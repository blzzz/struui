# Strudel-Steine – Kontext für Claude Code

Greifbare Oberfläche für Strudel.js: Steine (Tokens) werden hintereinander gelegt und ergeben
Mini-Notation. Heute ein GUI-Prototyp, später soll eine Kamera physische Steine erkennen und
dieselbe Datenstruktur füllen. Lies zuerst `docs/ARCHITECTURE.md`.

## Befehle

- `npm run dev` – Entwicklungsserver
- `npm run check` – svelte-check (muss 0 Fehler haben)
- `npm test` – Unit-Tests der Domäne und der Text-Umwandlung (node:test, kein Zusatzpaket; braucht Node ≥ 22.18 oder `--experimental-strip-types`)
- `npm run test:strudel` – prüft mit echtem Strudel (ohne Browser), dass Code läuft und Ereignisse den richtigen Steinen zugeordnet werden
- `npm run gen:effects` – Effektliste aus `@strudel/core` neu erzeugen (nach jedem Strudel-Update; der Test meldet, wenn nötig)
- `npm run gen:sounds` – Klangliste aus Strudels Quellen neu erzeugen (braucht Netz; nach Strudel-Updates, der Test meldet geänderte Quellen)
- `npm run build` – Produktions-Build

## Aufbau und Regeln

- `src/lib/domain/` – reine TypeScript-Logik. Kein Svelte, kein DOM, kein Audio. Importe nur untereinander.
  Hier liegt die Wahrheit über Steine, Klammer-Parser und Code-Erzeugung (inkl. Positionen der Klangnamen für das Aufleuchten). Tests daneben (`*.test.ts`).
- `src/lib/syntax/` – Abgleich mit Strudels Grammatik (`analyze` = eigener Parser plus Strudels Urteil) und
  Text zu Steinen (`from-text.ts`, Strudels Syntaxbaum, Unbekanntes wird ein roher Stein). Der Parser in `domain/parse.ts`
  muss mit Strudel übereinstimmen: nach Änderungen `npm run test:strudel` laufen lassen.
- `src/lib/audio/` – `StrudelEngine` ist die einzige Klang-Engine (keine eigenen Synths, keine eigene Auswertung).
  Sie kennt den Svelte-Zustand nicht, nur `EngineHost` (`engine.ts`).
- `src/lib/state/` – Svelte-5-Zustand (`*.svelte.ts`, Runes). `project` (Spuren, Tempo, abgeleiteter Code),
  `session` (flüchtiger UI-Zustand), `playback` (Engine-Steuerung), `sample-bank` (eigene Aufnahmen).
- `src/lib/interaction/` – Zeiger-Gesten als Svelte-Attachments (`{@attach ...}`).
- `src/lib/ui/` – Komponenten. Texte für Nutzer stehen auf Deutsch.

Konventionen: Svelte 5 mit Runes (`$state`, `$derived`, `$props`), keine Stores, keine Optionen-API.
TypeScript strict. Importe mit `.ts`-Endung. Domänenänderungen immer mit Test.

## Wichtig

- Klangquellen und Klangnamen nie von Hand abschreiben: sie kommen aus `@strudel/repl/prebake.mjs` (Namen über `npm run gen:sounds`). Beim Aktualisieren `@strudel/repl` anheben und
  `@strudel/core`, `@strudel/webaudio`, `@strudel/transpiler`, `@strudel/mini` auf genau die Versionen setzen, die es verlangt.
  Nicht `@strudel/web` verwenden (bündelt eine zweite Strudel-Kopie, siehe `docs/ARCHITECTURE.md`).
- **Architekturentscheidungen sind offen und gehören dem Projektinhaber** (Liste in `docs/ARCHITECTURE.md`, Abschnitt 4).
  Nicht selbst entscheiden: Optionen skizzieren und nachfragen.
- Der Prototyp wurde nie in einem Browser getestet, nur gebaut, typgeprüft, die Domäne unit-getestet und die Strudel-Zuordnung per Skript geprüft.
  Verhalten in Safari/iOS (Gesten, Mikrofon, Audio) ist ungeprüft.
- Strudel steht unter AGPL-3.0-or-later. Das betrifft eine Veröffentlichung dieses Projekts.
