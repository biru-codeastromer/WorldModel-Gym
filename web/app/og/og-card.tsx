import fs from "node:fs";
import path from "node:path";

// next/og 14.x does not re-export ImageResponseOptions, so we describe the
// shape of the `fonts` array (a Satori font descriptor) inline.
type OgFont = {
  name: string;
  data: Buffer | ArrayBuffer;
  weight?: 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900;
  style?: "normal" | "italic";
};

// ---------------------------------------------------------------------------
// Shared building blocks for the dynamic Open Graph / Twitter card images.
//
// Satori (which powers next/og's ImageResponse) cannot consume woff2, so the
// card reads the .ttf files we generate from the shipped woff2 faces into
// `app/og/fonts/`. These routes run on the Node runtime so they can read the
// font bytes off the filesystem.
//
// The card mirrors the app's "research terminal meets editorial press"
// identity: a warm-paper / dark token palette, a CMU Serif headline, IBM Plex
// Mono labels, a faint planner grid, and the WorldModel Gym wordmark.
// ---------------------------------------------------------------------------

export const OG_SIZE = { width: 1200, height: 630 } as const;
export const OG_CONTENT_TYPE = "image/png";

const FONT_DIR = path.join(process.cwd(), "app", "og", "fonts");

function readFont(file: string): Buffer {
  return fs.readFileSync(path.join(FONT_DIR, file));
}

/** Load the four faces used across the cards. Read once per render. */
export function ogFonts(): OgFont[] {
  return [
    { name: "CMU Serif", data: readFont("CMUSerif-Regular.ttf"), weight: 400, style: "normal" },
    { name: "CMU Serif", data: readFont("CMUSerif-Bold.ttf"), weight: 700, style: "normal" },
    { name: "Plex Mono", data: readFont("IBMPlexMono-Medium.ttf"), weight: 500, style: "normal" },
    { name: "Plex Mono", data: readFont("IBMPlexMono-SemiBold.ttf"), weight: 600, style: "normal" }
  ];
}

// Token-derived palette. We hard-code the resolved values from globals.css
// because Satori has no CSS-variable cascade; this is the warm-paper light
// theme, which is the brand's default surface.
const T = {
  bg: "#fbf6f0",
  surface: "#fffdfb",
  ink: "#1d1a24",
  muted: "#5f5867",
  subtle: "#6f6976",
  border: "rgba(120, 104, 92, 0.22)",
  accent: "#3760d0",
  accentSoft: "#e2e9ff",
  navy: "#11223a",
  orange: "#ff7a3d",
  paper: "#f9fbff",
  success: "#277548"
} as const;

export const ogColors = T;

/** The "A]" monogram wordmark, echoing app/icon.svg. */
function Wordmark() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
      <div
        style={{
          width: 64,
          height: 64,
          borderRadius: 16,
          background: T.navy,
          display: "flex",
          alignItems: "center",
          justifyContent: "center"
        }}
      >
        <svg width="44" height="44" viewBox="0 0 256 256" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M52 186L96 64H126L170 186H141L132 161H89L80 186H52ZM97 136H124L111 95L97 136Z" fill={T.paper} />
          <path
            d="M162 79H204C214.493 79 223 87.5066 223 98V158C223 168.493 214.493 177 204 177H162V79ZM190 104H183V152H190C194.418 152 198 148.418 198 144V112C198 107.582 194.418 104 190 104Z"
            fill={T.orange}
          />
        </svg>
      </div>
      <div style={{ display: "flex", flexDirection: "column" }}>
        <div style={{ fontFamily: "CMU Serif", fontWeight: 700, fontSize: 30, color: T.ink, lineHeight: 1 }}>
          WorldModel Gym
        </div>
        <div
          style={{
            fontFamily: "Plex Mono",
            fontWeight: 500,
            fontSize: 15,
            letterSpacing: 3,
            color: T.subtle,
            marginTop: 6,
            textTransform: "uppercase"
          }}
        >
          Planning Benchmark
        </div>
      </div>
    </div>
  );
}

