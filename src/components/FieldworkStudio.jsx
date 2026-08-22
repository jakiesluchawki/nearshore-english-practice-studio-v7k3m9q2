import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft, ArrowRight, Briefcase, Buildings, ChatCircleDots, Check,
  CheckCircle, Clock, Copy, Ear, EnvelopeSimple, Headphones, Heart,
  Lightning, Microphone, NotePencil, PhoneCall, Play, ShieldCheck,
  Sparkle, Star, Target, Timer, WarningCircle, Waveform, X,
} from "@phosphor-icons/react";
import { PracticeTimer, VoicePractice, speakPhrase } from "./LearningExperience.jsx";
import { formatLocalDate, withPracticeDay } from "../data/reviews.js";
import { screeningSteps } from "../data/screening.js";
import {
  advanceCallTurn, callModes, candidateScenarios, difficultSituations, getRolePack,
  listeningScenarios, makeBriefLines, makeCallPrompt, makePracticePrompt,
  polishCalques, rolePacks, scenarioStepLine, stakeholderScenarios, writingScenarios,
} from "../data/fieldwork.js";

const asset = (path) => `${import.meta.env.BASE_URL}${path}`;

function favoritePhrase(progress, updateProgress, phrase) {
  if (!phrase?.trim()) return;
  updateProgress((current) => withPracticeDay({
    ...current,
    myPhrases: (current.myPhrases || []).includes(phrase.trim())
      ? current.myPhrases.filter((item) => item !== phrase.trim())
      : [...new Set([...(current.myPhrases || []), phrase.trim()])],
  }));
}

function logPractice(updateProgress, kind, reference, responses = 1) {
  updateProgress((current) => withPracticeDay({
    ...current,
    studioHistory: [...(current.studioHistory || []), {
      date: formatLocalDate(), kind, reference, responses, recordedAt: new Date().toISOString(),
    }].slice(-150),
  }));
}

function favoritesAndDifficult(progress) {
  return {
    favoritePhrases: (progress.myPhrases || []).slice(0, 10),
    difficultPhrases: Object.entries(progress.phraseSchedule || {})
      .filter(([, entry]) => entry.rating === "again" || entry.rating === "hard")
      .map(([phrase]) => phrase).slice(0, 10),
  };
}

function hasPersonalDetails(value) {
  return /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(value)
    || /(?:\+?\d[\s().-]*){8,}/.test(value);
}

async function putOnClipboard(text) {
  const input = document.createElement("textarea");
  input.value = text;
  input.readOnly = true;
  input.style.position = "fixed";
  input.style.opacity = "0";
  document.body.appendChild(input);
  input.select();
  let success = false;
  try { success = document.execCommand("copy"); } catch { success = false; }
  input.remove();
  if (!success && navigator.clipboard?.writeText) {
    try { await navigator.clipboard.writeText(text); success = true; } catch { success = false; }
  }
  return success;
}

function PromptHandoff({ prompt, label = "Niech ChatGPT oceni odpowiedź", compact = false, disabled = false }) {
  const [notice, setNotice] = useState("");
  async function handle(open) {
    if (!prompt || disabled) return;
    const copying = putOnClipboard(prompt);
    if (open) window.open("https://chatgpt.com/", "_blank", "noopener,noreferrer");
    const copied = await copying;
    setNotice(copied ? "Prompt skopiowany. Wklej go w ChatGPT." : "Przeglądarka zablokowała schowek. Skopiuj prompt z podglądu.");
  }
  return <div className={`field-prompt ${compact ? "field-prompt--compact" : ""}`}>
    <button type="button" className="button button--violet" disabled={disabled || !prompt} onClick={() => handle(true)}>
      <ChatCircleDots size={18} /> {label}
    </button>
    <details className="field-prompt-preview"><summary>Podgląd kontekstu</summary><textarea readOnly aria-label="Pełny prompt dla ChatGPT" value={prompt || ""} /><button type="button" onClick={() => handle(false)}><Copy size={15} /> Tylko skopiuj</button></details>
    <span className="field-prompt-privacy"><ShieldCheck size={14} /> Prompt jest przenoszony do ChatGPT. Nie wpisuj nazwisk, e-maili ani poufnych danych.</span>
    {notice && <p role="status"><CheckCircle size={16} /> {notice}</p>}
  </div>;
}

function SavePhraseButton({ phrase, progress, updateProgress, compact = false }) {
  const saved = (progress.myPhrases || []).includes(phrase);
  return <button type="button" className={`field-save ${saved ? "saved" : ""} ${compact ? "field-save--compact" : ""}`} aria-pressed={saved} onClick={() => favoritePhrase(progress, updateProgress, phrase)}>
    <Star size={17} weight={saved ? "fill" : "regular"} /> {saved ? "W Moich frazach" : "Zapisz frazę"}
  </button>;
}

function ListenButton({ phrase, label = "Posłuchaj", rate = 0.88 }) {
  return <button type="button" className="field-listen" onClick={() => speakPhrase(phrase, rate)} aria-label={`${label}: ${phrase}`}><Headphones size={17} /> {label}</button>;
}

function StudioPage({ title, eyebrow, description, children, navigate, className = "", illustration }) {
  return <main id="main" className={`page page-width field-page ${className}`}>
    <button type="button" className="field-back" onClick={() => navigate("studio")}><ArrowLeft size={18} /> Studio prawdziwej rozmowy</button>
    <header className={`field-header ${illustration ? "field-header--illustrated" : ""}`}><div><span className="eyebrow">{eyebrow}</span><h1>{title}</h1>{description && <p>{description}</p>}</div>{illustration && <img src={asset(`assets/modules/module-${String(illustration).padStart(2, "0")}.webp`)} alt="" loading="lazy" />}</header>
    {children}
  </main>;
}

