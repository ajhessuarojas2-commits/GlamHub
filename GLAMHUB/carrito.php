<?php
require 'conexion.php';
require_once 'auth.php';

function escapar(string $valor): string
{
	return htmlspecialchars($valor, ENT_QUOTES, 'UTF-8');
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
	$accion = $_POST['accion'] ?? '';

	if ($accion === 'eliminar') {
		$idServicio = filter_var($_POST['id_servicio'] ?? null, FILTER_VALIDATE_INT);
		if ($idServicio !== false && $idServicio !== null) {
			unset($_SESSION['carrito'][$idServicio]);
		}
		header('Location: carrito.php');
		exit;
	}

	if ($accion === 'confirmar') {
		if (empty($_SESSION['usuario_id'])) {
			header('Location: login.php?retorno=carrito.php&mensaje=sesion_requerida');
			exit;
		}

		if (empty($_SESSION['carrito'])) {
			header('Location: carrito.php?mensaje=vacio');
			exit;
		}

		$fechaCita = trim((string) ($_POST['fecha'] ?? ''));
		$horaCita = trim((string) ($_POST['hora'] ?? ''));
		$fechaValidada = DateTimeImmutable::createFromFormat('!Y-m-d', $fechaCita);
		$horaValidada = DateTimeImmutable::createFromFormat('!H:i', $horaCita);
		if (!$fechaValidada || $fechaValidada->format('Y-m-d') !== $fechaCita || $fechaCita < date('Y-m-d')
			|| !$horaValidada || $horaValidada->format('H:i') !== $horaCita
			|| (int) $horaValidada->format('i') % 30 !== 0
			|| ($fechaCita === date('Y-m-d') && $horaCita <= date('H:i'))) {
			header('Location: carrito.php?mensaje=fecha_invalida');
			exit;
		}

		try {
			$consultaUsuario = $conexion->prepare(
				'SELECT IdUsuario, NombreUsuario, CorreoUsuario, TelefonoUsuario
				 FROM Usuarios WHERE IdUsuario = :id'
			);
			$consultaUsuario->execute([':id' => (int) $_SESSION['usuario_id']]);
			$usuario = $consultaUsuario->fetch(PDO::FETCH_ASSOC);
			if (!$usuario) {
				$_SESSION = [];
				header('Location: login.php?retorno=carrito.php&mensaje=sesion_requerida');
				exit;
			}

			$conexion->beginTransaction();
			$lineasPedido = [];
			$total = 0;
			$duracionTotal = 0;
			$consultaServicio = $conexion->prepare(
				'SELECT Nombre, Precio, DuracionMinutos FROM Servicio WHERE IdServicio = :id AND Activo = 1'
			);

			foreach ($_SESSION['carrito'] as $idServicio => $cantidad) {
				$idServicio = filter_var($idServicio, FILTER_VALIDATE_INT);
				$cantidad = filter_var($cantidad, FILTER_VALIDATE_INT);
				if ($idServicio === false || $idServicio === null || $cantidad === false || $cantidad === null || $cantidad < 1) {
					continue;
				}

				$consultaServicio->execute([':id' => $idServicio]);
				$servicio = $consultaServicio->fetch(PDO::FETCH_ASSOC);
				if (!$servicio) {
					continue;
				}

				$precio = (int) $servicio['Precio'];
				$lineasPedido[] = [
					'id' => $idServicio,
					'nombre' => (string) $servicio['Nombre'],
					'precio' => $precio,
					'cantidad' => $cantidad,
					'duracion' => (int) $servicio['DuracionMinutos'],
				];
				$total += $precio * $cantidad;
				$duracionTotal += (int) $servicio['DuracionMinutos'] * $cantidad;
			}

			if ($lineasPedido === []) {
				$conexion->rollBack();
				$_SESSION['carrito'] = [];
				header('Location: carrito.php?mensaje=vacio');
				exit;
			}

			if ($duracionTotal < 1 || $duracionTotal > 720 || $duracionTotal + ((int) $horaValidada->format('H') * 60) + (int) $horaValidada->format('i') >= 1440) {
				$conexion->rollBack();
				header('Location: carrito.php?mensaje=duracion_invalida');
				exit;
			}
			$finCita = $horaValidada->modify('+' . $duracionTotal . ' minutes')->format('H:i:s');
			$verificarHorario = $conexion->prepare(
				"SELECT COUNT(*) FROM Cita
				 WHERE Fecha = :fecha
				 AND (Estado IS NULL OR Estado NOT IN ('Cancelada', 'Anulada'))
				 AND TIME_TO_SEC(Hora) < TIME_TO_SEC(:fin)
				 AND TIME_TO_SEC(ADDTIME(Hora, SEC_TO_TIME(COALESCE(TIME_TO_SEC(Duracion), 3600)))) > TIME_TO_SEC(:inicio)"
			);
			$verificarHorario->execute([
				':fecha' => $fechaCita,
				':fin' => $finCita,
				':inicio' => $horaValidada->format('H:i:s'),
			]);
			if ((int) $verificarHorario->fetchColumn() > 0) {
				$conexion->rollBack();
				header('Location: carrito.php?mensaje=horario_ocupado');
				exit;
			}

			$crearPedido = $conexion->prepare(
				'INSERT INTO Pedido (IdUsuario, NombreCliente, CorreoCliente, TelefonoCliente, Total)
				 VALUES (:usuario, :nombre, :correo, :telefono, :total)'
			);
			$crearPedido->execute([
				':usuario' => $usuario['IdUsuario'],
				':nombre' => $usuario['NombreUsuario'],
				':correo' => $usuario['CorreoUsuario'],
				':telefono' => $usuario['TelefonoUsuario'] !== '' ? $usuario['TelefonoUsuario'] : null,
				':total' => $total,
			]);
			$idPedido = (int) $conexion->lastInsertId();

			$crearDetalle = $conexion->prepare(
				'INSERT INTO DetallePedido (IdPedido, IdServicio, NombreServicio, PrecioUnitario, Cantidad)
				 VALUES (:pedido, :servicio, :nombre, :precio, :cantidad)'
			);
			foreach ($lineasPedido as $linea) {
				$crearDetalle->execute([
					':pedido' => $idPedido,
					':servicio' => $linea['id'],
					':nombre' => $linea['nombre'],
					':precio' => $linea['precio'],
					':cantidad' => $linea['cantidad'],
				]);
			}

			$crearCita = $conexion->prepare(
				'INSERT INTO Cita (IdUsuario, IdPedido, Fecha, Hora, Estado, Comentario, Duracion)
				 VALUES (:usuario, :pedido, :fecha, :hora, :estado, :comentario, SEC_TO_TIME(:duracion))'
			);
			$detalleCita = implode(', ', array_map(
				static fn(array $linea): string => $linea['nombre'] . ' x ' . $linea['cantidad'],
				$lineasPedido
			));
			$crearCita->execute([
				':usuario' => $usuario['IdUsuario'],
				':pedido' => $idPedido,
				':fecha' => $fechaCita,
				':hora' => $horaValidada->format('H:i:s'),
				':estado' => 'Pendiente',
				':comentario' => 'Pedido #' . $idPedido . ' - ' . $detalleCita,
				':duracion' => $duracionTotal * 60,
			]);

			$crearMovimiento = $conexion->prepare(
				"INSERT INTO Finanzas (IdUsuario, IdPedido, Transaccion, TipoIngreso, Nombre, Monto, Fecha, Estado)
				 VALUES (:usuario, :pedido, 'Ingreso', 'Servicio', :nombre, :monto, :fecha, 'Proyectado')"
			);
			$crearMovimiento->execute([
				':usuario' => $usuario['IdUsuario'],
				':pedido' => $idPedido,
				':nombre' => 'Pedido #' . $idPedido,
				':monto' => $total,
				':fecha' => $fechaCita,
			]);

			$conexion->commit();
			$_SESSION['carrito'] = [];
			header('Location: carrito.php?mensaje=confirmado&id=' . $idPedido);
			exit;
		} catch (Throwable $error) {
			if ($conexion->inTransaction()) {
				$conexion->rollBack();
			}
			header('Location: carrito.php?mensaje=error');
			exit;
		}
	}
}

