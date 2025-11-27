use tauri::{AppHandle, Manager};
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct UpdateInfo {
    pub version: String,
    pub current_version: String,
    pub available: bool,
    pub download_url: Option<String>,
    pub release_notes: Option<String>,
}

#[tauri::command]
pub async fn check_for_updates(app: AppHandle) -> Result<UpdateInfo, String> {
    use tauri_plugin_updater::UpdaterExt;
    
    let updater = app.updater_builder().build()
        .map_err(|e| format!("Failed to create updater: {}", e))?;
    
    match updater.check().await {
        Ok(Some(update)) => {
            Ok(UpdateInfo {
                version: update.version.clone(),
                current_version: update.current_version.clone(),
                available: true,
                download_url: Some(update.download_url.clone()),
                release_notes: update.body.clone(),
            })
        }
        Ok(None) => {
            let current = app.package_info().version.to_string();
            Ok(UpdateInfo {
                version: current.clone(),
                current_version: current,
                available: false,
                download_url: None,
                release_notes: None,
            })
        }
        Err(e) => Err(format!("Failed to check for updates: {}", e)),
    }
}

#[tauri::command]
pub async fn download_and_install_update(app: AppHandle) -> Result<(), String> {
    use tauri_plugin_updater::UpdaterExt;
    
    let updater = app.updater_builder().build()
        .map_err(|e| format!("Failed to create updater: {}", e))?;
    
    match updater.check().await {
        Ok(Some(update)) => {
            // Emit download progress events
            let mut downloaded = 0;
            
            update.download_and_install(
                |chunk_length, content_length| {
                    downloaded += chunk_length;
                    if let Some(total) = content_length {
                        let progress = (downloaded as f64 / total as f64 * 100.0) as u32;
                        let _ = app.emit("update-download-progress", progress);
                    }
                },
                || {
                    let _ = app.emit("update-ready-to-install", ());
                }
            ).await.map_err(|e| format!("Failed to download update: {}", e))?;
            
            Ok(())
        }
        Ok(None) => Err("No updates available".to_string()),
        Err(e) => Err(format!("Failed to check for updates: {}", e)),
    }
}

#[tauri::command]
pub fn get_app_version(app: AppHandle) -> String {
    app.package_info().version.to_string()
}
