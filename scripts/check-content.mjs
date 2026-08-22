import fs from "node:fs";
import { createServer } from "vite";
import { getDialoguePracticeContext, lessonDialogues } from "../src/data/dialogues.js";
import { screeningSteps } from "../src/data/screening.js";

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
const {
  getDuePhraseReviews, getDueReviewLessonId, getNextLessonId, getPracticeStreak,
  ratePhraseProgress, scheduleReview,
} = await vite.ssrLoadModule("/src/data/reviews.js");

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

  const { answer, acceptedAnswers, intention, options } = getLessonQuiz(lesson);
  const validQuiz = lesson.phrases.includes(answer) && intention?.trim() && options.length === 3
    && new Set(options).size === 3 && options.filter((option) => option === answer).length === 1
    && options.every((option) => lesson.phrases.includes(option))
    && acceptedAnswers.includes(answer) && acceptedAnswers.every((option) => options.includes(option));
  if (!validQuiz) {
    console.error(`Quiz ${lesson.id} must contain an authored intention and three unique options from the same lesson.`);
    await vite.close();
    process.exit(1);
  }

  if (lesson.phrases.some((phrase) => phrase.includes("…") || /\bX\b/.test(phrase))) {
    console.error(`Lesson ${lesson.id} contains an unfinished phrase instead of a complete reusable example.`);
    await vite.close();
    process.exit(1);
  }

  const context = getDialoguePracticeContext(lesson);
  if (!context.recruiterModel || context.recruiterTurnIndex < 0
    || context.recruiterTurnIndex === 0 && context.candidateLead
    || context.candidateLead && context.recruiterTurnIndex < 1) {
    console.error(`Lesson ${lesson.id} must preserve recruiter/candidate chronology in daily dialogue practice.`);
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

if (getNextLessonId({ completed: [1, 63] }, lessons) !== 2 || getNextLessonId({ completed: [] }, lessons) !== 1) {
  console.error("The main learning path must always continue from its first unfinished lesson.");
  await vite.close();
  process.exit(1);
}

if (getLessonQuiz(lessons[51]).answer !== "Do you have a preferred contract type?") {
  console.error("Lesson 52 must accept the candidate's preferred contract type, not their current contract.");
  await vite.close();
  process.exit(1);
}

if (!getLessonQuiz(lessons[31]).acceptedAnswers.includes("Which areas do you own?")) {
  console.error("Lesson 32 must accept genuinely equivalent questions about personal ownership.");
  await vite.close();
  process.exit(1);
}

const onePhraseReview = ratePhraseProgress(
  { completed: [], myPhrases: [], phraseRatings: {}, phraseSchedule: {}, practiceDays: [] },
  lessons[0].phrases[0],
  "hard",
  1,
  new Date(2026, 0, 10, 12),
);
if (Object.keys(onePhraseReview.phraseSchedule).length !== 1
  || onePhraseReview.phraseSchedule[lessons[0].phrases[0]].dueDate !== "2026-01-13"
  || onePhraseReview.phraseSchedule[lessons[0].phrases[1]]) {
  console.error("A phrase rating must schedule only the selected phrase, never the entire lesson.");
  await vite.close();
  process.exit(1);
}

const firstGoodReview = ratePhraseProgress(
  { completed: [], myPhrases: [], phraseRatings: {}, phraseSchedule: {}, practiceDays: [] },
  lessons[0].phrases[0], "good", 1, new Date(2026, 0, 10, 12),
);
const repeatedSameDay = ratePhraseProgress(firstGoodReview, lessons[0].phrases[0], "good", 1, new Date(2026, 0, 10, 18));
const nextGoodReview = ratePhraseProgress(repeatedSameDay, lessons[0].phrases[0], "good", 1, new Date(2026, 0, 17, 12));
if (repeatedSameDay.phraseSchedule[lessons[0].phrases[0]].interval !== 7
  || nextGoodReview.phraseSchedule[lessons[0].phrases[0]].interval !== 21) {
  console.error("A repeat on the same day must not accelerate spaced repetition; the next successful review should extend it to 21 days.");
  await vite.close();
  process.exit(1);
}

const favoriteReview = getDuePhraseReviews({ myPhrases: ["Saved recruiter phrase"], phraseSchedule: {} }, "2026-01-10");
if (favoriteReview.length !== 1 || !favoriteReview[0].favorite || favoriteReview[0].dueDate !== "2026-01-10") {
  console.error("A newly saved personal phrase must enter the next daily-practice queue.");
  await vite.close();
  process.exit(1);
}

const priorityReview = getDuePhraseReviews({
  myPhrases: ["Saved recruiter phrase"],
  phraseSchedule: { "Older ordinary phrase": { rating: "good", dueDate: "2026-01-01", interval: 7 } },
}, "2026-01-10");
if (priorityReview[0]?.phrase !== "Saved recruiter phrase") {
  console.error("Saved phrases must take priority over unrelated older review items.");
  await vite.close();
  process.exit(1);
}

if (getPracticeStreak(["2026-01-08", "2026-01-09", "2026-01-10"], new Date(2026, 0, 10, 12)) !== 3
  || getPracticeStreak(["2026-01-01", "2026-01-10"], new Date(2026, 0, 10, 12)) !== 1
  || getPracticeStreak([], new Date(2026, 0, 10, 12)) !== 0) {
  console.error("Practice streaks must count consecutive real practice days, not page visits.");
  await vite.close();
  process.exit(1);
}

if (screeningSteps.length !== 12 || new Set(screeningSteps.map((step) => step.id)).size !== 12
  || screeningSteps.some((step) => !step.title || !step.goal || step.variants.length < 2 || step.variants.length > 4)) {
  console.error("The first-call screening script must contain 12 unique steps with 2–4 natural variants each.");
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

const personalizedReviewPrompt = answerReviewPrompt(lessons[30], reviewAnswer, lessonDialogues[31], ["My difficult phrase"], ["My favorite phrase"]);
if (!personalizedReviewPrompt.includes("My difficult phrase") || !personalizedReviewPrompt.includes("My favorite phrase")) {
  console.error("Answer-review prompts must include the learner's difficult and preferred reusable phrases.");
  await vite.close();
  process.exit(1);
}

const intentionOnlyReview = answerReviewPrompt(
  lessons[30], reviewAnswer, [["You", "Could you briefly summarize your background?"]], [], [],
  { kind: "lesson-transform", intention: "poprosić o zwięzły przegląd kariery", reference: "Could you briefly summarize your background?" },
);
if (!intentionOnlyReview.includes("poprosić o zwięzły przegląd kariery")
  || !intentionOnlyReview.includes("Could you briefly summarize your background?")
  || intentionOnlyReview.includes("Candidate: I started in QA")) {
  console.error("Standalone speaking exercises must receive their exact intention without an unrelated candidate dialogue.");
  await vite.close();
  process.exit(1);
}

const writtenTransformReview = answerReviewPrompt(
  lessons[20], "Would you be open to a quick conversation about this role?",
  [["You", lessons[20].phrases[0]]], [], [],
  { kind: "lesson-transform", intention: lessons[20].goal, reference: lessons[20].phrases[0] },
);
if (!writtenTransformReview.includes("write one natural English recruiter message")
  || writtenTransformReview.includes("say one natural English sentence")) {
  console.error("Written lesson exercises must ask ChatGPT to assess a recruiter message rather than a spoken answer.");
  await vite.close();
  process.exit(1);
}

const writtenTranslationReview = answerReviewPrompt(
  lessons[20], "Would you be interested in learning more?", [["You", lessons[20].phrases[0]]], [], [],
  { kind: "translation", intention: lessons[20].goal, reference: lessons[20].phrases[0] },
);
if (!writtenTranslationReview.includes("natural written recruiter message")
  || writtenTranslationReview.includes("natural spoken English")) {
  console.error("Written daily translation practice must not be described to ChatGPT as spoken English.");
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

console.log(`Content check passed: ${numbers.length} lessons, ${phrases.length} phrase packs, ${dialogueIds.length} dialogues, ${lessons.length} contextual quizzes, individual phrase reviews and ${screeningSteps.length} screening steps.`);
