# Plan — Integración IA en `CreateSurvey.jsx` (US-13)

## Objetivo

Añadir una sección "Asistente IA" en la página de creación de encuestas que permita al usuario describir una idea y un número de preguntas (1-12), llamar al endpoint `POST /api/v1/surveys/generate` y, al recibir la respuesta, hidratar el formulario (título + preguntas) listo para editar.

## Decisiones acordadas con el usuario

- La respuesta se **hidrata en el formulario** (no se imprime como JSON crudo).
- Si ya hay preguntas, se **confirma con un modal** antes de reemplazarlas.

## Archivos a tocar

- `src/lib/apiClient.js` — nueva función `generateSurveyDraft`.
- `src/pages/CreateSurvey.jsx` — nueva `card` "Asistente IA", estado, handler.
- `src/pages/CreateSurvey.css` — estilos `.ai-card` y `.ai-generate-btn`.
- `docs/planus13.md` — este plan.

## Cambios

### 1. `src/lib/apiClient.js`

Añadir al final (antes de `transcribeAudio` para mantener la agrupación por dominio, o al final del archivo siguiendo el orden existente):

```js
/**
 * US-13 — Genera un borrador de encuesta con IA (Gemini) en backend.
 * No persiste nada: el frontend inyecta el JSON en el formulario.
 * @param {{ prompt: string, numQuestions: number, language?: string }} payload
 */
export function generateSurveyDraft({ prompt, numQuestions, language = "es" }) {
  return request("surveys/generate", {
    method: "POST",
    body: JSON.stringify({
      prompt,
      num_questions: numQuestions,
      language,
    }),
  });
}
```

`request()` ya añade el `Authorization: Bearer` con el token del usuario.

### 2. `src/pages/CreateSurvey.jsx`

#### 2.1 Import

```js
import { generateSurveyDraft } from "../lib/apiClient";
```

#### 2.2 Estado nuevo

```js
const [aiPrompt, setAiPrompt] = useState("");
const [aiNumQuestions, setAiNumQuestions] = useState(5);
const [isGenerating, setIsGenerating] = useState(false);
const [showAiConfirm, setShowAiConfirm] = useState(false);
```

#### 2.3 Handler

```js
const MAX_AI_QUESTIONS = 12;
const MIN_AI_PROMPT = 5;

const requestGenerateAI = () => {
  const prompt = aiPrompt.trim();
  if (prompt.length < MIN_AI_PROMPT) {
    toast.error("Describe la idea con al menos 5 caracteres.");
    return;
  }
  const num = Number(aiNumQuestions);
  if (!Number.isInteger(num) || num < 1 || num > MAX_AI_QUESTIONS) {
    toast.error(`El número de preguntas debe estar entre 1 y ${MAX_AI_QUESTIONS}.`);
    return;
  }
  if (questions.length > 0) {
    setShowAiConfirm(true);
    return;
  }
  performGenerateAI();
};

const performGenerateAI = async () => {
  setIsGenerating(true);
  setShowAiConfirm(false);
  try {
    const res = await generateSurveyDraft({
      prompt: aiPrompt.trim(),
      numQuestions: Number(aiNumQuestions),
    });
    setTitle(res.title || "");
    const newQuestions = (res.questions || []).map((q) => {
      const localId = crypto.randomUUID();
      const localType = REVERSE_QUESTION_TYPE_MAP[q.question_type] || "open";
      return {
        id: localId,
        type: localType,
        _data: {
          statement: q.content || "",
          type: localType,
          options: q.options || undefined,
        },
      };
    });
    setQuestions(newQuestions.map(({ id, type }) => ({ id, type })));
    setAnswersData(
      newQuestions.reduce((acc, { id, _data }) => {
        acc[id] = _data;
        return acc;
      }, {})
    );
    setAiPrompt("");
    toast.success(`Borrador generado con ${newQuestions.length} preguntas.`);
  } catch (err) {
    toast.error(`Error al generar con IA: ${err.message}`);
  } finally {
    setIsGenerating(false);
  }
};
```

#### 2.4 Markup

