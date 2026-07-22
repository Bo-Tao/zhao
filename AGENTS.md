# Repository Guidelines

## Project Structure & Module Organization

`src/index.ts` is the executable entry point; `src/cli.ts` wires management commands through Citty. Put command implementations in `src/commands/`, domain logic in `src/core/`, onboarding in `src/middleware/`, terminal interactions in `src/ui/`, and shell integration in `src/shell/`. Tests live in `test/` as `*.test.ts`; shared utilities belong in `test/helpers/`, and samples in `test/fixtures/`. Design notes are under `docs/superpowers/`. Never edit generated `dist/` files.

## Build, Test, and Development Commands

Use pnpm 11 (the repository includes `pnpm-lock.yaml`):

- `pnpm install` installs dependencies.
- `pnpm dev -- <args>` runs the CLI directly with Bun, for example `pnpm dev -- doctor`.
- `pnpm build` creates the Node 18 ESM executable at `dist/index.mjs` with tsdown.
- `pnpm test` runs the Vitest suite once; `pnpm test:watch` supports iterative work.
- `pnpm check` runs formatting, linting, type checking, and tests. Run it before submission.

## Coding Style & Naming Conventions

Write strict TypeScript and preserve ESM imports, including `.js` extensions for local imports. Use two-space indentation, single quotes, and trailing commas; let `pnpm format` apply oxfmt. Use kebab-case filenames (`search-args.ts`), camelCase variables/functions, and PascalCase types. Keep command handlers thin and reusable behavior in `src/core/`.

## Testing Guidelines

Use Vitest globals (`describe`, `it`, `expect`) and name tests after observable behavior. Add unit tests for core logic and CLI coverage when flags, output, exit codes, migrations, or filesystem behavior changes. Use temporary directories and existing fixtures so tests never depend on local Zhao configuration. No numeric coverage threshold is enforced; every bug fix should include a regression test.

## Commit & Pull Request Guidelines

History uses imperative subjects and Conventional Commit prefixes where useful, such as `fix(cli): classify search argument errors`. Keep commits focused. Pull requests should summarize the change, list verification commands, link issues or design notes, and include terminal output examples for CLI UX changes. Screenshots are only needed for visual interaction changes.

## Configuration & Safety

Treat user configuration and project paths as untrusted input. Avoid overwriting conflicting files, and never commit local Zhao configuration, registry credentials, or private repository URLs.

<claude-mem-context>
# Memory Context

# [zhao] recent context, 2026-07-22 5:34pm GMT+8

Legend: 🎯session 🔴bugfix 🟣feature 🔄refactor ✅change 🔵discovery ⚖️decision 🚨security_alert 🔐security_note
Format: ID TIME TYPE TITLE
Fetch details: get_observations([IDs]) | Search: mem-search skill

Stats: 50 obs (17,505t read) | 319,365t work | 95% savings

### Jul 22, 2026

3893 3:43p 🔵 Integration test failure in ci command after tag modifications
3894 " 🟣 Feature implementation validated and build successful
3895 " 🟣 CLI help output confirms new --ciTest and --ciProd flags functional
3896 3:44p ✅ Enhanced integration test with actual URLs and ci command validation
3897 " ✅ Complete validation pipeline passed with enhanced integration test
3898 3:45p 🟣 Complete feature implementation: CI link configuration via tag command
3899 3:53p 🟣 Added CI link configuration to tag command
3900 3:58p 🔵 Test failure was formatting check failure, not unit test failure
3901 " 🔵 CLI and v2-cli tests confirmed stable across 12 consecutive runs
3902 " 🔄 Isolated build directories for CLI integration tests
3903 3:59p 🔴 Fixed formatting violations in markdown docs and test files
3904 " 🔵 Build isolation refactoring introduced regression in v2-cli test
3905 " ✅ Added debug instrumentation to v2-cli test failure point
3906 " 🔵 Build isolation fails because dependencies are not bundled into output
3907 4:00p 🔴 Fixed build isolation by placing temp builds inside node_modules
3908 " 🔵 Build isolation fix successful but test assertion too strict on stderr
3909 " 🔴 Relaxed test assertion to allow informational stderr output
3910 4:01p 🔵 Build isolation fix verified stable across 12 consecutive test runs
3911 " 🔴 Complete CI pipeline passes after resolving all test and formatting issues
3912 " 🔵 Cleanup verification confirms no debug artifacts or temporary files remain
3913 4:02p ✅ Created AGENTS.md contributor guide for zhao CLI project
3914 4:03p 🔄 Compacted AGENTS.md from 412 to 344 words
3915 " 🔵 AGENTS.md is excluded from git commits by .gitignore
3916 4:05p 🔄 Extract shared build helper and standardize code style
3917 4:07p ✅ AGENTS.md Now Tracked in Version Control
3918 " ✅ AGENTS.md Added to Version Control
3919 4:09p ✅ Repository guidelines documented in AGENTS.md
3921 4:13p 🔵 zhao CLI project structure and architecture analyzed
3922 4:14p 🟣 Comprehensive Chinese README.md generated for zhao CLI
3923 " ✅ README.md verification confirms 503-line documentation
3924 4:16p ✅ README.md validated and ready for commit
3925 " ✅ README.md clarifications added for --copy and --print flag behavior
3926 4:17p ✅ README.md formatting and security clarifications refined
3927 " 🔵 Final validation confirms README.md and dependency lockfiles ready for commit
3928 4:19p 🔵 zhao CLI project structure and command interface
3929 " 🟣 Implemented v2 project management command suite
3930 " 🔵 citty framework provides dual argument naming
S552 Complete v2 project management command implementation and commit changes (Jul 22 at 4:19 PM)
3931 4:23p 🔵 zhao scan command implementation and scanning scope
3932 4:24p 🟣 Generated comprehensive HTML explainer for zhao scan operation
3934 5:05p 🔵 `zhao browse --copy` intentionally opens URL after copying
3935 5:08p 🔵 `zhao browse --copy` intentionally opens browser after copying
3936 " 🟣 Added short aliases `-c` and `-p` for `zhao browse` flags
3937 " 🔵 Test expectations use backtick format but CLI outputs plain format
3938 5:09p 🔵 Citty help output format changed between v0.1.6 and v0.2.2
3939 " 🔵 TypeScript 7.0.2 and @clack/prompts 1.7.0 upgrade surfaced type errors
3940 " 🔵 Main CLI help test still expects backtick format from old citty version
3941 5:12p 🔵 `zhao ci` command lacks short aliases for --copy and --print flags
3942 " 🟣 Added short aliases `-c` and `-p` to `zhao ci` command flags
3943 5:30p ✅ Large-scale code changes committed across 9 files
3944 5:32p 🔵 YAML migration logic added for unpublished project

Access 319k tokens of past work via get_observations([IDs]) or mem-search skill.
</claude-mem-context>
