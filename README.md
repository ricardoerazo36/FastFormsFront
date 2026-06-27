# Fast Forms

Fast Forms es una aplicación web responsive y minimalista para crear, compartir y recolectar encuestas rápidamente mediante un código de acceso. El objetivo es ofrecer una alternativa ágil y directa a soluciones más completas como Google Forms, centrada en simplicidad y velocidad.


**Manual de desarrollo local**


 - Instalar dependencias:

```bash
pnpm install
```

- crear y llenar .env:

crear un .env como el de .env.example y pedirme las las claves


 - Levantar servidor de desarrollo (HMR):

```bash
pnpm run dev
```

## Voz con Whisper (US-12 a US-17)

Fast Forms permite **dictar enunciados** mientras se construye una encuesta
(US-13) y **responder por voz** preguntas abiertas o de opción
(US-14 / US-15). La transcripción la hace el backend con la API de
**Whisper** de OpenAI.

### Prerrequisitos

1. El backend debe estar levantado con un proveedor de Whisper configurado.
   Por defecto usa **Whisper local** (`openai/whisper`), que no necesita API
   key pero sí `ffmpeg`. Ver `FastFormsBack/README.md` para los detalles.
2. La tabla `answers` debe incluir la columna `is_voice` (US-17). Hay una
   migración idempotente al pie de `base.sql`.
3. Variables de entorno en el `.env` del front:

   ```
   VITE_API_URL=http://localhost:8000
   VITE_SUPABASE_URL=https://<tu-proyecto>.supabase.co
   VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY=<anon-key>
   ```

### Cómo usar las funciones de voz

- **Constructor (US-13).** Junto al input de cada pregunta hay un botón
  *🎤 Dictar enunciado*. Al presionarlo el navegador pide permiso de
  micrófono; el componente muestra "Grabando…" con temporizador, luego
  "Procesando…" y al terminar inserta el texto transcrito en el campo,
  donde queda editable antes de guardar el borrador.
- **Llenado de pregunta abierta (US-14).** En las preguntas abiertas
  aparece *🎤 Responder por voz*. Al detener la grabación, la respuesta
  se escribe automáticamente en el `textarea` y puede editarse o
  reemplazarse a mano. No se requiere cuenta.
- **Selección por voz (US-15).** En preguntas Sí/No y de opción
  múltiple, el botón de voz transcribe lo dicho y lo empareja con la
  opción más parecida (`src/lib/fuzzyMatch.js`). Si la confianza es alta
  marca la opción directamente; si es baja, pide confirmación
  ("¿Querías decir 'Excelente'?").
- **Estados y degradación (US-16).** Si el permiso de micrófono se
  niega, el navegador no soporta `MediaRecorder` o la transcripción
  falla, se muestra un mensaje claro y se ofrece volver a intentar.
- **Resultados (US-17).** En el dashboard de resultados, las respuestas
  abiertas dictadas llevan un badge *🎤 por voz* y se puede filtrar el
  feed con la búsqueda por palabra clave.
- **Multilingüe (US-18).** Las respuestas abiertas por voz se transcriben
  con detección automática de idioma (`language="auto"`). El idioma
  detectado se guarda con la respuesta y se muestra como etiqueta
  *🌐 idioma* junto al badge de voz en el dashboard.
- **Código por voz (US-19).** En la pantalla de inicio, el botón
  *🎤 Dictar código* graba el código de acceso; el backend lo normaliza
  ("a siete equis nueve ka" → `A7X9K`) y se muestra para confirmar antes
  de entrar, con opción de corregirlo manualmente.

### Componentes y utilidades clave

| Archivo | Para qué sirve |
| --- | --- |
| `src/components/VoiceInput.jsx` | Botón de micrófono reutilizable con MediaRecorder y estados (US-13/14/16). |
| `src/lib/apiClient.js` (`transcribeAudio`) | Llama a `POST /api/v1/transcribe/` (idioma/auto, task, normalize). |
| `src/lib/fuzzyMatch.js` | Empareja una transcripción con la opción más parecida (US-15). |
| `src/components/SurveyQuestionField.jsx` | Integra voz en preguntas abiertas y de opción (US-14/15/18). |
| `src/pages/SurveyResults.jsx` | Badge "por voz" + idioma + buscador (US-17/18). |
| `src/pages/Home.jsx` | Ingreso del código de encuesta por voz (US-19). |

### Limitaciones conocidas

- Whisper solo acepta hasta 60 s y 10 MB por archivo (validado en el
  backend; el componente corta a los 60 s automáticamente).
- El navegador debe soportar `MediaRecorder` y otorgar el permiso de
  micrófono. iOS Safari ≥ 14.5 / Chrome / Firefox / Edge actuales
  funcionan.
- El idioma por defecto es español; puede sobreescribirse con la prop
  `language` de `<VoiceInput>` o el parámetro `language` del helper.
