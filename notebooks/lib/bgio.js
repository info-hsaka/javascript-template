// Real boardgame.io, running in the browser + an interactive board UI.
//
// The classic boardgame.io tutorial makes you clone a template repo, run
// `npm i`, and start a dev server on http://localhost:3000. None of that is
// needed here: this module imports the *real* boardgame.io package (bundled
// into the page) and runs the student's Game object through a real local
// `Client`. The bot is a real `MCTSBot`. The only thing we provide ourselves is
// the board rendering + a small debug panel — exactly the part the tutorial
// says is "drawn elsewhere" (normally with React) and out of scope.
//
// So: the code a student writes is identical to the real project, and it runs
// against the real framework — just without the local server, and with the UI
// handed to them so they can focus on the game logic.
//
// The UI pieces need the runtime's `html`, so they live behind a
// `createGameUI({ html })` factory (same pattern as helpers.js).

import { Client } from "boardgame.io/client";
import { INVALID_MOVE } from "boardgame.io/core";
import { MCTSBot, Step } from "boardgame.io/ai";
// The canvas chapters' `drawPicture` helper, so the board-rendering finale can
// offer the exact same drawing tools the canvas track taught.
import { makeDrawPicture } from "./helpers.js";
// The real boardgame.io debug panel (the Svelte UI shipped with the package —
// the same one you normally get on localhost:3000). We pass it explicitly as
// `debug: { impl: Debug }` rather than `debug: true`: the bundled default is
// only wired up when `process.env.NODE_ENV !== 'production'`, which Vite
// strips out in the GitHub Pages build, so an explicit impl is what makes the
// panel show up there too.
import { Debug } from "boardgame.io/debug";

export { INVALID_MOVE };

// The students build up ONE file across all chapters. This is its starting
// point: the full structure with TODOs, but no implemented logic — every body
// is theirs to write. Rather than dumping every chapter's TODO into the file
// at once, the file *grows*: chapter 1 starts with just `setup` + `moves`, and
// each later chapter inserts only the section it introduces — merged into
// whatever the student has written so far, without touching their edits.
//
// The student's file lives under this single localStorage key (the editor key
// "bgio:game" + helpers.js's "jskurs:" prefix). `prepareGameFile(chapter)` is
// called by each chapter page before the editor is created.
const STORAGE_KEY = "jskurs:bgio:game";

// Chapter 1 base: only what chapter 1 teaches. No import, no future stubs.
export const BASE_SKELETON = `export const TicTacToe = {
  setup: function setup() {
    // TODO Kapitel 1: Gib { cells: [...] } mit 9-mal null zurueck.
  },

  moves: {
    clickCell: function clickCell(move, cellIndex) {
      // TODO Kapitel 1: move.playerID an der Stelle cellIndex in move.G.cells eintragen.
    },
  },
};
`;

const IMPORT_LINE = `import { INVALID_MOVE } from 'boardgame.io/core';`;

const HELPERS_STUB = `// === Hilfsfunktionen (Kapitel 3) ===========================================

function isVictory(cells) {
  // TODO Kapitel 3: Markierung des Gewinners ("0" oder "1") zurueckgeben, sonst null.
}

function isDraw(cells) {
  // TODO Kapitel 3: true, wenn alle Felder belegt sind, sonst false.
}`;

const TURN_STUB = `
  turn: {
    // TODO Kapitel 2: minMoves und maxMoves (jeweils 1) eintragen.
  },`;

const ENDIF_STUB = `
  endIf: function endIf(endIf) {
    // TODO Kapitel 3: mit isVictory/isDraw pruefen, ob das Spiel vorbei ist.
  },`;

const AI_STUB = `
  ai: {
    enumerate: function enumerate(G) {
      // Diese Funktion gibt jedes Mal nur die Zelle oben links als einzigen
      // moeglichen Spielzug zurueck.
      // TODO Kapitel 4: Aendere sie so, dass sie ALLE moeglichen Zuege zurueckgibt,
      // also einen clickCell-Zug fuer jede leere Zelle in G.cells.
      return [{ move: 'clickCell', args: [0] }];
    },
  },`;

// Insert a new top-level helper block right before `export const TicTacToe`.
function insertBeforeGame(code, snippet) {
  const m = code.match(/export\s+const\s+TicTacToe|const\s+TicTacToe/);
  if (!m) return snippet + "\n\n" + code;
  const i = code.indexOf(m[0]);
  return code.slice(0, i) + snippet + "\n\n" + code.slice(i);
}

// Insert a new object key right before the `};` that closes the game object.
function insertObjectKey(code, snippet) {
  const i = code.lastIndexOf("};");
  if (i === -1) return code + "\n" + snippet;
  return code.slice(0, i).replace(/\s*$/, "\n") + snippet + "\n" + code.slice(i);
}

// Each section: which chapter introduces it, how to detect it's already there
// (so we never insert twice), and how to insert it.
const SECTIONS = [
  { chapter: 2, has: (c) => /boardgame\.io\/core/.test(c), apply: (c) => IMPORT_LINE + "\n\n" + c },
  { chapter: 2, has: (c) => /\bturn\s*:/.test(c), apply: (c) => insertObjectKey(c, TURN_STUB) },
  { chapter: 3, has: (c) => /function\s+isVictory/.test(c), apply: (c) => insertBeforeGame(c, HELPERS_STUB) },
  { chapter: 3, has: (c) => /\bendIf\b/.test(c), apply: (c) => insertObjectKey(c, ENDIF_STUB) },
  { chapter: 4, has: (c) => /\benumerate\b/.test(c) || /\bai\s*:/.test(c), apply: (c) => insertObjectKey(c, AI_STUB) },
];

