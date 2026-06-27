import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Provider, createStore } from "jotai";
import ThemeToggle from "./ThemeToggle";
import { themeAtom } from "../stores/themeAtom";

const installMatchMedia = (prefersDark = false) => {
  const listeners = new Set();
  const mql = {
    matches: prefersDark,
    media: "(prefers-color-scheme: dark)",
    addEventListener: (_event, cb) => listeners.add(cb),
    removeEventListener: (_event, cb) => listeners.delete(cb),
    addListener: (cb) => listeners.add(cb),
    removeListener: (cb) => listeners.delete(cb),
    dispatchEvent: () => true,
  };
  vi.stubGlobal("matchMedia", () => mql);
  return { mql, listeners };
};

const renderWithStore = () => {
  const store = createStore();
  const utils = render(
    <Provider store={store}>
      <ThemeToggle />
    </Provider>,
  );
  return { ...utils, store };
};

describe("ThemeToggle", () => {
  beforeEach(() => {
    installMatchMedia(false);
    window.localStorage.clear();
    document.documentElement.removeAttribute("data-theme");
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("abre el menu y permite elegir cada uno de los 3 estados", async () => {
    const { store } = renderWithStore();
    const button = screen.getByRole("button", { name: /tema actual/i });

    expect(screen.queryByRole("menu")).not.toBeInTheDocument();

    fireEvent.click(button);

    const lightOption = await screen.findByRole("menuitemradio", { name: /claro/i });
    const darkOption = screen.getByRole("menuitemradio", { name: /oscuro/i });
    const systemOption = screen.getByRole("menuitemradio", { name: /sistema/i });

    expect(lightOption).toBeInTheDocument();
    expect(darkOption).toBeInTheDocument();
    expect(systemOption).toBeInTheDocument();

    fireEvent.click(lightOption);

    await waitFor(() => {
      expect(store.get(themeAtom)).toBe("light");
    });
    expect(window.localStorage.getItem("fastforms:theme")).toBe("\"light\"");

    fireEvent.click(button);
    fireEvent.click(await screen.findByRole("menuitemradio", { name: /oscuro/i }));
    await waitFor(() => {
      expect(store.get(themeAtom)).toBe("dark");
    });

    fireEvent.click(button);
    fireEvent.click(await screen.findByRole("menuitemradio", { name: /sistema/i }));
    await waitFor(() => {
      expect(store.get(themeAtom)).toBe("system");
    });
  });

  it("cierra el menu al hacer click fuera", async () => {
    render(
      <div>
        <div data-testid="outside">afuera</div>
        <Provider store={createStore()}>
          <ThemeToggle />
        </Provider>
      </div>,
    );

    fireEvent.click(screen.getByRole("button", { name: /tema actual/i }));
    expect(await screen.findByRole("menu")).toBeInTheDocument();

    fireEvent.mouseDown(screen.getByTestId("outside"));

    await waitFor(() => {
      expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    });
  });

  it("cierra el menu al presionar Escape", async () => {
    renderWithStore();
    fireEvent.click(screen.getByRole("button", { name: /tema actual/i }));
    expect(await screen.findByRole("menu")).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape" });

    await waitFor(() => {
      expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    });
  });
});
