const jwt = require('jsonwebtoken');

module.exports = function registrarSockets(io) {
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('No autorizado'));
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.usuario = decoded;
      next();
    } catch (err) {
      next(new Error('Token invalido'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`Cliente conectado via WebSocket: ${socket.usuario?.nombre || socket.id}`);

    socket.on('disconnect', () => {
      console.log(`Cliente desconectado: ${socket.usuario?.nombre || socket.id}`);
    });
  });
};
