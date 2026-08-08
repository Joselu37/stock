import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, NavLink, useNavigate } from 'react-router-dom';
import { conectarSocket, desconectarSocket, getSocket } from './socket';

import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Productos from './pages/Productos.jsx';
import Ventas from './pages/Ventas.jsx';
import Clientes from './pages/Clientes.jsx';
import Alertas from './pages/Alertas.jsx';

function RutaPrivada({ children }) {
  const token = localStorage.getItem('token');
  if (!token) return <Navigate to="/login" replace />;
  return children;
}

function Layout({ children }) {
  const navigate = useNavigate();
  const [alertasNoLeidas, setAlertasNoLeidas] = useState(0);
  const usuario = JSON.parse(localStorage.getItem('usuario') || 'null');

  useEffect(() => {
    const socket = conectarSocket();
    if (!socket) return;
    socket.on('alerta:nueva', () => setAlertasNoLeidas((n) => n + 1));
    return () => socket.off('alerta:nueva');
  }, []);

  function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('usuario');
    desconectarSocket();
    navigate('/login');
  }

  return (
    <div className="layout">
      <aside className="sidebar">
        <h1 className="logo">🥩 Carnicería</h1>
        <nav>
          <NavLink to="/" end>Panel de Control</NavLink>
          <NavLink to="/productos">Productos</NavLink>
          <NavLink to="/ventas">Ventas</NavLink>
          <NavLink to="/clientes">Clientes</NavLink>
          <NavLink to="/alertas">
            Alertas {alertasNoLeidas > 0 && <span className="badge">{alertasNoLeidas}</span>}
          </NavLink>
        </nav>
        <div className="user-box">
          <span>{usuario?.nombre}</span>
          <button onClick={logout}>Salir</button>
        </div>
      </aside>
      <main className="content">{children}</main>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/*"
          element={
            <RutaPrivada>
              <Layout>
                <Routes>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/productos" element={<Productos />} />
                  <Route path="/ventas" element={<Ventas />} />
                  <Route path="/clientes" element={<Clientes />} />
                  <Route path="/alertas" element={<Alertas />} />
                </Routes>
              </Layout>
            </RutaPrivada>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}
