use std::time::Duration;

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Runtime};

use crate::intervention_library::{
    import_github_library_pack as import_github_library_pack_to_library,
    preview_github_library_import as preview_github_library_import_from_library,
    GitHubLibraryImportFile, GitHubLibraryImportPreview, GitHubLibraryImportRequest,
    GitHubLibraryImportSelection, GitHubLibraryImportSource, GitHubLibraryImportSummary,
    PromptLoadResult,
};
use crate::logging::info_event;
use crate::state::AppState;

#[derive(Debug, Serialize)]
pub struct GitHubLibraryImportCommandResult {
    pub library: PromptLoadResult,
    pub imported_count: usize,
    pub updated_count: usize,
    pub imported_artifact_ids: Vec<String>,
    pub commit: String,
}

const GITHUB_IMPORT_TIMEOUT: Duration = Duration::from_secs(20);
const GITHUB_IMPORT_USER_AGENT: &str = "Ult GitHub Library Import";

pub(crate) async fn preview_github_library_import_use_case<R: Runtime>(
    app: &AppHandle<R>,
    request: GitHubLibraryImportRequest,
) -> Result<GitHubLibraryImportPreview, String> {
    let (source, files, warnings) = fetch_github_library_import_files(&request).await?;
    preview_github_library_import_from_library(app, source, files, warnings)
}

pub(crate) async fn import_github_library_pack_use_case<R: Runtime>(
    app: &AppHandle<R>,
    state: &AppState,
    selection: GitHubLibraryImportSelection,
) -> Result<GitHubLibraryImportCommandResult, String> {
    let request = GitHubLibraryImportRequest {
        url: selection.url.clone(),
        reference: selection.reference.clone(),
    };
    let (source, files, warnings) = fetch_github_library_import_files(&request).await?;
    let summary = import_github_library_pack_to_library(
        app,
        source,
        files,
        selection.selected_paths,
        warnings,
    )?;
    if let Some(prompt_id) = summary.imported_artifact_ids.first() {
        state.set_selected_artifact_id(prompt_id.clone())?;
    }
    info_event(app, "intervention-library", "GitHub import completed");
    Ok(github_import_command_result(
        summary,
        super::load_prompt_cache_for_app(app, state, true)?,
    ))
}

fn github_import_command_result(
    summary: GitHubLibraryImportSummary,
    library: PromptLoadResult,
) -> GitHubLibraryImportCommandResult {
    GitHubLibraryImportCommandResult {
        library,
        imported_count: summary.imported_count,
        updated_count: summary.updated_count,
        imported_artifact_ids: summary.imported_artifact_ids,
        commit: summary.commit,
    }
}

#[derive(Debug, Deserialize)]
struct GitHubRepoResponse {
    default_branch: String,
}

#[derive(Debug, Deserialize)]
struct GitHubCommitResponse {
    sha: String,
}

#[derive(Debug, Deserialize)]
struct GitHubTreeResponse {
    tree: Vec<GitHubTreeEntry>,
    #[serde(default)]
    truncated: bool,
}

#[derive(Debug, Deserialize)]
struct GitHubTreeEntry {
    path: String,
    #[serde(rename = "type")]
    kind: String,
}

struct ParsedGitHubRepoUrl {
    owner: String,
    repo: String,
    reference: Option<String>,
}

async fn fetch_github_library_import_files(
    request: &GitHubLibraryImportRequest,
) -> Result<
    (
        GitHubLibraryImportSource,
        Vec<GitHubLibraryImportFile>,
        Vec<String>,
    ),
    String,
> {
    let parsed = parse_github_repo_url(&request.url)?;
    let requested_ref = request
        .reference
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToString::to_string)
        .or(parsed.reference.clone());
    let client = reqwest::Client::builder()
        .timeout(GITHUB_IMPORT_TIMEOUT)
        .build()
        .map_err(|error| format!("failed to create GitHub import client: {error}"))?;
    let resolved_ref = match requested_ref.as_deref() {
        Some(reference) => reference.to_string(),
        None => {
            let repo_url = format!(
                "https://api.github.com/repos/{}/{}",
                encode_github_path_segment(&parsed.owner),
                encode_github_path_segment(&parsed.repo)
            );
            github_get_json::<GitHubRepoResponse>(&client, &repo_url)
                .await?
                .default_branch
        }
    };
    let commit_url = format!(
        "https://api.github.com/repos/{}/{}/commits/{}",
        encode_github_path_segment(&parsed.owner),
        encode_github_path_segment(&parsed.repo),
        encode_github_path_segment(&resolved_ref)
    );
    let commit = github_get_json::<GitHubCommitResponse>(&client, &commit_url)
        .await?
        .sha;
    let tree_url = format!(
        "https://api.github.com/repos/{}/{}/git/trees/{}?recursive=1",
        encode_github_path_segment(&parsed.owner),
        encode_github_path_segment(&parsed.repo),
        encode_github_path_segment(&commit)
    );
    let tree = github_get_json::<GitHubTreeResponse>(&client, &tree_url).await?;
    let mut warnings = Vec::new();
    if tree.truncated {
        warnings.push(
            "GitHub returned a truncated tree; some packages may be missing from the preview."
                .to_string(),
        );
    }

    let mut files = Vec::new();
    for entry in tree.tree {
        if entry.kind != "blob" {
            continue;
        }
        let path = entry.path;
        if is_github_import_package_path(&path) {
            let raw_url = github_raw_url(&parsed.owner, &parsed.repo, &commit, &path);
            let contents = github_get_text(&client, &raw_url).await?;
            files.push(GitHubLibraryImportFile {
                path,
                contents: Some(contents),
            });
        } else if is_github_import_related_path(&path) {
            files.push(GitHubLibraryImportFile {
                path,
                contents: None,
            });
        }
    }

    Ok((
        GitHubLibraryImportSource {
            owner: parsed.owner.clone(),
            repo: parsed.repo.clone(),
            requested_ref,
            resolved_ref,
            commit: commit.clone(),
            source_url: format!(
                "https://github.com/{}/{}/tree/{}",
                parsed.owner, parsed.repo, commit
            ),
        },
        files,
        warnings,
    ))
}

