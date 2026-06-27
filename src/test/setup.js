import "@testing-library/jest-dom/vitest";

// Env stubs para que `supabaseClient.js` no falle al inicializarse
// dentro del entorno de tests (jsdom no carga el `.env` de Vite).
import.meta.env.VITE_SUPABASE_URL ??= "https://fake.supabase.co";
import.meta.env.VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY ??= "fake-publishable-key";
