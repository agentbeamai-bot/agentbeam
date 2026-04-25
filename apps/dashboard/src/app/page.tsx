import { redirect } from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ZapIcon } from 'lucide-react';

export default async function Home() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect('/overview');
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 bg-background px-4">
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="flex size-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
          <ZapIcon className="size-7" />
        </div>
        <h1 className="text-4xl font-bold tracking-tight">AgentBeam</h1>
        <p className="max-w-md text-lg text-muted-foreground">
          Observability for AI agents. Monitor traces, track costs, and debug
          issues across every LLM call your agents make.
        </p>
      </div>
      <div className="flex gap-3">
        <Button size="lg" render={<Link href="/login" />}>
          Sign In
        </Button>
        <Button variant="outline" size="lg" render={<Link href="/signup" />}>
          Create Account
        </Button>
      </div>
    </div>
  );
}
