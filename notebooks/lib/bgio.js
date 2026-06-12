// In-browser boardgame.io engine + interactive board UI.
//
// The boardgame.io tutorial normally requires cloning a template repo, running
// `npm i`, and starting a dev server on http://localhost:3000. But the *game
// logic* a student writes — the `setup`, `moves`, `turn`, `endIf` and
// `ai.enumerate` of a Game object — is plain JavaScript. It doesn't need React
// or a server to run.
//
// This module reimplements just enough of the boardgame.io runtime to execute
// a student's Game object directly in the browser, plus a clickable Tic-Tac-Toe
// board + debug panel that mirror what the real `Client` + Debug Panel give you.
// That's the "online-first" port: write the same code, run it right here.
//
// Like helpers.js, the UI pieces need the runtime's `html`, so they live behind
// a `createGameUI({ html })` factory. The pure engine is exported directly.

// boardgame.io's real INVALID_MOVE sentinel is the string "INVALID_MOVE".
export const INVALID_MOVE = "INVALID_MOVE";

// === Loading the student's Game object =======================================
//
// The student writes code like:
//
//   import { INVALID_MOVE } from 'boardgame.io/core';
//   export const TicTacToe = { setup() {...}, moves: {...} };
//   function isVictory(cells) { ... }
//
// We can't actually `import` from a package in a sandbox, and `export` only
// works in real modules. So we strip both, inject `INVALID_MOVE` and a
// capturing `console` as function arguments (so the Game's functions use them),
// and evaluate the code to pull out the named binding.
export function loadGame(code, { console: fakeConsole, name = "TicTacToe" } = {}) {
  const cleaned = code
    // drop `import { ... } from 'boardgame.io/...'` lines
    .replace(/^\s*import\s+[^;\n]*from\s+['"]boardgame\.io[^'"]*['"];?\s*$/gm, "")
    // turn `export const/function/let/var` into a plain declaration
    .replace(/\bexport\s+(const|function|let|var)/g, "$1");

  const body = `${cleaned}\n;return typeof ${name} !== "undefined" ? ${name} : undefined;`;
  const cons = fakeConsole ?? console;
  const game = new Function("INVALID_MOVE", "console", body)(INVALID_MOVE, cons);
  return game;
}

// === The mini engine =========================================================
//
// Mirrors the slice of boardgame.io the tutorial touches:
//   - setup({ ctx })                       → initial G
//   - moves.<name>(move, ...args)          → mutate move.G, or return INVALID_MOVE
//   - turn.minMoves / turn.maxMoves        → automatic / guarded endTurn
//   - endIf({ G, ctx })                    → { winner } | { draw: true } | undefined
//   - ai.enumerate(G, ctx, playerID)       → [{ move, args }, ...]
//
// `G` is treated as mutable inside a move (the tutorial writes
// `move.G.cells[i] = ...`). Real boardgame.io achieves this with immer; we copy
// G before a move and only commit the copy if the move wasn't rejected, so an
// INVALID_MOVE leaves the state untouched.
export function createEngine(game, { numPlayers = 2 } = {}) {
  if (!game || typeof game !== "object") {
    throw new Error("Es wurde kein Game-Objekt gefunden (z. B. `export const TicTacToe = { ... }`).");
  }

  const ctx = {
    numPlayers,
    currentPlayer: 0,
    turn: 1,
    gameover: undefined,
    // not part of boardgame.io's public ctx, but handy for the board:
    _numMoves: 0
  };

  const events = {
    endTurn: () => endTurn()
  };

  let G = game.setup ? game.setup({ ctx }) : {};

  function endTurn() {
    ctx.currentPlayer = (ctx.currentPlayer + 1) % numPlayers;
    ctx.turn += 1;
    ctx._numMoves = 0;
  }

  // Returns { ok, reason?, gameover? }. reason ∈ {gameover, unknown, minmoves, invalid, error}
  function makeMove(name, ...args) {
    if (ctx.gameover) return { ok: false, reason: "gameover" };

    const fn = game.moves && game.moves[name];
    if (typeof fn !== "function") return { ok: false, reason: "unknown", name };

    const minMoves = game.turn && game.turn.minMoves;
    const maxMoves = game.turn && game.turn.maxMoves;

    // Work on a copy so a rejected move can't leave half-applied mutations.
    const draft = structuredClone(G);
    const move = { G: draft, ctx, playerID: ctx.currentPlayer, events };

    let result;
    try {
      result = fn(move, ...args);
    } catch (e) {
      return { ok: false, reason: "error", message: e.message };
    }

    if (result === INVALID_MOVE) return { ok: false, reason: "invalid" };

    // commit
    G = draft;
    ctx._numMoves += 1;

    // check for game over after every state change
    if (game.endIf) {
      let over;
      try {
        over = game.endIf({ G, ctx });
      } catch (e) {
        return { ok: false, reason: "error", message: "endIf: " + e.message };
      }
      if (over) {
        ctx.gameover = over;
        return { ok: true, gameover: over };
      }
    }

    // auto end the turn once the player has used up their moves
    if (maxMoves != null && ctx._numMoves >= maxMoves) endTurn();

    return { ok: true };
  }

  // Guarded manual endTurn (respects minMoves, like the Debug Panel's endTurn).
  function tryEndTurn() {
    if (ctx.gameover) return { ok: false, reason: "gameover" };
    const minMoves = game.turn && game.turn.minMoves;
    if (minMoves != null && ctx._numMoves < minMoves) {
      return { ok: false, reason: "minmoves", minMoves };
    }
    endTurn();
    return { ok: true };
  }

  // Ask the Game's bot for the moves it considers possible right now.
  function enumerate() {
    if (!game.ai || typeof game.ai.enumerate !== "function") return null;
    return game.ai.enumerate(G, ctx, ctx.currentPlayer);
  }

  return {
    get G() { return G; },
    ctx,
    makeMove,
    tryEndTurn,
    enumerate,
    hasMove: (name) => !!(game.moves && typeof game.moves[name] === "function"),
    hasAI: () => !!(game.ai && typeof game.ai.enumerate === "function")
  };
}

