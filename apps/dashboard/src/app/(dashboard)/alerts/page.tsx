'use client';

import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useProjectContext } from '@/lib/project-context';
import {
  BellIcon,
  PlusIcon,
  Trash2Icon,
  DollarSignIcon,
  AlertTriangleIcon,
  TimerIcon,
} from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Switch } from '@base-ui/react/switch';
import { formatRelativeTime } from '@/lib/utils/format';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type AlertType = 'cost_threshold' | 'error_rate' | 'latency';

interface Alert {
  id: string;
  project_id: string;
  name: string;
  type: AlertType;
  config: { threshold: number };
  channels: { email: string };
  enabled: boolean;
  last_triggered_at: string | null;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ALERT_TYPE_META: Record<
  AlertType,
  { label: string; icon: typeof DollarSignIcon; unit: string; prefix: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }
> = {
  cost_threshold: {
    label: 'Cost Threshold',
    icon: DollarSignIcon,
    unit: '$',
    prefix: 'Alert when daily cost exceeds',
    variant: 'default',
  },
  error_rate: {
    label: 'Error Rate',
    icon: AlertTriangleIcon,
    unit: '%',
    prefix: 'Alert when error rate exceeds',
    variant: 'destructive',
  },
  latency: {
    label: 'Latency',
    icon: TimerIcon,
    unit: 'ms',
    prefix: 'Alert when avg latency exceeds',
    variant: 'secondary',
  },
};

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------

async function fetchAlerts(projectId: string): Promise<Alert[]> {
  const res = await fetch(`/api/v1/alerts?project_id=${projectId}`);
  if (!res.ok) throw new Error('Failed to fetch alerts');
  const json = await res.json();
  return json.alerts ?? [];
}

async function createAlert(payload: {
  project_id: string;
  name: string;
  type: AlertType;
  config: { threshold: number };
  channels: { email: string };
  enabled: boolean;
}): Promise<Alert> {
  const res = await fetch('/api/v1/alerts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to create alert' }));
    throw new Error(err.error ?? 'Failed to create alert');
  }
  const json = await res.json();
  return json.alert;
}

async function toggleAlert(alertId: string, enabled: boolean): Promise<Alert> {
  const res = await fetch('/api/v1/alerts', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ alert_id: alertId, enabled }),
  });
  if (!res.ok) throw new Error('Failed to update alert');
  const json = await res.json();
  return json.alert;
}

async function deleteAlert(alertId: string): Promise<void> {
  const res = await fetch('/api/v1/alerts', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ alert_id: alertId }),
  });
  if (!res.ok) throw new Error('Failed to delete alert');
}

