<?php

$origen = $_SERVER['HTTP_ORIGIN'] ?? '';
$origenesPermitidos = [
    'http://localhost:3000',
    'http://localhost:5173',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:5173'
];

if (in_array($origen, $origenesPermitidos, true)) {
    header("Access-Control-Allow-Origin: $origen");
}

header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

$mostrarTabla = $_SERVER['REQUEST_METHOD'] === 'GET'
    && strpos($_SERVER['HTTP_ACCEPT'] ?? '', 'text/html') !== false;

function responderJson($datos, int $estado = 200): void
{
    http_response_code($estado);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($datos, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
}

function escaparHtml($valor): string
{
    return htmlspecialchars((string) $valor, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

if (!in_array($_SERVER['REQUEST_METHOD'], ['GET', 'POST'], true)) {
    responderJson(['error' => 'Método no permitido'], 405);
    exit;
}

try {
    $conexion = new PDO(
        'mysql:host=127.0.0.1;port=3307;dbname=doble_busqueda;charset=utf8mb4',
        'root',
        '',
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
    );

    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        $datos = json_decode(file_get_contents('php://input'), true);
        if (!is_array($datos)) {
            responderJson(['error' => 'El cuerpo de la solicitud no es válido.'], 400);
            exit;
        }

        $idCita = filter_var($datos['IdCita'] ?? null, FILTER_VALIDATE_INT);
        $idUsuario = ($datos['IdUsuario'] ?? '') === ''
            ? null
            : filter_var($datos['IdUsuario'], FILTER_VALIDATE_INT);
        $idPedido = ($datos['IdPedido'] ?? '') === ''
            ? null
            : filter_var($datos['IdPedido'], FILTER_VALIDATE_INT);
        $fecha = trim((string) ($datos['Fecha'] ?? ''));
        $hora = trim((string) ($datos['Hora'] ?? ''));
        $estado = trim((string) ($datos['Estado'] ?? ''));
        $comentario = trim((string) ($datos['Comentario'] ?? ''));
        $duracion = trim((string) ($datos['Duracion'] ?? ''));

        $fechaPartes = explode('-', $fecha);
        $fechaValida = count($fechaPartes) === 3
            && checkdate((int) $fechaPartes[1], (int) $fechaPartes[2], (int) $fechaPartes[0])
            && preg_match('/^\d{4}-\d{2}-\d{2}$/', $fecha);
        $horaValida = preg_match('/^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/', $hora);
        $duracionValida = preg_match('/^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/', $duracion);

        if (
            $idCita === false || $idCita < 1
            || ($idUsuario !== null && ($idUsuario === false || $idUsuario < 1))
            || ($idPedido !== null && ($idPedido === false || $idPedido < 1))
            || !$fechaValida || !$horaValida || !$duracionValida
            || $estado === '' || strlen($estado) > 30
        ) {
            responderJson(['error' => 'Revisa los datos: fecha, hora, duración, estado e identificadores.'], 400);
            exit;
        }

        $verificarCita = $conexion->prepare('SELECT IdCita FROM Cita WHERE IdCita = ?');
        $verificarCita->execute([$idCita]);
        if (!$verificarCita->fetchColumn()) {
            responderJson(['error' => 'La cita indicada no existe.'], 404);
            exit;
        }

        if ($idUsuario !== null) {
            $verificarUsuario = $conexion->prepare('SELECT IdUsuario FROM Usuarios WHERE IdUsuario = ?');
            $verificarUsuario->execute([$idUsuario]);
            if (!$verificarUsuario->fetchColumn()) {
                responderJson(['error' => 'El usuario seleccionado no existe.'], 400);
                exit;
            }
        }

        if (strlen($hora) === 5) {
            $hora .= ':00';
        }
        if (strlen($duracion) === 5) {
            $duracion .= ':00';
        }

        $actualizar = $conexion->prepare(
            'UPDATE Cita
            SET IdUsuario = :idUsuario,
                IdPedido = :idPedido,
                Fecha = :fecha,
                Hora = :hora,
                Estado = :estado,
                Comentario = :comentario,
                Duracion = :duracion
            WHERE IdCita = :idCita'
        );
        $actualizar->execute([
            ':idUsuario' => $idUsuario,
            ':idPedido' => $idPedido,
            ':fecha' => $fecha,
            ':hora' => $hora,
            ':estado' => $estado,
            ':comentario' => $comentario === '' ? null : $comentario,
            ':duracion' => $duracion,
            ':idCita' => $idCita
        ]);

        responderJson(['mensaje' => 'Cambios guardados correctamente.']);
        exit;
    }

    $consulta = $conexion->query(
        'SELECT
            c.IdCita,
            c.IdUsuario,
            u.NombreUsuario,
            u.CorreoUsuario,
            c.IdPedido,
            c.Fecha,
            c.Hora,
            c.Estado,
            c.Comentario,
            c.Duracion
        FROM Cita AS c
        LEFT JOIN Usuarios AS u ON u.IdUsuario = c.IdUsuario
        ORDER BY c.Fecha, c.Hora, c.IdCita'
    );
    $citas = $consulta->fetchAll(PDO::FETCH_ASSOC);

    if (!$mostrarTabla) {
        responderJson($citas);
        exit;
    }

    $usuarios = $conexion->query(
        'SELECT IdUsuario, NombreUsuario, CorreoUsuario FROM Usuarios ORDER BY NombreUsuario'
    )->fetchAll(PDO::FETCH_ASSOC);
} catch (Throwable $error) {
    error_log($error->getMessage());
    responderJson(['error' => 'Ocurrió un error al procesar la solicitud.'], 500);
    exit;
}
?>
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Administrar citas</title>
    <style>
        body { margin: 0; padding: 24px; color: #1f2937; background: #f3f4f6; font: 15px Arial, sans-serif; }
        main { max-width: 1500px; margin: 0 auto; }
        h1 { margin: 0 0 8px; }
        .ayuda { margin: 0 0 20px; color: #4b5563; }
        .tabla-contenedor { overflow-x: auto; background: #fff; border-radius: 8px; box-shadow: 0 2px 8px #00000012; }
        table { width: 100%; min-width: 1250px; border-collapse: collapse; }
        th, td { padding: 10px; border-bottom: 1px solid #e5e7eb; text-align: left; vertical-align: middle; }
        th { background: #e8eef8; white-space: nowrap; }
        input, select { box-sizing: border-box; width: 100%; min-width: 115px; padding: 7px; border: 1px solid #cbd5e1; border-radius: 4px; font: inherit; }
        input[type="number"] { min-width: 90px; }
        input[type="date"] { min-width: 140px; }
        .usuario { min-width: 190px; }
        button { padding: 8px 12px; color: #fff; background: #2563eb; border: 0; border-radius: 4px; cursor: pointer; font: inherit; }
        button:disabled { opacity: .6; cursor: wait; }
        .mensaje { min-height: 20px; margin: 16px 0 0; }
        .mensaje.error { color: #b91c1c; }
        .mensaje.exito { color: #15803d; }
        @media (max-width: 600px) { body { padding: 14px; } }
    </style>
</head>
<body>
<main>
    <h1>Administrar citas</h1>
    <p class="ayuda">Edita los campos directamente en la tabla y pulsa «Guardar» en la fila correspondiente.</p>
    <div class="tabla-contenedor">
        <table>
            <thead>
                <tr>
                    <th>ID cita</th>
                    <th>Usuario</th>
                    <th>ID pedido</th>
                    <th>Fecha</th>
                    <th>Hora</th>
                    <th>Estado</th>
                    <th>Comentario</th>
                    <th>Duración</th>
                    <th>Acción</th>
                </tr>
            </thead>
            <tbody>
            <?php foreach ($citas as $cita): ?>
                <tr data-id-cita="<?= escaparHtml($cita['IdCita']) ?>">
                    <td><?= escaparHtml($cita['IdCita']) ?></td>
                    <td>
                        <select class="usuario" data-campo="IdUsuario">
                            <option value="">Sin usuario</option>
                            <?php foreach ($usuarios as $usuario): ?>
                                <option value="<?= escaparHtml($usuario['IdUsuario']) ?>" <?= (string) $usuario['IdUsuario'] === (string) $cita['IdUsuario'] ? 'selected' : '' ?>>
                                    <?= escaparHtml($usuario['NombreUsuario'] . ' (' . $usuario['CorreoUsuario'] . ')') ?>
                                </option>
                            <?php endforeach; ?>
                        </select>
                    </td>
                    <td><input type="number" min="1" data-campo="IdPedido" value="<?= escaparHtml($cita['IdPedido']) ?>"></td>
                    <td><input type="date" data-campo="Fecha" value="<?= escaparHtml($cita['Fecha']) ?>"></td>
                    <td><input type="time" step="1" data-campo="Hora" value="<?= escaparHtml($cita['Hora']) ?>"></td>
                    <td><input type="text" maxlength="30" required data-campo="Estado" value="<?= escaparHtml($cita['Estado']) ?>"></td>
                    <td><input type="text" data-campo="Comentario" value="<?= escaparHtml($cita['Comentario']) ?>"></td>
                    <td><input type="time" step="1" data-campo="Duracion" value="<?= escaparHtml($cita['Duracion']) ?>"></td>
                    <td><button type="button" class="guardar">Guardar</button></td>
                </tr>
            <?php endforeach; ?>
            </tbody>
        </table>
    </div>
    <p id="mensaje" class="mensaje" role="status" aria-live="polite"></p>
</main>
<script>
    const mensaje = document.getElementById('mensaje');

    document.querySelectorAll('.guardar').forEach((boton) => {
        boton.addEventListener('click', async () => {
            const fila = boton.closest('tr');
            const datos = { IdCita: fila.dataset.idCita };
            fila.querySelectorAll('[data-campo]').forEach((campo) => {
                datos[campo.dataset.campo] = campo.value;
            });

            boton.disabled = true;
            mensaje.className = 'mensaje';
            mensaje.textContent = 'Guardando cambios...';

            try {
                const respuesta = await fetch(window.location.href, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                    body: JSON.stringify(datos)
                });
                const resultado = await respuesta.json();
                if (!respuesta.ok) {
                    throw new Error(resultado.error || 'No se pudieron guardar los cambios.');
                }
                mensaje.classList.add('exito');
                mensaje.textContent = resultado.mensaje;
            } catch (error) {
                mensaje.classList.add('error');
                mensaje.textContent = error.message || 'No se pudo conectar con el servidor.';
            } finally {
                boton.disabled = false;
            }
        });
    });
</script>
</body>
</html>
