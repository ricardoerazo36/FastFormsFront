import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { autoFillSurvey } from "../lib/apiClient";
import "./AutoFillVoice.css";

/**
 * US-15 t2 — Boton de autorrellenado por voz.
 *
 * Flujo:
 *   idle -> (modal de instrucciones) -> recording -> submitting -> (success | error)
 *
 * - Al pulsar "Iniciar dictado" se muestra un modal con las instrucciones y un
 *   boton de confirmar. Al confirmar, el modal se cierra y arranca la grabacion.
 * - Durante la grabacion NO hay overlay a pantalla completa: se muestra un boton
 *   flotante/sticky llamativo para detener. El usuario ve el formulario (en
 *   modo lectura) y puede dictar sus respuestas con contexto visual.
 * - Tras pulsar "Detener" este componente notifica al padre via
 *   `onProcessingChange(true)` y es el padre quien renderiza el overlay de
 *   bloqueo a pantalla completa (spinner). Aqui NO se renderiza nada
 *   durante `submitting` para evitar overlays duplicados.
 * - Graba con MediaRecorder (mismo patron que VoiceInput). Tope 60s alineado
 *   con el limite de 10MB del backend.
 * - `onBusyChange(true)` durante recording+submitting para que el padre
 *   deshabilite el resto del formulario.
 * - `onRecordingChange(true)` SOLO durante la grabacion (no en submitting) para
 *   que el padre ponga el formulario en modo lectura.
 * - `onProcessingChange(true)` SOLO durante submitting para que el padre
 *   muestre el overlay de bloqueo a pantalla completa.
 * - Expone `start({ force })` via ref para que el padre pueda saltarse el
 *   `onBeforeStart` (ej. tras confirmar sobrescritura).
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

const AutoFillVoice = forwardRef(function AutoFillVoice(
  {
    surveyCode,
    language = "es",
    onResult,
    onError,
    onBusyChange,
    onRecordingChange,
    onProcessingChange,
    onBeforeStart,
  },
  ref
) {
  const [status, setStatus] = useState("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [confirmationOpen, setConfirmationOpen] = useState(false);
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

  const notifyBusy = (busy) => {
    if (onBusyChange) onBusyChange(busy);
  };

  const notifyRecording = (recording) => {
    if (onRecordingChange) onRecordingChange(recording);
  };

  const notifyProcessing = (processing) => {
    if (onProcessingChange) onProcessingChange(processing);
  };

  const handleError = (message) => {
    cleanup();
    setErrorMessage(message);
    setStatus("error");
    setElapsed(0);
    setConfirmationOpen(false);
    notifyBusy(false);
    notifyRecording(false);
    notifyProcessing(false);
    if (onError) onError(message);
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
        handleError("La grabacion quedo vacia. Intenta de nuevo.");
        return;
      }

      setStatus("submitting");
      notifyRecording(false);
      notifyProcessing(true);
      try {
        const result = await autoFillSurvey(blob, { code: surveyCode, language });
        setStatus("success");
        notifyBusy(false);
        notifyProcessing(false);
        if (onResult) onResult(result);
        setStatus("idle");
        setErrorMessage("");
      } catch (error) {
        handleError(
          error?.message || "No fue posible procesar el audio. Intentalo otra vez."
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

  const openConfirmation = () => {
    if (status !== "idle" && status !== "error") {
      return;
    }
    if (onBeforeStart && onBeforeStart() === false) {
      return;
    }
    setErrorMessage("");
    setConfirmationOpen(true);
  };

  const cancelConfirmation = () => {
    setConfirmationOpen(false);
  };

  const confirmAndStart = () => {
    setConfirmationOpen(false);
    setStatus("recording");
    notifyBusy(true);
    notifyRecording(true);
    startRecording();
  };

  useImperativeHandle(ref, () => ({
    start: (options) => {
      const force = options?.force === true;
      if (!force && onBeforeStart && onBeforeStart() === false) {
        return;
      }
      setErrorMessage("");
      setConfirmationOpen(true);
    },
  }));

  const handleStartClick = () => {
    openConfirmation();
  };

  const handleStopClick = () => {
    if (status === "recording") {
      stopRecording();
    }
  };

  const isButtonDisabled = status !== "idle" && status !== "error";

  return (
    <>
      <div className="autofill-voice-idle">
        <button
          type="button"
          className="autofill-voice-btn"
          onClick={handleStartClick}
          disabled={isButtonDisabled}
          aria-label="Iniciar dictado por voz"
        >
          <span className="autofill-voice-btn-icon" aria-hidden="true">
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="9" y="2" width="6" height="12" rx="3" />
              <path d="M5 10a7 7 0 0 0 14 0" />
              <line x1="12" y1="17" x2="12" y2="22" />
              <line x1="8" y1="22" x2="16" y2="22" />
            </svg>
          </span>
          <span>{status === "error" ? "Reintentar" : "Iniciar dictado"}</span>
        </button>
        <p className="autofill-voice-hint">
          Dicta tus respuestas en orden. La IA las organizara por pregunta.
        </p>
        {status === "error" && errorMessage ? (
          <p className="autofill-voice-error" role="alert">
            {errorMessage}
          </p>
        ) : null}
      </div>

      {confirmationOpen ? (
        <div
          className="autofill-confirm-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Confirmar dictado por voz"
          onClick={(event) => {
            if (event.target === event.currentTarget) cancelConfirmation();
          }}
        >
          <div className="autofill-confirm-card" onClick={(event) => event.stopPropagation()}>
            <div className="autofill-confirm-icon" aria-hidden="true">
              <svg
                width="32"
                height="32"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="9" y="2" width="6" height="12" rx="3" />
                <path d="M5 10a7 7 0 0 0 14 0" />
                <line x1="12" y1="17" x2="12" y2="22" />
                <line x1="8" y1="22" x2="16" y2="22" />
              </svg>
            </div>
            <h3 className="autofill-confirm-title">Listo para grabar</h3>
            <ul className="autofill-confirm-list">
              <li>Responde las preguntas <strong>en orden</strong>.</li>
              <li>Menciona a que pregunta vas, por ejemplo: <em>"pregunta uno, prefiero italiana"</em>.</li>
              <li>Cuando termines, pulsa el boton rojo <strong>Detener</strong>.</li>
              <li>La grabacion se corta sola a los {MAX_SECONDS} segundos.</li>
            </ul>
            <div className="autofill-confirm-actions">
              <button
                type="button"
                className="autofill-cancel-btn"
                onClick={cancelConfirmation}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="autofill-confirm-start-btn"
                onClick={confirmAndStart}
              >
                Empezar a grabar
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {status === "recording" ? (
        <button
          type="button"
          className="autofill-floating-stop-btn"
          onClick={handleStopClick}
          aria-label="Detener grabacion"
        >
          <span className="autofill-floating-stop-dot" aria-hidden="true" />
          <span className="autofill-floating-stop-label">
            <span className="autofill-floating-stop-title">Detener</span>
            <span className="autofill-floating-stop-time">
              {elapsed}s / {MAX_SECONDS}s
            </span>
          </span>
        </button>
      ) : null}
    </>
  );
});

export default AutoFillVoice;