function formatThreshold(type: AlertType, threshold: number): string {
  switch (type) {
    case 'cost_threshold':
      return `$${threshold.toFixed(2)}`;
    case 'error_rate':
      return `${threshold}%`;
    case 'latency':
      return `${threshold}ms`;
    default:
      return String(threshold);
  }
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function AlertsPage() {
  const { projectId } = useProjectContext();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);

  // Form state
  const [name, setName] = useState('');
  const [type, setType] = useState<AlertType>('cost_threshold');
  const [threshold, setThreshold] = useState('');
  const [email, setEmail] = useState('');
  const [enabled, setEnabled] = useState(true);
  const [formError, setFormError] = useState('');

  const alertsQuery = useQuery({
    queryKey: ['alerts', projectId],
    queryFn: () => fetchAlerts(projectId!),
    enabled: !!projectId,
  });

  const createMutation = useMutation({
    mutationFn: createAlert,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts', projectId] });
      resetForm();
      setDialogOpen(false);
    },
    onError: (err: Error) => {
      setFormError(err.message);
    },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ alertId, enabled: en }: { alertId: string; enabled: boolean }) =>
      toggleAlert(alertId, en),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts', projectId] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteAlert,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts', projectId] });
    },
  });

  const resetForm = useCallback(() => {
    setName('');
    setType('cost_threshold');
    setThreshold('');
    setEmail('');
    setEnabled(true);
    setFormError('');
  }, []);

  const handleCreate = useCallback(() => {
    setFormError('');

    if (!name.trim()) {
      setFormError('Alert name is required');
      return;
    }
    const thresholdNum = parseFloat(threshold);
    if (isNaN(thresholdNum) || thresholdNum <= 0) {
      setFormError('Threshold must be a positive number');
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      setFormError('A valid email address is required');
      return;
    }
    if (!projectId) return;

    createMutation.mutate({
      project_id: projectId,
      name: name.trim(),
      type,
      config: { threshold: thresholdNum },
      channels: { email: email.trim() },
      enabled,
    });
  }, [name, type, threshold, email, enabled, projectId, createMutation]);

  const alerts = alertsQuery.data ?? [];

  return (
    <>
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Alerts</h1>
          <p className="text-muted-foreground">
            Set up alerts for cost spikes, error rates, and latency thresholds.
          </p>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger
            render={
              <Button
                onClick={() => {
                  resetForm();
                  setDialogOpen(true);
                }}
              />
            }
          >
            <PlusIcon data-icon="inline-start" />
            Create Alert
          </DialogTrigger>

          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Create Alert Rule</DialogTitle>
              <DialogDescription>
                Configure a threshold and notification channel.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-2">
              {/* Alert name */}
              <div className="grid gap-1.5">
                <Label htmlFor="alert-name">Alert Name</Label>
                <Input
                  id="alert-name"
                  placeholder="e.g. High daily spend"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              {/* Type selector */}
              <div className="grid gap-1.5">
                <Label>Type</Label>
                <div className="flex gap-1">
                  {(Object.keys(ALERT_TYPE_META) as AlertType[]).map((t) => {
                    const meta = ALERT_TYPE_META[t];
                    return (
                      <Button
                        key={t}
                        variant={type === t ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => {
                          setType(t);
                          setThreshold('');
                        }}
                      >
                        {meta.label}
                      </Button>
                    );
                  })}
                </div>
              </div>

              {/* Threshold */}
              <div className="grid gap-1.5">
                <Label htmlFor="alert-threshold">
                  {ALERT_TYPE_META[type].prefix}
                </Label>
                <div className="relative">
                  {type === 'cost_threshold' && (
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                      $
                    </span>
                  )}
                  <Input
                    id="alert-threshold"
                    type="number"
                    min={0}
                    step={type === 'cost_threshold' ? '0.01' : '1'}
                    placeholder={
                      type === 'cost_threshold'
                        ? '50.00'
                        : type === 'error_rate'
                          ? '5'
                          : '2000'
                    }
                    value={threshold}
                    onChange={(e) => setThreshold(e.target.value)}
                    className={type === 'cost_threshold' ? 'pl-6' : ''}
                  />
                  {type !== 'cost_threshold' && (
                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                      {ALERT_TYPE_META[type].unit}
                    </span>
                  )}
                </div>
              </div>

              {/* Channel: Email */}
              <div className="grid gap-1.5">
                <Label htmlFor="alert-email">Notification Email</Label>
                <Input
                  id="alert-email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              {/* Enable / disable */}
              <div className="flex items-center gap-3">
                <Switch.Root
                  checked={enabled}
                  onCheckedChange={(checked) => setEnabled(checked)}
                  className="relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent bg-muted transition-colors data-[checked]:bg-primary"
                >
                  <Switch.Thumb className="pointer-events-none block size-4 rounded-full bg-background shadow-sm transition-transform data-[checked]:translate-x-4" />
                </Switch.Root>
                <Label>
                  {enabled ? 'Enabled' : 'Disabled'}
                </Label>
              </div>

              {/* Error */}
              {formError && (
                <p className="text-sm text-destructive">{formError}</p>
              )}
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreate}
                disabled={createMutation.isPending}
              >
                {createMutation.isPending ? 'Creating...' : 'Create Alert'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Alerts table */}
      <Card>
        <CardHeader>
          <CardTitle>Alert Rules</CardTitle>
          <CardDescription>
            Configure thresholds and notification channels for your agents.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {alertsQuery.isLoading ? (
            <div className="flex h-[200px] items-center justify-center text-muted-foreground">
              Loading alerts...
            </div>
          ) : alerts.length === 0 ? (
            <div className="flex h-[300px] items-center justify-center">
              <div className="text-center text-muted-foreground">
                <BellIcon className="mx-auto mb-3 size-10 opacity-50" />
                <p className="font-medium">No alerts configured</p>
                <p className="mt-1 text-sm">
                  Create one to get notified about cost spikes, errors, or
                  latency issues.
                </p>
              </div>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Threshold</TableHead>
                  <TableHead>Channel</TableHead>
                  <TableHead>Enabled</TableHead>
                  <TableHead>Last Triggered</TableHead>
                  <TableHead className="w-[60px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {alerts.map((alert) => {
                  const meta = ALERT_TYPE_META[alert.type] ?? ALERT_TYPE_META.cost_threshold;
                  return (
                    <TableRow key={alert.id}>
                      <TableCell className="font-medium">
                        {alert.name}
                      </TableCell>
                      <TableCell>
                        <Badge variant={meta.variant}>
                          {meta.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {formatThreshold(alert.type, alert.config.threshold)}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {alert.channels.email}
                      </TableCell>
                      <TableCell>
                        <Switch.Root
                          checked={alert.enabled}
                          onCheckedChange={(checked) =>
                            toggleMutation.mutate({
                              alertId: alert.id,
                              enabled: checked,
                            })
                          }
                          disabled={toggleMutation.isPending}
                          className="relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent bg-muted transition-colors data-[checked]:bg-primary disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <Switch.Thumb className="pointer-events-none block size-4 rounded-full bg-background shadow-sm transition-transform data-[checked]:translate-x-4" />
                        </Switch.Root>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {alert.last_triggered_at
                          ? formatRelativeTime(alert.last_triggered_at)
                          : 'Never'}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => deleteMutation.mutate(alert.id)}
                          disabled={deleteMutation.isPending}
                        >
                          <Trash2Icon className="size-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </>
  );
}
