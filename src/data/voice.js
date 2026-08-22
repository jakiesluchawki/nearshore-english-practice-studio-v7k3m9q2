const supportedAudioTypes = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4",
  "audio/ogg;codecs=opus",
];

export function getVoiceCapabilities(browser, browserNavigator) {
  if (!browser) {
    return { secure: false, online: true, recording: false, recognition: null, brave: false };
  }

  const navigation = browserNavigator || browser.navigator || globalThis.navigator;
  const secure = browser.isSecureContext !== false;
  const recognition = secure && (browser.SpeechRecognition || browser.webkitSpeechRecognition || null);

  return {
    secure,
    online: navigation?.onLine !== false,
    recording: secure
      && typeof navigation?.mediaDevices?.getUserMedia === "function"
      && typeof browser.MediaRecorder === "function",
    recognition: typeof recognition === "function" ? recognition : null,
    brave: Boolean(navigation?.brave),
  };
}

export function pickSupportedAudioMimeType(Recorder) {
  if (typeof Recorder?.isTypeSupported !== "function") return "";
  return supportedAudioTypes.find((type) => {
    try { return Recorder.isTypeSupported(type); } catch { return false; }
  }) || "";
}

export function getRecordedBlobMimeType(recorder, chunks = [], preferred = "") {
  return recorder?.mimeType || chunks.find((chunk) => chunk?.type)?.type || preferred || "";
}

export function getMicrophoneErrorMessage(error, { secure = true } = {}) {
  const name = error?.name || error?.error || "";

  if (!secure || name === "SecurityError") {
    return "Mikrofon działa tylko pod bezpiecznym adresem HTTPS. Otwórz kurs przez jego właściwy link.";
  }
  if (["NotAllowedError", "PermissionDeniedError", "not-allowed"].includes(name)) {
    return "Mikrofon jest zablokowany. Zezwól na mikrofon przy adresie strony, a na Macu sprawdź: Ustawienia systemowe → Prywatność i ochrona → Mikrofon.";
  }
  if (["NotFoundError", "DevicesNotFoundError", "audio-capture"].includes(name)) {
    return "Nie wykryto mikrofonu. Podłącz urządzenie lub wybierz właściwe wejście dźwięku w ustawieniach systemu.";
  }
  if (["NotReadableError", "TrackStartError", "AbortError"].includes(name)) {
    return "Mikrofon jest zajęty albo został odłączony. Zamknij inną rozmowę lub nagrywanie i spróbuj ponownie.";
  }
  if (name === "InvalidStateError") {
    return "Inne ćwiczenie korzysta już z mikrofonu. Zatrzymaj je i uruchom nagrywanie ponownie.";
  }
  if (name === "NotSupportedError") {
    return "Ta przeglądarka nie potrafi nagrać dźwięku z wybranego urządzenia. Spróbuj innej przeglądarki lub wpisz odpowiedź.";
  }

  return "Nie udało się uruchomić mikrofonu. Sprawdź dostęp strony i ustawienia wejścia dźwięku.";
}

export function getSpeechRecognitionErrorMessage(error, { online = true, brave = false } = {}) {
  const code = typeof error === "string" ? error : error?.error || error?.name || "";

  if (code === "aborted") return "";
  if (["not-allowed", "NotAllowedError"].includes(code)) {
    return getMicrophoneErrorMessage({ name: "NotAllowedError" });
  }
  if (code === "audio-capture") return getMicrophoneErrorMessage({ name: "NotFoundError" });
  if (code === "no-speech") {
    return "Nie wykryto wypowiedzi. Sprawdź mikrofon, zacznij mówić od razu i spróbuj jeszcze raz.";
  }
  if (code === "language-not-supported") {
    return "Przeglądarka nie obsługuje angielskiego dyktowania. Użyj systemowego dyktowania albo otwórz kurs w Chrome.";
  }
  if (!online || code === "network") {
    return online
      ? `${brave ? "Brave" : "Przeglądarka"} nie połączyła się z usługą rozpoznawania mowy. Użyj systemowego dyktowania na Macu albo otwórz kurs w Chrome.`
      : "Dyktowanie wymaga połączenia z internetem. Nadal możesz wpisać odpowiedź albo nagrać ją tylko do odsłuchu.";
  }
  if (code === "service-not-allowed") {
    return `${brave ? "Brave" : "Ta przeglądarka"} nie udostępnia usługi zamiany mowy na tekst. Użyj systemowego dyktowania na Macu albo otwórz kurs w Chrome.`;
  }

  return "Nie udało się zamienić mowy na tekst. Użyj systemowego dyktowania albo wpisz odpowiedź ręcznie.";
}

export function extractSpeechTranscript(event, existing = "") {
  const spoken = Array.from(event?.results || [])
    .map((result) => result?.[0]?.transcript || "")
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
  if (!spoken) return "";
  return [String(existing || "").trim(), spoken].filter(Boolean).join(" ");
}

export function mergeSpeechTranscript(event, current = "", previousSpeech = "") {
  const nextSpeech = extractSpeechTranscript(event);
  if (!nextSpeech) return { text: "", speech: "" };

  const currentText = String(current || "").trim();
  const previous = String(previousSpeech || "").trim();

  if (!previous) return { text: [currentText, nextSpeech].filter(Boolean).join(" "), speech: nextSpeech };

  if (currentText.endsWith(previous)) {
    const prefix = currentText.slice(0, currentText.length - previous.length).trim();
    return { text: [prefix, nextSpeech].filter(Boolean).join(" "), speech: nextSpeech };
  }

  const continuation = nextSpeech.startsWith(previous) ? nextSpeech.slice(previous.length).trim() : nextSpeech;
  return { text: [currentText, continuation].filter(Boolean).join(" "), speech: nextSpeech };
}

export function createMicrophoneCoordinator() {
  let current = null;

  return {
    claim(owner, stop) {
      if (current && current.owner !== owner) {
        try { current.stop?.(); } catch { /* Releasing a disconnected device must not block the next exercise. */ }
      }
      current = { owner, stop };
    },
    release(owner) {
      if (current?.owner !== owner) return false;
      current = null;
      return true;
    },
    owns(owner) {
      return current?.owner === owner;
    },
  };
}
