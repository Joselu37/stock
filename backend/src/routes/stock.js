const express = require('express');
const pool = require('../db');
const { authMiddleware } = require('../middleware/auth');

module.exports = function (io) {
  const router = express.Router();
  router.use(authMiddleware);

  // GET /api/stock/resumen -> panel de control en tiempo real
  router.get('/resumen', async (req, res) => {
    try {
      const totalProductos = await pool.query('SELECT COUNT(*) FROM productos WHERE activo = TRUE');
      const stockBajo = await pool.query('SELECT * FROM productos WHERE activo = TRUE AND stock_actual <= stock_minimo ORDER BY stock_actual ASC');
      const ventasHoy = await pool.query(`SELECT COALESCE(SUM(total),0) AS total, COUNT(*) AS cantidad FROM ventas WHERE fecha::date = CURRENT_DATE`);
      const deudaTotal = await pool.query('SELECT COALESCE(SUM(saldo_adeudado),0) AS total FROM clientes');

      res.json({
        total_productos: Number(totalProductos.rows[0].count),
        productos_stock_bajo: stockBajo.rows,
        ventas_hoy: ventasHoy.rows[0],
        deuda_total_fiado: Number(deudaTotal.rows[0].total),
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Error obteniendo resumen de stock' });
    }
  });

  // GET /api/stock/movimientos/:productoId
  router.get('/movimientos/:productoId', async (req, res) => {
    try {
      const { rows } = await pool.query(
        'SELECT * FROM movimientos_stock WHERE producto_id = $1 ORDER BY fecha DESC LIMIT 50',
        [req.params.productoId]
      );
      res.json(rows);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Error obteniendo movimientos' });
    }
  });

  return router;
};
