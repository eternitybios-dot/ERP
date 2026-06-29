const Storage = (() => {
  const KEY = 'ocd_records';

  function getAll() {
    try {
      return JSON.parse(localStorage.getItem(KEY) || '[]');
    } catch {
      return [];
    }
  }

  function save(record) {
    const records = getAll();
    records.push(record);
    localStorage.setItem(KEY, JSON.stringify(records));
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
      if (dates.has(dateStr)) {
        streak++;
      } else {
        break;
      }
    }
    return streak;
  }

  function getLatest() {
    const all = getAll();
    return all.length > 0 ? all[all.length - 1] : null;
  }

  function deleteById(id) {
    const records = getAll().filter(r => r.id !== id);
    localStorage.setItem(KEY, JSON.stringify(records));
  }

  function clearAll() {
    localStorage.removeItem(KEY);
  }

  return { getAll, save, getToday, getLast7Days, getStreakDays, getLatest, deleteById, clearAll };
})();
