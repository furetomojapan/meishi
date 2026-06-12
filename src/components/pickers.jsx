import { useState } from "react";
import React from "react";
import { TINT_OPTIONS, FONT_OPTIONS, THEME_OPTIONS, FREE_THEME_KEYS, copyText, getSNS } from "../lib/core";

      export function BgPicker({ selected, onSelect }) {
        return (
          <div className="flex gap-2 flex-wrap">
            {[1,2,3,4,5,6,7,8,9,10].map(n => {
              const active = selected === String(n);
              return (
                <button key={n} type="button" onClick={() => onSelect(String(n))}
                  style={{width:"52px",height:"32px",borderRadius:"8px",overflow:"hidden",
                          backgroundImage:`url(hai${n}.png)`,backgroundSize:"cover",backgroundPosition:"center",
                          backgroundColor:"#888",cursor:"pointer",position:"relative",flexShrink:0,
                          border:active?"2.5px solid #000":"2.5px solid transparent",
                          boxShadow:active?"0 0 0 1px #000":"0 1px 3px rgba(0,0,0,0.18)"}}>
                  {active && <div style={{position:"absolute",inset:0,background:"rgba(0,0,0,0.28)",
                                          display:"flex",alignItems:"center",justifyContent:"center",
                                          color:"white",fontSize:"11px",fontWeight:"bold"}}>✓</div>}
                </button>
              );
            })}
          </div>
        );
      }

      /* ── カラーピッカー ── */
      export function TintPicker({ selected, onSelect }) {
        return (
          <div className="flex gap-2 flex-wrap">
            {TINT_OPTIONS.map(opt => {
              const active = selected === opt.value;
              return (
                <button key={opt.label} type="button" onClick={() => onSelect(opt.value)}
                  title={opt.label}
                  style={{width:"28px",height:"28px",borderRadius:"50%",background:opt.bg,cursor:"pointer",
                          position:"relative",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",
                          border:active?"2.5px solid #000":"2.5px solid transparent",
                          boxShadow:active?"0 0 0 1px #000":"0 1px 3px rgba(0,0,0,0.18)"}}>
                  {!opt.value && <span style={{fontSize:"10px",color:"#888",fontWeight:"bold"}}>✕</span>}
                  {active && opt.value && <span style={{fontSize:"10px",color:"white",fontWeight:"bold"}}>✓</span>}
                </button>
              );
            })}
          </div>
        );
      }

      /* ── テーマカラーピッカー（カード画面全体）v5.16 ── */
      // FREE は なし＋ブルー・グリーンのみ。PRO限定色は🔒表示（クリック不可）
      export function ThemePicker({ selected, onSelect, pro, dark = false }) {
        return (
          <div>
            <div className="flex gap-2 flex-wrap">
              {THEME_OPTIONS.map(opt => {
                const locked = !pro && !FREE_THEME_KEYS.includes(opt.key);
                const active = (selected || "") === opt.key;
                return (
                  <button key={opt.key || "none"} type="button"
                    title={locked ? `${opt.label}（PRO限定）` : opt.label}
                    onClick={() => { if (!locked) onSelect(opt.key); }}
                    style={{width:"28px",height:"28px",borderRadius:"50%",background:opt.swatch,
                            cursor:locked?"not-allowed":"pointer",position:"relative",flexShrink:0,
                            display:"flex",alignItems:"center",justifyContent:"center",
                            opacity:locked?0.3:1,filter:locked?"grayscale(0.6)":"none",
                            border:active?(dark?"2.5px solid #fff":"2.5px solid #000"):"2.5px solid transparent",
                            boxShadow:active?(dark?"0 0 0 1px #fff":"0 0 0 1px #000"):"0 1px 3px rgba(0,0,0,0.18)"}}>
                    {!opt.key && <span style={{fontSize:"10px",color:"#888",fontWeight:"bold"}}>✕</span>}
                    {locked && <span style={{fontSize:"10px"}}>🔒</span>}
                    {active && opt.key && <span style={{fontSize:"10px",color:"white",fontWeight:"bold"}}>✓</span>}
                  </button>
                );
              })}
            </div>
            {!pro && <p className={`text-[9px] mt-1.5 ${dark ? "text-amber-400" : "text-amber-600"}`}>✦ PROなら全8色から選べます（FREEはブルー・グリーン）</p>}
          </div>
        );
      }

      /* ── 文字色ピッカー ── */
      export const TEXT_COLOR_PRESETS = [
        "#ffffff","#f0f0f0","#000000","#1a1a1a",
        "#ffd700","#ffa500","#ff6b6b","#ff69b4",
        "#87ceeb","#00bcd4","#90ee90","#c8a2c8",
      ];
      export function TextColorPicker({ selected, onSelect, disabled }) {
        const cur = selected || "#ffffff";
        const isPreset = TEXT_COLOR_PRESETS.includes(cur);
        return (
          <div className="flex gap-1.5 flex-wrap items-center" style={disabled ? {opacity:0.12,pointerEvents:"none",filter:"grayscale(1)"} : {}}>
            {TEXT_COLOR_PRESETS.map(v => {
              const active = cur === v;
              const isLight = v === "#ffffff" || v === "#f0f0f0" || v === "#ffd700" || v === "#ffa500" || v === "#ff69b4" || v === "#87ceeb" || v === "#90ee90" || v === "#c8a2c8";
              return (
                <button key={v} type="button" onClick={() => onSelect(v)} title={v}
                  style={{width:"24px",height:"24px",borderRadius:"50%",background:v,cursor:"pointer",flexShrink:0,
                          border: active ? "2.5px solid #000" : isLight ? "1.5px solid rgba(0,0,0,0.15)" : "1.5px solid transparent",
                          boxShadow: active ? "0 0 0 2px white,0 0 0 3.5px #000" : "0 1px 3px rgba(0,0,0,0.2)"}} />
              );
            })}
            {/* カスタムカラー（コンパクトなinput[type=color]） */}
            <label title="カスタム色" style={{position:"relative",width:"24px",height:"24px",cursor:"pointer",flexShrink:0,
                    borderRadius:"50%",overflow:"hidden",
                    border: !isPreset ? "2.5px solid #000" : "1.5px solid rgba(0,0,0,0.2)",
                    boxShadow: !isPreset ? "0 0 0 2px white,0 0 0 3.5px #000" : "0 1px 3px rgba(0,0,0,0.2)",
                    background:"conic-gradient(red,yellow,lime,cyan,blue,magenta,red)"}}>
              <input type="color" value={cur} onChange={e => onSelect(e.target.value)}
                style={{position:"absolute",opacity:0,inset:0,width:"100%",height:"100%",cursor:"pointer"}} />
            </label>
          </div>
        );
      }

      /* ── 位置揃えピッカー（左/中/右） ── */
      export function AlignPicker({ selected, onSelect, dark = false, disabled = false }) {
        const opts = [
          { value:"left",   text:"左" },
          { value:"center", text:"中" },
          { value:"right",  text:"右" },
        ];
        return (
          <div className="flex gap-1" style={disabled ? {opacity:0.12,pointerEvents:"none",filter:"grayscale(1)"} : {}}>
            {opts.map(opt => {
              const active = (selected || "left") === opt.value;
              return (
                <button key={opt.value} type="button" onClick={() => onSelect(opt.value)}
                  style={{width:"30px",height:"24px",borderRadius:"6px",fontSize:"10px",fontWeight:"bold",
                          cursor:"pointer",
                          background: active ? (dark?"#fff":"#000") : (dark?"#333":"#f0f0f0"),
                          color: active ? (dark?"#000":"#fff") : (dark?"#ccc":"#111"),
                          border: active ? "none" : `1px solid ${dark?"#444":"#e0e0e0"}`}}>
                  {opt.text}
                </button>
              );
            })}
          </div>
        );
      }

      /* ── サイズピッカー（S/M/L/XL） ── */
      export function SizePicker({ selected, onSelect, dark = false, disabled = false }) {
        return (
          <div className="flex gap-1" style={disabled ? {opacity:0.12,pointerEvents:"none",filter:"grayscale(1)"} : {}}>
            {["S","M","L","XL"].map(s => {
              const active = (selected || "M") === s;
              return (
                <button key={s} type="button" onClick={() => onSelect(s)}
                  style={{minWidth:"24px",height:"22px",padding:"0 4px",borderRadius:"5px",fontSize:"9px",fontWeight:"bold",
                          cursor:"pointer",
                          background: active ? (dark?"#fff":"#000") : (dark?"#2a2a2a":"#f0f0f0"),
                          color: active ? (dark?"#000":"#fff") : (dark?"#ccc":"#111"),
                          border: active ? `1px solid ${dark?"#fff":"#000"}` : `1px solid ${dark?"#444":"#e0e0e0"}`}}>
                  {s}
                </button>
              );
            })}
          </div>
        );
      }

      /* ── フォントピッカー ── */
      export function FontPicker({ selected, onSelect, dark = false, disabled = false }) {
        return (
          <div className="flex gap-1 flex-wrap" style={disabled ? {opacity:0.12,pointerEvents:"none",filter:"grayscale(1)"} : {}}>
            {FONT_OPTIONS.map((opt, i) => {
              const active = (selected ?? 0) === i;
              return (
                <button key={i} type="button" onClick={() => onSelect(i)}
                  title={opt.label}
                  style={{fontFamily:opt.value,fontSize:"10px",padding:"2px 7px",borderRadius:"6px",
                          cursor:"pointer",whiteSpace:"nowrap",
                          background: active ? (dark?"#fff":"#000") : (dark?"#2a2a2a":"#f0f0f0"),
                          color: active ? (dark?"#000":"#fff") : (dark?"#ccc":"#111"),
                          border: active ? `1px solid ${dark?"#fff":"#000"}` : `1px solid ${dark?"#444":"#e0e0e0"}`}}>
                  {opt.label}
                </button>
              );
            })}
          </div>
        );
      }

      /* ── URLリンク行 ── */
      export function URLRow({ entry }) {
        const [copied, setCopied] = useState(false);
        const sns = getSNS(entry.label);
        const handleCopy = async (e) => { e.preventDefault(); await copyText(entry.url); setCopied(true); setTimeout(() => setCopied(false), 2000); };
        return (
          <div className="flex items-center gap-3 group">
            <a href={entry.url} target="_blank" rel="noopener noreferrer"
              className="flex-1 flex items-center gap-3 py-2.5 px-3 rounded-xl bg-white hover:bg-neutral-50 border border-neutral-100 transition-all group-hover:border-neutral-200 min-w-0">
              {sns ? (
                <span className="shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-white" style={{background:sns.color}}>{sns.icon}</span>
              ) : (
                <span className="shrink-0 w-7 h-7 rounded-lg bg-neutral-100 flex items-center justify-center text-neutral-400">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                </span>
              )}
              <div className="min-w-0 flex-1">
                {entry.label && <p className="text-xs font-semibold text-neutral-700 truncate">{entry.label}</p>}
                <p className="text-[10px] text-neutral-400 truncate font-mono">{entry.url}</p>
              </div>
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 text-neutral-300"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
            </a>
            <button onClick={handleCopy}
              className={`shrink-0 w-8 h-8 rounded-lg text-[9px] font-mono transition-all flex items-center justify-center ${copied ? 'bg-black text-white' : 'bg-neutral-100 text-neutral-400 hover:bg-black hover:text-white'}`}>
              {copied ? '✓' : <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect width="14" height="14" x="8" y="8" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>}
            </button>
          </div>
        );
      }

      /* ── SNSラベル選択（ボタングリッド方式） ── */
      // <select>のonChange問題を回避するためボタングリッドに変更
      export const SNS_BUTTONS = [
        { value:"Instagram", color:"#E1306C", icon:<svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg> },
        { value:"X",         color:"#000",    icon:<svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.73-8.835L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg> },
        { value:"Facebook",  color:"#1877F2", icon:<svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg> },
        { value:"LINE",      color:"#00B900", icon:<svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14"><path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63h2.386c.346 0 .627.285.627.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63.346 0 .628.285.628.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.282.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314"/></svg> },
        { value:"YouTube",   color:"#FF0000", icon:<svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14"><path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg> },
        { value:"TikTok",    color:"#000",    icon:<svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14"><path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/></svg> },
        { value:"LinkedIn",  color:"#0A66C2", icon:<svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg> },
        { value:"Website",   color:"#555",    icon:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg> },
      ];

      export function SNSLabelPicker({ value, isCustom, onSelect, dark = true }) {
        const isNone = !isCustom && value === "";
        // なし・SNS一覧・カスタムを1つの配列にまとめて3列グリッドで表示
        const allButtons = [
          { key: "__none__", label: "なし", icon: null },
          ...SNS_BUTTONS.map(s => ({ key: s.value, label: s.value, icon: s.icon, color: s.color })),
          { key: "__custom__", label: "カスタム", icon: null },
        ];
        return (
          <div className="space-y-2">
            {/* 3列グリッド：アイコン＋テキスト */}
            <div style={{display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'6px'}}>
              {allButtons.map(btn => {
                const isNoneBtn   = btn.key === "__none__";
                const isCustomBtn = btn.key === "__custom__";
                const active = isNoneBtn ? isNone : isCustomBtn ? isCustom : (!isCustom && value === btn.key);
                const handleClick = () => {
                  if (isNoneBtn)   onSelect("", false);
                  else if (isCustomBtn) onSelect("", true);
                  else              onSelect(btn.key, false);
                };
                return (
                  <button type="button" key={btn.key} onClick={handleClick}
                    className={`flex items-center gap-1.5 px-2 py-2 rounded-xl text-[10px] font-semibold transition-all truncate ${active
                      ? (dark ? 'text-white' : 'text-white')
                      : (dark ? 'bg-neutral-700 text-neutral-300 hover:bg-neutral-600 hover:text-white' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200')}`}
                    style={active ? {background: btn.color || (dark ? '#fff' : '#000'), color: (active && !btn.color) ? (dark ? '#000' : '#fff') : undefined} : {}}>
                    {btn.icon
                      ? <span className="shrink-0">{React.cloneElement(btn.icon, {width:13, height:13})}</span>
                      : <span className="shrink-0 text-[11px]">{isNoneBtn ? '✕' : '✎'}</span>
                    }
                    <span className="truncate">{btn.label}</span>
                  </button>
                );
              })}
            </div>
            {/* カスタム入力欄 */}
            {isCustom && (
              <input type="text" value={value}
                onChange={e => onSelect(e.target.value, true)}
                placeholder="ラベルを入力（例：会社サイト）"
                autoFocus
                className={`w-full px-3 py-2.5 rounded-xl text-xs placeholder:text-neutral-400 focus:outline-none ${dark
                  ? 'bg-neutral-800 border border-white/30 text-white focus:border-white/60'
                  : 'bg-neutral-50 border border-neutral-200 text-neutral-800 focus:border-black'}`} />
            )}
          </div>
        );
      }

      /* ── フリップカード ── */
