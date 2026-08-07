const cron = require('node-cron');
const pool = require('../db');
const { enviarEmailAlerta } = require('../utils/mailer');

// Revisa clientes con saldo pendiente y ventas fiadas sin pagar hace mas de X dias.
async function verificarFiadosVencidos(io) {
  const dias = Number(process.env.FIADO_ALERT_DIAS) || 7;
  const { rows: ventasVencidas } = await pool.query(
    `SELECT v.id, v.total, v.fecha, c.id AS cliente_id, c.nombre AS cliente_nombre, c.saldo_adeudado
     FROM ventas v
     JOIN clientes c ON c.id = v.cliente_id
     WHERE v.tipo_pago = 'fiado' AND v.pagado = FALSE
       AND v.fecha <= NOW() - ($1 || ' days')::interval
     ORDER BY v.fecha ASC`,
    [dias]
  );

  const alertasGeneradas = [];

  if (ventasVencidas.length > 0) {
    // Agrupar por cliente
    const porCliente = {};
    for (const v of ventasVencidas) {
      if (!porCliente[v.cliente_id]) porCliente[v.cliente_id] = { nombre: v.cliente_nombre, saldo: v.saldo_adeudado, ventas: [] };
      porCliente[v.cliente_id].ventas.push(v);
    }

    let mensajeHtml = `<h2>Alerta semanal de fiados pendientes</h2><ul>`;
    for (const clienteId of Object.keys(porCliente)) {
      const info = porCliente[clienteId];
      const mensaje = `Cliente "${info.nombre}" tiene ${info.ventas.length} venta(s) fiada(s) sin pagar (hace más de ${dias} días). Saldo total adeudado: $${info.saldo}`;
      const { rows } = await pool.query(
        'INSERT INTO alertas (tipo, mensaje) VALUES ($1,$2) RETURNING *',
        ['fiado_vencido', mensaje]
      );
      alertasGeneradas.push(rows[0]);
      mensajeHtml += `<li>${mensaje}</li>`;

      if (io) io.emit('alerta:nueva', rows[0]);
    }
    mensajeHtml += '</ul>';

    await enviarEmailAlerta('Alerta semanal: fiados pendientes de pago', mensajeHtml);
  }

  return alertasGeneradas;
}

function iniciarCronFiados(io) {
  const expresion = process.env.FIADO_ALERT_CRON || '0 8 * * 1'; // Lunes 08:00
  cron.schedule(expresion, () => {
    console.log('Ejecutando verificacion semanal de fiados vencidos...');
    verificarFiadosVencidos(io).catch((err) => console.error('Error en cron de fiados:', err));
  });
  console.log(`Cron de alertas de fiado programado: "${expresion}"`);
}

module.exports = { verificarFiadosVencidos, iniciarCronFiados };
