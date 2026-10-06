# IFBB Fitness Challenge — Developer Documentation

Version 0.3.0 · Tauri 2 · React 19 · TypeScript · SQLite

This document explains how the app is built and why, so that a new developer can change it safely.
For a short user-facing overview see `README.md`.

---

## 1. What the software does

A desktop app for running IFBB competitions **fully offline**. Organisers:

1. maintain three libraries: **athletes**, **exercises** and **categories** (age group → sub-group by sex and age → levels);
2. create a **competition** of one of two challenge types:
   - **Fitness Challenge**: athletes do reps at N stations, and the most total reps wins;
   - **Speed Fit**: each athlete gets one time for the whole set of exercises, and the fastest wins;
3. set it up (stations, categories, entries with bib numbers), **start** it, record results live,
   **finish** it, and **export** official results as PDF or CSV.

All data lives in one SQLite file (`fitness-challenge.db`) in the OS app-data folder for the
identifier `org.ifbb.fitnesschallenge`. There is no server, no network access and no user accounts.

---

## 2. Tech stack

| Concern | Choice |
|---|---|
| Desktop shell | Tauri 2 (Rust). Plugins: `sql` (SQLite via sqlx), `dialog`, `fs` |
| UI | React 19, React Router 8 (hash router), Tailwind CSS 4, shadcn/ui (Radix primitives) |
| Data fetching / cache | TanStack Query 5 |
| Animation | `motion` (animated Lucide icons from lucide-animated), `tw-animate-css`, a FLIP hook |
| Toasts | `sonner` |
| PDF | `jspdf` + `jspdf-autotable`, with embedded Noto Sans fonts |
| Countries | `i18n-iso-countries` (ISO 3166-1 alpha-3) |
| Tests | Vitest (node environment, pure logic only) |
| Build / CI | Vite 8, GitHub Actions + `tauri-action` |

---

## 3. High-level architecture

```
┌──────────────────────────── Tauri window (WebView) ────────────────────────────┐
│                                                                                │
│  app/            main.tsx → QueryClient → MotionConfig → DatabaseGate → Router │
│                                                                                │
│  features/       Screens + hooks (useX / useXMutations) + pure UI rules        │
│     athletes · exercises · categories · competitions (detail/, results/)       │
│        │                         │                                             │
│        │ useQuery / useDbMutation│ pure functions                              │
│        ▼                         ▼                                             │
│  db/  (only place with SQL) ──► engine/ (pure ranking/age/eligibility/time)    │
│        │                         ▲                                             │
│        │                         │                                             │
│  export/  PDF + CSV builders ────┘  (lazy-loaded)                              │
│        │                                                                       │
└────────┼───────────────────────────────────────────────────────────────────────┘
         │ IPC (@tauri-apps/plugin-sql, plugin-dialog, plugin-fs)
┌────────▼──────────────────────── Rust (src-tauri) ─────────────────────────────┐
│  lib.rs: registers plugins + 5 SQL migrations                                  │
│  SQLite file: CHECK constraints, FKs, and TRIGGERS enforce the lifecycle rules │
└────────────────────────────────────────────────────────────────────────────────┘
```

### Layering rules

| Layer | May import | Must not import |
|---|---|---|
| `src/engine/` | nothing outside itself | `db`, React, UI |
| `src/db/` | `engine` types, `lib/errors` | React, features |
| `src/features/` | everything below | other features' internals (sharing hooks like `useAthletes` is fine) |
| `src/export/` | `db` types, `engine`, `features/competitions/standings` types, `lib` | React |
| `src/components/` | `lib`, `engine` (formatting), `ui` | `db`, features |

### Core design principles

1. **The database is the source of truth for business rules.** Lifecycle locks, cross-table
   consistency and value ranges are SQLite `CHECK`s and `TRIGGER`s. No code path, including a
   future one, can bypass them. Trigger `RAISE` messages are written for end users and shown verbatim.
