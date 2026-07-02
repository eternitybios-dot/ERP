// ══ ビュー切り替え ═══════════════════════════════════
function showView(name) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  const view = document.getElementById('view-' + name);
  view.classList.add('active');
  view.querySelector('.view-body')?.scrollTo(0, 0);
  document.querySelector(`.nav-btn[data-view="${name}"]`)?.classList.add('active');

  if (name !== 'hrt') stopCrTimer(null);

  if (name === 'home') renderHome();
  if (name === 'erp') { recordType = 'compulsion'; updateQuickFill(); }
  if (name === 'hrt') { recordType = 'tic'; updateQuickFill(); }
  if (name === 'history') renderHistory();
  if (name === 'graph') { Chart.render(); renderCheckin(); renderDiscoveries(); }
}

// ══ ホーム ═══════════════════════════════════════════
function renderHome() {
  const recs = Storage.getToday();
  const score = recs.reduce((s, r) => s + r.score, 0);
  const wins = recs.filter(r =>
    r.planned === true ||
    r.reaction === 'しなかった' || r.competing === 'できた' || r.competing === '少しできた'
  ).length;

  document.getElementById('today-score').textContent = score;
  document.getElementById('today-count').textContent = recs.length;
  document.getElementById('no-reaction-count').textContent = wins;
  document.getElementById('home-practice-days').textContent = Storage.getPracticeDays();

  const MSGS = [
    'まずは1タップ。記録するだけで前進です。',
    '不快感が残っていても、それは成功です。消すことが目的ではありません。',
    '反応しなかった瞬間が、少しずつ脳の回路を変えていきます。',
    '衝動は波。消そうとせず、乗ったまま生活に戻りましょう。',
    '完璧でなくて大丈夫。積み重ねた分だけ、確実に前へ進んでいます。',
  ];
  const idx = score === 0 ? 0 : (Math.floor(Date.now() / 300000) % (MSGS.length - 1)) + 1;
  let msg = MSGS[idx];

  // 週1回ほどの低頻度で「あなたの発見」を再表示（間隔をあけた想起。安心探し化を防ぐため頻度は上げない）
  const discs = Storage.getDiscoveries(30);
  const dayNum = parseInt(Storage.localDateStr(new Date()).split('-').join(''), 10);
  if (discs.length && dayNum % 7 === 0) {
    const d = discs[dayNum % discs.length];
    msg = `あなたの発見：『${d.insight || '予想より耐えられた'}』`;
  }
  document.getElementById('home-message').textContent = msg;

  renderPractice();
}

// ══ ワンタップ記録 ═══════════════════════════════════
function quickLog(kind) {
  let record;
  const base = {
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
    timestamp: new Date().toISOString(),
    memo: '',
  };
  if (kind === 'resisted') {
    record = { ...base, type: 'compulsion', discomfortLevel: null, urgeLevel: null,
      situation: 'その他', triggers: [], reaction: 'しなかった', enduranceTime: '0秒', bonuses: [] };
  } else if (kind === 'competing') {
    record = { ...base, type: 'tic', movement: 'その他', urgeLevel: null,
      awareness: true, competing: 'できた', urgePassed: true };
  } else if (kind === 'calm') {
    record = { ...base, type: 'calm' };
  } else { // backtolife
    record = { ...base, type: 'compulsion', discomfortLevel: null, urgeLevel: null,
      situation: 'その他', triggers: [], reaction: 'しなかった', enduranceTime: '0秒',
      bonuses: ['不快なまま生活に戻れた'] };
  }
  record.score = Scoring.calculate(record);
  Storage.save(record);
  showFeedback(record);
}

// ══ 記録フォーム ═════════════════════════════════════
let recordType = 'compulsion';

const CR_GUIDES = {
  '目をパチパチ': 'まぶたの力をふっと抜いて（ギュッとつぶる・見開くをやめる）、やわらかい視線で正面を見ます。まばたきしたくなったら、速くパチパチせず、ゆっくり1回だけ意識して閉じて開く。ムズムズが引くまで続けます。',
  '鼻息を強く吐く': '口を軽く閉じ、鼻から4秒かけて吸い、6秒かけて細く長く吐きます（腹式呼吸）。強く吐きたい衝動は、このゆっくりした呼吸と両立しません。',
  '肩・首を動かす': '両手を太ももやひざにそっと置き、肩を軽く下げて止めます。動かしたい衝動が引くまで、その姿勢を保ちます。',
  '喉を鳴らす': '口を閉じて、鼻からゆっくり呼吸します。または軽く息を止め、衝動の波が引くのを待ちます。',
  '顔をしかめる': '表情の力をふっと抜き、口角と眉をニュートラルに保ちます。',
  'その他': 'その動きと「同時にはできない」反対の動作を選び、ムズムズが引くまでやさしく保ちます。',
};

