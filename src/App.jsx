import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft, ArrowRight, BookOpen, Brain, CaretDown, CaretRight,
  ChatCircleDots, Check, CheckCircle, ClipboardText, Copy, Fire,
  DownloadSimple, Headphones, Heart, House, List, ListChecks, LockKey, MagnifyingGlass,
  Microphone, NotePencil, Pause, PhoneCall, Play, Plus, ShieldCheck, Sparkle, Star, UploadSimple, X,
} from "@phosphor-icons/react";
import {
  ClozeExercise, DailyPractice, PersonalScreeningScript, PhraseReviewControls,
  PracticeTimer, VoicePractice, speakPhrase,
} from "./components/LearningExperience.jsx";
import { cheatSheets } from "./data/cheatsheets.js";
import { answerReviewPrompt, getLesson, lessonPrompt, lessons, modules } from "./data/curriculum.js";
import { getLessonDialogue } from "./data/dialogues.js";
import { getLessonPractice } from "./data/practice.js";
import { getLessonQuiz } from "./data/quizzes.js";
import {
  formatLocalDate, getDuePhraseReviews, getDueReviewLessonId, getNextLessonId,
  getPracticeStreak, phraseReviewLabel, reviewTimingLabel, scheduleReview, withPracticeDay,
} from "./data/reviews.js";
import { screeningScriptText, screeningSteps } from "./data/screening.js";

const APP_PASSWORD_HASH = "33f158fd0f2938adc78b5226c98f4c3cce25545b2979b1bd6de98c1bb53fdef3";
const publicAsset = (path) => `${import.meta.env.BASE_URL}${path}`;
const navItems = [
  { id: "home", label: "Start", icon: House },
  { id: "lessons", label: "Lekcje", icon: BookOpen },
  { id: "cheats", label: "Ściągi", icon: ClipboardText },
  { id: "rescue", label: "Ratunek", icon: Brain },
  { id: "phrases", label: "Moje", icon: Star },
];
const starterProgress = {
  schemaVersion: 2,
  completed: [],
  phraseRatings: {},
  phraseSchedule: {},
  myPhrases: [],
  reviewSchedule: {},
  personalScript: {},
  sessionHistory: [],
  practiceDays: [],
  lastLesson: 1,
  startedOn: new Date().toISOString(),
  lastVisit: "",
  visitDays: [],
};

const isRecord = (value) => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const validRatings = new Set(["again", "hard", "good"]);
const validScriptSteps = new Set(screeningSteps.map((step) => step.id));

function validLocalDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T12:00:00`);
  return !Number.isNaN(parsed.getTime()) && formatLocalDate(parsed) === value;
}

function safePhrase(value) {
  return typeof value === "string" && Boolean(value.trim()) && value.length <= 500;
}

export function normalizeProgress(value) {
  const source = isRecord(value) ? value : {};
  const completed = [...new Set((Array.isArray(source.completed) ? source.completed : [])
    .map(Number).filter((id) => Number.isInteger(id) && id >= 1 && id <= lessons.length))].sort((first, second) => first - second);
  const myPhrases = [...new Set((Array.isArray(source.myPhrases) ? source.myPhrases : [])
    .filter(safePhrase).map((phrase) => phrase.trim()))].slice(0, 1000);
  const phraseRatings = Object.fromEntries(Object.entries(isRecord(source.phraseRatings) ? source.phraseRatings : {})
    .filter(([phrase, rating]) => safePhrase(phrase) && validRatings.has(rating)).slice(0, 1000));
  const phraseSchedule = Object.fromEntries(Object.entries(isRecord(source.phraseSchedule) ? source.phraseSchedule : {})
    .filter(([phrase, review]) => safePhrase(phrase) && isRecord(review) && validRatings.has(review.rating) && validLocalDate(review.dueDate))
    .slice(0, 1000)
    .map(([phrase, review]) => [phrase, {
      rating: review.rating,
      dueDate: review.dueDate,
      lastReviewed: validLocalDate(review.lastReviewed) ? review.lastReviewed : "",
      repetitions: Math.max(0, Math.min(10000, Number.isFinite(Number(review.repetitions)) ? Math.floor(Number(review.repetitions)) : 0)),
      interval: Math.max(1, Math.min(365, Number.isFinite(Number(review.interval)) ? Math.floor(Number(review.interval)) : 1)),
      lessonId: Number.isInteger(Number(review.lessonId)) && Number(review.lessonId) >= 1 && Number(review.lessonId) <= lessons.length ? Number(review.lessonId) : 0,
    }]));
  const reviewSchedule = Object.fromEntries(Object.entries(isRecord(source.reviewSchedule) ? source.reviewSchedule : {})
    .filter(([lessonId, date]) => Number.isInteger(Number(lessonId)) && Number(lessonId) >= 1 && Number(lessonId) <= lessons.length && validLocalDate(date)));
  const personalScript = Object.fromEntries(Object.entries(isRecord(source.personalScript) ? source.personalScript : {})
    .filter(([stepId, phrase]) => validScriptSteps.has(stepId) && safePhrase(phrase)));
  const practiceDays = [...new Set((Array.isArray(source.practiceDays) ? source.practiceDays : []).filter(validLocalDate))].sort().slice(-180);
  const visitDays = [...new Set((Array.isArray(source.visitDays) ? source.visitDays : []).filter(validLocalDate))].sort().slice(-30);
  const sessionHistory = (Array.isArray(source.sessionHistory) ? source.sessionHistory : [])
    .filter((entry) => isRecord(entry) && validLocalDate(entry.date)
      && Number.isInteger(Number(entry.lessonId)) && Number(entry.lessonId) >= 1 && Number(entry.lessonId) <= lessons.length)
    .slice(-120).map((entry) => ({ date: entry.date, lessonId: Number(entry.lessonId), minutes: Math.max(0, Math.min(180, Number(entry.minutes) || 0)) }));

  return {
    ...starterProgress,
    schemaVersion: 2,
    completed,
    myPhrases,
    phraseRatings,
    phraseSchedule,
    reviewSchedule,
    personalScript,
    practiceDays,
    visitDays,
    sessionHistory,
    lastLesson: Number.isInteger(Number(source.lastLesson)) && Number(source.lastLesson) >= 1 && Number(source.lastLesson) <= lessons.length ? Number(source.lastLesson) : 1,
    startedOn: typeof source.startedOn === "string" && source.startedOn.length <= 80 ? source.startedOn : starterProgress.startedOn,
    lastVisit: validLocalDate(source.lastVisit) ? source.lastVisit : "",
    lastPractice: validLocalDate(source.lastPractice) ? source.lastPractice : "",
  };
}

function useStoredProgress() {
  const [storageWarning, setStorageWarning] = useState("");
  const [progress, setProgress] = useState(() => {
    try { return normalizeProgress(JSON.parse(localStorage.getItem("nearshore-english-progress") || "{}")); }
    catch { return normalizeProgress({}); }
  });
  const progressRef = useRef(progress);
  const update = (change) => {
    const current = progressRef.current;
    const next = normalizeProgress(typeof change === "function" ? change(current) : { ...current, ...change });
    progressRef.current = next;
    setProgress(next);
    try {
      localStorage.setItem("nearshore-english-progress", JSON.stringify(next));
      setStorageWarning("");
    } catch {
      setStorageWarning("Przeglądarka nie pozwoliła zapisać postępu. Sprawdź ustawienia prywatności albo pobierz kopię danych.");
    }
  };
  return [progress, update, storageWarning];
}

const routeFromHash = () => window.location.hash.replace(/^#\/?/, "") || "home";
function useRoute() {
  const [route, setRoute] = useState(routeFromHash);
  useEffect(() => { const handle = () => setRoute(routeFromHash()); window.addEventListener("hashchange", handle); return () => window.removeEventListener("hashchange", handle); }, []);
  const navigate = (next) => { window.location.hash = `/${next}`; window.scrollTo({ top: 0, behavior: "smooth" }); };
  return [route, navigate];
}

async function hashText(value) {
  const bytes = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(hash)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function copyText(value) {
  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand("copy");
  textarea.remove();
  if (copied) return true;

  if (navigator.clipboard?.writeText) {
    try { await navigator.clipboard.writeText(value); return true; }
    catch { /* Some Brave/privacy configurations block clipboard writes. */ }
  }
  return false;
}

function Wordmark({ button = false, onClick }) {
  const Tag = button ? "button" : "div";
  return <Tag className={`wordmark ${button ? "wordmark--button" : ""}`} onClick={onClick} aria-label={button ? "Nearshore English, strona główna" : undefined}><span>NEAR</span><span>SHORE</span><small><i /> English for IT recruitment</small></Tag>;
}

function PasswordGate({ onUnlock }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(false);
  const submit = async (event) => {
    event.preventDefault(); setChecking(true); setError("");
    const valid = (await hashText(password)) === APP_PASSWORD_HASH; setChecking(false);
    if (!valid) { setError("To nie to hasło. Sprawdź wielkie litery i znak specjalny."); return; }
    try { sessionStorage.setItem("nearshore-english-unlocked", "yes"); }
    catch { /* Privacy-oriented browsers may allow only an in-memory unlocked session. */ }
    onUnlock();
  };
  return <main className="gate">
    <section className="gate-panel"><Wordmark /><div className="gate-copy">
      <span className="eyebrow">Prywatny kurs</span><h1>Wejdź do pracowni rozmów.</h1>
      <p>100 krótkich lekcji do codziennej pracy po angielsku: od pierwszego hello po ofertę i negocjacje.</p>
      <form onSubmit={submit}><label htmlFor="course-password">Hasło dostępu</label><div className="gate-input-row"><LockKey size={20} /><input id="course-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" placeholder="Wpisz hasło" autoFocus /><button type="submit" aria-label="Otwórz kurs" disabled={checking || !password}>{checking ? <Pause size={20} /> : <ArrowRight size={20} />}</button></div>{error && <p className="form-error" role="alert">{error}</p>}</form>
      <div className="gate-note"><ShieldCheck size={18} /><span>Postęp zostaje tylko w tej przeglądarce. Nie zapisuj danych kandydatów ani poufnych informacji.</span></div>
    </div></section>
    <figure className="gate-art"><img src={publicAsset("assets/hero-recruiter-english.png")} alt="Filcowa martwa natura z zestawem słuchawkowym, laptopem, mikrofonem i kartami profili" /></figure>
  </main>;
}

function Header({ route, navigate }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const active = route.startsWith("lesson/") ? "lessons" : route === "practice" ? "home" : route.split("/")[0];
  return <><header className="app-header"><Wordmark button onClick={() => navigate("home")} />
    <nav className="desktop-nav" aria-label="Główna nawigacja">{navItems.map((item) => <button key={item.id} className={active === item.id ? "active" : ""} aria-current={active === item.id ? "page" : undefined} onClick={() => navigate(item.id)}>{item.label}</button>)}</nav>
    <button className="menu-button" aria-label="Otwórz menu" aria-expanded={menuOpen} onClick={() => setMenuOpen((value) => !value)}>{menuOpen ? <X size={23} /> : <List size={23} />}</button>
    {menuOpen && <nav className="mobile-menu" aria-label="Menu mobilne">{navItems.map(({ id, label, icon: Icon }) => <button key={id} onClick={() => { navigate(id); setMenuOpen(false); }}><Icon size={20} /><span>{label}</span><CaretRight size={16} /></button>)}</nav>}
  </header><nav className="bottom-nav" aria-label="Nawigacja dolna">{navItems.map(({ id, label, icon: Icon }) => <button key={id} className={active === id ? "active" : ""} aria-current={active === id ? "page" : undefined} onClick={() => navigate(id)}><Icon size={22} weight={active === id ? "fill" : "regular"} /><span>{label}</span></button>)}</nav></>;
}

function ProgressRing({ value }) { return <div className="progress-ring" style={{ "--progress": `${value * 3.6}deg` }} aria-label={`${value}% kursu ukończone`}><span>{value}<small>%</small></span></div>; }

function Home({ progress, navigate }) {
  const completedCount = progress.completed.length;
  const courseFinished = completedCount >= lessons.length;
  const dueReviewLessonId = getDueReviewLessonId(progress);
  const nextLessonId = dueReviewLessonId || (courseFinished ? 99 : getNextLessonId(progress, lessons));
  const nextLesson = getLesson(nextLessonId);
  const isReview = Boolean(dueReviewLessonId);
  const streak = getPracticeStreak(progress.practiceDays);
  const duePhrases = getDuePhraseReviews(progress).length;
  return <main id="main" className="home-page">
    <section className="home-hero"><div className="hero-copy"><span className="eyebrow">{courseFinished ? "100 lekcji za tobą" : "15–20 minut dziennie"}</span><h1>{courseFinished ? "Teraz rozmowa naprawdę należy do ciebie." : "Mów, zanim stres zabierze ci słowa."}</h1><p>{courseFinished ? "Wracaj do własnych fraz, buduj nowe scenariusze i rozwijaj rozmowę dalej z ChatGPT, kiedy potrzebujesz dodatkowej praktyki." : "Praktyczny angielski do pełnego cyklu rekrutacji IT. Bez szkolnych dialogów, bez korporacyjnego nadęcia, bez przełączania się między oknami."}</p><div className="hero-actions"><button className="button button--violet" onClick={() => navigate("practice")}><Play size={18} weight="fill" /> {courseFinished ? "Kontynuuj codzienną praktykę" : "Zacznij sesję na dziś"}</button><button className="button button--outline" onClick={() => navigate(courseFinished ? "lesson/100" : "rescue")}>{courseFinished ? <ChatCircleDots size={19} /> : <Brain size={19} />} {courseFinished ? "Rozwijaj rozmowę z ChatGPT" : "Potrzebuję zdania teraz"}</button></div>{duePhrases > 0 && <p className="home-review-note"><Star size={16} weight="fill" /> {duePhrases} {duePhrases === 1 ? "twoja fraza czeka" : "twoje frazy czekają"} na krótką powtórkę.</p>}</div><figure className="hero-art"><img src={publicAsset("assets/hero-recruiter-english.png")} alt="Filcowe słuchawki, mikrofon, laptop i karty profili w różowym studiu" /></figure></section>
    <section className="today-section page-width" aria-labelledby="today-title"><header className="section-heading"><div><span className="eyebrow">Twoje dzisiaj</span><h2 id="today-title">{isReview ? "Najpierw krótka powtórka." : courseFinished ? "Teraz ćwiczysz po swojemu." : "Jedna rozmowa bliżej swobody."}</h2></div><div className="streak"><Fire size={18} weight="fill" /><span>{streak ? `${streak} ${streak === 1 ? "dzień" : "dni"} praktyki` : "Twoja pierwsza sesja czeka"}</span></div></header><article className="today-card"><div className="today-number">{String(nextLesson.id).padStart(2, "0")}</div><div className="today-copy"><span className="lesson-kicker">{isReview ? "Powtórka na dziś" : courseFinished ? "Twój własny screening script" : `Moduł ${nextLesson.moduleId} · ${nextLesson.duration} min`}</span><h3>{nextLesson.title}</h3><p>{nextLesson.goal}</p><button className="text-button" onClick={() => navigate(`lesson/${nextLesson.id}`)}>{isReview ? "Powtórz lekcję" : courseFinished ? "Dopracuj własny skrypt" : "Otwórz lekcję"} <ArrowRight size={17} /></button></div><ProgressRing value={completedCount} /></article></section>
    <section className="quick-paths page-width" aria-label="Szybkie ścieżki"><button className="path-card path-card--rose" onClick={() => navigate("rescue")}><Brain size={28} /><span>Gdy pustka w głowie</span><strong>Odzyskaj rozmowę w 20 sekund</strong><ArrowRight size={19} /></button><button className="path-card path-card--blue" onClick={() => navigate("cheats")}><ClipboardText size={28} /><span>Przed telefonem</span><strong>Otwórz gotową ściągę</strong><ArrowRight size={19} /></button><button className="path-card path-card--cream" onClick={() => navigate("phrases")}><Star size={28} /><span>Twoja baza</span><strong>Powtórz zapisane frazy</strong><ArrowRight size={19} /></button></section>
    <section className="course-map page-width" aria-labelledby="map-title"><header className="section-heading"><div><span className="eyebrow">100 gotowych lekcji</span><h2 id="map-title">Od pierwszego hello po ofertę.</h2></div><button className="text-button" onClick={() => navigate("lessons")}>Cała biblioteka <ArrowRight size={17} /></button></header><div className="module-strip">{modules.map((module) => { const done = module.lessonIds.filter((id) => progress.completed.includes(id)).length; return <button key={module.id} className={`module-card tone-${module.color}`} onClick={() => navigate(`lessons/module-${module.id}`)}><span>{String(module.id).padStart(2, "0")}</span><h3>{module.title}</h3><p>{done}/10 lekcji</p><div className="mini-progress"><i style={{ width: `${done * 10}%` }} /></div></button>; })}</div></section>
    <section className="method-section"><div className="page-width method-grid"><div><span className="eyebrow">Metoda</span><h2>Najpierw mówisz. Potem odsłaniasz.</h2></div><div className="method-steps"><article><span>01</span><h3>Krótka sytuacja</h3><p>Wiesz, po co używasz zdania i w którym momencie rozmowy.</p></article><article><span>02</span><h3>Głos przed wzorem</h3><p>Próbujesz powiedzieć to po swojemu, zanim zobaczysz gotową frazę.</p></article><article><span>03</span><h3>Powrót w dobrym momencie</h3><p>Again, Hard i Good ustawiają lekkie powtórki w tej przeglądarce.</p></article></div></div></section>
  </main>;
}

function LessonLibrary({ route, progress, navigate }) {
  const routeModule = Number(route.match(/module-(\d+)/)?.[1] || 0);
  const [query, setQuery] = useState(""); const [moduleFilter, setModuleFilter] = useState(routeModule);
  const filtered = lessons.filter((lesson) => { const moduleMatch = !moduleFilter || lesson.moduleId === moduleFilter; const haystack = `${lesson.title} ${lesson.goal} ${lesson.phrases.join(" ")}`.toLowerCase(); return moduleMatch && haystack.includes(query.toLowerCase()); });
  return <main id="main" className="page page-width library-page"><header className="page-intro page-intro--with-art"><div><span className="eyebrow">Pełna baza</span><h1>100 lekcji. Każda gotowa do użycia.</h1><p>Wybierz etap procesu albo wyszukaj konkretną sytuację. Checkpointy co pięć lekcji łączą materiał w rozmowę.</p></div><img src={publicAsset("assets/lesson-library.png")} alt="Filcowy zestaw słuchawkowy, clipboard i stos kart lekcji" /></header><div className="library-tools"><label className="search-field"><MagnifyingGlass size={19} /><span className="sr-only">Szukaj lekcji</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Szukaj: stawka, feedback, tech stack…" /></label><label className="select-field"><span className="sr-only">Filtruj po module</span><select value={moduleFilter} onChange={(event) => setModuleFilter(Number(event.target.value))}><option value="0">Wszystkie moduły</option>{modules.map((module) => <option key={module.id} value={module.id}>{module.id}. {module.title}</option>)}</select><CaretDown size={16} /></label></div><p className="results-count">{filtered.length} {filtered.length === 1 ? "lekcja" : "lekcji"}</p><div className="lesson-list">{filtered.map((lesson) => { const done = progress.completed.includes(lesson.id); return <button key={lesson.id} className={`lesson-row ${lesson.checkpoint ? "checkpoint" : ""}`} onClick={() => navigate(`lesson/${lesson.id}`)}><span className="lesson-row-number">{String(lesson.id).padStart(2, "0")}</span><span className="lesson-row-copy"><small>Moduł {lesson.moduleId} · {lesson.checkpoint ? "checkpoint · " : ""}{lesson.duration} min</small><strong>{lesson.title}</strong><span>{lesson.goal}</span></span><span className={`lesson-status ${done ? "done" : ""}`}>{done ? <Check size={18} weight="bold" /> : <ArrowRight size={18} />}</span></button>; })}</div></main>;
}

function PhraseCard({ phrase, index, isSaved, onToggle, onSpeak, lessonId, progress, updateProgress }) {
  const label = `Fraza ${index + 1}`;
  return <article className="phrase-card"><span className="phrase-label">{label}</span><p lang="en">{phrase}</p><div className="phrase-actions"><button onClick={() => onSpeak(phrase)} aria-label={`Odtwórz: ${phrase}`}><Headphones size={18} /> Posłuchaj</button><button className={isSaved ? "saved" : ""} aria-pressed={isSaved} onClick={() => onToggle(phrase)} aria-label={isSaved ? "Usuń z Moich fraz" : "Dodaj do Moich fraz"}><Star size={18} weight={isSaved ? "fill" : "regular"} /> {isSaved ? "Zapisane" : "Zapisz"}</button></div><PhraseReviewControls phrase={phrase} lessonId={lessonId} progress={progress} updateProgress={updateProgress} /></article>;
}

function Reveal({ label = "Odsłoń podpowiedź", children, tone = "cream" }) {
  const [open, setOpen] = useState(false);
  return <div className={`reveal reveal--${tone}`}><button onClick={() => setOpen((value) => !value)} aria-expanded={open}>{open ? "Ukryj odpowiedź" : label} <CaretDown size={17} className={open ? "turned" : ""} /></button>{open && <div className="reveal-content">{children}</div>}</div>;
}

function PromptModal({ lesson, progress, onClose, initialMode = "roleplay", initialInput = "", reviewDialogue = null }) {
  const isAnswerReview = Boolean(reviewDialogue && initialInput.trim());
  const [mode, setMode] = useState(initialMode); const [input, setInput] = useState(initialInput); const [copied, setCopied] = useState(false); const dialogRef = useRef(null);
  const hard = Object.entries(progress.phraseSchedule || {}).filter(([, review]) => review.rating === "again" || review.rating === "hard").map(([phrase]) => phrase).slice(0, 12);
  const favorites = progress.myPhrases.slice(0, 12);
  const prompt = isAnswerReview ? answerReviewPrompt(lesson, input, reviewDialogue, hard, favorites) : lessonPrompt(lesson, mode, input, hard, favorites);
  useEffect(() => {
    const previousFocus = document.activeElement;
    dialogRef.current?.focus();
    const handle = (event) => {
      if (event.key === "Escape") { event.preventDefault(); onClose(); return; }
      if (event.key !== "Tab") return;
      const focusable = [...dialogRef.current.querySelectorAll('a[href], button:not([disabled]), textarea, input, summary, [tabindex]:not([tabindex="-1"])')];
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", handle);
    return () => { document.removeEventListener("keydown", handle); previousFocus?.focus?.(); };
  }, [onClose]);
  const copy = async () => { const success = await copyText(prompt); setCopied(success); if (success) window.setTimeout(() => setCopied(false), 2200); };
  const copyAndOpen = async () => {
    const copying = copyText(prompt);
    window.open("https://chatgpt.com/", "_blank", "noopener,noreferrer");
    const success = await copying;
    setCopied(success);
  };
  return <div className="modal-backdrop" onMouseDown={onClose}><section className={`prompt-modal ${isAnswerReview ? "prompt-modal--review" : ""}`} role="dialog" aria-modal="true" aria-labelledby="prompt-title" tabIndex={-1} ref={dialogRef} onMouseDown={(event) => event.stopPropagation()}><header><div><span className="eyebrow">Continue with ChatGPT</span><h2 id="prompt-title">{isAnswerReview ? "Poproś o konkretną ocenę." : "Zapytaj o tę lekcję."}</h2></div><button className="icon-button" onClick={onClose} aria-label="Zamknij"><X size={21} /></button></header><p className="modal-lead">{isAnswerReview ? "Gotowy prompt zawiera cel lekcji, pełny dialog, twoją odpowiedź oraz zapisane i trudne frazy. ChatGPT oceni tylko to, co naprawdę wpływa na naturalność." : "Aplikacja niczego nie wysyła. Gotowy prompt przenosi kontekst lekcji i twoje własne frazy do ChatGPT."}</p>{isAnswerReview ? <><div className="review-answer"><span>Oceniana odpowiedź</span><p lang="en">{input}</p></div><details className="prompt-preview"><summary>Podgląd pełnego promptu</summary><textarea aria-label="Gotowy prompt do oceny odpowiedzi" readOnly value={prompt} /></details></> : <><div className="mode-grid">{[["explain", "Wyjaśnij", "Różnice i użycie"], ["check", "Sprawdź", "Popraw moją wypowiedź"], ["practice", "Przećwicz", "Krótkie zadania"], ["roleplay", "Role-play", "Rozmowa krok po kroku"]].map(([id, label, note]) => <button key={id} className={mode === id ? "active" : ""} aria-pressed={mode === id} onClick={() => setMode(id)}><strong>{label}</strong><span>{note}</span></button>)}</div><label className="prompt-input"><span>Twoje pytanie albo odpowiedź <small>(opcjonalnie)</small></span><textarea value={input} onChange={(event) => setInput(event.target.value)} placeholder="Np. Czy mogę powiedzieć: How looks your notice period?" /></label></>}<div className="privacy-note"><ShieldCheck size={18} /><span>Nic nie jest wysyłane automatycznie. Nie wklejaj danych kandydatów, poufnych nazw klientów ani wewnętrznych informacji o projekcie.</span></div><div className="prompt-actions"><button className="button button--violet" onClick={copyAndOpen}>{copied ? <Check size={18} weight="bold" /> : <ChatCircleDots size={18} />} {copied ? "Skopiowano i otwarto ChatGPT" : "Skopiuj prompt i otwórz ChatGPT"}</button><button className="button button--outline" onClick={copy}><Copy size={17} /> {copied ? "Prompt skopiowany" : "Tylko skopiuj prompt"}</button></div></section></div>;
}

function LessonPage({ id, progress, updateProgress, navigate }) {
  const lesson = getLesson(id); const [promptRequest, setPromptRequest] = useState(null); const [selectedChoice, setSelectedChoice] = useState(""); const [transformDraft, setTransformDraft] = useState(""); const [dialogueDraft, setDialogueDraft] = useState(""); const [dialogueAnswer, setDialogueAnswer] = useState(""); const [addedPhrase, setAddedPhrase] = useState(lesson.phrases[0] || ""); const [customSaved, setCustomSaved] = useState(false); const [selectedRating, setSelectedRating] = useState(""); const phrases = lesson.phrases;
  const miniDialogue = getLessonDialogue(lesson);
  const dialogueTurnIndex = miniDialogue.findIndex(([speaker]) => speaker === "You");
  const dialogueModelAnswer = miniDialogue[dialogueTurnIndex]?.[1] || phrases[0];
  const dialogueLead = dialogueTurnIndex > 0 ? miniDialogue.slice(0, dialogueTurnIndex) : [];
  const dialogueFollowUp = dialogueTurnIndex >= 0 ? miniDialogue.slice(dialogueTurnIndex + 1) : miniDialogue;
  const practice = useMemo(() => getLessonPractice(lesson), [lesson.id]);
  const { answer: quizAnswer, acceptedAnswers: acceptedQuizAnswers, intention: quizIntention, options: choiceOptions } = useMemo(() => getLessonQuiz(lesson), [lesson.id]);
  useEffect(() => { setPromptRequest(null); setSelectedChoice(""); setTransformDraft(""); setDialogueDraft(""); setDialogueAnswer(""); setAddedPhrase(lesson.phrases[0] || ""); setCustomSaved(false); setSelectedRating(""); }, [lesson.id]);
  const saved = (phrase) => progress.myPhrases.includes(phrase);
  const togglePhrase = (phrase) => updateProgress((current) => ({ ...current, myPhrases: current.myPhrases.includes(phrase) ? current.myPhrases.filter((item) => item !== phrase) : [...current.myPhrases, phrase] }));
  const speak = speakPhrase;
  const rateLesson = (rating) => { updateProgress((current) => withPracticeDay({ ...current, completed: [...new Set([...current.completed, lesson.id])].sort((a, b) => a - b), reviewSchedule: { ...(current.reviewSchedule || {}), [lesson.id]: scheduleReview(rating) }, lastLesson: Math.min(100, lesson.id + 1) })); setSelectedRating(rating); };
  const insertDialogueAnswer = (event) => { event.preventDefault(); const value = dialogueDraft.trim(); if (!value) return; setDialogueAnswer(value); setAddedPhrase(value); setCustomSaved(false); updateProgress((current) => withPracticeDay(current)); };
  const editDialogueAnswer = () => { setDialogueDraft(dialogueAnswer); setDialogueAnswer(""); };
  const openAnswerReview = (answer) => { const value = answer.trim(); if (!value) return; setPromptRequest({ initialMode: "check", initialInput: value, reviewDialogue: miniDialogue }); };
  const addCustom = () => { const value = addedPhrase.trim(); if (!value) return; updateProgress((current) => ({ ...current, myPhrases: [...new Set([...current.myPhrases, value])] })); setCustomSaved(true); };
  return <main id="main" className="lesson-page"><section className={`lesson-hero tone-${lesson.moduleColor}`}><div className="lesson-hero-inner page-width"><button className="back-button" onClick={() => navigate("lessons")}><ArrowLeft size={19} /> Ścieżka nauki</button><div className="lesson-number">{String(lesson.id).padStart(2, "0")}</div><span className="lesson-kicker">Moduł {lesson.moduleId} · {lesson.checkpoint ? "checkpoint · " : ""}{lesson.duration} min</span><h1>{lesson.title}</h1><p>{lesson.goal}.</p><div className="lesson-progress-line"><i style={{ width: `${lesson.id}%` }} /><span>{lesson.id} / 100</span></div></div></section><div className="lesson-content page-width">
    <section className="lesson-block lesson-block--intro"><span className="eyebrow">01 · Sytuacja</span><h2>{practice.introTitle}</h2><p className="large-copy">{practice.introQuestion}</p><div className="speak-cue">{practice.isMessage ? <NotePencil size={24} /> : <Microphone size={24} />}<div><strong>{practice.cueTitle}</strong><span>{practice.cueNote}</span></div></div><Reveal label="Pokaż bezpieczny początek"><p className="model-answer" lang="en">{phrases[0]}</p><button className="inline-audio" onClick={() => speak(phrases[0])}><Headphones size={17} /> Posłuchaj</button></Reveal></section>
    <section className="lesson-block"><span className="eyebrow">02 · Phrase pack</span><h2>{lesson.checkpoint ? "Sześć fraz, które prowadzą rozmowę." : phrases.length === 3 ? "Trzy zdania, które wykonują pracę." : `${phrases.length} zdań, które wykonują pracę.`}</h2><p>{lesson.checkpoint ? "Potraktuj je jak mapę rozmowy. Każdą frazę możesz ocenić i powtarzać osobno." : "Wybierz frazę, która najlepiej pasuje do momentu rozmowy. Oceniasz każde zdanie osobno."}</p><div className="phrase-grid">{phrases.slice(0, 6).map((phrase, index) => <PhraseCard key={phrase} phrase={phrase} index={index} isSaved={saved(phrase)} onToggle={togglePhrase} onSpeak={speak} lessonId={lesson.id} progress={progress} updateProgress={updateProgress} />)}</div></section>
    <section className="lesson-block lesson-block--paper"><span className="eyebrow">03 · Rozpoznaj moment</span><h2>Co powiesz w tej chwili?</h2><blockquote><span>Intencja</span>Chcesz {quizIntention}. Wszystkie warianty pasują do tej rozmowy. Wybierz ten, który najdokładniej realizuje właśnie tę intencję.</blockquote><div className="choice-list">{choiceOptions.map((option) => { const isCorrect = acceptedQuizAnswers.includes(option); return <button key={option} aria-pressed={selectedChoice === option} className={selectedChoice === option ? (isCorrect ? "correct" : "incorrect") : ""} onClick={() => setSelectedChoice(option)}><span lang="en">{option}</span>{selectedChoice === option && (isCorrect ? <CheckCircle size={20} weight="fill" /> : <X size={19} />)}</button>; })}</div>{selectedChoice && <p className="choice-feedback" role="status">{acceptedQuizAnswers.includes(selectedChoice) ? selectedChoice === quizAnswer ? "Tak. To zdanie najdokładniej realizuje tę konkretną intencję." : "Tak. Ten wariant również naturalnie realizuje tę samą intencję." : `Ta fraza też pasuje do tej rozmowy, ale wykonuje inny ruch. Teraz chcesz ${quizIntention}.`}</p>}</section>
    <section className="lesson-block split-practice"><div><span className="eyebrow">{practice.transformEyebrow}</span><h2>{practice.transformTitle}</h2><p className="large-copy">{practice.transformInstruction}</p><PracticeTimer seconds={practice.pauseSeconds} lessonKey={`lesson-${lesson.id}`} title={practice.isMessage ? "Czas na wiadomość" : "Czas na odpowiedź"} /><label className="transform-answer"><span>{practice.isMessage ? "Twoja wiadomość" : "Twoja odpowiedź po angielsku"}</span><textarea value={transformDraft} onChange={(event) => setTransformDraft(event.target.value)} placeholder="Powiedz, a potem zapisz swoją wersję…" /></label><VoicePractice onTranscript={setTransformDraft} lessonKey={`lesson-transform-${lesson.id}`} /></div><Reveal label="Porównaj z odpowiedziami" tone="blue"><div className="stacked-answers">{phrases.slice(0, 3).map((phrase) => <p key={phrase} lang="en">{phrase}</p>)}</div></Reveal><ClozeExercise lesson={lesson} answer={quizAnswer} /></section>
    <section className="lesson-block lesson-block--dialogue"><span className="eyebrow">05 · Twoja kolej</span><h2>{practice.dialogueTitle}</h2><p className="dialogue-instruction">{practice.isMessage ? "Przeczytaj kontekst, napisz własną odpowiedź i wstaw ją do wymiany. Dopiero potem zobaczysz przykład z lekcji." : "Przeczytaj kontekst, powiedz odpowiedź na głos, a potem wpisz ją w brakujące miejsce. Dopiero wtedy zobaczysz przykład z lekcji."}</p><div className="dialogue">{dialogueLead.length ? dialogueLead.map(([speaker, text], index) => <div className={`dialogue-line ${speaker === "You" ? "recruiter" : "candidate"}`} key={`lead-${speaker}-${index}`}><span>{speaker}</span><p lang="en">{text}</p></div>) : <div className="dialogue-context"><span>Sytuacja</span><p>Twoim celem jest {lesson.goal}.</p></div>}{dialogueAnswer ? <><div className="dialogue-line recruiter dialogue-line--inserted"><span>You · Twoja wersja</span><p lang="en">{dialogueAnswer}</p></div>{dialogueFollowUp.map(([speaker, text], index) => { const isRecruiter = speaker === "You"; return <div className={`dialogue-line ${isRecruiter ? "recruiter" : "candidate"}`} key={`follow-up-${speaker}-${index}`}><span>{speaker}</span><p lang="en">{text}</p>{isRecruiter && <button onClick={() => speak(text)} aria-label={`Posłuchaj: ${text}`}><Play size={16} weight="fill" /></button>}</div>; })}<div className="dialogue-comparison"><div><span>Przykład z lekcji</span><p lang="en">{dialogueModelAnswer}</p></div><button className="inline-audio" onClick={() => speak(dialogueModelAnswer)}><Headphones size={17} /> Posłuchaj przykładu</button></div><div className="dialogue-result-actions"><button className="dialogue-edit" onClick={editDialogueAnswer}><NotePencil size={17} /> Zmień swoją odpowiedź</button><button className="dialogue-ai-button" onClick={() => openAnswerReview(dialogueAnswer)}><ChatCircleDots size={18} /> Niech ChatGPT oceni twoją odpowiedź</button></div><p className="dialogue-transfer" role="status"><Check size={17} weight="bold" /> Twoja wersja czeka niżej w sekcji „Twoja wersja”.</p></> : <form className="dialogue-compose" onSubmit={insertDialogueAnswer}><label htmlFor={`dialogue-answer-${lesson.id}`}><span>You</span><strong>{practice.isMessage ? "Twoja wiadomość" : "Twoja odpowiedź"}</strong></label><textarea id={`dialogue-answer-${lesson.id}`} value={dialogueDraft} onChange={(event) => setDialogueDraft(event.target.value)} placeholder={practice.isMessage ? "Napisz krótką odpowiedź po angielsku…" : "Wpisz to, co powiedziałaś po angielsku…"} /><VoicePractice onTranscript={setDialogueDraft} lessonKey={`lesson-dialogue-${lesson.id}`} /><div className="dialogue-compose-actions"><small>Możesz porównać ze wzorem albo poprosić ChatGPT o pełną ocenę.</small><div className="dialogue-compose-buttons"><button type="submit" disabled={!dialogueDraft.trim()}>Wstaw do rozmowy <ArrowRight size={17} /></button><button type="button" className="dialogue-ai-button" disabled={!dialogueDraft.trim()} onClick={() => openAnswerReview(dialogueDraft)}><ChatCircleDots size={18} /> Niech ChatGPT oceni twoją odpowiedź</button></div></div></form>}</div>{dialogueAnswer && <p className="coach-note"><Sparkle size={18} weight="fill" /><span><strong>Coach’s note:</strong> Porównaj intencję i naturalność, nie każde słowo. Jeśli twoja wersja była jasna, krótka i uprzejma, zadziałała.</span></p>}</section>
    <section className="lesson-block"><span className="eyebrow">06 · Twoja wersja</span><h2>Zapisz zdanie, którego naprawdę użyjesz.</h2><p>Możesz uprościć wzór albo dopasować go do własnego stylu. To zdanie trafi do sekcji „Moje frazy”.</p><div className="custom-phrase"><input aria-label="Zdanie do zapisania w Moich frazach" value={addedPhrase} onChange={(event) => { setAddedPhrase(event.target.value); setCustomSaved(false); }} /><button className={customSaved ? "saved" : ""} onClick={addCustom} disabled={!addedPhrase.trim()}>{customSaved ? <Check size={18} weight="bold" /> : <Plus size={18} />} {customSaved ? "Zapisano" : "Zapisz"}</button></div>{customSaved && <p className="save-feedback" role="status">Fraza jest już w sekcji „Moje”.</p>}</section>
    {lesson.id === 99 && <PersonalScreeningScript progress={progress} updateProgress={updateProgress} copyText={copyText} navigate={navigate} />}
    <section className="lesson-block lesson-block--final"><span className="eyebrow">07 · Final challenge</span><h2>{practice.finalTitle}</h2><p className="large-copy">{practice.finalBody}</p><div className="final-check"><CheckCircle size={30} /><div><strong>Gotowe?</strong><span>Oceń, jak łatwo frazy przyszły ci dziś do głowy.</span></div></div><div className="rating-buttons">{[["again", "Again", "wróć jutro"], ["hard", "Hard", "za 3 dni"], ["good", "Good", "za 7 dni"]].map(([rating, label, note]) => <button key={rating} aria-pressed={selectedRating === rating} onClick={() => rateLesson(rating)} className={`${rating === "good" ? "good " : ""}${selectedRating === rating ? "selected" : ""}`}><span>{label}</span><small>{note}</small></button>)}</div>{selectedRating && <p className="rating-feedback" role="status"><Check size={17} weight="bold" /> {reviewTimingLabel(selectedRating)}</p>}</section>
    <section className="continue-card"><ChatCircleDots size={32} /><div><span className="eyebrow">Opcjonalnie</span><h2>Dopytaj albo przećwicz dalej w ChatGPT.</h2><p>Wybierz tryb. Aplikacja przygotuje kontekst tej lekcji, trudne frazy i twoje zapisane zdania. Wszystko bez klucza API.</p></div><button className="button button--violet" onClick={() => setPromptRequest({})}>Ułóż prompt <ArrowRight size={17} /></button></section>
    <nav className="lesson-nav" aria-label="Nawigacja między lekcjami"><button disabled={lesson.id === 1} onClick={() => navigate(`lesson/${lesson.id - 1}`)}><ArrowLeft size={18} /> Poprzednia</button><span>{lesson.id} / 100</span><button disabled={lesson.id === 100} onClick={() => navigate(`lesson/${lesson.id + 1}`)}>Następna <ArrowRight size={18} /></button></nav>
  </div>{promptRequest && <PromptModal lesson={lesson} progress={progress} onClose={() => setPromptRequest(null)} {...promptRequest} />}</main>;
}

function CheatSheets({ route, progress, updateProgress, navigate }) {
  const routeSheet = route.split("/")[1];
  const [selectedId, setSelectedId] = useState(cheatSheets.some((sheet) => sheet.id === routeSheet) ? routeSheet : "first-call");
  const [copiedPhrase, setCopiedPhrase] = useState("");
  const [query, setQuery] = useState("");
  const [callMode, setCallMode] = useState(route.endsWith("/call"));
  const [checkedSteps, setCheckedSteps] = useState([]);
  const selected = cheatSheets.find((sheet) => sheet.id === selectedId) || cheatSheets[0];
  const isFullScreening = selectedId === "first-call" || selectedId === "screening";
  const visibleSheets = cheatSheets.filter((sheet) => `${sheet.title} ${sheet.subtitle}`.toLocaleLowerCase("pl-PL").includes(query.toLocaleLowerCase("pl-PL")));
  const steps = isFullScreening
    ? screeningSteps.map((step) => ({ ...step, phrases: [...new Set([progress.personalScript?.[step.id], ...step.variants])].filter(Boolean) }))
    : selected.lessonIds.map((lessonId) => { const lesson = getLesson(lessonId); return { id: `lesson-${lesson.id}`, title: lesson.title, goal: lesson.goal, lessonId: lesson.id, phrases: lesson.phrases.slice(0, 4) }; });

  useEffect(() => {
    if (routeSheet && cheatSheets.some((sheet) => sheet.id === routeSheet)) setSelectedId(routeSheet);
    setCallMode(route.endsWith("/call"));
  }, [route, routeSheet]);

  const copyPhrase = async (phrase) => { if (!await copyText(phrase)) return; setCopiedPhrase(phrase); window.setTimeout(() => setCopiedPhrase((current) => current === phrase ? "" : current), 1800); };
  const toggleFavorite = (phrase) => updateProgress((current) => ({ ...current, myPhrases: current.myPhrases.includes(phrase) ? current.myPhrases.filter((item) => item !== phrase) : [...current.myPhrases, phrase] }));
  const toggleStep = (stepId) => setCheckedSteps((current) => current.includes(stepId) ? current.filter((item) => item !== stepId) : [...current, stepId]);

  return <main id="main" className={`page page-width cheats-page ${callMode ? "cheats-page--call-mode" : ""}`}>
    {!callMode && <header className="page-intro"><span className="eyebrow">Dostępne od pierwszego dnia</span><h1>Ściągi, które trzymają rozmowę.</h1><p>Wybierz scenariusz, przypnij własne zdania i włącz zwarty tryb do prawdziwego telefonu.</p></header>}
    <label className="sheet-mobile-select"><span>Scenariusz rozmowy</span><select value={selectedId} onChange={(event) => { setSelectedId(event.target.value); setCheckedSteps([]); }}>{cheatSheets.map((sheet) => <option key={sheet.id} value={sheet.id}>{sheet.title}</option>)}</select></label>
    {callMode && <div className="call-toolbar"><div><PhoneCall size={20} /><strong>Tryb rozmowy</strong><span>{checkedSteps.length}/{steps.length} kroków</span></div><button onClick={() => setCallMode(false)}><X size={18} /> Zamknij</button></div>}
    <div className="cheats-layout"><nav className="sheet-list" aria-label="Lista ściąg"><label className="sheet-search"><MagnifyingGlass size={17} /><span className="sr-only">Szukaj scenariusza</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Szukaj scenariusza…" /></label>{visibleSheets.map((sheet) => <button key={sheet.id} className={sheet.id === selectedId ? "active" : ""} aria-current={sheet.id === selectedId ? "page" : undefined} onClick={() => { setSelectedId(sheet.id); setCheckedSteps([]); }}><span>{String(cheatSheets.indexOf(sheet) + 1).padStart(2, "0")}</span><div><strong>{sheet.title}</strong><small>{sheet.subtitle}</small></div><CaretRight size={17} /></button>)}</nav>
      <section className="sheet-detail"><header className="sheet-detail-header"><div><span className="eyebrow">{isFullScreening ? "12 kroków prawdziwej rozmowy" : "Szybka ściąga"}</span><h2>{selected.title}</h2><p>{selected.subtitle}</p></div><button className="call-mode-button" onClick={() => setCallMode((value) => !value)} aria-pressed={callMode}><PhoneCall size={19} /> {callMode ? "Pełny widok" : "Tryb rozmowy"}</button></header>
        {callMode && <div className="call-rescue-strip"><Sparkle size={17} weight="fill" /><span lang="en">Let me think for a second.</span><button onClick={() => speakPhrase("Let me think for a second.")} aria-label="Posłuchaj frazy ratunkowej"><Headphones size={16} /></button></div>}
        {steps.map((step, index) => <article className={`sheet-step ${checkedSteps.includes(step.id) ? "sheet-step--done" : ""}`} key={step.id}><button className="sheet-step-number" onClick={() => toggleStep(step.id)} aria-pressed={checkedSteps.includes(step.id)} aria-label={`${checkedSteps.includes(step.id) ? "Cofnij ukończenie" : "Oznacz jako omówiony"}: ${step.title}`}>{checkedSteps.includes(step.id) ? <Check size={19} weight="bold" /> : String(index + 1).padStart(2, "0")}</button><div><h3>{step.title}</h3><p>{step.goal}</p><div className="sheet-variants">{step.phrases.slice(0, 4).map((phrase) => { const copied = copiedPhrase === phrase; const favorite = progress.myPhrases.includes(phrase); return <div key={phrase} className="sheet-variant-row"><button lang="en" className={copied ? "copied" : ""} onClick={() => copyPhrase(phrase)} title="Kopiuj frazę">{phrase}{copied ? <Check size={15} weight="bold" /> : <Copy size={15} />}<span className="sr-only" role="status">{copied ? "Skopiowano" : ""}</span></button><button className={`sheet-star ${favorite ? "saved" : ""}`} onClick={() => toggleFavorite(phrase)} aria-pressed={favorite} aria-label={favorite ? "Usuń z Moich fraz" : "Dodaj do Moich fraz"}><Star size={16} weight={favorite ? "fill" : "regular"} /></button><button className="sheet-listen" onClick={() => speakPhrase(phrase)} aria-label={`Posłuchaj: ${phrase}`}><Headphones size={16} /></button></div>; })}</div>{!callMode && <button className="open-lesson" onClick={() => navigate(`lesson/${step.lessonId}`)}>Otwórz lekcję {step.lessonId} <ArrowRight size={16} /></button>}</div></article>)}
        {isFullScreening && <button className="text-button sheet-copy-script" onClick={() => copyPhrase(screeningScriptText(progress.personalScript || {}))}><Copy size={17} /> {copiedPhrase === screeningScriptText(progress.personalScript || {}) ? "Skrypt skopiowany" : "Skopiuj cały scenariusz"}</button>}
      </section>
    </div>
  </main>;
}

function Rescue({ progress, updateProgress, navigate }) {
  const rescueLessons = lessons.slice(0, 10).filter((lesson) => !lesson.checkpoint && lesson.phrases.length); const [openId, setOpenId] = useState(2); const [copiedPhrase, setCopiedPhrase] = useState(""); const [query, setQuery] = useState("");
  const labels = { 1: "Zacznij rozmowę", 2: "Kup kilka sekund", 3: "Poproś o powtórzenie", 4: "Popraw się bez paniki", 6: "Ustaw agendę", 7: "Sprawdź zrozumienie", 8: "Powiedz, że sprawdzisz", 9: "Zmień temat płynnie" };
  const aliases = {
    1: "zacznij witaj początek hello rozpocznij rozmowę",
    2: "sekunda sekundy sekundę myślę cisza zastanowić think second",
    3: "powtórz powtórzyć powtórzenie nie słyszę nie dosłyszałam repeat again slowly",
    4: "popraw poprawić przeformułuj inaczej rephrase clarify",
    6: "agenda plan porządek rozmowy plan call",
    7: "sprawdź zrozumiałam rozumiem czy dobrze understood mean",
    8: "sprawdzę sprawdzić sprawdzisz nie wiem nie wiem tego check information",
    9: "zmień temat wróć przejdź dalej move topic",
  };
  const searchable = (value) => value.toLocaleLowerCase("pl-PL").normalize("NFD").replace(/\p{Diacritic}/gu, "");
  const normalizedQuery = searchable(query.trim());
  const matchesLesson = (lesson) => !normalizedQuery || searchable(`${labels[lesson.id]} ${aliases[lesson.id] || ""} ${lesson.phrases.join(" ")}`).includes(normalizedQuery);
  const filteredLessons = rescueLessons.filter(matchesLesson);
  const instantPhrases = [getLesson(2), getLesson(3), getLesson(8), getLesson(7)].filter(matchesLesson).map((lesson) => ({ lesson, phrase: lesson.phrases[0] }));
  const expandedId = normalizedQuery && !filteredLessons.some((lesson) => lesson.id === openId) ? filteredLessons[0]?.id || 0 : openId;
  const toggleSave = (phrase) => updateProgress((current) => ({ ...current, myPhrases: current.myPhrases.includes(phrase) ? current.myPhrases.filter((item) => item !== phrase) : [...current.myPhrases, phrase] }));
  const copyPhrase = async (phrase) => { if (!await copyText(phrase)) return; setCopiedPhrase(phrase); window.setTimeout(() => setCopiedPhrase((current) => current === phrase ? "" : current), 1800); };
  return <main id="main" className="page rescue-page"><section className="rescue-command page-width"><div className="rescue-command-main"><span className="eyebrow">Help, my brain is empty</span><h1>Potrzebujesz zdania teraz.</h1><p>Wybierz krótką frazę i wróć do rozmowy.</p><label className="rescue-search"><MagnifyingGlass size={19} /><span className="sr-only">Wyszukaj ratunkową sytuację lub frazę</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Np. powtórz, sprawdzę, give me a second…" /></label><div className="rescue-instant" aria-label="Najważniejsze frazy ratunkowe">{instantPhrases.map(({ lesson, phrase }) => <article key={lesson.id}><span>{labels[lesson.id]}</span><p lang="en">{phrase}</p><div><button onClick={() => speakPhrase(phrase)} aria-label={`Posłuchaj: ${phrase}`}><Headphones size={17} /> Posłuchaj</button><button onClick={() => copyPhrase(phrase)}><Copy size={16} /> {copiedPhrase === phrase ? "Skopiowano" : "Kopiuj"}</button><button onClick={() => toggleSave(phrase)} aria-pressed={progress.myPhrases.includes(phrase)} aria-label={progress.myPhrases.includes(phrase) ? "Usuń z Moich fraz" : "Dodaj do Moich fraz"}><Star size={16} weight={progress.myPhrases.includes(phrase) ? "fill" : "regular"} /></button></div></article>)}</div></div><figure className="rescue-command-art"><img src={publicAsset("assets/brain-empty-rescue.png")} alt="Filcowa chmura na kole ratunkowym z dymkami rozmowy i mikrofonem" /><figcaption><Heart size={17} weight="fill" /> Nie przepraszaj za swój angielski. Kup czas, doprecyzuj albo sprawdź.</figcaption></figure></section><section className="rescue-library page-width" aria-label="Wszystkie ratunkowe sytuacje">{filteredLessons.map((lesson) => <article key={lesson.id} className={expandedId === lesson.id ? "open" : ""}><button className="rescue-toggle" aria-expanded={expandedId === lesson.id} aria-controls={expandedId === lesson.id ? `rescue-phrases-${lesson.id}` : undefined} onClick={() => setOpenId(expandedId === lesson.id ? 0 : lesson.id)}><span>{labels[lesson.id] || lesson.title}</span><CaretDown size={18} /></button>{expandedId === lesson.id && <div className="rescue-phrases" id={`rescue-phrases-${lesson.id}`}>{lesson.phrases.slice(0, 4).map((phrase) => { const isSaved = progress.myPhrases.includes(phrase); const isCopied = copiedPhrase === phrase; return <div key={phrase}><p lang="en">{phrase}</p><span><button onClick={() => speakPhrase(phrase)}><Headphones size={17} /> Posłuchaj</button><button className={isSaved ? "saved" : ""} aria-pressed={isSaved} onClick={() => toggleSave(phrase)}><Star size={17} weight={isSaved ? "fill" : "regular"} /> {isSaved ? "Zapisano" : "Zapisz"}</button><button className={isCopied ? "copied" : ""} onClick={() => copyPhrase(phrase)}><Copy size={17} /> {isCopied ? "Skopiowano" : "Kopiuj"}</button></span></div>; })}<button className="open-lesson" onClick={() => navigate(`lesson/${lesson.id}`)}>Przećwicz w lekcji {lesson.id} <ArrowRight size={16} /></button></div>}</article>)}{filteredLessons.length === 0 && <p className="rescue-no-results">Nie ma dokładnego wyniku. Zacznij od „Let me think for a second.”</p>}</section></main>;
}

function MyPhrases({ progress, updateProgress, navigate }) {
  const [custom, setCustom] = useState(""); const [copiedPhrase, setCopiedPhrase] = useState(""); const [query, setQuery] = useState(""); const [filter, setFilter] = useState("all"); const [notice, setNotice] = useState(""); const importRef = useRef(null);
  const scheduled = progress.phraseSchedule || {};
  const due = getDuePhraseReviews(progress);
  const dueSet = new Set(due.map((review) => review.phrase));
  const items = [...new Set([...progress.myPhrases, ...Object.entries(scheduled).filter(([, review]) => review.rating === "again" || review.rating === "hard").map(([phrase]) => phrase)])];
  const visibleItems = items.filter((phrase) => {
    const matchesQuery = phrase.toLocaleLowerCase("en-GB").includes(query.toLocaleLowerCase("en-GB"));
    const matchesFilter = filter === "all" || filter === "favorite" && progress.myPhrases.includes(phrase)
      || filter === "due" && dueSet.has(phrase)
      || filter === "hard" && ["again", "hard"].includes(scheduled[phrase]?.rating);
    return matchesQuery && matchesFilter;
  });
  const add = () => { if (!custom.trim()) return; updateProgress((current) => ({ ...current, myPhrases: [...new Set([...current.myPhrases, custom.trim()])] })); setCustom(""); setNotice("Fraza została dodana do twoich najbliższych powtórek."); };
  const remove = (phrase) => updateProgress((current) => { const phraseRatings = { ...current.phraseRatings }; const phraseSchedule = { ...current.phraseSchedule }; const personalScript = Object.fromEntries(Object.entries(current.personalScript || {}).filter(([, value]) => value !== phrase)); delete phraseRatings[phrase]; delete phraseSchedule[phrase]; return { ...current, myPhrases: current.myPhrases.filter((item) => item !== phrase), phraseRatings, phraseSchedule, personalScript }; });
  const copyPhrase = async (phrase) => { if (!await copyText(phrase)) return; setCopiedPhrase(phrase); window.setTimeout(() => setCopiedPhrase((current) => current === phrase ? "" : current), 1800); };

  function exportProgress() {
    const backup = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), app: "nearshore-english", progress }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(backup);
    const link = document.createElement("a");
    link.href = url;
    link.download = `nearshore-english-postep-${formatLocalDate()}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setNotice("Kopia postępu i własnych fraz została pobrana.");
  }

  async function importProgress(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 1_000_000) { setNotice("Plik jest zbyt duży. Wybierz kopię postępu pobraną z tej aplikacji."); event.target.value = ""; return; }

    try {
      const parsed = JSON.parse(await file.text());
      if (parsed.app && parsed.app !== "nearshore-english") throw new Error("wrong-app");
      const rawProgress = parsed.progress || parsed;
      if (!isRecord(rawProgress) || !Array.isArray(rawProgress.completed) && !Array.isArray(rawProgress.myPhrases)) throw new Error("invalid-backup");
      const imported = normalizeProgress(rawProgress);
      updateProgress((current) => {
        const mergedPhraseSchedule = { ...current.phraseSchedule };
        for (const [phrase, incoming] of Object.entries(imported.phraseSchedule)) {
          const existing = mergedPhraseSchedule[phrase];
          if (!existing || (incoming.lastReviewed || "") > (existing.lastReviewed || "")) mergedPhraseSchedule[phrase] = incoming;
        }

        return normalizeProgress({
          ...current,
          completed: [...new Set([...current.completed, ...imported.completed])],
          myPhrases: [...new Set([...current.myPhrases, ...imported.myPhrases])],
          phraseRatings: { ...imported.phraseRatings, ...current.phraseRatings },
          phraseSchedule: mergedPhraseSchedule,
          reviewSchedule: { ...imported.reviewSchedule, ...current.reviewSchedule },
          personalScript: { ...imported.personalScript, ...current.personalScript },
          practiceDays: [...new Set([...current.practiceDays, ...imported.practiceDays])].sort(),
          sessionHistory: [...current.sessionHistory, ...imported.sessionHistory].slice(-120),
        });
      });
      setNotice("Połączono zapisane frazy i postęp z wybraną kopią.");
    } catch {
      setNotice("Nie udało się odczytać pliku. Wybierz poprawną kopię postępu Nearshore English.");
    }
    event.target.value = "";
  }

  return <main id="main" className="page page-width phrases-page"><header className="page-intro"><span className="eyebrow">Twoja osobista baza</span><h1>Zdania, po które sięgasz bez namysłu.</h1><p>Twoje ulubione frazy wracają w sesji dziennej i budują osobisty screening script w lekcji 99.</p></header><div className="phrasebook-overview"><div><Star size={20} weight="fill" /><strong>{progress.myPhrases.length}</strong><span>zapisanych zdań</span></div><div><ListChecks size={20} /><strong>{due.length}</strong><span>powtórek na dziś</span></div><button className="button button--violet" onClick={() => navigate("practice")}><Play size={18} weight="fill" /> Przećwicz teraz</button></div><div className="custom-phrase custom-phrase--large"><input aria-label="Dodaj własną frazę po angielsku" value={custom} onChange={(event) => setCustom(event.target.value)} onKeyDown={(event) => event.key === "Enter" && add()} placeholder="Dodaj własną frazę po angielsku…" /><button onClick={add} disabled={!custom.trim()}><Plus size={18} /> Dodaj</button></div>{items.length > 0 && <div className="phrasebook-tools"><label className="phrasebook-search"><MagnifyingGlass size={18} /><span className="sr-only">Szukaj w swoich frazach</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Szukaj we własnych frazach…" /></label><div className="phrasebook-filters" role="group" aria-label="Filtruj frazy">{[["all", "Wszystkie"], ["favorite", "Ulubione"], ["due", "Na dziś"], ["hard", "Trudne"]].map(([id, label]) => <button key={id} aria-pressed={filter === id} onClick={() => setFilter(id)}>{label}</button>)}</div></div>}{notice && <p className="phrasebook-notice" role="status"><CheckCircle size={17} /> {notice}</p>}{items.length ? visibleItems.length ? <div className="my-phrase-list">{visibleItems.map((phrase, index) => { const copied = copiedPhrase === phrase; const review = scheduled[phrase]; const status = review?.rating || "saved"; return <article key={phrase}><span>{String(index + 1).padStart(2, "0")}</span><div className="phrasebook-item-copy"><p lang="en">{phrase}</p><small>{review ? `Powtórka ${phraseReviewLabel(review)} · ${review.repetitions || 0} ${review.repetitions === 1 ? "powtórzenie" : "powtórzeń"}` : "Nowa fraza czeka w sesji dziennej"}</small></div><small className={`rating rating--${status}`}>{status === "saved" ? "ulubiona" : status === "again" ? "wróć" : status === "hard" ? "trudna" : "umiem"}</small><button onClick={() => speakPhrase(phrase)} aria-label={`Posłuchaj: ${phrase}`}><Headphones size={17} /></button><button className={copied ? "copied" : ""} onClick={() => copyPhrase(phrase)} aria-label={copied ? "Skopiowano" : "Kopiuj"}>{copied ? <Check size={17} weight="bold" /> : <Copy size={17} />}</button><button onClick={() => remove(phrase)} aria-label="Usuń"><X size={17} /></button></article>; })}</div> : <p className="phrasebook-no-results">Żadna fraza nie pasuje do wybranego filtra.</p> : <section className="empty-state"><Star size={34} /><h2>Twoja baza dopiero się zaczyna.</h2><p>Przy każdej frazie w lekcji znajdziesz przycisk „Zapisz”. Dodaj zdania, które brzmią jak ty.</p><button className="button button--violet" onClick={() => navigate("lesson/1")}>Otwórz pierwszą lekcję</button></section>}<div className="phrasebook-backup"><div><ShieldCheck size={20} /><span>Postęp zostaje w tej przeglądarce. Możesz pobrać jego kopię i przenieść ją na inne urządzenie.</span></div><button onClick={exportProgress}><DownloadSimple size={18} /> Pobierz kopię</button><button onClick={() => importRef.current?.click()}><UploadSimple size={18} /> Wczytaj kopię</button><input ref={importRef} type="file" accept="application/json,.json" className="sr-only" tabIndex={-1} onChange={importProgress} aria-label="Wybierz plik kopii postępu" /></div></main>;
}

