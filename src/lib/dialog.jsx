import { useState, useEffect } from "react";

/* ── 独自ダイアログ（v5.19 / v5.21）──
   ブラウザ標準の confirm/alert/prompt はサイト名（nexua.tech の内容）が
   消せないため、アプリ内モーダルに置き換える。
   appConfirm(msg) → Promise<boolean>
   appAlert(msg)   → Promise<true>
   appPrompt(opts) → Promise<number|string|null>  （opts: { message, presets:[{label,value,danger}], inputLabel, unit, default, inputType:"number"|"text", sanitize:(raw:string)=>string }）
     ※ inputType:"text" 指定時は文字列をそのまま返す（数値変換・floor処理なし）。sanitizeは"text"時のみ、入力のたびに呼ばれる
   <DialogHost /> をアプリルートに1つ置くこと（未マウント時は標準にフォールバック） */

let _show = null;

export const appConfirm = (message) => new Promise((resolve) => {
  if (_show) _show({ message, confirm: true, resolve });
  else resolve(window.confirm(message)); // フォールバック
});

export const appAlert = (message) => new Promise((resolve) => {
  if (_show) _show({ message, confirm: false, resolve });
  else { window.alert(message); resolve(true); }
});

export const appPrompt = (opts) => new Promise((resolve) => {
  if (_show) _show({ ...opts, prompt: true, resolve });
  else {
    const v = window.prompt(opts.message, opts.default ?? "");
    if (v === null) { resolve(null); return; }
    resolve(opts.inputType === "text" ? v.trim() : (Number(v) || 0));
  }
});

export function DialogHost() {
  const [dlg, setDlg] = useState(null);
  const [input, setInput] = useState("");
  useEffect(() => {
    _show = (d) => { setInput(d.default ?? ""); setDlg(d); };
    return () => { _show = null; };
  }, []);
  useEffect(() => {
    if (!dlg) return;
    const onKey = (e) => {
      if (e.key === "Escape") { dlg.resolve(dlg.prompt ? null : false); setDlg(null); }
      if (e.key === "Enter" && !dlg.prompt) { dlg.resolve(true); setDlg(null); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dlg]);
  if (!dlg) return null;
  const close = (val) => { dlg.resolve(val); setDlg(null); };
  const submitInput = () => {
    if (dlg.inputType === "text") { close(input.trim()); return; }
    const n = Math.max(0, Math.floor(Number(input) || 0));
    close(n);
  };
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-6">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => close(dlg.prompt ? null : false)} />
      <div className="relative bg-white rounded-3xl shadow-2xl max-w-sm w-full p-6">
        <p className="text-[13px] text-neutral-700 leading-relaxed whitespace-pre-wrap">{dlg.message}</p>

        {dlg.prompt && (
          <div className="mt-4 space-y-3">
            {Array.isArray(dlg.presets) && dlg.presets.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {dlg.presets.map((p) => (
                  <button key={p.label} onClick={() => close(p.value)}
                    className={`px-3 py-2 rounded-xl text-xs font-bold border transition-colors ${
                      p.danger
                        ? 'bg-red-50 border-red-200 text-red-600 hover:bg-red-100'
                        : 'bg-neutral-100 border-neutral-200 text-neutral-700 hover:bg-neutral-200'}`}>
                    {p.label}
                  </button>
                ))}
              </div>
            )}
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-neutral-500 whitespace-nowrap">{dlg.inputLabel || "任意の値"}</span>
              <input
                type={dlg.inputType === "text" ? "text" : "number"}
                inputMode={dlg.inputType === "text" ? "text" : "numeric"}
                min={dlg.inputType === "text" ? undefined : 0}
                value={input} autoFocus
                onChange={(e) => setInput(dlg.inputType === "text" && dlg.sanitize ? dlg.sanitize(e.target.value) : e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") submitInput(); }}
                className="flex-1 w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:border-black text-sm text-center font-mono" />
              {dlg.unit && <span className="text-[11px] text-neutral-500">{dlg.unit}</span>}
            </div>
          </div>
        )}

        <div className="mt-5 flex justify-end gap-2">
          {(dlg.confirm || dlg.prompt) && (
            <button onClick={() => close(dlg.prompt ? null : false)}
              className="px-5 py-2.5 rounded-full text-xs font-bold bg-neutral-100 text-neutral-600 hover:bg-neutral-200 transition-colors">
              キャンセル
            </button>
          )}
          <button onClick={() => (dlg.prompt ? submitInput() : close(true))} autoFocus={!dlg.prompt}
            className="px-6 py-2.5 rounded-full text-xs font-bold bg-black text-white hover:bg-neutral-800 transition-colors">
            OK
          </button>
        </div>
      </div>
    </div>
  );
}