// Add every section up to `chapter` that isn't present yet. Idempotent.
export function growSkeleton(code, chapter) {
  let out = code;
  for (const s of SECTIONS) {
    if (s.chapter <= chapter && !s.has(out)) out = s.apply(out);
  }
  return out;
}

/**
 * Called by each chapter page (in the setup cell) before the editor is built.
 * Grows the student's stored file with this chapter's new section(s) without
 * clobbering their edits, persists it, and returns this chapter's *clean*
 * skeleton to use as the editor's reset target.
 */
export function prepareGameFile(chapter) {
  let stored = null;
  try { stored = localStorage.getItem(STORAGE_KEY); } catch { /* no storage */ }
  if (stored !== null) {
    const grown = growSkeleton(stored, chapter);
    if (grown !== stored) {
      try { localStorage.setItem(STORAGE_KEY, grown); } catch { /* ignore */ }
    }
  }
  // Reset target / fallback for a fresh visit: a clean skeleton for this chapter.
  return growSkeleton(BASE_SKELETON, chapter);
}

/**
 * Read the student's stored `TicTacToe.js` (the file they built across the
 * boardgame chapters), or `null` if there is none. The board-rendering finale
 * uses it as the live game logic behind the canvas.
 */
export function readStoredGame() {
  try { return localStorage.getItem(STORAGE_KEY); } catch { return null; }
}

// A complete, correct Tic-Tac-Toe used as a fallback in the board-rendering
// finale: if the student's own `TicTacToe.js` isn't finished (or doesn't load),
// the canvas should still be playable so they can focus on the drawing. The move
// shape matches what the chapters teach — a `move` object with `G`/`playerID`,
// mutating `G` in place.
const REF_LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
];
function refVictory(cells) {
  for (const [a, b, c] of REF_LINES) {
    if (cells[a] != null && cells[a] === cells[b] && cells[a] === cells[c]) return cells[a];
  }
  return null;
}
export const REFERENCE_GAME = {
  setup: () => ({ cells: Array(9).fill(null) }),
  turn: { minMoves: 1, maxMoves: 1 },
  moves: {
    clickCell: (move, cellIndex) => {
      if (move.G.cells[cellIndex] != null) return INVALID_MOVE;
      move.G.cells[cellIndex] = move.playerID;
    },
  },
  endIf: (endIf) => {
    const winner = refVictory(endIf.G.cells);
    if (winner != null) return { winner };
    if (endIf.G.cells.every((c) => c != null)) return { draw: true };
  },
  ai: {
    enumerate: (G) =>
      G.cells.map((c, i) => (c == null ? { move: "clickCell", args: [i] } : null)).filter(Boolean),
  },
};

// Try to use the student's own game; fall back to the reference if it can't be
// loaded or doesn't behave like a Tic-Tac-Toe (so the finale never breaks).
export function resolveGame(gameCode) {
  if (gameCode && gameSourceWorks(gameCode)) return loadGame(gameCode);
  return REFERENCE_GAME;
}

// Does this source load and behave like a Tic-Tac-Toe? (setup gives 9 cells and
// clickCell(0) fills a cell). Used both to decide the finale's fallback and to
// pick the starting source for the merged finale file.
function gameSourceWorks(code) {
  try {
    const game = loadGame(code);
    const client = makeClient(game);
    const st = client.getState();
    const cells = st && st.G && st.G.cells;
    let ok = Array.isArray(cells) && cells.length === 9;
    if (ok) {
      client.moves.clickCell(0);
      ok = client.getState().G.cells[0] != null;
    }
    try { client.stop(); } catch { /* ignore */ }
    return ok;
  } catch { return false; }
}

// A complete Tic-Tac-Toe *as source code*, written in the same style the
// chapters teach (named functions inside the object, plain `for` loops, no
// destructuring). The finale shows EVERYTHING in one file; if the student
// hasn't finished the logic chapters, this steps in as the visible starting
// point so the file is self-contained and runnable while they focus on drawing.
export const REFERENCE_GAME_SOURCE = `import { INVALID_MOVE } from 'boardgame.io/core';

// === Hilfsfunktionen (Kapitel 3) ===========================================

function isVictory(cells) {
  const linien = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8],
    [0, 3, 6], [1, 4, 7], [2, 5, 8],
    [0, 4, 8], [2, 4, 6],
  ];
  for (const linie of linien) {
    const a = cells[linie[0]];
    const b = cells[linie[1]];
    const c = cells[linie[2]];
    if (a !== null && a === b && a === c) {
      return a;
    }
  }
  return null;
}

function isDraw(cells) {
  for (const zelle of cells) {
    if (zelle === null) return false;
  }
  return true;
}

export const TicTacToe = {
  setup: function setup() {
    return { cells: [null, null, null, null, null, null, null, null, null] };
  },

  turn: {
    minMoves: 1,
    maxMoves: 1,
  },

  moves: {
    clickCell: function clickCell(move, cellIndex) {
      if (move.G.cells[cellIndex] !== null) {
        return INVALID_MOVE;
      }
      move.G.cells[cellIndex] = move.playerID;
    },
  },

  endIf: function endIf(endIf) {
    const gewinner = isVictory(endIf.G.cells);
    if (gewinner !== null) {
      return { winner: gewinner };
    }
    if (isDraw(endIf.G.cells)) {
      return { draw: true };
    }
  },

  ai: {
    enumerate: function enumerate(G) {
      const zuege = [];
      for (let i = 0; i < G.cells.length; i++) {
        if (G.cells[i] === null) {
          zuege.push({ move: 'clickCell', args: [i] });
        }
      }
      return zuege;
    },
  },
};
`;

