import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isTrustedHost } from '../../server/trusted-host.js';

test('hosts a player can legitimately type are trusted', () => {
  for (const host of ['localhost:3737', 'LOCALHOST', '127.0.0.1:3000', '192.168.1.42:3000', '[::1]:3737', 'mac.local:3737']) {
    assert.equal(isTrustedHost(host), true, host);
  }
});

test('a host name that could be rebound to this machine is not trusted', () => {
  for (const host of ['evil.example:3737', 'localhost.evil.example', '127.0.0.1.evil.example', '', undefined]) {
    assert.equal(isTrustedHost(host), false, String(host));
  }
});
