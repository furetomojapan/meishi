import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { APP_VERSION, GH_REPO, GAS_URL, getSiteBase, normalizeProfile, getPersonData, isPro, isPlusG, trialDaysLeft, proDaysLeft, FREE_LINK_LIMIT, PRO_LINK_LIMIT, TAG_FRIENDS_FREE, TAG_FRIENDS_PRO, FREE_TAG_LIMIT, PRO_TAG_LIMIT, TAG_MAX_LEN, shuffleArr, normalizeTag, STORES_URL, SQUARE_LINKS, normalizeEntry, SNS_LIST, getCardTheme } from "./lib/core";
import { appConfirm, appAlert, appPrompt, DialogHost } from "./lib/dialog";
import { BgPicker, TintPicker, ThemePicker, TextColorPicker, AlignPicker, SizePicker, FontPicker, SNSLabelPicker } from "./components/pickers";
import { FlipCard, Toast } from "./components/flipcard";
import { TagFields, ProfileTextFields } from "./components/forms";

      /* ── プラン特典エリアの視覚区別（v5.20）──
         お試し中はロックが外れて特典の場所が分からなくなるため、
         背景色で常時 FREE（無地）/ PRO（金）/ +G（青）を区別する。
         dark=true で管理画面（黒テーマ）用の淡色に切替。 */
      const planBoxCls = (kind, dark) => {
        const isG = kind === "plusg";
        if (dark) return isG ? "bg-sky-500/10 border-sky-500/25" : "bg-amber-500/10 border-amber-500/25";
        return isG ? "bg-sky-50/70 border-sky-200" : "bg-amber-50/70 border-amber-200";
      };
      function PlanBadge({ kind }) {
        const isG = kind === "plusg";
        return (
          <span className={`absolute -top-2 right-3 z-10 text-[8px] font-bold px-2 py-0.5 rounded-full shadow-sm ${isG ? "bg-sky-500 text-white" : "bg-amber-400 text-black"}`}>
            {isG ? "✦ ＋G特典" : "✦ PRO特典"}
          </span>
        );
      }
      function PlanBox({ kind = "pro", dark = false, label, upgrade = false, className = "", children }) {
        const isG = kind === "plusg";
        const labelCls = isG ? (dark ? "text-sky-300" : "text-sky-600") : (dark ? "text-amber-300" : "text-amber-600");
        return (
          <div className={`relative border rounded-2xl pt-3 ${planBoxCls(kind, dark)} ${className}`}>
            <PlanBadge kind={kind} />
            {label && <p className={`text-[9px] font-bold uppercase tracking-widest px-3 mb-1.5 ${labelCls}`}>{label}</p>}
            {children}
            {upgrade && (
              <a href={STORES_URL} target="_blank" rel="noopener noreferrer"
                className={`mt-3 mb-3 mx-3 flex items-center justify-center gap-1 py-2 rounded-xl text-[10px] font-bold tracking-wide active:scale-95 transition-all ${isG ? 'bg-sky-500 text-white hover:bg-sky-400' : 'bg-amber-500 text-white hover:bg-amber-400'}`}>
                {isG ? '＋Gにアップグレード →' : 'PROにアップグレード →'}
              </a>
            )}
          </div>
        );
      }
      /* お試し終了後の安心メッセージ用: 保存済みデータにPRO/＋G特典が含まれるか判定 */
      const premiumSettings = (pd, savedTags) => {
        const p = pd?.profile || {};
        const fonts = [p.companyFont, p.titleFont, p.nameFont, p.addressFont, p.phoneFont, ...(p.appealFonts || [])];
        const colors = [p.companyColor, p.titleColor, p.nameColor, p.addressColor, p.phoneColor, ...(p.appealColors || [])];
        const aligns = [p.companyAlign, p.titleAlign, p.nameAlign, p.appealsAlign];
        const typography = fonts.some(f => f && f !== 0) || colors.some(c => c) || aligns.some(a => a && a !== 'left') || (p.textColor && p.textColor !== '#ffffff');
        const extraLinks = (pd?.links || []).length > FREE_LINK_LIMIT;
        const extraTags = (savedTags || []).filter(t => normalizeTag(t) !== 'all').length > FREE_TAG_LIMIT;
        const hasImage = !!(p.frontImageUrl || p.backImageUrl);
        return { typography, extraLinks, extraTags, hasImage, any: typography || extraLinks || extraTags || hasImage };
      };
      function PlanLegend({ dark = false }) {
        const item = (cls, text) => (
          <span className="flex items-center gap-1"><span className={`w-3 h-3 rounded border inline-block ${cls}`}></span>{text}</span>
        );
        return (
          <div className={`flex items-center justify-center flex-wrap gap-x-3 gap-y-1 text-[9px] ${dark ? "text-neutral-400" : "text-neutral-500"}`}>
            {item(dark ? "bg-neutral-800 border-neutral-700" : "bg-white border-neutral-300", "FREE（無料）")}
            {item(dark ? "bg-amber-500/20 border-amber-500/40" : "bg-amber-50 border-amber-300", "PRO特典")}
            {item(dark ? "bg-sky-500/20 border-sky-500/40" : "bg-sky-50 border-sky-300", "＋G特典")}
          </div>
        );
      }

      /* v4.8: 「作りたい」勧誘CTA（カードヘッダーから移設。編集画面・購入モーダルで使用） */
      function MakeOwnCTA() {
        return (
          <div className="flex flex-wrap gap-2 justify-center">
            <a href="https://furetomojapan.github.io/meishi/welcome.html" target="_blank" rel="noopener noreferrer"
              className="px-3 py-2 bg-black text-white rounded-full text-[11px] font-medium hover:bg-neutral-800 active:scale-95 transition-all">私もデジタル名刺を作りたい！</a>
            <a href="https://laxuz.xyz/furetomo/" target="_blank" rel="noopener noreferrer"
              className="px-3 py-2 bg-neutral-200 text-black rounded-full text-[11px] font-medium hover:bg-neutral-300 active:scale-95 transition-all">デジタルカードを作りたい</a>
          </div>
        );
      }

      export function App() {
        const [registeredNames, setRegisteredNames] = useState([]);
        const [adminSearch, setAdminSearch] = useState("");
        const [newUserInput, setNewUserInput] = useState("");
        const [variablePart, setVariablePart] = useState(null);
        const [isAdminMode, setIsAdminMode] = useState(false);
        const [passwordInput, setPasswordInput] = useState("");
        const [isLoggedIn, setIsLoggedIn] = useState(false);
        // ★ v5.9: 管理パスワードは sessionStorage（タブを閉じると消える — 共有PC対策）
        const [adminPassLocal, setAdminPassLocal] = useState(() => sessionStorage.getItem('meisi_admin_pass') || "");
        const [mustChangePass, setMustChangePass] = useState(false); // 初期パスワード強制変更
        const [tagCounts, setTagCounts] = useState({});   // タグごとの「見えている人数」
        const [showPrivacy, setShowPrivacy] = useState(false); // プライバシー説明モーダル
        // ★ v5.14: 文字サイズ拡大（見る人側の設定・端末に記憶。座談会Cさん課題）
        const UI_ZOOMS = [1, 1.15, 1.3];
        const UI_ZOOM_LABELS = ["標準", "大", "特大"];
        const [uiZoomIdx, setUiZoomIdx] = useState(() => {
          const v = parseInt(localStorage.getItem('meisi_ui_zoom') || "0", 10);
          return v >= 0 && v < 3 ? v : 0;
        });
        const cycleUiZoom = () => setUiZoomIdx(prev => {
          const next = (prev + 1) % UI_ZOOMS.length;
          localStorage.setItem('meisi_ui_zoom', String(next));
          return next;
        });
        const [pinAuthToken, setPinAuthToken] = useState(null);

        const [error, setError] = useState("");
        const [urlsData, setUrlsData] = useState(() => {
          // localStorage からの初期値（GitHub fetch 前の即時表示用）
          try { const s = localStorage.getItem('meisi_urls_data'); return s ? JSON.parse(s) : {}; } catch { return {}; }
        });
        const [editingUrlsName, setEditingUrlsName] = useState(null);
        const [editingDisplayName, setEditingDisplayName] = useState("");
        // _custom: trueのとき「カスタム入力」モード（SNSLabelPickerのisCustomに渡す）
        const [editingUrls, setEditingUrls] = useState([
          { url:"", label:"", _custom:false }, { url:"", label:"", _custom:false }, { url:"", label:"", _custom:false }
        ]);
        const [toast, setToast] = useState("");
        const [newPassInput, setNewPassInput] = useState("");
        const [passMsg, setPassMsg] = useState("");
        const [showUserEdit, setShowUserEdit] = useState(false);
        const [showPinModal, setShowPinModal] = useState(false);
        const [pinInput, setPinInput] = useState("");
        const [pinError, setPinError] = useState("");
        const [pinChangeInput, setPinChangeInput] = useState("");
        const [pinChangeMsg, setPinChangeMsg] = useState("");
        const [showPinSetup, setShowPinSetup] = useState(false);
        const [pinSetupInput, setPinSetupInput] = useState("");
        const [pinSetupConfirm, setPinSetupConfirm] = useState("");
        const [pinSetupMsg, setPinSetupMsg] = useState("");
        const [adminPinInput, setAdminPinInput] = useState("");
        const [adminPinMsg, setAdminPinMsg] = useState("");
        const [pinBusy, setPinBusy] = useState(false);        // PIN検証/設定の通信中
        const [editOpening, setEditOpening] = useState(false); // 編集パネルを開く準備中
        const [pinModalPurpose, setPinModalPurpose] = useState("edit"); // "edit" | "tags"
        const [showCardTags, setShowCardTags] = useState(false);   // カード画面のタグ仲間セクション
        const [cardTagMatches, setCardTagMatches] = useState(null); // { tag: users[] }
        const [cardTagBusy, setCardTagBusy] = useState(false);
        const [deviceMemMsg, setDeviceMemMsg] = useState("");
        const [idCopied, setIdCopied] = useState(false); // v5.24: ユーザーIDコピー用
        const [showPurchase, setShowPurchase] = useState(false); // v4.8: 購入ページ（Squareリンク一覧）
        const [isNewUser, setIsNewUser] = useState(() => new URLSearchParams(window.location.search).get('new') === '1');
        const [userEditUrls, setUserEditUrls] = useState([]);
        const [userEditDisplayName, setUserEditDisplayName] = useState("");
        // フェーズ3: プロフィール初期値は normalizeProfile(null) に一本化（3重定義を解消）
        const [userEditProfile, setUserEditProfile] = useState(() => normalizeProfile(null));
        const [editingProfile, setEditingProfile] = useState(() => normalizeProfile(null));
        const [editTab, setEditTab] = useState("info"); // "info" | "design" | "links"
        const [editOrigJSON, setEditOrigJSON] = useState(null); // dirty tracking snapshot
        const [adminEditTab, setAdminEditTab] = useState("info"); // admin panel user tab
        const [adminAllTags, setAdminAllTags] = useState({});
        const [adminTagMsg, setAdminTagMsg] = useState("");
        const [adminTagsDirty, setAdminTagsDirty] = useState(false);
        // タグ機能
        const [userEditTags, setUserEditTags] = useState([]);      // 編集中のタグ入力値
        const [mySavedTags, setMySavedTags] = useState([]);        // サーバー保存済みタグ（マッチ検索用）
        const [tagSaveMsg, setTagSaveMsg] = useState("");
        const [tagNextChange, setTagNextChange] = useState(0); // 次にタグ変更できる時刻(ms)。0=制限なし

        const showToast = (status, ms=3000) => {
          setToast(status);
          setTimeout(() => setToast(""), ms);
        };

        // ユーザー一覧 = サーバーデータ（admin_get_all）のキー。
        // フェーズ2: /api/names（存在しないAPI）とGitHubリポジトリ一覧からの名前推測を削除
        const loadNamesData = (currentUrlsData) =>
          Object.keys(currentUrlsData || {}).filter(n => n.length > 0);

        // OGPメタタグを動的に更新
        const updateOGP = (name, data) => {
          if (!name) return;
          const displayName = data.displayName || name;
          const imgUrl = `${getSiteBase()}image1_${name}.png`; // フェーズ4: 画像はpublic/配下からPagesで配信
          const pageUrl = `${getSiteBase()}#${data?.publicId || name}`;
          const setMeta = (sel, attr, content) => {
            const el = document.querySelector(sel);
            if (el) el.setAttribute('content', content);
          };
          document.title = `${displayName} - デジタル名刺`;
          setMeta('meta[property="og:title"]', 'content', `${displayName} のデジタル名刺`);
          setMeta('meta[property="og:description"]', 'content', `${displayName} さんのデジタル名刺です`);
          setMeta('meta[property="og:image"]', 'content', imgUrl);
          setMeta('meta[property="og:url"]', 'content', pageUrl);
          setMeta('meta[name="twitter:image"]', 'content', imgUrl);
        };

        // ★ v5.9: 単一ユーザー取得（get_all廃止 — 全件吸い出し対策）
        //   id は内部名 / publicId のどちらでもGAS側で解決される
        const fetchUser = (id) => {
          if (!id) return;
          fetch(`${GAS_URL}?action=get_user&id=${encodeURIComponent(id)}&t=${Date.now()}`)
            .then(r => r.ok ? r.json() : null)
            .then(res => {
              if (!res || !res.user || !res.name) return;
              setUrlsData(prev => {
                const cur = prev[res.name] || {};
                const merged = { ...prev, [res.name]: {
                  ...res.user,
                  // ★ v5.15.1: hasPinSetはサーバー値が正（ローカル優先だと管理者のPINリセットが反映されないバグ）
                  hasPinSet: !!res.user.hasPinSet,
                  publicId:  res.user.publicId || cur.publicId || ""
                }};
                try { localStorage.setItem('meisi_urls_data', JSON.stringify(merged)); } catch {}
                return merged;
              });
              // publicIdでアクセスされた場合は内部名に解決
              setVariablePart(prev => (prev === id && res.name !== id) ? res.name : prev);
            })
            .catch(() => {
              try { const s = localStorage.getItem('meisi_urls_data'); if (s) setUrlsData(JSON.parse(s)); } catch {}
            });
        };

        useEffect(() => {
          // ★ v5.9: 旧GitHub方式の残骸（トークン・平文管理パス）をブラウザから掃除
          try {
            localStorage.removeItem('meisi_gh_token');
            localStorage.removeItem('meisi_admin_pass');
          } catch {}
          // ?new=1 をURLから削除（バナー表示後に不要）
          if (new URLSearchParams(window.location.search).get('new') === '1') {
            const params = new URLSearchParams(window.location.search);
            params.delete('new');
            const newSearch = params.toString();
            history.replaceState(null, '', window.location.pathname + (newSearch ? '?' + newSearch : ''));
          }
          const hash = window.location.hash.slice(1);
          const qid = new URLSearchParams(window.location.search).get('id');
          if (hash || qid) {
            setVariablePart(hash || qid);
            fetchUser(hash || qid); // 表示するカードのデータだけ取得
          } else {
            setIsAdminMode(true); // カードID指定なし → ボタンを押さずに管理者画面へ自動移行
          }
          window.addEventListener('hashchange', () => {
            const h = window.location.hash.slice(1);
            if (h) { setVariablePart(h); fetchUser(h); }
          });
        }, []);

        useEffect(() => {
          if (variablePart) { const pd = getPersonData(urlsData, variablePart); updateOGP(variablePart, pd); }
        }, [variablePart, urlsData]);

        // 管理画面: 編集対象ユーザーが変わったらタグの未保存状態をリセット
        useEffect(() => { setAdminTagsDirty(false); setAdminTagMsg(""); }, [editingUrlsName]);

        // publicId（zz+数字9桁等）のURLを内部名に解決
        useEffect(() => {
          if (!variablePart || urlsData[variablePart]) return;
          const entry = Object.entries(urlsData).find(([k, v]) => v?.publicId && v.publicId === variablePart);
          if (entry) setVariablePart(entry[0]);
        }, [variablePart, urlsData]);

        // ★ v5.9: 全ユーザーデータは管理者認証後にのみ取得（旧 get_all の代替）
        const fetchAllUsers = async (pass) => {
          try {
            const r = await gasPost({ action:"admin_get_all", adminPass: pass });
            if (r.success && r.users) {
              setUrlsData(prev => ({ ...prev, ...r.users }));
              setRegisteredNames(loadNamesData(r.users));
            }
          } catch {}
        };

        const fetchAllTags = async (pass) => {
          try {
            const r = await gasPost({ action:"admin_get_tags", adminPass: pass });
            if (r.success && r.tags) setAdminAllTags(r.tags);
          } catch {}
        };

        const handleLogin = async (e) => {
          e.preventDefault();
          const clean = passwordInput.trim().replace(/[Ａ-Ｚａ-ｚ０-９]/g, s => String.fromCharCode(s.charCodeAt(0) - 0xFEE0));
          const r = await gasPost({ action:"verify_admin", password:clean });
          if (r.success) {
            setIsLoggedIn(true); setAdminPassLocal(clean);
            sessionStorage.setItem('meisi_admin_pass', clean); // ★ タブを閉じると消える
            setError(""); setPasswordInput("");
            setMustChangePass(!!r.mustChange); // ★ 初期パスワードなら強制変更
            fetchAllUsers(clean);
            fetchAllTags(clean);
          } else { setError("正しいコードを入力してください"); setPasswordInput(""); }
        };

        const selectName = (name) => { setVariablePart(name); window.location.hash = name; setIsAdminMode(false); };

        /* ── PRO/FREE ワンクリック切り替え ── */
        const togglePlan = async (name) => {
          const pd = getPersonData(urlsData, name);
          const newPlan = pd.plan === "pro" ? "free" : "pro";
          setUrlsData(prev => { const n={...prev}; n[name]={...(n[name]||{}), plan:newPlan}; return n; });
          showToast("saving", 10000);
          try {
            const r = await gasPost({ action:"admin_toggle_plan", adminPass:adminPassLocal, name });
            if (r.success && r.plan) setUrlsData(prev => { const n={...prev}; n[name]={...(n[name]||{}), plan:r.plan}; return n; });
            showToast(r.success ? "saved" : "error");
          } catch { showToast("error"); }
        };

        /* ── +G ワンクリック切り替え ── */
        const togglePlusG = async (name) => {
          const pd = getPersonData(urlsData, name);
          const newPlusG = !pd.plusG;
          setUrlsData(prev => { const n={...prev}; n[name]={...(n[name]||{}), plusG:newPlusG}; return n; });
          showToast("saving", 10000);
          try {
            const r = await gasPost({ action:"admin_toggle_plusg", adminPass:adminPassLocal, name });
            if (r.success) setUrlsData(prev => { const n={...prev}; n[name]={...(n[name]||{}), plusG:r.plusG}; return n; });
            showToast(r.success ? "saved" : "error");
          } catch { showToast("error"); }
        };
        /* ── トライアル付与/終了（v5.17: days>0=付与・延長 / 0=終了） ── */
        const setTrial = async (name, days) => {
          showToast("saving", 10000);
          try {
            const r = await gasPost({ action:"admin_set_trial", adminPass:adminPassLocal, name, days });
            if (r.success) setUrlsData(prev => { const n={...prev}; n[name]={...(n[name]||{}), trialEnd:r.trialEnd||0}; return n; });
            showToast(r.success ? "saved" : "error");
          } catch { showToast("error"); }
        };
        /* ── 有料PROの期間設定（v4.8: days>0=今からN日 / 0=失効）── */
        const setPro = async (name, days) => {
          showToast("saving", 10000);
          try {
            const r = await gasPost({ action:"admin_set_pro", adminPass:adminPassLocal, name, days });
            if (r.success) setUrlsData(prev => { const n={...prev}; n[name]={...(n[name]||{}), proEnd:r.proEnd||0}; return n; });
            showToast(r.success ? "saved" : "error");
          } catch { showToast("error"); }
        };
        /* ── 管理パスワード変更（GASにハッシュ保存・8文字以上） ── */
        const changePassword = async () => {
          const newPass = newPassInput.trim();
          if (!newPass) return;
          if (newPass.length < 8) { setPassMsg("8文字以上にしてください"); setTimeout(() => setPassMsg(""), 3000); return false; }
          if (newPass === "admin123") { setPassMsg("初期パスワードは使用できません"); setTimeout(() => setPassMsg(""), 3000); return false; }
          try {
            const r = await gasPost({ action:"save_admin_pass", currentPass: adminPassLocal, password: newPass });
            if (r.success) {
              setAdminPassLocal(newPass);
              sessionStorage.setItem('meisi_admin_pass', newPass);
              setMustChangePass(false);
              showToast("saved");
              setPassMsg("✓ 変更しました（全デバイスに反映）");
              setNewPassInput("");
              setTimeout(() => setPassMsg(""), 3000);
              return true;
            } else {
              setPassMsg(r.error || "エラーが発生しました");
              setTimeout(() => setPassMsg(""), 4000);
              return false;
            }
          } catch { showToast("error"); }
          return false;
        };


        /* ── ユーザー自身が名刺を編集 ── */
        const openUserEditDirect = () => {
          const pd = getPersonData(urlsData, variablePart);
          const knownSNS = (v) => SNS_LIST.some(s => s.value === v && s.value !== "" && s.value !== "__custom__");
          const padded = [...pd.links, ...Array(PRO_LINK_LIMIT).fill(null)].slice(0, PRO_LINK_LIMIT)
            .map(e => e ? {url:e.url||"", label:e.label||"", _custom:!knownSNS(e.label) && e.label !== ""} : {url:"",label:"",_custom:false});
          setUserEditUrls(padded);
          setUserEditDisplayName(pd.displayName || "");
          const newProf = normalizeProfile(pd.profile); // pd.profileは正規化済みだが防御的に再適用

          setUserEditProfile(newProf);
          setEditOrigJSON(JSON.stringify(newProf) + JSON.stringify(padded));
          setEditTab("info");
          setTagSaveMsg("");
          setShowUserEdit(true);
        };

        /* ── タグ保存（専用アクション — 他フィールドに影響しない） ── */
        const saveMyTags = async () => {
          const pd = getPersonData(urlsData, variablePart);
          const limit = isPro(pd) ? PRO_TAG_LIMIT : FREE_TAG_LIMIT;
          const cleaned = [];
          const seen = new Set();
          for (const raw of userEditTags.slice(0, limit)) {
            const t = normalizeTag(raw);
            if (!t || seen.has(t)) continue;
            if (t.length > TAG_MAX_LEN) { setTagSaveMsg(`タグは${TAG_MAX_LEN}文字以内にしてください`); return; }
            seen.add(t); cleaned.push(t);
          }
          // 保存前の確認（毎回表示）
          if (cleaned.length > 0) {
            const allWarn = cleaned.includes("all")
              ? "【全体公開ON】全体公開中のすべての利用者にあなたの表示名と名刺リンクが表示されます。\n"
              : "";
            if (!(await appConfirm(allWarn + "タグを保存すると、同じタグを設定している他のユーザーに、あなたの表示名と名刺リンクが公開されます。\n保存後24時間はタグを変更できません（削除はいつでも可能）。よろしいですか？"))) return;
          } else if (mySavedTags.length > 0) {
            if (!(await appConfirm("タグをすべて削除しますか？（削除はいつでも可能です）"))) return;
          }
          setTagSaveMsg("保存中…");
          try {
            const r = await gasPost({ action:"save_tags", name:variablePart, token:pinAuthToken, tags:cleaned });
            if (r.success) {
              setMySavedTags(r.tags || []);
              setUserEditTags(r.tags || []);
              setTagNextChange(r.nextChangeAt || 0);
              setTagCounts(r.counts || {});
              setShowCardTags(false); setCardTagMatches(null); // 次回開いた時に再取得
              setTagSaveMsg("✓ タグを保存しました。カード画面の「タグ仲間」ボタンから確認できます");
              setTimeout(() => setTagSaveMsg(""), 5000);
            } else {
              if (r.nextChangeAt) setTagNextChange(r.nextChangeAt);
              setTagSaveMsg(r.error || "エラーが発生しました");
            }
          } catch { setTagSaveMsg("通信エラー"); }
        };

        /* ── 端末記憶トークン（30日セッション） ── */
        const tokenKey = (name) => 'meisi_token_' + name;
        const tryStoredToken = async () => {
          const tok = localStorage.getItem(tokenKey(variablePart));
          if (!tok) return null;
          try {
            const r = await gasPost({ action:"get_my_tags", name:variablePart, token:tok });
            if (r.success) return { token: tok, tags: r.tags || [], nextChangeAt: r.nextChangeAt || 0, counts: r.counts || {} };
          } catch { return null; } // 通信エラー時はトークンを消さない
          localStorage.removeItem(tokenKey(variablePart)); // 無効・期限切れ
          return null;
        };
        const forgetDevice = () => {
          localStorage.removeItem(tokenKey(variablePart));
          setPinAuthToken(null);
          setDeviceMemMsg("✓ この端末の記憶を消しました。次回からPIN入力が必要です");
          setTimeout(() => setDeviceMemMsg(""), 4000);
        };

        /* ── カード画面: タグ仲間の一覧（並列取得・各タグランダム5名まで） ── */
        const loadCardTagMatches = async (token, tags) => {
          const pd = getPersonData(urlsData, variablePart);
          const friendsLimit = isPro(pd) ? TAG_FRIENDS_PRO : TAG_FRIENDS_FREE; // v5.15: プラン差別化
          const active = (tags || []).slice(0, isPro(pd) ? PRO_TAG_LIMIT : FREE_TAG_LIMIT);
          const entries = await Promise.all(active.map(async (tag) => {
            try {
              const r = await gasPost({ action:"get_users_by_tag", name:variablePart, token, tag });
              return [tag, r.success ? shuffleArr(r.users || []).slice(0, friendsLimit) : []];
            } catch { return [tag, []]; }
          }));
          setCardTagMatches(Object.fromEntries(entries));
          setShowCardTags(true);
        };
        const openTagFriends = async () => {
          if (cardTagBusy) return;
          if (showCardTags) { setShowCardTags(false); return; } // 開いていれば閉じる
          if (/^zz\d{9}$/.test(variablePart) && !urlsData[variablePart]) {
            appAlert("データを読み込んでいます。数秒待ってからもう一度お試しください。");
            return;
          }
          setCardTagBusy(true);
          try {
            const st = await tryStoredToken();
            if (st) {
              setPinAuthToken(st.token);
              await loadCardTagMatches(st.token, st.tags);
            } else {
              // 記憶なし → PIN認証（成功後にタグ仲間を表示）
              setPinModalPurpose("tags");
              setPinInput(""); setPinError(""); setPinBusy(false); setShowPinModal(true);
            }
          } catch {}
          setCardTagBusy(false);
        };

        const openUserEdit = async () => {
          // publicId（zz+9桁）が内部名に未解決のまま編集に入ると、存在しないID宛に
          // PIN設定・保存が走ってしまうためブロック
          if (/^zz\d{9}$/.test(variablePart) && !urlsData[variablePart]) {
            appAlert("データを読み込んでいます。数秒待ってからもう一度お試しください。");
            return;
          }
          if (editOpening) return;
          setEditOpening(true);
          // 端末記憶トークンがあればPIN入力をスキップ
          try {
            const st = await tryStoredToken();
            if (st) {
              setPinAuthToken(st.token);
              setMySavedTags(st.tags); setUserEditTags(st.tags); setTagNextChange(st.nextChangeAt || 0);
              setTagCounts(st.counts || {});
              openUserEditDirect();
              setEditOpening(false);
              return;
            }
          } catch {}
          setPinModalPurpose("edit");
          // ★ v5.9: check_pin_set（無認証の存在オラクル）は廃止。
          //   get_user で取得済みの hasPinSet で判断。古い場合も set_initial_pin が
          //   「既に設定済み」を返し認証モーダルへ自動で切り替わるため安全。
          const pd = getPersonData(urlsData, variablePart);
          if (pd?.hasPinSet) {
            setPinInput(""); setPinError(""); setPinBusy(false); setShowPinModal(true);
          } else {
            setPinSetupInput(""); setPinSetupConfirm(""); setPinSetupMsg(""); setPinBusy(false); setShowPinSetup(true);
          }
          setEditOpening(false);
        };
        const handlePinVerify = async (pinOverride) => {
          if (pinBusy) return;
          const pin = typeof pinOverride === "string" ? pinOverride : pinInput;
          if (pin.length !== 6) return;
          setPinBusy(true);
          try {
            const r = await gasPost({ action:"verify_pin", name:variablePart, pin });
            if (r.success) {
              localStorage.setItem(tokenKey(variablePart), r.token); // 端末に30日記憶
              setPinAuthToken(r.token);
              setShowPinModal(false); setPinInput(""); setPinError("");
              if (pinModalPurpose === "tags") {
                // タグ仲間表示が目的 → 編集パネルは開かずに一覧表示
                const tr = await gasPost({ action:"get_my_tags", name:variablePart, token:r.token });
                await loadCardTagMatches(r.token, tr.success ? (tr.tags || []) : []);
              } else {
                // 自分のタグを取得
                gasPost({ action:"get_my_tags", name:variablePart, token:r.token }).then(tr => {
                  if (tr.success) { setMySavedTags(tr.tags || []); setUserEditTags(tr.tags || []); setTagNextChange(tr.nextChangeAt || 0); setTagCounts(tr.counts || {}); }
                });
                openUserEditDirect();
              }
            } else { setPinError(r.error || "PINが違います"); setPinInput(""); } // ★ ロックアウト等のメッセージも表示
          } catch { setPinError("通信エラーが発生しました"); }
          setPinBusy(false);
        };

        /* ── PIN初回設定の送信（自動送信・ボタン共通） ── */
        const submitInitialPin = async (pinVal, confirmVal) => {
          if (pinBusy) return;
          if (pinVal.length !== 6) { setPinSetupMsg("6桁で入力してください"); return; }
          if (pinVal !== confirmVal) { setPinSetupMsg("PINが一致しません"); return; }
          setPinBusy(true);
          try {
            const r = await gasPost({ action:"set_initial_pin", name:variablePart, pin:pinVal });
            if (r.success) {
              localStorage.setItem(tokenKey(variablePart), r.token); // 端末に30日記憶
              setPinAuthToken(r.token);
              setMySavedTags([]); setUserEditTags([]);
              setShowPinSetup(false);
              setUrlsData(prev => {
                const updated = { ...prev, [variablePart]: { ...prev[variablePart], hasPinSet: true } };
                localStorage.setItem('meisi_urls_data', JSON.stringify(updated));
                return updated;
              });
              openUserEditDirect();
            } else if (r.error && r.error.includes("既に設定")) {
              // PINがGASに既に保存済み → 認証モーダルへ切り替え
              setUrlsData(prev => {
                const updated = { ...prev, [variablePart]: { ...prev[variablePart], hasPinSet: true } };
                localStorage.setItem('meisi_urls_data', JSON.stringify(updated));
                return updated;
              });
              setShowPinSetup(false);
              setPinInput(""); setPinError(""); setShowPinModal(true);
            } else { setPinSetupMsg(r.error || "エラーが発生しました"); }
          } catch { setPinSetupMsg("通信エラーが発生しました"); }
          setPinBusy(false);
        };
        const savePinChange = async () => {
          const newPin = pinChangeInput.trim();
          if (!/^\d{6}$/.test(newPin)) { setPinChangeMsg("6桁の数字で入力してください"); return; }
          try {
            const r = await gasPost({ action:"change_pin", name:variablePart, token:pinAuthToken, newPin });
            if (r.success) { setPinChangeInput(""); setPinChangeMsg("✓ PINを変更しました"); setTimeout(()=>setPinChangeMsg(""),3000); }
            else { setPinChangeMsg(r.error || "エラーが発生しました"); }
          } catch { setPinChangeMsg("エラーが発生しました"); }
        };

        // ── GAS POST ヘルパー ──
        const gasPost = async (payload) => {
          const res = await fetch(GAS_URL, {
            method: "POST",
            body: JSON.stringify(payload)
          });
          return res.ok ? res.json() : { error: "network error" };
        };

        const saveUserLinks = async () => {
          const pd = getPersonData(urlsData, variablePart);
          const pro = isPro(pd);
          const allLinks = userEditUrls.map(e => ({url: e.url||"", label: e.label||""}))
            .map(normalizeEntry).filter(u => u.url);
          const links = pro
            ? allLinks
            : [...allLinks.slice(0, FREE_LINK_LIMIT), ...pd.links.slice(FREE_LINK_LIMIT)];
          const effectiveDisplayName = userEditDisplayName || (!isPro(pd) && userEditProfile.name ? userEditProfile.name : "");
          // ...pd で hasPinSet / publicId / plusG 等の既存フィールドを保持（上書き消失防止）
          const personObj = { ...pd, displayName: effectiveDisplayName, plan: pd.plan || "free", links, profile: userEditProfile, pin: pd.pin || "" };
          const newData = { ...urlsData, [variablePart]: personObj };
          setUrlsData(newData);
          localStorage.setItem('meisi_urls_data', JSON.stringify(newData));
          setShowUserEdit(false);
          setEditOrigJSON(null);
          // トークンは破棄しない（端末記憶で30日有効 — 「この端末の記憶を消す」で破棄可能）
          showToast("saving", 15000);
          try {
            const r = await gasPost({ action:"save_user_profile", name:variablePart, token:pinAuthToken, displayName:effectiveDisplayName, links, profile:userEditProfile });
            showToast(r.success ? "saved" : "error");
          } catch { showToast("error"); }
        };

        const saveUrls = async (name, displayName, urls, profile) => {
          const pd = getPersonData(urlsData, name);
          const personIsPro = isPro(pd);
          const allLinks = urls.map(e => ({url: e.url||"", label: e.label||""}))
            .map(normalizeEntry).filter(u => u.url);
          const existingLinks = pd.links;
          const links = personIsPro
            ? allLinks
            : [...allLinks.slice(0, FREE_LINK_LIMIT), ...existingLinks.slice(FREE_LINK_LIMIT)];
          // ...pd で hasPinSet / publicId 等の既存フィールドを保持（上書き消失防止）
          const personObj = { ...pd, displayName, plan: pd.plan || "free", links, profile: profile || pd.profile, pin: pd.pin || "" };
          const newData = { ...urlsData, [name]: personObj };
          setUrlsData(newData);
          localStorage.setItem('meisi_urls_data', JSON.stringify(newData));
          setEditingUrlsName(null);
          setEditingDisplayName("");
          setEditingUrls([{ url:"", label:"", _custom:false }]);
          showToast("saving", 30000);
          try {
            const r = await gasPost({ action:"admin_save_user", adminPass:adminPassLocal, name, displayName:personObj.displayName, licenseKey:personObj.licenseKey, links:personObj.links, plan:personObj.plan, profile:personObj.profile, plusG:personObj.plusG });
            showToast(r.success ? "saved" : "error");
          } catch { showToast("error"); }
        };

        /* ── テーマカラー（カード画面全体）v5.16 — 編集中はリアルタイムプレビュー ── */
        const themePd = (!isAdminMode && variablePart) ? getPersonData(urlsData, variablePart) : null;
        const cardTheme = themePd
          ? getCardTheme((showUserEdit ? userEditProfile : themePd.profile)?.themeColor, isPro(themePd))
          : null;

        return (
          <div className="min-h-screen p-4 sm:p-8 md:p-12" style={{ zoom: UI_ZOOMS[uiZoomIdx], ...(cardTheme ? { background: cardTheme.pageBg } : {}) }}>
            <Toast status={toast} />
            <DialogHost /> {/* v5.19: 独自確認ダイアログ（ブラウザ標準confirmのサイト名表示を排除） */}
            <div className="max-w-xl mx-auto">
              <header className="mb-10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <h1><img src={`${getSiteBase()}01_NEXUA_dark.png`} alt="NEXUA（ネクア）" className="h-5 w-auto" /></h1>
                  <p className="text-[10px] font-mono text-neutral-400 mt-0.5 uppercase tracking-widest">
                    {variablePart ? `Viewing: ${variablePart}` : "Management System"}
                  </p>
                </div>
                {/* v4.8: カード画面では非表示（編集画面・購入モーダルに移設）。管理画面のみ表示 */}
                {!variablePart && (
                <div className="flex flex-col items-start sm:items-end gap-2 w-full sm:w-auto">
                  <p className="text-[9px] text-neutral-400 font-mono uppercase tracking-widest">あなたもデジタル名刺を作りませんか？</p>
                  <div className="flex flex-wrap gap-2">
                    <motion.a href="https://furetomojapan.github.io/meishi/welcome.html" target="_blank" rel="noopener noreferrer"
                      whileHover={{scale:1.05}} whileTap={{scale:0.95}}
                      className="px-4 py-2 bg-black text-white rounded-full text-xs font-medium shadow-lg hover:shadow-xl transition-all">
                      私もデジタル名刺を作りたい！
                    </motion.a>
                    <motion.a href="https://laxuz.xyz/furetomo/" target="_blank" rel="noopener noreferrer"
                      whileHover={{scale:1.05}} whileTap={{scale:0.95}}
                      className="px-4 py-2 bg-neutral-200 text-black rounded-full text-xs font-medium shadow-lg hover:shadow-xl hover:bg-neutral-300 transition-all">
                      デジタルカードを作りたい
                    </motion.a>
                  </div>
                </div>
                )}
              </header>

              <AnimatePresence mode="wait">
                {isAdminMode ? (
                  <motion.div key="admin" initial={{opacity:0,scale:0.98}} animate={{opacity:1,scale:1}} exit={{opacity:0,scale:0.98}}
                    className="py-10 bg-neutral-950 rounded-[40px] shadow-2xl border border-neutral-800">
                    {!isLoggedIn ? (
                      <div className="w-full max-w-sm mx-auto p-8">
                        <h2 className="text-[10px] font-semibold mb-8 text-center text-neutral-500 tracking-[0.2em] uppercase">Security Access</h2>
                        <form onSubmit={handleLogin} className="space-y-4">
                          <input type="password" value={passwordInput} onChange={e => setPasswordInput(e.target.value)}
                            placeholder="管理者パスワード" autoFocus
                            className="w-full px-4 py-4 bg-neutral-900 border border-neutral-800 rounded-2xl focus:outline-none focus:border-neutral-600 text-sm text-center tracking-widest text-white placeholder:text-neutral-700" />
                          {error && <p className="text-[10px] text-red-400 text-center">{error}</p>}
                          <button type="submit" className="w-full py-4 bg-white text-black rounded-2xl text-[10px] font-bold uppercase tracking-[0.2em] hover:bg-neutral-200 transition-all">Verify</button>
                          <button type="button" onClick={() => setIsAdminMode(false)} className="w-full text-[10px] text-neutral-600 hover:text-neutral-400 uppercase tracking-widest transition-colors">Cancel</button>
                        </form>
                      </div>
                    ) : (
                      <div className="w-full px-6 md:px-8">
                        {/* ★ v5.9: 初期パスワード(admin123)のまま → 強制変更モーダル */}
                        {mustChangePass && (
                          <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-center justify-center p-6">
                            <div className="w-full max-w-sm bg-neutral-900 border border-amber-500/40 rounded-2xl p-6 space-y-4">
                              <p className="text-xs font-bold text-amber-400 uppercase tracking-widest">⚠️ パスワード変更が必要です</p>
                              <p className="text-[11px] text-neutral-300 leading-relaxed">初期パスワード（admin123）のままでは管理画面を利用できません。新しいパスワード（8文字以上）を設定してください。</p>
                              <input type="password" value={newPassInput} onChange={e => setNewPassInput(e.target.value)}
                                placeholder="新しいパスワード（8文字以上）" autoFocus
                                className="w-full px-4 py-3 bg-neutral-800 border border-neutral-700 rounded-xl focus:outline-none focus:border-amber-500 text-sm text-white placeholder:text-neutral-600" />
                              {passMsg && <p className={`text-[10px] ${passMsg.startsWith("✓") ? 'text-green-400' : 'text-red-400'}`}>{passMsg}</p>}
                              <button onClick={changePassword} disabled={newPassInput.trim().length < 8}
                                className="w-full py-3 bg-amber-500 text-black rounded-xl text-[11px] font-bold uppercase tracking-widest hover:bg-amber-400 transition-all disabled:opacity-30">変更して続行</button>
                              <button onClick={() => { setMustChangePass(false); setIsLoggedIn(false); setAdminPassLocal(""); sessionStorage.removeItem('meisi_admin_pass'); }}
                                className="w-full text-[10px] text-neutral-600 hover:text-neutral-400 uppercase tracking-widest">ログアウト</button>
                            </div>
                          </div>
                        )}
                        <div className="flex justify-between items-center mb-6 px-2">
                          <div className="flex items-center gap-2">
                            <h2 className="text-xs font-semibold text-white uppercase tracking-widest">Library</h2>
                            <span className="text-[9px] font-mono text-white bg-neutral-900 border border-neutral-700 px-2 py-0.5 rounded-full">{APP_VERSION}</span>
                          </div>
                          <div className="flex gap-6 items-center">
                            <button onClick={() => fetchAllUsers(adminPassLocal)}
                              className="text-[10px] text-neutral-500 hover:text-white uppercase tracking-widest transition-colors flex items-center gap-2">
                              <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/></svg>Sync
                            </button>
                            <button onClick={() => setIsLoggedIn(false)} className="text-[10px] text-neutral-600 hover:text-red-400 uppercase tracking-widest transition-colors">Logout</button>
                          </div>
                        </div>

                        {/* ── 新規ユーザー追加 ── */}
                        <div className="mb-6 p-4 bg-neutral-900 border border-neutral-700 rounded-2xl">
                          <p className="text-[9px] text-neutral-500 uppercase tracking-widest mb-2">新規ユーザー追加</p>
                          <p className="text-[9px] text-neutral-600 mb-3">ID（半角英数・アンダースコア可）を入力してFREEユーザーを作成します。<br/>例: <span className="font-mono text-neutral-500">tanaka_hanako</span></p>
                          <div className="flex gap-2">
                            <input type="text" value={newUserInput}
                              onChange={e => setNewUserInput(e.target.value.replace(/[^a-zA-Z0-9_]/g,""))}
                              placeholder="user_id"
                              className="flex-1 px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-xl focus:outline-none focus:border-neutral-500 text-xs text-white font-mono placeholder:text-neutral-600" />
                            <button
                              disabled={!newUserInput.trim() || registeredNames.includes(newUserInput.trim())}
                              onClick={async () => {
                                const id = newUserInput.trim();
                                if (!id || registeredNames.includes(id)) return;
                                const personObj = { displayName:"", plan:"free", plusG:false, licenseKey:"", links:[], profile: normalizeProfile(null), hasPinSet: false };
                                const newData = { ...urlsData, [id]: personObj };
                                setUrlsData(newData);
                                localStorage.setItem('meisi_urls_data', JSON.stringify(newData));
                                setRegisteredNames(prev => [...prev, id]);
                                setNewUserInput("");
                                showToast("saving", 10000);
                                try {
                                  const r = await gasPost({ action:"admin_create_user", adminPass:adminPassLocal, name:id });
                                  showToast(r.success ? "saved" : "error");
                                } catch { showToast("error"); }
                              }}
                              className="px-4 py-2 bg-white text-black rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-neutral-200 transition-all disabled:opacity-30 disabled:cursor-not-allowed">
                              追加
                            </button>
                          </div>
                          {newUserInput && registeredNames.includes(newUserInput) && (
                            <p className="text-[9px] text-red-400 mt-1">このIDはすでに存在します</p>
                          )}
                        </div>

                        {registeredNames.length > 0 && (
                          <div className="relative">
                            <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-600 pointer-events-none" xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                            <input
                              type="text"
                              value={adminSearch}
                              onChange={e => setAdminSearch(e.target.value)}
                              placeholder="IDまたは名前で検索..."
                              className="w-full pl-8 pr-3 py-2 bg-neutral-800 border border-neutral-700 rounded-xl text-xs text-white placeholder:text-neutral-600 focus:outline-none focus:border-neutral-500"
                            />
                            {adminSearch && (
                              <button onClick={() => setAdminSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-white">
                                <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                              </button>
                            )}
                          </div>
                        )}

                        {registeredNames.length === 0 ? (
                          <div className="py-20 text-center bg-neutral-900/50 rounded-3xl border border-dashed border-neutral-800">
                            <p className="text-xs text-neutral-400 mb-3">ユーザーがいません。上から追加してください。</p>
                          </div>
                        ) : (() => {
                          const q = adminSearch.trim().toLowerCase();
                          const filtered = [...registeredNames].reverse().filter(name => {
                            if (!q) return true;
                            const pd = getPersonData(urlsData, name);
                            return name.toLowerCase().includes(q) || (pd.displayName || "").toLowerCase().includes(q) || (pd.publicId || "").toLowerCase().includes(q);
                          });
                          return filtered.length === 0 ? (
                            <div className="py-12 text-center bg-neutral-900/50 rounded-3xl border border-dashed border-neutral-800">
                              <p className="text-xs text-neutral-500">「{adminSearch}」に一致するユーザーがいません</p>
                            </div>
                          ) : (
                          <div className="space-y-3">
                            {filtered.map(name => {
                              const pd = getPersonData(urlsData, name);
                              return (
                                <div key={name} className="space-y-2">
                                  <div className="flex gap-2">
                                    <button onClick={() => selectName(name)}
                                      className={`flex-1 flex items-center justify-between px-4 py-4 rounded-2xl border text-xs transition-all ${variablePart === name ? 'bg-white text-black border-white shadow-xl' : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:border-neutral-600 hover:text-white'}`}>
                                      <div className="text-left">
                                        <p className="font-medium tracking-wide">{pd.displayName || name}</p>
                                        {pd.displayName && <p className="text-[9px] opacity-40 font-mono mt-0.5">{name}</p>}
                                        {pd.publicId && <p className="text-[9px] opacity-60 font-mono mt-0.5">ID: {pd.publicId}</p>}
                                        <div className="flex items-center gap-1.5 mt-1">
                                          <span className="text-[9px] font-mono tracking-widest opacity-60">
                                            PIN: {pd.hasPinSet ? "設定済み" : "未設定"}
                                          </span>
                                        </div>
                                      </div>
                                      <span className="text-[9px] opacity-40 font-bold uppercase tracking-tighter">View</span>
                                    </button>
                                    {/* PRO/FREE トグル */}
                                    <button onClick={() => togglePlan(name)}
                                      className={`px-3 rounded-2xl border text-[9px] font-bold uppercase tracking-wider transition-all ${pd.plan === "pro" ? 'bg-amber-400 border-amber-400 text-black hover:bg-amber-300' : 'bg-neutral-900 border-neutral-800 text-neutral-600 hover:border-amber-400 hover:text-amber-400'}`}>
                                      {pd.plan === "pro" ? "PRO" : "FREE"}
                                    </button>
                                    {/* +G トグル */}
                                    <button onClick={() => togglePlusG(name)}
                                      className={`px-3 rounded-2xl border text-[9px] font-bold tracking-wider transition-all ${pd.plusG ? 'bg-red-500 border-red-500 text-white hover:bg-red-400' : 'bg-neutral-900 border-neutral-800 text-neutral-600 hover:border-red-400 hover:text-red-400'}`}>
                                      +G
                                    </button>
                                    {/* トライアル期間の調整（v5.21: プリセット＋任意日数） */}
                                    {(() => { const d = trialDaysLeft(pd); return (
                                      <button onClick={async () => {
                                        const days = await appPrompt({
                                          message: `「${pd.displayName || name}」のPRO+＋Gお試し期間を設定します。\n現在: ${d > 0 ? `残り約${d}日` : 'なし'}\n（設定すると「今日からその日数」に上書きされます。0で終了）`,
                                          inputLabel: "日数",
                                          unit: "日",
                                          default: d > 0 ? String(d) : "7",
                                        });
                                        if (days === null) return;
                                        setTrial(name, days);
                                      }}
                                        className={`px-3 rounded-2xl border text-[9px] font-bold tracking-wider whitespace-nowrap transition-all ${d > 0 ? 'bg-emerald-500 border-emerald-500 text-black hover:bg-emerald-400' : 'bg-neutral-900 border-neutral-800 text-neutral-600 hover:border-emerald-400 hover:text-emerald-400'}`}>
                                        {d > 0 ? `試${d}日` : '試用'}
                                      </button>
                                    ); })()}
                                    {/* v4.8: 有料PROの期間設定（1/3/6/12ヶ月・終了） */}
                                    {(() => { const pdl = proDaysLeft(pd); return (
                                      <button onClick={async () => {
                                        const days = await appPrompt({
                                          message: `「${pd.displayName || name}」の有料PRO有効期限を設定します。\n現在: ${pdl > 0 ? `残り約${pdl}日` : 'なし'}\n（「今日からその日数」に上書き。0で失効。＋Gは別管理）`,
                                          presets: [
                                            { label: "1ヶ月", value: 30 }, { label: "3ヶ月", value: 90 },
                                            { label: "6ヶ月", value: 180 }, { label: "1年", value: 365 },
                                            { label: "失効(0)", value: 0, danger: true },
                                          ],
                                          inputLabel: "日数",
                                          unit: "日",
                                          default: pdl > 0 ? String(pdl) : "180",
                                        });
                                        if (days === null) return;
                                        setPro(name, days);
                                      }}
                                        className={`px-3 rounded-2xl border text-[9px] font-bold tracking-wider whitespace-nowrap transition-all ${pdl > 0 ? 'bg-amber-500 border-amber-500 text-black hover:bg-amber-400' : 'bg-neutral-900 border-neutral-800 text-neutral-600 hover:border-amber-400 hover:text-amber-400'}`}>
                                        {pdl > 0 ? `PRO${pdl}日` : 'PRO期間'}
                                      </button>
                                    ); })()}
                                    <button
                                      onClick={() => {
                                        if (editingUrlsName === name) { setEditingUrlsName(null); return; }
                                        setEditingUrlsName(name);
                                        setAdminEditTab("info");
                                        setEditingDisplayName(pd.displayName);
                                        const knownSNS = (v) => SNS_LIST.some(s => s.value === v && s.value !== "" && s.value !== "__custom__");
                                        const padded = [...pd.links, ...Array(PRO_LINK_LIMIT).fill(null)].slice(0, PRO_LINK_LIMIT)
                                          .map(e => e ? {url:e.url||"", label:e.label||"", _custom:!knownSNS(e.label) && e.label !== ""} : {url:"",label:"",_custom:false});
                                        setEditingUrls(padded);
                                        setEditingProfile(normalizeProfile(pd.profile));
                                      }}
                                      className={`px-4 rounded-2xl border transition-all ${editingUrlsName === name ? 'bg-white text-black border-white' : 'bg-neutral-900 border-neutral-800 text-neutral-500 hover:border-neutral-600 hover:text-white'}`}>
                                      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                                    </button>
                                    {/* 削除ボタン */}
                                    <button
                                      onClick={async () => {
                                        if (!(await appConfirm(`「${pd.displayName || name}」を削除しますか？\nこの操作は元に戻せません。`))) return;
                                        const newData = { ...urlsData };
                                        delete newData[name];
                                        setUrlsData(newData);
                                        localStorage.setItem('meisi_urls_data', JSON.stringify(newData));
                                        setRegisteredNames(prev => prev.filter(n => n !== name));
                                        if (editingUrlsName === name) setEditingUrlsName(null);
                                        if (variablePart === name) setVariablePart(null);
                                        showToast("saving", 10000);
                                        try {
                                          const r = await gasPost({ action:"admin_delete_user", adminPass:adminPassLocal, name });
                                          showToast(r.success ? "saved" : "error");
                                        } catch { showToast("error"); }
                                      }}
                                      className="px-3 rounded-2xl border border-neutral-800 text-neutral-600 hover:border-red-500 hover:text-red-400 hover:bg-red-500/10 transition-all">
                                      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                                    </button>
                                  </div>

                                  {editingUrlsName === name && (() => {
                                    const personIsPro = isPro(pd) || trialDaysLeft(pd) > 0; // v5.17: お試し中はPRO扱い
                                    const AP = ({label, children}) => (
                                      <div className="flex items-center justify-between gap-2 mt-1.5">
                                        <span className="text-[8px] text-neutral-500 w-9 flex-shrink-0">{label}</span>
                                        <div className="flex-1 flex justify-end">{children}</div>
                                      </div>
                                    );
                                    return (
                                    <div className="bg-neutral-900 border border-neutral-700 rounded-2xl overflow-hidden">
                                      {/* ヘッダー */}
                                      <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-800">
                                        <span className={`text-[9px] font-bold uppercase tracking-widest px-3 py-1 rounded-full ${personIsPro ? 'bg-amber-400 text-black' : 'bg-neutral-700 text-neutral-400'}`}>
                                          {isPro(pd) ? '✦ PRO' : proDaysLeft(pd) > 0 ? `✦ PRO・残り${proDaysLeft(pd)}日` : trialDaysLeft(pd) > 0 ? `✦ お試し・残り${trialDaysLeft(pd)}日` : 'FREE'}
                                        </span>
                                        {!personIsPro && <span className="text-[9px] text-neutral-500">PROボタンでアップグレード可能</span>}
                                      </div>
                                      {/* タブバー */}
                                      <div className="flex border-b border-neutral-800 px-2">
                                        {[["info","情報"],["design","デザイン"],["links","リンク"],["tags","タグ"]].map(([id,label]) => (
                                          <button key={id} onClick={() => setAdminEditTab(id)}
                                            className={`px-3 py-2.5 text-[10px] font-semibold tracking-wide border-b-2 transition-colors ${adminEditTab===id ? 'border-white text-white' : 'border-transparent text-neutral-500 hover:text-neutral-300'}`}>
                                            {label}
                                          </button>
                                        ))}
                                      </div>
                                      {/* 凡例（色の意味）v5.20 */}
                                      <div className="px-4 pt-2"><PlanLegend dark /></div>
                                      {/* コンテンツ */}
                                      <div className="p-4 space-y-3">

                                        {/* ───── 情報タブ ───── */}
                                        {adminEditTab === "info" && (<>
                                          {/* PIN変更 */}
                                          <div className="pb-3 border-b border-neutral-800">
                                            <div className="flex items-center gap-2 mb-2">
                                              <p className="text-[9px] text-neutral-400 uppercase tracking-widest">PIN変更（6桁）</p>
                                              <span className="text-[9px] font-mono text-neutral-300 bg-neutral-800 border border-neutral-700 px-2 py-0.5 rounded">
                                                現在: {getPersonData(urlsData, editingUrlsName)?.hasPinSet ? "設定済み（表示不可）" : "未設定"}
                                              </span>
                                            </div>
                                            <div className="flex gap-2">
                                              <input type="tel" inputMode="numeric" maxLength={6}
                                                value={adminPinInput}
                                                onChange={e => { setAdminPinInput(e.target.value.replace(/\D/g,"")); setAdminPinMsg(""); }}
                                                placeholder="新しい6桁PIN"
                                                className="flex-1 px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-xl focus:outline-none focus:border-neutral-500 text-xs text-white font-mono tracking-widest text-center placeholder:text-neutral-600" />
                                              <button disabled={adminPinInput.length !== 6}
                                                onClick={async () => {
                                                  const n2 = editingUrlsName;
                                                  try {
                                                    const r = await gasPost({ action:"admin_set_pin", adminPass:adminPassLocal, name:n2, pin:adminPinInput });
                                                    if (r.success) {
                                                      setUrlsData(prev => ({ ...prev, [n2]: { ...prev[n2], hasPinSet: true } }));
                                                      setAdminPinInput(""); setAdminPinMsg("✓ 変更しました"); setTimeout(()=>setAdminPinMsg(""),3000);
                                                    } else { setAdminPinMsg(r.error||"エラー"); }
                                                  } catch { setAdminPinMsg("エラー"); }
                                                }}
                                                className="px-3 py-2 bg-neutral-700 text-white rounded-xl text-[10px] font-bold hover:bg-white hover:text-black transition-all disabled:opacity-30">変更</button>
                                              <button
                                                onClick={async () => {
                                                  const n2 = editingUrlsName;
                                                  if (!(await appConfirm(`${pd.displayName || n2} のPINをリセットしますか？\nユーザーは次回アクセス時に新しいPINを設定します。`))) return;
                                                  try {
                                                    const r = await gasPost({ action:"admin_reset_pin", adminPass:adminPassLocal, name:n2 });
                                                    if (r.success) {
                                                      setUrlsData(prev => {
                                                        const updated = { ...prev, [n2]: { ...prev[n2], hasPinSet: false } };
                                                        localStorage.setItem('meisi_urls_data', JSON.stringify(updated));
                                                        return updated;
                                                      });
                                                      setAdminPinMsg("✓ リセットしました"); setTimeout(()=>setAdminPinMsg(""),3000);
                                                    } else { setAdminPinMsg(r.error||"エラー"); }
                                                  } catch { setAdminPinMsg("エラー"); }
                                                }}
                                                className="px-3 py-2 bg-red-900 text-red-300 rounded-xl text-[10px] font-bold hover:bg-red-500 hover:text-white transition-all">リセット</button>
                                            </div>
                                            {adminPinMsg && <p className="text-[10px] text-green-400 mt-1">{adminPinMsg}</p>}
                                          </div>
                                          {/* 表示名 */}
                                          <div className="pb-3 border-b border-neutral-800">
                                            <p className="text-[9px] text-neutral-400 uppercase tracking-widest mb-1.5">表示名</p>
                                            <input type="text" value={editingDisplayName} onChange={e => setEditingDisplayName(e.target.value)}
                                              placeholder="例：鈴木 一郎"
                                              className="w-full px-3 py-2.5 bg-neutral-800 border border-neutral-700 rounded-xl focus:outline-none focus:border-neutral-500 text-xs text-white placeholder:text-neutral-600" />
                                          </div>
                                          {/* フェーズ3: 文字入力はユーザー編集と共通（ProfileTextFields） */}
                                          <ProfileTextFields profile={editingProfile} setProfile={setEditingProfile} dark />
                                        </>)}

                                        {/* ───── デザインタブ ───── */}
                                        {adminEditTab === "design" && (<>
                                          {!personIsPro && <div className="text-[10px] bg-amber-500/10 text-amber-400 px-3 py-2 rounded-xl border border-amber-500/20">フォント・サイズ・位置はPROで利用可能</div>}
                                          {/* テーマカラー（カード画面全体）v5.16 */}
                                          <div className="border-b border-neutral-800 pb-3">
                                            <p className="text-[9px] text-neutral-300 font-semibold uppercase tracking-widest mb-2">テーマカラー（画面全体）</p>
                                            <ThemePicker dark pro={personIsPro} selected={editingProfile.themeColor || ""} onSelect={themeColor => setEditingProfile(p => ({...p,themeColor}))} />
                                          </div>
                                          <PlanBox kind="pro" dark label="文字スタイル（フォント・サイズ・色・位置）" className="px-3 pb-1">
                                          <div className="border-b border-neutral-800 pb-3">
                                            <div className="flex items-center justify-between mb-1.5">
                                              <p className="text-[9px] text-neutral-300 font-semibold uppercase tracking-widest">会社名</p>
                                              <AlignPicker dark disabled={!personIsPro} selected={editingProfile.companyAlign} onSelect={v => setEditingProfile(p => ({...p,companyAlign:v}))} />
                                            </div>
                                            <AP label="フォント"><FontPicker dark disabled={!personIsPro} selected={editingProfile.companyFont??0} onSelect={v => setEditingProfile(p => ({...p,companyFont:v}))} /></AP>
                                            <AP label="サイズ"><SizePicker dark disabled={!personIsPro} selected={editingProfile.companyFontSize||"S"} onSelect={v => setEditingProfile(p => ({...p,companyFontSize:v}))} /></AP>
                                          </div>
                                          <div className="border-b border-neutral-800 pb-3">
                                            <div className="flex items-center justify-between mb-1.5">
                                              <p className="text-[9px] text-neutral-300 font-semibold uppercase tracking-widest">肩書き</p>
                                              <AlignPicker dark disabled={!personIsPro} selected={editingProfile.titleAlign} onSelect={v => setEditingProfile(p => ({...p,titleAlign:v}))} />
                                            </div>
                                            <AP label="フォント"><FontPicker dark disabled={!personIsPro} selected={editingProfile.titleFont??0} onSelect={v => setEditingProfile(p => ({...p,titleFont:v}))} /></AP>
                                            <AP label="サイズ"><SizePicker dark disabled={!personIsPro} selected={editingProfile.titleFontSize||"S"} onSelect={v => setEditingProfile(p => ({...p,titleFontSize:v}))} /></AP>
                                          </div>
                                          <div className="border-b border-neutral-800 pb-3">
                                            <div className="flex items-center justify-between mb-1.5">
                                              <p className="text-[9px] text-neutral-300 font-semibold uppercase tracking-widest">名前</p>
                                              <AlignPicker dark disabled={!personIsPro} selected={editingProfile.nameAlign} onSelect={v => setEditingProfile(p => ({...p,nameAlign:v}))} />
                                            </div>
                                            <AP label="フォント"><FontPicker dark disabled={!personIsPro} selected={editingProfile.nameFont??0} onSelect={v => setEditingProfile(p => ({...p,nameFont:v}))} /></AP>
                                            <AP label="サイズ"><SizePicker dark disabled={!personIsPro} selected={editingProfile.nameFontSize||"M"} onSelect={v => setEditingProfile(p => ({...p,nameFontSize:v}))} /></AP>
                                          </div>
                                          <div className="border-b border-neutral-800 pb-3">
                                            <p className="text-[9px] text-neutral-300 font-semibold uppercase tracking-widest mb-1.5">住所</p>
                                            <AP label="フォント"><FontPicker dark disabled={!personIsPro} selected={editingProfile.addressFont??0} onSelect={v => setEditingProfile(p => ({...p,addressFont:v}))} /></AP>
                                            <AP label="サイズ"><SizePicker dark disabled={!personIsPro} selected={editingProfile.addressFontSize||"M"} onSelect={v => setEditingProfile(p => ({...p,addressFontSize:v}))} /></AP>
                                          </div>
                                          <div className="border-b border-neutral-800 pb-3">
                                            <p className="text-[9px] text-neutral-300 font-semibold uppercase tracking-widest mb-1.5">電話番号</p>
                                            <AP label="フォント"><FontPicker dark disabled={!personIsPro} selected={editingProfile.phoneFont??0} onSelect={v => setEditingProfile(p => ({...p,phoneFont:v}))} /></AP>
                                            <AP label="サイズ"><SizePicker dark disabled={!personIsPro} selected={editingProfile.phoneFontSize||"M"} onSelect={v => setEditingProfile(p => ({...p,phoneFontSize:v}))} /></AP>
                                          </div>
                                          <div className="border-b border-neutral-800 pb-3">
                                            <div className="flex items-center justify-between mb-2">
                                              <p className="text-[9px] text-neutral-300 font-semibold uppercase tracking-widest">アピール</p>
                                              <AlignPicker dark disabled={!personIsPro} selected={editingProfile.appealsAlign} onSelect={v => setEditingProfile(p => ({...p,appealsAlign:v}))} />
                                            </div>
                                            {[0,1,2,3].map(i => (
                                              <div key={i} className="flex items-center gap-2 mb-1.5">
                                                <span className="text-[9px] text-neutral-500 w-8 flex-shrink-0">行{i+1}</span>
                                                <FontPicker dark disabled={!personIsPro} selected={editingProfile.appealFonts?.[i]??0}
                                                  onSelect={v => setEditingProfile(p => { const af=[...(p.appealFonts||[0,0,0,0])]; af[i]=v; return {...p,appealFonts:af}; })} />
                                              </div>
                                            ))}
                                          </div>
                                          </PlanBox>
                                          <div className="border-b border-neutral-800 pb-3">
                                            <p className="text-[9px] text-neutral-300 font-semibold uppercase tracking-widest mb-2">背景デザイン</p>
                                            <BgPicker selected={editingProfile.bg} onSelect={bg => setEditingProfile(p => ({...p,bg}))} />
                                          </div>
                                          <div>
                                            <p className="text-[9px] text-neutral-300 font-semibold uppercase tracking-widest mb-2">カラーオーバーレイ</p>
                                            <TintPicker selected={editingProfile.tint} onSelect={tint => setEditingProfile(p => ({...p,tint}))} />
                                          </div>
                                        </>)}

                                        {/* ───── リンクタブ ───── */}
                                        {adminEditTab === "links" && (<>
                                          <p className="text-[9px] text-neutral-400 uppercase tracking-widest">
                                            リンク（{personIsPro ? `最大${PRO_LINK_LIMIT}件` : `FREE: ${FREE_LINK_LIMIT}件`}）
                                          </p>
                                          {editingUrls.map((_, i) => {
                                            const locked = !personIsPro && i >= FREE_LINK_LIMIT;
                                            const proSlot = i >= FREE_LINK_LIMIT; // v5.20: FREE上限超はPRO特典
                                            return (
                                              <div key={i} className={`space-y-2 pb-3 last:pb-0 ${proSlot ? 'relative bg-amber-500/10 border border-amber-500/25 rounded-xl px-3 pt-3' : 'border-b border-neutral-800 last:border-0'} ${locked ? 'opacity-40' : ''}`}>
                                                {proSlot && !locked && <span className="absolute -top-2 right-3 z-10 text-[8px] font-bold px-2 py-0.5 rounded-full shadow-sm bg-amber-400 text-black">✦ PRO特典</span>}
                                                <div className="flex items-center gap-2">
                                                  <p className="text-[9px] text-neutral-300 uppercase tracking-widest">Link {i+1}</p>
                                                  {locked && <span className="text-[8px] bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full">PRO限定</span>}
                                                </div>
                                                <div className={locked ? 'pointer-events-none' : ''}>
                                                  <SNSLabelPicker value={editingUrls[i]?.label||""} isCustom={editingUrls[i]?._custom||false}
                                                    onSelect={(label, isCustom) => { if(locked) return; setEditingUrls(prev => { const n=prev.map(x=>({...x})); n[i]={...n[i],label,_custom:isCustom}; return n; }); }} />
                                                  <input type="url" value={editingUrls[i]?.url||""}
                                                    onChange={e => { if(locked) return; const val=e.target.value; setEditingUrls(prev => { const n=prev.map(x=>({...x})); n[i]={...n[i],url:val}; return n; }); }}
                                                    placeholder={locked ? "PROプランで利用可能" : "https://..."}
                                                    disabled={locked}
                                                    className="w-full mt-2 px-3 py-2.5 bg-neutral-800 border border-neutral-700 rounded-xl focus:outline-none focus:border-neutral-500 text-xs text-white placeholder:text-neutral-300 font-mono disabled:cursor-not-allowed" />
                                                </div>
                                              </div>
                                            );
                                          })}
                                        </>)}

                                        {/* ───── タグタブ ───── */}
                                        {adminEditTab === "tags" && (() => {
                                          const curTags = adminAllTags[editingUrlsName] || [];
                                          return (<>
                                          <p className="text-[9px] text-neutral-400 uppercase tracking-widest">
                                            タグ（{personIsPro ? `PRO: 最大${PRO_TAG_LIMIT}個` : `FREE: ${FREE_TAG_LIMIT}個有効`}・各{TAG_MAX_LEN}文字以内・全体公開も1個分）
                                          </p>
                                          <div className="text-[10px] bg-blue-500/10 text-blue-300 px-3 py-2 rounded-xl border border-blue-500/20 space-y-1">
                                            <p>同じタグを設定しているユーザー同士で、お互いの名刺（表示名とリンク）が見え合います</p>
                                            <p>例：業界（<b>飲食</b>）、会社名（<b>トヨタ</b>）、趣味（<b>DIY</b>）、地域（<b>渋谷</b>）</p>
                                            <p>※ 全体公開（旧 all タグ）は下のスイッチで設定します</p>
                                          </div>
                                          <div className="text-[10px] bg-neutral-800 text-neutral-400 px-3 py-2 rounded-xl border border-neutral-700">
                                            ⚠️ タグは下の<b>「タグを保存」</b>ボタンでのみ保存されます。一番下のSaveボタンでは保存されません。ユーザーのタグ変更は24時間に1回ですが、<b>管理者の保存は制限対象外</b>です
                                          </div>
                                          {adminTagsDirty && (
                                            <div className="text-[10px] bg-amber-500/10 text-amber-400 px-3 py-2 rounded-xl border border-amber-500/30 font-semibold animate-pulse">
                                              ● 入力中のタグはまだ保存されていません
                                            </div>
                                          )}
                                          {!personIsPro && <div className="text-[10px] bg-amber-500/10 text-amber-400 px-3 py-2 rounded-xl border border-amber-500/20">FREEプランは1つ目のタグのみマッチ対象になります（全体公開も1個分）</div>}
                                          {/* フェーズ3: トグル+入力欄はユーザー画面と共通（TagFields） */}
                                          <TagFields tags={curTags} pro={personIsPro} dark lockedEditable
                                            onChange={t => { setAdminAllTags(prev => ({ ...prev, [editingUrlsName]: t })); setAdminTagMsg(""); setAdminTagsDirty(true); }}
                                            onNotice={setAdminTagMsg} />
                                          <button
                                            onClick={async () => {
                                              const cleaned = [];
                                              const seen = new Set();
                                              for (const raw of curTags) {
                                                const t = normalizeTag(raw);
                                                if (!t || seen.has(t)) continue;
                                                seen.add(t); cleaned.push(t);
                                              }
                                              try {
                                                const r = await gasPost({ action:"admin_save_tags", adminPass:adminPassLocal, name:editingUrlsName, tags:cleaned });
                                                if (r.success) {
                                                  setAdminAllTags(prev => ({ ...prev, [editingUrlsName]: r.tags || [] }));
                                                  setAdminTagsDirty(false);
                                                  setAdminTagMsg("✓ 保存しました"); setTimeout(() => setAdminTagMsg(""), 3000);
                                                } else { setAdminTagMsg(r.error || "エラー"); }
                                              } catch { setAdminTagMsg("通信エラー"); }
                                            }}
                                            className={`w-full py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all ${adminTagsDirty ? 'bg-amber-500 text-white shadow-md hover:bg-amber-400' : 'bg-neutral-700 text-white hover:bg-white hover:text-black'}`}>
                                            {adminTagsDirty ? "● タグを保存する" : "タグを保存"}</button>
                                          {adminTagMsg && <p className={`text-[10px] ${adminTagMsg.startsWith("✓") ? 'text-green-400' : 'text-red-400'}`}>{adminTagMsg}</p>}
                                          </>);
                                        })()}

                                        {/* Save / Cancel */}
                                        <div className="flex gap-2 pt-2 border-t border-neutral-800">
                                          <button onClick={() => saveUrls(name, editingDisplayName, editingUrls, editingProfile)}
                                            className="flex-1 py-3 bg-white text-black rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-neutral-200 transition-all">Save</button>
                                          <button onClick={() => setEditingUrlsName(null)}
                                            className="px-5 text-[10px] text-neutral-300 hover:text-neutral-400 uppercase tracking-widest transition-colors">Cancel</button>
                                        </div>
                                      </div>
                                    </div>
                                  );})()}
                                </div>
                              );
                            })}
                          </div>
                          );})()}

                        {/* パスワード変更 */}
                        <div className="mt-8 border-t border-neutral-800 pt-6">
                          <p className="text-[9px] text-neutral-300 uppercase tracking-widest mb-3">管理パスワード変更（8文字以上）</p>
                          <div className="flex gap-2">
                            <input type="password" value={newPassInput} onChange={e => setNewPassInput(e.target.value)}
                              placeholder="新しいパスワード"
                              className="flex-1 px-4 py-3 bg-neutral-900 border border-neutral-800 rounded-xl focus:outline-none focus:border-neutral-600 text-xs text-white placeholder:text-neutral-600" />
                            <button onClick={changePassword} disabled={!newPassInput.trim()}
                              className="px-5 py-3 bg-neutral-800 text-neutral-300 rounded-xl text-[10px] uppercase tracking-widest hover:bg-white hover:text-black transition-all disabled:opacity-30">変更</button>
                          </div>
                          {passMsg && <p className="text-[10px] text-green-400 mt-2">{passMsg}</p>}
                          <p className="text-[9px] text-neutral-700 mt-2">※ このデバイスのブラウザに保存されます</p>
                        </div>

                        <button onClick={() => setIsAdminMode(false)}
                          className="w-full mt-6 py-4 text-[10px] text-neutral-300 hover:text-neutral-300 uppercase tracking-widest border border-neutral-800 rounded-2xl hover:bg-neutral-900 transition-all">
                          Close Panel
                        </button>
                      </div>
                    )}
                  </motion.div>

                ) : !variablePart ? (
                  <motion.div key="standby" initial={{opacity:0}} animate={{opacity:1}}
                    className="flex flex-col items-center justify-center py-32 text-center">
                    <div className="p-10 mb-8 bg-neutral-100/30 rounded-full">
                      <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#ddd" strokeWidth="1"><rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/></svg>
                    </div>
                    <h2 className="text-sm text-neutral-300 tracking-[0.2em] uppercase mb-8">Card Viewer Standby</h2>
                    <button onClick={() => setIsAdminMode(true)}
                      className="px-8 py-3 bg-neutral-100 text-neutral-500 rounded-full text-xs hover:bg-black hover:text-white transition-all active:scale-95">
                      管理者として選択する
                    </button>
                  </motion.div>

                ) : (
                  <motion.div key="card" initial={{opacity:0}} animate={{opacity:1}}>
                    {(() => {
                      const pd = getPersonData(urlsData, variablePart);
                      const pro = isPro(pd);
                      // 編集中はuserEditProfileをリアルタイムでカードに反映
                      const previewPd = showUserEdit ? { ...pd, profile: userEditProfile } : pd;
                      // v4.8: 本人（オーナー）判定 — 認証済み or 端末記憶あり or 新規登録(new=1)。来訪者にはオーナー用UIを出さない
                      const ownerView = !!(pinAuthToken || (variablePart && localStorage.getItem(tokenKey(variablePart))) || isNewUser);
                      return (<>
                        <FlipCard variablePart={variablePart} personData={previewPd} pro={pro} owner={ownerView} />

                        {/* PIN認証モーダル */}
                        {showPinModal && (
                          <>
                            <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center px-6"
                              onClick={() => { if (!pinBusy) setShowPinModal(false); }}>
                              <div className="bg-white rounded-3xl p-8 w-full max-w-xs shadow-2xl" onClick={e => e.stopPropagation()}>
                                <p className="text-sm font-bold text-center mb-1">編集PIN認証</p>
                                <p className="text-[10px] text-neutral-400 text-center mb-5">6桁のPINを入力すると自動で進みます</p>
                                <div className={pinBusy ? 'opacity-40 pointer-events-none' : ''}>
                                  <input
                                    type="tel" inputMode="numeric" maxLength={6}
                                    value={pinInput} autoFocus disabled={pinBusy}
                                    onChange={e => { const v = e.target.value.replace(/\D/g,""); setPinInput(v); setPinError(""); if (v.length === 6) handlePinVerify(v); }}
                                    onKeyDown={e => e.key === "Enter" && handlePinVerify()}
                                    placeholder="● ● ● ● ● ●"
                                    className="w-full text-center text-2xl font-mono tracking-[0.5em] px-4 py-4 bg-yellow-200 border-2 border-neutral-200 rounded-2xl focus:outline-none focus:border-black mb-2 disabled:bg-neutral-100" />
                                </div>
                                {pinBusy && <p className="text-[11px] text-neutral-500 text-center mb-2 animate-pulse">確認中です。お待ちください…</p>}
                                {pinError && <p className="text-[11px] text-red-500 text-center mb-2">{pinError}</p>}
                                <button onClick={handlePinVerify} disabled={pinInput.length !== 6 || pinBusy}
                                  className="w-full py-3.5 bg-black text-white rounded-2xl text-[11px] font-bold uppercase tracking-widest hover:bg-neutral-800 active:scale-95 transition-all disabled:opacity-30 mt-1">
                                  {pinBusy ? "確認中…" : "確認"}
                                </button>
                                <p className="text-[9px] text-neutral-400 text-center mt-2">
                                  PINを忘れた場合は <a href={STORES_URL} target="_blank" rel="noopener noreferrer" className="underline hover:text-black">STORES</a> から「PINリセット」をお申し込みください（有料）
                                </p>
                                <button onClick={() => setShowPinModal(false)} disabled={pinBusy}
                                  className="w-full mt-2 py-2 text-[10px] text-neutral-400 hover:text-black transition-colors disabled:opacity-30">
                                  キャンセル
                                </button>
                              </div>
                            </div>
                          </>
                        )}

                        {/* PIN初回設定モーダル */}
                        {showPinSetup && (
                          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center px-6"
                            onClick={() => { if (!pinBusy) setShowPinSetup(false); }}>
                            <div className="bg-white rounded-3xl p-8 w-full max-w-xs shadow-2xl" onClick={e => e.stopPropagation()}>
                              <p className="text-sm font-bold text-center mb-1">🔐 6桁のPIN初回設定</p>
                              <p className="text-[10px] text-neutral-400 text-center mb-2">この名刺を保護する6桁のPINを設定してください。確認欄に6桁入力すると自動で進みます</p>
                              <div className="text-[10px] bg-blue-50 text-blue-600 px-3 py-2 rounded-xl border border-blue-100 mb-4 text-left space-y-0.5">
                                <p>・PINは<b>あなたの名刺を編集するための鍵</b>です（閲覧には不要）</p>
                                <p>・<b>忘れないように必ず控えてください</b>（メモ・スマホのメモ帳など）</p>
                                <p>・万一忘れた場合は、管理者によるリセット<b>（有料）</b>が必要になります</p>
                              </div>
                              <div className={pinBusy ? 'opacity-40 pointer-events-none' : ''}>
                                <input
                                  type="tel" inputMode="numeric" maxLength={6} autoFocus
                                  value={pinSetupInput} disabled={pinBusy}
                                  onChange={e => { setPinSetupInput(e.target.value.replace(/\D/g,"")); setPinSetupMsg(""); }}
                                  placeholder="● ● ● ● ● ●"
                                  className="w-full text-center text-2xl font-mono tracking-[0.5em] px-4 py-4 bg-yellow-200 border-2 border-neutral-200 rounded-2xl focus:outline-none focus:border-black mb-3 disabled:bg-neutral-100" />
                                <input
                                  type="tel" inputMode="numeric" maxLength={6}
                                  value={pinSetupConfirm} disabled={pinBusy}
                                  onChange={e => {
                                    const v = e.target.value.replace(/\D/g,"");
                                    setPinSetupConfirm(v); setPinSetupMsg("");
                                    // 確認欄が6桁に達したら自動送信（一致しない場合はメッセージ表示）
                                    if (v.length === 6 && pinSetupInput.length === 6) submitInitialPin(pinSetupInput, v);
                                  }}
                                  onKeyDown={e => { if (e.key === "Enter") submitInitialPin(pinSetupInput, pinSetupConfirm); }}
                                  placeholder="確認（もう一度）"
                                  className="w-full text-center text-2xl font-mono tracking-[0.5em] px-4 py-4 bg-neutral-100 border-2 border-neutral-200 rounded-2xl focus:outline-none focus:border-black mb-2 disabled:bg-neutral-100" />
                              </div>
                              {pinBusy && <p className="text-[11px] text-neutral-500 text-center mb-2 animate-pulse">設定中です。お待ちください…</p>}
                              {pinSetupMsg && <p className="text-[11px] text-red-500 text-center mb-2">{pinSetupMsg}</p>}
                              <button
                                onClick={() => submitInitialPin(pinSetupInput, pinSetupConfirm)}
                                disabled={pinSetupInput.length !== 6 || pinSetupConfirm.length !== 6 || pinBusy}
                                className="w-full py-3.5 bg-black text-white rounded-2xl text-[11px] font-bold uppercase tracking-widest hover:bg-neutral-800 active:scale-95 transition-all disabled:opacity-30 mt-1">
                                {pinBusy ? "設定中…" : "PINを設定して編集する"}
                              </button>
                              <button onClick={() => setShowPinSetup(false)} disabled={pinBusy}
                                className="w-full mt-2 py-2 text-[10px] text-neutral-400 hover:text-black transition-colors disabled:opacity-30">
                                キャンセル
                              </button>
                            </div>
                          </div>
                        )}

                        {/* 初回登録ウェルカムバナー */}
                        {isNewUser && (
                          <div className="mt-5 mx-auto max-w-xs bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 flex items-start gap-3">
                            <span className="text-lg leading-none mt-0.5">👋</span>
                            <div className="flex-1">
                              <p className="text-xs font-bold text-amber-900">ようこそ！</p>
                              <p className="text-[11px] text-amber-700 mt-0.5">「名刺を編集」から名刺を作り始めましょう</p>
                            </div>
                            <button onClick={() => setIsNewUser(false)} className="text-amber-400 hover:text-amber-700 text-sm leading-none mt-0.5">✕</button>
                          </div>
                        )}

                        {/* ★ v5.10: タグ仲間向け限定表示の注記（編集・タグ仲間ボタンは非表示） */}
                        {pd._tagView && (
                          <div className="mt-5 mx-auto max-w-sm text-[10px] text-neutral-500 bg-neutral-50 border border-neutral-100 rounded-xl px-4 py-3 text-center">
                            🔒 この名刺はタグ仲間向けの限定表示です（連絡先は本人が公開を選んだ項目のみ表示されます）
                          </div>
                        )}

                        {/* v4.8: オーナー用ボタンは本人のみ表示。来訪者には控えめな編集の再入口だけ */}
                        {!pd._tagView && !ownerView && (
                          <div className="mt-5 flex justify-center">
                            <button onClick={openUserEdit} disabled={editOpening}
                              className="text-[10px] text-neutral-300 hover:text-neutral-500 underline underline-offset-2 transition-colors">
                              {editOpening ? "読み込み中…" : "オーナーの方（編集はこちら）"}
                            </button>
                          </div>
                        )}

                        {/* リンク編集ボタン（FREE/PRO共通） */}
                        {!pd._tagView && ownerView && (
                        <div className="mt-5 flex items-center justify-center gap-4">
                          <button onClick={openUserEdit} disabled={editOpening}
                            style={cardTheme && !editOpening ? { borderColor: cardTheme.accent, color: cardTheme.accent } : {}}
                            className={`flex items-center gap-1.5 text-[11px] transition-colors border rounded-full px-4 py-2 ${editOpening ? 'text-neutral-300 border-neutral-100 cursor-wait' : 'text-neutral-500 hover:text-black border-neutral-200 hover:border-black'}`}>
                            <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                            {editOpening ? "読み込み中…" : "名刺を編集"}
                          </button>
                          <button onClick={openTagFriends} disabled={cardTagBusy}
                            className={`flex items-center gap-1.5 text-[11px] font-semibold transition-all active:scale-95 border rounded-full px-4 py-2 shadow-sm ${cardTagBusy ? 'bg-amber-200 text-amber-600 border-amber-200 cursor-wait' : showCardTags ? 'bg-amber-500 text-black border-amber-500' : 'bg-amber-400 text-black border-amber-400 hover:bg-amber-300'}`}>
                            <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>
                            {cardTagBusy ? "読み込み中…" : "タグ仲間"}
                          </button>
                          <button onClick={() => setShowPurchase(true)}
                            className="flex items-center gap-1.5 text-[11px] font-semibold text-white bg-black hover:bg-neutral-800 active:scale-95 transition-all rounded-full px-4 py-2">
                            ☆購入☆
                          </button>
                        </div>
                        )}

                        {/* ★ v5.9: プライバシー説明 / v5.14: 文字サイズ切替（v4.8: 本人のみ） */}
                        {ownerView && (
                        <div className="mt-3 flex items-center justify-center gap-4">
                          <button onClick={cycleUiZoom}
                            className={`flex items-center gap-1 text-[10px] border rounded-full px-3 py-1.5 transition-colors ${uiZoomIdx > 0 ? 'border-black text-black font-bold' : 'border-neutral-200 text-neutral-400 hover:text-black hover:border-black'}`}>
                            <span className="text-[12px]">あ</span> 文字サイズ: {UI_ZOOM_LABELS[uiZoomIdx]}
                          </button>
                          <button onClick={() => setShowPrivacy(true)}
                            className="text-[10px] text-neutral-400 underline underline-offset-2 hover:text-black transition-colors">
                            🔒 プライバシー
                          </button>
                        </div>
                        )}
                        {showPrivacy && (
                          <div className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm flex items-center justify-center p-5" onClick={() => setShowPrivacy(false)}>
                            <div className="w-full max-w-md bg-white rounded-2xl p-6 space-y-3 overflow-y-auto shadow-2xl" style={{maxHeight:`calc(80vh / ${UI_ZOOMS[uiZoomIdx]})`}} onClick={e => e.stopPropagation()}>
                              <div className="flex items-center justify-between">
                                <h3 className="text-sm font-bold text-neutral-800">🔒 誰に何が見えるか</h3>
                                <button onClick={() => setShowPrivacy(false)} className="w-7 h-7 flex items-center justify-center rounded-full bg-neutral-100 text-neutral-500 hover:bg-neutral-200 text-xs">✕</button>
                              </div>
                              <div className="text-[11px] text-neutral-600 leading-relaxed space-y-2.5">
                                <p><b className="text-neutral-800">① この名刺ページ</b><br/>名刺のURL（またはQRコード）を知っている人だけが見られます。表示されるのは、あなたが名刺に載せた内容（表示名・リンク・プロフィール）です。利用者の一覧を外部から取得することはできません。</p>
                                <p><b className="text-neutral-800">② タグを設定した場合</b><br/>同じタグを保存している他の利用者の「タグ仲間」画面に、あなたの<b>表示名と名刺リンク</b>が表示されることがあります（開くたびにランダムで最大5〜8名）。タグは自分で保存しない限り公開されません。今何人に見えているかは、名刺を編集 → タグ タブでいつでも確認できます。<br/>タグ仲間に渡るのは<b>限定表示用のURL</b>で、あなたの電話番号・住所は表示されません（「タグ用 連絡先」に入力した内容だけが表示されます）。</p>
                                <p><b className="text-neutral-800">③ 全体公開をONにした場合</b><br/>全体公開中のすべての利用者にあなたの表示名と名刺リンクが表示されます。OFFにすればいつでも解除できます。</p>
                                <p><b className="text-neutral-800">④ 見えないもの</b><br/>あなたのPIN・メールアドレスが他の利用者に表示されることはありません。PINはサーバーでのみ照合されます。</p>
                                <p><b className="text-neutral-800">⑤ 運営（管理者）</b><br/>サイト運営者は、サポートとシステム管理のために登録データ（名刺内容・タグ・PIN）を確認できます。</p>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* v4.8: 購入ページ（Squareリンク一覧） */}
                        {showPurchase && (() => { const myId = pd?.publicId || variablePart; const plans = [["pro1m","PRO 1ヶ月"],["pro3m","PRO 3ヶ月"],["pro6m","PRO 6ヶ月"],["pro12m","PRO 1年"]]; return (
                          <div className="fixed inset-0 z-[70] bg-black/50 backdrop-blur-sm flex items-center justify-center p-5" onClick={() => setShowPurchase(false)}>
                            <div className="w-full max-w-md bg-white rounded-2xl p-6 space-y-3 overflow-y-auto shadow-2xl" style={{maxHeight:`calc(85vh / ${UI_ZOOMS[uiZoomIdx]})`}} onClick={e => e.stopPropagation()}>
                              <div className="flex items-center justify-between">
                                <h3 className="text-sm font-bold text-neutral-800">プランを購入</h3>
                                <button onClick={() => setShowPurchase(false)} className="w-7 h-7 flex items-center justify-center rounded-full bg-neutral-100 text-neutral-500 hover:bg-neutral-200 text-xs">✕</button>
                              </div>
                              {/* 決済ページに貼り付けるユーザーID */}
                              <div className="rounded-xl border border-sky-200 bg-sky-50/70 px-3 py-2.5">
                                <p className="text-[10px] font-bold text-sky-700 mb-1">① 決済ページの「ユーザーID」欄に、これを貼り付け</p>
                                <div className="flex items-center gap-2">
                                  <code className="flex-1 px-2 py-1.5 bg-white border border-sky-200 rounded-lg text-xs font-mono text-neutral-800 break-all select-all">{myId}</code>
                                  <button type="button"
                                    onClick={async () => { try { await navigator.clipboard.writeText(myId); } catch { const ta=document.createElement('textarea'); ta.value=myId; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove(); } setIdCopied(true); setTimeout(()=>setIdCopied(false), 2000); }}
                                    className={`px-3 py-1.5 rounded-lg text-[11px] font-bold whitespace-nowrap transition-colors ${idCopied ? 'bg-green-500 text-white' : 'bg-sky-500 text-white hover:bg-sky-400'}`}>
                                    {idCopied ? '✓ 済' : 'コピー'}
                                  </button>
                                </div>
                              </div>
                              <p className="text-[10px] font-bold text-amber-600 uppercase tracking-widest pt-1">② PRO（期間制）を選ぶ</p>
                              {plans.map(([k,label]) => SQUARE_LINKS[k] ? (
                                <a key={k} href={SQUARE_LINKS[k]} target="_blank" rel="noopener noreferrer"
                                  className="flex items-center justify-between px-4 py-3 rounded-xl border border-amber-200 bg-amber-50/70 hover:bg-amber-100 transition-colors">
                                  <span className="text-xs font-bold text-neutral-800">{label}</span>
                                  <span className="text-[10px] font-bold text-amber-600">購入 →</span>
                                </a>
                              ) : (
                                <div key={k} className="flex items-center justify-between px-4 py-3 rounded-xl border border-neutral-200 bg-neutral-50 opacity-60">
                                  <span className="text-xs font-bold text-neutral-500">{label}</span>
                                  <span className="text-[10px] text-neutral-400">準備中</span>
                                </div>
                              ))}
                              <p className="text-[10px] font-bold text-sky-600 uppercase tracking-widest pt-1">＋G（買い切り・永続）</p>
                              {SQUARE_LINKS.plusg ? (
                                <a href={SQUARE_LINKS.plusg} target="_blank" rel="noopener noreferrer"
                                  className="flex items-center justify-between px-4 py-3 rounded-xl border border-sky-200 bg-sky-50/70 hover:bg-sky-100 transition-colors">
                                  <span className="text-xs font-bold text-neutral-800">＋G 独自背景画像（買い切り）</span>
                                  <span className="text-[10px] font-bold text-sky-600">購入 →</span>
                                </a>
                              ) : (
                                <div className="flex items-center justify-between px-4 py-3 rounded-xl border border-neutral-200 bg-neutral-50 opacity-60">
                                  <span className="text-xs font-bold text-neutral-500">＋G 独自背景画像（買い切り）</span>
                                  <span className="text-[10px] text-neutral-400">準備中</span>
                                </div>
                              )}
                              <p className="text-[9px] text-neutral-400 leading-relaxed pt-1">③ 購入後、入金確認しだい有効化します（数営業日内）。PROは期間制、＋Gは一度の購入でずっと使えます。IDの入力間違いにご注意ください。</p>
                              <div className="border-t border-neutral-100 pt-3 mt-1">
                                <p className="text-[10px] text-neutral-400 mb-2 text-center">知り合いにもすすめる</p>
                                <MakeOwnCTA />
                              </div>
                            </div>
                          </div>
                        ); })()}

                        {/* タグ仲間の名刺一覧（カード画面・編集パネル不要） */}
                        {showCardTags && cardTagMatches && (
                          <div className="mt-5 mx-auto max-w-sm bg-white border border-neutral-100 rounded-2xl p-4 space-y-3 shadow-sm">
                            <div className="flex items-center justify-between">
                              <p className="text-[10px] text-neutral-700 font-semibold uppercase tracking-widest">タグ仲間の名刺</p>
                              <button onClick={() => setShowCardTags(false)} className="w-6 h-6 flex items-center justify-center rounded-full bg-neutral-100 text-neutral-500 hover:bg-neutral-200 text-xs">✕</button>
                            </div>
                            <p className="text-[10px] text-neutral-400">同じタグを設定している人の中から、開くたびにランダムで最大{isPro(getPersonData(urlsData, variablePart)) ? TAG_FRIENDS_PRO : TAG_FRIENDS_FREE}名まで表示されます（毎回顔ぶれが変わります）{!isPro(getPersonData(urlsData, variablePart)) && <span className="text-amber-600">　✦ PROなら最大{TAG_FRIENDS_PRO}名表示</span>}</p>
                            {Object.keys(cardTagMatches).length === 0 && (
                              <p className="text-[10px] text-neutral-400">タグが設定されていません。「名刺を編集」のタグタブから設定できます</p>
                            )}
                            {Object.entries(cardTagMatches).map(([tag, users]) => (
                              <div key={tag} className="space-y-1.5">
                                <span className="inline-block text-[10px] bg-neutral-100 text-neutral-600 px-2.5 py-1 rounded-full font-semibold"># {tag}</span>
                                {users.length === 0
                                  ? <p className="text-[10px] text-neutral-400 pl-1">同じタグのユーザーはまだいません</p>
                                  : users.map((u, j) => (
                                      <a key={j} href={`${getSiteBase()}#${u.publicId}`} target="_blank" rel="noopener noreferrer"
                                        className="flex items-center justify-between px-3 py-2.5 bg-neutral-50 hover:bg-neutral-100 border border-neutral-100 rounded-xl transition-colors">
                                        <span className="text-xs text-neutral-700 font-medium">{u.displayName || "（名前未設定）"}</span>
                                        <span className="text-[9px] text-neutral-400 font-mono">名刺を開く →</span>
                                      </a>
                                    ))}
                              </div>
                            ))}
                          </div>
                        )}

                        {/* v5.22: 閲覧者→見込み客 向けCTA（カード下部）／v5.23: 編集できる本人(PIN認証済 or 端末記憶あり)には非表示 */}
                        {!(pinAuthToken || (variablePart && localStorage.getItem(tokenKey(variablePart)))) && (
                        <div className="mt-8 mb-2 mx-auto max-w-sm text-center">
                          <div className="rounded-2xl border border-neutral-200 bg-white/70 backdrop-blur px-5 py-5 shadow-sm">
                            <p className="text-[12px] font-bold text-neutral-800 mb-1">あなたも、NEXUA（ネクア）で名刺を。</p>
                            <p className="text-[10px] text-neutral-500 mb-3">人と情報を、あなたのためにつなぐ。メールだけ・1分で無料登録。</p>
                            <a href="https://furetomojapan.github.io/meishi/welcome.html" target="_blank" rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 px-5 py-2.5 rounded-full text-[11px] font-bold text-white bg-gradient-to-r from-rose-400 to-orange-400 hover:from-rose-500 hover:to-orange-500 active:scale-95 transition-all shadow-md">
                              無料で名刺をつくる →
                            </a>
                          </div>
                        </div>
                        )}

                        {/* ユーザーリンク編集モーダル（ボトムシート） */}
                        {showUserEdit && (() => {
                          const editDirty = editOrigJSON !== null &&
                            (JSON.stringify(userEditProfile) + JSON.stringify(userEditUrls)) !== editOrigJSON;
                          // タグの未保存判定（タグは「タグを保存」ボタンでのみ保存される）
                          const tagLimit = pro ? PRO_TAG_LIMIT : FREE_TAG_LIMIT;
                          const tagsDirty = JSON.stringify(userEditTags.slice(0, tagLimit).map(normalizeTag).filter(Boolean)) !== JSON.stringify(mySavedTags.slice(0, tagLimit));
                          const closeEditSheet = async () => {
                            if (tagsDirty && !(await appConfirm("タグが未保存です（タグは「タグ」タブの『タグを保存』ボタンで保存します）。\nタグの変更を破棄して閉じますか？"))) return;
                            if (editDirty && !(await appConfirm("変更を破棄して閉じますか？"))) return;
                            setEditOrigJSON(null);
                            setShowUserEdit(false);
                          };
                          const handleFooterSave = async () => {
                            if (tagsDirty && !(await appConfirm("タグは未保存です。このSAVEボタンではタグは保存されません（タグは「タグ」タブの『タグを保存』ボタンで保存します）。\nタグ以外を保存して閉じますか？"))) return;
                            saveUserLinks();
                          };
                          const PRow = ({label, children}) => (
                            <div className="flex items-center justify-between gap-2 mt-1.5">
                              <span className="text-[8px] text-neutral-600 w-9 flex-shrink-0">{label}</span>
                              <div className="flex-1 flex justify-end">{children}</div>
                            </div>
                          );
                          const setColor = (key, val) => setUserEditProfile(p => ({...p,[key]:val}));
                          const setAColor = (i, val) => setUserEditProfile(p => { const ac=[...(p.appealColors||["","","",""])]; ac[i]=val; return {...p,appealColors:ac}; });
                          return (
                          <>
                            <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" onClick={closeEditSheet} />
                            <div className="fixed z-50 bg-white shadow-2xl flex flex-col"
                              style={{bottom:0,left:0,right:0,borderRadius:'24px 24px 0 0',maxHeight:`calc(88vh / ${UI_ZOOMS[uiZoomIdx]})`,paddingBottom:'env(safe-area-inset-bottom,0px)'}}>
                              {/* ドラッグハンドル */}
                              <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
                                <div className="w-10 h-1 bg-neutral-200 rounded-full" />
                              </div>
                              {/* ヘッダー（固定） */}
                              <div className="px-5 py-2 flex items-center justify-between flex-shrink-0">
                                <div className="flex items-center gap-2">
                                  <h3 className="text-sm font-semibold text-neutral-800">名刺を編集</h3>
                                  <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${pro ? 'bg-amber-400 text-black' : 'bg-neutral-200 text-neutral-500'}`}>
                                    {trialDaysLeft(pd) > 0 ? `✦ PRO+＋Gお試し中・残り${trialDaysLeft(pd)}日` : proDaysLeft(pd) > 0 ? `✦ PRO・残り${proDaysLeft(pd)}日` : pro ? "✦ PRO" : "FREE"}
                                  </span>
                                  {editDirty && <span className="text-[9px] text-amber-500 font-bold animate-pulse">● 未保存</span>}
                                </div>
                                <button onClick={closeEditSheet} className="w-7 h-7 flex items-center justify-center rounded-full bg-neutral-100 text-neutral-500 hover:bg-neutral-200 text-sm">✕</button>
                              </div>
                              {/* タブバー（固定） */}
                              <div className="px-5 flex gap-0 border-b border-neutral-100 flex-shrink-0">
                                {[["info","情報"],["design","デザイン"],["links","リンク"],["tags","タグ"]].map(([id,label]) => (
                                  <button key={id} onClick={() => setEditTab(id)}
                                    className={`px-4 py-2.5 text-[11px] font-semibold tracking-wide border-b-2 transition-colors ${editTab===id ? 'border-black text-black' : 'border-transparent text-neutral-400 hover:text-neutral-600'}`}>
                                    {label}{id === "tags" && tagsDirty && <span className="text-amber-500 ml-0.5">●</span>}
                                  </button>
                                ))}
                              </div>
                              {/* 凡例（色の意味）v5.20: お試し中でも特典の場所が分かるように */}
                              <div className="px-5 pt-2 flex-shrink-0"><PlanLegend /></div>
                              {/* スクロール領域 */}
                              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
                                {/* v5.20: お試し期限が近いときの注意バナー（残り2日以下） */}
                                {(() => { const d = trialDaysLeft(pd); return d > 0 && d <= 3 ? (
                                  <div className="text-[10px] bg-amber-50 text-amber-700 px-3 py-2.5 rounded-xl border border-amber-200">
                                    <p className="font-bold mb-0.5">⏳ PRO+＋Gお試しは残り{d}日です</p>
                                    <p className="text-amber-600">期限後はFREEになりますが、設定内容は保存され、PROにすると再び有効になります。
                                      <a href={STORES_URL} target="_blank" rel="noopener noreferrer" className="underline font-bold ml-0.5">PROにする →</a></p>
                                  </div>
                                ) : null; })()}
                                {/* v5.20: お試し終了後（FREEだが特典データを保持中）の安心リキャップ */}
                                {(() => {
                                  if (pro || trialDaysLeft(pd) > 0) return null;
                                  const ps = premiumSettings(pd, mySavedTags);
                                  if (!ps.any) return null;
                                  const items = [ps.typography && "文字スタイル", ps.extraLinks && "追加リンク", ps.extraTags && "追加タグ", ps.hasImage && "独自背景画像"].filter(Boolean);
                                  return (
                                    <div className="text-[10px] bg-sky-50 text-sky-700 px-3 py-2.5 rounded-xl border border-sky-200">
                                      <p className="font-bold mb-0.5">💾 お試し中の設定は保存されています</p>
                                      <p className="text-sky-600">{items.join("・")}は現在おやすみ中ですが、消えていません。PROにすると、そのまま再び有効になります。
                                        <a href={STORES_URL} target="_blank" rel="noopener noreferrer" className="underline font-bold ml-0.5">PROにする →</a></p>
                                    </div>
                                  );
                                })()}
                                {/* ───── 情報タブ ───── */}
                                {editTab === "info" && (<>
                                {/* v5.24: 決済時に貼り付ける本人確認用ユーザーID（publicId） */}
                                {(() => { const myId = pd?.publicId || variablePart; return (
                                  <div className="rounded-2xl border border-sky-200 bg-sky-50/70 px-4 py-3">
                                    <p className="text-[10px] font-bold text-sky-700 mb-1">あなたのユーザーID（PRO購入時にコピペで入力）</p>
                                    <div className="flex items-center gap-2">
                                      <code className="flex-1 px-3 py-2 bg-white border border-sky-200 rounded-xl text-sm font-mono text-neutral-800 tracking-wider break-all select-all">{myId}</code>
                                      <button type="button"
                                        onClick={async () => { try { await navigator.clipboard.writeText(myId); } catch { const ta=document.createElement('textarea'); ta.value=myId; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove(); } setIdCopied(true); setTimeout(()=>setIdCopied(false), 2000); }}
                                        className={`px-3 py-2 rounded-xl text-[11px] font-bold whitespace-nowrap transition-colors ${idCopied ? 'bg-green-500 text-white' : 'bg-sky-500 text-white hover:bg-sky-400'}`}>
                                        {idCopied ? '✓ コピー済' : 'コピー'}
                                      </button>
                                    </div>
                                    <p className="text-[9px] text-sky-600/80 mt-1.5">決済ページのID欄に、このIDをそのまま貼り付けてください。入金確認後、このIDの名刺をPROに切り替えます。</p>
                                  </div>
                                ); })()}
                                <p className="text-[10px] text-neutral-400">空白文字（スペース・改行）も認識します</p>
                                {/* フェーズ3: 文字入力は管理者編集と共通（ProfileTextFields） */}
                                <ProfileTextFields profile={userEditProfile} setProfile={setUserEditProfile} />
                                {/* この端末の記憶 */}
                                <div className="border-t border-neutral-100 pt-3">
                                  <p className="text-[10px] text-neutral-700 font-medium uppercase tracking-widest mb-1">この端末の記憶</p>
                                  <p className="text-[10px] text-neutral-400 mb-2">PIN認証は30日間この端末に記憶され、次回からPIN入力なしで編集・タグ仲間の閲覧ができます。共有端末では下のボタンで記憶を消してください</p>
                                  <button onClick={forgetDevice}
                                    className="px-4 py-2 bg-neutral-100 text-neutral-600 rounded-xl text-[10px] font-bold hover:bg-red-50 hover:text-red-500 border border-neutral-200 hover:border-red-200 transition-all">この端末の記憶を消す</button>
                                  {deviceMemMsg && <p className="text-[10px] text-green-500 mt-1">{deviceMemMsg}</p>}
                                </div>
                                {/* PIN変更（最下部・誤操作防止） */}
                                <div className="border-t border-neutral-100 pt-3">
                                  <div className="flex items-center gap-2 mb-2">
                                    <p className="text-[10px] text-neutral-700 font-medium uppercase tracking-widest">PIN変更</p>
                                    <span className="text-[10px] text-neutral-400 bg-neutral-100 px-2 py-0.5 rounded">安全のためPINは表示されません</span>
                                  </div>
                                  <div className="flex gap-2 items-center">
                                    <input type="tel" inputMode="numeric" maxLength={6}
                                      value={pinChangeInput}
                                      onChange={e => { setPinChangeInput(e.target.value.replace(/\D/g,"")); setPinChangeMsg(""); }}
                                      placeholder="新しい6桁PIN"
                                      className="flex-1 px-3 py-2 bg-yellow-200 border border-neutral-200 rounded-xl focus:outline-none focus:border-black text-sm font-mono tracking-widest text-center" />
                                    <button onClick={savePinChange} disabled={pinChangeInput.length !== 6}
                                      className="px-4 py-2 bg-neutral-800 text-white rounded-xl text-[10px] font-bold hover:bg-black transition-all disabled:opacity-30">変更</button>
                                  </div>
                                  {pinChangeMsg && <p className="text-[10px] text-green-500 mt-1">{pinChangeMsg}</p>}
                                </div>
                                {/* v4.8: 「作りたい」勧誘CTA（ヘッダーから移設） */}
                                <div className="border-t border-neutral-100 pt-3">
                                  <p className="text-[10px] text-neutral-400 mb-2 text-center">知り合いにもすすめる</p>
                                  <MakeOwnCTA />
                                </div>
                                </>)}

                                {/* ───── デザインタブ ───── */}
                                {editTab === "design" && (<>
                                  {!pro && <div className="text-[10px] bg-amber-50 text-amber-600 px-3 py-2 rounded-xl border border-amber-100">フォント・サイズ・位置はPROで利用可能</div>}
                                  {/* 独自背景画像（+G） */}
                                  {(() => {
                                    const canUpload = isPlusG(getPersonData(urlsData, variablePart));
                                    // v5.18: 高画質化 — 800px・WebP（非対応ならJPEG）・画質を自動段階調整。
                                    // 保存先（専用セル・上限5万文字）に収まる最高画質を選ぶ
                                    const compressImage = (file) => new Promise((resolve, reject) => {
                                      const reader = new FileReader();
                                      reader.onerror = () => reject(new Error('read error'));
                                      reader.onload = ev => {
                                        const img = new Image();
                                        img.onerror = () => reject(new Error('image error'));
                                        img.onload = () => {
                                          const IMG_MAX_CHARS = 47000; // サーバー上限5万文字に対し余裕を持たせる
                                          const webpOk = document.createElement('canvas').toDataURL('image/webp').indexOf('data:image/webp') === 0;
                                          const type = webpOk ? 'image/webp' : 'image/jpeg';
                                          const MAX_W = 800, MAX_H = 470;
                                          for (const scale of [1, 0.75, 0.5]) {
                                            const ratio = Math.min(MAX_W / img.width, MAX_H / img.height, 1) * scale;
                                            const canvas = document.createElement('canvas');
                                            canvas.width = Math.max(1, Math.round(img.width * ratio));
                                            canvas.height = Math.max(1, Math.round(img.height * ratio));
                                            canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
                                            for (const q of [0.85, 0.75, 0.65, 0.55, 0.45]) {
                                              const dataUrl = canvas.toDataURL(type, q);
                                              if (dataUrl.length <= IMG_MAX_CHARS) { resolve(dataUrl); return; }
                                            }
                                          }
                                          reject(new Error('too large'));
                                        };
                                        img.src = ev.target.result;
                                      };
                                      reader.readAsDataURL(file);
                                    });
                                    const uploadImg = async (file, side) => {
                                      if (!canUpload) return;
                                      setUserEditProfile(p => ({...p,[`${side}Uploading`]:true,[`${side}UploadErr`]:false}));
                                      try {
                                        const dataUrl = await compressImage(file);
                                        setUserEditProfile(p => ({...p,[`${side}ImageUrl`]:dataUrl,[`${side}Uploading`]:false,[`${side}UploadErr`]:false}));
                                      } catch {
                                        setUserEditProfile(p => ({...p,[`${side}Uploading`]:false,[`${side}UploadErr`]:true}));
                                      }
                                    };
                                    return (
                                      <div className={`relative space-y-3 border rounded-2xl p-3 ${planBoxCls('plusg', false)} ${!canUpload ? 'pointer-events-none select-none' : ''}`}>
                                        {canUpload && <PlanBadge kind="plusg" />}
                                        <div className="flex items-center justify-between">
                                          {!canUpload && (
                                            <div className="absolute inset-0 z-10 rounded-xl bg-blue-900/75 flex flex-col items-center justify-center gap-1 pointer-events-none">
                                              <span className="text-[11px] font-bold text-white tracking-wide">✦ +Gプラン限定</span>
                                              <span className="text-[9px] text-blue-200">背景画像をアップロードできます</span>
                                              <a href={STORES_URL} target="_blank" rel="noopener noreferrer" className="pointer-events-auto mt-1 px-3 py-1 bg-sky-500 text-white rounded-full text-[9px] font-bold hover:bg-sky-400 active:scale-95 transition-all">＋Gにする →</a>
                                            </div>
                                          )}
                                          <div>
                                            <p className="text-[9px] text-neutral-600 font-semibold uppercase tracking-widest">独自背景画像</p>
                                            {!canUpload && <p className="text-[8px] text-sky-500 mt-0.5">✦ +Gプランで利用できます</p>}
                                          </div>
                                          <label className="flex items-center gap-2 cursor-pointer select-none">
                                            <span className="text-[9px] text-neutral-500">文字を重ねる</span>
                                            <button type="button"
                                              onClick={() => setUserEditProfile(p => ({...p,showTextOverlay:!(p.showTextOverlay !== false)}))}
                                              className={`relative w-9 h-5 rounded-full transition-colors ${userEditProfile.showTextOverlay !== false ? 'bg-black' : 'bg-neutral-300'}`}>
                                              <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${userEditProfile.showTextOverlay !== false ? 'translate-x-4' : 'translate-x-0.5'}`} />
                                            </button>
                                          </label>
                                        </div>
                                        {[{side:"front",label:"表面"},{side:"back",label:"裏面"}].map(({side,label}) => {
                                          const url = userEditProfile[`${side}ImageUrl`];
                                          const uploading = userEditProfile[`${side}Uploading`];
                                          const uploadErr = userEditProfile[`${side}UploadErr`];
                                          return (
                                            <div key={side} className="space-y-1">
                                              <div className="flex items-center gap-3">
                                                <div className="w-16 h-10 rounded-lg overflow-hidden bg-neutral-100 border border-neutral-200 flex-shrink-0">
                                                  {url ? <img src={url} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-[8px] text-neutral-400">{label}</div>}
                                                </div>
                                                <div className="flex gap-2 flex-1">
                                                  <label className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-[10px] rounded-xl border transition-all ${canUpload ? 'cursor-pointer border-neutral-300 text-neutral-500 hover:border-black hover:text-black' : 'cursor-not-allowed border-neutral-200 text-neutral-300'} ${uploading ? 'opacity-50 pointer-events-none' : ''}`}>
                                                    {uploading
                                                      ? <svg className="animate-spin" xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 11-9-9"/></svg>
                                                      : <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                                                    }
                                                    {uploading ? "処理中..." : `${label}をアップ`}
                                                    {canUpload && <input type="file" accept="image/*" className="hidden" onChange={e => { if(e.target.files[0]) uploadImg(e.target.files[0], side); }} />}
                                                  </label>
                                                  {url && canUpload && <button type="button" onClick={() => setUserEditProfile(p => ({...p,[`${side}ImageUrl`]:"", [`${side}UploadErr`]:false}))} className="px-2 py-2 text-[10px] border border-neutral-200 rounded-xl text-neutral-400 hover:text-red-400 hover:border-red-300 transition-all">削除</button>}
                                                </div>
                                              </div>
                                              {uploadErr && <p className="text-[8px] text-red-400 pl-1">画像アップに失敗しました</p>}
                                            </div>
                                          );
                                        })}
                                      </div>
                                    );
                                  })()}
                                  {/* テーマカラー（カード画面全体）v5.16 */}
                                  <div className="border-b border-neutral-100 pb-3">
                                    <p className="text-[9px] text-neutral-600 font-semibold uppercase tracking-widest mb-2">テーマカラー（画面全体）</p>
                                    <ThemePicker pro={pro} selected={userEditProfile.themeColor || ""} onSelect={themeColor => setUserEditProfile(p => ({...p,themeColor}))} />
                                  </div>
                                  {/* 背景 */}
                                  <div className="border-b border-neutral-100 pb-3">
                                    <p className="text-[9px] text-neutral-600 font-semibold uppercase tracking-widest mb-2">背景デザイン（表面）</p>
                                    <BgPicker selected={userEditProfile.bg} onSelect={bg => setUserEditProfile(p => ({...p,bg}))} />
                                  </div>
                                  <div className="border-b border-neutral-100 pb-3">
                                    <p className="text-[9px] text-neutral-600 font-semibold uppercase tracking-widest mb-2">背景デザイン（裏面）</p>
                                    <BgPicker selected={userEditProfile.bgBack || userEditProfile.bg} onSelect={bgBack => setUserEditProfile(p => ({...p,bgBack}))} />
                                  </div>
                                  <div className="border-b border-neutral-100 pb-3">
                                    <p className="text-[9px] text-neutral-600 font-semibold uppercase tracking-widest mb-2">カラー（オーバーレイ）</p>
                                    <TintPicker selected={userEditProfile.tint} onSelect={tint => setUserEditProfile(p => ({...p,tint}))} />
                                  </div>
                                  <PlanBox kind="pro" label="文字スタイル（フォント・サイズ・色・位置）" upgrade={!pro} className="px-3 pb-1">
                                  <div className="border-b border-neutral-100 pb-3">
                                    <p className="text-[9px] text-neutral-600 font-semibold uppercase tracking-widest mb-2">デフォルト文字色</p>
                                    <TextColorPicker disabled={!pro} selected={userEditProfile.textColor||"#ffffff"} onSelect={textColor => setUserEditProfile(p => ({...p,textColor}))} />
                                  </div>
                                  {/* 会社名 */}
                                  <div className="border-b border-neutral-100 pb-3">
                                    <div className="flex items-center justify-between mb-1.5">
                                      <p className="text-[9px] text-neutral-600 font-semibold uppercase tracking-widest">会社名</p>
                                      <AlignPicker disabled={!pro} selected={userEditProfile.companyAlign} onSelect={v => setUserEditProfile(p => ({...p,companyAlign:v}))} />
                                    </div>
                                    <PRow label="フォント"><FontPicker disabled={!pro} selected={userEditProfile.companyFont??0} onSelect={v => setUserEditProfile(p => ({...p,companyFont:v}))} /></PRow>
                                    <PRow label="サイズ"><SizePicker disabled={!pro} selected={userEditProfile.companyFontSize||"S"} onSelect={v => setUserEditProfile(p => ({...p,companyFontSize:v}))} /></PRow>
                                    <PRow label="カラー"><TextColorPicker disabled={!pro} selected={userEditProfile.companyColor||""} onSelect={v => setColor("companyColor",v)} /></PRow>
                                  </div>
                                  {/* 肩書き */}
                                  <div className="border-b border-neutral-100 pb-3">
                                    <div className="flex items-center justify-between mb-1.5">
                                      <p className="text-[9px] text-neutral-600 font-semibold uppercase tracking-widest">肩書き</p>
                                      <AlignPicker disabled={!pro} selected={userEditProfile.titleAlign} onSelect={v => setUserEditProfile(p => ({...p,titleAlign:v}))} />
                                    </div>
                                    <PRow label="フォント"><FontPicker disabled={!pro} selected={userEditProfile.titleFont??0} onSelect={v => setUserEditProfile(p => ({...p,titleFont:v}))} /></PRow>
                                    <PRow label="サイズ"><SizePicker disabled={!pro} selected={userEditProfile.titleFontSize||"S"} onSelect={v => setUserEditProfile(p => ({...p,titleFontSize:v}))} /></PRow>
                                    <PRow label="カラー"><TextColorPicker disabled={!pro} selected={userEditProfile.titleColor||""} onSelect={v => setColor("titleColor",v)} /></PRow>
                                  </div>
                                  {/* 名前 */}
                                  <div className="border-b border-neutral-100 pb-3">
                                    <div className="flex items-center justify-between mb-1.5">
                                      <p className="text-[9px] text-neutral-600 font-semibold uppercase tracking-widest">名前</p>
                                      <AlignPicker disabled={!pro} selected={userEditProfile.nameAlign} onSelect={v => setUserEditProfile(p => ({...p,nameAlign:v}))} />
                                    </div>
                                    <PRow label="フォント"><FontPicker disabled={!pro} selected={userEditProfile.nameFont??0} onSelect={v => setUserEditProfile(p => ({...p,nameFont:v}))} /></PRow>
                                    <PRow label="サイズ"><SizePicker disabled={!pro} selected={userEditProfile.nameFontSize||"M"} onSelect={v => setUserEditProfile(p => ({...p,nameFontSize:v}))} /></PRow>
                                    <PRow label="カラー"><TextColorPicker disabled={!pro} selected={userEditProfile.nameColor||""} onSelect={v => setColor("nameColor",v)} /></PRow>
                                  </div>
                                  {/* 住所 */}
                                  <div className="border-b border-neutral-100 pb-3">
                                    <p className="text-[9px] text-neutral-600 font-semibold uppercase tracking-widest mb-1.5">住所</p>
                                    <PRow label="フォント"><FontPicker disabled={!pro} selected={userEditProfile.addressFont??0} onSelect={v => setUserEditProfile(p => ({...p,addressFont:v}))} /></PRow>
                                    <PRow label="サイズ"><SizePicker disabled={!pro} selected={userEditProfile.addressFontSize||"M"} onSelect={v => setUserEditProfile(p => ({...p,addressFontSize:v}))} /></PRow>
                                    <PRow label="カラー"><TextColorPicker disabled={!pro} selected={userEditProfile.addressColor||""} onSelect={v => setColor("addressColor",v)} /></PRow>
                                  </div>
                                  {/* 電話番号 */}
                                  <div className="border-b border-neutral-100 pb-3">
                                    <p className="text-[9px] text-neutral-600 font-semibold uppercase tracking-widest mb-1.5">電話番号</p>
                                    <PRow label="フォント"><FontPicker disabled={!pro} selected={userEditProfile.phoneFont??0} onSelect={v => setUserEditProfile(p => ({...p,phoneFont:v}))} /></PRow>
                                    <PRow label="サイズ"><SizePicker disabled={!pro} selected={userEditProfile.phoneFontSize||"M"} onSelect={v => setUserEditProfile(p => ({...p,phoneFontSize:v}))} /></PRow>
                                    <PRow label="カラー"><TextColorPicker disabled={!pro} selected={userEditProfile.phoneColor||""} onSelect={v => setColor("phoneColor",v)} /></PRow>
                                  </div>
                                  {/* アピール */}
                                  <div className="border-b border-neutral-100 pb-3">
                                    <div className="flex items-center justify-between mb-2">
                                      <p className="text-[9px] text-neutral-600 font-semibold uppercase tracking-widest">アピール</p>
                                      <AlignPicker disabled={!pro} selected={userEditProfile.appealsAlign} onSelect={v => setUserEditProfile(p => ({...p,appealsAlign:v}))} />
                                    </div>
                                    {[0,1,2,3].map(i => (
                                      <div key={i} className="flex items-center gap-2 mb-1.5">
                                        <span className="text-[9px] text-neutral-400 w-8 flex-shrink-0">行{i+1}</span>
                                        <FontPicker disabled={!pro} selected={userEditProfile.appealFonts?.[i]??0}
                                          onSelect={v => setUserEditProfile(p => { const af=[...(p.appealFonts||[0,0,0,0])]; af[i]=v; return {...p,appealFonts:af}; })} />
                                        <TextColorPicker disabled={!pro} selected={userEditProfile.appealColors?.[i]||""} onSelect={v => setAColor(i,v)} />
                                      </div>
                                    ))}
                                  </div>
                                  </PlanBox>
                                </>)}

                                {/* ───── リンクタブ ───── */}
                                {editTab === "links" && (<>
                                  <p className="text-[10px] text-neutral-500">リンク（{pro ? `最大${PRO_LINK_LIMIT}件` : `FREE: ${FREE_LINK_LIMIT}件`}）</p>
                                  {userEditUrls.map((_, i) => {
                                    const locked = !pro && i >= FREE_LINK_LIMIT;
                                    const proSlot = i >= FREE_LINK_LIMIT; // v5.20: FREE上限超はPRO特典
                                    return (
                                      <div key={i} className={`space-y-2 pb-4 last:border-0 ${proSlot ? 'relative bg-amber-50/70 border border-amber-200 rounded-2xl px-3 pt-3' : 'border-b border-neutral-100'} ${locked ? 'opacity-40' : ''}`}>
                                        {proSlot && !locked && <span className="absolute -top-2 right-3 z-10 text-[8px] font-bold px-2 py-0.5 rounded-full shadow-sm bg-amber-400 text-black">✦ PRO特典</span>}
                                        <div className="flex items-center gap-2">
                                          <p className="text-[9px] text-neutral-400 uppercase tracking-widest font-mono">Link {i+1}</p>
                                          {locked && <span className="text-[8px] bg-amber-100 text-amber-600 px-2 py-0.5 rounded-full font-semibold">PRO限定</span>}
                                        </div>
                                        <div className={locked ? 'pointer-events-none' : ''}>
                                          <SNSLabelPicker dark={false} value={userEditUrls[i]?.label||""} isCustom={userEditUrls[i]?._custom||false}
                                            onSelect={(label, isCustom) => { if(locked) return; setUserEditUrls(prev => { const n=prev.map(x=>({...x})); n[i]={...n[i],label,_custom:isCustom}; return n; }); }} />
                                          <input type="url" value={userEditUrls[i]?.url||""}
                                            onChange={e => { if(locked) return; const val=e.target.value; setUserEditUrls(prev => { const n=prev.map(x=>({...x})); n[i]={...n[i],url:val}; return n; }); }}
                                            placeholder={locked ? "PROプランで利用可能" : "https://..."}
                                            disabled={locked}
                                            className="w-full mt-2 px-3 py-2.5 bg-yellow-200 border border-neutral-200 rounded-xl focus:outline-none focus:border-black text-xs font-mono disabled:bg-neutral-50 disabled:cursor-not-allowed" />
                                        </div>
                                      </div>
                                    );
                                  })}
                                </>)}

                                {/* ───── タグタブ ───── */}
                                {editTab === "tags" && (() => {
                                  const savedActive = mySavedTags.slice(0, pro ? PRO_TAG_LIMIT : FREE_TAG_LIMIT);
                                  return (<>
                                  <p className="text-[10px] text-neutral-500">タグ（{pro ? `最大${PRO_TAG_LIMIT}個` : `FREE: ${FREE_TAG_LIMIT}個`}・各{TAG_MAX_LEN}文字以内・全体公開も1個分）</p>
                                  <div className="text-[10px] bg-blue-50 text-blue-600 px-3 py-2 rounded-xl border border-blue-100 space-y-1">
                                    <p>同じタグを設定している他のユーザーと、お互いの名刺（表示名とリンク）が見え合うようになります</p>
                                    <p>例：業界（<b>飲食</b>）、会社名（<b>トヨタ</b>）、趣味（<b>DIY</b>）、地域（<b>渋谷</b>）</p>
                                    <p>※ タグ仲間には、同じタグの人の中から開くたびにランダムで最大{TAG_FRIENDS_FREE}名（PROは{TAG_FRIENDS_PRO}名）まで表示されます</p>
                                  </div>
                                  {/* ★ あなたのタグが今誰に見えているか（透明性） */}
                                  {savedActive.length > 0 && (
                                    <div className="text-[10px] bg-green-50 text-green-700 px-3 py-2 rounded-xl border border-green-100 space-y-0.5">
                                      <p className="font-semibold">👀 あなたの名刺が見えている人</p>
                                      {savedActive.map(t => (
                                        <p key={t}>{normalizeTag(t) === "all" ? "🌐 全体公開" : `# ${t}`} … 今 <b>{tagCounts[normalizeTag(t)] ?? "–"}</b> 人に見えています</p>
                                      ))}
                                    </div>
                                  )}
                                  <div className="text-[10px] bg-neutral-100 text-neutral-600 px-3 py-2 rounded-xl border border-neutral-200">
                                    ⚠️ タグは下の<b>「タグを保存」</b>ボタンでのみ保存されます。画面下のSAVEボタンでは保存されません。保存後<b>24時間</b>はタグを変更できません（削除はいつでも可能）
                                  </div>
                                  {tagNextChange > Date.now() && (
                                    <div className="text-[10px] bg-red-50 text-red-500 px-3 py-2 rounded-xl border border-red-100 font-semibold">
                                      🔒 次のタグ変更まで 残り約{Math.ceil((tagNextChange - Date.now()) / (60 * 60 * 1000))}時間（削除はいつでも可能）
                                    </div>
                                  )}
                                  {tagsDirty && (
                                    <div className="text-[10px] bg-amber-50 text-amber-700 px-3 py-2 rounded-xl border border-amber-200 font-semibold animate-pulse">
                                      ● 入力中のタグはまだ保存されていません
                                    </div>
                                  )}
                                  {/* フェーズ3: トグル+入力欄は管理画面と共通（TagFields） */}
                                  <TagFields tags={userEditTags} pro={pro} confirmAllOn
                                    onChange={t => { setUserEditTags(t); setTagSaveMsg(""); }}
                                    onNotice={setTagSaveMsg} />
                                  <button onClick={saveMyTags}
                                    className={`w-full py-3 rounded-2xl text-[11px] font-bold uppercase tracking-widest active:scale-95 transition-all ${tagsDirty ? 'bg-amber-500 text-white shadow-md' : 'bg-neutral-800 text-white hover:bg-black'}`}>
                                    {tagsDirty ? "● タグを保存する" : "タグを保存"}
                                  </button>
                                  {tagSaveMsg && <p className={`text-[10px] mt-1 ${tagSaveMsg.startsWith("✓") ? 'text-green-500' : 'text-red-500'}`}>{tagSaveMsg}</p>}
                                  </>);
                                })()}

                              </div>{/* /スクロール領域 */}

                              {/* フッターボタン（固定） */}
                              <div className="px-5 py-4 border-t border-neutral-100 flex gap-3 flex-shrink-0">
                                <button onClick={handleFooterSave}
                                  className={`flex-1 py-3.5 rounded-2xl text-[11px] font-bold uppercase tracking-widest active:scale-95 transition-all ${editDirty ? 'bg-amber-500 text-white shadow-md' : 'bg-black text-white hover:bg-neutral-800'}`}>
                                  {editDirty ? "● SAVE" : "SAVE"}
                                </button>
                                <button onClick={closeEditSheet}
                                  className="px-5 py-3.5 text-[10px] text-neutral-400 hover:text-black rounded-2xl border border-neutral-200 transition-colors">キャンセル</button>
                              </div>
                            </div>
                          </>
                          );
                        })()}
                      </>);
                    })()}

                  </motion.div>
                )}
              </AnimatePresence>

              <footer className="mt-24 py-10 border-t border-neutral-100">
                <button onClick={() => setIsAdminMode(true)}
                  className="text-[9px] text-neutral-300 font-mono uppercase tracking-[0.4em] text-center w-full hover:text-neutral-500 transition-colors">
                  © 2026 NEXUA
                </button>
              </footer>
            </div>
          </div>
        );
      }