function initForms() {
  // スライダー
  [['discomfort-slider', 'discomfort-value'], ['urge-slider', 'urge-value'],
   ['tic-urge-slider', 'tic-urge-value'], ['p-predict', 'p-predict-val']].forEach(([s, v]) => {
    const slider = document.getElementById(s);
    slider.addEventListener('input', () => { document.getElementById(v).textContent = slider.value; });
  });

  // チップ（単一・複数）＋アクセシビリティ
  document.querySelectorAll('.chip').forEach(chip => {
    chip.setAttribute('role', 'button');
    chip.setAttribute('tabindex', '0');
    chip.setAttribute('aria-pressed', 'false');
    chip.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); chip.click(); }
    });
  });
  document.querySelectorAll('.chip-group.single .chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const group = chip.closest('.chip-group');
      group.querySelectorAll('.chip').forEach(c => {
        c.classList.remove('selected');
        c.setAttribute('aria-pressed', 'false');
      });
      chip.classList.add('selected');
      chip.setAttribute('aria-pressed', 'true');
      if (chip.closest('#movement-chips')) showCrGuide(chip.dataset.value);
    });
  });
  document.querySelectorAll('.chip-group.multi .chip').forEach(chip => {
    chip.addEventListener('click', () => {
      chip.classList.toggle('selected');
      chip.setAttribute('aria-pressed', chip.classList.contains('selected') ? 'true' : 'false');
    });
  });

  document.getElementById('form-compulsion').addEventListener('submit', e => {
    e.preventDefault(); submitCompulsion();
  });
  document.getElementById('form-tic').addEventListener('submit', e => {
    e.preventDefault(); submitTic();
  });

  // 履歴の削除はイベントデリゲーション（onclick属性を使わない）
  document.getElementById('history-list').addEventListener('click', e => {
    const btn = e.target.closest('.delete-btn');
    if (btn) deleteRecord(btn.dataset.id);
  });

  // 練習メニューの削除・テンプレ追加もデリゲーション
  document.getElementById('menu-list').addEventListener('click', e => {
    const btn = e.target.closest('.menu-del');
    if (btn) deleteMenuItem(btn.dataset.id);
  });
  document.getElementById('menu-templates').addEventListener('click', e => {
    const btn = e.target.closest('.menu-tpl');
    if (btn) addTemplateItem(parseInt(btn.dataset.idx));
  });
}

function showCrGuide(movement) {
  const box = document.getElementById('cr-guide');
  document.getElementById('cr-guide-body').textContent = CR_GUIDES[movement] || CR_GUIDES['その他'];
  box.style.display = 'block';
}

function selectedChips(id) {
  return [...document.querySelectorAll(`#${id} .chip.selected`)].map(c => c.dataset.value);
}
function selectedSingle(id) {
  return document.querySelector(`#${id} .chip.selected`)?.dataset.value || null;
}

function submitCompulsion() {
  const rec = {
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
    timestamp: new Date().toISOString(),
    type: 'compulsion',
    discomfortLevel: parseInt(document.getElementById('discomfort-slider').value),
    urgeLevel: parseInt(document.getElementById('urge-slider').value),
    situation: selectedSingle('situation-chips') || 'その他',
    triggers: selectedChips('trigger-chips'),
    reaction: selectedSingle('reaction-chips') || 'した',
    enduranceTime: selectedSingle('endurance-chips') || '0秒',
    expectancy: selectedSingle('expectancy-chips'),
    bonuses: selectedChips('bonus-chips'),
    memo: document.getElementById('memo-c').value.trim().slice(0, 100),
    score: 0,
  };
  rec.score = Scoring.calculate(rec);
  Storage.save(rec);
  showFeedback(rec);
  resetForms();
}

function submitTic() {
  const rec = {
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
    timestamp: new Date().toISOString(),
    type: 'tic',
    movement: selectedSingle('movement-chips') || 'その他',
    urgeLevel: parseInt(document.getElementById('tic-urge-slider').value),
    awareness: selectedSingle('awareness-chips') === 'yes',
    competing: selectedSingle('competing-chips') || '出てしまった',
    urgePassed: selectedSingle('passed-chips') === 'yes',
    memo: document.getElementById('memo-t').value.trim().slice(0, 100),
    score: 0,
  };
  rec.score = Scoring.calculate(rec);
  Storage.save(rec);
  showFeedback(rec);
  resetForms();
}

function showFeedback(record) {
  const fb = document.getElementById('record-feedback');
  document.getElementById('feedback-score').textContent = `+${record.score}点`;
  const items = Scoring.breakdown(record);
  document.getElementById('feedback-breakdown').innerHTML = items.map(([label, pts]) =>
    `<div class="fb-item"><span class="fb-label">${esc(label)}</span><span class="fb-pts">+${pts}</span></div>`
  ).join('');
  const msgEl = fb.querySelector('.feedback-msgs');
  if (record.type === 'calm') {
    msgEl.innerHTML = '<p>穏やかな日も、大切な記録です。</p><p>経過がより正確に見えるようになります。</p>';
  } else if (record.expectancy === '予想より耐えられた') {
    msgEl.innerHTML = '<p>「思ったより大丈夫だった」——</p><p>この発見が、脳の予測を書き換えていきます。</p>';
  } else {
    msgEl.innerHTML = '<p>不快感が残っていても、成功です。</p><p>記録した時点で、前進しています。</p>';
  }
  fb.classList.add('show');
  if (navigator.vibrate) navigator.vibrate(30);
  setTimeout(() => { fb.classList.remove('show'); showView('home'); }, 3200);
}

function resetForms() {
  ['discomfort', 'urge', 'tic-urge'].forEach(n => {
    const s = document.getElementById(`${n}-slider`);
    const v = document.getElementById(`${n}-value`);
    if (s) { s.value = 5; v.textContent = '5'; }
  });
  document.querySelectorAll('.record-form .chip.selected').forEach(c => {
    c.classList.remove('selected');
    c.setAttribute('aria-pressed', 'false');
  });
  document.getElementById('cr-guide').style.display = 'none';
  document.getElementById('memo-c').value = '';
  document.getElementById('memo-t').value = '';
  stopCrTimer(null);
}

