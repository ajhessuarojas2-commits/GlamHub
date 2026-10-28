import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Link, Navigate, Route, Routes, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { api, money, serviceIcon, setCsrfToken, today } from './api.js';

const SessionContext = createContext(null);
const useSession = () => useContext(SessionContext);
const messages = {
  agregado: 'Servicio agregado al carrito.',
  servicio_creado: 'Servicio agregado al catálogo.',
  servicio_estado: 'Disponibilidad del servicio actualizada.',
  registrado: 'Usuario registrado correctamente.',
  actualizado: 'Usuario actualizado correctamente.',
  eliminado: 'Usuario eliminado correctamente.',
  rol_actualizado: 'Rol actualizado correctamente.',
  foto_guardada: 'Foto de perfil actualizada.',
  foto_quitada: 'Foto de perfil eliminada.',
  gasto_guardado: 'Gasto registrado y sumado al reporte.',
  cita_realizada: 'Cita marcada como realizada e ingreso confirmado.',
  cita_cancelada: 'Cita cancelada y su ingreso proyectado anulado.',
  confirmado: 'Pedido confirmado correctamente.',
};

function Notice({ children, error = false }) {
  if (!children) return null;
  return <p className={`message ${error ? 'error' : 'success'}`} role="status">{children}</p>;
}

function useNoticeFromQuery() {
  const [params] = useSearchParams();
  const key = params.get('mensaje');
  return messages[key] || '';
}

function App() {
  const [session, setSession] = useState({ loading: true, user: null, cartCount: 0 });
  const [error, setError] = useState('');
  const location = useLocation();

  const refreshSession = async () => {
    const data = await api('/session');
    setCsrfToken(data.csrfToken);
    setSession({ loading: false, user: data.user, cartCount: data.cartCount });
  };

  useEffect(() => {
    refreshSession().catch((err) => {
      setError(err.message);
      setSession({ loading: false, user: null, cartCount: 0 });
    });
  }, []);

  useEffect(() => { setError(''); }, [location.pathname]);

  const context = useMemo(() => ({
    ...session,
    setSession,
    refreshSession,
    setError,
  }), [session]);

  if (session.loading) return <main className="container"><p>Cargando Glam Hub…</p></main>;

  return (
    <SessionContext.Provider value={context}>
      <Navbar />
      {error && <div className="container"><Notice error>{error}</Notice></div>}
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/servicios" element={<Services />} />
        <Route path="/carrito" element={<Cart />} />
        <Route path="/login" element={<Login />} />
        <Route path="/registro" element={<Register />} />
        <Route path="/citas" element={<Appointments />} />
        <Route path="/usuarios" element={<Protected admin><Users /></Protected>} />
        <Route path="/usuarios/:id" element={<Protected><Profile /></Protected>} />
        <Route path="/finanzas" element={<Protected admin><Finance /></Protected>} />
        <Route path="*" element={<main className="container"><h1>Página no encontrada</h1><Link to="/">Volver al inicio</Link></main>} />
      </Routes>
    </SessionContext.Provider>
  );
}

