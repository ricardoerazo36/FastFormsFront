# Plan 01 — Modo oscuro con `react-bits` + `jotai`

## Contexto del repo

- **Stack**: React 19 + Vite 7 + React Router 7 + Jotai 2.18 + Supabase. Sin Tailwind, CSS plano por página/componente.
- **Atoms existentes**: `src/stores/authAtom.js` usa `atom()` simple. Aún no hay un store de tema.
- **Tokens CSS ya definidos** en `src/index.css`: `--primary`, `--primary-dark/light/50/100/200`, `--gray-50..900`, `--bg`, `--bg-card`, `--bg-soft`, `--shadow-*`, `--transition`.
- **Problema**: ~30+ colores hardcodeados repartidos en `index.css`, `layout/*.css`, `pages/*.css`, `components/*.css` (búsqueda confirma `background:#fff`/`white` en 28 sitios y `color:#111827/#6b7280/#4b5563/#374151/#1f2937` en 32). Necesitan pasar a tokens semánticos.
- **Tests**: Vitest + jsdom. `src/test/setup.js` ya stubbea `VITE_SUPABASE_*`. `localStorage.clear()` en `beforeEach` (ver `SurveyAccess.test.jsx`), por lo que el atom de tema debe ser tolerante a `localStorage` vacío.
- **Build/despliegue**: Vite + Vercel rewrite. No hay restricciones raras.

## Decisiones (acordadas con el usuario)

1. **Componente react-bits**: Toggle animado sun/moon (custom + `framer-motion`).
2. **Alcance del tema**: tri-state `light` / `dark` / `system` (3 estados).
3. **Anti-FOUC**: NO. Se delega al `useEffect` del `Layout`. (Sí habrá un destello en la primera carga, aceptado.)
4. **CHANGELOG**: no se toca.

## 1. Dependencias a instalar

- `framer-motion` (peer de los componentes animados de react-bits, tree-shake por componente en Vite 7).
- Sin nuevas dependencias de iconos: reutilizamos `react-icons` (ya presente) con `FiSun`/`FiMoon`/`FiMonitor`.

No hace falta `jotai-effect`: el side-effect de aplicar `data-theme` al `<html>` lo hace un simple `useEffect` en `Layout`.

## 2. Modelo de estado (Jotai)

**Archivo nuevo**: `src/stores/themeAtom.js`

```js
import { atom } from 'jotai'
import { atomWithStorage, createJSONStorage } from 'jotai/utils'

// 'light' | 'dark' | 'system'
export const themeAtom = atomWithStorage(
  'fastforms:theme',
  'system',
  createJSONStorage(() => localStorage),
  { getOnInit: true }
)
```

- Patrón `atomWithStorage` recomendado por docs de Jotai.
- Clave con prefijo `fastforms:` para no colisionar con `fastforms:answered:<code>` (ver `AGENTS.md`).
- `getOnInit: true` evita el re-render fantasma en hidratación.

### Atom derivado + side-effect

Como el estado es tri-state, derivamos un `resolvedThemeAtom` (read-only) y un hook `useThemeApplier()`:

```js
export const resolvedThemeAtom = atom((get) => {
  const t = get(themeAtom)
  if (t === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light'
  }
  return t
})
```

Y un `<ThemeApplier />` (mejor como hook `useThemeApplier()` para no añadir un componente más) que en un `useEffect`:

1. Lee `useAtomValue(resolvedThemeAtom)`.
2. Setea `document.documentElement.dataset.theme = resolved`.
3. Se suscribe a `matchMedia('(prefers-color-scheme: dark)')` para repintar en vivo cuando el usuario cambie el modo del SO (solo si `themeAtom === 'system'`).
4. Limpieza en el `return`.

> El `resolvedThemeAtom` solo no es suficiente para reaccionar a cambios del SO: por eso el hook se suscribe explícitamente a `matchMedia`. Patrón documentado en la guía de persistencia de Jotai.

## 3. Toggle animado (react-bits + framer-motion)

**Archivos nuevos**: `src/components/ThemeToggle.jsx` + `ThemeToggle.css`

- Tres modos → no es un switch binario, es un popover/ciclo de 3 estados. UX: pequeño dropdown con tres botones (sol/luna/monitor) que se abre con un click sobre el ícono principal. Animación con `framer-motion` (`AnimatePresence` + `motion.span`).
- Iconos desde `react-icons/fi`: `FiSun`, `FiMoon`, `FiMonitor`.
- Componente con `aria-label` dinámico y `aria-expanded`, accesible por teclado (Escape cierra, click fuera cierra).
- Estilos en `ThemeToggle.css` siguiendo la convención del repo (CSS plano por componente).

El toggle vive en `src/layout/Header.jsx` (en `.header-right`, antes de los botones de auth/usuario) para que esté siempre visible.

## 4. Tokens de color + propagación a todas las hojas

**Archivo**: `src/index.css`

