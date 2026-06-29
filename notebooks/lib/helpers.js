// Central helper module for all notebooks.
//
// Notebook Kit injects `html`, `display`, `view`, etc. as local bindings in
// cells — they are NOT module globals. Helpers that use them therefore can't
// be imported directly. Instead, `createUI({ html })` is a factory that binds
// all UI helpers to the runtime's `html`.
//
// Pure logic helpers (`runWithConsole`, `runWithTimeout`, etc.) are re-exported
// as-is from their respective modules.

import {
  basicSetup,
  EditorView,
  javascript,
  keymap,
  indentWithTab,
  HighlightStyle,
  syntaxHighlighting,
  tags as t
} from "../codemirror-bundle.js";

// Syntax highlight style that mirrors Notebook Kit's prose code blocks. By
// pointing at the `--syntax-*` CSS variables Notebook Kit defines, the editor
// adopts the same colors as the markdown-rendered code in the same notebook
// — and tracks light/dark theme changes automatically.
const proseMatchHighlight = HighlightStyle.define([
  { tag: t.keyword, color: "var(--syntax-keyword)" },
  { tag: [t.atom, t.bool, t.special(t.variableName)], color: "var(--syntax-atom)" },
  { tag: [t.literal, t.number, t.unit], color: "var(--syntax-literal)" },
  { tag: [t.string, t.special(t.string), t.regexp, t.escape], color: "var(--syntax-string)" },
  { tag: [t.comment, t.lineComment, t.blockComment, t.docComment], color: "var(--syntax-comment)", fontStyle: "italic" },
  { tag: t.invalid, color: "var(--syntax-invalid)" },
  { tag: [t.definition(t.variableName), t.definition(t.propertyName), t.function(t.variableName), t.labelName, t.className], color: "var(--syntax-definition)" },
  { tag: [t.variableName, t.propertyName], color: "var(--syntax-variable)" },
  { tag: [t.meta, t.processingInstruction], color: "var(--syntax-meta)" },
  { tag: [t.operator, t.operatorKeyword, t.punctuation, t.bracket, t.separator], color: "var(--theme-foreground)" }
]);

// --- Re-exports of pure logic helpers ----------------------------------------
export {
  runWithConsole,
  runWithTimeout,
  runTestCases,
  runTestCasesWithTimeout,
  runAndExtract,
  formatValue,
  deepCompare
} from "./run.js";

export {
  installHashImport,
  buildShareUrl,
  downloadAsFile,
  importFromFile,
  importFromUrl,
  exportAll,
  importAll
} from "./progress.js";

// --- UI-Factory -------------------------------------------------------------

const STORAGE_PREFIX = "jskurs:";

/**
 * Creates all notebook UI helpers that need `html` from the runtime.
 * Call from a setup cell:
 *
 *   const { codeEditor, ok, err, hint, consoleOutput, testReport } = createUI({ html });
 */
