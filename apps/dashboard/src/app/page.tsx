import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ZapIcon } from 'lucide-react';

export default function Home() {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center gap-8 overflow-hidden bg-background px-4">
      {/* Background glow effects */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-0 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-500/10 blur-[120px]" />
        <div className="absolute bottom-0 right-0 h-[400px] w-[400px] translate-x-1/4 translate-y-1/4 rounded-full bg-purple-500/10 blur-[120px]" />
      </div>

      <div className="relative flex flex-col items-center gap-6 text-center">
        <div className="flex size-16 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-xl shadow-blue-500/25">
          <ZapIcon className="size-8" />
        </div>
        <h1 className="text-5xl font-bold tracking-tight text-foreground">
          AgentBeam
        </h1>
        <p className="max-w-lg text-lg leading-relaxed text-muted-foreground">
          The observability platform for AI agents. Monitor traces, track costs,
          and debug issues across every LLM call in real time.
        </p>
      </div>

      <div className="relative flex gap-3">
        <Button size="lg" render={<Link href="/login" />} className="bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 border-0">
          Sign In
        </Button>
        <Button variant="outline" size="lg" render={<Link href="/signup" />} className="border-white/10 bg-white/5 backdrop-blur-sm hover:bg-white/10">
          Create Account
        </Button>
      </div>
    </div>
  );
}
