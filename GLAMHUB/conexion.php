<?php
    $host = "127.0.0.1";
    $puerto = 3306;
    $usuario = "root";
    $password = "";
    $base_datos = "glamhub";

    try {
        $conexion = new PDO(
            "mysql:host=$host;port=$puerto;dbname=$base_datos;charset=utf8mb4",
            $usuario,
            $password
        );
        $conexion->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    } catch (PDOException $error) {
        exit("Error de conexión a la base de datos.");
    }
?>