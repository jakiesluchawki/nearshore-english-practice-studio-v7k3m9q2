import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight, Check, CheckCircle, Clock, Headphones, Microphone,
  Pause, Play, Repeat, Sparkle, Star, Stop, Timer,
} from "@phosphor-icons/react";
import { getLesson, lessons } from "../data/curriculum.js";
import { getDialoguePracticeContext } from "../data/dialogues.js";
import { getLessonQuiz } from "../data/quizzes.js";
import {
  formatLocalDate, getDuePhraseReviews, getNextLessonId, phraseReviewLabel,
  ratePhraseProgress, scheduleReview, withPracticeDay,
} from "../data/reviews.js";
import { matchSavedPhrases, screeningScriptText, screeningSteps } from "../data/screening.js";

const reviewOptions = [
  ["again", "Jeszcze raz", "jutro"],
  ["hard", "Trudne", "za 3 dni"],
  ["good", "Mam to", "za 7 dni"],
];

export function speakPhrase(phrase) {
  if (!("speechSynthesis" in window)) return false;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(phrase);
  utterance.lang = "en-GB";
  utterance.rate = 0.88;
  window.speechSynthesis.speak(utterance);
  return true;
}

export function PhraseReviewControls({ phrase, lessonId = 0, progress, updateProgress, compact = false }) {
  const selected = progress.phraseSchedule?.[phrase];

  return <div className={`phrase-review ${compact ? "phrase-review--compact" : ""}`}>
    {!compact && <span className="phrase-review-label">Jak łatwo przychodzi ci właśnie to zdanie?</span>}
    <div className="phrase-review-buttons" role="group" aria-label={`Oceń frazę: ${phrase}`}>
      {reviewOptions.map(([rating, label, timing]) => <button
        key={rating}
        type="button"
        aria-pressed={selected?.rating === rating}
        className={selected?.rating === rating ? `selected selected--${rating}` : ""}
        onClick={() => updateProgress((current) => ratePhraseProgress(current, phrase, rating, lessonId))}
      ><span>{label}</span>{!compact && <small>{timing}</small>}</button>)}
    </div>
    {!compact && selected && <p className="phrase-review-feedback" role="status"><Check size={15} weight="bold" /> Powtórka tej frazy: {phraseReviewLabel(selected)}.</p>}
  </div>;
}

