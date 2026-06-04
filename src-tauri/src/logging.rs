use tauri::{AppHandle, Runtime};
use tracing::{error, info, warn};

pub fn init_tracing() {
    let _ = tracing_subscriber::fmt()
        .with_target(true)
        .without_time()
        .try_init();
}

pub fn info_event<R: Runtime>(_app: &AppHandle<R>, source: &str, message: &str) {
    info!(source, message);
}

pub fn warn_event<R: Runtime>(_app: &AppHandle<R>, source: &str, message: &str) {
    warn!(source, message);
}

pub fn error_event<R: Runtime>(_app: &AppHandle<R>, source: &str, message: &str) {
    error!(source, message);
}
