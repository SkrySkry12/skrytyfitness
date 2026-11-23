import React, { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

/** Full-screen barcode scanner; html5-qrcode is loaded lazily (separate chunk). */
export function Scanner({ onDetected, onError, onClose }) {
  const handled = useRef(false);

  useEffect(() => {
    let scanner = null;
    let active = true;
    (async () => {
      try {
        const { Html5Qrcode } = await import("html5-qrcode");
        if (!active) return;
        scanner = new Html5Qrcode("food-barcode-reader");
        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 250, height: 150 } },
          decoded => {
            if (!active || handled.current) return;
            handled.current = true;
            if (navigator.vibrate) navigator.vibrate(80);
            onDetected(decoded);
          },
          () => {}
        );
      } catch {
        if (active) onError("Nie udało się uruchomić aparatu. Zezwól na dostęp do kamery albo wpisz kod ręcznie.");
      }
    })();
    return () => {
      active = false;
      if (scanner?.isScanning) scanner.stop().catch(() => {});
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return createPortal(
    <div className="scanner-overlay" role="dialog" aria-modal="true" aria-label="Skaner kodów kreskowych">
      <div className="scanner-top">
        <b>Skanuj kod kreskowy</b>
        <button type="button" className="icon-btn" aria-label="Zamknij skaner" onClick={onClose}><X size={22} /></button>
      </div>
      <div className="scanner-view">
        <div id="food-barcode-reader" />
        <div className="scanner-frame" aria-hidden="true"><span /></div>
      </div>
      <p className="scanner-hint">Ustaw kod kreskowy w ramce. Skaner korzysta z aparatu urządzenia.</p>
    </div>,
    document.body
  );
}
