import { useState } from 'react';
import api from '../api';

export default function MiCuenta() {
  const [passwordActual, setPasswordActual] = useState('');
  const [passwordNueva, setPasswordNueva] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState('');
  const usuario = JSON.parse(localStorage.getItem('usuario') || 'null');

  async function handleSubmit(e) {
    e.preventDefault();
    setMensaje('');
    setError('');
    if (passwordNueva !== confirmar) {
      setError('La confirmación no coincide con la contraseña nueva.');
      return;
    }
    try {
      await api.put('/auth/password', { passwordActual, passwordNueva });
      setMensaje('Contraseña actualizada correctamente.');
      setPasswordActual('');
      setPasswordNueva('');
      setConfirmar('');
    } catch (err) {
      setError(err.response?.data?.error || 'Error al cambiar la contraseña');
    }
  }

  return (
    <div>
      <h2>Mi cuenta</h2>
      <p className="hint">Sesión iniciada como <strong>{usuario?.nombre}</strong> ({usuario?.email}) — {usuario?.rol === 'admin' ? 'Administrador' : 'Colaborador'}</p>

      <form className="form-card" onSubmit={handleSubmit}>
        <h3>Cambiar contraseña</h3>
        {mensaje && <div className="info-box">{mensaje}</div>}
        {error && <div className="error-box">{error}</div>}
        <div className="form-grid">
          <div>
            <label>Contraseña actual</label>
            <input type="password" value={passwordActual} onChange={(e) => setPasswordActual(e.target.value)} required />
          </div>
          <div>
            <label>Contraseña nueva</label>
            <input type="password" value={passwordNueva} onChange={(e) => setPasswordNueva(e.target.value)} required minLength={6} />
          </div>
          <div>
            <label>Repetir contraseña nueva</label>
            <input type="password" value={confirmar} onChange={(e) => setConfirmar(e.target.value)} required minLength={6} />
          </div>
        </div>
        <div className="form-actions">
          <button type="submit">Guardar contraseña nueva</button>
        </div>
      </form>
    </div>
  );
}