export function createUI({ html }) {
  function codeEditor(key, { value = "", label = "Dein Code:" } = {}) {
    const storageKey = STORAGE_PREFIX + key;
    const pristine = value;             // original starter, used by reset()
    const stored = localStorage.getItem(storageKey);
    const initial = stored ?? value;

    // Two pieces of state:
    //   liveText      — what's currently in the editor (saved to localStorage on every keystroke)
    //   wrapper.value — what reactive cells see (only updated when "Run" is clicked / Cmd-Enter)
    let liveText = initial;

    function publish() {
      const text = liveText;
      wrapper.value = text;
      runBtn.classList.remove("dirty");
      wrapper.dispatchEvent(new Event("input", { bubbles: true }));
    }

    function reset() {
      if (liveText !== pristine && !confirm("Deine Änderungen verwerfen und den Code auf den Anfangszustand zurücksetzen?")) {
        return;
      }
      liveText = pristine;
      localStorage.removeItem(storageKey);
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: pristine },
        userEvent: "input.reset"
      });
      publish();
    }

    const editorEl = html`<div style="border:1px solid var(--theme-foreground-faintest);border-top-left-radius:.4em;border-top-right-radius:.4em;border-bottom:none;overflow:hidden;font-size:14px"></div>`;

    const view = new EditorView({
      doc: initial,
      extensions: [
        basicSetup,
        javascript(),
        // Apply our highlight style after basicSetup so it overrides the
        // default colors with our `--syntax-*` variables.
        syntaxHighlighting(proseMatchHighlight),
        keymap.of([
          indentWithTab,
          { key: "Mod-Enter", run: () => { publish(); return true; } }
        ]),
        EditorView.theme({
          "&": { fontSize: "14px" },
          ".cm-content": { fontFamily: "var(--monospace)", padding: "8px 0" },
          ".cm-gutters": { background: "var(--theme-background-alt)", border: "none" },
          "&.cm-focused": { outline: "none" }
        }),
        EditorView.updateListener.of((u) => {
          if (u.docChanged) {
            liveText = view.state.doc.toString();
            localStorage.setItem(storageKey, liveText);
            // Mark the run button as "dirty" so the user knows their changes
            // haven't been applied yet.
            if (liveText !== wrapper.value) runBtn.classList.add("dirty");
            else runBtn.classList.remove("dirty");
          }
        })
      ],
      parent: editorEl
    });

    const runBtn = html`<button class="run-button" type="button" title="Code ausführen (⌘/Ctrl+Enter)">▶ Ausführen</button>`;
    runBtn.addEventListener("click", () => publish());

    const resetBtn = html`<button class="reset-button" type="button" title="Auf den Anfangszustand zurücksetzen">↺ Zurücksetzen</button>`;
    resetBtn.addEventListener("click", () => reset());

    const toolbar = html`<div class="run-toolbar">${resetBtn}${runBtn}</div>`;

    const wrapper = html`<div class="code-editor">
      <div class="code-editor-label">${label}</div>
      ${editorEl}
      ${toolbar}
    </div>`;
    wrapper.value = initial;
    return wrapper;
  }

  // Runs canvas-drawing code on a REAL, on-page <canvas> (not the Web Worker
  // sandbox — the worker has no DOM and OffscreenCanvas fonts/metrics differ).
  // The student's code gets `ctx` (a 2D context) and `canvas` as locals and can
  // either draw directly (`ctx.fillRect(...)`) or define a `draw(ctx)` function
  // — if one exists it's called automatically, mirroring the App.js workflow
  // from the original tutorial.
  function canvasOutput(code, { width = 500, height = 400, background = "white" } = {}) {
    const canvas = html`<canvas class="canvas-surface" width="${width}" height="${height}"></canvas>`;
    const ctx = canvas.getContext("2d");

    // Reset to a clean, predictable starting state on every run.
    if (background) {
      ctx.fillStyle = background;
      ctx.fillRect(0, 0, width, height);
    }
    ctx.fillStyle = "black";
    ctx.strokeStyle = "black";
    ctx.lineWidth = 1;

    const logs = [];
    const fakeConsole = {
      log: (...a) => logs.push(a.map(fmtVal).join(" ")),
      error: (...a) => logs.push("⚠ " + a.map(fmtVal).join(" ")),
      warn: (...a) => logs.push("⚠ " + a.map(fmtVal).join(" "))
    };

    let error = null;
    const cleaned = code.replace(/\bexport\s+(function|const|let|async)/g, "$1");
    try {
      const body = `"use strict";\n${cleaned}\n;\nif (typeof draw === "function") draw(ctx);`;
      new Function("ctx", "canvas", "console", body)(ctx, canvas, fakeConsole);
    } catch (e) {
      error = e.message;
    }

    const wrap = html`<div class="canvas-output"></div>`;
    wrap.appendChild(html`<div class="canvas-label">Canvas</div>`);
    const frame = html`<div class="canvas-frame"></div>`;
    frame.appendChild(canvas);
    wrap.appendChild(frame);
    for (const l of logs) wrap.appendChild(html`<div class="console-line" style="font-family:var(--monospace);font-size:13px">${l}</div>`);
    if (error) wrap.appendChild(html`<div class="canvas-error">⚠ ${error}</div>`);
    return wrap;
  }

  // Runs canvas code on a hidden real canvas while RECORDING every ctx call and
  // property set, then reads the rendered pixels back via getImageData. This
  // lets exercises be graded on the *outcome* (which pixels ended up which
  // color, which calls were made) instead of diffing against a reference image.
  //
  // Each `check` is `{ name, run({ base, probe }) }` and returns `true`/`false`
  // or `{ passed, detail }`. `base` is the rendered API for the student's code
  // as-is; `probe({ callArgs })` re-runs the code and — when `extract` names a
  // function — calls that function with `callArgs` (for parametric exercises).
  function canvasTest(code, { width = 300, height = 300, background = "white", checks = [], extract = null } = {}) {
    const cleaned = code.replace(/\bexport\s+(function|const|let|async)/g, "$1");

    function colorEq(px, rgb, tol = 24) {
      return Math.abs(px[0] - rgb[0]) <= tol && Math.abs(px[1] - rgb[1]) <= tol && Math.abs(px[2] - rgb[2]) <= tol;
    }

    function probe({ callArgs = null } = {}) {
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
        set(t, p, val) { calls.push({ name: String(p), set: true, value: val }); t[p] = val; return true; }
      });
      const logs = [];
      const fakeConsole = { log: (...a) => logs.push(a.map(fmtVal).join(" ")), error: () => {}, warn: () => {} };

      let error = null, fn;
      try {
        let body = `"use strict";\n${cleaned}\n;`;
        if (extract) body += `\nreturn typeof ${extract} !== "undefined" ? ${extract} : undefined;`;
        else body += `\nif (typeof draw === "function") draw(ctx);`;
        fn = new Function("ctx", "canvas", "console", body)(ctx, canvas, fakeConsole);
        if (extract && callArgs) {
          if (typeof fn !== "function") error = `Die Funktion \`${extract}\` wurde nicht gefunden.`;
          else fn(...callArgs);
        }
      } catch (e) { error = e.message; }

      const img = real.getImageData(0, 0, width, height);
      const pixel = (x, y) => {
        const i = (Math.round(y) * width + Math.round(x)) * 4;
        return [img.data[i], img.data[i + 1], img.data[i + 2], img.data[i + 3]];
      };
      // A region/connected blob summary for a target color, sampled on a grid.
      const region = (rgb, tol = 30) => {
        let count = 0, sx = 0, sy = 0, minX = width, minY = height, maxX = 0, maxY = 0;
        for (let y = 0; y < height; y += 2) for (let x = 0; x < width; x += 2) {
          if (colorEq(pixel(x, y), rgb, tol)) {
            count++; sx += x; sy += y;
            if (x < minX) minX = x; if (x > maxX) maxX = x;
            if (y < minY) minY = y; if (y > maxY) maxY = y;
          }
        }
        return { count, cx: count ? sx / count : 0, cy: count ? sy / count : 0, minX, minY, maxX, maxY };
      };
      return {
        calls, logs, error, width, height, pixel, region, fnFound: typeof fn === "function",
        isColor: (x, y, rgb, tol) => colorEq(pixel(x, y), rgb, tol),
        isBackground: (x, y, tol) => colorEq(pixel(x, y), [255, 255, 255], tol ?? 8),
        callsTo: (name) => calls.filter(c => c.name === name && !c.set),
        setsOf: (name) => calls.filter(c => c.name === name && c.set).map(c => c.value)
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

  function canvasTestReport({ error, results }, title = "Aufgabe") {
    if (error) return err(html`Dein Code hat einen Fehler: <code>${error}</code>`);
    if (!results || !results.length) return hint(html`Schreib deine Lösung — dann prüfe ich sie automatisch.`);
    const passed = results.filter(r => r.passed).length;
    const total = results.length;
    const allOk = passed === total;
    const wrap = html`<div class="feedback ${allOk ? 'feedback-ok' : 'feedback-err'}"></div>`;
    wrap.appendChild(html`<div class="test-report-head">${allOk ? `🎉 ${title}: Alle ${total} Checks bestanden!` : `${title}: ${passed} von ${total} Checks bestanden`}</div>`);
    for (const r of results) {
      wrap.appendChild(html`<div class="test-report-row">${r.passed ? "✅" : "❌"} ${r.name}${r.detail ? html` — <span style="opacity:.8">${r.detail}</span>` : ""}</div>`);
    }
    return wrap;
  }

  function ok(msg) {
    return html`<div class="feedback feedback-ok">✅ ${msg}</div>`;
  }
  function err(msg) {
    return html`<div class="feedback feedback-err">❌ ${msg}</div>`;
  }
  function hint(msg) {
    return html`<div class="feedback feedback-hint">⏳ ${msg}</div>`;
  }

  function consoleOutput({ logs, error, timedOut }) {
    const box = html`<div class="console-output"></div>`;
    box.appendChild(html`<div class="console-label">Konsole</div>`);
    if ((logs?.length ?? 0) === 0 && !error && !timedOut) {
      box.appendChild(html`<div class="console-empty">(keine Ausgabe)</div>`);
    }
    for (const l of logs ?? []) box.appendChild(html`<div class="console-line">${l}</div>`);
    if (error) box.appendChild(html`<div class="console-error">⚠ ${error}</div>`);
    if (timedOut) box.appendChild(html`<div class="console-timeout">⏱ Dein Code lief länger als 1 Sekunde — vermutlich eine Endlosschleife.</div>`);
    return box;
  }

  function testReport({ error, results }, fnName, { summaryOnly = false } = {}) {
    if (error) return err(html`Fehler beim Laden: ${error}`);
    if (!results || !results.length) return hint(html`Schreib deine Funktion <code>${fnName}</code>.`);
    const passed = results.filter(r => r.passed).length;
    const total = results.length;
    const allOk = passed === total;
    const head = html`<div class="test-report-head">${allOk ? `🎉 Alle ${total} Tests bestanden!` : `${passed} von ${total} Tests bestanden`}</div>`;
    const wrap = html`<div class="feedback ${allOk ? 'feedback-ok' : 'feedback-err'}"></div>`;
    wrap.appendChild(head);
    // In summary-only mode (used by the boardgame tutorial) we only reveal the
    // count of passing tests, never the individual cases, so students can't read
    // the expected answers off the failing rows.
    if (summaryOnly && !allOk) return wrap;
    for (const r of results) {
      const args = r.args.map(fmtArg).join(", ");
      let row;
      if (r.passed) row = html`<div class="test-report-row">✅ <code>${fnName}(${args})</code> → <code>${fmtArg(r.actual)}</code></div>`;
      else if (r.error) row = html`<div class="test-report-row">❌ <code>${fnName}(${args})</code> → Fehler: ${r.error}</div>`;
      else row = html`<div class="test-report-row">❌ <code>${fnName}(${args})</code> → erwartet <code>${fmtArg(r.expected)}</code>, bekommen <code>${fmtArg(r.actual)}</code></div>`;
      wrap.appendChild(row);
    }
    return wrap;
  }

  return { codeEditor, ok, err, hint, consoleOutput, testReport, canvasOutput, canvasTest, canvasTestReport };
}

