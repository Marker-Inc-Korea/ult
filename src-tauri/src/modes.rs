use std::fmt;
use std::str::FromStr;

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum DeliveryMode {
    Copy,
    Paste,
    Send,
    InterruptSend,
}

impl DeliveryMode {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Copy => "copy",
            Self::Paste => "paste",
            Self::Send => "send",
            Self::InterruptSend => "interrupt-send",
        }
    }

    pub fn requires_accessibility(self) -> bool {
        !matches!(self, Self::Copy)
    }
}

impl FromStr for DeliveryMode {
    type Err = String;

    fn from_str(value: &str) -> Result<Self, Self::Err> {
        match value.trim() {
            "copy" => Ok(Self::Copy),
            "paste" => Ok(Self::Paste),
            "send" => Ok(Self::Send),
            "interrupt-send" => Ok(Self::InterruptSend),
            other => Err(format!("unknown delivery mode: {other}")),
        }
    }
}

impl fmt::Display for DeliveryMode {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str(self.as_str())
    }
}

#[cfg(test)]
mod tests {
    use super::DeliveryMode;
    use std::str::FromStr;

    #[test]
    fn parses_delivery_modes() {
        assert_eq!(DeliveryMode::from_str("copy"), Ok(DeliveryMode::Copy));
        assert_eq!(
            DeliveryMode::from_str("interrupt-send"),
            Ok(DeliveryMode::InterruptSend)
        );
        assert!(DeliveryMode::from_str("interrupt_send").is_err());
    }
}
