# Ult Brand Assets

Source logo assets for the macOS bundle and menu-bar icon.

## Files

- `app-icon.svg`: Source vector for the Dock/app bundle icon. It includes the macOS-style rounded app-icon background.
- `app-icon.png`: 1024px render used to generate Tauri app icons.
- `menubar-template.svg`: 44px source vector for the macOS menu-bar template icon.
- `menubar-template-source.png`: 1024px source render of the menu-bar glyph.

## Generated Outputs

- `src-tauri/icons/icon.icns`: macOS app bundle icon.
- `src-tauri/icons/icon.png`: PNG fallback/source icon for Tauri.
- `src-tauri/icons/tray-template.png`: compact menu-bar template icon.

The tray icon is loaded with `icon_as_template(true)`, so macOS tints it for
light and dark menu-bar appearances.
