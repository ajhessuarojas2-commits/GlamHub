from flask import (
    Flask,
    render_template,
    request,
    redirect,
    url_for,
    flash,
    session,
    send_from_directory
)

import os

import mysql.connector
from mysql.connector import Error

from werkzeug.security import (
    check_password_hash,
    generate_password_hash
)
from werkzeug.utils import secure_filename


# =========================================================
# CONFIGURACIÓN DE FLASK
# =========================================================

app = Flask(__name__)

# Necesaria para utilizar flash()
app.secret_key = "glamhub_clave_secreta_2026"


# =========================================================
# CONFIGURACIÓN DE MYSQL
# =========================================================

DB_CONFIG = {
    "host": "localhost",
    "user": "root",
    "password": "",
    "database": "glamhub"
}

BASIC_SERVICES = [
    {
        "IdServicio": -1,
        "Nombre": "Lavado y Secado",
        "Descripcion": "Lavado nutritivo y secado con acabado natural",
        "Precio": 18000
    },
    {
        "IdServicio": -2,
        "Nombre": "Depilación Facial",
        "Descripcion": "Depilación suave de rostro con acabado profesional",
        "Precio": 25000
    },
    {
        "IdServicio": -3,
        "Nombre": "Peinado Básico",
        "Descripcion": "Peinado sencillo para una ocasión especial",
        "Precio": 30000
    }
]


# =========================================================
# FUNCIÓN PARA CONECTAR A MYSQL
# =========================================================

def obtener_conexion():

    try:

        conexion = mysql.connector.connect(
            host=DB_CONFIG["host"],
            user=DB_CONFIG["user"],
            password=DB_CONFIG["password"],
            database=DB_CONFIG["database"]
        )

        return conexion

    except Error as e:

        print("Error al conectar con MySQL:", e)

        return None


# =========================================================
# PÁGINA PRINCIPAL
# =========================================================

@app.route("/")
def inicio():

    return render_template("index.html")


# =========================================================
# INICIO DE SESIÓN
# =========================================================

@app.route("/login", methods=["GET", "POST"])
def login():

    if request.method == "GET":
        return render_template("login.html")

    correo = request.form.get("correo", "").strip()
    password = request.form.get("password", "")

    if not correo or not password:
        flash("El correo y la contraseña son obligatorios.")
        return render_template("login.html")

    conexion = obtener_conexion()

    if conexion is None:
        flash("No se pudo conectar con la base de datos.")
        return render_template("login.html")

    cursor = None

    try:
        cursor = conexion.cursor(dictionary=True)
        cursor.execute("""
            SELECT
                IdUsuario,
                NombreUsuario,
                PasswordUsuario
            FROM usuarios
            WHERE CorreoUsuario = %s
        """, (correo,))

        usuario = cursor.fetchone()
        password_guardada = usuario["PasswordUsuario"] if usuario else ""

        try:
            password_valida = bool(usuario) and check_password_hash(
                password_guardada,
                password
            )
        except (TypeError, ValueError):
            password_valida = bool(usuario) and password_guardada == password

        if not password_valida:
            flash("El correo o la contraseña son incorrectos.")
            return render_template("login.html")

        if password_guardada == password:
            cursor.execute("""
                UPDATE usuarios
                SET PasswordUsuario = %s
                WHERE IdUsuario = %s
            """, (
                generate_password_hash(password),
                usuario["IdUsuario"]
            ))
            conexion.commit()

        session["usuario_id"] = usuario["IdUsuario"]
        session["usuario_nombre"] = usuario["NombreUsuario"]
        flash(f"Bienvenid@, {usuario['NombreUsuario']}.", "success")
        return redirect(url_for("inicio"))

    except Error as e:
        print("Error al iniciar sesión:", e)
        flash("No fue posible iniciar sesión.")
        return render_template("login.html")

    finally:
        if cursor:
            cursor.close()
        conexion.close()


# =========================================================
# PERFIL DEL USUARIO
# =========================================================

