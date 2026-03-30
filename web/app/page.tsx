import Link from "next/link";

const signalCards = [
  {
    title: "Prompt-driven benchmark creation",
    detail: "Frame sparse-reward and partial-observability tasks as polished research stories."
  },
  {
    title: "Upload traces and metrics",
    detail: "Move from controlled evaluations to public-facing evidence without rebuilding the stack."
  },
  {
    title: "Compare tracks in public",
    detail: "Translate raw run artifacts into a leaderboard that recruiters and collaborators can actually read."
  }
];

const agenticFlow = [
  "Design reproducible tasks with deterministic seeds and explicit budgets.",
  "Run planning agents against sparse rewards and partial observability.",
  "Publish traces, returns, and planning cost in a polished public benchmark."
];

const benchmarkTabs = [
  "Create",
  "Evaluate",
  "Upload",
  "Compare"
];

const benchmarkSteps = [
  "Prompt-based world specification",
  "Reference traces and task defaults",
  "Multi-view metric summaries",
  "Leaderboards per track",
  "Run-level trace inspection"
];

const manufacturerGrid = [
  "Benchmark tracks",
  "Environment defaults",
  "Trace artifacts",
  "Planning cost profiles",
  "Leaderboard slices",
  "Deployment-ready demos"
];

const reasons = [
  "Cleaner story for recruiters, labs, and research demos",
  "Visual + technical benchmark surfaces in one place",
  "Consistent presentation across tasks, runs, and leaderboard views",
  "Less reliance on ad hoc notebooks for public sharing",
  "Higher confidence in live demos under pressure",
  "Smoother handoff from experiments to deployment"
];

