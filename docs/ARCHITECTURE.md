# Architektur

Stand: Überführung des Chat-Prototyps in eine Codebasis. Dieses Dokument trennt, was schon
entschieden ist, von dem, was bewusst offen bleibt.

## 1. Idee

Eine Spur ist eine **flache Liste von Steinen**, genau wie der Mini-Notation-Text, der daraus entsteht.
Fehler sind erlaubt (Klammern können fehlen) und werden gemeldet, statt verhindert zu werden.
Die Oberfläche kommt zuerst; die Kamera soll später dieselbe Datenstruktur füllen.

## 2. Schichten

```
domain/   reine Logik: Token, parse, codegen, edit                    (kein DOM, kein Svelte, kein Audio)
syntax/   Abgleich mit Strudels Grammatik: validate (Grammatik), analyze (eigener Parser + Grammatik)
audio/    StrudelEngine (einzige Klang-Engine), EngineHost, Recorder, WAV
state/    Svelte-5-Zustand: project, session, playback, sample-bank
interaction/  Gesten als Attachments: tokenGestures (Tippen, Doppeltippen, Ziehen), knob (Drehen)
ui/       Komponenten
```

Abhängigkeiten zeigen nur nach unten: `ui` → `state` → `audio`/`syntax` → `domain`. `audio` kennt den Zustand nicht,
sondern bekommt einen `EngineHost` (Programm, Callbacks für Hervorhebung und Status).

### Datenfluss

`project.tracks` (Token-Listen) → `codegen` (Strudel-Code **und** die Position jedes Klangnamens im Code) →
`StrudelEngine` (`evaluate`). Parallel liefert `parse` Baum, Fehler und Gruppentiefe für die Darstellung.

**Prüfung der Spuren (`syntax/analyze.ts`):** Der eigene Parser (`domain/parse.ts`) liefert Baum, Gruppentiefe und die genaue
Fehlerstelle. Findet er nichts, fragt `validateMini` Strudels eigene Grammatik (`@strudel/mini/krill-parser.js`, nur die
Grammatik, rund 115 kB ohne Strudel-Kern). `@strudel/mini` steht deshalb als eigene Abhängigkeit in `package.json`, in derselben
Version, die `@strudel/repl` verlangt (sonst findet strenge Paketverwaltung wie pnpm den Tiefenimport nicht). Beim Aktualisieren
von `@strudel/repl` die Version von `@strudel/mini` mitziehen. Lehnt sie die Spur trotzdem ab, wird der Stein an der gemeldeten Stelle rot.
`npm run test:strudel` vergleicht beide an 5000 Zufallsspuren.

**Aufleuchten:** Strudel meldet pro Ereignis die Zeichenposition im Code (`hap.context.locations`). Weil der Code
von `codegen` stammt, kennen wir die Position jedes Klangnamens und finden so den Stein.

## 3. Bereits entschieden (aus dem Prototyp)

- **Token-Modell:** `sound`, `open`, `close`. Klammern sind eigene Steine, Modifier hängen wie im Code
  an der schliessenden Klammer. Beim Einfügen kommen Klammern immer als Paar.
- **Drei Ebenen pro Stein:** oben Zufall (rot), Mitte Klang, unten Wiederholung (blau `*`, grün `!`, orange `@`).
  Tippen auf die untere Ebene schaltet aus → `*` → `!` → `@` → aus.
  Die obere Ebene (Zufall) ist pro Spur zuschaltbar: Würfel links vom Notationseditor der Spur (`session.random`, flüchtig,
  Standard aus). Aus: keine Zufallsknöpfe, Steine mit Zufall tragen einen roten Punkt, nicht änderbar. Die Position bestimmt die Bedeutung. Fehlende Steine bedeuten Standardwerte.
- **Drei Klammerarten:** `[ ]` Gruppe, `< >` Wechsel, `{ }` Polymeter (eigene Farbe `--br3`). Unter `}` liegt statt Zufall und
  Wiederholung nur der **Modulowert** (`{a b c}%4`, Drehknopf 1–8, aus = so viele Schritte wie Elemente). Zufall und Wiederholung
  einer Klammer bleiben gespeichert, wenn sie zu `{` wechselt, und kommen beim Weiterschalten zurück. Kommas zwischen Folgen (`{a b, c d e}`) gibt es nicht als Stein, nur Stapel einzelner Klänge (siehe unten).
- **Zahlen über Drehung** mit Raststufen (`scales.ts`). `*` kennt Brüche und ersetzt damit `/`.
  Der Zufallswert ist die **Ausfallchance** (wie `?0.3` in Strudel).
- **Pause ist ein Klang** (`~`), kein Operator. Leere Felder in einem Raster gibt es nicht mehr.
- **Gestik:** Tippen auf einen Stein öffnet sofort ein kleines Menü darüber: Entfernen (Icon) und Umschliessen mit
  `[ ]`, `< >` oder `{ }`. Nach der Wahl ist die Reihe im Auswahlmodus (`session.wrap`): der Startstein ist blau umrandet,
  Antippen eines Steins (vorwärts oder rückwärts, auch des Startsteins selbst) setzt das Paar um den Bereich. Angeschnittene
  Klammerpaare kommen ganz hinein (`wrapSpan` in `domain/edit.ts`), so bleibt die Reihe ausgeglichen. Mit der Maus zeigt
  ein gestrichelter Rahmen den Bereich schon vorher. Tippen ausserhalb der Reihe, Escape oder «Abbrechen» bricht ab.
  Bei Klammern statt Umschliessen: Klammerpaar auflösen und die drei Klammerarten.
  Noten- und Wertsteine zeigen dasselbe Menü über dem Eingabefeld (−/+ bleiben darunter); eine Wahl schliesst das Feld.
  Klammerpaare gibt es deshalb nicht mehr in den Paletten; eine leere Reihe braucht zuerst einen Stein. **Ersetzen geht nur durch Ziehen:** Ein Stein aus der Palette über der mittleren Hälfte
  eines Klang- oder rohen Steins ersetzt ihn (Zufall und Wiederholung bleiben). Die äusseren
  Viertel fügen davor/danach ein (`findDropTarget`, `replace`). Steine im Editor verschieben immer nur. Einen Klangdialog gibt es
  nicht mehr; `ui/ValueSheet.svelte` ist nur noch der Dialog für Wertsteine. Ziehen verschiebt (auch zwischen
  Spuren). Kein Doppeltippen und keine Verzögerung mehr; per Tastatur öffnet Enter den Dialog.
  **Anfügen mit Komma durch Verweilen:** Bleibt ein Klang aus der Palette 600 ms über der Mitte eines Klangsteins (nicht Pause,
  nicht roher Stein), wird aus «ersetzen» (blau) «anfügen» (grün, `DropTarget.mode = 'stack'`, `DWELL_MS`); so bleiben Einfügen
  und Ersetzen unverändert. Die Pause aus der Palette fügt nie an.
  Ziehen hört nach dem Drücken am ganzen Fenster zu (nicht über Pointer Capture am Stein), wertet höchstens einmal pro Bild aus
  und bricht bei `Escape`, verlorenem Fokus oder `pointercancel` sauber ab. Vorher konnte der Geisterstein hängen bleiben.
