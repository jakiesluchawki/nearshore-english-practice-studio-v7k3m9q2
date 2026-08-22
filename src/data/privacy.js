const emailPattern = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
const datePattern = /\b(?:\d{4}[-./]\d{1,2}[-./]\d{1,2}|\d{1,2}[-./]\d{1,2}[-./]\d{2,4})\b/g;
const monetaryAmount = String.raw`(?:\d{1,3}(?:[\u00a0 ,.']\d{3})+|\d+(?:[.,]\d+)?)`;
const amountRange = String.raw`${monetaryAmount}(?:[\t ]*(?:-|–|to)[\t ]*${monetaryAmount})?`;
const currencyAfter = new RegExp(String.raw`\b${amountRange}[\t ]*(?:PLN|EUR|USD|GBP|zł)(?=$|[\s,.;:/)])`, "gi");
const currencyBefore = new RegExp(String.raw`\b(?:PLN|EUR|USD|GBP)[\t ]*${amountRange}\b`, "gi");
const phoneCandidate = /(?:\+\d[\d().\- \t]{7,}\d|\b\d[\d().\- \t]{7,}\d\b)/g;

export function containsPersonalContact(value) {
  const text = String(value || "");
  if (emailPattern.test(text)) return true;

  const safeRecruitmentText = text
    .replace(datePattern, " ")
    .replace(currencyAfter, " ")
    .replace(currencyBefore, " ");

  return [...safeRecruitmentText.matchAll(phoneCandidate)].some(([candidate]) => {
    const digits = candidate.replace(/\D/g, "");
    return digits.length >= 9 && digits.length <= 15;
  });
}

export function withoutPersonalContacts(phrases = []) {
  return phrases.filter((phrase) => typeof phrase === "string" && !containsPersonalContact(phrase));
}
