import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import SurveyAccess from "./SurveyAccess";
import * as surveyService from "../lib/surveyService";
import * as apiClient from "../lib/apiClient";

vi.mock("../lib/surveyService", () => ({
  fetchSurveyByCode: vi.fn(),
  submitSurveyResponse: vi.fn(),
}));

vi.mock("../lib/apiClient", async () => {
  const actual = await vi.importActual("../lib/apiClient");
  return {
    ...actual,
    autoFillSurvey: vi.fn(),
  };
});

const renderSurveyAccess = (path = "/survey/ABC123") =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/survey" element={<SurveyAccess />} />
        <Route path="/survey/:surveyCode" element={<SurveyAccess />} />
      </Routes>
    </MemoryRouter>
  );

describe("SurveyAccess", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
  });

  afterEach(() => {
    cleanup();
  });

  it("HU1: muestra mensajes claros cuando el codigo no existe o la encuesta fue cerrada", async () => {
    surveyService.fetchSurveyByCode.mockResolvedValueOnce({
      status: "invalid_code",
    });

    const firstRender = renderSurveyAccess("/survey/INVALIDO");

    expect(await screen.findByRole("heading", { name: /código no válido/i })).toBeInTheDocument();
    expect(
      screen.getByText(/no existe o no está asociado a una encuesta disponible/i)
    ).toBeInTheDocument();

    firstRender.unmount();

    surveyService.fetchSurveyByCode.mockResolvedValueOnce({
      status: "survey_closed",
      survey: {
        id: 7,
        title: "Encuesta cerrada de prueba",
        code: "CERRADA1",
      },
    });

    renderSurveyAccess("/survey/CERRADA1");

    expect(await screen.findByRole("heading", { name: /encuesta cerrada/i })).toBeInTheDocument();
    expect(screen.getByText(/ya no acepta más respuestas/i)).toBeInTheDocument();
    expect(screen.getByText("Encuesta cerrada de prueba")).toBeInTheDocument();
    // No se renderiza el formulario de llenado
    expect(screen.queryByRole("button", { name: /enviar respuestas/i })).not.toBeInTheDocument();
  });

  it("HU2: arma el formulario en una sola página y pide confirmación antes de enviar", async () => {
    surveyService.fetchSurveyByCode.mockResolvedValueOnce({
      status: "ready",
      survey: {
        id: 22,
        title: "Encuesta de satisfacción",
        code: "LISTA22",
        questions: [
          { id: 1, type: "open", content: "¿Qué mejorarías?", options: [] },
          {
            id: 2,
            type: "multiple_choice",
            content: "¿Cómo calificas el servicio?",
            options: ["Excelente", "Bueno", "Regular"],
          },
          { id: 3, type: "yes_no", content: "¿Nos recomendarías?", options: [] },
        ],
      },
    });

    surveyService.submitSurveyResponse.mockResolvedValueOnce({ id: 100 });

    renderSurveyAccess("/survey/LISTA22");

    expect(await screen.findByRole("heading", { name: /encuesta de satisfacción/i })).toBeInTheDocument();
    expect(screen.getByText("¿Qué mejorarías?")).toBeInTheDocument();
    expect(screen.getByText("¿Cómo calificas el servicio?")).toBeInTheDocument();
    expect(screen.getByText("¿Nos recomendarías?")).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText(/escribe tu respuesta/i), {
      target: { value: "Más rapidez en soporte" },
    });
    fireEvent.click(screen.getByRole("radio", { name: /excelente/i }));
    fireEvent.click(screen.getByRole("radio", { name: /sí/i }));

    fireEvent.click(screen.getByRole("button", { name: /enviar respuestas/i }));

    // US-08: aparece el modal de confirmación
    expect(await screen.findByText(/¿deseas enviar tus respuestas ahora\?/i)).toBeInTheDocument();
    expect(surveyService.submitSurveyResponse).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: /confirmar envío/i }));

    await waitFor(() => {
      expect(surveyService.submitSurveyResponse).toHaveBeenCalledWith({
        surveyId: 22,
        answers: [
          { questionId: 1, answer: "Más rapidez en soporte" },
          { questionId: 2, answer: "Excelente" },
          { questionId: 3, answer: "Sí" },
        ],
      });
    });

    expect(
      await screen.findByText(/tus respuestas fueron enviadas correctamente/i)
    ).toBeInTheDocument();
    expect(window.localStorage.getItem("fastforms:answered:LISTA22")).toBe("true");
  });

  it("HU3: bloquea el reenvío mostrando un mensaje cuando ya se respondió la encuesta", async () => {
    window.localStorage.setItem("fastforms:answered:YALISTO1", "true");

    renderSurveyAccess("/survey/YALISTO1");

    expect(
      await screen.findByRole("heading", { name: /ya has respondido esta encuesta/i })
    ).toBeInTheDocument();
    expect(surveyService.fetchSurveyByCode).not.toHaveBeenCalled();
  });
});

