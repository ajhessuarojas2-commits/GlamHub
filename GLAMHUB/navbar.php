<?php
require_once 'auth.php';

$paginaActual = basename($_SERVER['PHP_SELF'] ?? '');
$cantidadCarrito = array_sum($_SESSION['carrito'] ?? []);
$nombreNavegacion = htmlspecialchars((string) ($_SESSION['usuario_nombre'] ?? ''), ENT_QUOTES, 'UTF-8');
$urlPerfil = !empty($_SESSION['usuario_id'])
	? 'ver_usuario.php?id=' . (int) $_SESSION['usuario_id']
	: 'login.php';
$etiquetaPerfil = !empty($_SESSION['usuario_id'])
	? 'Abrir perfil de ' . $nombreNavegacion
	: 'Iniciar sesión';
?>
<nav class="navbar" aria-label="Navegación principal">
	<div class="navbar-container">
		<a class="logo" href="index.php">Glam Hub</a>
		<div class="navbar-tools">
			<details class="nav-menu"<?= in_array($paginaActual, ['usuarios.php', 'finanzas.php'], true) ? ' data-admin-page="true"' : '' ?>>
				<summary aria-label="Abrir menú de navegación">
					<span>Menú</span>
					<span class="nav-menu-chevron" aria-hidden="true"></span>
				</summary>
				<ul class="nav-menu-list">
					<li><a href="index.php"<?= $paginaActual === 'index.php' ? ' aria-current="page"' : '' ?>>Inicio</a></li>
					<li><a href="servicios.php"<?= $paginaActual === 'servicios.php' ? ' aria-current="page"' : '' ?>>Servicios</a></li>
					<li><a href="carrito.php"<?= $paginaActual === 'carrito.php' ? ' aria-current="page"' : '' ?>>Carrito (<?= $cantidadCarrito ?>)</a></li>
					<li><a href="citas.php"<?= $paginaActual === 'citas.php' ? ' aria-current="page"' : '' ?>>Mis citas<?= !empty($_SESSION['usuario_id']) ? ' (' . $nombreNavegacion . ')' : '' ?></a></li>
					<?php if (!empty($_SESSION['es_administrador'])): ?>
						<li class="nav-menu-divider"><a href="usuarios.php"<?= $paginaActual === 'usuarios.php' ? ' aria-current="page"' : '' ?>>Usuarios</a></li>
						<li><a href="finanzas.php"<?= $paginaActual === 'finanzas.php' ? ' aria-current="page"' : '' ?>>Finanzas</a></li>
					<?php endif; ?>
					<?php if (!empty($_SESSION['usuario_id'])): ?>
						<li class="nav-menu-divider"><a href="logout.php">Cerrar sesión</a></li>
					<?php else: ?>
						<li class="nav-menu-divider"><a href="login.php"<?= $paginaActual === 'login.php' ? ' aria-current="page"' : '' ?>>Iniciar sesión</a></li>
						<li><a href="registro.php"<?= $paginaActual === 'registro.php' ? ' aria-current="page"' : '' ?>>Registrarse</a></li>
					<?php endif; ?>
				</ul>
			</details>
			<a class="profile-link" href="<?= htmlspecialchars($urlPerfil, ENT_QUOTES, 'UTF-8') ?>" aria-label="<?= htmlspecialchars($etiquetaPerfil, ENT_QUOTES, 'UTF-8') ?>" title="<?= htmlspecialchars($etiquetaPerfil, ENT_QUOTES, 'UTF-8') ?>"<?= $paginaActual === 'ver_usuario.php' ? ' aria-current="page"' : '' ?>>
				<span class="profile-avatar-icon" aria-hidden="true"></span>
				<?php if (!empty($_SESSION['usuario_id'])): ?>
					<img class="profile-avatar-photo" src="foto_perfil.php?id=<?= (int) $_SESSION['usuario_id'] ?>" alt="">
				<?php endif; ?>
			</a>
		</div>
	</div>
</nav>