- **Eine Klangpalette unter der oberen Leiste** (`ui/SoundPalette.svelte`, in `App.svelte`, klebt beim Scrollen, immer offen;
  das + nach dem Titel öffnet ein Menü mit Aufnehmen und Datei laden): waagrecht scrollbare Zeile mit eigenen
  Klängen, Pause und den Klängen aus `SOUND_GROUPS` (mit Suche: alle Klänge, auch Drum Machines). Nach oben/unten ziehen legt den Stein in eine
  Klangreihe (Klangspur oder `.s` einer Notenspur, dort ohne Pause), seitwärts scrollt die Zeile (`canDrag` in `token-gestures.ts`,
  `touch-action: pan-x`). Antippen legt nichts ab, Steine kommen nur durch Ziehen in eine Spur. Langes Drücken spielt den Klang an (`StrudelEngine.preview`, direkt über Strudels `superdough`,
  lädt Strudel beim ersten Mal; auf iOS evtl. still, bis einmal getippt wurde, weil der Audiokontext eine Geste braucht). Klangreihen haben kein `+` mehr; Effektreihen behalten es (für Werte gibt es keine Palette).
- **Darstellung:** Wrap-Layout; passt eine Klangreihe nicht auf eine Zeile, verkleinert `Lane` sie per CSS `zoom` (bis 0,5,
  darunter Umbruch; Noten- und Wertreihen werden nie verkleinert, sie brechen um). Ein Knopf daneben schaltet pro Reihe auf Originalgrösse (`session.unfit`). Beim Tippen in einen Stein bleibt
  die Reihe verkleinert (zurücksetzen liess sie unter dem Finger springen, das Feld schloss gleich wieder), Feld und Menüs im Stein heben den Zoom auf (ungeprüft im Browser, vor allem Safari).
  Dasselbe für die Effekt-Boxen einer Spur (`EffectList`, `--fx-fit`), dort ist Originalgrösse der Standard und die Lupe
  verkleinert (`session.fitEffects`). Messung in `ui/fit.ts`, der Knopf (Lupe mit + oder −) ist `ui/FitButton.svelte`.
  Die frühere Kompaktansicht pro Spur ist entfernt.
  Gruppen ohne Hinterlegung, nur die farbigen Klammersteine zeigen sie (die Tiefe aus `parse` nutzt die Darstellung nicht mehr). Klammern sind quadratische Steine wie Klänge.
- **Operatoren als Drehknöpfe:** Jeder Operator ist ein runder Knopf. In der Mitte steht nur das Zeichen (`?`, `*`, `!`, `@`, `%`),
  rundherum markieren Punkte die Raststufen, an der aktuellen steht klein der Wert (Brüche als `½`, Zufall als `.25`).
- **Eigene Sounds:** aufnehmen oder Datei laden, auf 3 s gekürzt, normalisiert, als WAV (mono, 16 kHz)
  als Data-URL in den Code eingebettet (`samples({...})`).
- **Strudel ist die einzige Klang-Engine** (`@strudel/core`, `@strudel/webaudio`, `@strudel/transpiler`, dynamischer Import). Es gibt keine eigene Auswertung
  und keine eigenen Synthesizer mehr. **Die Klangquellen werden nicht von Hand gepflegt:** das Prebake stammt aus dem
  offiziellen Paket `@strudel/repl/prebake.mjs` (die übrigen Strudel-Pakete in genau den Versionen, die `@strudel/repl` verlangt). Es lädt unter anderem das
  uzu-Drumkit, das `bd`, `sd`, `hh` liefert. Eine früher von Hand aus einer README übernommene Liste fehlte genau dieses
  Drumkit, deshalb klang es anders als auf strudel.cc. Lehre: nichts abschreiben, was ein Paket mitliefert.
  **Nicht `@strudel/web` verwenden:** Es bündelt eine eigene Kopie von Strudel. Das Prebake überschreibt die globalen
  Funktionen mit den einzelnen Paketen und meldet die Klänge dort an. Mit zwei Kopien schlug `$:` fehl
  (`s(...).p is not a function`) und die Ausgabe hätte die Klänge nicht gefunden. Die Engine baut das Repl deshalb
  selbst (`webaudioRepl`), wie es `initStrudel` täte.
- **Klammerart wechseln gilt für das ganze Paar** (`edit.ts`, `setGroup`, `unwrapAt`). Das Gegenstück wird über alle
  Klammerarten gezählt (`partnerIndex`), so wird auch ein gerade unpassendes Paar wieder gleich. Ohne Gegenstück wechselt nur
  die Klammer selbst. `quickSwitch` (Weiterschalten per Tippen) ist seit dem Menü ungenutzt, aber noch vorhanden.
