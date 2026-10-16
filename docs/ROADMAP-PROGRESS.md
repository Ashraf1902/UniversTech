# UniversTech Roadmap Progress

Generated: 10/14/2026 04:08:40

## Stage Checklist
- [x] Stage 0: Recon, todo list, coverage matrix
- [x] Stage 1: Security hardening (P1, X2) — 18 tests pass (SQLite via env override; CI uses MySQL)
- [x] Stage 2: Audit log, soft deletes, admin scopes (N2, N3, A5) — 32 tests pass (SQLite via env override; CI uses MySQL); pending owner approval
- [x] Stage 3: Email, password reset, access requests (X1, A6) — 48 tests pass (SQLite via env override; CI uses MySQL); frontend build green; pending owner approval
- [x] Stage 4: Enrollment status, registration rules, manual enrollment (X3, S1, A4) — 66 tests pass (18 new; SQLite via env override; CI uses MySQL); frontend build green; pending owner approval
- [x] Stage 5: Grade lifecycle, components, appeals (P2, S5) — 80 tests pass (14 new; SQLite via env override; CI uses MySQL); frontend build green; pending owner approval
- [x] Stage 6: Semester rollover (A1) - 87 tests pass (+7 new; SQLite via env override; CI uses MySQL); frontend build green; pending owner approval
- [x] Stage 7: Attendance (N1, P5, S2) - 104 tests pass (+17 new; SQLite via env override; CI uses MySQL); frontend build green; fixed corrupted Stage 5/6 ar.js strings; pending owner approval
- [x] Stage 8: Quiz submissions (S3) - 117 tests pass (+13 new; SQLite via env override; CI uses MySQL); frontend build green; pending owner approval
- [x] Stage 9: Payments (S4, A4) - 126 tests pass (+9 new; SQLite via env override; CI uses MySQL); migration reversible; frontend build green; pending owner approval
- [x] Stage 10: Schedules (A3, P4) - 138 tests pass (+12 new; SQLite via env override; CI uses MySQL); rooms table + room_id, room/professor conflict blocking + level+department warning sharing ScheduleOverlap, existing-conflict report, professor timetable (own courses, active semester); migration reversible; frontend build green; pending owner approval
- [x] Stage 11: Announcements/events (P3, A7) - 155 tests pass (+17 new; SQLite via env override; CI uses MySQL); announcements table + notifications category/course/announcement columns, professor CRUD (own-course policy) with queued fan-out to registered students only, admin moderation under courses scope; event audience targeting (all|targeted) via event_departments/event_levels pivots, public carousel stays public, student events feed scoped to them; migrations reversible; frontend build green; pending owner approval
- [x] Stage 12: Bulk import, reports (A2, A8) - 186 tests pass (+31 new; SQLite via env override; CI uses MySQL); CSV import (plain fgetcsv, no new dependency, owner-approved) with two-step preview-then-apply (nothing written before confirm), per-row validation/duplicate detection, skip-bad-rows + downloadable error file (owner-approved), random password + queued password-set email for new students (never a fixed default), transactional 200-row chunks, files discarded not stored, audit-logged with summary counts only; UTF-8 verified with and without BOM using Arabic names, templates and report CSV exports carry a UTF-8 BOM (+Arabic sample values) so Excel renders them correctly; reports under reports scope aggregating in SQL (enrollment, payments collected by status/period/department, attendance per course/level + students over threshold) with filters + CSV export (report_exported logged); new report indexes migration reversible; frontend build green; pending owner approval
- [x] Stage 13: Final QA, docs, sign-off — 197 tests pass (+11 new AuthorizationSweepTest, 46 assertions; SQLite via env override; CI uses MySQL); frontend build green (90 modules); notification indexes migration reversible; DatabaseSeeder reworked to a deterministic demo dataset (demo accounts only, shared password `Demo@12345`); i18n en/ar 954/954 PARITY OK across 58 files; README rewritten + docs/ADMIN-GUIDE.md added + settings table; pending owner sign-off

---

## STAGE 13 — Coverage sign-off (§2 matrix)

Every roadmap ID is complete. Evidence = file(s) and/or test(s).