function displayTime(seconds) {
  if (seconds < 60) return `${seconds}`;
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

export function PracticeTimer({ seconds, lessonKey = "practice", title = "Twój czas", compact = false }) {
  const [remaining, setRemaining] = useState(seconds);
  const [running, setRunning] = useState(false);
  const deadlineRef = useRef(0);

  useEffect(() => {
    setRemaining(seconds);
    setRunning(false);
    deadlineRef.current = 0;
  }, [seconds, lessonKey]);

  useEffect(() => {
    if (!running) return undefined;
    deadlineRef.current = Date.now() + remaining * 1000;
    const interval = window.setInterval(() => {
      const next = Math.max(0, Math.ceil((deadlineRef.current - Date.now()) / 1000));
      setRemaining(next);
      if (!next) setRunning(false);
    }, 250);
    return () => window.clearInterval(interval);
  }, [running]);

  return <div className={`practice-timer ${compact ? "practice-timer--compact" : ""}`}>
    <div className="practice-timer-copy"><Timer size={compact ? 19 : 24} /><div><strong>{title}</strong><span>{remaining === 0 ? "Czas minął, możesz mówić dalej." : running ? "Spokojnie, mów po swojemu." : "Uruchom, kiedy będziesz gotowa."}</span></div></div>
    <output className="practice-timer-value" aria-label={`Pozostały czas: ${displayTime(remaining)}`}>{displayTime(remaining)}</output>
    <div className="practice-timer-actions"><button type="button" onClick={() => { if (!remaining) setRemaining(seconds); setRunning((value) => !value); }}>{running ? <Pause size={17} weight="fill" /> : <Play size={17} weight="fill" />}{running ? "Pauza" : remaining < seconds && remaining ? "Wznów" : "Start"}</button>{remaining < seconds && <button type="button" className="timer-reset" onClick={() => { setRemaining(seconds); setRunning(false); }} aria-label="Zacznij od początku"><Repeat size={17} /></button>}</div>
  </div>;
}

export function VoicePractice({ onTranscript, lessonKey = "practice" }) {
  const recognitionRef = useRef(null);
  const recorderRef = useRef(null);
  const streamRef = useRef(null);
  const audioUrlRef = useRef("");
  const generationRef = useRef(0);
  const pendingRef = useRef(false);
  const [recording, setRecording] = useState(false);
  const [recognizing, setRecognizing] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [audioUrl, setAudioUrl] = useState("");
  const [message, setMessage] = useState("");
  const Recognition = typeof window === "undefined" ? null : window.SpeechRecognition || window.webkitSpeechRecognition;
  const supportsRecording = typeof window !== "undefined" && Boolean(navigator.mediaDevices?.getUserMedia && window.MediaRecorder);

  useEffect(() => {
    generationRef.current += 1;
    setAudioUrl("");
    setMessage("");
    setRecording(false);
    setRecognizing(false);
    setRequesting(false);
    return () => {
      generationRef.current += 1;
      pendingRef.current = false;
      recognitionRef.current?.abort();
      recorderRef.current?.state === "recording" && recorderRef.current.stop();
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = "";
    };
  }, [lessonKey]);

  async function toggleRecording() {
    if (recording) {
      recorderRef.current?.stop();
      return;
    }
    if (pendingRef.current || recognizing) return;

    const generation = generationRef.current;
    let stream;
    try {
      pendingRef.current = true;
      setRequesting(true);
      setMessage("");
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (generationRef.current !== generation) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      streamRef.current = stream;
      const chunks = [];
      const recorder = new MediaRecorder(stream);
      recorderRef.current = recorder;
      recorder.addEventListener("dataavailable", (event) => event.data.size && chunks.push(event.data));
      recorder.addEventListener("stop", () => {
        stream.getTracks().forEach((track) => track.stop());
        if (generationRef.current !== generation) return;
        streamRef.current = null;
        setRecording(false);
        if (!chunks.length) return;
        if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
        audioUrlRef.current = URL.createObjectURL(new Blob(chunks, { type: recorder.mimeType || "audio/webm" }));
        setAudioUrl(audioUrlRef.current);
        setMessage("Nagranie zostaje w tej karcie i nie jest wysyłane do aplikacji.");
      });
      recorder.start();
      setRecording(true);
    } catch {
      stream?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      if (generationRef.current === generation) {
        setRecording(false);
        setMessage("Nie udało się uzyskać dostępu do mikrofonu. Nadal możesz wpisać odpowiedź.");
      }
    } finally {
      if (generationRef.current === generation) {
        pendingRef.current = false;
        setRequesting(false);
      }
    }
  }

  function toggleRecognition() {
    if (recognizing) {
      recognitionRef.current?.stop();
      return;
    }
    if (!Recognition || recording || pendingRef.current) return;

    try {
      setMessage("");
      const recognition = new Recognition();
      recognitionRef.current = recognition;
      recognition.lang = "en-GB";
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;
      recognition.onresult = (event) => {
        const text = Array.from(event.results).map((result) => result[0]?.transcript || "").join(" ").trim();
        if (text) onTranscript?.(text);
      };
      recognition.onerror = () => setMessage("Rozpoznawanie mowy jest niedostępne. Wpisz odpowiedź albo nagraj ją lokalnie.");
      recognition.onend = () => setRecognizing(false);
      recognition.start();
      setRecognizing(true);
    } catch {
      setRecognizing(false);
      setMessage("Przeglądarka nie pozwoliła uruchomić rozpoznawania mowy.");
    }
  }

  if (!supportsRecording && !Recognition) return null;

  return <div className="voice-practice"><div className="voice-actions">{supportsRecording && <button type="button" className={recording ? "recording" : ""} aria-pressed={recording} disabled={requesting || recognizing} onClick={toggleRecording}>{recording ? <Stop size={17} weight="fill" /> : <Microphone size={17} />}{requesting ? "Proszę o dostęp do mikrofonu…" : recording ? "Zakończ nagranie" : "Nagraj odpowiedź"}</button>}{Recognition && <button type="button" aria-pressed={recognizing} disabled={recording || requesting} onClick={toggleRecognition}><Microphone size={17} weight={recognizing ? "fill" : "regular"} />{recognizing ? "Zatrzymaj zapis" : "Mów i zamień na tekst"}</button>}</div>{audioUrl && <audio className="voice-playback" controls src={audioUrl} aria-label="Odtwórz swoje nagranie" />}{message && <p role="status">{message}</p>}{Recognition && <small>Rozpoznawanie mowy działa tylko w obsługiwanych przeglądarkach i może korzystać z usługi ich dostawcy.</small>}</div>;
}

const commonWords = new Set(["could", "would", "should", "there", "their", "about", "which", "after", "before", "going", "today", "really", "still", "please", "quite", "through", "what", "that", "does", "good", "currently", "personally", "completely", "looking", "have", "with", "your", "this"]);

function buildCloze(answer) {
  const matches = [...answer.matchAll(/[A-Za-z][A-Za-z’'-]{3,}/g)];
  const word = matches.find((match) => match[0].length >= 6 && !commonWords.has(match[0].toLowerCase()))?.[0]
    || matches.find((match) => !commonWords.has(match[0].toLowerCase()))?.[0]
    || matches[0]?.[0]
    || "";
  return { word, sentence: word ? answer.replace(word, "________") : answer };
}

export function ClozeExercise({ lesson, answer }) {
  const exercise = useMemo(() => buildCloze(answer), [answer]);
  const [input, setInput] = useState("");
  const [checked, setChecked] = useState(false);
  const correct = input.trim().toLocaleLowerCase("en-GB") === exercise.word.toLocaleLowerCase("en-GB");

  useEffect(() => { setInput(""); setChecked(false); }, [lesson.id, answer]);

  return <div className="cloze-exercise"><span className="eyebrow">Uzupełnij naturalne zdanie</span><p lang="en" className="cloze-sentence">{exercise.sentence}</p><form onSubmit={(event) => { event.preventDefault(); setChecked(true); }}><input aria-label="Brakujące angielskie słowo" value={input} onChange={(event) => { setInput(event.target.value); setChecked(false); }} placeholder="Brakujące słowo…" autoComplete="off" /><button disabled={!input.trim()} type="submit">Sprawdź</button></form>{checked && <p className={`cloze-feedback ${correct ? "correct" : ""}`} role="status">{correct ? "Tak, właśnie tak brzmi naturalny wariant." : <>W tym wariancie pasuje słowo <strong lang="en">{exercise.word}</strong>. Powiedz całe zdanie jeszcze raz.</>}</p>}</div>;
}

const sessionStages = [
  { id: "review", title: "Rozgrzej swoje frazy", minutes: 3, label: "Powtórki" },
  { id: "situation", title: "Jedna konkretna sytuacja", minutes: 4, label: "Nowa sytuacja" },
  { id: "translate", title: "Powiedz to po angielsku", minutes: 4, label: "PL → EN" },
  { id: "dialogue", title: "Odpowiedz kandydatowi", minutes: 4, label: "Dialog" },
  { id: "recap", title: "Zabierz jedno zdanie do pracy", minutes: 2, label: "Podsumowanie" },
];

export function DailyPractice({ progress, updateProgress, navigate }) {
  const [sessionLessonId] = useState(() => progress.completed.length >= lessons.length
    ? [91, 95, 98, 99, 100][new Date().getDate() % 5]
    : getNextLessonId(progress, lessons));
  const [stage, setStage] = useState(0);
  const [furthestStage, setFurthestStage] = useState(0);
  const [translation, setTranslation] = useState("");
  const [translationVisible, setTranslationVisible] = useState(false);
  const [dialogueAnswer, setDialogueAnswer] = useState("");
  const [dialogueVisible, setDialogueVisible] = useState(false);
  const [finished, setFinished] = useState(false);
  const startedAtRef = useRef(Date.now());
  const lesson = getLesson(sessionLessonId);
  const quiz = useMemo(() => getLessonQuiz(lesson), [lesson.id]);
  const { candidateLead, recruiterModel, candidateFollowUp } = getDialoguePracticeContext(lesson);
  const queue = getDuePhraseReviews(progress).slice(0, 4);
  const currentStage = sessionStages[stage];
  const canAdvance = stage === 2 ? Boolean(translation.trim()) : stage === 3 ? dialogueVisible : true;

  function advance() {
    if (!canAdvance) return;
    const next = Math.min(sessionStages.length - 1, stage + 1);
    setStage(next);
    setFurthestStage((current) => Math.max(current, next));
  }

  function completeSession() {
    updateProgress((current) => withPracticeDay({
      ...current,
      completed: [...new Set([...(current.completed || []), lesson.id])].sort((first, second) => first - second),
      reviewSchedule: { ...(current.reviewSchedule || {}), [lesson.id]: scheduleReview("good") },
      sessionHistory: [...(current.sessionHistory || []), { date: formatLocalDate(), lessonId: lesson.id, minutes: Math.max(1, Math.round((Date.now() - startedAtRef.current) / 60000)) }].slice(-120),
    }));
    setFinished(true);
  }

  return <main id="main" className="page page-width daily-practice-page"><header className="daily-intro"><div><span className="eyebrow">Twoje 17 minut</span><h1>Mała sesja. Dużo mniej pustki.</h1><p>Nowy język miesza się z frazami, które sama zapisałaś. Najpierw mówisz, dopiero potem porównujesz.</p></div><PracticeTimer seconds={17 * 60} lessonKey={`session-${lesson.id}`} title="Czas całej sesji" compact /></header><ol className="session-progress" aria-label="Plan codziennej sesji">{sessionStages.map((item, index) => <li key={item.id} className={index === stage ? "current" : index < stage ? "done" : ""}><button type="button" disabled={index > furthestStage} onClick={() => setStage(index)} aria-current={index === stage ? "step" : undefined}><span>{index < stage ? <Check size={16} weight="bold" /> : String(index + 1).padStart(2, "0")}</span><strong>{item.label}</strong><small>{item.minutes} min</small></button></li>)}</ol><section className="session-stage"><header><span className="eyebrow">{String(stage + 1).padStart(2, "0")} · {currentStage.minutes} min</span><h2>{currentStage.title}</h2></header>
    {stage === 0 && <><p>{queue.length ? "Każde zdanie oceniasz osobno. Ulubione i trudne wracają jako pierwsze." : "Nie masz jeszcze zaległych zdań. Zacznij od jednej frazy z dzisiejszej lekcji."}</p><div className="session-review-list">{(queue.length ? queue : [{ phrase: quiz.answer, lessonId: lesson.id, favorite: progress.myPhrases.includes(quiz.answer) }]).map((item) => <article key={item.phrase}><div><p lang="en">{item.phrase}</p><span>{item.favorite ? <><Star size={15} weight="fill" /> Twoja fraza</> : "Z dzisiejszej lekcji"}</span></div><button type="button" className="session-listen" onClick={() => speakPhrase(item.phrase)} aria-label={`Posłuchaj: ${item.phrase}`}><Headphones size={19} /></button><PhraseReviewControls phrase={item.phrase} lessonId={item.lessonId || lesson.id} progress={progress} updateProgress={updateProgress} compact /></article>)}</div></>}
    {stage === 1 && <><p className="session-context">Wyobraź sobie, że chcesz {lesson.goal}. Zacznij od zdania, które przyszłoby ci do głowy podczas prawdziwej rozmowy.</p><PracticeTimer seconds={lesson.practiceType === "message" ? 45 : 20} lessonKey={`intro-${lesson.id}`} title={lesson.practiceType === "message" ? "Czas na krótką wiadomość" : "Czas na odpowiedź na głos"} /><div className="session-phrase-pack">{lesson.phrases.slice(0, 3).map((phrase) => <button type="button" key={phrase} lang="en" onClick={() => speakPhrase(phrase)}><Headphones size={16} /> {phrase}</button>)}</div></>}
    {stage === 2 && <><div className="translation-exercise"><span className="eyebrow">Twoja intencja po polsku</span><p>Chcesz {quiz.intention}. Jak powiesz to po angielsku?</p><textarea value={translation} onChange={(event) => setTranslation(event.target.value)} aria-label="Twoja odpowiedź po angielsku" placeholder="Najpierw powiedz, potem zapisz swoją wersję…" /><VoicePractice onTranscript={setTranslation} lessonKey={`translation-${lesson.id}`} /><button type="button" className="button button--outline" onClick={() => setTranslationVisible(true)} disabled={!translation.trim()}>Porównaj ze wzorem</button>{translationVisible && <div className="translation-model"><span>Naturalny wariant</span><p lang="en">{quiz.answer}</p><small>Twoja odpowiedź nie musi brzmieć identycznie. Liczy się ta sama intencja i spokojny ton.</small></div>}</div><ClozeExercise lesson={lesson} answer={quiz.answer} /></>}
    {stage === 3 && <><div className="session-dialogue"><div className="session-candidate"><span>{candidateLead ? "Candidate" : "Sytuacja"}</span>{candidateLead ? <p lang="en">{candidateLead}</p> : <p>Twoim celem jest {lesson.goal}. Zacznij rozmowę własnym zdaniem.</p>}</div><label><span>Twoja odpowiedź</span><textarea value={dialogueAnswer} onChange={(event) => setDialogueAnswer(event.target.value)} placeholder={candidateLead ? "Jak odpowiesz kandydatowi?" : "Jak zaczniesz tę część rozmowy?"} /></label><VoicePractice onTranscript={setDialogueAnswer} lessonKey={`dialogue-${lesson.id}`} /><button type="button" className="button button--violet" disabled={!dialogueAnswer.trim()} onClick={() => { setDialogueVisible(true); updateProgress((current) => withPracticeDay(current)); }}>Sprawdź naturalny wariant</button>{dialogueVisible && <><div className="translation-model"><span>Jedna z możliwych odpowiedzi</span><p lang="en">{recruiterModel}</p><small>W pełnej lekcji możesz poprosić ChatGPT o ocenę własnej odpowiedzi.</small></div>{candidateFollowUp && <div className="session-candidate session-candidate--follow"><span>Candidate odpowiada</span><p lang="en">{candidateFollowUp}</p></div>}</>}</div></>}
    {stage === 4 && <><div className="session-recap"><Sparkle size={27} weight="fill" /><div><strong>Dzisiejsza fraza do zabrania</strong><p lang="en">{quiz.answer}</p></div></div><PhraseReviewControls phrase={quiz.answer} lessonId={lesson.id} progress={progress} updateProgress={updateProgress} />{finished ? <div className="session-finished" role="status"><CheckCircle size={23} weight="fill" /><div><strong>Sesja zapisana.</strong><span>Wróć jutro albo przejdź do pełnej lekcji.</span></div></div> : <button type="button" className="button button--violet" onClick={completeSession}>Zakończ i zapisz dzisiejszą sesję <Check size={18} /></button>}</>}
    <footer className="session-navigation"><button type="button" className="text-button" onClick={() => navigate(`lesson/${lesson.id}`)}>Pełna lekcja {lesson.id}</button>{stage < sessionStages.length - 1 && <button type="button" className="button button--violet" disabled={!canAdvance} onClick={advance}>Dalej: {sessionStages[stage + 1].label} <ArrowRight size={17} /></button>}</footer>
  </section></main>;
}

export function PersonalScreeningScript({ progress, updateProgress, copyText, navigate }) {
  const savedPhrases = progress.myPhrases || [];
  const [copied, setCopied] = useState(false);
  const selections = progress.personalScript || {};

  function optionsFor(step) {
    const lesson = getLesson(step.lessonId);
    const matching = matchSavedPhrases(step, savedPhrases, lesson.phrases);
    return [...new Set([...matching, ...step.variants, ...savedPhrases])];
  }

  function choose(stepId, phrase) {
    updateProgress((current) => ({ ...current, personalScript: { ...(current.personalScript || {}), [stepId]: phrase } }));
  }

  async function copyScript() {
    const resolvedSelections = Object.fromEntries(screeningSteps.map((step) => [step.id, selections[step.id] || optionsFor(step)[0]]));
    const success = await copyText(screeningScriptText(resolvedSelections));
    if (success) updateProgress((current) => ({ ...current, personalScript: { ...(current.personalScript || {}), ...resolvedSelections } }));
    setCopied(success);
    if (success) window.setTimeout(() => setCopied(false), 2000);
  }

  function openCallMode() {
    const resolvedSelections = Object.fromEntries(screeningSteps.map((step) => [step.id, selections[step.id] || optionsFor(step)[0]]));
    updateProgress((current) => ({ ...current, personalScript: { ...(current.personalScript || {}), ...resolvedSelections } }));
    navigate("cheats/first-call/call");
  }

  return <section className="lesson-block personal-script"><span className="eyebrow">Twój własny screening</span><h2>Ułóż rozmowę z fraz, które brzmią jak ty.</h2><p>{savedPhrases.length ? "Twoje zapisane zdania możesz przypisać do dowolnego etapu. Wybór zostaje w tej przeglądarce." : "Najpierw oznacz gwiazdką kilka zdań w lekcjach. Na początek możesz skorzystać z gotowych, spokojnych wariantów."}</p>{savedPhrases.length > 0 && <div className="script-saved-phrases"><span>Twoje zapisane frazy</span>{savedPhrases.slice(0, 10).map((phrase) => <span key={phrase} lang="en" className="script-phrase-chip"><Star size={14} weight="fill" /> {phrase}</span>)}</div>}<ol className="script-builder">{screeningSteps.map((step, index) => { const options = optionsFor(step); const current = selections[step.id] || options[0]; return <li key={step.id}><span className="script-step-number">{String(index + 1).padStart(2, "0")}</span><div><strong>{step.title}</strong><small>{step.goal}</small><label><span className="sr-only">Wybierz frazę dla etapu {step.title}</span><select value={current} onChange={(event) => choose(step.id, event.target.value)}>{options.map((phrase) => <option key={phrase} value={phrase}>{savedPhrases.includes(phrase) ? "★ " : ""}{phrase}</option>)}</select></label></div><button type="button" className="script-listen" onClick={() => speakPhrase(current)} aria-label={`Posłuchaj: ${current}`}><Headphones size={18} /></button></li>; })}</ol><div className="script-actions"><button type="button" className="button button--violet" onClick={copyScript}>{copied ? <Check size={18} /> : <Clock size={18} />}{copied ? "Skrypt skopiowany" : "Skopiuj cały skrypt"}</button><button type="button" className="button button--outline" onClick={openCallMode}>Otwórz tryb rozmowy <ArrowRight size={17} /></button></div></section>;
}
