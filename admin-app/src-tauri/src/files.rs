use std::path::PathBuf;
use tauri::Manager;

#[tauri::command]
pub async fn open_file_dialog(window: tauri::Window) -> Result<Option<PathBuf>, String> {
    use tauri::api::dialog::FileDialogBuilder;
    
    let (tx, rx) = std::sync::mpsc::channel();
    
    FileDialogBuilder::new()
        .add_filter("EasyMO Files", &["easymo"])
        .add_filter("All Files", &["*"])
        .pick_file(move |path| {
            tx.send(path).ok();
        });
    
    rx.recv().map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn save_file_dialog(window: tauri::Window, default_name: Option<String>) -> Result<Option<PathBuf>, String> {
    use tauri::api::dialog::FileDialogBuilder;
    
    let (tx, rx) = std::sync::mpsc::channel();
    
    let mut builder = FileDialogBuilder::new()
        .add_filter("EasyMO Files", &["easymo"])
        .add_filter("All Files", &["*"]);
    
    if let Some(name) = default_name {
        builder = builder.set_file_name(&name);
    }
    
    builder.save_file(move |path| {
        tx.send(path).ok();
    });
    
    rx.recv().map_err(|e| e.to_string())
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
                if let Err(e) = app.emit_all("file-open", path.to_str().unwrap()) {
                    eprintln!("Failed to emit file-open event: {}", e);
                }
            }
        }
    }
}
