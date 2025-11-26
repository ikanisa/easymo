use tauri::Manager;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Serialize, Deserialize)]
pub struct DeepLink {
    pub action: String,
    pub params: HashMap<String, String>,
}

impl DeepLink {
    pub fn parse(url: &str) -> Result<Self, String> {
        // Parse easymo://action?param=value
        let url = url.strip_prefix("easymo://")
            .ok_or("Invalid URL scheme")?;

        let parts: Vec<&str> = url.splitn(2, '?').collect();
        let action = parts[0].to_string();
        
        let mut params = HashMap::new();
        if parts.len() > 1 {
            for param in parts[1].split('&') {
                let kv: Vec<&str> = param.splitn(2, '=').collect();
                if kv.len() == 2 {
                    params.insert(
                        kv[0].to_string(),
                        urlencoding::decode(kv[1])
                            .map_err(|e| e.to_string())?
                            .to_string()
                    );
                }
            }
        }

        Ok(DeepLink { action, params })
    }
}

pub fn handle_deep_link(app: &tauri::AppHandle, url: String) {
    match DeepLink::parse(&url) {
        Ok(link) => {
            // Emit to frontend
            if let Err(e) = app.emit_all("deep-link", link) {
                eprintln!("Failed to emit deep link event: {}", e);
            }
        }
        Err(e) => {
            eprintln!("Failed to parse deep link: {}", e);
        }
    }
}

#[tauri::command]
pub fn parse_deep_link_url(url: String) -> Result<DeepLink, String> {
    DeepLink::parse(&url)
}
