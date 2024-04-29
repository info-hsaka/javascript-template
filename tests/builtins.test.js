import { test } from "./util.js";

await test("8_builtins.js", "removeSalutation", [
  [["Fr. Mariane Liemann"], "Mariane Liemann"],
  [["Hr. Hannes Güdelhöfer"], "Hannes Güdelhöfer"],
  [["Test Eroni"], "Test Eroni"],
]);

await test("8_builtins.js", "removeString", [
  [["ABCDE", "CD"], "ABE"],
  [["String Builtins gogo", " gogo"], "String Builtins"],
  [["Apfel Birne Banane", "Apfel "], "Birne Banane"],
  [["XYZXYZ", "Z"], "XYXY"],
  [["Hello World", "Asdf"], "Hello World"],
]);
