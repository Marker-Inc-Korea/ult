# Ult

[English](README.md)

Ult는 터미널 기반 코딩 에이전트를 명시적인 재사용 프롬프트로 조작하기 위한
로컬 우선 macOS 메뉴바 앱입니다.

Ult는 자율 에이전트가 아닙니다. 터미널 출력이나 소스 파일을 감시하지 않고,
무엇을 보낼지 스스로 판단하지도 않습니다. 사용자가 프롬프트, 컨텍스트, 스킬,
커맨드를 고른 다음 대상 앱을 직접 선택합니다.

## 왜 필요한가

코딩 에이전트는 종종 짧은 개입이 필요합니다.

- 요청한 범위 안에서만 작업하기
- 더 수정하기 전에 현재 diff 확인하기
- 관련 테스트 실행하기
- 큰 리팩터링 피하기
- 진행 상황과 남은 위험 요약하기
- 멈추고 최신 지시 따르기

이런 프롬프트는 반복적이지만, 영구적인 프로젝트 컨텍스트가 되면 안 됩니다.
Ult는 이런 개입 프롬프트를 로컬에 재사용 가능하게 두고, 사용자가 명시적으로
전달하기 전까지 에이전트 밖에 보관합니다.

## 빠른 시작

로컬 앱을 빌드하고 실행합니다.

```bash
make setup
bun run tauri:build
open "src-tauri/target/release/bundle/macos/Ult.app"
```

개발 모드로 실행합니다.

```bash
make setup
bun run tauri:dev
```

Ult는 메뉴바 앱으로 열립니다. 메뉴에는 Launcher, Preferences, 버전, Quit만
노출됩니다. 프롬프트와 컨텍스트 같은 아티팩트 관리는 Preferences가 아니라
Launcher에서 합니다.

## 기본 흐름

1. 터미널 기반 코딩 에이전트를 시작합니다.
2. `Option+Space`로 Launcher를 열거나, `Cmd+U`로 빠른 Palette를 엽니다.
3. `#review-change @repo-policy`처럼 개입 프롬프트를 고르거나 조합합니다.
4. `Enter`로 로드합니다.
5. `Shift+Tab`으로 Paste, Paste + Enter, Interrupt + Enter, Copy 중 하나를 고릅니다.
6. 대상 앱을 클릭해서 로드된 개입을 적용합니다.

네이티브 paste/send 모드는 macOS Accessibility 권한이 필요합니다. Ult는 첫 실행
권한 마법사를 띄우지 않습니다. 네이티브 전달이 실제로 필요할 때 macOS가 권한을
요청합니다. Copy 모드는 명시적으로 선택하는 모드이며 네이티브 입력 합성이
필요하지 않습니다.

## 단축키

| 단축키 | 동작 |
| --- | --- |
| `Cmd+U` | 빠른 Palette 열기 |
| `Option+Space` | Launcher 열기 |
| `Ctrl+Option+Cmd+S` | Launcher Scratch 열기 |
| `Shift+Tab` | 로드된 전달 모드 전환 |
| Launcher `Ctrl+V` | Clipboard Stack 열기 |
| Launcher `Esc` | 현재 Launcher 모드 닫기 |

단축키는 `Preferences > Shortcuts`에서 바꿀 수 있습니다. `Cmd+Option+Space`는
macOS가 예약하는 경우가 많아서 기본 Launcher 단축키로 쓰지 않습니다.

## 주요 화면

### Palette

Palette는 커서 근처에 뜨며 자주 쓰는 pinned prompt를 빠르게 고르는 용도입니다.
영구 보관된 pinned prompt만 `#handle` 형태로 보여줍니다. 컨텍스트, 스킬, scratch
prompt, 전체 검색 결과는 Palette에 나오지 않습니다.

### Launcher

Launcher는 주 커맨드 화면입니다. 화면 상단 중앙에 뜨며 검색, 생성, 라이브러리
탐색, scratch 작성, 변수 입력, workflow 입력 패널, clipboard stack, 아티팩트
reader, project setup이 모두 같은 안정적인 shell 안에서 열립니다.

Launcher handle은 고정된 namespace를 사용합니다.

| Prefix | 의미 |
| --- | --- |
| `#` | Prompt |
| `@` | Context |
| `$` | Skill |
| `/` | Launcher command |

예시:

```text
#scope-lock
@repo-policy
$diagnose
/review-current-change
```

검색은 handle, title, command alias, command intent metadata를 대상으로 합니다.
prompt body, context body, skill source, terminal output은 full-text search하지
않습니다.

prompt, context, skill reader를 열면 문서형 상세 화면이 보입니다. 상단에는
handle, name, description, kind, lifecycle, source path가 들어간 metadata card가
있고, 그 아래에는 artifact body가 Markdown으로 렌더링됩니다.

### Prompt와 Context 만들기

