/**
 * Citation source-of-truth for WorldModel Gym. A single benchmark record drives
 * every rendered format (BibTeX + plain text) so the metadata can never drift
 * between formats. Year is pinned to 2026 (the benchmark's public release).
 */

export type Citation = {
  /** BibTeX entry key — also the canonical short id for the benchmark. */
  key: string;
  author: string;
  title: string;
  year: number;
  url: string;
  note: string;
  /** BibTeX entry type. @software is the most accurate for a living benchmark. */
  entryType: "software" | "misc";
};

export const WMG_CITATION: Citation = {
  key: "worldmodelgym2026",
  author: "Saikia, Birajit",
  title: "WorldModel Gym: A Benchmark for Long-Horizon Planning under Sparse Rewards and Partial Observability",
  year: 2026,
  url: "https://world-model-gym.vercel.app",
  note: "Reproducible seeded test/train/continual tracks with honest success, bootstrap CIs, and k-step model-fidelity metrics. Version 0.1.0.",
  entryType: "software"
};

/** Render a citation as a formatted BibTeX entry string. */
export function toBibTeX(c: Citation): string {
  const fields: [string, string][] = [
    ["author", c.author],
    ["title", `{${c.title}}`],
    ["year", String(c.year)],
    ["url", c.url],
    ["note", c.note]
  ];
  const body = fields
    .map(([k, v]) => `  ${k.padEnd(6)} = {${v}},`)
    .join("\n");
  return `@${c.entryType}{${c.key},\n${body}\n}`;
}

/** Render a citation as a single-line plain-text reference. */
export function toPlainText(c: Citation): string {
  return `${c.author} (${c.year}). ${c.title}. ${c.url}`;
}