type Stat = { label: string; value: string };

export type OgCardProps = {
  /** Mono eyebrow label, e.g. "LEADERBOARD". */
  eyebrow: string;
  /** Large serif headline. */
  title: string;
  /** Supporting sentence. */
  subtitle: string;
  /** Optional metric chips along the bottom. */
  stats?: Stat[];
  /** Optional mono tag shown on the right of the eyebrow row. */
  tag?: string;
};

/**
 * A single JSX tree rendered by every route's ImageResponse. Returning the tree
 * (rather than the ImageResponse itself) keeps font loading in the route and
 * lets the dynamic run route compose stats before rendering.
 */
export function OgCard({ eyebrow, title, subtitle, stats, tag }: OgCardProps) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        position: "relative",
        background: T.bg,
        padding: 72,
        fontFamily: "CMU Serif"
      }}
    >
      {/* Faint planner grid motif */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          // Satori's gradient parser cannot handle the commas inside rgba(),
          // so the grid lines use a comma-free hex color.
          backgroundImage:
            "linear-gradient(#e7ded3 1px, transparent 1px), linear-gradient(90deg, #e7ded3 1px, transparent 1px)",
          backgroundSize: "48px 48px",
          opacity: 0.55
        }}
      />
      {/* Accent edge */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 10,
          background: T.accent
        }}
      />

      {/* Top: wordmark + tag */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          position: "relative"
        }}
      >
        <Wordmark />
        <div
          style={{
            fontFamily: "Plex Mono",
            fontWeight: 500,
            fontSize: 16,
            color: T.muted,
            letterSpacing: 1
          }}
        >
          world-model-gym.vercel.app
        </div>
      </div>

      {/* Middle: eyebrow + headline */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          position: "relative",
          maxWidth: 980,
          paddingTop: 8,
          paddingBottom: 8
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div
            style={{
              fontFamily: "Plex Mono",
              fontWeight: 600,
              fontSize: 22,
              letterSpacing: 4,
              color: T.accent,
              textTransform: "uppercase"
            }}
          >
            {eyebrow}
          </div>
          {tag ? (
            <div
              style={{
                fontFamily: "Plex Mono",
                fontWeight: 500,
                fontSize: 18,
                color: T.muted,
                background: T.accentSoft,
                border: `1px solid ${T.border}`,
                borderRadius: 999,
                padding: "4px 16px"
              }}
            >
              {tag}
            </div>
          ) : null}
        </div>
        <div
          style={{
            fontFamily: "CMU Serif",
            fontWeight: 700,
            fontSize: 64,
            lineHeight: 1.05,
            color: T.ink,
            marginTop: 20,
            letterSpacing: -1
          }}
        >
          {title}
        </div>
        <div
          style={{
            fontFamily: "CMU Serif",
            fontWeight: 400,
            fontSize: 27,
            lineHeight: 1.3,
            color: T.muted,
            marginTop: 20
          }}
        >
          {subtitle}
        </div>
      </div>

      {/* Bottom: stat chips */}
      {stats && stats.length > 0 ? (
        <div style={{ display: "flex", gap: 20, position: "relative" }}>
          {stats.map((s) => (
            <div
              key={s.label}
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 8,
                background: T.surface,
                border: `1px solid ${T.border}`,
                borderRadius: 16,
                padding: "20px 28px",
                minWidth: 220
              }}
            >
              <div
                style={{
                  fontFamily: "Plex Mono",
                  fontWeight: 500,
                  fontSize: 16,
                  letterSpacing: 2,
                  color: T.subtle,
                  textTransform: "uppercase"
                }}
              >
                {s.label}
              </div>
              <div style={{ fontFamily: "CMU Serif", fontWeight: 700, fontSize: 42, color: T.ink }}>
                {s.value}
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
