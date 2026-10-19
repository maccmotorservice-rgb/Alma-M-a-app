import {test} from 'node:test';
import assert from 'node:assert/strict';
import {WELCOME_IDLE_MS, welcomeDay, welcomeEligibility, mergeWelcomeState, claimWelcome} from './welcome.js';

const at = value => Date.parse(value);
test('welcome daily boundary follows Guatemala rather than UTC or browser timezone', () => {
 assert.equal(welcomeDay(at('2026-10-20T05:59:59Z')), '2026-10-19');
 assert.equal(welcomeDay(at('2026-10-20T06:00:00Z')), '2026-10-20');
 const state = claimWelcome({}, at('2026-10-20T05:59:00Z'));
 assert.deepEqual(welcomeEligibility(state, at('2026-10-20T06:00:00Z')), {due: true, reason: 'day'});
});
test('first access is welcomed and ordinary reloads or reauthentication do not repeat it', () => {
 const now = at('2026-10-19T16:00:00Z');
 assert.deepEqual(welcomeEligibility({}, now), {due: true, reason: 'first'});
 const saved = claimWelcome({}, now);
 assert.deepEqual(welcomeEligibility(JSON.parse(JSON.stringify(saved)), now + 1000), {due: false, reason: null});
 assert.equal(welcomeEligibility(saved, now + WELCOME_IDLE_MS - 1).due, false);
 assert.equal(welcomeEligibility(saved, now + WELCOME_IDLE_MS).reason, 'idle');
 assert.equal(welcomeEligibility(claimWelcome(saved, now + WELCOME_IDLE_MS), now + WELCOME_IDLE_MS + 1000).due, false);
});
test('continuous activity postpones inactivity welcome; two idle hours permits one new welcome', () => {
 const now = at('2026-10-19T15:00:00Z');
 const saved = {...claimWelcome({}, now), lastActivityAt: now + 3 * 60 * 60 * 1000};
 assert.equal(welcomeEligibility(saved, now + 4 * 60 * 60 * 1000).due, false);
 assert.equal(welcomeEligibility(saved, saved.lastActivityAt + WELCOME_IDLE_MS).due, true);
 const claimed = claimWelcome(saved, saved.lastActivityAt + WELCOME_IDLE_MS);
 assert.equal(welcomeEligibility(claimed, claimed.lastWelcomeAt + 1000).due, false);
 assert.equal(claimed.lastActivityAt, claimed.lastWelcomeAt);
});
test('merging devices tabs preserves latest activity and latest welcome without mutating inputs', () => {
 const first = claimWelcome({}, at('2026-10-19T14:00:00Z'));
 const second = {...claimWelcome(first, at('2026-10-19T17:00:00Z')), lastActivityAt: at('2026-10-19T18:00:00Z')};
 const before = structuredClone(first);
 assert.deepEqual(mergeWelcomeState(first, second), second);
 assert.deepEqual(mergeWelcomeState(second, first), second);
 assert.deepEqual(first, before);
 assert.equal(welcomeEligibility(mergeWelcomeState(first, second), at('2026-10-19T19:00:00Z')).due, false);
});
test('corrupt timestamp values are ignored; a large backwards clock correction can recover', () => {
 assert.deepEqual(mergeWelcomeState({lastActivityAt: -10}, {lastWelcomeAt: 'oops', lastActivityAt: NaN}), {lastWelcomeAt: 0, lastWelcomeDay: '', lastActivityAt: 0});
 const now = at('2026-10-19T14:00:00Z');
 assert.equal(welcomeEligibility(claimWelcome({}, now + 60 * 60 * 1000), now).due, true);
});
