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
    <title>Citas | Doble búsqueda</title>
    <style>
        :root {
            color-scheme: light;
            font-family: "Segoe UI", Arial, sans-serif;
            color: #172033;
            background: #f4f6fb;
        }
        * { box-sizing: border-box; }
        body { margin: 0; padding: 36px 22px; }
        main { max-width: 1050px; margin: 0 auto; }
        .encabezado { margin-bottom: 24px; }
        h1 { margin: 0 0 7px; font-size: 30px; letter-spacing: -.5px; }
        .encabezado p { margin: 0; color: #64748b; }
        .panel-titulo { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 14px; }
        .panel-titulo strong { font-size: 17px; }
        .contador { padding: 5px 10px; color: #475569; background: #e9eef8; border-radius: 20px; font-size: 13px; }
        .lista-citas { display: grid; gap: 16px; }
        .cita { padding: 20px; background: #fff; border: 1px solid #e6eaf1; border-radius: 12px; box-shadow: 0 5px 18px #17203309; }
        .cita-cabecera { display: flex; align-items: center; justify-content: space-between; gap: 14px; margin-bottom: 18px; padding-bottom: 14px; border-bottom: 1px solid #edf0f5; }
        .cita-cabecera h2 { margin: 0; font-size: 16px; }
        .cita-cabecera p { margin: 5px 0 0; color: #64748b; font-size: 13px; }
        .campos { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 14px; }
        .campo { min-width: 0; }
        .campo label { display: block; margin: 0 0 6px; color: #64748b; font-size: 12px; font-weight: 600; }
        .campo-amplio { grid-column: span 2; }
        .usuario { min-width: 0; }
        input, select { width: 100%; min-width: 0; padding: 9px 10px; color: #172033; background: #fff; border: 1px solid #d9e0ea; border-radius: 6px; font: inherit; font-size: 13px; }
        input:focus, select:focus { outline: 2px solid #bfdbfe; border-color: #3b82f6; }
        .acciones { display: flex; justify-content: flex-end; margin-top: 16px; }
        button { padding: 10px 16px; color: #fff; background: #2563eb; border: 0; border-radius: 6px; cursor: pointer; font: inherit; font-size: 13px; font-weight: 600; white-space: nowrap; }
        button:hover { background: #1d4ed8; }
        button:disabled { cursor: wait; opacity: .6; }
        .vacio { padding: 36px 20px; color: #64748b; text-align: center; }
        #mensaje { min-height: 22px; margin: 14px 2px 0; font-size: 14px; }
        #mensaje.error { color: #b91c1c; }
        #mensaje.exito { color: #15803d; }
        @media (max-width: 760px) { .campos { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
        @media (max-width: 520px) {
            body { padding: 22px 12px; }
            h1 { font-size: 25px; }
            .cita { padding: 15px; }
            .campos { grid-template-columns: 1fr; gap: 12px; }
            .campo-amplio { grid-column: auto; }
            .acciones button { width: 100%; }
        }
    </style>
</head>
<body>
<main>
    <header class="encabezado">
        <h1>Administrar citas</h1>
        <p>Consulta y edita las citas. Están ordenadas por fecha y hora.</p>
    </header>

    <section aria-label="Listado de citas">
        <div class="panel-titulo">
            <strong>Agenda</strong>
            <span class="contador"><?= count($citas) ?> citas</span>
        </div>
        <?php if (count($citas) === 0): ?>
            <p class="vacio">No hay citas para mostrar.</p>
        <?php else: ?>
            <div class="lista-citas">
                <?php foreach ($citas as $cita): ?>
                    <article class="cita" data-id-cita="<?= escaparHtml($cita['IdCita']) ?>">
                        <header class="cita-cabecera">
                            <div>
                                <h2>Cita #<?= escaparHtml($cita['IdCita']) ?></h2>
                                <p>Completa o ajusta los datos de esta cita</p>
                            </div>
                        </header>
                        <div class="campos">
                            <div class="campo campo-amplio">
                                <label for="usuario-<?= escaparHtml($cita['IdCita']) ?>">Usuario</label>
                                <select id="usuario-<?= escaparHtml($cita['IdCita']) ?>" class="usuario" data-campo="IdUsuario">
                                    <option value="">Sin usuario</option>
                                    <?php foreach ($usuarios as $usuario): ?>
                                        <option value="<?= escaparHtml($usuario['IdUsuario']) ?>" <?= (string) $usuario['IdUsuario'] === (string) $cita['IdUsuario'] ? 'selected' : '' ?>>
                                            <?= escaparHtml($usuario['NombreUsuario'] . ' · ' . $usuario['CorreoUsuario']) ?>
                                        </option>
                                    <?php endforeach; ?>
                                </select>
                            </div>
                            <div class="campo">
                                <label for="pedido-<?= escaparHtml($cita['IdCita']) ?>">ID del pedido</label>
                                <input id="pedido-<?= escaparHtml($cita['IdCita']) ?>" type="number" min="1" data-campo="IdPedido" value="<?= escaparHtml($cita['IdPedido']) ?>">
                            </div>
                            <div class="campo">
                                <label for="fecha-<?= escaparHtml($cita['IdCita']) ?>">Fecha</label>
                                <input id="fecha-<?= escaparHtml($cita['IdCita']) ?>" type="date" data-campo="Fecha" value="<?= escaparHtml($cita['Fecha']) ?>">
                            </div>
                            <div class="campo">
                                <label for="hora-<?= escaparHtml($cita['IdCita']) ?>">Hora</label>
                                <input id="hora-<?= escaparHtml($cita['IdCita']) ?>" type="time" step="1" data-campo="Hora" value="<?= escaparHtml($cita['Hora']) ?>">
                            </div>
                            <div class="campo">
                                <label for="estado-<?= escaparHtml($cita['IdCita']) ?>">Estado</label>
                                <input id="estado-<?= escaparHtml($cita['IdCita']) ?>" type="text" maxlength="30" required data-campo="Estado" value="<?= escaparHtml($cita['Estado']) ?>">
                            </div>
                            <div class="campo">
                                <label for="duracion-<?= escaparHtml($cita['IdCita']) ?>">Duración</label>
                                <input id="duracion-<?= escaparHtml($cita['IdCita']) ?>" type="time" step="1" data-campo="Duracion" value="<?= escaparHtml($cita['Duracion']) ?>">
                            </div>
                            <div class="campo campo-amplio">
                                <label for="comentario-<?= escaparHtml($cita['IdCita']) ?>">Comentario</label>
                                <input id="comentario-<?= escaparHtml($cita['IdCita']) ?>" type="text" data-campo="Comentario" value="<?= escaparHtml($cita['Comentario']) ?>">
                            </div>
                        </div>
                        <div class="acciones"><button type="button" class="guardar">Guardar cambios</button></div>
                    </article>
                <?php endforeach; ?>
            </div>
        <?php endif; ?>
    </section>
    <p id="mensaje" role="status" aria-live="polite"></p>
</main>
<script>
    const mensaje = document.getElementById('mensaje');

    document.querySelectorAll('.guardar').forEach((boton) => {
        boton.addEventListener('click', async () => {
            const fila = boton.closest('.cita');
            const datos = { IdCita: fila.dataset.idCita };
            fila.querySelectorAll('[data-campo]').forEach((campo) => {
                datos[campo.dataset.campo] = campo.value;
            });

            boton.disabled = true;
            mensaje.className = '';
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