const express = require('express');
const pool = require('../db');
const { authMiddleware } = require('../middleware/auth');

module.exports = function (io) {
  const router = express.Router();
  router.use(authMiddleware);

  // GET /api/productos?buscar=texto&categoria=despensa|carniceria
  router.get('/', async (req, res) => {
    const { buscar, categoria } = req.query;
    try {
      let query = 'SELECT * FROM productos WHERE activo = TRUE';
      const params = [];
      if (buscar) {
        params.push(`%${buscar.toLowerCase()}%`);
        query += ` AND (LOWER(nombre) LIKE $${params.length} OR codigo_barras LIKE $${params.length})`;
      }
      if (categoria && ['despensa', 'carniceria'].includes(categoria)) {
        params.push(categoria);
        query += ` AND categoria = $${params.length}`;
      }
      query += ' ORDER BY nombre ASC';
      const { rows } = await pool.query(query, params);
      res.json(rows);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Error obteniendo productos' });
    }
  });

  // GET /api/productos/codigo/:codigo -> busca por codigo de barras exacto (para el lector)
  router.get('/codigo/:codigo', async (req, res) => {
    try {
      const { rows } = await pool.query('SELECT * FROM productos WHERE codigo_barras = $1', [req.params.codigo]);
      if (rows.length === 0) return res.status(404).json({ error: 'Producto no encontrado' });
      res.json(rows[0]);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Error buscando producto' });
    }
  });

  // POST /api/productos (alta)
  router.post('/', async (req, res) => {
    const { codigo_barras, nombre, categoria, unidad, precio_unitario, stock_actual, stock_minimo } = req.body;
    if (!nombre) return res.status(400).json({ error: 'El nombre es requerido' });
    const categoriaFinal = ['despensa', 'carniceria'].includes(categoria) ? categoria : 'despensa';
    try {
      const { rows } = await pool.query(
        `INSERT INTO productos (codigo_barras, nombre, categoria, unidad, precio_unitario, stock_actual, stock_minimo)
         VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
        [codigo_barras || null, nombre, categoriaFinal, unidad || 'kg', precio_unitario || 0, stock_actual || 0, stock_minimo || 0]
      );
      const producto = rows[0];
      if (producto.stock_actual > 0) {
        await pool.query(
          'INSERT INTO movimientos_stock (producto_id, tipo, cantidad, motivo) VALUES ($1,$2,$3,$4)',
          [producto.id, 'alta', producto.stock_actual, 'Alta inicial de producto']
        );
      }
      io.emit('producto:creado', producto);
      res.status(201).json(producto);
    } catch (err) {
      if (err.code === '23505') return res.status(409).json({ error: 'Codigo de barras ya registrado' });
      console.error(err);
      res.status(500).json({ error: 'Error creando producto' });
    }
  });

  // PUT /api/productos/:id (modificacion)
  router.put('/:id', async (req, res) => {
    const { id } = req.params;
    const { codigo_barras, nombre, categoria, unidad, precio_unitario, stock_minimo } = req.body;
    if (categoria && !['despensa', 'carniceria'].includes(categoria)) {
      return res.status(400).json({ error: 'Categoria invalida, debe ser despensa o carniceria' });
    }
    const categoriaFinal = categoria || null;
    try {
      const { rows } = await pool.query(
        `UPDATE productos SET
          codigo_barras = COALESCE($1, codigo_barras),
          nombre = COALESCE($2, nombre),
          categoria = COALESCE($3, categoria),
          unidad = COALESCE($4, unidad),
          precio_unitario = COALESCE($5, precio_unitario),
          stock_minimo = COALESCE($6, stock_minimo),
          actualizado_en = NOW()
         WHERE id = $7 RETURNING *`,
        [codigo_barras, nombre, categoriaFinal, unidad, precio_unitario, stock_minimo, id]
      );
      if (rows.length === 0) return res.status(404).json({ error: 'Producto no encontrado' });
      io.emit('producto:actualizado', rows[0]);
      res.json(rows[0]);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Error actualizando producto' });
    }
  });

  // PUT /api/productos/:id/stock (ajuste manual de cantidad, alta/baja por codigo de barras)
  router.put('/:id/stock', async (req, res) => {
    const { id } = req.params;
    const { cantidad, tipo, motivo } = req.body; // tipo: 'alta' | 'baja' | 'ajuste'
    if (cantidad === undefined || !tipo) return res.status(400).json({ error: 'cantidad y tipo son requeridos' });
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const prodRes = await client.query('SELECT * FROM productos WHERE id = $1 FOR UPDATE', [id]);
      if (prodRes.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Producto no encontrado' });
      }
      let nuevoStock = Number(prodRes.rows[0].stock_actual);
      if (tipo === 'alta') nuevoStock += Number(cantidad);
      else if (tipo === 'baja') nuevoStock -= Number(cantidad);
      else nuevoStock = Number(cantidad); // ajuste = valor absoluto

      if (nuevoStock < 0) nuevoStock = 0;

      const updateRes = await client.query(
        'UPDATE productos SET stock_actual = $1, actualizado_en = NOW() WHERE id = $2 RETURNING *',
        [nuevoStock, id]
      );
      await client.query(
        'INSERT INTO movimientos_stock (producto_id, tipo, cantidad, motivo, usuario_id) VALUES ($1,$2,$3,$4,$5)',
        [id, tipo, cantidad, motivo || null, req.usuario.id]
      );
      await client.query('COMMIT');
      io.emit('producto:actualizado', updateRes.rows[0]);
      io.emit('stock:cambio', { producto_id: Number(id), stock_actual: nuevoStock });
      res.json(updateRes.rows[0]);
    } catch (err) {
      await client.query('ROLLBACK');
      console.error(err);
      res.status(500).json({ error: 'Error actualizando stock' });
    } finally {
      client.release();
    }
  });

  // DELETE /api/productos/:id (baja logica)
  router.delete('/:id', async (req, res) => {
    try {
      const { rows } = await pool.query(
        'UPDATE productos SET activo = FALSE, actualizado_en = NOW() WHERE id = $1 RETURNING *',
        [req.params.id]
      );
      if (rows.length === 0) return res.status(404).json({ error: 'Producto no encontrado' });
      io.emit('producto:eliminado', { id: Number(req.params.id) });
      res.json({ ok: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Error eliminando producto' });
    }
  });

  return router;
};
