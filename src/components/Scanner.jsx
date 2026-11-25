import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Camera, Flashlight, Keyboard, X } from "lucide-react";

/** GTIN mod-10 check digit (EAN-8/UPC-A/EAN-13/GTIN-14). */
export function gtinValid(code) {
  if (!/^\d{8}$|^\d{12,14}$/.test(code)) return false;
  const d = code.split("").map(Number);
  const check = d.pop();
  const sum = d.reverse().reduce((s, x, i) => s + x * (i % 2 === 0 ? 3 : 1), 0);
  return (10 - (sum % 10)) % 10 === check;
}

const NATIVE_FORMATS = ["ean_13", "ean_8", "upc_a", "upc_e"];

/** Native BarcodeDetector (Android Chrome) if it supports EAN; otherwise null. */
async function nativeDetector() {
  try {
    if (!("BarcodeDetector" in window)) return null;
    const supported = await window.BarcodeDetector.getSupportedFormats?.();
    const formats = NATIVE_FORMATS.filter(f => !supported || supported.includes(f));
    if (!formats.length) return null;
    return new window.BarcodeDetector({ formats });
  } catch { return null; }
}

/** ZXing (pure JS) reader limited to retail 1D codes – works on iOS Safari / Firefox. */
async function zxingReader() {
  const [{ BrowserMultiFormatReader }, { BarcodeFormat, DecodeHintType }] = await Promise.all([
    import("@zxing/browser"),
    import("@zxing/library")
  ]);
  const hints = new Map();
  hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.UPC_A, BarcodeFormat.UPC_E]);
  hints.set(DecodeHintType.TRY_HARDER, true);
  return new BrowserMultiFormatReader(hints);
}

/** Decode one frame (canvas) – returns digits or null. */
async function decodeCanvas(canvas, native, getZxing) {
  if (native) {
    try {
      const found = await native.detect(canvas);
      if (found?.[0]?.rawValue) return found[0].rawValue;
    } catch { /* fall through to zxing */ }
  }
  try {
    const reader = await getZxing();
    return reader.decodeFromCanvas(canvas).getText();
  } catch { return null; }
}

/**
 * Full-screen EAN/UPC scanner. Own camera loop: grabs the central band of the frame
 * (where the on-screen frame is) plus the full frame alternately, so the code is found
 * no matter how the video is cropped by CSS. A code is accepted when its check digit is valid,
 * or when the same code is read twice in a row.
 */
