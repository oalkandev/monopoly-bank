# Test Pyramid Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give Monopoly Bank a test suite that catches the bugs this app actually has, and that a reviewer can trust: every test states a rule, fails when that rule breaks, and runs fast enough to gate every pull request.

**Architecture:** Five layers on two runners. `node:test` covers static checks, game rules and a real server driven by real Socket.IO clients. Vitest covers the few client behaviours that are timing or state logic. Playwright covers multi-device journeys and a small desktop smoke test. Mutation testing, not line coverage, measures whether the server tests can fail.

**Tech Stack:** `node:test`, `fast-check@4`, `vitest@3` (the last major supporting the project's Vite 5), `@testing-library/react@16`, `jsdom`, `@playwright/test`, `jsqr`, `@stryker-mutator/core`, `eslint` with `eslint-plugin-react-hooks`.

**Spec:** No separate spec. The requirement is the maintainer's request for a realistic pyramid with real quality tests, and the [measured defects](#measured-defects) below are the evidence.

**Status (2026-11-02):** Tasks 1 to 6, 8 and 10 are done. Tasks 7 and 9 are deferred. In Task 6, nine surviving mutants have not been examined and the full mutation run has not finished yet. The `test:client` and `test:desktop` scripts were removed until Tasks 7 and 9 run, and the test rules live in `CONTRIBUTING.md` until `docs/testing.md` exists.

## The pyramid

| Layer | Tool | Tests | Budget | Runs | Answers |
|---|---|---|---|---|---|
| Manual | checklist | 8 items | 20 min | before a release | Does it work on real phones and a real projector? |
| Desktop smoke | Playwright `_electron` | 4 | 2 min | release, manual trigger | Does the app open, keep its port, survive a busy port? |
| E2E | Playwright | 12 | 3 min | every PR | Do the banker and phones agree through a whole game? |
| Client behaviour | Vitest | ~20 | 10 s | every PR | Are the timers and notification rules right? |
| Server integration | `node:test`, real server, real sockets | ~55, 22 of them one permissions table | 15 s | every PR | Are identity, permissions, broadcast and saving right? |
| Game rules | `node:test`, `fast-check` | ~35 | 2 s | every PR | Can any sequence of actions corrupt the money? |
| Static | ESLint, locale checks | 4 + lint | 5 s | every PR | Are hooks legal and translations complete? |

Mutation testing runs across the server code weekly and on demand.

**Why the integration layer is thick.** The usual pyramid would put most tests in unit tests. Here `game-logic.js` is small and already the best-tested file, while 9 of the 13 defects below sit where modules meet: sockets, persistence and startup. Test counts are ceilings, not goals. Stop when the rules are covered.

**Rough order of size (unmeasured estimate):** Tasks 1, 2, 5, 6 and 9 about half a day each; Tasks 3, 4, 7 and 8 about a day each.

## Measured defects

Measured on 2026-11-02 against commit `ebdf283` with a throwaway script, except where noted. Each fix follows its failing test.

| ID | Measured behaviour | Target behaviour | Task |
|---|---|---|---|
| D1 | After one failed save, every later save rejects until restart, even to a good path | A failed write does not block later writes | 4 |
| D2 | When a save fails, memory advances, no broadcast goes out, and the client is told it failed | The action stands, clients get it, the ack is `ok`, the error is logged. Reporting failure invites a retry that pays twice | 4 |
| D3 | Transfer A→B 200, B spends 1700, undo the first: `A:1500 B:-200 C:3200` | **Decided by the maintainer:** refuse with `errors.undoWouldOverdraw`; the banker corrects the balance by hand instead | 2 |
| D4 | `amount: 0.1` is accepted: balances become `1499.7`, `1500.3` | **Decided by the maintainer:** whole numbers only (`Number.isSafeInteger`), otherwise `errors.invalidAmount` | 2 |
| D5 | `start-game` accepts `startingBalance: 'abc'` and `passGoBonus: -5`: balances become `"abc"` | Same validation as `update-config`, tightened to whole-number balances and bonuses; invalid values ignored; a failed start leaves config unchanged | 5 |
| D6 | Payload-less events return raw text such as `Cannot read properties of null (reading 'fromId')` | Anything not `errors.*` becomes `errors.unknownError`, and the original is logged | 3 |
| D7 | Two connections for one player, close one: `online` becomes `false` | Offline only when the last connection closes | 5 |
| D8 | `online: true` is written to disk (stale state after restart is inferred, not run) | All players load as offline | 4 |
| D9 | A corrupt save file makes `startServer` reject (no desktop window is inferred, not run) | Move the file to `<name>.corrupt-<timestamp>`, start empty, log it. Never delete it | 4 |
| D10 | A socket with no credentials can `banker-adjust`, `undo`, `update-config`, `reset` | Banker events require the banker role: `errors.unauthorized` | 3 |
| D11 | `add-player` with no color is accepted | Falls back to `#475569`, the color the UI already uses for an unknown player | 2 |
| D12 | `App` in `player.jsx` calls hooks after an early return (code reading) | Split the component so hook order cannot change | 1 |
| D13 | Socket.IO accepts WebSocket connections from any website's origin, and the desktop port is now predictable (security review, not run) | Refuse when the `Origin` host differs from the `Host` header; allow no `Origin` for non-browser clients | 3 |

**Out of scope, on purpose:**
- Security hardening such as a login, a banker secret or redacted broadcasts. The maintainer's decision: this is a home app on a local network and security is not a requirement.
- "Send to Everyone" is a client-side loop of transfers, so a failure midway leaves it partly applied (code reading). The fix is an atomic server event. Do not write a test that pins today's behaviour.

## Global Constraints

**Test quality rules. A test that breaks one of these does not merge.**

1. The test name states a rule a person could say out loud: `a refused action changes nothing`. Never `works correctly`, `renders`, `should handle edge cases`.
2. Prove it can fail. Every new test is seen red first, against the unfixed bug or against one deliberately broken line that is then restored. The commit message names which line.
3. No mocks of this project's modules in `tests/unit` or `tests/integration`: real server, real sockets, real temp files. Client tests fake only timers and the socket boundary.
4. No snapshot tests. No assertions on CSS classes, on a mock having been called as the main check, on constants, on framework behaviour or on translation wording (except where the rule is about language).
5. No sleeps. No `waitForTimeout`, no `setTimeout` to wait for a result. Wait on an event, a web-first assertion, or fake timers. To assert that something did not happen, send a later known-good action and check it arrives first.
6. No randomness in assertions. Do not test the dice distribution; statistical tests are flaky and prove nothing about this code. Property tests use `fast-check`, which reports the seed.
7. Line coverage is never a target and never gates a merge. Mutation score does.
8. Each test owns its state: its own temp directory and port `0`. No test order dependence.
9. `retries: 0` everywhere. A flaky test is fixed or deleted, never retried.
10. Delete any test whose failure would not tell you what broke for a user.

**Safety and project rules.**

- No test may touch `~/Library/Application Support/monopoly-bank` or the repo-root `game-state.json`. All data goes in `mkdtemp`.
- App behaviour changes only as listed in the defects table. No refactors beyond the extractions named in a task.
- A new error key is added to all 7 locale files: `tr`, `en`, `es`, `de`, `fr`, `it`, `pt-BR`.
- Test names and test comments are in English. App code comments keep the file's existing language.
- Commit messages are English conventional commits. Never add `Co-Authored-By: Claude ...`, `Claude-Session: ...` or "Generated with Claude Code".
- Test tooling needs Node 22 or newer. CI runs Node 22 and 24. Set `ELECTRON_SKIP_BINARY_DOWNLOAD=1` in every CI job except the desktop job.

## Review Focus

Failure modes that matter to someone playing and that no rule above forces. Each has its test in the owning task.

1. A phone locks or drops Wi-Fi mid-game, misses a payment, then returns: it must show the current balance (Task 8).
2. A double tap, or two people acting at once, spends the same money twice: exactly one succeeds and no balance goes negative (Task 4).
3. A save file from an older version lacks `diceRolls`, `quickAmounts` or `startedAt`: the game loads and keeps working (Task 4).
4. A 24-character name on a phone breaks the layout: no horizontal page scrolling (Task 8).
5. The banker resets the game while a phone is open, and the player later reopens the old link: a clear screen, not a crash or a wrong player (Task 8).

---

### Task 1: Test layout, static checks and CI

**Files:**
- Move and modify: `tests/game-logic.test.js` to `tests/unit/game-logic.test.js`, translating the 24 test names to English without changing assertions
- Move: `tests/server-start.test.js` to `tests/integration/server-start.test.js`
- Create: `tests/static/locales.test.js`, `eslint.config.js`, `.github/workflows/ci.yml`
- Modify: `package.json`, `client/src/player.jsx:31-71`, `README.md` (the Development section)

**Interfaces:**
- Produces npm scripts, used by every later task:
  - `test` = `node --test tests/static/*.test.js tests/unit/*.test.js tests/integration/*.test.js`
  - `test:client` = `vitest run`
  - `test:e2e` = `npm run build && playwright test`
  - `test:desktop` = `playwright test --config tests/electron/playwright.config.js`
  - `test:mutation` = `stryker run`
  - `lint` = `eslint client/src server electron`

- [ ] **Step 1: Write `tests/static/locales.test.js`**

Four tests, reading `client/src/locales/*.json` and source files as text:
```js
test('every locale has exactly the same keys as en')
test('every {{placeholder}} in en appears in the same key of every locale')
test('every errors.* key thrown by the server exists in en')
test('every literal t("...") key used in client/src exists in en') // accept key_one / key_other plural forms
```

- [ ] **Step 2: Run them**

Run: `node --test tests/static/locales.test.js`
Expected: key parity and server errors pass today. Any other failure is a real translation gap: fix the locale file. To prove red, delete one key from `de.json`, see the failure naming it, restore.

- [ ] **Step 3: Add `eslint.config.js`**

Flat config over `client/src` with only two rules: `react-hooks/rules-of-hooks: error` and `react-hooks/exhaustive-deps: warn`. No style rules.

Run: `npx eslint client/src`
Expected: FAIL at `client/src/player.jsx`, hooks after the early return (D12).

- [ ] **Step 4: Fix D12**

`App` reads the token once and returns `<NoToken />` or `<PlayerApp token={token} />`. `PlayerApp` holds everything that was below the early return.

Run: `npm run lint`
Expected: no errors. Warnings from `exhaustive-deps` are listed in the PR, not bulk-suppressed.

- [ ] **Step 5: Add the scripts and `.github/workflows/ci.yml`**

Trigger on `pull_request` and pushes to `master`. Job `checks`, Ubuntu, Node 22 and 24: `npm ci`, `npm run lint`, `npm test`, `npm run build`.

Run: `npm test`
Expected: all pass, 25 existing plus 4 static.

- [ ] **Step 6: Commit**

```bash
git add tests eslint.config.js .github package.json package-lock.json client/src/player.jsx README.md
git commit -m "test: organize test layers, add locale checks, lint hooks and CI"
```

### Task 2: Game rules that hold for any sequence of actions

**Files:**
- Create: `tests/unit/game-rules.properties.test.js`
- Modify: `tests/unit/game-logic.test.js`, `server/game-logic.js`, `server/state.js:66-70`, all 7 locale files

**Interfaces:**
- Produces: `errors.undoWouldOverdraw`. `applyTransfer`, `applyBankerAdjust` and `payToBank` reject non-safe-integer amounts with `errors.invalidAmount`.

- [ ] **Step 1: Write the property tests**

A generator builds a started game of 2 to 6 players, then a list of 1 to 60 commands: transfer, pass-go, adjust, undo, rename. Amounts include `0`, `-1`, `0.5`, `NaN`, `1e21`, and ids include unknown ones. A runner applies each command, catching only errors whose message starts with `errors.`; anything else fails the test. Use `numRuns: 300`.

```js
test('balances always equal a replay of the non-undone transactions')
test('no sequence of actions makes a balance negative')
test('transfers never change the total money in the game')
test('a refused action changes nothing')          // deepEqual before and after
test('no game function mutates the state it receives') // deep-freeze the input
test('undoing the latest transaction restores every balance')
test('no sequence of adds and renames produces two names equal ignoring case')
```

- [ ] **Step 2: Write the example tests for D3, D4 and D11**

```js
test('undo is refused when the recipient has already spent the money', () => {
  // A→B 200, B→C 1700, then undo the first
  assert.throws(() => undoTransaction(s, { transactionId }), /errors\.undoWouldOverdraw/);
});
test('amounts must be whole numbers', () => {
  for (const amount of [0.1, 1.5, 1e21]) { /* transfer and adjust throw errors.invalidAmount */ }
});
test('a player added without a color gets the fallback color', () => {
  assert.equal(addPlayer(s, { name: 'A' }).players[0].color, '#475569');
});
```

- [ ] **Step 3: Run to verify they fail**

Run: `node --test tests/unit/*.test.js`
Expected: FAIL on the negative-balance property with a shrunk counterexample, and on the three examples.

- [ ] **Step 4: Implement in `server/game-logic.js`**

Add `assertValidAmount(amount)` and use it in `applyTransfer`, `applyBankerAdjust` (where negative amounts stay legal) and `payToBank`. In `undoTransaction`, compute the balance change for every affected player and throw `errors.undoWouldOverdraw` before applying any. Default the color in `addPlayer`. Add the key to all 7 locales.

- [ ] **Step 5: Run to verify they pass**

Run: `npm test`
Expected: PASS, including the locale checks for the new key.

- [ ] **Step 6: Commit**

```bash
git add tests server client/src/locales
git commit -m "fix(game): keep balances consistent under any action sequence"
```

### Task 3: Server harness, identity and permissions

**Files:**
- Create: `tests/integration/helpers/harness.js`, `tests/integration/helpers/server-entry.mjs`, `tests/integration/identity.test.js`, `tests/integration/authorization.test.js`
- Modify: `server/socket-handlers.js`, `server.js`, `README.md` (Security section)

**Interfaces:**
- Produces, used by Tasks 4 and 5:
  ```js
  startApp({ dataFile } = {}) → Promise<App>
  // Spawns server-entry.mjs as a child process on port 0 with a temp data file and a temp public dir holding stub HTML.
  // App: { url, port, dataFile, dir, banker(), player(token), anon(), connect(options),
  //        state(), startGame(names), restart(), kill(signal), stop() }
  // Each client: { socket, call(event, payload) → Promise<ack>, nextState() → Promise<state>,
  //                nextDice() → Promise<roll>, close() }
  ```
  A child process gives each test real isolation from the `state.js` singleton and lets `kill('SIGKILL')` simulate a crash.

- [ ] **Step 1: Write `identity.test.js`**

```js
test("a player's transfer leaves their own account even if the payload names another fromId")
test('rename changes the connected player even if the payload names another playerId')
test('the banker cannot roll dice')
test('a socket with an unknown token cannot roll dice')
test('a connection from another website is refused') // extraHeaders: { Origin: 'https://evil.example' } → connect_error
test('a connection from the app’s own address is accepted') // Origin: `http://localhost:${port}`
```

- [ ] **Step 2: Write `authorization.test.js`, table-driven**

For each of `add-player`, `remove-player`, `start-game`, `update-config`, `banker-adjust`, `undo`, `reset`, and for each of `anonymous` and `player`:
```js
test(`${role} cannot ${event}`, async () => {
  assert.deepEqual(await client.call(event, payload), { ok: false, error: 'errors.unauthorized' });
  assert.deepEqual(withoutOnline(await app.state()), withoutOnline(before));
});
test(`the banker can ${event}`) // the positive case, so a broken handler cannot pass as "refused"
test('events sent without a payload answer with a translatable error key') // every ack.error matches /^errors\./
test.todo('a client cannot become banker by claiming role=banker');
test.todo('the state broadcast does not expose other players’ tokens');
```

- [ ] **Step 3: Run to verify they fail**

Run: `node --test tests/integration/identity.test.js tests/integration/authorization.test.js`
Expected: FAIL for D6, D10 and D13. The existing identity tests pass; prove each can fail by temporarily using `p.fromId` in the handler, then restore.

- [ ] **Step 4: Implement**

In `server/socket-handlers.js`: add `requireBanker(role)` to the seven handlers, and have `wrap` send `errors.unknownError` for messages not starting with `errors.`, logging the original. In `server.js`: pass `allowRequest` to `new Server`, refusing when the `Origin` host differs from the `Host` header and allowing a missing `Origin`. Confirm the banker page still works over a LAN address, not only `localhost`. Update the README's Security section: banker events now need the banker role, but that role is still self-declared, so the app remains for trusted networks only.

- [ ] **Step 5: Run to verify they pass**

Run: `npm test`
Expected: PASS, with the two `todo` entries reported.

- [ ] **Step 6: Commit**

```bash
git add tests server server.js README.md
git commit -m "fix(server): require the banker role, refuse foreign origins, hide internal errors"
```

### Task 4: Saving, restarting and concurrent actions

**Files:**
- Create: `tests/unit/persistence.test.js`, `tests/integration/persistence.test.js`, `tests/integration/concurrency.test.js`, `tests/fixtures/legacy-game-state.json`
- Modify: `server/persistence.js`, `server/state.js`

**Interfaces:**
- Consumes: `startApp` from Task 3.
- Produces: `persistence.load()` returns `null` and moves the file aside when it cannot be parsed. `state.commit` never rejects because of a write failure.

- [ ] **Step 1: Write the tests**

```js
// tests/unit/persistence.test.js
test('a failed write does not block later writes') // bad path first, then good path; the file exists with the second state

// tests/integration/persistence.test.js
test('a game survives a restart unchanged')
test("a player's old link still works after a restart")
test('all players are offline after a restart until they reconnect')
test('a crash during heavy writing never leaves an unreadable save file') // 200 quick actions, kill('SIGKILL'), JSON.parse succeeds, three rounds
test('a corrupt save file is kept aside and the server starts empty') // the .corrupt-* file has the original bytes
test('an action still succeeds and reaches clients when the disk write fails') // chmod the data dir 0500; skip if running as root
test('after a disk failure clears, the next action saves the full game')
test('a save file from an older version loads and the game continues') // fixture without diceRolls, quickAmounts, startedAt

// tests/integration/concurrency.test.js
test('20 simultaneous transfers are all applied, in memory and on disk')
test('a double tap spending the same money succeeds exactly once') // balance 1500, two concurrent transfers of 1000: one ok, one errors.insufficientBalance, final 500
```

- [ ] **Step 2: Run to verify they fail**

Run: `node --test tests/unit/persistence.test.js tests/integration/persistence.test.js tests/integration/concurrency.test.js`
Expected: FAIL for D1, D2, D8 and D9. The restart and concurrency tests may already pass; prove each can fail by breaking one line.

- [ ] **Step 3: Implement**

In `persistence.js`, keep the write queue alive by chaining on a caught copy while returning the real promise to the caller. In `load`, on a parse error rename the file to `<name>.corrupt-<timestamp>`, log it and return `null`. In `state.js`, keep `state = next` synchronous before any `await`: moving it after the save loses concurrent updates, which the 20-transfer test guards. Notify listeners, then await the save and log a failure instead of rethrowing. In `init`, set every loaded player's `online` to `false`.

- [ ] **Step 4: Run to verify they pass**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add tests server
git commit -m "fix(server): survive save failures, corrupt files and restarts"
```

### Task 5: Broadcast, presence, routes and configuration

**Files:**
- Create: `tests/integration/broadcast.test.js`, `tests/integration/presence.test.js`, `tests/integration/routes.test.js`, `tests/integration/config.test.js`
- Modify: `server/socket-handlers.js`, `server/state.js:44-64`, `server/game-logic.js`

**Interfaces:**
- Consumes: `startApp` from Task 3.
- Produces: `sanitizeConfig(patch) → allowed` in `server/game-logic.js`, used by both `updateConfig` and `startGame`.

- [ ] **Step 1: Write the tests**

```js
// broadcast
test('a transfer updates every connected screen')
test('a refused action broadcasts nothing') // send a later update-config; the next state seen is that one
test('a dice roll carries the rolling player’s id and is stored before it is announced')
test('dice are whole numbers from 1 to 6') // shape only, never distribution
test('the history keeps only the newest 50 rolls')

// presence
test('a player stays online while another connection is open')
test('a player goes offline when the last connection closes')

// routes
test('a valid join link sets the player cookie and redirects to /player')
test('an unknown join link answers 404 and sets no cookie')
test('the root address redirects to /player')

// config
test('start-game ignores invalid settings') // startingBalance 'abc' → balances 1500; passGoBonus -5 → stays 200
test('a failed start leaves the settings unchanged') // one player, then assert config
test('update-config ignores invalid values')
test('quick amounts are cleaned: whole, unique, sorted, at most 12')
```

- [ ] **Step 2: Run to verify they fail**

Run: `node --test tests/integration/broadcast.test.js tests/integration/presence.test.js tests/integration/routes.test.js tests/integration/config.test.js`
Expected: FAIL for D5 and D7. Prove the passing ones can fail by breaking one line each.

- [ ] **Step 3: Implement**

Track a `Map(playerId → open connection count)` in `attachSockets`; call `setOnline(id, false)` only when the count reaches zero. Move the `updateConfig` validation into `sanitizeConfig`. In `state.startGame`, compute the next state from `{ ...state, config: { ...state.config, ...sanitizeConfig(config) } }` without assigning to `state` until `logic.startGame` has succeeded.

- [ ] **Step 4: Run to verify they pass**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add tests server
git commit -m "fix(server): track presence per connection and validate start settings"
```

### Task 6: Mutation gate on the server

**Files:**
- Create: `stryker.config.json`, `stryker.full.config.json`, `.github/workflows/mutation.yml`
- Modify: tests in `tests/unit` and `tests/integration` as survivors require

**Interfaces:**
- Consumes: `npm test` from Task 1.

- [ ] **Step 1: Configure Stryker**

The command runner has no per-test coverage, so every mutant runs the whole command. Use two configs. `stryker.config.json`: `testRunner: "command"`, command `node --test tests/unit/*.test.js`, `mutate` set to `server/game-logic.js` and `server/persistence.js`, `thresholds.break: 80`. `stryker.full.config.json`: the full `npm test` command, `mutate` also including `server/state.js` and `server/socket-handlers.js`, report only with no break threshold, run weekly. Exclude `dist-electron` and `node_modules` from the sandbox copy.

- [ ] **Step 2: Run it**

Run: `npm run test:mutation`
Expected: a report listing surviving mutants, with a score, in minutes rather than hours. Run the full config once to record its duration and score in the PR.

- [ ] **Step 3: Work through every surviving mutant**

Each survivor gets one of two outcomes: a new test named for the rule it protects, or a one-line reason in the PR that the mutant is equivalent. Do not assert on a mutated line just to kill it. Do not lower the threshold; if 80% cannot be reached, report why.

- [ ] **Step 4: Add `.github/workflows/mutation.yml`**

Weekly cron plus `workflow_dispatch`, Node 24, running both configs and uploading the HTML reports as artifacts.

- [ ] **Step 5: Commit**

```bash
git add stryker.config.json stryker.full.config.json .github/workflows/mutation.yml tests package.json package-lock.json
git commit -m "test: add a mutation gate for server logic"
```

### Task 7: Client behaviour

**Files:**
- Create: `vitest.config.js`, `tests/client/setup.js`, `tests/client/DiceNotification.test.jsx`, `tests/client/DiceList.test.jsx`, `tests/client/useReceivedNotification.test.jsx`, `tests/client/history.test.js`, `tests/client/socket-helpers.test.js`, `tests/client/i18n.test.js`
- Create by extraction: `client/src/useReceivedNotification.js` (from `client/src/player.jsx:242-279`), `client/src/history.js` exporting `matchFilter` (from `client/src/banker.jsx:669-677`)
- Modify: `client/src/player.jsx`, `client/src/banker.jsx`, `.github/workflows/ci.yml`

`player.jsx` and `banker.jsx` render on import, so nothing inside them can be imported by a test. Extract only the two pieces above. Leave the modals to Task 8.

**Interfaces:**
- Produces: `useReceivedNotification(state, me) → { tx, dismiss }` and `matchFilter(tx, filter) → boolean`, unchanged in behaviour.

- [ ] **Step 1: Write the dice tests with `vi.useFakeTimers()`**

```js
test('the total stays hidden until the roll ends', () => {
  // at 1999ms the total shows '?', at 2000ms it shows dice[0] + dice[1]
});
test('the notification closes itself 5300ms after the roll') // onClose called 0 times at 5299, once at 5300
test('re-rendering with a new onClose does not restart the timer') // regression: rerender at 1000, 2000 and 3000, still closes at 5300
test('a new roll hides the total again and restarts the timer')
test('tapping the card closes the notification') // regression
test('the doubles badge is hidden until the roll ends')
test('history rows are newest first and an unknown player shows ?')
```

- [ ] **Step 2: Write the notification and helper tests**

```js
test('money received before the page opened shows no notification')
test('new incoming money shows a notification')
test('money I send shows no notification')
test('an undone payment shows no notification')
test('when several payments arrive together the newest is shown')
test('the notification goes away after 5000ms')
test('the bank filter matches only transactions with the bank')
test('a player filter matches both directions')
test('emit rejects with the error text in the current language')
test('relative time changes unit at 10 seconds, 60 seconds, 60 minutes and 24 hours')
test('quick amounts fall back to the defaults when the game has none')
test('tr-TR resolves to Turkish, pt-PT to Brazilian Portuguese, and an unknown language to English')
```

- [ ] **Step 3: Run, then prove red**

Run: `npm run test:client`
Expected: the extracted code and the dice code already pass. Prove each regression test can fail: change the effect's dependency to `[roll, onClose]` and restore; remove the `settled` check and restore. Record which line in the commit message.

- [ ] **Step 4: Add `test:client` to the CI `checks` job**

Run: `npm run test:client && npm run build`
Expected: PASS, and the app still builds after the extractions.

- [ ] **Step 5: Commit**

```bash
git add tests/client vitest.config.js client/src .github package.json package-lock.json
git commit -m "test: cover dice and notification behaviour in the client"
```

### Task 8: Multi-device journeys

**Files:**
- Create: `playwright.config.js`, `tests/e2e/helpers/app.js`, `tests/e2e/game.spec.js`, `tests/e2e/dice.spec.js`, `tests/e2e/identity.spec.js`, `tests/e2e/resilience.spec.js`
- Modify: `.github/workflows/ci.yml`; add `data-testid` in `client/src` only where role and text cannot find an element (the player balance, the dice total)

**Interfaces:**
- Produces a fixture: `app` (own server on a free port, temp data), `banker` (Chromium page), `phone(name)` (a WebKit `iPhone 13` context with its own cookies, language forced to `en` through `addInitScript`).

Set `retries: 0`. Each test starts its own server. Install only `chromium` and `webkit`.

- [ ] **Step 1: Write the journeys**

```js
test('players join by link and a payment appears on every screen')
test('the receiver sees a full-screen notification in the sender’s color')
test('each QR dialog encodes that player’s own link, and the link opens that player') // decode the canvas with jsqr, compare with the link text
test('on a landscape phone the QR dialog’s Close button can be reached and works') // viewport 844x390
test('the dice result is hidden, then every screen shows the same total, then it closes by itself')
test('two tabs in one browser each stay on their own player') // regression: roll from the first tab, announced as the first player
test('a rename reaches every screen, and a duplicate name shows an error')
test('the banker undoes a payment and the phone’s balance goes back')
test('after the server restarts, phones reconnect with the right balances and can keep playing')
test('a phone that was offline during a payment shows the current balance when it returns') // context.setOffline
test('a 24-character name causes no horizontal scrolling on a phone') // scrollWidth <= innerWidth
test('after a reset, an open phone and its old link show a clear screen')
```
Twelve scenarios is the ceiling. Merge rather than add.

- [ ] **Step 2: Run them**

Run: `npm run test:e2e`
Expected: PASS after Tasks 2 to 5. Prove the two-tab test can fail by reading the cookie on each render, the way the old code did, then restore. A real failure here is an app bug: report and fix it, never loosen the assertion.

- [ ] **Step 3: Add a CI job `e2e`**

Ubuntu, Node 24: `npm ci`, `npx playwright install --with-deps chromium webkit`, `npm run test:e2e`, upload the trace on failure.

Check: the job finishes under 3 minutes. Run it 5 times on a branch; any failure is treated as a real bug or a flaky test to fix, not rerun.

- [ ] **Step 4: Commit**

```bash
git add playwright.config.js tests/e2e client/src .github package.json package-lock.json
git commit -m "test: add multi-device journeys"
```

### Task 9: Desktop smoke, manual checklist and docs

**Files:**
- Create: `tests/electron/playwright.config.js`, `tests/electron/smoke.spec.js`, `.github/workflows/desktop.yml`, `docs/testing.md`
- Modify: `README.md`, and `electron/main.cjs` only if Step 1 requires it

**Interfaces:**
- Consumes: the `test:desktop` script from Task 1.

- [ ] **Step 1: Write the safety check first**

Launch with `_electron.launch({ args: ['.', `--user-data-dir=${tmp}`] })` and assert, before anything else, that `app.getPath('userData')` equals `tmp`. If it does not, stop: add a `MONOPOLY_USER_DATA` environment override to `electron/main.cjs` and use that. No other desktop test may run until this passes, because the real data folder holds a real game.

- [ ] **Step 2: Write the smoke tests**

```js
test('the app opens the banker screen')
test('the address, theme and language are the same after a relaunch') // skip when 3737 is taken on this machine
test('the app still opens on another port when 3737 is taken')
```

- [ ] **Step 3: Run them and prove red**

Run: `npm run test:desktop`
Expected: PASS. Prove each can fail by breaking one line in `electron/main.cjs`, then restore it.

- [ ] **Step 4: Write `docs/testing.md`**

How to run each layer, the 10 quality rules, and this manual checklist for each release: a real iPhone and a real Android phone scan a QR code; the sound plays after the first tap on iOS Safari; vibration; the screen stays awake; the blur and dice animation stay smooth on an older phone; a projector at 1080p is readable from the back of the room; a packaged app on a clean Mac shows the expected first-launch warning; the Windows installer runs. Link it from the README's Development section, and update the README's test command list and the count.

- [ ] **Step 5: Add `.github/workflows/desktop.yml`**

`macos-latest`, on `workflow_dispatch` and version tags: `npm ci`, `npm run build`, `npm run test:desktop`.

- [ ] **Step 6: Commit**

```bash
git add tests/electron docs/testing.md .github electron/main.cjs README.md package.json package-lock.json
git commit -m "test: add desktop smoke tests and a release checklist"
```

### Task 10: Contributor guide

**Files:**
- Create: `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `.github/PULL_REQUEST_TEMPLATE.md`, `.github/ISSUE_TEMPLATE/bug.yml`, `.github/ISSUE_TEMPLATE/feature.yml`
- Modify: `README.md`, `CHANGELOG.md`, `tests/integration/authorization.test.js`

**Interfaces:**
- Consumes: the npm scripts from Task 1 and `docs/testing.md` from Task 9.

- [ ] **Step 1: Write the documents, in plain English**

- `CONTRIBUTING.md`: Node 22 or newer for the test tools, `npm install`, `npm run build`, how to run each test layer, a link to the quality rules in `docs/testing.md`, English conventional commits, one change per PR, new error keys go in all 7 locales.
- `CODE_OF_CONDUCT.md`: adopt the Contributor Covenant 2.1 by linking to it rather than copying its text, in a few sentences; conduct reports go to `oalkandev@gmail.com`.
- `.github/PULL_REQUEST_TEMPLATE.md`: what changed and why, how it was tested, a checkbox that new tests were seen failing first.
- `bug.yml`: steps to reproduce, expected, actual, device and browser, app version or commit. `feature.yml`: the problem, the proposed behaviour.
- `README.md`: add a short Contributing section linking to `CONTRIBUTING.md`.
- `CHANGELOG.md`: rename the `## 2026-11-02` heading to `## 1.0.0-beta (2026-11-02)`, and update the intro line, which says there are no version tags.
- `tests/integration/authorization.test.js`: remove the two security `test.todo` entries. Security hardening is out of scope.

- [ ] **Step 2: Verify**

Run: `node -e "for (const f of ['bug','feature']) require('fs').readFileSync('.github/ISSUE_TEMPLATE/'+f+'.yml','utf8')"` and check every relative link in the new files points at a file that exists.
Expected: no errors, no broken links. Every command in `CONTRIBUTING.md` exists in `package.json`.

- [ ] **Step 3: Commit**

```bash
git add CONTRIBUTING.md CODE_OF_CONDUCT.md .github README.md CHANGELOG.md tests/integration/authorization.test.js
git commit -m "docs: add contributor guide, security policy and templates"
```

---

## Done means

- All 13 defects are fixed and each has a test that was seen failing.
- `npm run lint && npm test && npm run test:client && npm run test:e2e` passes from a clean clone in under 5 minutes.
- Mutation score on `game-logic.js` and `persistence.js` is at least 80%, every remaining survivor has a stated reason, and the weekly full run reports `state.js` and `socket-handlers.js`.
- A branch rule on `master` requires the `checks` and `e2e` jobs before merging.

## What we will not test

- Dice fairness or distribution, because it would measure `Math.random`, not this code.
- Tailwind classes, colors, or exact layout other than the no-horizontal-scroll rule.
- Translation wording. Parity and placeholders are checked; quality needs a person who speaks the language.
- Sound output, vibration and wake lock in automation. They are on the manual checklist because emulators do not prove them.
- Windows and Linux installers in CI, until someone reports a platform-specific bug.