function Footer() { return <footer className="app-footer"><div className="page-width"><Wordmark /><p>100 lekcji do prawdziwych rozmów. Dane i postęp zostają lokalnie w przeglądarce.</p></div></footer>; }

export function App() {
  const [unlocked, setUnlocked] = useState(() => { try { return sessionStorage.getItem("nearshore-english-unlocked") === "yes"; } catch { return false; } }); const [route, navigate] = useRoute(); const [progress, updateProgress, storageWarning] = useStoredProgress();
  if (!unlocked) return <PasswordGate onUnlock={() => setUnlocked(true)} />;
  const lessonId = route.match(/^lesson\/(\d+)/)?.[1]; let page;
  if (lessonId) page = <LessonPage id={lessonId} progress={progress} updateProgress={updateProgress} navigate={navigate} />;
  else if (route === "practice") page = <DailyPractice progress={progress} updateProgress={updateProgress} navigate={navigate} />;
  else if (route.startsWith("lessons")) page = <LessonLibrary route={route} progress={progress} navigate={navigate} />;
  else if (route.startsWith("cheats")) page = <CheatSheets route={route} progress={progress} updateProgress={updateProgress} navigate={navigate} />;
  else if (route === "rescue") page = <Rescue progress={progress} updateProgress={updateProgress} navigate={navigate} />;
  else if (route === "phrases") page = <MyPhrases progress={progress} updateProgress={updateProgress} navigate={navigate} />;
  else page = <Home progress={progress} navigate={navigate} />;
  return <div className="app-shell"><a className="skip-link" href="#main">Przejdź do treści</a><Header route={route} navigate={navigate} />{storageWarning && <div className="storage-warning" role="alert"><ShieldCheck size={18} /> {storageWarning}</div>}{page}<Footer /></div>;
}