@app.route("/perfil", methods=["GET", "POST"])
def perfil():

    usuario_id = session.get("usuario_id")

    if not usuario_id:
        flash("Debes iniciar sesión para ver tu perfil.")
        return redirect(url_for("login"))

    conexion = obtener_conexion()

    if conexion is None:
        flash("No se pudo conectar con la base de datos.")
        return redirect(url_for("inicio"))

    cursor = None

    try:
        cursor = conexion.cursor(dictionary=True)

        if request.method == "POST":
            nombre = request.form.get("nombre", "").strip()
            correo = request.form.get("correo", "").strip()
            telefono = request.form.get("telefono", "").strip()

            if not nombre or not correo:
                flash("El nombre y el correo son obligatorios.")
                return redirect(url_for("perfil"))

            cursor.execute("""
                SELECT IdUsuario
                FROM usuarios
                WHERE CorreoUsuario = %s
                AND IdUsuario != %s
            """, (correo, usuario_id))

            if cursor.fetchone():
                flash("Ese correo ya pertenece a otro usuario.")
                return redirect(url_for("perfil"))

            cursor.execute("""
                UPDATE usuarios
                SET NombreUsuario = %s,
                    CorreoUsuario = %s,
                    TelefonoUsuario = %s
                WHERE IdUsuario = %s
            """, (nombre, correo, telefono, usuario_id))

            foto = request.files.get("foto")
            if foto and foto.filename:
                extension = os.path.splitext(secure_filename(foto.filename))[1].lower()
                extensiones_permitidas = {".jpg", ".jpeg", ".png", ".webp"}

                if extension not in extensiones_permitidas:
                    flash("La foto debe estar en formato JPG, PNG o WEBP.")
                    return redirect(url_for("perfil"))

                carpeta_fotos = os.path.join(app.root_path, "img", "perfiles")
                os.makedirs(carpeta_fotos, exist_ok=True)

                for extension_anterior in extensiones_permitidas:
                    foto_anterior = os.path.join(
                        carpeta_fotos,
                        f"{usuario_id}{extension_anterior}"
                    )
                    if os.path.exists(foto_anterior):
                        os.remove(foto_anterior)

                foto.save(os.path.join(carpeta_fotos, f"{usuario_id}{extension}"))

            conexion.commit()
            session["usuario_nombre"] = nombre
            flash("Perfil actualizado correctamente.", "success")
            return redirect(url_for("perfil"))

        cursor.execute("""
            SELECT IdUsuario, NombreUsuario, CorreoUsuario, TelefonoUsuario
            FROM usuarios
            WHERE IdUsuario = %s
        """, (usuario_id,))
        usuario = cursor.fetchone()

        if not usuario:
            session.clear()
            flash("El usuario no existe.")
            return redirect(url_for("login"))

        cursor.execute("""
            SELECT IdHistorial, Cita, Servicio, Comentario
            FROM Historial
            WHERE IdUsuario = %s
            ORDER BY IdHistorial DESC
        """, (usuario_id,))
        historial = cursor.fetchall()

        foto_url = None
        carpeta_fotos = os.path.join(app.root_path, "img", "perfiles")
        for extension in (".jpg", ".jpeg", ".png", ".webp"):
            if os.path.exists(os.path.join(carpeta_fotos, f"{usuario_id}{extension}")):
                foto_url = url_for("foto_perfil", filename=f"{usuario_id}{extension}")
                break

        return render_template(
            "perfil.html",
            usuario=usuario,
            historial=historial,
            foto_url=foto_url
        )

    except Error as e:
        conexion.rollback()
        print("Error al consultar el perfil:", e)
        flash("No fue posible cargar el perfil.")
        return redirect(url_for("inicio"))

    finally:
        if cursor:
            cursor.close()
        conexion.close()


@app.route("/img/perfiles/<path:filename>")
def foto_perfil(filename):

    return send_from_directory(
        os.path.join(app.root_path, "img", "perfiles"),
        filename
    )


@app.route("/logout")
def logout():

    session.clear()
    flash("Sesión cerrada correctamente.", "success")
    return redirect(url_for("inicio"))


# =========================================================
# PÁGINA DE REGISTRO
# =========================================================

@app.route("/registro", methods=["GET", "POST"])
def registro():

    if request.method == "GET":
        return render_template("registro.html")

    nombre = request.form.get("nombre", "").strip()
    correo = request.form.get("correo", "").strip()
    password = request.form.get("password", "")
    telefono = request.form.get("telefono", "").strip()

    if not nombre or not correo or not password:
        flash("Nombre, correo y contraseña son obligatorios.")
        return render_template("registro.html")

    password_hash = generate_password_hash(password)

    conexion = obtener_conexion()

    if conexion is None:
        flash("No se pudo conectar con la base de datos.")
        return render_template("registro.html")

    cursor = None

    try:
        cursor = conexion.cursor()

        cursor.execute("""
            SELECT IdUsuario
            FROM usuarios
            WHERE CorreoUsuario = %s
        """, (correo,))

        if cursor.fetchone():
            flash("Ya existe un usuario registrado con ese correo.")
            return render_template("registro.html")

        cursor.execute("""
            INSERT INTO usuarios
            (
                NombreUsuario,
                CorreoUsuario,
                PasswordUsuario,
                TelefonoUsuario
            )
            VALUES (%s, %s, %s, %s)
        """, (nombre, correo, password_hash, telefono))

        conexion.commit()
        flash("Registro exitoso. Ya puedes iniciar sesión.")
        return redirect(url_for("inicio"))

    except Error as e:
        conexion.rollback()
        print("Error al registrar usuario:", e)
        flash("No fue posible completar el registro.")
        return render_template("registro.html")

    finally:
        if cursor:
            cursor.close()
        conexion.close()


