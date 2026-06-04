#[cfg(target_os = "macos")]
use std::thread;
#[cfg(target_os = "macos")]
use std::time::Duration;

#[cfg(target_os = "macos")]
use core_foundation::base::TCFType;
#[cfg(target_os = "macos")]
use core_foundation::base::{CFType, CFTypeRef};
#[cfg(target_os = "macos")]
use core_foundation::boolean::CFBoolean;
#[cfg(target_os = "macos")]
use core_foundation::dictionary::{CFDictionary, CFDictionaryRef};
#[cfg(target_os = "macos")]
use core_foundation::number::CFNumber;
#[cfg(target_os = "macos")]
use core_foundation::string::CFString;
#[cfg(target_os = "macos")]
use core_graphics::event::{CGEvent, CGEventFlags, CGEventTapLocation, CGKeyCode, KeyCode};
#[cfg(target_os = "macos")]
use core_graphics::event::{CGEventType, CGMouseButton};
#[cfg(target_os = "macos")]
use core_graphics::event_source::{CGEventSource, CGEventSourceStateID};
#[cfg(target_os = "macos")]
use core_graphics::geometry::CGPoint;
#[cfg(target_os = "macos")]
use core_graphics::window::{
    copy_window_info, kCGNullWindowID, kCGWindowBounds, kCGWindowLayer,
    kCGWindowListExcludeDesktopElements, kCGWindowListOptionOnScreenOnly, kCGWindowOwnerPID,
};
#[cfg(target_os = "macos")]
use objc2::rc::Retained;
#[cfg(target_os = "macos")]
use objc2::runtime::ProtocolObject;
#[cfg(target_os = "macos")]
use objc2_app_kit::{
    NSPasteboard, NSPasteboardItem, NSPasteboardTypeString, NSPasteboardWriting,
    NSRunningApplication, NSWorkspace,
};
#[cfg(target_os = "macos")]
use objc2_foundation::{NSArray, NSData, NSString};

#[cfg(target_os = "macos")]
use super::key_steps::DeliveryKey;
#[cfg(target_os = "macos")]
use super::runner::{DeliveryClock, InputDriver, PasteboardAdapter, WindowInspector};
#[cfg(target_os = "macos")]
use super::types::{ApplicationIdentity, ScreenPoint, WindowBounds};

#[cfg(target_os = "macos")]
pub(crate) struct MacDeliveryPlatform;

#[cfg(target_os = "macos")]
#[derive(Debug, Clone)]
pub(crate) struct ClipboardSnapshot {
    items: Option<Vec<ClipboardItem>>,
}

#[cfg(target_os = "macos")]
#[derive(Debug, Clone)]
struct ClipboardItem {
    representations: Vec<ClipboardRepresentation>,
}

#[cfg(target_os = "macos")]
#[derive(Debug, Clone)]
struct ClipboardRepresentation {
    type_id: String,
    data: Vec<u8>,
}

pub fn write_clipboard(text: &str) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        let _guard = crate::ephemeral_context::suppress_internal_pasteboard_changes();
        let pasteboard = NSPasteboard::generalPasteboard();
        pasteboard.clearContents();
        let text = NSString::from_str(text);
        if pasteboard.setString_forType(&text, unsafe { NSPasteboardTypeString }) {
            Ok(())
        } else {
            Err("failed to write string to macOS pasteboard".to_string())
        }
    }

    #[cfg(not(target_os = "macos"))]
    {
        let _ = text;
        Err("native clipboard delivery is currently implemented for macOS only".to_string())
    }
}

#[cfg(target_os = "macos")]
impl ClipboardSnapshot {
    fn capture() -> Self {
        let pasteboard = NSPasteboard::generalPasteboard();
        let Some(items) = pasteboard.pasteboardItems() else {
            return Self {
                items: Some(Vec::new()),
            };
        };

        let mut captured_items = Vec::new();
        for item in items.to_vec() {
            let Some(item) = capture_clipboard_item(&item) else {
                return Self { items: None };
            };
            captured_items.push(item);
        }
        Self {
            items: Some(captured_items),
        }
    }

    fn restore(&self) -> bool {
        let Some(items) = &self.items else {
            return false;
        };
        let _guard = crate::ephemeral_context::suppress_internal_pasteboard_changes();
        let pasteboard = NSPasteboard::generalPasteboard();
        if items.is_empty() {
            pasteboard.clearContents();
            return true;
        }

        let restored_items = items.iter().map(restore_clipboard_item).collect::<Vec<_>>();
        let object_refs = restored_items
            .iter()
            .map(|item| ProtocolObject::from_ref(&**item))
            .collect::<Vec<&ProtocolObject<dyn NSPasteboardWriting>>>();
        let objects = NSArray::from_slice(&object_refs);
        pasteboard.clearContents();
        pasteboard.writeObjects(&objects)
    }
}

