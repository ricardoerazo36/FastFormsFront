import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import DonutChart from "../components/DonutChart";
import SentimentPanel from "../components/SentimentPanel";
import {
  getSurveyResults,
  exportSurveyResultsCsv,
  analyzeSentiment,
} from "../lib/apiClient";
import "./SurveyResults.css";

const toTextEntries = (question) => {
  if (Array.isArray(question.text_entries) && question.text_entries.length > 0) {
    return question.text_entries
      .map((entry) => entry?.text ?? "")
      .filter((text) => text.length > 0);
  }
  if (Array.isArray(question.texts)) {
    return question.texts;
  }
  return [];
};

const SurveyResults = () => {
  const navigate = useNavigate();
  const { surveyId } = useParams();

  const [state, setState] = useState("loading"); // loading | ready | error
  const [results, setResults] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [csvExporting, setCsvExporting] = useState(false);
  // US-17 — Filtro de busqueda por palabra clave sobre transcripciones.
  const [textSearch, setTextSearch] = useState("");
  // US-16 — Estado del analisis de sentimientos por pregunta abierta.
  const [sentimentByQuestion, setSentimentByQuestion] = useState({});
  const [sentimentLoading, setSentimentLoading] = useState({});
  const [sentimentError, setSentimentError] = useState({});
  const [sentimentOpen, setSentimentOpen] = useState({});

  useEffect(() => {
    let ignore = false;

    const load = async () => {
      setState("loading");
      try {
        const data = await getSurveyResults(surveyId);
        if (ignore) return;
        setResults(data);
        setState("ready");
      } catch (error) {
        if (ignore) return;
        setErrorMessage(error.message || "No fue posible cargar los resultados.");
        setState("error");
      }
    };

    load();
    return () => {
      ignore = true;
    };
  }, [surveyId]);

  const handleExportCsv = async () => {
    setCsvExporting(true);
    try {
      await exportSurveyResultsCsv(surveyId, results?.title
        ? `encuesta_${results.title.replace(/[^a-zA-Z0-9]/g, "_")}_resultados.csv`
        : undefined
      );
    } catch (error) {
      alert(`No fue posible exportar el CSV: ${error.message}`);
    } finally {
      setCsvExporting(false);
    }
  };

  // US-16 — Dispara o alterna el panel de analisis de sentimientos para una
  // pregunta abierta. Si ya hay un analisis en cache, solo abre/cierra el
  // panel; en caso contrario consulta al backend.
  const handleAnalyzeSentiment = async (questionId) => {
    const isOpen = Boolean(sentimentOpen[questionId]);
    const hasAnalysis = Boolean(sentimentByQuestion[questionId]);

    if (hasAnalysis) {
      setSentimentOpen((prev) => ({ ...prev, [questionId]: !isOpen }));
      return;
    }

    setSentimentOpen((prev) => ({ ...prev, [questionId]: true }));
    setSentimentLoading((prev) => ({ ...prev, [questionId]: true }));
    setSentimentError((prev) => ({ ...prev, [questionId]: null }));

    try {
      const analysis = await analyzeSentiment(surveyId, questionId);
      setSentimentByQuestion((prev) => ({ ...prev, [questionId]: analysis }));
    } catch (error) {
      setSentimentError((prev) => ({
        ...prev,
        [questionId]: error.message || "Error desconocido al analizar sentimientos.",
      }));
    } finally {
      setSentimentLoading((prev) => ({ ...prev, [questionId]: false }));
    }
  };

  const responsesLabel =
    results && results.total_responses === 1
      ? "1 respuesta recibida"
      : `${results?.total_responses ?? 0} respuestas recibidas`;

  const normalizedSearch = textSearch.trim().toLowerCase();
  const hasOpenQuestion = useMemo(
    () => Boolean(results?.questions?.some((q) => q.question_type === "open")),
    [results]
  );
  const isClosedSurvey = results?.status === "closed";

  return (
    <div className="results-page">
      <div className="results-header">
        <button className="back-btn" onClick={() => navigate("/dashboard")}>
          ←
        </button>
        <h1>{results?.title ? `Resultados · ${results.title}` : "Resultados"}</h1>
      </div>

      {state === "loading" ? (
        <p className="results-state">Cargando resultados...</p>
      ) : null}

      {state === "error" ? (
        <p className="results-state results-state-error">{errorMessage}</p>
      ) : null}

      {state === "ready" && results ? (
        results.total_responses === 0 ? (
          <div className="results-empty-wrapper">
            <p className="results-state">Aún no hay respuestas para esta encuesta</p>
            {results.title ? (
              <button className="csv-export-btn" onClick={handleExportCsv} disabled={csvExporting}>
                {csvExporting ? "Exportando..." : "Exportar CSV"}
              </button>
            ) : null}
          </div>
        ) : (
          <div className="results-list">
            <div className="results-summary-row">
              <p className="results-summary">{responsesLabel}</p>
              <button className="csv-export-btn" onClick={handleExportCsv} disabled={csvExporting}>
                {csvExporting ? "Exportando..." : "Exportar CSV"}
              </button>
            </div>

            {hasOpenQuestion ? (
              <div className="results-search-row">
                <input
                  type="search"
                  className="results-search-input"
                  placeholder="Buscar palabra clave en respuestas abiertas..."
                  value={textSearch}
                  onChange={(event) => setTextSearch(event.target.value)}
                />
              </div>
            ) : null}

            {results.questions.map((question) => {
              const isOpen = question.question_type === "open";
              const entries = isOpen ? toTextEntries(question) : [];
              const filteredEntries = normalizedSearch
                ? entries.filter((text) => text.toLowerCase().includes(normalizedSearch))
                : entries;

              return (
                <section key={question.question_id} className="results-card">
                  <div className="results-card-header">
                    <h3>{question.content}</h3>
                    {isOpen && isClosedSurvey && entries.length > 0 ? (
                      <div className="sentiment-action">
                        <p className="sentiment-help">
                          Detecta el tono y la emoción de las respuestas con IA.
                        </p>
                        <button
                          type="button"
                          className="sentiment-btn"
                          onClick={() => handleAnalyzeSentiment(question.question_id)}
                          disabled={Boolean(sentimentLoading[question.question_id])}
                          aria-expanded={Boolean(sentimentOpen[question.question_id])}
                        >
                          <svg
                            className="sentiment-btn-icon"
                            viewBox="0 0 24 24"
                            width="20"
                            height="20"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden="true"
                          >
                            <path d="M12 3l1.9 4.6L18.5 9.5l-4.6 1.9L12 16l-1.9-4.6L5.5 9.5l4.6-1.9z" />
                            <path d="M19 14l.9 2.2 2.2.9-2.2.9L19 20.2l-.9-2.2-2.2-.9 2.2-.9z" />
                            <path d="M5 14l.7 1.6 1.6.7-1.6.7L5 18.6l-.7-1.6-1.6-.7 1.6-.7z" />
                          </svg>
                          <span className="sentiment-btn-label">
                            {sentimentLoading[question.question_id]
                              ? "Analizando..."
                              : sentimentOpen[question.question_id] && sentimentByQuestion[question.question_id]
                              ? "Ocultar análisis"
                              : "Análisis de sentimientos"}
                          </span>
                        </button>
                      </div>
                    ) : null}
                  </div>

                  {isOpen ? (
                    entries.length > 0 ? (
                      <>
                        <ul className="results-text-feed">
                          {filteredEntries.map((text, index) => (
                            <li key={index} className="results-text-feed-item">
                              <span>{text}</span>
                            </li>
                          ))}
                        </ul>
                        {sentimentOpen[question.question_id] ? (
                          <SentimentPanel
                            analysis={sentimentByQuestion[question.question_id]}
                            loading={Boolean(sentimentLoading[question.question_id])}
                            error={sentimentError[question.question_id]}
                          />
                        ) : null}
                      </>
                    ) : (
                      <p className="results-empty-question">
                        Sin respuestas para esta pregunta.
                      </p>
                    )
                  ) : question.total_answers > 0 ? (
                    <DonutChart data={question.options ?? []} />
                  ) : (
                    <p className="results-empty-question">
                      Sin respuestas para esta pregunta.
                    </p>
                  )}
                </section>
              );
            })}
          </div>
        )
      ) : null}
    </div>
  );
};

export default SurveyResults;
