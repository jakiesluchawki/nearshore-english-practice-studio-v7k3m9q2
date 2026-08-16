import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft, ArrowRight, BookOpen, Brain, CaretDown, CaretRight,
  ChatCircleDots, Check, CheckCircle, ClipboardText, Copy, Fire,
  Headphones, Heart, House, List, LockKey, MagnifyingGlass,
  Microphone, Pause, Play, Plus, ShieldCheck, Sparkle, Star, X,
} from "@phosphor-icons/react";
import { cheatSheets } from "./data/cheatsheets.js";
import { getLesson, lessonPrompt, lessons, modules } from "./data/curriculum.js";

const APP_PASSWORD_HASH = "33f158fd0f2938adc78b5226c98f4c3cce25545b2979b1bd6de98c1bb53fdef3";
const publicAsset = (path) => `${import.meta.env.BASE_URL}${path}`;
const navItems = [
  { id: "home", label: "Start", icon: House },
  { id: "lessons", label: "Lekcje", icon: BookOpen },
  { id: "cheats", label: "Ściągi", icon: ClipboardText },
  { id: "rescue", label: "Ratunek", icon: Brain },
  { id: "phrases", label: "Moje", icon: Star },
];
const starterProgress = { completed: [], phraseRatings: {}, myPhrases: [], lastLesson: 1, startedOn: new Date().toISOString(), lastVisit: "", visitDays: [] };

function useStoredProgress() {
  const [progress, setProgress] = useState(() => {
    try { return { ...starterProgress, ...JSON.parse(localStorage.getItem("nearshore-english-progress") || "{}") }; }
    catch { return starterProgress; }
  });
  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    setProgress((current) => {
      if (current.lastVisit === today) return current;
      const next = { ...current, lastVisit: today, visitDays: [...new Set([...(current.visitDays || []), today])].slice(-30) };
      localStorage.setItem("nearshore-english-progress", JSON.stringify(next));
      return next;
    });
  }, []);
  const update = (change) => setProgress((current) => {
    const next = typeof change === "function" ? change(current) : { ...current, ...change };
    localStorage.setItem("nearshore-english-progress", JSON.stringify(next));
    return next;
  });
  return [progress, update];
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
    sessionStorage.setItem("nearshore-english-unlocked", "yes"); onUnlock();
  };
  return <main className="gate">
    <section className="gate-panel"><Wordmark /><div className="gate-copy">
      <span className="eyebrow">Prywatny kurs</span><h1>Wejdź do pracowni rozmów.</h1>
      <p>100 krótkich lekcji do codziennej pracy po angielsku — od pierwszego hello po ofertę i negocjacje.</p>
      <form onSubmit={submit}><label htmlFor="course-password">Hasło dostępu</label><div className="gate-input-row"><LockKey size={20} /><input id="course-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" placeholder="Wpisz hasło" autoFocus /><button type="submit" aria-label="Otwórz kurs" disabled={checking || !password}>{checking ? <Pause size={20} /> : <ArrowRight size={20} />}</button></div>{error && <p className="form-error" role="alert">{error}</p>}</form>
      <div className="gate-note"><ShieldCheck size={18} /><span>Postęp zostaje tylko w tej przeglądarce.</span></div>
    </div></section>
    <figure className="gate-art"><img src={publicAsset("assets/hero-recruiter-english.png")} alt="Filcowa martwa natura z zestawem słuchawkowym, laptopem, mikrofonem i kartami profili" /></figure>
  </main>;
}

function Header({ route, navigate }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const active = route.startsWith("lesson/") ? "lessons" : route.split("/")[0];
  return <><header className="app-header"><Wordmark button onClick={() => navigate("home")} />
    <nav className="desktop-nav" aria-label="Główna nawigacja">{navItems.map((item) => <button key={item.id} className={active === item.id ? "active" : ""} onClick={() => navigate(item.id)}>{item.label}</button>)}</nav>
    <button className="menu-button" aria-label="Otwórz menu" aria-expanded={menuOpen} onClick={() => setMenuOpen((value) => !value)}>{menuOpen ? <X size={23} /> : <List size={23} />}</button>
    {menuOpen && <nav className="mobile-menu" aria-label="Menu mobilne">{navItems.map(({ id, label, icon: Icon }) => <button key={id} onClick={() => { navigate(id); setMenuOpen(false); }}><Icon size={20} /><span>{label}</span><CaretRight size={16} /></button>)}</nav>}
  </header><nav className="bottom-nav" aria-label="Nawigacja dolna">{navItems.map(({ id, label, icon: Icon }) => <button key={id} className={active === id ? "active" : ""} onClick={() => navigate(id)}><Icon size={22} weight={active === id ? "fill" : "regular"} /><span>{label}</span></button>)}</nav></>;
}

