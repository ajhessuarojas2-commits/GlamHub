import 'dotenv/config';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import session from 'express-session';
import MySQLStoreFactory from 'express-mysql-session';
import bcrypt from 'bcryptjs';
import multer from 'multer';
import { pool, transaction } from './db.js';

const app = express();
const port = Number(process.env.PORT || 3001);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_req, file, callback) => {
    callback(null, ['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype));
  },
});

const MySQLStore = MySQLStoreFactory(session);
const sessionStore = new MySQLStore({}, pool);
app.disable('x-powered-by');
app.use(express.json({ limit: '100kb' }));
app.use(session({
  name: 'glamhub.sid',
  secret: process.env.SESSION_SECRET || 'development-secret-change-before-deploying',
  store: sessionStore,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 1000 * 60 * 60 * 8,
  },
}));

const asyncRoute = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
const fail = (status, message) => Object.assign(new Error(message), { status });
const userDTO = (user) => user ? ({
  id: Number(user.id),
  name: user.name,
  email: user.email,
  phone: user.phone || '',
  isAdmin: Boolean(user.isAdmin),
  hasPhoto: Boolean(user.photoType),
}) : null;

async function getUser(id) {
  const [rows] = await pool.execute(
    `SELECT U.IdUsuario AS id, U.NombreUsuario AS name, U.CorreoUsuario AS email,
      U.TelefonoUsuario AS phone, U.TipoFotoPerfil AS photoType,
      EXISTS (SELECT 1 FROM Rol R WHERE R.IdUsuario = U.IdUsuario AND R.NombreRol = 'Administrador') AS isAdmin
     FROM Usuarios U WHERE U.IdUsuario = ?`,
    [id],
  );
  return rows[0] || null;
}

function localISODate() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function requireUser(req, _res, next) {
  if (!req.session.userId) return next(fail(401, 'Inicia sesión para continuar.'));
  next();
}

const requireAdmin = asyncRoute(async (req, _res, next) => {
  if (!req.session.userId) throw fail(401, 'Inicia sesión para continuar.');
  const [rows] = await pool.execute(
    "SELECT 1 FROM Rol WHERE IdUsuario = ? AND NombreRol = 'Administrador' LIMIT 1",
    [req.session.userId],
  );
  if (!rows.length) throw fail(403, 'Solo un administrador puede realizar esta acción.');
  next();
});

function requireCsrf(req, _res, next) {
  if (!req.session.csrfToken || req.get('X-CSRF-Token') !== req.session.csrfToken) {
    return next(fail(403, 'La sesión expiró. Recarga la página e inténtalo de nuevo.'));
  }
  next();
}

function csrfToken(req) {
  if (!req.session.csrfToken) req.session.csrfToken = crypto.randomBytes(32).toString('hex');
  return req.session.csrfToken;
}

app.get('/api/session', asyncRoute(async (req, res) => {
  const user = req.session.userId ? await getUser(req.session.userId) : null;
  if (req.session.userId && !user) req.session.destroy(() => {});
  res.json({
    user: userDTO(user),
    csrfToken: csrfToken(req),
    cartCount: Object.values(req.session.cart || {}).reduce((sum, qty) => sum + Number(qty || 0), 0),
  });
}));

app.post('/api/auth/login', requireCsrf, asyncRoute(async (req, res) => {
  const email = String(req.body.email || '').trim();
  const password = String(req.body.password || '');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !password) throw fail(400, 'Ingresa un correo y una contraseña válidos.');
  const [rows] = await pool.execute(
    `SELECT U.IdUsuario, U.NombreUsuario, U.CorreoUsuario, U.PasswordUsuario,
      EXISTS (SELECT 1 FROM Rol R WHERE R.IdUsuario = U.IdUsuario AND R.NombreRol = 'Administrador') AS isAdmin
     FROM Usuarios U WHERE U.CorreoUsuario = ? LIMIT 1`,
    [email],
  );
  const account = rows[0];
  if (!account) throw fail(401, 'Correo o contraseña incorrectos.');
  const storedPassword = String(account.PasswordUsuario);
  const isHash = /^\$2[aby]\$/.test(storedPassword);
  const valid = isHash ? await bcrypt.compare(password, storedPassword) : storedPassword === password;
  if (!valid) throw fail(401, 'Correo o contraseña incorrectos.');
  if (!isHash) {
    await pool.execute('UPDATE Usuarios SET PasswordUsuario = ? WHERE IdUsuario = ?', [
      await bcrypt.hash(password, 12), account.IdUsuario,
    ]);
  }
  const cart = req.session.cart || {};
  await new Promise((resolve, reject) => req.session.regenerate((error) => error ? reject(error) : resolve()));
  req.session.userId = Number(account.IdUsuario);
  req.session.cart = cart;
  csrfToken(req);
  res.json({ user: userDTO(await getUser(req.session.userId)), csrfToken: req.session.csrfToken });
}));

