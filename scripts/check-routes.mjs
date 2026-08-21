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
  }

  const expectedMarkers = {
    practice: "session-progress",
    cheats: "12 kroków prawdziwej rozmowy",
    rescue: "rescue-instant",
    phrases: "phrasebook-backup",
  };

  for (const [route, marker] of Object.entries(expectedMarkers)) {
    if (!render(route).includes(marker)) {
      throw new Error(`The ${route} route did not render its primary product surface.`);
    }
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
  });

  if (JSON.stringify(cleaned.completed) !== JSON.stringify([1, 63])
    || Object.keys(cleaned.phraseSchedule).length
    || Object.keys(cleaned.reviewSchedule).length
    || Object.keys(cleaned.personalScript).length) {
    throw new Error("Malformed imported progress must be sanitized instead of breaking the course.");
  }

  storedProgress = { completed: Array.from({ length: 100 }, (_, index) => index + 1), myPhrases: [] };
  const finishedCourse = render("home");
  if (!finishedCourse.includes("100 lekcji za tobą") || !finishedCourse.includes("Rozwijaj rozmowę z ChatGPT")) {
    throw new Error("After lesson 100, the homepage must offer continued practice instead of an endless final lesson.");
  }

  console.log("Route check passed: 100 lessons, 4 learning surfaces, safe progress migration and post-course continuation.");
} finally {
  await vite.close();
}