2. **The UI mirrors those rules** (`permissions.ts`, `readiness.ts`) so it never offers an action
   that would fail. When the two disagree, the DB wins and the error becomes a toast.
3. **One ranking function per challenge type, used everywhere.** `standings.ts → competitionResults()`
   feeds the live screens, the results view, the PDF and the CSV, so they can never disagree.
4. **Pure logic is isolated and tested.** `engine/`, validators, `permissions`, `readiness`, `standings`
   and `standingsTable` have no I/O and are covered by Vitest.

---

## 4. Repository layout

```
.github/workflows/release.yml   CI: typecheck + test, then build installers for macOS/Windows/Linux
index.html                      Vite entry, mounts /src/app/main.tsx
vite.config.ts                  "@" alias → src, port 1420, Vitest config
components.json                 shadcn/ui config (style radix-nova, aliases)
src-tauri/
  tauri.conf.json               Window size, CSP, bundle targets, version
  capabilities/default.json     IPC permissions granted to the window
  src/lib.rs                    Plugin registration + migration list
  src/main.rs                   Binary entry, calls lib::run()
  migrations/000N_*.sql         Schema and lifecycle triggers (append-only)
src/
  app/          main.tsx, router.tsx, DatabaseGate.tsx, index.css (theme tokens)
  engine/       age, eligibility, places, ranking, speedFit, time, types (+ engine.test.ts)
  db/           client, errors, queryKeys, one module per table, results.ts
  features/
    athletes/     page, form dialog, hooks, validateAthlete (+test)
    exercises/    page, form dialog, hooks
    categories/   category library page, form dialog, hooks, validateCategory (+test)
    competitions/ list page, form dialog, badges, permissions, readiness, standings, hooks
      detail/     CompetitionDetailPage + Stations/Categories/Entries panels + add dialogs
      results/    ResultsPanel, RepsGrid, TimesTable, Leaderboard, WinnerBanner, ExportButtons
  export/       exportResults (entry), standingsTable (shared layout), pdf, pdfAssets, csv, saveFile
  components/
    ui/         shadcn primitives (generated, don't hand-edit unless needed)
    icons/      lucide-animated icons + animated.ts (useIconAnimation)
    layout/     AppLayout (sidebar + outlet), PageHeader
    shared/     LibraryPage, FormDialog, CommitInput, CheckList, ConfirmDialog, QueryState, …
  hooks/        useDbMutation, useFlipAnimation
  lib/          countries, dates, errors, labels, motion, search, utils
  assets/       IFBB logo, Noto Sans fonts (for PDF)
```

---

## 5. Native side (`src-tauri`)

`lib.rs` is intentionally tiny. It contains no custom Tauri commands. It:

- registers `tauri-plugin-sql` with the migration list for `sqlite:fitness-challenge.db`;
- registers `tauri-plugin-dialog` (native Save-As) and `tauri-plugin-fs` (write the chosen file).

`DATABASE_URL` is duplicated in `src-tauri/src/lib.rs` and `src/db/client.ts`. **Both must match.**

**Capabilities** (`capabilities/default.json`): `core:default`, `sql:default`, `sql:allow-execute`,
`dialog:allow-save`, `fs:allow-write-file`. The file dialog grants write access only to the path the
user picked.

**CSP** (`tauri.conf.json`): `default-src 'self'`, with images/fonts also allowed from `data:` (the
PDF embeds the logo and fonts as data URLs) and `connect-src` limited to Tauri IPC. Nothing is loaded
from the network.

**Release profile**: LTO, `codegen-units = 1`, `opt-level = 3`, `panic = "abort"`, stripped.

---

## 6. Data model

### 6.1 Tables

```
athletes ───────────────┐ (ON DELETE RESTRICT)
                        │
exercises ──┐ (RESTRICT)│
            │           │
competitions ─┬─< competition_stations (competition_id, station_number) → exercise_id?
   kind       ├─< categories (copied from category_presets)
   status     └─< entries (athlete, category, bib, late_entry)
                     ├─< scores (entry_id, station_number, reps)      [fitness_challenge]
                     └─  speed_fit_times (entry_id PK, time_ms)        [speed_fit]

age_groups ─< age_subgroups (sex, ages) ─< category_levels   (library; copied into categories)
```

