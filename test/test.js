// 純ロジックの単体テスト。実行: node test/test.js
const fs = require('fs');
const path = require('path');
const assert = require('assert');

// localStorage モック（storage.js のロード前に必要）
global.localStorage = {
  _s: {},
  getItem(k) { return Object.prototype.hasOwnProperty.call(this._s, k) ? this._s[k] : null; },
  setItem(k, v) { this._s[k] = String(v); },
  removeItem(k) { delete this._s[k]; },
  clear() { this._s = {}; },
};

function load(file, exportName) {
  const src = fs.readFileSync(path.join(__dirname, '..', 'js', file), 'utf8');
  return eval(`${src}\n${exportName}`);
}

const Scoring = load('scoring.js', 'Scoring');

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log(`  ✓ ${name}`); }
  catch (err) { failed++; console.error(`  ✗ ${name}\n    ${err.message}`); }
}

const isoDaysAgo = n => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
};

console.log('Scoring:');

test('強迫：反応しなかっただけ → 16点', () => {
  assert.equal(Scoring.calculate({
    type: 'compulsion', reaction: 'しなかった', enduranceTime: '0秒', bonuses: [],
  }), 16);
});

test('強迫：フル加点（しなかった+10分+生活+確認なし+期待違反） → 73点', () => {
  assert.equal(Scoring.calculate({
    type: 'compulsion', reaction: 'しなかった', enduranceTime: '10分',
    expectancy: '予想より耐えられた',
    bonuses: ['不快なまま生活に戻れた', '確認・安心探しをしなかった'],
  }), 1 + 15 + 12 + 5 + 20 + 20);
});

test('強迫：少しした → 6点（部分加点）', () => {
  assert.equal(Scoring.calculate({
    type: 'compulsion', reaction: '少しした', enduranceTime: '0秒', bonuses: [],
  }), 6);
});

test('強迫：「予想よりキツかった」は減点しない', () => {
  const withExp = Scoring.calculate({ type: 'compulsion', reaction: 'した', enduranceTime: '0秒', expectancy: '予想よりキツかった', bonuses: [] });
  const without = Scoring.calculate({ type: 'compulsion', reaction: 'した', enduranceTime: '0秒', bonuses: [] });
  assert.equal(withExp, without);
  assert.equal(without, 1);
});

test('チック：フル（気づき+置き換え+波） → 31点', () => {
  assert.equal(Scoring.calculate({
    type: 'tic', awareness: true, competing: 'できた', urgePassed: true,
  }), 31);
});

test('チック：出てしまったが気づけた → 6点', () => {
  assert.equal(Scoring.calculate({
    type: 'tic', awareness: true, competing: '出てしまった', urgePassed: false,
  }), 6);
});

test('穏やかな日 → 1点', () => {
  assert.equal(Scoring.calculate({ type: 'calm' }), 1);
});

test('breakdown の合計は常に calculate と一致する', () => {
  const cases = [
    { type: 'calm' },
    { type: 'compulsion', reaction: 'しなかった', enduranceTime: '3分', expectancy: '予想より耐えられた', bonuses: ['不快なまま生活に戻れた'] },
    { type: 'compulsion', reaction: '少しした', enduranceTime: '0秒', bonuses: [] },
    { type: 'compulsion', reaction: 'した', enduranceTime: '10秒', bonuses: [] },
    { type: 'tic', awareness: true, competing: '少しできた', urgePassed: true },
    { type: 'tic', awareness: false, competing: '出てしまった', urgePassed: false },
  ];
  for (const c of cases) {
    const sum = Scoring.breakdown(c).reduce((s, [, p]) => s + p, 0);
    assert.equal(sum, Scoring.calculate(c), `不一致: ${JSON.stringify(c)}`);
  }
});

console.log('Storage:');

