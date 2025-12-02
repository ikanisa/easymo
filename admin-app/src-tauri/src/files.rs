use std::path::PathBuf;
use tauri::Manager;
use tauri_plugin_dialog::{DialogExt, FileDialogBuilder};

#[tauri::command]
pub async fn open_file_dialog(app: tauri::AppHandle) -> Result<Option<PathBuf>, String> {
    let result = app.dialog()
        .file()
        .add_filter("EasyMO Files", &["easymo"])
        .add_filter("All Files", &["*"])
        .blocking_pick_file();
    
    match result {
        Some(file_response) => Ok(Some(file_response.path)),
        None => Ok(None),
    }
}

#[tauri::command]
pub async fn save_file_dialog(app: tauri::AppHandle, default_name: Option<String>) -> Result<Option<PathBuf>, String> {
    let mut dialog = app.dialog()
        .file()
        .add_filter("EasyMO Files", &["easymo"])
        .add_filter("All Files", &["*"]);
    
    if let Some(name) = default_name {
        dialog = dialog.set_file_name(&name);
    }
    
    let result = dialog.blocking_save_file();
    
    match result {
        Some(file_response) => Ok(Some(file_response.path)),
        None => Ok(None),
    }
}

#[tauri::command]
pub async fn read_file(path: String) -> Result<String, String> {
    std::fs::read_to_string(&path).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn write_file(path: String, contents: String) -> Result<(), String> {
    std::fs::write(&path, contents).map_err(|e| e.to_string())
}

pub fn handle_file_open(app: &tauri::AppHandle, paths: Vec<PathBuf>) {
    for path in paths {
        if let Some(ext) = path.extension() {
            if ext == "easymo" {
                // Emit event to frontend
                if let Err(e) = app.emit("file-open", path.to_str().unwrap()) {
                    eprintln!("Failed to emit file-open event: {}", e);
                }
            }
        }
    }
}
