import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import React from "react";
import { GH_REPO, getSiteBase, FREE_LINK_LIMIT } from "../lib/core";
import { QRButton, ShareBtn, PreviewBtn, AddToHomeBtn, FreeCardFace } from "./misc";
import { URLRow } from "./pickers";

      export function FlipCard({ variablePart, personData, pro, owner = false }) {
        const [flipped, setFlipped] = useState(false);
        const [showHint, setShowHint] = useState(true);
        const siteUrl = `${getSiteBase()}#${personData?.publicId || variablePart}`; // publicIdでID秘匿
        const tagUrl = personData?.tagPublicId ? `${getSiteBase()}#${personData.tagPublicId}` : ""; // タグ仲間向け限定URL
        // v4.16: プレビュー用URL（タグ仲間用のみ — 表面のカード自体は誰が見ても同じ見た目のため、
        //   実際に表示内容が変わる「タグ仲間向け限定表示」だけプレビューする意味がある）
        //   ?preview=1 を付け、同じ端末で開いても訪問者と同じ見た目を強制する
        //   （QR/シェアで配る本来のURLはtagUrlのまま。previewパラメータを付けない）
        const tagUrlPreview = personData?.tagPublicId ? `${getSiteBase()}?preview=1#${personData.tagPublicId}` : "";
        const frontSrc = `image1_${variablePart}.png`;
        const backSrc  = `image2_${variablePart}.png`;
        const ghFallback = src => `${getSiteBase()}${src}`; // フェーズ4: 画像はpublic/配下からPagesで配信

        useEffect(() => {
          const t = setTimeout(() => setShowHint(false), 4000);
          return () => clearTimeout(t);
        }, []);

        const [imgError, setImgError] = React.useState({front:false, back:false});
        const profile = personData.profile;
        // v5.20: 文字を重ねる表示は表面/裏面で個別設定可能に。
        //   個別設定（frontShowTextOverlay/backShowTextOverlay）が未設定の場合は
        //   旧・共通設定（showTextOverlay）にフォールバック（既存データとの後方互換）
        const showOverlayFor = (side) => {
          const key = `${side}ShowTextOverlay`;
          return profile?.[key] !== undefined ? profile[key] !== false : profile?.showTextOverlay !== false;
        };

        const onImgError = (e, side) => {
          const fb = ghFallback(e.target.dataset.src);
          if (e.target.src !== fb) { e.target.src = fb; }
          else { setImgError(prev => ({ ...prev, [side]: true })); }
        };

        const plusG = personData?.plusG === true; // v4.8: ＋Gは永続・PRO非依存
        const CardFace = ({ src, side }) => {
          const uploadedUrl = side === "front" ? profile?.frontImageUrl : profile?.backImageUrl;

          // v4.8: 独自背景画像（＋G）はPROでなくても表示（＋Gは買い切りで永続）
          if ((pro || plusG) && uploadedUrl) return (
            <div className="relative w-full h-full rounded-2xl overflow-hidden shadow-lg">
              <img src={uploadedUrl} className="absolute inset-0 w-full h-full object-cover" />
              {showOverlayFor(side) && (
                <div className="absolute inset-0">
                  <FreeCardFace profile={profile} side={side} transparent />
                </div>
              )}
            </div>
          );

          // FREEプラン（＋G背景なし）→ テキストカード
          if (!pro) return (
            <div className="relative w-full h-full rounded-2xl overflow-hidden shadow-lg">
              <FreeCardFace profile={profile} side={side} />
            </div>
          );

          // PROプラン + GitHubファイル画像（画像エラーならテキストカードにフォールバック）
          if (imgError[side]) return (
            <div className="relative w-full h-full rounded-2xl overflow-hidden shadow-lg">
              <FreeCardFace profile={profile} side={side} />
            </div>
          );
          return (
            <div className="relative w-full h-full bg-white rounded-2xl overflow-hidden border border-white shadow-lg">
              <img src={src} data-src={src} alt={src} className="w-full h-full object-cover"
                onError={e => onImgError(e, side)} />
            </div>
          );
        };

        return (
          <div className="w-full">
            {/* 表示名 */}
            {personData.displayName && (
              <h2 className="text-xl font-semibold text-neutral-800 mb-4 text-center tracking-wide">{personData.displayName}</h2>
            )}

            {/* カード本体（タップでフリップ） */}
            <div className="flip-container w-full relative">
              <div className={`flip-card aspect-[1.75/1] cursor-pointer ${flipped ? 'flipped' : ''} ${showHint ? 'hint-anim' : ''}`}
                style={{height:'auto'}} onClick={() => { setFlipped(f => !f); setShowHint(false); }}>
                <div className="flip-face w-full h-full"><CardFace src={frontSrc} side="front" /></div>
                <div className="flip-face-back w-full h-full"><CardFace src={backSrc} side="back" /></div>
              </div>
              {/* 無料プランのウォーターマーク（右端縦ストリップ・タップでアクティベーション） */}
              {!pro && (
                <a href="help.html#plans"
                  target="_blank" rel="noopener noreferrer"
                  style={{position:'absolute',top:0,right:0,bottom:0,width:'26px',zIndex:10,background:'rgba(0,0,0,0.65)',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',borderRadius:'0 12px 12px 0',textDecoration:'none'}}
                  title="Proプランにする">
                  <span style={{color:'white',fontSize:'13px',fontWeight:'600',fontFamily:'Inter,sans-serif',letterSpacing:'0.12em',whiteSpace:'nowrap',transform:'rotate(90deg)',display:'block'}}>
                    ✦ Free Plan
                  </span>
                </a>
              )}
              {/* タップヒント */}
              <AnimatePresence>
                {showHint && (
                  <motion.div initial={{opacity:0, y:-4}} animate={{opacity:1, y:0}} exit={{opacity:0}}
                    className="absolute top-3 right-8 flex items-center gap-1.5 bg-black/60 text-white text-[10px] px-3 py-1.5 rounded-full pointer-events-none backdrop-blur-sm">
                    <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M7 16V4m0 0L3 8m4-4l4 4"/><path d="M17 8v12m0 0l4-4m-4 4l-4-4"/></svg>
                    タップして裏返す
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* A面/B面 ボタン（v5.18.1: スリム化 — 高さ約1/3・ラベルのみ） */}
            <div className="mt-5 grid grid-cols-2 gap-3">
              <button onClick={() => setFlipped(false)}
                className={`py-2 rounded-2xl text-sm font-bold tracking-wide transition-all duration-300 ${!flipped ? 'bg-black text-white shadow-2xl scale-[1.02]' : 'bg-white text-neutral-400 shadow-md hover:shadow-lg hover:text-black border border-neutral-100'}`}>
                A面
              </button>
              <button onClick={() => setFlipped(true)}
                className={`py-2 rounded-2xl text-sm font-bold tracking-wide transition-all duration-300 ${flipped ? 'bg-black text-white shadow-2xl scale-[1.02]' : 'bg-white text-neutral-400 shadow-md hover:shadow-lg hover:text-black border border-neutral-100'}`}>
                B面
              </button>
            </div>

            {/* アクションボタン（v4.8: QR/シェアは本人のみ。v4.13: 相手側プレビュー2種を追加） */}
            {owner && (
            <div className="mt-4 flex items-center justify-center gap-4">
              <PreviewBtn url={tagUrlPreview} label="タグ仲間用" />
              <QRButton url={siteUrl} />
              <ShareBtn url={siteUrl} title={`${personData.displayName || variablePart} のデジタル名刺`} />
            </div>
            )}

            {/* v5.26: ホーム画面に追加（本人・来訪者どちらにも表示） */}
            {/* v5.45: 名刺ブックマークアプリへの保存リンク（本人・来訪者どちらにも表示） */}
            <div className="mt-4 flex justify-center gap-3 flex-wrap">
              <AddToHomeBtn />
              <a
                href={`https://laxuz999.github.io/meishi-bookmark/?url=${encodeURIComponent(siteUrl)}&name=${encodeURIComponent(personData.displayName || '')}&tags=${encodeURIComponent((personData.tags || []).join(','))}`}
                target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 mx-auto text-[10px] text-neutral-500 hover:text-black border border-neutral-200 hover:border-black rounded-full px-4 py-2 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
                この名刺を保存
              </a>
            </div>

            {/* URLリンク（無料プランは1件のみ表示） */}
            {personData.links.length > 0 && (
              <div className="mt-6 space-y-2">
                <p className="text-[9px] font-mono text-neutral-400 uppercase tracking-widest px-1 mb-3">Links</p>
                {(pro ? personData.links : personData.links.slice(0, FREE_LINK_LIMIT)).map((entry, i) => <URLRow key={i} entry={entry} />)}
                {!pro && personData.links.length > FREE_LINK_LIMIT && (
                  <p className="text-[9px] text-neutral-400 text-center py-1 font-mono">+{personData.links.length - FREE_LINK_LIMIT} 件（PROプランで表示）</p>
                )}
              </div>
            )}
          </div>
        );
      }

      /* ── トースト通知 ── */

      export function Toast({ status }) {
        if (!status) return null;
        const cfg = {
          saving:         { bg:"bg-neutral-700",  text:"保存中…" },
          saved:          { bg:"bg-green-600",     text:"✓ 保存しました" },
          saved_local:    { bg:"bg-blue-600",      text:"✓ 保存しました" },
          error:          { bg:"bg-red-600",       text:"保存に失敗しました" },
          error_no_token: { bg:"bg-yellow-600",    text:"保存に失敗しました" },
        }[status];
        if (!cfg) return null;
        return (
          <div className={`fixed top-4 left-1/2 z-[100] flex items-center gap-2 px-5 py-3 rounded-2xl text-white text-xs font-semibold shadow-2xl ${cfg.bg}`}
            style={{transform:'translateX(-50%)', whiteSpace:'nowrap'}}>
            {cfg.text}
          </div>
        );
      }

      /* ── メインアプリ ── */
      /* ── タグ編集（全体公開トグル + タグ入力欄）ユーザー/管理者 共通 ──
         フェーズ3: v5.9で2回実装したトグル+入力欄を統合。
         lockedEditable=true（管理者）は上限超過枠も入力可（保存可・無効） */
