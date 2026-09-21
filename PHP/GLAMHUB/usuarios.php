<?php
require 'conexion.php';

function escapar(string $valor): string
{
	return htmlspecialchars($valor, ENT_QUOTES, 'UTF-8');
}

$sentencia = $conexion->query(
	'SELECT IdUsuario, NombreUsuario, CorreoUsuario, TelefonoUsuario
	 FROM Usuarios ORDER BY IdUsuario ASC'
);
$usuarios = $sentencia->fetchAll(PDO::FETCH_ASSOC);

?>
<!DOCTYPE html>
<html lang="es">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>Usuarios | Glam Hub</title>
	<link rel="stylesheet" href="css/estilos.css">
</head>
<body>
	<nav class="navbar" aria-label="Navegación principal">
		<a class="logo" href="index.php">Glam Hub</a>
		<ul class="nav-links">
			<li><a href="index.php">Inicio</a></li>
			<li><a href="usuarios.php">Usuarios</a></li>
		</ul>
	</nav>

	<main class="container">
		<h1>Usuarios registrados</h1>
		<a class="action-link" href="registro.php">Registrar usuario</a>

		<?php $mensaje = $_GET['mensaje'] ?? ''; ?>
		<?php if ($mensaje === 'registrado'): ?>
			<div class="message success">Usuario registrado correctamente.</div>
		<?php elseif ($mensaje === 'actualizado'): ?>
			<div class="message success">Usuario actualizado correctamente.</div>
		<?php elseif ($mensaje === 'datos_invalidos'): ?>
			<div class="message error">No se encontró el usuario solicitado.</div>
		<?php endif; ?>

		<?php if ($usuarios === []): ?>
			<p class="empty">No hay usuarios registrados.</p>
		<?php else: ?>
			<div class="table-wrapper">
				<table>
					<thead>
						<tr>
							<th>ID</th>
							<th>Nombre</th>
							<th>Correo</th>
							<th>Teléfono</th>
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
								<td><a class="action-link" href="registro.php?id=<?= escapar((string) $usuario['IdUsuario']) ?>">Editar</a></td>
							</tr>
						<?php endforeach; ?>
					</tbody>
				</table>
			</div>
		<?php endif; ?>
	</main>
</body>
</html>