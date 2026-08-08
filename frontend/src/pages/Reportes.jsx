import { useEffect, useState, useCallback } from 'react';
import api from '../api';

const ETIQUETAS_TIPO = { contado: 'Efectivo', transferencia: 'Transferencia', tarjeta: 'Tarjeta', fiado: 'Fiado', mixto: 'Mixto' };
const ETIQUETAS_AGRUPAR = { dia: 'Por día', semana: 'Por semana', mes: 'Por mes' };
const ETIQUETAS_CAT = { despensa: '🛒 Despensa', carniceria: '🥩 Carnicería' };

function formatearPeriodo(periodo, agrupar) {
  const f = new Date(periodo);
  if (agrupar === 'mes') return f.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });
  if (agrupar === 'semana') return `Semana del ${f.toLocaleDateString('es-AR')}`;
  return f.toLocaleDateString('es-AR', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' });
}

export default function Reportes() {
  const [agrupar, setAgrupar] = useState('dia');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [resumen, setResumen] = useState({ periodos: [], porCategoria: [], porTipoPago: [] });
  const [detalle, setDetalle] = useState([]);
  const [periodoSeleccionado, setPeriodoSeleccionado] = useState(null);
  const [cargando, setCargando] = useState(false);

  const cargarResumen = useCallback(async () => {
    setCargando(true);
    try {
      const params = { agrupar };
      if (desde) params.desde = desde;
      if (hasta) params.hasta = hasta;
      const { data } = await api.get('/ventas/resumen', { params });
      setResumen(data);
    } finally {
      setCargando(false);
    }
  }, [agrupar, desde, hasta]);

  useEffect(() => { cargarResumen(); }, [cargarResumen]);

  useEffect(() => {
    // Trae el detalle de ventas del rango elegido (o todo si no hay filtro) para "qué se vendió y cuándo"
    const params = {};
    if (desde) params.desde = desde;
    if (hasta) params.hasta = hasta;
    api.get('/ventas', { params }).then(({ data }) => setDetalle(data));
  }, [desde, hasta]);

  const totalGeneral = resumen.periodos.reduce((acc, p) => acc + Number(p.total), 0);
  const ventasGeneral = resumen.periodos.reduce((acc, p) => acc + Number(p.cantidad_ventas), 0);

  function categoriasDePeriodo(periodo) {
    return resumen.porCategoria.filter((c) => c.periodo === periodo);
  }

  function tiposPagoDePeriodo(periodo) {
    return resumen.porTipoPago.filter((t) => t.periodo === periodo);
  }

  return (
    <div>
      <h2>Reportes de ventas</h2>
      <p className="hint">Consultá cuánto se vendió y cuándo, agrupado por día, semana o mes, y filtrá por rango de fechas.</p>

      <div className="form-card">
        <div className="form-grid">
          <div>
            <label>Agrupar por</label>
            <select value={agrupar} onChange={(e) => setAgrupar(e.target.value)}>
              <option value="dia">Día</option>
              <option value="semana">Semana</option>
              <option value="mes">Mes</option>
            </select>
          </div>
          <div>
            <label>Desde</label>
            <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
          </div>
          <div>
            <label>Hasta</label>
            <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
          </div>
        </div>
      </div>

      <div className="cards-grid">
        <div className="stat-card">
          <span className="stat-label">Total vendido {desde || hasta ? 'en el rango' : '(últimos períodos)'}</span>
          <span className="stat-value">${totalGeneral.toFixed(2)}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Cantidad de ventas</span>
          <span className="stat-value">{ventasGeneral}</span>
        </div>
      </div>

      <h3>{ETIQUETAS_AGRUPAR[agrupar]}</h3>
      {cargando && <p className="hint">Cargando...</p>}
      <table className="tabla">
        <thead><tr><th>Período</th><th>Cant. de ventas</th><th>Total</th><th>Por medio de pago</th><th>Por rubro</th><th></th></tr></thead>
        <tbody>
          {resumen.periodos.map((p) => (
            <tr key={p.periodo}>
              <td>{formatearPeriodo(p.periodo, agrupar)}</td>
              <td>{p.cantidad_ventas}</td>
              <td>${Number(p.total).toFixed(2)}</td>
              <td>
                {tiposPagoDePeriodo(p.periodo).map((t) => (
                  <div key={t.tipo_pago}>{ETIQUETAS_TIPO[t.tipo_pago] || t.tipo_pago}: ${Number(t.total).toFixed(2)}</div>
                ))}
              </td>
              <td>
                {categoriasDePeriodo(p.periodo).map((c) => (
                  <div key={c.categoria}>{ETIQUETAS_CAT[c.categoria] || c.categoria}: ${Number(c.total).toFixed(2)}</div>
                ))}
              </td>
              <td>
                <button onClick={() => setPeriodoSeleccionado(periodoSeleccionado === p.periodo ? null : p.periodo)}>
                  {periodoSeleccionado === p.periodo ? 'Ocultar ventas' : 'Ver ventas'}
                </button>
              </td>
            </tr>
          ))}
          {resumen.periodos.length === 0 && !cargando && <tr><td colSpan={6}>No hay ventas registradas en este rango.</td></tr>}
        </tbody>
      </table>

      {periodoSeleccionado && (
        <div>
          <h3>Ventas del período seleccionado</h3>
          <table className="tabla">
            <thead><tr><th>#</th><th>Fecha</th><th>Cliente</th><th>Medio de pago</th><th>Total</th></tr></thead>
            <tbody>
              {detalle
                .filter((v) => {
                  const inicio = new Date(periodoSeleccionado);
                  const fin = new Date(inicio);
                  if (agrupar === 'dia') fin.setDate(fin.getDate() + 1);
                  else if (agrupar === 'semana') fin.setDate(fin.getDate() + 7);
                  else fin.setMonth(fin.getMonth() + 1);
                  const f = new Date(v.fecha);
                  return f >= inicio && f < fin;
                })
                .map((v) => (
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
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}

      <h3>Todas las ventas del rango elegido</h3>
      <table className="tabla">
        <thead><tr><th>#</th><th>Fecha</th><th>Cliente</th><th>Medio de pago</th><th>Total</th></tr></thead>
        <tbody>
          {detalle.map((v) => (
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
            </tr>
          ))}
          {detalle.length === 0 && <tr><td colSpan={5}>Sin ventas en este rango.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
