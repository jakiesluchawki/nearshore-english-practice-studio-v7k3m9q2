import fs from "node:fs";
import { createServer } from "vite";
import { lessonDialogues } from "../src/data/dialogues.js";

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

const dialogueIds = Object.keys(lessonDialogues).map(Number);
if (JSON.stringify(dialogueIds) !== JSON.stringify(expected)) {
  console.error(`Expected mini-dialogues 1–100 in order, found ${dialogueIds.length}.`);
  process.exit(1);
}

for (const [lessonId, lines] of Object.entries(lessonDialogues)) {
  const speakers = new Set(lines.map(([speaker]) => speaker));
  const validLines = lines.length >= 2 && lines.length <= 4 && lines.every(([speaker, line]) => ["You", "Candidate"].includes(speaker) && line.trim());
  if (!validLines || !speakers.has("You") || !speakers.has("Candidate")) {
    console.error(`Mini-dialogue ${lessonId} must contain 2–4 non-empty turns from both You and Candidate.`);
    process.exit(1);
  }
}

const vite = await createServer({ configFile: false, server: { middlewareMode: true }, appType: "custom", logLevel: "silent" });
const { lessons } = await vite.ssrLoadModule("/src/data/curriculum.js");
const { getLessonQuiz } = await vite.ssrLoadModule("/src/data/quizzes.js");

for (const lesson of lessons) {
  const { answer, options } = getLessonQuiz(lesson);
  const validQuiz = lesson.phrases.includes(answer) && options.length === 3 && new Set(options).size === 3 && options.filter((option) => option === answer).length === 1;
  if (!validQuiz) {
    console.error(`Quiz ${lesson.id} must contain one lesson answer and two unique distractors.`);
    await vite.close();
    process.exit(1);
  }
}

await vite.close();

console.log(`Content check passed: ${numbers.length} lessons, ${phrases.length} authored phrase packs, ${dialogueIds.length} mini-dialogues and ${lessons.length} quizzes.`);
