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

  // 期待違反（予想より耐えられた）＝抑制学習の核心。発見に加点
  const EXPECTANCY_BONUS = 5;

  // 計画練習：「取り組んだこと」自体への加点。
  // タイマーの長さや途中で強迫行為が出たかどうかで増減させない（結果でなく行動に随伴させる）
  const PRACTICE_BONUS = 10;

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
    if (record.expectancy === '予想より耐えられた') score += EXPECTANCY_BONUS;
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

  // 数の契約（回数・数合わせの衝動）：数えない・完了させない。両方とも「勝ち」に加点。
  // 何回やったか・不安が下がったかは一切扱わない（測定の儀式化を防ぐ）。
  const CONTRACT_SCORES = {
    'dropped': 15, // 契約に乗らず、不完全なまま戻れた
    'stopped': 12, // 出てしまったが、やり直さずにそこで終了できた
  };

  function calcContract(record) {
    return 1 + (CONTRACT_SCORES[record.outcome] || 0);
  }

  function calculate(record) {
    if (record.type === 'calm') return 1;         // 穏やかな日の記録（欠測と区別するため）
    if (record.type === 'contract') return calcContract(record);
    if (record.planned) {
      let score = 1 + PRACTICE_BONUS;
      if (record.expectancy === '予想より耐えられた') score += EXPECTANCY_BONUS;
      return score;
    }
    return record.type === 'tic' ? calcTic(record) : calcCompulsion(record);
  }

  // 今日の練習の難易度提案ルール（決め打ち・テスト可能）:
  // 直近3回の計画練習がすべて「やさしい」で、メニューに「ふつう」があれば「ふつう」を提案
  function suggestTier(recentDifficulties, availableTiers) {
    if (
      recentDifficulties.length >= 3 &&
      recentDifficulties.slice(0, 3).every(d => d === 'やさしい') &&
      availableTiers.includes('ふつう')
    ) {
      return 'ふつう';
    }
    return null;
  }

  // 点数の内訳（なぜその点数か）を [ラベル, 点数] の配列で返す
  function breakdown(record) {
    if (record.type === 'calm') {
      return [['穏やかな一日を記録できた', 1]];
    }
    if (record.type === 'contract') {
      const items = [['記録できた', 1]];
      if (record.outcome === 'dropped') items.push(['数の契約に乗らず、戻れた', 15]);
      else if (record.outcome === 'stopped') items.push(['やり直さずに、そこで終了できた', 12]);
      return items;
    }
    if (record.planned) {
      const items = [['記録できた', 1], ['計画した練習に取り組めた', PRACTICE_BONUS]];
      if (record.expectancy === '予想より耐えられた') {
        items.push(['予想より耐えられた（発見！）', EXPECTANCY_BONUS]);
      }
      return items;
    }
    const items = [['記録できた', 1]];
    if (record.type === 'tic') {
      if (record.awareness) items.push(['ムズムズに気づけた', 5]);
      if (record.competing === 'できた') items.push(['別の動きに置き換えられた', 15]);
      else if (record.competing === '少しできた') items.push(['少し置き換えられた', 7]);
      if (record.urgePassed) items.push(['衝動の波をやり過ごせた', 10]);
    } else {
      if (record.reaction === 'しなかった') items.push(['強迫に反応しなかった', 15]);
      else if (record.reaction === '少しした') items.push(['少し・遅らせた', 5]);
      const e = ENDURANCE_SCORES[record.enduranceTime] || 0;
      if (e > 0) items.push([`波をやり過ごせた（${record.enduranceTime}）`, e]);
      if (record.expectancy === '予想より耐えられた') items.push(['予想より耐えられた（発見！）', EXPECTANCY_BONUS]);
      (record.bonuses || []).forEach(b => {
        if (BONUS_SCORES[b]) items.push([b, BONUS_SCORES[b]]);
      });
    }
    return items;
  }

  return {
    calculate, breakdown, suggestTier,
    ENDURANCE_SCORES, REACTION_SCORES, BONUS_SCORES, COMPETING_SCORES,
    EXPECTANCY_BONUS, PRACTICE_BONUS,
  };
})();
