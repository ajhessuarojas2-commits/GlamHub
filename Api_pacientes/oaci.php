<?php

require_once "conexion.php";

session_start();

if (empty($_SESSION["csrf_token"])) {
    $_SESSION["csrf_token"] = bin2hex(random_bytes(32));
}

$mensajeError = null;
$mensajeExito = $_SESSION["mensaje_exito"] ?? null;
unset($_SESSION["mensaje_exito"]);

if ($_SERVER["REQUEST_METHOD"] === "POST") {
    $token = (string) ($_POST["csrf_token"] ?? "");

    if (!hash_equals($_SESSION["csrf_token"], $token)) {
        $mensajeError = "El formulario venció. Recarga la página e inténtalo de nuevo.";
    } else {
        $accion = (string) ($_POST["accion"] ?? "");
        $idMedicamentoForm = trim((string) ($_POST["id_medicamento"] ?? ""));
        $informacionMedicamento = trim((string) ($_POST["n_medicamentos"] ?? ""));

        if ($idMedicamentoForm === "" || strlen($idMedicamentoForm) > 10) {
            $mensajeError = "El ID del medicamento es obligatorio y debe tener hasta 10 caracteres.";
        } elseif ($informacionMedicamento === "" || strlen($informacionMedicamento) > 30) {
            $mensajeError = "La información del medicamento es obligatoria y debe tener hasta 30 caracteres.";
        } elseif ($accion !== "agregar" && $accion !== "editar") {
            $mensajeError = "La acción solicitada no es válida.";
        } else {
            try {
                if ($accion === "agregar") {
                    $consulta = $conexion->prepare(
                        "INSERT INTO `medicamento` (`IdMedicamento`, `N_Medicamentos`) VALUES (?, ?)"
                    );
                    $consulta->execute([$idMedicamentoForm, $informacionMedicamento]);
                    $_SESSION["mensaje_exito"] = "Medicamento agregado correctamente.";
                } else {
                    $consulta = $conexion->prepare(
                        "UPDATE `medicamento` SET `N_Medicamentos` = ? WHERE `IdMedicamento` = ?"
                    );
                    $consulta->execute([$informacionMedicamento, $idMedicamentoForm]);

                    $consulta = $conexion->prepare(
                        "SELECT 1 FROM `medicamento` WHERE `IdMedicamento` = ?"
                    );
                    $consulta->execute([$idMedicamentoForm]);
                    if (!$consulta->fetchColumn()) {
                        $mensajeError = "No se encontró el medicamento que intentas editar.";
                    } else {
                        $_SESSION["mensaje_exito"] = "Información del medicamento actualizada correctamente.";
                    }
                }

                if ($mensajeError === null) {
                    header("Location: pacientes.php", true, 303);
                    exit;
                }
            } catch (PDOException $e) {
                error_log($e->getMessage());
                $mensajeError = $accion === "agregar"
                    ? "No se pudo agregar el medicamento. Verifica que el ID no esté repetido."
                    : "No se pudo actualizar el medicamento.";
            }
        }
    }
}

function getColumns(PDO $conexion, string $table): array
{
    $quotedTable = "`" . str_replace("`", "``", $table) . "`";
    $columns = $conexion->query("SHOW COLUMNS FROM $quotedTable")->fetchAll(PDO::FETCH_COLUMN);

    if (!$columns) {
        throw new RuntimeException("No se encontraron columnas en la tabla $table.");
    }

    return $columns;
}

function quoteIdentifier(string $identifier): string
{
    return "`" . str_replace("`", "``", $identifier) . "`";
}

function findColumn(array $columns, array $candidates, string $table): string
{
    foreach ($candidates as $candidate) {
        foreach ($columns as $column) {
            if (strcasecmp($column, $candidate) === 0) {
                return $column;
            }
        }
    }

    throw new RuntimeException(
        "No se encontró la llave requerida en la tabla $table. Columnas esperadas: " .
        implode(", ", $candidates)
    );
}

function formatColumnName(string $column): string
{
    return ucfirst(str_replace("_", " ", $column));
}