- **Code pro Spur bearbeiten** (`syntax/from-text.ts`, `ui/TrackCode.svelte`). Der Text wird von Strudels Grammatik
  gelesen, ihr Syntaxbaum wird in Steine übersetzt. Doppelpunkte direkt an einem Wort (`bd:3`, `.5:2`, Strudels `tail`) gehören zum Text des Steins. Was kein eigener Stein ist (`bd(3,8)`, `[a b]:2`, `a/2`, `a*2@3`, `[a, b]`,
  `{a, b}`, `{a b}*2`, `a . b` …), wird ein **roher Stein** (`RawToken`) mit dem Originaltext, der unverändert in den Code zurückgeht
  und als Ganzes aufleuchtet. Die Steine ändern sich bei jedem gültigen Tastendruck; ungültiger Text lässt sie stehen
  und zeigt Strudels Meldung. Steine gleicher Art an gleicher Stelle behalten ihre ID (`adoptIds`).
  Tests prüfen, dass Strudels Syntaxbaum vor und nach dem Umweg gleich ist, `test:strudel` zusätzlich an allen gültigen Zufallsspuren.
  Offen: Die Kamera kennt rohe Steine nicht; Klangnamen werden nicht gegen die Klangliste geprüft.
- **Spuren lassen sich stumm schalten** (`Track.muted`). Die Spur bleibt im Code, endet aber mit `.hush()`, Strudel macht daraus Stille.
- **Neue Klammerpaare enthalten eine Pause** (`[~]`), weil Strudel leere Klammern ablehnt. So bleibt die Spur gültig und läuft weiter.
- **Abspielkopf:** Zykluszähler und der Rand des runden Start/Stopp-Knopfs, der sich im Lauf eines Zyklus füllt (einer für alle Spuren,
  sie teilen sich den Zyklus), gelesen aus `scheduler.now()` von Strudel. Er ist nicht an die Steine ausgerichtet.
- **Gewicht `@`** ist eine vierte Art der Wiederholung (eine pro Stein, wie `*` und `!`). `a _` liest der Rückweg als `a@2`.
- **Aufleuchten bei `%n`:** Strudel meldet bei `{…}%4` zuerst die Position der Zahl, dann die des Klangnamens. Engine und
  `test:strudel` durchsuchen deshalb alle gemeldeten Positionen.
- **Layout über den ganzen Bildschirm:** feste Leiste oben (Start/Stopp, Tempo, Gesamtlautstärke, Umschalter Steine/Code, `?` für den
  Erklärungsdialog).
- **Tempo** (`domain/tempo.ts`): intern `project.cps`, eingegeben als Zahl in BPM, CPM oder CPS (`project.tempoUnit`, Standard BPM).
  BPM nach Strudels Konvention mit 4 Schlägen pro Zyklus. Der Code folgt der Einheit: `setcpm(120/4)`, `setcpm(30)` oder `setcps(0.5)`.
  Erlaubt sind 0.05–2 cps (12–480 BPM). Szenen speichern nur `cps`, die Einheit bleibt.
- **Gesamtlautstärke** (`session.volume`, 0–1, Doppelklick = 1): setzt den Ausgangsknoten von superdough
  (`getSuperdoughAudioController().output.destinationGain`), steht also nicht im Code und gilt auch für Szenen nicht.
  Hängt an einem internen Detail von superdough, nach Strudel-Updates prüfen. Spuren gehen über die volle Breite. Die Code-Ansicht zeigt das ganze Programm, oben der Link zu Strudel.
