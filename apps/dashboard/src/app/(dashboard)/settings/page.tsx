'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { useProjectContext } from '@/lib/project-context';
import {
  PlusIcon,
  KeyIcon,
  CopyIcon,
  CheckIcon,
  Trash2Icon,
  AlertTriangleIcon,
  BuildingIcon,
  FolderIcon,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface ApiKey {
  id: string;
  name: string;
  key_prefix: string;
  environment: string;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function formatRelativeTime(iso: string | null): string {
  if (!iso) return 'Never';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return formatDate(iso);
}

// ---------------------------------------------------------------------------
// Create Project Dialog
// ---------------------------------------------------------------------------
function CreateProjectDialog() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const queryClient = useQueryClient();
  const { projects } = useProjectContext();

  // Derive org_id from existing projects if available; backend auto-creates if missing
  const orgId = projects.length > 0 ? projects[0].org_id : undefined;

  const mutation = useMutation({
    mutationFn: async (projectName: string) => {
      const payload: { name: string; org_id?: string } = { name: projectName };
      if (orgId) payload.org_id = orgId;

      const res = await fetch('/api/v1/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? 'Failed to create project');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      setName('');
      setOpen(false);
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button size="sm">
            <PlusIcon className="size-3.5" data-icon="inline-start" />
            Create Project
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create New Project</DialogTitle>
          <DialogDescription>
            A project groups your agents, traces, and API keys together.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 py-2">
          <div className="grid gap-1.5">
            <Label htmlFor="project-name">Project name</Label>
            <Input
              id="project-name"
              placeholder="e.g. Production Agents"
              value={name}
              onChange={(e) =>
                setName((e.target as HTMLInputElement).value)
              }
              onKeyDown={(e) => {
                if (e.key === 'Enter' && name.trim()) {
                  mutation.mutate(name.trim());
                }
              }}
            />
          </div>
          {mutation.error && (
            <p className="text-xs text-destructive">
              {mutation.error instanceof Error
                ? mutation.error.message
                : 'Something went wrong'}
            </p>
          )}
        </div>
        <DialogFooter>
          <Button
            onClick={() => mutation.mutate(name.trim())}
            disabled={!name.trim() || mutation.isPending}
          >
            {mutation.isPending ? 'Creating...' : 'Create'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Generate Key Dialog
// ---------------------------------------------------------------------------
function GenerateKeyDialog({ projectId }: { projectId: string }) {
  const [open, setOpen] = useState(false);
  const [keyName, setKeyName] = useState('');
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (name: string) => {
      const res = await fetch('/api/v1/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: projectId,
          name: name || 'Untitled',
          environment: 'production',
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? 'Failed to generate key');
      }
      return res.json();
    },
    onSuccess: (data) => {
      setGeneratedKey(data.api_key);
      queryClient.invalidateQueries({ queryKey: ['api-keys', projectId] });
    },
  });

  function handleCopy() {
    if (generatedKey) {
      navigator.clipboard.writeText(generatedKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  function handleClose(isOpen: boolean) {
    if (!isOpen) {
      setGeneratedKey(null);
      setKeyName('');
      setCopied(false);
    }
    setOpen(isOpen);
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogTrigger
        render={
          <Button size="sm" variant="outline">
            <KeyIcon className="size-3.5" data-icon="inline-start" />
            Generate New Key
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {generatedKey ? 'API Key Generated' : 'Generate API Key'}
          </DialogTitle>
          <DialogDescription>
            {generatedKey
              ? 'Copy and save this key now. You will not be able to see it again.'
              : 'Create a new API key for this project.'}
          </DialogDescription>
        </DialogHeader>

        {generatedKey ? (
          <div className="grid gap-3 py-2">
            <div className="flex items-center gap-2 rounded-lg border bg-muted/50 p-3">
              <code className="flex-1 break-all text-xs font-mono">
                {generatedKey}
              </code>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={handleCopy}
              >
                {copied ? (
                  <CheckIcon className="size-3.5 text-emerald-500" />
                ) : (
                  <CopyIcon className="size-3.5" />
                )}
              </Button>
            </div>
            <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
              <AlertTriangleIcon className="mt-0.5 size-4 shrink-0 text-amber-500" />
              <p className="text-xs text-amber-200/80">
                Save this key -- you won't see it again. Store it securely in
                your environment variables.
              </p>
            </div>
          </div>
        ) : (
          <div className="grid gap-3 py-2">
            <div className="grid gap-1.5">
              <Label htmlFor="key-name">Key name</Label>
              <Input
                id="key-name"
                placeholder="e.g. Production"
                value={keyName}
                onChange={(e) =>
                  setKeyName((e.target as HTMLInputElement).value)
                }
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    mutation.mutate(keyName.trim());
                  }
                }}
              />
            </div>
            {mutation.error && (
              <p className="text-xs text-destructive">
                {mutation.error instanceof Error
                  ? mutation.error.message
                  : 'Something went wrong'}
              </p>
            )}
          </div>
        )}

        <DialogFooter>
          {generatedKey ? (
            <Button onClick={() => handleClose(false)}>Done</Button>
          ) : (
            <Button
              onClick={() => mutation.mutate(keyName.trim())}
              disabled={mutation.isPending}
            >
              {mutation.isPending ? 'Generating...' : 'Generate'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// API Keys Section
// ---------------------------------------------------------------------------
function ApiKeysSection({ projectId }: { projectId: string }) {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery<{ api_keys: ApiKey[] }>({
    queryKey: ['api-keys', projectId],
    queryFn: async () => {
      const res = await fetch(
        `/api/v1/api-keys?project_id=${projectId}`,
      );
      if (!res.ok) throw new Error('Failed to fetch API keys');
      return res.json();
    },
    enabled: !!projectId,
  });

  const revokeMutation = useMutation({
    mutationFn: async (keyId: string) => {
      const res = await fetch('/api/v1/api-keys', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key_id: keyId, action: 'revoke' }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? 'Failed to revoke key');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['api-keys', projectId] });
    },
  });

  const keys = data?.api_keys ?? [];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <KeyIcon className="size-4" />
              API Keys
            </CardTitle>
            <CardDescription className="mt-1">
              Manage API keys used to send traces from your agents.
            </CardDescription>
          </div>
          <GenerateKeyDialog projectId={projectId} />
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : keys.length === 0 ? (
          <div className="flex h-[120px] items-center justify-center text-sm text-muted-foreground">
            No API keys yet. Generate one to get started.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Key</TableHead>
                <TableHead>Environment</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Last Used</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {keys.map((key) => (
                <TableRow key={key.id}>
                  <TableCell className="font-medium">{key.name}</TableCell>
                  <TableCell>
                    <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">
                      {key.key_prefix}...
                    </code>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{key.environment}</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(key.created_at)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatRelativeTime(key.last_used_at)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="destructive"
                      size="xs"
                      onClick={() => revokeMutation.mutate(key.id)}
                      disabled={revokeMutation.isPending}
                    >
                      <Trash2Icon className="size-3" data-icon="inline-start" />
                      Revoke
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Main Settings Page
// ---------------------------------------------------------------------------
export default function SettingsPage() {
  const { currentProject, projects, isLoading: projectsLoading } =
    useProjectContext();

  if (projectsLoading) {
    return (
      <>
        <div>
          <Skeleton className="mb-2 h-8 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
        <div className="space-y-6">
          <Skeleton className="h-[200px] w-full" />
          <Skeleton className="h-[300px] w-full" />
        </div>
      </>
    );
  }

  return (
    <>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">
          Manage your project configuration and API keys.
        </p>
      </div>

      {/* Project Management */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FolderIcon className="size-4" />
                Project
              </CardTitle>
              <CardDescription className="mt-1">
                Your current project details.
              </CardDescription>
            </div>
            <CreateProjectDialog />
          </div>
        </CardHeader>
        <CardContent>
          {currentProject ? (
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <p className="text-xs font-medium text-muted-foreground">
                  Name
                </p>
                <p className="mt-0.5 text-sm font-medium">
                  {currentProject.name}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground">
                  Slug
                </p>
                <p className="mt-0.5 text-sm font-mono text-muted-foreground">
                  {currentProject.slug}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground">
                  Created
                </p>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {formatDate(currentProject.created_at)}
                </p>
              </div>
            </div>
          ) : (
            <div className="flex h-[80px] items-center justify-center text-sm text-muted-foreground">
              No project selected. Create one to get started.
            </div>
          )}
        </CardContent>
      </Card>

      {/* API Keys */}
      {currentProject && <ApiKeysSection projectId={currentProject.id} />}

      {/* Organization */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BuildingIcon className="size-4" />
            Organization
          </CardTitle>
          <CardDescription>
            Your organization and team settings.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {currentProject?.organizations ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-xs font-medium text-muted-foreground">
                  Organization Name
                </p>
                <p className="mt-0.5 text-sm font-medium">
                  {currentProject.organizations.name}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground">
                  Slug
                </p>
                <p className="mt-0.5 text-sm font-mono text-muted-foreground">
                  {currentProject.organizations.slug}
                </p>
              </div>
            </div>
          ) : (
            <div>
              <p className="text-xs font-medium text-muted-foreground">
                Organization
              </p>
              <p className="mt-0.5 text-sm text-muted-foreground">
                --
              </p>
            </div>
          )}
          <div className="mt-4 rounded-lg border border-dashed p-4 text-center">
            <p className="text-sm text-muted-foreground">
              Team member management coming soon.
            </p>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
