# Plan — Autorrellenado por voz de encuestas (US-15 t2)

## Objetivo

Añadir en la página de llenado (`SurveyAccess.jsx`) una sección llamativa con un botón de micrófono que, al activarlo, guía al usuario a dictar las respuestas en orden, las transcribe, las envía al backend `/responses/auto-fill` y autorrellena el formulario para que el encuestado verifique/corrija antes de enviar.

## Decisiones acordadas con el usuario

- **Flujo de grabación**: modal/overlay a pantalla completa con cuenta regresiva 3-2-1, indicador de grabación, instrucciones y botón "Detener".
- **Bloqueo durante espera**: bloqueo total con overlay a pantalla completa + desactivar el resto del formulario.
- **Sobrescritura**: si el usuario ya escribió respuestas a mano, se pregunta antes de sobrescribir.
- **Marcar como voz**: sí, las respuestas autorrellenadas se marcan con `is_voice: true` y conservan el `language` detectado.

## Archivos a tocar

| Tipo | Ruta | Propósito |
|------|------|-----------|
| Editar | `src/lib/apiClient.js` | Añadir `autoFillSurvey(audioBlob, { code, language })` que manda `audio`+`code` al endpoint. |
| Crear | `src/components/AutoFillVoice.jsx` | Componente que encapsula el modal overlay de cuenta regresiva + grabación + estado. |
| Crear | `src/components/AutoFillVoice.css` | Estilos del componente. |
| Editar | `src/pages/SurveyAccess.jsx` | Renderizar la sección "Autorrellenar por voz" arriba del formulario y aplicar el resultado al estado. |
| Editar | `src/pages/SurveyAccess.css` | Estilos de la sección "Autorrellenar por voz" y del overlay de bloqueo. |
| Editar | `src/pages/SurveyAccess.test.jsx` | Tests del flujo de autorrellenado. |
| Crear | `docs/planus15.md` | Este plan. |

## Cambios

### 1. `src/lib/apiClient.js`

Añadir al final del archivo la función `autoFillSurvey` siguiendo el patrón de `transcribeAudio` (mismo manejo de `Authorization` opcional, mismo parseo de `error.detail`):

```js
export async function autoFillSurvey(audioBlob, { code, language = "es" }) {
  const formData = new FormData();
  const extension = (audioBlob.type || "audio/webm").split("/")[1]?.split(";")[0] || "webm";
  formData.append("audio", audioBlob, `clip.${extension}`);
  formData.append("code", code);
  if (language) formData.append("language", language);

  const headers = {};
  const token = await getToken().catch(() => null);
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const response = await fetch(`${API_BASE_URL}responses/auto-fill`, {
    method: "POST",
    headers,
    body: formData,
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || `Error ${response.status}`);
  }
  return response.json();
}
```

### 2. `src/components/AutoFillVoice.jsx`

Componente autocontenido. Estados: `idle | countdown | recording | submitting | error | success`.

Props:
```js
{
  surveyCode: string,
  questions: Array,                  // [{id, content, position}] — pista visual de la pregunta actual
  onResult: (response) => void,
  onBusyChange?: (busy: boolean) => void,
  language?: string,                // default "es"
  onError?: (err) => void,
}
```

Flujo:
- **idle**: card con botón "Iniciar dictado" (icono `🎤`).
- **countdown**: overlay full-screen, 3→2→1 + texto instructivo + pista de la pregunta actual (muestra `questions[0]`).
- **recording**: overlay full-screen con pregunta actual destacada, instrucción "Responde la pregunta N de M" (rota cada ~6s con `setInterval`), indicador rojo pulsante + tiempo, botón "Detener". Tope 60s.
- **submitting**: overlay full-screen con spinner + "Procesando tus respuestas con IA...".
- **error**: vuelve a `idle` y muestra mensaje en la card.
- **success**: llama `onResult(response)` y vuelve a `idle`.

Lógica de grabación: reusar el patrón de `VoiceInput.jsx` (MediaRecorder, `pickMimeType` con `audio/webm;codecs=opus`, cleanup riguroso de tracks, `MAX_SECONDS = 60`). Al detener, se obtiene el `Blob` y se llama a `autoFillSurvey(blob, { code: surveyCode, language })`. El `language` se omite en el form (default backend) si no se pasa nada.

`useEffect(() => () => cleanup(), [])` para evitar fugas. `onBusyChange(true)` en `submitting`, `onBusyChange(false)` al terminar (éxito o error).

### 3. `src/components/AutoFillVoice.css`

Estilos del overlay y de la card. Elementos clave:
- `.autofill-overlay` (full-screen, `position: fixed; inset: 0; z-index: 9000; background: rgba(15, 23, 42, 0.92)`).
- `.autofill-overlay-card` (contenedor centrado, max-width 540px).
- `.autofill-countdown-number` (número enorme, `font-size: 120px`, animación de escala).
- `.autofill-recording-dot` (círculo rojo pulsante, `@keyframes autofill-pulse`).
- `.autofill-spinner` (spinner, `@keyframes autofill-spin`).
- `.autofill-question-pill` (chip con "Pregunta N de M").
- `.autofill-stop-btn` (botón grande rojo "Detener").