const studioExperiences = [
  { id: "simulator", label: "Symulator rozmowy", title: "Kandydat ma własne zdanie.", description: "Osiem osobowości, trzy długości i momenty, których nie da się zaplanować.", icon: PhoneCall, module: 10, time: "5 / 15 / 30 min", featured: true },
  { id: "reflex", label: "Refleks", title: "Odpowiedz w trzy sekundy.", description: "Krótka obiekcja. Krótki oddech. Jedna odpowiedź, która rusza rozmowę.", icon: Lightning, module: 1, time: "3 min" },
  { id: "listening", label: "Słuchanie", title: "Kandydat mówi pierwszy.", description: "Usłysz szczegół, którego nie można zgubić, zanim zobaczysz zapis.", icon: Ear, module: 7, time: "4 min" },
  { id: "prepare", label: "Przed telefonem", title: "Rozmowa za trzy minuty.", description: "Anonimowy brief zamienia się w gotowy pitch i trafne pytania.", icon: Clock, module: 2, time: "3 min" },
  { id: "roles", label: "Specjalizacje IT", title: "Brzmij pewnie przy stacku.", description: "Osiem ról, sensowne pytania i wymowa technologii.", icon: Briefcase, module: 4, time: "5 min" },
  { id: "situations", label: "Trudne momenty", title: "Gdy rozmowa skręca.", description: "Stawka, kontroferta, pośpiech, feedback i niejawny klient.", icon: WarningCircle, module: 9, time: "4 min" },
  { id: "natural", label: "Bez kalki", title: "Powiedz to naturalnie.", description: "Wybierz wersję, która nie brzmi jak tłumaczenie z polskiego.", icon: Sparkle, module: 3, time: "3 min" },
  { id: "team", label: "Klient i zespół", title: "Porozmawiaj z hiring managerem.", description: "Status, wymagania, budżet i feedback w normalnym języku.", icon: Buildings, module: 5, time: "5 min" },
  { id: "messages", label: "Wiadomości", title: "Napisz wiadomość, której użyjesz.", description: "Od pierwszego kontaktu po opóźnienie, odmowę i ofertę.", icon: EnvelopeSimple, module: 8, time: "5 min" },
  { id: "journal", label: "Po rozmowie", title: "Zamroziło mnie, gdy…", description: "Zamień prawdziwy trudny moment w zdanie na jutro.", icon: NotePencil, module: 6, time: "2 min" },
];

function StudioHome({ progress, navigate }) {
  const history = progress.studioHistory || [];
  const journal = progress.workJournal || [];
  const today = history.filter((entry) => entry.date === formatLocalDate()).length;
  return <main id="main" className="page page-width studio-home">
    <header className="studio-hero"><div><span className="eyebrow">Praktyka po drugiej stronie słuchawki</span><h1>Tu rozmowa nie idzie według planu.</h1><p>Ćwicz dokładnie to, co dzieje się w pracy: kandydat przerywa, stawia warunki i oczekuje spokojnej odpowiedzi.</p><div className="studio-hero-actions"><button type="button" className="button button--violet" onClick={() => navigate("studio/simulator")}><PhoneCall size={19} /> Zacznij rozmowę</button><button type="button" className="button button--outline" onClick={() => navigate("studio/prepare")}>Mam telefon za 3 minuty <ArrowRight size={17} /></button></div></div><img src={asset("assets/modules/module-10.webp")} alt="Filcowa kompozycja przedstawiająca pewnie prowadzoną rozmowę" /></header>
    <section className="studio-signal" aria-label="Twoja praktyka"><span><Waveform size={18} /> <strong>{history.length}</strong> rozegranych ćwiczeń</span><span><Target size={18} /> <strong>{today}</strong> dzisiaj</span><span><Heart size={18} /> <strong>{journal.length}</strong> odzyskanych trudnych momentów</span></section>
    <section className="studio-list" aria-label="Ćwiczenia praktyczne">{studioExperiences.map(({ id, label, title, description, icon: Icon, module, time, featured }, index) => <button key={id} type="button" className={`studio-option ${featured ? "studio-option--featured" : ""}`} onClick={() => navigate(`studio/${id}`)}><span className="studio-option-index">{String(index + 1).padStart(2, "0")}</span><img src={asset(`assets/modules/module-${String(module).padStart(2, "0")}.webp`)} alt="" loading="lazy" /><span className="studio-option-copy"><small><Icon size={15} /> {label} · {time}</small><strong>{title}</strong><span>{description}</span></span><ArrowRight size={20} /></button>)}</section>
    <p className="field-privacy"><ShieldCheck size={17} /> Wszystko działa bez klucza API. Nie wpisuj danych kandydatów ani poufnych informacji o klientach.</p>
  </main>;
}

