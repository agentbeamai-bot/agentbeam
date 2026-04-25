import Link from 'next/link';
import {
  ZapIcon,
  BookOpenIcon,
  DownloadIcon,
  KeyIcon,
  PlayIcon,
  WrenchIcon,
  DatabaseIcon,
  CpuIcon,
  ArrowLeftIcon,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

const sidebarLinks = [
  { id: 'quickstart', label: 'Quickstart' },
  { id: 'installation', label: 'Installation' },
  { id: 'api-key', label: 'Get Your API Key' },
  { id: 'initialize', label: 'Initialize' },
  { id: 'manual-tracing', label: 'Manual Tracing' },
  { id: 'what-gets-captured', label: 'What Gets Captured' },
  { id: 'supported-providers', label: 'Supported Providers' },
];

const capturedData = [
  { field: 'Model name & provider', example: 'claude-3-opus / anthropic' },
  { field: 'Input / output token counts', example: '1,204 in / 387 out' },
  { field: 'Cost (calculated automatically)', example: '$0.0234' },
  { field: 'Latency & time-to-first-token', example: '1.2s / 320ms' },
  { field: 'Tool / function calls', example: 'get_weather, search_db' },
  { field: 'Error messages & stack traces', example: 'RateLimitError at line 42' },
  { field: 'Custom metadata', example: 'user_id, session_id, tags' },
];

const providers = [
  { name: 'Anthropic (Claude)', status: 'Auto-instrumented', available: true },
  { name: 'OpenAI (GPT)', status: 'Auto-instrumented', available: true },
  { name: 'LangChain', status: 'Coming soon', available: false },
  { name: 'Any LLM', status: 'Via manual tracing', available: true },
];

// ---------------------------------------------------------------------------
// Reusable components
// ---------------------------------------------------------------------------

function CodeBlock({
  language,
  children,
}: {
  language: string;
  children: string;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-white/[0.06] bg-[#0c0c0e]">
      <div className="flex items-center gap-2 border-b border-white/[0.06] px-4 py-2">
        <span className="text-xs font-medium text-zinc-500">{language}</span>
      </div>
      <pre className="overflow-x-auto p-4 font-mono text-sm leading-relaxed text-zinc-300">
        <code>{children}</code>
      </pre>
    </div>
  );
}

function SectionHeading({
  id,
  icon: Icon,
  children,
}: {
  id: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <div id={id} className="scroll-mt-24">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex size-9 items-center justify-center rounded-lg bg-blue-500/10">
          <Icon className="size-5 text-blue-400" />
        </div>
        <h2 className="text-2xl font-bold tracking-tight">{children}</h2>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function DocsPage() {
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
              href="/docs"
              className="rounded-md px-3 py-1.5 text-sm font-medium text-white"
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

      <div className="mx-auto flex max-w-6xl gap-8 px-4 py-12">
        {/* Sidebar */}
        <aside className="hidden w-56 shrink-0 lg:block">
          <div className="sticky top-24">
            <Link
              href="/"
              className="mb-6 flex items-center gap-1.5 text-sm text-zinc-500 transition-colors hover:text-white"
            >
              <ArrowLeftIcon className="size-3.5" />
              Back to home
            </Link>
            <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-zinc-500">
              On this page
            </p>
            <nav className="flex flex-col gap-1">
              {sidebarLinks.map((link) => (
                <a
                  key={link.id}
                  href={`#${link.id}`}
                  className="rounded-md px-3 py-1.5 text-sm text-zinc-400 transition-colors hover:bg-white/[0.04] hover:text-white"
                >
                  {link.label}
                </a>
              ))}
            </nav>
          </div>
        </aside>

        {/* Main content */}
        <main className="min-w-0 flex-1">
          {/* --------------------------------------------------------- */}
          {/* Quickstart */}
          {/* --------------------------------------------------------- */}
          <section className="mb-16">
            <SectionHeading id="quickstart" icon={BookOpenIcon}>
              Quickstart
            </SectionHeading>
            <p className="text-lg text-zinc-400">
              Start monitoring your AI agents in 60 seconds.
            </p>
          </section>

          {/* --------------------------------------------------------- */}
          {/* Installation */}
          {/* --------------------------------------------------------- */}
          <section className="mb-16">
            <SectionHeading id="installation" icon={DownloadIcon}>
              Installation
            </SectionHeading>
            <p className="mb-6 text-sm text-zinc-400">
              Install the SDK for your language of choice.
            </p>

            <div className="flex flex-col gap-4">
              <div>
                <p className="mb-2 text-sm font-medium text-zinc-300">
                  Python
                </p>
                <CodeBlock language="bash">{`pip install agentbeam`}</CodeBlock>
              </div>

              <div>
                <p className="mb-2 text-sm font-medium text-zinc-300">
                  TypeScript / Node.js
                </p>
                <CodeBlock language="bash">{`npm install git+https://github.com/agentbeamai-bot/agentbeam.git#packages/sdk-node`}</CodeBlock>
              </div>
            </div>
          </section>

          {/* --------------------------------------------------------- */}
          {/* Get Your API Key */}
          {/* --------------------------------------------------------- */}
          <section className="mb-16">
            <SectionHeading id="api-key" icon={KeyIcon}>
              Get Your API Key
            </SectionHeading>

            <ol className="flex flex-col gap-3 text-sm text-zinc-300">
              <li className="flex items-start gap-3">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full border border-blue-500/30 bg-blue-500/10 text-xs font-bold text-blue-400">
                  1
                </span>
                <span>
                  Sign up at{' '}
                  <a
                    href="https://agentbeam.agentbeamai.workers.dev/signup"
                    className="text-blue-400 underline underline-offset-2 hover:text-blue-300"
                  >
                    agentbeam.agentbeamai.workers.dev/signup
                  </a>
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full border border-blue-500/30 bg-blue-500/10 text-xs font-bold text-blue-400">
                  2
                </span>
                <span>
                  Go to <strong className="text-white">Settings</strong> and
                  click <strong className="text-white">Generate New Key</strong>
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full border border-blue-500/30 bg-blue-500/10 text-xs font-bold text-blue-400">
                  3
                </span>
                <span>
                  Copy the key immediately -- you will not be able to see it
                  again
                </span>
              </li>
            </ol>
          </section>

          {/* --------------------------------------------------------- */}
          {/* Initialize */}
          {/* --------------------------------------------------------- */}
          <section className="mb-16">
            <SectionHeading id="initialize" icon={PlayIcon}>
              Initialize
            </SectionHeading>
            <p className="mb-6 text-sm text-zinc-400">
              Add a few lines of code to start tracing every LLM call
              automatically.
            </p>

            <div className="flex flex-col gap-4">
              <div>
                <p className="mb-2 text-sm font-medium text-zinc-300">
                  Python
                </p>
                <CodeBlock language="python">{`import agentbeam

agentbeam.init(
    api_key="ab_your_key_here",
    api_url="https://agentbeam.agentbeamai.workers.dev/api/v1",
    agent_name="my-agent",
)

# That's it! All Anthropic and OpenAI calls are now auto-traced.`}</CodeBlock>
              </div>

              <div>
                <p className="mb-2 text-sm font-medium text-zinc-300">
                  TypeScript
                </p>
                <CodeBlock language="typescript">{`import { AgentBeam } from 'agentbeam';

const ab = new AgentBeam({
  apiKey: 'ab_your_key_here',
  apiUrl: 'https://agentbeam.agentbeamai.workers.dev/api/v1',
  agentName: 'my-agent',
});

const anthropic = ab.wrap(new Anthropic());
// All calls through this client are now traced`}</CodeBlock>
              </div>
            </div>
          </section>

          {/* --------------------------------------------------------- */}
          {/* Manual Tracing */}
          {/* --------------------------------------------------------- */}
          <section className="mb-16">
            <SectionHeading id="manual-tracing" icon={WrenchIcon}>
              Manual Tracing (Optional)
            </SectionHeading>
            <p className="mb-6 text-sm text-zinc-400">
              Use decorators or context managers to trace custom logic beyond
              auto-instrumented LLM calls.
            </p>

            <div>
              <p className="mb-2 text-sm font-medium text-zinc-300">Python</p>
              <CodeBlock language="python">{`from agentbeam.trace import trace, span

@trace(name="process_order", kind="agent")
def process_order(order_id):
    # Your logic here
    return result

# Or use context manager
with span("lookup_user", kind="tool"):
    user = db.get_user(user_id)`}</CodeBlock>
            </div>
          </section>

          {/* --------------------------------------------------------- */}
          {/* What Gets Captured */}
          {/* --------------------------------------------------------- */}
          <section className="mb-16">
            <SectionHeading id="what-gets-captured" icon={DatabaseIcon}>
              What Gets Captured
            </SectionHeading>
            <p className="mb-6 text-sm text-zinc-400">
              Every traced call automatically records the following data.
            </p>

            <div className="overflow-hidden rounded-lg border border-white/[0.06]">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/[0.06] bg-white/[0.03]">
                    <th className="px-4 py-3 text-left font-semibold text-zinc-300">
                      Data
                    </th>
                    <th className="px-4 py-3 text-left font-semibold text-zinc-300">
                      Example
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {capturedData.map((row, i) => (
                    <tr
                      key={row.field}
                      className={
                        i < capturedData.length - 1
                          ? 'border-b border-white/[0.04]'
                          : ''
                      }
                    >
                      <td className="px-4 py-3 text-zinc-300">{row.field}</td>
                      <td className="px-4 py-3 font-mono text-xs text-zinc-500">
                        {row.example}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* --------------------------------------------------------- */}
          {/* Supported Providers */}
          {/* --------------------------------------------------------- */}
          <section className="mb-16">
            <SectionHeading id="supported-providers" icon={CpuIcon}>
              Supported Providers
            </SectionHeading>

            <div className="grid gap-3 sm:grid-cols-2">
              {providers.map((p) => (
                <div
                  key={p.name}
                  className="flex items-center justify-between rounded-lg border border-white/[0.06] bg-white/[0.03] px-4 py-3"
                >
                  <span className="text-sm font-medium text-zinc-200">
                    {p.name}
                  </span>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      p.available
                        ? 'bg-emerald-500/10 text-emerald-400'
                        : 'bg-zinc-800 text-zinc-500'
                    }`}
                  >
                    {p.status}
                  </span>
                </div>
              ))}
            </div>
          </section>

          {/* --------------------------------------------------------- */}
          {/* Next Steps CTA */}
          {/* --------------------------------------------------------- */}
          <section className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-8 text-center">
            <h3 className="mb-2 text-lg font-semibold">Ready to go?</h3>
            <p className="mb-6 text-sm text-zinc-400">
              Create a free account, grab your API key, and start tracing.
            </p>
            <Link
              href="/signup"
              className="inline-block rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-500/25 transition-all hover:bg-blue-500 hover:shadow-blue-500/40"
            >
              Get Started Free
            </Link>
          </section>
        </main>
      </div>

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