#[cfg(target_os = "macos")]
fn capture_clipboard_item(item: &NSPasteboardItem) -> Option<ClipboardItem> {
    let types = item.types().to_vec();
    let type_count = types.len();
    let representations: Vec<ClipboardRepresentation> = types
        .into_iter()
        .filter_map(|type_id| {
            let data = item.dataForType(&type_id)?;
            Some(ClipboardRepresentation {
                type_id: type_id.to_string(),
                data: data.to_vec(),
            })
        })
        .collect();
    if type_count > 0 && representations.is_empty() {
        None
    } else {
        Some(ClipboardItem { representations })
    }
}

#[cfg(target_os = "macos")]
fn restore_clipboard_item(item: &ClipboardItem) -> Retained<NSPasteboardItem> {
    let restored = NSPasteboardItem::new();
    for representation in &item.representations {
        let type_id = NSString::from_str(&representation.type_id);
        let data = NSData::with_bytes(&representation.data);
        let _ = restored.setData_forType(&data, &type_id);
    }
    restored
}

pub fn accessibility_permission_status() -> bool {
    unsafe { AXIsProcessTrusted() != 0 }
}

#[cfg(not(target_os = "macos"))]
pub fn accessibility_permission_status() -> bool {
    false
}

#[cfg(target_os = "macos")]
pub fn request_accessibility_permission_prompt() -> bool {
    let options: CFDictionary<CFString, CFBoolean> = CFDictionary::from_CFType_pairs(&[(
        CFString::from_static_string("AXTrustedCheckOptionPrompt"),
        CFBoolean::true_value(),
    )]);

    unsafe { AXIsProcessTrustedWithOptions(options.as_concrete_TypeRef()) != 0 }
}

#[cfg(not(target_os = "macos"))]
pub fn request_accessibility_permission_prompt() -> bool {
    false
}

impl DeliveryClock for MacDeliveryPlatform {
    fn sleep(&mut self, duration: Duration) {
        thread::sleep(duration);
    }
}

#[cfg(target_os = "macos")]
impl PasteboardAdapter for MacDeliveryPlatform {
    type ClipboardSnapshot = ClipboardSnapshot;

    fn write_clipboard(&mut self, text: &str) -> Result<(), String> {
        write_clipboard(text)
    }

    fn capture_clipboard(&mut self) -> Self::ClipboardSnapshot {
        ClipboardSnapshot::capture()
    }

    fn restore_clipboard(&mut self, snapshot: &Self::ClipboardSnapshot) -> bool {
        snapshot.restore()
    }
}

#[cfg(target_os = "macos")]
impl WindowInspector for MacDeliveryPlatform {
    fn current_pointer_location(&mut self) -> Result<ScreenPoint, String> {
        current_pointer_location()
    }

    fn application_identity_at_screen_location(
        &mut self,
        location: ScreenPoint,
    ) -> Option<ApplicationIdentity> {
        application_identity_at_screen_location(location)
    }

    fn frontmost_application_identity(&mut self) -> Option<ApplicationIdentity> {
        frontmost_application_identity()
    }
}

#[cfg(target_os = "macos")]
impl InputDriver for MacDeliveryPlatform {
    fn mouse_down(&mut self, location: ScreenPoint) -> Result<(), String> {
        mouse_event(CGEventType::LeftMouseDown, location)
    }

    fn mouse_up(&mut self, location: ScreenPoint) -> Result<(), String> {
        mouse_event(CGEventType::LeftMouseUp, location)
    }

    fn press_key(&mut self, key: DeliveryKey) -> Result<(), String> {
        let source = CGEventSource::new(CGEventSourceStateID::HIDSystemState)
            .map_err(|_| "failed to create macOS keyboard event source".to_string())?;
        let (keycode, flags) = native_key(key);
        press_key(&source, keycode, flags)
    }
}

#[cfg(target_os = "macos")]
fn native_key(key: DeliveryKey) -> (CGKeyCode, CGEventFlags) {
    match key {
        DeliveryKey::Paste => (KeyCode::ANSI_V, CGEventFlags::CGEventFlagCommand),
        DeliveryKey::Return => (KeyCode::RETURN, CGEventFlags::empty()),
        DeliveryKey::Interrupt => (KeyCode::ANSI_C, CGEventFlags::CGEventFlagControl),
    }
}

#[cfg(target_os = "macos")]
fn press_key(
    source: &CGEventSource,
    keycode: CGKeyCode,
    flags: CGEventFlags,
) -> Result<(), String> {
    let key_down = CGEvent::new_keyboard_event(source.clone(), keycode, true)
        .map_err(|_| format!("failed to create key-down event for keycode {keycode}"))?;
    key_down.set_flags(flags);
    key_down.post(CGEventTapLocation::HID);

    let key_up = CGEvent::new_keyboard_event(source.clone(), keycode, false)
        .map_err(|_| format!("failed to create key-up event for keycode {keycode}"))?;
    key_up.set_flags(flags);
    key_up.post(CGEventTapLocation::HID);

    Ok(())
}