function CallSimulator({ progress, updateProgress, navigate, initialRole }) {
  const [scenarioId, setScenarioId] = useState(() => candidateScenarios.find((item) => item.roleId === initialRole)?.id || candidateScenarios[0].id);
  const [modeId, setModeId] = useState(() => candidateScenarios.find((item) => item.roleId === initialRole)?.id === "five-minutes" ? "quick" : "screen");
  const [active, setActive] = useState(false);
  const [finished, setFinished] = useState(false);
  const [step, setStep] = useState(0);
  const [answer, setAnswer] = useState("");
  const [intention, setIntention] = useState("understand");
  const [transcript, setTranscript] = useState([]);
  const [challenge, setChallenge] = useState(false);
  const [challengeDone, setChallengeDone] = useState(false);
  const [coach, setCoach] = useState("");
  const [feedback, setFeedback] = useState("");
  const scenario = candidateScenarios.find((item) => item.id === scenarioId) || candidateScenarios[0];
  const mode = callModes.find((item) => item.id === modeId) || callModes[1];
  const stepId = mode.stepIds[step];
  const currentStep = screeningSteps.find((item) => item.id === stepId);
  const prompt = makeCallPrompt({ scenario, mode, transcript, ...favoritesAndDifficult(progress) });

  function start() {
    setActive(true); setFinished(false); setStep(0); setAnswer(""); setChallenge(false); setChallengeDone(false); setCoach(""); setFeedback("");
    setTranscript([{ speaker: "candidate", text: scenario.opening }]);
  }

  function reply() {
    const next = advanceCallTurn({
      scenario, mode, step, answer, intention, transcript, challenge, challengeDone,
      referenceAnswer: currentStep?.variants[0],
    });
    if (!next) return;
    setAnswer(""); setTranscript(next.transcript); setStep(next.step); setChallenge(next.challenge);
    setChallengeDone(next.challengeDone); setCoach(next.coach); setFeedback(next.feedback); setIntention("understand");
    if (next.finished) {
      setFinished(true); setActive(false);
      logPractice(updateProgress, "simulation", scenario.id, next.transcript.filter((turn) => turn.speaker === "recruiter").length);
    }
  }

  return <StudioPage navigate={navigate} eyebrow="Symulator pełnej rozmowy" title="Kandydat ma swój plan." description="Najpierw odpowiedz własnym zdaniem. Kierunek rozmowy wybierasz świadomie, a prawdziwą ocenę języka zostawiasz ChatGPT." illustration={10} className="simulator-page">
    {!active && !finished && <section className="simulator-setup"><div className="candidate-picker"><span className="eyebrow">Wybierz, kto odbiera</span>{candidateScenarios.map((item) => <button key={item.id} type="button" aria-pressed={item.id === scenarioId} onClick={() => { setScenarioId(item.id); if (item.id === "five-minutes") setModeId("quick"); }}><span>{item.role}</span><strong>{item.name}</strong><small>{item.temperament} · {item.difficulty}</small></button>)}</div><div className="mode-picker"><span className="eyebrow">{scenario.id === "five-minutes" ? "Kandydat ma tylko pięć minut, więc szanujesz jego czas." : "Ile masz czasu?"}</span>{callModes.map((item) => <button key={item.id} type="button" aria-pressed={item.id === modeId} disabled={scenario.id === "five-minutes" && item.id !== "quick"} onClick={() => setModeId(item.id)}><strong>{item.minutes} min</strong><span>{item.title}</span><small>{item.stepIds.length} etapów</small></button>)}</div><button type="button" className="button button--violet simulator-start" onClick={start}><PhoneCall size={19} /> Odbierz telefon</button></section>}
    {active && <section className="live-call"><header className="live-call-bar"><span><span className="live-dot" /> Rozmowa trwa · {scenario.role}</span><strong>{step + 1} / {mode.stepIds.length}</strong><PracticeTimer seconds={mode.minutes * 60} lessonKey={`call-${scenario.id}-${mode.id}`} title="Czas rozmowy" compact autoStart /></header><div className="call-progress-track"><i style={{ width: `${((step + (challenge ? .5 : 0)) / mode.stepIds.length) * 100}%` }} /></div><div className="call-history" aria-live="polite">{transcript.map((turn, index) => <article key={`${index}-${turn.speaker}`} className={`call-turn call-turn--${turn.speaker}`}><span>{turn.speaker === "candidate" ? "Candidate" : "You"}</span><p lang="en">{turn.text}</p>{turn.speaker === "candidate" && index === transcript.length - 1 && <ListenButton phrase={turn.text} label="Odsłuchaj pytanie" />}</article>)}</div><div className="call-response"><div className="call-current-intent"><span className="eyebrow">{challenge ? "Niespodziewany zwrot" : `Etap ${step + 1}: ${currentStep?.title || "Rozmowa"}`}</span><p>{challenge ? "Kandydat stawia warunek. Odpowiedz spokojnie, nie wymyślaj potwierdzeń." : step === 0 ? "Najpierw odpowiedz na to, co kandydat właśnie powiedział. Dopiero potem spokojnie ustaw rozmowę." : currentStep?.goal}</p></div><label htmlFor="simulation-answer">Twoja odpowiedź po angielsku</label><textarea id="simulation-answer" value={answer} onChange={(event) => setAnswer(event.target.value)} placeholder="Powiedz to na głos, a potem wpisz własną odpowiedź…" /><VoicePractice lessonKey={`simulation-${scenario.id}-${step}-${challenge}`} onTranscript={setAnswer} /><fieldset className="strategy-picker"><legend>W jakim kierunku prowadzisz rozmowę?</legend>{[["understand", "Uznaj obawę i doprecyzuj"], ["continue", "Odpowiedz i przejdź dalej"], ["avoid", "Pomiń ten temat"]].map(([id, label]) => <label key={id}><input type="radio" name="call-strategy" value={id} checked={intention === id} onChange={() => setIntention(id)} /><span>{label}</span></label>)}</fieldset><button type="button" className="button button--violet" disabled={!answer.trim()} onClick={reply}>Wstaw do rozmowy <ArrowRight size={17} /></button></div>{coach && <div className="field-coach" role="status"><Sparkle size={19} /><div><p>{feedback}</p><strong lang="en">{coach}</strong><div className="field-model-actions"><ListenButton phrase={coach} /><SavePhraseButton phrase={coach} progress={progress} updateProgress={updateProgress} compact /></div></div></div>}</section>}
    {finished && <section className="call-summary"><CheckCircle size={38} weight="fill" /><span className="eyebrow">Rozmowa zakończona</span><h2>Przeszłaś przez {transcript.filter((turn) => turn.speaker === "recruiter").length} prawdziwych odpowiedzi.</h2><p>Teraz oddaj całą rozmowę do oceny, razem z twoimi dokładnymi odpowiedziami, preferowanymi frazami i trudnymi momentami.</p><details className="transcript-review"><summary>Pokaż pełny zapis rozmowy</summary>{transcript.map((turn, index) => <p key={`${index}-${turn.speaker}`}><strong>{turn.speaker === "candidate" ? "Candidate" : "You"}:</strong> <span lang="en">{turn.text}</span></p>)}</details><PromptHandoff prompt={prompt} label="Niech ChatGPT oceni całą rozmowę" /><div className="call-summary-actions"><button type="button" className="button button--outline" onClick={start}>Zagraj ten scenariusz jeszcze raz</button><button type="button" className="text-button" onClick={() => navigate(`lesson/${scenario.lessonId}`)}>Przećwicz ten moment w lekcji {scenario.lessonId} <ArrowRight size={16} /></button></div></section>}
  </StudioPage>;
}

