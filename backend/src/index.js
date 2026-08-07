require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');

const pool = require('./db');
const initDb = require('./config/initdb');
const registrarSockets = require('./sockets');
const { iniciarCronFiados, verificarFiadosVencidos } = require('./jobs/alertasFiado');

const authRoutes = require('./routes/auth');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: process.env.CORS_ORIGIN || '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
  },
});

app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(express.json());

app.get('/api/health', (req, res) => res.json({ ok: true, servicio: 'carniceria-backend' }));

app.use('/api/auth', authRoutes);
app.use('/api/productos', require('./routes/productos')(io));
app.use('/api/clientes', require('./routes/clientes')(io));
app.use('/api/ventas', require('./routes/ventas')(io));
app.use('/api/alertas', require('./routes/alertas')(io));
app.use('/api/stock', require('./routes/stock')(io));

registrarSockets(io);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Error interno del servidor' });
});

const PORT = process.env.PORT || 4000;

async function start() {
  try {
    await initDb();
  } catch (err) {
    console.error('No se pudo inicializar la base de datos:', err.message);
    console.error('Verifica la conexion a PostgreSQL y las variables de entorno.');
  }

  server.listen(PORT, () => {
    console.log(`Servidor backend escuchando en el puerto ${PORT}`);
  });

  iniciarCronFiados(io);

  // Verificacion inicial al iniciar la app (alerta al arrancar si hay fiados vencidos)
  verificarFiadosVencidos(io).catch((err) => console.error('Error verificando fiados al iniciar:', err));
}

start();

module.exports = { app, server, io };
