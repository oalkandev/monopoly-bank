// Child process entry for the integration tests. A separate process gives every test its own
// copy of the state.js singleton, and lets the tests kill it to simulate a crash.
import { startServer } from '../../../server.js';

const { port } = await startServer({
  port: Number(process.env.PORT ?? 0),
  publicDir: process.env.MONOPOLY_TEST_PUBLIC_DIR,
  dataFile: process.env.MONOPOLY_TEST_DATA_FILE,
});
console.log(`LISTENING ${port}`);