#[cfg(target_os = "macos")]
fn current_pointer_location() -> Result<ScreenPoint, String> {
    let source = CGEventSource::new(CGEventSourceStateID::HIDSystemState)
        .map_err(|_| "failed to create macOS mouse event source".to_string())?;
    let location = CGEvent::new(source.clone())
        .map_err(|_| "failed to read current pointer location".to_string())?
        .location();
    Ok(ScreenPoint {
        x: location.x,
        y: location.y,
    })
}

#[cfg(target_os = "macos")]
fn mouse_event(event_type: CGEventType, location: ScreenPoint) -> Result<(), String> {
    let source = CGEventSource::new(CGEventSourceStateID::HIDSystemState)
        .map_err(|_| "failed to create macOS mouse event source".to_string())?;
    post_mouse_event(&source, event_type, location)
}

#[cfg(target_os = "macos")]
fn post_mouse_event(
    source: &CGEventSource,
    event_type: CGEventType,
    location: ScreenPoint,
) -> Result<(), String> {
    let event = CGEvent::new_mouse_event(
        source.clone(),
        event_type,
        CGPoint::new(location.x, location.y),
        CGMouseButton::Left,
    )
    .map_err(|_| "failed to create macOS mouse event".to_string())?;
    event.post(CGEventTapLocation::HID);
    Ok(())
}

#[cfg(target_os = "macos")]
fn frontmost_application_identity() -> Option<ApplicationIdentity> {
    let workspace = NSWorkspace::sharedWorkspace();
    let application = workspace.frontmostApplication()?;
    Some(application_identity(&application))
}

#[cfg(target_os = "macos")]
fn application_identity_at_screen_location(location: ScreenPoint) -> Option<ApplicationIdentity> {
    let windows = copy_window_info(
        kCGWindowListOptionOnScreenOnly | kCGWindowListExcludeDesktopElements,
        kCGNullWindowID,
    )?;
    let windows = unsafe {
        core_foundation::array::CFArray::<CFType>::wrap_under_get_rule(
            windows.as_concrete_TypeRef(),
        )
    };

    for window in windows.iter() {
        let dictionary = window.downcast::<CFDictionary>()?;
        let layer = dictionary_number_i32(&dictionary, unsafe { kCGWindowLayer as CFTypeRef })?;
        if layer != 0 {
            continue;
        }

        let bounds = window_bounds(&dictionary)?;
        if !bounds.contains(location) {
            continue;
        }

        let pid = dictionary_number_i32(&dictionary, unsafe { kCGWindowOwnerPID as CFTypeRef })?;
        let application = NSRunningApplication::runningApplicationWithProcessIdentifier(pid)?;
        return Some(application_identity(&application));
    }

    None
}

#[cfg(target_os = "macos")]
fn application_identity(application: &NSRunningApplication) -> ApplicationIdentity {
    ApplicationIdentity {
        bundle_id: application
            .bundleIdentifier()
            .map(|value| value.to_string())
            .unwrap_or_default(),
        name: application
            .localizedName()
            .map(|value| value.to_string())
            .unwrap_or_default(),
    }
}

#[cfg(target_os = "macos")]
fn window_bounds(window: &CFDictionary) -> Option<WindowBounds> {
    let bounds = dictionary_value(window, unsafe { kCGWindowBounds as CFTypeRef })?
        .downcast::<CFDictionary>()?;
    Some(WindowBounds {
        x: dictionary_static_number_f64(&bounds, "X")?,
        y: dictionary_static_number_f64(&bounds, "Y")?,
        width: dictionary_static_number_f64(&bounds, "Width")?,
        height: dictionary_static_number_f64(&bounds, "Height")?,
    })
}

#[cfg(target_os = "macos")]
fn dictionary_number_i32(dictionary: &CFDictionary, key: CFTypeRef) -> Option<i32> {
    dictionary_value(dictionary, key)?
        .downcast::<CFNumber>()?
        .to_i32()
}

#[cfg(target_os = "macos")]
fn dictionary_static_number_f64(dictionary: &CFDictionary, key: &'static str) -> Option<f64> {
    let key = CFString::from_static_string(key);
    dictionary_value(dictionary, key.as_CFTypeRef())?
        .downcast::<CFNumber>()?
        .to_f64()
}

#[cfg(target_os = "macos")]
fn dictionary_value(dictionary: &CFDictionary, key: CFTypeRef) -> Option<CFType> {
    let dictionary = unsafe {
        CFDictionary::<CFType, CFType>::wrap_under_get_rule(dictionary.as_concrete_TypeRef())
    };
    dictionary.find(key).map(|value| (*value).clone())
}

#[cfg(target_os = "macos")]
#[link(name = "ApplicationServices", kind = "framework")]
extern "C" {
    fn AXIsProcessTrusted() -> u8;
    fn AXIsProcessTrustedWithOptions(options: CFDictionaryRef) -> u8;
}
