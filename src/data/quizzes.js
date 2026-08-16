import { getLesson } from "./curriculum.js";
import { getLessonQuizAnswer } from "./dialogues.js";

const distractorLessonIdsByModule = {
  1: [54, 78],
  2: [64, 78],
  3: [17, 82],
  4: [63, 81],
  5: [18, 72],
  6: [16, 63],
  7: [19, 34],
  8: [44, 62],
  9: [17, 64],
};

const capstoneDistractorLessonIds = {
  91: [54, 78], 92: [63, 81], 93: [19, 63], 94: [81, 64], 95: [54, 63],
  96: [54, 81], 97: [17, 64], 98: [34, 82], 99: [54, 78], 100: [17, 64],
};

export function getLessonQuiz(lesson) {
  const answer = getLessonQuizAnswer(lesson);
  const distractorIds = capstoneDistractorLessonIds[lesson.id] || distractorLessonIdsByModule[lesson.moduleId];
  const distractors = distractorIds.map((lessonId) => getLesson(lessonId).phrases[0]);
  const choices = [...new Set([answer, ...distractors])].filter(Boolean);
  const shift = lesson.id % choices.length;
  const options = [...choices.slice(shift), ...choices.slice(0, shift)];

  return { answer, options };
}
