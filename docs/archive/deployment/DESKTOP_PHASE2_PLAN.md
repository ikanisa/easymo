# 🚀 Desktop Conversion - Phase 2: Advanced Features

**Start Date**: November 26, 2025  
**Duration**: 2-3 weeks  
**Status**: 🟢 READY TO START

---

## 📋 Phase 2 Overview

Building on Phase 1's foundation, Phase 2 adds advanced desktop features that transform the app into a power-user tool.

### Goals
1. Multi-window support for enhanced productivity
2. Command palette for keyboard-driven workflows
3. Deep OS integration (Spotlight, Alfred, etc.)
4. Platform-specific enhancements (Touch Bar, widgets)
5. Hardware access capabilities

---

## 🎯 Phase 2 Tasks (Week 3-4)

### Task 2.1: Multi-Window Support (24h)

**Goal**: Detachable panels and floating windows

**Deliverables**:
- Window manager service
- Detachable dashboard panels
- Floating analytics window
- Window state persistence
- Cross-window communication

**Implementation**:

```typescript
// lib/window-manager.ts
import { WebviewWindow } from '@tauri-apps/api/webviewWindow';

export class WindowManager {
  private windows: Map<string, WebviewWindow> = new Map();

  async createWindow(id: string, options: WindowOptions) {
    const window = new WebviewWindow(id, {
      url: options.url,
      title: options.title,
      width: options.width || 800,
      height: options.height || 600,
      decorations: true,
      resizable: true,
      center: true,
    });

    this.windows.set(id, window);
    return window;
  }

  async detachPanel(panelId: string) {
    // Create new window for panel
    const window = await this.createWindow(`panel-${panelId}`, {
      url: `/panel/${panelId}`,
      title: `Panel: ${panelId}`,
      width: 400,
      height: 600,
    });

    // Sync state between windows
    await this.syncWindowState(window, panelId);
  }

  async closeWindow(id: string) {
    const window = this.windows.get(id);
    if (window) {
      await window.close();
      this.windows.delete(id);
    }
  }

  private async syncWindowState(window: WebviewWindow, panelId: string) {
    // Implement state sync via Tauri events
    window.listen('state-update', (event) => {
      // Broadcast to all windows
      this.broadcastToAll('state-sync', event.payload);
    });
  }

  private broadcastToAll(event: string, payload: any) {
    this.windows.forEach((window) => {
      window.emit(event, payload);
    });
  }
}
```

**Rust Backend**:

```rust
// src-tauri/src/windows.rs
use tauri::{Manager, Window, WindowBuilder};

#[tauri::command]
pub async fn create_detached_window(
    app: tauri::AppHandle,
    label: String,
    url: String,
    title: String,
) -> Result<(), String> {
    WindowBuilder::new(
        &app,
        label,
        tauri::WindowUrl::App(url.into())
    )
    .title(title)
    .inner_size(800.0, 600.0)
    .resizable(true)
    .build()
    .map_err(|e| e.to_string())?;
    
    Ok(())
}

#[tauri::command]
pub fn get_all_windows(app: tauri::AppHandle) -> Vec<String> {
    app.windows()
        .keys()
        .map(|k| k.to_string())
        .collect()
}
```

---

### Task 2.2: Command Palette (16h)

**Goal**: Cmd+K global search and command execution

**Deliverables**:
- Command palette UI component
- Search/filter functionality
- Command registry
- Recent commands history
- Keyboard navigation

**Implementation**:

```typescript
// components/CommandPalette.tsx
import { useState, useEffect } from 'react';
import { Command } from 'cmdk';

interface CommandItem {
  id: string;
  label: string;
  icon?: string;
  action: () => void | Promise<void>;
  keywords?: string[];
  category?: string;
}

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

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

  return (
    <Command.Dialog open={open} onOpenChange={setOpen}>
      <Command.Input 
        placeholder="Search commands..." 
        value={search}
        onValueChange={setSearch}
      />
      <Command.List>
        <Command.Empty>No results found.</Command.Empty>

        <Command.Group heading="Navigation">
          <Command.Item onSelect={() => navigateTo('/dashboard')}>
            <span>📊 Dashboard</span>
          </Command.Item>
          <Command.Item onSelect={() => navigateTo('/analytics')}>
            <span>📈 Analytics</span>
          </Command.Item>
        </Command.Group>

        <Command.Group heading="Actions">
          <Command.Item onSelect={() => exportData()}>
            <span>💾 Export Data</span>
          </Command.Item>
          <Command.Item onSelect={() => refreshAll()}>
            <span>🔄 Refresh All</span>
          </Command.Item>
        </Command.Group>

        <Command.Group heading="Windows">
          <Command.Item onSelect={() => createNewWindow()}>
            <span>🪟 New Window</span>
          </Command.Item>
          <Command.Item onSelect={() => minimizeToTray()}>
            <span>📥 Minimize to Tray</span>
          </Command.Item>
        </Command.Group>
      </Command.List>
    </Command.Dialog>
  );
}
```

**Command Registry**:

```typescript
// lib/commands.ts
export class CommandRegistry {
  private commands: Map<string, CommandItem> = new Map();
  private recent: string[] = [];

  register(command: CommandItem) {
    this.commands.set(command.id, command);
  }

  execute(commandId: string) {
    const command = this.commands.get(commandId);
    if (command) {
      command.action();
      this.addToRecent(commandId);
    }
  }

  search(query: string): CommandItem[] {
    const lowerQuery = query.toLowerCase();
    return Array.from(this.commands.values()).filter((cmd) => {
      return (
        cmd.label.toLowerCase().includes(lowerQuery) ||
        cmd.keywords?.some((k) => k.toLowerCase().includes(lowerQuery))
      );
    });
  }

  getRecent(): CommandItem[] {
    return this.recent
      .map((id) => this.commands.get(id))
      .filter(Boolean) as CommandItem[];
  }

  private addToRecent(commandId: string) {
    this.recent = [
      commandId,
      ...this.recent.filter((id) => id !== commandId),
    ].slice(0, 10);
  }
}
```

---

### Task 2.3: Native Menu Bar (8h)

**Goal**: macOS menu bar with File/Edit/View menus

**Implementation**:

```rust
// src-tauri/src/menu.rs
use tauri::{CustomMenuItem, Menu, MenuItem, Submenu};

pub fn create_app_menu() -> Menu {
    // File menu
    let open = CustomMenuItem::new("open".to_string(), "Open...");
    let save = CustomMenuItem::new("save".to_string(), "Save");
    let export = CustomMenuItem::new("export".to_string(), "Export...");
    let file_menu = Submenu::new(
        "File",
        Menu::new()
            .add_item(open)
            .add_item(save)
            .add_native_item(MenuItem::Separator)
            .add_item(export)
            .add_native_item(MenuItem::Separator)
            .add_native_item(MenuItem::Quit),
    );

    // Edit menu
    let edit_menu = Submenu::new(
        "Edit",
        Menu::new()
            .add_native_item(MenuItem::Undo)
            .add_native_item(MenuItem::Redo)
            .add_native_item(MenuItem::Separator)
            .add_native_item(MenuItem::Cut)
            .add_native_item(MenuItem::Copy)
            .add_native_item(MenuItem::Paste)
            .add_native_item(MenuItem::SelectAll),
    );

    // View menu
    let refresh = CustomMenuItem::new("refresh".to_string(), "Refresh");
    let fullscreen = CustomMenuItem::new("fullscreen".to_string(), "Toggle Fullscreen");
    let view_menu = Submenu::new(
        "View",
        Menu::new()
            .add_item(refresh)
            .add_item(fullscreen)
            .add_native_item(MenuItem::Separator)
            .add_native_item(MenuItem::EnterFullScreen),
    );

    // Window menu
    let minimize = CustomMenuItem::new("minimize".to_string(), "Minimize");
    let zoom = CustomMenuItem::new("zoom".to_string(), "Zoom");
    let window_menu = Submenu::new(
        "Window",
        Menu::new()
            .add_item(minimize)
            .add_item(zoom)
            .add_native_item(MenuItem::Separator)
            .add_native_item(MenuItem::CloseWindow),
    );

    Menu::new()
        .add_submenu(file_menu)
        .add_submenu(edit_menu)
        .add_submenu(view_menu)
        .add_submenu(window_menu)
}

#[tauri::command]
pub fn handle_menu_event(event: String) -> Result<(), String> {
    match event.as_str() {
        "open" => {
            // Handle open
            Ok(())
        }
        "save" => {
            // Handle save
            Ok(())
        }
        "export" => {
            // Handle export
            Ok(())
        }
        "refresh" => {
            // Handle refresh
            Ok(())
        }
        _ => Err("Unknown menu event".to_string()),
    }
}
```

