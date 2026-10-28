<?php
require 'conexion.php';
require_once 'auth.php';
exigirInicioSesion('finanzas.php');

function escapar(string $valor): string
{
	return htmlspecialchars($valor, ENT_QUOTES, 'UTF-8');
}

$consultaAdmin = $conexion->prepare(
	"SELECT 1 FROM Rol WHERE IdUsuario = :usuario AND NombreRol = 'Administrador' LIMIT 1"
);
$consultaAdmin->execute([':usuario' => (int) $_SESSION['usuario_id']]);
if (!$consultaAdmin->fetchColumn()) {
	http_response_code(403);
	exit('No tienes permiso para consultar las finanzas.');
}

$mensaje = $_GET['mensaje'] ?? '';
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
	$accion = (string) ($_POST['accion'] ?? '');
	if ($accion === 'gasto') {
		$nombre = trim((string) ($_POST['nombre'] ?? ''));
		$categoria = (string) ($_POST['categoria'] ?? '');
		$monto = filter_var($_POST['monto'] ?? null, FILTER_VALIDATE_INT);
		$fecha = trim((string) ($_POST['fecha'] ?? ''));
		$fechaValidada = DateTimeImmutable::createFromFormat('!Y-m-d', $fecha);
		if ($nombre === '' || mb_strlen($nombre) > 100 || !in_array($categoria, ['Compra', 'Mantenimiento', 'Operación', 'Otro'], true)
			|| $monto === false || $monto < 1 || !$fechaValidada || $fechaValidada->format('Y-m-d') !== $fecha || $fecha > date('Y-m-d')) {
			header('Location: finanzas.php?mensaje=gasto_invalido');
			exit;
		}

		$crearGasto = $conexion->prepare(
			"INSERT INTO Finanzas (IdUsuario, Transaccion, TipoIngreso, Nombre, Monto, Fecha, Estado)
			 VALUES (:usuario, 'Gasto', :categoria, :nombre, :monto, :fecha, 'Confirmado')"
		);
		$crearGasto->execute([
			':usuario' => (int) $_SESSION['usuario_id'],
			':categoria' => $categoria,
			':nombre' => $nombre,
			':monto' => $monto,
			':fecha' => $fecha,
		]);
		header('Location: finanzas.php?mensaje=gasto_guardado');
		exit;
	}

	if (in_array($accion, ['realizar', 'cancelar'], true)) {
		$idCita = filter_var($_POST['id_cita'] ?? null, FILTER_VALIDATE_INT);
		if ($idCita === false || $idCita === null) {
			header('Location: finanzas.php?mensaje=accion_invalida');
			exit;
		}

		try {
			$conexion->beginTransaction();
			$buscarCita = $conexion->prepare(
				' SELECT IdCita, IdPedido, Estado, Fecha, Hora, Duracion FROM Cita WHERE IdCita = :id FOR UPDATE'
			);
			$buscarCita->execute([':id' => $idCita]);
			$cita = $buscarCita->fetch(PDO::FETCH_ASSOC);
			if (!$cita || !in_array($cita['Estado'], ['Pendiente', 'Confirmada'], true) || $cita['IdPedido'] === null) {
				$conexion->rollBack();
				header('Location: finanzas.php?mensaje=accion_invalida');
				exit;
			}

			if ($accion === 'realizar') {
				$partesDuracion = array_map('intval', explode(':', (string) ($cita['Duracion'] ?: '01:00:00')));
				$duracionSegundos = ($partesDuracion[0] * 3600) + ($partesDuracion[1] * 60) + $partesDuracion[2];
				$finProgramado = (new DateTimeImmutable($cita['Fecha'] . ' ' . $cita['Hora']))
					->modify('+' . $duracionSegundos . ' seconds');
				if ($finProgramado > new DateTimeImmutable()) {
					$conexion->rollBack();
					header('Location: finanzas.php?mensaje=cita_futura');
					exit;
				}
				$actualizarCita = $conexion->prepare("UPDATE Cita SET Estado = 'Realizada' WHERE IdCita = :id");
				$actualizarCita->execute([':id' => $idCita]);
				$actualizarPedido = $conexion->prepare("UPDATE Pedido SET Estado = 'Realizado' WHERE IdPedido = :pedido");
				$actualizarPedido->execute([':pedido' => $cita['IdPedido']]);
				$actualizarIngreso = $conexion->prepare(
					"INSERT INTO Finanzas (IdUsuario, IdPedido, Transaccion, TipoIngreso, Nombre, Monto, Fecha, Estado)
					 SELECT IdUsuario, IdPedido, 'Ingreso', 'Servicio', CONCAT('Pedido #', IdPedido), Total, CURRENT_DATE, 'Confirmado'
					 FROM Pedido WHERE IdPedido = :pedido
					 ON DUPLICATE KEY UPDATE Estado = 'Confirmado', Fecha = CURRENT_DATE"
				);
			} else {
				$actualizarCita = $conexion->prepare("UPDATE Cita SET Estado = 'Cancelada' WHERE IdCita = :id");
				$actualizarCita->execute([':id' => $idCita]);
				$actualizarPedido = $conexion->prepare("UPDATE Pedido SET Estado = 'Cancelado' WHERE IdPedido = :pedido");
				$actualizarPedido->execute([':pedido' => $cita['IdPedido']]);
				$actualizarIngreso = $conexion->prepare(
					"UPDATE Finanzas SET Estado = 'Anulado' WHERE IdPedido = :pedido AND Transaccion = 'Ingreso'"
				);
			}
			$actualizarIngreso->execute([':pedido' => $cita['IdPedido']]);
			$conexion->commit();
			header('Location: finanzas.php?mensaje=' . ($accion === 'realizar' ? 'cita_realizada' : 'cita_cancelada'));
			exit;
		} catch (Throwable $error) {
			if ($conexion->inTransaction()) {
				$conexion->rollBack();
			}
			header('Location: finanzas.php?mensaje=error');
			exit;
		}
	}
}

