use std::collections::HashSet;
use std::io::Read;
use std::path::PathBuf;
use std::process::{Command, Stdio};
use std::thread;
use std::time::{Duration, Instant};

use serde::Serialize;

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
pub struct DynamicEnumResolveResult {
    pub argument_name: String,
    pub ok: bool,
    pub values: Vec<String>,
    pub truncated: bool,
    pub timed_out: bool,
    pub retryable: bool,
    pub error: Option<String>,
}

const DYNAMIC_ENUM_TIMEOUT: Duration = Duration::from_secs(3);
const DYNAMIC_ENUM_MAX_STDOUT_BYTES: usize = 64 * 1024;
const DYNAMIC_ENUM_MAX_OPTIONS: usize = 100;

pub(crate) fn resolve_dynamic_enum_argument_use_case(
    argument_name: String,
    command: String,
    working_directory: String,
) -> DynamicEnumResolveResult {
    resolve_dynamic_enum_argument_command(
        argument_name,
        command,
        working_directory,
        DYNAMIC_ENUM_TIMEOUT,
        DYNAMIC_ENUM_MAX_STDOUT_BYTES,
        DYNAMIC_ENUM_MAX_OPTIONS,
    )
}

pub(crate) fn resolve_dynamic_enum_argument_command(
    argument_name: String,
    command: String,
    working_directory: String,
    timeout: Duration,
    max_stdout_bytes: usize,
    max_options: usize,
) -> DynamicEnumResolveResult {
    let argument_name = if argument_name.trim().is_empty() {
        "argument".to_string()
    } else {
        argument_name.trim().to_string()
    };
    let command = command.trim().to_string();
    if command.is_empty() {
        return dynamic_enum_error(
            argument_name,
            "Dynamic enum command is empty.",
            false,
            false,
        );
    }
    let working_directory = working_directory.trim();
    if working_directory.is_empty() {
        return dynamic_enum_error(
            argument_name,
            "Dynamic enum working directory is required.",
            false,
            false,
        );
    }
    let working_directory = expand_home_path(working_directory);
    if !working_directory.is_dir() {
        return dynamic_enum_error(
            argument_name,
            format!(
                "Dynamic enum working directory does not exist: {}",
                working_directory.display()
            ),
            false,
            false,
        );
    }

    let mut child = match dynamic_enum_shell_command(&command)
        .current_dir(&working_directory)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
    {
        Ok(child) => child,
        Err(error) => {
            return dynamic_enum_error(
                argument_name,
                format!("Failed to start dynamic enum command: {error}"),
                false,
                true,
            );
        }
    };

    let stdout = child
        .stdout
        .take()
        .map(|pipe| read_pipe_limited(pipe, max_stdout_bytes));
    let stderr = child
        .stderr
        .take()
        .map(|pipe| read_pipe_limited(pipe, max_stdout_bytes));

    let started = Instant::now();
    let status = loop {
        match child.try_wait() {
            Ok(Some(status)) => break status,
            Ok(None) => {
                if started.elapsed() >= timeout {
                    let _ = child.kill();
                    let _ = child.wait();
                    let _ = stdout.map(|handle| handle.join());
                    let _ = stderr.map(|handle| handle.join());
                    return DynamicEnumResolveResult {
                        argument_name,
                        ok: false,
                        values: Vec::new(),
                        truncated: false,
                        timed_out: true,
                        retryable: true,
                        error: Some(format!(
                            "Dynamic enum command timed out after {}s.",
                            timeout.as_secs()
                        )),
                    };
                }
                thread::sleep(Duration::from_millis(20));
            }
            Err(error) => {
                let _ = child.kill();
                let _ = child.wait();
                let _ = stdout.map(|handle| handle.join());
                let _ = stderr.map(|handle| handle.join());
                return dynamic_enum_error(
                    argument_name,
                    format!("Failed to inspect dynamic enum command: {error}"),
                    false,
                    true,
                );
            }
        }
    };

    let stdout = stdout
        .and_then(|handle| handle.join().ok())
        .unwrap_or_default();
    let stderr = stderr
        .and_then(|handle| handle.join().ok())
        .unwrap_or_default();
    let stdout_truncated = stdout.len() > max_stdout_bytes;
    let stdout = if stdout_truncated {
        &stdout[..max_stdout_bytes]
    } else {
        stdout.as_slice()
    };

    if !status.success() {
        let stderr = String::from_utf8_lossy(&stderr);
        let detail = stderr
            .lines()
            .map(str::trim)
            .find(|line| !line.is_empty())
            .unwrap_or("command exited with a non-zero status");
        return dynamic_enum_error(
            argument_name,
            format!("Dynamic enum command failed: {detail}"),
            false,
            true,
        );
    }

    let (values, options_truncated) = dynamic_enum_values_from_stdout(stdout, max_options);
    if values.is_empty() {
        return dynamic_enum_error(
            argument_name,
            "Dynamic enum command produced no choices.",
            stdout_truncated,
            true,
        );
    }

    DynamicEnumResolveResult {
        argument_name,
        ok: true,
        values,
        truncated: stdout_truncated || options_truncated,
        timed_out: false,
        retryable: false,
        error: None,
    }
}