function ReflexPractice({ progress, updateProgress, navigate }) {
  const [index, setIndex] = useState(0);
  const [seconds, setSeconds] = useState(3);
  const [remaining, setRemaining] = useState(3);
  const [running, setRunning] = useState(false);
  const [listening, setListening] = useState(false);
  const [answer, setAnswer] = useState("");
  const [revealed, setRevealed] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const startedAt = useRef(0);
  const playbackGeneration = useRef(0);
  const situation = difficultSituations[index % difficultSituations.length];

  useEffect(() => () => {
    playbackGeneration.current += 1;
    window.speechSynthesis?.cancel();
  }, [situation.id, seconds]);

  useEffect(() => {
    if (!running) return undefined;
    const timer = window.setInterval(() => {
      const left = Math.max(0, seconds - Math.floor((Date.now() - startedAt.current) / 1000));
      setRemaining(left);
      if (!left) setRunning(false);
    }, 120);
    return () => window.clearInterval(timer);
  }, [running, seconds]);

  function begin() {
    const generation = ++playbackGeneration.current;
    setRemaining(seconds); setRunning(false); setListening(true);
    const beginCountdown = () => {
      if (generation !== playbackGeneration.current) return;
      setListening(false); startedAt.current = Date.now(); setRunning(true);
    };
    if (!speakPhrase(situation.candidate, .93, beginCountdown)) beginCountdown();
  }
  function next() { playbackGeneration.current += 1; window.speechSynthesis?.cancel(); setIndex((current) => current + 1); setAnswer(""); setRevealed(false); setRunning(false); setListening(false); setRemaining(seconds); }
  function check() { if (!answer.trim()) return; setRunning(false); setRevealed(true); setAttempts((current) => current + 1); logPractice(updateProgress, "reflex", situation.id); }

  return <StudioPage navigate={navigate} eyebrow="Trening odruchu" title="Nie czekaj na idealne zdanie." description="Zegar rusza dopiero po wysłuchaniu kandydata. Mierzy rozpoczęcie odpowiedzi, nie ocenia akcentu ani nie przerywa myśli." illustration={1} className="reflex-page"><div className="reflex-controls"><span>Masz na start:</span>{[3, 5, 8].map((time) => <button key={time} type="button" aria-pressed={seconds === time} onClick={() => { setSeconds(time); setRemaining(time); setRunning(false); }}>{time} sekund</button>)}<small>{attempts} odpowiedzi w tej sesji</small></div><section className="reflex-stage"><span className="eyebrow">Kandydat · {situation.category}</span><p className="reflex-question" lang="en">{situation.candidate}</p><div className={`reflex-clock ${remaining === 0 ? "reflex-clock--open" : ""}`}><Timer size={27} /><output aria-live="polite">{remaining}</output><span>{remaining === 0 ? "Nadal możesz spokojnie odpowiedzieć." : listening ? "Najpierw spokojnie wysłuchaj kandydata." : running ? "Zacznij mówić." : "Włącz, kiedy chcesz zacząć."}</span></div><button type="button" className="button button--violet" onClick={begin}><Play size={18} weight="fill" /> {listening ? "Słuchasz pytania…" : running ? "Zacznij od nowa" : "Usłysz pytanie i zacznij"}</button><label htmlFor="reflex-answer">Twoja odpowiedź</label><textarea id="reflex-answer" value={answer} onChange={(event) => { setAnswer(event.target.value); if (running) setRunning(false); }} placeholder="Powiedz po swojemu, potem zapisz jedną naturalną wersję…" /><VoicePractice lessonKey={`reflex-${situation.id}`} onTranscript={(text) => { setAnswer(text); setRunning(false); }} /><div className="reflex-actions"><button type="button" className="button button--outline" disabled={!answer.trim() || revealed} onClick={check}>Pokaż spokojny wariant</button><button type="button" className="text-button" onClick={next}>Następna sytuacja <ArrowRight size={16} /></button></div>{revealed && <ModelAnswer phrase={situation.model} followUp={situation.next} progress={progress} updateProgress={updateProgress} prompt={makePracticePrompt({ title: situation.title, context: situation.category, candidate: situation.candidate, answer, model: situation.model, ...favoritesAndDifficult(progress) })} />}</section></StudioPage>;
}

