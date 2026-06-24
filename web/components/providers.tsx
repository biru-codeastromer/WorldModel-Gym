"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PropsWithChildren, useState } from "react";

import { CommandPaletteProvider } from "@/components/command-palette";
import { ShortcutsProvider } from "@/components/shortcuts";
import { ThemeProvider } from "@/components/theme";
import { ToastProvider } from "@/components/ui";

export function Providers({ children }: PropsWithChildren) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: 1,
            refetchOnWindowFocus: false
          }
        }
      })
  );
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        {/* ShortcutsProvider mounts the "?" help dialog + global listener and
            wraps the palette so the palette's "Keyboard shortcuts" action can
            read useShortcutsHelp(). CommandPaletteProvider mounts the ⌘K palette
            + global shortcut; ToastProvider mounts the aria-live toast viewport.
            All live inside the QueryClient (the palette fetches via React Query)
            and Theme (the palette/theme-toggle action reads useTheme). */}
        <ShortcutsProvider>
          <CommandPaletteProvider>{children}</CommandPaletteProvider>
        </ShortcutsProvider>
        <ToastProvider />
      </QueryClientProvider>
    </ThemeProvider>
  );
}