// ══ 前回の引き継ぎ ═══════════════════════════════════
function updateQuickFill() {
  const isTic = recordType === 'tic';
  const section = document.getElementById(isTic ? 'quick-fill-hrt' : 'quick-fill-erp');
  const summaryEl = document.getElementById(isTic ? 'qf-summary-hrt' : 'qf-summary-erp');
  const latest = Storage.getLatest(recordType);
  if (!latest) { section.style.display = 'none'; return; }
  const time = Storage.localTimeStr(latest.timestamp);
  if (isTic) {
    summaryEl.textContent = `前回 ${time}｜${latest.movement || 'クセ'}`;
  } else {
    const tags = [latest.situation, ...(latest.triggers || []).slice(0, 2)].filter(Boolean).join('・');
    summaryEl.textContent = `前回 ${time}｜${tags}`;
  }
  section.style.display = 'block';
}

function prefillFromLatest() {
  const r = Storage.getLatest(recordType);
  if (!r) return;
  if (recordType === 'tic') {
    setSingle('movement-chips', r.movement);
    if (r.movement) showCrGuide(r.movement);
    setSlider('tic-urge', r.urgeLevel);
    setSingle('awareness-chips', r.awareness ? 'yes' : 'no');
    setSingle('competing-chips', r.competing);
    setSingle('passed-chips', r.urgePassed ? 'yes' : 'no');
  } else {
    setSlider('discomfort', r.discomfortLevel);
    setSlider('urge', r.urgeLevel);
    setSingle('situation-chips', r.situation);
    setMulti('trigger-chips', r.triggers || []);
    setSingle('reaction-chips', r.reaction);
    setSingle('endurance-chips', r.enduranceTime);
    setMulti('bonus-chips', r.bonuses || []);
    // expectancy（予想との比較）は毎回の発見なので引き継がない
  }
}

function setSlider(name, val) {
  if (val == null) return;
  const s = document.getElementById(`${name}-slider`);
  const v = document.getElementById(`${name}-value`);
  if (s) { s.value = val; v.textContent = val; }
}
function setSingle(groupId, val) {
  document.querySelectorAll(`#${groupId} .chip`).forEach(c => {
    const on = c.dataset.value === val;
    c.classList.toggle('selected', on);
    c.setAttribute('aria-pressed', on ? 'true' : 'false');
  });
}
function setMulti(groupId, vals) {
  document.querySelectorAll(`#${groupId} .chip`).forEach(c => {
    const on = vals.includes(c.dataset.value);
    c.classList.toggle('selected', on);
    c.setAttribute('aria-pressed', on ? 'true' : 'false');
  });
}

// ══ 拮抗反応 1分キープタイマー（CBIT準拠） ═══════════
let crTimerId = null, crLeft = 0;

function toggleCrTimer() {
  if (crTimerId) { stopCrTimer('途中でも、やってみたこと自体が練習です。'); return; }
  crLeft = 60;
  const disp = document.getElementById('cr-timer-display');
  disp.style.display = 'block';
  disp.textContent = `あと ${crLeft} 秒`;
  document.getElementById('cr-timer-btn').textContent = '⏹ やめる';
  crTimerId = setInterval(() => {
    crLeft--;
    if (crLeft <= 0) {
      stopCrTimer('60秒キープできました。そのまま下で記録しましょう。');
      if (navigator.vibrate) navigator.vibrate([30, 60, 30]);
    } else {
      disp.textContent = `あと ${crLeft} 秒`;
    }
  }, 1000);
}

function stopCrTimer(msg) {
  if (crTimerId) { clearInterval(crTimerId); crTimerId = null; }
  const btn = document.getElementById('cr-timer-btn');
  const disp = document.getElementById('cr-timer-display');
  if (!btn || !disp) return;
  btn.textContent = '⏱ 1分キープしてみる';
  if (msg) { disp.style.display = 'block'; disp.textContent = msg; }
  else disp.style.display = 'none';
}

// ══ 今日の練習（計画的曝露／衝動曝露） ═══════════════
const PRACTICE_TEMPLATES = [
  { name: '気になる物を30秒ながめて、そのまま生活に戻る', difficulty: 'やさしい', type: 'compulsion' },
  { name: '少し気になる場所に触れて、洗わず・拭かずに次の行動へ', difficulty: 'ふつう', type: 'compulsion' },
  { name: '確認したくなっても1回だけにして、その場を離れる', difficulty: 'ふつう', type: 'compulsion' },
  { name: '嫌なイメージが浮かんでも、打ち消さずに30秒おいてみる', difficulty: 'ふつう', type: 'compulsion' },
  { name: 'いつもの回数・順番をわざと少し崩してみる', difficulty: 'チャレンジ', type: 'compulsion' },
  { name: '衝動をわざと呼んで、30秒チックを出さずに波に乗る', difficulty: 'やさしい', type: 'tic' },
  { name: '鏡の前で1分、ムズムズが来る瞬間に気づく練習', difficulty: 'やさしい', type: 'tic' },
  { name: '衝動の波に乗る時間を1分にのばしてみる', difficulty: 'ふつう', type: 'tic' },
];

const TIER_CLASS = { 'やさしい': 'tier-easy', 'ふつう': 'tier-mid', 'チャレンジ': 'tier-hard' };

function suggestedItem() {
  const menu = Storage.getPracticeMenu();
  if (!menu.length) return null;
  const today = Storage.getPracticeToday();
  const recent = Storage.getRecentPlannedDifficulties(3);
  const tiers = [...new Set(menu.map(m => m.difficulty))];
  const forced = Scoring.suggestTier(recent, tiers);
  let pool = forced ? menu.filter(m => m.difficulty === forced) : menu;
  if (!pool.length) pool = menu;
  const seed = parseInt(Storage.localDateStr(new Date()).split('-').join(''), 10);
  return pool[(seed + (today.swaps || 0)) % pool.length];
}

