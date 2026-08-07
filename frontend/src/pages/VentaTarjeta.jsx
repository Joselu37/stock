import PantallaVenta from '../components/PantallaVenta.jsx';

export default function VentaTarjeta() {
  return <PantallaVenta tipoPago="tarjeta" titulo="💳 Venta con Tarjeta" requiereCliente={false} />;
}
