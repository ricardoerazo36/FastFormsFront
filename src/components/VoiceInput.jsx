import { useEffect, useRef, useState } from "react";
import { transcribeAudio } from "../lib/apiClient";
import "./VoiceInput.css";

/**
 * US-13 / US-14 / US-16 — Boton de microfono reutilizable.
 *
 * - Graba con MediaRecorder hasta un maximo configurable (60s por defecto).
 * - Envia el audio al backend (`/transcribe`) y entrega el texto via onResult.
 * - Maneja los estados de UI: idle | recording | processing | error.
 * - Si el navegador no soporta MediaRecorder o el permiso es denegado, lo
 *   reporta para permitir la "degradacion elegante" (US-14).
 */

const MAX_SECONDS = 60;

const pickMimeType = () => {
  if (typeof MediaRecorder === "undefined") return null;
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/ogg",
  ];
  for (const candidate of candidates) {
    try {
      if (MediaRecorder.isTypeSupported(candidate)) {
        return candidate;
      }
    } catch {
      /* ignore */
    }
  }
  return "";
};

const VoiceInput = ({
  onResult,
  language = "es",
  task,
  normalizeCode = false,
  disabled = false,
  label = "Grabar",
  recordingLabel = "Detener",
  className = "",
}) => {
  const [status, setStatus] = useState("idle"); // idle | recording | processing | error
  const [errorMessage, setErrorMessage] = useState("");
  const [elapsed, setElapsed] = useState(0);

  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);
  const intervalRef = useRef(null);
  const stopTimeoutRef = useRef(null);

  const cleanup = () => {
    if (intervalRef.current) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (stopTimeoutRef.current) {
      window.clearTimeout(stopTimeoutRef.current);
      stopTimeoutRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    mediaRecorderRef.current = null;
    chunksRef.current = [];
  };

  useEffect(() => () => cleanup(), []);

  const handleError = (message) => {
    cleanup();
    setStatus("error");
    setErrorMessage(message);
  };

  const startRecording = async () => {
    setErrorMessage("");

    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      handleError("Tu navegador no permite grabar audio.");
      return;
    }
    if (typeof MediaRecorder === "undefined") {
      handleError("Tu navegador no soporta MediaRecorder.");
      return;
    }

    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (error) {
      const message =
        error?.name === "NotAllowedError" || error?.name === "PermissionDeniedError"
          ? "Permiso de microfono denegado. Habilitalo en tu navegador para dictar."
          : "No fue posible acceder al microfono.";
      handleError(message);
      return;
    }

    streamRef.current = stream;
    chunksRef.current = [];

    const mimeType = pickMimeType();
    let recorder;
    try {
      recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);
    } catch {
      handleError("No fue posible iniciar la grabacion.");
      return;
    }

    mediaRecorderRef.current = recorder;

    recorder.addEventListener("dataavailable", (event) => {
      if (event.data && event.data.size > 0) {
        chunksRef.current.push(event.data);
      }
    });

    recorder.addEventListener("stop", async () => {
      const recordedType = recorder.mimeType || mimeType || "audio/webm";
      const blob = new Blob(chunksRef.current, { type: recordedType });
      cleanup();
      setElapsed(0);

      if (blob.size === 0) {
        setStatus("error");
        setErrorMessage("La grabacion quedo vacia. Intenta de nuevo.");
        return;
      }

      setStatus("processing");
      try {
        const result = await transcribeAudio(blob, { language, task, normalizeCode });
        setStatus("idle");
        onResult?.({
          text: result.text || "",
          confidence: result.confidence ?? null,
          language: result.language || language,
          normalizedCode: result.normalized_code ?? null,
        });
      } catch (error) {
        setStatus("error");
        setErrorMessage(
          error?.message || "No fue posible transcribir el audio. Intentalo otra vez."
        );
      }
    });

    setStatus("recording");
    setElapsed(0);
    recorder.start();

    const startedAt = Date.now();
    intervalRef.current = window.setInterval(() => {
      setElapsed(Math.floor((Date.now() - startedAt) / 1000));
    }, 250);

    // Corte automatico al alcanzar MAX_SECONDS.
    stopTimeoutRef.current = window.setTimeout(() => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
        mediaRecorderRef.current.stop();
      }
    }, MAX_SECONDS * 1000);
  };

  const stopRecording = () => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state === "recording") {
      recorder.stop();
    }
  };

  const handleClick = () => {
    if (status === "recording") {
      stopRecording();
      return;
    }
    if (status === "processing") {
      return;
    }
    startRecording();
  };

  const renderStatus = () => {
    if (status === "recording") {
      return (
        <span className="voice-status">
          Grabando... {elapsed}s / {MAX_SECONDS}s
        </span>
      );
    }
    if (status === "processing") {
      return <span className="voice-status">Procesando audio...</span>;
    }
    if (status === "error" && errorMessage) {
      return <span className="voice-status voice-status-error">{errorMessage}</span>;
    }
    return null;
  };

  const buttonLabel = status === "recording" ? recordingLabel : label;

  return (
    <div className={`voice-input ${className}`.trim()}>
      <button
        type="button"
        onClick={handleClick}
        className={`voice-btn ${status === "recording" ? "voice-btn-recording" : ""}`}
        disabled={disabled || status === "processing"}
        aria-pressed={status === "recording"}
        aria-label={status === "recording" ? "Detener grabacion" : "Grabar voz"}
      >
        {status === "recording" ? null : <span aria-hidden="true">🎤</span>}
        <span>{buttonLabel}</span>
      </button>
      {renderStatus()}
    </div>
  );
};

export default VoiceInput;