function renderPractice() {
  const card = document.getElementById('practice-card');
  if (!card) return;
  const menu = Storage.getPracticeMenu();
  const today = Storage.getPracticeToday();

  if (menu.length === 0) {
    card.innerHTML = `
      <div class="practice-head"><span class="practice-title">🎯 今日の練習</span></div>
      <p class="practice-intro">症状が出るのを待たずに、毎日1つ「小さな練習」を自分から仕掛けると回復が早まるよ。</p>
      <button type="button" class="btn btn-soft" onclick="openMenuEditor()">練習メニューをつくる</button>`;
    return;
  }
  if (today.status === 'done') {
    card.innerHTML = `<div class="practice-collapsed done">✓ 今日の練習に取り組めた${today.itemName ? `：${esc(today.itemName)}` : ''}</div>`;
    return;
  }
  if (today.status === 'passed') {
    card.innerHTML = `
      <div class="practice-collapsed">今日はおやすみ。また明日、気が向いたらで大丈夫。
        <button type="button" class="practice-link" onclick="resumePractice()">やっぱりやる</button>
      </div>`;
    return;
  }
  const item = suggestedItem();
  card.innerHTML = `
    <div class="practice-head">
      <span class="practice-title">🎯 今日の練習</span>
      <span class="practice-tag ${TIER_CLASS[item.difficulty] || ''}">${esc(item.difficulty)}</span>
    </div>
    <div class="practice-name">${esc(item.name)}</div>
    <div class="practice-actions">
      <button type="button" class="btn btn-primary" onclick="startPractice()">やってみる</button>
      <button type="button" class="btn btn-soft" onclick="passPractice()">今日はパス</button>
    </div>
    <div class="practice-links">
      <button type="button" class="practice-link" onclick="swapPractice()">べつの練習にする</button>
      <button type="button" class="practice-link" onclick="openMenuEditor()">メニューを編集</button>
    </div>`;
}

function passPractice() {
  const t = Storage.getPracticeToday();
  t.status = 'passed';
  Storage.setPracticeToday(t);
  renderPractice();
}

function resumePractice() {
  const t = Storage.getPracticeToday();
  t.status = 'pending';
  Storage.setPracticeToday(t);
  renderPractice();
}

function swapPractice() {
  const t = Storage.getPracticeToday();
  t.swaps = (t.swaps || 0) + 1;
  Storage.setPracticeToday(t);
  renderPractice();
}

// ── 練習メニュー編集 ─────────────────────────────────
function openMenuEditor() {
  renderMenuEditor();
  document.getElementById('menu-overlay').classList.add('show');
}

function closeMenuEditor() {
  document.getElementById('menu-overlay').classList.remove('show');
  renderPractice();
}

function renderMenuEditor() {
  const menu = Storage.getPracticeMenu();
  const list = document.getElementById('menu-list');
  list.innerHTML = menu.length
    ? menu.map(m => `
        <div class="menu-item">
          <span class="practice-tag ${TIER_CLASS[m.difficulty] || ''}">${esc(m.difficulty)}</span>
          <span class="menu-item-name">${esc(m.name)}</span>
          <button type="button" class="delete-btn menu-del" data-id="${esc(m.id)}" aria-label="削除">
            <svg viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
          </button>
        </div>`).join('')
    : '<p class="menu-empty">まだ練習がありません。下のテンプレから追加するか、自分で書いてみよう。</p>';

  const names = new Set(menu.map(m => m.name));
  const tpl = document.getElementById('menu-templates');
  const remaining = PRACTICE_TEMPLATES.filter(t => !names.has(t.name));
  tpl.innerHTML = remaining.length
    ? '<div class="menu-tpl-label">テンプレから追加</div>' + remaining.map((t, i) => `
        <button type="button" class="menu-tpl" data-idx="${PRACTICE_TEMPLATES.indexOf(t)}">
          ＋ ${esc(t.name)} <small>（${esc(t.difficulty)}）</small>
        </button>`).join('')
    : '';
}

function addMenuItem() {
  const input = document.getElementById('menu-name');
  const name = input.value.trim().slice(0, 60);
  if (!name) { alert('練習の内容を入れてください'); return; }
  const difficulty = selectedSingle('menu-diff') || 'ふつう';
  const type = selectedSingle('menu-type') || 'compulsion';
  const menu = Storage.getPracticeMenu();
  menu.push({ id: `${Date.now()}_${Math.random().toString(36).slice(2, 5)}`, name, difficulty, type });
  Storage.setPracticeMenu(menu);
  input.value = '';
  renderMenuEditor();
}

function addTemplateItem(idx) {
  const t = PRACTICE_TEMPLATES[idx];
  if (!t) return;
  const menu = Storage.getPracticeMenu();
  menu.push({ id: `${Date.now()}_${Math.random().toString(36).slice(2, 5)}`, ...t });
  Storage.setPracticeMenu(menu);
  renderMenuEditor();
}

function deleteMenuItem(id) {
  Storage.setPracticeMenu(Storage.getPracticeMenu().filter(m => m.id !== id));
  renderMenuEditor();
}

// ── ガイド付き練習フロー（予想 → 実施 → ふり返り） ──
let practiceItem = null;
let pTimerId = null, pElapsed = 0;