### 4. `src/pages/SurveyAccess.jsx`

**Nuevos estados:**
```js
const [autoFillBusy, setAutoFillBusy] = useState(false);
const [autoFillError, setAutoFillError] = useState("");
const [showOverwriteConfirm, setShowOverwriteConfirm] = useState(false);
const [autoFillOpen, setAutoFillOpen] = useState(false);
```

**Nueva sección "Autorrellenar por voz"** (entre `survey-intro-card` y la card de preguntas):
- Card con gradiente `linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)`, texto blanco.
- Header: icono `🎤` + título "Autorrellenar por voz" + subtítulo explicativo.
- Botón grande "Iniciar dictado". Deshabilitado cuando `autoFillBusy` o `autoFillOpen`.
- Muestra `autoFillError` si existe.

**Handler `handleAutoFillClick`:** si hay respuestas existentes → modal de confirmación. Si no → `setAutoFillOpen(true)`.

**Modal de sobrescritura** (reusar `ConfirmModal`): "Ya tienes respuestas" / "Si activas el autorrellenado por voz, se reemplazarán las respuestas que ya escribiste. ¿Continuar?".

**Handler `handleAutoFillResult(response)`:**
- Itera `response.answers` y actualiza `answers`, `voiceFlags`, `voiceLangs` con `setAnswers`/`setVoiceFlags`/`setVoiceLangs`.
- Limpia `fieldErrors` de preguntas rellenadas.
- `toast.success("Respuestas autorrellenadas. Revísalas antes de enviar.")`.
- `setAutoFillOpen(false)`.

**Overlay de bloqueo** (full-screen, `position: fixed; inset: 0; z-index: 9999`): se renderiza cuando `autoFillBusy === true` Y no estamos dentro del propio modal de autorrellenado. Spinner + "Procesando tus respuestas con IA...".

**Disabled en el botón "Enviar respuestas" y "back-btn"** mientras `autoFillBusy` o `autoFillOpen`.

### 5. `src/pages/SurveyAccess.css`

Agregar:
- `.autofill-voice-card` (gradiente, padding generoso, border-radius 14px, sombra).
- `.autofill-voice-header` (flex con icono + texto).
- `.autofill-voice-title` (h3 blanco, font-size 18px).
- `.autofill-voice-subtitle` (p blanco, opacity 0.9).
- `.autofill-voice-btn` (botón grande blanco con texto violeta, hover con elevación).
- `.autofill-voice-status` (texto de estado).
- `.autofill-voice-error` (mensaje de error en la card).
- `.autofill-blocking-overlay` (overlay full-screen con spinner).

### 6. `src/pages/SurveyAccess.test.jsx`

Mockear `apiClient` con `vi.mock("../lib/apiClient", ...)` para exponer `autoFillSurvey.mockResolvedValueOnce(...)`. Si el mock actual no lo cubre, agregar `autoFillSurvey: vi.fn()` a `surveyService` o crear un mock nuevo. Lo más limpio: mockear `apiClient` por completo y `surveyService` solo con `fetchSurveyByCode` y `submitSurveyResponse` como ya está.

Tests a agregar:
1. Muestra la sección "Autorrellenar por voz" cuando la encuesta está en `ready`.
2. Llama al autorrellenado con el código al hacer click en el botón (cuando no hay respuestas).
3. Pide confirmación antes de sobrescribir si el usuario ya escribió algo.
4. Aplica el resultado al estado `answers`, `voiceFlags`, `voiceLangs` al recibir respuesta exitosa.
5. Muestra error en la card si el backend responde 404/409/502.
6. Deshabilita el botón "Enviar respuestas" mientras `autoFillBusy` (overlay de bloqueo).

## Riesgos / cosas a cuidar

- **Browser support**: MediaRecorder no existe en todos los navegadores. Replicar la degradación de `VoiceInput`.
- **Permiso de micrófono**: si el usuario rechaza, `AutoFillVoice` debe caer a `error` con mensaje "Permiso de micrófono denegado".
- **Limpieza**: al desmontar el componente o cambiar de encuesta, detener tracks y limpiar intervals.
- **Theme**: la card con gradiente morado debe verse bien en ambos modos del theme toggle.
- **No correr tests en paralelo** (regla del AGENTS.md del repo).
- **Límite de 60s** alineado con el límite de 10MB del backend (audio webm a ~128kbps ≈ 1MB por minuto).

## Orden de ejecución

1. `docs/planus15.md` — este plan.
2. `src/lib/apiClient.js` — agregar `autoFillSurvey`.
3. `src/components/AutoFillVoice.jsx` + `.css` — componente aislado.
4. `src/pages/SurveyAccess.jsx` + `.css` — integración, overlay de bloqueo, modal de sobrescritura.
5. `src/pages/SurveyAccess.test.jsx` — tests.
6. `pnpm lint && pnpm test` para verificar.