function ProgressRing({ value }) { return <div className="progress-ring" style={{ "--progress": `${value * 3.6}deg` }} aria-label={`${value}% kursu ukończone`}><span>{value}<small>%</small></span></div>; }

function Home({ progress, navigate }) {
  const completedCount = progress.completed.length;
  const nextLessonId = Math.min(100, completedCount ? Math.max(...progress.completed) + 1 : progress.lastLesson || 1);
  const nextLesson = getLesson(nextLessonId);
  const streak = Math.max(1, progress.visitDays?.length || 1);
  return <main id="main" className="home-page">
    <section className="home-hero"><div className="hero-copy"><span className="eyebrow">15–20 minut dziennie</span><h1>Mów, zanim stres zabierze ci słowa.</h1><p>Praktyczny angielski do pełnego cyklu rekrutacji IT. Bez szkolnych dialogów, bez korporacyjnego nadęcia, bez przełączania się między oknami.</p><div className="hero-actions"><button className="button button--violet" onClick={() => navigate(`lesson/${nextLesson.id}`)}><Play size={18} weight="fill" /> {completedCount ? "Kontynuuj lekcję" : "Zacznij pierwszą lekcję"}</button><button className="button button--outline" onClick={() => navigate("rescue")}><Brain size={19} /> Potrzebuję zdania teraz</button></div></div><figure className="hero-art"><img src={publicAsset("assets/hero-recruiter-english.png")} alt="Filcowe słuchawki, mikrofon, laptop i karty profili w różowym studiu" /></figure></section>
    <section className="today-section page-width" aria-labelledby="today-title"><header className="section-heading"><div><span className="eyebrow">Twoje dzisiaj</span><h2 id="today-title">Jedna rozmowa bliżej swobody.</h2></div><div className="streak"><Fire size={18} weight="fill" /><span>{streak} {streak === 1 ? "dzień" : "dni"} praktyki</span></div></header><article className="today-card"><div className="today-number">{String(nextLesson.id).padStart(2, "0")}</div><div className="today-copy"><span className="lesson-kicker">Moduł {nextLesson.moduleId} · {nextLesson.duration} min</span><h3>{nextLesson.title}</h3><p>{nextLesson.goal}</p><button className="text-button" onClick={() => navigate(`lesson/${nextLesson.id}`)}>Otwórz lekcję <ArrowRight size={17} /></button></div><ProgressRing value={completedCount} /></article></section>
    <section className="quick-paths page-width" aria-label="Szybkie ścieżki"><button className="path-card path-card--rose" onClick={() => navigate("rescue")}><Brain size={28} /><span>Gdy pustka w głowie</span><strong>Odzyskaj rozmowę w 20 sekund</strong><ArrowRight size={19} /></button><button className="path-card path-card--blue" onClick={() => navigate("cheats")}><ClipboardText size={28} /><span>Przed telefonem</span><strong>Otwórz gotową ściągę</strong><ArrowRight size={19} /></button><button className="path-card path-card--cream" onClick={() => navigate("phrases")}><Star size={28} /><span>Twoja baza</span><strong>Powtórz zapisane frazy</strong><ArrowRight size={19} /></button></section>
    <section className="course-map page-width" aria-labelledby="map-title"><header className="section-heading"><div><span className="eyebrow">100 gotowych lekcji</span><h2 id="map-title">Od pierwszego hello po ofertę.</h2></div><button className="text-button" onClick={() => navigate("lessons")}>Cała biblioteka <ArrowRight size={17} /></button></header><div className="module-strip">{modules.map((module) => { const done = module.lessonIds.filter((id) => progress.completed.includes(id)).length; return <button key={module.id} className={`module-card tone-${module.color}`} onClick={() => navigate(`lessons/module-${module.id}`)}><span>{String(module.id).padStart(2, "0")}</span><h3>{module.title}</h3><p>{done}/10 lekcji</p><div className="mini-progress"><i style={{ width: `${done * 10}%` }} /></div></button>; })}</div></section>
    <section className="method-section"><div className="page-width method-grid"><div><span className="eyebrow">Metoda</span><h2>Najpierw mówisz. Potem odsłaniasz.</h2></div><div className="method-steps"><article><span>01</span><h3>Krótka sytuacja</h3><p>Wiesz, po co używasz zdania i w którym momencie rozmowy.</p></article><article><span>02</span><h3>Głos przed wzorem</h3><p>Próbujesz powiedzieć to po swojemu, zanim zobaczysz gotową frazę.</p></article><article><span>03</span><h3>Powrót w dobrym momencie</h3><p>Again, Hard i Good ustawiają lekkie powtórki w tej przeglądarce.</p></article></div></div></section>
  </main>;
}

