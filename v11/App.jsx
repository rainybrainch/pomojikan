/* App.jsx ── design_canvas のメインアプリ
   各セクションに刷新案を配置する。
*/

const { useState: useSt, useEffect: useEf } = React;

/* ─── インタラクティブ・プロトタイプ（Tweaks付き） ─── */
function InteractivePrototype() {
  const defaults = /*EDITMODE-BEGIN*/{
    "theme": "yoruame",
    "motionLevel": 1,
    "showWordOfDay": true,
    "hasParty": true
  }/*EDITMODE-END*/;
  const [t, setTweak] = useTweaks(defaults);
  const theme = THEMES[t.theme] || THEMES.yoruame;
  const [modal, setModal] = useSt(null);

  const partyOptions = t.hasParty ? [
    { ch: '禅', tier: 8, lv: 47, exp: 72 },
    { ch: '雨', tier: 6, lv: 23, exp: 40 },
    { ch: 'き', tier: 1, lv: 18, exp: 88 },
    null,
  ] : [null,null,null,null];

  return (
    <>
      <MainScreen
        theme={theme}
        interactive={true}
        initialMode="work"
        motionLevel={t.motionLevel}
        showWordOfDay={t.showWordOfDay}
        party={partyOptions}
        cycles={1}
        onOpenModal={(m)=>setModal(m)}
      />

      {/* 内蔵モーダル：プロトタイプ内で開けるよう簡易表示 */}
      {modal && (
        <div className="proto-modal-bg" onClick={()=>setModal(null)} style={{
          position: 'absolute', inset: 0, zIndex: 100,
          background: 'rgba(0,0,0,.5)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        }}>
          <div onClick={e=>e.stopPropagation()} style={{
            background: theme.bgMid,
            color: theme.ink,
            width: '100%', height: '88%',
            borderRadius: '20px 20px 0 0',
            overflow: 'hidden',
            position: 'relative',
            border: `1px solid ${theme.line}`,
          }}>
            <button onClick={()=>setModal(null)} style={{
              position: 'absolute', top: 12, right: 14, zIndex: 10,
              width: 32, height: 32, borderRadius: '50%',
              background: theme.surface, color: theme.ink, border: `1px solid ${theme.line}`,
              cursor: 'pointer', fontSize: 16,
            }}>×</button>
            {modal === 'codex' && <CodexScreen theme={theme} />}
            {modal === 'help' && <HelpScreen theme={theme} />}
            {modal === 'party-picker' && <PartyPickerScreen theme={theme} />}
            {modal === 'writings' && <WritingsScreen theme={theme} />}
            {modal === 'menu' && <MenuPanel theme={theme} onItem={(m)=>setModal(m)} />}
            {modal === 'timer-settings' && <TimerSettingsScreen theme={theme} />}
          </div>
        </div>
      )}

      <TweaksPanel title="Tweaks">
        <TweakSection title="世界（テーマ）">
          <TweakSelect
            label="テーマ"
            value={t.theme}
            options={THEME_LIST.map(id => ({ value: id, label: `${THEMES[id].name}（${THEMES[id].yomi}）` }))}
            onChange={v => setTweak('theme', v)}
          />
        </TweakSection>
        <TweakSection title="演出">
          <TweakRadio
            label="モーション量"
            value={String(t.motionLevel)}
            options={[
              { value: '0', label: '控えめ' },
              { value: '1', label: '普通' },
              { value: '2', label: '豪奢' },
            ]}
            onChange={v => setTweak('motionLevel', Number(v))}
          />
          <TweakToggle label="今日の言葉を表示" value={t.showWordOfDay} onChange={v => setTweak('showWordOfDay', v)} />
          <TweakToggle label="パーティを編成済みにする" value={t.hasParty} onChange={v => setTweak('hasParty', v)} />
        </TweakSection>
        <TweakSection title="開く（プレビュー）">
          <TweakButton label="図鑑を開く" onClick={()=>setModal('codex')} />
          <TweakButton label="遊び方を開く" onClick={()=>setModal('help')} />
          <TweakButton label="リーダー選択を開く" onClick={()=>setModal('party-picker')} />
          <TweakButton label="文章モードを開く" onClick={()=>setModal('writings')} />
          <TweakButton label="メニューを開く" onClick={()=>setModal('menu')} />
        </TweakSection>
      </TweaksPanel>
    </>
  );
}

/* ─── メニューパネル（プロトタイプ内モーダルとして表示） ─── */
function MenuPanel({ theme, onItem }) {
  const items = [
    { id: 'codex', icon: '図', label: '図鑑', desc: '集めた字を眺める' },
    { id: 'writings', icon: '文', label: '文章', desc: '日記・俳句を編む' },
    { id: 'stats', icon: '録', label: '記録', desc: '累計・解放状況' },
    { id: 'theme', icon: '色', label: 'テーマ', desc: '世界を替える' },
    { id: 'audio', icon: '音', label: '音響', desc: 'オン／オフ' },
    { id: 'sleep', icon: '寝', label: 'スリープ', desc: '画面を黒く' },
    { id: 'help', icon: '？', label: '遊び方' },
    { id: 'data', icon: '貯', label: 'データ管理' },
  ];
  return (
    <div className="screen menu-screen" style={{ background: theme.bgMid, color: theme.ink, fontFamily: theme.bodyFont, padding: '30px 20px' }}>
      <h2 style={{ fontFamily: theme.displayFont, marginBottom: 18 }}>メニュー</h2>
      <div className="menu-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
        {items.map(it => (
          <button key={it.id} onClick={() => onItem(it.id === 'help' ? 'help' : it.id === 'codex' || it.id === 'writings' ? it.id : null)} style={{
            display: 'flex', gap: 14, alignItems: 'center', padding: 16,
            background: theme.surface, border: `1px solid ${theme.line}`, borderRadius: 14,
            color: theme.ink, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
          }}>
            <span style={{
              width: 40, height: 40, borderRadius: '50%',
              background: theme.bgDeep,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: theme.accent, fontFamily: theme.displayFont, fontSize: 20, flex: '0 0 auto',
            }}>{it.icon}</span>
            <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <strong style={{ fontFamily: theme.displayFont, fontSize: 15, letterSpacing: '.05em' }}>{it.label}</strong>
              {it.desc && <small style={{ color: theme.inkMute, fontSize: 11 }}>{it.desc}</small>}
            </span>
          </button>
        ))}
      </div>
      <div style={{ marginTop: 18, textAlign: 'center', fontSize: 10, color: theme.inkDim, letterSpacing: '.15em' }}>
        v10n3 ・ ぽもじかん
      </div>
    </div>
  );
}

/* ─── タイマー設定（簡易プレビュー） ─── */
function TimerSettingsScreen({ theme }) {
  const [preset, setPreset] = useSt(0);
  const presets = [['25','5'],['50','10'],['15','3']];
  return (
    <div className="screen ts-screen" style={{ background: theme.bgMid, color: theme.ink, fontFamily: theme.bodyFont, padding: '30px 20px' }}>
      <h2 style={{ fontFamily: theme.displayFont }}>時間設定</h2>
      <div style={{ display: 'flex', gap: 8, margin: '20px 0' }}>
        {presets.map((p, i) => (
          <button key={i} onClick={()=>setPreset(i)} style={{
            flex: 1, padding: '16px 0',
            background: preset === i ? theme.accent : 'transparent',
            color: preset === i ? (theme.luminance === 'light' ? '#fff' : theme.bgDeep) : theme.ink,
            border: `1px solid ${preset === i ? 'transparent' : theme.line}`,
            borderRadius: 12,
            cursor: 'pointer', fontFamily: theme.displayFont,
            fontSize: 20, letterSpacing: '.04em',
          }}>{p[0]}<small style={{ opacity: .6, fontSize: 12 }}>/{p[1]}</small></button>
        ))}
      </div>
      <div style={{ background: theme.surface, border: `1px solid ${theme.line}`, borderRadius: 14, padding: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0', borderBottom: `1px solid ${theme.line}` }}>
          <span style={{ color: theme.inkMute, fontSize: 12, letterSpacing: '.1em' }}>集中</span>
          <span style={{ fontFamily: theme.displayFont, fontSize: 22 }}>{presets[preset][0]} 分</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0', borderBottom: `1px solid ${theme.line}` }}>
          <span style={{ color: theme.inkMute, fontSize: 12, letterSpacing: '.1em' }}>休憩</span>
          <span style={{ fontFamily: theme.displayFont, fontSize: 22 }}>{presets[preset][1]} 分</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0' }}>
          <span style={{ color: theme.inkMute, fontSize: 12, letterSpacing: '.1em' }}>セット</span>
          <div style={{ display: 'flex', gap: 4 }}>
            {['1','3','4','6','∞'].map((n,i) => (
              <button key={i} style={{
                width: 32, height: 32, borderRadius: '50%',
                background: i === 1 ? theme.accent : 'transparent',
                color: i === 1 ? (theme.luminance === 'light' ? '#fff' : theme.bgDeep) : theme.ink,
                border: `1px solid ${i === 1 ? 'transparent' : theme.line}`,
                fontFamily: theme.displayFont, cursor: 'pointer',
              }}>{n}</button>
            ))}
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
        <button style={{ flex: 1, padding: 14, background: 'transparent', color: theme.inkMute, border: `1px solid ${theme.line}`, borderRadius: 12, cursor: 'pointer', fontFamily: 'inherit' }}>キャンセル</button>
        <button style={{ flex: 2, padding: 14, background: theme.accent, color: theme.luminance === 'light' ? '#fff' : theme.bgDeep, border: 0, borderRadius: 12, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}>適用</button>
      </div>
    </div>
  );
}

/* ─── ルート：design_canvas にセクション配置 ─── */
function App() {
  return (
    <DesignCanvas
      title="ぽもじかん UI改良 v10n3 → v11"
      subtitle="字の降る、小さな世界 ─ 5つの世界・刷新モーダル・レスポンシブ"
      defaultZoom={0.7}
    >
      <DCSection id="concept" title="01 ─ コンセプト">
        <DCArtboard id="concept-sheet" label="UI改良の方針" width={1280} height={720}>
          <ConceptSheet />
        </DCArtboard>
      </DCSection>

      <DCSection id="themes" title="02 ─ 5つの世界（メイン画面・並走）">
        {THEME_LIST.map(id => (
          <DCArtboard key={id} id={`theme-${id}`} label={`${THEMES[id].name}（${THEMES[id].yomi}）`} width={300} height={650}>
            <MainScreen
              theme={THEMES[id]}
              interactive={false}
              initialMode="work"
              motionLevel={1}
              showWordOfDay={true}
              party={[
                { ch: '禅', tier: 8, lv: 47, exp: 72 },
                { ch: '雨', tier: 6, lv: 23, exp: 40 },
                null, null,
              ]}
              cycles={1}
            />
          </DCArtboard>
        ))}
      </DCSection>

      <DCSection id="proto" title="03 ─ 動くプロトタイプ（Tweaksで世界を替える）">
        <DCArtboard id="prototype" label="メイン画面・インタラクティブ" width={390} height={844}>
          <InteractivePrototype />
        </DCArtboard>
      </DCSection>

      <DCSection id="modals" title="04 ─ モーダル刷新">
        <DCArtboard id="m-codex" label="図鑑 ─ 階層平準化" width={390} height={720}>
          <CodexScreen theme={THEMES.yoruame} />
        </DCArtboard>
        <DCArtboard id="m-help" label="遊び方 ─ 11節→4枚" width={390} height={720}>
          <HelpScreen theme={THEMES.yoruame} />
        </DCArtboard>
        <DCArtboard id="m-party" label="リーダーを選ぶ" width={390} height={720}>
          <PartyPickerScreen theme={THEMES.yoruame} />
        </DCArtboard>
        <DCArtboard id="m-writings" label="文章モード（俳句）" width={390} height={720}>
          <WritingsScreen theme={THEMES.yoruame} />
        </DCArtboard>
      </DCSection>

      <DCSection id="modals-sumi" title="05 ─ モーダル：墨道テーマでも確認">
        <DCArtboard id="m-codex-sumi" label="図鑑（墨道）" width={390} height={720}>
          <CodexScreen theme={THEMES.sumido} />
        </DCArtboard>
        <DCArtboard id="m-help-sumi" label="遊び方（墨道）" width={390} height={720}>
          <HelpScreen theme={THEMES.sumido} />
        </DCArtboard>
        <DCArtboard id="m-party-sumi" label="リーダー選択（春霞）" width={390} height={720}>
          <PartyPickerScreen theme={THEMES.harugasumi} />
        </DCArtboard>
        <DCArtboard id="m-writings-sumi" label="文章モード（金閣）" width={390} height={720}>
          <WritingsScreen theme={THEMES.kinkaku} />
        </DCArtboard>
      </DCSection>

      <DCSection id="desktop" title="06 ─ デスクトップ（PCはレスポンシブで広く呼吸させる）">
        <DCArtboard id="desktop-yoruame" label="夜雨・PC" width={1280} height={800}>
          <DesktopScreen theme={THEMES.yoruame} />
        </DCArtboard>
        <DCArtboard id="desktop-kinkaku" label="金閣・PC" width={1280} height={800}>
          <DesktopScreen theme={THEMES.kinkaku} />
        </DCArtboard>
      </DCSection>
    </DesignCanvas>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