Launcher에서 `New Prompt`나 `New Context`를 실행하면 create canvas가 열립니다.
기본 화면은 body-first입니다. 필요하면 title을 쓰고, prompt나 context 본문을
작성한 다음 로컬 artifact를 생성합니다.

Ult는 title 또는 본문의 첫 문장에서 canonical handle을 만들고 `#handle` 또는
`@handle`로 미리 보여줍니다. 아래 option bar에는 자주 쓰는 선택지만 남깁니다.

- type
- Personal Library destination
- 명시적 project selection 상태
- prompt의 Show in Palette
- prompt의 Confirm before delivery
- Advanced Editor

type, destination, project는 실제로 고를 수 있는 계약이 생기기 전까지 상태
label입니다. 안전한 선택지가 하나뿐이면 menu처럼 동작하지 않습니다.

`Use template`은 로컬 built-in prompt template을 채우거나 기존 본문 뒤에
붙입니다. 기본 template은 Code Review, Debug, Implementation Plan, Summary,
Scoped Task입니다. template은 원격 콘텐츠를 가져오거나 project file을 검사하지
않습니다.

`Create`는 Personal Library에만 저장합니다. 자동으로 load, paste, send, terminal
target 선택, project file 읽기, project 쓰기를 하지 않습니다. `Create and Load`는
별도의 명시적 액션입니다. 로컬 prompt 또는 context를 저장한 뒤 saved artifact를
loaded state로 준비하지만 delivery는 하지 않습니다. handle override, description,
context dependency, argument metadata, shortcut, raw body editing 같은 고급 필드가
필요하면 `Advanced Editor`를 엽니다.

Scratch는 빠른 임시 drafting 경로로 남아 있습니다. `Enter`는 scratch draft를
7일 ephemeral prompt로 저장하고 명시적 delivery를 위해 load합니다. `Create
Prompt` 또는 `Cmd+S`는 scratch text를 prompt create canvas로 승격하지만 load나
delivery는 하지 않습니다.

### Workflows

Workflow는 별도 artifact type이 아니라 prompt-command pair입니다. first-party
workflow는 로컬 `#workflow-*` prompt와 그 prompt를 명시 입력으로 준비하는
`/workflow-*` command로 저장됩니다. Workflow input panel은 붙여넣은 텍스트,
사용자가 직접 입력한 텍스트, 명시적 `@context` handle만 받습니다. 붙여넣은
텍스트는 `Continue`를 누른 뒤에만 7일 local ephemeral context로 저장되며,
기본적으로 Launcher search, usage history, diagnostics, logs에 복사되지 않습니다.

Workflow를 실행해도 terminal output 읽기, project file scan, agent response 검사,
자동 delivery는 하지 않습니다. 전달은 여전히 일반 loaded state, target click,
또는 명시적 Copy action을 거칩니다.

### Skills

New Skill은 persistent `SKILL.md` package를 위한 source-oriented scaffold를
엽니다. 여기서는 skill name, short description, `SKILL.md` body 또는 local
template, Personal Library destination, optional import source를 입력합니다. Skill을
만들어도 prompt text로 load, paste, send하지 않고, project file scan이나 project
install도 하지 않습니다.

외부 skill source는 GitHub import preview gate를 거칩니다. Project에 skill을
설치하는 일은 `Project Setup` 또는 `Install Skill to Project...`에서 명시적 file
preview와 confirmation 뒤에만 진행됩니다.

### Library

`Browse Library`는 prompts, contexts, skills, commands의 로컬 inventory를 엽니다.
Library row는 metadata 중심이며 Launcher search와 같은 handle 문법을 씁니다.
보조 액션으로 읽기, 수정, 복제, 삭제, pin, copy, reveal, import, export, install을
각 항목에 맞게 실행할 수 있습니다.

Skill은 source 중심 패키지입니다. `$skill` 결과는 로컬 `SKILL.md`를 열거나
보여줍니다. 기본적으로 skill은 prompt 전달 텍스트로 로드되지 않습니다.

### Loaded State

`Enter`로 로드하면 Ult가 커서 근처에 작은 loaded card를 보여줍니다. 이 카드에는
로드된 handle, target-click 상태, delivery mode가 표시됩니다. loaded state에서
`Enter`를 눌러도 전달되지 않습니다. 전달하려면 대상 앱을 명시적으로 클릭하거나
Copy 액션을 선택해야 합니다.

## Personal Library

Ult는 사용자가 관리하는 아티팩트를 아래 위치에 저장합니다.

```text
~/.ult/
  personal-library/
    persistent/
      prompts/<handle>/PROMPT.md
      contexts/<handle>/CONTEXT.md
      skills/<handle>/SKILL.md
      commands/<handle>/COMMAND.md
    ephemeral/
      prompts/<opaque-id>/PROMPT.md
      contexts/<opaque-id>/CONTEXT.md
```