function LessonLibrary({ route, progress, navigate }) {
  const routeModule = Number(route.match(/module-(\d+)/)?.[1] || 0);
  const [query, setQuery] = useState(""); const [moduleFilter, setModuleFilter] = useState(routeModule);
  const filtered = lessons.filter((lesson) => { const moduleMatch = !moduleFilter || lesson.moduleId === moduleFilter; const haystack = `${lesson.title} ${lesson.goal} ${lesson.phrases.join(" ")}`.toLowerCase(); return moduleMatch && haystack.includes(query.toLowerCase()); });
  return <main id="main" className="page page-width library-page"><header className="page-intro page-intro--with-art"><div><span className="eyebrow">Pełna baza</span><h1>100 lekcji. Każda gotowa do użycia.</h1><p>Wybierz etap procesu albo wyszukaj konkretną sytuację. Checkpointy co pięć lekcji łączą materiał w rozmowę.</p></div><img src={publicAsset("assets/lesson-library.png")} alt="Filcowy zestaw słuchawkowy, clipboard i stos kart lekcji" /></header><div className="library-tools"><label className="search-field"><MagnifyingGlass size={19} /><span className="sr-only">Szukaj lekcji</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Szukaj: stawka, feedback, tech stack…" /></label><label className="select-field"><span className="sr-only">Filtruj po module</span><select value={moduleFilter} onChange={(event) => setModuleFilter(Number(event.target.value))}><option value="0">Wszystkie moduły</option>{modules.map((module) => <option key={module.id} value={module.id}>{module.id}. {module.title}</option>)}</select><CaretDown size={16} /></label></div><p className="results-count">{filtered.length} {filtered.length === 1 ? "lekcja" : "lekcji"}</p><div className="lesson-list">{filtered.map((lesson) => { const done = progress.completed.includes(lesson.id); return <button key={lesson.id} className={`lesson-row ${lesson.checkpoint ? "checkpoint" : ""}`} onClick={() => navigate(`lesson/${lesson.id}`)}><span className="lesson-row-number">{String(lesson.id).padStart(2, "0")}</span><span className="lesson-row-copy"><small>Moduł {lesson.moduleId}{lesson.checkpoint ? " · checkpoint" : ` · ${lesson.duration} min`}</small><strong>{lesson.title}</strong><span>{lesson.goal}</span></span><span className={`lesson-status ${done ? "done" : ""}`}>{done ? <Check size={18} weight="bold" /> : <ArrowRight size={18} />}</span></button>; })}</div></main>;
}

function PhraseCard({ phrase, index, isSaved, onToggle, onSpeak }) {
  const labels = ["Najprościej", "Naturalnie", "Bardziej płynnie", "Dodatkowa opcja"];
  return <article className="phrase-card"><span className="phrase-label">{labels[index] || `Wariant ${index + 1}`}</span><p>{phrase}</p><div className="phrase-actions"><button onClick={() => onSpeak(phrase)} aria-label={`Odtwórz: ${phrase}`}><Headphones size={18} /> Posłuchaj</button><button className={isSaved ? "saved" : ""} onClick={() => onToggle(phrase)} aria-label={isSaved ? "Usuń z Moich fraz" : "Dodaj do Moich fraz"}><Star size={18} weight={isSaved ? "fill" : "regular"} /> {isSaved ? "Zapisane" : "Zapisz"}</button></div></article>;
}

