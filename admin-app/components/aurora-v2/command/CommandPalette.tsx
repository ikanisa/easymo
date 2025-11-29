'use client';

import { AnimatePresence,motion } from 'framer-motion';
import { 
  ArrowRight,
  Clock,
  Home, 
  type LucideIcon, 
  MessageCircle, 
  Plus,
  Search, 
  Settings, 
  Users} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { cn } from '@/lib/utils';

interface CommandItem {
  id: string;
  title: string;
  icon: LucideIcon;
  action: () => void;
  shortcut?: string;
}

interface CommandGroup {
  heading: string;
  items: CommandItem[];
}

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const router = useRouter();

  // Quick actions
  const quickActions: CommandItem[] = [
    {
      id: 'new-user',
      title: 'Create new user',
      icon: Plus,
      shortcut: 'N',
      action: () => {
        router.push('/users/new');
        setOpen(false);
      },
    },
    {
      id: 'send-message',
      title: 'Send message',
      icon: MessageCircle,
      shortcut: 'M',
      action: () => {
        router.push('/messages/new');
        setOpen(false);
      },
    },
    {
      id: 'settings',
      title: 'Open settings',
      icon: Settings,
      shortcut: 'S',
      action: () => {
        router.push('/settings');
        setOpen(false);
      },
    },
  ];

  // Navigation
  const navigation: CommandItem[] = [
    {
      id: 'dashboard',
      title: 'Dashboard',
      icon: Home,
      action: () => {
        router.push('/dashboard');
        setOpen(false);
      },
    },
    {
      id: 'users',
      title: 'Users',
      icon: Users,
      action: () => {
        router.push('/users');
        setOpen(false);
      },
    },
  ];

  // Recent items (mock data)
  const recentItems: CommandItem[] = [
    {
      id: 'recent-1',
      title: 'User: John Doe',
      icon: Clock,
      action: () => {
        router.push('/users/1');
        setOpen(false);
      },
    },
  ];

  const groups: CommandGroup[] = [
    { heading: 'Quick Actions', items: quickActions },
    { heading: 'Navigation', items: navigation },
    { heading: 'Recent', items: recentItems },
  ];

  // Filter items based on search
  const filteredGroups = groups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) =>
        item.title.toLowerCase().includes(search.toLowerCase())
      ),
    }))
    .filter((group) => group.items.length > 0);

  // Toggle with ⌘K or Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
      if (e.key === 'Escape') {
        setOpen(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Reset search when opening
  useEffect(() => {
    if (open) {
      setSearch('');
    }
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setOpen(false)}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
          />

          {/* Command Dialog */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -20 }}
            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
            className="fixed top-[20%] left-1/2 -translate-x-1/2 z-50 w-full max-w-xl px-4"
          >
            <div className="rounded-2xl border border-aurora-border bg-aurora-surface shadow-2xl overflow-hidden">
              {/* Search Input */}
              <div className="flex items-center gap-3 px-4 border-b border-aurora-border">
                <Search className="w-5 h-5 text-aurora-text-muted" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Type a command or search..."
                  className="flex-1 h-14 bg-transparent text-base placeholder:text-aurora-text-muted focus:outline-none text-aurora-text-primary"
                  autoFocus
                />
                <kbd className="hidden sm:flex items-center gap-1 px-2 py-1 text-xs text-aurora-text-muted bg-aurora-surface-muted rounded border border-aurora-border">
                  ESC
                </kbd>
              </div>

              {/* Results */}
              <div className="max-h-[400px] overflow-y-auto p-2">
                {filteredGroups.length === 0 ? (
                  <div className="py-8 text-center text-aurora-text-muted">
                    No results found.
                  </div>
                ) : (
                  filteredGroups.map((group, groupIndex) => (
                    <div key={group.heading}>
                      {groupIndex > 0 && <div className="my-2 h-px bg-aurora-border" />}
                      
                      <div className="px-2 py-1.5 text-xs font-semibold text-aurora-text-muted uppercase tracking-wider">
                        {group.heading}
                      </div>

                      {group.items.map((item) => (
                        <CommandItem key={item.id} item={item} />
                      ))}
                    </div>
                  ))
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function CommandItem({ item }: { item: CommandItem }) {
  const Icon = item.icon;

  return (
    <button
      onClick={item.action}
      className={cn(
        'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg',
        'cursor-pointer transition-colors',
        'hover:bg-aurora-accent hover:text-white',
        'group'
      )}
    >
      <Icon className="w-5 h-5 text-aurora-text-muted group-hover:text-white/80" />
      <span className="flex-1 text-left">{item.title}</span>
      {item.shortcut && (
        <kbd className="text-xs text-aurora-text-muted px-1.5 py-0.5 bg-aurora-surface-muted rounded border border-aurora-border group-hover:bg-white/20 group-hover:border-white/30 group-hover:text-white">
          ⌘{item.shortcut}
        </kbd>
      )}
      <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
    </button>
  );
}