function Navbar() {
  const { user, cartCount, setSession } = useSession();
  const location = useLocation();
  const navigate = useNavigate();
  const active = (path) => location.pathname === path ? { 'aria-current': 'page' } : {};

  async function logout() {
    try {
      await api('/auth/logout', { method: 'POST' });
      setCsrfToken('');
      setSession((current) => ({ ...current, user: null, cartCount: 0 }));
      navigate('/');
    } catch (error) {
      window.alert(error.message);
    }
  }

  return (
    <nav className="navbar" aria-label="Navegación principal">
      <div className="navbar-container">
        <Link className="logo" to="/">Glam Hub</Link>
        <div className="navbar-tools">
          <details className="nav-menu" data-admin-page={user?.isAdmin && ['/usuarios', '/finanzas'].includes(location.pathname) ? 'true' : undefined}>
            <summary aria-label="Abrir menú de navegación"><span>Menú</span><span className="nav-menu-chevron" aria-hidden="true" /></summary>
            <ul className="nav-menu-list">
              <li><Link to="/" {...active('/')}>Inicio</Link></li>
              <li><Link to="/servicios" {...active('/servicios')}>Servicios</Link></li>
              <li><Link to="/carrito" {...active('/carrito')}>Carrito ({cartCount})</Link></li>
              <li><Link to="/citas" {...active('/citas')}>Mis citas{user ? ` (${user.name})` : ''}</Link></li>
              {user?.isAdmin && <li className="nav-menu-divider"><Link to="/usuarios" {...active('/usuarios')}>Usuarios</Link></li>}
              {user?.isAdmin && <li><Link to="/finanzas" {...active('/finanzas')}>Finanzas</Link></li>}
              {user
                ? <li className="nav-menu-divider"><button className="nav-logout" type="button" onClick={logout}>Cerrar sesión</button></li>
                : <><li className="nav-menu-divider"><Link to="/login" {...active('/login')}>Iniciar sesión</Link></li><li><Link to="/registro" {...active('/registro')}>Registrarse</Link></li></>}
            </ul>
          </details>
          <Link className="profile-link" to={user ? `/usuarios/${user.id}` : '/login'} aria-label={user ? `Abrir perfil de ${user.name}` : 'Iniciar sesión'} title={user ? `Abrir perfil de ${user.name}` : 'Iniciar sesión'} {...(location.pathname.startsWith('/usuarios/') ? { 'aria-current': 'page' } : {})}>
            <span className="profile-avatar-icon" aria-hidden="true" />
            {user?.hasPhoto && <img className="profile-avatar-photo" src={`/api/users/${user.id}/photo`} alt="" />}
          </Link>
        </div>
      </div>
    </nav>
  );
}

function Protected({ children, admin = false }) {
  const { user } = useSession();
  const location = useLocation();
  if (!user) return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  if (admin && !user.isAdmin) return <Navigate to="/" replace />;
  return children;
}

function Home() {
  return (
    <main className="hero">
      <div className="overlay" />
      <div className="hero-content">
        <h1>Bienvenida a <span>Glam Hub</span></h1>
        <p>Donde tu belleza cobra vida con un toque de magia</p>
        <Link className="button" to="/registro">Registrar usuario</Link>
      </div>
    </main>
  );
}