function Reveal({ label = "Odsłoń podpowiedź", children, tone = "cream" }) {
  const [open, setOpen] = useState(false);
  return <div className={`reveal reveal--${tone}`}><button onClick={() => setOpen((value) => !value)} aria-expanded={open}>{open ? "Ukryj odpowiedź" : label} <CaretDown size={17} className={open ? "turned" : ""} /></button>{open && <div className="reveal-content">{children}</div>}</div>;
}

function PromptModal({ lesson, progress, onClose }) {
  const [mode, setMode] = useState("roleplay"); const [input, setInput] = useState(""); const [copied, setCopied] = useState(false); const dialogRef = useRef(null);
  const hard = Object.entries(progress.phraseRatings).filter(([, rating]) => rating === "again" || rating === "hard").map(([phrase]) => phrase).slice(0, 12);
  const prompt = lessonPrompt(lesson, mode, input, hard, progress.myPhrases.slice(0, 12));
  useEffect(() => { dialogRef.current?.focus(); const handle = (event) => event.key === "Escape" && onClose(); document.addEventListener("keydown", handle); return () => document.removeEventListener("keydown", handle); }, [onClose]);
  const copy = async () => { await navigator.clipboard.writeText(prompt); setCopied(true); window.setTimeout(() => setCopied(false), 2200); };
  return <div className="modal-backdrop" onMouseDown={onClose}><section className="prompt-modal" role="dialog" aria-modal="true" aria-labelledby="prompt-title" tabIndex={-1} ref={dialogRef} onMouseDown={(event) => event.stopPropagation()}><header><div><span className="eyebrow">Continue with ChatGPT</span><h2 id="prompt-title">Zapytaj o tę lekcję.</h2></div><button className="icon-button" onClick={onClose} aria-label="Zamknij"><X size={21} /></button></header><p className="modal-lead">Aplikacja niczego nie wysyła. Ułóż prompt, skopiuj go i wklej do swojej rozmowy w ChatGPT.</p><div className="mode-grid">{[["explain", "Wyjaśnij", "Różnice i użycie"], ["check", "Sprawdź", "Popraw moją wypowiedź"], ["practice", "Przećwicz", "Krótkie zadania"], ["roleplay", "Role-play", "Rozmowa krok po kroku"]].map(([id, label, note]) => <button key={id} className={mode === id ? "active" : ""} onClick={() => setMode(id)}><strong>{label}</strong><span>{note}</span></button>)}</div><label className="prompt-input"><span>Twoje pytanie albo odpowiedź <small>(opcjonalnie)</small></span><textarea value={input} onChange={(event) => setInput(event.target.value)} placeholder="Np. Czy mogę powiedzieć: How looks your notice period?" /></label><div className="privacy-note"><ShieldCheck size={18} /><span>Nie wklejaj danych kandydatów, poufnych nazw klientów ani wewnętrznych informacji o projekcie.</span></div><div className="prompt-actions"><button className="button button--violet" onClick={copy}>{copied ? <Check size={18} weight="bold" /> : <Copy size={18} />} {copied ? "Prompt skopiowany" : "Kopiuj prompt"}</button><a className="button button--outline" href="https://chatgpt.com/" target="_blank" rel="noreferrer">Otwórz ChatGPT <ArrowRight size={17} /></a></div></section></div>;
}