function startPractice() {
  practiceItem = suggestedItem();
  if (!practiceItem) return;

  document.getElementById('p-name').textContent = practiceItem.name;

  // 前回の発見を勇気づけとして表示（練習の文脈に限定）
  const disc = Storage.getDiscoveries(1)[0];
  const dEl = document.getElementById('p-discovery');
  if (disc) {
    dEl.textContent = `前回のあなたの発見：『${disc.insight || '予想より耐えられた'}』`;
    dEl.style.display = 'block';
  } else {
    dEl.style.display = 'none';
  }

  // リセット
  document.getElementById('p-predict').value = 5;
  document.getElementById('p-predict-val').textContent = '5';
  document.querySelectorAll('#p-expectancy .chip').forEach(c => {
    c.classList.remove('selected');
    c.setAttribute('aria-pressed', 'false');
  });
  document.getElementById('p-insight').value = '';
  showPracticeStep(1);
  document.getElementById('practice-overlay').classList.add('show');
}

function showPracticeStep(n) {
  [1, 2, 3].forEach(i => {
    document.getElementById(`p-step-${i}`).style.display = i === n ? 'block' : 'none';
  });
}

function practiceStep(n) {
  if (n === 2) {
    const isTic = practiceItem.type === 'tic';
    document.getElementById('p-guide').textContent = isTic
      ? 'チックを出さずに、ムズムズの波に乗ろう。波は必ず引いていくよ。'
      : '不快やムズムズが来ても、確認・打ち消し・安心探しはしない。不快はあっていい。波に乗ったまま続けよう。';
    document.getElementById('p-hint').textContent = isTic
      ? 'まずは30秒からでOK。慣れてきたら少しずつのばそう。'
      : '時間は目安。短くても、取り組んだこと自体に価値があるよ。';
    pElapsed = 0;
    updatePracticeTimer();
    clearInterval(pTimerId);
    pTimerId = setInterval(() => { pElapsed++; updatePracticeTimer(); }, 1000);
    showPracticeStep(2);
  } else if (n === 3) {
    clearInterval(pTimerId);
    pTimerId = null;
    showPracticeStep(3);
  }
}

function updatePracticeTimer() {
  const m = Math.floor(pElapsed / 60);
  const s = pElapsed % 60;
  document.getElementById('p-timer').textContent = `${m}:${String(s).padStart(2, '0')}`;
}

function finishPractice() {
  const rec = {
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
    timestamp: new Date().toISOString(),
    type: practiceItem.type,
    planned: true,
    practiceName: practiceItem.name,
    difficulty: practiceItem.difficulty,
    predicted: parseInt(document.getElementById('p-predict').value),
    expectancy: selectedSingle('p-expectancy'),
    insight: document.getElementById('p-insight').value.trim().slice(0, 30),
    practiceSeconds: pElapsed,
    memo: '',
    score: 0,
  };
  rec.score = Scoring.calculate(rec);
  Storage.save(rec);

  const t = Storage.getPracticeToday();
  t.status = 'done';
  t.itemName = practiceItem.name;
  Storage.setPracticeToday(t);

  closePracticeOverlay();
  showFeedback(rec);
}

function closePracticeOverlay() {
  clearInterval(pTimerId);
  pTimerId = null;
  document.getElementById('practice-overlay').classList.remove('show');
}

// ── 発見ノート（がんばりタブ） ───────────────────────
function renderDiscoveries() {
  const listEl = document.getElementById('discovery-list');
  if (!listEl) return;
  const discs = Storage.getDiscoveries(8);
  if (!discs.length) {
    listEl.innerHTML = '<p class="discovery-empty">練習のふり返りで「予想より耐えられた」や発見のひとことを記録すると、ここにたまっていくよ。</p>';
    return;
  }
  listEl.innerHTML = discs.map(r => {
    const d = Storage.localDateStr(r.timestamp);
    const [, m, day] = d.split('-');
    const context = r.practiceName || r.situation || r.movement || '';
    const text = r.insight ? `『${esc(r.insight)}』` : '予想より耐えられた ✨';
    return `
      <div class="discovery-item">
        <span class="discovery-date">${parseInt(m)}/${parseInt(day)}</span>
        <span class="discovery-text">${text}${context ? `<small>${esc(context)}</small>` : ''}</span>
      </div>`;
  }).join('');
}

// ══ 呼吸ガイド（衝動の波をやり過ごす） ═══════════════
let breathTimer = null, breathCount = 0;

function openBreathing() {
  breathCount = 0;
  document.getElementById('breathing-meta').textContent = '0 呼吸';
  document.getElementById('breathing-overlay').classList.add('show');
  runBreathPhase('inhale');
}

function runBreathPhase(phase) {
  const circle = document.getElementById('breath-circle');
  const text = document.getElementById('breath-text');
  if (phase === 'inhale') {
    circle.className = 'breath-circle inhale';
    text.textContent = '吸う';
    breathTimer = setTimeout(() => runBreathPhase('hold'), 4000);
  } else if (phase === 'hold') {
    text.textContent = '止める';
    breathTimer = setTimeout(() => runBreathPhase('exhale'), 1500);
  } else {
    circle.className = 'breath-circle exhale';
    text.textContent = '吐く';
    breathCount++;
    document.getElementById('breathing-meta').textContent = `${breathCount} 呼吸`;
    breathTimer = setTimeout(() => runBreathPhase('inhale'), 6000);
  }
}

function closeBreathing() {
  clearTimeout(breathTimer);
  breathTimer = null;
  document.getElementById('breathing-overlay').classList.remove('show');
}

