# Contributing

Monopoly Bank is a Monopoly money manager for home use on a local network. The banker runs it on a computer, and each player joins from a phone on the same Wi-Fi.

## Setup

Use Node.js 22 or newer. The test tools need it.

```bash
npm install
npm run build
```

`npm run build` builds the frontend into `public/`.

## Commands

| Command | What it does |
| --- | --- |
| `npm test` | Runs the locale checks, the game rules tests and the server tests. |
| `npm run test:e2e` | Runs the multi-device journeys in a browser. Run `npx playwright install chromium webkit` once before the first run. |
| `npm run test:mutation` | Changes the server logic on purpose and checks that the tests notice. Takes longer than `npm test`. |
| `npm run lint` | Checks the client, server and Electron code with eslint. |
| `npm run build` | Builds the frontend. |

## Rules for tests

A test that breaks one of these rules does not merge.

1. Name each test after a rule someone could say out loud, such as "a refused action changes nothing". Do not use names such as "works correctly" or "renders".
2. Watch each new test fail first. Run it against the bug, or against one deliberately broken line, then restore the line. The commit message names that line.
3. Server tests in `tests/unit` and `tests/integration` use the real server, real sockets and real temporary files. They do not mock this project's modules. Browser-side tests fake only timers and the socket.
4. Do not use snapshot tests. Do not assert on CSS classes, on whether a mock was called, on constant values, on framework behaviour, or on translation wording. The exception is a test about language itself.
5. Do not use sleeps or fixed timeouts to wait for a result. Wait for an event, use a web-first assertion, or use fake timers. To check that something did not happen, send a later action that is known to work and check that it arrives first.
6. Assertions never depend on random values. Dice are not tested for fair distribution. Property tests use `fast-check`, which reports its seed.
7. Line coverage is not a goal and does not decide whether a change merges. The mutation score does.
8. Each test uses its own temporary directory and port `0`. No test depends on another test running first.
9. Retries are off. A flaky test is fixed or deleted.
10. Delete any test whose failure would not tell a user what broke.

## Commits and pull requests

- Write commit messages in English, as conventional commits, for example `fix(server): keep the balance after a failed save`.
- Keep one change in each pull request.
- Say what changed and why, and how it was tested. The pull request template asks for both.
- If you add an error message key, add it to all seven locale files in `client/src/locales/`: `tr`, `en`, `es`, `de`, `fr`, `it` and `pt-BR`.

## Reporting bugs and ideas

Open an issue with the bug report form or the feature request form. Everyone taking part follows the [Code of Conduct](CODE_OF_CONDUCT.md).
