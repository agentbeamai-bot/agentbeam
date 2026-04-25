import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default function AlertsPage() {
  return (
    <>
      <div className="flex items-center gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Alerts</h1>
          <p className="text-muted-foreground">
            Set up alerts for cost spikes, error rates, and latency thresholds.
          </p>
        </div>
        <Badge variant="secondary">Coming soon</Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Alert Rules</CardTitle>
          <CardDescription>
            Configure thresholds and notification channels for your agents.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex h-[400px] items-center justify-center text-muted-foreground">
            Alert configuration will be available in a future release.
          </div>
        </CardContent>
      </Card>
    </>
  );
}