디렉터리가 아티팩트 타입과 scope를 결정합니다.

- `persistent/prompts/review-change/PROMPT.md`는 `#review-change`가 됩니다.
- `persistent/contexts/repo-policy/CONTEXT.md`는 `@repo-policy`가 됩니다.
- `persistent/skills/diagnose/SKILL.md`는 `$diagnose`가 됩니다.
- `persistent/commands/review-repo/COMMAND.md`는 `/review-repo`가 됩니다.

Scratch prompt와 캡처한 clipboard context는 7일 후 만료되는 ephemeral local
artifact로 저장됩니다. 이들은 opaque handle을 쓰며, 만료 후에는 무시됩니다.

`COMMAND.md` 파일은 로컬 prompt와 context를 재사용 가능한 Launcher command로
묶습니다. command는 prompt artifact가 아니라 실행 가능한 Launcher 동작입니다. 현재
`prepare` action은 참조한 prompt를 명시적 context handle과 variable preset과 함께
loaded state로 올릴 뿐, 붙여넣거나 입력하거나 terminal을 target하지 않습니다. Markdown
본문은 로컬 note 전용이며 full-text search 대상이 아닙니다. 예시:

```markdown
---
title = "Review Repo"
description = "Review the current change with repo policy."
prompt = "review-change"
contexts = ["repo-policy"]
keywords = ["review", "diff"]
aliases = ["rr"]
actions = ["prepare"]
home = true

[variables]
policy = "@repo-policy"
---
```

## Clipboard Contexts

Clipboard capture는 명시적으로 실행할 때만 동작합니다. Launcher에서
`Capture Clipboard`를 실행하면 현재 clipboard를 한 번 읽고, 로컬 7일 ephemeral
context로 저장합니다.

Ult는 clipboard capture를 위해 global keyboard event tap, Input Monitoring listener,
startup pasteboard monitor를 설치하지 않습니다. `Cmd+V`도 가로채지 않습니다.

## Project Writes And Imports

Project write는 prompt delivery와 별개인 명시적 Launcher action입니다.
prompt/context export, skill install, AGENTS snippet 생성, Project Setup은 모두 대상
디렉터리를 요구하고, 쓸 파일을 먼저 preview하며, 명시적 확인 없이는 기존 파일을
덮어쓰지 않습니다.

GitHub import와 starter pack도 명시적 preview flow를 사용합니다. 가져온 package는
로컬 Personal Library 파일이 됩니다. Ult는 GitHub token을 저장하지 않고, pack을
자동 pull/update하지 않으며, discovery gate에서 외부 install command를 실행하지
않습니다.

## Meta Prompting

Meta Prompting은 기본적으로 꺼져 있습니다. `Preferences > Meta Prompting`에서
설정합니다.

활성화된 경우 Launcher Scratch에서 `Cmd+R`을 누르면 현재 scratch text만 설정된
provider로 전송합니다. Ult는 terminal contents, shell history, source files,
context bodies, agent output을 붙이지 않습니다. 생성된 prompt는 검토용으로
보여주며, 사용자가 명시적으로 로드하고 대상을 클릭하기 전까지 전달되지 않습니다.

## Privacy Model

Ult는 기본적으로 local-first입니다.

Ult는 기본적으로 terminal contents, shell history, source files, editor buffers,
window titles, clipboard history, agent responses를 읽지 않습니다.

기본 usage history는 작은 metadata만 저장합니다.

- artifact id와 kind
- timestamp
- delivery mode
- success/failure state
- 가능한 경우 retryable diagnostic code
- 가능한 경우 target application metadata

prompt text, context text, scratch text, terminal output, source files, agent
responses는 기본적으로 usage history나 diagnostics에 저장되지 않습니다.

Project metadata collection은 향후 privacy-safe resolver를 위한 reserved 영역이며,
현재 Preferences에서 동작하는 설정으로 노출되지 않습니다.

## 개발

이 저장소는 Bun, Vite, Playwright, Rust stable, Tauri v2를 사용합니다.

```bash
make setup
make all
```

`make all`은 로컬과 CI의 주요 검증 gate입니다. dependency setup, Playwright WebKit
setup, TypeScript check, frontend build, frontend tests, visual regression tests,
Rust format/check/clippy/test, Tauri build를 실행합니다.

집중 검증 명령:

```bash
make check
make test-frontend
make test-visual
make rust-test
make rust-clippy
make tauri-build
```

레이아웃 변경이 의도된 경우에만 visual baseline을 갱신합니다.

```bash
bun run test:visual:update
```

## 문서

이 README는 공개 제품/개발 가이드입니다. 자세한 제품 계획, workflow notes,
manual QA checklist, agent-local instructions는 로컬 전용 project notes로
관리합니다.

## License

Ult는 [MIT License](LICENSE)를 따릅니다.