try {
    $pacienteColumns = getColumns($conexion, "Paciente");
    $relacionColumns = getColumns($conexion, "paciente_medicamento");
    $medicamentoColumns = getColumns($conexion, "medicamento");

    $pacienteId = findColumn($pacienteColumns, ["id", "idPaciente"], "Paciente");
    $relacionPacienteId = findColumn(
        $relacionColumns,
        ["paciente_id", "id_paciente", "idPaciente"],
        "paciente_medicamento"
    );
    $relacionMedicamentoId = findColumn(
        $relacionColumns,
        ["medicamento_id", "id_medicamento", "idMedicamento"],
        "paciente_medicamento"
    );
    $medicamentoId = findColumn(
        $medicamentoColumns,
        ["id", "id_medicamento", "idMedicamento"],
        "medicamento"
    );

    $groups = [
        "p" => ["label" => "Paciente", "columns" => $pacienteColumns],
        "pm" => ["label" => "Uso / relación", "columns" => $relacionColumns],
        "m" => ["label" => "Medicamento", "columns" => $medicamentoColumns],
    ];
    $selectColumns = [];

    foreach ($groups as $alias => $group) {
        foreach ($group["columns"] as $column) {
            $resultName = $alias . "__" . $column;
            $selectColumns[] = $alias . "." . quoteIdentifier($column) .
                " AS " . quoteIdentifier($resultName);
        }
    }

    $sql = "SELECT " . implode(", ", $selectColumns) .
        " FROM `Paciente` p" .
        " LEFT JOIN `paciente_medicamento` pm ON pm." .
        quoteIdentifier($relacionPacienteId) . " = p." . quoteIdentifier($pacienteId) .
        " LEFT JOIN `medicamento` m ON m." .
        quoteIdentifier($medicamentoId) . " = pm." . quoteIdentifier($relacionMedicamentoId);

    $filas = $conexion->query($sql)->fetchAll(PDO::FETCH_ASSOC);
    $medicamentos = $conexion->query(
        "SELECT `IdMedicamento`, `N_Medicamentos` FROM `medicamento` ORDER BY `IdMedicamento`"
    )->fetchAll(PDO::FETCH_ASSOC);
    $hayAsignaciones = false;
    foreach ($filas as $fila) {
        if ($fila["pm__" . $relacionPacienteId] !== null) {
            $hayAsignaciones = true;
            break;
        }
    }
} catch (PDOException $e) {
    http_response_code(500);
    error_log($e->getMessage());
    $error = "No fue posible consultar la información. Verifica la conexión y las tablas de la base de datos.";
} catch (RuntimeException $e) {
    http_response_code(500);
    error_log($e->getMessage());
    $error = $e->getMessage();
}

