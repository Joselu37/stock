import { useState } from 'react';
import api from '../api';

export default function Usuarios() {
  const [form, setForm] = useState({ nombre: '', email: '', password: '', rol: 'empleado' });
  const [mensaje, setMensaje] = useState('');
  const [creados, setCreados] = useState([]);

  async function handleSubmit(e) {
    e.preventDefault();
    setMensaje('');
    try {
      const { data } = await api.post('/auth/usuarios', form);
      setCreados((prev) => [...prev, data]);
      setMensaje(`Usuario "${data.nombre}" creado correctamente.`);
      setForm({ nombre: '', email: '', password: '', rol: 'empleado' });
    } catch (err) {
      setMensaje(err.response?.data?.error || 'Error al crear el usuario');
    }
  }

  return (
    <div>
      <h2>Usuarios del sistema</h2>
      <p className="hint">
        Como administrador podés crear logins para tus colaboradores. Un <strong>colaborador (empleado)</strong> solo
        ve las ventas del día de hoy y puede cargar mercadería; los reportes de días y semanas anteriores son
        exclusivos del <strong>administrador</strong>.
      </p>

      <form className="form-card" onSubmit={handleSubmit}>
        <h3>Crear nuevo usuario</h3>
        {mensaje && <div className="info-box">{mensaje}</div>}
        <div className="form-grid">
          <div>
            <label>Nombre *</label>
            <input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} required />
          </div>
          <div>
            <label>Email *</label>
            <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
          </div>
          <div>
            <label>Contraseña *</label>
            <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength={6} />
          </div>
          <div>
            <label>Rol</label>
            <select value={form.rol} onChange={(e) => setForm({ ...form, rol: e.target.value })}>
              <option value="empleado">Colaborador (ve solo el día de hoy)</option>
              <option value="admin">Administrador (ve todo, incluidos reportes históricos)</option>
            </select>
          </div>
        </div>
        <div className="form-actions">
          <button type="submit">Crear usuario</button>
        </div>
      </form>

      {creados.length > 0 && (
        <table className="tabla">
          <thead><tr><th>Nombre</th><th>Email</th><th>Rol</th></tr></thead>
          <tbody>
            {creados.map((u) => (
              <tr key={u.id}>
                <td>{u.nombre}</td>
                <td>{u.email}</td>
                <td>{u.rol === 'admin' ? 'Administrador' : 'Colaborador'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
