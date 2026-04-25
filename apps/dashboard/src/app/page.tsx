import Link from 'next/link';
import {
  ZapIcon,
  ActivityIcon,
  DollarSignIcon,
  CodeIcon,
  LayoutGridIcon,
  ShieldIcon,
  FlaskConicalIcon,
  TerminalIcon,
  EyeIcon,
  CheckIcon,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Feature data
// ---------------------------------------------------------------------------
const features = [
  {
    icon: ActivityIcon,
    title: 'Real-Time Traces',
    description:
      'See every LLM call, tool use, and agent decision as it happens. Full waterfall view of multi-step agent workflows.',
  },
  {
    icon: DollarSignIcon,
    title: 'Cost Analytics',
    description:
      'Know exactly what every agent costs. Per-model, per-agent cost attribution with budget alerts and optimization tips.',
  },
  {
    icon: CodeIcon,
    title: 'Auto-Instrumentation',
    description:
      'Add 3 lines of code. Our SDK auto-captures Anthropic, OpenAI, and LangChain calls with zero config.',
  },
  {
    icon: LayoutGridIcon,
    title: 'Agent Registry',
    description:
      'Agents self-register on first trace. See all your agents, their status, error rates, and performance at a glance.',
  },
  {
    icon: ShieldIcon,
    title: 'Security Vault',
    description:
      'Agent identity management, least-privilege access control, and full audit trails.',
    comingSoon: true,
    href: '/coming-soon/security-vault',
  },
  {
    icon: FlaskConicalIcon,
    title: 'Testing Lab',
    description:
      'Regression testing, A/B testing, and eval-gated deployments for your agent prompts.',
    comingSoon: true,
    href: '/coming-soon/testing-lab',
  },
];

const steps = [
  {
    icon: TerminalIcon,
    step: '1',
    title: 'Install the SDK',
    description: null,
    code: `pip install agentbeam\n# or: npm install agentbeam`,
  },
  {
    icon: ZapIcon,
    step: '2',
    title: 'Set your API key and run',
    description: null,
    code: `# Python\nAGENTBEAM_API_KEY=ab_... python -m agentbeam your_script.py\n\n# Node.js\nAGENTBEAM_API_KEY=ab_... node --require agentbeam/auto app.js`,
  },
  {
    icon: EyeIcon,
    step: '3',
    title: 'See everything',
    description:
      'Real-time dashboard shows traces, costs, and agent health.',
    code: null,
  },
];

const plans = [
  {
    name: 'Free',
    price: '$0',
    period: '/mo',
    features: ['50K traces', '3 agents', '7-day retention', 'Community support'],
    cta: 'Get Started Free',
    href: '/signup',
    highlighted: false,
  },
  {
    name: 'Pro',
    price: '$79',
    period: '/mo',
    features: [
      '1M traces',
      'Unlimited agents',
      '90-day retention',
      'Alerts & notifications',
      'Priority support',
    ],
    cta: 'Start Pro Trial',
    href: '/signup',
    highlighted: true,
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    period: '',
    features: [
      'Unlimited traces',
      'Unlimited agents',
      'Unlimited retention',
      'SSO & SAML',
      'SLA & compliance',
      'Dedicated support',
    ],
    cta: 'Contact Sales',
    href: 'mailto:sales@agentbeam.ai',
    highlighted: false,
  },
];

const trustedBy = [
  'Acme AI',
  'NeuralOps',
  'StackAgent',
  'Cortex Labs',
  'SynthCo',
  'AgentForge',
];

// ---------------------------------------------------------------------------
// Page (static — no 'use client', no hooks, no Supabase)
// ---------------------------------------------------------------------------
export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#09090b] text-white">
      {/* ----------------------------------------------------------------- */}
      {/* Nav */}
      {/* ----------------------------------------------------------------- */}
      <nav className="sticky top-0 z-50 border-b border-white/[0.06] bg-[#09090b]/80 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
            <div className="flex size-7 items-center justify-center rounded-md bg-gradient-to-br from-blue-500 to-blue-600">
              <ZapIcon className="size-4 text-white" />
            </div>
            AgentBeam
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href="/docs"
              className="rounded-md px-3 py-1.5 text-sm text-zinc-400 transition-colors hover:text-white"
            >
              Docs
            </Link>
            <Link
              href="/login"
              className="rounded-md px-3 py-1.5 text-sm text-zinc-400 transition-colors hover:text-white"
            >
              Sign In
            </Link>
            <Link
              href="/signup"
              className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-500"
            >
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      {/* ----------------------------------------------------------------- */}
      {/* Hero */}
      {/* ----------------------------------------------------------------- */}
      <section className="relative overflow-hidden">
        {/* Background glows */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-1/2 top-0 h-[700px] w-[700px] -translate-x-1/2 -translate-y-1/3 rounded-full bg-blue-500/15 blur-[150px]" />
          <div className="absolute bottom-0 right-0 h-[500px] w-[500px] translate-x-1/4 translate-y-1/4 rounded-full bg-purple-500/10 blur-[150px]" />
          <div className="absolute left-0 top-1/2 h-[400px] w-[400px] -translate-x-1/3 -translate-y-1/2 rounded-full bg-blue-600/8 blur-[120px]" />
        </div>

        <div className="relative mx-auto flex max-w-4xl flex-col items-center gap-8 px-4 pb-24 pt-24 text-center md:pt-32">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-4 py-1.5 text-sm text-zinc-400">
            <span className="inline-block size-1.5 rounded-full bg-emerald-400" />
            Now in public beta
          </div>

          <h1 className="text-4xl font-bold leading-tight tracking-tight sm:text-5xl md:text-6xl lg:text-7xl">
            The observability platform{' '}
            <span className="bg-gradient-to-r from-blue-400 to-blue-600 bg-clip-text text-transparent">
              for AI agents
            </span>
          </h1>

          <p className="max-w-2xl text-lg leading-relaxed text-zinc-400 md:text-xl">
            Monitor traces, track costs, and debug issues across every LLM call
            your agents make.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/signup"
              className="rounded-lg bg-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-500/25 transition-all hover:bg-blue-500 hover:shadow-blue-500/40"
            >
              Get Started Free
            </Link>
            <Link
              href="/login"
              className="rounded-lg border border-white/[0.1] bg-white/[0.03] px-6 py-3 text-sm font-semibold text-zinc-300 backdrop-blur-sm transition-all hover:bg-white/[0.06] hover:text-white"
            >
              View Demo
            </Link>
          </div>
        </div>
      </section>

      {/* ----------------------------------------------------------------- */}
      {/* Trusted By */}
      {/* ----------------------------------------------------------------- */}
      <section className="border-y border-white/[0.06] bg-white/[0.01]">
        <div className="mx-auto max-w-6xl px-4 py-12 text-center">
          <p className="mb-8 text-sm font-medium uppercase tracking-widest text-zinc-500">
            Built for teams shipping AI agents
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-12 gap-y-4">
            {trustedBy.map((name) => (
              <span
                key={name}
                className="text-lg font-semibold tracking-tight text-zinc-600"
              >
                {name}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ----------------------------------------------------------------- */}
      {/* Features */}
      {/* ----------------------------------------------------------------- */}
      <section className="mx-auto max-w-6xl px-4 py-24">
        <div className="mb-16 text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Everything you need to ship agents with confidence
          </h2>
          <p className="mt-4 text-lg text-zinc-400">
            From first trace to production monitoring — one platform.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => {
            const Icon = f.icon;
            const card = (
              <div
                className="group relative rounded-xl border border-white/[0.06] bg-white/[0.03] p-6 backdrop-blur-xl transition-colors hover:border-white/[0.1] hover:bg-white/[0.05]"
              >
                <div className="mb-4 flex size-10 items-center justify-center rounded-lg bg-blue-500/10">
                  <Icon className="size-5 text-blue-400" />
                </div>
                <h3 className="mb-2 flex items-center gap-2 text-lg font-semibold">
                  {f.title}
                  {f.comingSoon && (
                    <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-zinc-400">
                      Coming Soon
                    </span>
                  )}
                </h3>
                <p className="text-sm leading-relaxed text-zinc-400">
                  {f.description}
                </p>
              </div>
            );

            if (f.href) {
              return (
                <Link key={f.title} href={f.href}>
                  {card}
                </Link>
              );
            }

            return <div key={f.title}>{card}</div>;
          })}
        </div>
      </section>

      {/* ----------------------------------------------------------------- */}
      {/* How It Works */}
      {/* ----------------------------------------------------------------- */}
      <section className="border-y border-white/[0.06] bg-white/[0.01]">
        <div className="mx-auto max-w-5xl px-4 py-24">
          <div className="mb-16 text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Up and running in 60 seconds
            </h2>
            <p className="mt-4 text-lg text-zinc-400">
              Three steps. No config files. No infra to manage.
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-3">
            {steps.map((s) => {
              const Icon = s.icon;
              return (
                <div key={s.step} className="flex flex-col gap-4">
                  <div className="flex items-center gap-3">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-full border border-blue-500/30 bg-blue-500/10 text-sm font-bold text-blue-400">
                      {s.step}
                    </div>
                    <h3 className="text-lg font-semibold">{s.title}</h3>
                  </div>

                  {s.code ? (
                    <div className="rounded-lg border border-white/[0.06] bg-[#0c0c0e] p-4 font-mono text-sm leading-relaxed text-zinc-300">
                      <pre className="whitespace-pre-wrap">{s.code}</pre>
                    </div>
                  ) : (
                    <div className="flex flex-1 items-center rounded-lg border border-white/[0.06] bg-white/[0.02] p-4">
                      <div className="flex items-start gap-3">
                        <Icon className="mt-0.5 size-5 shrink-0 text-blue-400" />
                        <p className="text-sm leading-relaxed text-zinc-400">
                          {s.description}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ----------------------------------------------------------------- */}
      {/* Pricing */}
      {/* ----------------------------------------------------------------- */}
      <section className="mx-auto max-w-5xl px-4 py-24">
        <div className="mb-16 text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Simple, transparent pricing
          </h2>
          <p className="mt-4 text-lg text-zinc-400">
            Start free. Scale when you need to.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`relative flex flex-col rounded-xl border p-6 backdrop-blur-xl transition-colors ${
                plan.highlighted
                  ? 'border-blue-500/40 bg-blue-500/[0.05] shadow-lg shadow-blue-500/10'
                  : 'border-white/[0.06] bg-white/[0.03]'
              }`}
            >
              {plan.highlighted && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-blue-600 px-3 py-0.5 text-xs font-semibold">
                  Most Popular
                </div>
              )}

              <div className="mb-6">
                <h3 className="text-lg font-semibold">{plan.name}</h3>
                <div className="mt-2 flex items-baseline gap-1">
                  <span className="text-4xl font-bold">{plan.price}</span>
                  {plan.period && (
                    <span className="text-zinc-500">{plan.period}</span>
                  )}
                </div>
              </div>

              <ul className="mb-8 flex flex-col gap-3">
                {plan.features.map((feat) => (
                  <li
                    key={feat}
                    className="flex items-center gap-2 text-sm text-zinc-300"
                  >
                    <CheckIcon className="size-4 shrink-0 text-blue-400" />
                    {feat}
                  </li>
                ))}
              </ul>

              <div className="mt-auto">
                <Link
                  href={plan.href}
                  className={`block w-full rounded-lg py-2.5 text-center text-sm font-semibold transition-colors ${
                    plan.highlighted
                      ? 'bg-blue-600 text-white hover:bg-blue-500'
                      : 'border border-white/[0.1] bg-white/[0.03] text-zinc-300 hover:bg-white/[0.06]'
                  }`}
                >
                  {plan.cta}
                </Link>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ----------------------------------------------------------------- */}
      {/* CTA Footer */}
      {/* ----------------------------------------------------------------- */}
      <section className="border-t border-white/[0.06]">
        <div className="relative overflow-hidden">
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute left-1/2 top-1/2 h-[400px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-500/10 blur-[120px]" />
          </div>

          <div className="relative mx-auto flex max-w-2xl flex-col items-center gap-6 px-4 py-24 text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Start monitoring your AI agents in 60 seconds
            </h2>
            <p className="text-lg text-zinc-400">
              Free to start. No credit card required.
            </p>
            <Link
              href="/signup"
              className="rounded-lg bg-blue-600 px-8 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-500/25 transition-all hover:bg-blue-500 hover:shadow-blue-500/40"
            >
              Get Started Free
            </Link>
          </div>
        </div>
      </section>

      {/* ----------------------------------------------------------------- */}
      {/* Footer */}
      {/* ----------------------------------------------------------------- */}
      <footer className="border-t border-white/[0.06] bg-white/[0.01]">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-8">
          <div className="flex items-center gap-2 text-sm text-zinc-500">
            <div className="flex size-5 items-center justify-center rounded bg-gradient-to-br from-blue-500 to-blue-600">
              <ZapIcon className="size-3 text-white" />
            </div>
            AgentBeam
          </div>
          <p className="text-sm text-zinc-600">
            &copy; {new Date().getFullYear()} AgentBeam. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
