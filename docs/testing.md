# Testing

The rules every test follows are in [CONTRIBUTING.md](../CONTRIBUTING.md#rules-for-tests). This page lists the commands for each layer and the checks to do by hand before a release.

## Commands

| Layer | Command | What it covers |
| --- | --- | --- |
| Locale files | `npm test` | The seven locale files have the same keys. |
| Game rules | `npm test` | Balances, transfers, undo and validation in `server/game-logic.js`, including property tests. |
| Server | `npm test` | Real sockets and temporary files: saving, loading, permissions, presence and the HTTP routes. |
| Client | `npm run test:client` | Dice, the received-money notification and the helpers in `client/src`. |
| Browser journeys | `npm run test:e2e` | Banker and phones playing together in a browser. Run `npx playwright install chromium webkit` once first. |
| Desktop app | `npm run test:desktop` | Starts the Electron app with a temporary data folder. It opens the app's windows briefly. |
| Mutation score | `npm run test:mutation` | Changes the game logic on purpose and checks that the tests notice. |
| Lint | `npm run lint` | eslint over the client, server and Electron code. |

## Before each release

Check these by hand:

- A real iPhone and a real Android phone scan a QR code and join.
- The sound plays after the first tap on iOS Safari.
- Vibration works on the phones that support it.
- The screen stays awake while a game is open.
- The blur and the dice animation stay smooth on an older phone.
- A projector at 1080p is readable from the back of the room.
- A packaged app on a clean Mac shows the expected first-launch warning.
- The Windows installer runs.
