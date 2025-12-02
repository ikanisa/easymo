use tauri::{
    menu::{Menu, MenuBuilder, MenuItem, PredefinedMenuItem, Submenu, SubmenuBuilder},
    AppHandle, Runtime, WebviewWindow, Wry,
};

/// Creates the application menu using the Tauri 2.0 menu API
pub fn create_app_menu<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<Menu<R>> {
    // File menu
    let file_submenu = SubmenuBuilder::new(app, "File")
        .item(&MenuItem::with_id(app, "new_window", "New Window", true, None::<&str>)?)
        .separator()
        .item(&MenuItem::with_id(app, "open", "Open...", true, Some("CmdOrCtrl+O"))?)
        .item(&MenuItem::with_id(app, "save", "Save", true, Some("CmdOrCtrl+S"))?)
        .item(&MenuItem::with_id(app, "export", "Export Data...", true, Some("CmdOrCtrl+E"))?)
        .separator()
        .close_window()
        .quit()
        .build()?;

    // Edit menu
    let edit_submenu = SubmenuBuilder::new(app, "Edit")
        .undo()
        .redo()
        .separator()
        .cut()
        .copy()
        .paste()
        .select_all()
        .build()?;

    // View menu
    let view_submenu = SubmenuBuilder::new(app, "View")
        .item(&MenuItem::with_id(app, "refresh", "Refresh", true, Some("CmdOrCtrl+R"))?)
        .separator()
        .item(&MenuItem::with_id(app, "fullscreen", "Toggle Fullscreen", true, Some("F11"))?)
        .fullscreen()
        .separator()
        .item(&MenuItem::with_id(app, "dev_tools", "Developer Tools", true, Some("CmdOrCtrl+Shift+I"))?)
        .build()?;

    // Window menu
    let window_submenu = SubmenuBuilder::new(app, "Window")
        .item(&MenuItem::with_id(app, "minimize", "Minimize", true, Some("CmdOrCtrl+M"))?)
        .item(&MenuItem::with_id(app, "minimize_to_tray", "Minimize to Tray", true, None::<&str>)?)
        .item(&MenuItem::with_id(app, "zoom", "Zoom", true, None::<&str>)?)
        .separator()
        .close_window()
        .build()?;

    // Help menu
    let help_submenu = SubmenuBuilder::new(app, "Help")
        .item(&MenuItem::with_id(app, "documentation", "Documentation", true, None::<&str>)?)
        .item(&MenuItem::with_id(app, "report_issue", "Report Issue", true, None::<&str>)?)
        .separator()
        .item(&MenuItem::with_id(app, "about", "About EasyMO", true, None::<&str>)?)
        .build()?;

    // Build the menu
    MenuBuilder::new(app)
        .item(&file_submenu)
        .item(&edit_submenu)
        .item(&view_submenu)
        .item(&window_submenu)
        .item(&help_submenu)
        .build()
}

#[tauri::command]
pub async fn handle_menu_event(event: String, window: WebviewWindow) -> Result<(), String> {
    match event.as_str() {
        "new_window" => {
            // Emit event to frontend to handle window creation
            window.emit("menu-new-window", ()).map_err(|e| e.to_string())?;
        }
        "open" => {
            window.emit("menu-open", ()).map_err(|e| e.to_string())?;
        }
        "save" => {
            window.emit("menu-save", ()).map_err(|e| e.to_string())?;
        }
        "export" => {
            window.emit("menu-export", ()).map_err(|e| e.to_string())?;
        }
        "refresh" => {
            window.emit("menu-refresh", ()).map_err(|e| e.to_string())?;
        }
        "fullscreen" => {
            let is_fullscreen = window.is_fullscreen().map_err(|e| e.to_string())?;
            window.set_fullscreen(!is_fullscreen).map_err(|e| e.to_string())?;
        }
        "dev_tools" => {
            #[cfg(debug_assertions)]
            window.open_devtools();
        }
        "minimize" => {
            window.minimize().map_err(|e| e.to_string())?;
        }
        "minimize_to_tray" => {
            window.hide().map_err(|e| e.to_string())?;
        }
        "zoom" => {
            let is_maximized = window.is_maximized().map_err(|e| e.to_string())?;
            if is_maximized {
                window.unmaximize().map_err(|e| e.to_string())?;
            } else {
                window.maximize().map_err(|e| e.to_string())?;
            }
        }
        "documentation" => {
            window.emit("menu-documentation", ()).map_err(|e| e.to_string())?;
        }
        "report_issue" => {
            window.emit("menu-report-issue", ()).map_err(|e| e.to_string())?;
        }
        "about" => {
            window.emit("menu-about", ()).map_err(|e| e.to_string())?;
        }
        _ => {
            return Err(format!("Unknown menu event: {}", event));
        }
    }
    
    Ok(())
}
