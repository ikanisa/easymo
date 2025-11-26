use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Manager, Runtime,
};

mod commands;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            Some(vec![]),
        ))
        .plugin(tauri_plugin_os::init())
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            // Setup system tray
            setup_tray(app)?;

            // Register global shortcuts
            setup_shortcuts(app)?;

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::send_notification,
            commands::minimize_to_tray,
            commands::show_window,
            commands::get_platform_info,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

fn setup_tray<R: Runtime>(app: &tauri::App<R>) -> tauri::Result<()> {
    let quit = MenuItem::with_id(app, "quit", "Quit EasyMO Admin", true, None::<&str>)?;
    let show = MenuItem::with_id(app, "show", "Show Window", true, None::<&str>)?;
    let hide = MenuItem::with_id(app, "hide", "Hide Window", true, None::<&str>)?;

    let menu = Menu::with_items(app, &[&show, &hide, &quit])?;

    let _tray = TrayIconBuilder::new()
        .menu(&menu)
        .icon(app.default_window_icon().unwrap().clone())
        .on_menu_event(|app, event| match event.id.as_ref() {
            "quit" => {
                app.exit(0);
            }
            "show" => {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
            "hide" => {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.hide();
                }
            }
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                let app = tray.app_handle();
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
        })
        .build(app)?;

    Ok(())
}

fn setup_shortcuts<R: Runtime>(app: &tauri::App<R>) -> tauri::Result<()> {
    use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut};

    // Cmd+K (or Ctrl+K on Windows/Linux) to show command palette
    let shortcut = if cfg!(target_os = "macos") {
        Shortcut::new(Some(Modifiers::META), Code::KeyK)
    } else {
        Shortcut::new(Some(Modifiers::CONTROL), Code::KeyK)
    };

    let app_handle = app.handle().clone();
    app.handle()
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())?;
    
    app.global_shortcut().on_shortcut(shortcut, move |_app, _shortcut, _event| {
        if let Some(window) = app_handle.get_webview_window("main") {
            let _ = window.show();
            let _ = window.set_focus();
            // Emit event to frontend to open command palette
            let _ = window.emit("show-command-palette", ());
        }
    })?;

    Ok(())
}

