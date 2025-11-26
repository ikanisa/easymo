use tauri::{CustomMenuItem, Menu, MenuItem, Submenu};

pub fn create_app_menu() -> Menu {
    // File menu
    let new_window = CustomMenuItem::new("new_window".to_string(), "New Window");
    let open = CustomMenuItem::new("open".to_string(), "Open...").accelerator("CmdOrCtrl+O");
    let save = CustomMenuItem::new("save".to_string(), "Save").accelerator("CmdOrCtrl+S");
    let export = CustomMenuItem::new("export".to_string(), "Export Data...").accelerator("CmdOrCtrl+E");
    
    let file_menu = Submenu::new(
        "File",
        Menu::new()
            .add_item(new_window)
            .add_native_item(MenuItem::Separator)
            .add_item(open)
            .add_item(save)
            .add_item(export)
            .add_native_item(MenuItem::Separator)
            .add_native_item(MenuItem::CloseWindow)
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
    let refresh = CustomMenuItem::new("refresh".to_string(), "Refresh").accelerator("CmdOrCtrl+R");
    let fullscreen = CustomMenuItem::new("fullscreen".to_string(), "Toggle Fullscreen").accelerator("F11");
    let dev_tools = CustomMenuItem::new("dev_tools".to_string(), "Developer Tools").accelerator("CmdOrCtrl+Shift+I");
    
    let view_menu = Submenu::new(
        "View",
        Menu::new()
            .add_item(refresh)
            .add_native_item(MenuItem::Separator)
            .add_item(fullscreen)
            .add_native_item(MenuItem::EnterFullScreen)
            .add_native_item(MenuItem::Separator)
            .add_item(dev_tools),
    );

    // Window menu
    let minimize = CustomMenuItem::new("minimize".to_string(), "Minimize").accelerator("CmdOrCtrl+M");
    let minimize_to_tray = CustomMenuItem::new("minimize_to_tray".to_string(), "Minimize to Tray");
    let zoom = CustomMenuItem::new("zoom".to_string(), "Zoom");
    
    let window_menu = Submenu::new(
        "Window",
        Menu::new()
            .add_item(minimize)
            .add_item(minimize_to_tray)
            .add_item(zoom)
            .add_native_item(MenuItem::Separator)
            .add_native_item(MenuItem::CloseWindow),
    );

    // Help menu
    let documentation = CustomMenuItem::new("documentation".to_string(), "Documentation");
    let report_issue = CustomMenuItem::new("report_issue".to_string(), "Report Issue");
    let about = CustomMenuItem::new("about".to_string(), "About EasyMO");
    
    let help_menu = Submenu::new(
        "Help",
        Menu::new()
            .add_item(documentation)
            .add_item(report_issue)
            .add_native_item(MenuItem::Separator)
            .add_item(about),
    );

    Menu::new()
        .add_submenu(file_menu)
        .add_submenu(edit_menu)
        .add_submenu(view_menu)
        .add_submenu(window_menu)
        .add_submenu(help_menu)
}

#[tauri::command]
pub async fn handle_menu_event(event: String, window: tauri::Window) -> Result<(), String> {
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
