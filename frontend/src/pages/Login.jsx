import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import { conectarSocket } from '../socket';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setCargando(true);
    try {
      const { data } = await api.post('/auth/login', { email, password });
      localStorage.setItem('token', data.token);
      localStorage.setItem('usuario', JSON.stringify(data.usuario));
      conectarSocket();
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || 'Error al iniciar sesion');
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="login-page">
      <form className="login-card" onSubmit={handleSubmit}>
        <h1>🥩 2HERMANOS</h1>
        <p className="subtitle">Iniciá sesión para continuar</p>
        {error && <div className="error-box">{error}</div>}
        <label>Email</label>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <label>Contraseña</label>
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        <button type="submit" disabled={cargando}>{cargando ? 'Ingresando...' : 'Ingresar'}</button>
      </form>
    </div>
  );
}