# =========================================================
# LISTAR USUARIOS
# =========================================================

@app.route("/usuarios")
@app.route("/usuario")
def usuarios():

    conexion = obtener_conexion()

    if conexion is None:

        flash("No se pudo conectar con la base de datos.")

        return render_template(
            "usuarios.html",
            usuarios=[]
        )

    cursor = None

    try:

        cursor = conexion.cursor(dictionary=True)

        cursor.execute("""
            SELECT
                IdUsuario,
                NombreUsuario,
                CorreoUsuario,
                TelefonoUsuario
            FROM usuarios
            ORDER BY IdUsuario DESC
        """)

        usuarios = cursor.fetchall()

        return render_template(
            "usuarios.html",
            usuarios=usuarios
        )

    except Error as e:

        print("Error al consultar usuarios:", e)

        flash("Ocurrió un error al consultar los usuarios.")

        return render_template(
            "usuarios.html",
            usuarios=[]
        )

    finally:

        if cursor:
            cursor.close()

        conexion.close()


# =========================================================
# VER USUARIO
# =========================================================

@app.route("/usuarios/ver/<int:id>")
def ver_usuario(id):

    conexion = obtener_conexion()

    if conexion is None:

        flash("No se pudo conectar con la base de datos.")

        return redirect(url_for("usuarios"))

    cursor = None

    try:

        cursor = conexion.cursor(dictionary=True)

        cursor.execute("""
            SELECT
                IdUsuario,
                NombreUsuario,
                CorreoUsuario,
                TelefonoUsuario
            FROM usuarios
            WHERE IdUsuario = %s
        """, (id,))

        usuario = cursor.fetchone()

        if usuario is None:

            flash("El usuario no existe.")

            return redirect(url_for("usuarios"))

        return render_template(
            "ver_usuario.html",
            usuario=usuario
        )

    except Error as e:

        print("Error al consultar usuario:", e)

        flash("No fue posible consultar el usuario.")

        return redirect(url_for("usuarios"))

    finally:

        if cursor:
            cursor.close()

        conexion.close()


# =========================================================
# EDITAR USUARIO
# =========================================================

@app.route(
    "/usuarios/editar/<int:id>",
    methods=["GET", "POST"]
)
def editar_usuario(id):

    conexion = obtener_conexion()

    if conexion is None:

        flash(
            "No se pudo conectar con la base de datos."
        )

        return redirect(
            url_for("usuarios")
        )

    cursor = None

    try:

        cursor = conexion.cursor(
            dictionary=True
        )


        # -----------------------------------------
        # BUSCAR USUARIO
        # -----------------------------------------

        cursor.execute("""
            SELECT
                IdUsuario,
                NombreUsuario,
                CorreoUsuario,
                TelefonoUsuario
            FROM usuarios
            WHERE IdUsuario = %s
        """, (id,))

        usuario = cursor.fetchone()


        if usuario is None:

            flash(
                "El usuario no existe."
            )

            return redirect(
                url_for("usuarios")
            )


        # -----------------------------------------
        # MOSTRAR FORMULARIO
        # -----------------------------------------

        if request.method == "GET":

            return render_template(
                "editar_usuario.html",
                usuario=usuario
            )


        # -----------------------------------------
        # RECIBIR DATOS
        # -----------------------------------------

        nombre = request.form.get(
            "nombre",
            ""
        ).strip()

        correo = request.form.get(
            "correo",
            ""
        ).strip()

        telefono = request.form.get(
            "telefono",
            ""
        ).strip()


        # -----------------------------------------
        # VALIDAR
        # -----------------------------------------

        if not nombre or not correo:

            flash(
                "El nombre y correo son obligatorios."
            )

            return render_template(
                "editar_usuario.html",
                usuario=usuario
            )


        # -----------------------------------------
        # COMPROBAR CORREO
        # -----------------------------------------

        cursor.execute("""
            SELECT IdUsuario
            FROM usuarios
            WHERE CorreoUsuario = %s
            AND IdUsuario != %s
        """, (
            correo,
            id
        ))

        correo_existente = cursor.fetchone()

        if correo_existente:

            flash(
                "Ese correo ya pertenece a otro usuario."
            )

            return render_template(
                "editar_usuario.html",
                usuario=usuario
            )


        # -----------------------------------------
        # ACTUALIZAR
        # -----------------------------------------

        cursor.execute("""
            UPDATE usuarios
            SET
                NombreUsuario = %s,
                CorreoUsuario = %s,
                TelefonoUsuario = %s
            WHERE IdUsuario = %s
        """, (
            nombre,
            correo,
            telefono,
            id
        ))

        conexion.commit()

        flash(
            "Usuario actualizado correctamente."
        )

        return redirect(
            url_for("usuarios")
        )


    except Error as e:

        conexion.rollback()

        print(
            "Error al editar usuario:",
            e
        )

        flash(
            "No fue posible actualizar el usuario."
        )

        return redirect(
            url_for("usuarios")
        )

    finally:

        if cursor:
            cursor.close()

        conexion.close()


