// 加点のみ。減点・失敗判定は一切しない（点数付けの強迫化を防ぐ設計）。
const Scoring = (() => {
  // ── 強迫（ERP：曝露反応妨害）系 ──────────────────
  const ENDURANCE_SCORES = {
    '放置成功': 15,
    '10分': 12,
    '3分': 8,
    '1分': 5,
    '10秒': 2,
    '0秒': 0,
  };

  const REACTION_SCORES = {
    'しなかった': 15,
    '少しした': 5,   // 遅らせた・途中でやめたのも前進として加点
    'した': 0,
  };

  const BONUS_SCORES = {
    '不快なまま生活に戻れた': 20,
    '確認・安心探しをしなかった': 20,
    '打ち消しイメージをしなかった': 15,
  };

  // ── クセ・チック（HRT：気づき＋拮抗反応）系 ──────
  const COMPETING_SCORES = {
    'できた': 15,      // 拮抗反応（別の動き）をやり切った
    '少しできた': 7,   // 一部でも置き換えられた
    '出てしまった': 0,
  };

  function calcCompulsion(record) {
    let score = 1; // 記録しただけで +1
    score += REACTION_SCORES[record.reaction] || 0;
    score += ENDURANCE_SCORES[record.enduranceTime] || 0;
    if (Array.isArray(record.bonuses)) {
      for (const b of record.bonuses) score += BONUS_SCORES[b] || 0;
    }
    return score;
  }

  function calcTic(record) {
    let score = 1; // 記録しただけで +1
    if (record.awareness) score += 5;             // 前駆衝動に「気づけた」だけで加点
    score += COMPETING_SCORES[record.competing] || 0;
    if (record.urgePassed) score += 10;           // 衝動の波をやり過ごせた
    return score;
  }

  function calculate(record) {
    return record.type === 'tic' ? calcTic(record) : calcCompulsion(record);
  }

  return {
    calculate,
    ENDURANCE_SCORES, REACTION_SCORES, BONUS_SCORES, COMPETING_SCORES,
  };
})();
