<script lang="ts">
  import { session } from '../state/session.svelte.ts';

  let dialog = $state<HTMLDialogElement>();

  $effect(() => {
    if (!dialog) return;
    if (session.help && !dialog.open) dialog.showModal();
    else if (!session.help && dialog.open) dialog.close();
  });

  const close = () => (session.help = false);
</script>

<dialog
  bind:this={dialog}
  aria-labelledby="help-title"
  onclose={close}
  onclick={(e) => {
    if (e.target === dialog) close();
  }}
>
  <div class="box">
    <h2 id="help-title">So funktioniert’s</h2>
    <p class="sub">Leg Steine hintereinander, genau wie du den Code schreiben würdest.</p>
    <dl>
      <dt>Unten</dt>
      <dd>
        Die Zeile unter den Steinen lässt sich seitwärts scrollen. Einen Stein daraus nach oben in eine Spur ziehen, oder antippen,
        dann kommt er ans Ende. Über der Mitte eines Klangsteins losgelassen, ersetzt ein Klang ihn (blau umrandet);
        am Rand wird davor oder danach eingefügt (blauer Strich).
        Vorne: <code>●</code> aufnehmen (bis 3 Sekunden), Datei laden, eigene Klänge.
      </dd>
      <dt>Tippen</dt>
      <dd>
        Ohne Wiedergabe spielt der Stein dabei einmal an (Noten mit dem Klang ihrer Spur).
        Auf einem Klangstein: den Namen eintippen, ↑/↓ oder −/+ wechseln zum Nachbarn aus der Palette.
        Darüber ein Menü: Mülleimer entfernt. Langes Drücken öffnet nur das Menü.
        Bei Klammern: Paar auflösen oder die Klammerart wählen.
      </dd>
      <dt>Ziehen</dt>
      <dd>Stein an eine andere Stelle schieben, auch in eine andere Spur.</dd>
      <dt>Oben / Unten</dt>
      <dd>Rot = Zufall. Blau = Stern, Grün = Ausrufezeichen, Orange = Gewicht. Drehen stellt die Zahl ein.</dd>
      <dt>Effekte</dt>
      <dd>
        Unter den Steinen einen Effekt suchen (z. B. <code>lpf</code>, <code>room</code>, <code>delay</code>). Er bekommt eine
        eigene Reihe aus hellen Wertsteinen. Tippen auf einen Wert öffnet ihn zum Tippen; ↑/↓ oder −/+ springen zum nächsten
        Wert aus Strudels Beispielen. Lange drücken öffnet den Dialog mit Klammern (für Muster wie <code>&lt;200 800&gt;</code>),
        Einfügen und Entfernen. Ziehen, Zufall und Wiederholung wirken wie bei Klängen. Ohne Wertsteine ist der Effekt aus.
      </dd>
      <dt>Links</dt>
      <dd>
        Der Pfeil vor dem Namen klappt die Spur zur Kompaktansicht ein und wieder aus. Der Regler darunter ist die Lautstärke
        der Spur (im Code <code>.postgain()</code>, Doppelklick = 100 %). <code>M</code> schaltet stumm (im Code <code>_$</code>).
      </dd>
      <dt>Name</dt>
      <dd>Oben links in der Spur. Er steht im Code nach dem <code>$</code>, z. B. <code>$drums:</code>.</dd>
      <dt>Code</dt>
      <dd>
        «UI | Code» in einer Spur zeigt statt der Steine ihre ganze Codezeile mit Name, Effekten und Lautstärke. Was du dort tippst, wird sofort zu Steinen.
        Unbekannte Mini-Notation wird ein dunkler Stein mit dem Text. Oben unter «Code» steht das ganze Programm, mit Link zu Strudel.
      </dd>
      <dt>Snapshots</dt>
      <dd>
        In der Leiste ganz unten hält «+ Snapshot» den ganzen Code fest (alle Spuren und das Tempo), solange er gültig ist.
        Es entsteht ein grosser Stein: oben den Namen antippen und ändern, darunter antippen lädt den Zustand wieder.
        Der geladene Snapshot ist gelb umrandet. Snapshots sind nur im Speicher und beim Neuladen der Seite weg.
      </dd>
    </dl>
    <button class="wide" onclick={close}>Schliessen</button>
  </div>
</dialog>

<style>
  dialog {
    width: min(560px, calc(100% - 32px));
    max-height: 85%;
    padding: 0;
    border: none;
    border-radius: 14px;
    background: var(--panel);
    color: var(--ink);
  }
  dialog::backdrop {
    background: rgba(0, 0, 0, 0.45);
  }
  .box {
    padding: 18px 18px 16px;
  }
  h2 {
    font-size: 18px;
    margin: 0 0 2px;
  }
  .sub {
    color: var(--mute);
    font-size: 14px;
    margin: 0 0 14px;
  }
  dl {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 6px 12px;
    font-size: 14px;
    margin: 0 0 16px;
  }
  dt {
    font-weight: 600;
  }
  dd {
    margin: 0;
    color: var(--mute);
  }
  .wide {
    width: 100%;
  }
</style>
