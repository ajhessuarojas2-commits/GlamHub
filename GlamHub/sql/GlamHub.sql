DROP DATABASE IF EXISTS GlamHub;
CREATE DATABASE GlamHub;
USE GlamHub;

CREATE TABLE Usuarios (
 IdUsuario INT AUTO_INCREMENT PRIMARY KEY,
 NombreUsuario VARCHAR(100),
 CorreoUsuario VARCHAR(150),
 PasswordUsuario VARCHAR(255),
 TelefonoUsuario VARCHAR(30)
);

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
 IdCita INT PRIMARY KEY,
 IdUsuario INT,
 Fecha DATE,
 Hora TIME,
 Estado VARCHAR(30),
 Comentario VARCHAR(200),
 Duracion TIME,
 FOREIGN KEY (IdUsuario) REFERENCES Usuarios(IdUsuario)
);

INSERT INTO Cita VALUES
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
 IdCita INT,
 Nombre VARCHAR(30),
 Descripcion VARCHAR(200),
 Precio INT,
 Imagen MEDIUMBLOB,
 FOREIGN KEY (IdCita) REFERENCES Cita(IdCita)
);

INSERT INTO Servicio (IdCita,Nombre,Descripcion,Precio) VALUES
(1,'Corte y Peinado','Corte profesional con lavado y peinado',35000),
(2,'Corte de Cabello','Corte personalizado segun preferencia',25000),
(3,'Manicure','Limpieza, cuidado y esmaltado de unas',30000),
(4,'Corte Infantil','Corte especializado para ninos',20000),
(5,'Tinte Completo','Aplicacion de color en todo el cabello',85000),
(6,'Corte Masculino','Corte masculino clasico o moderno',28000),
(7,'Pedicure','Cuidado completo de pies y unas',35000),
(8,'Alisado','Tratamiento para alisar y suavizar el cabello',120000),
(9,'Diseno de Unas','Decoracion personalizada de unas',45000),
(10,'Corte y Barba','Corte masculino acompanado de arreglo de barba',40000),
(11,'Balayage','Tecnica de iluminacion personalizada',180000),
(12,'Peinado','Peinado sencillo para diferentes ocasiones',40000),
(13,'Manicure Semipermanente','Manicure con esmalte semipermanente',50000),
(14,'Tratamiento Capilar','Tratamiento de hidratacion y restauracion',70000),
(15,'Peinado para Evento','Peinado profesional para eventos especiales',65000);

INSERT INTO Servicio (IdCita,Nombre,Descripcion,Precio) VALUES
(NULL,'Extensiones de Pestañas','Aplicación profesional de extensiones para una mirada definida',90000),
(NULL,'Diseño de Cejas','Perfilado y diseño de cejas según tu rostro',20000),
(NULL,'Spa Capilar','Hidratación profunda y masaje relajante para el cabello',60000);

INSERT INTO Servicio (IdCita,Nombre,Descripcion,Precio) VALUES
(NULL,'Lavado y Secado','Lavado nutritivo y secado con acabado natural',18000),
(NULL,'Depilación Facial','Depilación suave de rostro con acabado profesional',25000),
(NULL,'Peinado Básico','Peinado sencillo para una ocasión especial',30000);

CREATE TABLE Finanzas (
 IdFinanzas INT AUTO_INCREMENT PRIMARY KEY,
 IdUsuario INT,
 Transaccion VARCHAR(30),
 TipoIngreso VARCHAR(30),
 Nombre VARCHAR(30),
 Monto INT,
 Fecha DATE,
 FOREIGN KEY (IdUsuario) REFERENCES Usuarios(IdUsuario)
);

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

CREATE TABLE Reporte (
 IdReporte INT AUTO_INCREMENT PRIMARY KEY,
 IdFinanzas INT,
 Periodo VARCHAR(50),
 IngresosTotal DECIMAL(10,0),
 GastosTotal DECIMAL(10,0),
 GananciasNetas DECIMAL(10,0),
 FOREIGN KEY (IdFinanzas) REFERENCES Finanzas(IdFinanzas)
);

INSERT INTO Reporte (IdFinanzas,Periodo,IngresosTotal,GastosTotal,GananciasNetas) VALUES
(1,'Agosto Semana 1',350000,120000,230000),
(2,'Agosto Semana 2',420000,150000,270000),
(3,'Agosto Semana 3',385000,95000,290000),
(4,'Agosto Semana 4',510000,180000,330000),
(5,'Agosto Semana 5',625000,210000,415000),
(6,'Septiembre Semana 1',450000,130000,320000),
(7,'Septiembre Semana 2',580000,175000,405000),
(8,'Septiembre Semana 3',690000,200000,490000),
(9,'Septiembre Semana 4',475000,155000,320000),
(10,'Octubre Semana 1',720000,250000,470000),
(11,'Octubre Semana 2',810000,280000,530000),
(12,'Octubre Semana 3',560000,190000,370000),
(13,'Octubre Semana 4',635000,205000,430000),
(14,'Noviembre Semana 1',745000,230000,515000),
(15,'Noviembre Semana 2',890000,300000,590000);