function LessonPage({ id, progress, updateProgress, navigate }) {
  const lesson = getLesson(id); const [promptOpen, setPromptOpen] = useState(false); const [selectedChoice, setSelectedChoice] = useState(""); const [addedPhrase, setAddedPhrase] = useState(""); const phrases = lesson.phrases;
  const choiceOptions = useMemo(() => { const distractor = getLesson(Math.min(100, lesson.id + 1)).phrases[0]; return [...new Set([phrases[0], phrases[1], distractor])].filter(Boolean).sort(() => lesson.id % 2 ? -1 : 1); }, [lesson.id, phrases]);
  const saved = (phrase) => progress.myPhrases.includes(phrase);
  const togglePhrase = (phrase) => updateProgress((current) => ({ ...current, myPhrases: current.myPhrases.includes(phrase) ? current.myPhrases.filter((item) => item !== phrase) : [...current.myPhrases, phrase] }));
  const speak = (phrase) => { if (!("speechSynthesis" in window)) return; window.speechSynthesis.cancel(); const utterance = new SpeechSynthesisUtterance(phrase); utterance.lang = "en-GB"; utterance.rate = 0.88; window.speechSynthesis.speak(utterance); };
  const rateLesson = (rating) => { const ratings = { ...progress.phraseRatings }; phrases.forEach((phrase) => { ratings[phrase] = rating; }); updateProgress((current) => ({ ...current, completed: [...new Set([...current.completed, lesson.id])].sort((a, b) => a - b), phraseRatings: ratings, lastLesson: Math.min(100, lesson.id + 1) })); };
  const addCustom = () => { const value = addedPhrase.trim(); if (!value) return; updateProgress((current) => ({ ...current, myPhrases: [...new Set([...current.myPhrases, value])] })); setAddedPhrase(""); };
  return <main id="main" className="lesson-page"><section className={`lesson-hero tone-${lesson.moduleColor}`}><div className="lesson-hero-inner page-width"><button className="back-button" onClick={() => navigate("lessons")}><ArrowLeft size={19} /> Ścieżka nauki</button><div className="lesson-number">{String(lesson.id).padStart(2, "0")}</div><span className="lesson-kicker">Moduł {lesson.moduleId} · {lesson.checkpoint ? "checkpoint" : `${lesson.duration} min`}</span><h1>{lesson.title}</h1><p>{lesson.goal}.</p><div className="lesson-progress-line"><i style={{ width: `${lesson.id}%` }} /><span>{lesson.id} / 100</span></div></div></section><div className="lesson-content page-width">
    <section className="lesson-block lesson-block--intro"><span className="eyebrow">01 · Sytuacja</span><h2>Najpierw odpowiedz po swojemu.</h2><p className="large-copy">Wyobraź sobie, że właśnie chcesz {lesson.scenario || lesson.goal}. Jak powiedziałabyś to teraz — bez szukania idealnego zdania?</p><div className="speak-cue"><Microphone size={24} /><div><strong>Powiedz odpowiedź na głos</strong><span>Masz 20 sekund. Nie oceniaj akcentu ani drobnych błędów.</span></div></div><Reveal label="Pokaż bezpieczny początek"><p className="model-answer">{phrases[0]}</p><button className="inline-audio" onClick={() => speak(phrases[0])}><Headphones size={17} /> Posłuchaj</button></Reveal></section>
    <section className="lesson-block"><span className="eyebrow">02 · Phrase pack</span><h2>Trzy zdania, które wykonują pracę.</h2><p>Nie ucz się wszystkich identycznie. Wybierz jedno, które najłatwiej przychodzi ci do ust.</p><div className="phrase-grid">{phrases.slice(0, lesson.checkpoint ? 6 : 4).map((phrase, index) => <PhraseCard key={phrase} phrase={phrase} index={index} isSaved={saved(phrase)} onToggle={togglePhrase} onSpeak={speak} />)}</div></section>
    <section className="lesson-block lesson-block--paper"><span className="eyebrow">03 · Rozpoznaj moment</span><h2>Co powiesz w tej chwili?</h2><blockquote><span>Intencja</span>Chcesz {lesson.goal}. Które zdanie najbezpieczniej rozpoczyna ten ruch?</blockquote><div className="choice-list">{choiceOptions.map((option) => <button key={option} className={selectedChoice === option ? (option === phrases[0] ? "correct" : "incorrect") : ""} onClick={() => setSelectedChoice(option)}><span>{option}</span>{selectedChoice === option && (option === phrases[0] ? <CheckCircle size={20} weight="fill" /> : <X size={19} />)}</button>)}</div>{selectedChoice && <p className="choice-feedback">{selectedChoice === phrases[0] ? "To naturalnie rozpoczyna tę funkcję językową." : "Ta fraza może być przydatna, ale w tej intencji lepiej pasuje pierwszy wariant z lekcji."}</p>}</section>
    <section className="lesson-block split-practice"><div><span className="eyebrow">04 · Speak before you see</span><h2>Zmień intencję w zdanie.</h2><p className="large-copy">{lesson.goal}. Powiedz jedną krótką, naturalną wersję po angielsku.</p><div className="pause-card"><span>20</span><p>sekund ciszy jest częścią ćwiczenia</p></div></div><Reveal label="Porównaj z odpowiedziami" tone="blue"><div className="stacked-answers">{phrases.slice(0, 3).map((phrase) => <p key={phrase}>{phrase}</p>)}</div></Reveal></section>
    <section className="lesson-block lesson-block--dialogue"><span className="eyebrow">05 · Mini dialogue</span><h2>Wstaw frazę do prawdziwej wymiany.</h2><div className="dialogue"><div className="dialogue-line candidate"><span>Candidate</span><p>{lesson.candidateLine}</p></div><div className="dialogue-line recruiter"><span>You</span><p>{phrases[1] || phrases[0]}</p><button onClick={() => speak(phrases[1] || phrases[0])} aria-label="Posłuchaj odpowiedzi"><Play size={16} weight="fill" /></button></div><div className="dialogue-line candidate"><span>Candidate</span><p>{lesson.moduleId >= 8 ? "Thanks for being clear. What happens next?" : "That makes sense. What would you like to know next?"}</p></div></div><p className="coach-note"><Sparkle size={18} weight="fill" /><span><strong>Coach’s note:</strong> Nie chodzi o dokładne odtworzenie. Jeśli twoja wersja była jasna, krótka i uprzejma — zadziałała.</span></p></section>
    <section className="lesson-block"><span className="eyebrow">06 · Twoja wersja</span><h2>Zapisz zdanie, które naprawdę powiesz.</h2><p>Możesz uprościć wzór albo dopasować go do własnego stylu. To zdanie trafi do sekcji „Moje frazy”.</p><div className="custom-phrase"><input value={addedPhrase} onChange={(event) => setAddedPhrase(event.target.value)} placeholder={phrases[0]} /><button onClick={addCustom} disabled={!addedPhrase.trim()}><Plus size={18} /> Zapisz</button></div></section>
    <section className="lesson-block lesson-block--final"><span className="eyebrow">07 · Final challenge</span><h2>Zamknij notatki. Poprowadź 60 sekund.</h2><p className="large-copy">Rozpocznij od sytuacji „{lesson.title}”, użyj co najmniej dwóch fraz i płynnie przejdź do kolejnego pytania. Nie zatrzymuj się, żeby poprawiać drobiazgi.</p><div className="final-check"><CheckCircle size={30} /><div><strong>Gotowe?</strong><span>Oceń, jak łatwo frazy przyszły ci dziś do głowy.</span></div></div><div className="rating-buttons"><button onClick={() => rateLesson("again")}><span>Again</span><small>wróć jutro</small></button><button onClick={() => rateLesson("hard")}><span>Hard</span><small>powtórz szybciej</small></button><button onClick={() => rateLesson("good")} className="good"><span>Good</span><small>idź dalej</small></button></div></section>
    <section className="continue-card"><ChatCircleDots size={32} /><div><span className="eyebrow">Opcjonalnie</span><h2>Dopytaj albo przećwicz dalej w ChatGPT.</h2><p>Wybierz tryb. Aplikacja przygotuje kontekst tej lekcji, trudne frazy i twoje zapisane zdania — bez klucza API.</p></div><button className="button button--violet" onClick={() => setPromptOpen(true)}>Ułóż prompt <ArrowRight size={17} /></button></section>
    <nav className="lesson-nav" aria-label="Nawigacja między lekcjami"><button disabled={lesson.id === 1} onClick={() => navigate(`lesson/${lesson.id - 1}`)}><ArrowLeft size={18} /> Poprzednia</button><span>{lesson.id} / 100</span><button disabled={lesson.id === 100} onClick={() => navigate(`lesson/${lesson.id + 1}`)}>Następna <ArrowRight size={18} /></button></nav>
  </div>{promptOpen && <PromptModal lesson={lesson} progress={progress} onClose={() => setPromptOpen(false)} />}</main>;
}