function Services() {
  const { user, setSession, setError } = useSession();
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState(useNoticeFromQuery());
  const [form, setForm] = useState({ name: '', description: '', price: '', duration: '60' });

  async function load() {
    setLoading(true);
    try { setServices(await api('/services')); } catch (error) { setError(error.message); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  async function addService(event) {
    event.preventDefault();
    try {
      await api('/services', { method: 'POST', body: form });
      setForm({ name: '', description: '', price: '', duration: '60' });
      setNotice('Servicio agregado al catálogo.');
      await load();
    } catch (error) { setError(error.message); }
  }

  async function toggle(id) {
    try {
      await api(`/services/${id}`, { method: 'PATCH' });
      setNotice('Disponibilidad del servicio actualizada.');
      await load();
    } catch (error) { setError(error.message); }
  }

  async function addToCart(id) {
    try {
      await api('/cart/items', { method: 'POST', body: { serviceId: id } });
      setSession((current) => ({ ...current, cartCount: current.cartCount + 1 }));
      setNotice('Servicio agregado al carrito.');
    } catch (error) { setError(error.message); }
  }

  return (
    <main className="services-container">
      <header className="services-header"><h1>Nuestros servicios</h1><p>Servicios y tratamientos para cuidar tu belleza.</p><Notice>{notice}</Notice></header>
      {user?.isAdmin && <section className="service-admin-panel" aria-labelledby="service-admin-heading">
        <h2 id="service-admin-heading">Administrar catálogo</h2>
        <form className="service-admin-form" onSubmit={addService}>
          <div><label htmlFor="nuevo-servicio">Nombre</label><input id="nuevo-servicio" maxLength="100" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div><label htmlFor="descripcion-servicio">Descripción</label><input id="descripcion-servicio" maxLength="200" required value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
          <div><label htmlFor="precio-servicio">Precio COP</label><input id="precio-servicio" type="number" min="0" step="1" required value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} /></div>
          <div><label htmlFor="duracion-servicio">Duración (min)</label><input id="duracion-servicio" type="number" min="15" max="720" step="15" required value={form.duration} onChange={(e) => setForm({ ...form, duration: e.target.value })} /></div>
          <button type="submit">Agregar servicio</button>
        </form>
      </section>}
      {loading ? <p>Cargando servicios…</p> : !services.length ? <p className="services-empty">No hay servicios disponibles en este momento.</p> : (
        <div className="services-grid">
          {services.map((service) => <article className="service-card" key={service.id}>
            {user?.isAdmin && !Number(service.active) && <span className="service-tag service-inactive-tag">Retirado del catálogo</span>}
            <div className="service-icon" aria-hidden="true">{serviceIcon(service.name)}</div>
            <span className="service-tag">Servicio de belleza</span>
            <h2>{service.name}</h2><p>{service.description}</p>
            <div className="service-price">{money(service.price)}</div>
            {Number(service.active) === 1 && <form className="service-form" onSubmit={(e) => { e.preventDefault(); addToCart(service.id); }}><button className="service-add-button" type="submit">Agregar al carrito</button></form>}
            {user?.isAdmin && <form className="service-admin-toggle" onSubmit={(e) => { e.preventDefault(); toggle(service.id); }}><button type="submit">{Number(service.active) ? 'Retirar del catálogo' : 'Reactivar servicio'}</button></form>}
          </article>)}
        </div>
      )}
    </main>
  );
}

function Cart() {
  const { user, setSession, setError } = useSession();
  const [cart, setCart] = useState({ items: [], total: 0 });
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [notice, setNotice] = useState(useNoticeFromQuery());
  const [noticeError, setNoticeError] = useState(false);
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  async function load() {
    try { setCart(await api('/cart')); } catch (error) { setError(error.message); }
  }
  useEffect(() => { load(); }, []);

  async function remove(id) {
    try {
      await api(`/cart/items/${id}`, { method: 'DELETE' });
      setSession((current) => ({ ...current, cartCount: Math.max(0, current.cartCount - (cart.items.find((item) => item.id === id)?.quantity || 0)) }));
      await load();
    } catch (error) { setError(error.message); }
  }

  async function checkout(event) {
    event.preventDefault();
    setBusy(true);
    try {
      const { orderId } = await api('/cart/checkout', { method: 'POST', body: { date, time } });
      setSession((current) => ({ ...current, cartCount: 0 }));
      setNotice(`Pedido #${orderId} confirmado correctamente.`);
      await load();
    } catch (error) {
      setNotice(error.message);
      setNoticeError(true);
    } finally { setBusy(false); }
  }

  return (
    <main className="cart-container"><section className="cart-panel">
      <h1>Mi carrito</h1><Notice error={noticeError}>{notice}</Notice>
      {!cart.items.length ? <><p className="cart-empty">Tu carrito está vacío.</p><div className="cart-actions"><Link className="cart-action secondary" to="/servicios">Ver servicios</Link></div></> : <>
        <div className="cart-items">{cart.items.map((item) => <article className="cart-item" key={item.id}>
          <div className="cart-item-info"><strong>{item.name}</strong><p>{item.description}</p><span className="cart-quantity">Cantidad: {item.quantity}</span></div>
          <span className="cart-price">{money(item.subtotal)}</span>
          <button className="cart-remove" type="button" onClick={() => remove(item.id)}>Eliminar</button>
        </article>)}</div>
        <div className="cart-summary"><span>Total</span><span>{money(cart.total)}</span></div>
        {user ? <><div className="cart-account-summary"><strong>{user.name}</strong><span>{user.email}</span></div>
          <form className="cart-checkout-form" onSubmit={checkout}>
            <div className="cart-appointment-fields">
              <div><label htmlFor="fecha-cita">Fecha de la cita</label><input id="fecha-cita" type="date" min={today()} required value={date} onChange={(e) => setDate(e.target.value)} /></div>
              <div><label htmlFor="hora-cita">Hora de inicio</label><input id="hora-cita" type="time" step="1800" required value={time} onChange={(e) => setTime(e.target.value)} /></div>
            </div>
            <div className="cart-actions"><Link className="cart-action secondary" to="/servicios">Seguir comprando</Link><button className="cart-action" type="submit" disabled={busy}>{busy ? 'Guardando…' : 'Confirmar pedido'}</button></div>
          </form>
        </> : <><p className="cart-login-prompt">Inicia sesión para guardar la compra en tus citas.</p><div className="cart-actions"><Link className="cart-action secondary" to="/servicios">Seguir comprando</Link><Link className="cart-action" to="/login">Iniciar sesión para comprar</Link></div></>}
      </>}
    </section></main>
  );
}

function Login() {
  const { setSession, setError } = useSession();
  const [search] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const returnTo = location.state?.from || (['/servicios', '/carrito', '/citas', '/finanzas'].includes(search.get('retorno')) ? `/${search.get('retorno').replace('.php', '')}` : '/servicios');
  const [form, setForm] = useState({ email: '', password: '' });
  const [message, setMessage] = useState(search.get('mensaje') === 'sesion_requerida' ? 'Inicia sesión para confirmar tu compra.' : '');

  async function submit(event) {
    event.preventDefault();
    try {
      const data = await api('/auth/login', { method: 'POST', body: form });
      setCsrfToken(data.csrfToken);
      const session = await api('/session');
      setSession({ loading: false, user: session.user, cartCount: session.cartCount });
      navigate(returnTo, { replace: true });
    } catch (error) { setMessage(error.message); }
  }
  return <main className="auth-container"><section className="auth-panel">
    <h1>Iniciar sesión</h1><p>Ingresa para continuar en Glam Hub.</p>
    <Notice error>{message}</Notice>
    <form onSubmit={submit}>
      <label htmlFor="correo">Correo electrónico</label><input id="correo" type="email" autoComplete="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
      <label htmlFor="password">Contraseña</label><input id="password" type="password" autoComplete="current-password" required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
      <button className="auth-submit" type="submit">Ingresar</button>
    </form>
    <Link className="auth-register-link" to="/registro">¿No tienes una cuenta? Regístrate</Link>
  </section></main>;
}

function Register() {
  const [search] = useSearchParams();
  const id = search.get('id');
  const { user, setError } = useSession();
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '' });
  const [message, setMessage] = useState('');
  const [isError, setIsError] = useState(false);
  const navigate = useNavigate();
  useEffect(() => {
    if (!id) return;
    api(`/users/${id}`).then((data) => setForm({ name: data.name, email: data.email, phone: data.phone || '', password: '' }))
      .catch((error) => setError(error.message));
  }, [id]);

  if (id && (!user || (!user.isAdmin && Number(user.id) !== Number(id)))) return <Navigate to="/login" replace />;
  async function submit(event) {
    event.preventDefault();
    try {
      if (id) {
        await api(`/users/${id}`, { method: 'PATCH', body: form });
        navigate(user?.isAdmin ? '/usuarios?mensaje=actualizado' : `/usuarios/${id}`);
      } else {
        await api('/auth/register', { method: 'POST', body: form });
        if (user?.isAdmin) navigate('/usuarios?mensaje=registrado');
        else navigate('/login');
      }
    } catch (error) { setMessage(error.message); setIsError(true); }
  }
  return <main className="container form-container">
    <h1>{id ? 'Editar usuario' : 'Registrar usuario'}</h1><Notice error={isError}>{message}</Notice>
    <form onSubmit={submit}>
      <label htmlFor="nombre">Nombre completo</label><input id="nombre" maxLength="100" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
      <label htmlFor="correo">Correo electrónico</label><input id="correo" type="email" maxLength="150" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
      {!id && <><label htmlFor="contrasena">Contraseña</label><input id="contrasena" type="password" minLength="6" required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></>}
      <label htmlFor="telefono">Teléfono</label><input id="telefono" maxLength="30" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
      <div className="buttons"><button type="submit">{id ? 'Guardar cambios' : 'Registrar usuario'}</button><Link className="action-link secondary-link" to={user?.isAdmin ? '/usuarios' : '/'}>Cancelar</Link></div>
    </form>
  </main>;
}

