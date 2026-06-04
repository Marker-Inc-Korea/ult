#[derive(Debug, Clone, Copy, PartialEq)]
pub struct DisplayBounds {
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
}

pub type PhysicalDisplayBounds = DisplayBounds;

impl DisplayBounds {
    pub fn contains_point(&self, x: f64, y: f64) -> bool {
        let min_x = self.x;
        let min_y = self.y;
        let max_x = min_x + self.width;
        let max_y = min_y + self.height;
        x >= min_x && x < max_x && y >= min_y && y < max_y
    }

    fn squared_distance_to_point(&self, x: f64, y: f64) -> f64 {
        let min_x = self.x;
        let min_y = self.y;
        let max_x = min_x + self.width;
        let max_y = min_y + self.height;
        let clamped_x = x.clamp(min_x, max_x);
        let clamped_y = y.clamp(min_y, max_y);
        (x - clamped_x).powi(2) + (y - clamped_y).powi(2)
    }
}

#[cfg(test)]
pub fn display_bounds_for_point(
    displays: &[DisplayBounds],
    x: f64,
    y: f64,
) -> Option<DisplayBounds> {
    display_index_for_point(displays, x, y).map(|index| displays[index])
}

pub fn display_index_for_point(displays: &[DisplayBounds], x: f64, y: f64) -> Option<usize> {
    displays
        .iter()
        .position(|display| display.contains_point(x, y))
        .or_else(|| {
            displays
                .iter()
                .enumerate()
                .min_by(|(_, a), (_, b)| {
                    a.squared_distance_to_point(x, y)
                        .total_cmp(&b.squared_distance_to_point(x, y))
                })
                .map(|(index, _)| index)
        })
}

pub fn project_physical_cursor_to_webview(
    cursor_x: f64,
    cursor_y: f64,
    window_x: i32,
    window_y: i32,
    window_scale_factor: f64,
) -> (f64, f64) {
    let scale_factor = if window_scale_factor.is_finite() && window_scale_factor > 0.0 {
        window_scale_factor
    } else {
        1.0
    };

    (
        (cursor_x - f64::from(window_x)) / scale_factor,
        (cursor_y - f64::from(window_y)) / scale_factor,
    )
}

#[cfg(test)]
mod tests {
    use super::{
        display_bounds_for_point, display_index_for_point, project_physical_cursor_to_webview,
        DisplayBounds, PhysicalDisplayBounds,
    };

    #[test]
    fn selects_display_containing_cursor() {
        let display = display_bounds_for_point(
            &[DisplayBounds {
                x: 0.0,
                y: 0.0,
                width: 1440.0,
                height: 900.0,
            }],
            600.0,
            300.0,
        )
        .expect("display");

        assert_eq!(display.x, 0.0);
        assert_eq!(display.y, 0.0);
        assert_eq!(display.width, 1440.0);
        assert_eq!(display.height, 900.0);
    }

    #[test]
    fn selects_negative_origin_display_containing_cursor() {
        let display = display_bounds_for_point(
            &[
                DisplayBounds {
                    x: -1920.0,
                    y: 0.0,
                    width: 1920.0,
                    height: 1080.0,
                },
                DisplayBounds {
                    x: 0.0,
                    y: -180.0,
                    width: 2560.0,
                    height: 1440.0,
                },
            ],
            -1200.0,
            400.0,
        )
        .expect("display");

        assert_eq!(display.x, -1920.0);
        assert_eq!(display.y, 0.0);
        assert_eq!(display.width, 1920.0);
        assert_eq!(display.height, 1080.0);
    }

    #[test]
    fn falls_back_to_nearest_display_when_cursor_is_between_displays() {
        let display = display_bounds_for_point(
            &[
                DisplayBounds {
                    x: 0.0,
                    y: 0.0,
                    width: 100.0,
                    height: 100.0,
                },
                DisplayBounds {
                    x: 300.0,
                    y: 0.0,
                    width: 100.0,
                    height: 100.0,
                },
            ],
            260.0,
            50.0,
        )
        .expect("display");

        assert_eq!(display.x, 300.0);
    }

    #[test]
    fn selects_vertically_stacked_display() {
        let displays = [
            PhysicalDisplayBounds {
                x: 0.0,
                y: -1200.0,
                width: 1920.0,
                height: 1200.0,
            },
            PhysicalDisplayBounds {
                x: 0.0,
                y: 0.0,
                width: 2560.0,
                height: 1440.0,
            },
        ];

        assert_eq!(display_index_for_point(&displays, 800.0, -400.0), Some(0));
        assert_eq!(display_index_for_point(&displays, 800.0, 400.0), Some(1));
    }

    #[test]
    fn selects_mixed_scale_display_using_physical_bounds() {
        let displays = [
            PhysicalDisplayBounds {
                x: 0.0,
                y: 0.0,
                width: 2880.0,
                height: 1800.0,
            },
            PhysicalDisplayBounds {
                x: 2880.0,
                y: 0.0,
                width: 1920.0,
                height: 1080.0,
            },
        ];

        assert_eq!(display_index_for_point(&displays, 1400.0, 900.0), Some(0));
        assert_eq!(display_index_for_point(&displays, 3200.0, 400.0), Some(1));
    }

    #[test]
    fn returns_none_without_displays() {
        assert!(display_bounds_for_point(&[], 0.0, 0.0).is_none());
    }

    #[test]
    fn projects_cursor_with_window_scale_factor() {
        let (x, y) = project_physical_cursor_to_webview(2200.0, 600.0, 1200, 200, 2.0);
        assert_eq!(x, 500.0);
        assert_eq!(y, 200.0);
    }

    #[test]
    fn projects_mixed_scale_secondary_display_to_webview_space() {
        let (x, y) = project_physical_cursor_to_webview(3200.0, 400.0, 2880, 0, 1.0);
        assert_eq!(x, 320.0);
        assert_eq!(y, 400.0);

        let (x, y) = project_physical_cursor_to_webview(1400.0, 900.0, 0, 0, 2.0);
        assert_eq!(x, 700.0);
        assert_eq!(y, 450.0);
    }

    #[test]
    fn projection_falls_back_for_invalid_scale_factor() {
        let (x, y) = project_physical_cursor_to_webview(200.0, 120.0, 50, 20, 0.0);
        assert_eq!(x, 150.0);
        assert_eq!(y, 100.0);
    }
}