app.post('/api/auth/logout', requireCsrf, (req, res, next) => {
  req.session.destroy((error) => {
    if (error) return next(error);
    res.clearCookie('glamhub.sid');
    res.json({ ok: true });
  });
});

async function createUser({ name, email, password, phone = '' }) {
  const cleanName = String(name || '').trim();
  const cleanEmail = String(email || '').trim();
  if (!cleanName || cleanName.length > 100 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail) || cleanEmail.length > 150) {
    throw fail(400, 'Completa correctamente el nombre y el correo.');
  }
  if (String(phone).length > 30) throw fail(400, 'El teléfono no puede superar 30 caracteres.');
  if (String(password || '').length < 6) throw fail(400, 'La contraseña debe tener al menos 6 caracteres.');
  try {
    return await transaction(async (connection) => {
      const [result] = await connection.execute(
        'INSERT INTO Usuarios (NombreUsuario, CorreoUsuario, PasswordUsuario, TelefonoUsuario) VALUES (?, ?, ?, ?)',
        [cleanName, cleanEmail, await bcrypt.hash(String(password), 12), phone || null],
      );
      await connection.execute("INSERT INTO Rol (IdUsuario, NombreRol) VALUES (?, 'Cliente')", [result.insertId]);
      return result.insertId;
    });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') throw fail(409, 'Ya existe una cuenta con ese correo electrónico.');
    throw error;
  }
}

app.post('/api/auth/register', requireCsrf, asyncRoute(async (req, res) => {
  await createUser(req.body);
  res.status(201).json({ ok: true });
}));

app.get('/api/services', asyncRoute(async (req, res) => {
  const admin = req.session.userId ? await isAdmin(req.session.userId) : false;
  const [rows] = await pool.query(
    `SELECT IdServicio AS id, Nombre AS name, Descripcion AS description, Precio AS price,
      DuracionMinutos AS duration, Activo AS active
     FROM Servicio ${admin ? '' : 'WHERE Activo = 1 '} ORDER BY Activo DESC, Nombre ASC`,
  );
  res.json(rows);
}));

async function isAdmin(userId) {
  const [rows] = await pool.execute(
    "SELECT 1 FROM Rol WHERE IdUsuario = ? AND NombreRol = 'Administrador' LIMIT 1",
    [userId],
  );
  return Boolean(rows.length);
}

app.post('/api/services', requireCsrf, requireAdmin, asyncRoute(async (req, res) => {
  const { name, description } = req.body;
  const price = Number(req.body.price);
  const duration = Number(req.body.duration);
  if (!String(name || '').trim() || String(name).length > 100 || !String(description || '').trim()
      || String(description).length > 200 || !Number.isInteger(price) || price < 0
      || !Number.isInteger(duration) || duration < 15 || duration > 720) {
    throw fail(400, 'Revisa los datos del servicio.');
  }
  await pool.execute(
    'INSERT INTO Servicio (Nombre, Descripcion, Precio, DuracionMinutos, Activo) VALUES (?, ?, ?, ?, 1)',
    [name.trim(), description.trim(), price, duration],
  );
  res.status(201).json({ ok: true });
}));

app.patch('/api/services/:id', requireCsrf, requireAdmin, asyncRoute(async (req, res) => {
  const id = positiveId(req.params.id);
  const [result] = await pool.execute('UPDATE Servicio SET Activo = 1 - Activo WHERE IdServicio = ?', [id]);
  if (!result.affectedRows) throw fail(404, 'No se encontró el servicio.');
  res.json({ ok: true });
}));

