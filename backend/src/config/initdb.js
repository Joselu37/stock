// Ejecuta el esquema SQL (db/init.sql) y crea el usuario admin por defecto si no existe.
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const pool = require('../db');

async function initDb() {
  const sqlPath = path.join(__dirname, '..', '..', 'db', 'init.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');
  await pool.query(sql);

  const { rows } = await pool.query('SELECT id FROM usuarios WHERE email = $1', ['admin@carniceria.com']);
  if (rows.length === 0) {
    const hash = bcrypt.hashSync('admin123', 10);
    await pool.query(
      'INSERT INTO usuarios (nombre, email, password_hash, rol) VALUES ($1,$2,$3,$4)',
      ['Administrador', 'admin@carniceria.com', hash, 'admin']
    );
    console.log('Usuario admin creado: admin@carniceria.com / admin123');
  }
  console.log('Base de datos inicializada correctamente.');
}

if (require.main === module) {
  initDb()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Error inicializando la base de datos:', err);
      process.exit(1);
    });
}

module.exports = initDb;