---

### Task 2.4: File Associations (4h)

**Goal**: Open .easymo files from OS

**Implementation**:

```json
// tauri.conf.json additions
{
  "bundle": {
    "fileAssociations": [
      {
        "ext": ["easymo"],
        "name": "EasyMO Data File",
        "description": "EasyMO application data file",
        "role": "Editor",
        "mimeType": "application/x-easymo"
      }
    ]
  }
}
```

```rust
// src-tauri/src/file_handler.rs
use tauri::Manager;
use std::path::PathBuf;

#[tauri::command]
pub async fn open_file(path: String) -> Result<String, String> {
    let file_path = PathBuf::from(path);
    
    if !file_path.exists() {
        return Err("File not found".to_string());
    }

    let contents = std::fs::read_to_string(&file_path)
        .map_err(|e| e.to_string())?;

    Ok(contents)
}

pub fn handle_file_open(app: &tauri::AppHandle, paths: Vec<PathBuf>) {
    for path in paths {
        if let Some(ext) = path.extension() {
            if ext == "easymo" {
                // Open file in app
                app.emit_all("file-open", path.to_str().unwrap()).ok();
            }
        }
    }
}
```

---

### Task 2.5: Deep Link Handling (8h)

**Goal**: Handle easymo:// protocol URLs

**Implementation**:

```json
// tauri.conf.json
{
  "bundle": {
    "macOS": {
      "urlScheme": "easymo"
    },
    "windows": {
      "urlScheme": "easymo"
    }
  }
}
```

```rust
// src-tauri/src/deep_links.rs
use tauri::Manager;

#[derive(Debug)]
pub struct DeepLink {
    pub action: String,
    pub params: std::collections::HashMap<String, String>,
}

impl DeepLink {
    pub fn parse(url: &str) -> Result<Self, String> {
        // Parse easymo://action?param=value
        let url = url.strip_prefix("easymo://")
            .ok_or("Invalid URL scheme")?;

        let parts: Vec<&str> = url.splitn(2, '?').collect();
        let action = parts[0].to_string();
        
        let mut params = std::collections::HashMap::new();
        if parts.len() > 1 {
            for param in parts[1].split('&') {
                let kv: Vec<&str> = param.splitn(2, '=').collect();
                if kv.len() == 2 {
                    params.insert(kv[0].to_string(), kv[1].to_string());
                }
            }
        }

        Ok(DeepLink { action, params })
    }
}

pub fn handle_deep_link(app: &tauri::AppHandle, url: String) {
    match DeepLink::parse(&url) {
        Ok(link) => {
            app.emit_all("deep-link", link).ok();
        }
        Err(e) => {
            eprintln!("Failed to parse deep link: {}", e);
        }
    }
}
```

---

### Task 2.6: macOS Touch Bar (8h)

**Goal**: Touch Bar support for MacBook Pro

**Implementation**:

```rust
// src-tauri/src/touchbar.rs (macOS only)
#[cfg(target_os = "macos")]
use tauri::Manager;

#[cfg(target_os = "macos")]
pub fn setup_touchbar(app: &tauri::AppHandle) {
    // Use cocoa-rs or objc crate for Touch Bar
    // This is platform-specific code
    
    use objc::runtime::{Class, Object};
    use objc::{msg_send, sel, sel_impl};
    
    unsafe {
        let cls = Class::get("NSTouchBar").unwrap();
        let touchbar: *mut Object = msg_send![cls, new];
        
        // Add Touch Bar items
        // - Refresh button
        // - Export button
        // - View toggles
    }
}
```

---

### Task 2.7: Spotlight Integration (macOS) (8h)

**Goal**: Index app data for Spotlight search

**Implementation**:

```rust
// src-tauri/src/spotlight.rs (macOS only)
#[cfg(target_os = "macos")]
use std::path::PathBuf;

#[cfg(target_os = "macos")]
pub fn index_for_spotlight(item_id: &str, metadata: SpotlightMetadata) {
    use core_spotlight::{CSSearchableItem, CSSearchableItemAttributeSet};
    
    let attributes = CSSearchableItemAttributeSet::new();
    attributes.set_title(&metadata.title);
    attributes.set_content_description(&metadata.description);
    attributes.set_keywords(&metadata.keywords);
    
    let item = CSSearchableItem::new(item_id, attributes);
    item.index();
}

#[cfg(target_os = "macos")]
pub struct SpotlightMetadata {
    pub title: String,
    pub description: String,
    pub keywords: Vec<String>,
}
```

---

## 📦 Required Dependencies

```toml
# Cargo.toml additions
[dependencies]
# Multi-window support (already included in Tauri)

[target.'cfg(target_os = "macos")'.dependencies]
cocoa = "0.25"
objc = "0.2"
core-spotlight = "0.1"  # For Spotlight integration
```

```json
// package.json additions
{
  "dependencies": {
    "cmdk": "^0.2.0",  // Command palette
    "@radix-ui/react-dialog": "^1.0.5"  // Command palette UI
  }
}
```

---

## 🧪 Testing Plan

### Multi-Window Tests
- [ ] Create detached window
- [ ] Window state persists across sessions
- [ ] Cross-window communication works
- [ ] Memory usage stays reasonable with multiple windows

### Command Palette Tests
- [ ] Cmd+K opens palette
- [ ] Search filters commands
- [ ] Keyboard navigation works
- [ ] Recent commands are saved

### Menu Bar Tests
- [ ] All menu items appear (macOS)
- [ ] Menu actions trigger correctly
- [ ] Keyboard shortcuts work

### File Association Tests
- [ ] .easymo files open in app
- [ ] File contents load correctly
- [ ] Multiple files can be opened

### Deep Link Tests
- [ ] easymo:// URLs open app
- [ ] URL parameters are parsed
- [ ] Actions are executed

---

## 📊 Success Metrics

| Feature | Target | Measurement |
|---------|--------|-------------|
| Multi-window support | 3+ windows | Manual test |
| Command palette search | <100ms | Performance test |
| Menu bar items | 15+ items | Count |
| File associations | .easymo files | OS test |
| Deep links | easymo:// URLs | Manual test |
| Touch Bar (macOS) | 5+ buttons | Visual check |

---

## 🚀 Implementation Order

**Week 1** (Nov 26 - Dec 2):
1. Command Palette (16h) - Highest user value
2. Native Menu Bar (8h) - Standard desktop expectation
3. Multi-Window foundation (8h) - Core infrastructure

**Week 2** (Dec 3 - Dec 9):
4. Multi-Window completion (16h) - Complete the feature
5. File Associations (4h) - Quick win
6. Deep Link Handling (8h) - Important for integrations

**Week 3** (Optional - Dec 10-16):
7. Touch Bar support (8h) - macOS only
8. Spotlight integration (8h) - macOS only

---

## 📝 Documentation Updates

Will update:
- DESKTOP_START_HERE.md
- DESKTOP_PHASE2_COMPLETE.md (new)
- admin-app/DESKTOP_README.md

---

**Status**: 📋 **PLAN READY - READY TO START IMPLEMENTATION**

**Next Step**: Begin Task 2.2 (Command Palette) - highest user value

