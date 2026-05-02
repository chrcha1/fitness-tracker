# Track

Personal fitness + nutrition tracker. Phone-first, but works on desktop too.

**Live:** https://chrcha1.github.io/fitness-tracker/

Six tabs: **Today** (daily ritual surface), **Zone 2** (100 sessions by Dec 1), **Intervals** (1/wk), **Lifting** (tag-based), **Nutrition** (talk to Claude to log meals), **Weight** (Saturday goal trajectory).

Data syncs to a private GitHub gist. Offline-first, dark mode auto, ~40KB.

## Stack
Single `index.html` + `core.js` + Node test suite. No framework, no build step. Service worker for offline launches. Browser-direct Claude API call for nutrition logging (your key in localStorage, same threat surface as the GitHub PAT).

## Setup
- iPhone: Safari → Share → Add to Home Screen.
- Settings sheet inside the app: paste a GitHub PAT (Gist scope) for sync, paste an Anthropic key for Nutrition tab.
