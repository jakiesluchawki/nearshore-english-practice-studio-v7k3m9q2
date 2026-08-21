const reviewIntervals = {
  again: 1,
  hard: 3,
  good: 7,
};

export function formatLocalDate(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function scheduleReview(rating, now = new Date()) {
  const due = new Date(now);
  due.setHours(12, 0, 0, 0);
  due.setDate(due.getDate() + (reviewIntervals[rating] || reviewIntervals.good));
  return formatLocalDate(due);
}

export function getDueReviewLessonId(progress, today = formatLocalDate()) {
  return Object.entries(progress.reviewSchedule || {})
    .filter(([, dueDate]) => dueDate <= today)
    .map(([lessonId, dueDate]) => ({ lessonId: Number(lessonId), dueDate }))
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.lessonId - b.lessonId)[0]?.lessonId || 0;
}

export function getNextLessonId(progress, courseLessons) {
  const completed = new Set((progress.completed || []).map(Number));
  return courseLessons.find((lesson) => !completed.has(lesson.id))?.id || courseLessons.at(-1)?.id || 1;
}

export function getPracticeStreak(practiceDays = [], now = new Date()) {
  const days = new Set(practiceDays);
  const cursor = new Date(now);
  cursor.setHours(12, 0, 0, 0);

  if (!days.has(formatLocalDate(cursor))) {
    cursor.setDate(cursor.getDate() - 1);
    if (!days.has(formatLocalDate(cursor))) return 0;
  }

  let streak = 0;
  while (days.has(formatLocalDate(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return streak;
}

export function withPracticeDay(progress, now = new Date()) {
  const today = formatLocalDate(now);
  return {
    ...progress,
    practiceDays: [...new Set([...(progress.practiceDays || []), today])].sort().slice(-180),
    lastPractice: today,
  };
}

export function ratePhraseProgress(progress, phrase, rating, lessonId = 0, now = new Date()) {
  const previous = progress.phraseSchedule?.[phrase];
  const today = formatLocalDate(now);
  const sameDay = previous?.lastReviewed === today;
  if (sameDay && previous.rating === rating) return withPracticeDay(progress, now);

  const repetitions = rating === "again" ? 0 : sameDay ? previous.repetitions || 1 : (previous?.repetitions || 0) + 1;
  const baseInterval = reviewIntervals[rating] || reviewIntervals.good;
  const interval = rating === "good" && !sameDay && previous?.rating === "good"
    ? previous.interval <= 7 ? 21 : Math.min(56, previous.interval * 2)
    : baseInterval;
  const due = new Date(now);
  due.setHours(12, 0, 0, 0);
  due.setDate(due.getDate() + interval);

  return withPracticeDay({
    ...progress,
    phraseRatings: { ...(progress.phraseRatings || {}), [phrase]: rating },
    phraseSchedule: {
      ...(progress.phraseSchedule || {}),
      [phrase]: {
        rating,
        dueDate: formatLocalDate(due),
        lastReviewed: today,
        repetitions,
        interval,
        lessonId: Number(lessonId || previous?.lessonId || 0),
      },
    },
  }, now);
}

export function getDuePhraseReviews(progress, today = formatLocalDate()) {
  const scheduled = Object.entries(progress.phraseSchedule || {})
    .filter(([, review]) => review?.dueDate && review.dueDate <= today)
    .map(([phrase, review]) => ({ phrase, ...review, favorite: (progress.myPhrases || []).includes(phrase) }));

  const unscheduledFavorites = (progress.myPhrases || [])
    .filter((phrase) => !progress.phraseSchedule?.[phrase])
    .map((phrase) => ({ phrase, dueDate: today, rating: "saved", repetitions: 0, favorite: true, lessonId: 0 }));

  const priorities = { again: 0, hard: 1, saved: 2, good: 3 };
  return [...scheduled, ...unscheduledFavorites].sort((first, second) =>
    Number(second.favorite) - Number(first.favorite)
    || (priorities[first.rating] ?? 4) - (priorities[second.rating] ?? 4)
    || first.dueDate.localeCompare(second.dueDate));
}

export function phraseReviewLabel(review) {
  if (!review?.dueDate) return "nowa";
  const today = formatLocalDate();
  if (review.dueDate <= today) return "na dziś";
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (review.dueDate === formatLocalDate(tomorrow)) return "jutro";
  return new Intl.DateTimeFormat("pl-PL", { day: "numeric", month: "short" }).format(new Date(`${review.dueDate}T12:00:00`));
}

export function reviewTimingLabel(rating) {
  return {
    again: "Powtórka zapisana na jutro.",
    hard: "Powtórka zapisana za 3 dni.",
    good: "Powtórka zapisana za 7 dni.",
  }[rating] || "Powtórka zapisana.";
}