| Table | Key columns and constraints |
|---|---|
| `athletes` | `first_name`, `last_name` (non-blank), `date_of_birth` ISO date (`date(x) IS x`), `sex` ∈ male/female, `country` 3 upper-case letters |
| `exercises` | `name` UNIQUE NOCASE, `description` |
| `age_groups` | `name` UNIQUE NOCASE (Junior, Senior, Masters…) |
| `age_subgroups` | `age_group_id` (CASCADE), `gender` ∈ male/female/mixed, `min_age`/`max_age` 0–120 or NULL, min ≤ max. Unique per age group + sex + ages (NULL = NULL) |
| `category_levels` | `subgroup_id` (CASCADE), `name`, UNIQUE (`subgroup_id`, `name`) NOCASE |
| `competitions` | `name`, `date`, `location`, `status` ∈ draft/running/finished, `kind` ∈ fitness_challenge/speed_fit, `started_at`, `finished_at` |
| `competition_stations` | PK (`competition_id`, `station_number`), `exercise_id` nullable while in draft |
| `categories` | per-competition snapshot of one level: `name` ("Junior Men 14–23 · Gold"), rules, `age_group`, `level` (both empty for pre-0006 categories). UNIQUE (`competition_id`, `name`) |
| `entries` | one row per athlete **per category** (an athlete can enter several levels): UNIQUE (`category_id`, `athlete_id`). One bib per athlete per competition, shared by all their entries and never used by another athlete (triggers). `late_entry` 0/1 |
| `scores` | PK (`entry_id`, `station_number`), `reps` 0–9999 |
| `speed_fit_times` | PK `entry_id`, `time_ms` 1 … 86 399 999 |

Conventions: dates are ISO `YYYY-MM-DD` text, timestamps are `datetime('now')` (UTC), booleans are
0/1, and times are integer milliseconds at hundredth-of-a-second precision.

Cascades: deleting a competition removes its stations, categories, entries and results. Deleting a
category removes its entries (and their results). Athletes and exercises in use **cannot** be
deleted (FK RESTRICT, translated to a friendly message in `db/errors.ts`).

### 6.2 Migrations

Migrations are embedded with `include_str!` and run automatically by the SQL plugin on first
`Database.load()`. They are **append-only**: never edit a shipped migration; add `000N_*.sql` and
register it in `lib.rs` with the next `version`.

| # | File | Purpose |
|---|---|---|
| 1 | `0001_init.sql` | Base schema |
| 2 | `0002_lifecycle_rules.sql` | Status flow and setup/result locks (triggers) |
| 3 | `0003_speed_fit.sql` | `competitions.kind`, `speed_fit_times`, kind-isolation triggers |
| 4 | `0004_category_library.sql` | `category_presets`, seeded from existing categories |
| 5 | `0005_late_entries.sql` | `entries.late_entry`; relaxes entry/category locks while running |
| 6 | `0006_category_hierarchy.sql` | Library becomes age group → sub-group → level; each old preset becomes an age group with one sub-group (no levels); `categories.age_group`/`level` |
| 8 | `0008_unique_subgroups.sql` | Merges duplicate sub-groups, then a unique index prevents new ones |
| 7 | `0007_multiple_levels.sql` | Rebuilds `entries` (+ `scores`, `speed_fit_times`, all their triggers) so an athlete can enter several categories; bib triggers |

### 6.3 Competition lifecycle (enforced by triggers)

```
          start                 finish
 draft ─────────► running ─────────────► finished
                     ▲                      │
                     └──────── reopen ──────┘
```

Any other transition raises `That competition status change is not allowed.` `kind` can never change.

