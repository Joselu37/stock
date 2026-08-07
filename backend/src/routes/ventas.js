const express = require('express');
const pool = require('../db');
const { authMiddleware } = require('../middleware/auth');

const TIPOS_VALIDOS = ['contado', 'transferencia', 'tarjeta', 'fiado'];

module.exports = function (io) {
  const router = express.Router();
  router.use(authMiddleware);

  // GET /api/ventas?tipo=contado
  router.get('/', async (req, res) => {
    const { tipo } = req.query;
    try {
      let query = `SELECT v.*, c.nombre AS cliente_nombre FROM ventas v
                   LEFT JOIN clientes c ON c.id = v.cliente_id`;
      const params = [];
      if (tipo && TIPOS_VALIDOS.includes(tipo)) {
        params.push(tipo);
        query += ` WHERE v.tipo_pago = $${params.length}`;
      }
      query += ' ORDER BY v.fecha DESC LIMIT 200';
      const { rows } = await pool.query(query, params);
      res.json(rows);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Error obteniendo ventas' });
    }
  });

  // GET /api/ventas/:id/items
  router.get('/:id/items', async (req, res) => {
    try {
      const { rows } = await pool.query(
        `SELECT vi.*, p.nombre AS producto_nombre FROM venta_items vi
         JOIN productos p ON p.id = vi.producto_id WHERE vi.venta_id = $1`,
        [req.params.id]
      );
      res.json(rows);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Error obteniendo items de la venta' });
    }
  });

  // POST /api/ventas
  // body: { tipo_pago, cliente_id (requerido si fiado), items: [{producto_id, cantidad}] }
  router.post('/', async (req, res) => {
    const { tipo_pago, cliente_id, items } = req.body;
    if (!TIPOS_VALIDOS.includes(tipo_pago)) return res.status(400).json({ error: 'Tipo de pago invalido' });
    if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ error: 'La venta debe tener al menos un item' });
    if (tipo_pago === 'fiado' && !cliente_id) return res.status(400).json({ error: 'La venta fiada requiere un cliente' });

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      let total = 0;
      const itemsCalculados = [];

      for (const item of items) {
        const prodRes = await client.query('SELECT * FROM productos WHERE id = $1 FOR UPDATE', [item.producto_id]);
        if (prodRes.rows.length === 0) throw new Error(`Producto ${item.producto_id} no encontrado`);
        const producto = prodRes.rows[0];
        const cantidad = Number(item.cantidad);
        if (cantidad <= 0) throw new Error('Cantidad invalida');
        if (Number(producto.stock_actual) < cantidad) {
          throw new Error(`Stock insuficiente para "${producto.nombre}" (disponible: ${producto.stock_actual})`);
        }
        const subtotal = cantidad * Number(producto.precio_unitario);
        total += subtotal;
        itemsCalculados.push({ producto, cantidad, subtotal, precio_unitario: producto.precio_unitario });
      }

      const pagado = tipo_pago !== 'fiado';
      const ventaRes = await client.query(
        `INSERT INTO ventas (tipo_pago, cliente_id, usuario_id, total, pagado) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
        [tipo_pago, cliente_id || null, req.usuario.id, total, pagado]
      );
      const venta = ventaRes.rows[0];

      for (const it of itemsCalculados) {
        await client.query(
          'INSERT INTO venta_items (venta_id, producto_id, cantidad, precio_unitario, subtotal) VALUES ($1,$2,$3,$4,$5)',
          [venta.id, it.producto.id, it.cantidad, it.precio_unitario, it.subtotal]
        );
        const nuevoStock = Number(it.producto.stock_actual) - it.cantidad;
        await client.query('UPDATE productos SET stock_actual = $1, actualizado_en = NOW() WHERE id = $2', [nuevoStock, it.producto.id]);
        await client.query(
          'INSERT INTO movimientos_stock (producto_id, tipo, cantidad, motivo, usuario_id) VALUES ($1,$2,$3,$4,$5)',
          [it.producto.id, 'venta', it.cantidad, `Venta #${venta.id} (${tipo_pago})`, req.usuario.id]
        );
      }

      if (tipo_pago === 'fiado') {
        await client.query('UPDATE clientes SET saldo_adeudado = saldo_adeudado + $1 WHERE id = $2', [total, cliente_id]);
      }

      await client.query('COMMIT');

      // Notificar por WebSocket en tiempo real
      io.emit('venta:creada', venta);
      for (const it of itemsCalculados) {
        io.emit('stock:cambio', { producto_id: it.producto.id, stock_actual: Number(it.producto.stock_actual) - it.cantidad });
      }
      if (tipo_pago === 'fiado') {
        io.emit('cliente:actualizado', { id: cliente_id });
      }

      res.status(201).json({ venta, items: itemsCalculados });
    } catch (err) {
      await client.query('ROLLBACK');
      console.error(err);
      res.status(400).json({ error: err.message || 'Error registrando la venta' });
    } finally {
      client.release();
    }
  });

  return router;
};
