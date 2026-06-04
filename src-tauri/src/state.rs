use std::sync::Mutex;

use serde::Serialize;

use crate::intervention_library::PromptLoadResult;
use crate::overlay_events::{DeliveryResultPayload, LauncherMode, OverlayMode};

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
pub enum OverlayLifecycle {
    #[default]
    Idle,
    Open,
    Delivering,
    Passthrough,
}

#[derive(Default)]
pub struct AppState {
    inner: Mutex<AppRuntimeState>,
}

#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize)]
pub struct PendingPreferencesRoute {
    pub section: String,
}

#[derive(Default)]
struct AppRuntimeState {
    palette_selected_artifact_id: Option<String>,
    overlay_mode: OverlayMode,
    launcher_mode: Option<LauncherMode>,
    overlay_lifecycle: OverlayLifecycle,
    prompt_cache: Option<PromptLoadResult>,
    delivery_id_counter: u64,
    overlay_generation: u64,
    active_delivery_generation: Option<u64>,
    last_delivery_result: Option<DeliveryResultPayload>,
    registered_app_shortcuts: Vec<String>,
    registered_prompt_shortcuts: Vec<String>,
    pending_preferences_route: Option<PendingPreferencesRoute>,
}

impl AppState {
    pub fn prompt_cache(&self) -> Result<Option<PromptLoadResult>, String> {
        Ok(self.runtime()?.prompt_cache.clone())
    }

    pub fn set_prompt_cache(&self, result: PromptLoadResult) -> Result<(), String> {
        self.runtime()?.prompt_cache = Some(result);
        Ok(())
    }

    pub fn selected_artifact_id(&self) -> Result<Option<String>, String> {
        Ok(self.runtime()?.palette_selected_artifact_id.clone())
    }

    pub fn set_selected_artifact_id(&self, selected_id: String) -> Result<(), String> {
        self.runtime()?.palette_selected_artifact_id = Some(selected_id);
        Ok(())
    }

    pub fn clear_selected_artifact_id(&self) -> Result<(), String> {
        self.runtime()?.palette_selected_artifact_id = None;
        Ok(())
    }

    #[cfg(test)]
    pub fn overlay_lifecycle(&self) -> Result<OverlayLifecycle, String> {
        Ok(self.runtime()?.overlay_lifecycle)
    }

    pub fn overlay_mode(&self) -> Result<OverlayMode, String> {
        Ok(self.runtime()?.overlay_mode)
    }

    pub fn launcher_mode(&self) -> Result<Option<LauncherMode>, String> {
        Ok(self.runtime()?.launcher_mode)
    }

    pub fn overlay_generation(&self) -> Result<u64, String> {
        Ok(self.runtime()?.overlay_generation)
    }

    pub fn is_overlay_idle(&self) -> Result<bool, String> {
        Ok(self.runtime()?.overlay_lifecycle == OverlayLifecycle::Idle)
    }

    pub fn open_palette(&self) -> Result<OverlayLifecycle, String> {
        let mut runtime = self.runtime()?;
        runtime.overlay_mode = OverlayMode::Palette;
        runtime.launcher_mode = None;
        runtime.overlay_lifecycle = OverlayLifecycle::Open;
        runtime.bump_overlay_generation();
        Ok(runtime.overlay_lifecycle)
    }

    pub fn open_launcher(&self, launcher_mode: LauncherMode) -> Result<OverlayLifecycle, String> {
        let mut runtime = self.runtime()?;
        runtime.overlay_mode = OverlayMode::Launcher;
        runtime.launcher_mode = Some(launcher_mode);
        runtime.overlay_lifecycle = OverlayLifecycle::Open;
        runtime.bump_overlay_generation();
        Ok(runtime.overlay_lifecycle)
    }