| Action | draft | running | finished |
|---|:-:|:-:|:-:|
| Edit name / date / location | ✅ | ❌ | ❌ |
| Stations: count and exercises | ✅ | ❌ | ❌ |
| Add category | ✅ | ✅ (for late athletes) | ❌ |
| Edit category rules | ✅ | ❌ | ❌ |
| Remove category | ✅ | only if empty | ❌ |
| Add / remove entry, change bib | ✅ | ✅ (new entries get `late_entry = 1`) | ❌ |
| Change entry category | ✅ | only while the entry has no results | ❌ |
| Enter / clear reps or times | ❌ | ✅ | ❌ |

Further invariants:

- an entry's category must belong to the same competition;
- an entry's athlete and competition never change;
- stations and scores exist only for Fitness Challenge, and times only for Speed Fit.

Cascade deletes still work in every state: during a cascade the parent competition row is already
gone, so the status sub-selects return NULL and the guards don't fire.

---

## 7. Frontend architecture

### 7.1 Boot sequence

`main.tsx` builds the provider stack:

```
StrictMode
 └ QueryClientProvider     staleTime: Infinity, no retries, no refetch-on-focus
    ├ MotionConfig reducedMotion="user"
    │  └ DatabaseGate      useQuery(["database"], db) → spinner / error + retry / children
    │     └ RouterProvider (hash router)
    └ Toaster (sonner)
```

`DatabaseGate` opens the DB (running any pending migrations) before any screen renders. If that
fails, it shows the error and a **Try again** button. `db()` clears its cached promise on failure so
the retry really retries.

### 7.2 Routing (`app/router.tsx`)

The app uses a hash router, because the bundled app is served from a custom protocol with no
server fallback.

| Path | Screen |
|---|---|
| `/` | redirect → `/competitions` |
| `/competitions` | `CompetitionsPage` (list) |
| `/competitions/:competitionId` | `CompetitionDetailPage` |
| `/athletes` | `AthletesPage` |
| `/categories` | `CategoriesPage` (category library) |
| `/exercises` | `ExercisesPage` |

All of these render inside `AppLayout` (sidebar navigation + animated `<Outlet/>`).

### 7.3 Data access layer (`src/db/`)

- `client.ts`: `db()` returns the single shared `Database` connection, a lazily created promise.
- One module per table exposes plain async functions (`listX`, `createX`, `updateX`, `deleteX`, …).
  SQL is written by hand with `$1…` parameters, and columns are aliased to camelCase
  (`first_name AS firstName`).
- `errors.ts` → `withConstraintMessages(promise, { unique, foreignKey })` turns SQLite
  `UNIQUE`/`FOREIGN KEY` failures into user-facing messages.
- `lib/errors.ts` → `errorMessage()` strips sqlx's `error returned from database: (code: N)` prefix,
  so trigger messages reach the user cleanly.
- Notable write patterns:
  - **Bib allocation** (`addEntries`): one `WITH … INSERT … SELECT` over `json_each(athleteIds)`:
    athletes already in the competition keep their bib, new ones get `MAX + ROW_NUMBER()`.
    All-or-nothing. (tauri-plugin-sql uses a connection pool, so `BEGIN`/`COMMIT` across calls is
    not reliable; keep multi-row writes to a single statement.) `setEntryBib` changes the bib on all of
    the athlete's entries in one statement.
  - **Results upsert** (`setScore`, `setTime`): `INSERT … ON CONFLICT DO UPDATE`. A `null` value deletes
    the row (clears the result).
  - **Station count** (`setStationCount`): an idempotent recursive-CTE `INSERT OR IGNORE`, then
    `DELETE … > count`. Re-running after a partial failure converges.
  - **Category snapshot** (`addCategoriesFromLibrary(levelIds)`): reads the levels with their sub-group
    and age group (`json_each`), composes names with `categoryName()` and inserts them in **one**
    multi-row `INSERT`, so it is all-or-nothing. Later library edits
    never change a competition's rules.
  - **Status change** (`setCompetitionStatus`): stamps `started_at` (first start only) and `finished_at`.