# =========================================================
# ELIMINAR USUARIO
# =========================================================

@app.route(
    "/usuarios/eliminar/<int:id>",
    methods=["POST"]
)
def eliminar_usuario(id):

    conexion = obtener_conexion()

    if conexion is None:

        flash(
            "No se pudo conectar con la base de datos."
        )

        return redirect(
            url_for("usuarios")
        )

    cursor = None

    try:

        cursor = conexion.cursor()

        # -----------------------------------------
        # COMPROBAR QUE EXISTE
        # -----------------------------------------

        cursor.execute("""
            SELECT IdUsuario
            FROM usuarios
            WHERE IdUsuario = %s
        """, (id,))

        usuario = cursor.fetchone()

        if usuario is None:

            flash(
                "El usuario no existe."
            )

            return redirect(
                url_for("usuarios")
            )


        # -----------------------------------------
        # ELIMINAR
        # -----------------------------------------

        cursor.execute("""
            DELETE FROM usuarios
            WHERE IdUsuario = %s
        """, (id,))

        conexion.commit()

        flash(
            "Usuario eliminado correctamente."
        )

        return redirect(
            url_for("usuarios")
        )


    except Error as e:

        conexion.rollback()

        print(
            "Error al eliminar usuario:",
            e
        )

        flash(
            "No se pudo eliminar el usuario. "
            "Puede tener registros relacionados."
        )

        return redirect(
            url_for("usuarios")
        )

    finally:

        if cursor:
            cursor.close()

        conexion.close()


# =========================================================
# SERVICIOS
# =========================================================

@app.route("/servicios")
def servicios():

    conexion = obtener_conexion()

    if conexion is None:

        flash(
            "No se pudo conectar con la base de datos."
        )

        return render_template(
            "servicios.html",
            servicios=BASIC_SERVICES,
            carrito=session.get("carrito", [])
        )

    cursor = None

    try:

        cursor = conexion.cursor(
            dictionary=True
        )

        cursor.execute("""
            SELECT
                IdServicio,
                Nombre,
                Descripcion,
                Precio
            FROM servicio
            ORDER BY IdServicio DESC
        """)

        servicios = cursor.fetchall()
        nombres_servicios = {servicio["Nombre"] for servicio in servicios}
        servicios.extend(
            servicio for servicio in BASIC_SERVICES
            if servicio["Nombre"] not in nombres_servicios
        )

        return render_template(
            "servicios.html",
            servicios=servicios,
            carrito=session.get("carrito", [])
        )

    except Error as e:

        print(
            "Error al consultar servicios:",
            e
        )

        flash(
            "No fue posible consultar los servicios."
        )

        return render_template(
            "servicios.html",
            servicios=BASIC_SERVICES,
            carrito=session.get("carrito", [])
        )

    finally:

        if cursor:
            cursor.close()

        conexion.close()


# =========================================================
# CARRITO Y PEDIDOS
# =========================================================

@app.route("/carrito")
def carrito():

    carrito_actual = session.get("carrito", [])
    total = sum(item["precio"] for item in carrito_actual)
    return render_template(
        "carrito.html",
        carrito=carrito_actual,
        total=total
    )


