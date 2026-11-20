<?php

$servidor = "localhost";
$puerto = 3306;
$usuario = "root";
$password = "";
$baseDatos = "salud";

try {

    $conexion = new PDO(
        "mysql:host=$servidor;port=$puerto;dbname=$baseDatos;charset=utf8mb4",
        $usuario,
        $password
    );

    $conexion->setAttribute(
        PDO::ATTR_ERRMODE,
        PDO::ERRMODE_EXCEPTION
    );

} catch (PDOException $e) {

    http_response_code(500);

    header("Content-Type: application/json; charset=utf-8");

    echo json_encode([
        "error" => "No fue posible conectar con MySQL"
    ]);

    exit;
}

