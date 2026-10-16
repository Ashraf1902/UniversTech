# UniversTech

> _Campus, elevated._ — An animated, super-hero styled e-learning & university management platform for students, professors, and university administrators.

UniversTech runs an entire campus experience in one place: course catalogs and registration, paid course access, lectures and quizzes, attendance, grades and GPA reports, schedules with room/conflict checks, events with audience targeting, notifications, bulk CSV import, reporting, and multi-role administration with granular role-based permissions.

It is built as **two decoupled applications** that talk over a JSON REST API:

| Piece | Location | Stack |
| --- | --- | --- |
| **Frontend (SPA)** | `D:\UniversTech\front-end` | React 18 + Vite 5 + React Router 6 |
| **Backend (API)** | `D:\UniversTech\univers-tech.pro\univers-tech.pro` | Laravel 13 · PHP 8.4 · Sanctum · MySQL 8 (Postgres on Render) |

> The repository root is `D:\UniversTech`. The Laravel app lives one level down in the nested `univers-tech.pro\univers-tech.pro` folder, and the React app is the sibling `front-end` folder.

---

## Table of contents

- [Architecture overview](#architecture-overview)
- [Roles & features](#roles--features)
  - [Public / guest](#public--guest)
  - [Student](#student)
  - [Professor](#professor)
  - [Admin (scoped) & super admin](#admin-scoped--super-admin)
- [Technical design](#technical-design)
  - [Frontend](#frontend)
  - [Backend](#backend)
  - [Authentication & authorization](#authentication--authorization)
  - [API conventions](#api-conventions)
  - [File uploads](#file-uploads)
  - [Internationalization (i18n)](#internationalization-i18n)
- [Data model](#data-model)
- [Admin scopes](#admin-scopes)
- [Configurable settings](#configurable-settings)
- [Scheduled jobs](#scheduled-jobs)
- [Getting started](#getting-started)
- [Demo accounts](#demo-accounts)
- [Project structure](#project-structure)
- [Key commands](#key-commands)
- [Testing](#testing)
- [Known caveats & gotchas](#known-caveats--gotchas)
- [Follow-ups](#follow-ups)

---

## Architecture overview

```
┌─────────────────────────┐        /api/* (proxy)        ┌──────────────────────────────┐
│  React SPA (Vite dev)   │ ──────────────────────────► │  Laravel API                 │
│  localhost:5173         │                              │  (php artisan serve / -t)    │
│                         │                              │  - Sanctum token auth        │
│  role-scoped dashboards │                              │  - role / scope middleware   │
│  (student/prof/admin)   │                              │  - MySQL 8 (or Postgres)     │
└─────────────────────────┘                              └──────────────────────────────┘
                                                                     │
                                                   uploads served from public/uploads
                                                       (junction → public_html/uploads)
```

- The **frontend** is a `BrowserRouter` app with three role-scoped sections under `/app/student`, `/app/professor`, and `/app/admin`.
- The **backend** exposes a JSON API under `/api` and authenticates with **Laravel Sanctum** bearer tokens.
- During development the Vite dev server proxies every `/api/*` request to `http://127.0.0.1:8000` (see `front-end/vite.config.js`). The frontend therefore calls relative paths such as `/api/user/courses`; set `VITE_API_URL` only if the API is hosted elsewhere.

---

## Roles & features

### Public / guest

The **login screen** doubles as a campus landing page and the entry point for all three roles:

- Event carousel — the latest events with image and title (`/api/public/events`).
- **Role tabs** (Student / Professor / Admin) switch the sign-in form between the three login endpoints.
- **Registration via access request** — guests submit a sign-up form (name, email, password, gender, optional phone/national id/level/department). This is **not** auto-approval: it creates an `AccessRequest` an admin must approve before the account becomes active. Decisions can email the applicant (approve/reject) with an optional rejection reason.
- **Password reset** — `POST /api/…/forgot-password` emails a reset link (`FRONTEND_URL`), and the SPA's `ResetPassword` screen completes the flow.
- Language toggle (English / Arabic) with full RTL switch.

### Student

After login (guard: `role:student` + `active`):

- **Home** — profile snapshot, upcoming schedule, notifications, quick actions.
- **My courses** — registered courses (paginated) with cover images, professor, progress bars, and a link into each course.
- **Catalog** — browse offered courses and register; registration is gated by the enrollment window, credit limit, capacity, prerequisites, and schedule-conflict rules. Subscribing is gated by payment.
- **Course detail / lectures** — per-course lectures with a reader and progress tracking (`student_lectures`).
- **Quizzes** — view quiz/submission state and submit answers/files before the deadline (score + feedback once graded).
- **Attendance** — per-course attendance summary with absence warnings / exam-bar indicators.
- **Schedule** — weekly timetable for the active semester.
- **Reports & GPA** — per-semester final scores with letter rates plus cumulative GPA; can open grade appeals within the appeal window.
- **Notifications** — tabs for notifications / events / announcements.
- **Payments** — pay for courses or a year; view history and download receipts.

### Professor

After login (guard: `role:professor` + `active`, plus per-course ownership checks):

- **Home** — profile, assigned courses, latest events, notifications.
- **Courses** — assigned courses.
- **Students / attendance** — per-course roster; record and correct attendance within the edit window.
- **Lectures** — create/edit lectures with file uploads.
- **Quizzes** — create quizzes and grade submissions.
- **Grades** — enter grades and grade components; publish to the lifecycle (draft → published → locked); edit within the edit window with a reason.
- **Appeals** — respond to students' grade appeals on owned courses.
- **Announcements** — post course announcements to registered students (queued fan-out).
- **Schedule** — own weekly timetable for the active semester.
- **Notifications** — bell feed.

### Admin (scoped) & super admin

After login (guard: `role:admin`), admin modules are gated by **scopes**. A super admin sees everything; a scoped admin sees only their assigned modules (`CheckAdminScope`).

- **Control Center** — KPI tiles and insights.
- **Accounts** — manage student/professor accounts (create, edit, delete, status).
- **Access requests** — approve/reject guest sign-ups.
- **Departments / Courses / Semesters / Schedules** — core academic setup; schedules include room assignment and conflict checks.
- **Enrollment** — manual enroll/unenroll and view enrollment state.
- **Grades / Appeals** — grade override and appeal moderation.
- **Attendance** — admin attendance management and corrections.
- **Payments** — payment records with override (mark paid/waived/refunded).
- **Events** — publish events with image and audience targeting (all / by department / by level).
- **Announcements** — course announcement moderation.
- **Rollover** — semester rollover (promote/graduate students, close semester, lock grades).
- **Import** — two-step CSV import of students/courses (preview then apply).
- **Reports** — enrollment / payments / attendance aggregates with CSV export.
- **Activity** — audit log viewer.
- **Settings** — edit the runtime policy values (see [Configurable settings](#configurable-settings)).
- **Admins & roles** (super admin only) — create/edit/delete admin accounts and assign scopes.

---

## Technical design

### Frontend

A dependency-light React SPA. The only runtime packages are `react`, `react-dom`, and `react-router-dom`; icons, modals, toasts, loaders, and tables are hand-rolled in `src/lib/ui.jsx` with inline SVG icons.

- **API layer** — `src/lib/api.js` exposes `request(path, {method, data|formData})`, plus `downloadFile()`, `normalizePage()`, `buildQuery()`, and `ApiError`. It attaches the bearer token, sends JSON or multipart, and on a 401 fires `ut:unauthorized` so the app bounces to login.
- **Auth** — `src/lib/auth.jsx` stores the session in `localStorage` (`ut:session`) and provides `login/logout/role/user/isAuthed`.
- **Async hook** — `src/lib/hooks.js` `useAsync(fn, deps)` manages loading/data/error.
- **i18n** — `src/lib/i18n.jsx` `useI18n()` → `{ lang, setLang, t, isRTL, dir }`; dictionaries in `src/lib/lang/{en,ar}.js`. `t()` supports `{token}` interpolation but cannot inject JSX.
- **UI kit** — `src/lib/ui.jsx`: `I` (≈30 inline SVG icons), `Btn`, `Field`, `Badge`, `Modal`/`FormModal`, `ToastProvider`/`useToast`, `Empty`, `Avatar`, `Reveal`, etc.
- **Layout** — `src/layout/DashboardLayout.jsx`: shared sidebar/topbar, `NavLink` menus per role, `RoleGate`, and a language toggle. Admin NAV items carry a `scope` (and `super: true`) so unauthorized modules are hidden.
- **Pages** — split by role into `src/pages/{student,professor,admin}/` (plus `Login.jsx`, `ResetPassword.jsx`), each with a small `_shared.jsx` (`DataTable`, `Head`, `useList`, `useOptions`, …) and an `index.jsx` barrel.
- **Styling** — `src/styles/main.css`: dark "super-hero" theme plus RTL rules (`html[dir='rtl'] …`) and an Arabic font block.

### Backend

Standard Laravel structure with domain logic under `app/`:

- **Controllers** (46 files): `API\` (auth, public, access requests, facts), `API\Student\`, `Admin\` (per-module + `AdminManagementController`), `Professor\`.
- **Requests** — dedicated `FormRequest` classes per mutation.
- **Middleware** — `CheckUserRole` (`role:…`), `CheckAdminScope` (`admin-scope:…`), `EnsureAccountActive` (`active`), `PaidCourses`. All return **403** on denial.
- **Traits** — `LogsActivity`, `AuthorizesCourseOwnership`, `Notifiable`, `FetchRequestError`, and file helpers under `Traits\File\`.
- **Models** — 29 Eloquent models (see [Data model](#data-model)).
- **Support** — `App\Support\Settings` (policy values), `PasswordRealm` (reset realms), `ScheduleOverlap` (conflict detection), `ActivityLogger`.
- **Services** — `ImportService` (CSV parsing/validation), `AttendanceService`.
- **Jobs** — `FanOutNotification` (`ShouldQueue`).
- **Console** — `notify:lecture-reminders`, `activity:prune` (audit-log retention, disabled by default).

### Authentication & authorization

Three auth realms, each with its own login/logout flow and Sanctum tokens:

| Role | Login route | Rows |
| --- | --- | --- |
| Student | `POST /api/auth/login` | `users` (`type = 0`) |
| Professor | `POST /api/prof/auth/login` | `users` (`type = 1`) |
| Admin | `POST /api/admin/auth/login` | `admins` |

- **Account status** (`users.status`): active / suspended / graduated / inactive. `EnsureAccountActive` blocks non-active users with 403.
- **Admin scopes** — `admins.is_super_admin` (bool) + `admins.roles` (JSON array of scopes). `Admin::isSuperAdmin()` bypasses scope checks; `Admin::hasRole($scope)` checks the array; `CheckAdminScope` gates each resource group. `AdminManagementController` is **super-admin only** and guards self/super-admin modification.
- **Professor ownership** — `AuthorizesCourseOwnership` returns 403 when a professor touches a course they do not own (lectures, quizzes, grades, announcements, appeals).
- **Paid-course gating** — `PaidCourses` (403) blocks access to course content until a `paid`/`waived` `courses`-type payment exists for the current year.

### API conventions

- Responses use `{ status, message, data }` via the `SendResponse()` helper (`app/Helpers.php`). The client unwraps `data` and throws `ApiError(message, status, payload)` on non-2xx.
- List endpoints are paginated Laravel paginators / `Resource::collection` (`{ data, links, meta }`), normalized by `normalizePage()`.
- Validation failures return **422** with the envelope `{ status: 422, message: "error in body request", data: { "<field>": ["<message>", …] } }` (the renderer wraps `$e->errors()` into `data`; the frontend throws `ApiError` and surfaces the first message of the first field).
- File uploads use `multipart/form-data`; the wrapper deliberately does not set `Content-Type` so the browser adds the boundary.

### File uploads

- Stored via the **`files`** disk: root `base_path('public_html/uploads')`, public URL `/uploads`.
- UUID filenames; folders per entity (`events/`, `images/…`, `lectures/`, ...).
- **Quirk**: the disk root is `public_html/uploads` while the dev server docroot is `public`. Fix locally with a directory junction: `mklink /J public\uploads public_html\uploads`.

### Internationalization (i18n)

- `I18nProvider` + `useI18n` (`src/lib/i18n.jsx`); default `en`, switchable to `ar` (persisted in `ut:lang`, sets `<html lang/dir>`).
- Every user-facing string is translated; `en.js` and `ar.js` are kept to **identical key sets** (verified by script during QA).

---

## Data model

Key tables (migrations under `database/migrations/`; the custom `2026_*` migrations modernize the older 2013–2024 schema):

- **`admins`** — admin accounts + `is_super_admin`, `roles`.
- **`users`** — students and professors (`type` 0/1) with department/level, credit points, semester, and `status`.
- **`departments`**, **`levels`** (with `position`).
- **`courses`** — code/title/hours/cover, department (nullable), professor, semester, `capacity`; **`course_prerequisites`** links courses.
- **`semesters`** — academic year, `is_active`, registration window (`registration_opens_at/closes_at`), `closed_at`.
- **`schedules`** — weekly timetable with `room_id`, day, times, section type, level/department/course, semester.
- **`rooms`** — name/building/capacity (unique name+building).
- **`student_courses`** (enrollments) — `status` (registered / dropped / completed / failed), `status_changed_at`, `semester_id`.
- **`student_lectures`** — per-student lecture progress (unique student+lecture).
- **`lectures`**, **`quizzes`** (+ `max_score`, `published_at`), **`quiz_submissions`** (unique quiz+student; file/answer/score/feedback/graded_by).
- **`grades`** — lifecycle `status` (draft / published / locked), publish/lock morphs, `edit_reason`; **`grade_components`** (course, name, weight, position) and **`grade_component_scores`**; **`grade_appeals`** (reason, status, response).
- **`attendances`** — per lecture/course with `recorded_by` morph + soft deletes; **`attendance_threshold_alerts`** (unique student+course+threshold).
- **`events`** — campus events with `audience` (all / targeted) and pivots `event_departments`, `event_levels`.
- **`announcements`** — course announcements (course + professor/admin authors).
- **`notifications`** — bell feed with `type`, `category`, optional `course_id` / `announcement_id`.
- **`payments`** — courses/year tuition with `status` (pending / paid / waived / refunded / failed), `receipt_number`, timestamps.
- **`access_requests`** — pending registrations (status + `rejection_reason`).
- **`student_promotions`** — rollover history (from/to semester + level, action).
- **`settings`** — runtime policy key/value.
- **`activity_logs`** — audit log (`action`, actor morph, `properties`, indexed by action/created_at/actor).
- **`personal_access_tokens`** — Sanctum tokens.

Relationships are defined on the models (`User`, `Admin`, `Course`, `Grade`, `Payment`, `Schedule`, `Event`, …).

> **Migration timestamps:** the newest shipped migration is `2026_10_25_000001`. Any **new** migration must be timestamped **after** that (e.g. `2026_10_26_000001_...`) so it applies last on existing databases; keep it additive with a working `down()`.

---

## Admin scopes

`VALID_SCOPES` (in `AdminManagementController`) — assign any subset to a non-super admin:

`accounts` · `access_requests` · `departments` · `courses` · `semesters` · `schedules` · `events` · `grades` · `attendances` · `payments` · `reports` · `activity` · `settings`

---

## Configurable settings

Runtime policy values live in the `settings` table and fall back to `config/enrollment.php` defaults. `App\Support\Settings` reads them with typed accessors. Change them in the admin **Settings** page (`admin-scope:settings`).

| Key | Default | Meaning |
| --- | --- | --- |
| `credit_limit` | `18` | Max credit hours a student may register per semester. |
| `passing_score` | `50` | Min % for a prerequisite to count as passed (out of 100). |
| `drop_window_days` | `14` | Days after the registration window within which a student may drop. |
| `grade_edit_window_hours` | `48` | Hours after publish a professor may still edit a grade (with reason). |
| `attendance_edit_window_hours` | `48` | Hours after recording a professor may still correct attendance. |
| `attendance_warn_threshold` | `15` | Absence % per course that triggers a warning notification. |
| `attendance_bar_threshold` | `25` | Absence % per course flagged as "exam barred" (informational). |
| `appeal_window_days` | `14` | Days after publication a student may appeal a grade. |
| `quiz_allow_resubmit` | `false` | Whether a student may resubmit a quiz. |
| `quiz_allow_late` | `false` | Whether late quiz submissions are accepted. |
| `quiz_submission_max_kb` | `10240` | Max quiz submission file size (KB). |
| `flag_refund_on_drop` | `true` | Flag a refund for admin review when a paid course is dropped. |

**New environment variables** (see `.env.example`):

| Var | Purpose |
| --- | --- |
| `FRONTEND_URL` | Frontend origin used to build links in emails (password reset, access-request decisions). |
| `MAIL_MAILER` / `MAIL_*` | Mail transport. Local/dev uses `log`; production sets `smtp` (+ credentials). |
| `PAYMENT_DEMO_MODE` | When `true`, payments succeed without a real charge (no Stripe call). |
| `PAYMENT_CURRENCY` | Currency code for payments. |
| `DB_CONNECTION` / `DATABASE_URL` | MySQL locally; Postgres on Render. |

---

## Scheduled jobs

`php artisan schedule:work` (or OS cron hitting the scheduler) runs:

- `notify:lecture-reminders` — daily at **08:00** and **16:00**: notifies enrolled students about upcoming lectures from the active semester's schedule.
- `activity:prune` — audit-log retention (default retention 24 months); **disabled by default** (see `bootstrap/app.php`).

---

## Getting started

### Prerequisites

- **PHP ≥ 8.4** with the usual Laravel extensions.
- **Composer**, **Node.js (npm)**.
- **MySQL 8** (local dev); Postgres for the Render target.

### Backend setup

```bash
cd D:\UniversTech\univers-tech.pro\univers-tech.pro
composer install
copy .env.example .env
php artisan key:generate
# configure .env: APP_URL, FRONTEND_URL, DB_* , MAIL_* , PAYMENT_*
php artisan migrate
php artisan db:seed          # optional: coherent demo dataset
php artisan serve            # → http://127.0.0.1:8000
```

> The dev backend is commonly launched as `php -S 127.0.0.1:8000 -t public` inside the project so `/uploads/*` resolves through the `public/uploads` junction.

### Frontend setup

```bash
cd D:\UniversTech\front-end
npm install
npm run dev                  # → http://localhost:5173 (proxies /api → 127.0.0.1:8000)
```

### Required services

1. MySQL running (default DB `univars_tech`).
2. Backend API on `127.0.0.1:8000`.
3. Vite dev server on `localhost:5173`; open `http://localhost:5173/login`.

---

## Demo accounts

`php artisan migrate:fresh --seed` runs `DatabaseSeeder`, which creates a **deterministic, idempotent** demo dataset. All accounts share the password:

```
Demo@12345
```

| Role | Email | Scope / notes |
| --- | --- | --- |
| Super admin | `superadmin@universtech.demo` | Full access incl. Admins & Roles. |
| Scoped admin | `registrar@universtech.demo` | accounts, courses, schedules, semesters, grades, attendances, departments, reports, settings |
| Scoped admin | `finance@universtech.demo` | payments, reports |
| Scoped admin | `events@universtech.demo` | events, access_requests, activity |
| Professor | `professor@universtech.demo` | Owns seeded courses. |
| Student | `student@universtech.demo` | Enrolled with mixed statuses. |

The seed covers every new feature: courses with prerequisites and capacity, a room-backed schedule, enrollments in every status, grade components and scores, a grade appeal, quizzes with submissions, announcements (incl. Arabic for RTL checks), attendance rows plus a threshold alert, payments in every status, targeted events, access requests, a promotion record, and activity-log entries.

---

## Project structure

```
D:\UniversTech
├── front-end                          # React SPA
│   ├── vite.config.js                 # dev proxy /api → 127.0.0.1:8000
│   └── src
│       ├── main.jsx / App.jsx         # entry + routes/providers
│       ├── layout/DashboardLayout.jsx # role-scoped shell + NAV + RoleGate
│       ├── lib/
│       │   ├── api.js  auth.jsx  hooks.js  i18n.jsx  ui.jsx
│       │   └── lang/{en,ar}.js         # dictionaries (identical key sets)
│       ├── pages/
│       │   ├── Login.jsx  ResetPassword.jsx
│       │   ├── student/   professor/   admin/   # per-role pages + _shared + index
│       └── styles/main.css             # theme + RTL rules + Arabic font block
│
└── univers-tech.pro/univers-tech.pro   # Laravel API
    ├── app
    │   ├── Http/Controllers/{API,API\Student,Admin,Professor}
    │   ├── Http/Middleware/            # CheckUserRole, CheckAdminScope, EnsureAccountActive, PaidCourses
    │   ├── Http/Requests/  Http/Resources/
    │   ├── Models/                     # 29 Eloquent models
    │   ├── Services/                   # ImportService, AttendanceService
    │   ├── Support/                    # Settings, PasswordRealm, ScheduleOverlap, ActivityLogger
    │   ├── Traits/  Jobs/  Console/Commands/
    │   └── Helpers.php                 # SendResponse()
    ├── bootstrap/app.php               # middleware aliases + scheduling + user route group
    ├── config/{filesystems,enrollment,mail}.php
    ├── database/{migrations,factories,seeders}
    ├── public/ + public_html/          # web root + uploads dir (junction)
    ├── routes/{api.php,user-api.php}
    └── tests/                          # PHPUnit feature tests
```

---

## Key commands

| Action | Command |
| --- | --- |
| Install backend deps | `composer install` |
| Install frontend deps | `npm install` |
| Run backend | `php artisan serve` (or `php -S 127.0.0.1:8000 -t public`) |
| Run Vite dev server | `npm run dev` |
| Production frontend build | `npm run build` (outputs to `front-end/dist`) |
| Migrate DB | `php artisan migrate` |
| Seed demo data | `php artisan db:seed` |
| Full reset + seed | `php artisan migrate:fresh --seed` |
| Run tests | `php vendor/phpunit/phpunit/phpunit` |
| Lecture reminders | `php artisan notify:lecture-reminders` |
| Prune audit log | `php artisan activity:prune` |
| Fix missing image serving | `cmd /c mklink /J "…\public\uploads" "…\public_html\uploads"` |

---

## Testing

- PHPUnit feature tests live under `backend/tests/Feature`. The suite runs against **MySQL** in CI and can run against SQLite locally by overriding `DB_CONNECTION=sqlite` / `DB_DATABASE=…`.
- Coverage includes security (roles/scopes/status/ownership), enrollment rules, grade lifecycle/appeals, rollover, attendance, quizzes, payments, schedules/conflicts, announcements/event targeting, bulk import, and reports.

---

## Known caveats & gotchas

1. **Image URLs 404 after upload** — files land in `public_html/uploads` but `-t public` serves from `public/uploads`; keep the `public/uploads` junction.
2. **Vite is IPv6-bound in this workspace** — always use `http://localhost:5173`, not `127.0.0.1:5173`.
3. **i18n interpolation** — `t(key, vars)` only substitutes `{word}` placeholders; it cannot embed JSX.
4. **Windows PowerShell + JSON payloads** — use `[IO.File]::WriteAllText`; `Set-Content -Encoding UTF8` adds a BOM that breaks Laravel JSON parsing.
5. **CP1252 consoles** — printing Arabic from PowerShell/Python needs `encode('unicode_escape')`.
6. **`AttendaceProfessorController`** keeps its original (misspelled) class name for route backward-compatibility.
7. **Validation status code** — the codebase uses **422** (see [API conventions](#api-conventions)).

---

## Follow-ups

Deferred / noticed, deliberately **not** part of the completed roadmap:

- Change requests to alter the validation status code — kept **422**.
- Split the remaining larger page modules; further extract shared admin components.
- Token storage / cookie-auth migration, containerization, CI pipeline definition.
- Real Stripe integration (demo mode is the default).
- Backend hosting/deployment (Render/other) — separate decision.
- Progressive table alignment in dense tables uses physical `text-align: right` for action columns (consistent across the app); revisit if stricter logical-property RTL alignment is desired.