CREATE TABLE Historial (
 IdHistorial INT AUTO_INCREMENT PRIMARY KEY,
 IdUsuario INT,
 Cita VARCHAR(30),
 Servicio VARCHAR(30),
 Comentario VARCHAR(200),
 FOREIGN KEY (IdUsuario) REFERENCES Usuarios(IdUsuario)
);

INSERT INTO Historial (IdUsuario,Cita,Servicio,Comentario) VALUES
(1,'CITA001','Corte y Peinado','Cliente satisfecho con el resultado'),
(2,'CITA002','Corte de Cabello','Solicito corte corto'),
(3,'CITA003','Manicure','Prefirio esmalte rojo'),
(4,'CITA004','Corte Infantil','Cita cancelada por el cliente'),
(5,'CITA005','Tinte Completo','Se aplico color solicitado'),
(6,'CITA006','Corte Masculino','Solicito corte degradado'),
(7,'CITA007','Pedicure','Servicio realizado correctamente'),
(8,'CITA008','Alisado','Tratamiento finalizado satisfactoriamente'),
(9,'CITA009','Diseno de Unas','Diseno floral solicitado'),
(10,'CITA010','Corte y Barba','Solicito barba perfilada'),
(11,'CITA011','Balayage','Cliente eligio tonos claros'),
(12,'CITA012','Peinado','Cita cancelada por cambio de horario'),
(13,'CITA013','Manicure Semipermanente','Color rosado seleccionado'),
(14,'CITA014','Tratamiento Capilar','Se recomienda repetir tratamiento'),
(15,'CITA015','Peinado para Evento','Peinado realizado para evento social');

CREATE TABLE Calendario (
 IdCalendario INT AUTO_INCREMENT PRIMARY KEY,
 IdCita INT,
 Usuario VARCHAR(30),
 Horario DATE,
 Servicio VARCHAR(30),
 FOREIGN KEY (IdCita) REFERENCES Cita(IdCita)
);

INSERT INTO Calendario (IdCita,Usuario,Horario,Servicio) VALUES
(1,'Maria Rodriguez','2026-08-20','Corte y Peinado'),
(2,'Carlos Martinez','2026-08-20','Corte de Cabello'),
(3,'Laura Gomez','2026-08-20','Manicure'),
(4,'Andres Perez','2026-08-21','Corte Infantil'),
(5,'Sofia Hernandez','2026-08-21','Tinte Completo'),
(6,'Juan Rodriguez','2026-08-21','Corte Masculino'),
(7,'Valentina Torres','2026-08-22','Pedicure'),
(8,'Diego Ramirez','2026-08-22','Alisado'),
(9,'Camila Castro','2026-08-22','Diseno de Unas'),
(10,'Sebastian Morales','2026-08-23','Corte y Barba'),
(11,'Natalia Vargas','2026-08-23','Balayage'),
(12,'Felipe Rojas','2026-08-23','Peinado'),
(13,'Daniela Suarez','2026-08-24','Manicure Semipermanente'),
(14,'Mateo Castillo','2026-08-24','Tratamiento Capilar'),
(15,'Paula Mendoza','2026-08-24','Peinado para Evento');

CREATE TABLE Rol (
 IdRol INT AUTO_INCREMENT PRIMARY KEY,
 IdUsuario INT,
 NombreRol VARCHAR(30),
 FOREIGN KEY (IdUsuario) REFERENCES Usuarios(IdUsuario)
);

INSERT INTO Rol (IdUsuario,NombreRol) VALUES
(1,'Administrador'),(2,'Cliente'),(3,'Cliente'),(4,'Cliente'),(5,'Estilista'),
(6,'Cliente'),(7,'Cliente'),(8,'Estilista'),(9,'Cliente'),(10,'Cliente'),
(11,'Estilista'),(12,'Cliente'),(13,'Cliente'),(14,'Estilista'),(15,'Cliente');

SHOW TABLES;

SELECT 'Usuarios' AS Tabla, COUNT(*) AS Registros FROM Usuarios
UNION ALL SELECT 'Cita', COUNT(*) FROM Cita
UNION ALL SELECT 'Servicio', COUNT(*) FROM Servicio
UNION ALL SELECT 'Finanzas', COUNT(*) FROM Finanzas
UNION ALL SELECT 'Reporte', COUNT(*) FROM Reporte
UNION ALL SELECT 'Historial', COUNT(*) FROM Historial
UNION ALL SELECT 'Calendario', COUNT(*) FROM Calendario
UNION ALL SELECT 'Rol', COUNT(*) FROM Rol;