Mantener las variables actuales en `:root` y añadir su contraparte en `[data-theme="dark"]`:

```css
:root {
  --bg: #f6f6f8;
  --bg-card: #ffffff;
  --bg-soft: #f0f2f5;
  --text: #1f2937;          /* nuevo, antes implícito en gray-800 */
  --text-muted: #6b7280;    /* nuevo */
  --border: #e5e7eb;        /* nuevo */
  --header-bg: rgba(255,255,255,0.85);
  /* el resto de tokens primarios/gray-* se quedan igual */
}

[data-theme="dark"] {
  --bg: #0f1115;
  --bg-card: #1a1d24;
  --bg-soft: #232730;
  --text: #f3f4f6;
  --text-muted: #9ca3af;
  --border: #2d313a;
  --header-bg: rgba(20,22,28,0.85);
  /* sombras más sutiles en dark */
  --shadow-sm: 0 1px 2px rgba(0,0,0,0.4);
  /* el resto (primary, accent, etc) idéntico: la marca se mantiene */
}
```

`body` pasa a `background-color: var(--bg); color: var(--text);`.

### Migración de hardcoded → tokens (~25 sitios)

- `#fff` / `white` en backgrounds → `var(--bg-card)`
- `#111827`, `#1f2937` en `color:` → `var(--text)`
- `#6b7280`, `#4b5563` en `color:` → `var(--text-muted)`
- `#e5e7eb`, `#ddd` en `border:` → `var(--border)`
- `rgba(255,255,255,0.85)` del header → `var(--header-bg)`
- `linear-gradient(180deg, var(--bg) 0%, #ffffff 100%)` en Home `.steps` → `linear-gradient(180deg, var(--bg) 0%, var(--bg-card) 100%)`
- `.features { background: #ffffff }` y `.ai-section { background: #ffffff }` → `var(--bg-card)`
- `.stats` ya usa un gradiente violeta, se queda (sección de marca).
- `.hero h1` con `background: linear-gradient(135deg, var(--gray-900) 0%, var(--primary) 100%)` se queda igual.
- `::-webkit-scrollbar-thumb { background: var(--gray-300) }` → `var(--border)`.
- `.skeleton` usa `--gray-200` y `--gray-100` → migrar a `var(--bg-soft)` y `var(--bg-card)`.

Archivos a tocar:

```
src/index.css                              ← nuevos tokens + dark block + body
src/layout/Header.css                      ← bg + text muted
src/layout/Footer.css                      ← dejar de ser #333; usar var(--bg-card) + var(--text)
src/pages/Home.css                         ← 6-8 lugares
src/pages/Login.css                        ← 3 lugares
src/pages/Register.css                     ← 3 lugares
src/pages/Dashboard.css                    ← 4-5 lugares
src/pages/CreateSurvey.css                 ← 5-6 lugares
src/pages/SurveyAccess.css                 ← 6-8 lugares
src/pages/SurveyResults.css                ← 4-5 lugares
src/components/ConfirmModal.css            ← bg + text
src/components/DonutChart.css              ← text muted
src/components/VoiceInput.css              ← status text
```

## 5. Integración en el árbol React

- **`src/layout/Layout.jsx`**: llamar a `useThemeApplier()` al inicio. No rompe el `if (loading) return ...` — el hook se monta dentro del componente principal.
- **`src/main.jsx`**: nada cambia. Jotai funciona sin `<Provider>` con el store por defecto (igual que `authAtom` actual).
- **`src/layout/Header.jsx`**: añadir `<ThemeToggle />` al inicio de `<div className="header-right">`.

## 6. Tests

- `src/test/setup.js` ya no necesita cambios (no tocamos Supabase).
- Añadir `src/components/ThemeToggle.test.jsx`:
  - Renderiza el toggle.
  - Click cicla `system → light → dark → system`.
  - Verifica que `document.documentElement.dataset.theme` cambia en consecuencia.
  - Mockear `matchMedia` con `vi.stubGlobal` o seguir el patrón del repo.
- `SurveyAccess.test.jsx` no se toca. El `localStorage.clear()` del `beforeEach` resetea también `fastforms:theme` y el `resolvedThemeAtom` cae al default (light en jsdom, porque `matchMedia` no está definido), por lo que los tests existentes no se ven afectados.

## 7. Verificación

Antes de commit, en este orden (ver `AGENTS.md`):

```bash
pnpm lint
pnpm test
pnpm build
```

## 8. Resumen de archivos a crear / tocar

**Crear**:

- `src/stores/themeAtom.js`
- `src/components/ThemeToggle.jsx`
- `src/components/ThemeToggle.css`
- `docs/plan01.md`

**Editar**: los listados en la sección 4.

**No tocar**: `CHANGELOG.md` (decisión explícita), `vercel.json`, `vite.config.js`, `eslint.config.js`, `index.html` (sin anti-FOUC), backend.

### tiempo de ejecucion : 6.47min