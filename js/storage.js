const Storage = (() => {
  const KEY = 'ocd_records';
  const CHECKIN_KEY = 'ocd_checkins';
  const BACKUP_AT_KEY = 'ocd_last_backup_at';

  // ── ローカル日付ヘルパー ──────────────────────────
  // 保存はISO(UTC)のまま。表示と日別集計はすべて端末のローカル時間で行う。
  function localDateStr(ts) {
    const d = ts instanceof Date ? ts : new Date(ts);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  function localTimeStr(ts) {
    const d = ts instanceof Date ? ts : new Date(ts);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }

  // 旧データの不快度・衝動は 0〜100 スケール。現行は 0〜10。
  // 10 を超える値だけを 0〜10 に換算する（新データを壊さず、再実行しても安全）。
  function migrateScale() {
    let list;
    try { list = JSON.parse(localStorage.getItem(KEY) || '[]'); }
    catch { return; }
    let changed = false;
    const fix = v => {
      if (typeof v === 'number' && v > 10) { changed = true; return Math.min(10, Math.round(v / 10)); }
      return v;
    };
    for (const r of list) {
      if ('discomfortLevel' in r) r.discomfortLevel = fix(r.discomfortLevel);
      if ('urgeLevel' in r) r.urgeLevel = fix(r.urgeLevel);
    }
    if (changed) localStorage.setItem(KEY, JSON.stringify(list));
  }
  migrateScale();

  // 全記録のメモ化キャッシュ（タブ切替のたびのJSONパースを避ける）
  let recordsCache = null;

  function getAll() {
    if (recordsCache) return recordsCache;
    try {
      const list = JSON.parse(localStorage.getItem(KEY) || '[]');
      // 旧データ（type なし）は強迫記録として扱う
      recordsCache = list.map(r => ({ type: 'compulsion', ...r }));
    } catch {
      recordsCache = [];
    }
    return recordsCache;
  }

  function setAll(list) {
    localStorage.setItem(KEY, JSON.stringify(list));
    recordsCache = null;
  }

  function save(record) {
    const records = getAll();
    records.push(record);
    setAll(records);
  }

  function getToday() {
    const today = localDateStr(new Date());
    return getAll().filter(r => localDateStr(r.timestamp) === today);
  }

  function getLast7Days() {
    const byDay = {};
    getAll().forEach(r => {
      const d = localDateStr(r.timestamp);
      (byDay[d] ||= []).push(r);
    });
    const result = {};
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const ds = localDateStr(d);
      result[ds] = byDay[ds] || [];
    }
    return result;
  }

  // 練習した日の合計（減らない数字）
  function getPracticeDays() {
    return new Set(getAll().map(r => localDateStr(r.timestamp))).size;
  }

  // やさしい連続：1日の空きはセーフ、2日連続で空いたら区切り。
  // 今日まだ記録していなくても連続は切らない（完璧主義・儀式化の防止）。
  function getStreakDays() {
    const dates = new Set(getAll().map(r => localDateStr(r.timestamp)));
    if (dates.size === 0) return 0;
    let streak = 0, gap = 0;
    for (let i = 0; i < 730; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      if (dates.has(localDateStr(d))) {
        streak++; gap = 0;
      } else {
        if (i === 0) continue; // 今日はまだこれから
        gap++;
        if (gap >= 2) break;
      }
    }
    return streak;
  }

  function getLatest(type) {
    const all = getAll();
    for (let i = all.length - 1; i >= 0; i--) {
      if (!type || all[i].type === type) return all[i];
    }
    return null;
  }

  function deleteById(id) {
    setAll(getAll().filter(r => r.id !== id));
  }

  function clearAll() {
    localStorage.removeItem(KEY);
    recordsCache = null;
  }

  // ── 月1セルフチェック ─────────────────────────────
  function getCheckins() {
    try { return JSON.parse(localStorage.getItem(CHECKIN_KEY) || '[]'); }
    catch { return []; }
  }

  function setCheckins(list) {
    localStorage.setItem(CHECKIN_KEY, JSON.stringify(list));
  }

  function saveCheckin(checkin) {
    const list = getCheckins();
    list.push(checkin);
    setCheckins(list);
  }

  // ── バックアップ日時 ──────────────────────────────
  function getLastBackupAt() {
    return localStorage.getItem(BACKUP_AT_KEY);
  }

  function setLastBackupAt(iso) {
    localStorage.setItem(BACKUP_AT_KEY, iso);
  }

  // ── 練習メニュー・今日の練習 ──────────────────────
  const MENU_KEY = 'ocd_practice_menu';
  const PRACTICE_TODAY_KEY = 'ocd_practice_today';

  function getPracticeMenu() {
    try { return JSON.parse(localStorage.getItem(MENU_KEY) || '[]'); }
    catch { return []; }
  }

  function setPracticeMenu(list) {
    localStorage.setItem(MENU_KEY, JSON.stringify(list));
  }

  // 今日の練習カードのUI状態（日付が変わると自動リセット。パスの履歴は残さない）
  function getPracticeToday() {
    try {
      const t = JSON.parse(localStorage.getItem(PRACTICE_TODAY_KEY));
      if (t && t.date === localDateStr(new Date())) return t;
    } catch { /* fallthrough */ }
    return { date: localDateStr(new Date()), status: 'pending', swaps: 0 };
  }

  function setPracticeToday(t) {
    localStorage.setItem(PRACTICE_TODAY_KEY, JSON.stringify(t));
  }

  // 直近の計画練習の難易度（新しい順）
  function getRecentPlannedDifficulties(n) {
    const out = [];
    const all = getAll();
    for (let i = all.length - 1; i >= 0 && out.length < n; i--) {
      if (all[i].planned && all[i].difficulty) out.push(all[i].difficulty);
    }
    return out;
  }

  // 発見（期待違反 or 学びのひとこと）を新しい順に
  function getDiscoveries(limit) {
    const list = getAll().filter(r =>
      (r.insight && String(r.insight).trim()) || r.expectancy === '予想より耐えられた'
    );
    list.reverse();
    return limit ? list.slice(0, limit) : list;
  }

  // ── バックアップ復元時の検証・正規化 ──────────────
  // 壊れた/改変されたJSONを読んでも、NaN合計や表示停止が起きないようにする
  const RECORD_TYPES = ['compulsion', 'tic', 'calm', 'contract'];
  const TIERS = ['やさしい', 'ふつう', 'チャレンジ'];

  function cleanStr(v, max) {
    return typeof v === 'string' ? v.slice(0, max) : '';
  }
  function cleanNum(v, min, max) {
    const n = Number(v);
    if (!Number.isFinite(n)) return null;
    return Math.min(max, Math.max(min, Math.round(n)));
  }
  function cleanStrArr(v, maxItems, maxLen) {
    if (!Array.isArray(v)) return [];
    return v.filter(x => typeof x === 'string').slice(0, maxItems).map(x => x.slice(0, maxLen));
  }

  function sanitizeRecords(list) {
    if (!Array.isArray(list)) return [];
    const out = [];
    for (const r of list.slice(0, 20000)) {
      if (!r || typeof r !== 'object') continue;
      if (typeof r.id !== 'string' || !r.id) continue;
      if (typeof r.timestamp !== 'string' || isNaN(new Date(r.timestamp).getTime())) continue;
      const rec = {
        id: r.id.slice(0, 60),
        timestamp: r.timestamp.slice(0, 40),
        type: RECORD_TYPES.includes(r.type) ? r.type : 'compulsion',
        memo: cleanStr(r.memo, 100),
      };
      if (r.planned) {
        rec.planned = true;
        rec.practiceName = cleanStr(r.practiceName, 60);
        rec.difficulty = TIERS.includes(r.difficulty) ? r.difficulty : 'ふつう';
        rec.predicted = cleanNum(r.predicted, 0, 10);
        rec.insight = cleanStr(r.insight, 30);
        rec.practiceSeconds = cleanNum(r.practiceSeconds, 0, 86400) ?? 0;
        rec.expectancy = cleanStr(r.expectancy, 20) || null;
      } else if (rec.type === 'compulsion') {
        rec.discomfortLevel = cleanNum(r.discomfortLevel, 0, 10);
        rec.urgeLevel = cleanNum(r.urgeLevel, 0, 10);
        rec.situation = cleanStr(r.situation, 20) || 'その他';
        rec.triggers = cleanStrArr(r.triggers, 10, 20);
        rec.reaction = cleanStr(r.reaction, 20) || null;
        rec.enduranceTime = cleanStr(r.enduranceTime, 10) || '0秒';
        rec.expectancy = cleanStr(r.expectancy, 20) || null;
        rec.bonuses = cleanStrArr(r.bonuses, 5, 30);
      } else if (rec.type === 'tic') {
        rec.movement = cleanStr(r.movement, 30) || 'その他';
        rec.urgeLevel = cleanNum(r.urgeLevel, 0, 10);
        rec.awareness = !!r.awareness;
        rec.competing = cleanStr(r.competing, 10) || '出てしまった';
        rec.urgePassed = !!r.urgePassed;
      } else if (rec.type === 'contract') {
        rec.outcome = r.outcome === 'stopped' ? 'stopped' : 'dropped';
      }
      // 点数：数値ならそのまま（過去ルールで付いた点を尊重）、壊れていれば再計算
      const score = Number(r.score);
      rec.score = (Number.isFinite(score) && score >= 0 && score <= 500)
        ? Math.round(score)
        : (typeof Scoring !== 'undefined' ? Scoring.calculate(rec) : 1);
      out.push(rec);
    }
    return out;
  }

  function sanitizeCheckins(list) {
    if (!Array.isArray(list)) return [];
    const out = [];
    for (const c of list.slice(0, 500)) {
      if (!c || typeof c.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(c.date)) continue;
      const answers = Array.isArray(c.answers)
        ? c.answers.slice(0, 10).map(a => cleanNum(a, 0, 4) ?? 0)
        : [];
      const t = Number(c.total);
      out.push({
        date: c.date,
        answers,
        total: Number.isFinite(t)
          ? Math.min(99, Math.max(0, Math.round(t)))
          : answers.reduce((s, v) => s + v, 0),
      });
    }
    return out;
  }

  function sanitizePracticeMenu(list) {
    if (!Array.isArray(list)) return [];
    const out = [];
    for (const m of list.slice(0, 200)) {
      if (!m || typeof m.id !== 'string' || typeof m.name !== 'string' || !m.name.trim()) continue;
      out.push({
        id: m.id.slice(0, 60),
        name: m.name.slice(0, 60),
        difficulty: TIERS.includes(m.difficulty) ? m.difficulty : 'ふつう',
        type: m.type === 'tic' ? 'tic' : 'compulsion',
      });
    }
    return out;
  }

  // ── 初回オンボーディング ──────────────────────────
  const ONBOARD_KEY = 'ocd_onboarded';

  function getOnboarded() {
    return localStorage.getItem(ONBOARD_KEY) === '1';
  }

  function setOnboarded() {
    localStorage.setItem(ONBOARD_KEY, '1');
  }

  const CONTRACT_INTRO_KEY = 'ocd_contract_intro';
  function getContractIntroSeen() {
    return localStorage.getItem(CONTRACT_INTRO_KEY) === '1';
  }
  function setContractIntroSeen() {
    localStorage.setItem(CONTRACT_INTRO_KEY, '1');
  }

  // ── リマインダー設定 ──────────────────────────────
  const REMINDER_KEY = 'ocd_reminder';
  const REMINDER_SHOWN_KEY = 'ocd_reminder_last_shown';

  function getReminder() {
    try {
      return JSON.parse(localStorage.getItem(REMINDER_KEY)) || { enabled: false, time: '20:00' };
    } catch {
      return { enabled: false, time: '20:00' };
    }
  }

  function setReminder(r) {
    localStorage.setItem(REMINDER_KEY, JSON.stringify(r));
  }

  function getReminderLastShown() {
    return localStorage.getItem(REMINDER_SHOWN_KEY);
  }

  function setReminderLastShown(dateStr) {
    localStorage.setItem(REMINDER_SHOWN_KEY, dateStr);
  }

  return {
    getAll, setAll, save, getToday, getLast7Days,
    getPracticeDays, getStreakDays, getLatest, deleteById, clearAll,
    getCheckins, setCheckins, saveCheckin,
    getPracticeMenu, setPracticeMenu, getPracticeToday, setPracticeToday,
    getRecentPlannedDifficulties, getDiscoveries,
    getLastBackupAt, setLastBackupAt,
    getReminder, setReminder, getReminderLastShown, setReminderLastShown,
    getOnboarded, setOnboarded, getContractIntroSeen, setContractIntroSeen,
    sanitizeRecords, sanitizeCheckins, sanitizePracticeMenu,
    localDateStr, localTimeStr,
  };
})();
