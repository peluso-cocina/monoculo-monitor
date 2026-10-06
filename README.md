# Monoculo Monitor

En el Discord de Hipersónica se recomiendan tantos discos al día que es imposible tener siempre la libretilla a mano para apuntar. Este bot hace de tu libretilla: ves algo que te mola, reaccionas, y ya está guardado en tu lista personal de pendientes.

## Qué hace

- Ves un mensaje con un disco (un enlace de Bandcamp, un vídeo de YouTube o simplemente un texto) y reaccionas con el emoji :memo:.
- El bot reconoce el artista, el título y la portada, y lo guarda en tu lista privada.
- Cuando quieras, escribes `/pendientes` y el bot te manda un mensaje directo con todo lo que tienes pendiente, agrupado por género.
- Desde ese mismo privado marcas lo que ya hayas escuchado con un desplegable, y la lista se actualiza sola.

## Requisitos

- Node.js 20 o superior.
- Una aplicación de bot en el [portal de desarrolladores de Discord](https://discord.com/developers/applications) con el intent `Message Content` activado.
- Docker y Docker Compose (solo para correrlo en el NAS).

## Correrlo en el NAS con Docker

```sh
git clone https://github.com/peluso-cocina/monoculo-monitor.git
cd monoculo-monitor
cp .env.example .env
# rellena DISCORD_TOKEN, CLIENT_ID y GUILD_ID en .env
docker compose up -d --build
docker compose logs -f
```

La base de datos vive en `./data` (volumen persistente): sobrevive a reinicios y actualizaciones. Para actualizar: `git pull` y `docker compose up -d --build`. Para copia de seguridad, guarda el fichero `data/database.sqlite` con el contenedor parado.