- `results.ts` returns a discriminated union `RecordedResults` (`scores` or `times`, depending on `kind`).
- Inputs are validated on the JS side too (e.g. `MAX_REPS`, `MAX_STATIONS = 50`, `MAX_TIME_MS`), with
  constants that mirror the SQL `CHECK`s.

### 7.4 Caching and mutations

`db/queryKeys.ts` defines a small hierarchy of query keys:

```
["athletes"]  ["exercises"]  ["categoryLibrary"]
["competitions"]                    list with counts
["competitions", id]                CompetitionSetup (competition + stations + categories + entries)
["competitions", id, "results"]     RecordedResults
```

Only this window writes to the DB, so queries never go stale on their own (`staleTime: Infinity`).
Every write goes through **`useDbMutation(fn, { invalidates, success })`** (`hooks/useDbMutation.ts`):

- on success it invalidates the listed roots (prefix match) and optionally shows a success toast;
- on error it shows `errorMessage(error)` as an error toast.

Invalidation choices:

- athlete and exercise writes also invalidate `competitions`, because competition screens embed
  their names;
- category-library writes touch only the library, because competitions hold copies;
- all competition setup writes invalidate `["competitions"]`, which also refreshes nested results;
- a single rep or time save invalidates only `["competitions", id, "results"]`, which keeps live
  scoring cheap.

Each feature exposes `useX()` (query) and `useXMutations()` (a group of `useDbMutation`s) in a
`useX.ts` file.

### 7.5 Domain engine (`src/engine/`)

The engine has no I/O and is fully unit-tested (`engine.test.ts`).

| Function | Rule |
|---|---|
| `ageOn(dob, date)` | **year(date) − year(dob)**. Month and day are ignored, so an athlete keeps one age for the whole calendar year. Throws on malformed dates. |
| `eligibilityProblems(athlete, rules, competitionDate)` | User-facing reasons (gender mismatch, below min, above max; bounds inclusive). Empty = eligible. |
| `assignPlaces(sorted, score)` | Standard competition ranking **1, 1, 3**. |
| `rankCategory(entries, stationNumbers, scores)` | Fitness Challenge. Sums reps (a missing station counts as 0 but sets `complete = false`), sorts descending and assigns places. The stable sort keeps ties in input order (the caller passes bib order). Scores for unknown entries or stations are ignored. |
| `rankByTime(entries, times)` | Speed Fit. Fastest first, ties share a place, athletes with no time come last with `place = null`. |
| `parseDuration(text)` | Accepts `83.4`, `1:23.45`, `01:23`, `1:02:03,5` (`.` or `,`, up to 2 decimals). Only the largest unit written may exceed 59. Must be > 0 and ≤ `MAX_TIME_MS`. Returns `undefined` if invalid. |
| `formatDuration(ms)` | `m:ss.cc`, or `h:mm:ss.cc` from one hour. Round-trips with `parseDuration`. |

### 7.6 Competition logic (`src/features/competitions/`)

- **`permissions.ts`**: `competitionPermissions(status)` → `{ editSetup, editEntries, addCategories,
  enterResults }`, plus `canRemoveCategory` and `canChangeCategory`. These mirror the triggers in
  §6.3.
- **`readiness.ts`**: `competitionReadiness(setup)` → `{ blocking, warnings }`, shown in
  `ReadinessCard`. **Start** is disabled while `blocking` is non-empty.
  - Blocking: no stations (Fitness Challenge only), a station without an exercise, no entries, an
    entry that no longer meets its category's rules.
  - Warnings: the same exercise at several stations, a category with no athletes.
- **`standings.ts`**: the single ranking entry point.
  - `competitionResults(setup, recorded)` → per-category standings, plus `missingResults`.
  - `entriesWithResults(results)` → entry IDs that already have a result (these entries can't change
    category, and removing one deletes its results).
  - `leaderboardRows(results, i)` → a challenge-neutral `{ entry, place, value, ranked, note }` for the
    Leaderboard and WinnerBanner.

