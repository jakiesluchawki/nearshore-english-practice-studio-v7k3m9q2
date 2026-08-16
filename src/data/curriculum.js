import curriculumText from "./curriculum.md?raw";

const moduleColors = [
  "rose",
  "blue",
  "olive",
  "plum",
  "violet",
  "sand",
  "sky",
  "coral",
  "moss",
  "ink",
];

const moduleShortTitles = [
  "Gdy brakuje słów",
  "Pierwszy screening",
  "Sourcing i kontakt",
  "Profil techniczny",
  "Projekt i rola",
  "Logistyka i stawka",
  "Proces i interview",
  "Feedback i decyzje",
  "Oferta i negocjacje",
  "Pełne rozmowy",
];

const candidateLines = {
  1: [
    "Sorry, could we keep this quite brief today?",
    "I’m not sure I understood the last question.",
    "Could you tell me more about the project?",
  ],
  2: [
    "Yes, now is fine. What would you like to know?",
    "I’m not actively looking, but I’m open to hearing more.",
    "I have about fifteen minutes before my next meeting.",
  ],
  3: [
    "Thanks for reaching out. Could you send me the key details first?",
    "I’m not looking at the moment, but the project sounds interesting.",
    "Thursday afternoon could work for a short call.",
  ],
  4: [
    "I’ve worked with several technologies across different projects.",
    "My title is Senior Developer, although my role is quite broad.",
    "I used that tool before, but not very recently.",
  ],
  5: [
    "What would I actually be responsible for day to day?",
    "Can you tell me more about the client and the team?",
    "How flexible is the remote-work setup?",
  ],
  6: [
    "My notice period is three months, but there may be some flexibility.",
    "I’m targeting a rate above the range you mentioned.",
    "I’m already in the final stage of another process.",
  ],
  7: [
    "Could you remind me who I’ll be meeting and how long it will take?",
    "I’m worried about the technical part of the interview.",
    "The proposed time no longer works for me.",
  ],
  8: [
    "I have another offer and need to make a decision by Friday.",
    "Do you have any more detailed feedback for me?",
    "The process has taken longer than I expected.",
  ],
  9: [
    "The offer is interesting, but I expected a higher rate.",
    "My current employer has just made me a counteroffer.",
    "I need a little time to compare the full packages.",
  ],
  10: [
    "Could you be more specific about what you mean by hands-on?",
    "Sorry, the line is breaking up and I missed the technology name.",
    "I only have ten minutes, so can we focus on the key points?",
  ],
};

function readField(body, label) {
  return body.match(new RegExp(`- \\*\\*${label}:\\*\\* ([^\\n]+)`))?.[1]?.trim() || "";
}

