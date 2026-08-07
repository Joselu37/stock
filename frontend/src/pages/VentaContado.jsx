import PantallaVenta from '../components/PantallaVenta.jsx';

export default function VentaContado() {
  return <PantallaVenta tipoPago="contado" titulo="💵 Venta al Contado" requiereCliente={false} />;
}
