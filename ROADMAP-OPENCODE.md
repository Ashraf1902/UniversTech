# UniversTech — Staged Implementation Roadmap (for OpenCode)

**Owner:** Mahmoud (project owner). **Audience:** OpenCode (coding agent).
**Purpose:** add the missing features and logic fixes agreed in the logic review, in controlled stages, with a mandatory stop-and-report gate after every stage.

---

## 0. THE RULES (read before touching anything)

### 0.1 The stage gate — most important rule
1. Work on **one stage at a time**, in order.
2. When a stage is finished, **STOP**. Post the stage report (template in §0.6) and **wait for the owner to write "continue"** (or give corrections).
3. **Never start the next stage on your own**, even if it looks trivial or you have spare capacity.
4. If the owner asks for changes to a finished stage, do those first, re-report, and wait again.

### 0.2 Todo list and progress tracking (do this first, in Stage 0)
- Create a task list (your todo tool) containing **every stage (0–13) as a parent item**, with that stage's task IDs as sub-items. Mark items as you go. Keep it current so the owner can see progress at a glance.
- Also create `docs/ROADMAP-PROGRESS.md` in the repo with the same checklist (`- [ ]` / `- [x]`), so progress survives across sessions. Update it at the end of every stage.
- The **coverage matrix** in §2 maps every requested item to a stage. At the end of every stage report, state which item IDs were completed. Nothing in §2 may be silently dropped. If something cannot be done as written, say so explicitly and propose an alternative; do not skip it.

### 0.3 Verify before building
The requirements were written from the project README, not from the code. For each item, first check whether it **already exists** fully, partially, or not at all. Report findings (Stage 0 does this for all items; each stage re-verifies its own items). Do not duplicate something that exists; extend it.

### 0.4 Engineering conventions (match the existing codebase)
**Backend (Laravel):**
- Follow existing patterns: dedicated `FormRequest` per mutation, `SendResponse()` envelope `{status, message, data}`, `FetchRequestError` for validation failures, API Resources for output, existing `Notifiable` trait for notifications.
- **Validation failures use HTTP 422.** The codebase and tests expect 422 with a `data` map of field → messages; keep it that way.
- Migrations must be **additive and reversible** (working `down()`), never destructive to existing data. Backfill sensible defaults for existing rows.
- The `users` → `students`/`professors` profile split (expand-contract plan) is in progress. **Read role-specific fields via the `student()` / `professor()` relationships. Do not add new reads or writes against role columns on `users`.**
- Any new fan-out notification (many recipients) must go through a **queued job** (`ShouldQueue`), not a synchronous loop.
- Never log or store passwords, tokens, or national ids in audit data.
- Every new endpoint gets the correct middleware: `role:*`, `admin-scope:*`, `paid-courses` where applicable.
- Every new endpoint and rule gets **tests** (feature tests for authorization, validation, and the happy path). Authorization tests are mandatory: prove the wrong role and the wrong owner get rejected.

**Frontend (React + Vite):**
- Keep dependencies minimal (react, react-dom, react-router-dom). Reuse the hand-rolled UI kit in `src/lib/ui.jsx`; do not add UI libraries.
- **Do not add new pages into the large existing `admin.jsx` / `student.jsx` / `professor.jsx`.** Create new files (for example `src/pages/admin/Activity.jsx`) and import them. Do not refactor the old files in this roadmap.
- **Every new string goes into both `src/lib/lang/en.js` and `src/lib/lang/ar.js`.** `t()` cannot inject JSX; keep interpolations inside full sentences.
- New CSS must use logical properties (`margin-inline-start`, `padding-inline-end`, `text-align: start`) so RTL works. Check each new screen in Arabic.
- Show field-level validation errors inline where practical (the API returns the full error map).
- Every list needs an `Empty` state and a loading state.
- Admin navigation entries carry a `scope` so they are hidden from admins without permission.

### 0.5 Git, deployment, and secrets — safety rules
- **Work on a branch per stage** named `stage-N-short-name`. Commit per task with clear messages. **Do not push to `master`/`main` and do not merge** until the owner approves the stage. (Vercel auto-deploys the frontend from the connected branch; an unapproved push would go live.)
- **Do not change deployment configuration** (Vercel settings, `vercel.json`, Wasmer/Docker/host config, environment variables on any platform). The backend host decision is still open and is handled separately.
- Never commit `.env`, keys, tokens, or passwords. Never print secrets in reports.
- Use seeded/fake data only. No real student data.
- Do not delete or rewrite existing migrations; add new ones.

### 0.6 Stage report template (post this at the end of every stage, then stop)
```
## Stage N report — <name>
Status: COMPLETE / PARTIAL (explain)
Items completed: <IDs from §2>
Items found already existing / partially existing: <IDs + what you found>
What changed:
  - Backend: <migrations, models, controllers, requests, resources, routes, middleware, jobs>
  - Frontend: <pages, components, i18n keys added (en + ar), CSS>
Tests: <added/changed>, result of full test run, result of `npm run build`
Manual checks done: <list, include Arabic/RTL check for new screens>
Policy defaults I chose (owner please confirm): <list>
Deviations from the plan + why: <list or "none">
Risks / things the owner should know: <list>
Branch: stage-N-... (not merged)
Waiting for "continue".
```