// The drawing half of the finale's single file: the \`draw(G, gameover)\`
// skeleton the student fills in. Lines (not a template string) so the notebook
// keeps the indentation.
export const DRAW_STARTER = [
  "",
  "// === Das Spielbrett zeichnen (Finale) ===================================",
  "// Oben steht deine Spiellogik. Hier unten zeichnest du das Brett -- mit",
  "// genau den Canvas-Bausteinen aus dem Zeichnen-Kurs.",
  "",
  "const feld = 100   // jede Zelle ist 100 x 100 Pixel gross",
  "",
  "export function draw(G, gameover) {",
  "  resetOnClicks()",
  "",
  "  // Hintergrund weiss uebermalen (wie in der Klicks-Uebung)",
  "  ctx.fillStyle = \"white\"",
  "  ctx.fillRect(0, 0, canvas.width, canvas.height)",
  "",
  "  // TODO 1: Zeichne das 3x3-Gitter.",
  "",
  "  // TODO 2: Zeichne fuer jede belegte Zelle in G.cells die",
  "  //         passende Markierung (X fuer \"0\", O fuer \"1\").",
  "",
  "  // Die Zelle oben links (Index 0) ist schon anklickbar:",
  "  // ein Klick darauf ruft deinen Move clickCell(0) auf.",
  "  onClick(0, 0, feld, feld, () => {",
  "    clickCell(0)",
  "  })",
  "",
  "  // TODO 3: Mach AUCH alle anderen Zellen anklickbar -- jede mit dem",
  "  //         richtigen Index fuer clickCell. (Denk an die let-Falle aus",
  "  //         dem Klicks-Kapitel, wenn du onClick in einer Schleife anlegst!)",
  "",
  "  // TODO 4: Wenn das Spiel vorbei ist, ist gameover gesetzt (sonst null).",
  "  //         Zeige dann das Ergebnis an: gameover.winner ist der Gewinner",
  "  //         (\"0\" oder \"1\"), gameover.draw ist true bei einem Unentschieden.",
  "}",
  "",
].join("\n");

/**
 * The starting content for the finale's ONE file: the student's own game logic
 * (from the boardgame chapters) if it works, otherwise the reference source —
 * with the `draw(G, gameover)` skeleton appended. So everything the game needs
 * lives in a single file the student edits.
 */
export function finaleStarter() {
  const stored = readStoredGame();
  const logic = (stored && gameSourceWorks(stored)) ? stored.replace(/\s+$/, "") : REFERENCE_GAME_SOURCE.replace(/\s+$/, "");
  return logic + "\n" + DRAW_STARTER;
}

// boardgame.io move/setup/endIf code uses `import { INVALID_MOVE } from
// 'boardgame.io/core'` and `export const`. We can't `import`/`export` inside a
// sandbox `new Function`, so we strip those lines/keywords. `INVALID_MOVE` is
// injected as an argument instead (the real sentinel from the package).
export function stripModuleSyntax(code) {
  return code
    .replace(/^\s*import\s+[^;\n]*from\s+['"]boardgame\.io[^'"]*['"];?\s*$/gm, "")
    .replace(/\bexport\s+(const|function|let|var)/g, "$1");
}

export function loadGame(code, { console: fakeConsole, name = "TicTacToe" } = {}) {
  const body = `${stripModuleSyntax(code)}\n;return typeof ${name} !== "undefined" ? ${name} : undefined;`;
  const cons = fakeConsole ?? console;
  return new Function("INVALID_MOVE", "console", body)(INVALID_MOVE, cons);
}

// Create and start a real local boardgame.io client (no server, in-memory).
// Pass `debug: true` to mount boardgame.io's own debug panel for this client.
// `debugCollapsed` starts the panel collapsed — used to preserve the panel's
// open/closed state across the client rebuilds that happen on every edit.
export function makeClient(game, { numPlayers = 2, debug = false, debugCollapsed = false } = {}) {
  const client = Client({
    game,
    numPlayers,
    // We keep boardgame.io's built-in arrow tab in the DOM (our own toggle clicks
    // it — .click() works even though we hide it with CSS), but hide it visually
    // because it docked on top of the theme toggle. See `.visibility-toggle` in
    // style.css.
    debug: debug ? { impl: Debug, collapseOnLoad: debugCollapsed } : false,
  });
  client.start();
  return client;
}

// === UI factory ==============================================================

