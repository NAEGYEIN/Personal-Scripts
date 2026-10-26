# Personal-Scripts AGENTS.md

## Repository scope

This is the public userscript collection at `NAEGYEIN/Personal-Scripts`.

- Keep one userscript project per top-level project directory.
- Do not add browser extensions or web tools to this repository.
- Use direct, recognizable project directory names.
- Split a project into its own repository only when its size or release process justifies it.

## Release safety

- Preserve userscript identity fields such as `@name` and `@namespace` unless an intentional migration is approved.
- Preserve existing storage keys during in-place updates unless a migration is explicitly implemented.
- Do not break `@updateURL` or `@downloadURL`.
- Keep canonical `.user.js` and `.meta.js` files inside each project directory.
- A version bump that changes only distribution metadata must not silently change feature behavior.

## Validation

- Syntax/mock tests are not equivalent to real-browser E2E.
- Record archived or failed scripts as such instead of presenting them as stable releases.
- Avoid unrelated refactors when changing release paths or repository structure.
