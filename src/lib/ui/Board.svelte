<script lang="ts">
  import { untrack } from "svelte";
  import type { Attachment } from "svelte/attachments";
  import { MIN_WIDTH, PAD, dotsFor, gapFor, magnet, pxFor } from "../domain/board.ts";
  import type { Rect, Side } from "../domain/board.ts";
  import type { TrackType } from "../domain/types.ts";
  import { boardDrag } from "../interaction/board-drag.ts";
  import { board } from "../state/board.svelte.ts";
  import { project } from "../state/project.svelte.ts";
  import type { PaletteItem } from "../state/project.svelte.ts";
  import TrackView from "./TrackView.svelte";

  /**
   * Arbeitsfläche: Spuren als abgerundete Rechtecke auf einem unendlichen Punkteraster. Statt zu scrollen zeigt
   * eine Kamera (Verschiebung und Verkleinerung per `transform`) einen Ausschnitt:
   * beim Bearbeiten 1:1 bei der gewählten Spur (`cam`), in der Übersicht passt alles hinein. Zwischen beiden gleitet sie.
   * Antippen in der Übersicht wählt eine Spur und rückt sie in den Blick.
   * Eine Spur ist immer so hoch wie ihr Inhalt (in sich scrollt sie nie); wächst die gewählte über den unteren Rand hinaus,
   * gleitet die Kamera, bis ihr oberer Rand oben steht.
   * In der Übersicht legt das Plus an jeder der vier Seiten eine neue Spur an: es gleitet in die Mitte, dann erscheint die
   * Wahl der Art. Danach tippt man einen Punkt als obere linke Ecke an und zieht nach unten die Höhe auf (Breite fest).
   * Ein Klang aus der Palette, auf freie Fläche gezogen, zeigt gleich die neue Spur unter dem Zeiger (obere linke Ecke);
   * beim Loslassen erscheint dort die Wahl der Art, die Spur beginnt dann mit dem Klang.
   */

  /** Abstand der Übersicht zum Rand, Platz für die Plus-Knöpfe. */
  const OVERVIEW_PAD = 56;
  /** Freie Punkte rund um alle Spuren, die die Übersicht beim Aufziehen einer neuen Spur zusätzlich zeigt. */
  const PLACE_ROOM = 2;
  /** Abstand der Plus-Knöpfe (Mitte) vom Rand aller Spuren. */
  const PLUS_OFF = 26;
  /** Abstand einer hohen, gewählten Spur zum oberen und unteren Bildschirmrand. */
  const EDGE = 12;
  /** Dauer des Gleitens zwischen Übersicht und Spur und wenn ein Plus in die Mitte rückt (wie `--glide` im Stil). */
  const GLIDE_MS = 250;
  /** Stillstand des Mausrads, nach dem die Kamera auf ganze Punkte einrastet, und wie lange sie dorthin gleitet (auch nach dem Wischen). */
  const SNAP_MS = 80;
  const SNAP_GLIDE_MS = 150;

  const TYPES: { type: TrackType; label: string }[] = [
    { type: "sound", label: "Klang" },
    { type: "note", label: "Noten" },
    { type: "midi", label: "MIDI" },
    { type: "sampler", label: "Sampler" },
  ];
  const SIDES: { side: Side; label: string }[] = [
    { side: "top", label: "oben" },
    { side: "right", label: "rechts" },
    { side: "bottom", label: "unten" },
    { side: "left", label: "links" },
  ];

  // Gleich die echte Breite: ein Platzhalter änderte nach dem ersten Fokussieren den Abstand der Punkte
  let innerWidth = $state(window.innerWidth);
  let vw = $state(0);
  let vh = $state(0);
  let boardEl = $state<HTMLElement>();
  const gap = $derived(gapFor(innerWidth));

  const ids = $derived(project.tracks.map((t) => t.id));
  $effect.pre(() => {
    const list = ids;
    untrack(() => board.sync(list));
  });

  /** Ohne Spuren ein gedachtes Rechteck am Ursprung, damit die Plus-Knöpfe einen Platz haben. */
  const box = $derived(board.box ?? { x: 0, y: 0, w: MIN_WIDTH, h: 1 });

  /** Linke bzw. obere Kante eines Rechtecks ab Punkt `x` bzw. `y`, in Pixeln der Fläche (Punkt 0 bei `0.5 * gap`). */
  const left = (x: number) => (x + 0.5 - PAD) * gap;
  const top = (y: number) => (y + 0.5 - PAD) * gap;

  /**
   * Kamera beim Bearbeiten: welcher Punkt der Fläche oben links am Bildschirm steht, in Punkten (nicht Pixeln),
   * so bleibt der Ausschnitt, wenn sich der Abstand der Punkte mit der Fensterbreite ändert.
   */
  let cam = $state({ x: 0, y: 0 });

  /** Verschiebung der Übersicht, damit das angetippte Plus in der Mitte steht. */
  let pan = $state({ x: 0, y: 0 });
  /** Übersicht gleitet gerade (Plus in die Mitte und zurück). */
  let glide = $state(false);
  /** Dauer des laufenden Gleitens (Einrasten nach dem Scrollen ist kürzer). */
  let glideMs = $state(GLIDE_MS);

  /** Verkleinerung und Lage der Fläche: 1:1 beim Bearbeiten, in der Übersicht passt alles mit Rand hinein. */
  const view = $derived.by(() => {
    // Ganze Pixel, sonst wird Text unscharf
    if (!board.overview) return { s: 1, tx: Math.round(-cam.x * gap), ty: Math.round(-cam.y * gap) };
    // Beim Aufziehen mit Platz rundum, damit man auch neben und unter den Spuren ansetzen kann
    const room = placing ? PLACE_ROOM : 0;
    const fit = { x: box.x - room, y: box.y - room, w: box.w + 2 * room, h: box.h + 2 * room };
    const bw = pxFor(fit.w, gap);
    const bh = pxFor(fit.h, gap);
    const s = Math.max(0.05, Math.min(
      1,
      (vw - 2 * OVERVIEW_PAD) / bw,
      (vh - 2 * OVERVIEW_PAD) / bh,
    ));
    return {
      s,
      tx: (vw - bw * s) / 2 - left(fit.x) * s + pan.x,
      ty: (vh - bh * s) / 2 - top(fit.y) * s + pan.y,
    };
  });

  /** Plus-Knöpfe in der Mitte jeder Seite, in Pixeln der (nicht verkleinerten) Fläche bzw. des Bildschirms. */
  const plus = $derived.by(() => {
    const { s, tx, ty } = view;
    const l = tx + left(box.x) * s;
    const t = ty + top(box.y) * s;
    const r = l + pxFor(box.w, gap) * s;
    const b = t + pxFor(box.h, gap) * s;
    return {
      top: { x: (l + r) / 2, y: t - PLUS_OFF },
      right: { x: r + PLUS_OFF, y: (t + b) / 2 },
      bottom: { x: (l + r) / 2, y: b + PLUS_OFF },
      left: { x: l - PLUS_OFF, y: (t + b) / 2 },
    };
  });

  /**
   * Rückt ein Rechteck in den Blick: sein oberer Rand steht oben (mit `EDGE` Abstand). Waagrecht steht es in der Mitte;
   * ist es breiter als der Bildschirm, stehen seine ersten `MIN_WIDTH` Punkte in der Mitte (Handy).
   * Ist die gewählte Spur höher als der Bildschirm, scrollt sie in sich.
   */
  function show(r: Rect) {
    const w = pxFor(r.w, gap);
    const shownW = w <= vw ? w : pxFor(MIN_WIDTH, gap);
    cam = {
      x: (left(r.x) - (vw - shownW) / 2) / gap,
      y: (top(r.y) - EDGE) / gap,
    };
  }

  /** Übersicht ein oder aus. Zurück steht wieder derselbe Ausschnitt da (`cam` bleibt). */
  function toggleOverview() {
    closeMenu();
    stopPlacing();
    glideThen();
    board.overview = !board.overview;
  }

  /** Spur wählen: die Übersicht schliesst sich und die Kamera gleitet zur Spur. */
  function select(id: string) {
    const r = board.rects[id];
    board.selected = id;
    glideThen();
    board.overview = false;
    if (r) show(r);
  }

  // Zu Beginn die erste Spur (oben links) wählen und in den Blick, sobald die Fläche ihre Grösse kennt
  let started = false;
  $effect(() => {
    if (started || !vw || !vh || !board.box) return;
    started = true;
    untrack(() => {
      const first = Object.entries(board.rects).sort(([, a], [, b]) => a.y - b.y || a.x - b.x)[0];
      board.selected ??= first[0];
      show(board.rects[board.selected] ?? first[1]);
    });
  });

  /**
   * Holt der Browser ein fokussiertes Feld selbst in den Blick, scrollt er die Fläche trotz `overflow: hidden`.
   * Das wird in die Kamera übernommen, damit Scrollen und Verschiebung nicht doppelt wirken.
   */
  function onscroll(e: Event) {
    const el = e.currentTarget as HTMLElement;
    if (!el.scrollLeft && !el.scrollTop) return;
    if (!board.overview) cam = { x: cam.x + el.scrollLeft / gap, y: cam.y + el.scrollTop / gap };
    el.scrollLeft = 0;
    el.scrollTop = 0;
  }

  /**
   * Freies Verschieben der Kamera (Mausrad, Trackpad, Wischen) in x und y, ohne Scrollleisten.
   * Die Kamera bleibt so, dass von den Spuren immer etwas zu sehen ist (mindestens zwei Punkte).
   * Schon beim Verschieben zieht das Raster an (`magnet`): gezählt wird die tatsächliche Lage (`raw`), gezeigt die angezogene.
   * Danach gleitet sie auf ganze Punkte (`snap`).
   *
   * `raw`: tatsächliche Lage in Punkten, solange verschoben wird; sonst gilt `cam`.
   */
  let raw: { x: number; y: number } | null = null;
  let snapTimer = 0;

  /** Lage der Kamera in Pixeln zu Beginn einer Bewegung. */
  const camPx = () => {
    const from = raw ?? cam;
    return { x: from.x * gap, y: from.y * gap };
  };

  /**
   * Versatz des Einrastrasters in Punkten (0 bis 1): so steht eine Spur von `MIN_WIDTH` Punkten nach dem Einrasten
   * waagrecht genau in der Mitte und ihr oberer Rand `EDGE` unter dem oberen, wie nach `show`. Ganze Punkte allein passen
   * nur bei manchen Bildschirmbreiten (bei 393 px stünde die Spur 12 px links und 5 px rechts vom Rand).
   */
  const snapOffset = $derived.by(() => {
    const frac = (v: number) => v - Math.floor(v);
    return {
      x: frac((left(0) - (vw - pxFor(MIN_WIDTH, gap)) / 2) / gap),
      y: frac((top(0) - EDGE) / gap),
    };
  });

  /** Kamera nach (Pixel) `x`, `y`, begrenzt auf den Umriss der Spuren, mit Magnet. Unterbricht laufendes Gleiten. */
  function panTo(x: number, y: number) {
    clearTimeout(glideTimer);
    clearTimeout(snapTimer);
    glide = false;
    const keep = 2 * gap;
    const cx = Math.min(Math.max(x, left(box.x) + keep - vw), left(box.x) + pxFor(box.w, gap) - keep);
    const cy = Math.min(Math.max(y, top(box.y) + keep - vh), top(box.y) + pxFor(box.h, gap) - keep);
    raw = { x: cx / gap, y: cy / gap };
    const o = snapOffset;
    cam = { x: magnet(raw.x - o.x) + o.x, y: magnet(raw.y - o.y) + o.y };
  }

  /** Auf ganze Punkte einrasten (gleitet kurz). */
  function snap() {
    clearTimeout(snapTimer);
    if (!raw) return;
    glideThen(undefined, SNAP_GLIDE_MS);
    const o = snapOffset;
    cam = { x: Math.round(raw.x - o.x) + o.x, y: Math.round(raw.y - o.y) + o.y };
    raw = null;
  }

  /**
   * Mausrad und Trackpad (Touch löst kein `wheel` aus). Steht das Rad `SNAP_MS` still (auch nach dem Nachlaufen des
   * Trackpads), rastet die Kamera ein.
   */
  const wheel: Attachment<HTMLElement> = (el) => {
    const onWheel = (e: WheelEvent) => {
      if (board.overview || e.ctrlKey) return;
      e.preventDefault();
      // Zeilen oder Seiten (Firefox, manche Mäuse) in Pixel umrechnen
      const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? vh : 1;
      // Shift + Rad scrollt waagrecht, wenn die Maus nur ein senkrechtes Rad hat
      const dx = (e.shiftKey && !e.deltaX ? e.deltaY : e.deltaX) * unit;
      const dy = (e.shiftKey && !e.deltaX ? 0 : e.deltaY) * unit;
      const from = camPx();
      panTo(from.x + dx, from.y + dy);
      snapTimer = window.setTimeout(snap, SNAP_MS);
    };
    // Nicht passiv, sonst wirkt `preventDefault` nicht (und der Browser blättert z. B. mit zwei Fingern zurück)
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      el.removeEventListener("wheel", onWheel);
      clearTimeout(snapTimer);
    };
  };

  /** Ab so vielen Pixeln wird aus dem Berühren ein Wischen. */
  const PAN_THRESHOLD = 8;

  /**
   * Touch: Wischen verschiebt die Kamera frei in x und y, wie das Mausrad, und rastet beim Loslassen ein.
   * Elemente mit eigener Geste (`touch-action: none`: Steine, Drehknöpfe, Griffe) und Eingabefelder behalten ihre Geste.
   */
  const touchPan: Attachment<HTMLElement> = (el) => {
    let id: number | null = null;
    let sx = 0;
    let sy = 0;
    let from = { x: 0, y: 0 };
    let panning = false;

    /** Hat das Element zwischen Ziel und Fläche eine eigene Geste? */
    const ownGesture = (target: Element): boolean => {
      if (target.closest("input, textarea, select")) return true;
      for (let n: Element | null = target; n && n !== el; n = n.parentElement)
        if (getComputedStyle(n).touchAction === "none") return true;
      return false;
    };

    const stop = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      id = null;
    };
    const onMove = (e: PointerEvent) => {
      if (e.pointerId !== id) return;
      const dx = e.clientX - sx;
      const dy = e.clientY - sy;
      if (!panning && Math.hypot(dx, dy) < PAN_THRESHOLD) return;
      panning = true;
      panTo(from.x - dx, from.y - dy);
    };
    const onUp = (e: PointerEvent) => {
      if (e.pointerId !== id) return;
      stop();
      if (panning) snap();
      panning = false;
    };
    const onDown = (e: PointerEvent) => {
      if (e.pointerType !== "touch" || id !== null || board.overview) return;
      if (ownGesture(e.target as Element)) return;
      id = e.pointerId;
      sx = e.clientX;
      sy = e.clientY;
      from = camPx();
      panning = false;
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", onUp);
    };

    el.addEventListener("pointerdown", onDown);
    return () => {
      el.removeEventListener("pointerdown", onDown);
      stop();
    };
  };

  /** Seite, an der gerade die Art der neuen Spur gewählt wird. */
  let adding = $state<Side | null>(null);
  /** Die Wahl der Art erscheint erst, wenn das Plus in der Mitte angekommen ist. */
  let menuOpen = $state(false);
  let addMenu = $state<HTMLElement>();
  let glideTimer = 0;
  /** Art gewählt: jetzt wird die neue Spur aufgezogen (Punkt antippen, nach unten ziehen). */
  let placing = $state<TrackType | null>(null);
  /** Obere linke Ecke und Höhe der neuen Spur: beim Drücken bzw. Ziehen (`pull`) oder unter der Maus (`hover`). */
  let pull = $state<{ x: number; y: number; h: number } | null>(null);
  let hover = $state<{ x: number; y: number } | null>(null);

  /** Gleiten ein- und nach `GLIDE_MS` wieder ausschalten, dann `done`. */
  function glideThen(done?: () => void, ms = GLIDE_MS) {
    glide = true;
    glideMs = ms;
    clearTimeout(glideTimer);
    glideTimer = window.setTimeout(() => {
      glide = false;
      done?.();
    }, ms);
  }

  /** Plus angetippt: die Übersicht gleitet, bis es in der Mitte steht, dann erscheint die Wahl der Art. */
  function openAdd(side: Side) {
    if (adding === side) return closeAdd();
    const p = plus[side];
    pan = { x: pan.x + vw / 2 - p.x, y: pan.y + vh / 2 - p.y };
    adding = side;
    menuOpen = false;
    glideThen(() => (menuOpen = true));
  }

  /** Wahl schliessen, die Übersicht gleitet zurück. */
  function closeAdd() {
    if (!adding) return;
    adding = null;
    menuOpen = false;
    pan = { x: 0, y: 0 };
    glideThen();
  }

  /** Wahl der Art schliessen, ob vom Plus oder für einen Klang aus der Palette. */
  function closeMenu() {
    closeAdd();
    arriving = null;
  }

  $effect(() => {
    if (!adding && !arriving) return;
    const onDown = (e: PointerEvent) => {
      // Das Plus selbst schaltet beim Klick um
      const t = e.target as Element;
      if (!addMenu?.contains(t) && !t.closest?.(".plus")) closeMenu();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeMenu();
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  });

  /** Klang aus der Palette auf freier Fläche losgelassen: hier entsteht die neue Spur, sobald ihre Art gewählt ist. */
  let arriving = $state<{ x: number; y: number; item: PaletteItem } | null>(null);

  // Losgelassen: auf freier Fläche erscheint die Wahl der Art, sonst passiert nichts
  $effect(() => {
    const l = board.landed;
    if (!l) return;
    untrack(() => {
      board.landed = null;
      const at = freeDot(l.x, l.y);
      if (!at) return;
      closeAdd();
      stopPlacing();
      arriving = { ...at, item: l.item };
    });
  });

  /** Wo die Wahl der Art steht: unter dem Plus in der Mitte bzw. unter der Mitte der neuen Spur aus der Palette. */
  const menuAt = $derived.by(() => {
    if (arriving) {
      const { s, tx, ty } = view;
      return {
        x: tx + (left(arriving.x) + pxFor(MIN_WIDTH, gap) / 2) * s,
        y: ty + (top(arriving.y) + pxFor(1, gap)) * s,
      };
    }
    return adding && menuOpen && board.overview ? plus[adding] : null;
  });

  /** Art gewählt: mit einem Klang aus der Palette steht die Spur gleich da, sonst wird sie auf dem Raster aufgezogen. */
  function choose(type: TrackType) {
    if (arriving) {
      const id = board.add(type, arriving.x, arriving.y, 1, arriving.item);
      arriving = null;
      select(id);
      return;
    }
    closeAdd();
    placing = type;
  }

  function stopPlacing() {
    placing = null;
    pull = null;
    hover = null;
  }

  // Escape bricht das Aufziehen ab
  $effect(() => {
    if (!placing) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") stopPlacing();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  });

  /** Nächster Punkt unter einem Bildschirmpunkt (Mitte der Punkte bei `(x + 0.5) * gap`). */
  function dotAt(cx: number, cy: number): { x: number; y: number } {
    const b = boardEl!.getBoundingClientRect();
    return {
      x: Math.round((cx - b.left - view.tx) / view.s / gap - 0.5),
      y: Math.round((cy - b.top - view.ty) / view.s / gap - 0.5),
    };
  }

  /** Punkt unter einem Bildschirmpunkt, wenn dort freie Fläche ist (keine Spur, kein Knopf, kein Menü), sonst null. */
  function freeDot(cx: number, cy: number): { x: number; y: number } | null {
    const el = document.elementFromPoint(cx, cy);
    if (!el || !boardEl?.contains(el) || el.closest(".cell, button, .addmenu, .placer")) return null;
    return dotAt(cx, cy);
  }

  /** Klang aus der Palette über freier Fläche: Punkt, an dem die neue Spur entstünde. */
  const aimDot = $derived(board.aim && !arriving ? freeDot(board.aim.x, board.aim.y) : null);

  function placeDown(e: PointerEvent) {
    if (e.button !== 0) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    pull = { ...dotAt(e.clientX, e.clientY), h: 1 };
  }

  /** Mit gedrücktem Zeiger nur nach unten: die Höhe reicht bis zur Reihe unter dem Zeiger. */
  function placeMove(e: PointerEvent) {
    const at = dotAt(e.clientX, e.clientY);
    if (pull) pull = { ...pull, h: Math.max(1, at.y - pull.y + 1) };
    else hover = at;
  }

  function placeUp() {
    if (!placing || !pull) return;
    const id = board.add(placing, pull.x, pull.y, pull.h);
    stopPlacing();
    select(id);
  }

  /** Vorschau der neuen Spur, gestrichelt (beim Aufziehen oder für einen Klang aus der Palette). */
  const preview = $derived.by(() => {
    if (placing) return pull ?? (hover && { ...hover, h: 1 });
    const at = arriving ?? aimDot;
    return at && { x: at.x, y: at.y, h: 1 };
  });

  /** Laufendes Ziehen: Verschieben (Griff, in der Übersicht die ganze Spur) oder Verbreitern (Ecke). */
  let drag = $state<{
    id: string;
    kind: "move" | "resize";
    dx: number;
    dy: number;
  } | null>(null);

  /** Ganze Punkte für eine Verschiebung in Bildschirmpixeln. */
  const dots = (px: number) => Math.round(px / view.s / gap);

  const dragMove = (id: string, onTap?: () => void) =>
    boardDrag(() => ({
      onMove: (dx, dy) => (drag = { id, kind: "move", dx, dy }),
      onDrop: (dx, dy) => {
        const r = board.rects[id];
        drag = null;
        if (r) board.move(id, r.x + dots(dx), r.y + dots(dy));
      },
      onCancel: () => (drag = null),
      onTap,
    }));

  const dragResize = (id: string) =>
    boardDrag(() => ({
      onMove: (dx, dy) => (drag = { id, kind: "resize", dx, dy }),
      onDrop: (dx) => {
        const r = board.rects[id];
        drag = null;
        if (r) board.resize(id, r.w + dots(dx));
      },
      onCancel: () => (drag = null),
    }));

  /** Rechteck, wie es gerade gezeigt wird (beim Verbreitern schon mit neuer Breite). */
  const shape = (id: string, r: Rect): Rect =>
    drag?.id === id && drag.kind === "resize"
      ? { ...r, w: Math.max(MIN_WIDTH, r.w + dots(drag.dx)) }
      : r;

  /** Ziel beim Verschieben, als gestrichelter Rahmen. */
  const target = $derived.by(() => {
    if (drag?.kind !== "move") return null;
    const r = board.rects[drag.id];
    return r ? { ...r, x: r.x + dots(drag.dx), y: r.y + dots(drag.dy) } : null;
  });

  // Wächst die gewählte Spur über den Platz bis zum unteren Rand hinaus, gleitet die Kamera, bis ihr oberer Rand oben steht.
  // Nur beim Wachsen, nicht beim Scrollen: sonst zöge sie zurück, wenn man die Spur am Desktop selbst nach unten schiebt.
  let grownH: { id: string; h: number } | null = null;
  $effect(() => {
    const id = board.selected;
    const r = id ? board.rects[id] : undefined;
    if (!id || !r || board.overview) return;
    const before = grownH?.id === id ? grownH.h : r.h;
    grownH = { id, h: r.h };
    if (r.h <= before) return;
    untrack(() => {
      const onScreen = view.ty + top(r.y);
      if (onScreen + pxFor(r.h, gap) > vh - EDGE && onScreen > EDGE + 1) {
        glideThen();
        show(r);
      }
    });
  });

  /** Antippen oder Bearbeiten einer Spur wählt sie (nur beim Bearbeiten, in der Übersicht wählt `select`). */
  function pick(id: string) {
    if (!board.overview && board.selected !== id) board.selected = id;
  }

  /** Meldet, wie viele Punkte der Inhalt einer Spur hoch ist. */
  const measure =
    (id: string): Attachment<HTMLElement> =>
    (el) => {
      const observer = new ResizeObserver(() =>
        board.measured(id, dotsFor(el.offsetHeight, gap)),
      );
      observer.observe(el);
      return () => observer.disconnect();
    };
</script>

<svelte:window bind:innerWidth />

<div
  class="board"
  class:overview={board.overview}
  class:glide
  bind:clientWidth={vw}
  bind:clientHeight={vh}
  bind:this={boardEl}
  style:--gap="{gap * view.s}px"
  style:--glide="{glideMs}ms"
  style:background-position="{view.tx}px {view.ty}px"
  {onscroll}
  {@attach wheel}
  {@attach touchPan}
>
  <div
    class="layer"
    style:transform="translate({view.tx}px, {view.ty}px) scale({view.s})"
  >
    {#if preview}
      <div
        class="target"
        class:pulling={pull !== null || arriving !== null}
        style:left="{left(preview.x)}px"
        style:top="{top(preview.y)}px"
        style:width="{pxFor(MIN_WIDTH, gap)}px"
        style:height="{pxFor(preview.h, gap)}px"
      ></div>
    {/if}
    {#if target}
      <div
        class="target"
        style:left="{left(target.x)}px"
        style:top="{top(target.y)}px"
        style:width="{pxFor(target.w, gap)}px"
        style:height="{pxFor(target.h, gap)}px"
      ></div>
    {/if}
    {#each project.tracks as track, i (track.id)}
      {@const rect = board.rects[track.id]}
      {#if rect}
        {@const r = shape(track.id, rect)}
        {@const moving = drag?.id === track.id && drag.kind === "move"}
        <div
          class="cell"
          class:selected={board.overview && board.selected === track.id}
          class:moving
          style:left="{left(r.x)}px"
          style:top="{top(r.y)}px"
          style:width="{pxFor(r.w, gap)}px"
          style:height="{pxFor(r.h, gap)}px"
          style:transform={moving && drag
            ? `translate(${drag.dx / view.s}px, ${drag.dy / view.s}px)`
            : undefined}
          role="group"
          aria-label={track.name}
          onfocusin={() => pick(track.id)}
          onpointerdown={() => pick(track.id)}
        >
          <div class="content" inert={board.overview} {@attach measure(track.id)}>
            <TrackView {track} index={i}>
              {#snippet grip()}
                <button
                  class="grip"
                  aria-label={`Spur ${i + 1} verschieben`}
                  title="Ziehen: Spur verschieben"
                  {@attach dragMove(track.id)}
                >
                  <svg viewBox="0 0 16 16" aria-hidden="true">
                    {#each [4, 8, 12] as y (y)}
                      <circle cx="6" cy={y} r="1.2" /><circle cx="10" cy={y} r="1.2" />
                    {/each}
                  </svg>
                </button>
              {/snippet}
            </TrackView>
          </div>
          {#if board.overview}
            <!-- Übersicht: Antippen wählt die Spur, Ziehen verschiebt sie -->
            <button
              class="pick"
              aria-label={`${track.name} wählen`}
              {@attach dragMove(track.id, () => select(track.id))}
            ></button>
          {:else}
            <button
              class="resize"
              aria-label={`Breite von Spur ${i + 1}`}
              title="Ziehen: Breite ändern"
              {@attach dragResize(track.id)}
              onkeydown={(e) => {
                if (e.key === "ArrowRight") board.resize(track.id, rect.w + 1);
                if (e.key === "ArrowLeft") board.resize(track.id, rect.w - 1);
              }}
            >
              <svg viewBox="0 0 12 12" aria-hidden="true"><path d="M11 3L3 11M11 7L7 11" /></svg>
            </button>
          {/if}
        </div>
      {/if}
    {/each}
  </div>

  {#each board.overview && !placing ? SIDES : [] as { side, label } (side)}
    <button
      class="plus"
      class:open={adding === side}
      style:left="{plus[side].x}px"
      style:top="{plus[side].y}px"
      aria-label={`Neue Spur ${label}`}
      title={`Neue Spur ${label}`}
      aria-haspopup="menu"
      aria-expanded={adding === side}
      onclick={() => openAdd(side)}
    >
      <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 3v10M3 8h10" /></svg>
    </button>
  {/each}
  {#if menuAt}
    <div
      class="addmenu"
      class:below={arriving !== null}
      role="menu"
      aria-label="Art der neuen Spur"
      bind:this={addMenu}
      style:left="{menuAt.x}px"
      style:top="{menuAt.y}px"
    >
      {#each TYPES as { type, label } (type)}
        <button role="menuitem" onclick={() => choose(type)}>{label}</button>
      {/each}
    </div>
  {/if}
  {#if placing && board.overview}
    <!-- Aufziehen: Drücken setzt die obere linke Ecke, Ziehen nach unten die Höhe, Loslassen legt die Spur an -->
    <div
      class="placer"
      role="presentation"
      onpointerdown={placeDown}
      onpointermove={placeMove}
      onpointerup={placeUp}
      onpointercancel={() => (pull = null)}
      onpointerleave={() => (hover = null)}
    ></div>
    <p class="hint" role="status">
      Punkt für die obere linke Ecke antippen und nach unten ziehen · Esc bricht ab
    </p>
  {/if}
</div>

<button
  class="overview-toggle"
  aria-pressed={board.overview}
  title={board.overview ? "Zurück zur Spur" : "Übersicht: alle Spuren"}
  onclick={toggleOverview}
>
  <svg viewBox="0 0 16 16" aria-hidden="true">
    {#if board.overview}
      <path d="M2 6V2h4M14 6V2h-4M2 10v4h4M14 10v4h-4" />
    {:else}
      <rect x="1.5" y="1.5" width="6" height="7" rx="1.2" />
      <rect x="9" y="1.5" width="5.5" height="4.5" rx="1.2" />
      <rect x="3.5" y="10" width="9" height="4.5" rx="1.2" />
    {/if}
  </svg>
  <span>{board.overview ? "Zurück" : "Übersicht"}</span>
</button>

<style>
  /*
   * Kein Scrollen von Hand (Wischen, Rad, Leisten), die Kamera verschiebt die Ebene.
   * Punkteraster: ein Punkt in der Mitte jeder Kachel, die Kacheln laufen mit der Kamera mit.
   * In der Übersicht liegen die Punkte dichter, deshalb dort kleiner und blasser.
   */
  .board {
    flex: 1;
    min-height: 0;
    --dot: var(--mute);
    --dot-r: 1.6px;
    overflow: hidden;
    position: relative;
    /* Wischen verschiebt die Kamera selbst (`touchPan`), der Browser soll die Geste nicht übernehmen */
    touch-action: none;
    background-image: radial-gradient(
      circle,
      var(--dot) 0,
      var(--dot) var(--dot-r),
      transparent calc(var(--dot-r) + 0.6px)
    );
    background-size: var(--gap) var(--gap);
  }
  .board.overview {
    --dot: color-mix(in srgb, var(--mute) 35%, transparent);
    --dot-r: 0.9px;
  }
  .layer {
    position: absolute;
    inset: 0 auto auto 0;
    transform-origin: 0 0;
  }
  /* Spur: abgerundetes Rechteck über ihren Punkten, die Punkte scheinen schwach durch */
  .cell {
    position: absolute;
    border-radius: 18px;
    background: color-mix(in srgb, var(--panel) 92%, transparent);
    box-shadow: 0 0 0 1.5px var(--line);
  }
  /* Offene Menüs einer Spur liegen über den Nachbarn */
  .cell:focus-within {
    z-index: 2;
  }
  .cell.moving {
    z-index: 3;
    opacity: 0.85;
    box-shadow:
      0 0 0 1.5px var(--blue),
      0 10px 30px rgb(0 0 0 / 0.35);
  }
  .cell.selected {
    box-shadow: 0 0 0 3px var(--blue);
  }
  /* Fängt beim Aufziehen alle Zeiger ab, über den Spuren, unter Plus und Hinweis */
  .placer {
    position: absolute;
    inset: 0;
    z-index: 3;
    touch-action: none;
    cursor: crosshair;
  }
  .hint {
    position: absolute;
    inset: 12px 12px auto;
    margin: 0;
    text-align: center;
    font-size: 13px;
    color: var(--mute);
    pointer-events: none;
  }
  .target {
    position: absolute;
    z-index: 2;
    border: 2px dashed var(--blue);
    border-radius: 18px;
  }
  .target.pulling {
    background: color-mix(in srgb, var(--blue) 15%, transparent);
  }
  .pick {
    position: absolute;
    inset: 0;
    width: 100%;
    border: none;
    border-radius: inherit;
    background: transparent;
    touch-action: none;
    cursor: grab;
  }
  .pick:hover {
    background: color-mix(in srgb, var(--blue) 12%, transparent);
  }
  /* Griff vor dem Namen: zurückhaltend wie die Schalter der Spur */
  .grip {
    flex: none;
    width: 24px;
    height: 28px;
    padding: 0;
    border: none;
    background: transparent;
    color: var(--mute);
    opacity: 0.7;
    touch-action: none;
    cursor: grab;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .grip:hover {
    opacity: 1;
  }
  .grip svg {
    width: 16px;
    height: 16px;
    fill: currentColor;
  }
  /* Ecke unten rechts: Ziehen ändert die Breite in ganzen Punkten */
  .resize {
    position: absolute;
    right: 2px;
    bottom: 2px;
    width: 24px;
    height: 24px;
    padding: 0;
    border: none;
    background: transparent;
    color: var(--mute);
    opacity: 0.6;
    touch-action: none;
    cursor: ew-resize;
  }
  .resize:hover {
    opacity: 1;
  }
  .resize svg {
    width: 12px;
    height: 12px;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.5;
    stroke-linecap: round;
  }
  .plus {
    position: absolute;
    z-index: 4;
    width: 36px;
    height: 36px;
    margin: -18px 0 0 -18px;
    padding: 0;
    border-radius: 50%;
    border-style: dashed;
    border-color: var(--mute);
    background: var(--bg);
    color: var(--mute);
    display: flex;
    align-items: center;
    justify-content: center;
  }
  /* Erscheinen erst, wenn die Übersicht steht */
  .plus {
    animation: appear var(--glide) ease var(--glide) backwards;
  }
  @keyframes appear {
    from {
      opacity: 0;
    }
  }
  .plus:hover,
  .plus.open {
    border-style: solid;
    border-color: var(--ink);
    color: var(--ink);
  }
  .plus svg {
    width: 16px;
    height: 16px;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.8;
    stroke-linecap: round;
  }
  /* Art der neuen Spur, unter dem Plus (es steht dann in der Mitte) */
  .addmenu {
    position: absolute;
    z-index: 5;
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 120px;
    padding: 4px;
    transform: translate(-50%, 24px);
    border: 1.5px solid var(--line);
    border-radius: 10px;
    background: var(--panel);
    box-shadow: 0 8px 24px rgb(0 0 0 / 0.3);
  }
  /* Unter der neuen Spur aus der Palette (`menuAt` steht schon an ihrem unteren Rand) */
  .addmenu.below {
    transform: translate(-50%, 8px);
  }
  .addmenu button {
    border: none;
    text-align: left;
    padding: 6px 10px;
  }
  .addmenu button:hover,
  .addmenu button:focus-visible {
    background: color-mix(in srgb, var(--ink) 10%, transparent);
  }
  /* Gleiten zwischen Übersicht und Spur und wenn ein Plus in die Mitte rückt: Ebene, Raster und Plus bewegen sich gemeinsam */
  .glide .layer {
    transition: transform var(--glide) ease;
  }
  .board.glide {
    transition:
      background-position var(--glide) ease,
      background-size var(--glide) ease;
  }
  .glide .plus {
    transition:
      left var(--glide) ease,
      top var(--glide) ease;
  }
  /* Übersicht: schwebt über der Szenen-Leiste, rechts */
  .overview-toggle {
    position: fixed;
    z-index: 15;
    right: max(12px, env(safe-area-inset-right, 0px));
    bottom: calc(var(--dock-h) + env(safe-area-inset-bottom, 0px) + 12px);
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    border-color: var(--line);
    border-radius: 999px;
    background: var(--panel);
    box-shadow: 0 4px 16px rgb(0 0 0 / 0.3);
    font-size: 14px;
  }
  .overview-toggle[aria-pressed="true"] {
    background: var(--ink);
    color: var(--bg);
  }
  .overview-toggle svg {
    width: 16px;
    height: 16px;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.5;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
</style>
