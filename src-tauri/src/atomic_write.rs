use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::Path;
use std::time::{SystemTime, UNIX_EPOCH};

pub fn write_atomic(path: &Path, contents: &[u8], label: &str) -> Result<(), String> {
    let parent = path
        .parent()
        .ok_or_else(|| format!("{label} path has no parent directory"))?;
    fs::create_dir_all(parent).map_err(|error| {
        format!(
            "failed to create parent directory for {label} `{}`: {error}",
            parent.display()
        )
    })?;

    let file_name = path
        .file_name()
        .and_then(|name| name.to_str())
        .ok_or_else(|| format!("{label} path has no valid file name"))?;
    let suffix = unique_suffix();

    for attempt in 0..100 {
        let temp_path = parent.join(format!(".{file_name}.{suffix}.{attempt}.tmp"));
        let mut file = match OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&temp_path)
        {
            Ok(file) => file,
            Err(error) if error.kind() == std::io::ErrorKind::AlreadyExists => continue,
            Err(error) => {
                return Err(format!(
                    "failed to create temporary {label} file `{}`: {error}",
                    temp_path.display()
                ));
            }
        };

        let write_result = file
            .write_all(contents)
            .and_then(|_| file.sync_all())
            .map_err(|error| {
                format!(
                    "failed to write temporary {label} file `{}`: {error}",
                    temp_path.display()
                )
            });
        drop(file);

        if let Err(error) = write_result {
            let _ = fs::remove_file(&temp_path);
            return Err(error);
        }

        if let Err(error) = fs::rename(&temp_path, path) {
            let _ = fs::remove_file(&temp_path);
            return Err(format!(
                "failed to replace {label} `{}`: {error}",
                path.display()
            ));
        }

        return Ok(());
    }

    Err(format!(
        "failed to allocate a unique temporary file for {label} `{}`",
        path.display()
    ))
}

fn unique_suffix() -> String {
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_nanos())
        .unwrap_or(0);
    format!("{}.{}", std::process::id(), nanos)
}

#[cfg(test)]
mod tests {
    use super::write_atomic;

    #[test]
    fn atomic_write_replaces_file_contents() {
        let path = std::env::temp_dir().join(format!(
            "ult-atomic-{}-{}.txt",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .expect("time")
                .as_nanos()
        ));

        write_atomic(&path, b"old", "test").expect("first write");
        write_atomic(&path, b"new", "test").expect("second write");

        assert_eq!(std::fs::read_to_string(&path).expect("read"), "new");
        let _ = std::fs::remove_file(path);
    }
}
