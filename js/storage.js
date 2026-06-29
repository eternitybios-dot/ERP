const Storage = (() => {
  const KEY = 'ocd_records';

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
    const today = new Date().toISOString().split('T')[0];
    return getAll().filter(r => r.timestamp.startsWith(today));
  }

  function getLast7Days() {
    const all = getAll();
    const result = {};
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      result[dateStr] = all.filter(r => r.timestamp.startsWith(dateStr));
    }
    return result;
  }

  function getStreakDays() {
    const all = getAll();
    if (all.length === 0) return 0;
    const dates = new Set(all.map(r => r.timestamp.split('T')[0]));
    let streak = 0;
    const today = new Date();
    for (let i = 0; i < 365; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      if (dates.has(dateStr)) streak++;
      else break;
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

  return {
    getAll, save, setAll, getToday, getLast7Days,
    getStreakDays, getLatest, deleteById, clearAll,
  };
})();