function fmtArg(v) {
  if (typeof v === "string") return JSON.stringify(v);
  if (v === undefined) return "undefined";
  if (v === null) return "null";
  try { return JSON.stringify(v); } catch { return String(v); }
}

/**
 * Mounts a fixed top-right button that toggles light/dark theme and persists
 * the choice to localStorage. Honors the OS preference until the user clicks
 * once; after that the explicit choice wins.
 */
export function installThemeToggle({ html, display }) {
  const root = document.documentElement;
  const STORAGE_KEY = "jskurs:theme";

  function currentTheme() {
    const explicit = root.getAttribute("data-theme");
    if (explicit === "dark" || explicit === "light") return explicit;
    return matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }

  function applyTheme(theme) {
    root.setAttribute("data-theme", theme);
    localStorage.setItem(STORAGE_KEY, theme);
    btn.textContent = theme === "dark" ? "☀️" : "🌙";
    btn.title = theme === "dark" ? "Heller Modus" : "Dunkler Modus";
  }

  const btn = html`<button class="theme-toggle" aria-label="Theme umschalten"></button>`;
  btn.addEventListener("click", () => {
    applyTheme(currentTheme() === "dark" ? "light" : "dark");
  });
  applyTheme(currentTheme());
  display(btn);
}

/**
 * If the URL contains a `#p=…` hash, imports the saved progress and shows a
 * confirmation banner. Call from each notebook's setup cell.
 *
 * The banner text stays in German since it's user-facing for the German course.
 */
