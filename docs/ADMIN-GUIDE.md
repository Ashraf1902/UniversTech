# UniversTech — Admin Guide

Operational procedures for university administrators. Scope-gated: a **super admin** can do everything; a **scoped admin** only sees modules whose scope they hold (see [Admin scopes](../README.md#admin-scopes)). Every action below is also available from the admin dashboard UI — the API routes are listed for reference.

> **Audit:** administrative mutations are written to `activity_logs` and visible on the **Activity** page.

---

## 1. Semester rollover

Rollover closes the current semester and promotes/graduates its students. It is **preview-first**: nothing is written until you confirm.

**Scopes needed:** `semesters`.

### Step 1 — Inspect what will be closed

- UI: **Rollover → Close preview**.
- API: `GET /api/admin/rollover/close/preview`.

The preview reports the semester to be closed and any **unresolved** items (e.g. grades still in `draft` for that semester). Resolve these first — use `GET /api/admin/rollover/unresolved` to list them:

- Publish or lock outstanding grades (see [§4](#4-grade-override)).
- Resolve any pending attendance/quiz issues flagged.

### Step 2 — Close the semester

- UI: **Rollover → Close semester**.
- API: `POST /api/admin/rollover/semester/close`.

Effects:
- The semester's `closed_at` is stamped.
- Its grades are **locked** (no further edits except by an admin override).
- The semester is no longer "active" for scheduling/reports.

### Step 2 (alternative) — Lock grades only at close

If your policy is to lock grades as part of closing, the close step does this. To lock an individual semester's grades implicitly, set/verify the active semester first under **Semesters**.

### Step 3 — Preview promotions

- UI: **Rollover → Promotion preview**.
- API: `GET /api/admin/rollover/promotion/preview`.

The preview lists, per student, the proposed action:

- **promoted** — moves to the next level and/or the next semester.
- **graduated** — final-level students leaving.

Review carefully; the preview is the only chance to catch edge cases before apply.

### Step 4 — Apply the promotion

- UI: **Rollover → Apply promotion**.
- API: `POST /api/admin/rollover/promotion/apply`.

Effects:

- Students are moved (level/semester) or marked graduated per the preview.
- Each change is recorded in `student_promotions` (from/to semester + level, action).
- Graduated students are excluded from active enrollment lists.

### Step 5 — Activate the new semester

- UI: **Semesters** → edit the new semester → set **active** and the registration window.
- The active semester drives the professor/student timetable and lecture reminders.

**Rollback:** rollover is not a single reversible button. To correct a mistake, adjust the affected students manually (Accounts) and/or re-run promotion; the `student_promotions` table preserves history.

---

## 2. Bulk import (CSV)

Two-step import of **students** (scope `accounts`) or **courses** (scope `courses`): **preview first, then apply**. Nothing is written before you confirm.

**Limits:** max 2,000 rows, 2 MB file, processed in transactional chunks of 200.

### Step 1 — Download the template

- UI: **Import → Download template**.
- API: `GET /api/admin/import/{students|courses}/template`.

The template ships with a UTF-8 BOM and Arabic sample values so Excel opens it correctly. Keep the header row exactly as provided.

### Step 2 — Fill in the file

- Save as CSV (UTF-8). Keep one header row; one record per subsequent row.
- Students: name, email, gender, and the other documented columns. New students get a **random password** and a queued password-set email — **no fixed default password is ever assigned**.
- Courses: course name, code, hours, and the documented columns.

### Step 3 — Preview

- UI: **Import → Preview**.
- API: `POST /api/admin/import/{students|courses}/preview` (multipart `file`).

The preview returns per-row **valid/invalid** flags with the exact errors (e.g. duplicate email/code, missing required field) and a summary (total / valid / invalid). **No data is written.**

### Step 4 — Apply

- UI: **Import → Confirm import** (enabled after a successful preview).
- API: `POST /api/admin/import/{students|courses}/apply`.

Behaviour:

- **Valid rows are imported; invalid rows are skipped** (the file is not rejected wholesale).
- Processing is **transactional per 200-row chunk**.
- The response reports `imported` / `skipped` counts and the list of skipped rows.
- Use **Download errors** (UI) to export the skipped rows + reasons as a CSV.
- The upload file is discarded — not stored.
- An `data_imported` entry is written to the audit log with summary counts only.

**If everything is invalid**, fix the file and re-preview; nothing was committed.

---

## 3. Payment override

Manually set a student's payment state when a real charge is not needed (cash, waiver, refund, or correcting a failed record).

**Scope needed:** `payments`.

### Find the record

- UI: **Payments** (filter by student / status).
- API: `GET /api/admin/payment/get/all`.

### Apply an override

- UI: **Payments → Override** on the row → choose the new status.
- API: `POST /api/admin/payment/override`.

Supported statuses:

| Status | Effect |
| --- | --- |
| `paid` | Grants course access (sets `paid_at`). |
| `waived` | Grants access without charge (`waived_at`). |
| `refunded` | Reverces access; records `refunded_at`. |
| `pending` | Returns an unpaid record to pending. |

Notes:

- A student gains access to course content when a `courses`-type payment exists with status **paid** or `waived` for the current year (`PaidCourses` middleware).
- Receipts are numbered with `Payment::receiptNumber()`; overridden paid/waived payments remain downloadable by the student.
- Dropping a paid course can **flag a refund for review** (setting `flag_refund_on_drop`); it never auto-refunds — you decide here.

---

## 4. Grade override

Change a published/locked grade after the normal windows have passed.

**Scope needed:** `grades`.

### Context — the grade lifecycle

`draft → published → locked`. A professor may edit a published grade only within `grade_edit_window_hours` (default 48) and must supply a reason; after that, only an admin can change a grade.

### Override a grade

- UI: **Grades** → locate the student/course → **Override** (provide the new value and a reason).
- API: `POST /api/admin/grade/override`.

Effects:

- Records the new value, the admin as the actor, and the reason on the grade.
- An audit-log entry is written.

### Lock / unlock a grade

- UI: **Grades** → **Lock** / **Unlock**.
- API: `POST /api/admin/grade/lock` · `POST /api/admin/grade/unlock`.

Locked grades are frozen against professor edits (rollover locks the whole semester's grades).

### Grade appeals

- UI: **Appeals** — review a student's appeal and record a response.
- API: `GET` grade appeals are surfaced per course; respond via the professor/admin appeal actions.

### Component grades (coursework/midterm/final)

- Components are defined per course with weights; per-student component scores roll up into the final grade. An admin override sets the resulting grade directly.

**Note:** overrides are for correction and exceptional cases, not the normal grading flow — prefer letting professors grade within policy.

---

## 4a. Attendance corrections (related)

**Scope needed:** `attendances`. Professors may correct their own records within `attendance_edit_window_hours` (default 48); afterwards only an admin may change them (**Attendance** page / `POST /api/admin/attendance/update`). Soft-deleted records can be restored via `POST /api/admin/attendance/restore/{id}`.

---

## 5. Files and uploads

Files uploaded through the app — event/notification images and **quiz submissions** — are stored on the public `files` disk and served directly under `/uploads/<path>`. Filenames are random UUIDs (plus the original extension), so they are not guessable, but they are **not access-controlled**: anyone who knows the URL can download the file.

> **Before any real student data is used:** quiz submissions must move off the public disk. Serve them from a private, non-web-served disk through an authorized download route that enforces the same ownership/scope checks as the rest of the API (a student only their own submission; the owning professor and admins the rest). Serving them publicly under `/uploads` is acceptable only while the deployment carries demo data.