function ListeningPractice({ progress, updateProgress, navigate }) {
  const [selected, setSelected] = useState(listeningScenarios[0].id);
  const [played, setPlayed] = useState(false);
  const [transcriptVisible, setTranscriptVisible] = useState(false);
  const [answer, setAnswer] = useState("");
  const [revealed, setRevealed] = useState(false);
  const scenario = listeningScenarios.find((item) => item.id === selected) || listeningScenarios[0];

  function choose(id) { setSelected(id); setPlayed(false); setTranscriptVisible(false); setAnswer(""); setRevealed(false); }
  function play(rate = .88) { const ok = speakPhrase(scenario.line, rate); setPlayed(true); if (!ok) setTranscriptVisible(true); }
  function compare() { if (!answer.trim() || revealed) return; setRevealed(true); logPractice(updateProgress, "listening", scenario.id); }

  return <StudioPage navigate={navigate} eyebrow="Najpierw usłysz, potem zobacz" title="Kandydat mówi pierwszy." description="Ukryty zapis zmusza do usłyszenia sensu. Możesz zwolnić tempo albo odsłonić tekst, jeśli urządzenie nie ma dostępnego głosu." illustration={7} className="listening-page"><div className="topic-tabs" role="group" aria-label="Wybierz wypowiedź kandydata">{listeningScenarios.map((item) => <button key={item.id} type="button" aria-pressed={selected === item.id} onClick={() => choose(item.id)}>{item.title}</button>)}</div><section className="listening-stage"><span className="eyebrow">Usłysz odpowiedź kandydata</span><div className="sound-orb" aria-hidden="true"><Waveform size={53} /></div><div className="listening-actions"><button type="button" className="button button--violet" onClick={() => play(.92)}><Headphones size={19} /> {played ? "Odtwórz jeszcze raz" : "Odtwórz bez podglądu"}</button><button type="button" className="button button--outline" onClick={() => play(.7)}>Wolniej</button></div>{played && <><p className="listening-question">{scenario.question}</p><button type="button" className="text-button transcript-toggle" aria-expanded={transcriptVisible} onClick={() => setTranscriptVisible((value) => !value)}>{transcriptVisible ? "Ukryj wypowiedź" : "Pokaż transkrypcję"}</button>{transcriptVisible && <blockquote lang="en">{scenario.line}</blockquote>}<label htmlFor="listening-answer">Jak odpowiesz kandydatowi po angielsku?</label><textarea id="listening-answer" value={answer} onChange={(event) => setAnswer(event.target.value)} placeholder="Najpierw nazwij sens wypowiedzi, potem odpowiedz…" /><VoicePractice lessonKey={`listening-${scenario.id}`} onTranscript={setAnswer} /><button type="button" className="button button--outline" disabled={!answer.trim() || revealed} onClick={compare}>Sprawdź, co było najważniejsze</button>{revealed && <><div className="listening-insight"><Sparkle size={19} /><p>{scenario.insight}</p></div><ModelAnswer phrase={scenario.reply} progress={progress} updateProgress={updateProgress} prompt={makePracticePrompt({ title: scenario.title, context: scenario.question, candidate: scenario.line, answer, model: scenario.reply, ...favoritesAndDifficult(progress) })} /></>}</>}</section></StudioPage>;
}

function ModelAnswer({ phrase, followUp, followUpLabel = "Candidate odpowiada", progress, updateProgress, prompt }) {
  return <section className="model-answer" aria-label="Naturalny wariant odpowiedzi"><span className="eyebrow">Jedna naturalna odpowiedź</span><p lang="en">{phrase}</p><div className="field-model-actions"><ListenButton phrase={phrase} /><SavePhraseButton phrase={phrase} progress={progress} updateProgress={updateProgress} /></div>{followUp && <div className="candidate-follow-up"><span>{followUpLabel}</span><p lang="en">{followUp}</p></div>}{prompt && <PromptHandoff prompt={prompt} compact />}</section>;
}