function positiveId(value) {
  const id = Number(value);
  if (!Number.isInteger(id) || id < 1) throw fail(400, 'Identificador inválido.');
  return id;
}

function currentCart(req) {
  if (!req.session.cart) req.session.cart = {};
  return req.session.cart;
}

app.get('/api/cart', asyncRoute(async (req, res) => {
  const cart = currentCart(req);
  const ids = Object.keys(cart).map(Number).filter((id) => Number.isInteger(id) && id > 0);
  let items = [];
  if (ids.length) {
    const [rows] = await pool.query(
      `SELECT IdServicio AS id, Nombre AS name, Descripcion AS description, Precio AS price
       FROM Servicio WHERE Activo = 1 AND IdServicio IN (${ids.map(() => '?').join(',')})`,
      ids,
    );
    items = rows.map((item) => {
      const quantity = Math.max(0, Number(cart[item.id]) || 0);
      return { ...item, quantity, subtotal: Number(item.price) * quantity };
    }).filter((item) => item.quantity > 0);
  }
  const user = req.session.userId ? await getUser(req.session.userId) : null;
  res.json({ items, total: items.reduce((sum, item) => sum + item.subtotal, 0), user: userDTO(user) });
}));

app.post('/api/cart/items', requireCsrf, asyncRoute(async (req, res) => {
  const id = positiveId(req.body.serviceId);
  const [rows] = await pool.execute('SELECT 1 FROM Servicio WHERE IdServicio = ? AND Activo = 1', [id]);
  if (!rows.length) throw fail(404, 'Ese servicio ya no está disponible.');
  const cart = currentCart(req);
  cart[id] = Math.min(20, Number(cart[id] || 0) + 1);
  res.json({ ok: true });
}));

app.delete('/api/cart/items/:id', requireCsrf, (req, res, next) => {
  try {
    delete currentCart(req)[positiveId(req.params.id)];
    res.json({ ok: true });
  } catch (error) { next(error); }
});

app.post('/api/cart/checkout', requireCsrf, requireUser, asyncRoute(async (req, res) => {
  const { date, time } = req.body;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date)) || !/^\d{2}:\d{2}$/.test(String(time))
      || date < localISODate() || Number(time.slice(3)) % 30 !== 0
      || (date === localISODate() && time <= new Date().toTimeString().slice(0, 5))) {
    throw fail(400, 'Selecciona una fecha actual o futura y una hora válida.');
  }
  const cart = currentCart(req);
  const cartIds = Object.keys(cart).map(Number).filter((id) => Number.isInteger(id) && id > 0 && Number(cart[id]) > 0);
  if (!cartIds.length) throw fail(400, 'Tu carrito está vacío.');
  const orderId = await transaction(async (connection) => {
    const [users] = await connection.execute(
      'SELECT IdUsuario, NombreUsuario, CorreoUsuario, TelefonoUsuario FROM Usuarios WHERE IdUsuario = ?',
      [req.session.userId],
    );
    const user = users[0];
    if (!user) throw fail(401, 'Inicia sesión para continuar.');
    const lines = [];
    for (const id of cartIds) {
      const [services] = await connection.execute(
        'SELECT IdServicio, Nombre, Precio, DuracionMinutos FROM Servicio WHERE IdServicio = ? AND Activo = 1',
        [id],
      );
      if (services[0]) lines.push({ ...services[0], quantity: Number(cart[id]) });
    }
    if (!lines.length) throw fail(400, 'Tu carrito no contiene servicios válidos.');
    const total = lines.reduce((sum, line) => sum + Number(line.Precio) * line.quantity, 0);
    const duration = lines.reduce((sum, line) => sum + Number(line.DuracionMinutos) * line.quantity, 0);
    const startMinutes = Number(time.slice(0, 2)) * 60 + Number(time.slice(3));
    if (duration < 1 || duration > 720 || startMinutes + duration >= 1440) {
      throw fail(400, 'La duración del pedido no cabe en un mismo día de agenda.');
    }
    const endTime = new Date(Date.UTC(2000, 0, 1, 0, startMinutes + duration)).toISOString().slice(11, 19);
    const [conflicts] = await connection.execute(
      `SELECT COUNT(*) AS count FROM Cita WHERE Fecha = ?
       AND (Estado IS NULL OR Estado NOT IN ('Cancelada', 'Anulada'))
       AND TIME_TO_SEC(Hora) < TIME_TO_SEC(?)
       AND TIME_TO_SEC(ADDTIME(Hora, SEC_TO_TIME(COALESCE(TIME_TO_SEC(Duracion), 3600)))) > TIME_TO_SEC(?)`,
      [date, endTime, `${time}:00`],
    );
    if (Number(conflicts[0].count)) throw fail(409, 'Ese horario ya no está disponible. Elige otro turno.');
    const [order] = await connection.execute(
      'INSERT INTO Pedido (IdUsuario, NombreCliente, CorreoCliente, TelefonoCliente, Total) VALUES (?, ?, ?, ?, ?)',
      [user.IdUsuario, user.NombreUsuario, user.CorreoUsuario, user.TelefonoUsuario || null, total],
    );
    for (const line of lines) {
      await connection.execute(
        'INSERT INTO DetallePedido (IdPedido, IdServicio, NombreServicio, PrecioUnitario, Cantidad) VALUES (?, ?, ?, ?, ?)',
        [order.insertId, line.IdServicio, line.Nombre, line.Precio, line.quantity],
      );
    }
    const detail = lines.map((line) => `${line.Nombre} x ${line.quantity}`).join(', ');
    await connection.execute(
      `INSERT INTO Cita (IdUsuario, IdPedido, Fecha, Hora, Estado, Comentario, Duracion)
       VALUES (?, ?, ?, ?, 'Pendiente', ?, SEC_TO_TIME(?))`,
      [user.IdUsuario, order.insertId, date, `${time}:00`, `Pedido #${order.insertId} - ${detail}`, duration * 60],
    );
    await connection.execute(
      `INSERT INTO Finanzas (IdUsuario, IdPedido, Transaccion, TipoIngreso, Nombre, Monto, Fecha, Estado)
       VALUES (?, ?, 'Ingreso', 'Servicio', ?, ?, ?, 'Proyectado')`,
      [user.IdUsuario, order.insertId, `Pedido #${order.insertId}`, total, date],
    );
    return order.insertId;
  });
  req.session.cart = {};
  res.status(201).json({ orderId });
}));

