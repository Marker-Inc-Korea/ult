use std::time::Duration;

use crate::modes::DeliveryMode;

pub(crate) const OVERLAY_PASSTHROUGH_SETTLE_DELAY: Duration = Duration::from_millis(45);
pub(crate) const TARGET_FOCUS_TIMEOUT: Duration = Duration::from_millis(220);
pub(crate) const TARGET_FOCUS_POLL_INTERVAL: Duration = Duration::from_millis(12);
pub(crate) const MOUSE_CLICK_DELAY: Duration = Duration::from_millis(20);
const INTERRUPT_DELAY: Duration = Duration::from_millis(85);
const MIN_PASTE_COMMIT_DELAY: Duration = Duration::from_millis(120);
const MAX_PASTE_COMMIT_DELAY: Duration = Duration::from_millis(850);
const POST_SEND_RESTORE_DELAY: Duration = Duration::from_millis(120);

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum DeliveryKey {
    Paste,
    Return,
    Interrupt,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum DeliveryKeyStep {
    Press(DeliveryKey),
    Wait(Duration),
}

pub(crate) fn delivery_key_steps(mode: DeliveryMode, prompt_len: usize) -> Vec<DeliveryKeyStep> {
    match mode {
        DeliveryMode::Copy => Vec::new(),
        DeliveryMode::Paste => vec![DeliveryKeyStep::Press(DeliveryKey::Paste)],
        DeliveryMode::Send => vec![
            DeliveryKeyStep::Press(DeliveryKey::Paste),
            DeliveryKeyStep::Wait(paste_commit_delay(prompt_len)),
            DeliveryKeyStep::Press(DeliveryKey::Return),
        ],
        DeliveryMode::InterruptSend => vec![
            DeliveryKeyStep::Press(DeliveryKey::Interrupt),
            DeliveryKeyStep::Wait(INTERRUPT_DELAY),
            DeliveryKeyStep::Press(DeliveryKey::Paste),
            DeliveryKeyStep::Wait(paste_commit_delay(prompt_len)),
            DeliveryKeyStep::Press(DeliveryKey::Return),
        ],
    }
}

pub(crate) fn paste_commit_delay(prompt_len: usize) -> Duration {
    let chunks = prompt_len.saturating_add(4095) / 4096;
    let scaled = MIN_PASTE_COMMIT_DELAY + Duration::from_millis((chunks as u64) * 40);
    scaled.min(MAX_PASTE_COMMIT_DELAY)
}

pub(crate) fn clipboard_restore_delay(mode: DeliveryMode, prompt_len: usize) -> Duration {
    match mode {
        DeliveryMode::Copy => Duration::ZERO,
        DeliveryMode::Paste => paste_commit_delay(prompt_len),
        DeliveryMode::Send | DeliveryMode::InterruptSend => POST_SEND_RESTORE_DELAY,
    }
}
