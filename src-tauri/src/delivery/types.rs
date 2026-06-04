use crate::overlay_events::DeliveryTargetApplication;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum DeliveryOutcome {
    Delivered {
        clipboard_restored: bool,
    },
    Blocked {
        reason: DeliveryBlockedReason,
    },
    Failed {
        reason: DeliveryFailureReason,
        clipboard_restored: bool,
    },
    Cancelled {
        clipboard_restored: bool,
    },
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum DeliveryBlockedReason {
    PointerUnavailable,
    TargetUnavailable,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum DeliveryFailureReason {
    ClickFailed,
    FocusTimeout,
    PasteboardWriteFailed,
    NativeKeyFailed,
}

impl DeliveryOutcome {
    pub fn clipboard_restored(self) -> bool {
        match self {
            Self::Delivered { clipboard_restored }
            | Self::Failed {
                clipboard_restored, ..
            }
            | Self::Cancelled { clipboard_restored } => clipboard_restored,
            Self::Blocked { .. } => false,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct DeliveryReport {
    pub outcome: DeliveryOutcome,
    pub target_application: Option<DeliveryTargetApplication>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct ApplicationIdentity {
    pub(crate) bundle_id: String,
    pub(crate) name: String,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub(crate) struct ScreenPoint {
    pub(crate) x: f64,
    pub(crate) y: f64,
}

#[cfg(target_os = "macos")]
#[derive(Debug, Clone, Copy, PartialEq)]
pub(crate) struct WindowBounds {
    pub(crate) x: f64,
    pub(crate) y: f64,
    pub(crate) width: f64,
    pub(crate) height: f64,
}

pub(crate) fn same_application_identity(
    left: &ApplicationIdentity,
    right: &ApplicationIdentity,
) -> bool {
    if !left.bundle_id.is_empty() && !right.bundle_id.is_empty() {
        return left.bundle_id.eq_ignore_ascii_case(&right.bundle_id);
    }
    !left.name.is_empty() && left.name.eq_ignore_ascii_case(&right.name)
}

impl ApplicationIdentity {
    pub(crate) fn target_application(&self) -> DeliveryTargetApplication {
        DeliveryTargetApplication {
            bundle_id: self.bundle_id.clone(),
            name: self.name.clone(),
        }
    }
}

#[cfg(target_os = "macos")]
impl WindowBounds {
    pub(crate) fn contains(self, location: ScreenPoint) -> bool {
        location.x >= self.x
            && location.x <= self.x + self.width
            && location.y >= self.y
            && location.y <= self.y + self.height
    }
}