function Appointments() {
  const { user, setError } = useSession();
  const [data, setData] = useState(null);
  useEffect(() => { if (user) api('/appointments').then(setData).catch((error) => setError(error.message)); }, [user]);
  if (!user) return <Navigate to="/login" replace />;
  return <main className="container account-container">
    <h1>Mis citas y compras</h1>
    <section className="account-details" aria-labelledby="account-heading"><h2 id="account-heading">Información de usuario</h2>
      {data && <dl><div><dt>Nombre</dt><dd>{data.user.name}</dd></div><div><dt>Correo</dt><dd>{data.user.email}</dd></div><div><dt>Teléfono</dt><dd>{data.user.phone || 'No registrado'}</dd></div></dl>}
    </section>
    <section className="account-appointments" aria-labelledby="appointments-heading"><h2 id="appointments-heading">Registros asociados a tu cuenta</h2>
      {!data ? <p>Cargando…</p> : !data.appointments.length ? <p className="empty">Todavía no tienes citas ni compras registradas.</p> : <div className="table-wrapper"><table><thead><tr><th>Fecha</th><th>Hora</th><th>Detalle</th><th>Duración</th><th>Estado</th><th>Pedido</th></tr></thead>
        <tbody>{data.appointments.map((item) => <tr key={item.id}><td>{new Date(`${String(item.date).slice(0, 10)}T00:00:00`).toLocaleDateString('es-CO')}</td><td>{String(item.time).slice(0, 5)}</td><td>{item.comment}</td><td>{item.duration ? String(item.duration).slice(0, 5) : 'Por definir'}</td><td>{item.status}</td><td>{item.orderId == null ? 'Cita' : `#${item.orderId}`}</td></tr>)}</tbody>
      </table></div>}
    </section>
  </main>;
}

