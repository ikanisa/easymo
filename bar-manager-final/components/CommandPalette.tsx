'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { minimizeToTray, showNotification } from '@/lib/platform';

interface Command {
  id: string;
  label: string;
  icon: string;
  action: () => void | Promise<void>;
  keywords?: string[];
  category: string;
}

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(0);
  const router = useRouter();

  // Register Cmd+K / Ctrl+K shortcut
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
      
      if (e.key === 'Escape') {
        setOpen(false);
      }
    };

    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  // Command registry
  const commands: Command[] = useMemo(() => [
    // Navigation
    {
      id: 'nav-dashboard',
      label: 'Go to Dashboard',
      icon: '📊',
      category: 'Navigation',
      action: () => router.push('/dashboard'),
      keywords: ['dashboard', 'home', 'main'],
    },
    {
      id: 'nav-analytics',
      label: 'Go to Analytics',
      icon: '📈',
      category: 'Navigation',
      action: () => router.push('/analytics'),
      keywords: ['analytics', 'stats', 'metrics'],
    },
    {
      id: 'nav-users',
      label: 'Go to Users',
      icon: '👥',
      category: 'Navigation',
      action: () => router.push('/users'),
      keywords: ['users', 'people', 'accounts'],
    },
    {
      id: 'nav-settings',
      label: 'Go to Settings',
      icon: '⚙️',
      category: 'Navigation',
      action: () => router.push('/settings'),
      keywords: ['settings', 'config', 'preferences'],
    },

    // Actions
    {
      id: 'action-refresh',
      label: 'Refresh Page',
      icon: '🔄',
      category: 'Actions',
      action: () => window.location.reload(),
      keywords: ['refresh', 'reload'],
    },
    {
      id: 'action-export',
      label: 'Export Data',
      icon: '💾',
      category: 'Actions',
      action: async () => {
        await showNotification('Export', 'Data export started');
      },
      keywords: ['export', 'download', 'save'],
    },
    {
      id: 'action-notify',
      label: 'Test Notification',
      icon: '🔔',
      category: 'Actions',
      action: async () => {
        await showNotification('Test', 'This is a test notification!');
      },
      keywords: ['notification', 'alert', 'test'],
    },

    // Window
    {
      id: 'window-minimize',
      label: 'Minimize to Tray',
      icon: '📥',
      category: 'Window',
      action: async () => {
        await minimizeToTray();
      },
      keywords: ['minimize', 'tray', 'hide'],
    },
    {
      id: 'window-fullscreen',
      label: 'Toggle Fullscreen',
      icon: '⛶',
      category: 'Window',
      action: () => {
        if (document.fullscreenElement) {
          document.exitFullscreen();
        } else {
          document.documentElement.requestFullscreen();
        }
      },
      keywords: ['fullscreen', 'maximize'],
    },
  ], [router]);

  // Filter commands based on search
  const filteredCommands = useMemo(() => {
    if (!search) return commands;

    const lowerSearch = search.toLowerCase();
    return commands.filter((cmd) => {
      return (
        cmd.label.toLowerCase().includes(lowerSearch) ||
        cmd.category.toLowerCase().includes(lowerSearch) ||
        cmd.keywords?.some((k) => k.toLowerCase().includes(lowerSearch))
      );
    });
  }, [search, commands]);

  // Group commands by category
  const groupedCommands = useMemo(() => {
    const groups: Record<string, Command[]> = {};
    filteredCommands.forEach((cmd) => {
      if (!groups[cmd.category]) {
        groups[cmd.category] = [];
      }
      groups[cmd.category].push(cmd);
    });
    return groups;
  }, [filteredCommands]);

  // Handle keyboard navigation
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelected((s) => Math.min(s + 1, filteredCommands.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelected((s) => Math.max(s - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filteredCommands[selected]) {
          executeCommand(filteredCommands[selected]);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, selected, filteredCommands]);

  const executeCommand = useCallback(async (command: Command) => {
    setOpen(false);
    setSearch('');
    setSelected(0);
    await command.action();
  }, []);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-start justify-center pt-[20vh]">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl w-full max-w-2xl overflow-hidden">
        {/* Search Input */}
        <div className="border-b border-gray-200 dark:border-gray-700 p-4">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Type a command or search..."
            className="w-full bg-transparent outline-none text-lg"
            autoFocus
          />
        </div>

        {/* Results */}
        <div className="max-h-96 overflow-y-auto">
          {Object.keys(groupedCommands).length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              No results found for "{search}"
            </div>
          ) : (
            Object.entries(groupedCommands).map(([category, cmds]) => (
              <div key={category} className="p-2">
                <div className="px-3 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">
                  {category}
                </div>
                {cmds.map((cmd, idx) => {
                  const globalIdx = filteredCommands.indexOf(cmd);
                  const isSelected = globalIdx === selected;
                  
                  return (
                    <button
                      key={cmd.id}
                      onClick={() => executeCommand(cmd)}
                      onMouseEnter={() => setSelected(globalIdx)}
                      className={`w-full text-left px-3 py-2 rounded flex items-center gap-3 transition-colors ${
                        isSelected
                          ? 'bg-blue-500 text-white'
                          : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                      }`}
                    >
                      <span className="text-2xl">{cmd.icon}</span>
                      <span className="flex-1">{cmd.label}</span>
                      {cmd.keywords && cmd.keywords[0] && !search && (
                        <span className="text-xs opacity-50">
                          {cmd.keywords[0]}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 dark:border-gray-700 px-4 py-2 flex items-center justify-between text-xs text-gray-500">
          <div className="flex items-center gap-4">
            <span>↑↓ Navigate</span>
            <span>↵ Select</span>
            <span>ESC Close</span>
          </div>
          <span>{filteredCommands.length} commands</span>
        </div>
      </div>
    </div>
  );
}