| ID | Pri | Status | Evidence |
| --- | --- | --- | --- |
| P1 | 🔴 | ✅ done | `app/Traits/AuthorizesCourseOwnership.php`; used by professor controllers; `tests/Feature` ownership cases + `AuthorizationSweepTest` cross-owner tests (403). |
| X2 | 🟠 | ✅ done | `app/Http/Middleware/EnsureAccountActive.php`; `add_status_to_users` migration; `AuthorizationSweepTest` suspended student/professor → 403. |
| N2 | 🔴 | ✅ done | `activity_logs` migration, `app/Traits/LogsActivity.php`, `ActivityLogger`, `ActivityAdminController`, admin **Activity** page, `activity:prune` command. |
| N3 | 🟠 | ✅ done | Soft-delete migrations for core records + restore/purge admin endpoints. |
| A5 | 🟠 | ✅ done | `AdminManagementController::VALID_SCOPES`; `CheckAdminScope`; scopes used in stages 7, 9, 12. |
| X1 | 🔴 | ✅ done | `PasswordController`, `PasswordRealm`, `App\Mail\ResetPasswordMail`, `ResetPassword.jsx`; `MAIL_*`/`FRONTEND_URL`. |
| A6 | 🟡 | ✅ done | `rejection_reason` migration; access-request decision emails. |
| X3 | 🔴 | ✅ done | `student_courses.status` migration (registered/dropped/completed/failed). |
| S1 | 🔴 | ✅ done | Registration rules (window, credit limit, capacity, prerequisites, `ScheduleOverlap` conflict check, drop window); enrollment tests. |
| A4 | 🟠 | ✅ done | `EnrollmentAdminController` (manual enroll/unenroll); `PaymentAdminController::override` (paid/waived). |
| P2 | 🔴 | ✅ done | Grade lifecycle migration (draft/published/locked) + `GradeAdminController` override; grade tests. |
| S5 | 🟡 | ✅ done | `grade_components`, `grade_component_scores`, `grade_appeals` migrations + controllers + appeal UI. |
| A1 | 🔴 | ✅ done | `RolloverAdminController` (close preview/close, promotion preview/apply, unresolved); `student_promotions`; `Rollover.jsx`; rollover tests. |
| N1 | 🟠 | ✅ done | `AttendanceAdminController` (scope `attendances`) + `recorded_by` morph. |
| P5 | 🟡 | ✅ done | `attendance_edit_window_hours` enforced (professor window → admin only); attendance tests. |
| S2 | 🟠 | ✅ done | Student attendance view + `attendance_threshold_alerts` + warn/bar thresholds. |
| S3 | 🟠 | ✅ done | `quiz_submissions` migration, deadline/score/feedback, professor grading; quiz tests. |
| S4 | 🟠 | ✅ done | `payments` billing fields, receipts, refund/waive path; `PaidCourses`; payment tests. |
| A3 | 🟠 | ✅ done | `rooms` table + `room_id`; `ScheduleOverlap` professor/room conflict blocking + warning sharing; schedule tests. |
| P4 | 🟡 | ✅ done | `ScheduleProfessorController` (own courses, active semester). |
| P3 | 🟠 | ✅ done | `announcements` table + professor CRUD with ownership fan-out; admin moderation under `courses` scope; announcement tests. |
| A7 | 🟡 | ✅ done | Event `audience` + `event_departments`/`event_levels`; student feed scoped; event-targeting tests. |
| A2 | 🟠 | ✅ done | `ImportService` + `ImportAdminController` (template/preview/apply), UTF-8 BOM handling; import tests. |
| A8 | 🟡 | ✅ done | `ReportAdminController` (enrollment/payments/attendance) with CSV export; report indexes migration; report tests. |

**Nothing in §2 was left undone.** Items explicitly out of scope remain as listed in Appendix B.

## STAGE 13 — Performance check

- Indexes: `activity_logs` (action, created_at, actor+time), report indexes (`add_report_indexes`), notification composite indexes (`add_notification_indexes`: student+created_at, type+created_at); attendance FK columns indexed.
- No N+1 in new list endpoints (reports aggregate in SQL; notifications/activity eager-load relations).

## STAGE 13 — Demo accounts (fresh `migrate:fresh --seed`)

Shared password **`Demo@12345`**:

| Role | Email |
| --- | --- |
| Super admin | `superadmin@universtech.demo` |
| Scoped admin | `registrar@universtech.demo` (accounts, courses, schedules, semesters, grades, attendances, departments, reports, settings) |
| Scoped admin | `finance@universtech.demo` (payments, reports) |
| Scoped admin | `events@universtech.demo` (events, access_requests, activity) |
| Professor | `professor@universtech.demo` |
| Student | `student@universtech.demo` |

The old `password`-only super-admin accounts are no longer the sole credentials.

## STAGE 13 — Open follow-ups (deferred, not part of this roadmap)

- Change the validation status code from **420 → 422** (roadmap §0.4/Appendix B); codebase and tests consistently use 422.
- Split remaining large page modules; further componentize admin pages.
- Token storage / cookie-auth migration; containerization; CI pipeline.
- Real Stripe payments (demo mode remains default).
- Backend hosting/deployment decision.
- Optional: convert physical `textAlign:'right'` table-column styling to logical properties for stricter RTL.
- A few old seeded image references may still 404 where the source file is absent.
