import { useEffect, useState, useCallback } from 'react';
import api from '../api';
import { conectarSocket } from '../socket';
import BarcodeScanner from '../components/BarcodeScanner.jsx';

const vacio = { codigo_barras: '', nombre: '', categoria: 'despensa', unidad: 'kg', precio_unitario: '', stock_actual: '', stock_minimo: '' };

function TablaCategoria({ titulo, productos, onEditar, onAjustar, onEliminar }) {
  return (
    <div className="bloque-categoria">
      <h3>{titulo} <span className="contador">({productos.length})</span></h3>
      <table className="tabla">
        <thead>
          <tr><th>Código</th><th>Nombre</th><th>Precio</th><th>Stock</th><th>Unidad</th><th>Acciones</th></tr>
        </thead>
        <tbody>
          {productos.map((p) => (
            <tr key={p.id} className={Number(p.stock_actual) <= Number(p.stock_minimo) ? 'fila-alerta' : ''}>
              <td>{p.codigo_barras || '-'}</td>
              <td>{p.nombre}</td>
              <td>${Number(p.precio_unitario).toFixed(2)}</td>
              <td>{p.stock_actual}</td>
              <td>{p.unidad}</td>
              <td className="acciones">
                <button onClick={() => onEditar(p)}>Editar</button>
                <button onClick={() => onAjustar(p.id, 'alta')}>+ Stock</button>
                <button onClick={() => onAjustar(p.id, 'baja')}>- Stock</button>
                <button className="danger" onClick={() => onEliminar(p.id)}>Baja</button>
              </td>
            </tr>
          ))}
          {productos.length === 0 && <tr><td colSpan={6}>Sin productos en esta categoría.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

export default function Productos() {
  const [productos, setProductos] = useState([]);
  const [buscar, setBuscar] = useState('');
  const [form, setForm] = useState(vacio);
  const [editandoId, setEditandoId] = useState(null);
  const [mensaje, setMensaje] = useState('');

  const cargar = useCallback(async (texto) => {
    const { data } = await api.get('/productos', { params: texto ? { buscar: texto } : {} });
    setProductos(data);
  }, []);

  useEffect(() => {
    cargar('');
    const socket = conectarSocket();
    if (!socket) return;
    const refrescar = () => cargar(buscar);
    socket.on('producto:creado', refrescar);
    socket.on('producto:actualizado', refrescar);
    socket.on('producto:eliminado', refrescar);
    return () => {
      socket.off('producto:creado', refrescar);
      socket.off('producto:actualizado', refrescar);
      socket.off('producto:eliminado', refrescar);
    };
    // eslint-disable-next-line
  }, []);

  useEffect(() => {
    const t = setTimeout(() => cargar(buscar), 300);
    return () => clearTimeout(t);
  }, [buscar, cargar]);

  async function handleSubmit(e) {
    e.preventDefault();
    setMensaje('');
    try {
      if (editandoId) {
        await api.put(`/productos/${editandoId}`, form);
        setMensaje('Producto actualizado correctamente.');
      } else {
        await api.post('/productos', form);
        setMensaje('Producto dado de alta correctamente.');
      }
      setForm(vacio);
      setEditandoId(null);
    } catch (err) {
      setMensaje(err.response?.data?.error || 'Error al guardar producto');
    }
  }

  function editar(p) {
    setEditandoId(p.id);
    setForm({
      codigo_barras: p.codigo_barras || '',
      nombre: p.nombre,
      categoria: p.categoria,
      unidad: p.unidad,
      precio_unitario: p.precio_unitario,
      stock_actual: p.stock_actual,
      stock_minimo: p.stock_minimo,
    });
  }

  async function eliminar(id) {
    if (!confirm('¿Dar de baja este producto?')) return;
    await api.delete(`/productos/${id}`);
  }

  async function ajustarStock(id, tipo) {
    const cantidad = prompt(`Cantidad a ${tipo === 'alta' ? 'agregar' : 'restar'}:`);
    if (!cantidad || isNaN(Number(cantidad))) return;
    await api.put(`/productos/${id}/stock`, { cantidad: Number(cantidad), tipo, motivo: 'Ajuste manual' });
  }

  // Manejo del lector de codigo de barras: busca el producto por codigo y lo carga para editar/ajustar
  const handleScan = useCallback(async (codigo) => {
    try {
      const { data } = await api.get(`/productos/codigo/${codigo}`);
      editar(data);
      setMensaje(`Producto escaneado: ${data.nombre}`);
    } catch (err) {
      setForm({ ...vacio, codigo_barras: codigo });
      setEditandoId(null);
      setMensaje('Código no registrado. Completá los datos para dar de alta el producto.');
    }
  }, []);

  const despensa = productos.filter((p) => p.categoria === 'despensa');
  const carniceria = productos.filter((p) => p.categoria === 'carniceria');

  return (
    <div>
      <BarcodeScanner onScan={handleScan} />
      <h2>Gestión de Productos</h2>
      <p className="hint">📷 Podés usar el lector de código de barras en cualquier momento de esta pantalla.</p>

      <form className="form-card" onSubmit={handleSubmit}>
        <h3>{editandoId ? 'Editar producto' : 'Alta de producto'}</h3>
        {mensaje && <div className="info-box">{mensaje}</div>}
        <div className="form-grid">
          <div>
            <label>Código de barras</label>
            <input value={form.codigo_barras} onChange={(e) => setForm({ ...form, codigo_barras: e.target.value })} />
          </div>
          <div>
            <label>Nombre *</label>
            <input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} required />
          </div>
          <div>
            <label>Categoría *</label>
            <select value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })}>
              <option value="despensa">Despensa</option>
              <option value="carniceria">Carnicería</option>
            </select>
          </div>
          <div>
            <label>Unidad</label>
            <select value={form.unidad} onChange={(e) => setForm({ ...form, unidad: e.target.value })}>
              <option value="kg">Kg</option>
              <option value="unidad">Unidad</option>
              <option value="litro">Litro</option>
            </select>
          </div>
          <div>
            <label>Precio unitario</label>
            <input type="number" step="0.01" value={form.precio_unitario} onChange={(e) => setForm({ ...form, precio_unitario: e.target.value })} />
          </div>
          {!editandoId && (
            <div>
              <label>Stock inicial</label>
              <input type="number" step="0.001" value={form.stock_actual} onChange={(e) => setForm({ ...form, stock_actual: e.target.value })} />
            </div>
          )}
          <div>
            <label>Stock mínimo</label>
            <input type="number" step="0.001" value={form.stock_minimo} onChange={(e) => setForm({ ...form, stock_minimo: e.target.value })} />
          </div>
        </div>
        <div className="form-actions">
          <button type="submit">{editandoId ? 'Guardar cambios' : 'Dar de alta'}</button>
          {editandoId && <button type="button" onClick={() => { setEditandoId(null); setForm(vacio); }}>Cancelar</button>}
        </div>
      </form>

      <input className="buscador" placeholder="🔍 Buscar producto por nombre o código (en ambas categorías)..." value={buscar} onChange={(e) => setBuscar(e.target.value)} />

      <div className="columnas-categorias">
        <TablaCategoria titulo="🥩 Carnicería" productos={carniceria} onEditar={editar} onAjustar={ajustarStock} onEliminar={eliminar} />
        <TablaCategoria titulo="🛒 Despensa" productos={despensa} onEditar={editar} onAjustar={ajustarStock} onEliminar={eliminar} />
      </div>
    </div>
  );
}