Insertar la nueva `card` entre la `card` "Información de la Encuesta" y la `card` "Preguntas":

```jsx
{/* ASISTENTE IA */}
<div className="card ai-card">
  <div className="ai-card-header">
    <span className="ai-card-badge">IA</span>
    <div>
      <h3>Asistente IA</h3>
      <p className="ai-card-subtitle">
        Describe la idea de tu encuesta y la IA generará un borrador con las
        preguntas que indiques.
      </p>
    </div>
  </div>

  <label htmlFor="ai-prompt">Contexto o idea *</label>
  <textarea
    id="ai-prompt"
    placeholder="Ej: Encuesta de satisfacción para usuarios de una app de delivery..."
    value={aiPrompt}
    maxLength={2000}
    onChange={(e) => setAiPrompt(e.target.value)}
    rows={3}
  />

  <label htmlFor="ai-num">Número de preguntas (máx. {MAX_AI_QUESTIONS})</label>
  <input
    id="ai-num"
    type="number"
    min={1}
    max={MAX_AI_QUESTIONS}
    value={aiNumQuestions}
    onChange={(e) => setAiNumQuestions(e.target.value)}
  />

  <button
    type="button"
    className="ai-generate-btn"
    onClick={requestGenerateAI}
    disabled={isGenerating}
  >
    {isGenerating ? "Generando..." : "✨ Generar con IA"}
  </button>
</div>
```

Y añadir un `ConfirmModal` extra al final (junto al de publicación) para confirmar el reemplazo:

```jsx
<ConfirmModal
  open={showAiConfirm}
  title="Reemplazar preguntas actuales"
  message="Ya tienes preguntas en el formulario. Si generas con IA, se perderán. ¿Continuar?"
  confirmLabel="Sí, reemplazar"
  cancelLabel="Cancelar"
  busy={isGenerating}
  onConfirm={performGenerateAI}
  onCancel={() => setShowAiConfirm(false)}
/>
```

### 3. `src/pages/CreateSurvey.css`

Añadir al final (antes del bloque `@media`):

```css
/* ========== ASISTENTE IA ========== */

.ai-card {
  border: 1px solid transparent;
  background:
    linear-gradient(var(--bg-card), var(--bg-card)) padding-box,
    linear-gradient(135deg, var(--primary) 0%, #a855f7 100%) border-box;
  position: relative;
  overflow: hidden;
}

.ai-card::before {
  content: "";
  position: absolute;
  inset: 0;
  background: linear-gradient(135deg, rgba(79, 70, 229, 0.04), rgba(168, 85, 247, 0.06));
  pointer-events: none;
}

.ai-card > * {
  position: relative;
}

.ai-card-header {
  display: flex;
  align-items: flex-start;
  gap: 14px;
  margin-bottom: 14px;
}

.ai-card-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 32px;
  padding: 0 12px;
  border-radius: 999px;
  background: linear-gradient(135deg, var(--primary), #a855f7);
  color: #fff;
  font-size: 13px;
  font-weight: 800;
  letter-spacing: 1px;
  box-shadow: 0 4px 12px rgba(124, 58, 237, 0.25);
  flex-shrink: 0;
}

.ai-card-subtitle {
  margin: 4px 0 0;
  font-size: 14px;
  color: var(--text-muted);
  line-height: 1.4;
}

.ai-generate-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 11px 18px;
  border-radius: 10px;
  border: none;
  background: linear-gradient(135deg, #7c3aed 0%, #a855f7 100%);
  color: #fff;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
  box-shadow: 0 4px 12px rgba(124, 58, 237, 0.25);
}

.ai-generate-btn:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 6px 16px rgba(124, 58, 237, 0.35);
}

.ai-generate-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
```

Y en el media query existente (`@media (max-width: 480px)`) asegurar que los inputs de la `.ai-card` se apilan bien (los inputs ya son `width: 100%`, por lo que se apilan solos).

## Verificación

- `pnpm lint`
- `pnpm test`

No hay tests actuales de `CreateSurvey`, por lo que la verificación se centra en lint + suite existente.
