<?php
require 'conexion.php';
require_once 'auth.php';

function escapar(string $valor): string
{
	return htmlspecialchars($valor, ENT_QUOTES, 'UTF-8');
}

if (empty($_SESSION['usuario_id'])) {
	header('Location: login.php');
	exit;
}

$consultaAdmin = $conexion->prepare(
	"SELECT 1 FROM Rol WHERE IdUsuario = :usuario AND NombreRol = 'Administrador' LIMIT 1"
);
$consultaAdmin->execute([':usuario' => (int) $_SESSION['usuario_id']]);
if (!$consultaAdmin->fetchColumn()) {
	http_response_code(403);
	exit('No tienes permiso para administrar usuarios.');
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
	if (!validarTokenCSRF()) {
		http_response_code(419);
		exit('La solicitud expiró. Recarga la página e inténtalo de nuevo.');
	}

	$id = filter_var($_POST['id'] ?? null, FILTER_VALIDATE_INT);
	if ($id === false || $id === null || $id < 1) {
		header('Location: usuarios.php?mensaje=datos_invalidos');
		exit;
	}

	if (($_POST['accion'] ?? '') === 'cambiar_rol') {
		$rolNuevo = (string) ($_POST['rol'] ?? '');
		if (!in_array($rolNuevo, ['Cliente', 'Estilista', 'Administrador'], true)) {
			header('Location: usuarios.php?mensaje=rol_invalido');
			exit;
		}

		$consultaRolActual = $conexion->prepare(
			"SELECT COUNT(*) FROM Rol WHERE IdUsuario = :id AND NombreRol = 'Administrador'"
		);
		$consultaRolActual->execute([':id' => $id]);
		$esAdminObjetivo = (int) $consultaRolActual->fetchColumn() > 0;
		if ($esAdminObjetivo && $rolNuevo !== 'Administrador') {
			$totalAdmins = (int) $conexion->query(
				"SELECT COUNT(DISTINCT IdUsuario) FROM Rol WHERE NombreRol = 'Administrador'"
			)->fetchColumn();
			if ($totalAdmins <= 1) {
				header('Location: usuarios.php?mensaje=ultimo_admin');
				exit;
			}
		}

		try {
			$conexion->beginTransaction();
			$quitarRoles = $conexion->prepare('DELETE FROM Rol WHERE IdUsuario = :id');
			$quitarRoles->execute([':id' => $id]);
			$asignarRol = $conexion->prepare('INSERT INTO Rol (IdUsuario, NombreRol) VALUES (:id, :rol)');
			$asignarRol->execute([':id' => $id, ':rol' => $rolNuevo]);
			$conexion->commit();
		} catch (Throwable $error) {
			if ($conexion->inTransaction()) {
				$conexion->rollBack();
			}
			header('Location: usuarios.php?mensaje=error');
			exit;
		}

		if ($id === (int) $_SESSION['usuario_id']) {
			$_SESSION['es_administrador'] = $rolNuevo === 'Administrador';
			if ($rolNuevo !== 'Administrador') {
				header('Location: ver_usuario.php?id=' . $id . '&mensaje=rol_actualizado');
				exit;
			}
		}
		header('Location: usuarios.php?mensaje=rol_actualizado');
		exit;
	}

	if (($_POST['accion'] ?? '') === 'eliminar') {
		if ($id === (int) $_SESSION['usuario_id']) {
			header('Location: usuarios.php?mensaje=no_eliminar_propio');
			exit;
		}
		$consultaRolObjetivo = $conexion->prepare(
			"SELECT COUNT(*) FROM Rol WHERE IdUsuario = :id AND NombreRol = 'Administrador'"
		);
		$consultaRolObjetivo->execute([':id' => $id]);
		if ((int) $consultaRolObjetivo->fetchColumn() > 0) {
			$totalAdmins = (int) $conexion->query(
				"SELECT COUNT(DISTINCT IdUsuario) FROM Rol WHERE NombreRol = 'Administrador'"
			)->fetchColumn();
			if ($totalAdmins <= 1) {
				header('Location: usuarios.php?mensaje=ultimo_admin');
				exit;
			}
		}

		$sentencia = $conexion->prepare('DELETE FROM Usuarios WHERE IdUsuario = :id');
		$sentencia->execute([':id' => $id]);
		header($sentencia->rowCount() > 0
			? 'Location: usuarios.php?mensaje=eliminado'
			: 'Location: usuarios.php?mensaje=datos_invalidos'
		);
		exit;
	}
}

