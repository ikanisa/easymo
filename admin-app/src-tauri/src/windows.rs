use tauri::{Manager, WebviewUrl, WebviewWindowBuilder};
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct WindowConfig {
    pub label: String,
    pub url: String,
    pub title: String,
    pub width: Option<f64>,
    pub height: Option<f64>,
}

#[tauri::command]
pub async fn create_window(
    app: tauri::AppHandle,
    config: WindowConfig,
) -> Result<(), String> {
    let label = config.label.clone();
    
    // Check if window already exists
    if app.get_webview_window(&label).is_some() {
        // Focus existing window
        if let Some(window) = app.get_webview_window(&label) {
            window.set_focus().map_err(|e| e.to_string())?;
        }
        return Ok(());
    }

    // Create new window using WebviewWindowBuilder (Tauri 2.0 API)
    WebviewWindowBuilder::new(
        &app,
        label,
        WebviewUrl::App(config.url.into())
    )
    .title(config.title)
    .inner_size(config.width.unwrap_or(800.0), config.height.unwrap_or(600.0))
    .resizable(true)
    .center()
    .build()
    .map_err(|e| e.to_string())?;
    
    Ok(())
}

#[tauri::command]
pub fn get_all_windows(app: tauri::AppHandle) -> Vec<String> {
    app.webview_windows()
        .keys()
        .map(|k| k.to_string())
        .collect()
}

#[tauri::command]
pub async fn close_window(app: tauri::AppHandle, label: String) -> Result<(), String> {
    if let Some(window) = app.get_webview_window(&label) {
        window.close().map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub async fn focus_window(app: tauri::AppHandle, label: String) -> Result<(), String> {
    if let Some(window) = app.get_webview_window(&label) {
        window.set_focus().map_err(|e| e.to_string())?;
        window.show().map_err(|e| e.to_string())?;
    } else {
        return Err(format!("Window not found: {}", label));
    }
    Ok(())
}

#[tauri::command]
pub async fn broadcast_event(
    app: tauri::AppHandle,
    event: String,
    payload: serde_json::Value,
) -> Result<(), String> {
    app.emit(&event, payload).map_err(|e| e.to_string())?;
    Ok(())
}
