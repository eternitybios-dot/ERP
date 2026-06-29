// ══ ビュー切り替え ═══════════════════════════════════
function showView(name) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  const view = document.getElementById('view-' + name);
  view.classList.add('active');
  view.querySelector('.view-body')?.scrollTo(0, 0);
  document.querySelector(`.nav-btn[data-view="${name}"]`)?.classList.add('active');

  if (name === 'home') renderHome();
  if (name === 'record') updateQuickFill();
  if (name === 'history') renderHistory();
  if (name === 'graph') Chart.render();
}

// ══ ホーム ═══════════════════════════════════════════
function renderHome() {
  const recs = Storage.getToday();
  const score = recs.reduce((s, r) => s + r.score, 0);
  const wins = recs.filter(r =>
    r.reaction === 'しなかった' || r.competing === 'できた' || r.competing === '少しできた'
  ).length;

  document.getElementById('today-score').textContent = score;
  document.getElementById('today-count').textContent = recs.length;
  document.getElementById('no-reaction-count').textContent = wins;
  document.getElementById('streak-days').textContent = Storage.getStreakDays();

  const MSGS = [
    'まずは1タップ。記録するだけで前進です。',
    '不快感が残っていても、それは成功です。消すことが目的ではありません。',
    '反応しなかった瞬間が、少しずつ脳の回路を変えていきます。',
    '衝動は波。消そうとせず、乗ったまま生活に戻りましょう。',
    '完璧でなくて大丈夫。積み重ねた分だけ、確実に前へ進んでいます。',
  ];
  const idx = score === 0 ? 0 : (Math.floor(Date.now() / 300000) % (MSGS.length - 1)) + 1;
  document.getElementById('home-message').textContent = MSGS[idx];
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
  } else { // backtolife
    record = { ...base, type: 'compulsion', discomfortLevel: null, urgeLevel: null,
      situation: 'その他', triggers: [], reaction: 'しなかった', enduranceTime: '0秒',
      bonuses: ['不快なまま生活に戻れた'] };
  }
  record.score = Scoring.calculate(record);
  Storage.save(record);
  showFeedback(record.score);
}

// ══ 記録フォーム（種類切り替え） ═════════════════════
let recordType = 'compulsion';

const CR_GUIDES = {
  '目をパチパチ': 'まぶたの力をふっと抜いて（ギュッとつぶる・見開くをやめる）、やわらかい視線で正面を見ます。まばたきしたくなったら、速くパチパチせず、ゆっくり1回だけ意識して閉じて開く。ムズムズが引くまで続けます。',
  '鼻息を強く吐く': '口を軽く閉じ、鼻から4秒かけて吸い、6秒かけて細く長く吐きます（腹式呼吸）。強く吐きたい衝動は、このゆっくりした呼吸と両立しません。',
  '肩・首を動かす': '両手を太ももやひざにそっと置き、肩を軽く下げて止めます。動かしたい衝動が引くまで、その姿勢を保ちます。',
  '喉を鳴らす': '口を閉じて、鼻からゆっくり呼吸します。または軽く息を止め、衝動の波が引くのを待ちます。',
  '顔をしかめる': '表情の力をふっと抜き、口角と眉をニュートラルに保ちます。',
  'その他': 'その動きと「同時にはできない」反対の動作を選び、ムズムズが引くまでやさしく保ちます。',
};

function setRecordType(type) {
  recordType = type;
  document.querySelectorAll('#type-toggle .seg').forEach(b =>
    b.classList.toggle('active', b.dataset.type === type));
  document.getElementById('form-compulsion').style.display = type === 'compulsion' ? 'block' : 'none';
  document.getElementById('form-tic').style.display = type === 'tic' ? 'block' : 'none';
  updateQuickFill();
}

