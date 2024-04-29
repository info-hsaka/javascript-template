import { test } from "./util.js"

await test("10_objects.js", "analyzeGrades", [
    [
        [
            [
                { subject: "Deutsch", grade: 2.3 },
                { subject: "Mathe", grade: 1.3 },
                { subject: "Erdkunde", grade: 3.3 },
            ],
        ],
        {
            averageGrade: 2.3,
            bestSubject: {
                subject: "Mathe",
                grade: 1.3,
            },
        },
    ],
    [
        [
            [
                { subject: "PoWi", grade: 4.0 },
                { subject: "Informatik", grade: 3.0 },
                { subject: "Ethik", grade: 2.0 },
                { subject: "Sport", grade: 3.0 },
            ],
        ],
        {
            averageGrade: 3.0,
            bestSubject: {
                subject: "Ethik",
                grade: 2.0,
            },
        },
    ],
])
