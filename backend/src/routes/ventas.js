const express = require('express');
const pool = require('../db');
const { authMiddleware } = require('../middleware/auth');

const TIPOS_VALIDOS = ['contado', 'transferencia', 'tarjeta', 'fiado'];
const EPSILON = 0.01; // tolerancia para redondeo de centavos

module.exports = function (io) {
  const router = express.Router();
  router.use(authMiddleware);

  // GET /api/ventas?tipo=contado  -> incluye ventas donde ese tipo fue AL MENOS uno de los medios usados
  router.get('/', async (req, res) => {
    const { tipo } = req.query;
    try {
      let query = `SELECT v.*, c.nombre AS cliente_nombre,
                    COALESCE(
                      (SELECT json_agg(json_build_object('tipo_pago', vp.tipo_pago, 'monto', vp.monto))
                       FROM venta_pagos vp WHERE vp.venta_id = v.id), '[]'
                    ) AS pagos
                   FROM ventas v
                   LEFT JOIN clientes c ON c.id = v.cliente_id`;
      const params = [];
      if (tipo && TIPOS_VALIDOS.includes(tipo)) {
        params.push(tipo);
        query += ` WHERE EXISTS (SELECT 1 FROM venta_pagos vp WHERE vp.venta_id = v.id AND vp.tipo_pago = $${params.length})`;
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
        `SELECT vi.*, p.nombre AS producto_nombre, p.categoria FROM venta_items vi
         JOIN productos p ON p.id = vi.producto_id WHERE vi.venta_id = $1`,
        [req.params.id]
      );
      res.json(rows);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Error obteniendo items de la venta' });
    }
  });

  // GET /api/ventas/:id/pagos
  router.get('/:id/pagos', async (req, res) => {
    try {
      const { rows } = await pool.query('SELECT * FROM venta_pagos WHERE venta_id = $1', [req.params.id]);
      res.json(rows);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Error obteniendo pagos de la venta' });
    }
  });

  // POST /api/ventas
  // body: { pagos: [{tipo_pago, monto}], cliente_id (requerido si algun pago es fiado), items: [{producto_id, cantidad}] }
  router.post('/', async (req, res) => {
    const { cliente_id, items } = req.body;
    let { pagos } = req.body;

    // Compatibilidad con el formato viejo (tipo_pago unico) por si algo todavia lo manda asi
    if (!pagos && req.body.tipo_pago) {
      pagos = [{ tipo_pago: req.body.tipo_pago, monto: null }]; // monto se completa mas abajo con el total
    }

    if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ error: 'La venta debe tener al menos un item' });
    if (!Array.isArray(pagos) || pagos.length === 0) return res.status(400).json({ error: 'La venta debe tener al menos un medio de pago' });
    for (const p of pagos) {
      if (!TIPOS_VALIDOS.includes(p.tipo_pago)) return res.status(400).json({ error: `Medio de pago invalido: ${p.tipo_pago}` });
    }
    const tienesFiado = pagos.some((p) => p.tipo_pago === 'fiado');
    if (tienesFiado && !cliente_id) return res.status(400).json({ error: 'La venta con un componente fiado requiere un cliente' });

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
      total = Math.round(total * 100) / 100;

      // Si vino en formato viejo (un solo pago sin monto), se le asigna el total completo
      if (pagos.length === 1 && (pagos[0].monto === null || pagos[0].monto === undefined)) {
        pagos[0].monto = total;
      }
      const sumaPagos = Math.round(pagos.reduce((acc, p) => acc + Number(p.monto || 0), 0) * 100) / 100;
      if (Math.abs(sumaPagos - total) > EPSILON) {
        throw new Error(`La suma de los pagos ($${sumaPagos.toFixed(2)}) no coincide con el total de la venta ($${total.toFixed(2)})`);
      }

      const tipoPagoResumen = pagos.length === 1 ? pagos[0].tipo_pago : 'mixto';
      const pagado = !tienesFiado;

      const ventaRes = await client.query(
        `INSERT INTO ventas (tipo_pago, cliente_id, usuario_id, total, pagado) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
        [tipoPagoResumen, tienesFiado ? cliente_id : (cliente_id || null), req.usuario.id, total, pagado]
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
          [it.producto.id, 'venta', it.cantidad, `Venta #${venta.id} (${tipoPagoResumen})`, req.usuario.id]
        );
      }

      for (const p of pagos) {
        await client.query('INSERT INTO venta_pagos (venta_id, tipo_pago, monto) VALUES ($1,$2,$3)', [venta.id, p.tipo_pago, p.monto]);
      }

      const montoFiado = pagos.filter((p) => p.tipo_pago === 'fiado').reduce((acc, p) => acc + Number(p.monto), 0);
      if (montoFiado > 0) {
        await client.query('UPDATE clientes SET saldo_adeudado = saldo_adeudado + $1 WHERE id = $2', [montoFiado, cliente_id]);
      }

      await client.query('COMMIT');

      // Notificar por WebSocket en tiempo real
      io.emit('venta:creada', { ...venta, pagos });
      for (const it of itemsCalculados) {
        io.emit('stock:cambio', { producto_id: it.producto.id, stock_actual: Number(it.producto.stock_actual) - it.cantidad });
      }
      if (montoFiado > 0) {
        io.emit('cliente:actualizado', { id: cliente_id });
      }

      res.status(201).json({ venta, items: itemsCalculados, pagos });
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