// === UI factory ==============================================================

export function createGameUI({ html }) {
  // Render a single value for the state view.
  function fmt(v) {
    try { return JSON.stringify(v); } catch { return String(v); }
  }

  // A capturing console so console.log inside moves shows up under the board.
  function makeCapture() {
    const lines = [];
    const push = (prefix) => (...args) =>
      lines.push(prefix + args.map((a) => (typeof a === "string" ? a : fmt(a))).join(" "));
    return { lines, console: { log: push(""), error: push("⚠ "), warn: push("⚠ ") } };
  }

  // Symbol shown in a board cell for a given playerID (0 → ✕, 1 → ◯).
  function mark(v) {
    if (v === 0 || v === "0") return "✕";
    if (v === 1 || v === "1") return "◯";
    if (v == null) return "";
    return String(v);
  }

  function statusLine(engine) {
    const go = engine.ctx.gameover;
    if (go) {
      if (go.draw) return html`<div class="bg-status bg-status-draw">🤝 Unentschieden!</div>`;
      if (go.winner != null)
        return html`<div class="bg-status bg-status-win">🎉 Spieler ${mark(go.winner)} (ID ${go.winner}) gewinnt!</div>`;
      return html`<div class="bg-status bg-status-win">Spiel vorbei: <code>${fmt(go)}</code></div>`;
    }
    const p = engine.ctx.currentPlayer;
    return html`<div class="bg-status">Am Zug: <b>Spieler ${mark(p)}</b> (ID ${p})</div>`;
  }

  /**
   * Interactive Tic-Tac-Toe board driven by the student's Game object.
   *
   * `code` is the student's source (reactive — the cell re-runs and the board
   * rebuilds whenever the editor publishes new code).
   *
   * opts:
   *   - showDebug:  show a Debug-Panel-like control (cell index input + move/endTurn)
   *   - showBot:    show "play" / "simulate" bot buttons (needs ai.enumerate)
   *   - showState:  show the raw game state G as JSON (default true)
   *   - hint:       optional extra note shown under the board
   */
  function gameBoard(code, opts = {}) {
    const { showDebug = false, showBot = false, showState = true } = opts;
    const root = html`<div class="bg-game"></div>`;

    let engine;
    const cap = makeCapture();
    try {
      const game = loadGame(code, { console: cap.console });
      engine = createEngine(game);
    } catch (e) {
      root.appendChild(html`<div class="feedback feedback-err">❌ ${e.message}</div>`);
      return root;
    }

    const notice = html`<div class="bg-notice"></div>`;
    function flash(node) {
      notice.innerHTML = "";
      if (node) notice.appendChild(node);
    }

    function cellBtn(i) {
      const val = engine.G && engine.G.cells ? engine.G.cells[i] : null;
      const btn = html`<button class="bg-cell" ${engine.ctx.gameover ? "disabled" : ""}>${mark(val)}</button>`;
      btn.addEventListener("click", () => {
        cap.lines.length = 0;
        const res = engine.makeMove("clickCell", i);
        if (!res.ok) {
          if (res.reason === "unknown")
            flash(html`<div class="feedback feedback-hint">⏳ Es gibt noch keinen <code>clickCell</code>-Move in <code>moves</code>.</div>`);
          else if (res.reason === "invalid")
            flash(html`<div class="feedback feedback-err">❌ Ungültiger Zug — die Zelle ist schon belegt.</div>`);
          else if (res.reason === "error")
            flash(html`<div class="feedback feedback-err">❌ Fehler im Move: ${res.message}</div>`);
          else if (res.reason === "gameover")
            flash(html`<div class="feedback feedback-hint">⏳ Das Spiel ist vorbei — setz das Spiel zurück.</div>`);
        } else {
          flash(null);
        }
        render();
      });
      return btn;
    }

    function boardGrid() {
      const cells = (engine.G && engine.G.cells) || new Array(9).fill(null);
      const grid = html`<div class="bg-board"></div>`;
      for (let i = 0; i < 9; i++) grid.appendChild(cellBtn(i));
      return grid;
    }

    function debugPanel() {
      const idx = html`<input class="bg-idx" type="number" min="0" max="8" value="0" style="width:4em">`;
      const moveBtn = html`<button class="run-button" type="button">clickCell(…)</button>`;
      moveBtn.addEventListener("click", () => {
        cap.lines.length = 0;
        const res = engine.makeMove("clickCell", Number(idx.value));
        if (!res.ok && res.reason === "invalid")
          flash(html`<div class="feedback feedback-err">❌ Ungültiger Zug.</div>`);
        else if (!res.ok && res.reason === "unknown")
          flash(html`<div class="feedback feedback-hint">⏳ Kein <code>clickCell</code>-Move definiert.</div>`);
        else flash(null);
        render();
      });
      const endBtn = html`<button class="reset-button" type="button">endTurn</button>`;
      endBtn.addEventListener("click", () => {
        const res = engine.tryEndTurn();
        if (!res.ok && res.reason === "minmoves")
          flash(html`<div class="feedback feedback-err">❌ Du musst erst einen Zug machen (<code>minMoves: ${res.minMoves}</code>).</div>`);
        else flash(null);
        render();
      });
      return html`<div class="bg-debug">
        <span class="bg-debug-label">Debug Panel:</span>
        <code>clickCell(</code>${idx}<code>)</code> ${moveBtn} ${endBtn}
      </div>`;
    }

    function botPanel() {
      if (!engine.hasAI()) {
        return html`<div class="bg-notice"><div class="feedback feedback-hint">⏳ Noch kein <code>ai.enumerate</code> definiert — füg es hinzu, um den Bot zu aktivieren.</div></div>`;
      }
      const playBtn = html`<button class="run-button" type="button">🤖 play (ein Zug)</button>`;
      playBtn.addEventListener("click", () => { botStep(); render(); });
      const simBtn = html`<button class="run-button" type="button">⏩ simulate (ganzes Spiel)</button>`;
      simBtn.addEventListener("click", () => {
        let guard = 0;
        while (!engine.ctx.gameover && guard < 200) {
          if (!botStep()) break;
          guard++;
        }
        render();
      });
      return html`<div class="bg-debug"><span class="bg-debug-label">Bot:</span> ${playBtn} ${simBtn}</div>`;
    }

    // One bot move: ask enumerate for options, pick one at random, play it.
    // (The real framework uses MCTS to pick *good* moves; our in-browser bot
    // picks randomly among whatever enumerate returns — enough to show that
    // enumerate must list *all* valid moves.)
    let rngState = 0x2545f491;
    function rnd(n) { rngState = (rngState * 1103515245 + 12345) & 0x7fffffff; return rngState % n; }
    function botStep() {
      let options;
      try { options = engine.enumerate(); }
      catch (e) { flash(html`<div class="feedback feedback-err">❌ Fehler in enumerate: ${e.message}</div>`); return false; }
      if (!Array.isArray(options) || options.length === 0) {
        flash(html`<div class="feedback feedback-hint">⏳ <code>enumerate</code> hat keine Züge zurückgegeben.</div>`);
        return false;
      }
      const choice = options[rnd(options.length)];
      const res = engine.makeMove(choice.move, ...(choice.args || []));
      // a random pick may land on an occupied cell if enumerate over-reports;
      // just retry a couple times so simulate doesn't stall
      if (!res.ok && res.reason === "invalid") {
        for (const o of options) {
          const r = engine.makeMove(o.move, ...(o.args || []));
          if (r.ok) return true;
        }
        return false;
      }
      return res.ok;
    }

    function render() {
      root.innerHTML = "";
      root.appendChild(statusLine(engine));
      root.appendChild(boardGrid());
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
        const cells = (engine.G && engine.G.cells) || [];
        root.appendChild(html`<details class="bg-state"><summary>Spielzustand <code>G</code></summary>
          <div class="console-output" style="margin-top:.4em">
            <div class="console-line">G = ${fmt(engine.G)}</div>
            <div class="console-line">ctx.currentPlayer = ${fmt(engine.ctx.currentPlayer)}</div>
            <div class="console-line">ctx.gameover = ${fmt(engine.ctx.gameover)}</div>
          </div></details>`);
      }

      if (opts.hint) root.appendChild(html`<div class="feedback feedback-hint">⏳ ${opts.hint}</div>`);

      const resetBtn = html`<button class="reset-button" type="button" style="margin-top:.5em">↺ Spiel zurücksetzen</button>`;
      resetBtn.addEventListener("click", () => {
        cap.lines.length = 0;
        try {
          const game = loadGame(code, { console: cap.console });
          engine = createEngine(game);
        } catch (e) { /* keep old engine */ }
        flash(null);
        render();
      });
      root.appendChild(resetBtn);
    }

    render();
    return root;
  }

  return { gameBoard, loadGame };
}
