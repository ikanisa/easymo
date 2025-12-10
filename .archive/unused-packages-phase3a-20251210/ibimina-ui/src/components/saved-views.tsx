"use client";

import { useState, useEffect, ReactNode } from "react";
import { cn } from "../utils/cn";

export interface FilterValue {
  key: string;
  operator: "eq" | "ne" | "gt" | "lt" | "gte" | "lte" | "in" | "like";
  value: string | number | boolean | Array<string | number>;
}

export interface SavedView {
  id: string;
  name: string;
  filters: FilterValue[];
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  isDefault?: boolean;
  isShared?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface SavedViewsProps {
  views: SavedView[];
  currentView?: SavedView;
  onSelectView: (view: SavedView) => void;
  onCreateView: (view: Omit<SavedView, "id" | "createdAt" | "updatedAt">) => Promise<void>;
  onUpdateView: (id: string, updates: Partial<SavedView>) => Promise<void>;
  onDeleteView: (id: string) => Promise<void>;
  className?: string;
}

export function SavedViews({
  views,
  currentView,
  onSelectView,
  onCreateView,
  onUpdateView,
  onDeleteView,
  className,
}: SavedViewsProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newViewName, setNewViewName] = useState("");

  const handleCreate = async () => {
    if (!newViewName.trim()) return;

    await onCreateView({
      name: newViewName,
      filters: currentView?.filters || [],
      sortBy: currentView?.sortBy,
      sortOrder: currentView?.sortOrder,
    });

    setNewViewName("");
    setIsCreating(false);
  };

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
          Saved Views
        </h3>
        <button
          onClick={() => setIsCreating(true)}
          className="text-xs font-medium text-atlas-blue hover:text-atlas-blue-dark dark:text-atlas-blue dark:hover:text-atlas-blue-light"
        >
          + New View
        </button>
      </div>

      {/* Create New View */}
      {isCreating && (
        <div className="flex gap-2 rounded-lg border border-neutral-200 bg-neutral-50 p-2 dark:border-neutral-700 dark:bg-neutral-800">
          <input
            type="text"
            value={newViewName}
            onChange={(e) => setNewViewName(e.target.value)}
            placeholder="View name..."
            className="flex-1 border-0 bg-transparent text-sm outline-none dark:text-neutral-100"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") handleCreate();
              if (e.key === "Escape") {
                setIsCreating(false);
                setNewViewName("");
              }
            }}
          />
          <button
            onClick={handleCreate}
            className="rounded bg-atlas-blue px-3 py-1 text-xs font-medium text-white hover:bg-atlas-blue-dark"
          >
            Save
          </button>
          <button
            onClick={() => {
              setIsCreating(false);
              setNewViewName("");
            }}
            className="rounded px-3 py-1 text-xs font-medium text-neutral-600 hover:bg-neutral-200 dark:text-neutral-400 dark:hover:bg-neutral-700"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Views List */}
      <div className="space-y-1">
        {views.map((view) => (
          <ViewItem
            key={view.id}
            view={view}
            isActive={currentView?.id === view.id}
            isEditing={editingId === view.id}
            onSelect={() => onSelectView(view)}
            onEdit={() => setEditingId(view.id)}
            onUpdate={(updates) => {
              onUpdateView(view.id, updates);
              setEditingId(null);
            }}
            onDelete={() => onDeleteView(view.id)}
            onCancelEdit={() => setEditingId(null)}
          />
        ))}
      </div>

      {views.length === 0 && !isCreating && (
        <p className="text-center text-sm text-neutral-500 dark:text-neutral-400 py-4">
          No saved views. Create one to save your current filters.
        </p>
      )}
    </div>
  );
}

interface ViewItemProps {
  view: SavedView;
  isActive: boolean;
  isEditing: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onUpdate: (updates: Partial<SavedView>) => void;
  onDelete: () => void;
  onCancelEdit: () => void;
}

