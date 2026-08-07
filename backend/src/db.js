const { Pool } = require('pg');
require('dotenv').config();

// Si existe DATABASE_URL (Neon, Render Postgres, Railway, etc.) la usamos directamente.
// Si no, armamos la conexion con las variables sueltas (uso tipico de Docker local).
const usarSSL = process.env.DB_SSL !== 'false';

const config = process.env.DATABASE_URL
  ? {
      connectionString: process.env.DATABASE_URL,
      ssl: usarSSL ? { rejectUnauthorized: false } : false,
    }
  : {
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 5432,
      database: process.env.DB_NAME || 'carniceria_stock',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
      ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
    };

const pool = new Pool(config);

pool.on('error', (err) => {
  console.error('Error inesperado en el pool de PostgreSQL', err);
});

module.exports = pool;