- **Effekte pro Spur** (`domain/effects.ts`, `Track.effects`, `ui/EffectList.svelte`). Unter den Steinen ein Suchfeld mit
  Autovervollständigung; die Wahl fügt eine Box an. **Der Wert eines Effekts ist eine Steinreihe wie eine Spur**
  (`Effect.tokens`), nur stehen Werte statt Klängen auf den Steinen (`sound` = `800`, `.5`, `a`). Klammern, Zufall,
  Wiederholung und Ziehen (nur zwischen Wertreihen) wirken gleich. **Werte werden direkt bearbeitet:** Tippen öffnet sofort
  (ohne Warten auf Doppeltippen) ein Feld im Stein, jede gültige Eingabe gilt sofort; ↑/↓ und −/+ springen zum nächsten Wert
  aus Strudels Beispielen (`stepValue`). Das Tippen muss sofort wirken, weil iOS die Tastatur nur innerhalb der Geste öffnet.
  Der Dialog liegt deshalb bei Wertsteinen auf langem Drücken (Tastatur: Enter). Ungeprüft auf iOS/Android. Im Code: ein einzelner Zahlenstein ohne Modifier als Zahl (`.lpf(800)`), sonst Mini-Notation
  (`.lpf("<200 800>")`); dann meldet Strudel Positionen und die Wertsteine leuchten (`test:strudel` prüft das).
  Ohne Steine oder mit Klammerfehler geht der Effekt nicht in den Code. Neue Klammerpaare enthalten in Wertreihen einen Wert
  statt `~`, denn `~` liesse dort die Klänge ausfallen (mit Strudel geprüft).
  `state/project` adressiert beide Arten von Reihen einheitlich über `lane(id)` (Spur-ID oder Effekt-ID).
  **Die Liste wird nicht von Hand gepflegt:** `npm run gen:effects` liest die JSDoc-Kommentare von `@strudel/core/controls.mjs`
  (Name, Synonyme, erster Satz, Wertangabe, Werte aus den `@example`-Aufrufen) und schreibt `effects.generated.ts`.
  Ausgefiltert werden nur `@superdirtOnly`, Objekt-Parameter (`env`, `lfo` …) und eine kurze Liste von Nicht-Effekten
  (Klangwahl, Routing, Sysex/OSC, dazu was die Spur selbst einstellt: `postgain`, `orbit`, `midichan`, `midiport`).
  Jeder Eintrag hat eine **Gruppe** (`audio`, `pitch` = `note`, `midi` = `ccn`, `ccv`, `progNum`, `midibend` …, `sample`). Klangspuren bieten
  Audio, Tonhöhe und Sample-Funktionen an, MIDI-Spuren MIDI, Tonhöhe sowie `velocity` und `gain` (`offersEffect`).
  **Sample-Funktionen** (Gruppe `sample`, nur Klangspuren): `chop`, `striate`, `scrub`, `loopAt`, `fit`. Sie verändern die
  Ereignisse statt einen Wert zu setzen, stehen im Code aber wie Effekte nach dem Muster (`s("brk").fit().scrub("<0 .5>")`),
  in der Reihenfolge der Boxen. Die Auswahl (`SAMPLE_OPS` im Skript) ist von Hand, Beschreibung, Beispielwerte und die Zahl
  der Werte liest das Skript aus Strudel (`register('chop', function (n, pat)`). `fit` nimmt keinen Wert (`noValue`): seine Box
  hat keine Wertreihe, im Code steht immer `.fit()`. `test:strudel` prüft, dass `fit().chop(2).scrub(…)` läuft und die
  Wertsteine von `scrub` leuchten. `scrub` mit Geschwindigkeit (`"0.8:1.5"`) geht als Wertstein mit Doppelpunkt (`isValueAtom(text, true)`, nur wo `takesSpeed`, also bei `scrub`). Offen: `slice`/`splice` (zwei Werte),
  Rechnen in Wertreihen (`"0 4 8".div(16)`). Zahlen hinter Modifiern in Strudels Beispielen (`!2`, `@3`, `%8`) gelten nicht als Werte. Der Rückweg aus Code nimmt jeden bekannten Effekt. Ein Test schlägt fehl, wenn die Datei nicht mehr zum installierten Strudel passt.
  Beschreibungen sind Strudels englische Texte. Für 44 Effekte zeigt Strudel keine Beispielwerte; dort zählen −/+ in Einer- bzw. Zehntelschritten.
  **Effekte als Boxen** (`ui/EffectBox.svelte`): je Effekt eine rund 64 px breite Box, von links umbrechend. Oben der Titel
  (Beschreibung als Tooltip, Ziehen daran verschiebt die Box, Tastatur Pfeil links/rechts, `interaction/reorder.ts`,
  `project.moveEffect`; die Reihenfolge ist die im Code), darunter Regler und Zahlenfeld. Ein Regler pro Box, also pro Effekt ein
  Wert: Strudels Unterparameter (`lpf("800:10")` = cutoff:resonance) sind bewusst nicht dabei (entschieden). Der Bereich kommt aus
  Strudels Beispielwerten (`valueScale`): sie liegen gleichmässig auf dem Regler, dazwischen linear, nahe daran rastet er ein; mit
  einem Beispiel 0 bis zum Doppelten, ohne Beispiel 0–1. Das Zahlenfeld nimmt auch Werte ausserhalb. Effekte mit Namen statt
  Zahlen (`vowel`) bekommen eine Auswahl. Der Schalter «mini» zeigt stattdessen die Wertsteine (`session.mini`, flüchtig);
  ist der Wert mehr als ein einzelner Stein ohne Zufall und Wiederholung (`singleValue`), bleibt er an, damit nichts verloren geht.
  **Strudels `slider()`:** «edit» in der Box stellt min, max und step ein (`Effect.slider`, Vorschlag aus den Beispielwerten,
  `suggestSliderRange`). Erst dann steht der Wert als `.lpf(slider(800, 100, 8000, 10))` im Code (entschieden: nur nach Bearbeiten),
  und der Regler der Box ist linear wie der von Strudel. «kein slider» schreibt wieder die Zahl. Bei Mini-Notation bleibt der
  Bereich gespeichert, steht aber nicht im Code. Der Rückweg aus Code liest `slider(wert[, min, max, step])` (fehlend wie bei Strudel
  0, 1, ohne step ein Hundertstel). `sliderWithID`, das der Transpiler daraus macht, kommt aus `@strudel/codemirror`, das das Prebake
  lädt; `test:strudel` prüft mit genau diesem Modul. Auf strudel.cc erscheint der Wert als Regler im Code. Ziehen am Regler ändert
  den Code und wertet neu aus (Strudels Weg ohne Neuauswerten, `cm-slider`-Nachrichten, ist ungenutzt).
  Ungeprüft im Browser, vor allem Regler und Ziehen am Titel auf iOS.
  Offen: Effekte als physische Steine für die Kamera, Effekte auf einzelnen Steinen statt der ganzen Spur.
- **Kanalzug pro Spur** (`ui/TrackView.svelte`): rechts vom Namen waagrecht `M` (stumm), Orbit bzw. MIDI-Kanal und der Lautstärkeregler (höchstens 120 px breit). Am rechten Rand des Spurkopfs drei Punkte (`ui/TrackMenu.svelte`): Menü mit Art der Spur (Klang, Noten, MIDI), Ansicht (Steine oder Code) und «Spur entfernen». In der Code-Ansicht fallen
  Regler und `M` weg, Lautstärke und Stummschaltung stehen dann im Text. Die Lautstärke (`Track.volume`, 0–1.5) ist Strudels `postgain`
  (wirkt nach allen Effekten, Standard 1) und steht nur im Code, wenn sie nicht 1 ist, als letzter Aufruf der Zeile.
  `postgain` ist deshalb aus der Effektliste gefiltert; der Rückweg aus Code liest `.postgain(Zahl)` als Lautstärke.
  Offen: Lautstärke in dB oder linear, Bereich über 1, Meter/Pegelanzeige.
