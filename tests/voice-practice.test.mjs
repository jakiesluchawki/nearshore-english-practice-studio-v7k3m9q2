import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";
import {
  createMicrophoneCoordinator, extractSpeechTranscript, getMicrophoneErrorMessage,
  getRecordedBlobMimeType, getSpeechRecognitionErrorMessage, getVoiceCapabilities,
  mergeSpeechTranscript, pickSupportedAudioMimeType,
} from "../src/data/voice.js";

class FakeRecorder {}
class FakeRecognition {}

test("detects recording and dictation independently without breaking unsupported browsers", () => {
  const navigation = { mediaDevices: { getUserMedia() {} }, onLine: true };
  const supported = getVoiceCapabilities({ isSecureContext: true, MediaRecorder: FakeRecorder, webkitSpeechRecognition: FakeRecognition }, navigation);
  assert.equal(supported.recording, true);
  assert.equal(supported.recognition, FakeRecognition);

  const recorderOnly = getVoiceCapabilities({ isSecureContext: true, MediaRecorder: FakeRecorder }, navigation);
  assert.equal(recorderOnly.recording, true);
  assert.equal(recorderOnly.recognition, null);

  const recognitionOnly = getVoiceCapabilities({ isSecureContext: true, SpeechRecognition: FakeRecognition }, {});
  assert.equal(recognitionOnly.recording, false);
  assert.equal(recognitionOnly.recognition, FakeRecognition);

  const unsupported = getVoiceCapabilities({ isSecureContext: true }, {});
  assert.equal(unsupported.recording, false);
  assert.equal(unsupported.recognition, null);
  assert.equal(getVoiceCapabilities(undefined).secure, false);
});

test("blocks microphone APIs on insecure pages while preserving offline local recording", () => {
  const navigation = { mediaDevices: { getUserMedia() {} }, onLine: false, brave: {} };
  const insecure = getVoiceCapabilities({ isSecureContext: false, MediaRecorder: FakeRecorder, SpeechRecognition: FakeRecognition }, navigation);
  assert.equal(insecure.secure, false);
  assert.equal(insecure.recording, false);
  assert.equal(insecure.recognition, null);

  const offline = getVoiceCapabilities({ isSecureContext: true, MediaRecorder: FakeRecorder, SpeechRecognition: FakeRecognition }, navigation);
  assert.equal(offline.online, false);
  assert.equal(offline.recording, true);
  assert.equal(offline.recognition, FakeRecognition);
  assert.equal(offline.brave, true);
});

test("selects browser-supported audio formats including Safari-compatible MP4", () => {
  class SafariRecorder {
    static isTypeSupported(type) { return type === "audio/mp4"; }
  }
  class ChromiumRecorder {
    static isTypeSupported(type) { return type === "audio/webm;codecs=opus"; }
  }
  class BrokenRecorder {
    static isTypeSupported() { throw new Error("unsupported"); }
  }

  assert.equal(pickSupportedAudioMimeType(SafariRecorder), "audio/mp4");
  assert.equal(pickSupportedAudioMimeType(ChromiumRecorder), "audio/webm;codecs=opus");
  assert.equal(pickSupportedAudioMimeType(BrokenRecorder), "");
  assert.equal(pickSupportedAudioMimeType(FakeRecorder), "");
  assert.equal(getRecordedBlobMimeType({ mimeType: "audio/mp4" }, [{ type: "audio/webm" }]), "audio/mp4");
  assert.equal(getRecordedBlobMimeType({}, [{ type: "audio/mp4" }], "audio/webm"), "audio/mp4");
  assert.equal(getRecordedBlobMimeType({}, [], "audio/webm"), "audio/webm");
  assert.equal(getRecordedBlobMimeType({}, []), "");
});

test("explains blocked permissions, missing devices, busy microphones and insecure contexts", () => {
  assert.match(getMicrophoneErrorMessage({ name: "NotAllowedError" }), /Prywatność i ochrona/);
  assert.match(getMicrophoneErrorMessage({ name: "NotFoundError" }), /Nie wykryto mikrofonu/);
  assert.match(getMicrophoneErrorMessage({ name: "NotReadableError" }), /zajęty/);
  assert.match(getMicrophoneErrorMessage({ name: "AbortError" }), /odłączony/);
  assert.match(getMicrophoneErrorMessage({ name: "InvalidStateError" }), /Inne ćwiczenie/);
  assert.match(getMicrophoneErrorMessage({ name: "SecurityError" }), /HTTPS/);
  assert.match(getMicrophoneErrorMessage({}, { secure: false }), /HTTPS/);
});

test("explains Brave speech-service problems, offline mode, denied permissions and silence", () => {
  assert.match(getSpeechRecognitionErrorMessage("service-not-allowed", { brave: true }), /Brave/);
  assert.match(getSpeechRecognitionErrorMessage("service-not-allowed", { brave: true }), /dyktowania/);
  assert.match(getSpeechRecognitionErrorMessage("network", { online: true, brave: true }), /Brave/);
  assert.match(getSpeechRecognitionErrorMessage("network", { online: false }), /wymaga połączenia/);
  assert.match(getSpeechRecognitionErrorMessage({ error: "not-allowed" }), /Mikrofon jest zablokowany/);
  assert.match(getSpeechRecognitionErrorMessage("audio-capture"), /Nie wykryto mikrofonu/);
  assert.match(getSpeechRecognitionErrorMessage("no-speech"), /Nie wykryto wypowiedzi/);
  assert.match(getSpeechRecognitionErrorMessage("language-not-supported"), /angielskiego dyktowania/);
  assert.equal(getSpeechRecognitionErrorMessage("aborted"), "");
});

