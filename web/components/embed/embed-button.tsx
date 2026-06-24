"use client";

import { Code2 } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui";
import type { ButtonSize, ButtonVariant } from "@/components/ui";

import { EmbedDialog } from "./embed-dialog";

export type EmbedButtonProps = {
  /** Origin-relative badge path, e.g. "/runs/abc/badge". */
  badgePath: string;
  /** Origin-relative target the badge links to, e.g. "/runs/abc". */
  targetPath: string;
  /** Short human label used in the dialog + alt text, e.g. "run abc". */
  subject: string;
  /** Button label. Defaults to "Embed". */
  label?: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
};

/**
 * "Embed" affordance: a design-system Button that opens the {@link EmbedDialog}
 * with copy-able badge snippets. Self-contained (owns its open state) so a page
 * can drop it next to a run header or leaderboard track switcher.
 */
export function EmbedButton({
  badgePath,
  targetPath,
  subject,
  label = "Embed",
  variant = "secondary",
  size = "sm",
  className
}: EmbedButtonProps) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        type="button"
        variant={variant}
        size={size}
        className={className}
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        leftIcon={<Code2 className="h-4 w-4" aria-hidden="true" />}
      >
        {label}
      </Button>
      <EmbedDialog
        open={open}
        onOpenChange={setOpen}
        badgePath={badgePath}
        targetPath={targetPath}
        subject={subject}
      />
    </>
  );
}