- **Klang- und MIDI-Spuren** (`Track.type`, im Menü der Spur). Eine MIDI-Spur behält ihre Klangsteine
  (`s("…")` ist für MIDI bedeutungslos); die Tonhöhe kommt als Effektzeile `.note(…)`. Ohne sie schickt Strudel keine Noten,
  die Spur zeigt dann einen Hinweis mit «note hinzufügen». Im Code: `$m: s("bd").note("c4").midichan(2).midi('IAC Driver Bus 1')`,
  `.midichan` immer, `.midi()` am Schluss (leer = Strudel wählt den ersten IAC-Port, sonst den ersten Ausgang).
  Neben `M` steht bei Klangspuren der **Orbit** (1–8, Tippen zählt weiter, `.orbit(n)` nur wenn nicht 1, vor `.postgain`),
  bei MIDI-Spuren der **Kanal** (1–16). MIDI-Spuren haben keinen Lautstärkeregler. Der Ausgang wird im Spurkopf gewählt;
  die Liste kommt aus der Web-MIDI-API (`audio/midi-ports.ts`, `state/midi.svelte.ts`), erst abgefragt, wenn eine Spur MIDI wird.
  Ein gewählter, aber nicht angeschlossener Ausgang bleibt als «(nicht verbunden)» stehen. Werte der anderen Art bleiben beim
  Umschalten gespeichert. Safari kennt Web MIDI nicht. Ungeprüft: MIDI im Browser überhaupt (`test:strudel` lädt `@strudel/midi` nicht).
  Offen: `n`, `bank` und die übrigen Nicht-Effekte.
- **Notenspuren** (`Track.type = 'note'`, dritte Art neben Klang und MIDI, im Menü der Spur). Die Steine tragen
  Noten statt Klängen (`note("f <d a4> ~")`), danach folgt eine feste Reihe für den Klang (`Track.voice`, im Code `.s("sine")`,
  vor den Effekten). Notensteine kommen aus einer Notenpalette (Stammtöne c–b, Pause); Tippen bearbeitet sie direkt
  wie Wertsteine (`domain/notes.ts`: Strudels Schreibweise `c#4`, `eb`, MIDI-Zahlen; ↑/↓ = Halbton, aufwärts `#`, abwärts `b`,
  Oktave nur wenn nicht 3), langes Drücken öffnet das Menü (Entfernen, Umschliessen). Klangsteine bearbeiten sich genauso: Tippen öffnet ein Feld für den Namen
  (`isSoundName`: ein Wort, auch unbekannte Namen, wahlweise mit Variante `bd:3`, keine Pause;
  ↑/↓ und −/+ zählen die Variante, `stepVariant`: `bd` → `bd:1` …, nicht unter `bd`), langes Drücken öffnet das Menü.
  Den Klang selbst wechselt man durch Tippen des Namens oder aus der Palette. Wie viele Varianten ein Name hat, wissen wir nicht; Strudel zählt im Kreis.
  Ohne Wiedergabe spielt Tippen (und ↑/↓) den Stein einmal an (`playback.preview`, wie langes Drücken in der Palette):
  Klänge direkt, auch die Variante (`superdough` mit `n`), Noten mit dem Klang der Spur (`superdough` mit `note`). Nicht bei Pausen, Werten und MIDI-Spuren. Der Klang kommt aus der Klangpalette (ohne Pause);
  Ziehen ersetzt oder fügt ein, Klammern ergeben
  Wechsel (`.s("<sine sawtooth>")`). Ohne Klangstein fehlt `.s()` und Strudel spielt `triangle`. Lautstärke und Orbit wie bei
  Klangspuren. Effektliste: nur Audio (keine `note`, kein MIDI). Klänge und Noten haben getrennte Steine: beim Wechsel zwischen
  Klang/MIDI, Noten und Sampler warten die anderen in `Track.parked` (je Inhalt). Reihen tragen einen Inhalt (`Lane.content`: Klänge, Noten, Werte),
  Ziehen und Paletten wirken nur zwischen gleichem Inhalt. `test:strudel` prüft die Zuordnung von Noten- und Klangsteinen.
  Bewusst nicht: Notenspuren an MIDI (`note().midi()`, MIDI-Spuren bleiben Klangsteine plus `.note()`).
- **Rechenarten für Noten** (`Track.noteOps`, Liste direkt unter der Notenpalette, vor `.s`). `add`, `sub`, `mul`, `div`:
  `npm run gen:effects` liest sie aus `@strudel/core/pattern.mjs` (Verknüpfungen mit `numeralArgs`, soweit dokumentiert) nach
  `NOTE_OPS`. Sie bedienen sich wie Effekte (Wertsteine, Suchfeld), stehen im Code aber **an der Mini-Notation**:
  `note("f d".add("<0 3>").div(2))`. Als Methode nach `note(…)` wirkten sie nicht auf die Noten (Strudel legt die Zahl dann
  in ein eigenes Feld `value`). Strudel rechnet mit MIDI-Zahlen (`c3` = 48); `test:strudel` prüft, dass `add` transponiert und
  die Wertsteine im richtigen Zyklus leuchten. Bei Klang- und MIDI-Spuren bleiben sie gespeichert, aber nicht im Code.
- **Sampler-Spuren** (`Track.type = 'sampler'`, vierte Art, im Menü der Spur und als «+ Sampler-Spur»; `domain/sampler.ts`).
  Oben eine feste Reihe für das Sample (`Track.sample`, Klangsteine aus der Palette, `<brk amen>` wechselt, Standard `brk`
  aus Strudels Drumkit), darunter die Art und die Wertsteine der Spur (`Track.tokens`, Inhalt `values`, bedient wie Effektwerte).
  Zwei Arten (`Track.samplerMode`): **slice** teilt das Sample in `Track.slices` gleich lange Abschnitte (1–64, Standard 8),
  die Steine sind Abschnittsnummern: `$x: s("brk").slice(8, "0 3 <1 2>")`; **scrub** nimmt Positionen 0–1:
  `$x: s("brk").scrub("0 .25")`. Beim Umschalten werden Zahlen umgerechnet (Abschnitt 2 von 8 = Position 0.25).
  Danach Effekte, Orbit und Lautstärke wie bei Klangspuren; die Sample-Funktionen (`chop`, `fit` …) bleiben auch dort wählbar.
  Ohne Sample oder ohne Wertsteine steht die Spur nicht im Code. Beschreibungen kommen aus Strudel (`SAMPLER_MODES` in
  `effects.generated.ts`), die Werte von slice sind die Abschnittsnummern. Rückweg aus Code: `.slice(n, "…")` direkt nach
  `s(…)` macht immer eine Sampler-Spur, `.scrub(…)` an dieser Stelle nur, wenn die Spur schon eine ist (sonst ist es ein
  Effekt der Klangspur, `codeToTrack(code, prefer)`). `test:strudel` prüft, dass slice die richtigen Abschnitte und scrub die
  richtigen Positionen spielt und Sample- wie Wertsteine leuchten. Klänge, Noten und Werte haben getrennte Steine:
  beim Wechsel der Art warten die anderen in `Track.parked`, je Inhalt.
  Offen: `splice` (wie slice, passt aber die Geschwindigkeit an den Schritt an), scrub mit Geschwindigkeit (`"0.8:1.5"`),
  ungleiche Abschnitte (`slice([0, .25, .5], …)`).
