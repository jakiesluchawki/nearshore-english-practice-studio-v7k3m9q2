import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import {
  advanceCallTurn, callModes, candidateScenarios, difficultSituations, getRolePack,
  listeningScenarios, makeBriefLines, makeCallPrompt, makePracticePrompt,
  makeTurnReviewPrompt, openingModel, polishCalques, rolePacks, scenarioStepLine,
  stakeholderScenarios, writingScenarios,
} from "../src/data/fieldwork.js";
import { containsPersonalContact } from "../src/data/privacy.js";
import { screeningSteps } from "../src/data/screening.js";

const unique = (items, label) => {
  const ids = items.map((item) => item.id);
  assert.equal(new Set(ids).size, ids.length, `${label} must have stable, unique identifiers.`);
};

assert.equal(rolePacks.length, 8, "The role library must contain eight genuinely different IT specializations.");
assert.equal(candidateScenarios.length, 8, "The call simulator must offer eight candidate personalities.");
assert.equal(difficultSituations.length, 16, "The objection lab must cover the full sixteen authored situations.");
assert.equal(stakeholderScenarios.length, 8, "The client-and-team practice needs eight practical conversations.");
assert.equal(writingScenarios.length, 10, "The written-English studio must cover ten recruitment stages.");
assert.ok(listeningScenarios.length >= 8, "Listening practice must offer several distinct candidate statements.");
assert.ok(polishCalques.length >= 18, "The natural-English deck must contain at least eighteen corrections.");

unique(rolePacks, "Role packs");
unique(candidateScenarios, "Candidate profiles");
unique(difficultSituations, "Difficult situations");
unique(listeningScenarios, "Listening exercises");
unique(stakeholderScenarios, "Stakeholder conversations");
unique(writingScenarios, "Written-message exercises");

for (const pack of rolePacks) {
  assert.ok(pack.pitch.endsWith("."), `${pack.id} needs a complete, spoken project pitch.`);
  assert.ok(pack.stack.length >= 4 && pack.questions.length >= 3, `${pack.id} needs useful technologies and follow-up questions.`);
  assert.ok(pack.terms.length >= 3, `${pack.id} needs clear pronunciation support.`);
}

for (const scenario of candidateScenarios) {
  assert.ok(rolePacks.some((pack) => pack.id === scenario.roleId), `${scenario.id} refers to an unknown IT specialization.`);
  for (const field of ["opening", "obstacle", "strong", "repair", "accepted", "pushed", "stack", "availability", "rate", "closing"]) {
    assert.ok(typeof scenario[field] === "string" && scenario[field].trim().length > 8, `${scenario.id} is missing an authored ${field} response.`);
  }
}

const allowedSteps = new Set(screeningSteps.map((step) => step.id));
assert.deepEqual(callModes.map((mode) => mode.minutes), [5, 15, 30], "The simulator must support genuine 5, 15 and 30 minute call formats.");
assert.equal(callModes.at(-1).stepIds.length, 12, "The longest call must include the full twelve-stage screening.");
for (const mode of callModes) {
  assert.ok(mode.stepIds.every((step) => allowedSteps.has(step)), `${mode.id} uses an invalid screening stage.`);
  assert.ok(mode.stepIds.every((step) => scenarioStepLine(candidateScenarios[0], step).trim()), `${mode.id} contains an empty candidate turn.`);
}

for (const scenario of candidateScenarios) {
  for (const mode of callModes) {
    let state = {
      scenario, mode, step: 0, answer: "Thanks. Could you tell me a little more?",
      intention: "avoid", transcript: [{ speaker: "candidate", text: scenario.opening }],
      challenge: false, challengeDone: false, referenceAnswer: "Could you tell me more?",
    };
    let avoidedChallenge = false;
    for (let attempt = 0; attempt < 30 && !state.finished; attempt += 1) {
      const next = advanceCallTurn(state);
      assert.ok(next, `${scenario.id}/${mode.id} did not accept a valid recruiter response.`);
      for (let index = 1; index < next.transcript.length; index += 1) {
        assert.notEqual(next.transcript[index].speaker, next.transcript[index - 1].speaker,
          `${scenario.id}/${mode.id} must strictly alternate recruiter and candidate turns.`);
      }
      let intention = "understand";
      if (next.challenge && !avoidedChallenge) { intention = "avoid"; avoidedChallenge = true; }
      state = { ...state, ...next, intention, answer: "I understand. Let me clarify that and come back to you." };
    }
    assert.ok(state.finished, `${scenario.id}/${mode.id} must finish after handling a real objection.`);
    assert.ok(state.challengeDone, `${scenario.id}/${mode.id} must include and resolve a genuine interruption.`);
  }
}

