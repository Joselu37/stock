# 🥩 Sistema de Gestión de Stock — Carnicería y Despensa

Aplicación completa (backend + frontend + base de datos) para gestionar stock, ventas (contado, transferencia, tarjeta, fiado), clientes y alertas, con sincronización en tiempo real vía WebSockets.

## Stack

- **Backend:** Node.js + Express + Socket.io + JWT
- **Base de datos:** PostgreSQL
- **Frontend:** React + Vite + React Router + Socket.io-client
- **Tiempo real:** WebSockets (Socket.io)
- **Alertas:** node-cron + Nodemailer (email) + notificación interna en la app

## Estructura del proyecto

```
carniceria-stock/
├── backend/
│   ├── src/
│   │   ├── config/initdb.js       # Inicializa la BD y crea el usuario admin
│   │   ├── middleware/auth.js     # Autenticación JWT
│   │   ├── routes/                # productos, ventas, clientes, alertas, stock, auth
│   │   ├── sockets/index.js       # Autenticación y eventos WebSocket
│   │   ├── jobs/alertasFiado.js   # Cron semanal de alertas de fiado
│   │   ├── utils/mailer.js        # Envío de emails de alerta
│   │   └── index.js               # Punto de entrada del servidor
│   ├── db/init.sql                # Esquema completo de la base de datos
│   ├── package.json
│   ├── Dockerfile
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── pages/                 # Login, Dashboard, Productos, Clientes, Alertas
│   │   │   ├── VentaContado.jsx
│   │   │   ├── VentaTransferencia.jsx
│   │   │   ├── VentaTarjeta.jsx
│   │   │   └── VentaFiado.jsx     # Pantallas separadas por tipo de venta
│   │   ├── components/
│   │   │   ├── BarcodeScanner.jsx # Soporte lector de código de barras
│   │   │   └── PantallaVenta.jsx  # Lógica común de venta reutilizada
│   │   ├── api.js / socket.js
│   │   └── App.jsx
│   ├── package.json
│   ├── Dockerfile
│   └── .env.example
├── docker-compose.yml
├── render.yaml                    # Blueprint para desplegar en Render (backend + frontend)
└── README.md
```

## 1. Instalación local (sin Docker)

### Requisitos
- Node.js 18+
- PostgreSQL 14+ corriendo localmente

### Backend

```bash
cd backend
cp .env.example .env
# Editá .env con los datos de tu base de datos PostgreSQL y SMTP
npm install
npm run initdb     # crea las tablas y el usuario admin por defecto
npm run dev         # http://localhost:4000
```

### Frontend

```bash
cd frontend
cp .env.example .env
npm install
npm run dev          # http://localhost:5173
```

### Usuario por defecto

```
email:    admin@carniceria.com
password: admin123
```

## 2. Instalación con Docker (recomendado)

Con Docker y Docker Compose instalados:

```bash
docker compose up --build
```

Esto levanta:
- PostgreSQL en el puerto `5432`
- Backend (API + WebSockets) en el puerto `4000`
- Frontend en el puerto `5173`

La base de datos y el usuario admin se inicializan automáticamente al arrancar el backend.

## 3. Variables de entorno

### backend/.env

| Variable | Descripción |
|---|---|
| `PORT` | Puerto del servidor backend |
| `JWT_SECRET` | Clave secreta para firmar tokens JWT |
| `CORS_ORIGIN` | Origen permitido (URL del frontend) |
| `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` | Conexión a PostgreSQL |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` | Configuración de email para alertas |
| `ALERT_EMAIL_TO` | Email que recibe las alertas semanales de fiado |
| `FIADO_ALERT_CRON` | Expresión cron de la verificación semanal (por defecto lunes 08:00) |
| `FIADO_ALERT_DIAS` | Días de mora para considerar un fiado vencido |

### frontend/.env

| Variable | Descripción |
|---|---|
| `VITE_API_URL` | URL de la API REST del backend |
| `VITE_SOCKET_URL` | URL del servidor WebSocket |

## 4. Funcionalidades principales

- **Productos:** alta, baja (lógica), modificación, ajuste de stock (+/-), búsqueda, soporte de lector de código de barras (funciona como teclado: escanear y Enter).
- **Ventas:** pantallas independientes para Contado, Transferencia, Tarjeta y Fiado. Cada venta descuenta stock automáticamente dentro de una transacción SQL (evita condiciones de carrera).
- **Fiado:** registro de clientes y saldo adeudado, historial de pagos parciales, alerta automática semanal (cron configurable) para clientes con ventas fiadas sin pagar hace más de `FIADO_ALERT_DIAS` días. Las alertas se muestran en la app (WebSocket + pantalla de Alertas) y se envían por email.
- **Tiempo real:** todos los cambios de stock, ventas, clientes y alertas se propagan a todos los dispositivos conectados vía Socket.io.
- **Autenticación:** JWT con roles (`admin` / `empleado`).
- **Panel de control:** stock total, productos con stock bajo, ventas del día, deuda total de fiado — todo actualizado en tiempo real.

## 5. Despliegue en línea (gratis, con actualización automática desde GitHub)

Esta es la forma recomendada: no requiere tarjeta de crédito y cada `git push` a GitHub actualiza la app sola.

### 5.1 Subir el proyecto a GitHub

```bash
cd carniceria-stock
git init
git add .
git commit -m "Version inicial"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/carniceria-stock.git
git push -u origin main
```
(Primero creá el repositorio vacío en github.com → "New repository". No tildes "Add README" para evitar conflictos.)

### 5.2 Crear la base de datos (Neon, gratis y permanente)

1. Entrá a [neon.tech](https://neon.tech) y creá una cuenta gratis.
2. Creá un proyecto nuevo → copiá la **Connection string** (empieza con `postgresql://...`).

