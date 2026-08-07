const express = require('express');
const pool = require('../db');
const { authMiddleware } = require('../middleware/auth');

module.exports = function (io) {
  const router = express.Router();
  router.use(authMiddleware);

  // GET /api/clientes?buscar=texto
  router.get('/', async (req, res) => {
    const { buscar } = req.query;
    try {
      let query = 'SELECT * FROM clientes';
      const params = [];
      if (buscar) {
        params.push(`%${buscar.toLowerCase()}%`);
        query += ` WHERE LOWER(nombre) LIKE $${params.length}`;
      }
      query += ' ORDER BY nombre ASC';
      const { rows } = await pool.query(query, params);
      res.json(rows);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Error obteniendo clientes' });
    }
  });

  // GET /api/clientes/deudores -> clientes con saldo pendiente
  router.get('/deudores', async (req, res) => {
    try {
      const { rows } = await pool.query('SELECT * FROM clientes WHERE saldo_adeudado > 0 ORDER BY saldo_adeudado DESC');
      res.json(rows);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Error obteniendo deudores' });
    }
  });

  // POST /api/clientes
  router.post('/', async (req, res) => {
    const { nombre, telefono, email, direccion } = req.body;
    if (!nombre) return res.status(400).json({ error: 'El nombre es requerido' });
    try {
      const { rows } = await pool.query(
        'INSERT INTO clientes (nombre, telefono, email, direccion) VALUES ($1,$2,$3,$4) RETURNING *',
        [nombre, telefono || null, email || null, direccion || null]
      );
      io.emit('cliente:creado', rows[0]);
      res.status(201).json(rows[0]);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Error creando cliente' });
    }
  });

  // PUT /api/clientes/:id
  router.put('/:id', async (req, res) => {
    const { nombre, telefono, email, direccion } = req.body;
    try {
      const { rows } = await pool.query(
        `UPDATE clientes SET nombre = COALESCE($1,nombre), telefono = COALESCE($2,telefono),
         email = COALESCE($3,email), direccion = COALESCE($4,direccion) WHERE id = $5 RETURNING *`,
        [nombre, telefono, email, direccion, req.params.id]
      );
      if (rows.length === 0) return res.status(404).json({ error: 'Cliente no encontrado' });
      io.emit('cliente:actualizado', rows[0]);
      res.json(rows[0]);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Error actualizando cliente' });
    }
  });

  // POST /api/clientes/:id/pagos -> registra un pago de fiado
  router.post('/:id/pagos', async (req, res) => {
    const { monto } = req.body;
    if (!monto || monto <= 0) return res.status(400).json({ error: 'Monto invalido' });
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const clienteRes = await client.query('SELECT * FROM clientes WHERE id = $1 FOR UPDATE', [req.params.id]);
      if (clienteRes.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Cliente no encontrado' });
      }
      const nuevoSaldo = Math.max(0, Number(clienteRes.rows[0].saldo_adeudado) - Number(monto));
      const updateRes = await client.query(
        'UPDATE clientes SET saldo_adeudado = $1 WHERE id = $2 RETURNING *',
        [nuevoSaldo, req.params.id]
      );
      await client.query('INSERT INTO pagos_fiado (cliente_id, monto) VALUES ($1,$2)', [req.params.id, monto]);
      await client.query('COMMIT');
      io.emit('cliente:actualizado', updateRes.rows[0]);
      res.json(updateRes.rows[0]);
    } catch (err) {
      await client.query('ROLLBACK');
      console.error(err);
      res.status(500).json({ error: 'Error registrando pago' });
    } finally {
      client.release();
    }
  });

  return router;
};
