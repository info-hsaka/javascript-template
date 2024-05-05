export async function test(file, name, calls) {
    const fn = await loadUserFunction(file, name)

    assertCalls(name, fn, calls)
}

async function loadUserFunction(file, name) {
    const module = await import(`../uebungen/${file}`)
    const fun = module[name]

    if (fun == null) {
        const keys = Object.keys(module)

        console.error(
            `Wir konnten die Funktion "${name}" in der Datei "${file}" nicht finden.`,
        )

        if (keys.length == 0) {
            console.error(
                'Es sieht aus, als ob du das "export" vor der Funktion vergessen oder noch gar keine Funtion geschrieben hast.',
            )
        } else {
            console.error(
                `Vielleicht hast du dich vertippt? Wir sehen nur die ${
                    keys.length > 1
                        ? "folgenden exportierten Funktionen"
                        : "folgende exportierte Funktion"
                }: ${keys}`,
            )
        }

        process.exit(1)
    }

    return fun
}

function assertCalls(name, fn, calls) {
    calls.forEach(([args, expected]) => {
        const actual = fn(...args)

        if (!deepCompare(expected, actual)) {
            console.error(`${name} wurde mit folgenden Parametern aufgerufen:`)
            console.dir(args)

            console.error(`Wir hätten folgenden return erwartet:`)
            console.dir(expected)

            console.error(
                `Aber wir haben stattdessen folgenden return von ${name} bekommen`,
            )
            console.dir(actual)

            process.exit(1)
        }
    })

    console.log(
        `${name} hat alle Tests erfolgreich bestanden - die Übung ist gelöst!`,
    )
}

function deepCompare(a, b) {
    if (a === b) return true
    if (a == null || b == null) return false

    if (Array.isArray(a) && Array.isArray(b)) {
        return (
            a.length === b.length &&
            a.every((it, index) => deepCompare(it, b[index]))
        )
    }

    if (typeof a === "object" && typeof b === "object") {
        const aEntries = Object.entries(a)
        const bEntriesLength = Object.entries(b).length

        return (
            aEntries.length === bEntriesLength &&
            aEntries.every(([key, value]) => deepCompare(value, b[key]))
        )
    }

    return false
}
