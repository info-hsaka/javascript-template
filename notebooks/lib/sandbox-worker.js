// Web Worker that runs untrusted student code with a console.log capture.
// The main thread terminates this worker after a timeout to handle infinite loops.

function formatValue(v) {
  if (typeof v === "string") return v;
  if (v === undefined) return "undefined";
  if (v === null) return "null";
  if (typeof v === "object") {
    try { return JSON.stringify(v); } catch { return String(v); }
  }
  return String(v);
}

self.addEventListener("message", (e) => {
  const { code } = e.data;
  const fakeConsole = {
    log: (...args) => self.postMessage({ type: "log", line: args.map(formatValue).join(" ") }),
    error: (...args) => self.postMessage({ type: "log", line: "⚠ " + args.map(formatValue).join(" ") }),
    warn: (...args) => self.postMessage({ type: "log", line: "⚠ " + args.map(formatValue).join(" ") })
  };
  try {
    new Function("console", code)(fakeConsole);
    self.postMessage({ type: "done" });
  } catch (err) {
    self.postMessage({ type: "error", message: err.message });
  }
});