### 0.7 Policy values are configurable, not hard-coded
Where a rule needs a number (credit limit, edit window, absence threshold, etc.), store it as a **configurable setting** (a `settings` table or config entry that an admin can change), use the default listed in the stage, and list it under "Policy defaults I chose" in the report. The defaults below are **assumptions for the owner to confirm**, not decisions.

---

## 1. Stage overview (the todo list to create)

| Stage | Name | Items |
| --- | --- | --- |
| 0 | Recon, todo list, coverage matrix | all (verification only) |
| 1 | Security hardening: ownership checks + account status | P1, X2 |
| 2 | Audit log, soft deletes, admin scopes | N2, N3, A5 |
| 3 | Email, password reset, access-request improvements | X1, A6 |
| 4 | Enrollment status, registration rules, manual enrollment | X3, S1, A4 (enrollment part) |
| 5 | Grade lifecycle, components, appeals | P2, S5 |
| 6 | Semester rollover and closing | A1 |
| 7 | Attendance: admin management, edit window, student view, warnings | N1, P5, S2 |
| 8 | Quiz submissions and scoring | S3 |
| 9 | Payments: history, receipts, refunds, admin override | S4, A4 (payment part) |
| 10 | Schedules: room and conflict checks, professor timetable | A3, P4 |
| 11 | Announcements and event targeting | P3, A7 |
| 12 | Bulk import and reports | A2, A8 |
| 13 | Final QA, docs, and coverage sign-off | all |

---

## 2. Coverage matrix (nothing may be forgotten)

Priority: 🔴 critical · 🟠 important · 🟡 nice to have.

| ID | Item | Pri | Stage |
| --- | --- | --- | --- |
| P1 | Professor ownership checks on every professor endpoint | 🔴 | 1 |
| X2 | Account status (active / suspended / graduated / inactive) | 🟠 | 1 |
| N2 | Audit log + admin Activity page | 🔴 | 2 |
| N3 | Soft deletes on core academic records (supports the audit log) | 🟠 | 2 |
| A5 | New admin scopes: attendances, payments, reports, activity | 🟠 | 2 (created), used in 7, 9, 12 |
| X1 | Password reset + change password + email system | 🔴 | 3 |
| A6 | Access requests: rejection reason + emails on approve/reject | 🟡 | 3 |
| X3 | Enrollment status (registered / dropped / completed / failed) | 🔴 | 4 |
| S1 | Registration rules: window, credit limit, capacity, prerequisites, schedule-conflict check, drop/withdraw | 🔴 | 4 |
| A4 | Admin manual enroll/unenroll (stage 4) and payment override paid/waived (stage 9) | 🟠 | 4 + 9 |
| P2 | Grade lifecycle: draft → published → locked, admin override | 🔴 | 5 |
| S5 | Grade components (coursework/midterm/final) + grade-appeal path | 🟡 | 5 |
| A1 | Semester rollover: promote students, close semester, lock its grades | 🔴 | 6 |
| N1 | Admin attendance management (`AttendanceAdminController`, scope `attendances`, `recorded_by_type`/`recorded_by_id`) | 🟠 | 7 |
| P5 | Attendance edit window (professor can correct for N hours, then admin only) | 🟡 | 7 |
| S2 | Student attendance view + absence warnings / exam bar | 🟠 | 7 |
| S3 | Quiz submissions: student answers, deadline, score | 🟠 | 8 |
| S4 | Payments: history, receipts, refund/waive path | 🟠 | 9 |
| A3 | Schedules: room + professor/room conflict checks | 🟠 | 10 |
| P4 | Professor's own timetable | 🟡 | 10 |
| P3 | Course announcements (professor → course students) | 🟠 | 11 |
| A7 | Event targeting by department/level | 🟡 | 11 |
| A2 | Bulk import of students and courses (CSV/Excel) | 🟠 | 12 |
| A8 | Reports: enrollment per course, payments collected, attendance summaries | 🟡 | 12 |

---

## STAGE 0 — Recon, todo list, coverage matrix

**Goal:** know exactly what exists before writing code, and set up tracking.

**Tasks**
- [ ] Create the task list (all 14 stages as parents, items as sub-items) and `docs/ROADMAP-PROGRESS.md`.
- [ ] Read the codebase and, for **every ID in §2**, record: *exists fully / partially / missing*, with file paths as evidence.
- [ ] Specifically check and report on:
  - Which professor endpoints already verify course ownership, and which do not (P1).
  - Whether password reset, any mail configuration, or any mail-sending code exists (X1).
  - Current shape of `student_course`, `grades`, `attendances`, `quizzes`, `payments`, `schedules`, `events`, `semesters`, `access_requests` tables (columns, constraints, indexes).
  - Whether a student-facing attendance view and a quiz submission flow exist (S2, S3).
  - How the admin scope list is defined in the backend (`CheckAdminScope`) and the frontend (NAV `scope`, `can(scope)`).
  - Whether `admin.jsx` / `student.jsx` / `professor.jsx` have already been split.
  - Current test coverage (what test suite exists, does it pass).