### 5.3 Desplegar backend + frontend (Render, gratis)

1. Entrá a [render.com](https://render.com) y creá una cuenta (podés usar tu GitHub).
2. Click en **New +** → **Blueprint** → elegí el repositorio `carniceria-stock`. Render detecta automáticamente el archivo `render.yaml` de este proyecto y va a proponer crear 2 servicios: `carniceria-backend` y `carniceria-frontend`.
3. Antes de confirmar, va a pedirte completar algunas variables:
   - En **carniceria-backend**:
     - `DATABASE_URL`: pegá la connection string de Neon.
     - `CORS_ORIGIN`: por ahora dejala vacía, la completás en el paso 5.
     - `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`, `ALERT_EMAIL_TO`: datos de tu email para las alertas de fiado (podés dejarlos vacíos si no vas a usar esa función todavía).
   - En **carniceria-frontend**:
     - `VITE_API_URL` y `VITE_SOCKET_URL`: dejalas vacías por ahora también.
4. Click en **Apply** / **Deploy Blueprint**. Render va a buildear y desplegar ambos servicios (tarda unos minutos).
5. Cuando terminen, Render te da una URL para cada servicio (algo como `https://carniceria-backend-xxxx.onrender.com` y `https://carniceria-frontend-xxxx.onrender.com`). Ahora completá las variables que dejaste vacías:
   - En `carniceria-backend` → Environment → `CORS_ORIGIN` = la URL del frontend.
   - En `carniceria-frontend` → Environment → `VITE_API_URL` = `https://carniceria-backend-xxxx.onrender.com/api`, `VITE_SOCKET_URL` = `https://carniceria-backend-xxxx.onrender.com`.
   - Guardá — cada servicio se va a re-desplegar solo con el nuevo valor.
6. Entrá a la URL del frontend. Iniciá sesión con `admin@carniceria.com` / `admin123` y **cambiá esa contraseña de inmediato** (creando un nuevo usuario admin y borrando el original, o vía la base de datos).

### 5.4 Quedar "actualizado en línea" automáticamente

A partir de acá, cada vez que hagas `git push` a la rama `main`, Render vuelve a buildear y desplegar solo — no hace falta tocar nada más.

> **Nota sobre el plan gratis de Render:** el servicio del backend "duerme" tras 15 minutos sin uso y tarda ~30-60 segundos en despertar con la primera visita. Para uso real de un negocio (sin esos cortes), el paso de "Starter" ronda los USD 7/mes por servicio.

### 5.5 Alternativa: VPS propio con Docker

Si preferís un servidor propio (Ubuntu, Debian, etc.) en vez de Render:

1. Instalar Docker y Docker Compose en el servidor.
2. Clonar el repositorio: `git clone <tu-repo> && cd carniceria-stock`
3. Configurar `backend/.env` con credenciales reales (JWT_SECRET fuerte, SMTP real, `CORS_ORIGIN` con el dominio del frontend).
4. Ajustar los `args` de build del frontend en `docker-compose.yml` con el dominio público real del backend.
5. Ejecutar: `docker compose up -d --build`
6. Configurar un proxy reverso (Nginx / Caddy / Traefik) con HTTPS delante de los puertos 4000 (API) y 8080 (frontend).
7. Configurar backups periódicos del volumen de PostgreSQL (`db_data`).

Para producción se recomienda:
- Compilar el frontend (`npm run build` dentro de `frontend/`) y servirlo con Nginx en lugar del servidor de desarrollo de Vite.
- Usar un `JWT_SECRET` largo y aleatorio.
- Usar una contraseña de aplicación SMTP (no la contraseña normal del email) para las alertas.
- Restringir `CORS_ORIGIN` al dominio real del frontend.

## 6. Scripts útiles

```bash
# Backend
npm run dev       # desarrollo con recarga automática
npm start         # producción
npm run initdb    # (re)inicializa el esquema de base de datos

# Frontend
npm run dev       # desarrollo
npm run build     # build de producción (carpeta dist/)
npm run preview   # previsualizar el build
```