describe("US-15 t2: autorrellenado por voz", () => {
  let originalMediaRecorder;
  let originalMediaDevices;

  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    originalMediaRecorder = globalThis.MediaRecorder;
    originalMediaDevices = Object.getOwnPropertyDescriptor(navigator, "mediaDevices");
  });

  afterEach(() => {
    cleanup();
    globalThis.MediaRecorder = originalMediaRecorder;
    if (originalMediaDevices) {
      Object.defineProperty(navigator, "mediaDevices", originalMediaDevices);
    } else {
      // Si no existía originalmente, lo borramos.
      try {
        delete navigator.mediaDevices;
      } catch {
        /* ignore */
      }
    }
  });

  const readySurvey = (overrides = {}) => ({
    id: 30,
    title: "Encuesta con voz",
    code: "VOZ0001",
    questions: [
      { id: 1, type: "open", content: "¿Qué opinas?", options: [], position: 0 },
      {
        id: 2,
        type: "multiple_choice",
        content: "¿Color favorito?",
        options: ["Rojo", "Azul", "Verde"],
        position: 1,
      },
    ],
    ...overrides,
  });

  it("muestra la seccion 'Autorrellenar por voz' cuando la encuesta esta ready", async () => {
    surveyService.fetchSurveyByCode.mockResolvedValueOnce({
      status: "ready",
      survey: readySurvey(),
    });

    renderSurveyAccess("/survey/VOZ0001");

    expect(
      await screen.findByRole("heading", { name: /autorrellenar por voz/i })
    ).toBeInTheDocument();
    expect(
      screen.getByText(/dicta todas tus respuestas y la ia las organizara por pregunta/i)
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /iniciar dictado por voz/i })
    ).toBeInTheDocument();
  });

  it("pide confirmacion antes de sobrescribir si el usuario ya escribio respuestas", async () => {
    surveyService.fetchSurveyByCode.mockResolvedValueOnce({
      status: "ready",
      survey: readySurvey(),
    });

    renderSurveyAccess("/survey/VOZ0001");

    await screen.findByRole("heading", { name: /autorrellenar por voz/i });

    // El usuario escribe una respuesta manualmente.
    fireEvent.change(screen.getByPlaceholderText(/escribe tu respuesta/i), {
      target: { value: "Mi opinion escrita" },
    });

    // Click en iniciar dictado.
    fireEvent.click(screen.getByRole("button", { name: /iniciar dictado por voz/i }));

    // Aparece el modal de sobrescritura.
    expect(
      await screen.findByRole("heading", { name: /ya tienes respuestas/i })
    ).toBeInTheDocument();
    expect(apiClient.autoFillSurvey).not.toHaveBeenCalled();
  });

  it("autorrellena el formulario al confirmar sobrescritura y recibir respuesta exitosa", async () => {
    surveyService.fetchSurveyByCode.mockResolvedValueOnce({
      status: "ready",
      survey: readySurvey(),
    });

    apiClient.autoFillSurvey.mockResolvedValueOnce({
      survey_id: 30,
      answers: [
        { question_id: 1, answer_text: "Me gusta mucho" },
        { question_id: 2, answer_text: "Azul" },
      ],
    });

    renderSurveyAccess("/survey/VOZ0001");

    await screen.findByRole("heading", { name: /autorrellenar por voz/i });

    // Escribimos en la pregunta 1.
    fireEvent.change(screen.getByPlaceholderText(/escribe tu respuesta/i), {
      target: { value: "Lo que yo escribi" },
    });

    // Iniciamos dictado: aparece el modal de sobrescritura.
    fireEvent.click(screen.getByRole("button", { name: /iniciar dictado por voz/i }));
    await screen.findByRole("heading", { name: /ya tienes respuestas/i });

    // Confirmamos la sobrescritura. El modal debe cerrarse.
    fireEvent.click(screen.getByRole("button", { name: /si, reemplazar/i }));

    // El modal de sobrescritura se cierra y aparece el modal de instrucciones
    // del autorrellenado. Confirmamos para arrancar la grabacion.
    await screen.findByRole("heading", { name: /listo para grabar/i });
    fireEvent.click(screen.getByRole("button", { name: /empezar a grabar/i }));

    // El modal se cierra y la grabacion arranca.
    await waitFor(() => {
      expect(
        screen.queryByRole("heading", { name: /listo para grabar/i })
      ).not.toBeInTheDocument();
    });
  });

  it("muestra el overlay de bloqueo SOLO mientras el backend procesa (no durante la grabacion)", { timeout: 15000 }, async () => {
    // Mock getUserMedia y MediaRecorder para simular una grabacion real en jsdom.
    const stopTrack = vi.fn();
    const mockStream = { getTracks: () => [{ stop: stopTrack }] };
    Object.defineProperty(navigator, "mediaDevices", {
      value: { getUserMedia: vi.fn().mockResolvedValue(mockStream) },
      configurable: true,
    });

    class MockMediaRecorder {
      constructor(stream, options) {
        this.stream = stream;
        this.mimeType = options?.mimeType || "audio/webm";
        this.state = "inactive";
        this._listeners = {};
      }
      addEventListener(type, handler) {
        this._listeners[type] = handler;
      }
      start() {
        this.state = "recording";
      }
      stop() {
        this.state = "inactive";
        if (this._listeners.dataavailable) {
          const blob = new Blob([new Uint8Array([1, 2, 3])], { type: this.mimeType });
          this._listeners.dataavailable({ data: blob });
        }
        if (this._listeners.stop) {
          this._listeners.stop();
        }
      }
    }
    globalThis.MediaRecorder = MockMediaRecorder;

    surveyService.fetchSurveyByCode.mockResolvedValueOnce({
      status: "ready",
      survey: readySurvey(),
    });

    renderSurveyAccess("/survey/VOZ0001");
    await screen.findByRole("heading", { name: /autorrellenar por voz/i });

    // Iniciar dictado: aparece el modal de instrucciones (sin countdown).
    fireEvent.click(screen.getByRole("button", { name: /iniciar dictado por voz/i }));
    await screen.findByRole("heading", { name: /listo para grabar/i });

    // Confirmamos para arrancar la grabacion.
    fireEvent.click(screen.getByRole("button", { name: /empezar a grabar/i }));

    // Esperamos a que la grabacion arranque (getUserMedia se llama).
    await waitFor(
      () => {
        expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalled();
      },
      { timeout: 5000 }
    );

    // En este punto deberiamos estar en recording. El overlay de bloqueo
    // de la pagina NO debe estar visible (solo aparece en submitting).
    expect(
      screen.queryByRole("dialog", { name: /procesando autorrellenado/i })
    ).not.toBeInTheDocument();

    // El boton flotante de detener SI debe estar visible.
    expect(
      screen.getByRole("button", { name: /detener grabacion/i })
    ).toBeInTheDocument();

    // Pulsamos el boton flotante de detener.
    fireEvent.click(screen.getByRole("button", { name: /detener grabacion/i }));

    // Tras detener, el overlay de bloqueo debe aparecer durante el
    // submitting (aunque sea brevemente).
    await waitFor(
      () => {
        expect(
          screen.getByRole("dialog", { name: /procesando autorrellenado/i })
        ).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  });

  it("muestra error del backend en la card cuando el autorrellenado falla", { timeout: 10000 }, async () => {
    surveyService.fetchSurveyByCode.mockResolvedValueOnce({
      status: "ready",
      survey: readySurvey(),
    });

    renderSurveyAccess("/survey/VOZ0001");

    await screen.findByRole("heading", { name: /autorrellenar por voz/i });

    // En jsdom el flujo termina en error por falta de MediaRecorder
    // y navigator.mediaDevices. Tras el modal de instrucciones, el
    // componente entra a recording -> startRecording -> getUserMedia falla.
    fireEvent.click(screen.getByRole("button", { name: /iniciar dictado por voz/i }));
    await screen.findByRole("heading", { name: /listo para grabar/i });
    fireEvent.click(screen.getByRole("button", { name: /empezar a grabar/i }));

    // Aparece el mensaje de error en la card.
    await waitFor(
      () => {
        expect(
          screen.getByText(/tu navegador no permite grabar audio|tu navegador no soporta mediarecorder|no fue posible acceder al microfono|no fue posible iniciar la grabacion/i)
        ).toBeInTheDocument();
      },
      { timeout: 8000 }
    );
  });

  it("muestra el modal de instrucciones antes de empezar a grabar", async () => {
    surveyService.fetchSurveyByCode.mockResolvedValueOnce({
      status: "ready",
      survey: readySurvey(),
    });

    renderSurveyAccess("/survey/VOZ0001");
    await screen.findByRole("heading", { name: /autorrellenar por voz/i });

    // Click en iniciar: debe aparecer el modal de instrucciones.
    fireEvent.click(screen.getByRole("button", { name: /iniciar dictado por voz/i }));
    expect(
      await screen.findByRole("heading", { name: /listo para grabar/i })
    ).toBeInTheDocument();
    // Debe listar las instrucciones clave (lista del modal, no el hint).
    expect(screen.getByText(/Responde las preguntas/i)).toBeInTheDocument();
    expect(screen.getByText(/Menciona a que pregunta vas/i)).toBeInTheDocument();

    // El overlay de bloqueo NO debe estar visible en el modal de instrucciones.
    expect(
      screen.queryByRole("dialog", { name: /procesando autorrellenado/i })
    ).not.toBeInTheDocument();
  });

  it("permite cancelar el modal de instrucciones sin grabar", async () => {
    surveyService.fetchSurveyByCode.mockResolvedValueOnce({
      status: "ready",
      survey: readySurvey(),
    });

    renderSurveyAccess("/survey/VOZ0001");
    await screen.findByRole("heading", { name: /autorrellenar por voz/i });

    fireEvent.click(screen.getByRole("button", { name: /iniciar dictado por voz/i }));
    await screen.findByRole("heading", { name: /listo para grabar/i });

    // Cancelamos.
    fireEvent.click(screen.getByRole("button", { name: /cancelar/i }));

    // El modal se cierra y no se inicio ninguna grabacion.
    await waitFor(() => {
      expect(
        screen.queryByRole("heading", { name: /listo para grabar/i })
      ).not.toBeInTheDocument();
    });
    expect(apiClient.autoFillSurvey).not.toHaveBeenCalled();
  });

  it("pone el formulario en modo lectura durante la grabacion", { timeout: 10000 }, async () => {
    const stopTrack = vi.fn();
    const mockStream = { getTracks: () => [{ stop: stopTrack }] };
    Object.defineProperty(navigator, "mediaDevices", {
      value: { getUserMedia: vi.fn().mockResolvedValue(mockStream) },
      configurable: true,
    });

    class MockMediaRecorder {
      constructor(stream, options) {
        this.stream = stream;
        this.mimeType = options?.mimeType || "audio/webm";
        this.state = "inactive";
        this._listeners = {};
      }
      addEventListener(type, handler) {
        this._listeners[type] = handler;
      }
      start() {
        this.state = "recording";
      }
      stop() {
        this.state = "inactive";
        if (this._listeners.dataavailable) {
          const blob = new Blob([new Uint8Array([1, 2, 3])], { type: this.mimeType });
          this._listeners.dataavailable({ data: blob });
        }
        if (this._listeners.stop) {
          this._listeners.stop();
        }
      }
    }
    globalThis.MediaRecorder = MockMediaRecorder;

    surveyService.fetchSurveyByCode.mockResolvedValueOnce({
      status: "ready",
      survey: readySurvey(),
    });

    renderSurveyAccess("/survey/VOZ0001");
    await screen.findByRole("heading", { name: /autorrellenar por voz/i });

    // Escribimos una respuesta manual antes de empezar.
    fireEvent.change(screen.getByPlaceholderText(/escribe tu respuesta/i), {
      target: { value: "Mi respuesta" },
    });

    // Arrancamos el dictado: primero aparece el modal de sobrescritura
    // (porque ya hay respuestas), luego el de instrucciones.
    fireEvent.click(screen.getByRole("button", { name: /iniciar dictado por voz/i }));
    await screen.findByRole("heading", { name: /ya tienes respuestas/i });
    fireEvent.click(screen.getByRole("button", { name: /si, reemplazar/i }));
    await screen.findByRole("heading", { name: /listo para grabar/i });
    fireEvent.click(screen.getByRole("button", { name: /empezar a grabar/i }));

    // Esperamos a que la grabacion arranque.
    await waitFor(
      () => {
        expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalled();
      },
      { timeout: 5000 }
    );

    // El textarea debe estar en readOnly.
    const textarea = screen.getByPlaceholderText(/escribe tu respuesta/i);
    expect(textarea).toHaveAttribute("readonly");

    // Los radio buttons deben estar disabled.
    const radios = screen.getAllByRole("radio");
    radios.forEach((radio) => expect(radio).toBeDisabled());

    // El boton de enviar debe estar disabled.
    expect(screen.getByRole("button", { name: /enviar respuestas/i })).toBeDisabled();
  });
});