- [ ] Confirm local setup works: backend serves, migrations run on a fresh DB, `npm run build` passes, existing tests pass. Report any pre-existing failures so they are not blamed on later stages.
- [ ] Propose any change to the stage order if the recon shows a dependency problem (do not apply it without approval).

**No feature code in this stage.**

**Acceptance:** a findings table for every ID, the task list and progress file created, baseline test/build status reported.

**STOP — post the report and wait for "continue".**

---

## STAGE 1 — Security hardening: ownership checks + account status

**Items:** P1 🔴, X2 🟠

### P1 — Professor ownership checks
**Problem:** a professor must only act on courses assigned to them. Today, changing an id in a request could let Professor A record grades or attendance, upload lectures or quizzes, or read the student list of Professor B's course.
- [ ] Audit **every** professor endpoint that takes a course, lecture, quiz, grade, or attendance id: courses, students list, attendance (`make/attendance`), lectures (create/list/delete), quizzes (create/list/delete), grades (create/list/delete), and any other.
- [ ] Add a single reusable authorization mechanism (a Policy or a small middleware/trait, e.g. `course.owned`), so the rule is defined once and applied everywhere. Do not copy-paste checks into each controller.
- [ ] Rule: the professor must be the assigned professor of the course the resource belongs to; return 403 (using the standard envelope) otherwise.
- [ ] Also verify **students** can only read/act on their own records and enrolled courses, and that admins are unaffected. Report any student-side gaps found; fix them if small, otherwise list them.
- [ ] **Tests (mandatory):** for each professor endpoint, a test proving Professor A gets 403 on Professor B's course and 200 on their own. Include a test for each id type (course id, lecture id, quiz id, grade id).

### X2 — Account status
- [ ] Add a `status` to `users` (`active`, `suspended`, `graduated`, `inactive`; default `active`; backfill existing rows as `active`). Consider whether the column belongs on `users` or the profile tables, in line with the split in progress, and report your reasoning.
- [ ] Login for student and professor realms must be rejected for any status except `active`, with a clear message (and existing tokens of a user who becomes suspended must stop working; revoke their tokens when status changes).
- [ ] `graduated`: read-only/limited behavior is out of scope here; just block login unless the owner decides otherwise. List this as a question in the report.
- [ ] Admin account management (existing Accounts page + controller) can change status; add the field to the form and list filter. Show a status badge in the table.
- [ ] i18n (en + ar) for status labels and error messages.
- [ ] **Tests:** suspended user cannot log in; existing token is rejected after suspension; status change by a scoped admin without `accounts` scope is rejected.

**Acceptance:** all professor endpoints protected by the shared mechanism with tests; account status enforced at login and token level; frontend builds; Arabic labels present.

**STOP — post the report and wait for "continue".**

---

## STAGE 2 — Audit log, soft deletes, admin scopes

**Items:** N2 🔴, N3 🟠, A5 🟠

### N3 — Soft deletes (prerequisite so log entries never point to vanished records)
- [ ] Add `SoftDeletes` (+ `deleted_at` migration) to `User`, `Course`, `Department`, `Grade`, `Payment` at minimum; evaluate `Lecture`, `Quiz`, `Event`, `Schedule` and report.
- [ ] Admin "delete" becomes a soft delete. Check every unique constraint and every query that could now collide with or leak soft-deleted rows (for example a unique `course_code` or email after deletion). Decide and document the behavior for each.
- [ ] A permanent purge is **super-admin only**; implement only if trivial, otherwise list as a follow-up.
- [ ] Verify existing lists, reports, GPA calculations, and enrollment queries correctly exclude soft-deleted rows.

### A5 — New admin scopes
- [ ] Add scopes `attendances`, `payments`, `reports`, `activity` to the backend scope list (`CheckAdminScope` / `Admin::hasRole` validation) and to the admin-management role chips in the frontend (Admins & Roles page), with en + ar labels.
- [ ] Super admin bypasses as before. Existing admins keep their current scopes unchanged. The `activity` scope should default to **super-admin only** unless explicitly granted.
- [ ] The scopes are created now and attached to features in Stages 7, 9, 12.