assert.equal(scenarioStepLine(candidateScenarios[0], "availability"), candidateScenarios[0].availability,
  "Candidate availability can only follow the recruiter's availability question.");

for (const situation of difficultSituations) {
  assert.ok(situation.candidate && situation.model && situation.next, `${situation.id} needs a complete recruiter-candidate exchange.`);
  assert.ok(situation.lessonId >= 1 && situation.lessonId <= 100, `${situation.id} must link to a real existing lesson.`);
}

for (const correction of polishCalques) {
  assert.notEqual(correction.wrong, correction.right, "A natural-English contrast cannot repeat the same phrase.");
  assert.ok(correction.why.length > 15, "Every correction must include a helpful Polish explanation.");
}

const transcript = [
  { speaker: "candidate", text: "Could you tell me the maximum rate?" },
  { speaker: "recruiter", text: "The range is 180 to 200 PLN per hour. What would you need?" },
];
const callPrompt = makeCallPrompt({
  scenario: candidateScenarios[0], mode: callModes[1], transcript,
  favoritePhrases: ["I can check that for you."], difficultPhrases: ["What range would make a move worthwhile?"],
});
for (const required of [transcript[0].text, transcript[1].text, "I can check that for you.", "What range would make a move worthwhile?", "in Polish"]) {
  assert.ok(callPrompt.includes(required), `The complete-conversation ChatGPT prompt is missing: ${required}`);
}

const answerPrompt = makePracticePrompt({
  title: "Remote expectation", context: "The candidate cannot commute.",
  candidate: "I live in Gdańsk.", answer: "I will confirm the remote setup.",
  model: "Let me check whether fully remote is possible.", favoritePhrases: ["I will come back to you."], difficultPhrases: ["Is there flexibility?"],
});
for (const required of ["I live in Gdańsk.", "I will confirm the remote setup.", "I will come back to you.", "Is there flexibility?"]) {
  assert.ok(answerPrompt.includes(required), `The answer-review prompt is missing: ${required}`);
}
assert.ok(answerPrompt.includes("<learner_answer>"), "Every practice prompt must isolate the learner's exact words from its instructions.");
assert.ok(answerPrompt.includes("WERDYKT"), "Every practice prompt must ask for a concrete Polish verdict.");

const liveCandidate = candidateScenarios[0];
const beforeFirstAnswer = [{ speaker: "candidate", text: liveCandidate.opening }];
const firstReply = "I can share the current range. Which rate would make a change worthwhile?";
const firstTurnPrompt = makeTurnReviewPrompt({
  scenario: liveCandidate, mode: callModes[0], step: 0, stageTitle: "First response",
  goal: "Answer the actual budget question before continuing.", answer: firstReply,
  candidate: liveCandidate.opening, history: beforeFirstAnswer, strategy: "understand",
  favoritePhrases: ["I can check the current budget."], difficultPhrases: ["What rate works for you?"],
});
for (const required of [liveCandidate.opening, firstReply, openingModel(liveCandidate), liveCandidate.role,
  liveCandidate.stack, "Answer the actual budget question", "I can check the current budget.", "What rate works for you?",
  "Judge the actual words independently", "WERDYKT"]) {
  assert.ok(firstTurnPrompt.includes(required), `The live first-turn review is missing: ${required}`);
}
assert.ok(!firstTurnPrompt.includes(liveCandidate.accepted), "A single-turn prompt must not leak a future candidate response.");

const beforeObjectionAnswer = [
  { speaker: "candidate", text: liveCandidate.opening },
  { speaker: "recruiter", text: firstReply },
  { speaker: "candidate", text: liveCandidate.obstacle },
];
const objectionReply = "That is clear. I will check whether the client can improve the budget.";
const objectionPrompt = makeTurnReviewPrompt({
  scenario: liveCandidate, mode: callModes[1], step: 2, stageTitle: "Budget objection",
  goal: "Acknowledge the concern without inventing an approval.", answer: objectionReply,
  history: beforeObjectionAnswer, strategy: "continue", challenge: true,
  referenceAnswer: liveCandidate.strong,
});
for (const required of [liveCandidate.opening, firstReply, liveCandidate.obstacle, objectionReply, liveCandidate.strong,
  "unexpected objection", "Acknowledge the concern"]) {
  assert.ok(objectionPrompt.includes(required), `The live objection review is missing: ${required}`);
}
assert.ok(!objectionPrompt.includes(liveCandidate.accepted), "The objection review must stop at the answer being assessed.");
assert.equal(makeTurnReviewPrompt({ scenario: liveCandidate, mode: callModes[0], answer: "   " }), "",
  "Empty simulator answers must not create misleading evaluation prompts.");

