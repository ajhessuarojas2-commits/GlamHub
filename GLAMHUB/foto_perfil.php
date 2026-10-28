<?php
require 'conexion.php';
require_once 'auth.php';
exigirInicioSesion('citas.php');

$idUsuario = filter_var($_GET['id'] ?? null, FILTER_VALIDATE_INT);
if ($idUsuario === false || $idUsuario === null || $idUsuario < 1) {
	http_response_code(404);
	exit;
}

$consultaAdmin = $conexion->prepare(
	"SELECT 1 FROM Rol WHERE IdUsuario = :usuario AND NombreRol = 'Administrador' LIMIT 1"
);
$consultaAdmin->execute([':usuario' => (int) $_SESSION['usuario_id']]);
$esAdministrador = (bool) $consultaAdmin->fetchColumn();
if (!$esAdministrador && (int) $_SESSION['usuario_id'] !== $idUsuario) {
	http_response_code(403);
	exit;
}

$consultaFoto = $conexion->prepare(
	'SELECT FotoPerfil, TipoFotoPerfil FROM Usuarios WHERE IdUsuario = :id'
);
$consultaFoto->execute([':id' => $idUsuario]);
$foto = $consultaFoto->fetch(PDO::FETCH_ASSOC);
if (!$foto || !$foto['FotoPerfil'] || !in_array($foto['TipoFotoPerfil'], ['image/jpeg', 'image/png', 'image/webp'], true)) {
	http_response_code(204);
	exit;
}

header('Content-Type: ' . $foto['TipoFotoPerfil']);
header('X-Content-Type-Options: nosniff');
header('Cache-Control: private, no-store');
echo $foto['FotoPerfil'];