app.get('/api/appointments', requireUser, asyncRoute(async (req, res) => {
  const [userRows] = await pool.execute(
    'SELECT IdUsuario AS id, NombreUsuario AS name, CorreoUsuario AS email, TelefonoUsuario AS phone FROM Usuarios WHERE IdUsuario = ?',
    [req.session.userId],
  );
  if (!userRows[0]) throw fail(401, 'La cuenta ya no existe.');
  const [appointments] = await pool.execute(
    `SELECT IdCita AS id, IdPedido AS orderId, Fecha AS date, Hora AS time, Estado AS status,
      Comentario AS comment, Duracion AS duration FROM Cita WHERE IdUsuario = ?
     ORDER BY Fecha DESC, Hora DESC, IdCita DESC`,
    [req.session.userId],
  );
  res.json({ user: userRows[0], appointments });
}));

app.get('/api/users', requireUser, requireAdmin, asyncRoute(async (_req, res) => {
  const [users] = await pool.query(
    `SELECT U.IdUsuario AS id, U.NombreUsuario AS name, U.CorreoUsuario AS email,
      U.TelefonoUsuario AS phone,
      COALESCE((SELECT R.NombreRol FROM Rol R WHERE R.IdUsuario = U.IdUsuario
        ORDER BY (R.NombreRol = 'Administrador') DESC LIMIT 1), 'Sin rol') AS role
     FROM Usuarios U ORDER BY U.IdUsuario ASC`,
  );
  res.json(users);
}));