### 7.7 Screens

**Categories page** is a custom tree: age-group cards → sub-group rows (sex + ages, edited in
`SubgroupFormDialog`) → level chips (named in `NameFormDialog`). A sub-group without levels can't
be added to a competition. Naming helpers live in `lib/labels.ts` (`subgroupName`, `categoryName`,
`categoryTitle`).

**Library pages** (Athletes, Exercises) are built on the generic
`components/shared/LibraryPage<T>`: a searchable table, an add/edit dialog via `renderForm`, and a
delete confirmation. A new library screen is just a column config plus a form dialog.

**Competition detail page** (`detail/CompetitionDetailPage.tsx`):

```
CompetitionDetailPage   load setup (["competitions", id])
 └ CompetitionDetail    if started, also load results; wait for them
    └ CompetitionView   header actions (Edit / Delete / Start / Finish / Reopen / Export)
       ├ ReadinessCard           (draft only)
       └ Tabs (keyed by status, so the default tab follows the lifecycle)
          ├ Results/Scoring/Timing → ResultsPanel   (running/finished)
          ├ Stations               → StationsPanel  (Fitness Challenge only)
          ├ Categories             → CategoriesPanel → AddCategoriesDialog
          └ Athletes               → EntriesPanel    → AddEntriesDialog
```

- **AddEntriesDialog**: pick a category, then tick athletes. Already-entered athletes are hidden,
  ineligible ones are disabled with the reason shown, and a **New athlete** button opens the athlete
  form. The athlete form is rendered *outside* the `<form>`, because React would otherwise bubble the
  nested dialog's submit event through the portal into the parent form. While the competition is
  running, the dialog is labelled as a late entry.
- **ResultsPanel**: sub-group tabs (`groupBySubgroup` in `standings.ts`), then level tabs (with "N
  missing" or a check), **Previous/Next** buttons (Next turns primary once the current category has
  all results), a progress line, and an **Enter athlete** shortcut for late entries. Below that:
  - `WinnerBanner`: current leader(s), re-animated when the lead changes;
  - `RepsGrid` (athletes × stations) or `TimesTable`: kept in **bib order** so rows don't jump while
    a judge types;
  - `Leaderboard`: in rank order, animated with `useFlipAnimation` as places change.
- **Finish confirmation**: warns how many station results are empty (counted as 0) or how many
  athletes have no time (listed without a place).

### 7.8 Shared UI building blocks

| Component / hook | Purpose |
|---|---|
| `CommitInput` (+ `CommitNumberInput`, `TimeInput`) | Saves on blur or Enter, reverts on Escape, on invalid input, or when the save promise rejects. Remounts when the stored value changes, so it always shows what is in the DB. Used for reps, times and bibs. |
| `FormDialog`, `FormActions`, `saveAndClose` | Standard dialog form. `formKey` remounts the form to re-seed its state. On failure the dialog stays open (the error toast comes from `useDbMutation`). |
| `CheckList`, `toggleInSet` | Multi-select list with per-item `disabledReason`. |
| `QueryState` | Renders the loading, error or data state of a query. |
| `ConfirmDialog`, `EmptyState`, `RowActions`, `SearchInput`, `CountryCombobox` | Small reusable pieces. |
| `useIconAnimation` / `AnimatedButton` | Lets the hover or focus of a whole button drive an animated icon. |
| `useFlipAnimation` | FLIP reorder animation using `transform` only. Respects reduced motion. |
| `useFormState` | Dialog form state: `values`, typed `set(key, value)`, `submitted`, `onSubmit(save)`. |
| `CountryLabel` | Country name + small ISO code. |
| `fullName` / `listName` (`lib/labels`) | "Ana Pop" for sentences, banners and exports; "Pop Ana" for tables and pick lists. |
| `subgroupName` / `categoryName` / `categoryTitle` | Category naming; `subgroupName` skips sex/ages the age group name already states. |

