// ビュー切り替え
function showView(name) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  const view = document.getElementById('view-' + name);
  view.classList.add('active');
  view.querySelector('.view-body')?.scrollTo(0, 0);
  document.querySelector(`.nav-btn[data-view="${name}"]`).classList.add('active');

  if (name === 'home') renderHome();
  if (name === 'history') renderHistory();
  if (name === 'graph') Chart.render();
}

// ── ホーム ──────────────────────────────────────────
function renderHome() {
  const recs = Storage.getToday();
  const score = recs.reduce((s, r) => s + r.score, 0);
  const noReact = recs.filter(r => r.reaction === 'しなかった').length;
  const streak = Storage.getStreakDays();

  document.getElementById('today-score').textContent = score;
  document.getElementById('today-count').textContent = recs.length;
  document.getElementById('no-reaction-count').textContent = noReact;
  document.getElementById('streak-days').textContent = streak;

  const MSGS = [
    '今日も練習を積み重ねましょう。記録するだけで +1点 加算されます。',
    '不快感が残っていても、それは成功です。感覚を消すことが目的ではありません。',
    '強迫行為をしなかった瞬間が、少しずつ脳を変えていきます。',
    '完璧でなくて大丈夫です。記録できた分だけ、着実に前進しています。',
    '不快感があるまま生活に戻れました。それが最も価値のある行動です。',
  ];
  const idx = score === 0 ? 0 : (Math.floor(Date.now() / 300000) % (MSGS.length - 1)) + 1;
  document.getElementById('home-message').textContent = MSGS[idx];
}

// ── タイマー ─────────────────────────────────────────
let timerInterval = null;
let timerLeft = 0;

function startTimer(seconds) {
  stopTimer();
  timerLeft = seconds;
  updateTimerDisplay();
  const btn = document.getElementById('timer-btn');
  btn.textContent = '⏹ キャンセル';
  btn.onclick = stopTimer;
  timerInterval = setInterval(() => {
    timerLeft--;
    updateTimerDisplay();
    if (timerLeft <= 0) {
      stopTimer();
      const done = document.getElementById('timer-done');
      done.classList.add('show');
      setTimeout(() => done.classList.remove('show'), 4000);
    }
  }, 1000);
}

function stopTimer() {
  clearInterval(timerInterval);
  timerInterval = null;
  timerLeft = 0;
  document.getElementById('timer-display').textContent = '';
  const btn = document.getElementById('timer-btn');
  btn.textContent = '⏱ 3分タイマー開始';
  btn.onclick = () => startTimer(180);
}

function updateTimerDisplay() {
  const m = Math.floor(timerLeft / 60);
  const s = timerLeft % 60;
  document.getElementById('timer-display').textContent =
    `${m}:${s.toString().padStart(2, '0')}`;
}

// ── 記録フォーム ───────────────────────────────────────
function initForm() {
  ['discomfort', 'urge'].forEach(name => {
    const slider = document.getElementById(`${name}-slider`);
    const display = document.getElementById(`${name}-value`);
    slider.addEventListener('input', () => { display.textContent = slider.value; });
  });

  document.querySelectorAll('.chip-group.single .chip').forEach(chip => {
    chip.addEventListener('click', () => {
      chip.closest('.chip-group').querySelectorAll('.chip').forEach(c => c.classList.remove('selected'));
      chip.classList.add('selected');
    });
  });

  document.querySelectorAll('.chip-group.multi .chip').forEach(chip => {
    chip.addEventListener('click', () => chip.classList.toggle('selected'));
  });

  document.getElementById('record-form').addEventListener('submit', e => {
    e.preventDefault();
    submitRecord();
  });
}

function selectedChips(groupId) {
  return [...document.querySelectorAll(`#${groupId} .chip.selected`)].map(c => c.dataset.value);
}

function selectedSingleChip(groupId) {
  return document.querySelector(`#${groupId} .chip.selected`)?.dataset.value || null;
}

function submitRecord() {
  const record = {
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
    timestamp: new Date().toISOString(),
    discomfortLevel: parseInt(document.getElementById('discomfort-slider').value),
    urgeLevel: parseInt(document.getElementById('urge-slider').value),
    situation: selectedSingleChip('situation-chips') || 'その他',
    triggers: selectedChips('trigger-chips'),
    reaction: document.querySelector('input[name="reaction"]:checked')?.value || 'した',
    enduranceTime: selectedSingleChip('endurance-chips') || '0秒',
    bonuses: selectedChips('bonus-chips'),
    memo: document.getElementById('memo-input').value.trim().slice(0, 100),
    score: 0,
  };
  record.score = Scoring.calculate(record);
  Storage.save(record);
  showFeedback(record.score);
  resetForm();
}