function Users() {
  const [users, setUsers] = useState([]);
  const [error, setError] = useState('');
  const notice = useNoticeFromQuery();
  async function load() {
    try { setUsers(await api('/users')); } catch (err) { setError(err.message); }
  }
  useEffect(() => { load(); }, []);
  async function changeRole(id, role) {
    try { await api(`/users/${id}/role`, { method: 'PATCH', body: { role } }); await load(); }
    catch (err) { setError(err.message); }
  }
  async function remove(id) {
    if (!window.confirm('¿Seguro que deseas eliminar este usuario?')) return;
    try { await api(`/users/${id}`, { method: 'DELETE' }); await load(); }
    catch (err) { setError(err.message); }
  }
  return <main className="container users-container">
    <h1>Usuarios registrados</h1><Link className="action-link" to="/registro">Registrar usuario</Link>
    <Notice>{notice}</Notice><Notice error>{error}</Notice>
    {!users.length ? <p className="empty">No hay usuarios registrados.</p> : <div className="table-wrapper"><table className="users-table">
      <thead><tr><th>ID</th><th>Nombre</th><th>Correo</th><th>Teléfono</th><th>Rol</th><th>Acción</th></tr></thead>
      <tbody>{users.map((person) => <tr key={person.id}><td>{person.id}</td><td>{person.name}</td><td>{person.email}</td><td>{person.phone}</td><td>{person.role}</td>
        <td><div className="table-actions">
          <Link className="action-link" to={`/usuarios/${person.id}`}>Ver</Link>
          <Link className="action-link" to={`/registro?id=${person.id}`}>Editar</Link>
          <select aria-label={`Rol de ${person.name}`} value={person.role} onChange={(e) => changeRole(person.id, e.target.value)}>
            {['Cliente', 'Estilista', 'Administrador'].map((role) => <option key={role} value={role}>{role}</option>)}
          </select>
          <button type="button" onClick={() => remove(person.id)}>Eliminar</button>
        </div></td>
      </tr>)}</tbody>
    </table></div>}
  </main>;
}

