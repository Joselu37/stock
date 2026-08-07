import { useEffect, useState } from 'react';
import api from '../api';
import { conectarSocket } from '../socket';

export default function Dashboard() {
  const [resumen, setResumen] = useState(null);
  const [cargando, setCargando] = useState(true);

  async function cargar() {
    try {
      const { data } = await api.get('/stock/resumen');
      setResumen(data);
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    cargar();
    const socket = conectarSocket();
    if (!socket) return;
    const refrescar = () => cargar();
    socket.on('stock:cambio', refrescar);
    socket.on('venta:creada', refrescar);
    socket.on('producto:creado', refrescar);
    socket.on('producto:actualizado', refrescar);
    return () => {
      socket.off('stock:cambio', refrescar);
      socket.off('venta:creada', refrescar);
      socket.off('producto:creado', refrescar);
      socket.off('producto:actualizado', refrescar);
    };
  }, []);

  if (cargando) return <p>Cargando panel de control...</p>;
  if (!resumen) return <p>No se pudo cargar el resumen.</p>;

  return (
    <div>
      <h2>Panel de Control</h2>
      <div className="cards-grid">
        <div className="stat-card">
          <span className="stat-label">Productos activos</span>
          <span className="stat-value">{resumen.total_productos}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Ventas de hoy</span>
          <span className="stat-value">{resumen.ventas_hoy.cantidad}</span>
          <span className="stat-sub">${Number(resumen.ventas_hoy.total).toFixed(2)}</span>
        </div>
        <div className="stat-card alerta">
          <span className="stat-label">Total fiado adeudado</span>
          <span className="stat-value">${Number(resumen.deuda_total_fiado).toFixed(2)}</span>
        </div>
        <div className="stat-card alerta">
          <span className="stat-label">Productos con stock bajo</span>
          <span className="stat-value">{resumen.productos_stock_bajo.length}</span>
        </div>
      </div>

      <h3>Stock bajo (en tiempo real)</h3>
      <table className="tabla">
        <thead>
          <tr><th>Producto</th><th>Stock actual</th><th>Stock mínimo</th><th>Unidad</th></tr>
        </thead>
        <tbody>
          {resumen.productos_stock_bajo.map((p) => (
            <tr key={p.id}>
              <td>{p.nombre}</td>
              <td className="celda-alerta">{p.stock_actual}</td>
              <td>{p.stock_minimo}</td>
              <td>{p.unidad}</td>
            </tr>
          ))}
          {resumen.productos_stock_bajo.length === 0 && (
            <tr><td colSpan={4}>Todo el stock está en niveles normales.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