- **Ganzer Code ohne Labels:** Aufnahmen, Tempo, dann alle Spuren in einem `stack(…)`, eine Spur pro Zeile:
  `stack(\n  /* drums */ s("bd sd"),\n  /* Klangspur_1 */ s("hh*8").hush()\n)`. Ohne `$:` spielt Strudel den letzten
  Ausdruck, also den Stapel. So lässt sich derselbe Aufbau später als Part (`const verse = stack(…)`) in ein
  `arrange(…)` geben, ohne dass eine Spur ihr Label behält und daneben weiterspielt.
- **Spurnamen** (`Track.name`): als Kommentar vor der Spur (`/* drums */`). Strudel sieht ihn nicht, `codeToTrack` liest ihn
  wieder. Erlaubt sind Buchstaben, Ziffern und `_`, nicht am Ende (`trackName`), so kann ein Name den Kommentar nicht beenden.
  Fehlt der Kommentar oder bleibt das Namensfeld leer, bekommt die Spur den Namen ihrer Art mit der ersten freien Nummer
  (`defaultTrackName`: `Klangspur_1`, `Notenspur_1`, `MIDIspur_1`, `Samplerspur_1`). Neue Spuren heissen gleich so.
  Gleiche Namen stören Strudel nicht; für ein späteres Arrangement, das Spuren über Namen zusammenführt, müssten sie eindeutig sein.
- **Code pro Spur ist die ganze Zeile** (`syntax/from-code.ts`, `ui/TrackCode.svelte`): `/* name */ s("…").effekt(…)…`. Die Ansicht
  «Code» im Menü der Spur schaltet die Spur von Steinen auf diese Zeile um. Name, Stummschaltung, Klänge und Effekte ändern sich bei jedem gültigen
  Tastendruck; die Mini-Notation darin liest weiter Strudels Grammatik. Mehr JavaScript als diese Kette (andere Funktionen,
  Variablen, `n()`) wird als Fehler mit Stelle gemeldet, ebenso unbekannte Effektnamen.
- **Klangliste aus Strudels Quellen** (`npm run gen:sounds`, `scripts/strudel-sounds.mjs`, `domain/sounds.generated.ts`).
  Das Skript liest die Adressen der Sample-Listen aus dem Prebake von `@strudel/repl` und lädt sie (braucht Netz), dazu Synths,
  Rauschen und ZZFX aus dem Quelltext von superdough. Nur `user`, `one`, `bus`, `bytebeat` sind ausgefiltert (klingen allein nicht).
  Der Test prüft ohne Netz, dass Adressen und Synths zum installierten Strudel passen und jeder Klang der Palette bekannt ist.
  **Nicht geprüft wird der Inhalt der Listen auf GitHub** (sie hängen am `main`-Zweig und können sich ändern): dafür
  `npm run gen:sounds` erneut laufen lassen. Anlass: Die frühere Liste aus dem Gedächtnis (nach Tidals vollem Dirt-Samples-Ordner)
  enthielt 64 Namen, die Strudel nicht kennt (`juno`, `808`, `bass` …); Strudel lädt von Dirt-Samples nur 9 Ordner.
  Welche Quellen die Palette ohne Suche zeigt, ist eine Auswahl in `sounds.ts` (`SOUND_GROUPS`): uzu-Drumkit, Synths, Rauschen,
  Dirt-Samples und Piano, Mridangam, VCSL, ZZFX. Die 683 Drum-Machine-Klänge nur über die Suche.
  Offen: Drum Machines als Wahl (`.bank()`), Soundfonts (`gm_…`, melodisch, noch nicht erfasst), unbekannte Klangnamen markieren.
- **Szenen** (`domain/scene.ts`, `state/scenes.svelte.ts`, `ui/SceneDock.svelte`): feste Leiste unten. Es gibt immer
  mindestens eine Szene (am Anfang «Szene01» mit dem Startzustand) und genau eine ist gewählt (gelb umrandet). Eine Szene ist der
  ganze Zustand (alle Spuren samt Effekten und das Tempo, als Kopie). «+ Szene» kopiert den aktuellen Zustand in eine neue Szene
  gleich hinter der gewählten und wählt sie (Name «Szene02» …, gleich markiert). Antippen wählt eine Szene und lädt sie (ersetzt
  Spuren und Tempo, IDs bleiben). Auch ungültiger Code wird gespeichert, die Szene ist schlicht der Arbeitsstand.
  Unten rechts ein geteilter Knopf: links die Aktion, rechts (▾) die Wahl «Manuell» oder «Auto».
  «Auto» (Standard, `scenes.autoUpdate`): ein Effekt in `App.svelte` schreibt jede Änderung sofort in die gewählte
  Szene. «Manuell»: der Stein zeigt «geändert», «Übernehmen» schreibt hinein. Szene wählen oder «+ Szene» fragt dann
  nach (`SceneDock.svelte`): in die gewählte Szene übernehmen, nicht übernehmen (beim Wählen verworfen, die neue Szene
  bekommt sie trotzdem) oder abbrechen. Abweichung wird per JSON-Vergleich erkannt (`sameContent`). Die letzte Szene lässt sich nicht entfernen; fällt die
  gewählte weg, wird die Nachbarin geladen. Eigene Aufnahmen stecken nicht in der Szene, sie bleiben ohnehin in `sampleBank`.
  Offen: Persistenz (heute nur im Speicher, siehe Abschnitt 4, Punkt 4), Reihenfolge ändern, Bezug zu Undo/Redo (Punkt 3).
