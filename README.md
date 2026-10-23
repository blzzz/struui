# Strudel-Steine

Strudel.js zum Anfassen: Steine hintereinander legen, daraus entsteht Mini-Notation.
Zuerst als Oberfläche am Bildschirm, später mit Kamera und echten Steinen.

```bash
npm install
npm run dev      # Entwicklungsserver
npm run check    # Typen und Svelte-Prüfung
npm test         # Unit-Tests der Domäne
npm run test:strudel  # Prüfung mit echtem Strudel (ohne Browser)
npm run build    # Produktions-Build
```

Stack: Svelte 5 (Runes), TypeScript, Vite. Der Ton kommt ausschliesslich von Strudel (`@strudel/core` und `@strudel/webaudio`, werden erst geladen, wenn ein Klangstein sichtbar wird oder etwas erklingt), mit denselben
Klangquellen aus dem Paket `@strudel/repl`. Dafür braucht die Seite beim ersten Abspielen Internet.

Das Mikrofon (eigene Sounds aufnehmen) braucht eine https-Adresse oder `localhost`.

Lizenz: Strudel steht unter AGPL-3.0-or-later. Wer dieses Projekt veröffentlicht, muss den
Quelltext mitliefern. Die Lizenz des Projekts selbst ist noch nicht festgelegt.

Mehr dazu in `docs/ARCHITECTURE.md`.
