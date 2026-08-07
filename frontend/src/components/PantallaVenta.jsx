import { useEffect, useState, useCallback } from 'react';
import api from '../api';
import BarcodeScanner from './BarcodeScanner.jsx';

/**
 * Componente generico para una pantalla de venta de un tipo de pago especifico.
 * Cada pagina de venta (Contado, Transferencia, Tarjeta, Fiado) lo usa con su propio tipo.
 */
export default function PantallaVenta({ tipoPago, titulo, requiereCliente }) {
  const [buscar, setBuscar] = useState('');
  const [resultados, setResultados] = useState([]);
  const [carrito, setCarrito] = useState([]); // { producto, cantidad }
  const [clientes, setClientes] = useState([]);
  const [clienteId, setClienteId] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [procesando, setProcesando] = useState(false);
  const [historial, setHistorial] = useState([]);

  const cargarHistorial = useCallback(async () => {
    const { data } = await api.get('/ventas', { params: { tipo: tipoPago } });
    setHistorial(data);
  }, [tipoPago]);

  useEffect(() => {
    cargarHistorial();
    if (requiereCliente) {
      api.get('/clientes').then(({ data }) => setClientes(data));
    }
  }, [cargarHistorial, requiereCliente]);

  useEffect(() => {
    if (!buscar) { setResultados([]); return; }
    const t = setTimeout(async () => {
      const { data } = await api.get('/productos', { params: { buscar } });
      setResultados(data);
    }, 250);
    return () => clearTimeout(t);
  }, [buscar]);

  function agregarProducto(producto) {
    setCarrito((prev) => {
      const existe = prev.find((it) => it.producto.id === producto.id);
      if (existe) {
        return prev.map((it) => it.producto.id === producto.id ? { ...it, cantidad: it.cantidad + 1 } : it);
      }
      return [...prev, { producto, cantidad: 1 }];
    });
    setBuscar('');
    setResultados([]);
  }

  const handleScan = useCallback(async (codigo) => {
    try {
      const { data } = await api.get(`/productos/codigo/${codigo}`);
      agregarProducto(data);
      setMensaje(`Agregado: ${data.nombre}`);
    } catch (err) {
      setMensaje('Código no encontrado en el stock.');
    }
  }, []);

  function actualizarCantidad(productoId, cantidad) {
    setCarrito((prev) => prev.map((it) => it.producto.id === productoId ? { ...it, cantidad: Number(cantidad) } : it));
  }

  function quitar(productoId) {
    setCarrito((prev) => prev.filter((it) => it.producto.id !== productoId));
  }

  const total = carrito.reduce((acc, it) => acc + it.cantidad * Number(it.producto.precio_unitario), 0);

  async function confirmarVenta() {
    setMensaje('');
    if (carrito.length === 0) return setMensaje('Agregá al menos un producto.');
    if (requiereCliente && !clienteId) return setMensaje('Seleccioná un cliente para la venta fiada.');

    setProcesando(true);
    try {
      await api.post('/ventas', {
        tipo_pago: tipoPago,
        cliente_id: requiereCliente ? Number(clienteId) : undefined,
        items: carrito.map((it) => ({ producto_id: it.producto.id, cantidad: it.cantidad })),
      });
      setMensaje('✅ Venta registrada correctamente.');
      setCarrito([]);
      setClienteId('');
      cargarHistorial();
    } catch (err) {
      setMensaje(err.response?.data?.error || 'Error al registrar la venta');
    } finally {
      setProcesando(false);
    }
  }

  return (
    <div>
      <BarcodeScanner onScan={handleScan} />
      <h2>{titulo}</h2>
      {mensaje && <div className="info-box">{mensaje}</div>}

      <input
        className="buscador"
        placeholder="🔍 Buscar producto por nombre o escanear código de barras..."
        value={buscar}
        onChange={(e) => setBuscar(e.target.value)}
      />
      {resultados.length > 0 && (
        <ul className="resultados-busqueda">
          {resultados.map((p) => (
            <li key={p.id} onClick={() => agregarProducto(p)}>
              {p.nombre} — ${Number(p.precio_unitario).toFixed(2)} / {p.unidad} (stock: {p.stock_actual})
            </li>
          ))}
        </ul>
      )}

      {requiereCliente && (
        <div className="form-grid" style={{ marginBottom: '1rem' }}>
          <div>
            <label>Cliente *</label>
            <select value={clienteId} onChange={(e) => setClienteId(e.target.value)}>
              <option value="">Seleccionar cliente...</option>
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>{c.nombre} (debe ${Number(c.saldo_adeudado).toFixed(2)})</option>
              ))}
            </select>
          </div>
        </div>
      )}

      <table className="tabla">
        <thead>
          <tr><th>Producto</th><th>Cantidad</th><th>Precio Unit.</th><th>Subtotal</th><th></th></tr>
        </thead>
        <tbody>
          {carrito.map((it) => (
            <tr key={it.producto.id}>
              <td>{it.producto.nombre}</td>
              <td>
                <input
                  type="number"
                  step="0.001"
                  min="0.001"
                  value={it.cantidad}
                  onChange={(e) => actualizarCantidad(it.producto.id, e.target.value)}
                  style={{ width: '80px' }}
                />
              </td>
              <td>${Number(it.producto.precio_unitario).toFixed(2)}</td>
              <td>${(it.cantidad * Number(it.producto.precio_unitario)).toFixed(2)}</td>
              <td><button className="danger" onClick={() => quitar(it.producto.id)}>Quitar</button></td>
            </tr>
          ))}
          {carrito.length === 0 && <tr><td colSpan={5}>Buscá o escaneá productos para agregarlos a la venta.</td></tr>}
        </tbody>
      </table>

      <div className="total-venta">
        <span>Total: ${total.toFixed(2)}</span>
        <button disabled={procesando} onClick={confirmarVenta}>{procesando ? 'Procesando...' : 'Confirmar venta'}</button>
      </div>

      <h3>Historial de ventas ({titulo})</h3>
      <table className="tabla">
        <thead><tr><th>#</th><th>Fecha</th><th>Cliente</th><th>Total</th></tr></thead>
        <tbody>
          {historial.map((v) => (
            <tr key={v.id}>
              <td>{v.id}</td>
              <td>{new Date(v.fecha).toLocaleString()}</td>
              <td>{v.cliente_nombre || '-'}</td>
              <td>${Number(v.total).toFixed(2)}</td>
            </tr>
          ))}
          {historial.length === 0 && <tr><td colSpan={4}>Sin ventas registradas todavía.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
