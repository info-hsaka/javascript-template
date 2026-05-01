// Central helper module for all notebooks.
//
// Notebook Kit injects `html`, `display`, `view`, etc. as local bindings in
// cells — they are NOT module globals. Helpers that use them therefore can't
// be imported directly. Instead, `createUI({ html })` is a factory that binds
// all UI helpers to the runtime's `html`.
//
// Pure logic helpers (`runWithConsole`, `runWithTimeout`, etc.) are re-exported
// as-is from their respective modules.

import { basicSetup, EditorView, javascript, keymap, indentWithTab } from "../codemirror-bundle.js";

// --- Re-exports of pure logic helpers ----------------------------------------
export {
  runWithConsole,
  runWithTimeout,
  runTestCases,
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
  function codeEditor(key, { value = "", label = "Dein Code:", minHeight = "auto" } = {}) {
    const storageKey = STORAGE_PREFIX + key;
    const stored = localStorage.getItem(storageKey);
    const initial = stored ?? value;

    const editorEl = html`<div style="border:1px solid var(--theme-foreground-faintest);border-radius:.4em;overflow:hidden;font-size:14px;min-height:${minHeight}"></div>`;

    const view = new EditorView({
      doc: initial,
      extensions: [
        basicSetup,
        javascript(),
        keymap.of([indentWithTab]),
        EditorView.theme({
          "&": { fontSize: "14px" },
          ".cm-content": { fontFamily: "var(--monospace)", padding: "8px 0" },
          ".cm-gutters": { background: "var(--theme-background-alt)", border: "none" },
          "&.cm-focused": { outline: "none" }
        }),
        EditorView.updateListener.of((u) => {
          if (u.docChanged) {
            const text = view.state.doc.toString();
            wrapper.value = text;
            localStorage.setItem(storageKey, text);
            wrapper.dispatchEvent(new Event("input", { bubbles: true }));
          }
        })
      ],
      parent: editorEl
    });

    const wrapper = html`<div style="margin:.5em 0">
      <div style="font: 500 13px/1.4 var(--sans-serif); color: var(--theme-foreground-muted); margin-bottom: 4px">${label}</div>
      ${editorEl}
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
    const box = html`<div style="font-family:var(--monospace);font-size:13px;background:var(--theme-background-alt);border:1px solid var(--theme-foreground-faintest);border-radius:.4em;padding:.5em .75em;margin:.4em 0 1em;line-height:1.5"></div>`;
    const label = html`<div style="font: 500 10px/1 var(--sans-serif);color:var(--theme-foreground-muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:.3em">Konsole</div>`;
    box.appendChild(label);
    if ((logs?.length ?? 0) === 0 && !error && !timedOut) {
      box.appendChild(html`<div style="color:var(--theme-foreground-muted);font-style:italic">(keine Ausgabe)</div>`);
    }
    for (const l of logs ?? []) box.appendChild(html`<div style="white-space:pre-wrap">${l}</div>`);
    if (error) box.appendChild(html`<div style="color:var(--err-text, #a32a1a);white-space:pre-wrap;margin-top:.2em">⚠ ${error}</div>`);
    if (timedOut) box.appendChild(html`<div style="color:var(--hint-text, #7a5a00);margin-top:.3em">⏱ Dein Code lief länger als 1 Sekunde — vermutlich eine Endlosschleife.</div>`);
    return box;
  }

  function testReport({ error, results }, fnName) {
    if (error) return err(html`Fehler beim Laden: ${error}`);
    if (!results || !results.length) return hint(html`Schreib deine Funktion <code>${fnName}</code>.`);
    const passed = results.filter(r => r.passed).length;
    const total = results.length;
    const allOk = passed === total;
    const head = html`<div style="font-weight:600;margin-bottom:.4em">${allOk ? `🎉 Alle ${total} Tests bestanden!` : `${passed} von ${total} Tests bestanden`}</div>`;
    const wrap = html`<div class="feedback ${allOk ? 'feedback-ok' : 'feedback-err'}"></div>`;
    wrap.appendChild(head);
    for (const r of results) {
      const args = r.args.map(fmtArg).join(", ");
      let row;
      if (r.passed) row = html`<div style="font-family:var(--monospace);font-size:12px">✅ <code>${fnName}(${args})</code> → <code>${fmtArg(r.actual)}</code></div>`;
      else if (r.error) row = html`<div style="font-family:var(--monospace);font-size:12px">❌ <code>${fnName}(${args})</code> → Fehler: ${r.error}</div>`;
      else row = html`<div style="font-family:var(--monospace);font-size:12px">❌ <code>${fnName}(${args})</code> → erwartet <code>${fmtArg(r.expected)}</code>, bekommen <code>${fmtArg(r.actual)}</code></div>`;
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
