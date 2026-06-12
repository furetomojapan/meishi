import { useState, useEffect } from "react";

/* ── 独自ダイアログ（v5.19） ──
   ブラウザ標準の confirm/alert はサイト名（furetomojapan.github.io の内容）が
   消せないため、アプリ内モーダルに置き換える。
   appConfirm(msg) → Promise<boolean> / appAlert(msg) → Promise<true>
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

export function DialogHost() {
  const [dlg, setDlg] = useState(null);
  useEffect(() => {
    _show = (d) => setDlg(d);
    return () => { _show = null; };
  }, []);
  useEffect(() => {
    if (!dlg) return;
    const onKey = (e) => {
      if (e.key === "Escape") { dlg.resolve(false); setDlg(null); }
      if (e.key === "Enter")  { dlg.resolve(true);  setDlg(null); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dlg]);
  if (!dlg) return null;
  const close = (val) => { dlg.resolve(val); setDlg(null); };
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-6">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => close(false)} />
      <div className="relative bg-white rounded-3xl shadow-2xl max-w-sm w-full p-6">
        <p className="text-[13px] text-neutral-700 leading-relaxed whitespace-pre-wrap">{dlg.message}</p>
        <div className="mt-5 flex justify-end gap-2">
          {dlg.confirm && (
            <button onClick={() => close(false)}
              className="px-5 py-2.5 rounded-full text-xs font-bold bg-neutral-100 text-neutral-600 hover:bg-neutral-200 transition-colors">
              キャンセル
            </button>
          )}
          <button onClick={() => close(true)} autoFocus
            className="px-6 py-2.5 rounded-full text-xs font-bold bg-black text-white hover:bg-neutral-800 transition-colors">
            OK
          </button>
        </div>
      </div>
    </div>
  );
}