?>
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Pacientes y medicamentos</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 2rem; color: #1f2937; }
        h1 { margin-bottom: 1rem; }
        .table-container { overflow-x: auto; }
        table { border-collapse: collapse; min-width: 100%; }
        th, td { border: 1px solid #d1d5db; padding: 0.65rem; text-align: left; }
        thead tr:first-child th { background: #e8eef8; text-align: center; }
        thead tr:nth-child(2) th { background: #f3f4f6; }
        .error { color: #b91c1c; }
        .success { color: #166534; }
        section { margin: 2rem 0; }
        form { display: flex; flex-wrap: wrap; align-items: end; gap: 0.75rem; }
        label { display: grid; gap: 0.3rem; }
        input, button { font: inherit; padding: 0.5rem; }
        button { cursor: pointer; }
    </style>
</head>
<body>
    <h1>Pacientes y medicamentos</h1>

    <?php if ($mensajeError !== null): ?>
        <p class="error"><?= htmlspecialchars($mensajeError, ENT_QUOTES, "UTF-8") ?></p>
    <?php endif; ?>
    <?php if ($mensajeExito !== null): ?>
        <p class="success"><?= htmlspecialchars($mensajeExito, ENT_QUOTES, "UTF-8") ?></p>
    <?php endif; ?>

    <?php if (isset($error)): ?>
        <p class="error"><?= htmlspecialchars($error, ENT_QUOTES, "UTF-8") ?></p>
    <?php else: ?>
        <section>
            <h2>Pacientes y medicamentos asignados</h2>
            <?php if (!$filas): ?>
                <p>No hay pacientes registrados.</p>
            <?php else: ?>
                <?php if (!$hayAsignaciones): ?>
                    <p>No hay relaciones registradas en paciente_medicamento.</p>
                <?php endif; ?>
                <div class="table-container">
                    <table>
                        <thead>
                            <tr>
                                <?php foreach ($groups as $group): ?>
                                    <th colspan="<?= count($group["columns"]) ?>">
                                        <?= htmlspecialchars($group["label"], ENT_QUOTES, "UTF-8") ?>
                                    </th>
                                <?php endforeach; ?>
                            </tr>
                            <tr>
                                <?php foreach ($groups as $group): ?>
                                    <?php foreach ($group["columns"] as $column): ?>
                                        <th>
                                            <?= htmlspecialchars(formatColumnName($column), ENT_QUOTES, "UTF-8") ?>
                                        </th>
                                    <?php endforeach; ?>
                                <?php endforeach; ?>
                            </tr>
                        </thead>
                        <tbody>
                            <?php foreach ($filas as $fila): ?>
                                <tr>
                                    <?php foreach ($groups as $alias => $group): ?>
                                        <?php foreach ($group["columns"] as $column): ?>
                                            <td>
                                                <?php $valor = $fila[$alias . "__" . $column]; ?>
                                                <?= $valor === null
                                                    ? "&mdash;"
                                                    : htmlspecialchars((string) $valor, ENT_QUOTES, "UTF-8") ?>
                                            </td>
                                        <?php endforeach; ?>
                                    <?php endforeach; ?>
                                </tr>
                            <?php endforeach; ?>
                        </tbody>
                    </table>
                </div>
            <?php endif; ?>
        </section>

        <section>
            <h2>Medicamentos</h2>
            <form method="post">
                <input type="hidden" name="csrf_token" value="<?= htmlspecialchars($_SESSION["csrf_token"], ENT_QUOTES, "UTF-8") ?>">
                <input type="hidden" name="accion" value="agregar">
                <label>
                    ID del medicamento
                    <input type="text" name="id_medicamento" maxlength="10" required>
                </label>
                <label>
                    N_Medicamentos
                    <input type="text" name="n_medicamentos" maxlength="30" required>
                </label>
                <button type="submit">Agregar medicamento</button>
            </form>

            <?php if (!$medicamentos): ?>
                <p>No hay medicamentos registrados.</p>
            <?php else: ?>
                <div class="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>ID del medicamento</th>
                                <th>N_Medicamentos</th>
                                <th>Editar información</th>
                            </tr>
                        </thead>
                        <tbody>
                            <?php foreach ($medicamentos as $medicamento): ?>
                                <tr>
                                    <td><?= htmlspecialchars($medicamento["IdMedicamento"], ENT_QUOTES, "UTF-8") ?></td>
                                    <td><?= htmlspecialchars((string) $medicamento["N_Medicamentos"], ENT_QUOTES, "UTF-8") ?></td>
                                    <td>
                                        <form method="post">
                                            <input type="hidden" name="csrf_token" value="<?= htmlspecialchars($_SESSION["csrf_token"], ENT_QUOTES, "UTF-8") ?>">
                                            <input type="hidden" name="accion" value="editar">
                                            <input type="hidden" name="id_medicamento" value="<?= htmlspecialchars($medicamento["IdMedicamento"], ENT_QUOTES, "UTF-8") ?>">
                                            <label>
                                                Cambiar N_Medicamentos
                                                <input
                                                    type="text"
                                                    name="n_medicamentos"
                                                    value="<?= htmlspecialchars((string) $medicamento["N_Medicamentos"], ENT_QUOTES, "UTF-8") ?>"
                                                    maxlength="30"
                                                    required
                                                >
                                            </label>
                                            <button type="submit">Guardar cambios</button>
                                        </form>
                                    </td>
                                </tr>
                            <?php endforeach; ?>
                        </tbody>
                    </table>
                </div>
            <?php endif; ?>
        </section>
    <?php endif; ?>
</body>
</html>
