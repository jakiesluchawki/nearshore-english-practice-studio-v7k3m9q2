import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";

globalThis.React = React;
globalThis.window = { location: { hash: "#/home" } };
globalThis.sessionStorage = { getItem: () => "yes" };

let storedProgress = {};
globalThis.localStorage = { getItem: () => JSON.stringify(storedProgress) };

const vite = await createServer({
  configFile: false,
  server: { middlewareMode: true },
  appType: "custom",
  logLevel: "silent",
});

try {
  const { App, normalizeProgress } = await vite.ssrLoadModule("/src/App.jsx");
  const render = (route) => {
    window.location.hash = `#/${route}`;
    return renderToStaticMarkup(React.createElement(App));
  };

  for (let lessonId = 1; lessonId <= 100; lessonId += 1) {
    const page = render(`lesson/${lessonId}`);
    if (!page.includes("phrase-review-buttons") || !page.includes("choice-list") || !page.includes("practice-timer")) {
      throw new Error(`Lesson ${lessonId} is missing its phrase reviews, contextual quiz or active timer.`);
    }
    if (lessonId === 99 && !page.includes("script-builder")) {
      throw new Error("Lesson 99 must render the real personal-screening builder.");
    }
    const moduleId = Math.ceil(lessonId / 10);
    if (!page.includes(`assets/modules/module-${String(moduleId).padStart(2, "0")}.webp`)) {
      throw new Error(`Lesson ${lessonId} must show the original felt illustration for its module.`);
    }
  }

  const expectedMarkers = {
    practice: "session-progress",
    cheats: "12 kroków prawdziwej rozmowy",
    rescue: "rescue-instant",
    phrases: "phrasebook-backup",
    studio: "studio-list",
    "studio/simulator": "candidate-picker",
    "studio/reflex": "reflex-stage",
    "studio/listening": "listening-stage",
    "studio/prepare": "brief-form",
    "studio/prepare/devops": "brief-form",
    "studio/simulator/devops": "candidate-picker",
    "studio/roles": "role-detail",
    "studio/situations": "field-exercise",
    "studio/natural": "natural-exercise",
    "studio/team": "field-exercise",
    "studio/messages": "writing-desk",
    "studio/journal": "journal-entry",
  };

  for (const [route, marker] of Object.entries(expectedMarkers)) {
    if (!render(route).includes(marker)) {
      throw new Error(`The ${route} route did not render its primary product surface.`);
    }
  }

  const specificBrief = render("studio/prepare/devops");
  if (!specificBrief.includes('<option value="devops" selected=""')) {
    throw new Error("A specialist role selected in the role library must carry over into its pre-call brief.");
  }
  const specialistSimulator = render("studio/simulator/devops");
  if (!specialistSimulator.includes('aria-pressed="true"><span>DevOps Engineer')) {
    throw new Error("The generated pre-call brief must continue with a candidate from the same IT specialization.");
  }

  const reflection = render("studio/journal");
  if (!reflection.includes("Przećwicz ten moment z ChatGPT")) {
    throw new Error("Post-call reflections must offer a safe contextual ChatGPT practice prompt.");
  }

  const cleaned = normalizeProgress({
    completed: [1, 63, -4, 1000],
    myPhrases: ["A useful recruiter phrase."],
    phraseSchedule: {
      invalid: null,
      "Invalid date": { rating: "good", dueDate: "not-a-date" },
    },
    reviewSchedule: { 1: "invalid", 999: "2026-01-01" },
    personalScript: { greeting: null, unknown: "Not an actual screening step." },
    studioHistory: [null, { date: "bad-date", kind: "simulation", reference: "rate-first" }, { date: "2026-01-10", kind: "unknown", reference: "x" }],
    workJournal: [null, { date: "2026-01-10", category: "Stawka", reference: "rate-first", phrase: "" }],
  });

  if (JSON.stringify(cleaned.completed) !== JSON.stringify([1, 63])
    || Object.keys(cleaned.phraseSchedule).length
    || Object.keys(cleaned.reviewSchedule).length
    || Object.keys(cleaned.personalScript).length
    || cleaned.studioHistory.length
    || cleaned.workJournal.length) {
    throw new Error("Malformed imported progress must be sanitized instead of breaking the course.");
  }

  storedProgress = { completed: Array.from({ length: 100 }, (_, index) => index + 1), myPhrases: [] };
  const finishedCourse = render("home");
  if (!finishedCourse.includes("100 lekcji za tobą") || !finishedCourse.includes("Rozwijaj rozmowę z ChatGPT")) {
    throw new Error("After lesson 100, the homepage must offer continued practice instead of an endless final lesson.");
  }

  const preserved = normalizeProgress({
    completed: [], myPhrases: ["A reusable answer."],
    studioHistory: [{ date: "2026-01-10", kind: "simulation", reference: "rate-first", responses: 5 }],
    workJournal: [{ date: "2026-01-10", category: "Stawka", reference: "rate-first", phrase: "What rate would make a move worthwhile?" }],
  });
  if (preserved.schemaVersion !== 3 || preserved.studioHistory[0]?.responses !== 5 || preserved.workJournal[0]?.category !== "Stawka") {
    throw new Error("Practice history and anonymous post-call reflections must survive safe progress migration.");
  }

  console.log(`Route check passed: 100 illustrated lessons, ${Object.keys(expectedMarkers).length} learning routes, safe studio progress migration and post-course continuation.`);
} finally {
  await vite.close();
}
