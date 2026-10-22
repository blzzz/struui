import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MIN_GAP, MIN_WIDTH, boardComment, bounds, dotsFor, gapFor, magnet, overlaps, placeAt, pxFor, readBoardComment, settle } from './board.ts';

test('board: Überlappung nur bei gemeinsamen Punkten', () => {
  const a = { x: 0, y: 0, w: 5, h: 3 };
  assert.equal(overlaps(a, { x: 5, y: 0, w: 5, h: 3 }), false);
  assert.equal(overlaps(a, { x: 0, y: 3, w: 5, h: 1 }), false);
  assert.equal(overlaps(a, { x: 4, y: 2, w: 5, h: 3 }), true);
});

test('board: Umriss aller Rechtecke', () => {
  assert.equal(bounds([]), null);
  assert.deepEqual(
    bounds([
      { x: 0, y: 0, w: 5, h: 5 },
      { x: 5, y: 0, w: 5, h: 3 },
      { x: 1, y: 5, w: 7, h: 3 },
    ]),
    { x: 0, y: 0, w: 10, h: 8 },
  );
});

test('board: Überlappende rücken nach unten, das feste Rechteck bleibt', () => {
  const out = settle(
    {
      a: { x: 0, y: 0, w: 5, h: 5 },
      b: { x: 0, y: 5, w: 5, h: 3 },
      c: { x: 0, y: 8, w: 5, h: 2 },
      d: { x: 5, y: 0, w: 5, h: 3 },
    },
    'a',
  );
  // nichts überlappt: nichts bewegt sich
  assert.deepEqual(out.b, { x: 0, y: 5, w: 5, h: 3 });

  // a wächst um zwei Punkte: b und c rücken nach, d (daneben) nicht
  const grown = settle({ ...out, a: { x: 0, y: 0, w: 5, h: 7 } }, 'a');
  assert.equal(grown.a.y, 0);
  assert.equal(grown.b.y, 7);
  assert.equal(grown.c.y, 10);
  assert.equal(grown.d.y, 0);
});

test('board: Abgelegt auf eine andere Spur schiebt diese darunter, die Reihenfolge bleibt', () => {
  const out = settle(
    {
      moved: { x: 0, y: 0, w: 5, h: 3 },
      a: { x: 0, y: 1, w: 5, h: 2 },
      b: { x: 0, y: 3, w: 5, h: 2 },
    },
    'moved',
  );
  assert.deepEqual(out.moved, { x: 0, y: 0, w: 5, h: 3 });
  assert.equal(out.a.y, 3);
  assert.equal(out.b.y, 5);
});

test('board: Neue Spur aussen an jeder Seite', () => {
  const rects = [
    { x: 0, y: 0, w: 5, h: 5 },
    { x: 5, y: 0, w: 5, h: 3 },
  ];
  assert.deepEqual(placeAt(rects, 'right', 5, 2), { x: 10, y: 0, w: 5, h: 2 });
  assert.deepEqual(placeAt(rects, 'bottom', 5, 2), { x: 0, y: 5, w: 5, h: 2 });
  assert.deepEqual(placeAt(rects, 'left', 5, 2), { x: -5, y: 0, w: 5, h: 2 });
  assert.deepEqual(placeAt(rects, 'top', 5, 2), { x: 0, y: -2, w: 5, h: 2 });
  assert.deepEqual(placeAt([], 'left', 5, 2), { x: 0, y: 0, w: 5, h: 2 });
});

test('board: Punkte für eine Höhe und zurück', () => {
  const gap = 60;
  for (const dots of [1, 2, 5, 9]) assert.equal(dotsFor(pxFor(dots, gap), gap), dots);
  assert.equal(dotsFor(pxFor(3, gap) + 1, gap), 4);
  assert.equal(dotsFor(0, gap), 1);
});

test('board: Fünf Punkte passen auf den Bildschirm, nie enger als MIN_GAP', () => {
  for (const vw of [320, 375, 430]) assert.ok(pxFor(5, gapFor(vw)) <= vw - 16);
  assert.equal(gapFor(120), MIN_GAP);
  assert.equal(gapFor(2000), 80);
});

test('board: Magnet hält nahe am Punkt und springt dazwischen', () => {
  for (const v of [-2, 0, 3, 0.5, -1.5]) assert.equal(magnet(v), v);
  // nahe am Punkt kaum bewegt, nahe der Mitte fast schon dort
  assert.ok(Math.abs(magnet(0.1)) < 0.01);
  assert.ok(magnet(0.4) > 0.25);
  assert.equal(magnet(0.3, 1), 0.3);
  // monoton steigend, auch über Punkte hinweg
  let last = -Infinity;
  for (let v = -2; v <= 2; v += 0.01) {
    const m = magnet(v);
    assert.ok(m >= last - 1e-9);
    last = m;
  }
});

test('board: Sammelkommentar mit der Lage der Spuren, Breite nur wenn breiter als das Minimum', () => {
  assert.equal(boardComment([]), '');
  const text = boardComment([
    { name: 'drums', spot: { x: 0, y: 0, w: MIN_WIDTH } },
    { name: 'hats', spot: { x: 6, y: -2, w: 8 } },
  ]);
  assert.equal(text, '/* board: drums 0,0; hats 6,-2,8 */');
  assert.deepEqual(
    readBoardComment(text.slice(2, -2)),
    new Map([
      ['drums', { x: 0, y: 0, w: MIN_WIDTH }],
      ['hats', { x: 6, y: -2, w: 8 }],
    ]),
  );
});

test('board: Sammelkommentar lesen ist nachsichtig', () => {
  assert.equal(readBoardComment(' drums '), null, 'ohne Erkennungszeichen kein Sammelkommentar');
  assert.deepEqual(readBoardComment('board:'), new Map());
  assert.deepEqual(
    readBoardComment(' board:\n  a 1 , 2;\n  kaputt;  b 3,4,2; a 9,9; c x,1 '),
    new Map([
      ['a', { x: 1, y: 2, w: MIN_WIDTH }],
      ['b', { x: 3, y: 4, w: MIN_WIDTH }],
    ]),
    'Leerraum egal, Unlesbares weg, der erste Name gilt, Breite mindestens das Minimum',
  );
});
