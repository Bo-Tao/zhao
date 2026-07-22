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

Treat user configuration and project paths as untrusted input. Preserve `.yaml` migration behavior, avoid overwriting conflicting files, and never commit local Zhao configuration, registry credentials, or private repository URLs.


<claude-mem-context>
# Memory Context

# [zhao] recent context, 2026-07-22 4:06pm GMT+8

Legend: 🎯session 🔴bugfix 🟣feature 🔄refactor ✅change 🔵discovery ⚖️decision 🚨security_alert 🔐security_note
Format: ID TIME TYPE TITLE
Fetch details: get_observations([IDs]) | Search: mem-search skill

Stats: 50 obs (16,763t read) | 290,218t work | 94% savings

### Jul 22, 2026
3867 3:12p 🔵 Code reuse reviewer completed: no duplication found in migration implementation
3868 " 🔵 zhao CLI requires CI link configuration for test environment
3869 3:13p ✅ Added test coverage for YAML migration collision handling
3870 " 🟣 Migrated zhao CLI configuration files from .yml to .yaml extension
3871 3:14p 🔵 Multi-agent code review initiated for zhao YAML migration changes
3872 " 🔵 Adversarial reviewer added to zhao YAML migration code review
3873 3:15p 🔵 Test suite validates YAML migration functionality across all zhao CLI commands
3874 " 🔵 TypeScript compilation and build completed successfully after YAML migration
3875 " 🟣 Complete YAML configuration migration implemented for zhao CLI
3876 3:16p 🔵 Code review agents completed analysis with no actionable findings
3877 " 🔵 Migration verification shows only intentional .yml references remain
3878 " 🔵 Adversarial reviewer agent interrupted after extended runtime
3879 3:18p 🔴 Migration logic updated to detect and report conflicting configuration files
3880 " 🔵 Tests fail revealing migration implementation needs conflict detection logic
3881 " 🔴 Migration implementation enhanced with conflict detection and content comparison
3882 " ✅ Documentation updated to explain YAML migration behavior and conflict policy
3883 3:19p 🔵 Enhanced migration implementation passes all quality gates
3884 " 🔵 CI Configuration Error in zhao CLI Tool
3885 3:20p 🔄 Improved YAML Migration Error Handling in zhao CLI
3886 " 🟣 Symbolic Link Support in YAML Configuration Migration
3887 3:28p 🟣 Configuration file migration from .yml to .yaml
3888 " 🔵 Git index lock preventing staging operations
3889 3:42p 🔵 tag command does not support configuring project links
3890 " 🔵 Specification defines links field but not tag command configuration method
3891 " 🟣 Added --ci-test and --ci-prod flags to tag command
3892 3:43p 🔵 Format check failed on documentation files
3893 " 🔵 Integration test failure in ci command after tag modifications
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

Access 290k tokens of past work via get_observations([IDs]) or mem-search skill.
</claude-mem-context>