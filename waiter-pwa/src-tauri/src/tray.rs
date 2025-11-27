use tauri::{AppHandle, Manager};
use std::sync::Mutex;

pub struct TrayState {
    pub status: Mutex<String>,
}

#[tauri::command]
pub async fn update_tray_status(
    app: AppHandle,
    status: String,
) -> Result<(), String> {
    // Update tray tooltip
    if let Some(tray) = app.tray_by_id("main") {
        let tooltip = match status.as_str() {
            "online" => "EasyMO Admin - Online",
            "offline" => "EasyMO Admin - Offline",
            "busy" => "EasyMO Admin - Processing...",
            _ => "EasyMO Admin",
        };
        
        tray.set_tooltip(Some(tooltip))
            .map_err(|e| format!("Failed to update tray tooltip: {}", e))?;
    }
    
    Ok(())
}

#[tauri::command]
pub async fn show_tray_message(
    app: AppHandle,
    title: String,
    message: String,
) -> Result<(), String> {
    use tauri_plugin_notification::NotificationExt;
    
    app.notification()
        .builder()
        .title(title)
        .body(message)
        .show()
        .map_err(|e| format!("Failed to show tray message: {}", e))?;
    
    Ok(())
}

#[tauri::command]
pub async fn flash_tray_icon(app: AppHandle) -> Result<(), String> {
    // Flash tray icon to get user attention
    if let Some(window) = app.get_webview_window("main") {
        if !window.is_visible().unwrap_or(false) {
            window.request_user_attention(Some(tauri::UserAttentionType::Informational))
                .map_err(|e| format!("Failed to flash tray icon: {}", e))?;
        }
    }
    
    Ok(())
}
