import "./SentimentPanel.css";

const SENTIMENT_META = {
  positivo: { label: "Positivo", className: "sentiment-pos", emoji: "😊" },
  negativo: { label: "Negativo", className: "sentiment-neg", emoji: "😟" },
  neutral: { label: "Neutral", className: "sentiment-neu", emoji: "😐" },
  mixto: { label: "Mixto", className: "sentiment-mix", emoji: "🤔" },
};

const formatScore = (score) => {
  if (score == null || Number.isNaN(score)) return "0.00";
  const sign = score > 0 ? "+" : "";
  return `${sign}${score.toFixed(2)}`;
};

const SentimentPanel = ({ analysis, loading, error }) => {
  if (loading) {
    return (
      <div className="sentiment-panel sentiment-loading" role="status" aria-live="polite">
        <span className="sentiment-loading-dots" aria-hidden="true">
          ●●●
        </span>
        <span>Analizando sentimientos con IA...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="sentiment-panel sentiment-error" role="alert">
        <strong>No fue posible analizar las respuestas.</strong>
        <span>{error}</span>
      </div>
    );
  }

  if (!analysis) {
    return null;
  }

  const meta = SENTIMENT_META[analysis.overall_sentiment] || SENTIMENT_META.neutral;
  const { distribution, total_answers } = analysis;
  const safeTotal = total_answers || distribution.positive + distribution.negative + distribution.neutral || 1;

  const bars = [
    {
      key: "positivo",
      label: "Positivo",
      count: distribution.positive,
      className: "sentiment-bar-pos",
    },
    {
      key: "negativo",
      label: "Negativo",
      count: distribution.negative,
      className: "sentiment-bar-neg",
    },
    {
      key: "neutral",
      label: "Neutral",
      count: distribution.neutral,
      className: "sentiment-bar-neu",
    },
  ];

  return (
    <section className="sentiment-panel" aria-label="Análisis de sentimientos">
      <header className="sentiment-header">
        <span className={`sentiment-badge ${meta.className}`}>
          <span className="sentiment-badge-emoji" aria-hidden="true">
            {meta.emoji}
          </span>
          <span>{meta.label}</span>
        </span>
        <span
          className="sentiment-score"
          title="Score normalizado entre -1 (muy negativo) y 1 (muy positivo)"
        >
          {formatScore(analysis.score)}
        </span>
      </header>

      <div className="sentiment-distribution">
        {bars.map((bar) => {
          const percent = safeTotal > 0 ? Math.round((bar.count / safeTotal) * 100) : 0;
          return (
            <div key={bar.key} className="sentiment-bar-row">
              <div className="sentiment-bar-label">
                <span>{bar.label}</span>
                <span className="sentiment-bar-count">
                  {bar.count} · {percent}%
                </span>
              </div>
              <div className="sentiment-bar-track">
                <div
                  className={`sentiment-bar-fill ${bar.className}`}
                  style={{ width: `${percent}%` }}
                  aria-hidden="true"
                />
              </div>
            </div>
          );
        })}
      </div>

      {analysis.summary ? (
        <p className="sentiment-summary">{analysis.summary}</p>
      ) : null}

      {Array.isArray(analysis.key_themes) && analysis.key_themes.length > 0 ? (
        <div className="sentiment-themes">
          <span className="sentiment-themes-title">Temas clave:</span>
          <ul className="sentiment-themes-list">
            {analysis.key_themes.map((theme, index) => (
              <li key={index} className="sentiment-theme-chip">
                {theme}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <footer className="sentiment-footer">
        {total_answers} {total_answers === 1 ? "respuesta analizada" : "respuestas analizadas"}
      </footer>
    </section>
  );
};

export default SentimentPanel;
