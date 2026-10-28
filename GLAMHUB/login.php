<?php
require 'conexion.php';
require_once 'auth.php';

function escapar(string $valor): string
{
	return htmlspecialchars($valor, ENT_QUOTES, 'UTF-8');
}

$retornoPermitido = ['servicios.php', 'carrito.php', 'citas.php', 'finanzas.php'];
$retorno = $_POST['retorno'] ?? $_GET['retorno'] ?? 'servicios.php';
if (!in_array($retorno, $retornoPermitido, true)) {
	$retorno = 'servicios.php';
}

if (!empty($_SESSION['usuario_id'])) {
	header('Location: ' . $retorno);
	exit;
}

$mensaje = $_GET['mensaje'] ?? '';
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
	$correo = trim((string) ($_POST['correo'] ?? ''));
	$contrasena = (string) ($_POST['password'] ?? '');

	if (filter_var($correo, FILTER_VALIDATE_EMAIL)) {
		$sentencia = $conexion->prepare(
			"SELECT IdUsuario, NombreUsuario, CorreoUsuario, PasswordUsuario,
				EXISTS (SELECT 1 FROM Rol WHERE Rol.IdUsuario = Usuarios.IdUsuario AND NombreRol = 'Administrador') AS EsAdministrador
			 FROM Usuarios WHERE CorreoUsuario = :correo LIMIT 1"
		);
		$sentencia->execute([':correo' => $correo]);
		$usuario = $sentencia->fetch(PDO::FETCH_ASSOC);

		if ($usuario) {
			$hashGuardado = (string) $usuario['PasswordUsuario'];
			$esHash = password_get_info($hashGuardado)['algo'] !== null;
			$credencialValida = $esHash
				? password_verify($contrasena, $hashGuardado)
				: hash_equals($hashGuardado, $contrasena);

			if ($credencialValida) {
				if (!$esHash) {
					$actualizarHash = $conexion->prepare(
						'UPDATE Usuarios SET PasswordUsuario = :hash WHERE IdUsuario = :id'
					);
					$actualizarHash->execute([
						':hash' => password_hash($contrasena, PASSWORD_DEFAULT),
						':id' => $usuario['IdUsuario'],
					]);
				}

				session_regenerate_id(true);
				$_SESSION['usuario_id'] = (int) $usuario['IdUsuario'];
				$_SESSION['usuario_nombre'] = (string) $usuario['NombreUsuario'];
				$_SESSION['usuario_correo'] = (string) $usuario['CorreoUsuario'];
				$_SESSION['es_administrador'] = (bool) $usuario['EsAdministrador'];
				header('Location: ' . $retorno);
				exit;
			}
		}
	}

	$mensaje = 'credenciales_invalidas';
}
?>
<!DOCTYPE html>
<html lang="es">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>Iniciar sesión | Glam Hub</title>
	<link rel="stylesheet" href="css/estilos.css?v=12">
</head>
<body>
	<?php require 'navbar.php'; ?>

	<main class="auth-container">
		<section class="auth-panel">
			<h1>Iniciar sesión</h1>
			<p>Ingresa para continuar en Glam Hub.</p>

			<?php if ($mensaje === 'credenciales_invalidas'): ?>
				<div class="message error">Correo o contraseña incorrectos.</div>
			<?php elseif ($mensaje === 'sesion_requerida'): ?>
				<div class="message error">Inicia sesión para confirmar tu compra.</div>
			<?php endif; ?>

			<form method="post">
				<input type="hidden" name="retorno" value="<?= escapar($retorno) ?>">
				<label for="correo">Correo electrónico</label>
				<input id="correo" type="email" name="correo" maxlength="150" autocomplete="email" required>

				<label for="password">Contraseña</label>
				<input id="password" type="password" name="password" autocomplete="current-password" required>

				<button class="auth-submit" type="submit">Ingresar</button>
			</form>

			<a class="auth-register-link" href="registro.php">¿No tienes una cuenta? Regístrate</a>
		</section>
	</main>
</body>
</html>