export function Scanner({ onDetected, onError, onClose, onManual }) {
  const videoRef = useRef(null);
  const trackRef = useRef(null);
  const handled = useRef(false);
  const lastCode = useRef(null);
  const nativeRef = useRef(null);
  const zxingRef = useRef(null);
  const [torch, setTorch] = useState(null); // null = unsupported
  const [busy, setBusy] = useState(false);
  const [slowHint, setSlowHint] = useState(false);

  const getZxing = async () => (zxingRef.current ||= zxingReader());

  const accept = raw => {
    if (handled.current || !raw) return false;
    const code = String(raw).replace(/\D/g, "");
    const ok = gtinValid(code) || (code.length >= 8 && code === lastCode.current);
    lastCode.current = code;
    if (!ok) return false;
    handled.current = true;
    if (navigator.vibrate) navigator.vibrate(80);
    onDetected(code);
    return true;
  };

  useEffect(() => {
    let active = true;
    let stream = null;
    let timer = null;
    let frame = 0;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    const slow = setTimeout(() => active && setSlowHint(true), 12000);

    const tick = async () => {
      if (!active || handled.current) return;
      const v = videoRef.current;
      if (v && v.readyState >= 2 && v.videoWidth) {
        const vw = v.videoWidth, vh = v.videoHeight;
        // Odd frames: central horizontal band (better resolution for 1D codes); even: whole frame.
        const band = frame++ % 2 === 0;
        const sw = band ? Math.round(vw * 0.9) : vw;
        const sh = band ? Math.round(Math.min(vh, vw) * 0.45) : vh;
        const sx = Math.round((vw - sw) / 2), sy = Math.round((vh - sh) / 2);
        const scale = Math.min(1, 1280 / sw);
        canvas.width = Math.round(sw * scale);
        canvas.height = Math.round(sh * scale);
        ctx.drawImage(v, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
        const raw = await decodeCanvas(canvas, nativeRef.current, getZxing);
        if (accept(raw)) return;
      }
      if (active) timer = setTimeout(tick, nativeRef.current ? 120 : 60);
    };

    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error("NoMediaDevices");
        nativeRef.current = await nativeDetector();
        if (!nativeRef.current) getZxing().catch(() => {}); // preload
        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } }
        });
        if (!active) { stream.getTracks().forEach(t => t.stop()); return; }
        const track = stream.getVideoTracks()[0];
        trackRef.current = track;
        try {
          const caps = track.getCapabilities?.() || {};
          if (caps.focusMode?.includes("continuous")) await track.applyConstraints({ advanced: [{ focusMode: "continuous" }] });
          if (caps.torch) setTorch(false);
        } catch { /* optional features */ }
        const v = videoRef.current;
        v.srcObject = stream;
        await v.play().catch(() => {});
        tick();
      } catch (err) {
        if (!active) return;
        const msg = `${err?.name || ""} ${err?.message || err || ""}`;
        onError(/NotAllowed|Permission|Security/i.test(msg)
          ? "Brak dostępu do aparatu. Zezwól na użycie kamery w ustawieniach przeglądarki albo wpisz kod ręcznie."
          : /NotFound|OverConstrained|device not found/i.test(msg)
            ? "Nie znaleziono aparatu w tym urządzeniu. Wpisz kod kreskowy ręcznie."
            : "Nie udało się uruchomić aparatu. Spróbuj ponownie albo wpisz kod ręcznie.");
      }
    })();

    return () => {
      active = false;
      clearTimeout(timer);
      clearTimeout(slow);
      stream?.getTracks().forEach(t => t.stop());
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleTorch = async () => {
    try {
      await trackRef.current.applyConstraints({ advanced: [{ torch: !torch }] });
      setTorch(!torch);
    } catch { setTorch(null); }
  };

  /** Fallback: take a photo with the system camera app (sharp, autofocus) and decode it. */
  const onPhoto = async e => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    try {
      const bmp = await createImageBitmap(file);
      const canvas = document.createElement("canvas");
      const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
      canvas.width = Math.round(bmp.width * scale);
      canvas.height = Math.round(bmp.height * scale);
      canvas.getContext("2d").drawImage(bmp, 0, 0, canvas.width, canvas.height);
      const raw = await decodeCanvas(canvas, nativeRef.current, getZxing);
      const code = String(raw || "").replace(/\D/g, "");
      if (code.length >= 8) {
        handled.current = true;
        if (navigator.vibrate) navigator.vibrate(80);
        onDetected(code);
      } else {
        alert("Nie udało się odczytać kodu ze zdjęcia. Zrób zdjęcie bliżej, ostro i przy dobrym świetle albo wpisz kod ręcznie.");
      }
    } catch {
      alert("Nie udało się odczytać zdjęcia. Wpisz kod ręcznie.");
    } finally { setBusy(false); }
  };

  return createPortal(
    <div className="scanner-overlay" role="dialog" aria-modal="true" aria-label="Skaner kodów kreskowych">
      <div className="scanner-top">
        <b>Skanuj kod kreskowy</b>
        <button type="button" className="icon-btn" aria-label="Zamknij skaner" onClick={onClose}><X size={22} /></button>
      </div>
      <div className="scanner-view">
        <video ref={videoRef} className="scanner-video" playsInline muted autoPlay />
        <div className="scanner-frame" aria-hidden="true"><span /></div>
      </div>
      <p className="scanner-hint">
        {slowHint
          ? "Nie widzę kodu? Odsuń telefon na ok. 20 cm, włącz latarkę albo użyj „Zrób zdjęcie kodu”."
          : "Ustaw kod kreskowy poziomo w ramce, ok. 15–20 cm od aparatu. Odczyt nastąpi automatycznie."}
      </p>
      <div className="scanner-actions">
        {torch !== null && <button type="button" className="secondary" onClick={toggleTorch}><Flashlight size={18} /> {torch ? "Wyłącz latarkę" : "Latarka"}</button>}
        <label className="secondary button-like">
          <Camera size={18} /> {busy ? "Odczytuję…" : "Zrób zdjęcie kodu"}
          <input type="file" accept="image/*" capture="environment" hidden onChange={onPhoto} disabled={busy} />
        </label>
        {onManual && <button type="button" className="secondary" onClick={onManual}><Keyboard size={18} /> Wpisz kod ręcznie</button>}
      </div>
    </div>,
    document.body
  );
}
