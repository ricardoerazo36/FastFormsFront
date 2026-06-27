# Plan — Análisis de sentimientos en resultados (US-16)

## Objetivo

Añadir en la página de resultados (`SurveyResults.jsx`) un botón **"Análisis de sentimientos"** al lado de cada pregunta abierta, **solo si la encuesta está cerrada**. Al pulsarlo, el front hace `POST /surveys/{survey_id}/questions/{question_id}/sentiment-analysis`, recibe el JSON del backend y lo muestra en un panel desplegable moderno.

## Decisiones acordadas con el usuario

- El botón va **por pregunta abierta** (no por cada respuesta individual), porque el endpoint analiza el agregado.
- Solo se muestra cuando `results.status === "closed"`.
- No se llama al backend automáticamente: el usuario decide cuándo analizar.
- El panel se renderiza debajo del listado de respuestas, dentro de la misma `results-card`.

## Archivos a tocar

| Tipo | Ruta | Propósito |
|------|------|-----------|
| Editar | `src/lib/apiClient.js` | Añadir `analyzeSentiment(surveyId, questionId)`. |
| Crear | `src/components/SentimentPanel.jsx` | Componente que renderiza el JSON del análisis (sentimiento, score, distribución, summary, key_themes). |
| Editar | `src/pages/SurveyResults.jsx` | Estado por pregunta, botón y render del panel. |
| Editar | `src/pages/SurveyResults.css` | Estilos del header con botón, panel desplegable, barras, badges y chips. |
| Crear | `src/pages/SurveyResults.test.jsx` | Tests del flujo (botón oculto/visible, llamada al backend, render del panel, errores). |
| Crear | `docs/planus16.md` | Este plan. |

## Cambios

### 1. `src/lib/apiClient.js`

Añadir tras `getSurveyResults`:

```js
export function analyzeSentiment(surveyId, questionId) {
  return request(
    `surveys/${surveyId}/questions/${questionId}/sentiment-analysis`,
    { method: "POST" }
  );
}
```

### 2. `src/components/SentimentPanel.jsx`

Componente puro con la firma:

```js
<SentimentPanel analysis={...} loading={bool} error={string|null} />
```

Renderiza:
- **Sentimiento global**: badge grande con `overall_sentiment` y `score` con formato `+0.42` o `-0.18`.
- **Distribución**: tres barras horizontales (positiva/negativa/neutra) con conteo y porcentaje.
- **Resumen**: bloque de texto con `summary`.
- **Temas clave**: chips con `key_themes` (si hay).
- **Pie**: total de respuestas analizadas.
- **Estado de error**: muestra `error` con color de error si lo recibe.

Color de sentimiento:
- `positivo` → verde.
- `negativo` → rojo.
- `neutral` → gris.
- `mixto` → ámbar.

### 3. `src/pages/SurveyResults.jsx`

- Estado nuevo:
  ```js
  const [sentimentByQuestion, setSentimentByQuestion] = useState({});
  const [sentimentLoading, setSentimentLoading] = useState({});
  const [sentimentError, setSentimentError] = useState({});
  const [sentimentOpen, setSentimentOpen] = useState({});
  ```
- En el render de cada `results-card` con `isOpen` y `entries.length > 0`:
  - Si `results.status === "closed"`, renderizar el botón al lado del `h3` con layout flex.
  - El botón dispara:
    - Si ya hay análisis y se cierra/abre, solo toggle de `sentimentOpen`.
    - Si no hay análisis, llamar a `analyzeSentiment`, setear loading, guardar respuesta o error, y abrir el panel.
- Render condicional del `<SentimentPanel>` debajo de la lista de respuestas.

### 4. `src/pages/SurveyResults.css`

Clases nuevas (respetando variables ya definidas):
- `.results-card-header` — flex con título y botón alineado a la derecha.
- `.sentiment-btn` — botón secundario (outline con `var(--primary)`).
- `.sentiment-btn:disabled` — opacidad reducida.
- `.sentiment-panel` — card anidada con borde, sombra suave y animación de entrada.
- `.sentiment-header` — flex con badge de sentimiento + score.
- `.sentiment-badge` + modificadores `.sentiment-badge-pos`, `.sentiment-badge-neg`, `.sentiment-badge-neu`, `.sentiment-badge-mix`.
- `.sentiment-score` — tipografía monoespaciada.
- `.sentiment-distribution` — contenedor de barras.
- `.sentiment-bar` + `.sentiment-bar-fill` + modificadores de color.
- `.sentiment-summary` — texto justificado.
- `.sentiment-themes` + `.sentiment-theme-chip`.
- `.sentiment-error` — color de error.
- `.sentiment-loading` — texto con spinner visual (puntos animados).
- Media query para móvil: el header se apila vertical.

### 5. `src/pages/SurveyResults.test.jsx`

Siguiendo el patrón de `SurveyAccess.test.jsx`:
- `MemoryRouter` + `<Routes>` con `/results/:surveyId`.
- Mock parcial de `apiClient` con `vi.mock` para `analyzeSentiment`.
- Casos:
  1. Render con `status: "active"` → el botón NO aparece.
  2. Render con `status: "closed"` y pregunta abierta con respuestas → botón visible.
  3. Click en el botón → llama a `analyzeSentiment` con los IDs correctos y renderiza el panel con `overall_sentiment`, `distribution`, `summary`, `key_themes`.
  4. Click otra vez en el botón (con datos cargados) → colapsa el panel.
  5. Backend devuelve error → se muestra el mensaje en el panel.

### 6. Verificación

```bash
pnpm lint && pnpm test
```
### tiempo de ejecución 3min 3seg