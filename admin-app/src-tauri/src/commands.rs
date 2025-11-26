use tauri::{AppHandle, Manager};

#[tauri::command]
pub async fn send_notification(
    app: AppHandle,
    title: String,
    body: String,
    icon: Option<String>,
) -> Result<(), String> {
    use tauri_plugin_notification::NotificationExt;

    let mut notification = app.notification().builder().title(title).body(body);

    if let Some(icon_path) = icon {
        notification = notification.icon(icon_path);
    }

    notification
        .show()
        .map_err(|e| format!("Failed to send notification: {}", e))?;

    Ok(())
}

#[tauri::command]
pub async fn minimize_to_tray(app: AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("main") {
        window
            .hide()
            .map_err(|e| format!("Failed to minimize to tray: {}", e))?;
    }
    Ok(())
}

#[tauri::command]
pub async fn show_window(app: AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("main") {
        window
            .show()
            .map_err(|e| format!("Failed to show window: {}", e))?;
        window
            .set_focus()
            .map_err(|e| format!("Failed to focus window: {}", e))?;
    }
    Ok(())
}

#[tauri::command]
pub async fn get_platform_info() -> Result<PlatformInfo, String> {
    use tauri_plugin_os::{arch, platform, version};

    Ok(PlatformInfo {
        platform: platform().to_string(),
        arch: arch().to_string(),
        version: version().to_string(),
    })
}

#[derive(serde::Serialize)]
pub struct PlatformInfo {
    pub platform: String,
    pub arch: String,
    pub version: String,
}
