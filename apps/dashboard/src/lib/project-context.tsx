'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useQuery } from '@tanstack/react-query';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export interface Project {
  id: string;
  name: string;
  slug: string;
  org_id: string;
  created_at: string;
  organizations?: { name: string; slug: string };
}

interface ProjectContextValue {
  projectId: string | null;
  projects: Project[];
  currentProject: Project | null;
  setProjectId: (id: string) => void;
  isLoading: boolean;
  error: Error | null;
}

const STORAGE_KEY = 'agentbeam_selected_project';

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------
const ProjectContext = createContext<ProjectContextValue | null>(null);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------
export function ProjectProvider({ children }: { children: React.ReactNode }) {
  const [selectedId, setSelectedId] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(STORAGE_KEY);
  });

  const {
    data: projects,
    isLoading,
    error,
  } = useQuery<Project[]>({
    queryKey: ['projects'],
    queryFn: async () => {
      const res = await fetch('/api/v1/projects');
      if (!res.ok) throw new Error('Failed to fetch projects');
      const json = await res.json();
      return json.projects ?? [];
    },
  });

  // Auto-select first project when loaded if nothing is selected or the
  // stored project no longer exists.
  useEffect(() => {
    if (!projects || projects.length === 0) return;

    const isValid = selectedId && projects.some((p) => p.id === selectedId);
    if (!isValid) {
      const firstId = projects[0].id;
      setSelectedId(firstId);
      localStorage.setItem(STORAGE_KEY, firstId);
    }
  }, [projects, selectedId]);

  const setProjectId = useCallback((id: string) => {
    setSelectedId(id);
    localStorage.setItem(STORAGE_KEY, id);
  }, []);

  const currentProject = useMemo(() => {
    if (!projects || !selectedId) return null;
    return projects.find((p) => p.id === selectedId) ?? null;
  }, [projects, selectedId]);

  const value = useMemo<ProjectContextValue>(
    () => ({
      projectId: selectedId,
      projects: projects ?? [],
      currentProject,
      setProjectId,
      isLoading,
      error: error as Error | null,
    }),
    [selectedId, projects, currentProject, setProjectId, isLoading, error],
  );

  return (
    <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------
export function useProjectContext(): ProjectContextValue {
  const ctx = useContext(ProjectContext);
  if (!ctx) {
    throw new Error('useProjectContext must be used within a ProjectProvider');
  }
  return ctx;
}
