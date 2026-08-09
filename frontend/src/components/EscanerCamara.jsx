import { useEffect, useRef, useState } from 'react';
import { BrowserMultiFormatReader } from '@zxing/browser';

/**
 * Botón + visor que usa la cámara del dispositivo (celular o notebook con webcam)
 * para leer códigos de barras. Complementa a BarcodeScanner.jsx, que sirve para
 * lectores físicos tipo pistola. Requiere HTTPS (ya lo tenemos en producción)
 * y que el usuario acepte el permiso de cámara la primera vez.
 */
export default function EscanerCamara({ onScan }) {
  const [abierto, setAbierto] = useState(false);
  const [error, setError] = useState('');
  const videoRef = useRef(null);
  const controlsRef = useRef(null);

  useEffect(() => {
    if (!abierto) return;
    setError('');
    let cancelado = false;
    const codeReader = new BrowserMultiFormatReader();

    codeReader
      .decodeFromConstraints(
        { video: { facingMode: 'environment' } }, // preferir la camara trasera en celulares
        videoRef.current,
        (resultado, err, controls) => {
          if (cancelado) return;
          controlsRef.current = controls;
          if (resultado) {
            onScan(resultado.getText());
            controls.stop();
            setAbierto(false);
          }
        }
      )
      .catch((err) => {
        console.error(err);
        setError('No se pudo acceder a la cámara. Revisá que le hayas dado permiso al navegador.');
      });

    return () => {
      cancelado = true;
      controlsRef.current?.stop();
    };
  }, [abierto, onScan]);

  return (
    <>
      <button type="button" className="boton-camara" onClick={() => setAbierto(true)}>
        📷 Escanear con la cámara
      </button>

      {abierto && (
        <div className="popup-overlay" onClick={() => setAbierto(false)}>
          <div className="popup" onClick={(e) => e.stopPropagation()}>
            <h3>Apuntá la cámara al código de barras</h3>
            {error && <div className="error-box">{error}</div>}
            <video ref={videoRef} className="video-camara" muted playsInline />
            <p className="hint">Mantené el código dentro del recuadro, bien iluminado.</p>
            <div className="form-actions">
              <button type="button" onClick={() => setAbierto(false)}>Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