$consultaReporte = $conexion->query(
	"SELECT
		DATE_FORMAT(Fecha, '%Y-%m') AS Periodo,
		SUM(CASE WHEN Transaccion = 'Ingreso' AND Estado = 'Confirmado' THEN Monto ELSE 0 END) AS IngresosTotal,
		SUM(CASE WHEN Transaccion = 'Gasto' AND Estado = 'Confirmado' THEN Monto ELSE 0 END) AS GastosTotal,
		SUM(CASE WHEN Estado = 'Confirmado' AND Transaccion = 'Ingreso' THEN Monto WHEN Estado = 'Confirmado' AND Transaccion = 'Gasto' THEN -Monto ELSE 0 END) AS GananciasNetas,
		SUM(CASE WHEN Transaccion = 'Ingreso' AND Estado IN ('Proyectado', 'Confirmado') THEN Monto ELSE 0 END) AS IngresosEstimados,
		SUM(CASE WHEN Transaccion = 'Ingreso' AND Estado IN ('Proyectado', 'Confirmado') THEN Monto ELSE 0 END)
			- SUM(CASE WHEN Transaccion = 'Gasto' AND Estado = 'Confirmado' THEN Monto ELSE 0 END) AS GananciasEstimadas
	 FROM Finanzas
	 GROUP BY YEAR(Fecha), MONTH(Fecha)
	 ORDER BY Periodo DESC"
);
$reportes = $consultaReporte->fetchAll(PDO::FETCH_ASSOC);
$consultaCitas = $conexion->query(
	"SELECT C.IdCita, C.IdPedido, C.Fecha, C.Hora, C.Duracion, C.Estado, C.Comentario,
		P.Total, U.NombreUsuario,
		(SELECT F.Estado FROM Finanzas F WHERE F.IdPedido = C.IdPedido AND F.Transaccion = 'Ingreso' LIMIT 1) AS EstadoFinanciero
	 FROM Cita C
	 LEFT JOIN Pedido P ON P.IdPedido = C.IdPedido
	 LEFT JOIN Usuarios U ON U.IdUsuario = C.IdUsuario
	 WHERE C.IdPedido IS NOT NULL
	 ORDER BY C.Fecha DESC, C.Hora DESC"
);
$citas = $consultaCitas->fetchAll(PDO::FETCH_ASSOC);
$fechaHoy = date('Y-m-d');
?>
<!DOCTYPE html>
<html lang="es">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>Finanzas y agenda | Glam Hub</title>
	<link rel="stylesheet" href="css/estilos.css?v=12">