function initForms() {
  // スライダー
  [['discomfort-slider', 'discomfort-value'], ['urge-slider', 'urge-value'],
   ['tic-urge-slider', 'tic-urge-value']].forEach(([s, v]) => {
    const slider = document.getElementById(s);
    slider.addEventListener('input', () => { document.getElementById(v).textContent = slider.value; });
  });

  // チップ（単一・複数）
  document.querySelectorAll('.chip-group.single .chip').forEach(chip => {
    chip.addEventListener('click', () => {
      chip.closest('.chip-group').querySelectorAll('.chip').forEach(c => c.classList.remove('selected'));
      chip.classList.add('selected');
      if (chip.closest('#movement-chips')) showCrGuide(chip.dataset.value);
    });
  });
  document.querySelectorAll('.chip-group.multi .chip').forEach(chip => {
    chip.addEventListener('click', () => chip.classList.toggle('selected'));
  });

  document.getElementById('form-compulsion').addEventListener('submit', e => {
    e.preventDefault(); submitCompulsion();
  });
  document.getElementById('form-tic').addEventListener('submit', e => {
    e.preventDefault(); submitTic();
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
    bonuses: selectedChips('bonus-chips'),
    memo: document.getElementById('memo-c').value.trim().slice(0, 100),
    score: 0,
  };
  rec.score = Scoring.calculate(rec);
  Storage.save(rec);
  showFeedback(rec.score);
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
  showFeedback(rec.score);
  resetForms();
}

function showFeedback(score) {
  const fb = document.getElementById('record-feedback');
  document.getElementById('feedback-score').textContent = `+${score}点`;
  fb.classList.add('show');
  if (navigator.vibrate) navigator.vibrate(30);
  setTimeout(() => { fb.classList.remove('show'); showView('home'); }, 2400);
}

function resetForms() {
  ['discomfort', 'urge', 'tic-urge'].forEach(n => {
    const s = document.getElementById(`${n}-slider`);
    const v = document.getElementById(`${n}-value`);
    if (s) { s.value = 5; v.textContent = '5'; }
  });
  document.querySelectorAll('.chip.selected').forEach(c => c.classList.remove('selected'));
  document.getElementById('cr-guide').style.display = 'none';
  document.getElementById('memo-c').value = '';
  document.getElementById('memo-t').value = '';
}

// ══ 前回の引き継ぎ ═══════════════════════════════════
function updateQuickFill() {
  const latest = Storage.getLatest(recordType);
  const section = document.getElementById('quick-fill-section');
  if (!latest) { section.style.display = 'none'; return; }
  const time = latest.timestamp.split('T')[1].slice(0, 5);
  let summary;
  if (recordType === 'tic') {
    summary = `前回 ${time}｜${latest.movement || 'クセ'}`;
  } else {
    const tags = [latest.situation, ...(latest.triggers || []).slice(0, 2)].filter(Boolean).join('・');
    summary = `前回 ${time}｜${tags}`;
  }
  document.getElementById('quick-fill-summary').textContent = summary;
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
  }
}