**Styling**: Tailwind 4 with theme tokens in `app/index.css` (OKLCH palette, IFBB navy `--primary`,
an added `--gold` accent, and a `surface` utility for raised panels). All motion uses only opacity and
transform, and the OS "reduce motion" setting disables it globally (CSS media query plus
`MotionConfig`). `.dark` tokens exist, but nothing in the app switches to dark mode yet.

### 7.9 Export (`src/export/`)

`ExportButtons` loads the export module with a dynamic import
(`await import("@/export/exportResults")`), so jsPDF and the ~8 k-line font files stay out of the
startup bundle. Export is offered only once the competition is **finished**.

```
exportResults(format, setup, results)
  ├ standingsTable.resultsTables()   one shared column layout:
  │     Fitness Challenge: Nr Crt | Athlete Name | Country | S1…Sn | Placement
  │     Speed Fit:         Nr Crt | Athlete Name | Country | Time  | Placement
  ├ pdf.resultsPdf()     A4 landscape, one page per category, each with the IFBB header
  │                      "<kind> — <categoryTitle> Official Results" and an autoTable,
  │                      podium cell colours, "Generated …" and "Page x of y" footer.
  │                      Embeds Noto Sans (pdfAssets) so names like "Łukasz" or "Şahin" render.
  ├ csv.resultsCsv()     one flat sheet with a Category column, UTF-8 BOM, CRLF, RFC-4180 quoting,
  │                      and formula-injection guarding (cells starting with = + @ tab CR, or "-"
  │                      followed by a non-digit, get a leading ').
  └ saveFile()           native Save-As dialog → plugin-fs writeFile. Returns false if cancelled.
```

`exportFileStem()` builds the default file name, e.g. `Cupa României 2026!` →
`cupa-romaniei-2026-results`.

---

## 8. Key flows end-to-end

**Recording a rep.** The judge types `25` in `RepsGrid` and presses Enter:

1. `CommitNumberInput` validates the range and calls `setScore.mutateAsync({ entryId, stationNumber, reps })`.
2. `db/scores.setScore` validates again, then runs the upsert.
3. SQLite triggers check that the competition is a Fitness Challenge and is `running`.
4. On success, `["competitions", id, "results"]` is invalidated and refetched.
5. `competitionResults` re-ranks, and the Leaderboard rows glide to their new places.
6. On failure, a toast shows the trigger message and the input reverts.

**Late entry.** While running, the user picks *Enter athlete* and ticks an athlete:

1. `addEntries` inserts the entry with the next bib.
2. The trigger `entries_mark_late` sets `late_entry = 1`.
3. `["competitions"]` is invalidated, and the athlete appears with a **Late entry** badge and empty
   results.

**Start / finish / reopen.** `setCompetitionStatus` runs an `UPDATE` with timestamps, and
`competitions_status_flow` validates the transition. The tabs are keyed by status, so the default
tab switches to Scoring or Results.

---

## 9. Development workflow

Prerequisites: Node.js LTS and the Rust toolchain (rustup). On Linux you also need the WebKitGTK
build dependencies (see `release.yml`).

```bash
npm install
npm run tauri dev     # Vite on :1420 + Tauri window with HMR
npm test              # Vitest: src/**/*.test.ts
npm run typecheck     # tsc -b (strict, noUncheckedIndexedAccess, noUnused*)
npm run tauri build   # installers in src-tauri/target/release/bundle/
```

`npm run dev` alone serves the UI in a browser, but every DB call fails there because the Tauri IPC
is missing. Use `tauri dev`.

**Tests** cover only pure modules (plus `src/consistency.test.ts`, which checks values that must
match across Rust, SQL and TypeScript: database URL, migration registration, version, limits): `engine.test.ts`, `standings.test.ts`, `permissions.test.ts`,
`readiness.test.ts`, `standingsTable.test.ts` (tables, CSV and file names), `validateAthlete.test.ts`
and `validateCategory.test.ts`. The SQL triggers and the React components have no automated tests.
Exercise those manually in `tauri dev`.

