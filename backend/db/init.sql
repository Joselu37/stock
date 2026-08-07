-- ============================================================
-- Base de datos: Gestion de Stock Carniceria y Despensa
-- PostgreSQL
-- ============================================================

CREATE TABLE IF NOT EXISTS usuarios (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    rol VARCHAR(20) NOT NULL DEFAULT 'empleado', -- admin | empleado
    creado_en TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS productos (
    id SERIAL PRIMARY KEY,
    codigo_barras VARCHAR(64) UNIQUE,
    nombre VARCHAR(150) NOT NULL,
    categoria VARCHAR(80) DEFAULT 'general',
    unidad VARCHAR(20) NOT NULL DEFAULT 'kg', -- kg | unidad | litro
    precio_unitario NUMERIC(12,2) NOT NULL DEFAULT 0,
    stock_actual NUMERIC(12,3) NOT NULL DEFAULT 0,
    stock_minimo NUMERIC(12,3) NOT NULL DEFAULT 0,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    creado_en TIMESTAMP NOT NULL DEFAULT NOW(),
    actualizado_en TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_productos_nombre ON productos (LOWER(nombre));
CREATE INDEX IF NOT EXISTS idx_productos_codigo ON productos (codigo_barras);

CREATE TABLE IF NOT EXISTS clientes (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(150) NOT NULL,
    telefono VARCHAR(40),
    email VARCHAR(150),
    direccion VARCHAR(255),
    saldo_adeudado NUMERIC(12,2) NOT NULL DEFAULT 0,
    creado_en TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ventas (
    id SERIAL PRIMARY KEY,
    tipo_pago VARCHAR(20) NOT NULL CHECK (tipo_pago IN ('contado','transferencia','tarjeta','fiado')),
    cliente_id INTEGER REFERENCES clientes(id) ON DELETE SET NULL,
    usuario_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
    total NUMERIC(12,2) NOT NULL DEFAULT 0,
    pagado BOOLEAN NOT NULL DEFAULT TRUE, -- false solo para fiado pendiente
    fecha TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ventas_tipo ON ventas (tipo_pago);
CREATE INDEX IF NOT EXISTS idx_ventas_fecha ON ventas (fecha);
CREATE INDEX IF NOT EXISTS idx_ventas_pagado ON ventas (pagado);

CREATE TABLE IF NOT EXISTS venta_items (
    id SERIAL PRIMARY KEY,
    venta_id INTEGER NOT NULL REFERENCES ventas(id) ON DELETE CASCADE,
    producto_id INTEGER NOT NULL REFERENCES productos(id),
    cantidad NUMERIC(12,3) NOT NULL,
    precio_unitario NUMERIC(12,2) NOT NULL,
    subtotal NUMERIC(12,2) NOT NULL
);

CREATE TABLE IF NOT EXISTS pagos_fiado (
    id SERIAL PRIMARY KEY,
    cliente_id INTEGER NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
    venta_id INTEGER REFERENCES ventas(id) ON DELETE SET NULL,
    monto NUMERIC(12,2) NOT NULL,
    fecha TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS movimientos_stock (
    id SERIAL PRIMARY KEY,
    producto_id INTEGER NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
    tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('alta','baja','venta','ajuste')),
    cantidad NUMERIC(12,3) NOT NULL,
    motivo VARCHAR(255),
    usuario_id INTEGER REFERENCES usuarios(id),
    fecha TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS alertas (
    id SERIAL PRIMARY KEY,
    tipo VARCHAR(30) NOT NULL, -- fiado_vencido | stock_bajo
    mensaje TEXT NOT NULL,
    leida BOOLEAN NOT NULL DEFAULT FALSE,
    creado_en TIMESTAMP NOT NULL DEFAULT NOW()
);

-- El usuario administrador por defecto (admin@carniceria.com / admin123)
-- se crea automaticamente al iniciar el backend (ver src/config/initdb.js),
-- ya que el hash de password se genera con bcrypt en tiempo de ejecucion.
