<?php
require 'conexion.php';
require_once 'auth.php';

function escapar(string $valor): string
{
	return htmlspecialchars($valor, ENT_QUOTES, 'UTF-8');
}

function iconoServicio(string $nombre): string
{
	if (preg_match('/corte|peinado|alisado|balayage|tinte|lavado|secado|capilar/i', $nombre)) {
		return '💇';
	}
	if (preg_match('/manicure|uñas|unas/i', $nombre)) {
		return '💅';
	}
	if (preg_match('/pedicure/i', $nombre)) {
		return '🦶';
	}
	if (preg_match('/maquillaje/i', $nombre)) {
		return '💄';
	}
	if (preg_match('/pestañas|pestanas|cejas/i', $nombre)) {
		return '👁️';
	}
	if (preg_match('/facial|spa/i', $nombre)) {
		return '✨';
	}

	return '🌸';
}

$consultaAdmin = $conexion->prepare(
	"SELECT 1 FROM Rol WHERE IdUsuario = :usuario AND NombreRol = 'Administrador' LIMIT 1"
);
$consultaAdmin->execute([':usuario' => (int) ($_SESSION['usuario_id'] ?? 0)]);
$esAdministrador = (bool) $consultaAdmin->fetchColumn();

if ($_SERVER['REQUEST_METHOD'] === 'POST' && in_array($_POST['accion'] ?? '', ['crear_servicio', 'cambiar_estado'], true)) {
	if (!$esAdministrador) {
		http_response_code(403);
		exit('Solo un administrador puede gestionar el catálogo.');
	}
	if (!validarTokenCSRF()) {
		http_response_code(419);
		exit('La solicitud expiró. Recarga la página e inténtalo de nuevo.');
	}

	$accionServicio = (string) $_POST['accion'];
	if ($accionServicio === 'crear_servicio') {
		$nombre = trim((string) ($_POST['nombre'] ?? ''));
		$descripcion = trim((string) ($_POST['descripcion'] ?? ''));
		$precio = filter_var($_POST['precio'] ?? null, FILTER_VALIDATE_INT);
		$duracion = filter_var($_POST['duracion'] ?? null, FILTER_VALIDATE_INT);
		if ($nombre === '' || mb_strlen($nombre) > 100 || $descripcion === '' || mb_strlen($descripcion) > 200
			|| $precio === false || $precio < 0 || $duracion === false || $duracion < 15 || $duracion > 720) {
			header('Location: servicios.php?mensaje=servicio_invalido');
			exit;
		}

		$crearServicio = $conexion->prepare(
			'INSERT INTO Servicio (Nombre, Descripcion, Precio, DuracionMinutos, Activo)
			 VALUES (:nombre, :descripcion, :precio, :duracion, 1)'
		);
		$crearServicio->execute([
			':nombre' => $nombre,
			':descripcion' => $descripcion,
			':precio' => $precio,
			':duracion' => $duracion,
		]);
		header('Location: servicios.php?mensaje=servicio_creado');
		exit;
	}

	$idServicio = filter_var($_POST['id_servicio'] ?? null, FILTER_VALIDATE_INT);
	if ($idServicio === false || $idServicio === null || $idServicio < 1) {
		header('Location: servicios.php?mensaje=servicio_invalido');
		exit;
	}
	$actualizarEstado = $conexion->prepare('UPDATE Servicio SET Activo = 1 - Activo WHERE IdServicio = :id');
	$actualizarEstado->execute([':id' => $idServicio]);
	header('Location: servicios.php?mensaje=servicio_estado');
	exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'POST' && ($_POST['accion'] ?? '') === 'agregar') {
	$idServicio = filter_var($_POST['id_servicio'] ?? null, FILTER_VALIDATE_INT);
	if ($idServicio !== false && $idServicio !== null) {
		$sentencia = $conexion->prepare('SELECT IdServicio FROM Servicio WHERE IdServicio = :id AND Activo = 1');
		$sentencia->execute([':id' => $idServicio]);
		if ($sentencia->fetchColumn()) {
			$_SESSION['carrito'][$idServicio] = ($_SESSION['carrito'][$idServicio] ?? 0) + 1;
			header('Location: servicios.php?mensaje=agregado');
			exit;
		}
	}
	header('Location: servicios.php?mensaje=servicio_invalido');
	exit;
}

