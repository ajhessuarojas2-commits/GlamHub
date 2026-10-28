<?php
require 'conexion.php';
require_once 'auth.php';
exigirInicioSesion('citas.php');

function escapar(string $valor): string
{
	return htmlspecialchars($valor, ENT_QUOTES, 'UTF-8');
}

$consultaUsuario = $conexion->prepare(
	'SELECT IdUsuario, NombreUsuario, CorreoUsuario, TelefonoUsuario
	 FROM Usuarios WHERE IdUsuario = :id'
);
$consultaUsuario->execute([':id' => (int) $_SESSION['usuario_id']]);
$usuario = $consultaUsuario->fetch(PDO::FETCH_ASSOC);
if (!$usuario) {
	$_SESSION = [];
	header('Location: login.php');
	exit;
}

$consultaCitas = $conexion->prepare(
	' SELECT IdCita, IdPedido, Fecha, Hora, Estado, Comentario, Duracion
	 FROM Cita WHERE IdUsuario = :id
	 ORDER BY Fecha DESC, Hora DESC, IdCita DESC'
);
$consultaCitas->execute([':id' => $usuario['IdUsuario']]);
$citas = $consultaCitas->fetchAll(PDO::FETCH_ASSOC);
?>
<!DOCTYPE html>
<html lang="es">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>Mis citas | Glam Hub</title>
	<link rel="stylesheet" href="css/estilos.css?v=12">
</head>
<body>
	<?php require 'navbar.php'; ?>

	<main class="container account-container">
		<h1>Mis citas y compras</h1>

		<section class="account-details" aria-labelledby="account-heading">
			<h2 id="account-heading">Información de usuario</h2>
			<dl>
				<div><dt>Nombre</dt><dd><?= escapar((string) $usuario['NombreUsuario']) ?></dd></div>
				<div><dt>Correo</dt><dd><?= escapar((string) $usuario['CorreoUsuario']) ?></dd></div>
				<div><dt>Teléfono</dt><dd><?= escapar((string) ($usuario['TelefonoUsuario'] ?: 'No registrado')) ?></dd></div>
			</dl>
		</section>

		<section class="account-appointments" aria-labelledby="appointments-heading">
			<h2 id="appointments-heading">Registros asociados a tu cuenta</h2>
			<?php if ($citas === []): ?>
				<p class="empty">Todavía no tienes citas ni compras registradas.</p>
			<?php else: ?>
				<div class="table-wrapper">
					<table>
						<thead>
							<tr>
								<th>Fecha</th>
								<th>Hora</th>
								<th>Detalle</th>
								<th>Duración</th>
								<th>Estado</th>
								<th>Pedido</th>
							</tr>
						</thead>
						<tbody>
							<?php foreach ($citas as $cita): ?>
								<tr>
									<td><?= escapar(date('d/m/Y', strtotime((string) $cita['Fecha']))) ?></td>
									<td><?= escapar(substr((string) $cita['Hora'], 0, 5)) ?></td>
									<td><?= escapar((string) $cita['Comentario']) ?></td>
									<td><?= $cita['Duracion'] ? escapar(substr((string) $cita['Duracion'], 0, 5)) : 'Por definir' ?></td>
									<td><?= escapar((string) $cita['Estado']) ?></td>
									<td><?= $cita['IdPedido'] === null ? 'Cita' : '#' . escapar((string) $cita['IdPedido']) ?></td>
								</tr>
							<?php endforeach; ?>
						</tbody>
					</table>
				</div>
			<?php endif; ?>
		</section>
	</main>
</body>
</html>
