import { FREE_TAG_LIMIT, PRO_TAG_LIMIT, TAG_MAX_LEN, TAG_PLACEHOLDERS, normalizeTag, FONT_OPTIONS } from "../lib/core";
import { appConfirm } from "../lib/dialog";

      export function TagFields({ tags, onChange, pro, dark, lockedEditable, confirmAllOn, onNotice }) {
        const allOn = (tags || []).some(t => normalizeTag(t) === "all");
        const nonAll = (tags || []).filter(t => normalizeTag(t) !== "all");
        const compose = (on, rest) => (on ? ["all"] : []).concat(rest);
        const slotLimit = (pro ? PRO_TAG_LIMIT : FREE_TAG_LIMIT) - (allOn ? 1 : 0);
        const inputCls = dark
          ? "w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-xl focus:outline-none focus:border-neutral-500 text-xs text-white placeholder:text-neutral-600"
          : "w-full px-3 py-2.5 bg-yellow-200 border border-neutral-200 rounded-xl focus:outline-none focus:border-black text-sm disabled:bg-neutral-50 disabled:cursor-not-allowed";
        return (<>
          {/* 全体公開トグル（旧「all」タグ） */}
          <label className={`flex items-center justify-between gap-3 px-3 py-3 rounded-xl border cursor-pointer transition-colors ${
            allOn ? (dark ? 'bg-amber-500/10 border-amber-500/40' : 'bg-amber-50 border-amber-300')
                  : (dark ? 'bg-neutral-800 border-neutral-700' : 'bg-neutral-50 border-neutral-200')}`}>
            <span className={`text-[11px] ${dark ? 'text-neutral-300' : 'text-neutral-700'}`}>
              <b>🌐 全体に公開する</b>
              <span className="block text-[10px] text-neutral-500 mt-0.5">ONにすると、全体公開中のすべての利用者にこの名刺（表示名とリンク）が表示されます{!pro && "（FREEはタグとの併用不可）"}</span>
            </span>
            <input type="checkbox" checked={allOn}
              onChange={async e => {
                const on = e.target.checked;
                if (on && confirmAllOn && !(await appConfirm("全体公開をONにすると、全体公開中のすべての利用者にあなたの表示名と名刺リンクが表示されます（反映には保存が必要です）。よろしいですか？"))) return;
                onChange(compose(on, nonAll));
              }}
              className="w-5 h-5 accent-amber-500 flex-shrink-0" />
          </label>
          {/* タグ入力欄 */}
          {Array.from({ length: PRO_TAG_LIMIT - (allOn ? 1 : 0) }).map((_, i) => {
            const locked = i >= slotLimit;
            const disabled = locked && !lockedEditable;
            return (
              <div key={i} className={`space-y-1 ${locked ? 'opacity-40' : ''}`}>
                <div className="flex items-center gap-2">
                  <p className={`text-[9px] uppercase tracking-widest font-mono ${dark ? 'text-neutral-300' : 'text-neutral-400'}`}>Tag {i+1}</p>
                  {locked && <span className={`text-[8px] px-2 py-0.5 rounded-full font-semibold ${dark ? 'bg-amber-500/20 text-amber-400' : 'bg-amber-100 text-amber-600'}`}>
                    {!pro ? (lockedEditable ? "PRO限定（保存可・無効）" : "PRO限定") : "全体公開で1枠使用中"}</span>}
                </div>
                <input type="text" value={nonAll[i] || ""} maxLength={TAG_MAX_LEN}
                  onChange={e => {
                    if (disabled) return;
                    const val = e.target.value;
                    if (normalizeTag(val) === "all") { onNotice && onNotice("全体公開は上のスイッチで設定してください"); return; }
                    const rest = [...nonAll];
                    while (rest.length < PRO_TAG_LIMIT) rest.push("");
                    rest[i] = val;
                    onChange(compose(allOn, rest));
                  }}
                  placeholder={disabled ? (!pro ? "PROプランで利用可能" : "全体公開をOFFにすると使えます") : TAG_PLACEHOLDERS[i] || "例：タグ"}
                  disabled={disabled}
                  className={inputCls} />
              </div>
            );
          })}
        </>);
      }

      /* ── プロフィール文字入力フォーム（ユーザー編集/管理者編集 共通）──
         フェーズ3: 二重実装を統合。dark=true で管理画面（黒）テーマ。
         ここを変更すれば両画面に反映される（個別修正は不要） */
      export function ProfileTextFields({ profile, setProfile, dark }) {
        const labelCls = `text-[9px] uppercase tracking-widest mb-1 ${dark ? 'text-neutral-400' : 'text-neutral-500'}`;
        const inputCls = dark
          ? "w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-xl focus:outline-none focus:border-neutral-500 text-xs text-white placeholder:text-neutral-600"
          : "w-full px-3 py-2.5 bg-yellow-200 border border-neutral-200 rounded-xl focus:outline-none focus:border-black text-sm";
        const dividerCls = dark ? 'border-neutral-800' : 'border-neutral-100';
        const noteCls = dark
          ? "text-[10px] bg-blue-500/10 text-blue-300 px-3 py-2 rounded-xl border border-blue-500/20"
          : "text-[10px] bg-blue-50 text-blue-600 px-3 py-2 rounded-xl border border-blue-100";
        const set = (key) => (e) => { const v = e.target.value; setProfile(p => ({ ...p, [key]: v })); };
        const ff = (fontKey) => ({ fontFamily: FONT_OPTIONS[profile[fontKey] ?? 0]?.value });
        return (<>
          {/* 会社名 */}
          <div className={`border-t ${dividerCls} pt-3`}>
            <p className={labelCls}>会社名</p>
            <input type="text" value={profile.company||""} onChange={set('company')}
              placeholder="例：株式会社〇〇" style={ff('companyFont')} className={inputCls} />
          </div>
          {/* 肩書き */}
          <div>
            <p className={labelCls}>肩書き</p>
            <input type="text" value={profile.title||""} onChange={set('title')}
              placeholder="例：代表取締役 / エンジニア" style={ff('titleFont')} className={inputCls} />
          </div>
          {/* 名前 */}
          <div>
            <p className={labelCls}>名前</p>
            <textarea rows={3} value={profile.name||""} onChange={set('name')}
              placeholder="例：鈴木 一郎" style={{resize:"none", ...ff('nameFont')}} className={inputCls} />
          </div>
          {/* 住所 */}
          <div>
            <p className={labelCls}>住所</p>
            <input type="text" value={profile.address||""} onChange={set('address')}
              placeholder="例：東京都渋谷区〇〇1-2-3" style={ff('addressFont')} className={inputCls} />
          </div>
          {/* 電話番号 */}
          <div>
            <p className={labelCls}>電話番号</p>
            <input type="tel" value={profile.phone||""} onChange={set('phone')}
              placeholder="例：090-1234-5678" style={ff('phoneFont')} className={inputCls} />
          </div>
          {/* タグ仲間向けの連絡先（任意） */}
          <div className={`border-t ${dividerCls} pt-3 space-y-2`}>
            <p className={labelCls}>タグ仲間に見せる連絡先（任意）</p>
            <p className={noteCls}>タグ仲間から名刺を開いた人には、上の電話番号・住所の代わりに<b>ここに入力した内容だけ</b>が表示されます。<b>空欄ならその項目は表示されません</b>。QRコードやURLを直接渡した相手には、これまで通り上の連絡先が表示されます</p>
            <div>
              <p className={labelCls}>タグ用 住所</p>
              <input type="text" value={profile.tagAddress||""} onChange={set('tagAddress')}
                placeholder="例：東京都渋谷区（市区まで等。空欄=非表示）" className={inputCls} />
            </div>
            <div>
              <p className={labelCls}>タグ用 電話番号</p>
              <input type="tel" value={profile.tagPhone||""} onChange={set('tagPhone')}
                placeholder="例：会社の代表番号（空欄=非表示）" className={inputCls} />
            </div>
          </div>
          {/* 裏面アピール */}
          <div className={`border-t ${dividerCls} pt-3`}>
            <p className={`${labelCls} mb-2`}>裏面アピール（4つ）</p>
            {[0,1,2,3].map(i => (
              <input key={i} type="text" value={profile.appeals?.[i]||""}
                onChange={e => { const v=e.target.value; setProfile(p => { const a=[...(p.appeals||["","","",""])]; a[i]=v; return {...p,appeals:a}; }); }}
                placeholder={`アピール${i+1}（例：〇〇の経験10年）`}
                style={{fontFamily:FONT_OPTIONS[profile.appealFonts?.[i]??0]?.value}}
                className={`${inputCls} mb-2`} />
            ))}
          </div>
        </>);
      }