test('migrateScale: 旧0〜100は換算、新0〜10は保持', () => {
  localStorage.clear();
  localStorage.setItem('ocd_records', JSON.stringify([
    { id: 'a', timestamp: isoDaysAgo(1), discomfortLevel: 85, urgeLevel: 100 },
    { id: 'b', timestamp: isoDaysAgo(0), discomfortLevel: 7, urgeLevel: 0 },
  ]));
  const S = load('storage.js', 'Storage');
  const [a, b] = S.getAll();
  assert.equal(a.discomfortLevel, 9);
  assert.equal(a.urgeLevel, 10);
  assert.equal(b.discomfortLevel, 7);
  assert.equal(b.urgeLevel, 0);
});

test('getAll: type なしの旧データは compulsion 扱い', () => {
  localStorage.clear();
  localStorage.setItem('ocd_records', JSON.stringify([{ id: 'x', timestamp: isoDaysAgo(0) }]));
  const S = load('storage.js', 'Storage');
  assert.equal(S.getAll()[0].type, 'compulsion');
});

test('localDateStr/localTimeStr はローカル時間で返す', () => {
  localStorage.clear();
  const S = load('storage.js', 'Storage');
  const d = new Date(2026, 6, 2, 8, 5); // ローカル 2026-07-02 08:05
  assert.equal(S.localDateStr(d), '2026-07-02');
  assert.equal(S.localTimeStr(d), '08:05');
  // ISO(UTC)で保存された値もローカルに戻る
  assert.equal(S.localDateStr(d.toISOString()), '2026-07-02');
  assert.equal(S.localTimeStr(d.toISOString()), '08:05');
});

test('getToday はローカルの「今日」で判定する', () => {
  localStorage.clear();
  const S = load('storage.js', 'Storage');
  S.save({ id: 't1', timestamp: new Date().toISOString(), type: 'calm', score: 1 });
  S.save({ id: 't2', timestamp: isoDaysAgo(1), type: 'calm', score: 1 });
  assert.equal(S.getToday().length, 1);
  assert.equal(S.getToday()[0].id, 't1');
});

test('やさしい連続: 1日空きはセーフ、2日空きで途切れる', () => {
  localStorage.clear();
  let S = load('storage.js', 'Storage');
  // 今日・一昨日（昨日が空き）→ 2
  S.save({ id: 's1', timestamp: isoDaysAgo(0), type: 'calm', score: 1 });
  S.save({ id: 's2', timestamp: isoDaysAgo(2), type: 'calm', score: 1 });
  assert.equal(S.getStreakDays(), 2);

  localStorage.clear();
  S = load('storage.js', 'Storage');
  // 今日・3日前（1〜2日前が2日連続空き）→ 1
  S.save({ id: 's3', timestamp: isoDaysAgo(0), type: 'calm', score: 1 });
  S.save({ id: 's4', timestamp: isoDaysAgo(3), type: 'calm', score: 1 });
  assert.equal(S.getStreakDays(), 1);
});

test('やさしい連続: 今日未記録でも昨日までの連続は切れない', () => {
  localStorage.clear();
  const S = load('storage.js', 'Storage');
  S.save({ id: 'y1', timestamp: isoDaysAgo(1), type: 'calm', score: 1 });
  S.save({ id: 'y2', timestamp: isoDaysAgo(2), type: 'calm', score: 1 });
  assert.equal(S.getStreakDays(), 2);
});

test('getPracticeDays はユニーク日数', () => {
  localStorage.clear();
  const S = load('storage.js', 'Storage');
  S.save({ id: 'p1', timestamp: isoDaysAgo(0), type: 'calm', score: 1 });
  S.save({ id: 'p2', timestamp: isoDaysAgo(0), type: 'calm', score: 1 });
  S.save({ id: 'p3', timestamp: isoDaysAgo(5), type: 'calm', score: 1 });
  assert.equal(S.getPracticeDays(), 2);
});

test('checkin の保存・取得', () => {
  localStorage.clear();
  const S = load('storage.js', 'Storage');
  S.saveCheckin({ date: '2026-07-02', answers: [1, 2, 0, 3], total: 6 });
  const list = S.getCheckins();
  assert.equal(list.length, 1);
  assert.equal(list[0].total, 6);
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
