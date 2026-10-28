DROP DATABASE IF EXISTS GlamHub;
CREATE DATABASE GlamHub CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE GlamHub;

CREATE TABLE Usuarios (
 IdUsuario INT AUTO_INCREMENT PRIMARY KEY,
 NombreUsuario VARCHAR(100) NOT NULL,
 CorreoUsuario VARCHAR(150) NOT NULL UNIQUE,
 PasswordUsuario VARCHAR(255) NOT NULL,
 TelefonoUsuario VARCHAR(30),
 FotoPerfil MEDIUMBLOB NULL,
 TipoFotoPerfil VARCHAR(30) NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO Usuarios (NombreUsuario,CorreoUsuario,PasswordUsuario,TelefonoUsuario) VALUES
('Maria Rodriguez','maria.rodriguez@gmail.com','Maria123','3001234567'),
('Carlos Martinez','carlos.martinez@gmail.com','Carlos123','3012345678'),
('Laura Gomez','laura.gomez@gmail.com','Laura123','3023456789'),
('Andres Perez','andres.perez@gmail.com','Andres123','3034567890'),
('Sofia Hernandez','sofia.hernandez@gmail.com','Sofia123','3045678901'),
('Juan Rodriguez','juan.rodriguez@gmail.com','Juan123','3056789012'),
('Valentina Torres','valentina.torres@gmail.com','Valentina123','3067890123'),
('Diego Ramirez','diego.ramirez@gmail.com','Diego123','3078901234'),
('Camila Castro','camila.castro@gmail.com','Camila123','3089012345'),
('Sebastian Morales','sebastian.morales@gmail.com','Sebastian123','3090123456'),
('Natalia Vargas','natalia.vargas@gmail.com','Natalia123','3101234567'),
('Felipe Rojas','felipe.rojas@gmail.com','Felipe123','3112345678'),
('Daniela Suarez','daniela.suarez@gmail.com','Daniela123','3123456789'),
('Mateo Castillo','mateo.castillo@gmail.com','Mateo123','3134567890'),
('Paula Mendoza','paula.mendoza@gmail.com','Paula123','3145678901');

CREATE TABLE Cita (
 IdCita INT AUTO_INCREMENT PRIMARY KEY,
 IdUsuario INT,
 IdPedido INT NULL,
 Fecha DATE,
 Hora TIME,
 Estado VARCHAR(30),
 Comentario TEXT,
 Duracion TIME,
 INDEX idx_cita_fecha_estado_hora (Fecha, Estado, Hora),
 CONSTRAINT fk_cita_usuario FOREIGN KEY (IdUsuario)
  REFERENCES Usuarios(IdUsuario) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO Cita (IdCita,IdUsuario,Fecha,Hora,Estado,Comentario,Duracion) VALUES
(1,1,'2026-08-20','09:00:00','Confirmada','Corte y peinado','01:00:00'),
(2,2,'2026-08-20','10:30:00','Pendiente','Corte de cabello','00:45:00'),
(3,3,'2026-08-20','12:00:00','Confirmada','Manicure','01:00:00'),
(4,4,'2026-08-21','09:30:00','Cancelada','Cliente cancelo la cita','01:30:00'),
(5,5,'2026-08-21','11:00:00','Confirmada','Tinte completo','02:00:00'),
(6,6,'2026-08-21','14:00:00','Pendiente','Corte masculino','00:45:00'),
(7,7,'2026-08-22','09:00:00','Confirmada','Pedicure','01:00:00'),
(8,8,'2026-08-22','10:30:00','Confirmada','Alisado','02:30:00'),
(9,9,'2026-08-22','13:00:00','Pendiente','Diseno de unas','01:30:00'),
(10,10,'2026-08-23','08:30:00','Confirmada','Corte y barba','01:00:00'),
(11,11,'2026-08-23','10:00:00','Confirmada','Balayage','03:00:00'),
(12,12,'2026-08-23','14:30:00','Cancelada','Cambio de horario','01:00:00'),
(13,13,'2026-08-24','09:30:00','Pendiente','Manicure semipermanente','01:15:00'),
(14,14,'2026-08-24','11:30:00','Confirmada','Tratamiento capilar','01:30:00'),
(15,15,'2026-08-24','15:00:00','Confirmada','Peinado para evento','01:30:00');

CREATE TABLE Servicio (
 IdServicio INT AUTO_INCREMENT PRIMARY KEY,
 Nombre VARCHAR(100) NOT NULL,
 Descripcion VARCHAR(200) NOT NULL,
 Precio INT UNSIGNED NOT NULL,
 DuracionMinutos SMALLINT UNSIGNED NOT NULL DEFAULT 60,
 Activo TINYINT(1) NOT NULL DEFAULT 1,
 Imagen MEDIUMBLOB,
 CONSTRAINT chk_servicio_precio CHECK (Precio >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO Servicio (Nombre,Descripcion,Precio) VALUES
('Corte y Peinado','Corte profesional con lavado y peinado',35000),
('Corte de Cabello','Corte personalizado segun preferencia',25000),
('Manicure','Limpieza, cuidado y esmaltado de unas',30000),
('Corte Infantil','Corte especializado para ninos',20000),
('Tinte Completo','Aplicacion de color en todo el cabello',85000),
('Corte Masculino','Corte masculino clasico o moderno',28000),
('Pedicure','Cuidado completo de pies y unas',35000),
('Alisado','Tratamiento para alisar y suavizar el cabello',120000),
('Diseno de Unas','Decoracion personalizada de unas',45000),
('Corte y Barba','Corte masculino acompanado de arreglo de barba',40000),
('Balayage','Tecnica de iluminacion personalizada',180000),
('Peinado','Peinado sencillo para diferentes ocasiones',40000),
('Manicure Semipermanente','Manicure con esmalte semipermanente',50000),
('Tratamiento Capilar','Tratamiento de hidratacion y restauracion',70000),
('Peinado para Evento','Peinado profesional para eventos especiales',65000);

INSERT INTO Servicio (Nombre,Descripcion,Precio) VALUES
('Extensiones de Pestañas','Aplicación profesional de extensiones para una mirada definida',90000),
('Diseño de Cejas','Perfilado y diseño de cejas según tu rostro',20000),
('Spa Capilar','Hidratación profunda y masaje relajante para el cabello',60000);

INSERT INTO Servicio (Nombre,Descripcion,Precio) VALUES
('Lavado y Secado','Lavado nutritivo y secado con acabado natural',18000),
('Depilación Facial','Depilación suave de rostro con acabado profesional',25000),
('Peinado Básico','Peinado sencillo para una ocasión especial',30000);

UPDATE Servicio SET DuracionMinutos = CASE IdServicio
 WHEN 1 THEN 60
 WHEN 2 THEN 45
 WHEN 3 THEN 60
 WHEN 4 THEN 45
 WHEN 5 THEN 120
 WHEN 6 THEN 45
 WHEN 7 THEN 60
 WHEN 8 THEN 150
 WHEN 9 THEN 90
 WHEN 10 THEN 60
 WHEN 11 THEN 180
 WHEN 12 THEN 60
 WHEN 13 THEN 75
 WHEN 14 THEN 90
 WHEN 15 THEN 90
 WHEN 16 THEN 120
 WHEN 17 THEN 30
 WHEN 18 THEN 60
 WHEN 19 THEN 45
 WHEN 20 THEN 30
 WHEN 21 THEN 45
 ELSE DuracionMinutos
END;

CREATE TABLE Pedido (
 IdPedido INT AUTO_INCREMENT PRIMARY KEY,
 IdUsuario INT NULL,
 NombreCliente VARCHAR(100) NOT NULL,
 CorreoCliente VARCHAR(150) NOT NULL,
 TelefonoCliente VARCHAR(30) NULL,
 FechaPedido DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 Estado VARCHAR(30) NOT NULL DEFAULT 'Pendiente',
 Total INT UNSIGNED NOT NULL,
 CONSTRAINT fk_pedido_usuario FOREIGN KEY (IdUsuario)
    REFERENCES Usuarios(IdUsuario) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

ALTER TABLE Cita
 ADD CONSTRAINT fk_cita_pedido FOREIGN KEY (IdPedido)
 REFERENCES Pedido(IdPedido) ON DELETE SET NULL;

CREATE TABLE DetallePedido (
 IdDetalle INT AUTO_INCREMENT PRIMARY KEY,
 IdPedido INT NOT NULL,
 IdServicio INT NOT NULL,
 NombreServicio VARCHAR(100) NOT NULL,
 PrecioUnitario INT UNSIGNED NOT NULL,
 Cantidad INT UNSIGNED NOT NULL,
 CONSTRAINT uq_detallepedido_pedido_servicio UNIQUE (IdPedido, IdServicio),
 CONSTRAINT chk_detallepedido_cantidad CHECK (Cantidad > 0),
 CONSTRAINT fk_detallepedido_pedido FOREIGN KEY (IdPedido)
	REFERENCES Pedido(IdPedido) ON DELETE CASCADE,
 CONSTRAINT fk_detallepedido_servicio FOREIGN KEY (IdServicio)
	REFERENCES Servicio(IdServicio)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE Finanzas (
 IdFinanzas INT AUTO_INCREMENT PRIMARY KEY,
 IdUsuario INT NULL,
 IdPedido INT NULL,
 Transaccion VARCHAR(30) NOT NULL,
 TipoIngreso VARCHAR(30) NOT NULL,
 Nombre VARCHAR(100) NOT NULL,
 Monto INT UNSIGNED NOT NULL,
 Fecha DATE NOT NULL,
 Estado VARCHAR(20) NOT NULL DEFAULT 'Confirmado',
 CONSTRAINT uq_finanzas_pedido UNIQUE (IdPedido),
 CONSTRAINT chk_finanzas_transaccion CHECK (Transaccion IN ('Ingreso', 'Gasto')),
 CONSTRAINT chk_finanzas_estado CHECK (Estado IN ('Proyectado', 'Confirmado', 'Anulado')),
 CONSTRAINT fk_finanzas_usuario FOREIGN KEY (IdUsuario)
  REFERENCES Usuarios(IdUsuario) ON DELETE SET NULL,
 CONSTRAINT fk_finanzas_pedido FOREIGN KEY (IdPedido)
  REFERENCES Pedido(IdPedido) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO Finanzas (IdUsuario,Transaccion,TipoIngreso,Nombre,Monto,Fecha) VALUES
(1,'Ingreso','Servicio','Corte y Peinado',35000,'2026-08-20'),
(2,'Ingreso','Servicio','Corte de Cabello',25000,'2026-08-20'),
(3,'Ingreso','Servicio','Manicure',30000,'2026-08-20'),
(4,'Gasto','Compra','Productos de limpieza',85000,'2026-08-20'),
(5,'Ingreso','Servicio','Tinte Completo',85000,'2026-08-21'),
(6,'Ingreso','Servicio','Corte Masculino',28000,'2026-08-21'),
(7,'Ingreso','Servicio','Pedicure',35000,'2026-08-22'),
(8,'Ingreso','Servicio','Alisado',120000,'2026-08-22'),
(9,'Gasto','Compra','Esmaltes y materiales',65000,'2026-08-22'),
(10,'Ingreso','Servicio','Corte y Barba',40000,'2026-08-23'),
(11,'Ingreso','Servicio','Balayage',180000,'2026-08-23'),
(12,'Gasto','Servicio','Mantenimiento de equipos',120000,'2026-08-23'),
(13,'Ingreso','Servicio','Manicure Semipermanente',50000,'2026-08-24'),
(14,'Ingreso','Servicio','Tratamiento Capilar',70000,'2026-08-24'),
(15,'Ingreso','Servicio','Peinado para Evento',65000,'2026-08-24');

CREATE VIEW Reporte AS
SELECT
 DATE_FORMAT(Fecha, '%Y-%m') AS Periodo,
 SUM(CASE WHEN Transaccion = 'Ingreso' AND Estado = 'Confirmado' THEN Monto ELSE 0 END) AS IngresosTotal,
 SUM(CASE WHEN Transaccion = 'Gasto' AND Estado = 'Confirmado' THEN Monto ELSE 0 END) AS GastosTotal,
 SUM(CASE
  WHEN Estado = 'Confirmado' AND Transaccion = 'Ingreso' THEN Monto
  WHEN Estado = 'Confirmado' AND Transaccion = 'Gasto' THEN -Monto
  ELSE 0
 END) AS GananciasNetas,
 SUM(CASE WHEN Transaccion = 'Ingreso' AND Estado IN ('Proyectado', 'Confirmado') THEN Monto ELSE 0 END) AS IngresosEstimados,
 SUM(CASE WHEN Transaccion = 'Ingreso' AND Estado IN ('Proyectado', 'Confirmado') THEN Monto ELSE 0 END)
  - SUM(CASE WHEN Transaccion = 'Gasto' AND Estado = 'Confirmado' THEN Monto ELSE 0 END) AS GananciasEstimadas
FROM Finanzas
GROUP BY YEAR(Fecha), MONTH(Fecha);

CREATE TABLE Rol (
 IdRol INT AUTO_INCREMENT PRIMARY KEY,
 IdUsuario INT,
 NombreRol VARCHAR(30),
 CONSTRAINT fk_rol_usuario FOREIGN KEY (IdUsuario)
    REFERENCES Usuarios(IdUsuario) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO Rol (IdUsuario,NombreRol) VALUES
(1,'Administrador'),(2,'Cliente'),(3,'Cliente'),(4,'Cliente'),(5,'Estilista'),
(6,'Cliente'),(7,'Cliente'),(8,'Estilista'),(9,'Cliente'),(10,'Cliente'),
(11,'Estilista'),(12,'Cliente'),(13,'Cliente'),(14,'Estilista'),(15,'Cliente');

SHOW TABLES;

SELECT 'Usuarios' AS Tabla, COUNT(*) AS Registros FROM Usuarios
UNION ALL SELECT 'Cita', COUNT(*) FROM Cita
UNION ALL SELECT 'Servicio', COUNT(*) FROM Servicio
UNION ALL SELECT 'Pedido', COUNT(*) FROM Pedido
UNION ALL SELECT 'DetallePedido', COUNT(*) FROM DetallePedido
UNION ALL SELECT 'Finanzas', COUNT(*) FROM Finanzas
UNION ALL SELECT 'Reporte', COUNT(*) FROM Reporte
UNION ALL SELECT 'Rol', COUNT(*) FROM Rol;