### N2 — Audit log
**What it is:** an append-only, permanent record of who did what, on which record, with old/new values. It is **separate from the `notifications` table** (do not mix them).
- [ ] Migration `activity_logs`: `id`, `actor_type`, `actor_id`, `action` (e.g. `grade.updated`), `subject_type`, `subject_id`, `properties` (JSON: old and new values of changed fields), `ip_address`, `user_agent`, `created_at`. No `updated_at`; no soft delete; no edit or delete path in code or UI.
- [ ] Indexes: `(subject_type, subject_id)` and `(actor_type, actor_id, created_at)`, plus `created_at`.
- [ ] Write entries **automatically** via model observers or `spatie/laravel-activitylog` (choose one; report why). Write through a **queue** so logging never slows requests. Capture actor from the three auth realms (admin / professor / student).
- [ ] **Exclude sensitive fields** from stored values: passwords, tokens, remember tokens, national id (store a masked version or omit).
- [ ] **Log:** grade and attendance changes, any deletion/restoration, account and role/status changes, access-request approvals/rejections, payments, enrollment changes, course/schedule/semester changes, login successes and failures.
- [ ] **Do not log:** plain reads (viewing a course page).
- [ ] Hook the observers onto everything built so far (accounts, courses, departments, grades, attendance, events, schedules, semesters, access requests, payments, enrollments, status changes from Stage 1). Later stages must add logging for their own new actions.
- [ ] Admin **Activity page** `src/pages/admin/Activity.jsx` (new file): read-only, paginated, filters for actor, role, action type, subject type, date range, and (if feasible) course. Shows details (old → new values) in an expandable row. Gated by the `activity` scope. Nav entry with `scope: 'activity'`. en + ar strings, loading and empty states, RTL-safe.
- [ ] **Notifications for high-signal events only** (do not push every action): grade changed after publication/lock (once Stage 5 exists, leave a hook now), admin role or scope modified, account suspended. Route through the existing Notifiable trait.
- [ ] **Retention:** add a documented, configurable retention setting (default: keep 24 months) and a scheduled prune/archive command, **disabled by default**, so the owner decides when to enable it.
- [ ] **Tests:** entries created on update/delete; sensitive fields absent; log not writable/deletable via any route; scope enforcement on the Activity endpoint; an entry exists for an admin override.

**Acceptance:** the audit log records real actions end to end; the Activity page works in English and Arabic; soft deletes do not break any existing list or report; new scopes selectable and enforced.

**STOP — post the report and wait for "continue".**

---

## STAGE 3 — Email, password reset, access-request improvements

**Items:** X1 🔴, A6 🟡

### X1 — Email system, password reset, change password
- [ ] Configure Laravel mail using environment variables only (`MAIL_*`). **Do not commit credentials.** For local/dev use the `log` mailer; document which variables the owner must set in production. Provide a clear note in the report about which provider settings are needed.
- [ ] Mail sending goes through the **queue** (`ShouldQueue` mailables). With `QUEUE_CONNECTION=sync` it still works.
- [ ] **Forgot password / reset password** for all three realms (student, professor, admin): request endpoint (always returns the same generic success message regardless of whether the email exists, to avoid account enumeration), signed/expiring token, reset endpoint. Use Laravel's password broker; ensure the three realms use the correct user provider/table.
- [ ] Throttle the request and reset endpoints. Revoke existing Sanctum tokens for that user after a successful reset.
- [ ] **Change password** for a logged-in user (all roles): requires current password; new password validated; revoke other tokens.
- [ ] Frontend: "Forgot password?" link on the login screen (works for the selected role tab), reset-password page, change-password form in the user's profile area. en + ar. Frontend reset link must point to the frontend URL via a `FRONTEND_URL` config value (not hard-coded).
- [ ] Audit-log password changes/resets (action only, never the values).
- [ ] **Tests:** generic response for unknown email; token expiry; token reuse blocked; throttling; old tokens revoked; works for each realm.

### A6 — Access requests
- [ ] Add `rejection_reason` (nullable text) and keep a status/decision timestamp and decided-by admin on `access_requests` (check what exists first).
- [ ] The respond endpoint requires a reason when rejecting; the admin UI gets a reason field on reject.
- [ ] Send email on approval (including how to log in / set password) and on rejection (including the reason). Queued.
- [ ] Audit-log the decision.
- [ ] **Tests:** reason required on reject; emails queued/sent (use `Mail::fake()`); only admins with `access_requests` scope can respond.

**Acceptance:** a user can reset and change their password end to end in all three realms (using the log mailer locally); access-request decisions send emails with reasons.

**STOP — post the report and wait for "continue".**

---

## STAGE 4 — Enrollment status, registration rules, manual enrollment

**Items:** X3 🔴, S1 🔴, A4 (enrollment part) 🟠

### X3 — Enrollment status
- [ ] Add `status` to `student_course` (`registered`, `dropped`, `completed`, `failed`; default `registered`; backfill existing rows sensibly, report how). Add `status_changed_at` and, if useful, `semester_id`.
- [ ] Update every query that reads enrollments (My Courses, professor students list, attendance lists, GPA/reports, schedules) so **dropped** enrollments are excluded where appropriate and `completed`/`failed` are handled correctly. Report each query you changed.
- [ ] Audit-log every enrollment status change.

