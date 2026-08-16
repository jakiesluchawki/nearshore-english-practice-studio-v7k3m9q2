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
if (phrases.length !== 100) {
  console.error(`Expected one authored phrase pack for every lesson, found ${phrases.length}.`);
  process.exit(1);
}

const dialogueIds = Object.keys(lessonDialogues).map(Number);
if (JSON.stringify(dialogueIds) !== JSON.stringify(expected)) {
  console.error(`Expected mini-dialogues 1–100 in order, found ${dialogueIds.length}.`);
  process.exit(1);
}

for (const [lessonId, lines] of Object.entries(lessonDialogues)) {
  const speakers = new Set(lines.map(([speaker]) => speaker));
  const firstRecruiterTurn = lines.find(([speaker]) => speaker === "You")?.[1];
  const validLines = lines.length >= 2 && lines.length <= 4 && lines.every(([speaker, line]) => ["You", "Candidate"].includes(speaker) && line.trim());
  if (!validLines || !speakers.has("You") || !speakers.has("Candidate") || !firstRecruiterTurn?.trim()) {
    console.error(`Mini-dialogue ${lessonId} must contain 2–4 non-empty turns from both You and Candidate.`);
    process.exit(1);
  }
}

const vite = await createServer({ configFile: false, server: { middlewareMode: true }, appType: "custom", logLevel: "silent" });
const { answerReviewPrompt, lessons, lessonPrompt } = await vite.ssrLoadModule("/src/data/curriculum.js");
const { getLessonQuiz, quizBlueprints } = await vite.ssrLoadModule("/src/data/quizzes.js");
const { getLessonPractice } = await vite.ssrLoadModule("/src/data/practice.js");
const { getDueReviewLessonId, scheduleReview } = await vite.ssrLoadModule("/src/data/reviews.js");

if (lessons.length !== 100 || quizBlueprints.length !== 101) {
  console.error(`Expected 100 runtime lessons and 100 authored quiz blueprints.`);
  await vite.close();
  process.exit(1);
}

for (const lesson of lessons) {
  const minimumPhrases = lesson.checkpoint ? 6 : 3;
  if (lesson.phrases.length < minimumPhrases) {
    console.error(`Lesson ${lesson.id} requires at least ${minimumPhrases} authored phrases, found ${lesson.phrases.length}.`);
    await vite.close();
    process.exit(1);
  }

  const { answer, intention, options } = getLessonQuiz(lesson);
  const validQuiz = lesson.phrases.includes(answer) && intention?.trim() && options.length === 3 && new Set(options).size === 3 && options.filter((option) => option === answer).length === 1;
  if (!validQuiz) {
    console.error(`Quiz ${lesson.id} must contain an authored intention, one lesson answer and two unique distractors.`);
    await vite.close();
    process.exit(1);
  }

  const practice = getLessonPractice(lesson);
  const expectedPracticeType = lesson.moduleId === 3 ? "message" : "spoken";
  if (lesson.practiceType !== expectedPracticeType || !practice.introTitle || !practice.dialogueTitle.includes("własnym zdaniem") || !practice.finalTitle || !practice.finalBody) {
    console.error(`Lesson ${lesson.id} has an invalid ${lesson.practiceType} practice blueprint.`);
    await vite.close();
    process.exit(1);
  }
}

if (JSON.stringify([scheduleReview("again", new Date(2026, 0, 10, 12)), scheduleReview("hard", new Date(2026, 0, 10, 12)), scheduleReview("good", new Date(2026, 0, 10, 12))]) !== JSON.stringify(["2026-01-11", "2026-01-13", "2026-01-17"])) {
  console.error("Review intervals must schedule Again, Hard and Good after 1, 3 and 7 days.");
  await vite.close();
  process.exit(1);
}

if (getDueReviewLessonId({ reviewSchedule: { 4: "2026-01-10", 2: "2026-01-09" } }, "2026-01-10") !== 2) {
  console.error("Due reviews must prioritize the oldest scheduled lesson.");
  await vite.close();
  process.exit(1);
}

if (!lessonPrompt(lessons[20], "roleplay", "").includes("exchange of short messages") || !lessonPrompt(lessons[0], "roleplay", "").includes("spoken role-play")) {
  console.error("ChatGPT prompts must distinguish written-message practice from spoken role-play.");
  await vite.close();
  process.exit(1);
}

const reviewAnswer = "Could you tell me briefly about your career so far?";
const reviewPrompt = answerReviewPrompt(lessons[30], reviewAnswer, lessonDialogues[31]);
const reviewContextChecks = [reviewAnswer, lessons[30].goal, lessons[30].scenario, ...lessons[30].phrases, ...lessonDialogues[31].flat(), "WERDYKT", "MINI PRAKTYKA"];
if (!reviewContextChecks.every((value) => reviewPrompt.includes(value))) {
  console.error("Answer-review prompts must include the learner answer, full lesson context, dialogue and structured coaching task.");
  await vite.close();
  process.exit(1);
}

for (const lesson of lessons) {
  const prompt = answerReviewPrompt(lesson, reviewAnswer, lessonDialogues[lesson.id]);
  const fullContext = [reviewAnswer, lesson.goal, lesson.scenario, ...lesson.phrases, ...lessonDialogues[lesson.id].flat()];
  if (!fullContext.every((value) => prompt.includes(value))) {
    console.error(`Answer-review prompt ${lesson.id} is missing lesson or dialogue context.`);
    await vite.close();
    process.exit(1);
  }
}

if (Object.values(lessonDialogues).flat(2).some((value) => typeof value === "string" && value.includes("złotych per hour"))) {
  console.error("English dialogues must use PLN, not mixed Polish-English currency wording.");
  await vite.close();
  process.exit(1);
}

await vite.close();

console.log(`Content check passed: ${numbers.length} lessons, ${phrases.length} authored phrase packs, ${dialogueIds.length} mini-dialogues, ${lessons.length} authored quizzes and review scheduling.`);