$carrito = $_SESSION['carrito'] ?? [];
$items = [];
$total = 0;
$consultaServicio = $conexion->prepare(
	'SELECT IdServicio, Nombre, Descripcion, Precio FROM Servicio WHERE IdServicio = :id AND Activo = 1'
);

foreach ($carrito as $idServicio => $cantidad) {
	$idServicio = filter_var($idServicio, FILTER_VALIDATE_INT);
	$cantidad = filter_var($cantidad, FILTER_VALIDATE_INT);
	if ($idServicio === false || $idServicio === null || $cantidad === false || $cantidad === null || $cantidad < 1) {
		continue;
	}

	$consultaServicio->execute([':id' => $idServicio]);
	$servicio = $consultaServicio->fetch(PDO::FETCH_ASSOC);
	if (!$servicio) {
		continue;
	}

	$servicio['Cantidad'] = $cantidad;
	$servicio['Subtotal'] = (int) $servicio['Precio'] * $cantidad;
	$items[] = $servicio;
	$total += $servicio['Subtotal'];
}

$mensaje = $_GET['mensaje'] ?? '';
$fechaMinima = date('Y-m-d');
$usuarioActual = null;
if (!empty($_SESSION['usuario_id'])) {
	$consultaUsuario = $conexion->prepare(
		'SELECT NombreUsuario, CorreoUsuario, TelefonoUsuario
		 FROM Usuarios WHERE IdUsuario = :id'
	);
	$consultaUsuario->execute([':id' => (int) $_SESSION['usuario_id']]);
	$usuarioActual = $consultaUsuario->fetch(PDO::FETCH_ASSOC) ?: null;
}
?>
<!DOCTYPE html>
<html lang="es">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>Carrito | Glam Hub</title>
	<link rel="stylesheet" href="css/estilos.css?v=12">
