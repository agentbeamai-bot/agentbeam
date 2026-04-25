'use client';

import { SidebarTrigger } from '@/components/ui/sidebar';
import { Separator } from '@/components/ui/separator';
import { ProjectProvider, useProjectContext } from '@/lib/project-context';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { ChevronsUpDownIcon } from 'lucide-react';

function ProjectSwitcher() {
  const { projects, currentProject, setProjectId, isLoading } =
    useProjectContext();

  if (isLoading || projects.length === 0) return null;

  // Single project -- just show the name
  if (projects.length === 1) {
    return (
      <span className="text-sm font-medium text-foreground">
        {currentProject?.name ?? ''}
      </span>
    );
  }

  // Multiple projects -- dropdown
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="outline" size="sm" className="gap-1.5">
            {currentProject?.name ?? 'Select project'}
            <ChevronsUpDownIcon className="size-3 text-muted-foreground" />
          </Button>
        }
      />
      <DropdownMenuContent align="start">
        {projects.map((p) => (
          <DropdownMenuItem key={p.id} onClick={() => setProjectId(p.id)}>
            {p.name}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function DashboardShell({ children }: { children: React.ReactNode }) {
  return (
    <ProjectProvider>
      <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 border-b border-white/[0.06] bg-background/80 px-4 backdrop-blur-xl">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 !h-4" />
        <ProjectSwitcher />
      </header>
      <div className="flex flex-1 flex-col gap-4 p-4 md:p-6 lg:p-8">
        {children}
      </div>
    </ProjectProvider>
  );
}