@app.route("/carrito/agregar/<int:id>", methods=["POST"])
def agregar_al_carrito(id):

    conexion = obtener_conexion()

    if conexion is None:
        flash("No se pudo conectar con la base de datos.")
        return redirect(url_for("servicios"))

    cursor = None

    try:
        cursor = conexion.cursor(dictionary=True)
        cursor.execute("""
            SELECT IdServicio, Nombre, Descripcion, Precio
            FROM servicio
            WHERE IdServicio = %s
        """, (id,))
        servicio = cursor.fetchone()

        if not servicio:
            servicio = next(
                (item for item in BASIC_SERVICES if item["IdServicio"] == id),
                None
            )

        if not servicio:
            flash("El servicio seleccionado no existe.")
            return redirect(url_for("servicios"))

        carrito_actual = session.get("carrito", [])
        carrito_actual.append({
            "id": servicio["IdServicio"],
            "nombre": servicio["Nombre"],
            "descripcion": servicio["Descripcion"],
            "precio": int(servicio["Precio"])
        })
        session["carrito"] = carrito_actual
        session.modified = True
        flash(f"{servicio['Nombre']} se agregó al carrito.", "success")
        return redirect(url_for("servicios"))

    except Error as e:
        print("Error al agregar servicio al carrito:", e)
        flash("No fue posible agregar el servicio.")
        return redirect(url_for("servicios"))

    finally:
        if cursor:
            cursor.close()
        conexion.close()


@app.route("/carrito/eliminar/<int:indice>", methods=["POST"])
def eliminar_del_carrito(indice):

    carrito_actual = session.get("carrito", [])

    if indice < 0 or indice >= len(carrito_actual):
        flash("El artículo ya no está en el carrito.")
        return redirect(url_for("carrito"))

    eliminado = carrito_actual.pop(indice)
    session["carrito"] = carrito_actual
    session.modified = True
    flash(f"{eliminado['nombre']} se eliminó del carrito.", "success")
    return redirect(url_for("carrito"))


@app.route("/carrito/confirmar", methods=["POST"])
def confirmar_pedido():

    usuario_id = session.get("usuario_id")
    carrito_actual = session.get("carrito", [])

    if not usuario_id:
        flash("Debes iniciar sesión para confirmar el pedido.")
        return redirect(url_for("login"))

    if not carrito_actual:
        flash("Tu carrito está vacío.")
        return redirect(url_for("servicios"))

    conexion = obtener_conexion()

    if conexion is None:
        flash("No se pudo conectar con la base de datos.")
        return redirect(url_for("carrito"))

    cursor = None

    try:
        cursor = conexion.cursor()
        codigo_pedido = f"PEDIDO-{__import__('datetime').datetime.now():%Y%m%d%H%M%S}"
        total = sum(item["precio"] for item in carrito_actual)

        for item in carrito_actual:
            cursor.execute("""
                INSERT INTO Historial (IdUsuario, Cita, Servicio, Comentario)
                VALUES (%s, %s, %s, %s)
            """, (
                usuario_id,
                codigo_pedido,
                item["nombre"],
                f"Pedido confirmado. Precio: ${item['precio']:,} COP"
            ))

        conexion.commit()
        session["carrito"] = []
        flash(f"Pedido confirmado por ${total:,} COP.", "success")
        return redirect(url_for("perfil"))

    except Error as e:
        conexion.rollback()
        print("Error al confirmar pedido:", e)
        flash("No fue posible guardar el pedido.")
        return redirect(url_for("carrito"))

    finally:
        if cursor:
            cursor.close()
        conexion.close()


# =========================================================
# CITAS
# =========================================================

@app.route("/citas")
def citas():

    conexion = obtener_conexion()

    if conexion is None:

        flash(
            "No se pudo conectar con la base de datos."
        )

        return render_template(
            "citas.html",
            citas=[]
        )

    cursor = None

    try:

        cursor = conexion.cursor(
            dictionary=True
        )

        cursor.execute("""
            SELECT
                c.IdCita,
                c.Fecha,
                c.Hora,
                c.Estado,
                c.Comentario,
                c.Duracion,
                u.NombreUsuario
            FROM cita c
            LEFT JOIN usuarios u
                ON c.IdUsuario = u.IdUsuario
            ORDER BY c.Fecha DESC, c.Hora DESC
        """)

        citas = cursor.fetchall()

        return render_template(
            "citas.html",
            citas=citas
        )

    except Error as e:

        print(
            "Error al consultar citas:",
            e
        )

        flash(
            "No fue posible consultar las citas."
        )

        return render_template(
            "citas.html",
            citas=[]
        )

    finally:

        if cursor:
            cursor.close()

        conexion.close()




# =========================================================
# EJECUTAR APLICACIÓN
# =========================================================

if __name__ == "__main__":

    app.run(
        debug=True,
        host="127.0.0.1",
        port=5000
    )

