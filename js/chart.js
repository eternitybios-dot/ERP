const Chart = (() => {

  // 「ブレイブ行動」＝強迫に反応しなかった or クセを拮抗反応に置き換えられた
  function isWin(r) {
    return r.reaction === 'しなかった' || r.competing === 'できた' || r.competing === '少しできた';
  }

  // 記録がローカル時間で「何日前」か（0＝今日）
  function dayDiff(ts) {
    const a = new Date(ts); a.setHours(0, 0, 0, 0);
    const b = new Date();  b.setHours(0, 0, 0, 0);
    return Math.round((b - a) / 86400000);
  }

  // ── マイルストーン定義（目標勾配効果） ──────────────
  const TIERS = [
    { at: 0,    badge: '🌱', title: 'はじめよう' },
    { at: 1,    badge: '🌱', title: 'はじめの一歩' },
    { at: 10,   badge: '🌿', title: '芽が出た' },
    { at: 25,   badge: '🌷', title: '根づいてきた' },
    { at: 50,   badge: '🌲', title: '習慣の幹' },
    { at: 100,  badge: '🌳', title: '大きな木' },
    { at: 200,  badge: '🏞️', title: '林になった' },
    { at: 365,  badge: '⛰️', title: '一年分の森' },
    { at: 700,  badge: '🏔️', title: '揺るがない山' },
  ];

  function tierFor(n) {
    let cur = TIERS[0], next = null;
    for (let i = 0; i < TIERS.length; i++) {
      if (n >= TIERS[i].at) cur = TIERS[i];
      else { next = TIERS[i]; break; }
    }
    return { cur, next };
  }

  // ── 折れ線（累積エリア） ────────────────────────────
  function drawArea(canvas, series, color) {
    const dpr = window.devicePixelRatio || 1;
    const W = canvas.offsetWidth || 320;
    const H = 180;
    canvas.width = W * dpr; canvas.height = H * dpr;
    canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    const padL = 10, padR = 10, padTop = 28, padBottom = 26;
    const cw = W - padL - padR, ch = H - padTop - padBottom;
    const n = series.length;
    const maxV = Math.max(series[n - 1]?.value || 0, 1);

    ctx.fillStyle = '#98a2c4';
    ctx.font = 'bold 12px -apple-system, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('積み上がるブレイブ（累計）', padL, 16);

    const xy = series.map((p, i) => [
      padL + (n === 1 ? cw / 2 : (i / (n - 1)) * cw),
      padTop + ch - (p.value / maxV) * ch,
    ]);

    // 塗り
    const grad = ctx.createLinearGradient(0, padTop, 0, padTop + ch);
    grad.addColorStop(0, color + '55');
    grad.addColorStop(1, color + '08');
    ctx.beginPath();
    ctx.moveTo(xy[0][0], padTop + ch);
    xy.forEach(([x, y]) => ctx.lineTo(x, y));
    ctx.lineTo(xy[n - 1][0], padTop + ch);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    // 線
    ctx.beginPath();
    xy.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;
    ctx.lineJoin = 'round';
    ctx.stroke();

    // 末端ドット＋数値
    const [lx, ly] = xy[n - 1];
    ctx.beginPath();
    ctx.arc(lx, ly, 4.5, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.fillStyle = '#eaeefb';
    ctx.font = 'bold 13px -apple-system, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(series[n - 1].value, lx, Math.max(ly - 10, padTop + 4));

    // 端の日付
    ctx.fillStyle = '#6b769c';
    ctx.font = '10px -apple-system, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(series[0].label, padL, H - 6);
    ctx.textAlign = 'right';
    ctx.fillText(series[n - 1].label, W - padR, H - 6);
  }

  // ── 棒グラフ（直近7日の詳細） ───────────────────────
  function drawBars(canvas, labels, values, color, title) {
    const dpr = window.devicePixelRatio || 1;
    const W = canvas.offsetWidth || 320;
    const H = 180;
    canvas.width = W * dpr; canvas.height = H * dpr;
    canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    const maxVal = Math.max(...values, 1);
    const n = labels.length;
    const padL = 12, padR = 12, padTop = 30, padBottom = 26;
    const chartW = W - padL - padR, chartH = H - padTop - padBottom;
    const barW = chartW / n, barPad = barW * 0.22;

    ctx.fillStyle = '#98a2c4';
    ctx.font = 'bold 12px -apple-system, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(title, padL, 16);

    labels.forEach((lbl, i) => {
      const x = padL + i * barW;
      const bh = (values[i] / maxVal) * chartH;
      const y = padTop + chartH - bh;
      ctx.fillStyle = values[i] > 0 ? color : '#23263e';
      const bx = x + barPad, bw = barW - barPad * 2, r = 5;
      ctx.beginPath();
      ctx.moveTo(bx + r, y);
      ctx.lineTo(bx + bw - r, y);
      ctx.quadraticCurveTo(bx + bw, y, bx + bw, y + r);
      ctx.lineTo(bx + bw, y + Math.max(bh, r));
      ctx.lineTo(bx, y + Math.max(bh, r));
      ctx.lineTo(bx, y + r);
      ctx.quadraticCurveTo(bx, y, bx + r, y);
      ctx.fill();
      if (values[i] > 0) {
        ctx.fillStyle = '#cdd6f4';
        ctx.font = 'bold 11px -apple-system, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(values[i], x + barW / 2, y - 5);
      }
      ctx.fillStyle = '#6b769c';
      ctx.font = '10px -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(lbl, x + barW / 2, H - 6);
    });
  }

  // ── レンダリング ────────────────────────────────────
  function render() {
    const all = Storage.getAll();
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };

    // 累計ブレイブ（減らない数字＝進捗の原則）
    const totalWins = all.filter(isWin).length;
    set('total-wins', totalWins);

    // マイルストーン（目標勾配効果）
    const { cur, next } = tierFor(totalWins);
    set('ms-badge', cur.badge);
    set('ms-title', cur.title);
    const fill = document.getElementById('ms-fill');
    if (next) {
      const span = next.at - cur.at;
      const prog = Math.min(1, (totalWins - cur.at) / span);
      if (fill) fill.style.width = `${Math.round(prog * 100)}%`;
      set('ms-note', `次の節目「${next.title}」まで あと ${next.at - totalWins} 回`);
    } else {
      if (fill) fill.style.width = '100%';
      set('ms-note', 'すべての節目を達成。あなたの積み重ねは揺るぎません。');
    }

    // 日別集計（ローカル日付）
    const byDay = {};
    all.forEach(r => {
      const d = Storage.localDateStr(r.timestamp);
      (byDay[d] ||= { points: 0, wins: 0 });
      byDay[d].points += r.score;
      if (isWin(r)) byDay[d].wins++;
    });

    // 累積エリア（最初の記録日〜今日、最大21日窓）
    const today = new Date();
    let startDays = 14;
    if (all.length) {
      const oldest = all.reduce((m, r) => dayDiff(r.timestamp) > m ? dayDiff(r.timestamp) : m, 0);
      startDays = Math.min(21, Math.max(7, oldest + 1));
    }
    const series = [];
    // 窓の開始前までの累計を先に加算
    let cum = all.filter(r => isWin(r) && dayDiff(r.timestamp) > startDays - 1).length;
    for (let i = startDays - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const ds = Storage.localDateStr(d);
      cum += byDay[ds]?.wins || 0;
      series.push({ label: `${d.getMonth() + 1}/${d.getDate()}`, value: cum });
    }
    const cumCanvas = document.getElementById('chart-cumulative');
    if (cumCanvas) drawArea(cumCanvas, series, '#5eead4');

    // 今週 vs 先週（やさしい比較）
    const winsInRange = (startOffset, endOffset) =>
      all.filter(r => {
        if (!isWin(r)) return false;
        const diff = dayDiff(r.timestamp);
        return diff >= startOffset && diff < endOffset;
      }).length;
    const thisWeek = winsInRange(0, 7);
    const lastWeek = winsInRange(7, 14);
    set('this-week', thisWeek);
    set('last-week', lastWeek);
    const arrow = document.getElementById('week-arrow');
    let msg;
    if (thisWeek > lastWeek) {
      if (arrow) { arrow.textContent = '↗'; arrow.className = 'week-arrow up'; }
      msg = `🎉 先週を ${thisWeek - lastWeek} 回 上回っています。その調子！`;
    } else if (thisWeek === lastWeek && thisWeek > 0) {
      if (arrow) { arrow.textContent = '→'; arrow.className = 'week-arrow flat'; }
      msg = '先週と同じペースを保てています。継続は確かな力です。';
    } else if (thisWeek === 0 && lastWeek === 0) {
      if (arrow) { arrow.textContent = '·'; arrow.className = 'week-arrow flat'; }
      msg = '今週の最初の1回を、気軽にどうぞ。';
    } else {
      if (arrow) { arrow.textContent = '〜'; arrow.className = 'week-arrow wave'; }
      msg = '波があって当然です。続けていること自体が、回復を支えています。';
    }
    set('week-msg', msg);

    // 小カード
    set('practice-days', Object.keys(byDay).length);
    set('cur-streak', Storage.getStreakDays());
    const best = Object.values(byDay).reduce((m, d) => Math.max(m, d.points), 0);
    set('best-day', best);

    // 直近7日の詳細棒グラフ
    const last7 = Storage.getLast7Days();
    const dates = Object.keys(last7).sort();
    const labels = dates.map(d => { const [, m, day] = d.split('-'); return `${parseInt(m)}/${parseInt(day)}`; });
    const points = dates.map(d => last7[d].reduce((s, r) => s + r.score, 0));
    const wins = dates.map(d => last7[d].filter(isWin).length);
    const c1 = document.getElementById('chart-scores');
    const c2 = document.getElementById('chart-reactions');
    if (c1) drawBars(c1, labels, points, '#5eead4', '日別の練習点');
    if (c2) drawBars(c2, labels, wins, '#b794f6', '反応しなかった・置き換えた回数');
  }

  return { render };
})();
