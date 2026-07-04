import { useCallback, useEffect, useRef, useState } from "react";
import {
  createSpeechRecognition,
  isSpeechRecognitionSupported,
  transcriptHasEndNote,
  transcriptHasWakeNote,
  type SpeechRecognitionLike,
} from "../lib/speechRecognition";

export type HandsFreePhase = "off" | "armed" | "recording";

interface Options {
  onRecorded: (blob: Blob) => void;
  /** Parent is transcribing / cleaning — pause hands-free. */
  disabled?: boolean;
  onError?: (message: string) => void;
}

export function useHandsFreeVoice({
  onRecorded,
  disabled = false,
  onError,
}: Options) {
  const supported = isSpeechRecognitionSupported();
  const [phase, setPhase] = useState<HandsFreePhase>("off");
  const [seconds, setSeconds] = useState(0);

  const phaseRef = useRef<HandsFreePhase>("off");
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const onRecordedRef = useRef(onRecorded);
  const onErrorRef = useRef(onError);

  useEffect(() => {
    onRecordedRef.current = onRecorded;
  }, [onRecorded]);

  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const stopRecognition = useCallback(() => {
    const recognition = recognitionRef.current;
    recognitionRef.current = null;
    if (!recognition) return;
    recognition.onresult = null;
    recognition.onerror = null;
    recognition.onend = null;
    try {
      recognition.stop();
    } catch {
      try {
        recognition.abort();
      } catch {
        /* already stopped */
      }
    }
  }, []);

  const stopRecording = useCallback(() => {
    const recorder = recorderRef.current;
    recorderRef.current = null;
    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
    } else {
      stopStream();
      if (phaseRef.current === "recording") {
        setPhase("armed");
      }
    }
  }, [stopStream]);

  const teardown = useCallback(() => {
    stopRecording();
    stopRecognition();
    stopStream();
    setPhase("off");
    setSeconds(0);
  }, [stopRecognition, stopRecording, stopStream]);

  const startRecording = useCallback(async () => {
    if (phaseRef.current !== "armed" || disabled) return;

    try {
      const stream =
        streamRef.current ??
        (await navigator.mediaDevices.getUserMedia({ audio: true }));
      streamRef.current = stream;

      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType || "audio/webm",
        });
        stopStream();
        setPhase("armed");
        setSeconds(0);
        if (blob.size > 0) onRecordedRef.current(blob);
      };
      recorder.start();
      recorderRef.current = recorder;
      setPhase("recording");
    } catch {
      onErrorRef.current?.(
        "Microphone permission is needed for hands-free notes.",
      );
      teardown();
    }
  }, [disabled, stopStream, teardown]);

  const handleTranscript = useCallback(
    (raw: string) => {
      const text = raw.trim();
      if (!text) return;

      if (phaseRef.current === "recording") {
        if (transcriptHasEndNote(text)) stopRecording();
        return;
      }

      if (phaseRef.current === "armed" && transcriptHasWakeNote(text)) {
        void startRecording();
      }
    },
    [startRecording, stopRecording],
  );

  const startRecognition = useCallback(() => {
    stopRecognition();

    const recognition = createSpeechRecognition();
    if (!recognition) {
      onErrorRef.current?.("Hands-free mode is not supported in this browser.");
      setPhase("off");
      return;
    }

    recognition.onresult = (event) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        handleTranscript(event.results[i][0].transcript);
      }
    };

    recognition.onerror = (event) => {
      if (event.error === "not-allowed") {
        onErrorRef.current?.("Microphone permission is needed for hands-free notes.");
        teardown();
        return;
      }
      if (event.error === "aborted") return;
    };

    recognition.onend = () => {
      if (phaseRef.current === "off") return;
      if (recognitionRef.current !== recognition) return;
      try {
        recognition.start();
      } catch {
        /* restart on next user action */
      }
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch {
      onErrorRef.current?.("Could not start listening. Try again.");
      teardown();
    }
  }, [handleTranscript, stopRecognition, teardown]);

  const arm = useCallback(async () => {
    if (disabled || !supported) return;
    try {
      if (!streamRef.current) {
        streamRef.current = await navigator.mediaDevices.getUserMedia({
          audio: true,
        });
      }
      setPhase("armed");
      startRecognition();
    } catch {
      onErrorRef.current?.(
        "Microphone permission is needed for hands-free notes.",
      );
    }
  }, [disabled, startRecognition, supported]);

  const disarm = useCallback(() => {
    teardown();
  }, [teardown]);

  const toggle = useCallback(() => {
    if (phase === "off") arm();
    else disarm();
  }, [arm, disarm, phase]);

  useEffect(() => {
    if (disabled && phase !== "off") disarm();
  }, [disabled, disarm, phase]);

  useEffect(() => {
    if (phase !== "recording") return;
    setSeconds(0);
    const started = Date.now();
    const id = window.setInterval(
      () => setSeconds(Math.floor((Date.now() - started) / 1000)),
      250,
    );
    return () => window.clearInterval(id);
  }, [phase]);

  useEffect(() => () => teardown(), [teardown]);

  return {
    supported,
    phase,
    seconds,
    armed: phase !== "off",
    toggle,
    disarm,
  };
}
