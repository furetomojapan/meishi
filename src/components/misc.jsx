import { useState } from "react";
import { FONT_OPTIONS, FONT_SIZES, copyText } from "../lib/core";

      export function QRButton({ url }) {
        const [show, setShow] = useState(false);
        const qr = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(url)}`;
        return (
          <div>
            <button onClick={() => setShow(v => !v)}
              className={`flex flex-col items-center justify-center gap-1.5 w-20 h-16 rounded-2xl font-medium text-xs transition-all shadow-md ${show ? 'bg-black text-white' : 'bg-white text-neutral-700 hover:bg-black hover:text-white hover:shadow-lg'}`}>
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/><path d="M14 14h3v3h-3zM17 17h3v3h-3zM14 20h3"/><path d="M17 14v3"/></svg>
              <span className="text-[10px] font-semibold tracking-wide">QR</span>
            </button>
            {show && (
              <>
                {/* オーバーレイ（外クリックで閉じる） */}
                <div className="fixed inset-0 z-40" onClick={() => setShow(false)} />
                {/* QRポップアップ — viewport中央固定 */}
                <div className="fixed z-50 bg-white rounded-3xl shadow-2xl p-6 border border-neutral-100"
                  style={{left:'50%', top:'50%', transform:'translate(-50%,-50%)', width:'220px'}}>
                  <button onClick={() => setShow(false)} className="absolute top-3 right-4 text-neutral-300 hover:text-black text-base font-bold">✕</button>
                  <img src={qr} alt="QR Code" style={{width:'160px',height:'160px',display:'block'}} className="mx-auto" />
                  <p className="text-[9px] text-neutral-400 text-center mt-3 font-mono tracking-wider">Scan to open</p>
                </div>
              </>
            )}
          </div>
        );
      }

      /* ── シェアボタン ── */
      export function ShareBtn({ url, title }) {
        const [copied, setCopied] = useState(false);
        const handle = async () => {
          if (navigator.share) {
            try { await navigator.share({ title, url }); return; } catch(e) {}
          }
          await copyText(url);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        };
        return (
          <button onClick={handle}
            className={`flex flex-col items-center justify-center gap-1.5 w-20 h-16 rounded-2xl font-medium text-xs transition-all shadow-md ${copied ? 'bg-black text-white' : 'bg-white text-neutral-700 hover:bg-black hover:text-white hover:shadow-lg'}`}>
            {copied ? (
              <><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
              <span className="text-[10px] font-semibold">Copied!</span></>
            ) : (
              <><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
              <span className="text-[10px] font-semibold tracking-wide">シェア</span></>
            )}
          </button>
        );
      }

      /* ── 写真保存ボタン ── */
      // フェーズ2: 旧GitHub画像のDownloadBtn（未使用）を削除

      /* ── フリーカード（テキスト名刺）── */
      export function FreeCardFace({ profile, side, transparent = false }) {
        const bgNum = side === "back" ? (profile?.bgBack || profile?.bg || "1") : (profile?.bg || "1");
        const bgSrc = `hai${bgNum}.png`;
        const tint = profile?.tint || "";
        const appeals = profile?.appeals || ["","","",""];
        const globalColor = profile?.textColor || "#ffffff";
        // フィールド別カラー or グローバルカラーのテキストスタイルを返す
        const ts = (fieldColor) => {
          const c = fieldColor || globalColor;
          const hx = c.replace("#","");
          const r=parseInt(hx.slice(0,2),16)||255, g=parseInt(hx.slice(2,4),16)||255, b=parseInt(hx.slice(4,6),16)||255;
          const lum=(0.299*r+0.587*g+0.114*b)/255;
          return { color:c, textShadow: lum>0.55 ? "0 1px 4px rgba(0,0,0,0.85)" : "0 1px 3px rgba(255,255,255,0.35)" };
        };
        return (
          <div style={{position:"relative",width:"100%",height:"100%",borderRadius:"inherit",overflow:"hidden",
                       ...(!transparent && {backgroundImage:`url(${bgSrc})`,backgroundSize:"cover",backgroundPosition:"center",backgroundColor:"#2a2a3a"})}}>
            {!transparent && tint && <div style={{position:"absolute",inset:0,background:tint,zIndex:1,pointerEvents:"none"}} />}
            <div style={{position:"relative",zIndex:2,width:"100%",height:"100%",padding:"8% 9%"}}>
              {side === "front" ? (<>
                {/* 会社名・肩書き・名前：上部 */}
                <div style={{display:"flex",flexDirection:"column",gap:"2px"}}>
                  {profile?.company && (
                    <div style={{...ts(profile.companyColor),fontSize:FONT_SIZES.name[profile.companyFontSize||"S"],
                                 fontFamily:FONT_OPTIONS[profile.companyFont??0]?.value||"inherit",
                                 textAlign:profile.companyAlign||"left",whiteSpace:"pre-line",opacity:0.9}}>
                      {profile.company}
                    </div>
                  )}
                  {profile?.title && (
                    <div style={{...ts(profile.titleColor),fontSize:FONT_SIZES.name[profile.titleFontSize||"S"],
                                 fontFamily:FONT_OPTIONS[profile.titleFont??0]?.value||"inherit",
                                 textAlign:profile.titleAlign||"left",whiteSpace:"pre-line",opacity:0.8}}>
                      {profile.title}
                    </div>
                  )}
                  <div style={{...ts(profile?.nameColor),fontSize:FONT_SIZES.name[profile?.nameFontSize||"M"],fontWeight:700,
                               fontFamily:FONT_OPTIONS[profile?.nameFont??0]?.value||"inherit",
                               textAlign:profile?.nameAlign||"left",whiteSpace:"pre-line"}}>
                    {profile?.name || <span style={{opacity:0.3}}>（名前を入力してください）</span>}
                  </div>
                </div>
                {/* 電話・住所：下部固定 */}
                <div style={{position:"absolute",bottom:"12%",left:"9%",right:"9%",display:"flex",flexDirection:"column",gap:"6px"}}>
                  {profile?.phone && (
                    <a href={`tel:${profile.phone.replace(/[^\d+]/g,"")}`}
                      style={{...ts(profile?.phoneColor),fontSize:FONT_SIZES.phone[profile?.phoneFontSize||"M"],
                              fontFamily:FONT_OPTIONS[profile?.phoneFont??0]?.value||"inherit",
                              opacity:0.9,display:"flex",alignItems:"center",gap:"5px",textDecoration:"none"}}>
                      <span>☎</span><span>{profile.phone}</span>
                    </a>
                  )}
                  {profile?.address && (
                    <a href={`https://maps.google.com/?q=${encodeURIComponent(profile.address)}`}
                      target="_blank" rel="noopener noreferrer"
                      style={{...ts(profile?.addressColor),fontSize:FONT_SIZES.address[profile?.addressFontSize||"M"],
                              fontFamily:FONT_OPTIONS[profile?.addressFont??0]?.value||"inherit",
                              opacity:0.8,display:"flex",alignItems:"flex-start",gap:"5px",lineHeight:1.4,textDecoration:"none"}}>
                      <span style={{flexShrink:0}}>📍</span><span>{profile.address}</span>
                    </a>
                  )}
                </div>
                <div style={{position:"absolute",bottom:"5%",right:"5%",...ts(""),fontSize:"7px",opacity:0.35,
                             fontFamily:"monospace",letterSpacing:"0.12em"}}>XYZ Digital Card</div>
              </>) : (<>
                {/* 裏面：名前なし、アピール項目を大きく中央寄せ */}
                <div style={{display:"flex",flexDirection:"column",justifyContent:"center",height:"100%",gap:"clamp(6px,1.8vw,12px)"}}>
                  {/* 空のアピールは表示しない（「未入力」を出さない） */}
                  {appeals.map((a,i) => (a && String(a).trim()) ? (
                    <div key={i} style={{...ts(profile?.appealColors?.[i]),fontSize:"clamp(11px,3vw,16px)",display:"flex",
                                         alignItems:"flex-start",gap:"8px",
                                         justifyContent:profile?.appealsAlign==="center"?"center":profile?.appealsAlign==="right"?"flex-end":"flex-start",
                                         fontFamily:FONT_OPTIONS[profile?.appealFonts?.[i]??0]?.value||"inherit"}}>
                      <span style={{whiteSpace:"pre-line"}}>{a}</span>
                    </div>
                  ) : null)}
                </div>
              </>)}
            </div>
          </div>
        );
      }

      /* ── 背景ピッカー ── */
