import PantallaVenta from '../components/PantallaVenta.jsx';

export default function VentaFiado() {
  return <PantallaVenta tipoPago="fiado" titulo="📒 Venta Fiada" requiereCliente={true} />;
}