export function createGameUI({ html }) {
  function fmt(v) {
    try { return JSON.stringify(v); } catch { return String(v); }
  }

  function makeCapture() {
    const lines = [];
    const push = (prefix) => (...args) =>
      lines.push(prefix + args.map((a) => (typeof a === "string" ? a : fmt(a))).join(" "));
    return { lines, console: { log: push(""), error: push("⚠ "), warn: push("⚠ ") } };
  }

  // boardgame.io's debug panel toggles its visibility on the bare "." key via
  // window key listeners we can't configure off (its `disableHotkeys` store is
  // internal). It registers TWO of them — one on "keydown" and one on "keypress"
  // — and the visibility toggle fires on the "keypress" one, so blocking keydown
  // alone isn't enough. These fire while students type "." in the code editor and
  // keep popping the panel open, so we silence the shortcut for all three key
  // events: a capture-phase window listener runs before the panel's own
  // bubble-phase listeners and stops the "." event from ever reaching them. We
  // don't preventDefault, and character input in CodeMirror/<input> is driven by
  // beforeinput (not these listeners), so typing "." everywhere still works —
  // only the toggle is gone.
  if (!window.__bgioDotHotkeyDisabled) {
    window.__bgioDotHotkeyDisabled = true;
    const swallowDot = (e) => {
      if (e.key === "." && !e.ctrlKey && !e.metaKey && !e.altKey) e.stopImmediatePropagation();
    };
    for (const type of ["keydown", "keypress", "keyup"]) {
      window.addEventListener(type, swallowDot, true);
    }
  }

  // boardgame.io's debug panel exposes no public toggle API, but it mounts a
  // ".visibility-toggle" button (which we hide with CSS) that flips its `visible`
  // state; .click() drives it reliably even while hidden. When expanded the button
  // carries the ".closer" class, collapsed it's ".opener" — that's how we read
  // the current state to remember it across rebuilds.
  function isDebugPanelOpen() {
    return !!document.querySelector(".debug-panel .closer");
  }
  function toggleDebugPanel() {
    const toggle = document.querySelector(".debug-panel .visibility-toggle");
    if (toggle) toggle.click();
  }

  // playerID is the string "0" / "1" in boardgame.io.
  function mark(v) {
    if (v === "0" || v === 0) return "✕";
    if (v === "1" || v === 1) return "◯";
    if (v == null) return "";
    return String(v);
  }

  function statusLine(state) {
    const go = state && state.ctx && state.ctx.gameover;
    if (go) {
      if (go.draw) return html`<div class="bg-status bg-status-draw">🤝 Unentschieden!</div>`;
      if (go.winner != null)
        return html`<div class="bg-status bg-status-win">🎉 Spieler ${mark(go.winner)} (ID ${go.winner}) gewinnt!</div>`;
      return html`<div class="bg-status bg-status-win">Spiel vorbei: <code>${fmt(go)}</code></div>`;
    }
    const p = state && state.ctx ? state.ctx.currentPlayer : "0";
    return html`<div class="bg-status">Am Zug: <b>Spieler ${mark(p)}</b> (ID ${p})</div>`;
  }

  /**
   * Live Tic-Tac-Toe board driven by the student's Game object through a real
   * boardgame.io Client. `code` is the student's file (reactive: the cell
   * re-runs and the board rebuilds when the editor publishes new code).
   *
   * opts: { showDebug, showBot, showState, hint }
   */
  // boardgame.io's ClientManager only ever mounts ONE debug panel (the first
  // started client wins) and keeps every started client in a map. The editor
  // re-runs `gameBoard` on each keystroke, so we stop the previous board client
  // before building a new one — otherwise the debug panel would freeze on the
  // first run's client and stale clients would pile up.
  let liveClient = null;
  // The panel is tied to client lifecycle, so rebuilding the client on every
  // keystroke would otherwise re-open it from scratch. We remember whether the
  // user had it open and restore that on the next mount (collapseOnLoad). Starts
  // collapsed on load; the student opens it via the state-display toggle.
  let debugCollapsed = true;

  function gameBoard(code, opts = {}) {
    const { showDebug = false, showBot = false, showState = true } = opts;
    const root = html`<div class="bg-game"></div>`;

    if (liveClient) {
      // Capture the panel's current open/closed state before tearing it down,
      // so toggles via our button or the panel's own arrow survive the rebuild.
      if (showDebug) debugCollapsed = !isDebugPanelOpen();
      try { liveClient.stop(); } catch { /* ignore */ }
      liveClient = null;
    }

    let client, game;
    const cap = makeCapture();
    try {
      game = loadGame(code, { console: cap.console });
      client = makeClient(game, { debug: showDebug, debugCollapsed });
      liveClient = client;
    } catch (e) {
      root.appendChild(html`<div class="feedback feedback-err">❌ ${e.message}</div>`);
      return root;
    }

    let bot = null;
    if (showBot && game.ai && typeof game.ai.enumerate === "function") {
      try { bot = new MCTSBot({ game, enumerate: game.ai.enumerate, iterations: 1000 }); }
      catch { bot = null; }
    }

    const notice = html`<div class="bg-notice"></div>`;
    function flash(node) { notice.innerHTML = ""; if (node) notice.appendChild(node); }

    function cells() {
      const st = client.getState();
      return st && st.G && Array.isArray(st.G.cells) ? st.G.cells : null;
    }

    function clickCell(i) {
      cap.lines.length = 0;
      const cs = cells();
      if (!cs) return;
      const before = JSON.stringify(cs);
      const stateIdBefore = client.getState()._stateID;
      try { client.moves.clickCell(i); }
      catch (e) { flash(html`<div class="feedback feedback-err">❌ Fehler im Move: ${e.message}</div>`); render(); return; }
      const after = JSON.stringify(cells());
      // A move that returns INVALID_MOVE is rejected and leaves _stateID
      // unchanged — that is expected behavior, so we only warn when the move
      // was actually applied (stateID advanced) but did not touch `cells`.
      const accepted = client.getState()._stateID !== stateIdBefore;
      if (accepted && before === after && !client.getState().ctx.gameover) {
        flash(html`<div class="feedback feedback-err">❌ Der Zug hat nichts verändert — vielleicht ist das Feld schon belegt (<code>INVALID_MOVE</code>) oder <code>clickCell</code> trägt noch nichts in <code>cells</code> ein.</div>`);
      } else {
        flash(null);
      }
      render();
    }

    function boardGrid() {
      const cs = cells();
      const over = client.getState().ctx.gameover;
      const grid = html`<div class="bg-board"></div>`;
      if (!cs) {
        for (let i = 0; i < 9; i++) grid.appendChild(html`<button class="bg-cell" disabled></button>`);
        return grid;
      }
      for (let i = 0; i < 9; i++) {
        const btn = html`<button class="bg-cell" ${over ? "disabled" : ""}>${mark(cs[i])}</button>`;
        btn.addEventListener("click", () => clickCell(i));
        grid.appendChild(btn);
      }
      return grid;
    }

    function botPanel() {
      if (!bot) {
        return html`<div class="bg-notice"><div class="feedback feedback-hint">⏳ Noch kein funktionierendes <code>ai.enumerate</code> — füg es hinzu, um den Bot zu aktivieren.</div></div>`;
      }
      const playBtn = html`<button class="run-button" type="button">🤖 play (ein Zug)</button>`;
      playBtn.addEventListener("click", async () => {
        playBtn.disabled = true;
        try { await Step(client, bot); flash(null); }
        catch (e) { flash(html`<div class="feedback feedback-err">❌ Bot-Fehler: ${e.message}</div>`); }
        playBtn.disabled = false;
        render();
      });
      const simBtn = html`<button class="run-button" type="button">⏩ simulate (ganzes Spiel)</button>`;
      simBtn.addEventListener("click", async () => {
        simBtn.disabled = true;
        try {
          let guard = 0;
          while (!client.getState().ctx.gameover && guard < 30) { await Step(client, bot); guard++; }
          flash(null);
        } catch (e) { flash(html`<div class="feedback feedback-err">❌ Bot-Fehler: ${e.message}</div>`); }
        simBtn.disabled = false;
        render();
      });
      return html`<div class="bg-debug"><span class="bg-debug-label">Bot:</span> ${playBtn} ${simBtn}</div>`;
    }

    // Persist the state <details> open/closed across re-renders (the board is
    // rebuilt on every move, which would otherwise reset it to closed).
    let stateOpen = false;

    function render() {
      const st = client.getState();
      root.innerHTML = "";
      root.appendChild(statusLine(st));
      root.appendChild(boardGrid());

      if (!cells())
        root.appendChild(html`<div class="feedback feedback-hint">⏳ <code>setup</code> gibt noch kein <code>{ cells: [...] }</code> zurück — deshalb ist das Feld leer.</div>`);

      if (showBot) root.appendChild(botPanel());
      root.appendChild(notice);

      if (cap.lines.length) {
        const box = html`<div class="console-output"></div>`;
        box.appendChild(html`<div class="console-label">Konsole (letzter Zug)</div>`);
        for (const l of cap.lines) box.appendChild(html`<div class="console-line">${l}</div>`);
        root.appendChild(box);
      }

      if (showState) {
        const details = html`<details class="bg-state"><summary>Spielzustand <code>G</code> &amp; <code>ctx</code></summary>
          <div class="console-output" style="margin-top:.4em">
            <div class="console-line">G = ${fmt(st && st.G)}</div>
            <div class="console-line">ctx.currentPlayer = ${fmt(st && st.ctx && st.ctx.currentPlayer)}</div>
            <div class="console-line">ctx.gameover = ${fmt(st && st.ctx && st.ctx.gameover)}</div>
          </div></details>`;
        details.open = stateOpen;
        details.addEventListener("toggle", () => { stateOpen = details.open; });

        // When the real boardgame.io debug panel is mounted, give the state
        // display a button to show/hide it (the panel also has its own arrow
        // tab; this is just a discoverable entry point).
        if (showDebug) {
          const dbgBtn = html`<button class="reset-button bg-debug-toggle" type="button">🛠️ Debug-Menü öffnen/schließen</button>`;
          dbgBtn.addEventListener("click", () => {
            toggleDebugPanel();
            debugCollapsed = !isDebugPanelOpen();
          });
          root.appendChild(html`<div class="bg-state-tools">${dbgBtn}</div>`);
        }

        root.appendChild(details);
      }

      if (opts.hint) root.appendChild(html`<div class="feedback feedback-hint">⏳ ${opts.hint}</div>`);

      const resetBtn = html`<button class="reset-button" type="button" style="margin-top:.5em">↺ Spiel zurücksetzen</button>`;
      resetBtn.addEventListener("click", () => {
        cap.lines.length = 0;
        try { client.reset(); } catch { /* ignore */ }
        flash(null);
        render();
      });
      root.appendChild(resetBtn);
    }

    // The real boardgame.io debug panel mutates client state directly — its
    // Reset button (and undo/redo, log time-travel) bypasses our own click
    // handlers, so those changes would never reach `render()`. Subscribing to
    // the client makes any external state change re-render our board too.
    client.subscribe(() => render());

    render();
    return root;
  }

  // Strip `export` and the boardgame.io `import` line so the student's single
  // finale file (game logic + draw) can be run inside a `new Function` sandbox
  // (same trick as the canvas chapters). The file now holds BOTH the TicTacToe
  // object and `draw`, so we strip module syntax exactly as `loadGame` does.
  function stripExport(code) {
    return stripModuleSyntax(code).replace(/\bexport\s+(function|const|let|async)/g, "$1");
  }

  // Like `gameBoard`, but the board is drawn by the STUDENT's own
  // `draw(G, gameover)` function on a real, clickable <canvas> — the finale of
  // the course. Logic AND rendering live in ONE file now: the same `code` holds
  // their `TicTacToe` object (run through a real boardgame.io client) and their
  // `draw` (which renders the board). If the logic half doesn't work yet, a
  // reference game steps in (see `resolveGame`) so the canvas stays playable.
  //
  // The student's `draw` gets the canvas tools they already know — `ctx`,
  // `canvas`, `drawPicture`, `onClick`, `resetOnClicks` — plus `clickCell(i)`,
  // which fires the real `clickCell` move on the client. Every accepted move
  // updates `G` and re-runs `draw(G, gameover)`: the same redraw loop as the
  // canvas "Klicks" chapter, only the state now lives in boardgame.io.
  let liveCanvasClient = null;

  function gameCanvas(code, opts = {}) {
    const { width = 300, height = 300, background = "white" } = opts;
    const root = html`<div class="bg-game"></div>`;

    if (liveCanvasClient) {
      try { liveCanvasClient.stop(); } catch { /* ignore */ }
      liveCanvasClient = null;
    }

    let client;
    try {
      client = makeClient(resolveGame(code));
      liveCanvasClient = client;
    } catch (e) {
      root.appendChild(html`<div class="feedback feedback-err">❌ ${e.message}</div>`);
      return root;
    }

    const canvas = html`<canvas class="canvas-surface" style="cursor:pointer" width="${width}" height="${height}"></canvas>`;
    const ctx = canvas.getContext("2d");
    if (background) { ctx.fillStyle = background; ctx.fillRect(0, 0, width, height); }
    ctx.fillStyle = "black";
    ctx.strokeStyle = "black";
    ctx.lineWidth = 1;

    let handlers = [];
    const onClick = (x, y, w, h, handler) => { handlers.push({ x, y, width: w, height: h, handler }); };
    const resetOnClicks = () => { handlers = []; };
    const drawPicture = makeDrawPicture();
    const clickCell = (i) => {
      try { client.moves.clickCell(i); }
      catch (e) { flash(html`<div class="feedback feedback-err">❌ Fehler im Move: ${e.message}</div>`); }
    };

    // Pull the student's draw(G, gameover) out of the same file.
    let drawFn = null, loadError = null;
    const cleaned = stripExport(code);
    try {
      const body = `"use strict";\n${cleaned}\n;\nreturn typeof draw === "function" ? draw : undefined;`;
      drawFn = new Function("ctx", "canvas", "drawPicture", "onClick", "resetOnClicks", "clickCell", body)(
        ctx, canvas, drawPicture, onClick, resetOnClicks, clickCell
      );
    } catch (e) { loadError = e.message; }

    const errSlot = html`<div></div>`;
    const notice = html`<div class="bg-notice"></div>`;
    function flash(node) { notice.innerHTML = ""; if (node) notice.appendChild(node); }

    function render() {
      errSlot.innerHTML = "";
      if (loadError) {
        errSlot.appendChild(html`<div class="canvas-error">⚠ ${loadError}</div>`);
        return;
      }
      if (typeof drawFn !== "function") {
        errSlot.appendChild(html`<div class="feedback feedback-hint">⏳ Exportiere eine Funktion <code>draw(G, gameover)</code> — dann zeichne ich dein Spielbrett.</div>`);
        return;
      }
      // boardgame.io keeps the result of `endIf` in ctx.gameover (null while the
      // game runs). We hand it to the student's draw so THEY render the result.
      const state = client.getState();
      try { drawFn(state.G, state.ctx.gameover || null); }
      catch (e) { errSlot.appendChild(html`<div class="canvas-error">⚠ Fehler in <code>draw</code>: ${e.message}</div>`); }
    }

    // A real click on the surface runs every handler whose rectangle contains
    // the point — which calls clickCell, advances the client, and (via the
    // subscription below) redraws the board.
    canvas.addEventListener("click", (event) => {
      const rect = canvas.getBoundingClientRect();
      const x = (event.clientX - rect.left) * (canvas.width / rect.width);
      const y = (event.clientY - rect.top) * (canvas.height / rect.height);
      for (const h of handlers.slice()) {
        if (x >= h.x && x <= h.x + h.width && y >= h.y && y <= h.y + h.height) h.handler();
      }
    });

    const frame = html`<div class="canvas-frame"></div>`;
    frame.appendChild(canvas);

    const resetBtn = html`<button class="reset-button" type="button" style="margin-top:.5em">↺ Spiel zurücksetzen</button>`;
    resetBtn.addEventListener("click", () => {
      try { client.reset(); } catch { /* ignore */ }
      flash(null);
      render();
    });

    root.append(frame, errSlot, notice);
    if (opts.hint) root.appendChild(html`<div class="feedback feedback-hint">⏳ ${opts.hint}</div>`);
    root.appendChild(resetBtn);

    // Any state change (our clicks, reset, …) redraws the student's board.
    client.subscribe(() => render());
    render();
    return root;
  }

  // Grades a student's board file by running their `draw(G)` against synthetic
  // game states on an offscreen canvas, recording every ctx call + onClick area,
  // and spying on `clickCell`. Mirrors `canvasTest` from helpers.js but calls
  // `draw(G)` (not `draw(ctx)`) and provides a `clickCell` spy instead of a real
  // client. Returns `{ error, results }` for `canvasTestReport`.
  function gameCanvasTest(code, { width = 300, height = 300, background = "white", checks = [] } = {}) {
    const cleaned = stripExport(code);
    const bg = [255, 255, 255];
    const colorEq = (px, rgb, tol = 30) =>
      Math.abs(px[0] - rgb[0]) <= tol && Math.abs(px[1] - rgb[1]) <= tol && Math.abs(px[2] - rgb[2]) <= tol;

    function probe({ cells = Array(9).fill(null), gameover = null } = {}) {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const real = canvas.getContext("2d", { willReadFrequently: true });
      if (background) { real.fillStyle = background; real.fillRect(0, 0, width, height); }
      real.fillStyle = "black";
      real.strokeStyle = "black";
      real.lineWidth = 1;

      const calls = [];
      const ctx = new Proxy(real, {
        get(t, p) {
          const v = t[p];
          if (typeof v === "function") return (...a) => { calls.push({ name: String(p), args: a }); return v.apply(t, a); };
          return v;
        },
        set(t, p, val) { calls.push({ name: String(p), set: true, value: val }); t[p] = val; return true; },
      });

      const drawPicture = makeDrawPicture();
      let clickHandlers = [], resetCount = 0;
      const moves = [];
      const onClick = (x, y, w, h, handler) => { clickHandlers.push({ x, y, width: w, height: h, handler }); };
      const resetOnClicks = () => { resetCount++; clickHandlers = []; };
      const clickCell = (i) => { moves.push(i); };

      let error = null, drawFn;
      try {
        const body = `"use strict";\n${cleaned}\n;\nreturn typeof draw === "function" ? draw : undefined;`;
        drawFn = new Function("ctx", "canvas", "drawPicture", "onClick", "resetOnClicks", "clickCell", body)(
          ctx, canvas, drawPicture, onClick, resetOnClicks, clickCell
        );
        if (typeof drawFn !== "function") error = "Die Funktion `draw` wurde nicht gefunden — exportiere `function draw(G, gameover)`.";
        else drawFn({ cells }, gameover);
      } catch (e) { error = e.message; }

      const img = real.getImageData(0, 0, width, height);
      const pixel = (x, y) => {
        const i = (Math.round(y) * width + Math.round(x)) * 4;
        return [img.data[i], img.data[i + 1], img.data[i + 2], img.data[i + 3]];
      };
      // Count non-background pixels in the INNER area of cell `i` (inset to skip
      // the grid lines), so a marked cell stands out from an empty one no matter
      // how the mark is drawn (✕ lines, ◯ ring, text, sprite…).
      const cellInk = (i, feld = 100, inset = 20) => {
        const col = i % 3, rowi = Math.floor(i / 3);
        let count = 0;
        for (let y = rowi * feld + inset; y < rowi * feld + feld - inset; y++) {
          for (let x = col * feld + inset; x < col * feld + feld - inset; x++) {
            if (!colorEq(pixel(x, y), bg, 12)) count++;
          }
        }
        return count;
      };
      const nonBg = () => {
        let count = 0;
        for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
          if (!colorEq(pixel(x, y), bg, 12)) count++;
        }
        return count;
      };
      return {
        calls, error, width, height, pixel, cellInk, nonBg,
        clickHandlers, resetCount, moves, drawFound: typeof drawFn === "function",
        clickAt: (x, y) => {
          for (const h of clickHandlers.slice()) {
            if (x >= h.x && x <= h.x + h.width && y >= h.y && y <= h.y + h.height) h.handler();
          }
        },
        callsTo: (name) => calls.filter((c) => c.name === name && !c.set),
      };
    }

    const base = probe();
    if (base.error) return { error: base.error, results: [] };
    const results = [];
    for (const chk of checks) {
      try {
        const r = chk.run({ base, probe });
        const passed = r === true ? true : r === false ? false : !!r.passed;
        results.push({ name: chk.name, passed, detail: (r && r.detail) || null });
      } catch (e) {
        results.push({ name: chk.name, passed: false, detail: "Test-Fehler: " + e.message });
      }
    }
    return { error: null, results };
  }

  // Small helper to label a section inside the panel.
  function sectionLabel(text) {
    return html`<div class="bg-panel-section-label">${text}</div>`;
  }

  /**
   * Mount the given DOM nodes (editor, board, checks, …) into a fixed panel
   * docked to the right of the viewport, so the page's instruction flow on the
   * left and the editor on the right are visible at the same time. The panel
   * can be collapsed to a tab. Replaces any previously mounted editor panel.
   *
   * The `editor` fills a full-height panel on the RIGHT (the code scrolls inside
   * CodeMirror so the Run bar stays in view). It can be collapsed to a tab and
   * resized by dragging its left edge; the width persists to localStorage. The
   * game/state lives in the instructions column (see `gameCard`), so both panes
   * are visible at once without a third column.
   */
  function mountEditor({ title = "TicTacToe.js", editor } = {}) {
    document.getElementById("bg-editor-panel")?.remove();
    document.getElementById("bg-editor-tab")?.remove();

    const root = document.documentElement;
    // Marks this page as the boardgame app shell (fixed left/right panes, only
    // the instructions scroll). Scopes the layout CSS so shared JS-course
    // notebooks keep their normal page flow.
    root.classList.add("bg-app");
    const WIDTH_KEY = "jskurs:bgio:panelWidth";
    const isWide = () => window.innerWidth > 900;
    const clampW = (w) => Math.max(360, Math.min(w, Math.round(window.innerWidth * 0.7)));
    const applyWidth = (w) => { if (isWide()) root.style.setProperty("--bg-panel-width", clampW(w) + "px"); };

    if (editor) editor.classList.add("bg-editor-fill");
    const editorRegion = html`<div class="bg-panel-editor"></div>`;
    if (editor) editorRegion.appendChild(editor);
    const collapseBtn = html`<button class="bg-panel-btn" title="Code ausblenden">✕ ausblenden</button>`;
    const head = html`<div class="bg-panel-head"><span>📄 <code>${title}</code></span>${collapseBtn}</div>`;
    const resizer = html`<div class="bg-panel-resizer" title="Breite ziehen"></div>`;
    const panel = html`<div class="bg-panel" id="bg-editor-panel">${resizer}${head}${editorRegion}</div>`;
    const tab = html`<button class="bg-panel-tab" id="bg-editor-tab" title="Code anzeigen">📄 Code</button>`;

    const show = () => { root.classList.add("bg-has-panel"); root.classList.remove("bg-panel-hidden"); panel.classList.remove("bg-collapsed"); };
    const hide = () => { root.classList.remove("bg-has-panel"); root.classList.add("bg-panel-hidden"); panel.classList.add("bg-collapsed"); };
    collapseBtn.addEventListener("click", hide);
    tab.addEventListener("click", show);

    const savedW = Number(localStorage.getItem(WIDTH_KEY));
    if (savedW) applyWidth(savedW);

    let dragging = false;
    const widthFor = (e) => clampW(window.innerWidth - e.clientX);
    resizer.addEventListener("pointerdown", (e) => {
      dragging = true;
      resizer.setPointerCapture(e.pointerId);
      document.body.style.userSelect = "none";
      e.preventDefault();
    });
    resizer.addEventListener("pointermove", (e) => { if (dragging) applyWidth(widthFor(e)); });
    const stop = (e) => {
      if (!dragging) return;
      dragging = false;
      document.body.style.userSelect = "";
      try { localStorage.setItem(WIDTH_KEY, String(widthFor(e))); } catch { /* ignore */ }
    };
    resizer.addEventListener("pointerup", stop);
    resizer.addEventListener("pointercancel", stop);

    document.body.append(panel, tab);
    show();
  }

  /**
   * Mount the game/state as a fixed section pinned to the TOP of the
   * instructions column (above the prose, which scrolls underneath). It starts
   * COLLAPSED — only a slim bar with a title + an "Ausführen" button is shown —
   * and expands to reveal the board/state/checks. `onRun` is invoked by the
   * section's Ausführen button (typically to run the editor's code); the section
   * also exposes `expand`/`collapse` so the page can auto-expand it on every run.
   * Replaces any previously mounted section.
   */
  function mountGameSection({ nodes = [], onRun, title = "Spiel & Zustand" } = {}) {
    document.getElementById("bg-game-section")?.remove();
    document.documentElement.classList.add("bg-has-gamesection");

    const runBtn = html`<button class="run-button" type="button" title="Code ausführen (⌘/Strg+Enter)">▶ Ausführen</button>`;
    const toggle = html`<button class="bg-panel-btn" title="Ein-/ausklappen">▸ Spiel zeigen</button>`;
    const head = html`<div class="bg-game-section-head">${runBtn}${toggle}<span class="bg-game-section-title">🎮 ${title}</span></div>`;
    const body = html`<div class="bg-game-section-body"></div>`;
    for (const n of nodes) if (n) body.appendChild(n);
    const section = html`<div class="bg-game-section bg-collapsed" id="bg-game-section">${head}${body}</div>`;

    const expand = () => { section.classList.remove("bg-collapsed"); toggle.textContent = "▾ Spiel ausblenden"; };
    const collapse = () => { section.classList.add("bg-collapsed"); toggle.textContent = "▸ Spiel zeigen"; };
    toggle.addEventListener("click", () => (section.classList.contains("bg-collapsed") ? expand() : collapse()));
    runBtn.addEventListener("click", () => { if (onRun) onRun(); expand(); });

    document.body.prepend(section);
    return { expand, collapse, el: section };
  }

  return { gameBoard, gameCanvas, gameCanvasTest, mountEditor, mountGameSection, sectionLabel };
}
