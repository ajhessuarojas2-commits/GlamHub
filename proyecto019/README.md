# MiniAventura

Arcade sencillo de minijuegos hecho con React. Las partidas, puntos, nivel,
récords personales y perfil se guardan en el almacenamiento local del navegador.

## Iniciar

Desde la carpeta del proyecto, ejecuta:

```bash
npm install
npm run dev
```

Abre la dirección local que muestra Vite en la consola y deja la terminal abierta
mientras juegas.

## Juegos y progresión

- **Culebrita** está disponible desde el nivel 1. Cada manzana suma 10 XP.
- **Cálculo relámpago**, **Memoria cósmica** y **Código secreto** se desbloquean
  en el nivel 2.
- **Escape: sala secreta**, **Eco de colores** y **Gato galáctico** se
  desbloquean en el nivel 3.
- **Palabra revuelta** y **¡Toque relámpago!** se desbloquean en el nivel 4.
- **Laberinto brillante** se desbloquea en el nivel 5.
- El nivel 2 requiere 80 XP; cada nivel siguiente requiere 40 XP más que el
  anterior.

En Culebrita usa las flechas o WASD. También hay controles en pantalla para
teléfonos. Los juegos de memoria, reflejos, acertijos, cálculo, palabras,
estrategia y laberinto tienen reglas y controles dentro de cada pantalla. En el
perfil se puede cambiar el nombre y consultar los récords, juego favorito,
actividad reciente y estadísticas.