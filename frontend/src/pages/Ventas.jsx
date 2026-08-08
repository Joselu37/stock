import { useEffect, useState, useCallback } from 'react';
import api from '../api';
import BarcodeScanner from '../components/BarcodeScanner.jsx';
import PopupPago from '../components/PopupPago.jsx';

const ETIQUETAS_TIPO = { contado: 'Efectivo', transferencia: 'Transferencia', tarjeta: 'Tarjeta', fiado: 'Fiado', mixto: 'Mixto' };

export default function Ventas() {
  const [buscar, setBuscar] = useState('');
  const [resultados, setResultados] = useState([]);
  const [carrito, setCarrito] = useState([]); // { producto, cantidad }
  const [clientes, setClientes] = useState([]);
  const [mensaje, setMensaje] = useState('');
  const [procesando, setProcesando] = useState(false);
  const [historial, setHistorial] = useState([]);
  const [mostrarPopup, setMostrarPopup] = useState(false);

  const cargarHistorial = useCallback(async () => {
    const { data } = await api.get('/ventas');
    setHistorial(data);
  }, []);

  useEffect(() => {
    cargarHistorial();
    api.get('/clientes').then(({ data }) => setClientes(data));
  }, [cargarHistorial]);

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
      setMensaje(`Agregado: ${data.nombre} (${data.categoria === 'carniceria' ? 'Carnicería' : 'Despensa'})`);
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

  function abrirPopupPago() {
    setMensaje('');
    if (carrito.length === 0) { setMensaje('Agregá al menos un producto.'); return; }
    setMostrarPopup(true);
  }

  async function borrarVenta(id) {
    if (!confirm(`¿Anular la venta #${id}? Esto va a devolver el stock de los productos vendidos.`)) return;
    try {
      await api.delete(`/ventas/${id}`);
      setMensaje(`Venta #${id} anulada. El stock fue repuesto.`);
      cargarHistorial();
    } catch (err) {
      setMensaje(err.response?.data?.error || 'Error al anular la venta');
    }
  }

  async function confirmarVentaConPago({ pagos, cliente_id }) {
    setProcesando(true);
    try {
      await api.post('/ventas', {
        pagos,
        cliente_id,
        items: carrito.map((it) => ({ producto_id: it.producto.id, cantidad: it.cantidad })),
      });
      setMensaje('✅ Venta registrada correctamente.');
      setCarrito([]);
      setMostrarPopup(false);
      cargarHistorial();
    } catch (err) {
      setMensaje(err.response?.data?.error || 'Error al registrar la venta');
      setMostrarPopup(false);
    } finally {
      setProcesando(false);
    }
  }

  return (
    <div>
      <BarcodeScanner onScan={handleScan} />
      <h2>Ventas</h2>
      <p className="hint">📷 Escaneá o buscá productos de Despensa o Carnicería, armá el carrito y elegí el medio de pago al confirmar.</p>
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
              <span className={`etiqueta-cat ${p.categoria}`}>{p.categoria === 'carniceria' ? '🥩' : '🛒'}</span>
              {p.nombre} — ${Number(p.precio_unitario).toFixed(2)} / {p.unidad} (stock: {p.stock_actual})
            </li>
          ))}
        </ul>
      )}

      <table className="tabla">
        <thead>
          <tr><th>Producto</th><th>Categoría</th><th>Cantidad</th><th>Precio Unit.</th><th>Subtotal</th><th></th></tr>
        </thead>
        <tbody>
          {carrito.map((it) => (
            <tr key={it.producto.id}>
              <td>{it.producto.nombre}</td>
              <td>{it.producto.categoria === 'carniceria' ? '🥩 Carnicería' : '🛒 Despensa'}</td>
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
          {carrito.length === 0 && <tr><td colSpan={6}>Buscá o escaneá productos para agregarlos a la venta.</td></tr>}
        </tbody>
      </table>

      <div className="total-venta">
        <span>Total: ${total.toFixed(2)}</span>
        <button disabled={procesando} onClick={abrirPopupPago}>{procesando ? 'Procesando...' : 'Confirmar venta'}</button>
      </div>

      {mostrarPopup && (
        <PopupPago
          total={total}
          clientes={clientes}
          onConfirmar={confirmarVentaConPago}
          onCancelar={() => setMostrarPopup(false)}
        />
      )}

      <h3>Historial de ventas</h3>
      <table className="tabla">
        <thead><tr><th>#</th><th>Fecha</th><th>Cliente</th><th>Medio de pago</th><th>Total</th><th></th></tr></thead>
        <tbody>
          {historial.map((v) => (
            <tr key={v.id}>
              <td>{v.id}</td>
              <td>{new Date(v.fecha).toLocaleString()}</td>
              <td>{v.cliente_nombre || '-'}</td>
              <td>
                {v.tipo_pago === 'mixto' && Array.isArray(v.pagos)
                  ? v.pagos.map((p) => `${ETIQUETAS_TIPO[p.tipo_pago]}: $${Number(p.monto).toFixed(2)}`).join(' + ')
                  : ETIQUETAS_TIPO[v.tipo_pago] || v.tipo_pago}
              </td>
              <td>${Number(v.total).toFixed(2)}</td>
              <td><button className="danger" onClick={() => borrarVenta(v.id)}>Anular</button></td>
            </tr>
          ))}
          {historial.length === 0 && <tr><td colSpan={6}>Sin ventas registradas todavía.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
