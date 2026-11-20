import { test } from 'node:test';
import assert from 'node:assert/strict';

import { toIdentity } from './identity.js';

test('toIdentity conserva el país local si el RPC no lo devuelve', () => {
  const identity = toIdentity(
    { username: 'Mugiwara', token: 't1', avatar_key: 'avatar_01' },
    { country: 'VE', day_streak: 3 }
  );

  assert.equal(identity.country, 'VE');
  assert.equal(identity.day_streak, 3);
  assert.equal(identity.frame_key, 'inicial');
});

test('toIdentity acepta el país nuevo del RPC', () => {
  const identity = toIdentity({ username: 'Mugiwara', token: 't1', country: 'MX' }, { country: 'VE' });
  assert.equal(identity.country, 'MX');
});

test('toIdentity distingue país nulo de país ausente', () => {
  const cleared = toIdentity({ username: 'Mugiwara', token: 't1', country: null }, { country: 'VE' });
  assert.equal(cleared.country, null);
});