- **Arrangement** (`domain/arrangement.ts`, `state/arrangement.svelte.ts`, `ui/ArrangementRow.svelte`): Umschaltknopf (`aria-pressed`) unten links
  in der Szenen-Leiste (Standard aus). An: ganz unten eine Zeile mit Abschnitten wie eine Steinreihe: oben der Szenenstein,
  darunter der grüne `!`-Knopf für die Zyklen (`Knob.svelte`, derselbe Drehknopf wie `ModSlot`, Stufen `TIMES_VALUES`
  1–16, nicht ausschaltbar). Szenen werden aus der Leiste nach unten hineingezogen (`tokenGestures` mit Ziel
  `ARRANGEMENT_LANE`, ohne Arrangement kein Ziehen: Option `drags`), Abschnitte darin verschoben; Antippen öffnet wie bei den Steinen ein Icon-Menü
  darüber (Szene bearbeiten, entfernen; fest am Fenster, weil die Zeile scrollt), doppelt antippen wählt die Szene. Der Code (`toArrangedProgram`) deklariert jede Szene als `const <Name> = stack(…)` (leer:
  `silence`) und endet mit `arrange([4, Szene01], [2, Szene02])`, ohne Abschnitt mit `silence`. Variablennamen aus dem
  Szenennamen (`sceneVariables`: ungültige Zeichen zu `_`, eindeutig, JS-Wörter und wichtige Strudel-Namen wie `s` mit `_`).
  Die gewählte Szene geht mit dem aktuellen Stand hinein (auch nicht übernommene Änderungen), die anderen wie gespeichert
  (Klammerfehler je Reihe weggelassen wie bei der angezeigten, `codeTracksOf`). Nur die Steine der gewählten Szene leuchten,
  weil kopierte Szenen dieselben Stein-IDs tragen. Tempo: das der gewählten Szene für alle (Strudel hat ein globales Tempo).
  Der Schalter bestimmt nur, was Leiste und Code-Ansicht zeigen (`arrangement.codeFull`/`codeDisplay`). Was klingt, bestimmt
  `session.playMode`: Play oben spielt die gewählte Szene, ▶ vor der Arrangement-Zeile das Arrangement (`playback.toggleArrangement`).
  Die beiden schliessen sich aus. ▶ hält Strudel an und startet neu, damit `arrange()` bei Zyklus 0 und damit beim ersten
  Abschnitt beginnt; Play oben wechselt ohne Neustart auf die Szene. Ausschalten des Schalters während das Arrangement spielt
  wechselt auf die Szene. Aus `session.cycle` ergeben sich Fortschritt (Ring um ▶) und laufender Abschnitt (`positionAt`).
  Mit echtem Strudel geprüft (`npm run test:strudel`). Offen: Tempo je Szene, Persistenz. Annahme: `session.cycle` zählt ab dem Start (so im Engine-Code, im Browser ungeprüft).
- **Stapel mit Komma** (`SoundToken.joined`, `joinsPrevious` in `types.ts`): ein Klangstein mit `joined` hängt am Klangstein
  davor, beide klingen gleichzeitig. Aufeinanderfolgende verbundene Steine schreibt `codegen` als `[bd, hh*2, cp?]`; jeder Stein
  behält Zufall und Wiederholung. Dargestellt waagrecht ohne Abstand (Ecken innen eckig). Jeder Stein bleibt einzeln bedienbar
  (bearbeiten, ersetzen, entfernen, verschieben). Einfügen zwischen zwei Steinen eines Stapels legt in den Stapel (`insertAt`),
  vor dem ersten oder nach dem letzten daneben; Entfernen des ersten macht den nächsten zum ersten. Ein Klammerpaar fasst immer
  den ganzen Stapel (`wrapSpan`, `wrapAt`), ein neues Paar mitten im Stapel trennt ihn. Ein Komma direkt nach einer Klammer gilt
  nicht und wird beim nächsten Bearbeiten entfernt. Rückweg aus Text: `[a, b*2?]` mit je einem Klang pro Teil wird ein Stapel,
  alles andere mit Komma (`[a b, c]`, `[a, b]*2`, `<a, b>`) bleibt ein roher Stein. Ganze Stapel lassen sich nicht auf einmal
  verschieben, Steine im Editor fügen nicht durch Verweilen an (nur aus der Palette).
- **Bewusst weggelassen:** Euclid `(3,8)`, `,` zwischen Folgen (Polyphonie ganzer Folgen), Melodien mit `n()` (Melodien gehen über Notenspuren mit `note()`).

## 4. Offene Entscheidungen (für dich)

Jede mit Optionen. Keine Empfehlung festgelegt.

1. **Schnittstelle zur Kamera.** Wie kommt Erkennung in das Modell?
   a) Die Kamera liefert pro Bild eine komplette Spur und ersetzt `track.tokens` (GUI währenddessen nur lesend).
   b) Die Kamera erzeugt Bearbeitungsoperationen (`edit.ts`), das GUI bleibt gleichberechtigt.
   c) Eine `TokenSource`-Abstraktion mit Zusammenführungsregel.
   Dazu: Marker-ID oder je Würfelseite? Zeilen auf dem Tisch zu Spuren? Glättung über mehrere Bilder?
   Wem gehören Token-IDs (Marker-ID oder erzeugt)? Der Drehwinkel liefert die Raststufen (`indexForAngle`).
2. **Strudel-Anbindung.** Einzige Engine ist entschieden. Offen: Das Prebake aus `@strudel/repl` zieht auch CodeMirror, Hydra,
   MIDI und Soundfonts nach (die erste Wiedergabe lädt rund 1,5 MB, gzip rund 365 kB mehr als nötig). Alternativen: eigenes
   schlankes Prebake mit einem Test, der es gegen das Paket abgleicht, oder die Strudel-Website per iframe einbetten
   (garantiert gleicher Klang, aber kein Aufleuchten und kein Abspielkopf). Weiter offen: Offline-Betrieb (Samples selbst
   hosten), Hervorhebung bei sehr schnellen Mustern, AGPL.
   Hinweis: `@strudel/repl` entspricht der Website vermutlich, ist aber nicht dieselbe Datei wie das Prebake der Website.