### S1 — Registration rules (student course catalog registration)
All limits are **configurable settings** (see §0.7). Defaults are assumptions for the owner to confirm.
- [ ] **Registration window:** an admin-configurable open/close date range per semester. Outside the window, student registration/drop is rejected with a clear message. (Admin override via manual enrollment still works.)
- [ ] **Credit limit per semester:** default max **18** credits. Reject registration that exceeds it. Count only `registered` enrollments in the active semester.
- [ ] **Course capacity:** add `capacity` (nullable = unlimited) to `courses`. Reject registration when full. Use a DB transaction + row lock so two simultaneous registrations cannot exceed capacity.
- [ ] **Prerequisites:** add a `course_prerequisites` pivot (course → required course). A student can register only if they have a `completed` enrollment (passing grade) in each prerequisite. Define "passing" via a configurable minimum score and report the default you chose. Admin UI on the course form to pick prerequisites.
- [ ] **Schedule-conflict check:** reject registering courses whose scheduled day/time overlaps with already-registered courses (and with other courses in the same request). Use the `schedules` table. Return which courses conflict.
- [ ] **Drop/withdraw:** students can drop a `registered` course within a configurable drop window (default: until end of registration window + 14 days); sets status `dropped`. Define the effect on payment (do not refund automatically here; flag it for Stage 9) and report your decision.
- [ ] Registration of a batch is **all-or-nothing in one transaction**; the response lists exactly which courses failed and why.
- [ ] Frontend (student catalog page): show capacity/remaining seats, prerequisite status, conflict warnings, credit total vs limit, and per-course reasons for being unselectable; add a "Drop" action in My Courses. Inline error details instead of only a toast. en + ar.
- [ ] **Tests:** each rule individually, the combination, concurrency on capacity (as far as feasible), transaction rollback on partial failure, and that rules are bypassed only by the admin manual-enrollment path.

### A4 (enrollment part) — Admin manual enroll / unenroll
- [ ] New admin endpoints (under the `courses` or `accounts` scope; choose and report): enroll a student in a course and unenroll/drop a student, bypassing registration window/capacity/prerequisites **with an explicit "override" flag and a required note**. Audit-logged with the override flag.
- [ ] Admin UI: on the account or course detail, an "Enroll student" / "Remove student" control with the override note. en + ar.
- [ ] **Tests:** override works only for admins with the right scope; note is required; log entry created.

**Acceptance:** all registration rules enforced and tested; enrollment statuses used consistently across existing features; admin can enroll/unenroll with override.

**STOP — post the report and wait for "continue".**

---

## STAGE 5 — Grade lifecycle, components, appeals

**Items:** P2 🔴, S5 🟡

### P2 — Grade lifecycle: draft → published → locked
- [ ] Add `status` to `grades` (`draft`, `published`, `locked`). **Backfill existing grades as `published`** so current student reports do not change. Add `published_at`, `locked_at`, and who did each.
- [ ] Professor: create/edit grades as `draft` (invisible to students); explicit **Publish** action (single and per-course bulk) that makes them visible and notifies the student. Professor can edit a `published` grade only within a configurable window (default 48 h) and with a required reason; after that, or when `locked`, only an admin can change it.
- [ ] **Student reports and GPA must only use `published`/`locked` grades.** Verify and fix the reports/GPA endpoints.
- [ ] Admin (`grades` scope): can edit any state, lock/unlock, and **override a locked grade with a required reason**. Every state change and override is **audit-logged**, and a changed-after-publication grade triggers the high-signal admin notification hook from Stage 2.
- [ ] Frontend: professor grade page shows status badges, Publish buttons, and a reason field when editing a published grade; admin grades panel shows status and override control; student view shows only visible grades. en + ar.
- [ ] **Tests:** draft invisible to student; publish makes it visible; professor blocked after the window or when locked; admin override requires reason; GPA ignores drafts; ownership still enforced (Stage 1 mechanism).

### S5 — Grade components and appeals
- [ ] **Components:** add a `grade_components` structure (for example coursework / midterm / final, with configurable weights per course that must total 100) and a per-student component score table. Define how the final score is computed from components. Keep the existing single-score flow working for courses with no components configured (do not break old data).
- [ ] Student view: per-course breakdown of components when available.
- [ ] **Appeals:** a student can submit a grade appeal (reason text) on a published grade within a configurable window (default 14 days after publication). Statuses: `pending`, `accepted`, `rejected`, with a response note from the professor or admin. Notifies the student on decision. Audit-logged. If accepted, the professor/admin edits the grade through the normal audited path.
- [ ] Admin/professor UI to list and answer appeals for their scope (professor: own courses only; admin: all, under `grades` scope). en + ar.
- [ ] **Tests:** weights must total 100; final computed correctly; appeal window enforced; only the grade's owner student can appeal; only the owning professor or an admin can respond.

**Acceptance:** grades follow the lifecycle with admin override and full audit trail; students never see drafts; GPA uses visible grades only; components and appeals work without breaking existing data.

**STOP — post the report and wait for "continue".**

---

## STAGE 6 — Semester rollover and closing

**Items:** A1 🔴 (the biggest operational gap)