export function installHashImportBanner({ html, display }) {
  const imported = doInstallHashImport();
  if (imported) {
    display(html`<div class="feedback feedback-info">
      ✅ Lösungen aus dem Link wurden geladen. Lade die Seite neu, falls du sie nicht siehst.
    </div>`);
  }
}

// Direct named-import (in addition to the re-export above) so we can call it
// from `installHashImportBanner` without a circular path.
import { installHashImport as doInstallHashImport } from "./progress.js";

// Direct import so `canvasOutput` can format console.log args without relying
// on the re-exported binding (re-exports aren't in module-local scope).
import { formatValue as fmtVal } from "./run.js";

// === Hint blockquote classifier =============================================
// Markdown blockquotes don't carry a class, so we tag them at runtime based on
// their leading emoji (💡 → tip, 📌 → info, ⚠️ → warn, 🧐 → trivia). The CSS
// in style.css then applies a subtle background and accent border per type.
const HINT_CLASS = "hint";
const HINT_KINDS = ["hint-tip", "hint-info", "hint-warn", "hint-trivia"];

function classifyHintBlockquote(bq) {
  // Strip any prior hint-* classes (handles re-classification idempotently).
  for (const cls of [HINT_CLASS, ...HINT_KINDS]) bq.classList.remove(cls);
  const text = (bq.textContent || "").trim();
  let kind = null;
  if (text.startsWith("💡") || text.startsWith("🧠")) kind = "hint-tip";
  else if (text.startsWith("📌")) kind = "hint-info";
  else if (text.startsWith("⚠")) kind = "hint-warn";
  else if (text.startsWith("🧐") || text.startsWith("🤔")) kind = "hint-trivia";
  if (kind) bq.classList.add(HINT_CLASS, kind);
}

function classifyAllHints() {
  document.querySelectorAll(".observablehq blockquote").forEach(classifyHintBlockquote);
}

// Auto-run on module load. Cells render asynchronously, so we also watch for
// new blockquotes added later via MutationObserver.
if (typeof document !== "undefined") {
  const start = () => {
    classifyAllHints();
    if (typeof MutationObserver !== "undefined") {
      const obs = new MutationObserver(classifyAllHints);
      obs.observe(document.body, { childList: true, subtree: true });
    }
  };
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
}