app.patch('/api/users/:id', requireUser, requireCsrf, asyncRoute(async (req, res) => {
  const id = positiveId(req.params.id);
  const admin = await isAdmin(req.session.userId);
  if (!admin && Number(req.session.userId) !== id) throw fail(403, 'No tienes permiso para editar esta cuenta.');
  const name = String(req.body.name || '').trim();
  const email = String(req.body.email || '').trim();
  const phone = String(req.body.phone || '').trim();
  if (!name || name.length > 100 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 150 || phone.length > 30) {
    throw fail(400, 'Completa correctamente los datos.');
  }
  try {
    const [result] = await pool.execute(
      'UPDATE Usuarios SET NombreUsuario = ?, CorreoUsuario = ?, TelefonoUsuario = ? WHERE IdUsuario = ?',
      [name, email, phone || null, id],
    );
    if (!result.affectedRows) throw fail(404, 'No se encontró el usuario.');
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') throw fail(409, 'Ya existe una cuenta con ese correo electrónico.');
    throw error;
  }
  res.json({ ok: true });
}));

app.patch('/api/users/:id/role', requireUser, requireCsrf, requireAdmin, asyncRoute(async (req, res) => {
  const id = positiveId(req.params.id);
  const role = String(req.body.role || '');
  if (!['Cliente', 'Estilista', 'Administrador'].includes(role)) throw fail(400, 'Rol inválido.');
  await transaction(async (connection) => {
    const [target] = await connection.execute(
      "SELECT COUNT(*) AS count FROM Rol WHERE IdUsuario = ? AND NombreRol = 'Administrador'",
      [id],
    );
    if (Number(target[0].count) && role !== 'Administrador') {
      const [admins] = await connection.query("SELECT COUNT(DISTINCT IdUsuario) AS count FROM Rol WHERE NombreRol = 'Administrador'");
      if (Number(admins[0].count) <= 1) throw fail(400, 'Debe quedar al menos un administrador activo.');
    }
    await connection.execute('DELETE FROM Rol WHERE IdUsuario = ?', [id]);
    await connection.execute('INSERT INTO Rol (IdUsuario, NombreRol) VALUES (?, ?)', [id, role]);
  });
  if (id === Number(req.session.userId)) req.session.isAdmin = role === 'Administrador';
  res.json({ ok: true });
}));

app.delete('/api/users/:id', requireUser, requireCsrf, requireAdmin, asyncRoute(async (req, res) => {
  const id = positiveId(req.params.id);
  if (id === Number(req.session.userId)) throw fail(400, 'No puedes eliminar tu propia cuenta desde esta sesión.');
  await transaction(async (connection) => {
    const [target] = await connection.execute(
      "SELECT COUNT(*) AS count FROM Rol WHERE IdUsuario = ? AND NombreRol = 'Administrador'",
      [id],
    );
    if (Number(target[0].count)) {
      const [admins] = await connection.query("SELECT COUNT(DISTINCT IdUsuario) AS count FROM Rol WHERE NombreRol = 'Administrador'");
      if (Number(admins[0].count) <= 1) throw fail(400, 'Debe quedar al menos un administrador activo.');
    }
    const [result] = await connection.execute('DELETE FROM Usuarios WHERE IdUsuario = ?', [id]);
    if (!result.affectedRows) throw fail(404, 'No se encontró el usuario.');
  });
  res.json({ ok: true });
}));

app.get('/api/users/:id', requireUser, asyncRoute(async (req, res) => {
  const id = positiveId(req.params.id);
  const admin = await isAdmin(req.session.userId);
  if (!admin && Number(req.session.userId) !== id) throw fail(403, 'No tienes permiso para consultar este perfil.');
  const [rows] = await pool.execute(
    `SELECT U.IdUsuario AS id, U.NombreUsuario AS name, U.CorreoUsuario AS email,
      U.TelefonoUsuario AS phone, U.TipoFotoPerfil AS photoType,
      GROUP_CONCAT(R.NombreRol ORDER BY R.NombreRol SEPARATOR ', ') AS roles
     FROM Usuarios U LEFT JOIN Rol R ON R.IdUsuario = U.IdUsuario
     WHERE U.IdUsuario = ? GROUP BY U.IdUsuario`,
    [id],
  );
  if (!rows[0]) throw fail(404, 'No se encontró el usuario solicitado.');
  res.json({ ...rows[0], roles: rows[0].roles || 'Sin rol asignado' });
}));

