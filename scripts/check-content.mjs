import fs from "node:fs";

const text = fs.readFileSync(new URL("../src/data/curriculum.md", import.meta.url), "utf8");
const matches = [...text.matchAll(/^### (\d+)\. /gm)];
const numbers = matches.map((match) => Number(match[1]));
const expected = Array.from({ length: 100 }, (_, index) => index + 1);

if (JSON.stringify(numbers) !== JSON.stringify(expected)) {
  console.error(`Expected lessons 1–100 in order, found ${numbers.length}.`);
  process.exit(1);
}

const phrases = [...text.matchAll(/- \*\*Frazy:\*\* ([^\n]+)/g)];
if (phrases.length < 70) {
  console.error(`Expected phrase packs for standard lessons, found ${phrases.length}.`);
  process.exit(1);
}

console.log(`Content check passed: ${numbers.length} lessons and ${phrases.length} authored phrase packs.`);
