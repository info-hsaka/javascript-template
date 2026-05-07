// Shared module for cross-notebook progress sharing.
// Stores all student work in localStorage under the unified `jskurs:` prefix
// so a single share link can capture and restore progress across all chapters.
import LZString from "lz-string";

export const STORAGE_PREFIX = "jskurs:";
const URL_HASH_THRESHOLD = 8000;

export function exportAll() {
  const out = {};
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith(STORAGE_PREFIX)) {
      out[k.slice(STORAGE_PREFIX.length)] = localStorage.getItem(k);
    }
  }
  return out;
}

export function importAll(obj) {
  for (const [k, v] of Object.entries(obj)) {
    localStorage.setItem(STORAGE_PREFIX + k, v);
  }
}

export function encodeForUrl(obj) {
  return LZString.compressToEncodedURIComponent(JSON.stringify(obj));
}

export function decodeFromUrl(str) {
  try {
    const json = LZString.decompressFromEncodedURIComponent(str);
    return json ? JSON.parse(json) : null;
  } catch {
    return null;
  }
}

// Reads the URL hash on page load, imports any progress payload it finds,
// and strips the hash. Returns true if progress was imported.
export function installHashImport() {
  const m = location.hash.match(/^#p=(.+)$/);
  if (!m) return false;
  const data = decodeFromUrl(m[1]);
  if (!data) return false;
  importAll(data);
  history.replaceState(null, "", location.pathname + location.search);
  return true;
}

// Builds a shareable URL pointing at the index of the current notebook site.
// If the result is too long for a comfortable URL, returns null and the caller
// should offer a file download instead.
export function buildShareUrl({ baseUrl } = {}) {
  const data = exportAll();
  if (Object.keys(data).length === 0) return { kind: "empty" };
  const compressed = encodeForUrl(data);
  const root = baseUrl ?? (location.origin + location.pathname.replace(/[^/]*$/, ""));
  const url = root + "#p=" + compressed;
  if (url.length > URL_HASH_THRESHOLD) {
    return { kind: "too_long", data, length: url.length };
  }
  return { kind: "ok", url, length: url.length };
}

export function downloadAsFile(filename = "fortschritt.json") {
  const data = exportAll();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export async function importFromFile(file) {
  const text = await file.text();
  const data = JSON.parse(text);
  importAll(data);
  return data;
}

export function importFromUrl(input) {
  // Accept a full URL or just the hash payload.
  const match = input.match(/#p=(.+)$/) || input.match(/^([A-Za-z0-9+_\-/$]+)$/);
  if (!match) return null;
  const data = decodeFromUrl(match[1]);
  if (!data) return null;
  importAll(data);
  return data;
}