function showFeedback(score) {
  const fb = document.getElementById('record-feedback');
  document.getElementById('feedback-score').textContent = `+${score}点`;
  fb.classList.add('show');
  setTimeout(() => {
    fb.classList.remove('show');
    showView('home');
  }, 2800);
}

function resetForm() {
  ['discomfort', 'urge'].forEach(name => {
    document.getElementById(`${name}-slider`).value = 50;
    document.getElementById(`${name}-value`).textContent = '50';
  });
  document.querySelectorAll('.chip.selected').forEach(c => c.classList.remove('selected'));
  const first = document.querySelector('input[name="reaction"]');
  if (first) first.checked = true;
  document.getElementById('memo-input').value = '';
}

// ── 履歴 ──────────────────────────────────────────
function renderHistory() {
  const all = Storage.getAll().slice().reverse();
  const container = document.getElementById('history-list');

  if (all.length === 0) {
    container.innerHTML = '<p class="empty-msg">まだ記録がありません。<br>記録するだけで +1点 加算されます。</p>';
    return;
  }

  const grouped = {};
  all.forEach(r => {
    const date = r.timestamp.split('T')[0];
    if (!grouped[date]) grouped[date] = [];
    grouped[date].push(r);
  });

  container.innerHTML = Object.entries(grouped)
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, recs]) => {
      const dayScore = recs.reduce((s, r) => s + r.score, 0);
      const [, m, d] = date.split('-');
      return `
        <div class="history-day">
          <div class="history-day-header">
            <span class="history-date">${parseInt(m)}月${parseInt(d)}日</span>
            <span class="history-day-score">${dayScore}点</span>
          </div>
          ${recs.map(r => `
            <div class="history-entry">
              <div class="entry-top">
                <span class="entry-time">${r.timestamp.split('T')[1].slice(0,5)}</span>
                <span class="entry-reaction${r.reaction === 'しなかった' ? ' good' : ''}">${r.reaction}</span>
                <span class="entry-score">+${r.score}点</span>
                <button class="delete-btn" onclick="deleteRecord('${r.id}')" aria-label="削除">
                  <svg viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
                </button>
              </div>
              <div class="entry-detail">
                不快度 ${r.discomfortLevel}
                ${r.enduranceTime ? '/ 我慢 ' + r.enduranceTime : ''}
                ${r.triggers.length ? '/ ' + r.triggers.slice(0, 2).join('・') : ''}
              </div>
              ${r.memo ? `<div class="entry-memo">${esc(r.memo)}</div>` : ''}
            </div>
          `).join('')}
        </div>`;
    }).join('');
}

function esc(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function deleteRecord(id) {
  if (!confirm('この記録を削除しますか？')) return;
  Storage.deleteById(id);
  renderHistory();
  renderHome();
}

// ── バックアップ・復元 ───────────────────────────────
function exportBackup() {
  const data = Storage.getAll();
  if (data.length === 0) {
    alert('まだ記録がありません。');
    return;
  }
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const date = new Date().toISOString().split('T')[0];
  a.href = url;
  a.download = `練習帳バックアップ_${date}.json`;
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
      if (!Array.isArray(imported) || !imported.every(r => r.id && r.timestamp)) {
        throw new Error('invalid');
      }
      const existing = Storage.getAll();
      const existingIds = new Set(existing.map(r => r.id));
      const newRecords = imported.filter(r => !existingIds.has(r.id));
      const merged = [...existing, ...newRecords]
        .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
      localStorage.setItem('ocd_records', JSON.stringify(merged));
      alert(`復元完了。${newRecords.length}件のデータを追加しました。`);
      renderHistory();
      renderHome();
    } catch {
      alert('ファイルの読み込みに失敗しました。\n正しいバックアップファイルを選んでください。');
    }
    input.value = '';
  };
  reader.readAsText(file);
}

// ── アプリ更新 ──────────────────────────────────────
function forceUpdate() {
  caches.keys()
    .then(keys => Promise.all(keys.map(k => caches.delete(k))))
    .then(() => navigator.serviceWorker?.getRegistrations() || Promise.resolve([]))
    .then(regs => Promise.all(regs.map(r => r.unregister())))
    .then(() => location.reload(true));
}

// ── 初期化 ─────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => showView(btn.dataset.view));
  });

  document.getElementById('home-record-btn').addEventListener('click', () => showView('record'));
  document.getElementById('timer-btn').onclick = () => startTimer(180);

  initForm();
  showView('home');

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
});
