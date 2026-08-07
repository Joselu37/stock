import { useEffect, useState, useCallback } from 'react';
import api from '../api';
import { conectarSocket } from '../socket';

export default function Alertas() {
  const [alertas, setAlertas] = useState([]);

  const cargar = useCallback(async () => {
    const { data } = await api.get('/alertas');
    setAlertas(data);
  }, []);

  useEffect(() => {
    cargar();
    const socket = conectarSocket();
    if (!socket) return;
    const refrescar = () => cargar();
    socket.on('alerta:nueva', refrescar);
    return () => socket.off('alerta:nueva', refrescar);
  }, [cargar]);

  async function marcarLeida(id) {
    await api.put(`/alertas/${id}/leida`);
    cargar();
  }

  async function verificarAhora() {
    await api.post('/alertas/verificar-fiados');
    cargar();
  }

  return (
    <div>
      <h2>Alertas</h2>
      <p className="hint">Se verifica automáticamente cada semana si hay ventas fiadas sin pagar. También podés forzar la verificación manualmente.</p>
      <button onClick={verificarAhora}>Verificar fiados vencidos ahora</button>

      <table className="tabla" style={{ marginTop: '1rem' }}>
        <thead><tr><th>Tipo</th><th>Mensaje</th><th>Fecha</th><th>Estado</th><th></th></tr></thead>
        <tbody>
          {alertas.map((a) => (
            <tr key={a.id} className={!a.leida ? 'fila-alerta' : ''}>
              <td>{a.tipo}</td>
              <td>{a.mensaje}</td>
              <td>{new Date(a.creado_en).toLocaleString()}</td>
              <td>{a.leida ? 'Leída' : 'Pendiente'}</td>
              <td>{!a.leida && <button onClick={() => marcarLeida(a.id)}>Marcar leída</button>}</td>
            </tr>
          ))}
          {alertas.length === 0 && <tr><td colSpan={5}>No hay alertas registradas.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
