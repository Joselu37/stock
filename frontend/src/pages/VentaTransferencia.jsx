import PantallaVenta from '../components/PantallaVenta.jsx';

export default function VentaTransferencia() {
  return <PantallaVenta tipoPago="transferencia" titulo="🏦 Venta por Transferencia" requiereCliente={false} />;
}