async fn github_get_json<T: for<'de> Deserialize<'de>>(
    client: &reqwest::Client,
    url: &str,
) -> Result<T, String> {
    let response = client
        .get(url)
        .header(reqwest::header::USER_AGENT, GITHUB_IMPORT_USER_AGENT)
        .header(reqwest::header::ACCEPT, "application/vnd.github+json")
        .send()
        .await
        .map_err(|error| format!("GitHub did not respond: {error}"))?;
    let status = response.status();
    if !status.is_success() {
        let body = response.text().await.unwrap_or_default();
        return Err(format!(
            "GitHub request failed ({status}){}",
            github_error_body_suffix(&body)
        ));
    }
    response
        .json::<T>()
        .await
        .map_err(|error| format!("GitHub response was not valid JSON: {error}"))
}

async fn github_get_text(client: &reqwest::Client, url: &str) -> Result<String, String> {
    let response = client
        .get(url)
        .header(reqwest::header::USER_AGENT, GITHUB_IMPORT_USER_AGENT)
        .send()
        .await
        .map_err(|error| format!("GitHub raw file did not respond: {error}"))?;
    let status = response.status();
    if !status.is_success() {
        let body = response.text().await.unwrap_or_default();
        return Err(format!(
            "GitHub raw file request failed ({status}){}",
            github_error_body_suffix(&body)
        ));
    }
    response
        .text()
        .await
        .map_err(|error| format!("failed to read GitHub raw file: {error}"))
}

fn github_error_body_suffix(body: &str) -> String {
    let message = body
        .lines()
        .map(str::trim)
        .find(|line| !line.is_empty())
        .unwrap_or("");
    if message.is_empty() {
        String::new()
    } else {
        format!(": {message}")
    }
}

fn parse_github_repo_url(input: &str) -> Result<ParsedGitHubRepoUrl, String> {
    let trimmed = input.trim();
    if trimmed.is_empty() {
        return Err("GitHub URL is required".to_string());
    }
    let path = if let Some(path) = trimmed.strip_prefix("git@github.com:") {
        path
    } else {
        trimmed
            .strip_prefix("https://github.com/")
            .or_else(|| trimmed.strip_prefix("http://github.com/"))
            .or_else(|| trimmed.strip_prefix("https://www.github.com/"))
            .or_else(|| trimmed.strip_prefix("http://www.github.com/"))
            .ok_or_else(|| "enter a github.com repository URL".to_string())?
    };
    let path = path
        .split(['?', '#'])
        .next()
        .unwrap_or(path)
        .trim_end_matches('/');
    let segments = path.split('/').collect::<Vec<_>>();
    let owner = segments
        .first()
        .copied()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .ok_or_else(|| "GitHub URL is missing an owner".to_string())?;
    let repo = segments
        .get(1)
        .copied()
        .map(str::trim)
        .map(|value| value.strip_suffix(".git").unwrap_or(value))
        .filter(|value| !value.is_empty())
        .ok_or_else(|| "GitHub URL is missing a repository".to_string())?;
    let reference = if segments.get(2) == Some(&"tree") {
        segments.get(3).map(|value| value.to_string())
    } else {
        None
    };
    Ok(ParsedGitHubRepoUrl {
        owner: owner.to_string(),
        repo: repo.to_string(),
        reference,
    })
}

fn github_raw_url(owner: &str, repo: &str, commit: &str, path: &str) -> String {
    let encoded_path = path
        .split('/')
        .map(encode_github_path_segment)
        .collect::<Vec<_>>()
        .join("/");
    format!(
        "https://raw.githubusercontent.com/{}/{}/{}/{}",
        encode_github_path_segment(owner),
        encode_github_path_segment(repo),
        encode_github_path_segment(commit),
        encoded_path
    )
}

fn is_github_import_package_path(path: &str) -> bool {
    matches!(
        path.trim_matches('/')
            .split('/')
            .collect::<Vec<_>>()
            .as_slice(),
        ["persistent", "prompts", _, "PROMPT.md"]
            | ["persistent", "contexts", _, "CONTEXT.md"]
            | ["persistent", "skills", _, "SKILL.md"]
            | ["persistent", "commands", _, "COMMAND.md"]
            | ["prompts", _, "PROMPT.md"]
            | ["contexts", _, "CONTEXT.md"]
            | ["skills", _, "SKILL.md"]
            | ["commands", _, "COMMAND.md"]
    )
}

fn is_github_import_related_path(path: &str) -> bool {
    matches!(
        path.trim_matches('/')
            .split('/')
            .collect::<Vec<_>>()
            .as_slice(),
        ["persistent", "prompts", ..]
            | ["persistent", "contexts", ..]
            | ["persistent", "skills", ..]
            | ["persistent", "commands", ..]
            | ["prompts", ..]
            | ["contexts", ..]
            | ["skills", ..]
            | ["commands", ..]
    )
}

fn encode_github_path_segment(segment: &str) -> String {
    let mut encoded = String::new();
    for byte in segment.bytes() {
        match byte {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                encoded.push(char::from(byte));
            }
            _ => encoded.push_str(&format!("%{byte:02X}")),
        }
    }
    encoded
}
