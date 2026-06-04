use std::time::Duration;

use crate::modes::DeliveryMode;
use crate::overlay_events::DeliveryTargetApplication;

use super::key_steps::{
    clipboard_restore_delay, delivery_key_steps, DeliveryKey, DeliveryKeyStep, MOUSE_CLICK_DELAY,
    OVERLAY_PASSTHROUGH_SETTLE_DELAY, TARGET_FOCUS_POLL_INTERVAL, TARGET_FOCUS_TIMEOUT,
};
#[cfg(target_os = "macos")]
use super::macos::MacDeliveryPlatform;
use super::types::{
    same_application_identity, ApplicationIdentity, DeliveryBlockedReason, DeliveryFailureReason,
    DeliveryOutcome, DeliveryReport, ScreenPoint,
};

pub struct DeliveryCoordinator {
    text: String,
    mode: DeliveryMode,
}

#[cfg(test)]
#[derive(Debug, Clone, PartialEq, Eq)]
struct DeliveryTargetInspection {
    pub target_application: Option<DeliveryTargetApplication>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum DeliveryPhase {
    SettleOverlay,
    ResolvePointer,
    ValidateTarget,
    ClickTarget,
    WaitForFocus,
    CaptureClipboard,
    StagePrompt,
    SendKeys,
    RestoreClipboard,
    Finished,
}

pub(crate) trait DeliveryClock {
    fn sleep(&mut self, duration: Duration);
}

pub(crate) trait PasteboardAdapter {
    type ClipboardSnapshot;

    fn write_clipboard(&mut self, text: &str) -> Result<(), String>;
    fn capture_clipboard(&mut self) -> Self::ClipboardSnapshot;
    fn restore_clipboard(&mut self, snapshot: &Self::ClipboardSnapshot) -> bool;
}

pub(crate) trait WindowInspector {
    fn current_pointer_location(&mut self) -> Result<ScreenPoint, String>;
    fn application_identity_at_screen_location(
        &mut self,
        location: ScreenPoint,
    ) -> Option<ApplicationIdentity>;
    fn frontmost_application_identity(&mut self) -> Option<ApplicationIdentity>;
}

pub(crate) trait InputDriver {
    fn mouse_down(&mut self, location: ScreenPoint) -> Result<(), String>;
    fn mouse_up(&mut self, location: ScreenPoint) -> Result<(), String>;
    fn press_key(&mut self, key: DeliveryKey) -> Result<(), String>;
}

pub(crate) trait DeliveryPlatform:
    DeliveryClock + PasteboardAdapter + WindowInspector + InputDriver
{
}

impl<T> DeliveryPlatform for T where
    T: DeliveryClock + PasteboardAdapter + WindowInspector + InputDriver
{
}

struct DeliveryRunner<'a, F, P>
where
    F: Fn() -> Result<bool, String>,
    P: DeliveryPlatform,
{
    coordinator: &'a DeliveryCoordinator,
    should_cancel: &'a F,
    platform: P,
    phase: DeliveryPhase,
    location: Option<ScreenPoint>,
    target_identity: Option<ApplicationIdentity>,
    target_application: Option<DeliveryTargetApplication>,
    clipboard_snapshot: Option<P::ClipboardSnapshot>,
    clipboard_restored: bool,
}

impl DeliveryCoordinator {
    pub fn new(text: String, mode: DeliveryMode) -> Self {
        Self { text, mode }
    }

    #[cfg(target_os = "macos")]
    pub fn deliver_to_current_pointer<F>(&self, should_cancel: F) -> Result<DeliveryReport, String>
    where
        F: Fn() -> Result<bool, String>,
    {
        DeliveryRunner::new(self, &should_cancel, MacDeliveryPlatform).run()
    }