**Problem:** `semester` and `level` live on each student; without tooling, admins would edit hundreds of accounts by hand each year.
- [ ] **Close semester** action (admin, `semesters` scope): sets the semester closed/inactive, **locks all its grades** (published → locked), and resolves enrollments of that semester: `registered` with a passing published grade → `completed`; `registered` with a failing grade → `failed`; `registered` with no grade → flagged in a report for the admin to resolve (do not guess). Passing threshold uses the configurable setting from Stage 4.
- [ ] **Promote students**: an admin tool that, for a chosen set of students/levels, advances `level` (and `semester` where applicable). Must support a **preview (dry run)** showing exactly who changes from what to what before applying, handle graduating students (final level → status `graduated` from Stage 1, with confirmation), and allow excluding individuals (for example students who failed and must repeat).
- [ ] **Open the next semester**: creating/activating the next semester and its registration window (from Stage 4) must be smooth; only one semester active at a time (verify the existing rule).
- [ ] Everything runs in a transaction per batch, is **idempotent** (running twice must not promote twice), and is **audit-logged** with a summary entry plus per-student entries.
- [ ] Admin UI `src/pages/admin/Rollover.jsx` (new file): step-by-step flow (1. close semester → 2. review unresolved → 3. preview promotion → 4. confirm). Clear warnings; confirmation required. en + ar. Gate with the `semesters` scope.
- [ ] **Tests:** locking, status resolution, dry run changes nothing, idempotency, graduation, exclusions, scope enforcement.

**Acceptance:** an admin can close a semester and promote students safely, with preview and full audit trail, without editing accounts one by one.

**STOP — post the report and wait for "continue".**

---

## STAGE 7 — Attendance: admin management, edit window, student view, warnings

**Items:** N1 🟠, P5 🟡, S2 🟠

