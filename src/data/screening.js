export const screeningSteps = [
  {
    id: "greeting",
    title: "Greeting & small talk",
    goal: "przywitaj się i sprawdź, czy to nadal dobry moment",
    lessonId: 1,
    variants: [
      "Hi, thanks for taking the time to speak with me today.",
      "Hi, how are you doing today? Is now still a good time?",
      "Thanks for joining. Have you got around twenty minutes for a quick chat?",
    ],
  },
  {
    id: "reason",
    title: "Reason for calling",
    goal: "powiedz krótko, dlaczego dzwonisz",
    lessonId: 12,
    variants: [
      "I’m calling about a role that could be a good match for your experience.",
      "I wanted to tell you about an opportunity we’re working on.",
      "I came across your profile and thought this project might be relevant to you.",
    ],
  },
  {
    id: "opportunity",
    title: "Introduction of the opportunity",
    goal: "zarysuj projekt i najważniejszy powód kontaktu",
    lessonId: 41,
    variants: [
      "Let me give you a quick overview of the role.",
      "The team is looking for someone with strong backend experience.",
      "It’s a long-term project with an international team and a flexible setup.",
    ],
  },
  {
    id: "interest",
    title: "Checking interest",
    goal: "sprawdź zainteresowanie bez nacisku",
    lessonId: 14,
    variants: [
      "Would you be open to hearing a little more about it?",
      "How does that sound so far?",
      "Is this the kind of opportunity you’d consider at the moment?",
    ],
  },
  {
    id: "experience",
    title: "Experience & current role",
    goal: "zrozum obecną rolę i osobiste obowiązki",
    lessonId: 16,
    variants: [
      "Could you walk me through your current role?",
      "What are you mainly responsible for at the moment?",
      "Could you give me a brief overview of your experience so far?",
    ],
  },
  {
    id: "stack",
    title: "Tech stack",
    goal: "ustal technologie używane w codziennej pracy",
    lessonId: 17,
    variants: [
      "Which technologies do you work with most often?",
      "What does your current tech stack look like?",
      "Which technologies have you worked with hands-on recently?",
    ],
  },
  {
    id: "motivation",
    title: "Motivation",
    goal: "poznaj powód rozważania zmiany",
    lessonId: 39,
    variants: [
      "What would make you consider a change right now?",
      "What matters most to you in your next role?",
      "Is there anything you’d like to have more of in your next project?",
    ],
  },
  {
    id: "availability",
    title: "Availability & notice period",
    goal: "ustal dostępność i okres wypowiedzenia",
    lessonId: 51,
    variants: [
      "What is your current notice period?",
      "When would you potentially be available to start?",
      "Is there any flexibility around your start date?",
    ],
  },
  {
    id: "rate",
    title: "Salary & rate expectations",
    goal: "zapytaj neutralnie o oczekiwania finansowe",
    lessonId: 53,
    variants: [
      "What rate range would you be looking for?",
      "Do you have a preferred salary or hourly rate in mind?",
      "What compensation range would you have in mind for a move?",
    ],
  },
  {
    id: "processes",
    title: "Other recruitment processes",
    goal: "ustal równoległe procesy i presję czasu",
    lessonId: 58,
    variants: [
      "Are you currently involved in any other recruitment processes?",
      "Are there any timelines or offers I should keep in mind?",
      "How far along are you in any other conversations?",
    ],
  },
  {
    id: "next-steps",
    title: "Explaining next steps",
    goal: "wyjaśnij dalszy proces i czas odpowiedzi",
    lessonId: 61,
    variants: [
      "Let me quickly walk you through the next steps.",
      "I’ll share your profile with the client and keep you posted.",
      "The next step would be a conversation with the hiring team.",
    ],
  },
  {
    id: "closing",
    title: "Closing the call",
    goal: "podsumuj ustalenia i naturalnie zakończ rozmowę",
    lessonId: 100,
    variants: [
      "Thanks again for your time. I’ll be in touch soon.",
      "That gives me a good picture. I’ll come back to you with an update.",
      "Before we wrap up, is there anything else you’d like to ask?",
    ],
  },
];

export function matchSavedPhrases(step, savedPhrases = [], lessonPhrases = []) {
  const related = new Set([...step.variants, ...lessonPhrases].map((phrase) => phrase.toLowerCase()));
  return savedPhrases.filter((phrase) => related.has(phrase.toLowerCase()));
}

export function screeningScriptText(selections = {}) {
  return screeningSteps.map((step, index) =>
    `${String(index + 1).padStart(2, "0")}. ${step.title}\n${selections[step.id] || step.variants[0]}`
  ).join("\n\n");
}
