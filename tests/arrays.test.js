import { test } from "./util.js"

await test("9_arrays.js", "filterStrings", [
    [[["Abcdefgh", "Blub", "Saft"]], ["Saft", "Abcdefgh"]],
    [[["1234", ""]], []],
    [[["sss", "Hello"]], ["Hello"]],
])
