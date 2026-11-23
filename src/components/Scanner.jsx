import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Flashlight, Keyboard, X } from "lucide-react";

/** GTIN mod-10 check digit (EAN-8/UPC-A/EAN-13/GTIN-14). */
export function gtinValid(code) {
  if (!/^\d{8}$|^\d{12,14}$/.test(code)) return false;
  const d = code.split("").map(Number);
  const check = d.pop();
  const sum = d.reverse().reduce((s, x, i) => s + x * (i % 2 === 0 ? 3 : 1), 0);
  return (10 - (sum % 10)) % 10 === check;
}

/**
 * Full-screen EAN/UPC scanner. html5-qrcode is loaded lazily (separate chunk) and uses the
 * native BarcodeDetector when the browser has it (much faster on Android/Chrome).
 * A code is accepted when its check digit is valid, or when the same code is read twice in a row.
 */
export function Scanner({ onDetected, onError, onClose, onManual }) {
  const handled = useRef(false);
  const [torch, setTorch] = useState(null); // null = unsupported, false/true = state
  const scannerRef = useRef(null);

  useEffect(() => {
    let active = true;
    let startPromise = null;
    let lastCode = null;
    (async () => {
      try {
        const { Html5Qrcode, Html5QrcodeSupportedFormats: F } = await import("html5-qrcode");
        if (!active) return;
        const scanner = new Html5Qrcode("food-barcode-reader", {
          verbose: false,
          formatsToSupport: [F.EAN_13, F.EAN_8, F.UPC_A, F.UPC_E],
          experimentalFeatures: { useBarCodeDetectorIfSupported: true }
        });
        scannerRef.current = scanner;
        startPromise = scanner.start(
          { facingMode: "environment" },
          {
            fps: 15,
            qrbox: (w, h) => ({ width: Math.round(Math.min(w * 0.85, 360)), height: Math.round(Math.min(h * 0.4, 170)) }),
            aspectRatio: 1.333,
            videoConstraints: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 }, advanced: [{ focusMode: "continuous" }] }
          },
          decoded => {
            if (!active || handled.current) return;
            const code = String(decoded).replace(/\D/g, "");
            const ok = gtinValid(code) || (code.length >= 8 && code === lastCode);
            lastCode = code;
            if (!ok) return;
            handled.current = true;
            if (navigator.vibrate) navigator.vibrate(80);
            onDetected(code);
          },
          () => {}
        );
        await startPromise;
        if (!active) return;
        try {
          const caps = scanner.getRunningTrackCameraCapabilities?.();
          if (caps?.torchFeature?.().isSupported()) setTorch(false);
        } catch { /* torch not available */ }
      } catch (err) {
        if (!active) return;
        const msg = String(err?.message || err || "");
        onError(/NotAllowed|Permission/i.test(msg)
          ? "Brak dostępu do aparatu. Zezwól na użycie kamery w ustawieniach przeglądarki albo wpisz kod ręcznie."
          : /NotFound|Requested device not found/i.test(msg)
            ? "Nie znaleziono aparatu w tym urządzeniu. Wpisz kod kreskowy ręcznie."
            : "Nie udało się uruchomić aparatu. Spróbuj ponownie albo wpisz kod ręcznie.");
      }
    })();
    return () => {
      active = false;
      const s = scannerRef.current;
      // Stop the camera even if start() is still pending.
      Promise.resolve(startPromise).catch(() => {}).then(() => { if (s?.isScanning) return s.stop(); }).then(() => s?.clear?.()).catch(() => {});
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleTorch = async () => {
    try {
      const t = scannerRef.current?.getRunningTrackCameraCapabilities?.().torchFeature();
      await t.apply(!torch);
      setTorch(!torch);
    } catch { setTorch(null); }
  };

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
      <p className="scanner-hint">Ustaw kod kreskowy poziomo w ramce, ok. 15–20 cm od aparatu. Odczyt nastąpi automatycznie.</p>
      <div className="scanner-actions">
        {torch !== null && <button type="button" className="secondary" onClick={toggleTorch}><Flashlight size={18} /> {torch ? "Wyłącz latarkę" : "Latarka"}</button>}
        {onManual && <button type="button" className="secondary" onClick={onManual}><Keyboard size={18} /> Wpisz kod ręcznie</button>}
      </div>
    </div>,
    document.body
  );
}