$sentencia = $conexion->query(
	"SELECT U.IdUsuario, U.NombreUsuario, U.CorreoUsuario, U.TelefonoUsuario,
		COALESCE((SELECT R.NombreRol FROM Rol R WHERE R.IdUsuario = U.IdUsuario ORDER BY (R.NombreRol = 'Administrador') DESC LIMIT 1), 'Sin rol') AS NombreRol
	 FROM Usuarios U ORDER BY U.IdUsuario ASC"
);
$usuarios = $sentencia->fetchAll(PDO::FETCH_ASSOC);

?>
<!DOCTYPE html>
<html lang="es">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>Usuarios | Glam Hub</title>
	<link rel="stylesheet" href="css/estilos.css?v=12">
</head>
<body>
	<?php require 'navbar.php'; ?>

	<main class="container users-container">
		<h1>Usuarios registrados</h1>
		<a class="action-link" href="registro.php">Registrar usuario</a>

		<?php $mensaje = $_GET['mensaje'] ?? ''; ?>
		<?php if ($mensaje === 'registrado'): ?>
			<div class="message success">Usuario registrado correctamente.</div>
		<?php elseif ($mensaje === 'actualizado'): ?>
			<div class="message success">Usuario actualizado correctamente.</div>
		<?php elseif ($mensaje === 'eliminado'): ?>
			<div class="message success">Usuario eliminado correctamente.</div>
		<?php elseif ($mensaje === 'datos_invalidos'): ?>
			<div class="message error">No se encontró el usuario solicitado.</div>
		<?php elseif ($mensaje === 'rol_actualizado'): ?>
			<div class="message success">Rol actualizado correctamente.</div>
		<?php elseif ($mensaje === 'ultimo_admin'): ?>
			<div class="message error">Debe quedar al menos un administrador activo.</div>
		<?php elseif ($mensaje === 'no_eliminar_propio'): ?>
			<div class="message error">No puedes eliminar tu propia cuenta desde esta sesión.</div>
		<?php elseif ($mensaje === 'rol_invalido' || $mensaje === 'error'): ?>
			<div class="message error">No se pudo actualizar el rol.</div>
		<?php endif; ?>

		<?php if ($usuarios === []): ?>
			<p class="empty">No hay usuarios registrados.</p>
		<?php else: ?>
			<div class="table-wrapper">
				<table class="users-table">
					<thead>
						<tr>
							<th>ID</th>
							<th>Nombre</th>
							<th>Correo</th>
							<th>Teléfono</th>
							<th>Rol</th>
							<th>Acción</th>
						</tr>
					</thead>
					<tbody>
						<?php foreach ($usuarios as $usuario): ?>
							<tr>
								<td><?= escapar((string) $usuario['IdUsuario']) ?></td>
								<td><?= escapar((string) $usuario['NombreUsuario']) ?></td>
								<td><?= escapar((string) $usuario['CorreoUsuario']) ?></td>
								<td><?= escapar((string) $usuario['TelefonoUsuario']) ?></td>
								<td><?= escapar((string) $usuario['NombreRol']) ?></td>
								<td>
									<div class="table-actions">
										<a class="action-link" href="ver_usuario.php?id=<?= escapar((string) $usuario['IdUsuario']) ?>">Ver</a>
										<a class="action-link" href="registro.php?id=<?= escapar((string) $usuario['IdUsuario']) ?>">Editar</a>
										<form method="post" class="role-edit-form">
											<input type="hidden" name="token_csrf" value="<?= escapar(tokenCSRF()) ?>">
											<input type="hidden" name="accion" value="cambiar_rol">
											<input type="hidden" name="id" value="<?= escapar((string) $usuario['IdUsuario']) ?>">
											<label class="visually-hidden" for="rol-<?= (int) $usuario['IdUsuario'] ?>">Rol de <?= escapar((string) $usuario['NombreUsuario']) ?></label>
											<select id="rol-<?= (int) $usuario['IdUsuario'] ?>" name="rol">
												<?php foreach (['Cliente', 'Estilista', 'Administrador'] as $rol): ?>
													<option value="<?= escapar($rol) ?>"<?= $usuario['NombreRol'] === $rol ? ' selected' : '' ?>><?= escapar($rol) ?></option>
												<?php endforeach; ?>
											</select>
											<button type="submit">Guardar rol</button>
										</form>
										<form method="post" onsubmit="return confirm('¿Seguro que deseas eliminar este usuario?');">
											<input type="hidden" name="token_csrf" value="<?= escapar(tokenCSRF()) ?>">
											<input type="hidden" name="accion" value="eliminar">
											<input type="hidden" name="id" value="<?= escapar((string) $usuario['IdUsuario']) ?>">
											<button type="submit">Eliminar</button>
										</form>
									</div>
								</td>
							</tr>
						<?php endforeach; ?>
					</tbody>
				</table>
			</div>
		<?php endif; ?>
	</main>
</body>
</html>