    pub fn unload_overlay(&self) -> Result<Option<u64>, String> {
        let mut runtime = self.runtime()?;
        let cancelled = runtime.active_delivery_generation.take();
        runtime.bump_overlay_generation();
        runtime.overlay_mode = OverlayMode::Palette;
        runtime.launcher_mode = None;
        runtime.overlay_lifecycle = OverlayLifecycle::Idle;
        Ok(cancelled)
    }

    pub fn start_delivery(&self) -> Result<u64, String> {
        let mut runtime = self.runtime()?;
        let generation = runtime.bump_overlay_generation();
        runtime.active_delivery_generation = Some(generation);
        runtime.overlay_lifecycle = OverlayLifecycle::Delivering;
        Ok(generation)
    }

    pub fn mark_passthrough(&self) -> Result<(), String> {
        self.runtime()?.overlay_lifecycle = OverlayLifecycle::Passthrough;
        Ok(())
    }

    pub fn delivery_finished(&self, generation: u64) -> Result<(), String> {
        let mut runtime = self.runtime()?;
        if runtime.active_delivery_generation == Some(generation) {
            runtime.active_delivery_generation = None;
            runtime.overlay_lifecycle = OverlayLifecycle::Idle;
        }
        Ok(())
    }

    pub fn delivery_cancelled(&self, generation: u64) -> Result<(), String> {
        let mut runtime = self.runtime()?;
        if runtime.active_delivery_generation == Some(generation) {
            runtime.active_delivery_generation = None;
            runtime.overlay_lifecycle = OverlayLifecycle::Idle;
        }
        Ok(())
    }

    pub fn next_delivery_id(&self) -> Result<u64, String> {
        let mut runtime = self.runtime()?;
        runtime.delivery_id_counter = runtime.delivery_id_counter.wrapping_add(1).max(1);
        Ok(runtime.delivery_id_counter)
    }

    pub fn overlay_generation_matches(&self, generation: u64) -> Result<bool, String> {
        Ok(self.runtime()?.overlay_generation == generation)
    }

    #[cfg(test)]
    pub fn active_delivery_generation(&self) -> Result<Option<u64>, String> {
        Ok(self.runtime()?.active_delivery_generation)
    }

    pub fn record_delivery_result(&self, result: DeliveryResultPayload) -> Result<(), String> {
        self.runtime()?.last_delivery_result = Some(result);
        Ok(())
    }

    pub fn last_delivery_result(&self) -> Result<Option<DeliveryResultPayload>, String> {
        Ok(self.runtime()?.last_delivery_result.clone())
    }

    pub fn registered_app_shortcuts(&self) -> Result<Vec<String>, String> {
        Ok(self.runtime()?.registered_app_shortcuts.clone())
    }

    pub fn set_registered_app_shortcuts(&self, shortcuts: Vec<String>) -> Result<(), String> {
        self.runtime()?.registered_app_shortcuts = shortcuts;
        Ok(())
    }

    pub fn take_registered_app_shortcuts(&self) -> Result<Vec<String>, String> {
        Ok(std::mem::take(
            &mut self.runtime()?.registered_app_shortcuts,
        ))
    }

    pub fn set_registered_prompt_shortcuts(&self, shortcuts: Vec<String>) -> Result<(), String> {
        self.runtime()?.registered_prompt_shortcuts = shortcuts;
        Ok(())
    }

    pub fn take_registered_prompt_shortcuts(&self) -> Result<Vec<String>, String> {
        Ok(std::mem::take(
            &mut self.runtime()?.registered_prompt_shortcuts,
        ))
    }

    pub fn set_pending_preferences_route(&self, section: impl Into<String>) -> Result<(), String> {
        self.runtime()?.pending_preferences_route = Some(PendingPreferencesRoute {
            section: section.into(),
        });
        Ok(())
    }

    pub fn consume_pending_preferences_route(
        &self,
    ) -> Result<Option<PendingPreferencesRoute>, String> {
        Ok(self.runtime()?.pending_preferences_route.take())
    }

