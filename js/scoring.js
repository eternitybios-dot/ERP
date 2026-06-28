const Scoring = (() => {
  const ENDURANCE_SCORES = {
    '放置成功': 15,
    '10分': 12,
    '3分': 8,
    '1分': 5,
    '10秒': 2,
    '0秒': 0,
  };

  const BONUS_SCORES = {
    '不快なまま生活に戻れた': 20,
    '確認・安心探しをしなかった': 20,
    '打ち消しイメージをしなかった': 15,
  };

  function calculate(record) {
    let score = 1;
    score += ENDURANCE_SCORES[record.enduranceTime] || 0;
    if (record.reaction === 'しなかった') score += 15;
    if (record.bonuses) {
      for (const bonus of record.bonuses) {
        score += BONUS_SCORES[bonus] || 0;
      }
    }
    return score;
  }

  return { calculate, ENDURANCE_SCORES, BONUS_SCORES };
})();
