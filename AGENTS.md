# FastFormsFront

SPA de React 19 + Vite 7 + React Router 7 + Jotai + Supabase.

## Comandos

| Comando | Qué hace |
|---------|----------|
| `pnpm dev` | Servidor de desarrollo con HMR |
| `pnpm build` | Build de producción |
| `pnpm lint` | ESLint (flat config, `eslint.config.js`) |
| `pnpm test` | Vitest con jsdom |
| `pnpm preview` | Previsualiza el build local |

Ejecutar en orden: `pnpm lint && pnpm test` antes de commit.

## Estructura

- `src/main.jsx` — Definición de rutas. Solo tocar aquí para agregar/quitar páginas.
- `src/App.jsx` — Renderiza `<Home />`; es la raíz del router.
- `src/lib/apiClient.js` — Cliente HTTP hacia FastFormsBack (`VITE_API_URL` + `/api/v1/`).
- `src/lib/supabaseClient.js` — Cliente Supabase (seeds desde `VITE_SUPABASE_*` en `.env`).
- `src/stores/authAtom.js` — Estado de sesión con Jotai.
- `src/components/VoiceInput.jsx` — Grabación y transcripción con Whisper.
- `src/pages/` — Páginas del router. Cada archivo incluye su propio CSS con el mismo nombre.

## Tests

- Vitest + jsdom + `@testing-library/react`.
- Setup en `src/test/setup.js` — stubbea `VITE_SUPABASE_*` para que `supabaseClient.js` no falle.
- Los tests de página usan `MemoryRouter` + `<Routes>` (ver `SurveyAccess.test.jsx`).
- Mockear `src/lib/surveyService` con `vi.mock`.
- El estado "ya respondió" se guarda en `localStorage` con clave `fastforms:answered:<CODE>`.
- **No correr tests en paralelo** — varios usan `cleanup` y `localStorage.clear()`.

## Convenciones repo

- Código en español (variables, comentarios, commits).
- CSS plano por página/componente, sin Tailwind ni CSS-in-JS.
- ESLint: `no-unused-vars` como error, ignora vars con mayúscula/underscore (`^[A-Z_]`).
- Vite env variables prefijadas `VITE_`.
- Vercel: rewrite todo a `index.html` (SPA).

## Despliegue

- Vercel vía `vercel.json`. No requiere build step manual.
- `.env` no se sube (en `.gitignore`). Variables necesarias:
  - `VITE_API_URL` — backend FastForms (default `http://localhost:8000`).
  - `VITE_SUPABASE_URL` + `VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY`.