$sentencia = $conexion->query(
	' SELECT IdServicio, Nombre, Descripcion, Precio, DuracionMinutos, Activo
	 FROM Servicio ' . ($esAdministrador ? '' : 'WHERE Activo = 1 ') . 'ORDER BY Activo DESC, Nombre ASC'
);
$servicios = $sentencia->fetchAll(PDO::FETCH_ASSOC);
?>
<!DOCTYPE html>
<html lang="es">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>Servicios | Glam Hub</title>
	<link rel="stylesheet" href="css/estilos.css?v=12">
</head>
<body>
	<?php require 'navbar.php'; ?>

	<main class="services-container">
		<header class="services-header">
			<h1>Nuestros servicios</h1>
			<p>Servicios y tratamientos para cuidar tu belleza.</p>
			<?php if (($_GET['mensaje'] ?? '') === 'agregado'): ?>
				<p class="message success">Servicio agregado al carrito.</p>
			<?php elseif (($_GET['mensaje'] ?? '') === 'servicio_invalido'): ?>
				<p class="message error">No se pudo agregar ese servicio.</p>
			<?php elseif (($_GET['mensaje'] ?? '') === 'servicio_creado'): ?>
				<p class="message success">Servicio agregado al catálogo.</p>
			<?php elseif (($_GET['mensaje'] ?? '') === 'servicio_estado'): ?>
				<p class="message success">Disponibilidad del servicio actualizada.</p>
			<?php endif; ?>
		</header>

		<?php if ($esAdministrador): ?>
			<section class="service-admin-panel" aria-labelledby="service-admin-heading">
				<h2 id="service-admin-heading">Administrar catálogo</h2>
				<form method="post" class="service-admin-form">
					<input type="hidden" name="token_csrf" value="<?= escapar(tokenCSRF()) ?>">
					<input type="hidden" name="accion" value="crear_servicio">
					<div><label for="nuevo-servicio">Nombre</label><input id="nuevo-servicio" name="nombre" maxlength="100" required></div>
					<div><label for="descripcion-servicio">Descripción</label><input id="descripcion-servicio" name="descripcion" maxlength="200" required></div>
					<div><label for="precio-servicio">Precio COP</label><input id="precio-servicio" type="number" name="precio" min="0" step="1" required></div>
					<div><label for="duracion-servicio">Duración (min)</label><input id="duracion-servicio" type="number" name="duracion" min="15" max="720" step="15" value="60" required></div>
					<button type="submit">Agregar servicio</button>
				</form>
			</section>
		<?php endif; ?>

		<?php if ($servicios === []): ?>
			<p class="services-empty">No hay servicios disponibles en este momento.</p>
		<?php else: ?>
			<div class="services-grid">
				<?php foreach ($servicios as $servicio): ?>
					<article class="service-card">
						<?php if ($esAdministrador && !(int) $servicio['Activo']): ?>
							<span class="service-tag service-inactive-tag">Retirado del catálogo</span>
						<?php endif; ?>
						<div class="service-icon" aria-hidden="true"><?= iconoServicio((string) $servicio['Nombre']) ?></div>
						<span class="service-tag">Servicio de belleza</span>
						<h2><?= escapar((string) $servicio['Nombre']) ?></h2>
						<p><?= escapar((string) $servicio['Descripcion']) ?></p>
						<div class="service-price">
							$<?= number_format((float) $servicio['Precio'], 0, ',', '.') ?> COP
						</div>
						<?php if ((int) $servicio['Activo']): ?>
							<form class="service-form" method="post">
								<input type="hidden" name="accion" value="agregar">
								<input type="hidden" name="id_servicio" value="<?= escapar((string) $servicio['IdServicio']) ?>">
								<button class="service-add-button" type="submit">Agregar al carrito</button>
							</form>
						<?php endif; ?>
						<?php if ($esAdministrador): ?>
							<form class="service-admin-toggle" method="post">
								<input type="hidden" name="token_csrf" value="<?= escapar(tokenCSRF()) ?>">
								<input type="hidden" name="accion" value="cambiar_estado">
								<input type="hidden" name="id_servicio" value="<?= (int) $servicio['IdServicio'] ?>">
								<button type="submit"><?= (int) $servicio['Activo'] ? 'Retirar del catálogo' : 'Reactivar servicio' ?></button>
							</form>
						<?php endif; ?>
					</article>
				<?php endforeach; ?>
			</div>
		<?php endif; ?>
	</main>
</body>
</html>
