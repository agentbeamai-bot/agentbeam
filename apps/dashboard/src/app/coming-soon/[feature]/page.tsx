import Link from 'next/link';
import {
  ZapIcon,
  ShieldIcon,
  FlaskConicalIcon,
  RocketIcon,
  UsersIcon,
  PenToolIcon,
  ScaleIcon,
  ArrowLeftIcon,
} from 'lucide-react';
import { notFound } from 'next/navigation';

// ---------------------------------------------------------------------------
// Feature data
// ---------------------------------------------------------------------------

const FEATURES: Record<
  string,
  {
    name: string;
    description: string;
    icon: typeof ShieldIcon;
  }
> = {
  'security-vault': {
    name: 'Agent Security Vault',
    description:
      'Agent identity management, least-privilege access control, input/output guardrails, full audit trails, and compliance templates for EU AI Act, SOC 2, and HIPAA.',
    icon: ShieldIcon,
  },
  'testing-lab': {
    name: 'Agent Testing Lab',
    description:
      'Regression testing, A/B testing, scenario simulation, production replay testing, and eval-gated deployments for your agent prompts.',
    icon: FlaskConicalIcon,
  },
  'deployment-engine': {
    name: 'Agent Deployment Engine',
    description:
      'One-click deploy, intelligent model routing, automatic failover, auto-scaling, canary deployments, and multi-region support.',
    icon: RocketIcon,
  },
  'collaboration-hub': {
    name: 'Agent Collaboration Hub',
    description:
      'Agent registry, handoff protocols, shared memory, agent-to-agent communication, dependency graphs, and visual workflow builder.',
    icon: UsersIcon,
  },
  'prompt-studio': {
    name: 'Prompt Engineering Studio',
    description:
      'Prompt version control, playground, templates library, analytics, and collaborative editing with approvals.',
    icon: PenToolIcon,
  },
  'compliance-center': {
    name: 'Compliance & Governance Center',
    description:
      'Risk classification, data lineage, bias detection, incident response playbooks, and regulatory reporting.',
    icon: ScaleIcon,
  },
};

// ---------------------------------------------------------------------------
// Static params for all known features
// ---------------------------------------------------------------------------

export function generateStaticParams() {
  return Object.keys(FEATURES).map((feature) => ({ feature }));
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function ComingSoonPage({
  params,
}: {
  params: Promise<{ feature: string }>;
}) {
  const { feature: slug } = await params;
  const feature = FEATURES[slug];

  if (!feature) {
    notFound();
  }

  const Icon = feature.icon;

  return (
    <div className="min-h-screen bg-[#09090b] text-white">
      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b border-white/[0.06] bg-[#09090b]/80 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
          <Link
            href="/"
            className="flex items-center gap-2 font-semibold tracking-tight"
          >
            <div className="flex size-7 items-center justify-center rounded-md bg-gradient-to-br from-blue-500 to-blue-600">
              <ZapIcon className="size-4 text-white" />
            </div>
            AgentBeam
          </Link>
          <div className="flex items-center gap-3">
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

      {/* Content */}
      <section className="relative overflow-hidden">
        {/* Background glows */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-1/2 top-0 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/3 rounded-full bg-blue-500/10 blur-[150px]" />
          <div className="absolute bottom-0 right-0 h-[400px] w-[400px] translate-x-1/4 translate-y-1/4 rounded-full bg-purple-500/8 blur-[120px]" />
        </div>

        <div className="relative mx-auto flex max-w-2xl flex-col items-center gap-8 px-4 py-24 text-center md:py-32">
          {/* Back link */}
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm text-zinc-500 transition-colors hover:text-zinc-300"
          >
            <ArrowLeftIcon className="size-3.5" />
            Back to Dashboard
          </Link>

          {/* Glass card */}
          <div className="w-full rounded-2xl border border-white/[0.08] bg-white/[0.03] p-8 backdrop-blur-xl md:p-12">
            {/* Icon */}
            <div className="mx-auto mb-6 flex size-16 items-center justify-center rounded-2xl bg-blue-500/10 ring-1 ring-blue-500/20">
              <Icon className="size-8 text-blue-400" />
            </div>

            {/* Badge */}
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-4 py-1.5 text-sm text-zinc-400">
              <span className="inline-block size-1.5 rounded-full bg-amber-400" />
              Coming Soon
            </div>

            {/* Heading */}
            <h1 className="mb-4 text-3xl font-bold tracking-tight sm:text-4xl">
              {feature.name}
            </h1>

            {/* Description */}
            <p className="mx-auto mb-10 max-w-lg text-lg leading-relaxed text-zinc-400">
              {feature.description}
            </p>

            {/* Email capture form */}
            <form
              className="mx-auto flex w-full max-w-md flex-col gap-3 sm:flex-row"
              onSubmit={undefined}
            >
              <input
                type="email"
                name="email"
                placeholder="you@company.com"
                required
                className="flex-1 rounded-lg border border-white/[0.1] bg-white/[0.04] px-4 py-3 text-sm text-white placeholder-zinc-500 outline-none transition-colors focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30"
              />
              <button
                type="submit"
                className="rounded-lg bg-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-500/25 transition-all hover:bg-blue-500 hover:shadow-blue-500/40"
              >
                Join Waitlist
              </button>
            </form>

            <p className="mt-4 text-xs text-zinc-600">
              We&apos;ll notify you when this feature launches. No spam.
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
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
