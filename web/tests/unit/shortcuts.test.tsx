import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { ShortcutsProvider, useShortcutsHelp } from "@/components/shortcuts";

// Surfaces the open state as text so we can assert on it without poking at the
// dialog internals (which depend on framer-motion / focus machinery).
function OpenProbe() {
  const { open } = useShortcutsHelp();
  return <span data-testid="state">{open ? "open" : "closed"}</span>;
}

function press(key: string, init: KeyboardEventInit = {}, target?: EventTarget) {
  const event = new KeyboardEvent("keydown", {
    key,
    bubbles: true,
    cancelable: true,
    ...init
  });
  act(() => {
    (target ?? document).dispatchEvent(event);
  });
  return event;
}

afterEach(() => {
  document.body.innerHTML = "";
});

describe("ShortcutsProvider '?' shortcut", () => {
  it("toggles the help open and closed on '?'", () => {
    render(
      <ShortcutsProvider>
        <OpenProbe />
      </ShortcutsProvider>
    );
    expect(screen.getByTestId("state")).toHaveTextContent("closed");

    press("?");
    expect(screen.getByTestId("state")).toHaveTextContent("open");

    press("?");
    expect(screen.getByTestId("state")).toHaveTextContent("closed");
  });

  it("prevents default so the keystroke isn't typed elsewhere", () => {
    render(
      <ShortcutsProvider>
        <OpenProbe />
      </ShortcutsProvider>
    );
    const event = press("?");
    expect(event.defaultPrevented).toBe(true);
  });

  it("ignores '?' while typing in an input", () => {
    render(
      <ShortcutsProvider>
        <OpenProbe />
        <input data-testid="field" />
      </ShortcutsProvider>
    );
    const input = screen.getByTestId("field");
    input.focus();

    press("?", {}, input);
    expect(screen.getByTestId("state")).toHaveTextContent("closed");
  });

  it("ignores '?' when a command/ctrl/alt modifier is held", () => {
    render(
      <ShortcutsProvider>
        <OpenProbe />
      </ShortcutsProvider>
    );
    press("?", { metaKey: true });
    press("?", { ctrlKey: true });
    press("?", { altKey: true });
    expect(screen.getByTestId("state")).toHaveTextContent("closed");
  });

  it("throws when useShortcutsHelp is used outside the provider", () => {
    const Bare = () => {
      useShortcutsHelp();
      return null;
    };
    expect(() => render(<Bare />)).toThrow(/ShortcutsProvider/);
  });
});