const realisticRecruiterPrompt = makeTurnReviewPrompt({
  scenario: liveCandidate, mode: callModes[0], step: 0,
  answer: "The start date is 2026-10-01, and the monthly budget is 20 000 - 25 000 PLN.",
  candidate: liveCandidate.opening, history: beforeFirstAnswer,
});
assert.ok(!containsPersonalContact(realisticRecruiterPrompt),
  "Real recruitment dates and salary ranges must not prevent a safe ChatGPT answer review.");
assert.ok(containsPersonalContact(`${realisticRecruiterPrompt}\nContact: candidate@example.com`),
  "A recruiter prompt containing actual candidate contact information must be blocked.");

const ungradedSimulatorTurn = advanceCallTurn({
  scenario: liveCandidate, mode: callModes[0], step: 0,
  answer: "banana refrigerator 123", intention: "understand",
  transcript: beforeFirstAnswer, challenge: false, challengeDone: false,
  referenceAnswer: openingModel(liveCandidate),
});
assert.match(ungradedSimulatorTurn.feedback, /nie ocena twojego angielskiego/i,
  "The simulator must clearly disclose that continuing the scenario is not an English-quality assessment.");

const writingPrompt = makePracticePrompt({
  title: "Interview follow-up", context: "Send a brief update.", answer: "I will keep you posted.",
  model: "I will get back to you by Friday.", kind: "written recruiter message",
});
assert.ok(writingPrompt.includes("natural written B2 version"), "Written practice must request a useful written-language assessment.");
assert.ok(!writingPrompt.includes("simpler spoken B2 version"), "Written messages cannot be reviewed as spoken interview answers.");

const anonymousBrief = makeBriefLines({ roleId: "devops", rate: "185 PLN/h", workMode: "fully remote", start: "early October", contract: "a B2B contract", stack: "AWS and Terraform" });
const completeBrief = anonymousBrief.map((line) => line.text).join(" ");
for (const required of ["185 PLN/h", "fully remote", "early October", "AWS and Terraform"]) {
  assert.ok(completeBrief.includes(required), `The pre-call brief is missing a user-supplied field: ${required}`);
}
assert.ok(!completeBrief.includes("offers fully remote"), "Generated work-arrangement wording must be natural English.");
const unspecifiedBrief = makeBriefLines({ roleId: "java" }).map((line) => line.text).join(" ");
assert.ok(unspecifiedBrief.includes("calling from emagine"), "The recruiter's opening must introduce emagine naturally.");
assert.ok(unspecifiedBrief.includes("I am still confirming the budget."), "Unknown budgets must not pretend to be confirmed.");
assert.ok(!unspecifiedBrief.includes("arrangement is a flexible working arrangement"), "Empty brief fields must still produce natural English.");
assert.equal(getRolePack("unknown-role").id, "java", "Unknown role identifiers must fall back to a safe valid role.");

const manifest = JSON.parse(readFileSync(new URL("../public/manifest.webmanifest", import.meta.url), "utf8"));
assert.equal(manifest.start_url, "./", "The installed application must work under the GitHub Pages subpath.");
assert.equal(manifest.scope, "./", "The installed application cannot assume deployment at the domain root.");
assert.equal(manifest.icons.length, 2, "Installable mode needs both common application-icon sizes.");
for (const icon of manifest.icons) {
  const buffer = readFileSync(new URL(`../public/${icon.src.replace(/^\.\//, "")}`, import.meta.url));
  const width = buffer.readUInt32BE(16);
  const height = buffer.readUInt32BE(20);
  assert.equal(`${width}x${height}`, icon.sizes, `${icon.src} must match its advertised square app-icon size.`);
}
for (let index = 1; index <= 10; index += 1) {
  const file = new URL(`../public/assets/modules/module-${String(index).padStart(2, "0")}.webp`, import.meta.url);
  const size = statSync(file).size;
  assert.ok(size > 5000 && size < 120000, `Module ${index} needs a real, mobile-optimized illustration.`);
}

console.log("Fieldwork check passed: 24 complete alternating conversations, 16 objections, 8 IT roles, 18 natural-English corrections, 10 message scenarios and 10 optimized module illustrations.");
