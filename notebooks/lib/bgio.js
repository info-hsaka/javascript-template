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
      // TODO Kapitel 4: einen clickCell-Zug fuer jede leere Zelle zurueckgeben.
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
export function makeClient(game, { numPlayers = 2 } = {}) {
  const client = Client({ game, numPlayers, debug: false });
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
  function gameBoard(code, opts = {}) {
    const { showDebug = false, showBot = false, showState = true } = opts;
    const root = html`<div class="bg-game"></div>`;

    let client, game;
    const cap = makeCapture();
    try {
      game = loadGame(code, { console: cap.console });
      client = makeClient(game);
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
      try { client.moves.clickCell(i); }
      catch (e) { flash(html`<div class="feedback feedback-err">❌ Fehler im Move: ${e.message}</div>`); render(); return; }
      const after = JSON.stringify(cells());
      if (before === after && !client.getState().ctx.gameover) {
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

    function debugPanel() {
      const idx = html`<input class="bg-idx" type="number" min="0" max="8" value="0">`;
      const moveBtn = html`<button class="run-button" type="button">clickCell(…)</button>`;
      moveBtn.addEventListener("click", () => clickCell(Number(idx.value)));
      const endBtn = html`<button class="reset-button" type="button">endTurn</button>`;
      endBtn.addEventListener("click", () => {
        cap.lines.length = 0;
        try { client.events.endTurn(); flash(null); }
        catch (e) { flash(html`<div class="feedback feedback-err">❌ ${e.message}</div>`); }
        render();
      });
      return html`<div class="bg-debug">
        <span class="bg-debug-label">Debug Panel:</span>
        <code>clickCell(</code>${idx}<code>)</code> ${moveBtn} ${endBtn}
      </div>`;
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

    function render() {
      const st = client.getState();
      root.innerHTML = "";
      root.appendChild(statusLine(st));
      root.appendChild(boardGrid());

      if (!cells())
        root.appendChild(html`<div class="feedback feedback-hint">⏳ <code>setup</code> gibt noch kein <code>{ cells: [...] }</code> zurück — deshalb ist das Feld leer.</div>`);

      if (showDebug) root.appendChild(debugPanel());
      if (showBot) root.appendChild(botPanel());
      root.appendChild(notice);

      if (cap.lines.length) {
        const box = html`<div class="console-output"></div>`;
        box.appendChild(html`<div class="console-label">Konsole (letzter Zug)</div>`);
        for (const l of cap.lines) box.appendChild(html`<div class="console-line">${l}</div>`);
        root.appendChild(box);
      }

      if (showState) {
        root.appendChild(html`<details class="bg-state"><summary>Spielzustand <code>G</code> &amp; <code>ctx</code></summary>
          <div class="console-output" style="margin-top:.4em">
            <div class="console-line">G = ${fmt(st && st.G)}</div>
            <div class="console-line">ctx.currentPlayer = ${fmt(st && st.ctx && st.ctx.currentPlayer)}</div>
            <div class="console-line">ctx.gameover = ${fmt(st && st.ctx && st.ctx.gameover)}</div>
          </div></details>`);
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

    render();
    return root;
  }

  return { gameBoard };
}
