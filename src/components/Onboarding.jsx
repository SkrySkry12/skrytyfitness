import React, { useState } from "react";
import { Activity, ArrowLeft, ArrowRight, Bell, Check, Palette, Target } from "lucide-react";
import { GoalFields, TdeeCalculator } from "./GoalsForm.jsx";
import { Spinner } from "./Spinner.jsx";

/** First-run wizard shown when the account has no saved settings yet. */
export function Onboarding({ user, initial, onFinish }) {
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState(initial);
  const [saving, setSaving] = useState(false);
  const patch = p => setDraft(d => ({ ...d, ...p }));
  const steps = [
    { icon: Target, title: "Twoje cele", text: "Ustal punkt startowy i cel. Wartości zmienisz w każdej chwili w ustawieniach." },
    { icon: Activity, title: "Kalorie i makro", text: "Nie wiesz ile kalorii? Skorzystaj z kalkulatora poniżej." },
    { icon: Palette, title: "Wygląd", text: "Wybierz kolor przewodni aplikacji." },
    { icon: Bell, title: "Przypomnienia", text: "Aplikacja może przypominać o posiłkach według Twojego harmonogramu." }
  ];
  const current = steps[step];
  const last = step === steps.length - 1;

  const finish = async (skip = false) => {
    setSaving(true);
    try { await onFinish(skip ? { ...initial, onboarded: true } : { ...draft, onboarded: true }); }
    finally { setSaving(false); }
  };

  return (
    <div className={`onboarding theme-${draft.theme}`}>
      <div className="onboarding-card">
        <div className="onboarding-progress">{steps.map((_, i) => <span key={i} className={i <= step ? "on" : ""} />)}</div>
        <div className="onboarding-icon"><current.icon size={26} /></div>
        <p className="eyebrow">KROK {step + 1} Z {steps.length} · CZEŚĆ, {String(user.username).toUpperCase()}</p>
        <h1>{current.title}</h1>
        <p className="muted">{current.text}</p>

        {step === 0 && <GoalFields compact value={draft} onChange={patch} />}
        {step === 1 && (
          <>
            <GoalFields value={draft} onChange={patch} />
            <TdeeCalculator weight={draft.startWeight} onApply={kcal => patch({ kcalTarget: kcal })} />
          </>
        )}
        {step === 2 && (
          <div className="theme-picker">
            {[["blue", "Niebieski"], ["pink", "Różowy"]].map(([id, label]) => (
              <button key={id} type="button" className={`theme-option theme-${id}` + (draft.theme === id ? " active" : "")} onClick={() => patch({ theme: id })}>
                <span className="theme-swatch" /> {label} {draft.theme === id && <Check size={16} />}
              </button>
            ))}
          </div>
        )}
        {step === 3 && (
          <label className="switch-row">
            <input type="checkbox" checked={draft.remindersEnabled !== false} onChange={e => patch({ remindersEnabled: e.target.checked })} />
            <span>Włącz przypomnienia o posiłkach (godziny ustawisz w zakładce Ustawienia)</span>
          </label>
        )}

        <div className="onboarding-actions">
          {step > 0
            ? <button type="button" className="ghost" onClick={() => setStep(s => s - 1)}><ArrowLeft size={16} /> Wstecz</button>
            : <button type="button" className="ghost" onClick={() => finish(true)} disabled={saving}>Pomiń</button>}
          {last
            ? <button type="button" className="primary" onClick={() => finish(false)} disabled={saving}>{saving ? <Spinner /> : <Check size={16} />} Zaczynamy</button>
            : <button type="button" className="primary" onClick={() => setStep(s => s + 1)}>Dalej <ArrowRight size={16} /></button>}
        </div>
      </div>
    </div>
  );
}
