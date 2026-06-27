import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import SurveyResults from "./SurveyResults";
import * as apiClient from "../lib/apiClient";

vi.mock("../lib/apiClient", async () => {
  const actual = await vi.importActual("../lib/apiClient");
  return {
    ...actual,
    getSurveyResults: vi.fn(),
    analyzeSentiment: vi.fn(),
  };
});

const renderSurveyResults = (path = "/results/42") =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/results/:surveyId" element={<SurveyResults />} />
        <Route path="/dashboard" element={<div>Dashboard</div>} />
      </Routes>
    </MemoryRouter>
  );

const buildClosedSurvey = (overrides = {}) => ({
  survey_id: 42,
  title: "Encuesta de satisfacción",
  status: "closed",
  total_responses: 3,
  questions: [
    {
      question_id: 1,
      content: "¿Qué mejorarías?",
      question_type: "open",
      total_answers: 3,
      text_entries: [
        { text: "Mejorar el soporte" },
        { text: "Mas rapidez" },
        { text: "Nada, todo bien" },
      ],
    },
    {
      question_id: 2,
      content: "¿Cómo nos conociste?",
      question_type: "multiple_choice",
      total_answers: 3,
      options: [
        { label: "Redes", count: 2, percent: 66.7 },
        { label: "Amigos", count: 1, percent: 33.3 },
      ],
    },
  ],
  ...overrides,
});

const buildActiveSurvey = () => buildClosedSurvey({ status: "active" });

const buildSentimentResponse = (overrides = {}) => ({
  survey_id: 42,
  question_id: 1,
  question_content: "¿Qué mejorarías?",
  total_answers: 3,
  overall_sentiment: "positivo",
  score: 0.42,
  distribution: { positive: 2, negative: 0, neutral: 1 },
  summary: "Las respuestas son mayoritariamente positivas con foco en soporte y rapidez.",
  key_themes: ["soporte", "rapidez", "satisfacción"],
  ...overrides,
});

describe("SurveyResults — US-16 análisis de sentimientos", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
  });

  afterEach(() => {
    cleanup();
  });

  it("no muestra el botón de análisis si la encuesta NO está cerrada", async () => {
    apiClient.getSurveyResults.mockResolvedValueOnce(buildActiveSurvey());

    renderSurveyResults("/results/42");

    expect(
      await screen.findByRole("heading", { name: /resultados · encuesta de satisfacci.n/i })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /análisis de sentimientos/i })
    ).not.toBeInTheDocument();
  });

  it("muestra el botón solo en preguntas abiertas cuando la encuesta está cerrada", async () => {
    apiClient.getSurveyResults.mockResolvedValueOnce(buildClosedSurvey());

    renderSurveyResults("/results/42");

    expect(
      await screen.findByRole("heading", { name: /¿qué mejorarías\?/i })
    ).toBeInTheDocument();

    const buttons = screen.getAllByRole("button", { name: /análisis de sentimientos/i });
    expect(buttons).toHaveLength(1);
    expect(buttons[0]).toBeEnabled();
  });

  it("consulta al backend con survey_id y question_id y renderiza el panel con el resultado", async () => {
    apiClient.getSurveyResults.mockResolvedValueOnce(buildClosedSurvey());
    apiClient.analyzeSentiment.mockResolvedValueOnce(buildSentimentResponse());

    renderSurveyResults("/results/42");

    const trigger = await screen.findByRole("button", { name: /análisis de sentimientos/i });
    fireEvent.click(trigger);

    await waitFor(() => {
      expect(apiClient.analyzeSentiment).toHaveBeenCalledWith("42", 1);
    });

    expect(
      await screen.findByRole("region", { name: /análisis de sentimientos/i })
    ).toBeInTheDocument();
    expect(screen.getByText("+0.42")).toBeInTheDocument();
    expect(
      screen.getByText(/las respuestas son mayoritariamente positivas/i)
    ).toBeInTheDocument();
    expect(screen.getByText("soporte")).toBeInTheDocument();
    expect(screen.getByText("rapidez")).toBeInTheDocument();

    expect(screen.getByText(/3 respuestas analizadas/i)).toBeInTheDocument();
  });

  it("muestra el porcentaje calculado en las barras de distribución", async () => {
    apiClient.getSurveyResults.mockResolvedValueOnce(buildClosedSurvey());
    apiClient.analyzeSentiment.mockResolvedValueOnce(buildSentimentResponse());

    renderSurveyResults("/results/42");

    fireEvent.click(await screen.findByRole("button", { name: /análisis de sentimientos/i }));

    await waitFor(() => {
      expect(apiClient.analyzeSentiment).toHaveBeenCalled();
    });

    expect(screen.getByText(/2 · 67%/)).toBeInTheDocument();
    expect(screen.getByText(/0 · 0%/)).toBeInTheDocument();
    expect(screen.getByText(/1 · 33%/)).toBeInTheDocument();
  });

  it("alterna el panel (oculta/mostrar) sin volver a llamar al backend", async () => {
    apiClient.getSurveyResults.mockResolvedValueOnce(buildClosedSurvey());
    apiClient.analyzeSentiment.mockResolvedValueOnce(buildSentimentResponse());

    renderSurveyResults("/results/42");

    const trigger = await screen.findByRole("button", { name: /análisis de sentimientos/i });
    fireEvent.click(trigger);

    await screen.findByRole("region", { name: /análisis de sentimientos/i });
    expect(apiClient.analyzeSentiment).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: /ocultar análisis/i }));

    await waitFor(() => {
      expect(
        screen.queryByRole("region", { name: /análisis de sentimientos/i })
      ).not.toBeInTheDocument();
    });
    expect(apiClient.analyzeSentiment).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: /análisis de sentimientos/i }));
    expect(
      await screen.findByRole("region", { name: /análisis de sentimientos/i })
    ).toBeInTheDocument();
    expect(apiClient.analyzeSentiment).toHaveBeenCalledTimes(1);
  });

  it("muestra el mensaje de error del backend dentro del panel", async () => {
    apiClient.getSurveyResults.mockResolvedValueOnce(buildClosedSurvey());
    apiClient.analyzeSentiment.mockRejectedValueOnce(
      new Error("Solo se puede analizar el sentimiento de encuestas cerradas (estado actual: 'active').")
    );

    renderSurveyResults("/results/42");

    fireEvent.click(await screen.findByRole("button", { name: /análisis de sentimientos/i }));

    expect(
      await screen.findByText(/no fue posible analizar las respuestas/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/solo se puede analizar el sentimiento de encuestas cerradas/i)
    ).toBeInTheDocument();
  });
});
