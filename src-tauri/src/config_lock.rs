use std::sync::{Mutex, OnceLock};

static CONFIG_WRITE_LOCK: OnceLock<Mutex<()>> = OnceLock::new();

pub fn with_config_write_lock<T>(
    operation: impl FnOnce() -> Result<T, String>,
) -> Result<T, String> {
    let guard = CONFIG_WRITE_LOCK
        .get_or_init(|| Mutex::new(()))
        .lock()
        .map_err(|_| "config write lock poisoned".to_string())?;
    let result = operation();
    drop(guard);
    result
}

#[cfg(test)]
mod tests {
    use std::sync::{Arc, Mutex};
    use std::thread;

    use super::with_config_write_lock;

    #[test]
    fn serializes_config_writes() {
        let values = Arc::new(Mutex::new(Vec::new()));
        let mut handles = Vec::new();

        for value in 0..8 {
            let values = Arc::clone(&values);
            handles.push(thread::spawn(move || {
                with_config_write_lock(|| {
                    let mut values = values.lock().expect("values");
                    values.push(value);
                    Ok(())
                })
                .expect("locked write");
            }));
        }

        for handle in handles {
            handle.join().expect("thread");
        }

        assert_eq!(values.lock().expect("values").len(), 8);
    }

    #[test]
    fn serializes_mixed_config_writes() {
        let writes = Arc::new(Mutex::new(Vec::new()));
        let mut handles = Vec::new();

        for label in [
            "settings.toml",
            "artifact:add",
            "artifact:update",
            "usage-history.jsonl",
        ] {
            let writes = Arc::clone(&writes);
            handles.push(thread::spawn(move || {
                with_config_write_lock(|| {
                    let mut writes = writes.lock().expect("writes");
                    writes.push(label);
                    Ok(())
                })
                .expect("locked write");
            }));
        }

        for handle in handles {
            handle.join().expect("thread");
        }

        let writes = writes.lock().expect("writes");
        assert_eq!(writes.len(), 4);
        assert!(writes.contains(&"settings.toml"));
        assert!(writes.contains(&"artifact:add"));
        assert!(writes.contains(&"artifact:update"));
        assert!(writes.contains(&"usage-history.jsonl"));
    }
}
