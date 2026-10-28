<?php
require 'conexion.php';
require_once 'auth.php';
exigirInicioSesion('usuarios.php');

function escapar(string $valor): string
{
	return htmlspecialchars($valor, ENT_QUOTES, 'UTF-8');
}

$idUsuario = filter_var($_GET['id'] ?? null, FILTER_VALIDATE_INT);
if ($idUsuario === false || $idUsuario === null || $idUsuario < 1) {
	http_response_code(404);
	exit('No se encontró el usuario solicitado.');
}

$consultaAdmin = $conexion->prepare(
	"SELECT 1 FROM Rol WHERE IdUsuario = :usuario AND NombreRol = 'Administrador' LIMIT 1"
);
$consultaAdmin->execute([':usuario' => (int) $_SESSION['usuario_id']]);
$esAdministrador = (bool) $consultaAdmin->fetchColumn();
$esTitular = (int) $_SESSION['usuario_id'] === $idUsuario;
if (!$esAdministrador && !$esTitular) {
	http_response_code(403);
	exit('No tienes permiso para consultar este perfil.');
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
	if (!validarTokenCSRF()) {
		http_response_code(419);
		exit('La solicitud expiró. Recarga la página e inténtalo de nuevo.');
	}

	$accionFoto = (string) ($_POST['accion'] ?? '');
	if ($accionFoto === 'quitar_foto') {
		$actualizarFoto = $conexion->prepare(
			'UPDATE Usuarios SET FotoPerfil = NULL, TipoFotoPerfil = NULL WHERE IdUsuario = :id'
		);
		$actualizarFoto->execute([':id' => $idUsuario]);
		header('Location: ver_usuario.php?id=' . $idUsuario . '&mensaje=foto_quitada');
		exit;
	}

	if ($accionFoto === 'subir_foto') {
		$archivo = $_FILES['foto_perfil'] ?? null;
		if (!$archivo || $archivo['error'] !== UPLOAD_ERR_OK || $archivo['size'] > 2 * 1024 * 1024) {
			header('Location: ver_usuario.php?id=' . $idUsuario . '&mensaje=foto_invalida');
			exit;
		}

		$contenidoFoto = file_get_contents($archivo['tmp_name']);
		$finfo = new finfo(FILEINFO_MIME_TYPE);
		$tipoFoto = $contenidoFoto === false ? '' : $finfo->buffer($contenidoFoto);
		$tiposPermitidos = ['image/jpeg', 'image/png', 'image/webp'];
		$dimensiones = $contenidoFoto === false ? false : @getimagesizefromstring($contenidoFoto);
		if ($contenidoFoto === false || !in_array($tipoFoto, $tiposPermitidos, true) || !$dimensiones
			|| $dimensiones[0] > 3000 || $dimensiones[1] > 3000 || ($dimensiones[0] * $dimensiones[1]) > 9000000) {
			header('Location: ver_usuario.php?id=' . $idUsuario . '&mensaje=foto_invalida');
			exit;
		}

		$actualizarFoto = $conexion->prepare(
			'UPDATE Usuarios SET FotoPerfil = :foto, TipoFotoPerfil = :tipo WHERE IdUsuario = :id'
		);
		$actualizarFoto->bindValue(':foto', $contenidoFoto, PDO::PARAM_LOB);
		$actualizarFoto->bindValue(':tipo', $tipoFoto);
		$actualizarFoto->bindValue(':id', $idUsuario, PDO::PARAM_INT);
		$actualizarFoto->execute();
		header('Location: ver_usuario.php?id=' . $idUsuario . '&mensaje=foto_guardada');
		exit;
	}
}

$consultaUsuario = $conexion->prepare(
	' SELECT U.IdUsuario, U.NombreUsuario, U.CorreoUsuario, U.TelefonoUsuario, U.TipoFotoPerfil,
		GROUP_CONCAT(R.NombreRol ORDER BY R.NombreRol SEPARATOR ", ") AS Roles
	 FROM Usuarios U
	 LEFT JOIN Rol R ON R.IdUsuario = U.IdUsuario
	 WHERE U.IdUsuario = :id
	 GROUP BY U.IdUsuario, U.NombreUsuario, U.CorreoUsuario, U.TelefonoUsuario, U.TipoFotoPerfil'
);
$consultaUsuario->execute([':id' => $idUsuario]);
$usuario = $consultaUsuario->fetch(PDO::FETCH_ASSOC);
if (!$usuario) {
	http_response_code(404);
	exit('No se encontró el usuario solicitado.');
}

$esquemaRoles = trim((string) ($usuario['Roles'] ?? ''));
if ($esquemaRoles === '') {
	$esquemaRoles = 'Sin rol asignado';
}
?>
<!DOCTYPE html>
<html lang="es">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>Ver usuario | Glam Hub</title>
	<link rel="stylesheet" href="css/estilos.css?v=12">