**Resetting data**: delete `fitness-challenge.db` from the app-data folder (on Windows,
`%APPDATA%\org.ifbb.fitnesschallenge\`; on macOS, `~/Library/Application Support/org.ifbb.fitnesschallenge/`).

### Releasing

1. Bump the version in `package.json` and `src-tauri/Cargo.toml` (`tauri.conf.json` reads
   `package.json`; `src/consistency.test.ts` fails if Cargo differs).
2. Commit, then `git tag vX.Y.Z && git push origin vX.Y.Z`.
3. `release.yml` runs typecheck and tests, then builds:
   - a macOS universal `.dmg`;
   - Windows `.msi` and `setup.exe`;
   - Linux `.AppImage`, `.deb` and `.rpm` (built on Ubuntu 22.04 for older-distro compatibility).

   The artifacts are attached to a **draft** GitHub release.
4. The macOS build is unsigned, so users must right-click → **Open** on first launch.

---

## 10. How to extend

**Add a column or table**

1. Write `src-tauri/migrations/000N_name.sql`, including triggers if the lifecycle applies.
2. Register it in `lib.rs` with `version: N`.
3. Update the matching `src/db/*.ts` module: types, `COLUMNS`, aliases.
4. If a new query root is needed, add it to `queryKeys.ts` and pick its invalidations carefully.

**Add a lifecycle rule**: add the trigger first (the source of truth), then mirror it in
`permissions.ts` (and `readiness.ts` if it should block the start), then add a test in
`permissions.test.ts`.

**Add a library screen**: a `db` module, `useX.ts` with `useX` + `useXMutations`, a form dialog,
and a page built on `LibraryPage`. Then add a route in `router.tsx` and a `NAV_ITEMS` entry in
`AppLayout.tsx`.

**Add a challenge type**:

1. Extend the `kind` CHECK (this needs a table rebuild in SQLite) and add a results table with
   kind-isolation and lifecycle triggers.
2. Add a ranking function in `engine/`.
3. Extend the unions in `RecordedResults` (`db/results.ts`) and `CompetitionResults` (`standings.ts`).
4. Handle the new kind in `leaderboardRows`, `resultsTables`, `readiness`, `ResultsPanel` and
   `COMPETITION_KIND_LABELS`.

TypeScript's discriminated unions will flag most of the places you miss.

**Add an export format**: build rows with `resultsTables()` so the layout stays consistent, then
call `saveFile()` from `exportResults.ts`.

**Add a shadcn component**: `npx shadcn add <name>`. It lands in `src/components/ui/`.

---

## 11. Known limitations and gotchas

- **`DATABASE_URL` and the reps/time/age limits are written in two languages.** They can't share
  one definition; `src/consistency.test.ts` fails if they drift.
- **Lifecycle triggers repeat the same status lookup** in each trigger. That's the SQLite idiom;
  copy an existing trigger when adding a rule.
- **Single window, single writer** is assumed (`staleTime: Infinity`). Opening a second window or
  editing the DB externally would show stale data until something invalidates the cache.
- **Age rule** is year-based by design (IFBB convention), not an exact birthday calculation.
- **Speed Fit times** are stored at hundredth-second precision. `parseDuration` rejects three or
  more decimals rather than rounding.
- **Bibs**: an athlete's first entry gets `MAX + 1`, later entries reuse it. Athlete counts
  (`entryCount`, the Athletes tab) count distinct athletes, not entries. Gaps left by removed entries are not reused, and bibs can be
  edited by hand (1–99 999 in the UI).
- **Category library** is copied, not linked. Renaming a preset never renames it inside existing
  competitions (intended).
- `README.md` says "Windows and macOS", but CI also produces Linux packages. Its Structure table
  also predates the `features/categories/` folder.
- App icons in `src-tauri/icons/` are generated from `src/assets/ifbb-logo.png` (centred on a white
  rounded square) with `npx tauri icon <square.png>`.
- The `next-themes` dependency and the `.dark` tokens exist, but there is no theme switcher yet.
