// Sandbox helpers that don't depend on the Notebook Kit runtime.
// (Helpers that need `html`/`Inputs` live in `helpers.js` behind a factory.)

export function runWithConsole(code, deps = {}) {
  const logs = [];
  const fakeConsole = {
    log: (...args) => logs.push(args.map(formatValue).join(" ")),
    error: (...args) => logs.push("⚠ " + args.map(formatValue).join(" ")),
    warn: (...args) => logs.push("⚠ " + args.map(formatValue).join(" "))
  };
  const argNames = ["console", ...Object.keys(deps)];
  const argValues = [fakeConsole, ...Object.values(deps)];
  try {
    new Function(...argNames, code)(...argValues);
    return { logs, error: null, timedOut: false };
  } catch (e) {
    return { logs, error: e.message, timedOut: false };
  }
}

export function runAndExtract(code, varName, deps = {}) {
  const argNames = Object.keys(deps);
  const argValues = Object.values(deps);
  const body = `
    ${code};
    return typeof ${varName} !== "undefined" ? ${varName} : undefined;
  `;
  return new Function(...argNames, body)(...argValues);
}

export function formatValue(v) {
  if (typeof v === "string") return v;
  if (v === undefined) return "undefined";
  if (v === null) return "null";
  if (typeof v === "object") {
    try { return JSON.stringify(v); } catch { return String(v); }
  }
  return String(v);
}

// Runs code in a Web Worker with a timeout. Returns a Promise<{ logs, error, timedOut }>.
// Used for loops where infinite-loop protection is needed.
export function runWithTimeout(code, { timeoutMs = 1000 } = {}) {
  return new Promise((resolve) => {
    const worker = new Worker(new URL("./sandbox-worker.js", import.meta.url), { type: "module" });
    const logs = [];
    let settled = false;

    const finish = (payload) => {
      if (settled) return;
      settled = true;
      worker.terminate();
      clearTimeout(timer);
      resolve(payload);
    };

    const timer = setTimeout(() => {
      finish({ logs, error: null, timedOut: true });
    }, timeoutMs);

    worker.onmessage = (e) => {
      const msg = e.data;
      if (msg.type === "log") {
        logs.push(msg.line);
        if (logs.length > 5000) finish({ logs, error: "Zu viele Ausgaben — vielleicht eine Endlosschleife?", timedOut: false });
      } else if (msg.type === "done") {
        finish({ logs, error: null, timedOut: false });
      } else if (msg.type === "error") {
        finish({ logs, error: msg.message, timedOut: false });
      }
    };
    worker.onerror = (e) => {
      finish({ logs, error: e.message || "Unbekannter Fehler im Worker.", timedOut: false });
    };

    worker.postMessage({ code });
  });
}

// Loads a student-defined function from the code string and calls it against
// a list of test cases. `cases` is shaped as [[args, expected], ...].
// Returns `{ error, results: [{ args, expected, actual, passed, error? }] }`.
export function runTestCases({ code, fnName, cases }) {
  let fn;
  try {
    // Strip `export` from the student's source so the function can be called
    // inside a single-file sandbox. (In a real multi-file project `export`
    // would matter — here we simply ignore it.)
    const cleaned = code.replace(/\bexport\s+(function|const|let|async)/g, "$1");
    const body = `${cleaned}\nreturn typeof ${fnName} !== "undefined" ? ${fnName} : undefined;`;
    fn = new Function(body)();
  } catch (e) {
    return { error: e.message, results: [] };
  }
  if (typeof fn !== "function") {
    return { error: `Die Funktion \`${fnName}\` wurde nicht gefunden.`, results: [] };
  }
  const results = cases.map(([args, expected]) => {
    try {
      const actual = fn(...args);
      return { args, expected, actual, passed: deepCompare(expected, actual) };
    } catch (e) {
      return { args, expected, actual: undefined, passed: false, error: e.message };
    }
  });
  return { error: null, results };
}

export function deepCompare(a, b) {
  if (a === b) return true;
  if (a == null || b == null) return false;
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((it, i) => deepCompare(it, b[i]));
  }
  if (typeof a === "object" && typeof b === "object") {
    const aE = Object.entries(a);
    const bE = Object.entries(b);
    return aE.length === bE.length && aE.every(([k, v]) => deepCompare(v, b[k]));
  }
  return false;
}