app.post('/api/users/:id/photo', requireUser, requireCsrf, upload.single('photo'), asyncRoute(async (req, res) => {
  const id = positiveId(req.params.id);
  const admin = await isAdmin(req.session.userId);
  if (!admin && Number(req.session.userId) !== id) throw fail(403, 'No tienes permiso para cambiar esta foto.');
  if (!req.file || !['image/jpeg', 'image/png', 'image/webp'].includes(req.file.mimetype)) {
    throw fail(400, 'Usa una imagen JPG, PNG o WebP de hasta 2 MB.');
  }
  await pool.execute(
    'UPDATE Usuarios SET FotoPerfil = ?, TipoFotoPerfil = ? WHERE IdUsuario = ?',
    [req.file.buffer, req.file.mimetype, id],
  );
  res.json({ ok: true });
}));

app.delete('/api/users/:id/photo', requireUser, requireCsrf, asyncRoute(async (req, res) => {
  const id = positiveId(req.params.id);
  const admin = await isAdmin(req.session.userId);
  if (!admin && Number(req.session.userId) !== id) throw fail(403, 'No tienes permiso para cambiar esta foto.');
  await pool.execute('UPDATE Usuarios SET FotoPerfil = NULL, TipoFotoPerfil = NULL WHERE IdUsuario = ?', [id]);
  res.json({ ok: true });
}));

app.get('/api/users/:id/photo', requireUser, asyncRoute(async (req, res) => {
  const id = positiveId(req.params.id);
  const admin = await isAdmin(req.session.userId);
  if (!admin && Number(req.session.userId) !== id) throw fail(403, 'No tienes permiso para consultar esta foto.');
  const [rows] = await pool.execute('SELECT FotoPerfil, TipoFotoPerfil FROM Usuarios WHERE IdUsuario = ?', [id]);
  if (!rows[0]?.FotoPerfil || !['image/jpeg', 'image/png', 'image/webp'].includes(rows[0].TipoFotoPerfil)) return res.sendStatus(404);
  res.set({ 'Content-Type': rows[0].TipoFotoPerfil, 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'private, no-store' });
  res.end(rows[0].FotoPerfil);
}));

app.get('/api/finance', requireUser, requireAdmin, asyncRoute(async (_req, res) => {
  const [reports] = await pool.query(
    `SELECT DATE_FORMAT(Fecha, '%Y-%m') AS period,
      SUM(CASE WHEN Transaccion = 'Ingreso' AND Estado = 'Confirmado' THEN Monto ELSE 0 END) AS income,
      SUM(CASE WHEN Transaccion = 'Gasto' AND Estado = 'Confirmado' THEN Monto ELSE 0 END) AS expenses,
      SUM(CASE WHEN Estado = 'Confirmado' AND Transaccion = 'Ingreso' THEN Monto
        WHEN Estado = 'Confirmado' AND Transaccion = 'Gasto' THEN -Monto ELSE 0 END) AS net,
      SUM(CASE WHEN Transaccion = 'Ingreso' AND Estado IN ('Proyectado', 'Confirmado') THEN Monto ELSE 0 END) AS estimatedIncome,
      SUM(CASE WHEN Transaccion = 'Ingreso' AND Estado IN ('Proyectado', 'Confirmado') THEN Monto ELSE 0 END)
        - SUM(CASE WHEN Transaccion = 'Gasto' AND Estado = 'Confirmado' THEN Monto ELSE 0 END) AS estimatedProfit
     FROM Finanzas GROUP BY YEAR(Fecha), MONTH(Fecha) ORDER BY period DESC`,
  );
  const [appointments] = await pool.query(
    `SELECT C.IdCita AS id, C.IdPedido AS orderId, C.Fecha AS date, C.Hora AS time,
      C.Duracion AS duration, C.Estado AS status, C.Comentario AS comment, P.Total AS total,
      U.NombreUsuario AS customer,
      (SELECT F.Estado FROM Finanzas F WHERE F.IdPedido = C.IdPedido AND F.Transaccion = 'Ingreso' LIMIT 1) AS financeStatus
     FROM Cita C LEFT JOIN Pedido P ON P.IdPedido = C.IdPedido
     LEFT JOIN Usuarios U ON U.IdUsuario = C.IdUsuario
     WHERE C.IdPedido IS NOT NULL ORDER BY C.Fecha DESC, C.Hora DESC`,
  );
  res.json({ reports, appointments });
}));

