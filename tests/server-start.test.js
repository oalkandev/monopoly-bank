import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:net';
import { startServer } from '../server.js';

test('startServer dolu portta EADDRINUSE ile reddeder', async () => {
  const blocker = createServer();
  await new Promise((resolve) => blocker.listen(0, '0.0.0.0', resolve));
  const { port } = blocker.address();
  await assert.rejects(startServer({ port }), { code: 'EADDRINUSE' });
  await new Promise((resolve) => blocker.close(resolve));
});
