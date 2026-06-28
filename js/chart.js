const Chart = (() => {
  function drawBars(canvas, labels, values, color, title) {
    const dpr = window.devicePixelRatio || 1;
    const W = canvas.offsetWidth || 320;
    const H = 200;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';

    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, W, H);

    const maxVal = Math.max(...values, 1);
    const n = labels.length;
    const padL = 12, padR = 12, padTop = 32, padBottom = 28;
    const chartW = W - padL - padR;
    const chartH = H - padTop - padBottom;
    const barW = chartW / n;
    const barPad = barW * 0.2;

    ctx.fillStyle = '#8899aa';
    ctx.font = `bold 12px -apple-system, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(title, W / 2, 16);

    labels.forEach((lbl, i) => {
      const x = padL + i * barW;
      const barHeight = (values[i] / maxVal) * chartH;
      const y = padTop + chartH - barHeight;

      ctx.fillStyle = values[i] > 0 ? color : '#1e1e30';
      ctx.beginPath();
      const bx = x + barPad;
      const bw = barW - barPad * 2;
      const r = 4;
      ctx.moveTo(bx + r, y);
      ctx.lineTo(bx + bw - r, y);
      ctx.quadraticCurveTo(bx + bw, y, bx + bw, y + r);
      ctx.lineTo(bx + bw, y + barHeight);
      ctx.lineTo(bx, y + barHeight);
      ctx.lineTo(bx, y + r);
      ctx.quadraticCurveTo(bx, y, bx + r, y);
      ctx.fill();

      if (values[i] > 0) {
        ctx.fillStyle = '#ccddee';
        ctx.font = `bold 11px -apple-system, sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText(values[i], x + barW / 2, y - 4);
      }

      ctx.fillStyle = '#6677aa';
      ctx.font = `10px -apple-system, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(lbl, x + barW / 2, H - 6);
    });
  }

  function render() {
    const daily = Storage.getLast7Days();
    const dates = Object.keys(daily).sort();
    const labels = dates.map(d => {
      const [, m, day] = d.split('-');
      return `${parseInt(m)}/${parseInt(day)}`;
    });
    const scores = dates.map(d => daily[d].reduce((s, r) => s + r.score, 0));
    const noReactions = dates.map(d => daily[d].filter(r => r.reaction === 'しなかった').length);

    const c1 = document.getElementById('chart-scores');
    const c2 = document.getElementById('chart-reactions');
    if (c1) drawBars(c1, labels, scores, '#4ecdc4', '日別合計点');
    if (c2) drawBars(c2, labels, noReactions, '#9b59b6', '反応しなかった回数');
  }

  return { render };
})();