function stripMarkdown(value) {
  return value.replace(/`/g, "").replace(/\*\*/g, "").trim().replace(/\.$/, "");
}

function parseCourse() {
  const courseOnly = curriculumText.split("\n# Generator promptów")[0];
  const moduleBlocks = courseOnly.split(/\n# Moduł /).slice(1);
  const parsedModules = [];
  const parsedLessons = [];

  moduleBlocks.forEach((block, moduleIndex) => {
    const [moduleIntro, ...lessonBlocks] = block.split(/\n### /);
    const [heading, ...introLines] = moduleIntro.trim().split("\n");
    const headingMatch = heading.match(/^(\d+)\. (.+)$/);
    const moduleId = Number(headingMatch?.[1] || moduleIndex + 1);
    const fullTitle = headingMatch?.[2] || moduleShortTitles[moduleIndex];
    const goal = introLines.join("\n").match(/Cel modułu: ([^\n]+)/)?.[1]?.trim() || "";
    const moduleLessonIds = [];

    lessonBlocks.forEach((lessonBlock) => {
      const [lessonHeading, ...bodyLines] = lessonBlock.trim().split("\n");
      const match = lessonHeading.match(/^(\d+)\. (.+)$/);
      if (!match) return;

      const id = Number(match[1]);
      const title = match[2].trim();
      const body = bodyLines.join("\n");
      const result = stripMarkdown(readField(body, "Rezultat"));
      const scene = stripMarkdown(readField(body, "Scenka"));
      const scope = stripMarkdown(readField(body, "Zakres"));
      const chatgpt = stripMarkdown(readField(body, "ChatGPT"));
      const phraseLine = readField(body, "Frazy");
      const phrases = [...phraseLine.matchAll(/`([^`]+)`/g)].map((item) => item[1].trim());
      const checkpoint = title.toLowerCase().includes("checkpoint") || id === 100;

      parsedLessons.push({
        id,
        moduleId,
        moduleTitle: moduleShortTitles[moduleIndex],
        moduleFullTitle: fullTitle,
        moduleColor: moduleColors[moduleIndex],
        title,
        goal: result || `utrwalić materiał modułu „${moduleShortTitles[moduleIndex]}”`,
        scenario: scene || scope || result,
        chatgpt,
        phrases,
        checkpoint,
        duration: checkpoint ? 18 : 16,
        candidateLine: candidateLines[moduleId][(id - 1) % candidateLines[moduleId].length],
      });
      moduleLessonIds.push(id);
    });

    parsedModules.push({
      id: moduleId,
      title: moduleShortTitles[moduleIndex],
      fullTitle,
      goal,
      color: moduleColors[moduleIndex],
      lessonIds: moduleLessonIds,
    });
  });

  parsedLessons.forEach((lesson, index) => {
    if (lesson.phrases.length) return;
    lesson.phrases = parsedLessons
      .slice(Math.max(0, index - 4), index)
      .flatMap((item) => item.phrases.slice(0, 2))
      .slice(-6);
  });

  return { modules: parsedModules, lessons: parsedLessons };
}

export const { modules, lessons } = parseCourse();

export function getLesson(id) {
  return lessons.find((lesson) => lesson.id === Number(id)) || lessons[0];
}

export function getModule(id) {
  return modules.find((module) => module.id === Number(id)) || modules[0];
}

export function lessonPrompt(lesson, mode, userInput, hardPhrases = [], myPhrases = []) {
  const modeInstructions = {
    explain: "Explain the differences between the phrases, when to use them, and any natural alternatives.",
    check: "Correct my answer. Keep my meaning, make it natural for a spoken recruiter conversation, and explain only the most important change in Polish.",
    practice: "Give me short Polish-to-English prompts and transformations. Wait for each answer before continuing.",
    roleplay: "Act as the candidate. Run a realistic role-play one turn at a time and do not give me the recruiter answer in advance.",
  };

  return `You are my English speaking coach. I work as an IT recruiter in a nearshore team and use English in almost every candidate conversation. My level is around B2. I understand English well, but I sometimes freeze when I have to speak unexpectedly. My goal is to automate natural, professional spoken English rather than learn formal grammar or corporate-sounding phrases.

Current lesson: ${lesson.id} — ${lesson.title}
Situation: ${lesson.scenario}
Lesson goal: ${lesson.goal}
Target phrases:
${lesson.phrases.map((phrase) => `- ${phrase}`).join("\n")}

Phrases I found difficult:
${hardPhrases.length ? hardPhrases.map((phrase) => `- ${phrase}`).join("\n") : "- none yet"}

My preferred phrases:
${myPhrases.length ? myPhrases.map((phrase) => `- ${phrase}`).join("\n") : "- none yet"}

Selected practice mode: ${modeInstructions[mode] || modeInstructions.roleplay}
My question or answer, if provided:
${userInput?.trim() || "No additional question."}

Use natural spoken English suitable for a capable B2 recruiter. Prefer sentences that are easy to say under pressure. Avoid LinkedIn-style corporate language and unnecessary jargon. Ask one question at a time during role-play. Do not interrupt minor mistakes. After every three answers, give one important correction in Polish, one natural corrected version in English, and one reusable phrase. Never ask for or repeat real candidate data, confidential client names, or internal project details. Start now.`;
}