function QuickBrief({ progress, updateProgress, navigate: baseNavigate, initialRole }) {
  const [roleId, setRoleId] = useState(() => getRolePack(initialRole).id);
  const [rate, setRate] = useState("");
  const [workMode, setWorkMode] = useState("");
  const [start, setStart] = useState("");
  const [contract, setContract] = useState("");
  const [stack, setStack] = useState("");
  const [generated, setGenerated] = useState(false);
  const [copied, setCopied] = useState(false);
  const pack = getRolePack(roleId);
  const navigate = (target) => baseNavigate(target === "studio/simulator" ? `studio/simulator/${pack.id}` : target);
  const lines = useMemo(() => makeBriefLines({ roleId, rate, workMode, start, contract, stack }), [roleId, rate, workMode, start, contract, stack]);
  async function copy() { const ok = await putOnClipboard(lines.map((line, index) => `${index + 1}. ${line.label}\n${line.text}`).join("\n\n")); setCopied(ok); }
  function generate(event) { event.preventDefault(); setGenerated(true); logPractice(updateProgress, "brief", pack.id); }
  return <StudioPage navigate={navigate} eyebrow="Trzy minuty przed telefonem" title="Wchodzisz w rozmowę przygotowana." description="Wpisz wyłącznie anonimowe parametry roli. Szkic jest pomocnikiem do rozmowy, nie miejscem na nazwiska, klientów ani dane z CV." illustration={2} className="brief-page"><form className="brief-form" onSubmit={generate}><label>Rola<select value={roleId} onChange={(event) => { setRoleId(event.target.value); setStack(""); }}>{rolePacks.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label><label>Stack technologiczny<input value={stack} onChange={(event) => setStack(event.target.value)} placeholder={pack.stack.slice(0, 3).join(", ")} maxLength={100} /></label><label>Widełki lub stawka<input value={rate} onChange={(event) => setRate(event.target.value)} placeholder="np. 170–190 PLN/h" maxLength={80} /></label><label>Model pracy<input value={workMode} onChange={(event) => setWorkMode(event.target.value)} placeholder="np. fully remote within Poland" maxLength={90} /></label><label>Forma współpracy<input value={contract} onChange={(event) => setContract(event.target.value)} placeholder="np. a B2B contract" maxLength={80} /></label><label>Oczekiwany start<input value={start} onChange={(event) => setStart(event.target.value)} placeholder="np. early October" maxLength={80} /></label><p className="brief-safety"><ShieldCheck size={17} /> Nie wpisuj imienia kandydata, nazwy klienta ani poufnych danych.</p><button type="submit" className="button button--violet"><Sparkle size={18} /> Ułóż moją rozmowę</button></form>{generated && <section className="generated-brief"><header><div><span className="eyebrow">Twój plan rozmowy</span><h2>{pack.title}</h2></div><button type="button" className="button button--outline" onClick={copy}>{copied ? <Check size={17} /> : <Copy size={17} />} {copied ? "Skopiowano" : "Skopiuj plan"}</button></header><ol>{lines.map((line, index) => <li key={line.id}><span>{String(index + 1).padStart(2, "0")}</span><div><small>{line.label}</small><p lang="en">{line.text}</p><div className="field-model-actions"><ListenButton phrase={line.text} /><SavePhraseButton phrase={line.text} progress={progress} updateProgress={updateProgress} compact /></div></div></li>)}</ol><button type="button" className="button button--violet" onClick={() => navigate("studio/simulator")}>Przećwicz z kandydatem <ArrowRight size={17} /></button></section>}</StudioPage>;
}

function RoleLab({ progress, updateProgress, navigate }) {
  const [roleId, setRoleId] = useState("java");
  const pack = getRolePack(roleId);
  return <StudioPage navigate={navigate} eyebrow="Technologie bez udawania developera" title="Wiesz, o co naprawdę zapytać." description="Nie musisz robić technicznego interview. Wystarczy naturalnie ustalić, z czym kandydat pracował samodzielnie." illustration={4} className="roles-page"><div className="topic-tabs" role="group" aria-label="Wybierz specjalizację IT">{rolePacks.map((item) => <button key={item.id} type="button" aria-pressed={roleId === item.id} onClick={() => setRoleId(item.id)}>{item.title}</button>)}</div><section className="role-detail"><header><span className="eyebrow">{pack.subtitle}</span><h2>{pack.title}</h2><div className="stack-chips">{pack.stack.map((item) => <span key={item}>{item}</span>)}</div></header><article className="role-pitch"><span className="eyebrow">Trzydziestosekundowy opis projektu</span><p lang="en">{pack.pitch}</p><div className="field-model-actions"><ListenButton phrase={pack.pitch} /><SavePhraseButton phrase={pack.pitch} progress={progress} updateProgress={updateProgress} /></div></article><section className="role-questions"><span className="eyebrow">Pytania, które dobrze działają</span>{pack.questions.map((question, index) => <article key={question}><span>{String(index + 1).padStart(2, "0")}</span><p lang="en">{question}</p><div className="field-model-actions"><ListenButton phrase={question} /><SavePhraseButton phrase={question} progress={progress} updateProgress={updateProgress} compact /></div></article>)}</section><section className="pronunciation"><span className="eyebrow">Jak to powiedzieć</span>{pack.terms.map(([term, pronunciation]) => <button key={term} type="button" onClick={() => speakPhrase(term, .75)}><span lang="en">{term}</span><span>{pronunciation}</span><Headphones size={17} /></button>)}</section><button type="button" className="button button--violet" onClick={() => { logPractice(updateProgress, "roles", pack.id); navigate(`studio/prepare/${pack.id}`); }}>Przygotuj rozmowę dla tej roli <ArrowRight size={17} /></button></section></StudioPage>;
}

function SituationLab({ progress, updateProgress, navigate }) {
  const [caseId, setCaseId] = useState(difficultSituations[0].id);
  const [answer, setAnswer] = useState("");
  const [revealed, setRevealed] = useState(false);
  const scenario = difficultSituations.find((item) => item.id === caseId) || difficultSituations[0];
  function select(id) { setCaseId(id); setAnswer(""); setRevealed(false); }
  function reveal() { if (!answer.trim() || revealed) return; setRevealed(true); logPractice(updateProgress, "situation", scenario.id); }
  return <StudioPage navigate={navigate} eyebrow="Gdy kandydat stawia warunek" title="Nie musisz mieć idealnej odpowiedzi." description="Najpierw zauważ, czego kandydat rzeczywiście potrzebuje. Dopiero potem porównaj swoją odpowiedź z naturalnym wariantem." illustration={9} className="situations-page"><div className="topic-tabs" role="group" aria-label="Wybierz trudną sytuację">{difficultSituations.map((item) => <button key={item.id} type="button" aria-pressed={caseId === item.id} onClick={() => select(item.id)}>{item.title}</button>)}</div><section className="field-exercise"><span className="eyebrow">{scenario.category}</span><h2>{scenario.title}</h2><div className="candidate-statement"><span>Candidate</span><p lang="en">{scenario.candidate}</p><ListenButton phrase={scenario.candidate} /></div><label htmlFor="situation-answer">Co odpowiesz?</label><textarea id="situation-answer" value={answer} onChange={(event) => setAnswer(event.target.value)} placeholder="Odpowiedz swoim naturalnym angielskim…" /><VoicePractice lessonKey={`situation-${scenario.id}`} onTranscript={setAnswer} /><button type="button" className="button button--violet" disabled={!answer.trim() || revealed} onClick={reveal}>Wstaw swoją odpowiedź <ArrowRight size={16} /></button>{revealed && <><ModelAnswer phrase={scenario.model} followUp={scenario.next} progress={progress} updateProgress={updateProgress} prompt={makePracticePrompt({ title: scenario.title, context: scenario.category, candidate: scenario.candidate, answer, model: scenario.model, ...favoritesAndDifficult(progress) })} /><button type="button" className="text-button field-related-lesson" onClick={() => navigate(`lesson/${scenario.lessonId}`)}>Przećwicz dalej w lekcji {scenario.lessonId} <ArrowRight size={16} /></button></>}</section></StudioPage>;
}

function NaturalEnglish({ progress, updateProgress, navigate }) {
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState("");
  const item = polishCalques[index % polishCalques.length];
  const options = index % 2 ? [item.right, item.wrong] : [item.wrong, item.right];
  function choose(phrase) { if (selected) return; setSelected(phrase); logPractice(updateProgress, "natural", String(index)); }
  function next() { setIndex((value) => (value + 1) % polishCalques.length); setSelected(""); }
  return <StudioPage navigate={navigate} eyebrow="Naturalnie, bez dosłownego tłumaczenia" title="Które zdanie naprawdę działa?" description="Jedna wersja brzmi jak kalka z polskiego. Druga spokojnie przechodzi przez prawdziwą rozmowę." illustration={3} className="natural-page"><section className="natural-exercise"><span className="eyebrow">Przykład {index + 1} / {polishCalques.length}</span><h2>Wybierz naturalny wariant.</h2><div className="natural-options">{options.map((phrase) => <button key={phrase} type="button" lang="en" aria-pressed={selected === phrase} disabled={Boolean(selected)} className={selected === phrase ? phrase === item.right ? "choice-correct" : "choice-wrong" : ""} onClick={() => choose(phrase)}>{phrase}{selected === phrase && (phrase === item.right ? <Check size={19} /> : <X size={19} />)}</button>)}</div>{selected && <div className="natural-feedback" role="status"><strong>{selected === item.right ? "Tak brzmi spokojna, naturalna odpowiedź." : "To kalka. Naturalny wariant lepiej oddaje sens i brzmi swobodniej."}</strong><p>{item.why}</p><p lang="en" className="natural-right">{item.right}</p><div className="field-model-actions"><ListenButton phrase={item.right} /><SavePhraseButton phrase={item.right} progress={progress} updateProgress={updateProgress} /></div><button type="button" className="button button--violet" onClick={next}>Następna para <ArrowRight size={17} /></button></div>}</section></StudioPage>;
}

function TeamPractice({ progress, updateProgress, navigate }) {
  const [selected, setSelected] = useState(stakeholderScenarios[0].id);
  const [answer, setAnswer] = useState("");
  const [shown, setShown] = useState(false);
  const scenario = stakeholderScenarios.find((item) => item.id === selected) || stakeholderScenarios[0];
  function choose(id) { setSelected(id); setAnswer(""); setShown(false); }
  function reveal() { if (!answer.trim() || shown) return; setShown(true); logPractice(updateProgress, "team", scenario.id); }
  return <StudioPage navigate={navigate} eyebrow="Po drugiej stronie jest też zespół" title="Powiedz to hiring managerowi." description="Pytasz o wymagania, bronisz dobrego kandydata i domykasz feedback. Profesjonalnie, ale bez języka z korporacyjnych prezentacji." illustration={5} className="team-page"><div className="topic-tabs" role="group" aria-label="Wybierz sytuację z zespołem">{stakeholderScenarios.map((item) => <button key={item.id} type="button" aria-pressed={selected === item.id} onClick={() => choose(item.id)}>{item.title}</button>)}</div><section className="field-exercise"><span className="eyebrow">Sytuacja</span><h2>{scenario.title}</h2><p>{scenario.context}</p><label htmlFor="team-answer">Co powiesz klientowi lub hiring managerowi?</label><textarea id="team-answer" value={answer} onChange={(event) => setAnswer(event.target.value)} placeholder="Powiedz to po swojemu…" /><VoicePractice lessonKey={`team-${scenario.id}`} onTranscript={setAnswer} /><button type="button" className="button button--violet" disabled={!answer.trim()} onClick={reveal}>Porównaj odpowiedź <ArrowRight size={17} /></button>{shown && <ModelAnswer phrase={scenario.phrase} followUp={scenario.followUp} followUpLabel="Ty dopowiadasz" progress={progress} updateProgress={updateProgress} prompt={makePracticePrompt({ title: scenario.title, context: scenario.context, answer, model: `${scenario.phrase} ${scenario.followUp}`, ...favoritesAndDifficult(progress) })} />}</section></StudioPage>;
}

function WritingPractice({ progress, updateProgress, navigate }) {
  const [selected, setSelected] = useState(writingScenarios[0].id);
  const [draft, setDraft] = useState("");
  const [shown, setShown] = useState(false);
  const scenario = writingScenarios.find((item) => item.id === selected) || writingScenarios[0];
  function choose(id) { setSelected(id); setDraft(""); setShown(false); }
  function compare() { if (!draft.trim() || shown) return; setShown(true); logPractice(updateProgress, "message", scenario.id); }
  const words = draft.trim() ? draft.trim().split(/\s+/).length : 0;
  return <StudioPage navigate={navigate} eyebrow="Mail, LinkedIn i krótka wiadomość" title="Pisz tak, jak naprawdę pracujesz." description="Najpierw ułóż własną wiadomość. Potem sprawdź, czy jest konkretna, naturalna i prowadzi do jasnego kolejnego kroku." illustration={8} className="writing-page"><div className="topic-tabs" role="group" aria-label="Wybierz rodzaj wiadomości">{writingScenarios.map((item) => <button key={item.id} type="button" aria-pressed={selected === item.id} onClick={() => choose(item.id)}>{item.title}</button>)}</div><section className="writing-desk"><header><span className="eyebrow">Brief wiadomości</span><h2>{scenario.title}</h2><p>{scenario.brief}</p></header><label htmlFor="writing-draft">Twoja wiadomość po angielsku</label><textarea id="writing-draft" rows={6} value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Hi, …" /><div className="writing-meter"><span>{words} {words === 1 ? "słowo" : words >= 2 && words <= 4 ? "słowa" : "słów"}</span><span>Krótko, naturalnie, z jasnym kolejnym krokiem.</span></div><button type="button" className="button button--violet" disabled={!draft.trim() || shown} onClick={compare}>Porównaj z naturalną wersją <ArrowRight size={17} /></button>{shown && <><ModelAnswer phrase={scenario.model} progress={progress} updateProgress={updateProgress} prompt={makePracticePrompt({ title: scenario.title, context: scenario.brief, answer: draft, model: scenario.model, kind: "written recruiter message", ...favoritesAndDifficult(progress) })} /><button type="button" className="text-button field-related-lesson" onClick={() => navigate(`lesson/${scenario.lessonId}`)}>Otwórz powiązaną lekcję {scenario.lessonId} <ArrowRight size={16} /></button></>}</section></StudioPage>;
}

function AfterCallJournal({ progress, updateProgress, navigate }) {
  const [caseId, setCaseId] = useState(difficultSituations[0].id);
  const [ownPhrase, setOwnPhrase] = useState("");
  const [saved, setSaved] = useState(false);
  const [privacyError, setPrivacyError] = useState("");
  const scenario = difficultSituations.find((item) => item.id === caseId) || difficultSituations[0];
  const journal = progress.workJournal || [];
  function rescue() {
    if (saved) return;
    const phrase = ownPhrase.trim() || scenario.model;
    if (hasPersonalDetails(phrase)) {
      setPrivacyError("Wpisz wyłącznie uniwersalną frazę. Usuń adres e-mail, numer telefonu i inne dane osoby.");
      return;
    }
    setPrivacyError("");
    updateProgress((current) => withPracticeDay({
      ...current,
      myPhrases: [...new Set([...(current.myPhrases || []), phrase])],
      workJournal: [...(current.workJournal || []), { date: formatLocalDate(), category: scenario.category, reference: scenario.id, phrase, recordedAt: new Date().toISOString() }].slice(-100),
      studioHistory: [...(current.studioHistory || []), { date: formatLocalDate(), kind: "journal", reference: scenario.id, responses: 1, recordedAt: new Date().toISOString() }].slice(-150),
    }));
    setSaved(true);
  }
  const counts = Object.entries(journal.reduce((result, entry) => ({ ...result, [entry.category]: (result[entry.category] || 0) + 1 }), {})).sort((first, second) => second[1] - first[1]);
  const phrase = ownPhrase.trim() || scenario.model;
  const prompt = makePracticePrompt({ title: scenario.title, context: scenario.category, candidate: scenario.candidate, answer: phrase, model: scenario.model, ...favoritesAndDifficult(progress) });
  return <StudioPage navigate={navigate} eyebrow="Po prawdziwej rozmowie" title="Zamroziło mnie, gdy…" description="Wybierz rodzaj trudnej sytuacji. Bez nazwisk, bez nazw klienta i bez zapisywania treści prawdziwej rozmowy." illustration={6} className="journal-page">
    <section className="journal-entry">
      <label htmlFor="journal-case">Co było trudne?<select id="journal-case" value={caseId} onChange={(event) => { setCaseId(event.target.value); setSaved(false); setOwnPhrase(""); setPrivacyError(""); }}>{difficultSituations.map((item) => <option key={item.id} value={item.id}>{item.category}: {item.title}</option>)}</select></label>
      <div className="journal-model"><span>Zdanie, które może odzyskać ten moment</span><p lang="en">{scenario.model}</p><ListenButton phrase={scenario.model} /></div>
      <label htmlFor="journal-phrase">Twoja własna wersja, jeśli chcesz ją uprościć<textarea id="journal-phrase" value={ownPhrase} onChange={(event) => { setOwnPhrase(event.target.value); setSaved(false); setPrivacyError(""); }} placeholder={scenario.model} maxLength={400} /></label>
      <p className="journal-input-warning">Wpisz tylko uniwersalne zdanie, bez imion, nazw firm, e-maili i numerów.</p>
      {privacyError && <p className="journal-error" role="alert"><WarningCircle size={17} /> {privacyError}</p>}
      <button type="button" className="button button--violet" disabled={saved} onClick={rescue}>{saved ? <Check size={18} /> : <Heart size={18} />} {saved ? "Fraza dodana do twoich powtórek" : "Zabierz to zdanie do kolejnej rozmowy"}</button>
      <PromptHandoff prompt={prompt} label="Przećwicz ten moment z ChatGPT" compact disabled={hasPersonalDetails(phrase)} />
      <button type="button" className="text-button journal-lesson" onClick={() => navigate(`lesson/${scenario.lessonId}`)}>Otwórz powiązaną lekcję {scenario.lessonId} <ArrowRight size={16} /></button>
      <p className="field-privacy"><ShieldCheck size={17} /> Zapisujemy wyłącznie kategorię i ćwiczoną frazę, nie szczegóły kandydata ani klienta.</p>
    </section>
    {counts.length > 0 && <section className="journal-patterns"><span className="eyebrow">Twoje powracające momenty</span><h2>Wiesz już, co warto oswoić.</h2>{counts.map(([category, count]) => <div key={category}><span>{category}</span><span>{count} {count === 1 ? "sytuacja" : count < 5 ? "sytuacje" : "sytuacji"}</span></div>)}</section>}
  </StudioPage>;
}

export function FieldworkStudio({ route, progress, updateProgress, navigate }) {
  const segment = route.split("/")[1] || "";
  const shared = { progress, updateProgress, navigate };
  if (segment === "simulator") return <CallSimulator {...shared} initialRole={route.split("/")[2]} />;
  if (segment === "reflex") return <ReflexPractice {...shared} />;
  if (segment === "listening") return <ListeningPractice {...shared} />;
  if (segment === "prepare") return <QuickBrief {...shared} initialRole={route.split("/")[2]} />;
  if (segment === "roles") return <RoleLab {...shared} />;
  if (segment === "situations") return <SituationLab {...shared} />;
  if (segment === "natural") return <NaturalEnglish {...shared} />;
  if (segment === "team") return <TeamPractice {...shared} />;
  if (segment === "messages") return <WritingPractice {...shared} />;
  if (segment === "journal") return <AfterCallJournal {...shared} />;
  return <StudioHome {...shared} />;
}
