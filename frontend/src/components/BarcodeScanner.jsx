import { useEffect, useRef } from 'react';

/**
 * Componente invisible que captura la entrada de un lector de codigo de barras.
 * La mayoria de los lectores funcionan como teclados: escriben los caracteres muy
 * rapido y terminan con Enter. Este componente detecta ese patron y llama a onScan.
 */
export default function BarcodeScanner({ onScan, activo = true }) {
  const bufferRef = useRef('');
  const ultimaTeclaRef = useRef(0);

  useEffect(() => {
    if (!activo) return;

    function handleKeyDown(e) {
      const activeTag = document.activeElement?.tagName;
      // Evita interferir si el usuario esta escribiendo en un input de texto libre
      if (activeTag === 'TEXTAREA') return;

      const ahora = Date.now();
      if (ahora - ultimaTeclaRef.current > 80) {
        bufferRef.current = '';
      }
      ultimaTeclaRef.current = ahora;

      if (e.key === 'Enter') {
        if (bufferRef.current.length >= 3) {
          onScan(bufferRef.current);
        }
        bufferRef.current = '';
      } else if (e.key.length === 1) {
        bufferRef.current += e.key;
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onScan, activo]);

  return null;
}
