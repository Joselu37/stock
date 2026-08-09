const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../db');
const { authMiddleware, soloAdmin } = require('../middleware/auth');

const router = express.Router();

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email y password requeridos' });

  try {
    const { rows } = await pool.query('SELECT * FROM usuarios WHERE email = $1', [email]);
    const usuario = rows[0];
    if (!usuario) return res.status(401).json({ error: 'Credenciales invalidas' });

    const ok = bcrypt.compareSync(password, usuario.password_hash);
    if (!ok) return res.status(401).json({ error: 'Credenciales invalidas' });

    const token = jwt.sign(
      { id: usuario.id, nombre: usuario.nombre, email: usuario.email, rol: usuario.rol },
      process.env.JWT_SECRET,
      { expiresIn: '12h' }
    );

    res.json({ token, usuario: { id: usuario.id, nombre: usuario.nombre, email: usuario.email, rol: usuario.rol } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error en el servidor' });
  }
});

// POST /api/auth/usuarios (crear usuario, solo admin)
router.post('/usuarios', authMiddleware, soloAdmin, async (req, res) => {
  const { nombre, email, password, rol } = req.body;
  if (!nombre || !email || !password) return res.status(400).json({ error: 'Datos incompletos' });
  try {
    const hash = bcrypt.hashSync(password, 10);
    const { rows } = await pool.query(
      'INSERT INTO usuarios (nombre, email, password_hash, rol) VALUES ($1,$2,$3,$4) RETURNING id, nombre, email, rol',
      [nombre, email, hash, rol || 'empleado']
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'El email ya esta registrado' });
    console.error(err);
    res.status(500).json({ error: 'Error en el servidor' });
  }
});

// PUT /api/auth/password (el usuario logueado cambia su propia contraseña)
router.put('/password', authMiddleware, async (req, res) => {
  const { passwordActual, passwordNueva } = req.body;
  if (!passwordActual || !passwordNueva) return res.status(400).json({ error: 'Faltan datos' });
  if (passwordNueva.length < 6) return res.status(400).json({ error: 'La contraseña nueva debe tener al menos 6 caracteres' });
  try {
    const { rows } = await pool.query('SELECT * FROM usuarios WHERE id = $1', [req.usuario.id]);
    const usuario = rows[0];
    if (!usuario) return res.status(404).json({ error: 'Usuario no encontrado' });
    const ok = bcrypt.compareSync(passwordActual, usuario.password_hash);
    if (!ok) return res.status(401).json({ error: 'La contraseña actual no es correcta' });
    const nuevoHash = bcrypt.hashSync(passwordNueva, 10);
    await pool.query('UPDATE usuarios SET password_hash = $1 WHERE id = $2', [nuevoHash, req.usuario.id]);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error en el servidor' });
  }
});

// GET /api/auth/me
router.get('/me', authMiddleware, (req, res) => {
  res.json(req.usuario);
});

module.exports = router;
