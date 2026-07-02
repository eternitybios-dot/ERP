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

  function getAll() {
    try {
      const list = JSON.parse(localStorage.getItem(KEY) || '[]');
      // 旧データ（type なし）は強迫記録として扱う
      return list.map(r => ({ type: 'compulsion', ...r }));
    } catch {
      return [];
    }
  }

  function setAll(list) {
    localStorage.setItem(KEY, JSON.stringify(list));
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

  return {
    getAll, setAll, save, getToday, getLast7Days,
    getPracticeDays, getStreakDays, getLatest, deleteById, clearAll,
    getCheckins, setCheckins, saveCheckin,
    getLastBackupAt, setLastBackupAt,
    localDateStr, localTimeStr,
  };
})();
