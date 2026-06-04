#[cfg(target_os = "macos")]
use std::sync::atomic::{AtomicU64, Ordering};
#[cfg(target_os = "macos")]
use std::time::{SystemTime, UNIX_EPOCH};

#[cfg(target_os = "macos")]
use objc2_app_kit::{NSPasteboard, NSPasteboardTypeString};
#[cfg(target_os = "macos")]
use tauri::{AppHandle, Runtime};

#[cfg(target_os = "macos")]
use crate::overlay_events::EphemeralContextCapturePayload;
#[cfg(target_os = "macos")]
use crate::overlay_runtime;

#[cfg(target_os = "macos")]
const MAX_EPHEMERAL_CONTEXT_BYTES: usize = 256 * 1024;
#[cfg(target_os = "macos")]
const PREVIEW_CHARS: usize = 96;
#[cfg(target_os = "macos")]
static INTERNAL_PASTEBOARD_SUPPRESSED_UNTIL_MS: AtomicU64 = AtomicU64::new(0);
#[cfg(target_os = "macos")]
const INTERNAL_PASTEBOARD_SUPPRESSION_MS: u128 = 1_200;

#[cfg(target_os = "macos")]
pub(crate) struct InternalPasteboardChangeGuard;

#[cfg(target_os = "macos")]
pub(crate) fn suppress_internal_pasteboard_changes() -> InternalPasteboardChangeGuard {
    suppress_internal_pasteboard_changes_until(
        timestamp_ms_u128() + INTERNAL_PASTEBOARD_SUPPRESSION_MS,
    );
    InternalPasteboardChangeGuard
}

#[cfg(target_os = "macos")]
impl Drop for InternalPasteboardChangeGuard {
    fn drop(&mut self) {
        suppress_internal_pasteboard_changes_until(timestamp_ms_u128() + 250);
    }
}

#[cfg(target_os = "macos")]
fn suppress_internal_pasteboard_changes_until(until_ms: u128) {
    let until_ms = until_ms.min(u64::MAX as u128) as u64;
    let mut current = INTERNAL_PASTEBOARD_SUPPRESSED_UNTIL_MS.load(Ordering::SeqCst);
    while until_ms > current {
        match INTERNAL_PASTEBOARD_SUPPRESSED_UNTIL_MS.compare_exchange(
            current,
            until_ms,
            Ordering::SeqCst,
            Ordering::SeqCst,
        ) {
            Ok(_) => return,
            Err(next) => current = next,
        }
    }
}

#[cfg(target_os = "macos")]
pub fn capture_ephemeral_context_from_clipboard<R>(
    app: &AppHandle<R>,
    state: &crate::state::AppState,
) -> Result<EphemeralContextCapturePayload, String>
where
    R: Runtime + 'static,
{
    let text = normalized_clipboard_text()?;
    let captured_at = timestamp_ms();
    let artifact = crate::intervention_library::capture_ephemeral_context_artifact(
        app,
        text.clone(),
        captured_at,
    )?;
    let library = crate::intervention_library::load_intervention_library_from_disk(app);
    state.set_prompt_cache(library)?;

    let payload = EphemeralContextCapturePayload {
        preview: preview_text(&text),
        artifact,
        timestamp_ms: captured_at,
        pointer: overlay_runtime::current_palette_pointer(app).unwrap_or_default(),
    };
    if let Err(error) = overlay_runtime::show_ephemeral_context_feedback(app, payload.clone()) {
        tracing::debug!(error = %error, "failed to emit ephemeral context capture");
    }

    Ok(payload)
}

#[cfg(not(target_os = "macos"))]
pub fn capture_ephemeral_context_from_clipboard<R>(
    _app: &tauri::AppHandle<R>,
    _state: &crate::state::AppState,
) -> Result<crate::overlay_events::EphemeralContextCapturePayload, String>
where
    R: tauri::Runtime + 'static,
{
    Err("clipboard context capture is currently implemented for macOS only".to_string())
}

#[cfg(target_os = "macos")]
fn normalized_clipboard_text() -> Result<String, String> {
    let text = read_clipboard_text()
        .ok_or_else(|| "clipboard does not contain text to capture".to_string())?
        .trim()
        .to_string();
    if text.is_empty() {
        return Err("clipboard does not contain text to capture".to_string());
    }
    if text.len() > MAX_EPHEMERAL_CONTEXT_BYTES {
        return Err("clipboard text is too large to capture".to_string());
    }
    Ok(text)
}

#[cfg(target_os = "macos")]
fn read_clipboard_text() -> Option<String> {
    let pasteboard = NSPasteboard::generalPasteboard();
    let text = pasteboard.stringForType(unsafe { NSPasteboardTypeString })?;
    Some(text.to_string())
}

#[cfg(target_os = "macos")]
fn preview_text(text: &str) -> String {
    let first_line = text
        .lines()
        .map(str::trim)
        .find(|line| !line.is_empty())
        .unwrap_or("");
    let mut chars = first_line.chars();
    let preview = chars.by_ref().take(PREVIEW_CHARS).collect::<String>();
    if chars.next().is_some() {
        format!("{preview}...")
    } else {
        preview
    }
}

#[cfg(target_os = "macos")]
fn timestamp_ms() -> u64 {
    timestamp_ms_u128() as u64
}

#[cfg(target_os = "macos")]
fn timestamp_ms_u128() -> u128 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis())
        .unwrap_or_default()
}

#[cfg(test)]
#[cfg(target_os = "macos")]
mod tests {
    use super::preview_text;

    #[test]
    fn preview_text_uses_first_non_empty_line() {
        assert_eq!(
            preview_text("\n\n  first line  \nsecond line"),
            "first line"
        );
    }

    #[test]
    fn preview_text_truncates_long_lines() {
        let source = "a".repeat(120);
        assert_eq!(preview_text(&source), format!("{}...", "a".repeat(96)));
    }
}