    fn runtime(&self) -> Result<std::sync::MutexGuard<'_, AppRuntimeState>, String> {
        self.inner
            .lock()
            .map_err(|_| "app runtime state lock poisoned".to_string())
    }
}

impl AppRuntimeState {
    fn bump_overlay_generation(&mut self) -> u64 {
        self.overlay_generation = self.overlay_generation.wrapping_add(1).max(1);
        self.overlay_generation
    }
}

#[cfg(test)]
mod tests {
    use super::{AppState, OverlayLifecycle};
    use crate::overlay_events::{LauncherMode, OverlayMode};

    #[test]
    fn delivery_generation_can_be_cancelled() {
        let state = AppState::default();
        let generation = state.start_delivery().expect("start");
        assert!(state
            .overlay_generation_matches(generation)
            .expect("generation"));

        let cancelled = state.unload_overlay().expect("cancel");
        assert_eq!(cancelled, Some(generation));
        assert!(!state
            .overlay_generation_matches(generation)
            .expect("generation"));
        assert_eq!(
            state.overlay_lifecycle().expect("lifecycle"),
            OverlayLifecycle::Idle
        );
    }

    #[test]
    fn finishing_delivery_clears_only_matching_generation() {
        let state = AppState::default();
        let first = state.start_delivery().expect("first");
        let second = state.start_delivery().expect("second");

        state.delivery_finished(first).expect("finish first");
        assert_eq!(
            state.active_delivery_generation().expect("active"),
            Some(second)
        );

        state.delivery_finished(second).expect("finish second");
        assert_eq!(state.active_delivery_generation().expect("active"), None);
    }

    #[test]
    fn delivery_ids_do_not_change_overlay_generation() {
        let state = AppState::default();
        let delivery_id = state.next_delivery_id().expect("delivery id");
        assert_eq!(delivery_id, 1);
        assert!(!state
            .overlay_generation_matches(delivery_id)
            .expect("generation"));
    }

    #[test]
    fn selected_artifact_can_be_updated() {
        let state = AppState::default();
        assert_eq!(state.selected_artifact_id().expect("selected"), None);

        state
            .set_selected_artifact_id("scope-lock".to_string())
            .expect("set selection");
        assert_eq!(
            state.selected_artifact_id().expect("selected"),
            Some("scope-lock".to_string())
        );
    }

    #[test]
    fn pending_preferences_route_is_consumed_once() {
        let state = AppState::default();
        state
            .set_pending_preferences_route("advanced")
            .expect("set route");

        assert_eq!(
            state.consume_pending_preferences_route().expect("route"),
            Some(super::PendingPreferencesRoute {
                section: "advanced".to_string(),
            }),
        );
        assert_eq!(
            state.consume_pending_preferences_route().expect("route"),
            None,
        );
    }

    #[test]
    fn selecting_artifact_does_not_open_overlay() {
        let state = AppState::default();
        state
            .set_selected_artifact_id("scope-lock".to_string())
            .expect("set selection");
        assert_eq!(
            state.overlay_lifecycle().expect("lifecycle"),
            OverlayLifecycle::Idle
        );

        state.open_palette().expect("open");
        assert_eq!(
            state.overlay_lifecycle().expect("lifecycle"),
            OverlayLifecycle::Open
        );
    }

    #[test]
    fn scratch_overlay_mode_uses_launcher_session() {
        let state = AppState::default();
        state.open_launcher(LauncherMode::Scratch).expect("scratch");
        let open_generation = state.overlay_generation().expect("open generation");

        assert_eq!(state.overlay_mode().expect("mode"), OverlayMode::Launcher);
        assert_eq!(
            state.launcher_mode().expect("launcher mode"),
            Some(LauncherMode::Scratch)
        );
        assert_eq!(
            state.overlay_lifecycle().expect("lifecycle"),
            OverlayLifecycle::Open
        );

        state.unload_overlay().expect("unload");

        assert_eq!(state.overlay_mode().expect("mode"), OverlayMode::Palette);
        assert_eq!(state.launcher_mode().expect("launcher mode"), None);
        assert!(
            state.overlay_generation().expect("closed generation") > open_generation,
            "unloading should advance overlay event ordering"
        );
        assert_eq!(
            state.overlay_lifecycle().expect("lifecycle"),
            OverlayLifecycle::Idle
        );
    }