function Profile() {
  const { user, setError, refreshSession } = useSession();
  const location = useLocation();
  const id = location.pathname.split('/').pop();
  const [profile, setProfile] = useState(null);
  const notice = useNoticeFromQuery();
  useEffect(() => { api(`/users/${id}`).then(setProfile).catch((error) => setError(error.message)); }, [id]);
  if (!user) return <Navigate to="/login" replace />;
  if (!profile) return <main className="container"><p>Cargando perfil…</p></main>;
  const owner = Number(user.id) === Number(id);

  async function upload(event) {
    event.preventDefault();
    const formData = new FormData();
    formData.append('photo', event.currentTarget.elements.photo.files[0]);
    try {
      await api(`/users/${id}/photo`, { method: 'POST', body: formData });
      await refreshSession();
      setProfile(await api(`/users/${id}`));
      window.history.replaceState({}, '', `/usuarios/${id}?mensaje=foto_guardada`);
    } catch (error) { setError(error.message); }
  }
  async function removePhoto() {
    try {
      await api(`/users/${id}/photo`, { method: 'DELETE' });
      await refreshSession();
      setProfile(await api(`/users/${id}`));
    } catch (error) { setError(error.message); }
  }

  return <main className="container account-container user-profile-container">
    <header className="user-profile-heading">
      <div className="user-profile-photo-wrap">{profile.photoType ? <img className="user-profile-photo" src={`/api/users/${id}/photo`} alt={`Foto de ${profile.name}`} /> : <span className="user-profile-photo-placeholder" aria-hidden="true" />}</div>
      <p className="user-profile-kicker">Cuenta Glam Hub</p><h1>Información del usuario</h1><p>Perfil, acceso y datos de contacto.</p>
    </header>
    <Notice>{notice}</Notice>
    <section className="profile-section" aria-labelledby="photo-heading"><h2 id="photo-heading">Foto de perfil</h2>
      <form className="profile-photo-form" onSubmit={upload}><label htmlFor="foto-perfil">Elige una imagen JPG, PNG o WebP</label><input id="foto-perfil" name="photo" type="file" accept="image/jpeg,image/png,image/webp" required /><button type="submit">Guardar foto</button></form>
      {profile.photoType && <form className="profile-photo-remove-form" onSubmit={(e) => { e.preventDefault(); removePhoto(); }}><button className="profile-photo-remove" type="submit">Quitar foto</button></form>}
    </section>
    <section className="profile-section" aria-labelledby="profile-heading"><h2 id="profile-heading">Perfil</h2><dl className="profile-data">
      <div><dt>ID de usuario</dt><dd>#{profile.id}</dd></div><div><dt>Nombre</dt><dd>{profile.name}</dd></div><div><dt>Correo electrónico</dt><dd>{profile.email}</dd></div><div><dt>Teléfono</dt><dd>{profile.phone || 'No registrado'}</dd></div>
    </dl></section>
    <section className="profile-section" aria-labelledby="account-heading"><h2 id="account-heading">Cuenta</h2><dl className="profile-data profile-data-compact"><div><dt>Rol</dt><dd>{profile.roles}</dd></div></dl><p className="profile-note">El rol define los accesos disponibles dentro de Glam Hub.</p></section>
    <section className="profile-section" aria-labelledby="privacy-heading"><h2 id="privacy-heading">Privacidad</h2><p>La contraseña nunca se muestra en esta página. Este perfil solo está disponible para su titular y para usuarios administradores.</p><p className="profile-note">Los datos de contacto se usan para identificar la cuenta y gestionar sus citas y pedidos.</p></section>
    <section className="profile-section" aria-labelledby="settings-heading"><h2 id="settings-heading">Configuración</h2><p>Actualiza el nombre, correo electrónico o teléfono asociados a esta cuenta.</p>
      <div className="profile-actions"><Link className="action-link secondary-link" to={user.isAdmin ? '/usuarios' : '/citas'}>Volver</Link><Link className="action-link" to={`/registro?id=${id}`}>Editar perfil</Link>{owner && <Link className="action-link profile-secondary-action" to="/citas">Mis citas</Link>}</div>
    </section>
  </main>;
}