</head>
<body>
	<?php require 'navbar.php'; ?>

	<main class="cart-container">
		<section class="cart-panel">
			<h1>Mi carrito</h1>

			<?php if ($mensaje === 'confirmado'): ?>
				<p class="message success">Pedido #<?= escapar((string) ($_GET['id'] ?? '')) ?> confirmado correctamente.</p>
			<?php elseif ($mensaje === 'vacio'): ?>
				<p class="message error">Tu carrito no contiene servicios válidos.</p>
			<?php elseif ($mensaje === 'error'): ?>
				<p class="message error">No se pudo guardar el pedido. Inténtalo nuevamente.</p>
			<?php elseif ($mensaje === 'fecha_invalida'): ?>
				<p class="message error">Selecciona una fecha actual o futura y una hora válida.</p>
			<?php elseif ($mensaje === 'horario_ocupado'): ?>
				<p class="message error">Ese horario ya no está disponible. Elige otro turno.</p>
			<?php elseif ($mensaje === 'duracion_invalida'): ?>
				<p class="message error">La duración del pedido no cabe en un mismo día de agenda.</p>
			<?php endif; ?>

			<?php if ($items === []): ?>
				<p class="cart-empty">Tu carrito está vacío.</p>
				<div class="cart-actions">
					<a class="cart-action secondary" href="servicios.php">Ver servicios</a>
				</div>
			<?php else: ?>
				<div class="cart-items">
					<?php foreach ($items as $item): ?>
						<article class="cart-item">
							<div class="cart-item-info">
								<strong><?= escapar((string) $item['Nombre']) ?></strong>
								<p><?= escapar((string) $item['Descripcion']) ?></p>
								<span class="cart-quantity">Cantidad: <?= escapar((string) $item['Cantidad']) ?></span>
							</div>
							<span class="cart-price">$<?= number_format((float) $item['Subtotal'], 0, ',', '.') ?> COP</span>
							<form method="post" class="cart-remove-form">
								<input type="hidden" name="accion" value="eliminar">
								<input type="hidden" name="id_servicio" value="<?= escapar((string) $item['IdServicio']) ?>">
								<button class="cart-remove" type="submit">Eliminar</button>
							</form>
						</article>
					<?php endforeach; ?>
				</div>

				<div class="cart-summary">
					<span>Total</span>
					<span>$<?= number_format((float) $total, 0, ',', '.') ?> COP</span>
				</div>

				<?php if ($usuarioActual): ?>
					<div class="cart-account-summary">
						<strong><?= escapar((string) $usuarioActual['NombreUsuario']) ?></strong>
						<span><?= escapar((string) $usuarioActual['CorreoUsuario']) ?></span>
					</div>
					<form method="post" class="cart-checkout-form">
						<input type="hidden" name="accion" value="confirmar">
						<div class="cart-appointment-fields">
							<div>
								<label for="fecha-cita">Fecha de la cita</label>
								<input id="fecha-cita" type="date" name="fecha" min="<?= escapar($fechaMinima) ?>" required>
							</div>
							<div>
								<label for="hora-cita">Hora de inicio</label>
								<input id="hora-cita" type="time" name="hora" step="1800" required>
							</div>
						</div>
					<div class="cart-actions">
						<a class="cart-action secondary" href="servicios.php">Seguir comprando</a>
						<button class="cart-action" type="submit">Confirmar pedido</button>
					</div>
					</form>
				<?php else: ?>
					<p class="cart-login-prompt">Inicia sesión para guardar la compra en tus citas.</p>
					<div class="cart-actions">
						<a class="cart-action secondary" href="servicios.php">Seguir comprando</a>
						<a class="cart-action" href="login.php?retorno=carrito.php">Iniciar sesión para comprar</a>
					</div>
				<?php endif; ?>
			<?php endif; ?>
		</section>
	</main>
</body>
</html>
