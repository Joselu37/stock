const express = require('express');
const pool = require('../db');
const { authMiddleware } = require('../middleware/auth');
const { verificarFiadosVencidos } = require('../jobs/alertasFiado');

module.exports = function (io) {
  const router = express.Router();
  router.use(authMiddleware);

  // GET /api/alertas -> todas las alertas (mas recientes primero)
  router.get('/', async (req, res) => {
    try {
      const { rows } = await pool.query('SELECT * FROM alertas ORDER BY creado_en DESC LIMIT 100');
      res.json(rows);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Error obteniendo alertas' });
    }
  });

  // GET /api/alertas/no-leidas
  router.get('/no-leidas', async (req, res) => {
    try {
      const { rows } = await pool.query('SELECT * FROM alertas WHERE leida = FALSE ORDER BY creado_en DESC');
      res.json(rows);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Error obteniendo alertas' });
    }
  });

  // PUT /api/alertas/:id/leida
  router.put('/:id/leida', async (req, res) => {
    try {
      const { rows } = await pool.query('UPDATE alertas SET leida = TRUE WHERE id = $1 RETURNING *', [req.params.id]);
      res.json(rows[0]);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Error actualizando alerta' });
    }
  });

  // POST /api/alertas/verificar-fiados -> dispara manualmente la verificacion semanal
  router.post('/verificar-fiados', async (req, res) => {
    try {
      const alertas = await verificarFiadosVencidos(io);
      res.json({ ok: true, alertas_generadas: alertas.length });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Error verificando fiados' });
    }
  });

  return router;
};
