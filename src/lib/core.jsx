

      export const APP_VERSION = "v5.12"; // フェーズ5: GAS v4.0（PINハッシュ化・ルーティング構造化・ロック・キャッシュ）
      export const GH_REPO = "furetomojapan/meishi"; // 画像ホスティング（読み取り専用）にのみ使用
      // ★ Google Apps Script Web App URL（デプロイ後に差し替える）
      export const GAS_URL = "https://script.google.com/macros/s/AKfycbx07AF_mr_J1zVlkNbQ5FcEFDRJNwkhcAUGG71elltc3iusAKUuBvRBWcnriHcZ4NT2/exec";
      // 書き込みは全てGAS経由（旧GitHub方式はv5.9で廃止、GAS_READY恒真分岐はフェーズ2で削除）
      export const getSiteBase = () => window.location.origin + window.location.pathname;

      /* ── データ正規化 ── */
      export const normalizeProfile = (p) => {
        const d = { company:"", companyFont:0, companyFontSize:"S", companyAlign:"left", companyColor:"",
                    title:"", titleFont:0, titleFontSize:"S", titleAlign:"left", titleColor:"",
                    name:"", nameFont:0, nameFontSize:"M", nameAlign:"left", nameColor:"",
                    address:"", addressFont:0, addressFontSize:"M", addressColor:"",
                    phone:"", phoneFont:0, phoneFontSize:"M", phoneColor:"",
                    appeals:["","","",""], appealsAlign:"left", appealFonts:[0,0,0,0], appealColors:["","","",""],
                    bg:"1", bgBack:"", tint:"", textColor:"#ffffff", frontImageUrl:"", backImageUrl:"", showTextOverlay:true };
        if (!p) return d;
        const appeals = Array.isArray(p.appeals) ? [...p.appeals, ...["","","",""]].slice(0,4) : d.appeals;
        const appealFonts = Array.isArray(p.appealFonts) ? [...p.appealFonts, 0,0,0,0].slice(0,4) : d.appealFonts;
        return { ...d, ...p, appeals, appealFonts };
      };
      export const getPersonData = (urlsData, name) => {
        const raw = urlsData[name];
        if (!raw) return { displayName: "", plan: "free", links: [], profile: normalizeProfile(null) };
        return { displayName: raw.displayName || "", plan: raw.plan || "free", plusG: raw.plusG || false, links: (raw.links || []).map(normalizeEntry).filter(e => e.url), profile: normalizeProfile(raw.profile), pin: raw.pin || "", publicId: raw.publicId || "", hasPinSet: raw.hasPinSet, _tagView: raw._tagView || false };
      };

      /* ── プラン判定 ── */
      export const isPro = (personData) => personData?.plan === "pro";
      export const isPlusG = (personData) => isPro(personData) && personData?.plusG === true;
      export const FREE_LINK_LIMIT = 1;
      export const PRO_LINK_LIMIT  = 5;
      export const FREE_TAG_LIMIT  = 1;
      export const PRO_TAG_LIMIT   = 5;
      export const TAG_MAX_LEN     = 20;
      export const TAG_PLACEHOLDERS = ["例：飲食", "例：トヨタ", "例：DIY", "例：渋谷（地域）", "例：釣り"]; // ★ v5.9: 「all」は全体公開トグルに分離
      // Fisher-Yates シャッフル（マッチ一覧のランダム表示用）
      export const shuffleArr = (arr) => {
        const a = [...arr];
        for (let i = a.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [a[i], a[j]] = [a[j], a[i]];
        }
        return a;
      };
      // タグ正規化（GAS側と同一仕様: NFKC → trim → 小文字 → 連続空白を1つに）
      export const normalizeTag = (t) => {
        let s = String(t || "");
        try { s = s.normalize("NFKC"); } catch {}
        return s.trim().toLowerCase().replace(/\s+/g, " ");
      };
      // ★ STORESの商品公開URL（申し込みボタン用）
      export const STORES_URL = "https://w0uojgyhnhslanlhxcdn.stores.jp/";
      export const TINT_OPTIONS = [
        { label:"なし",     bg:"#e0e0e0", value:"",                        textIcon:"✕" },
        { label:"ピンク",   bg:"#ff69b4", value:"rgba(255,105,180,0.38)"               },
        { label:"レッド",   bg:"#e03040", value:"rgba(210,50,50,0.38)"                 },
        { label:"オレンジ", bg:"#f09020", value:"rgba(240,140,30,0.38)"                },
        { label:"グリーン", bg:"#32a040", value:"rgba(50,160,70,0.38)"                 },
        { label:"ブルー",   bg:"#2878d0", value:"rgba(40,120,210,0.38)"                },
        { label:"パープル", bg:"#8c3cbe", value:"rgba(140,60,190,0.38)"                },
        { label:"ブラック", bg:"#222222", value:"rgba(0,0,0,0.48)"                     },
      ];

      export const FONT_OPTIONS = [
        { label:"ゴシック",   value:"'Noto Sans JP', sans-serif",   sample:"Aa" },
        { label:"明朝",       value:"'Noto Serif JP', serif",        sample:"Aa" },
        { label:"丸ゴシック", value:"'M PLUS 1p', sans-serif",       sample:"Aa" },
        { label:"細明朝",     value:"'Sawarabi Mincho', serif",      sample:"Aa" },
        { label:"丸字",       value:"'Kosugi Maru', sans-serif",     sample:"Aa" },
        { label:"レトロ",     value:"'DotGothic16', sans-serif",     sample:"Aa" },
      ];

      export const FONT_SIZES = {
        name:    { S:"clamp(11px,3vw,16px)",  M:"clamp(15px,4.2vw,24px)", L:"clamp(18px,5vw,28px)",  XL:"clamp(22px,6vw,34px)"  },
        address: { S:"clamp(7px,1.8vw,9px)",  M:"clamp(8px,2.2vw,11px)",  L:"clamp(10px,2.8vw,14px)", XL:"clamp(13px,3.5vw,18px)" },
        phone:   { S:"clamp(7px,2vw,10px)",   M:"clamp(9px,2.5vw,13px)",  L:"clamp(11px,3vw,16px)",  XL:"clamp(14px,4vw,20px)"  },
      };

      export const normalizeEntry = (e) => {
        if (!e) return { url: "", label: "" };
        if (typeof e === "string") return { url: e, label: "" };
        return { url: e.url || "", label: e.label || "" };
      };

      export const copyText = async (text) => {
        try { await navigator.clipboard.writeText(text); return true; } catch { return false; }
      };

      /* ── SNS定義 ── */
      export const SNS_LIST = [
        { value: "", label: "── 選択してください ──", color: "#888", icon: null },
        { value: "Instagram", label: "Instagram", color: "#E1306C",
          icon: <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg> },
        { value: "X", label: "X (Twitter)", color: "#000",
          icon: <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.73-8.835L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg> },
        { value: "Facebook", label: "Facebook", color: "#1877F2",
          icon: <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg> },
        { value: "LINE", label: "LINE", color: "#00B900",
          icon: <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16"><path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63h2.386c.346 0 .627.285.627.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63.346 0 .628.285.628.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.282.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314"/></svg> },
        { value: "YouTube", label: "YouTube", color: "#FF0000",
          icon: <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16"><path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg> },
        { value: "TikTok", label: "TikTok", color: "#000",
          icon: <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16"><path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/></svg> },
        { value: "LinkedIn", label: "LinkedIn", color: "#0A66C2",
          icon: <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg> },
        { value: "Website", label: "Webサイト", color: "#555",
          icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg> },
        { value: "__custom__", label: "カスタム入力", color: "#888",
          icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg> },
      ];
      export const getSNS = (label) => SNS_LIST.find(s => s.value === label && s.value !== "" && s.value !== "__custom__");

      /* ── QRボタン ── */
