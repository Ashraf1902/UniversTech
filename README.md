# UniversTech

> _Campus, elevated._ — An animated, super-hero styled e-learning & university management platform for students, professors, and university administrators.

UniversTech is a full-stack web application that runs an entire campus experience in one place: course catalogs and registration, paid course access, lectures and quizzes, attendance, grades and GPA reports, schedules, events, notifications, and multi-role administration with granular role-based permissions.

It is built as **two decoupled applications** that talk over a JSON REST API:

| Piece | Location | Stack |
| --- | --- | --- |
| **Frontend (SPA)** | `D:\UniversTech\front-end` | React 18 + Vite 5 + React Router 6 |
| **Backend (API)** | `D:\UniversTech\univers-tech.pro\univers-tech.pro` | Laravel 13 (PHP 8.3) + MySQL + Laravel Sanctum |

---

## Table of Contents

- [Architecture overview](#architecture-overview)
- [Roles & features](#roles--features)
  - [Public / Guest](#public--guest)
  - [Student](#student)
  - [Professor](#professor)
  - [Admin & super admin](#admin--super-admin)
- [Technical design](#technical-design)
  - [Frontend](#frontend)
  - [Backend](#backend)
  - [Authentication & authorization](#authentication--authorization)
  - [API conventions](#api-conventions)
  - [File uploads](#file-uploads)
  - [Internationalization (i18n)](#internationalization-i18n)
- [Data model](#data-model)
- [Scheduled jobs](#scheduled-jobs)
- [Getting started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Backend setup](#backend-setup)
  - [Frontend setup](#frontend-setup)
  - [Required services](#required-services)
- [Default accounts](#default-accounts)
- [Project structure](#project-structure)
- [Key commands](#key-commands)
- [Known caveats & gotchas](#known-caveats--gotchas)

---

## Architecture overview

```
┌─────────────────────────┐        /api/* (proxy)        ┌──────────────────────────────┐
│  React SPA (Vite dev)   │ ──────────────────────────► │  Laravel API (PHP built-in   │
│  localhost:5173         │                              │  server) 127.0.0.1:8000     │
│                         │                              │  - Sanctum token auth       │
│  single .jsx entry +    │                              │  - role / scope middleware  │
│  role-scoped dashboards │                              │  - MySQL (univars_tech)     │
└─────────────────────────┘                              └──────────────────────────────┘
                                                                    │
                                                   uploads served from public/uploads
                                                       (junction → public_html/uploads)
```

- The **frontend** is a browser router app (`BrowserRouter`) with three role-scoped sections under `/app/student`, `/app/professor`, and `/app/admin`.
- The **backend** exposes a JSON API under `/api` and authenticates requests with **Laravel Sanctum** bearer tokens.
- During development the Vite dev server proxies every `/api/*` request to `http://127.0.0.1:8000` (see `front-end/vite.config.js`). Because of this, the frontend calls relative paths like `/api/user/courses` — no hard-coded API host is needed. A `VITE_API_URL` env var can override the base if the backend is hosted elsewhere.

---

## Roles & features

### Public / Guest

The **login screen** doubles as a mini campus landing page and is also a one-stop entry point for all roles:

- Event carousel — the 6 latest events with their image and title (`/api/public/events`), auto-rotating every 4.5s.
- **Role tabs** (Student / Professor / Admin) switch the sign-in form between the three login endpoints.
- **Registration via access request** — guests fill a sign-up form (name, email, password, gender, optional phone/national id/level/department). This is **not** auto-approval: it creates an `AccessRequest` that an admin must approve before the account becomes active.
- Language toggle (English / Arabic) with full RTL switch.
- Static "facts" counters (students / professors / departments) shown on the page.

### Student

After login (guard: `role:student`):

- **Home** — profile snapshot, upcoming schedule, notifications, quick actions.
- **My Courses** — courses the student registered for and paid for. Paginated list with cover images, professor, progress bars, and a link into each course.
- **Course Catalog** — browse all offered courses; select any number and **register** (creates enrollments). Subscribing is gated by payment (see below).
- **Course detail / lectures** — per-course page listing its lectures (PDFs / content) with a built-in reader; **watches progress** via `update_progress` (tracked per lecture in a per-student `student_lectures` table).
- **Schedule** — weekly timetable for the active semester, sorted by day, from the schedules table.
- **Reports & GPA** — per-semester final scores with letter rates, plus cumulative GPA across all graded subjects.
- **Notifications** — tabs for notifications / events / announcements (feeds come from one endpoint with a tab path segment).
- **Payments** — a "make payment" action (courses or yearly) creates a payment record; Stripe is integrated but **demo mode** is the default and returns success without a real charge.

### Professor

After login (guard: `role:professor`):

- **Home** — profile, assigned courses, latest events, notifications.
- **My Courses** — list of courses assigned to the professor.
- **Students & attendance** — pick a course, see enrolled students, record attendance per lecture (`make/attendance`).
- **Lectures** — create/upload lectures (multipart upload: file content + title/description) per course; list existing ones.
- **Quizzes** — create quizzes per course (multipart upload supporting files), list and delete them.
- **Grades** — enter student grades per course (score, comment), list, and delete them. These feed the student reports/GPA.
- **Notifications** — inbox endpoint for everything the platform sends the professor.

### Admin & super admin

After login (guard: `role:admin`), the admin dashboard is split into management panels. Navigation is **filtered by permissions** (scope):

- **Control Center** (home) — counts/quick insights (students, professors, departments, events, etc.).
- **Accounts** — manage student & professor accounts: create, view, edit, delete. Consistent user fields include gender, national id, phone, credit points, semester, type, department, level, job title.
- **Access Requests** — review guest sign-ups and **approve/reject** them (`access-request/respond`).
- **Departments** — create, edit, delete, and list departments (with abbreviation).
- **Courses** — create, edit, delete, and list courses (title, code, credits, cover image, professor, department, level, semester).
- **Semesters** — manage semesters; the active one drives schedules and reports.
- **Schedules** — define the weekly timetable: day, times, section type (lecture/seminar/lab), level, semester, department, course, and an optional image.
- **Events** — publish campus events with title, content, and a **photo** (image upload). Publishing pushes a notification to **all students** and to the admin.
- **Grades / semester card** — manage grades and generate per-student semester cards.
- **Admins & Roles** (super admin only) — create, edit, and delete administrator accounts and pick **which modules each admin can manage** (role chips). See [Authentication & authorization](#authentication--authorization).

---

## Technical design

### Frontend

A dependency-light React SPA. The only runtime packages are `react`, `react-dom`, and `react-router-dom` — everything else (icons, modals, toasts, loaders, tables, forms) is **hand-rolled** in `src/lib/ui.jsx` with inline SVG icons.

- **State/API layer** — `src/lib/api.js` exposes a `request(path, {method, data|formData})` fetch wrapper: attaches the bearer token, sends JSON or multipart, normalizes Laravel pagination (`normalizePage`), builds query strings (`buildQuery`), and throws `ApiError` with status + payload. On a 401 it fires an `ut:unauthorized` custom event that global listeners use to bounce to login.
- **Auth** — `src/lib/auth.jsx` (React context) stores the token/session in `localStorage` (`ut:session`), and provides `login(role, email, password)`, `logout()`, plus `role`/`user`/`isAuthed`. Repeated tokens survive reload.
- **Async hook** — `src/lib/hooks.js` `useAsync(fn, deps)` manages loading/data/error with a rerunnable `run()`.
- **i18n** — `src/lib/i18n.jsx` provides `useI18n()` with `{ lang, setLang, t, isRTL, dir }`. Dictionaries live in `src/lib/lang/{en,ar}.js` (115 keys each). `t()` supports simple `{token}` string interpolation but **cannot inject JSX** — keep interpolations inside a full sentence.
- **UI kit** — `src/lib/ui.jsx` (≈640 lines): `I` icon renderer with ~30 inline SVG paths, `Loader`, `CourseLoader`, `Btn`, `Field`, `Badge`, `Modal`/`FormModal`, `ToastProvider`/`useToast`, `Empty`, `Avatar`, `Reveal`, etc.
- **Layout** — `src/layout/DashboardLayout.jsx` renders the shared sidebar/topbar, `NavLink` menu (student/professor/admin NAV configs), a `RoleGate` that redirects on mismatched role, and a language toggle in the topbar. Admin NAV items carry a `scope` (and a `super: true` flag for the Admins page) so unauthorized modules are hidden.
- **Pages** — large per-role page modules:
  - `src/pages/Login.jsx` — public/gate page (338 lines).
  - `src/pages/student.jsx` — 610 lines across 7 exported pages.
  - `src/pages/professor.jsx` — 580 lines across 7 exported pages.
  - `src/pages/admin.jsx` — 1203 lines across 11 exported pages + shared `DataTable`, `FormModal`, `useList`, `useOptions`, `Insight`, `SemesterCardExplorer`.
- **Styling** — one global stylesheet `src/styles/main.css` (~736 lines) with a dark "super-hero" theme, plus appended **RTL rules** (`html[dir='rtl'] …`) and an Arabic font block.

### Backend

Standard Laravel structure with lots of domain logic in `app/`:

- **Controllers** (namespace groups):
  - `Admin\` → `AdminAuthController`, `EventAdminController`, `AccountAdminController`, `DepartmentAdminController`, `CourseAdminController`, `SemesterAdminController`, `ScheduleAdminController`, `GradeAdminController`, `AccessRequestAdminController`, `AdminManagementController`.
  - `API\` → `AuthController` (student login), `PublicController` (events + meta), `AccessRequestController`, `FactsController`.
  - `API\Student\` → `UserController`, `CoursesController`, `NotificationsController`, `PaymentController`, `LogoutController`.
  - `Professor\` → `AuthController`, `CourseProfessorController`, `AttendaceProfessorController` (sic), `LectureProfessorController`, `QuizProfessorController`, `GradeProfessorController`, `EventProfessorController`, `ProfessorNotificationsController`.
- **Requests** — dedicated `FormRequest` classes per mutation (`AdminAddEvent`, `AdminUpdateEventRequest`, `AdminAddCourseRequest`, `ProfessorAddLectureRequest`, etc.). Rejected requests go through the `FetchRequestError` trait, which returns **HTTP 420** with message `"error in body request"` plus `data` holding the Laravel validator errors.
- **Middleware** aliases registered in `bootstrap/app.php`:
  - `role` → `CheckUserRole` (`admin` | `professor` | `student`).
  - `admin-scope` → `CheckAdminScope` (`accounts`, `access_requests`, `departments`, `courses`, `semesters`, `schedules`, `events`, `grades`).
  - `paid-courses` → `PaidCourses` (protects student course content until paid).
- **Traits**: `SendResponse` helper in `app/Helpers.php`; file traits `UploadFile`/`UpdateFile`/`DeleteFile`/`UploadManyFile`; `Notifiable` (fan-out notifications to admins/students/professors/all students); `FetchRequestError`.
- **Models** (18): `Admin`, `User`, `Department`, `Level`, `Course`, `StudentCourse`, `Lecture`, `StudentLecture`, `Quiz`, `Grade`, `Schedule`, `Semester`, `Event`, `Attendance`, `Notification`, `Payment`, `AccessRequest` (+ personal access tokens from Sanctum).
- **Resources**: `UserResource`, `CourseCatalogResource`, `CourseDetailResource`, `StudentCourseResource`, `LecturesResource`, `QuizResource`, `NotificationsResource`, `Professor\ProfessorStudentResource`.
- **Console** — `NotifyLectureReminders` (`notify:lecture-reminders`) pushes daily lecture reminders from the active semester's schedule. Scheduled in `bootstrap/app.php` to run daily at **08:00** and **16:00**.

### Authentication & authorization

Three separate auth realms, each with its own login/logout flow and Sanctum tokens:

| Role | Login route | Logout route | Guard rows |
| --- | --- | --- | --- |
| Student | `POST /api/auth/login` | `GET /api/user/logout` | `users` table |
| Professor | `POST /api/prof/auth/login` | `POST /api/professor/auth/logout` | `users` table (`type = 1`) |
| Admin | `POST /api/admin/auth/login` | `POST /api/admin/auth/logout` | `admins` table |

Admins support **fine-grained roles** (feature added 2026-09-18 migration `add_admin_roles`):

- `admins.is_super_admin` (boolean) + `admins.roles` (JSON array of scopes).
- `Admin::isSuperAdmin()` bypasses all scope checks; `Admin::hasRole($scope)` checks the JSON roles.
- `CheckAdminScope` middleware gates each admin resource group. `AdminManagementController` is **super-admin only** and protects the current admin from self-modification and super admins from modification/deletion.
- The Nginx/REST layer on the frontend mirrors this: admin nav is filtered by `user.is_super_admin`/`user.roles`, and a `can(scope)` helper gates admin home tiles.

### API conventions

- All responses follow the shape `{ status: <int>, message: <string>, data: <mixed> }` via the `SendResponse()` helper. The frontend unwraps `data` and throws `ApiError(message, status, payload)` on non-2xx.
- List endpoints are **paginated** Laravel paginators/`Resource::collection` with the standard `{ data, links, meta }` shape; the client normalizes them with `normalizePage()`.
- Validation failures return **HTTP 420** with a `data` map of field → messages. The frontend's `request()` surfaces the first field error as the toasts message (so you see `"The image field is required."` rather than `"error in body request"`).
- File uploads send `multipart/form-data` (`formData` option in the request wrapper) — the wrapper deliberately does **not** set `Content-Type` so the browser adds the boundary.

### File uploads

- Stored via the **`files`** disk (`config/filesystems.php`): root `base_path('public_html/uploads')`, public URL `/uploads`.
- Filenames are UUIDs; folders per entity: `events/`, `images/events/`, `images/courses/covers/`, `images/schedules/`, `lectures/`.
- Image URLs are generated as `url('uploads/' . $storedPath)`.
- **Important quirk**: the `files` disk root is `public_html/uploads` while the local dev server (`php -S 127.0.0.1:8000 -t public`) has docroot `public`. The `/uploads/*` URLs therefore map to `public/uploads`, which does **not** exist by default. It was fixed locally with a **directory junction**: `public/uploads` → `public_html/uploads` (run `mklink /J public\uploads public_html\uploads` if it is missing). On a host whose web root is `public`, you must keep that junction/link; on a host whose web root is the project `public_html` folder, you don't.
- Validation for event images: `image|mimes:jpeg,png,jpg,gif,svg,webp|max:5120` (5 MB, and note **webp is allowed**); for lecture/quiz uploads files are stored under `lectures/` (PDFs observed in DB).

### Internationalization (i18n)

- `I18nProvider` + `useI18n` (`src/lib/i18n.jsx`); default `en`, switchable to `ar`.
- Persists the choice in `localStorage` (`ut:lang`); sets `<html lang>` and `dir` (`rtl` for Arabic).
- Language toggle buttons: topbar `.lang-toggle` in the app, floating `.lang-toggle-float` on the login screen. Toggling shows the **target** language label (`switchToAr`/`switchToEn`).
- Translation keys live in `src/lib/lang/{en,ar}.js`; pages are fully translated including admin/role labels and login flows.

---

## Data model

Key tables (see `database/migrations/`, note the custom `2026_*` migrations extend/modernize the older 2013–2024 schema):

- `admins` — admin accounts (+ `is_super_admin`, `roles`).
- `users` — students **and** professors (`type`: 0 student, 1 professor; gender, national id, phone, credit points, semester, department, level, job title).
- `departments` — (`name`, `abbreviation`) and `levels` (year levels).
- `courses` — (`course_name`, `course_code`, `credits`, cover `image`, professor, department, level, `semester_id`).
- `student_course` — enrollments (`last_lecture`), `student_lectures` — per-student lecture progress.
- `lectures`, `quizzes` — content per course.
- `schedules` — weekly rows (`day_of_week`, `start_time`, `end_time`, `section_type`, semester, level, department, course, image) in `2026_01_01_000004_rework_schedules_table`.
- `semesters` — (+ `grading_system`), `is_active` flag drives schedule/reports.
- `grades` — student scores per course (per `2026_09_17_000005`).
- `attendances` — per lecture/course.
- `events` — campus events (+ `image`, `admin_id`).
- `notifications` — bell feed with `type` (notification/event/announcement) targeted at student/professor/admin.
- `payments` — paid course/year tuition (Stripe or demo mode).
- `access_requests` — pending registration approvals (created `2026_09_18`).
- `personal_access_tokens` — Sanctum tokens.

Relationships are defined in the models (e.g. `User` → department, level, grades, attendances, payments, notifications; `Admin` → users, events, departments, notifications, payments).

---

## Scheduled jobs

`php artisan schedule:work` (or OS cron hitting the scheduler) runs:

- `notify:lecture-reminders` — **08:00** and **16:00** daily. Finds the active semester, builds today's lecture schedule, and notifies each enrolled student about upcoming lectures.

---

## Getting started

### Prerequisites

- **PHP ≥ 8.3** with the usual Laravel extensions (observed: `C:\Program Files\php-8.4.6-...`).
- **Composer**.
- **Node.js** (npm).
- **MySQL** (local server on `127.0.0.1:3306`, DB `univars_tech`).

### Backend setup

```bash
cd D:\UniversTech\univers-tech.pro\univers-tech.pro
composer install
copy .env.example .env          # or reuse the existing .env
php artisan key:generate        # if replacing .env
# configure .env: set APP_URL, DB_DATABASE=univars_tech, and file disk values
php artisan migrate             # run all migrations
php artisan db:seed             # optional demo data (DatabaseSeeder)
php artisan serve               # → http://127.0.0.1:8000
```

> The dev backend is commonly launched as `php -S 127.0.0.1:8000 -t public` inside the project so `/uploads/*` works through the `public/uploads` junction.

### Frontend setup

```bash
cd D:\UniversTech\front-end
npm install
npm run dev                     # → http://localhost:5173 (proxies /api → 127.0.0.1:8000)
```

### Required services

1. MySQL running with DB `univars_tech` (root / no password in default `.env`).
2. Backend API on `127.0.0.1:8000`.
3. Vite dev server on `localhost:5173` and open `http://localhost:5173/login`.

---

## Default accounts

These were set up during development and are actively used for testing:

| Role | Email | Password | Notes |
| --- | --- | --- | --- |
| **Super admin** (manager) | `ashraf@gmail.com` | `password` | Full access incl. Admins & Roles |
| **Super admin** (manager) | `3mo@gmail.com` | `password` | Full access incl. Admins & Roles |
| Scoped admin (accounts+departments) | `acctadmin@test.com` | `password` | Sees only Control Center, Accounts, Departments |
| Scoped admin (events only) | `eventsadmin@test.com` | `password` | Sees only Control Center, Events |
| Student | `student@test.com` | `password` | Also `m@gmail.com` (student) |
| Professor | `prof@test.com` | `password` | |

Seeders also create a batch of factory users (`Admin::factory(10)`, `Department::factory(10)`, `User::factory(20)`, `Course::factory(10)`, `StudentCourse`, `Lecture::factory(30)`, `Notification::factory(200)`).

---

## Project structure

```
D:\UniversTech
├── front-end                         # React SPA
│   ├── index.html
│   ├── vite.config.js                # dev proxy /api → 127.0.0.1:8000
│   ├── package.json
│   └── src
│       ├── main.jsx                  # entry (StrictMode)
│       ├── App.jsx                   # routes + providers + unauthorized listener
│       ├── layout/DashboardLayout.jsx# role-scoped shell + NAV + RoleGate + lang toggle
│       ├── lib/
│       │   ├── api.js                # request/normalizePage/buildQuery/ApiError/constants
│       │   ├── auth.jsx              # AuthProvider/useAuth + session store
│       │   ├── hooks.js              # useAsync
│       │   ├── i18n.jsx              # I18nProvider/useI18n
│       │   ├── ui.jsx                # hand-rolled UI kit (icons, Modal, toast, loader…)
│       │   └── lang/{en,ar}.js       # dictionaries
│       ├── pages/
│       │   ├── Login.jsx             # role tabs + registration request + event carousel
│       │   ├── student.jsx           # home, courses, catalog, course detail, schedule, reports, notifications
│       │   ├── professor.jsx         # home, courses, students/attendance, lectures, quizzes, grades, notifications
│       │   └── admin.jsx             # accounts, access requests, departments, courses, semesters, schedules, events, grades, admins, home
│       └── styles/main.css           # global stylesheet + RTL rules + Arabic font block
│
└── univers-tech.pro/univers-tech.pro # Laravel API
    ├── app
    │   ├── Http/Controllers/
    │   │   ├── API/                  # auth, public, access requests, facts, student APIs
    │   │   ├── Admin/                # per-module admin controllers + admin management
    │   │   └── Professor/            # professor controllers
    │   ├── Http/Middleware/          # Authenticate, CheckUserRole, CheckAdminScope, PaidCourses, …
    │   ├── Http/Requests/            # FormRequests (Admin, Professor, public)
    │   ├── Http/Resources/           # API resources
    │   ├── Models/                   # 18 Eloquent models
    │   ├── Traits/                   # SendResponse (Helpers.php), files, Notifiable, FetchRequestError
    │   └── Console/Commands/         # NotifyLectureReminders
    ├── bootstrap/app.php             # middleware aliases + scheduling + api/user route group
    ├── config/filesystems.php        # files disk → public_html/uploads
    ├── database/migrations/          # 37 migrations (2013 → 2026-09-18)
    ├── database/seeders/             # DatabaseSeeder (factory data)
    ├── public/                       # web root (uploads junction lives here)
    ├── public_html/                  # cPanel-style dir; uploads actually stored here
    └── routes/
        ├── api.php                   # main API (admin/professor/public/auth)
        └── user-api.php              # /api/user/* group (student, paid-courses)
```

---

## Key commands

| Action | Command |
| --- | --- |
| Install backend deps | `composer install` |
| Install frontend deps | `npm install` |
| Run backend (public docroot) | `php -S 127.0.0.1:8000 -t public` |
| Run Vite dev server | `npm run dev` |
| Production frontend build | `npm run build` (outputs to `front-end/dist`) |
| Migrate DB | `php artisan migrate` |
| Seed demo data | `php artisan db:seed` |
| Run tests | `./vendor/bin/phpunit` (bare Laravel defaults present) |
| Lecture reminders | `php artisan notify:lecture-reminders` (or `schedule:work` for 08:00/16:00) |
| Fix missing image serving | `cmd /c mklink /J "…\public\uploads" "…\public_html\uploads"` |

---

## Known caveats & gotchas

1. **Image URLs 404 after upload (fixed finding):** files land in `public_html/uploads` but `-t public` serves from `public/uploads`. Kept working via a junction — if images 404 again, recreate it.
2. **`error in body request` toasts:** this is the Surface a Laravel 420 validation failure. Current frontend unwraps and shows the real field message.
3. **i18n interpolation:** `t(key, vars)` only substitutes `{word}` placeholders; it cannot embed React/JSX nodes. Keep slots inside a sentence.
4. **Windows PowerShell + curl JSON:** use `[IO.File]::WriteAllText` — `Set-Content -Encoding UTF8` adds a BOM that breaks Laravel JSON parsing (HTTP 420).
5. **CP1252 consoles:** printing Arabic from PowerShell/Python needs `encode('unicode_escape')`.
6. **Vite is IPv6-bound in this workspace:** always use `http://localhost:5173` (not `127.0.0.1:5173`).
7. **Route blank-import quirk in `routes/api.php`:** the admin management routes live outside the scope groups but still require `role:admin`; super-admin enforcement is inside the controller (`AdminManagementController::authorizeSuper`).
8. The seeded event id `1` (مصلحة عامة) still references `uploads/img.png`, a file that does not exist anywhere — its image will 404 until the record is fixed or the file provided.
9. `AttendaceProfessorController` retains its original (misspelled) class name for backward compatibility with routes.

---

## Roadmap notes (recently added)

- **2026-09-18** — Multi-admin role management: `is_super_admin` + `roles` on `admins`, `CheckAdminScope` middleware, `AdminManagementController`, filtered admin nav + `can(scope)` gating, `event/upcoming` etc.
- **2026-09-17/18** — `semesters` rework + grading system, nullable course department, unique constraints, `student_lectures` progress tracking, `quizzes`, `grades`, and `access_requests`.
- **2026-09** — Full Arabic (RTL) support, animated `CourseLoader`, desktop-parity admin modules, upload-limit/mime relaxation for event photos (5 MB, `webp`).