import { useState, useEffect } from 'react';

const ETIQUETAS = { contado: 'Efectivo', transferencia: 'Transferencia', tarjeta: 'Tarjeta', fiado: 'Fiado' };

/**
 * Popup para elegir el/los medios de pago de una venta.
 * Permite un solo medio (lo mas comun) o dividir el total entre varios.
 */
export default function PopupPago({ total, clientes, onConfirmar, onCancelar }) {
  const [dividir, setDividir] = useState(false);
  const [medioUnico, setMedioUnico] = useState('contado');
  const [partes, setPartes] = useState([{ tipo_pago: 'contado', monto: total }]);
  const [clienteId, setClienteId] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!dividir) setPartes([{ tipo_pago: medioUnico, monto: total }]);
  }, [dividir, medioUnico, total]);

  function actualizarParte(idx, campo, valor) {
    setPartes((prev) => prev.map((p, i) => (i === idx ? { ...p, [campo]: campo === 'monto' ? valor : valor } : p)));
  }

  function agregarParte() {
    setPartes((prev) => [...prev, { tipo_pago: 'contado', monto: '' }]);
  }

  function quitarParte(idx) {
    setPartes((prev) => prev.filter((_, i) => i !== idx));
  }

  const sumaPartes = partes.reduce((acc, p) => acc + (Number(p.monto) || 0), 0);
  const faltante = Math.round((total - sumaPartes) * 100) / 100;
  const requiereCliente = partes.some((p) => p.tipo_pago === 'fiado');

  function confirmar() {
    setError('');
    if (Math.abs(faltante) > 0.01) {
      setError(`La suma de los pagos debe ser igual al total. Faltan $${faltante.toFixed(2)}.`);
      return;
    }
    if (requiereCliente && !clienteId) {
      setError('Elegí un cliente porque hay un componente fiado en el pago.');
      return;
    }
    onConfirmar({
      pagos: partes.map((p) => ({ tipo_pago: p.tipo_pago, monto: Number(p.monto) })),
      cliente_id: requiereCliente ? Number(clienteId) : null,
    });
  }

  return (
    <div className="popup-overlay" onClick={onCancelar}>
      <div className="popup" onClick={(e) => e.stopPropagation()}>
        <h3>Medio de pago</h3>
        <p className="hint">Total a cobrar: <strong>${total.toFixed(2)}</strong></p>

        {!dividir && (
          <div className="form-grid">
            <div>
              <label>Pagó con</label>
              <select value={medioUnico} onChange={(e) => setMedioUnico(e.target.value)}>
                <option value="contado">Efectivo (contado)</option>
                <option value="transferencia">Transferencia</option>
                <option value="tarjeta">Tarjeta</option>
                <option value="fiado">Fiado</option>
              </select>
            </div>
          </div>
        )}

        {dividir && (
          <div className="partes-pago">
            {partes.map((p, idx) => (
              <div key={idx} className="parte-pago-fila">
                <select value={p.tipo_pago} onChange={(e) => actualizarParte(idx, 'tipo_pago', e.target.value)}>
                  <option value="contado">Efectivo</option>
                  <option value="transferencia">Transferencia</option>
                  <option value="tarjeta">Tarjeta</option>
                  <option value="fiado">Fiado</option>
                </select>
                <input
                  type="number"
                  step="0.01"
                  placeholder="Monto"
                  value={p.monto}
                  onChange={(e) => actualizarParte(idx, 'monto', e.target.value)}
                  style={{ width: '110px' }}
                />
                {partes.length > 1 && <button type="button" className="danger" onClick={() => quitarParte(idx)}>Quitar</button>}
              </div>
            ))}
            <button type="button" onClick={agregarParte}>+ Agregar otro medio de pago</button>
            <p className="hint">
              {Math.abs(faltante) < 0.01 ? '✅ Los montos cubren el total.' : `Falta cubrir: $${faltante.toFixed(2)}`}
            </p>
          </div>
        )}

        <label className="checkbox-linea">
          <input type="checkbox" checked={dividir} onChange={(e) => setDividir(e.target.checked)} />
          Dividir esta venta entre varios medios de pago
        </label>

        {requiereCliente && (
          <div className="form-grid">
            <div>
              <label>Cliente (fiado) *</label>
              <select value={clienteId} onChange={(e) => setClienteId(e.target.value)}>
                <option value="">Seleccionar cliente...</option>
                {clientes.map((c) => (
                  <option key={c.id} value={c.id}>{c.nombre} (debe ${Number(c.saldo_adeudado).toFixed(2)})</option>
                ))}
              </select>
            </div>
          </div>
        )}

        {error && <div className="error-box">{error}</div>}

        <div className="form-actions">
          <button onClick={confirmar}>Confirmar venta</button>
          <button type="button" onClick={onCancelar}>Cancelar</button>
        </div>
      </div>
    </div>
  );
}