    #[test]
    fn search_overlay_mode_uses_launcher_session() {
        let state = AppState::default();
        state.open_launcher(LauncherMode::Search).expect("search");

        assert_eq!(state.overlay_mode().expect("mode"), OverlayMode::Launcher);
        assert_eq!(
            state.launcher_mode().expect("launcher mode"),
            Some(LauncherMode::Search)
        );
        assert_eq!(
            state.overlay_lifecycle().expect("lifecycle"),
            OverlayLifecycle::Open
        );
    }

    #[test]
    fn context_picker_overlay_mode_uses_launcher_stack_session() {
        let state = AppState::default();
        state
            .open_launcher(LauncherMode::Stack)
            .expect("context picker");

        assert_eq!(state.overlay_mode().expect("mode"), OverlayMode::Launcher);
        assert_eq!(
            state.launcher_mode().expect("launcher mode"),
            Some(LauncherMode::Stack)
        );
        assert_eq!(
            state.overlay_lifecycle().expect("lifecycle"),
            OverlayLifecycle::Open
        );
    }

    #[test]
    fn recent_overlay_mode_uses_launcher_session() {
        let state = AppState::default();
        state.open_launcher(LauncherMode::Recent).expect("recent");

        assert_eq!(state.overlay_mode().expect("mode"), OverlayMode::Launcher);
        assert_eq!(
            state.launcher_mode().expect("launcher mode"),
            Some(LauncherMode::Recent)
        );
        assert_eq!(
            state.overlay_lifecycle().expect("lifecycle"),
            OverlayLifecycle::Open
        );
    }

    #[test]
    fn overlay_lifecycle_tracks_primary_events() {
        let state = AppState::default();
        assert_eq!(
            state.overlay_lifecycle().expect("initial lifecycle"),
            OverlayLifecycle::Idle
        );

        assert_eq!(state.open_palette().expect("open"), OverlayLifecycle::Open);
        let generation = state.start_delivery().expect("apply");
        assert_eq!(
            state.overlay_lifecycle().expect("lifecycle"),
            OverlayLifecycle::Delivering
        );
        state.mark_passthrough().expect("passthrough");
        assert_eq!(
            state.overlay_lifecycle().expect("lifecycle"),
            OverlayLifecycle::Passthrough
        );
        state.delivery_finished(generation).expect("finished");
        assert_eq!(
            state.overlay_lifecycle().expect("lifecycle"),
            OverlayLifecycle::Idle
        );
        state.unload_overlay().expect("unload");
        assert_eq!(
            state.overlay_lifecycle().expect("lifecycle"),
            OverlayLifecycle::Idle
        );
    }

    #[test]
    fn repeated_open_unload_apply_sequences_are_consistent() {
        let state = AppState::default();
        state.open_palette().expect("open one");
        state.open_palette().expect("open two");
        assert_eq!(
            state.overlay_lifecycle().expect("lifecycle"),
            OverlayLifecycle::Open
        );

        let first = state.start_delivery().expect("first delivery");
        let cancelled = state.unload_overlay().expect("unload");
        assert_eq!(cancelled, Some(first));

        state.open_palette().expect("open three");
        let second = state.start_delivery().expect("second delivery");
        assert_ne!(first, second);
        state.delivery_cancelled(second).expect("cancel second");
        assert_eq!(
            state.overlay_lifecycle().expect("lifecycle"),
            OverlayLifecycle::Idle
        );
        assert_eq!(state.active_delivery_generation().expect("active"), None);
    }
}