function Finance() {
  const [data, setData] = useState({ reports: [], appointments: [] });
  const [error, setError] = useState('');
  const [notice, setNotice] = useState(useNoticeFromQuery());
  const [expense, setExpense] = useState({ name: '', category: 'Compra', amount: '', date: today() });
  async function load() {
    try { setData(await api('/finance')); } catch (err) { setError(err.message); }
  }
  useEffect(() => { load(); }, []);
  async function addExpense(event) {
    event.preventDefault();
    try {
      await api('/finance/expenses', { method: 'POST', body: expense });
      setNotice('Gasto registrado y sumado al reporte.');
      setExpense({ name: '', category: 'Compra', amount: '', date: today() });
      await load();
    } catch (err) { setError(err.message); }
  }
  async function action(id, actionName) {
    try {
      await api(`/finance/appointments/${id}`, { method: 'PATCH', body: { action: actionName } });
      setNotice(actionName === 'realizar' ? 'Cita marcada como realizada e ingreso confirmado.' : 'Cita cancelada y su ingreso proyectado anulado.');
      await load();
    } catch (err) { setError(err.message); }
  }
  return <main className="container finance-container">
    <h1>Finanzas y agenda</h1><Notice>{notice}</Notice><Notice error>{error}</Notice>
    <section className="finance-section"><h2>Registrar gasto</h2>
      <form className="finance-expense-form" onSubmit={addExpense}>
        <div><label htmlFor="gasto-nombre">Concepto</label><input id="gasto-nombre" maxLength="100" required value={expense.name} onChange={(e) => setExpense({ ...expense, name: e.target.value })} /></div>
        <div><label htmlFor="gasto-categoria">Categoría</label><select id="gasto-categoria" value={expense.category} onChange={(e) => setExpense({ ...expense, category: e.target.value })}>{['Compra', 'Mantenimiento', 'Operación', 'Otro'].map((value) => <option key={value}>{value}</option>)}</select></div>
        <div><label htmlFor="gasto-monto">Monto (COP)</label><input id="gasto-monto" type="number" min="1" step="1" required value={expense.amount} onChange={(e) => setExpense({ ...expense, amount: e.target.value })} /></div>
        <div><label htmlFor="gasto-fecha">Fecha</label><input id="gasto-fecha" type="date" max={today()} required value={expense.date} onChange={(e) => setExpense({ ...expense, date: e.target.value })} /></div>
        <button type="submit">Guardar gasto</button>
      </form>
    </section>
    <section className="finance-section"><h2>Resumen mensual</h2><div className="table-wrapper"><table>
      <thead><tr><th>Periodo</th><th>Ingresos confirmados</th><th>Gastos</th><th>Ganancia real</th><th>Ingresos estimados</th><th>Ganancia estimada</th></tr></thead>
      <tbody>{data.reports.map((report) => <tr key={report.period}><td>{report.period}</td><td>{money(report.income)}</td><td>{money(report.expenses)}</td><td>{money(report.net)}</td><td>{money(report.estimatedIncome)}</td><td>{money(report.estimatedProfit)}</td></tr>)}</tbody>
    </table></div></section>
    <section className="finance-section"><h2>Citas de pedidos</h2><div className="table-wrapper"><table>
      <thead><tr><th>Fecha</th><th>Hora</th><th>Cliente</th><th>Detalle</th><th>Total</th><th>Estado</th><th>Ingreso</th><th>Acción</th></tr></thead>
      <tbody>{data.appointments.map((item) => <tr key={item.id}><td>{String(item.date).slice(0, 10)}</td><td>{String(item.time).slice(0, 5)}</td><td>{item.customer || 'Cuenta eliminada'}</td><td>{item.comment}</td><td>{money(item.total)}</td><td>{item.status}</td><td>{item.financeStatus || 'Sin movimiento'}</td>
        <td>{['Pendiente', 'Confirmada'].includes(item.status) ? <div className="finance-row-action"><button type="button" onClick={() => action(item.id, 'realizar')}>Realizada</button><button className="finance-cancel" type="button" onClick={() => action(item.id, 'cancelar')}>Cancelar</button></div> : 'Sin acciones'}</td>
      </tr>)}</tbody>
    </table></div></section>
  </main>;
}

export default App;