function CheatSheets({ navigate }) {
  const [selectedId, setSelectedId] = useState(cheatSheets[0].id); const selected = cheatSheets.find((sheet) => sheet.id === selectedId); const selectedLessons = selected.lessonIds.map(getLesson);
  return <main id="main" className="page page-width cheats-page"><header className="page-intro"><span className="eyebrow">Dostępne od pierwszego dnia</span><h1>Ściągi na dwie minuty przed rozmową.</h1><p>Każdy etap ma proste, naturalne i bardziej płynne warianty. Nie musisz przechodzić kursu po kolei, żeby z nich korzystać.</p></header><div className="cheats-layout"><nav className="sheet-list" aria-label="Lista ściąg">{cheatSheets.map((sheet, index) => <button key={sheet.id} className={sheet.id === selectedId ? "active" : ""} onClick={() => setSelectedId(sheet.id)}><span>{String(index + 1).padStart(2, "0")}</span><div><strong>{sheet.title}</strong><small>{sheet.subtitle}</small></div><CaretRight size={17} /></button>)}</nav><section className="sheet-detail"><header><span className="eyebrow">Szybka ściąga</span><h2>{selected.title}</h2><p>{selected.subtitle}</p></header>{selectedLessons.map((lesson, index) => <article className="sheet-step" key={lesson.id}><div className="sheet-step-number">{String(index + 1).padStart(2, "0")}</div><div><h3>{lesson.title}</h3><p>{lesson.goal}</p><div className="sheet-variants">{lesson.phrases.slice(0, 4).map((phrase) => <button key={phrase} onClick={() => navigator.clipboard.writeText(phrase)} title="Kopiuj frazę">{phrase}<Copy size={15} /></button>)}</div><button className="open-lesson" onClick={() => navigate(`lesson/${lesson.id}`)}>Otwórz lekcję {lesson.id} <ArrowRight size={16} /></button></div></article>)}</section></div></main>;
}