3. **Zustandsverwaltung.** Singleton-Klassen mit Runes (jetzt), Svelte-Kontext, oder anderes? Undo/Redo?
   Mehrere Projekte?
4. **Persistenz und Teilen.** URL-Hash, localStorage, IndexedDB für Aufnahmen, Export/Import als Datei.
   Versionierung des Formats. IDs bei Persistenz (heute einfache Zähler, `types.ts`).
5. **Umfang der Notation.** Euclid, `,` zwischen Folgen (Stapel einzelner Klänge sind drin), `bd:3`, `n()` mit Skalen, Zahlen als eigene Steine. Effekte pro Spur sind drin (Abschnitt 3).
6. **Text zu Steinen und Parser.** Jetzt: eigener Parser für Fehlerstelle und Gruppentiefe, Strudels Grammatik als Schiedsrichter.
   Ein vollständiger Wechsel auf Strudels Syntaxbaum wäre möglich (die Grammatik liefert Positionen), ersetzt aber vor allem
   den kleinen eigenen Parser und verlangt, Gruppentiefe und Fehlerstelle aus dem Baum abzuleiten. Die Rückrichtung
   (Text zu Steinen) ist entschieden und nutzt bereits Strudels Syntaxbaum (siehe Abschnitt 3).
   Weiter offen: ein am Stein ausgerichteter Abspielkopf. Dafür brauchte es die Zeitspanne jedes Steins im Zyklus. Sie lässt
   sich aus den Ereignissen von Strudel (`hap.whole`) oder aus dem Baum ableiten.
7. **Layout.** Ganzer Bildschirm mit fester Leiste ist entschieden (Abschnitt 3). Offen: Umbruch der Steine (jetzt) oder vertikal, vor allem auf dem Handy. Tastatur- und Screenreader-Bedienung.
8. **Fehlerverhalten.** Spur mit Klammerfehler bleibt stumm (jetzt). Alternativen: gültigen Teil spielen,
   Klammern automatisch ergänzen.
9. **Build und Hosting.** Statisch, https wegen Mikrofon, PWA/offline, Lizenzfrage (AGPL) und SRF-Veröffentlichung.
10. **Tests.** Domäne ist abgedeckt. UI-Tests, E2E (z. B. Playwright), Kamera-Tests mit aufgezeichneten Bildern, CI.
11. **Sprache.** Deutsche Texte stehen fest im Code (`ui/messages.ts`, Komponenten). i18n ja oder nein.

## 5. Bekannte Lücken und ungeprüfte Annahmen

- **Nie im Browser getestet.** Gebaut, typgeprüft, Domäne und Text-Umwandlung mit 17 Unit-Tests, die Strudel-Zuordnung und der Parser-Abgleich mit
  einem eigenen Skript geprüft, Dev-Server liefert die App aus. Gesten (Zeiger, Doppeltippen), Audio, Sample-Laden und Mikrofon sind
  nicht durch Tests abgedeckt, besonders auf iOS/Safari. Ob die App wirklich genauso klingt wie strudel.cc, ist
  nicht geprüft. Vergleich: in beiden Konsolen `Object.keys(soundMap.get()).length` und `soundMap.get().bd?.data`.
- **Zuordnung Strudel-Ereignis zu Stein ist mit echtem Strudel geprüft** (`npm run test:strudel`, läuft ohne Browser und
  ohne Samples): 68 Ereignisse über vier Zyklen mit `*`, `!`, `@`, `[ ]`, `< >`, `{ }%4` und Namen mit Ziffern wurden korrekt zugeordnet.
  Nicht geprüft ist das zeitliche Aufleuchten im Browser, ebenso `scheduler.now()` für den Abspielkopf (aus dem Quelltext
  von `@strudel/core` übernommen, nicht ausgeführt).
- **Eingebettete Aufnahmen in Strudel unverifiziert.** `samples({ name: 'data:audio/wav;base64,…' })` sollte
  funktionieren, wurde aber nicht getestet. Lange Codes passen nicht mehr in den `strudel.cc`-Link.
- **Mikrofon in eingebetteten Seiten** kann gesperrt sein. Hier wirkt als Ersatz «Datei laden».
- **Strudel-Start:** Das Laden (Repl und Prebake) muss abgewartet werden, bevor `evaluate` funktioniert (so umgesetzt). Schlägt das Laden
  der Klangquellen fehl, startet Strudel trotzdem und die Seite nennt den Fehler.
- **Aufnahme:** Das Mikrofon gibt es nur über https oder localhost; über eine Netzwerkadresse (`http://192.168…`) meldet die App
  das jetzt ausdrücklich. Aufnahmeformat wird gewählt (webm/opus, sonst mp4 für Safari), Dekodieren mit Rückfall auf einen
  AudioContext. Im Browser ungeprüft; Fehler stehen mit der Meldung des Browsers in der Konsole (`Aufnahme`).

## 6. Semantik-Referenz (so versteht Strudel den erzeugten Code)

| Notation | Bedeutung |
|---|---|
| `a b c` | gleich lange Schritte |
| `a*2` | im Schritt doppelt so schnell |
| `a*0.5` | über zwei Zyklen gestreckt |
| `a!2` | zwei Schritte, jeder mit `a` |
| `[a b]` | Gruppe teilt sich einen Schritt |
| `<a b>` | pro Zyklus ein Element |
| `{a b c}%4` | Polymeter: die Folge läuft mit 4 Schritten pro Zyklus weiter (ohne `%` wie `[a b c]`) |
| `a@3` | Schritt hat dreifaches Gewicht (länger als die anderen), `a@0.5` halb so lang |
| `a?0.3` | fällt mit 30 % Wahrscheinlichkeit aus (`?` allein = 50 %), Strudel nutzt dafür ein festes Zufallsmuster |
| `~` | Pause |