app.post('/api/finance/expenses', requireUser, requireCsrf, requireAdmin, asyncRoute(async (req, res) => {
  const name = String(req.body.name || '').trim();
  const category = String(req.body.category || '');
  const amount = Number(req.body.amount);
  const date = String(req.body.date || '');
  if (!name || name.length > 100 || !['Compra', 'Mantenimiento', 'Operación', 'Otro'].includes(category)
      || !Number.isInteger(amount) || amount < 1 || !/^\d{4}-\d{2}-\d{2}$/.test(date)
      || date > localISODate()) throw fail(400, 'Revisa los datos del gasto.');
  await pool.execute(
    "INSERT INTO Finanzas (IdUsuario, Transaccion, TipoIngreso, Nombre, Monto, Fecha, Estado) VALUES (?, 'Gasto', ?, ?, ?, ?, 'Confirmado')",
    [req.session.userId, category, name, amount, date],
  );
  res.status(201).json({ ok: true });
}));

app.patch('/api/finance/appointments/:id', requireUser, requireCsrf, requireAdmin, asyncRoute(async (req, res) => {
  const id = positiveId(req.params.id);
  const action = String(req.body.action || '');
  if (!['realizar', 'cancelar'].includes(action)) throw fail(400, 'Acción inválida.');
  await transaction(async (connection) => {
    const [rows] = await connection.execute(
      'SELECT IdCita, IdPedido, Estado, Fecha, Hora, Duracion FROM Cita WHERE IdCita = ? FOR UPDATE',
      [id],
    );
    const appointment = rows[0];
    if (!appointment || !['Pendiente', 'Confirmada'].includes(appointment.Estado) || appointment.IdPedido === null) {
      throw fail(400, 'No se pudo completar esa acción.');
    }
    if (action === 'realizar') {
      const [durHours, durMinutes, durSeconds] = String(appointment.Duracion || '01:00:00').split(':').map(Number);
      const finish = new Date(`${String(appointment.Fecha).slice(0, 10)}T${appointment.Hora}Z`);
      finish.setSeconds(finish.getSeconds() + durHours * 3600 + durMinutes * 60 + durSeconds);
      if (finish > new Date()) throw fail(400, 'El ingreso solo se confirma después de terminar el servicio.');
      await connection.execute("UPDATE Cita SET Estado = 'Realizada' WHERE IdCita = ?", [id]);
      await connection.execute("UPDATE Pedido SET Estado = 'Realizado' WHERE IdPedido = ?", [appointment.IdPedido]);
      await connection.execute(
        `INSERT INTO Finanzas (IdUsuario, IdPedido, Transaccion, TipoIngreso, Nombre, Monto, Fecha, Estado)
         SELECT IdUsuario, IdPedido, 'Ingreso', 'Servicio', CONCAT('Pedido #', IdPedido), Total, CURRENT_DATE, 'Confirmado'
         FROM Pedido WHERE IdPedido = ? ON DUPLICATE KEY UPDATE Estado = 'Confirmado', Fecha = CURRENT_DATE`,
        [appointment.IdPedido],
      );
    } else {
      await connection.execute("UPDATE Cita SET Estado = 'Cancelada' WHERE IdCita = ?", [id]);
      await connection.execute("UPDATE Pedido SET Estado = 'Cancelado' WHERE IdPedido = ?", [appointment.IdPedido]);
      await connection.execute("UPDATE Finanzas SET Estado = 'Anulado' WHERE IdPedido = ? AND Transaccion = 'Ingreso'", [appointment.IdPedido]);
    }
  });
  res.json({ ok: true });
}));

const clientDist = path.resolve(__dirname, '../dist');
app.use(express.static(clientDist));
app.get('*', (_req, res, next) => {
  if (_req.path.startsWith('/api/')) return next(fail(404, 'Ruta API no encontrada.'));
  res.sendFile(path.join(clientDist, 'index.html'), (error) => error && next(error));
});

app.use((error, _req, res, _next) => {
  const status = error.status || (error instanceof multer.MulterError ? 400 : 500);
  if (status >= 500) console.error(error);
  res.status(status).json({ error: status === 500 ? 'Ocurrió un error inesperado.' : error.message });
});

app.listen(port, () => console.log(`Glam Hub API disponible en http://localhost:${port}`));