// ══ 履歴 ═════════════════════════════════════════════
function renderHistory() {
  updateBackupHint();
  const all = Storage.getAll();
  const container = document.getElementById('history-list');
  if (all.length === 0) {
    container.innerHTML = '<p class="empty-msg">まだ記録がありません。<br>ホームのワンタップ記録から始めてみましょう。</p>';
    return;
  }

  const grouped = {};
  all.forEach(r => {
    const date = Storage.localDateStr(r.timestamp);
    (grouped[date] ||= []).push(r);
  });

  container.innerHTML = Object.entries(grouped)
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, recs]) => {
      const dayScore = recs.reduce((s, r) => s + r.score, 0);
      const [, m, d] = date.split('-');
      const rows = recs.slice().reverse().map(r => {
        if (r.planned) return plannedEntry(r);
        if (r.type === 'calm') return calmEntry(r);
        if (r.type === 'tic') return ticEntry(r);
        return compulsionEntry(r);
      }).join('');
      return `
        <div class="history-day">
          <div class="history-day-header">
            <span class="history-date">${parseInt(m)}月${parseInt(d)}日</span>
            <span class="history-day-score">${dayScore}点</span>
          </div>
          ${rows}
        </div>`;
    }).join('');
}

function compulsionEntry(r) {
  const good = r.reaction === 'しなかった';
  const detail = [
    r.discomfortLevel != null ? `不快度 ${esc(r.discomfortLevel)}/10` : null,
    r.enduranceTime && r.enduranceTime !== '0秒' ? `波 ${esc(r.enduranceTime)}` : null,
    r.expectancy === '予想より耐えられた' ? '予想より耐えられた✨' : null,
    (r.triggers && r.triggers.length) ? esc(r.triggers.slice(0, 2).join('・')) : null,
  ].filter(Boolean).join('　/　');
  return `
    <div class="history-entry">
      <div class="entry-top">
        <span class="entry-time">${esc(Storage.localTimeStr(r.timestamp))}</span>
        <span class="tag tag-c">強迫</span>
        <span class="entry-reaction${good ? ' good' : ''}">${esc(r.reaction || '記録')}</span>
        <span class="entry-score">+${esc(r.score)}</span>
        ${delBtn(r.id)}
      </div>
      ${detail ? `<div class="entry-detail">${detail}</div>` : ''}
      ${r.memo ? `<div class="entry-memo">${esc(r.memo)}</div>` : ''}
    </div>`;
}

function ticEntry(r) {
  const good = r.competing === 'できた' || r.competing === '少しできた';
  const detail = [
    r.urgeLevel != null ? `ムズムズ ${esc(r.urgeLevel)}/10` : null,
    r.awareness ? '気づけた' : null,
    r.urgePassed ? 'やり過ごせた' : null,
  ].filter(Boolean).join('　/　');
  return `
    <div class="history-entry tic">
      <div class="entry-top">
        <span class="entry-time">${esc(Storage.localTimeStr(r.timestamp))}</span>
        <span class="tag tag-t">クセ</span>
        <span class="entry-reaction${good ? ' good-lav' : ''}">${esc(r.movement || 'クセ')}・${esc(r.competing || '')}</span>
        <span class="entry-score lav">+${esc(r.score)}</span>
        ${delBtn(r.id)}
      </div>
      ${detail ? `<div class="entry-detail">${detail}</div>` : ''}
      ${r.memo ? `<div class="entry-memo">${esc(r.memo)}</div>` : ''}
    </div>`;
}

function plannedEntry(r) {
  const good = r.expectancy === '予想より耐えられた';
  const detail = [
    r.predicted != null ? `予想 ${esc(r.predicted)}/10` : null,
    r.expectancy ? esc(r.expectancy) + (good ? ' ✨' : '') : null,
  ].filter(Boolean).join('　/　');
  return `
    <div class="history-entry">
      <div class="entry-top">
        <span class="entry-time">${esc(Storage.localTimeStr(r.timestamp))}</span>
        <span class="tag tag-p">練習</span>
        <span class="entry-reaction good">${esc(r.practiceName || '計画練習')}</span>
        <span class="entry-score">+${esc(r.score)}</span>
        ${delBtn(r.id)}
      </div>
      ${detail ? `<div class="entry-detail">${detail}</div>` : ''}
      ${r.insight ? `<div class="entry-memo">💡 ${esc(r.insight)}</div>` : ''}
    </div>`;
}

function calmEntry(r) {
  return `
    <div class="history-entry calm">
      <div class="entry-top">
        <span class="entry-time">${esc(Storage.localTimeStr(r.timestamp))}</span>
        <span class="tag tag-calm">穏やか</span>
        <span class="entry-reaction">波が穏やかな一日</span>
        <span class="entry-score gold">+${esc(r.score)}</span>
        ${delBtn(r.id)}
      </div>
    </div>`;
}

function delBtn(id) {
  return `<button class="delete-btn" data-id="${esc(id)}" aria-label="削除">
    <svg viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
  </button>`;
}

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function deleteRecord(id) {
  if (!confirm('この記録を削除しますか？')) return;
  Storage.deleteById(id);
  renderHistory();
}

