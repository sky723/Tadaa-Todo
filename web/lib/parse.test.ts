import test from 'node:test';
import assert from 'node:assert/strict';
import { parseQuick, nextDue } from './parse.ts';

const NOW = new Date('2026-10-17T10:00:00'); // a Saturday

test('parses the full kitchen-sink sentence', () => {
  const p = parseQuick('Call mom tomorrow 5pm !high #family every week remind me 15 min before', NOW);
  assert.deepEqual(p, {
    text: 'Call mom', priority: 3, due: '2026-10-18', time: '17:00', rec: 'weekly', tags: ['family'], remind: 15,
  });
});

test('weekday names resolve to the next occurrence, today included', () => {
  assert.equal(parseQuick('Gym monday', NOW).due, '2026-10-19');
  assert.equal(parseQuick('Brunch saturday', NOW).due, '2026-10-17');
});

test('"every <weekday>" is weekly and dated', () => {
  const p = parseQuick('Gym every monday', NOW);
  assert.equal(p.rec, 'weekly');
  assert.equal(p.due, '2026-10-19');
});

test('recurring with no date starts today', () => {
  assert.equal(parseQuick('Water plants every day', NOW).due, '2026-10-17');
});

test('12am / 12pm edge cases', () => {
  assert.equal(parseQuick('x 12am', NOW).time, '00:00');
  assert.equal(parseQuick('x 12pm', NOW).time, '12:00');
});

test('plain text is untouched', () => {
  const p = parseQuick('Buy eggs', NOW);
  assert.equal(p.text, 'Buy eggs');
  assert.equal(p.due, null);
});

test('nextDue handles month ends and weekdays', () => {
  assert.equal(nextDue('2026-01-31', 'monthly'), '2026-02-28');
  assert.equal(nextDue('2026-10-16', 'weekdays'), '2026-10-19'); // Fri -> Mon
  assert.equal(nextDue('2026-10-17', 'yearly'), '2027-10-17');
});
