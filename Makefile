.PHONY: help all setup setup-visual check build test-frontend test-visual rust-fmt rust-check rust-clippy rust-test tauri-build ci pr-body-check

BUN ?= bun
CARGO ?= cargo

help:
	@echo "Targets: setup, setup-visual, check, build, test-frontend, test-visual, rust-fmt, rust-check, rust-clippy, rust-test, tauri-build, ci, all, pr-body-check"

setup:
	$(BUN) install --frozen-lockfile

setup-visual:
	$(BUN) x playwright install webkit

check:
	$(BUN) run check

build:
	$(BUN) run build

test-frontend:
	$(BUN) run test:frontend

test-visual:
	$(BUN) run test:visual

rust-fmt:
	$(CARGO) fmt --manifest-path src-tauri/Cargo.toml --check

rust-check:
	$(CARGO) check --manifest-path src-tauri/Cargo.toml

rust-clippy:
	$(CARGO) clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings

rust-test:
	$(CARGO) test --manifest-path src-tauri/Cargo.toml

tauri-build:
	$(BUN) run tauri:build

ci:
	$(MAKE) setup
	$(MAKE) setup-visual
	$(MAKE) check
	$(MAKE) build
	$(MAKE) test-frontend
	$(MAKE) test-visual
	$(MAKE) rust-fmt
	$(MAKE) rust-check
	$(MAKE) rust-clippy
	$(MAKE) rust-test
	$(MAKE) tauri-build

all: ci

pr-body-check:
	@test -n "$(FILE)" || (echo "FILE is required, e.g. make pr-body-check FILE=/tmp/pr_body.md" >&2; exit 1)
	$(BUN) scripts/pr-body-check.mjs --file "$(FILE)"
