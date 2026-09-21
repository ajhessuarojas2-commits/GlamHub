<?php
    $host = "localhost:3307";
    $usuario = "root";
    $password = "";
    $base_datos = "glamhub";

    try {
        $conexion = new PDO(
            "mysql:host=$host;dbname=$base_datos;charset=utf8mb4",
            $usuario,
            $password
        );
        $conexion->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    } catch (PDOException $error) {
        exit("Error de conexión a la base de datos.");
    }
?>