### N1 — Admin attendance management
- [ ] Migration on `attendances`: add `recorded_by_type` and `recorded_by_id` (backfill existing rows as unknown/legacy or attribute to the course's professor; report the choice). Keep the professor's existing flow unchanged except for filling these fields.
- [ ] New **`AttendanceAdminController`**, same pattern as `GradeAdminController`: gated by `role:admin` + `admin-scope:attendances`. Full read/write across **any** course and lecture (list, create/record, update, delete). Admin must **not** be given a professor-guard token or treated as a professor; it is a separate controller and route group.
- [ ] Dedicated `FormRequest`s. Every admin write is audit-logged, and overrides of a professor's record show both the old and new values.
- [ ] Admin UI page `src/pages/admin/Attendance.jsx` (new file): pick course and lecture, see enrolled students (only `registered`), mark/edit attendance, see who recorded each entry and when. Nav entry with `scope: 'attendances'`. en + ar.
- [ ] Admin course create/edit/delete **already exists**: verify only, do not rebuild.

### P5 — Attendance edit window
- [ ] A professor can correct their own attendance record for a configurable window (default **48 h** after it was recorded); after that, the professor gets a clear message and only an admin can change it. Enforced server-side. Ownership check from Stage 1 still applies.

### S2 — Student attendance view and warnings
- [ ] Student endpoint + page: per enrolled course, attendance records, counts of attended/absent, and absence percentage. New file `src/pages/...` or an addition via a new component (do not bloat `student.jsx`). en + ar.
- [ ] **Warning thresholds (configurable):** default warn at **15%** absence, "exam barred" at **25%** absence, per course. Show badges on the student view. Send a notification to the student when the warning threshold is crossed (once per threshold, not on every record). Queued.
- [ ] Barred status is **informational/visible** to the student, professor, and admin for now (do not block grade entry automatically). Add it as an indicator on the professor's student list and the admin attendance page. List as a question in the report whether the owner wants it to block exam grades later.
- [ ] **Tests:** admin vs professor authorization, `recorded_by_*` populated correctly, edit window enforced, percentages computed correctly, threshold notification sent once.

**Acceptance:** admin can manage attendance across all courses with a clear audit trail; professors have a bounded correction window; students can see their attendance and are warned.

**STOP — post the report and wait for "continue".**

---

## STAGE 8 — Quiz submissions and scoring

**Items:** S3 🟠

**Problem:** today professors upload quiz files, but students cannot submit or receive a score; it behaves like a file share.
- [ ] Extend `quizzes` with `due_at`, `max_score`, and `published_at` (or equivalent; check existing columns first). Existing quizzes keep working as downloadable material (backfill so they are not suddenly "overdue").
- [ ] New `quiz_submissions` table: `quiz_id`, `student_id`, submitted file and/or text answer (reuse the existing file upload traits and disk), `submitted_at`, `score`, `feedback`, `graded_by`, `graded_at`, unique per (quiz, student).
- [ ] Student: can submit **once** (or resubmit until the deadline: pick one rule, make it configurable, report the default) only for quizzes of courses where they have a `registered` enrollment (and paid, via the existing `paid-courses` middleware). After `due_at`, submissions are rejected (late handling: reject by default, configurable).
- [ ] Professor (own courses only): list submissions, open/download them, enter a score (≤ `max_score`) and feedback; student is notified when graded.
- [ ] Validate uploads (mime and size, same discipline as existing uploads). Never trust client-supplied paths.
- [ ] Frontend: student quiz list with due date, status (not submitted / submitted / graded), submit form, and result view; professor submissions page with grading form. New components/files; en + ar.
- [ ] Decide and report whether quiz scores feed into grade components (Stage 5). **Default: they do not**; the professor enters component scores manually.
- [ ] Audit-log score entries and changes.
- [ ] **Tests:** deadline enforcement, one-submission rule, non-enrolled student rejected, ownership on grading, score bounds, upload validation.

**Acceptance:** a student can submit work before the deadline and see a score; the professor can grade submissions.

**STOP — post the report and wait for "continue".**

---

## STAGE 9 — Payments: history, receipts, refunds, admin override

**Items:** S4 🟠, A4 (payment part) 🟠

**Constraint:** payments stay in **demo mode** for this project. Do **not** add real Stripe keys or live charging. Everything below must work against the demo/record-keeping flow.
- [ ] **Student payment history** page/endpoint: list of payments with date, type (courses/yearly), amount, status, and the related semester/courses. en + ar.
- [ ] **Receipts:** a downloadable receipt (PDF or printable HTML view) per paid payment with a unique receipt number, student, items, amount, date. Keep the generator simple and dependency-light; report what you chose.
- [ ] **Payment statuses:** make sure payments have a clear status lifecycle (`pending`, `paid`, `waived`, `refunded`, `failed`); add what is missing, backfill existing rows.
- [ ] **Admin payment override (A4 payment part)** under the `payments` scope (created in Stage 2): mark a payment as `paid` (offline/cash), `waived` (scholarship), or `refunded`, each with a **required reason/note**; the existing `paid-courses` middleware must treat `paid` and `waived` as access-granting and `refunded` as access-removing. All overrides are **audit-logged** and notify the student.
- [ ] **Refund path:** recording a refund is a status/record change in demo mode (no real money movement); dropping a course (Stage 4) can optionally trigger a refund **request** for admin review. Do not auto-refund. Report how you modeled it.
- [ ] Admin UI `src/pages/admin/Payments.jsx` (new file): list/filter payments (by student, status, date), override actions with reason. Nav entry with `scope: 'payments'`. en + ar.
- [ ] **Tests:** access rules for each status, override requires scope and reason, receipt only for paid/waived of the owner, history shows only the student's own payments, transactions around payment + enrollment writes.

**Acceptance:** students see history and receipts; admins can override with an audit trail; course access follows payment status.

**STOP — post the report and wait for "continue".**

---

## STAGE 10 — Schedules: room and conflict checks, professor timetable

**Items:** A3 🟠, P4 🟡

### A3 — Room and conflict checks
- [ ] Add `room` (or a `rooms` table with capacity; evaluate and report which is better, default: a simple `rooms` table + `room_id`) and ensure schedules have the assigned **professor** (derive from the course; confirm).
- [ ] On create/update of a schedule, reject conflicts: same **room** overlapping in time on the same day within the same semester; same **professor** overlapping; and (warn, not block) same level+department overlapping. Return which existing schedule row conflicts. Use a transaction to avoid race conditions.
- [ ] Existing data: run a **report of existing conflicts** (do not auto-fix), and show it to the admin.
- [ ] Admin schedules form: room selector, inline conflict error details. Also consider the Stage 4 student schedule-conflict check: make sure both use the same overlap logic (one shared function). en + ar.
- [ ] **Tests:** each conflict type, edge cases (touching end/start times are not conflicts), update excluding itself.

### P4 — Professor's own timetable
- [ ] Professor endpoint + page: weekly timetable for the active semester built from the schedules of the professor's own courses (day, time, room, section type, course). New file; en + ar. Ownership enforced.
- [ ] **Tests:** only own courses appear; active semester only.

**Acceptance:** conflicting schedules cannot be created; professors have a timetable page.

**STOP — post the report and wait for "continue".**

---

## STAGE 11 — Announcements and event targeting

**Items:** P3 🟠, A7 🟡

### P3 — Course announcements
- [ ] Professor can post an announcement to **one of their own courses**: title, body, optional attachment (reuse upload traits). Stored in an `announcements` table (course_id, author, ...). Ownership enforced (Stage 1 mechanism).
- [ ] Notifies **only students with a `registered` enrollment** in that course, using the existing `notifications` feed (type `announcement`), via a **queued job**.
- [ ] Students see course announcements on the course page and in the notification feed's announcements tab. Professors can list/edit/delete their own announcements; admins (under `courses` scope) can remove any. Audit-log create/delete.
- [ ] en + ar, empty and loading states.
- [ ] **Tests:** only the owning professor can post; only enrolled students notified; dropped students excluded.

### A7 — Event targeting
- [ ] Add audience targeting to events: `all` (default, current behavior), or specific **departments** and/or **levels** (pivot tables or JSON; choose and report). Existing events remain `all`.
- [ ] Publishing notifies only the targeted students (and still the admin), via a queued job. Public login-page carousel behavior unchanged (public events stay public).
- [ ] Admin events form: audience selector. Student events feed shows only events targeted at them or `all`. en + ar.
- [ ] **Tests:** targeted vs all, department+level combinations, students outside the target do not get notified.

**Acceptance:** professors can announce to their course; events can be targeted without breaking existing events.

**STOP — post the report and wait for "continue".**

---

## STAGE 12 — Bulk import and reports

**Items:** A2 🟠, A8 🟡

### A2 — Bulk import (students and courses, CSV/Excel)
- [ ] Admin endpoint + UI to import **students** and **courses** from CSV (and XLSX if a lightweight, well-maintained package is justified; report the choice, default: `maatwebsite/excel` or plain CSV).
- [ ] Provide a **downloadable template** for each import with the exact columns.
- [ ] **Two-step flow:** upload → **validation preview** (valid rows, rows with errors and reasons per row, duplicates) → confirm to apply. Nothing is written before confirmation.
- [ ] Apply inside transactions in chunks; the import is **all-valid-rows-or-report** (owner choice between "skip bad rows" and "abort all": default skip bad rows and download an error file; report the default).
- [ ] Students import creates the `users` row **and** its `students` profile row (respecting the profile split), generates a secure random temporary password or sends a password-set email using Stage 3 (queued), never a fixed default password. Duplicate detection by email / national id / course code.
- [ ] Scope: `accounts` for students, `courses` for courses. Audit-log each import with a summary (counts) and per-row failures excluded from the log's sensitive fields.
- [ ] File size/row limits and mime validation. Files are processed and discarded, not left in public storage.
- [ ] Admin UI `src/pages/admin/Import.jsx` (new file). en + ar.
- [ ] **Tests:** valid/invalid/duplicate rows, no writes before confirm, scope enforcement, chunking, profile rows created.

### A8 — Reports
- [ ] Under the `reports` scope: **enrollment per course** (counts by status, capacity usage), **payments collected** (totals by status, by period, by department), **attendance summaries** (per course and per level, absence rates, students over the thresholds).
- [ ] Filters: semester, department, level, date range. Export to **CSV**. Large queries must be efficient (use aggregation in SQL, not loading all rows into memory) and indexed.
- [ ] Admin UI `src/pages/admin/Reports.jsx` (new file) with simple tables (charts optional; if added, no new heavy dependency). Nav entry with `scope: 'reports'`. en + ar.
- [ ] **Tests:** totals match known fixture data; filters; scope enforcement; soft-deleted records excluded.

**Acceptance:** an admin can import students/courses safely with preview, and view/export the three reports.

**STOP — post the report and wait for "continue".**

---

## STAGE 13 — Final QA, documentation, and coverage sign-off

- [ ] **Coverage check:** walk through the §2 matrix and mark every ID done, with evidence (file or test). List anything not done and why. This is the final guard against forgotten items.
- [ ] Full backend test run and frontend build must pass. Fix regressions caused by this roadmap; list any pre-existing failures separately.
- [ ] **Authorization sweep:** a test matrix confirming for each role (student, professor, scoped admin, super admin) which new endpoints are allowed or forbidden. Include the cross-owner tests.
- [ ] **RTL/Arabic pass** on every new screen; check `en.js` and `ar.js` have identical key sets (no missing keys in either).
- [ ] **Empty/loading/error states** present on every new page; keyboard access and labels on new forms.
- [ ] **Performance check:** the audit log, reports, notifications, and attendance queries have the right indexes; no N+1 queries in new list endpoints.
- [ ] **Seeders:** update seeders/factories so a fresh `migrate:fresh --seed` produces a coherent demo dataset for every new feature (statuses, prerequisites, components, announcements, quiz submissions, payments in each status, schedule with rooms). Use **demo accounts only**; do not seed the old default `password` super-admin accounts as the only credentials; list the demo accounts created.
- [ ] **Documentation:** update the project README (roles & features, data model additions, new scopes, scheduled jobs, new env vars such as `MAIL_*` and `FRONTEND_URL`, configurable settings and their defaults) and add `docs/ADMIN-GUIDE.md` covering semester rollover, import, payment override, and grade override procedures.
- [ ] **Settings summary:** one table of every configurable policy value, its default, and where to change it.
- [ ] Open follow-ups list (items deferred, ideas noticed), clearly separated from this roadmap.

**STOP — post the final report and wait for the owner's sign-off. Do not merge or deploy anything until told.**

---

## Appendix A — Defaults used in this roadmap (assumptions for the owner to confirm)

| Setting | Default |
| --- | --- |
| Credit limit per semester | 18 |
| Drop window | until registration window closes + 14 days |
| Passing score (prerequisites, completed/failed) | owner to confirm (OpenCode reports the value it used) |
| Grade edit window by professor after publish | 48 hours |
| Attendance edit window by professor | 48 hours |
| Absence warning / exam-barred thresholds | 15% / 25% |
| Grade appeal window | 14 days after publication |
| Audit log retention | 24 months (prune job disabled by default) |
| Quiz late submissions | rejected |
| Import behavior on bad rows | skip bad rows, provide error file |

## Appendix B — Things deliberately out of scope here

- Revisiting the validation status code (settled: **422**).
- Splitting the large `admin.jsx` / `student.jsx` / `professor.jsx` files.
- Token storage / cookie-auth migration, containerization, CI.
- Backend hosting and deployment (Wasmer/other host decision is separate).
- Real Stripe payments.
These are tracked in the earlier architecture and deployment documents.
