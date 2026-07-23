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

# [zhao] recent context, 2026-07-24 12:27am GMT+8

Legend: 🎯session 🔴bugfix 🟣feature 🔄refactor ✅change 🔵discovery ⚖️decision 🚨security_alert 🔐security_note
Format: ID TIME TYPE TITLE
Fetch details: get_observations([IDs]) | Search: mem-search skill

Stats: 50 obs (21,472t read) | 656,870t work | 97% savings

### Jul 22, 2026
S565 Fix help table alignment regression after Citty library upgrade broke test expectations (Jul 22 at 8:21 PM)
S578 Design auto-management of projects.yaml for zhao scan command with incremental sync (Jul 22 at 8:24 PM)
### Jul 23, 2026
4148 11:14p 🔵 Pre-existing TypeScript errors in prompts module unrelated to sync implementation
4149 11:15p ✅ Quality gates passed for projects.yaml sync implementation
4150 " 🟣 zhao scan projects.yaml auto-sync feature complete
4151 11:16p ✅ Refined atomic write test and updated documentation for projects.yaml auto-sync
4152 " 🔵 Formatting issue in zhao-spec.md documentation update
4153 " 🔵 Full pnpm check blocked by unrelated AGENTS.md and package.json formatting
4154 11:17p 🔵 Linting clean but pre-existing TypeScript errors persist in prompts module
4155 " ✅ Full test suite passed with no regressions from projects.yaml sync implementation
4156 " ✅ Code simplification review initiated for projects.yaml sync implementation
4158 11:18p ✅ Second simplification reviewer agent spawned for code quality analysis
4157 " 🟣 zhao scan auto-manages projects.yaml configuration
S580 Implement automatic projects.yaml synchronization during zhao scan command execution (Jul 23 at 11:18 PM)
4159 11:19p ✅ Third efficiency reviewer agent spawned completing simplification review panel
4160 " 🔵 Code simplification reviewers completing analysis with clean whitespace verification
4161 " 🔄 Applied code reuse simplification replacing manual deduplication with existing helper
4162 11:20p ✅ Simplification refactor verified with all tests passing and shipping workflow initiated
4163 " ✅ Entering formal code review phase with ce-code-review skill for final validation
4164 11:21p 🔵 Code review scope analysis reveals 208-line diff triggering comprehensive reviewer roster
4165 11:22p ⚖️ zhao scan auto-management of projects.yaml
4167 11:23p 🟣 zhao scan auto-manages projects.yaml with stable project keys
4168 11:24p ⚖️ Auto-maintain projects.yaml during zhao scan indexing
S581 Auto-generate and sync projects.yaml keys during zhao scan - create file if missing, append new project keys if exists, skip existing entries (Jul 23 at 11:25 PM)
S582 Auto-generate project keys in projects.yaml during zhao scan, with merge logic to avoid overwriting existing entries (Jul 23 at 11:27 PM)
4169 11:28p 🟣 Automatic projects.yaml synchronization in zhao scan
4170 11:29p 🔵 Race condition in projects.yaml concurrent access
4171 " 🔵 Adversarial review step failed due to Claude API connectivity issue
4172 11:31p 🔵 Code review completed with 2 findings across correctness and reliability dimensions
4173 11:32p ⚖️ Review synthesis demoted comment-loss finding as settled design decision
4174 11:33p ⚖️ zhao scan auto-generation behavior for projects.yaml
4175 11:34p 🟣 Auto-sync projects.yaml during zhao scan
4176 " 🔵 Pre-existing TypeScript errors in prompts module
4177 11:35p ⚖️ Code review completed: projects.yaml auto-sync ready to merge
### Jul 24, 2026
4178 12:02a 🟣 Auto-creation and incremental update of projects.yaml in zhao scan
4179 " 🔵 YAML serialization renders empty metadata fields verbosely
4180 " ✅ Test expectations updated to match verbose YAML serialization
4181 12:03a 🔵 Test-first verification confirms current implementation generates minimal empty objects
4182 " 🟣 Implemented verbose empty metadata template for new project entries
4183 " ✅ Documentation updated to describe verbose empty metadata initialization
4184 " 🔵 Quality checks pass except for pre-existing type errors in unrelated file
4185 12:04a ✅ Transition to shipping workflow after successful implementation
4186 12:05a 🔵 Code review scope analysis shows 252 executable lines changed across agent-facing surfaces
4187 " ✅ Code review infrastructure initialized with cross-model adversarial pass preparation
4188 " ✅ Cross-model adversarial review job started with independent Claude verification
4189 12:06a ✅ Reviewer persona templates and protocols loaded for multi-agent code review
4190 " ✅ Diff and file list staged to disk for efficient reviewer distribution
4191 12:07a ✅ Local reviewer subagents dispatched in concurrent batch for multi-perspective code review
4192 " ✅ Testing reviewer spawned and context validation performed for reviewer batch
S583 Fix projects.yaml initialization to create structured templates with all fields instead of empty objects (Jul 24 at 12:07 AM)
4193 12:08a 🔵 projects.yaml initialization creates empty objects instead of structured templates
S584 Code review of projects.yaml auto-maintenance implementation that initializes all fields with structured templates instead of empty objects (Jul 24 at 12:08 AM)
4194 12:11a 🔵 projects.yaml generates empty objects instead of scaffolded structure
S585 Implement automatic projects.yaml scaffolding with initialized empty fields instead of bare empty objects (Jul 24 at 12:11 AM)
S586 Fix projects.yaml initialization to include empty field structure instead of empty objects (Jul 24 at 12:11 AM)
4195 12:14a 🔵 projects.yaml default initialization structure issue identified
4196 12:16a 🟣 Auto-sync projects.yaml on scan with empty field templates
4197 " ✅ Code review completed: Ready to merge with resolved display bug
4198 12:21a ✅ YAML formatting preference updated for cactus-blackboard-02 config
S587 Generate v0.1.0 release note using document-release skill (Jul 24 at 12:25 AM)
**Investigated**: The document-release skill documentation was read to understand the workflow for creating release notes. The skill performs post-ship documentation updates by cross-referencing diffs, updating project documentation files (README, ARCHITECTURE, CONTRIBUTING, CHANGELOG), polishing CHANGELOG voice, cleaning TODOs, and optionally bumping VERSION.

**Learned**: The document-release skill follows a structured 9-step process: detects git platform (GitHub/GitLab), determines base branch, reads existing documentation, audits cross-file consistency, checks for discoverability (all docs reachable from README or AGENTS.md), cleans completed TODOs, and always asks before bumping VERSION. It never silently modifies version numbers and uses AskUserQuestion for narrative contradictions.

**Completed**: Skill initialization completed successfully. The gstack session tracking was set up in ~/.gstack/sessions and telemetry logging was initialized for the document-release skill session in the zhao project directory.

**Next Steps**: The document-release skill will execute its workflow to generate the v0.1.0 release note by detecting the git platform, reading project documentation, auditing consistency, and creating a structured release note based on the changes in the repository.


Access 657k tokens of past work via get_observations([IDs]) or mem-search skill.
</claude-mem-context>