    #[cfg(test)]
    fn inspect_current_pointer_target_with_platform<P>(
        &self,
        platform: &mut P,
    ) -> Result<DeliveryTargetInspection, String>
    where
        P: WindowInspector,
    {
        let location = platform.current_pointer_location()?;
        let Some(identity) = platform.application_identity_at_screen_location(location) else {
            return Ok(DeliveryTargetInspection {
                target_application: None,
            });
        };
        Ok(DeliveryTargetInspection {
            target_application: Some(identity.target_application()),
        })
    }
}

impl<'a, F, P> DeliveryRunner<'a, F, P>
where
    F: Fn() -> Result<bool, String>,
    P: DeliveryPlatform,
{
    fn new(coordinator: &'a DeliveryCoordinator, should_cancel: &'a F, platform: P) -> Self {
        Self {
            coordinator,
            should_cancel,
            platform,
            phase: DeliveryPhase::ResolvePointer,
            location: None,
            target_identity: None,
            target_application: None,
            clipboard_snapshot: None,
            clipboard_restored: false,
        }
    }

    fn run(&mut self) -> Result<DeliveryReport, String> {
        loop {
            if self.cancelled()? {
                let clipboard_restored = self.restore_clipboard();
                return Ok(self.report(DeliveryOutcome::Cancelled { clipboard_restored }));
            }

            match self.phase {
                DeliveryPhase::SettleOverlay => {
                    self.wait(OVERLAY_PASSTHROUGH_SETTLE_DELAY);
                    self.phase = DeliveryPhase::ValidateTarget;
                }
                DeliveryPhase::ResolvePointer => {
                    self.location = match self.platform.current_pointer_location() {
                        Ok(location) => Some(location),
                        Err(error) => {
                            tracing::warn!(
                                error = %error,
                                "failed to read pointer location before delivery; blocking native delivery"
                            );
                            return Ok(self.report(DeliveryOutcome::Blocked {
                                reason: DeliveryBlockedReason::PointerUnavailable,
                            }));
                        }
                    };
                    self.phase = DeliveryPhase::SettleOverlay;
                }
                DeliveryPhase::ValidateTarget => {
                    let Some(identity) = self
                        .platform
                        .application_identity_at_screen_location(self.location()?)
                    else {
                        return Ok(self.report(DeliveryOutcome::Blocked {
                            reason: DeliveryBlockedReason::TargetUnavailable,
                        }));
                    };
                    self.target_application = Some(identity.target_application());
                    self.target_identity = Some(identity);
                    self.phase = DeliveryPhase::ClickTarget;
                }
                DeliveryPhase::ClickTarget => {
                    if let Err(error) = self.click_target() {
                        tracing::warn!(
                            error = %error,
                            "failed to click target before delivery"
                        );
                        return Ok(self.report(DeliveryOutcome::Failed {
                            reason: DeliveryFailureReason::ClickFailed,
                            clipboard_restored: false,
                        }));
                    }
                    if self.cancelled()? {
                        return Ok(self.report(DeliveryOutcome::Cancelled {
                            clipboard_restored: false,
                        }));
                    }
                    self.phase = DeliveryPhase::WaitForFocus;
                }
                DeliveryPhase::WaitForFocus => match self.wait_for_target_focus() {
                    Ok(true) => self.phase = DeliveryPhase::CaptureClipboard,
                    Ok(false) => {
                        return Ok(self.report(DeliveryOutcome::Cancelled {
                            clipboard_restored: false,
                        }));
                    }
                    Err(error) => {
                        tracing::warn!(
                            error = %error,
                            "target did not receive focus before delivery"
                        );
                        return Ok(self.report(DeliveryOutcome::Failed {
                            reason: DeliveryFailureReason::FocusTimeout,
                            clipboard_restored: false,
                        }));
                    }
                },
                DeliveryPhase::CaptureClipboard => {
                    self.clipboard_snapshot = Some(self.platform.capture_clipboard());
                    self.phase = DeliveryPhase::StagePrompt;
                }
                DeliveryPhase::StagePrompt => {
                    if let Err(error) = self.platform.write_clipboard(&self.coordinator.text) {
                        tracing::warn!(error = %error, "failed to stage prompt on clipboard");
                        let clipboard_restored = self.restore_clipboard();
                        return Ok(self.report(DeliveryOutcome::Failed {
                            reason: DeliveryFailureReason::PasteboardWriteFailed,
                            clipboard_restored,
                        }));
                    }
                    self.phase = DeliveryPhase::SendKeys;
                }
                DeliveryPhase::SendKeys => match self.send_delivery_keys() {
                    Ok(true) => self.phase = DeliveryPhase::RestoreClipboard,
                    Ok(false) => {
                        let clipboard_restored = self.restore_clipboard();
                        return Ok(self.report(DeliveryOutcome::Cancelled { clipboard_restored }));
                    }
                    Err(error) => {
                        tracing::warn!(error = %error, "failed to send native delivery keys");
                        let clipboard_restored = self.restore_clipboard();
                        return Ok(self.report(DeliveryOutcome::Failed {
                            reason: DeliveryFailureReason::NativeKeyFailed,
                            clipboard_restored,
                        }));
                    }
                },
                DeliveryPhase::RestoreClipboard => {
                    self.wait(clipboard_restore_delay(
                        self.coordinator.mode,
                        self.coordinator.text.len(),
                    ));
                    if self.cancelled()? {
                        let clipboard_restored = self.restore_clipboard();
                        return Ok(self.report(DeliveryOutcome::Cancelled { clipboard_restored }));
                    }
                    self.clipboard_restored = self.restore_clipboard();
                    self.phase = DeliveryPhase::Finished;
                }
                DeliveryPhase::Finished => {
                    return Ok(self.report(DeliveryOutcome::Delivered {
                        clipboard_restored: self.clipboard_restored,
                    }));
                }
            }
        }
    }

    fn location(&self) -> Result<ScreenPoint, String> {
        self.location
            .ok_or_else(|| "delivery location was not resolved".to_string())
    }

    fn cancelled(&self) -> Result<bool, String> {
        (self.should_cancel)()
    }

    fn wait(&mut self, duration: Duration) {
        self.platform.sleep(duration);
    }

    fn click_target(&mut self) -> Result<(), String> {
        let location = self.location()?;
        self.platform.mouse_down(location)?;
        self.wait(MOUSE_CLICK_DELAY);
        self.platform.mouse_up(location)
    }

    fn wait_for_target_focus(&mut self) -> Result<bool, String> {
        let target = self
            .target_identity
            .clone()
            .ok_or_else(|| "delivery target identity was not resolved".to_string())?;
        let mut elapsed = Duration::ZERO;
        loop {
            if self.cancelled()? {
                return Ok(false);
            }

            if let Some(frontmost) = self.platform.frontmost_application_identity() {
                if same_application_identity(&target, &frontmost) {
                    return Ok(true);
                }
            }

            if elapsed >= TARGET_FOCUS_TIMEOUT {
                return Err("target app did not become frontmost before timeout".to_string());
            }

            self.wait(TARGET_FOCUS_POLL_INTERVAL);
            elapsed += TARGET_FOCUS_POLL_INTERVAL;
        }
    }

    fn send_delivery_keys(&mut self) -> Result<bool, String> {
        for step in delivery_key_steps(self.coordinator.mode, self.coordinator.text.len()) {
            if self.cancelled()? {
                return Ok(false);
            }

            match step {
                DeliveryKeyStep::Press(key) => self.platform.press_key(key)?,
                DeliveryKeyStep::Wait(duration) => self.wait(duration),
            }

            if self.cancelled()? {
                return Ok(false);
            }
        }

        Ok(true)
    }

    fn restore_clipboard(&mut self) -> bool {
        self.clipboard_snapshot
            .take()
            .is_some_and(|snapshot| self.platform.restore_clipboard(&snapshot))
    }

    fn report(&self, outcome: DeliveryOutcome) -> DeliveryReport {
        DeliveryReport {
            outcome,
            target_application: self.target_application.clone(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::{
        DeliveryClock, DeliveryCoordinator, DeliveryRunner, InputDriver, PasteboardAdapter,
        WindowInspector,
    };
    use crate::delivery::key_steps::{paste_commit_delay, DeliveryKey};
    use crate::delivery::types::{
        ApplicationIdentity, DeliveryBlockedReason, DeliveryFailureReason, DeliveryOutcome,
        ScreenPoint,
    };
    use crate::modes::DeliveryMode;
    use std::cell::Cell;
    use std::collections::VecDeque;
    use std::time::Duration;

    #[derive(Debug, Clone, Copy, PartialEq, Eq)]
    struct FakeClipboardSnapshot(usize);

    struct FakeDeliveryPlatform {
        pointer_result: Result<ScreenPoint, String>,
        app_at_pointer: Option<ApplicationIdentity>,
        frontmost_sequence: VecDeque<Option<ApplicationIdentity>>,
        written_clipboard: Vec<String>,
        sleeps: Vec<Duration>,
        keys: Vec<DeliveryKey>,
        mouse_downs: Vec<ScreenPoint>,
        mouse_ups: Vec<ScreenPoint>,
        capture_count: usize,
        restore_count: usize,
        restore_result: bool,
        fail_click: bool,
        fail_key: bool,
    }

    impl FakeDeliveryPlatform {
        fn terminal() -> ApplicationIdentity {
            ApplicationIdentity {
                bundle_id: "com.apple.terminal".to_string(),
                name: "Terminal".to_string(),
            }
        }

        fn finder() -> ApplicationIdentity {
            ApplicationIdentity {
                bundle_id: "com.apple.finder".to_string(),
                name: "Finder".to_string(),
            }
        }

        fn ready_terminal() -> Self {
            Self {
                pointer_result: Ok(ScreenPoint { x: 42.0, y: 24.0 }),
                app_at_pointer: Some(Self::terminal()),
                frontmost_sequence: VecDeque::from([Some(Self::terminal())]),
                written_clipboard: Vec::new(),
                sleeps: Vec::new(),
                keys: Vec::new(),
                mouse_downs: Vec::new(),
                mouse_ups: Vec::new(),
                capture_count: 0,
                restore_count: 0,
                restore_result: true,
                fail_click: false,
                fail_key: false,
            }
        }
    }

    impl DeliveryClock for FakeDeliveryPlatform {
        fn sleep(&mut self, duration: Duration) {
            self.sleeps.push(duration);
        }
    }

    impl PasteboardAdapter for FakeDeliveryPlatform {
        type ClipboardSnapshot = FakeClipboardSnapshot;

        fn write_clipboard(&mut self, text: &str) -> Result<(), String> {
            self.written_clipboard.push(text.to_string());
            Ok(())
        }

        fn capture_clipboard(&mut self) -> Self::ClipboardSnapshot {
            self.capture_count += 1;
            FakeClipboardSnapshot(self.capture_count)
        }

        fn restore_clipboard(&mut self, _snapshot: &Self::ClipboardSnapshot) -> bool {
            self.restore_count += 1;
            self.restore_result
        }
    }

    impl WindowInspector for FakeDeliveryPlatform {
        fn current_pointer_location(&mut self) -> Result<ScreenPoint, String> {
            self.pointer_result.clone()
        }

        fn application_identity_at_screen_location(
            &mut self,
            _location: ScreenPoint,
        ) -> Option<ApplicationIdentity> {
            self.app_at_pointer.clone()
        }

        fn frontmost_application_identity(&mut self) -> Option<ApplicationIdentity> {
            self.frontmost_sequence.pop_front().flatten()
        }
    }

    impl InputDriver for FakeDeliveryPlatform {
        fn mouse_down(&mut self, location: ScreenPoint) -> Result<(), String> {
            if self.fail_click {
                return Err("click failed".to_string());
            }
            self.mouse_downs.push(location);
            Ok(())
        }

        fn mouse_up(&mut self, location: ScreenPoint) -> Result<(), String> {
            if self.fail_click {
                return Err("click failed".to_string());
            }
            self.mouse_ups.push(location);
            Ok(())
        }

        fn press_key(&mut self, key: DeliveryKey) -> Result<(), String> {
            if self.fail_key {
                return Err("key failed".to_string());
            }
            self.keys.push(key);
            Ok(())
        }
    }

    fn test_coordinator(mode: DeliveryMode) -> DeliveryCoordinator {
        DeliveryCoordinator::new("prompt text".to_string(), mode)
    }

    #[test]
    fn paste_commit_delay_scales_with_prompt_size() {
        assert!(paste_commit_delay(10) >= Duration::from_millis(120));
        assert!(paste_commit_delay(200_000) <= Duration::from_millis(850));
    }

    #[test]
    fn delivery_pointer_read_failure_blocks_without_copying() {
        let coordinator = test_coordinator(DeliveryMode::Send);
        let should_cancel = || Ok(false);
        let mut platform = FakeDeliveryPlatform::ready_terminal();
        platform.pointer_result = Err("no pointer".to_string());
        let mut runner = DeliveryRunner::new(&coordinator, &should_cancel, platform);

        let report = runner.run().expect("delivery should produce a report");

        assert_eq!(
            report.outcome,
            DeliveryOutcome::Blocked {
                reason: DeliveryBlockedReason::PointerUnavailable
            }
        );
        assert!(runner.platform.written_clipboard.is_empty());
        assert!(runner.platform.mouse_downs.is_empty());
        assert_eq!(runner.platform.capture_count, 0);
    }

    #[test]
    fn delivery_explicit_target_is_not_blocked_by_app_settings() {
        let coordinator = test_coordinator(DeliveryMode::Send);
        let should_cancel = || Ok(false);
        let mut platform = FakeDeliveryPlatform::ready_terminal();
        platform.app_at_pointer = Some(FakeDeliveryPlatform::finder());
        platform.frontmost_sequence = VecDeque::from([Some(FakeDeliveryPlatform::finder())]);
        let mut runner = DeliveryRunner::new(&coordinator, &should_cancel, platform);

        let report = runner.run().expect("delivery should produce a report");

        assert_eq!(
            report.outcome,
            DeliveryOutcome::Delivered {
                clipboard_restored: true
            }
        );
        assert_eq!(runner.platform.written_clipboard, vec!["prompt text"]);
        assert_eq!(
            report.target_application,
            Some(FakeDeliveryPlatform::finder().target_application()),
        );
        assert_eq!(runner.platform.mouse_downs.len(), 1);
        assert_eq!(runner.platform.capture_count, 1);
    }

    #[test]
    fn target_inspection_reports_pointer_target_without_side_effects() {
        let coordinator = test_coordinator(DeliveryMode::Paste);
        let mut platform = FakeDeliveryPlatform::ready_terminal();

        let inspection = coordinator
            .inspect_current_pointer_target_with_platform(&mut platform)
            .expect("target inspection should succeed");

        assert_eq!(
            inspection.target_application,
            Some(FakeDeliveryPlatform::terminal().target_application()),
        );
        assert!(platform.written_clipboard.is_empty());
        assert!(platform.mouse_downs.is_empty());
        assert!(platform.keys.is_empty());
    }

    #[test]
    fn target_inspection_accepts_explicit_pointer_target_without_side_effects() {
        let coordinator = test_coordinator(DeliveryMode::Paste);
        let mut platform = FakeDeliveryPlatform::ready_terminal();
        platform.app_at_pointer = Some(FakeDeliveryPlatform::finder());

        let inspection = coordinator
            .inspect_current_pointer_target_with_platform(&mut platform)
            .expect("target inspection should succeed");

        assert_eq!(
            inspection.target_application,
            Some(FakeDeliveryPlatform::finder().target_application()),
        );
        assert!(platform.written_clipboard.is_empty());
        assert!(platform.mouse_downs.is_empty());
        assert!(platform.keys.is_empty());
    }

    #[test]
    fn delivery_focus_timeout_reports_failure_without_copying() {
        let coordinator = test_coordinator(DeliveryMode::Send);
        let should_cancel = || Ok(false);
        let mut platform = FakeDeliveryPlatform::ready_terminal();
        platform.frontmost_sequence = VecDeque::new();
        let mut runner = DeliveryRunner::new(&coordinator, &should_cancel, platform);

        let report = runner.run().expect("delivery should produce a report");

        assert_eq!(
            report.outcome,
            DeliveryOutcome::Failed {
                reason: DeliveryFailureReason::FocusTimeout,
                clipboard_restored: false,
            }
        );
        assert!(runner.platform.written_clipboard.is_empty());
        assert_eq!(runner.platform.mouse_downs.len(), 1);
        assert_eq!(runner.platform.capture_count, 0);
    }

    #[test]
    fn delivery_key_failure_restores_staged_clipboard() {
        let coordinator = test_coordinator(DeliveryMode::Send);
        let should_cancel = || Ok(false);
        let mut platform = FakeDeliveryPlatform::ready_terminal();
        platform.fail_key = true;
        let mut runner = DeliveryRunner::new(&coordinator, &should_cancel, platform);

        let report = runner.run().expect("delivery should produce a report");

        assert_eq!(
            report.outcome,
            DeliveryOutcome::Failed {
                reason: DeliveryFailureReason::NativeKeyFailed,
                clipboard_restored: true,
            }
        );
        assert_eq!(runner.platform.written_clipboard, vec!["prompt text"]);
        assert_eq!(runner.platform.capture_count, 1);
        assert_eq!(runner.platform.restore_count, 1);
    }

    #[test]
    fn delivery_cancellation_restores_clipboard_when_possible() {
        let coordinator = test_coordinator(DeliveryMode::Paste);
        let cancel_checks = Cell::new(0);
        let should_cancel = || {
            let next = cancel_checks.get() + 1;
            cancel_checks.set(next);
            Ok(next >= 11)
        };
        let platform = FakeDeliveryPlatform::ready_terminal();
        let mut runner = DeliveryRunner::new(&coordinator, &should_cancel, platform);

        let report = runner.run().expect("delivery should produce a report");

        assert_eq!(
            report.outcome,
            DeliveryOutcome::Cancelled {
                clipboard_restored: true
            }
        );
        assert_eq!(runner.platform.written_clipboard, vec!["prompt text"]);
        assert_eq!(runner.platform.capture_count, 1);
        assert_eq!(runner.platform.restore_count, 1);
        assert!(runner.platform.keys.is_empty());
    }

    #[test]
    fn delivery_success_restores_clipboard_when_possible() {
        let coordinator = test_coordinator(DeliveryMode::Send);
        let should_cancel = || Ok(false);
        let platform = FakeDeliveryPlatform::ready_terminal();
        let mut runner = DeliveryRunner::new(&coordinator, &should_cancel, platform);

        let report = runner.run().expect("delivery should produce a report");

        assert_eq!(
            report.outcome,
            DeliveryOutcome::Delivered {
                clipboard_restored: true
            }
        );
        assert_eq!(runner.platform.written_clipboard, vec!["prompt text"]);
        assert_eq!(
            runner.platform.keys,
            vec![DeliveryKey::Paste, DeliveryKey::Return]
        );
        assert_eq!(runner.platform.capture_count, 1);
        assert_eq!(runner.platform.restore_count, 1);
    }
}
