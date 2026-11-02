# Changelog

Notable user-facing changes to Monopoly Bank, newest first.

## 1.0.0-beta.2 (2026-11-02)

### Changed

- Undoing a payment is refused when the player has already spent that money. The banker can correct the balance by hand.
- Amounts must be whole numbers.

### Fixed

- A phone or browser set to a regional language such as tr-TR, de-DE or fr-FR opened in English.
- A failed save no longer stops later saves, and the game carries on.
- A damaged save file is kept aside and the app starts with an empty game.
- A player stays online while another of their connections is open.
- Invalid starting settings are ignored.

## 1.0.0-beta (2026-11-02)

### Added

- Players can change their name from their phone after the game has started.
- MIT license and an English README with screenshots.
- The banker's history panel now has Transactions, Dice and Both views, with large text and dice that can be shown to spectators on a projector.

### Changed

- The dice animation now lasts 2 seconds instead of about 0.7 seconds, and the total and doubles badge appear once it finishes. The screen behind the dice notification is now blurred so the history list cannot reveal the result early.
- The desktop app uses a fixed port (3737) and falls back to a free port if it is taken, so the connection address stays the same between launches.
- Player names are limited to 24 characters, and two players cannot use the same name (names that differ only in upper/lower case count as the same). The server enforces this too.

### Fixed

- The dice notification could not be dismissed by tapping the card on mobile.
- Game updates arriving during play delayed the automatic dismissal of the dice notification.
- Column alignment was off on dice rows with a doubles badge in the history.
- On a phone in landscape, the QR dialog did not fit the screen and its Close button was unreachable.
- The desktop app reset the theme and language choice on every launch.
- Scanning a second player's QR code on the same phone switched older tabs to that player while they kept acting as the previous one. Each tab now stays on the player it opened with.

## 2026-04-26

### Added

- Desktop app (Electron): Monopoly Bank can now be packaged as a cross-platform desktop installer. The app icon is Mr. Monopoly's red top hat.
- Multi-language support (i18n): Turkish, English, Spanish, German, French, Italian and Brazilian Portuguese. Server error messages are translated into the selected language too, and regional language codes (such as tr-TR or pt-PT) resolve to the right language.
- Dice rolling: players roll the dice from their phones and the result is shown on every screen. The dice are drawn with dots and animated. The Roll Dice button sits in the player's top bar.
- Dice roll history is saved with the game state and lists every roll. Transactions and Dice were combined into a single tabbed card.
- When money is received, the player's phone shows a full-screen notification in the sender's color, plays a "ka-ching" sound and vibrates. Sounds no longer overlap when payments arrive in quick succession.
- Quick amount buttons are additive (press several to add them up); the default presets are 1, 5, 10, 50, 100 and 500. The banker can edit the quick amounts during game setup.
- A Send to Everyone option was added to the Send Money dialog.
- A game timer is shown in the banker's header and in the player's top bar. It also works for older games that were started before this field was saved.
- The setup screen has a larger QR code (on a white background) and a more subdued copy button.

### Changed

- Emojis were replaced with consistent Lucide icons (setup screen, transaction history, stats bar, theme toggle, connection badge).
- Player cards are shown in at most 2 columns.
- On the banker's player card, the GO bonus, quick amount and Give/Take buttons are larger and the same height; spacing was increased on the cards and in the Settings card. The action buttons on the player side were made smaller.
- Amount fields display the currency symbol and right-aligned digits more cleanly, and open the numeric keyboard.
- On narrow screens the player's action buttons stack vertically and icons no longer wrap onto the next line.

### Fixed

- Sound problems on iOS Safari were fixed (audio unlocking, sound resuming when returning to the tab, reliable playback).
- On iOS Safari, dialogs sometimes failed to open and the currency symbol in amount fields was pushed off-screen.
- The Send Money dialog shifted on Android (Brave).
- The copy button did not work when the app was opened over a local network IP (an insecure connection); a fallback method was added.
- The GO bonus button showed the "+" sign twice.

## 2026-04-25

### Added

- First release: a Monopoly money manager that runs on the local network. The banker runs the game from a computer, players join from their phones, and data is saved automatically.
- The interface was rebuilt with Vite, React, Tailwind and DaisyUI.
- A QR code the banker can open during the game, a light/dark theme, and a new layout with a sidebar.
- Filterable transaction history.

### Changed

- Only the banker can grant the GO bonus.
- Visual polish: a dark interface, more prominent player headers and borders, and a reordered color palette (blue, red, yellow, green first).
- The Send Money dialog was simplified, and recipient selection moved to colored cards.

### Fixed

- The QR code now uses the local network IP instead of `localhost`, so phones can connect.

### Removed

- The players' own "Passed GO" button on their screens (the GO bonus is now banker-only).
