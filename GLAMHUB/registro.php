<?php
require 'conexion.php';
require_once 'auth.php';

function escapar(string $valor): string
{
	return htmlspecialchars($valor, ENT_QUOTES, 'UTF-8');
}

$id = filter_var($_GET['id'] ?? $_POST['id'] ?? null, FILTER_VALIDATE_INT);
$esEdicion = $id !== false && $id !== null;
$mensaje = $_GET['mensaje'] ?? '';

if ($esEdicion) {
	if (empty($_SESSION['usuario_id'])) {
		header('Location: login.php');
		exit;
	}
	$consultaAdmin = $conexion->prepare(
		"SELECT 1 FROM Rol WHERE IdUsuario = :usuario AND NombreRol = 'Administrador' LIMIT 1"
	);
	$consultaAdmin->execute([':usuario' => (int) $_SESSION['usuario_id']]);
	$esAdministrador = (bool) $consultaAdmin->fetchColumn();
	if (!$esAdministrador && (int) $_SESSION['usuario_id'] !== $id) {
		http_response_code(403);
		exit('No tienes permiso para editar esta cuenta.');
	}
}

$usuario = [
	'IdUsuario' => '',
	'NombreUsuario' => '',
	'CorreoUsuario' => '',
	'TelefonoUsuario' => '',
];

if ($esEdicion) {
	$sentencia = $conexion->prepare(
		'SELECT IdUsuario, NombreUsuario, CorreoUsuario, TelefonoUsuario
		 FROM Usuarios WHERE IdUsuario = :id'
	);
	$sentencia->execute([':id' => $id]);
	$usuario = $sentencia->fetch(PDO::FETCH_ASSOC);

	if (!$usuario) {
		header('Location: usuarios.php?mensaje=datos_invalidos');
		exit;
	}
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
	$nombre = trim((string) ($_POST['nombre'] ?? ''));
	$correo = trim((string) ($_POST['correo'] ?? ''));
	$telefono = trim((string) ($_POST['telefono'] ?? ''));

	if ($nombre === '' || !filter_var($correo, FILTER_VALIDATE_EMAIL)) {
		header($esEdicion
			? "Location: registro.php?id=$id&mensaje=datos_invalidos"
			: 'Location: registro.php?mensaje=datos_invalidos'
		);
		exit;
	}

	$consultaCorreo = $conexion->prepare(
		' SELECT IdUsuario FROM Usuarios
		 WHERE CorreoUsuario = :correo' . ($esEdicion ? ' AND IdUsuario <> :id' : '') . ' LIMIT 1'
	);
	$parametrosCorreo = [':correo' => $correo];
	if ($esEdicion) {
		$parametrosCorreo[':id'] = $id;
	}
	$consultaCorreo->execute($parametrosCorreo);
	if ($consultaCorreo->fetchColumn()) {
		header($esEdicion
			? "Location: registro.php?id=$id&mensaje=correo_existente"
			: 'Location: registro.php?mensaje=correo_existente'
		);
		exit;
	}

	if ($esEdicion) {
		$sentencia = $conexion->prepare(
			'UPDATE Usuarios
			 SET NombreUsuario = :nombre, CorreoUsuario = :correo, TelefonoUsuario = :telefono
			 WHERE IdUsuario = :id'
		);
		$sentencia->execute([
			':nombre' => $nombre,
			':correo' => $correo,
			':telefono' => $telefono,
			':id' => $id,
		]);
		header('Location: usuarios.php?mensaje=actualizado');
		exit;
	}

	$contrasena = (string) ($_POST['contrasena'] ?? '');
	if (strlen($contrasena) < 6) {
		header('Location: registro.php?mensaje=contrasena_invalida');
		exit;
	}

	try {
		$conexion->beginTransaction();
		$sentencia = $conexion->prepare(
			'INSERT INTO Usuarios (NombreUsuario, CorreoUsuario, PasswordUsuario, TelefonoUsuario)
			 VALUES (:nombre, :correo, :contrasena, :telefono)'
		);
		$sentencia->execute([
			':nombre' => $nombre,
			':correo' => $correo,
			':contrasena' => password_hash($contrasena, PASSWORD_DEFAULT),
			':telefono' => $telefono,
		]);
		$idUsuarioNuevo = (int) $conexion->lastInsertId();
		$asignarRol = $conexion->prepare(
			"INSERT INTO Rol (IdUsuario, NombreRol) VALUES (:usuario, 'Cliente')"
		);
		$asignarRol->execute([':usuario' => $idUsuarioNuevo]);
		$conexion->commit();
	} catch (Throwable $error) {
		if ($conexion->inTransaction()) {
			$conexion->rollBack();
		}
		header('Location: registro.php?mensaje=error_registro');
		exit;
	}

	header('Location: usuarios.php?mensaje=registrado');
	exit;
}
?>
<!DOCTYPE html>
<html lang="es">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title><?= $esEdicion ? 'Editar usuario' : 'Registrar usuario' ?> | Glam Hub</title>
	<link rel="stylesheet" href="css/estilos.css?v=12">
</head>
<body>
	<?php require 'navbar.php'; ?>

	<main class="container form-container">
		<h1><?= $esEdicion ? 'Editar usuario' : 'Registrar usuario' ?></h1>

		<?php if ($mensaje === 'datos_invalidos'): ?>
			<div class="message error">Completa correctamente el nombre y el correo.</div>
		<?php elseif ($mensaje === 'contrasena_invalida'): ?>
			<div class="message error">La contraseña debe tener al menos 6 caracteres.</div>
		<?php elseif ($mensaje === 'correo_existente'): ?>
			<div class="message error">Ya existe una cuenta con ese correo electrónico.</div>
		<?php elseif ($mensaje === 'error_registro'): ?>
			<div class="message error">No se pudo crear la cuenta. Inténtalo nuevamente.</div>
		<?php endif; ?>

		<form method="post">
			<?php if ($esEdicion): ?>
				<input type="hidden" name="id" value="<?= escapar((string) $usuario['IdUsuario']) ?>">
			<?php endif; ?>

			<label for="nombre">Nombre completo</label>
			<input id="nombre" type="text" name="nombre" required maxlength="100" value="<?= escapar((string) $usuario['NombreUsuario']) ?>">

			<label for="correo">Correo electrónico</label>
			<input id="correo" type="email" name="correo" required maxlength="150" value="<?= escapar((string) $usuario['CorreoUsuario']) ?>">

			<?php if (!$esEdicion): ?>
				<label for="contrasena">Contraseña</label>
				<input id="contrasena" type="password" name="contrasena" required minlength="6">
			<?php endif; ?>

			<label for="telefono">Teléfono</label>
			<input id="telefono" type="text" name="telefono" maxlength="30" value="<?= escapar((string) $usuario['TelefonoUsuario']) ?>">

			<div class="buttons">
				<button type="submit"><?= $esEdicion ? 'Guardar cambios' : 'Registrar usuario' ?></button>
				<a class="action-link secondary-link" href="usuarios.php">Cancelar</a>
			</div>
		</form>
	</main>
</body>
</html>