function Rescue({ progress, updateProgress, navigate }) {
  const rescueLessons = lessons.slice(0, 10).filter((lesson) => !lesson.checkpoint && lesson.phrases.length); const [openId, setOpenId] = useState(2); const [copiedPhrase, setCopiedPhrase] = useState("");
  const labels = { 1: "Zacznij rozmowę", 2: "Kup kilka sekund", 3: "Poproś o powtórzenie", 4: "Popraw się bez paniki", 6: "Ustaw agendę", 7: "Sprawdź zrozumienie", 8: "Powiedz, że sprawdzisz", 9: "Zmień temat płynnie" };
  const speak = (phrase) => { if (!("speechSynthesis" in window)) return; const utterance = new SpeechSynthesisUtterance(phrase); utterance.lang = "en-GB"; utterance.rate = 0.88; window.speechSynthesis.speak(utterance); };
  const toggleSave = (phrase) => updateProgress((current) => ({ ...current, myPhrases: current.myPhrases.includes(phrase) ? current.myPhrases.filter((item) => item !== phrase) : [...current.myPhrases, phrase] }));
  const copyPhrase = async (phrase) => { await navigator.clipboard.writeText(phrase); setCopiedPhrase(phrase); window.setTimeout(() => setCopiedPhrase((current) => current === phrase ? "" : current), 1800); };
  return <main id="main" className="page rescue-page"><section className="rescue-hero page-width"><div><span className="eyebrow">Help, My Brain Is Empty</span><h1>Nie szukaj idealnego zdania. Odzyskaj rozmowę.</h1><p>Wybierz to, co właśnie się wydarzyło. Każda fraza jest krótka, bezpieczna i naturalna pod presją.</p><div className="rescue-rule"><Heart size={20} weight="fill" /><span>Nie przepraszaj za swój angielski. Kup czas, doprecyzuj albo sprawdź — to jest profesjonalne.</span></div></div><img src={publicAsset("assets/brain-empty-rescue.png")} alt="Filcowa chmura na kole ratunkowym z dymkami rozmowy i mikrofonem" /></section><section className="rescue-library page-width">{rescueLessons.map((lesson) => <article key={lesson.id} className={openId === lesson.id ? "open" : ""}><button className="rescue-toggle" onClick={() => setOpenId(openId === lesson.id ? 0 : lesson.id)}><span>{labels[lesson.id] || lesson.title}</span><CaretDown size={18} /></button>{openId === lesson.id && <div className="rescue-phrases">{lesson.phrases.slice(0, 4).map((phrase) => { const isSaved = progress.myPhrases.includes(phrase); const isCopied = copiedPhrase === phrase; return <div key={phrase}><p>{phrase}</p><span><button onClick={() => speak(phrase)}><Headphones size={17} /> Posłuchaj</button><button className={isSaved ? "saved" : ""} aria-pressed={isSaved} onClick={() => toggleSave(phrase)}><Star size={17} weight={isSaved ? "fill" : "regular"} /> {isSaved ? "Zapisano" : "Zapisz"}</button><button className={isCopied ? "copied" : ""} onClick={() => copyPhrase(phrase)}><Copy size={17} /> {isCopied ? "Skopiowano" : "Kopiuj"}</button></span></div>; })}<button className="open-lesson" onClick={() => navigate(`lesson/${lesson.id}`)}>Przećwicz w lekcji {lesson.id} <ArrowRight size={16} /></button></div>}</article>)}</section></main>;
}

