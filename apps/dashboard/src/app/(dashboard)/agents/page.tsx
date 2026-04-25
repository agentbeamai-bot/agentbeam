import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

export default function AgentsPage() {
  return (
    <>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Agents</h1>
        <p className="text-muted-foreground">
          View and manage all registered agents in your project.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Registered Agents</CardTitle>
          <CardDescription>
            Agents are auto-discovered when they send their first trace.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex h-[400px] items-center justify-center text-muted-foreground">
            No agents detected. Install the AgentBeam SDK to register your first
            agent.
          </div>
        </CardContent>
      </Card>
    </>
  );
}
