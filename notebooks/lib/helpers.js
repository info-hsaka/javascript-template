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

  return { codeEditor, ok, err, hint, consoleOutput, testReport };
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
