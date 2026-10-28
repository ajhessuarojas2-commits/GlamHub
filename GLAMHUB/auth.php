<?php
if (session_status() === PHP_SESSION_NONE) {
	session_start();
}

function exigirInicioSesion(string $destino = 'servicios.php'): void
{
	if (empty($_SESSION['usuario_id'])) {
		header('Location: login.php?retorno=' . rawurlencode($destino));
		exit;
	}
}

function tokenCSRF(): string
{
	if (empty($_SESSION['token_csrf'])) {
		$_SESSION['token_csrf'] = bin2hex(random_bytes(32));
	}

	return (string) $_SESSION['token_csrf'];
}

function validarTokenCSRF(): bool
{
	$tokenEnviado = (string) ($_POST['token_csrf'] ?? '');
	$tokenSesion = (string) ($_SESSION['token_csrf'] ?? '');

	return $tokenEnviado !== '' && $tokenSesion !== '' && hash_equals($tokenSesion, $tokenEnviado);
}