</head>
<body>
	<?php require 'navbar.php'; ?>

	<main class="container account-container user-profile-container">
		<header class="user-profile-heading">
			<div class="user-profile-photo-wrap">
				<?php if ($usuario['TipoFotoPerfil']): ?>
					<img class="user-profile-photo" src="foto_perfil.php?id=<?= (int) $usuario['IdUsuario'] ?>" alt="Foto de <?= escapar((string) $usuario['NombreUsuario']) ?>">
				<?php else: ?>
					<span class="user-profile-photo-placeholder" aria-hidden="true"></span>
				<?php endif; ?>
			</div>
			<p class="user-profile-kicker">Cuenta Glam Hub</p>
			<h1>Información del usuario</h1>
			<p>Perfil, acceso y datos de contacto.</p>
		</header>

		<?php if (($_GET['mensaje'] ?? '') === 'foto_guardada'): ?>
			<p class="message success">Foto de perfil actualizada.</p>
		<?php elseif (($_GET['mensaje'] ?? '') === 'foto_quitada'): ?>
			<p class="message success">Foto de perfil eliminada.</p>
		<?php elseif (($_GET['mensaje'] ?? '') === 'foto_invalida'): ?>
			<p class="message error">Usa una imagen JPG, PNG o WebP de hasta 2 MB y 3000 × 3000 píxeles.</p>
		<?php endif; ?>

		<section class="profile-section" aria-labelledby="photo-heading">
			<h2 id="photo-heading">Foto de perfil</h2>
			<form method="post" enctype="multipart/form-data" class="profile-photo-form">
				<input type="hidden" name="token_csrf" value="<?= escapar(tokenCSRF()) ?>">
				<input type="hidden" name="accion" value="subir_foto">
				<input type="hidden" name="MAX_FILE_SIZE" value="2097152">
				<label for="foto-perfil">Elige una imagen JPG, PNG o WebP</label>
				<input id="foto-perfil" type="file" name="foto_perfil" accept="image/jpeg,image/png,image/webp" required>
				<button type="submit">Guardar foto</button>
			</form>
			<?php if ($usuario['TipoFotoPerfil']): ?>
				<form method="post" class="profile-photo-remove-form">
					<input type="hidden" name="token_csrf" value="<?= escapar(tokenCSRF()) ?>">
					<input type="hidden" name="accion" value="quitar_foto">
					<button class="profile-photo-remove" type="submit">Quitar foto</button>
				</form>
			<?php endif; ?>
		</section>

		<section class="profile-section" aria-labelledby="profile-heading">
			<h2 id="profile-heading">Perfil</h2>
			<dl class="profile-data">
				<div><dt>ID de usuario</dt><dd>#<?= escapar((string) $usuario['IdUsuario']) ?></dd></div>
				<div><dt>Nombre</dt><dd><?= escapar((string) $usuario['NombreUsuario']) ?></dd></div>
				<div><dt>Correo electrónico</dt><dd><?= escapar((string) $usuario['CorreoUsuario']) ?></dd></div>
				<div><dt>Teléfono</dt><dd><?= escapar((string) ($usuario['TelefonoUsuario'] ?: 'No registrado')) ?></dd></div>
			</dl>
		</section>

		<section class="profile-section" aria-labelledby="account-heading">
			<h2 id="account-heading">Cuenta</h2>
			<dl class="profile-data profile-data-compact">
				<div><dt>Rol</dt><dd><?= escapar($esquemaRoles) ?></dd></div>
			</dl>
			<p class="profile-note">El rol define los accesos disponibles dentro de Glam Hub.</p>
		</section>

		<section class="profile-section" aria-labelledby="privacy-heading">
			<h2 id="privacy-heading">Privacidad</h2>
			<p>La contraseña nunca se muestra en esta página. Este perfil solo está disponible para su titular y para usuarios administradores.</p>
			<p class="profile-note">Los datos de contacto se usan para identificar la cuenta y gestionar sus citas y pedidos.</p>
		</section>

		<section class="profile-section" aria-labelledby="settings-heading">
			<h2 id="settings-heading">Configuración</h2>
			<p>Actualiza el nombre, correo electrónico o teléfono asociados a esta cuenta.</p>
			<div class="profile-actions">
				<a class="action-link secondary-link" href="<?= $esAdministrador ? 'usuarios.php' : 'citas.php' ?>">Volver</a>
				<a class="action-link" href="registro.php?id=<?= escapar((string) $usuario['IdUsuario']) ?>">Editar perfil</a>
				<?php if ($esTitular): ?>
					<a class="action-link profile-secondary-action" href="citas.php">Mis citas</a>
				<?php endif; ?>
			</div>
		</section>
	</main>
</body>
</html>