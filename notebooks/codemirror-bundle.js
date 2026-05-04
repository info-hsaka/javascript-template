// Re-exports all CodeMirror pieces from a single module graph so Vite
// deduplicates @codemirror/state. Importing the @codemirror packages
// individually via npm: specifiers loads multiple copies of the state
// module, which breaks instanceof checks at runtime.
export { basicSetup, EditorView } from "codemirror";
export { javascript } from "@codemirror/lang-javascript";
export { keymap } from "@codemirror/view";
export { indentWithTab } from "@codemirror/commands";
export { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
export { tags } from "@lezer/highlight";