export default function HomePage() {
  return (
    <section className="space-y-10">
      <section className="border-b border-t border-[var(--line)] pb-10 pt-12">
        <div className="mx-auto max-w-4xl text-center">
          <p className="section-kicker justify-center">World-model benchmark platform</p>
          <h1 className="mt-6 text-5xl font-semibold leading-[1.02] tracking-[-0.05em] text-[var(--ink)] md:text-7xl">
            Turn your planning research into{" "}
            <span className="brand-accent font-semibold">portfolio-ready</span> benchmark software.
          </h1>
          <p className="mx-auto mt-6 max-w-3xl text-lg leading-8 text-[var(--muted)]">
            WorldModel Gym brings tasks, traces, uploads, and public leaderboard presentation into one editorial,
            enterprise-grade surface that feels closer to a product launch than a lab prototype.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/leaderboard"
              className="button-primary px-8 py-4 text-sm font-semibold"
            >
              Start Exploring
            </Link>
            <Link
              href="/tasks"
              className="button-secondary px-8 py-4 text-sm font-semibold"
            >
              Explore Tasks
            </Link>
          </div>
          <p className="mt-6 text-sm font-medium text-[var(--muted)]">
            Built for benchmark creators, planning labs, and research teams shipping live demos.
          </p>
        </div>

        <div className="site-panel paper-matrix mx-auto mt-12 max-w-5xl rounded-[34px] p-5 md:p-8">
          <div className="grid gap-6 lg:grid-cols-[1.25fr_0.75fr]">
            <div className="rounded-[28px] border border-[var(--line)] bg-[var(--paper-strong)] p-5">
              <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
                <span className="h-3 w-3 rounded-full bg-[#d7c9b7]" />
                <span className="h-3 w-3 rounded-full bg-[#e6dac8]" />
                <span className="h-3 w-3 rounded-full bg-[#f0e8dc]" />
                Describe your benchmark
              </div>
              <div className="mt-5 rounded-[22px] border border-[var(--line)] bg-white px-5 py-4 text-sm text-[#a39a90]">
                Create a memory-limited maze benchmark for model-based planners with sparse delayed reward...
              </div>
              <div className="mt-5 grid gap-3 md:grid-cols-3">
                {signalCards.map((card) => (
                  <div key={card.title} className="site-soft-panel rounded-[20px] p-4">
                    <p className="text-sm font-semibold text-[var(--ink)]">{card.title}</p>
                    <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{card.detail}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="site-dark-panel dot-matrix rounded-[28px] p-6">
              <p className="section-kicker !text-[#b7b0a8] before:!bg-[#5a544c]">Research workflow</p>
              <h2 className="mt-5 text-3xl font-semibold leading-tight text-[#f8f2ea]">
                From task framing to leaderboard proof in one loop.
              </h2>
              <div className="mt-6 space-y-3">
                {agenticFlow.map((step, index) => (
                  <div key={step} className="rounded-[18px] border border-white/10 bg-white/5 px-4 py-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#b7b0a8]">Step {index + 1}</p>
                    <p className="mt-2 text-sm leading-6 text-[#f4eee7]">{step}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-t border-[var(--line)] py-10">
        <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <p className="section-kicker">What worldmodel gym does</p>
            <h2 className="mt-5 max-w-3xl text-5xl font-semibold leading-[1.06] tracking-[-0.05em] text-[var(--ink)]">
              Go from design idea to public{" "}
              <span className="text-[rgba(22,20,18,0.72)]">benchmark narrative</span>
            </h2>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-[var(--muted)]">
              WorldModel Gym replaces fragmented benchmark demos, ad hoc notebooks, and brittle upload flows with one
              seamless agentic research surface.
            </p>

            <div className="site-panel mt-10 overflow-hidden rounded-[30px]">
              <div className="grid lg:grid-cols-[1fr_0.75fr]">
                <div className="paper-matrix border-b border-[var(--line)] bg-[var(--paper)] p-6 lg:border-b-0 lg:border-r">
                  <div className="rounded-[28px] border border-[var(--line)] bg-[linear-gradient(180deg,#fbf7f1,#efe5d7)] p-6">
                    <div className="rounded-[22px] border border-black/10 bg-white/75 p-5 shadow-[0_18px_44px_rgba(34,24,12,0.09)]">
                      <div className="mx-auto h-40 w-full max-w-[360px] rounded-[18px] bg-[radial-gradient(circle_at_top,rgba(73,68,61,0.12),transparent_35%),linear-gradient(180deg,#fdf8f0,#e8ddd0)]" />
                      <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        <div className="rounded-[16px] border border-[var(--line)] bg-[var(--paper)] p-3 text-sm text-[var(--muted)]">
                          Multi-view run artifacts
                        </div>
                        <div className="rounded-[16px] border border-[var(--line)] bg-[var(--paper)] p-3 text-sm text-[var(--muted)]">
                          Reproducible track metadata
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="divide-y divide-[var(--line)] bg-[var(--paper-strong)]">
                  {[
                    "Design products and collections with prompts",
                    "Generate multi-view visuals and tech-pack style benchmark summaries",
                    "Auto-capture metrics, defaults, and run-level evidence",
                    "Present the whole story cleanly to collaborators and recruiters"
                  ].map((item) => (
                    <div key={item} className="px-6 py-5 text-lg font-medium text-[var(--ink)]">
                      {item}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            {reasons.map((reason) => (
              <div key={reason} className="flex items-start gap-3 border-b border-[var(--line)] pb-4 text-lg text-[var(--ink)]">
                <span className="mt-1 text-sm text-[var(--muted)]">◎</span>
                <span>{reason}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-b border-t border-[var(--line)] py-10">
        <div>
          <h2 className="max-w-4xl text-5xl font-semibold leading-[1.08] tracking-[-0.05em] text-[var(--ink)]">
            Benchmark agents in the speed of modern product design.
          </h2>

          <div className="mt-8 grid grid-cols-2 md:grid-cols-4">
            {benchmarkTabs.map((tab, index) => (
              <div key={tab} className={`eyebrow-tab ${index === 0 ? "is-active" : ""}`}>
                {tab}
              </div>
            ))}
          </div>

          <div className="site-panel paper-matrix rounded-b-[34px] rounded-t-none p-6 md:p-10">
            <div className="rounded-[28px] border border-[var(--line)] bg-[var(--paper-strong)] p-6 md:p-10">
              <h3 className="text-center text-4xl font-semibold tracking-[-0.04em] text-[var(--ink)]">
                From idea to multi-view benchmark concept
              </h3>
              <div className="mx-auto mt-8 max-w-3xl rounded-[28px] border border-[var(--line)] bg-white p-5 shadow-[0_24px_60px_rgba(38,28,16,0.08)]">
                <div className="h-[280px] rounded-[20px] border border-[var(--line)] bg-[linear-gradient(180deg,rgba(250,248,244,0.96),rgba(244,236,226,0.98))]">
                  <div className="grid h-full grid-cols-[0.85fr_1.15fr_0.75fr] gap-4 p-5">
                    <div className="rounded-[18px] border border-[var(--line)] bg-[var(--paper)] p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">Prompt</p>
                      <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
                        Define a partially observable task with delayed reward and explicit planning budget.
                      </p>
                    </div>
                    <div className="rounded-[18px] border border-[var(--line)] bg-[radial-gradient(circle_at_top,rgba(190,170,145,0.18),transparent_32%),#fffdfa] p-4">
                      <div className="grid h-full grid-cols-2 gap-3">
                        <div className="rounded-[16px] border border-[var(--line)] bg-[var(--sand)]" />
                        <div className="rounded-[16px] border border-[var(--line)] bg-[var(--paper)]" />
                        <div className="rounded-[16px] border border-[var(--line)] bg-[var(--paper)]" />
                        <div className="rounded-[16px] border border-[var(--line)] bg-[var(--sand)]" />
                      </div>
                    </div>
                    <div className="rounded-[18px] border border-[var(--line)] bg-[var(--paper)] p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">Review</p>
                      <div className="mt-3 space-y-3">
                        <div className="h-14 rounded-[14px] border border-[var(--line)] bg-[var(--sand)]" />
                        <div className="h-20 rounded-[14px] border border-[var(--line)] bg-[var(--paper-strong)]" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-6 grid gap-3 md:grid-cols-5">
                {benchmarkSteps.map((step) => (
                  <div key={step} className="site-soft-panel rounded-[18px] px-4 py-5 text-sm font-medium leading-6 text-[var(--ink)]">
                    {step}
                  </div>
                ))}
              </div>

              <p className="mt-6 text-center text-3xl font-semibold tracking-[-0.04em] text-[var(--ink)]">
                Your benchmark becomes a public product surface instantly.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="site-dark-panel dot-matrix rounded-[34px] px-7 py-8 md:px-10 md:py-10">
        <p className="section-kicker !text-[#b7b0a8] before:!bg-[#4f4a43]">Factory-ready files in minutes</p>
        <h2 className="mt-5 max-w-5xl text-5xl font-semibold leading-[1.06] tracking-[-0.05em] text-[#f8f2ea]">
          Everything a planning team needs to get to work, instantly generated.
        </h2>
        <p className="mt-4 max-w-3xl text-lg leading-8 text-[#c8bfb4]">
          Every benchmark can turn into a full product-grade package: public metrics, trace inspection, seeded task
          metadata, and deployable web surfaces.
        </p>

        <div className="mt-8 grid gap-px overflow-hidden rounded-[24px] border border-white/10 bg-[#2b2926] md:grid-cols-3">
          {manufacturerGrid.map((item) => (
            <div key={item} className="bg-[#35322e] px-6 py-6 text-center text-lg font-semibold text-[#f8f2ea]">
              {item}
            </div>
          ))}
        </div>

        <div className="mt-10 rounded-[30px] border border-white/10 bg-[#11110f] p-6 md:p-10">
          <h3 className="text-center text-4xl font-semibold tracking-[-0.04em] text-[#f8f2ea]">
            Say goodbye to scattered PDFs, notebooks, and ad hoc screenshots
          </h3>
          <div className="mx-auto mt-8 max-w-3xl rounded-[26px] border border-[#3a352f] bg-[#f4eee7] p-4 text-[var(--ink)] shadow-[0_24px_70px_rgba(0,0,0,0.24)]">
            <div className="flex items-center justify-between gap-4 rounded-[20px] bg-white px-4 py-3 text-sm text-[var(--muted)]">
              <span>Let AI describe and structure your benchmark flow</span>
              <span className="rounded-full bg-[var(--sand)] px-4 py-2 font-semibold text-[var(--ink)]">AI-guided upload</span>
            </div>
            <div className="mt-4 flex items-center gap-3 rounded-[20px] border border-[var(--line)] bg-white px-4 py-4">
              <div className="flex-1 text-sm text-[#9a9287]">
                Compare planning cost and success rate across benchmark tracks with reproducible seeds...
              </div>
              <div className="button-secondary whitespace-nowrap px-4 py-3 text-sm font-semibold">Ask now</div>
            </div>
            <p className="mt-4 text-center text-sm text-[var(--muted)]">
              Replace brittle demo prep with one polished benchmark narrative.
            </p>
          </div>
        </div>
      </section>

      <section className="border-b border-t border-[var(--line)] py-10">
        <div className="grid gap-8 xl:grid-cols-[0.9fr_1.1fr]">
          <div>
            <h2 className="max-w-3xl text-5xl font-semibold leading-[1.08] tracking-[-0.05em] text-[var(--ink)]">
              Why individuals & teams alike choose <span className="brand-accent">WorldModel Gym</span>
            </h2>
            <div className="mt-8 divide-y divide-[var(--line)] border-y border-[var(--line)]">
              {reasons.map((reason) => (
                <div key={reason} className="flex items-start gap-4 py-6 text-xl text-[var(--ink)]">
                  <span className="text-sm text-[var(--muted)]">◌</span>
                  <span>{reason}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="site-panel rounded-[34px] p-5">
            <div className="h-full rounded-[28px] border border-[var(--line)] bg-[linear-gradient(135deg,#eadbc7,#f9f4ec_45%,#efe3d5)] p-5">
              <div className="h-full min-h-[420px] rounded-[24px] border border-white/60 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.55),transparent_22%),linear-gradient(180deg,rgba(255,255,255,0.22),rgba(255,255,255,0.05))] p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.6)]">
                <div className="grid h-full gap-4 md:grid-cols-[0.9fr_1.1fr]">
                  <div className="rounded-[22px] border border-white/60 bg-[rgba(255,255,255,0.64)] p-5">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                      Research deck
                    </p>
                    <div className="mt-4 space-y-3">
                      <div className="h-20 rounded-[18px] bg-[rgba(255,255,255,0.72)]" />
                      <div className="h-28 rounded-[18px] bg-[rgba(255,255,255,0.52)]" />
                      <div className="h-16 rounded-[18px] bg-[rgba(255,255,255,0.72)]" />
                    </div>
                  </div>
                  <div className="rounded-[22px] border border-white/60 bg-[rgba(255,255,255,0.3)] p-4">
                    <div className="h-full rounded-[18px] border border-[rgba(255,255,255,0.55)] bg-[linear-gradient(180deg,rgba(255,255,255,0.74),rgba(247,240,231,0.55))]" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="site-panel grid overflow-hidden rounded-[34px] lg:grid-cols-[1.05fr_0.95fr]">
        <div className="border-b border-[var(--line)] bg-[linear-gradient(180deg,#d8c4aa,#cdb497)] p-6 text-white lg:border-b-0 lg:border-r lg:p-8">
          <div className="flex h-full flex-col justify-between rounded-[28px] border border-white/25 bg-[linear-gradient(180deg,rgba(255,255,255,0.12),rgba(0,0,0,0.08))] p-6">
            <div>
              <p className="section-kicker !text-[#f8f2ea] before:!bg-white/60">Turn ideas into reality</p>
              <h2 className="mt-6 text-4xl font-semibold tracking-[-0.04em]">
                Join the labs building benchmark surfaces that actually look shipped.
              </h2>
            </div>
            <p className="max-w-md text-lg leading-8 text-[#f6efe7]">
              WorldModel Gym packages tasks, traces, uploads, and rankings into a single UI language that feels as
              intentional as the work behind it.
            </p>
          </div>
        </div>

        <div className="bg-[var(--paper-strong)] p-6 lg:p-8">
          <div className="mx-auto max-w-xl rounded-[28px] border border-[var(--line)] bg-white p-6 shadow-[0_24px_60px_rgba(36,28,18,0.08)]">
            <div className="grid grid-cols-2 gap-2 rounded-[16px] bg-[var(--sand)] p-1.5 text-sm font-semibold">
              <div className="rounded-[12px] bg-white px-4 py-3 text-center text-[var(--ink)]">Login</div>
              <div className="rounded-[12px] px-4 py-3 text-center text-[var(--muted)]">Sign Up</div>
            </div>
            <h3 className="mt-6 text-center text-4xl font-semibold tracking-[-0.04em] text-[var(--ink)]">
              Start Your Journey
            </h3>
            <p className="mt-3 text-center text-base leading-7 text-[var(--muted)]">
              Join the future of benchmark creation with AI-assisted task design and public evaluation tools.
            </p>
            <div className="mt-6 rounded-[16px] border border-[var(--line)] px-4 py-4 text-center text-sm font-semibold text-[var(--ink)]">
              Continue with GitHub
            </div>
            <div className="mt-6 text-center text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
              or
            </div>
            <div className="mt-6 space-y-4">
              {["Full Name", "Email", "Research Focus", "Team / Lab"].map((label) => (
                <label key={label} className="block text-sm font-semibold text-[var(--ink)]">
                  <span>{label}</span>
                  <div className="mt-2 rounded-[16px] border border-[var(--line)] px-4 py-4 text-[var(--muted)]">
                    Enter your {label.toLowerCase()}
                  </div>
                </label>
              ))}
            </div>
            <div className="button-primary mt-6 w-full px-6 py-4 text-center text-sm font-semibold">
              Request Research Access
            </div>
          </div>
        </div>
      </section>
    </section>
  );
}
