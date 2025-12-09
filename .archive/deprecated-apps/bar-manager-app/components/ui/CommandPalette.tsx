'use client';

import { useEffect, useState, useMemo } from 'react';
import { Command } from 'cmdk';
import { Search, Calculator, Calendar, Settings, ShoppingBag, Users, BarChart3, Home } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';

interface CommandItem {
  id: string;
  name: string;
  shortcut?: string;
  category: string;
  icon?: any;
  action: () => void;
}

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const router = useRouter();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };

    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  const commands: CommandItem[] = useMemo(() => [
    { id: 'dashboard', name: 'Go to Dashboard', category: 'Navigation', icon: Home, action: () => router.push('/') },
    { id: 'orders', name: 'Go to Orders', category: 'Navigation', icon: ShoppingBag, action: () => router.push('/orders') },
    { id: 'tables', name: 'Go to Tables', category: 'Navigation', icon: Users, action: () => router.push('/tables') },
    { id: 'analytics', name: 'Go to Analytics', category: 'Navigation', icon: BarChart3, action: () => router.push('/analytics') },
    { id: 'settings', name: 'Open Settings', category: 'Actions', icon: Settings, action: () => router.push('/settings') },
  ], [router]);

  const filteredCommands = useMemo(() => {
    if (!search) return commands;
    return commands.filter(cmd => 
      cmd.name.toLowerCase().includes(search.toLowerCase()) ||
      cmd.category.toLowerCase().includes(search.toLowerCase())
    );
  }, [commands, search]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm" onClick={() => setOpen(false)}>
      <Command className="fixed left-1/2 top-1/3 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg bg-card border border-border rounded-xl shadow-2xl overflow-hidden">
        <div className="flex items-center border-b border-border px-4">
          <Search className="w-5 h-5 text-muted-foreground mr-2" />
          <Command.Input
            value={search}
            onValueChange={setSearch}
            placeholder="Type a command or search..."
            className="flex-1 py-4 bg-transparent outline-none"
          />
        </div>

        <Command.List className="max-h-96 overflow-auto p-2">
          <Command.Empty className="py-6 text-center text-muted-foreground">
            No results found.
          </Command.Empty>

          {Object.entries(
            filteredCommands.reduce((acc, cmd) => {
              if (!acc[cmd.category]) acc[cmd.category] = [];
              acc[cmd.category].push(cmd);
              return acc;
            }, {} as Record<string, CommandItem[]>)
          ).map(([category, items]) => (
            <Command.Group key={category} heading={category} className="mb-2">
              {items.map((item) => {
                const Icon = item.icon;
                return (
                  <Command.Item
                    key={item.id}
                    onSelect={() => {
                      item.action();
                      setOpen(false);
                    }}
                    className="flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer hover:bg-muted"
                  >
                    {Icon && <Icon className="w-4 h-4" />}
                    <span>{item.name}</span>
                    {item.shortcut && (
                      <kbd className="ml-auto px-2 py-0.5 rounded bg-muted text-xs font-mono">
                        {item.shortcut}
                      </kbd>
                    )}
                  </Command.Item>
                );
              })}
            </Command.Group>
          ))}
        </Command.List>
      </Command>
    </div>
  );
}
