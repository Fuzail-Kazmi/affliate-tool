# Repository Guidelines

## Current Project State

UnityAffliate is the Next.js and PostgreSQL storefront and admin portal in `storefront/`. Its authenticated offer workflow uses the shared Python engine in `src/discovery.py`. The earlier standalone Fieldwork application uses Flask and SQLite. Runtime data for both local launchers lives in the ignored `.local/` directory.

## Project Structure & Module Organization

Use a predictable top-level layout as the project is created:

- `src/` for production source code, organized by feature or domain.
- `tests/` for automated tests that mirror the relevant `src/` paths.
- `assets/` for static, non-generated project resources.
- `docs/` for architecture notes and operational documentation.
- `scripts/` for repeatable developer and maintenance automation.

Do not commit generated output, local caches, credentials, or IDE-specific files unless the selected platform requires a shared configuration file. Keep modules focused; for example, place affiliate-link validation in `src/links/` rather than in a general utility module.

## Build, Test, and Development Commands

Install Python dependencies with `python -m pip install -r requirements.txt`. Inside `storefront/`, run `bun install --frozen-lockfile` and `bun run local` for the integrated portal, `bun test` for assistant tests and `bun run build` for the production build. Run the Python suite at the repository root with `python -m unittest discover -s tests -v`. Launch the standalone app with `python -m src.app`.

Run the smallest relevant test or check before submitting changes. Avoid machine-specific command assumptions in documentation and scripts.

## Coding Style & Naming Conventions

Follow the formatter and linter supplied by the chosen language ecosystem; do not add competing formatting tools. Use spaces for indentation, with the exact width enforced by project configuration. Name files and directories consistently with the framework convention, use descriptive identifiers, and avoid unexplained abbreviations. Keep configuration files at the repository root unless a tool requires another location.

## Testing Guidelines

Add tests alongside each feature and name them after the behavior they verify, such as `link-validator.test.ts` or `test_link_validator.py`. Cover expected behavior, invalid input, and important edge cases. Add coverage thresholds only after the test framework is established, then enforce them in continuous integration.

## Commit & Pull Request Guidelines

There is no Git history yet, so no repository-specific commit convention exists. Use short imperative commit subjects, for example `Add affiliate link validator`. Keep commits focused and avoid bundling refactors with behavior changes.

Pull requests should state the purpose, summarize implementation and validation, link related issues when available, and include screenshots for visible UI changes. Call out configuration, migration, or security impacts explicitly.
