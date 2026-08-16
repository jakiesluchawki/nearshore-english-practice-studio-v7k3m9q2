const reviewIntervals = {
  again: 1,
  hard: 3,
  good: 7,
};

function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function scheduleReview(rating, now = new Date()) {
  const due = new Date(now);
  due.setHours(12, 0, 0, 0);
  due.setDate(due.getDate() + (reviewIntervals[rating] || reviewIntervals.good));
  return formatDate(due);
}

export function getDueReviewLessonId(progress, today = formatDate(new Date())) {
  return Object.entries(progress.reviewSchedule || {})
    .filter(([, dueDate]) => dueDate <= today)
    .map(([lessonId, dueDate]) => ({ lessonId: Number(lessonId), dueDate }))
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.lessonId - b.lessonId)[0]?.lessonId || 0;
}

export function reviewTimingLabel(rating) {
  return {
    again: "Powtórka zapisana na jutro.",
    hard: "Powtórka zapisana za 3 dni.",
    good: "Powtórka zapisana za 7 dni.",
  }[rating] || "Powtórka zapisana.";
}
