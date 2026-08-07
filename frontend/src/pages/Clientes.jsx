import { useEffect, useState, useCallback } from 'react';
import api from '../api';
import { conectarSocket } from '../socket';

const vacio = { nombre: '', telefono: '', email: '', direccion: '' };

export default function Clientes() {
  const [clientes, setClientes] = useState([]);
  const [form, setForm] = useState(vacio);
  const [mensaje, setMensaje] = useState('');

  const cargar = useCallback(async () => {
    const { data } = await api.get('/clientes');
    setClientes(data);
  }, []);

  useEffect(() => {
    cargar();
    const socket = conectarSocket();
    if (!socket) return;
    const refrescar = () => cargar();
    socket.on('cliente:creado', refrescar);
    socket.on('cliente:actualizado', refrescar);
    return () => {
      socket.off('cliente:creado', refrescar);
      socket.off('cliente:actualizado', refrescar);
    };
  }, [cargar]);

  async function handleSubmit(e) {
    e.preventDefault();
    try {
      await api.post('/clientes', form);
      setForm(vacio);
      setMensaje('Cliente registrado correctamente.');
    } catch (err) {
      setMensaje(err.response?.data?.error || 'Error al registrar cliente');
    }
  }

  async function registrarPago(cliente) {
    const monto = prompt(`Registrar pago para ${cliente.nombre} (debe $${cliente.saldo_adeudado}):`);
    if (!monto || isNaN(Number(monto))) return;
    await api.post(`/clientes/${cliente.id}/pagos`, { monto: Number(monto) });
  }

  return (
    <div>
      <h2>Clientes y Fiado</h2>
      {mensaje && <div className="info-box">{mensaje}</div>}

      <form className="form-card" onSubmit={handleSubmit}>
        <h3>Nuevo cliente</h3>
        <div className="form-grid">
          <div><label>Nombre *</label><input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} required /></div>
          <div><label>Teléfono</label><input value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} /></div>
          <div><label>Email</label><input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
          <div><label>Dirección</label><input value={form.direccion} onChange={(e) => setForm({ ...form, direccion: e.target.value })} /></div>
        </div>
        <div className="form-actions"><button type="submit">Registrar cliente</button></div>
      </form>

      <table className="tabla">
        <thead><tr><th>Nombre</th><th>Teléfono</th><th>Email</th><th>Saldo adeudado</th><th>Acciones</th></tr></thead>
        <tbody>
          {clientes.map((c) => (
            <tr key={c.id} className={Number(c.saldo_adeudado) > 0 ? 'fila-alerta' : ''}>
              <td>{c.nombre}</td>
              <td>{c.telefono || '-'}</td>
              <td>{c.email || '-'}</td>
              <td>${Number(c.saldo_adeudado).toFixed(2)}</td>
              <td>{Number(c.saldo_adeudado) > 0 && <button onClick={() => registrarPago(c)}>Registrar pago</button>}</td>
            </tr>
          ))}
          {clientes.length === 0 && <tr><td colSpan={5}>No hay clientes registrados.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