function ViewItem({
  view,
  isActive,
  isEditing,
  onSelect,
  onEdit,
  onUpdate,
  onDelete,
  onCancelEdit,
}: ViewItemProps) {
  const [editName, setEditName] = useState(view.name);

  if (isEditing) {
    return (
      <div className="flex gap-2 rounded-lg border border-atlas-blue bg-atlas-blue/5 p-2 dark:border-atlas-blue/40 dark:bg-atlas-blue/10">
        <input
          type="text"
          value={editName}
          onChange={(e) => setEditName(e.target.value)}
          className="flex-1 border-0 bg-transparent text-sm outline-none dark:text-neutral-100"
          onKeyDown={(e) => {
            if (e.key === "Enter") onUpdate({ name: editName });
            if (e.key === "Escape") onCancelEdit();
          }}
          autoFocus
        />
        <button
          onClick={() => onUpdate({ name: editName })}
          className="text-xs font-medium text-atlas-blue hover:text-atlas-blue-dark"
        >
          Save
        </button>
        <button
          onClick={onCancelEdit}
          className="text-xs font-medium text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "group flex items-center justify-between rounded-lg p-2 transition-colors",
        isActive
          ? "bg-atlas-blue/10 text-atlas-blue-dark dark:bg-atlas-blue/20 dark:text-atlas-blue"
          : "hover:bg-neutral-100 dark:hover:bg-neutral-800"
      )}
    >
      <button onClick={onSelect} className="flex-1 text-left text-sm font-medium">
        <div className="flex items-center gap-2">
          {view.name}
          {view.isDefault && (
            <span className="text-xs text-neutral-500 dark:text-neutral-400">(default)</span>
          )}
          {view.isShared && (
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
              />
            </svg>
          )}
        </div>
        <div className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">
          {view.filters.length} filter{view.filters.length !== 1 ? "s" : ""}
        </div>
      </button>

      <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        <button
          onClick={onEdit}
          className="rounded p-1 hover:bg-neutral-200 dark:hover:bg-neutral-700"
          title="Edit view"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
            />
          </svg>
        </button>
        {!view.isDefault && (
          <button
            onClick={onDelete}
            className="rounded p-1 text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
            title="Delete view"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * Hook for managing saved views with local storage
 */
export function useSavedViews(storageKey: string) {
  const [views, setViews] = useState<SavedView[]>([]);
  const [currentView, setCurrentView] = useState<SavedView | undefined>();

  useEffect(() => {
    const stored = localStorage.getItem(storageKey);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setViews(
          parsed.map((v: any) => ({
            ...v,
            createdAt: new Date(v.createdAt),
            updatedAt: new Date(v.updatedAt),
          }))
        );
      } catch (error) {
        console.error("Failed to load saved views:", error);
      }
    }
  }, [storageKey]);

  const saveToStorage = (updatedViews: SavedView[]) => {
    localStorage.setItem(storageKey, JSON.stringify(updatedViews));
    setViews(updatedViews);
  };

  const createView = async (view: Omit<SavedView, "id" | "createdAt" | "updatedAt">) => {
    const newView: SavedView = {
      ...view,
      id: crypto.randomUUID(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    saveToStorage([...views, newView]);
    setCurrentView(newView);
  };

  const updateView = async (id: string, updates: Partial<SavedView>) => {
    const updatedViews = views.map((v) =>
      v.id === id ? { ...v, ...updates, updatedAt: new Date() } : v
    );
    saveToStorage(updatedViews);
    if (currentView?.id === id) {
      setCurrentView(updatedViews.find((v) => v.id === id));
    }
  };

  const deleteView = async (id: string) => {
    const updatedViews = views.filter((v) => v.id !== id);
    saveToStorage(updatedViews);
    if (currentView?.id === id) {
      setCurrentView(undefined);
    }
  };

  return {
    views,
    currentView,
    setCurrentView,
    createView,
    updateView,
    deleteView,
  };
}