fn dynamic_enum_error(
    argument_name: String,
    error: impl Into<String>,
    truncated: bool,
    retryable: bool,
) -> DynamicEnumResolveResult {
    DynamicEnumResolveResult {
        argument_name,
        ok: false,
        values: Vec::new(),
        truncated,
        timed_out: false,
        retryable,
        error: Some(error.into()),
    }
}

fn dynamic_enum_values_from_stdout(stdout: &[u8], max_options: usize) -> (Vec<String>, bool) {
    let text = String::from_utf8_lossy(stdout);
    let mut seen = HashSet::new();
    let mut values = Vec::new();
    let mut truncated = false;
    for line in text.lines() {
        let value = line.trim();
        if value.is_empty() || !seen.insert(value.to_string()) {
            continue;
        }
        if values.len() >= max_options {
            truncated = true;
            break;
        }
        values.push(value.to_string());
    }
    (values, truncated)
}

fn read_pipe_limited<R: Read + Send + 'static>(
    reader: R,
    max_bytes: usize,
) -> thread::JoinHandle<Vec<u8>> {
    thread::spawn(move || {
        let mut buffer = Vec::new();
        let _ = reader
            .take(max_bytes.saturating_add(1) as u64)
            .read_to_end(&mut buffer);
        buffer
    })
}

fn expand_home_path(path: &str) -> PathBuf {
    if path == "~" {
        return std::env::var_os("HOME")
            .map(PathBuf::from)
            .unwrap_or_else(|| PathBuf::from(path));
    }
    if let Some(rest) = path.strip_prefix("~/") {
        if let Some(home) = std::env::var_os("HOME") {
            return PathBuf::from(home).join(rest);
        }
    }
    PathBuf::from(path)
}

#[cfg(target_os = "windows")]
fn dynamic_enum_shell_command(command: &str) -> Command {
    let mut shell = Command::new("cmd");
    shell.args(["/C", command]);
    shell
}

#[cfg(not(target_os = "windows"))]
fn dynamic_enum_shell_command(command: &str) -> Command {
    let mut shell = Command::new("/bin/sh");
    shell.args(["-lc", command]);
    shell
}

#[cfg(test)]
mod tests {
    use super::resolve_dynamic_enum_argument_command;
    use std::time::Duration;

    #[test]
    fn dynamic_enum_command_success_returns_stdout_lines() {
        let result = resolve_dynamic_enum_argument_command(
            "branch".to_string(),
            "printf 'main\nfeature\nmain\n'".to_string(),
            std::env::temp_dir().display().to_string(),
            Duration::from_secs(1),
            1024,
            10,
        );

        assert!(result.ok);
        assert_eq!(result.values, vec!["main", "feature"]);
        assert!(!result.truncated);
        assert_eq!(result.error, None);
    }

    #[test]
    fn dynamic_enum_command_timeout_is_retryable() {
        let result = resolve_dynamic_enum_argument_command(
            "branch".to_string(),
            "sleep 1".to_string(),
            std::env::temp_dir().display().to_string(),
            Duration::from_millis(25),
            1024,
            10,
        );

        assert!(!result.ok);
        assert!(result.timed_out);
        assert!(result.retryable);
        assert!(result.error.unwrap().contains("timed out"));
    }

    #[test]
    fn dynamic_enum_command_clamps_options() {
        let result = resolve_dynamic_enum_argument_command(
            "branch".to_string(),
            "i=0; while [ $i -lt 20 ]; do echo item-$i; i=$((i + 1)); done".to_string(),
            std::env::temp_dir().display().to_string(),
            Duration::from_secs(1),
            1024,
            5,
        );

        assert!(result.ok);
        assert_eq!(result.values.len(), 5);
        assert!(result.truncated);
    }

    #[test]
    fn dynamic_enum_command_clamps_oversized_stdout_bytes() {
        let result = resolve_dynamic_enum_argument_command(
            "branch".to_string(),
            "printf 'abcdefghijkl\nsecond\n'".to_string(),
            std::env::temp_dir().display().to_string(),
            Duration::from_secs(1),
            8,
            10,
        );

        assert!(result.ok);
        assert_eq!(result.values, vec!["abcdefgh"]);
        assert!(result.truncated);
    }

    #[test]
    fn dynamic_enum_command_failure_returns_structured_error() {
        let result = resolve_dynamic_enum_argument_command(
            "branch".to_string(),
            "printf 'bad command\n' >&2; exit 12".to_string(),
            std::env::temp_dir().display().to_string(),
            Duration::from_secs(1),
            1024,
            10,
        );

        assert!(!result.ok);
        assert!(result.retryable);
        assert!(result.values.is_empty());
        assert!(result.error.unwrap().contains("bad command"));
    }
}