function setSlider(name, val) {
  if (val == null) return;
  const s = document.getElementById(`${name}-slider`);
  const v = document.getElementById(`${name}-value`);
  if (s) { s.value = val; v.textContent = val; }
}
function setSingle(groupId, val) {
  document.querySelectorAll(`#${groupId} .chip`).forEach(c =>
    c.classList.toggle('selected', c.dataset.value === val));
}
function setMulti(groupId, vals) {
  document.querySelectorAll(`#${groupId} .chip`).forEach(c =>
    c.classList.toggle('selected', vals.includes(c.dataset.value)));
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
  const all = Storage.getAll();
  const container = document.getElementById('history-list');
  if (all.length === 0) {
    container.innerHTML = '<p class="empty-msg">まだ記録がありません。<br>ホームのワンタップ記録から始めてみましょう。</p>';
    return;
  }

  const grouped = {};
  all.forEach(r => {
    const date = r.timestamp.split('T')[0];
    (grouped[date] ||= []).push(r);
  });

  container.innerHTML = Object.entries(grouped)
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, recs]) => {
      const dayScore = recs.reduce((s, r) => s + r.score, 0);
      const [, m, d] = date.split('-');
      const rows = recs.slice().reverse().map(r =>
        r.type === 'tic' ? ticEntry(r) : compulsionEntry(r)).join('');
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
    r.discomfortLevel != null ? `不快度 ${r.discomfortLevel}/10` : null,
    r.enduranceTime && r.enduranceTime !== '0秒' ? `波 ${r.enduranceTime}` : null,
    (r.triggers && r.triggers.length) ? r.triggers.slice(0, 2).join('・') : null,
  ].filter(Boolean).join('　/　');
  return `
    <div class="history-entry">
      <div class="entry-top">
        <span class="entry-time">${r.timestamp.split('T')[1].slice(0,5)}</span>
        <span class="tag tag-c">強迫</span>
        <span class="entry-reaction${good ? ' good' : ''}">${r.reaction || '記録'}</span>
        <span class="entry-score">+${r.score}</span>
        ${delBtn(r.id)}
      </div>
      ${detail ? `<div class="entry-detail">${detail}</div>` : ''}
      ${r.memo ? `<div class="entry-memo">${esc(r.memo)}</div>` : ''}
    </div>`;
}

function ticEntry(r) {
  const good = r.competing === 'できた' || r.competing === '少しできた';
  const detail = [
    r.urgeLevel != null ? `ムズムズ ${r.urgeLevel}/10` : null,
    r.awareness ? '気づけた' : null,
    r.urgePassed ? 'やり過ごせた' : null,
  ].filter(Boolean).join('　/　');
  return `
    <div class="history-entry tic">
      <div class="entry-top">
        <span class="entry-time">${r.timestamp.split('T')[1].slice(0,5)}</span>
        <span class="tag tag-t">クセ</span>
        <span class="entry-reaction${good ? ' good-lav' : ''}">${r.movement || 'クセ'}・${r.competing || ''}</span>
        <span class="entry-score lav">+${r.score}</span>
        ${delBtn(r.id)}
      </div>
      ${detail ? `<div class="entry-detail">${detail}</div>` : ''}
      ${r.memo ? `<div class="entry-memo">${esc(r.memo)}</div>` : ''}
    </div>`;
}

function delBtn(id) {
  return `<button class="delete-btn" onclick="deleteRecord('${id}')" aria-label="削除">
    <svg viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
  </button>`;
}

function esc(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function deleteRecord(id) {
  if (!confirm('この記録を削除しますか？')) return;
  Storage.deleteById(id);
  renderHistory();
}

// ══ バックアップ・復元 ═══════════════════════════════
function exportBackup() {
  const data = Storage.getAll();
  if (data.length === 0) { alert('まだ記録がありません。'); return; }
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `練習帳バックアップ_${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function importBackup(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const imported = JSON.parse(e.target.result);
      if (!Array.isArray(imported) || !imported.every(r => r.id && r.timestamp)) throw 0;
      const existing = Storage.getAll();
      const ids = new Set(existing.map(r => r.id));
      const added = imported.filter(r => !ids.has(r.id));
      const merged = [...existing, ...added].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
      Storage.setAll(merged);
      alert(`復元完了。${added.length}件のデータを追加しました。`);
      renderHistory();
    } catch {
      alert('ファイルの読み込みに失敗しました。\n正しいバックアップファイルを選んでください。');
    }
    input.value = '';
  };
  reader.readAsText(file);
}

// ══ アプリ更新 ═══════════════════════════════════════
function forceUpdate() {
  caches.keys()
    .then(keys => Promise.all(keys.map(k => caches.delete(k))))
    .then(() => navigator.serviceWorker?.getRegistrations() || Promise.resolve([]))
    .then(regs => Promise.all(regs.map(r => r.unregister())))
    .then(() => location.reload(true));
}

// ══ 初期化 ═══════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => showView(btn.dataset.view));
  });
  initForms();
  showView('home');
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
});