test("joins cumulative speech results without duplicating earlier dictated words", () => {
  const initial = "I think";
  const first = { results: [[{ transcript: "hello" }]] };
  const second = { results: [[{ transcript: "hello" }], [{ transcript: "world" }]] };
  assert.equal(extractSpeechTranscript(first, initial), "I think hello");
  assert.equal(extractSpeechTranscript(second, initial), "I think hello world");
  assert.equal(extractSpeechTranscript({ results: [[{ transcript: "  fully   remote  " }]] }), "fully remote");
  assert.equal(extractSpeechTranscript({ results: [] }, initial), "");
});

test("preserves edits typed by the learner while continuous dictation is still active", () => {
  const first = { results: [[{ transcript: "hello" }]] };
  const second = { results: [[{ transcript: "hello" }], [{ transcript: "world" }]] };
  const initial = mergeSpeechTranscript(first, "I think", "");
  assert.deepEqual(initial, { text: "I think hello", speech: "hello" });
  assert.deepEqual(mergeSpeechTranscript(second, initial.text, initial.speech), {
    text: "I think hello world", speech: "hello world",
  });
  assert.deepEqual(mergeSpeechTranscript(second, "I believe hi", initial.speech), {
    text: "I believe hi world", speech: "hello world",
  });
  assert.deepEqual(mergeSpeechTranscript({ results: [] }, "Keep my manual changes", "hello"), {
    text: "", speech: "",
  });
});

test("allows only one exercise to own the microphone and ignores stale releases", () => {
  const coordinator = createMicrophoneCoordinator();
  const first = Symbol("first exercise");
  const second = Symbol("second exercise");
  let stopped = 0;

  coordinator.claim(first, () => { stopped += 1; });
  assert.equal(coordinator.owns(first), true);
  coordinator.claim(second, () => {});
  assert.equal(stopped, 1);
  assert.equal(coordinator.owns(second), true);
  assert.equal(coordinator.release(first), false);
  assert.equal(coordinator.owns(second), true);
  assert.equal(coordinator.release(second), true);
  assert.equal(coordinator.owns(second), false);

  coordinator.claim(first, () => { throw new Error("microphone disconnected"); });
  coordinator.claim(second, () => {});
  assert.equal(coordinator.owns(second), true);
});

test("renders honest microphone and dictation affordances for every browser-capability combination", async () => {
  const previous = Object.fromEntries(["window", "navigator", "React"].map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  Object.defineProperty(globalThis, "React", { configurable: true, writable: true, value: React });
  const vite = await createServer({ configFile: false, server: { middlewareMode: true }, appType: "custom", logLevel: "silent" });

  try {
    const { VoicePractice } = await vite.ssrLoadModule("/src/components/LearningExperience.jsx");
    const render = (browser, navigation) => {
      Object.defineProperty(globalThis, "window", { configurable: true, writable: true, value: browser });
      Object.defineProperty(globalThis, "navigator", { configurable: true, writable: true, value: navigation });
      return renderToStaticMarkup(React.createElement(VoicePractice, { onTranscript() {}, lessonKey: "test" }));
    };

    const navigation = { mediaDevices: { getUserMedia() {} }, onLine: true };
    assert.match(render({ isSecureContext: false, MediaRecorder: FakeRecorder, SpeechRecognition: FakeRecognition }, navigation), /HTTPS/);
    assert.match(render({ isSecureContext: true }, {}), /dyktowania systemowego/);

    const recordingOnly = render({ isSecureContext: true, MediaRecorder: FakeRecorder }, navigation);
    assert.match(recordingOnly, /Nagraj tylko do odsłuchu/);
    assert.doesNotMatch(recordingOnly, /Mów i wpisz odpowiedź/);

    const recognitionOnly = render({ isSecureContext: true, SpeechRecognition: FakeRecognition }, {});
    assert.match(recognitionOnly, /Mów i wpisz odpowiedź/);
    assert.doesNotMatch(recognitionOnly, /Nagraj tylko do odsłuchu/);

    const complete = render({ isSecureContext: true, MediaRecorder: FakeRecorder, webkitSpeechRecognition: FakeRecognition }, navigation);
    assert.match(complete, /Mów i wpisz odpowiedź/);
    assert.match(complete, /Nagraj tylko do odsłuchu/);
    assert.match(complete, /Nagranie służy wyłącznie do odsłuchu/);

    const offline = render({ isSecureContext: true, MediaRecorder: FakeRecorder, SpeechRecognition: FakeRecognition }, { ...navigation, onLine: false });
    assert.match(offline, /Dyktowanie wymaga internetu/);
    assert.match(offline, /Nagraj tylko do odsłuchu/);
  } finally {
    await vite.close();
    for (const [key, descriptor] of Object.entries(previous)) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
});
