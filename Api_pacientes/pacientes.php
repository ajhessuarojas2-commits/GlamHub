<?php

header("Content-Type: application/json; charset=utf-8");

require_once __DIR__ . "/conexion.php";

$metodo = $_SERVER["REQUEST_METHOD"];

try {

    // CONSULTAR PACIENTES
    if ($metodo === "GET") {

        $sql = "SELECT * FROM pacientes";

        $consulta = $conexion->prepare($sql);

        $consulta->execute();

        $pacientes = $consulta->fetchAll(PDO::FETCH_ASSOC);

        echo json_encode($pacientes);

    }

    // REGISTRAR PACIENTE
    elseif ($metodo === "POST") {

        $datos = json_decode(
            file_get_contents("php://input"),
            true
        );

        if (
            !is_array($datos) ||
            empty($datos["Id_Paciente"]) ||
            empty($datos["Nombre"]) ||
            empty($datos["Apellido"])
        ) {
            http_response_code(400);

            echo json_encode([
                "error" => "Datos del paciente incompletos"
            ]);

            exit;
        }

        $sql = "INSERT INTO pacientes
                (Id_Paciente, Nombre, Apellido, Contacto)
                VALUES (:id, :nombre, :apellido, :contacto)";

        $consulta = $conexion->prepare($sql);

        $consulta->execute([
            ":id" => $datos["Id_Paciente"],
            ":nombre" => $datos["Nombre"],
            ":apellido" => $datos["Apellido"],
            ":contacto" => $datos["Contacto"] ?? null
        ]);

        http_response_code(201);

        echo json_encode([
            "mensaje" => "Paciente registrado correctamente"
        ]);

    }

    else {

        http_response_code(405);

        echo json_encode([
            "error" => "Método HTTP no permitido"
        ]);

    }

} catch (PDOException $e) {

    http_response_code(500);

    echo json_encode([
        "error" => "No fue posible procesar la solicitud"
    ]);

}
?>