</head>
<body>
	<?php require 'navbar.php'; ?>

	<main class="container finance-container">
		<h1>Finanzas y agenda</h1>
		<?php if ($mensaje === 'gasto_guardado'): ?>
			<p class="message success">Gasto registrado y sumado al reporte.</p>
		<?php elseif ($mensaje === 'gasto_invalido'): ?>
			<p class="message error">Revisa los datos del gasto e inténtalo de nuevo.</p>
		<?php elseif ($mensaje === 'cita_realizada'): ?>
			<p class="message success">Cita marcada como realizada e ingreso confirmado.</p>
		<?php elseif ($mensaje === 'cita_cancelada'): ?>
			<p class="message success">Cita cancelada y su ingreso proyectado anulado.</p>
		<?php elseif ($mensaje === 'cita_futura'): ?>
			<p class="message error">El ingreso solo se confirma después de terminar el servicio.</p>
		<?php elseif ($mensaje === 'accion_invalida' || $mensaje === 'error'): ?>
			<p class="message error">No se pudo completar esa acción.</p>
		<?php endif; ?>

		<section class="finance-section">
			<h2>Registrar gasto</h2>
			<form method="post" class="finance-expense-form">
				<input type="hidden" name="accion" value="gasto">
				<div>
					<label for="gasto-nombre">Concepto</label>
					<input id="gasto-nombre" name="nombre" maxlength="100" required>
				</div>
				<div>
					<label for="gasto-categoria">Categoría</label>
					<select id="gasto-categoria" name="categoria" required>
						<option value="Compra">Compra</option>
						<option value="Mantenimiento">Mantenimiento</option>
						<option value="Operación">Operación</option>
						<option value="Otro">Otro</option>
					</select>
				</div>
				<div>
					<label for="gasto-monto">Monto (COP)</label>
					<input id="gasto-monto" type="number" name="monto" min="1" step="1" required>
				</div>
				<div>
					<label for="gasto-fecha">Fecha</label>
					<input id="gasto-fecha" type="date" name="fecha" max="<?= escapar($fechaHoy) ?>" value="<?= escapar($fechaHoy) ?>" required>
				</div>
				<button type="submit">Guardar gasto</button>
			</form>
		</section>

		<section class="finance-section">
			<h2>Resumen mensual</h2>
			<div class="table-wrapper">
				<table>
					<thead><tr><th>Periodo</th><th>Ingresos confirmados</th><th>Gastos</th><th>Ganancia real</th><th>Ingresos estimados</th><th>Ganancia estimada</th></tr></thead>
					<tbody>
						<?php foreach ($reportes as $reporte): ?>
							<tr>
								<td><?= escapar((string) $reporte['Periodo']) ?></td>
								<td>$<?= number_format((float) $reporte['IngresosTotal'], 0, ',', '.') ?></td>
								<td>$<?= number_format((float) $reporte['GastosTotal'], 0, ',', '.') ?></td>
								<td>$<?= number_format((float) $reporte['GananciasNetas'], 0, ',', '.') ?></td>
								<td>$<?= number_format((float) $reporte['IngresosEstimados'], 0, ',', '.') ?></td>
								<td>$<?= number_format((float) $reporte['GananciasEstimadas'], 0, ',', '.') ?></td>
							</tr>
						<?php endforeach; ?>
					</tbody>
				</table>
			</div>
		</section>

		<section class="finance-section">
			<h2>Citas de pedidos</h2>
			<div class="table-wrapper">
				<table>
					<thead><tr><th>Fecha</th><th>Hora</th><th>Cliente</th><th>Detalle</th><th>Total</th><th>Estado</th><th>Ingreso</th><th>Acción</th></tr></thead>
					<tbody>
						<?php foreach ($citas as $cita): ?>
							<tr>
								<td><?= escapar((string) $cita['Fecha']) ?></td>
								<td><?= escapar(substr((string) $cita['Hora'], 0, 5)) ?></td>
								<td><?= escapar((string) ($cita['NombreUsuario'] ?? 'Cuenta eliminada')) ?></td>
								<td><?= escapar((string) $cita['Comentario']) ?></td>
								<td>$<?= number_format((float) $cita['Total'], 0, ',', '.') ?></td>
								<td><?= escapar((string) $cita['Estado']) ?></td>
								<td><?= escapar((string) ($cita['EstadoFinanciero'] ?? 'Sin movimiento')) ?></td>
								<td>
									<?php if (in_array($cita['Estado'], ['Pendiente', 'Confirmada'], true)): ?>
										<form method="post" class="finance-row-action">
											<input type="hidden" name="id_cita" value="<?= (int) $cita['IdCita'] ?>">
											<button name="accion" value="realizar" type="submit">Realizada</button>
											<button class="finance-cancel" name="accion" value="cancelar" type="submit">Cancelar</button>
										</form>
									<?php else: ?>
										<span>Sin acciones</span>
									<?php endif; ?>
								</td>
							</tr>
						<?php endforeach; ?>
					</tbody>
				</table>
			</div>
		</section>
	</main>
</body>
</html>