function MyPhrases({ progress, updateProgress, navigate }) {
  const ratings = progress.phraseRatings; const items = [...new Set([...progress.myPhrases, ...Object.keys(ratings).filter((phrase) => ratings[phrase] === "again" || ratings[phrase] === "hard")])]; const [custom, setCustom] = useState("");
  const add = () => { if (!custom.trim()) return; updateProgress((current) => ({ ...current, myPhrases: [...new Set([...current.myPhrases, custom.trim()])] })); setCustom(""); };
  const remove = (phrase) => updateProgress((current) => { const phraseRatings = { ...current.phraseRatings }; delete phraseRatings[phrase]; return { ...current, myPhrases: current.myPhrases.filter((item) => item !== phrase), phraseRatings }; });
  return <main id="main" className="page page-width phrases-page"><header className="page-intro"><span className="eyebrow">Twoja osobista baza</span><h1>Zdania, po które sięgasz bez namysłu.</h1><p>Zapisane frazy i te ocenione jako Hard lub Again wracają tutaj. To z nich w lekcji 99 zbudujesz własny screening script.</p></header><div className="custom-phrase custom-phrase--large"><input value={custom} onChange={(event) => setCustom(event.target.value)} placeholder="Dodaj własną frazę po angielsku…" /><button onClick={add} disabled={!custom.trim()}><Plus size={18} /> Dodaj</button></div>{items.length ? <div className="my-phrase-list">{items.map((phrase, index) => <article key={phrase}><span>{String(index + 1).padStart(2, "0")}</span><p>{phrase}</p><small className={`rating rating--${ratings[phrase] || "saved"}`}>{ratings[phrase] || "saved"}</small><button onClick={() => navigator.clipboard.writeText(phrase)} aria-label="Kopiuj"><Copy size={17} /></button><button onClick={() => remove(phrase)} aria-label="Usuń"><X size={17} /></button></article>)}</div> : <section className="empty-state"><Star size={34} /><h2>Twoja baza dopiero się zaczyna.</h2><p>Przy każdej frazie w lekcji znajdziesz przycisk „Zapisz”. Dodaj zdania, które brzmią jak ty.</p><button className="button button--violet" onClick={() => navigate("lesson/1")}>Otwórz pierwszą lekcję</button></section>}</main>;
}

function Footer() { return <footer className="app-footer"><div className="page-width"><Wordmark /><p>100 lekcji do prawdziwych rozmów. Dane i postęp zostają lokalnie w przeglądarce.</p></div></footer>; }

export function App() {
  const [unlocked, setUnlocked] = useState(() => sessionStorage.getItem("nearshore-english-unlocked") === "yes"); const [route, navigate] = useRoute(); const [progress, updateProgress] = useStoredProgress();
  if (!unlocked) return <PasswordGate onUnlock={() => setUnlocked(true)} />;
  const lessonId = route.match(/^lesson\/(\d+)/)?.[1]; let page;
  if (lessonId) page = <LessonPage id={lessonId} progress={progress} updateProgress={updateProgress} navigate={navigate} />;
  else if (route.startsWith("lessons")) page = <LessonLibrary route={route} progress={progress} navigate={navigate} />;
  else if (route === "cheats") page = <CheatSheets navigate={navigate} />;
  else if (route === "rescue") page = <Rescue progress={progress} updateProgress={updateProgress} navigate={navigate} />;
  else if (route === "phrases") page = <MyPhrases progress={progress} updateProgress={updateProgress} navigate={navigate} />;
  else page = <Home progress={progress} navigate={navigate} />;
  return <div className="app-shell"><a className="skip-link" href="#main">Przejdź do treści</a><Header route={route} navigate={navigate} />{page}<Footer /></div>;
}
