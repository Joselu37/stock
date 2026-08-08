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
    categoria VARCHAR(20) NOT NULL DEFAULT 'despensa', -- despensa | carniceria
    unidad VARCHAR(20) NOT NULL DEFAULT 'kg', -- kg | unidad | litro
    precio_unitario NUMERIC(12,2) NOT NULL DEFAULT 0,
    stock_actual NUMERIC(12,3) NOT NULL DEFAULT 0,
    stock_minimo NUMERIC(12,3) NOT NULL DEFAULT 0,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    creado_en TIMESTAMP NOT NULL DEFAULT NOW(),
    actualizado_en TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Migracion: cualquier producto con una categoria vieja/libre pasa a "despensa" por defecto
UPDATE productos SET categoria = 'despensa' WHERE categoria IS NULL OR categoria NOT IN ('despensa', 'carniceria');

CREATE INDEX IF NOT EXISTS idx_productos_nombre ON productos (LOWER(nombre));
CREATE INDEX IF NOT EXISTS idx_productos_codigo ON productos (codigo_barras);
CREATE INDEX IF NOT EXISTS idx_productos_categoria ON productos (categoria);

CREATE TABLE IF NOT EXISTS clientes (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(150) NOT NULL,
    telefono VARCHAR(40),
    email VARCHAR(150),
    direccion VARCHAR(255),
    saldo_adeudado NUMERIC(12,2) NOT NULL DEFAULT 0,
    creado_en TIMESTAMP NOT NULL DEFAULT NOW()
);

-- "tipo_pago" queda como resumen: el medio unico, o 'mixto' si la venta se dividio en varios medios.
-- El detalle real de cuanto se pago con cada medio vive en venta_pagos.
CREATE TABLE IF NOT EXISTS ventas (
    id SERIAL PRIMARY KEY,
    tipo_pago VARCHAR(20) NOT NULL CHECK (tipo_pago IN ('contado','transferencia','tarjeta','fiado','mixto')),
    cliente_id INTEGER REFERENCES clientes(id) ON DELETE SET NULL,
    usuario_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
    total NUMERIC(12,2) NOT NULL DEFAULT 0,
    pagado BOOLEAN NOT NULL DEFAULT TRUE, -- false si tiene algun componente fiado sin saldar
    fecha TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Si la tabla ya existia de una version anterior, nos aseguramos de que acepte 'mixto'.
DO $$
BEGIN
  ALTER TABLE ventas DROP CONSTRAINT IF EXISTS ventas_tipo_pago_check;
  ALTER TABLE ventas ADD CONSTRAINT ventas_tipo_pago_check CHECK (tipo_pago IN ('contado','transferencia','tarjeta','fiado','mixto'));
END $$;

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

-- Detalle de cada medio de pago dentro de una venta (permite dividir una venta en varios medios)
CREATE TABLE IF NOT EXISTS venta_pagos (
    id SERIAL PRIMARY KEY,
    venta_id INTEGER NOT NULL REFERENCES ventas(id) ON DELETE CASCADE,
    tipo_pago VARCHAR(20) NOT NULL CHECK (tipo_pago IN ('contado','transferencia','tarjeta','fiado')),
    monto NUMERIC(12,2) NOT NULL CHECK (monto > 0)
);

CREATE INDEX IF NOT EXISTS idx_venta_pagos_venta ON venta_pagos (venta_id);
CREATE INDEX IF NOT EXISTS idx_venta_pagos_tipo ON venta_pagos (tipo_pago);

-- Migracion: ventas antiguas (de antes de venta_pagos) no tienen su fila de pago; se completa una sola vez.
INSERT INTO venta_pagos (venta_id, tipo_pago, monto)
SELECT v.id, v.tipo_pago, v.total FROM ventas v
WHERE v.tipo_pago <> 'mixto'
  AND NOT EXISTS (SELECT 1 FROM venta_pagos vp WHERE vp.venta_id = v.id);

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