// ══ バックアップ・復元（v2形式・旧形式も復元可） ═════
function exportBackup() {
  const records = Storage.getAll();
  if (records.length === 0) { alert('まだ記録がありません。'); return; }
  const envelope = {
    app: 'hannou-shinai-renshucho',
    version: 2,
    exportedAt: new Date().toISOString(),
    records,
    checkins: Storage.getCheckins(),
    practiceMenu: Storage.getPracticeMenu(),
  };
  const blob = new Blob([JSON.stringify(envelope, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `練習帳バックアップ_${Storage.localDateStr(new Date())}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  Storage.setLastBackupAt(new Date().toISOString());
  updateBackupHint();
}

function importBackup(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const parsed = JSON.parse(e.target.result);
      let records, checkins = [];
      if (Array.isArray(parsed)) {
        records = parsed; // 旧形式（配列そのまま）
      } else if (parsed && Array.isArray(parsed.records)) {
        records = parsed.records; // v2形式
        checkins = Array.isArray(parsed.checkins) ? parsed.checkins : [];
      } else {
        throw 0;
      }
      if (!records.every(r => r && r.id && r.timestamp)) throw 0;

      const existing = Storage.getAll();
      const ids = new Set(existing.map(r => r.id));
      const added = records.filter(r => !ids.has(r.id));
      const merged = [...existing, ...added].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
      Storage.setAll(merged);

      const exC = Storage.getCheckins();
      const cDates = new Set(exC.map(c => c.date));
      const addedC = checkins.filter(c => c && c.date && !cDates.has(c.date));
      if (addedC.length) {
        Storage.setCheckins([...exC, ...addedC].sort((a, b) => a.date.localeCompare(b.date)));
      }

      // 練習メニューもマージ（IDで重複排除）
      if (!Array.isArray(parsed) && Array.isArray(parsed.practiceMenu)) {
        const exM = Storage.getPracticeMenu();
        const mIds = new Set(exM.map(m => m.id));
        const addedM = parsed.practiceMenu.filter(m => m && m.id && m.name && !mIds.has(m.id));
        if (addedM.length) Storage.setPracticeMenu([...exM, ...addedM]);
      }

      alert(`復元完了。記録${added.length}件${addedC.length ? `・セルフチェック${addedC.length}件` : ''}を追加しました。`);
      renderHistory();
    } catch {
      alert('ファイルの読み込みに失敗しました。\n正しいバックアップファイルを選んでください。');
    }
    input.value = '';
  };
  reader.readAsText(file);
}

// バックアップが古いとき、履歴画面にそっと知らせる
function updateBackupHint() {
  const hint = document.getElementById('backup-hint');
  if (!hint) return;
  const n = Storage.getAll().length;
  let show = false, msg = '';
  if (n >= 10) {
    const last = Storage.getLastBackupAt();
    if (!last) {
      show = true;
      msg = 'データはこの端末の中だけに保存されています。ときどきバックアップしておくと安心です。';
    } else {
      const days = Math.floor((Date.now() - new Date(last).getTime()) / 86400000);
      if (days >= 30) { show = true; msg = `最後のバックアップから${days}日たっています。`; }
    }
  }
  hint.style.display = show ? 'block' : 'none';
  hint.textContent = msg;
}

// ══ 月1セルフチェック（任意・4項目） ═════════════════
const CHECKIN_QS = [
  '強迫観念・侵入イメージに悩まされた',
  '強迫行為・確認・打ち消しに時間をとられた',
  'クセ・チックが気になった／生活に影響した',
  '生活・仕事・人との関わりに支障があった',
];
const CHECKIN_OPTS = ['ぜんぜん', '少し', 'そこそこ', 'かなり', '非常に'];

function renderCheckin() {
  const list = Storage.getCheckins();
  const status = document.getElementById('checkin-status');
  const btn = document.getElementById('checkin-open-btn');
  if (!status || !btn) return;

  let due = false;
  if (list.length === 0) {
    const all = Storage.getAll();
    if (all.length > 0) {
      const firstTs = all.reduce((m, r) => (r.timestamp < m ? r.timestamp : m), all[0].timestamp);
      due = (Date.now() - new Date(firstTs).getTime()) / 86400000 >= 14;
    }
  } else {
    const last = list[list.length - 1];
    due = (Date.now() - new Date(last.date + 'T00:00:00').getTime()) / 86400000 >= 30;
  }

  if (list.length) {
    const items = list.slice(-4).map(c => {
      const [, m, d] = c.date.split('-');
      return `${parseInt(m)}/${parseInt(d)}: ${c.total}点`;
    });
    status.textContent = items.join(' ／ ') + '（16点満点・低いほど楽）';
  } else {
    status.textContent = 'この1か月のつらさをざっくり記録して、長い目で経過を見るためのものです。義務ではありません。';
  }
  btn.style.display = due ? 'block' : 'none';
}

function openCheckin() {
  const box = document.getElementById('checkin-questions');
  box.innerHTML = CHECKIN_QS.map((q, i) => `
    <div class="checkin-q">
      <div class="checkin-q-label">${i + 1}. この1か月、${q}</div>
      <div class="chip-group single checkin-opts" data-q="${i}">
        ${CHECKIN_OPTS.map((o, v) => `<div class="chip" data-value="${v}" role="button" tabindex="0">${o}</div>`).join('')}
      </div>
    </div>`).join('');
  box.querySelectorAll('.chip').forEach(chip => {
    const select = () => {
      chip.closest('.chip-group').querySelectorAll('.chip').forEach(c => c.classList.remove('selected'));
      chip.classList.add('selected');
    };
    chip.addEventListener('click', select);
    chip.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(); }
    });
  });
  document.getElementById('checkin-overlay').classList.add('show');
}

function saveCheckinAnswers() {
  const answers = [];
  for (let i = 0; i < CHECKIN_QS.length; i++) {
    const sel = document.querySelector(`.checkin-opts[data-q="${i}"] .chip.selected`);
    answers.push(sel ? parseInt(sel.dataset.value) : null);
  }
  if (answers.some(a => a === null)) {
    alert('未回答の項目があります。直感で大丈夫です。');
    return;
  }
  const total = answers.reduce((s, v) => s + v, 0);
  Storage.saveCheckin({ date: Storage.localDateStr(new Date()), answers, total });
  closeCheckin();
  renderCheckin();
}

function closeCheckin() {
  document.getElementById('checkin-overlay').classList.remove('show');
}

// ══ 毎日のリマインダー（オプトイン・1日1回） ═════════
let reminderTimeout = null;

function nextReminderAt(hhmm, now = new Date()) {
  const [h, m] = hhmm.split(':').map(Number);
  const t = new Date(now);
  t.setHours(h, m, 0, 0);
  if (t <= now) t.setDate(t.getDate() + 1);
  return t;
}

function initReminder() {
  const s = Storage.getReminder();
  const timeInput = document.getElementById('reminder-time');
  timeInput.value = s.time;
  timeInput.addEventListener('change', () => {
    const st = Storage.getReminder();
    st.time = timeInput.value || '20:00';
    Storage.setReminder(st);
    updateReminderUi();
    scheduleReminder();
  });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) scheduleReminder();
  });
  updateReminderUi();
  scheduleReminder();
}

async function toggleReminder() {
  const s = Storage.getReminder();
  if (s.enabled) {
    s.enabled = false;
    Storage.setReminder(s);
  } else if ('Notification' in window) {
    const perm = await Notification.requestPermission();
    if (perm === 'granted') {
      s.enabled = true;
      Storage.setReminder(s);
    }
  }
  updateReminderUi();
  scheduleReminder();
}

function updateReminderUi() {
  const s = Storage.getReminder();
  const btn = document.getElementById('reminder-toggle');
  const status = document.getElementById('reminder-status');
  if (!btn || !status) return;
  if (!('Notification' in window)) {
    btn.style.display = 'none';
    status.textContent = 'この開き方ではアプリ内通知を使えません（ホーム画面に追加したアプリからなら設定できます）。下のカレンダー通知なら確実に届きます。';
    return;
  }
  if (Notification.permission === 'denied') {
    btn.style.display = 'none';
    status.textContent = '通知がブロックされています。iPhoneの「設定 → 通知 → 練習帳」から許可してください。';
    return;
  }
  btn.style.display = '';
  btn.textContent = s.enabled ? 'オフにする' : 'オンにする';
  status.textContent = s.enabled
    ? `毎日 ${s.time} にお知らせします。アプリを完全に閉じていると届かないことがあるので、確実にしたいときは下のカレンダー通知を併用してください。`
    : '1日1回だけ、そっとお知らせします。義務ではありません。';
}

function scheduleReminder() {
  clearTimeout(reminderTimeout);
  const s = Storage.getReminder();
  if (!s.enabled || !('Notification' in window) || Notification.permission !== 'granted') return;
  const next = nextReminderAt(s.time);
  reminderTimeout = setTimeout(() => {
    const today = Storage.localDateStr(new Date());
    if (Storage.getReminderLastShown() !== today) {
      Storage.setReminderLastShown(today);
      showReminderNotification();
    }
    scheduleReminder();
  }, next.getTime() - Date.now());
}

const REMINDER_MSGS = [
  '今日も1タップだけ、どうぞ。穏やかな日ボタンでもOKです。',
  '記録するだけで+1点。完璧じゃなくて大丈夫。',
  '波があってもなくても、開くだけで前進です。',
];

function showReminderNotification() {
  const body = REMINDER_MSGS[Math.floor(Math.random() * REMINDER_MSGS.length)];
  navigator.serviceWorker?.ready
    .then(reg => reg.showNotification('反応しない練習帳', {
      body,
      tag: 'daily-reminder',
      icon: 'icons/icon-192.png',
      badge: 'icons/icon-192.png',
    }))
    .catch(() => {});
}

// iPhoneで確実に届く方法：カレンダーの繰り返し通知（.ics）を生成
function downloadReminderIcs() {
  const time = document.getElementById('reminder-time').value || '20:00';
  const start = nextReminderAt(time);
  const pad = n => String(n).padStart(2, '0');
  const dt = `${start.getFullYear()}${pad(start.getMonth() + 1)}${pad(start.getDate())}` +
             `T${pad(start.getHours())}${pad(start.getMinutes())}00`;
  const stamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//renshucho//reminder//JA',
    'BEGIN:VEVENT',
    `UID:renshucho-daily-${time.replace(':', '')}@local`,
    `DTSTAMP:${stamp}`,
    `DTSTART:${dt}`,
    'RRULE:FREQ=DAILY',
    'SUMMARY:反応しない練習帳',
    'DESCRIPTION:1タップだけ、今日の練習を記録しよう',
    'BEGIN:VALARM',
    'TRIGGER:PT0S',
    'ACTION:DISPLAY',
    'DESCRIPTION:反応しない練習帳',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
  const blob = new Blob([ics], { type: 'text/calendar' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = '練習帳リマインダー.ics';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ══ アプリ更新 ═══════════════════════════════════════
function forceUpdate() {
  caches.keys()
    .then(keys => Promise.all(keys.map(k => caches.delete(k))))
    .then(() => navigator.serviceWorker?.getRegistrations() || Promise.resolve([]))
    .then(regs => Promise.all(regs.map(r => r.unregister())))
    .then(() => location.reload());
}

// ══ 初期化 ═══════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => showView(btn.dataset.view));
  });
  initForms();
  initReminder();
  showView('home');

  // ストレージの永続化を要求（iOSの自動削除への保険）
  if (navigator.storage && navigator.storage.persist) {
    navigator.storage.persist().catch(() => {});
  }

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
});
