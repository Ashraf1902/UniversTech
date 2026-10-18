# Phase 4 Runbook — deploy the 13 roadmap stages (Wasmer backend + Vercel frontend)

> **Do not run anything here until the owner says "go".**
> Never put secret values in a file, a command you paste into a report, or a commit.
> Secrets go in the **Wasmer dashboard** (`wasmer app secrets`) only.

Source of truth: `UniversTech-Deployment-Wasmer-Vercel2.md` §11.4–§11.5. This sheet narrows that to the exact commands for Phase 4 and the output each one must produce.

Legend: `PS>` = Windows PowerShell 5.1, `$` = bash. Commands that touch Wasmer require the deploy token (owner-supplied; currently a CLI secret, never recorded).

---

## 0. Secrets the owner must set in the Wasmer dashboard

Set these once, before/at the first deploy. Values are chosen by the owner and are **not** written anywhere in the repo.

| Secret | Where | Note |
| --- | --- | --- |
| `APP_KEY` | Wasmer secret | Generate once locally: `php artisan key:generate --show` → `base64:...`. **Never change it later** — rotating invalidates sessions and tokens. Do **not** put it in `app.yaml`. |
| `DEMO_SUPER_ADMIN_PASSWORD` | Wasmer secret | Strong password for the seeded `superadmin@universtech.demo`. If unset, the seeder prints a random one once — capture it. |
| `DB_PASSWORD` | Wasmer | **Injected automatically** by Wasmer (with `DB_HOST`/`DB_PORT`/`DB_NAME`/`DB_USERNAME`). Do not set by hand. |
| `MAIL_USERNAME`, `MAIL_PASSWORD` | Wasmer secret | **Only** if switching `MAIL_MAILER` off `log` to `smtp`. Until then no mail is delivered. |

Non-secret settings already live in `app.yaml` and need no dashboard entry: `APP_ENV=production`, `APP_DEBUG=false`, `CACHE_STORE=database`, `FRONTEND_URL=https://universtech.vercel.app`, `MAIL_MAILER=log`, `PAYMENT_DEMO_MODE=true`, `TRUSTED_PROXIES=*`.

---

## 1. Build the clean package — from `stage-14-release-blockers`

Never deploy the dev folder. Build from a clean clone of the release branch (this also guarantees no `.env`, no `vendor/` leftovers, no local uploads).

```powershell
PS> git clone --branch stage-14-release-blockers --single-branch D:\UniversTech C:\Temp\ut-phase4-build
PS> Set-Location C:\Temp\ut-phase4-build\univers-tech.pro\univers-tech.pro
PS> composer install --no-dev --optimize-autoloader
```

Expected:
- clone prints `Checking out files: 100%` and the branch name.
- composer finishes with `Generating optimized autoload files` (no `Installing …` errors).

Sanity checks (must all hold before deploying):

```powershell
PS> Test-Path .env                 # -> False   (no local env shipped)
PS> Test-Path bootstrap\providers.php   # -> True    (Stage 14 added this file)
PS> git status --short             # -> empty
```

> `bootstrap/cache/*.php` (compiled config/routes/services) must NOT be in the package — confirm with `Get-ChildItem bootstrap\cache` showing only `.gitignore`.

---

## 2. Deploy the backend

From the package directory (where `wasmer.toml` and `app.yaml` live):

```powershell
PS> wasmer deploy
```

Expected:
- prints the app URL (`https://universtech-api.wasmer.app`) and finishes with a success line.
- first deploy creates the managed MySQL; later deploys reuse it.

Do **not** merge `master` yet — the frontend is still the old build.

---

## 3. First close the two unverified live checks (BEFORE migrating)

Get the live DB credentials once:

```powershell
PS> wasmer app database list --with-password
```

Create a temporary, **gitignored** `C:\Temp\ut-phase4-build\univers-tech.pro\univers-tech.pro\.env.wasmer` with `DB_CONNECTION=mysql` and the printed host/port/name/user/password (`DB_DATABASE` = the printed name). Then, from the package directory:

```powershell
PS> php artisan db:show --env=wasmer
PS> php artisan migrate:status --env=wasmer
```

Expected:
- `db:show` reports **Server Version** — must be **MariaDB ≥ 10.4** or **MySQL ≥ 5.7**. **STOP and report if older.**
- `migrate:status` prints a table of migrations with `Ran`/`Pending`. A fresh demo DB shows most rows `Pending`.

---

## 4. Migrate and seed the live DB

Only when the live DB is the demo DB (owner confirmed no real data) — otherwise restore the Phase 1 backup first.

```powershell
PS> php artisan migrate --force --env=wasmer
PS> php artisan db:seed --force --env=wasmer      # ONLY if the DB is empty
```

Expected:
- migrate prints `DONE` per migration and exits 0.
- seed prints `Database seeding completed successfully.` and writes the demo dataset (including `events/demo-placeholder.png` on the uploads volume).

> Re-seeding a DB with real data is forbidden. Delete `.env.wasmer` when finished:
> `PS> Remove-Item .env.wasmer`

---

## 5. Health check

```powershell
PS> curl.exe -s https://universtech-api.wasmer.app/api/health     # -> {"status":"ok"}
PS> curl.exe -s https://universtech.vercel.app/api/health         # -> {"status":"ok"}  (proves the Vercel rewrite)
```

---

## 6. Three realm logins

Student and professor use the shared demo password `Demo@12345`; the admin password is the `DEMO_SUPER_ADMIN_PASSWORD` secret (type it, do not save it).

```powershell
# student
PS> curl.exe -s -X POST https://universtech-api.wasmer.app/api/auth/login -H "Content-Type: application/json" --data '{\"email\":\"student@universtech.demo\",\"password\":\"Demo@12345\"}'
# professor
PS> curl.exe -s -X POST https://universtech-api.wasmer.app/api/prof/auth/login -H "Content-Type: application/json" --data '{\"email\":\"professor@universtech.demo\",\"password\":\"Demo@12345\"}'
# admin
PS> curl.exe -s -X POST https://universtech-api.wasmer.app/api/admin/auth/login -H "Content-Type: application/json" --data '{\"email\":\"superadmin@universtech.demo\",\"password\":\"<DEMO_SUPER_ADMIN_PASSWORD>\"}'
```

Expected: each returns HTTP 200 with `{"status":200,...,"data":{"access_token":"…","token_type":"Bearer","user":{…}}}`.
Also hit each via the Vercel domain by swapping the host to `https://universtech.vercel.app` (proves the rewrite + CORS).

---

## 7. 429 throttle test (throttle is DB-backed, survives restart)

Six wrong-password logins for the **same** email must give `5 × 401` then `429`; a **different** email is unaffected.

```powershell
PS> 1..6 | ForEach-Object { curl.exe -s -o NUL -w "%{http_code}`n" -X POST https://universtech-api.wasmer.app/api/auth/login -H "Content-Type: application/json" --data '{\"email\":\"student@universtech.demo\",\"password\":\"wrong-password\"}' }
```

Expected: `401 401 401 401 401 429`.

The limiter is keyed on **email + client IP** (see §8), so a second email from the same source is still `401`. Because the cache store is the database, the lockout persists across a redeploy — repeat the test right after a redeploy to confirm.

---

## 8. Trusted proxy / real client IP (why the throttle key is correct)

Request path: **browser → Vercel (rewrite) → Wasmer Edge → PHP**. The TCP peer is always a proxy, so the real client IP only arrives in `X-Forwarded-For`.

- `bootstrap/app.php` calls `$middleware->trustProxies(at: env('TRUSTED_PROXIES', '*'), headers: X_FORWARDED_FOR | X_FORWARDED_PROTO)`. Only `FOR`/`PROTO` are trusted; `X-Forwarded-Host/Port` are ignored so a spoofed host cannot poison generated URLs.
- The login limiter (`app/Providers/AppServiceProvider.php`) keys on `strtolower(email) . '|' . $request->ip()`, so `$request->ip()` must be the forwarded client IP.
- Verified locally: with `X-Forwarded-For: 203.0.113.10` the same email gave `401×5, 429`; with `203.0.113.20` it gave `401` (separate bucket).

Live check (optional): send six bad logins with a fixed `-H "X-Forwarded-For: 203.0.113.10"` → `429`, then the same with `203.0.113.20` → `401`.

> Caveat to record: `TRUSTED_PROXIES=*` trusts any proxy, so a client that can set `X-Forwarded-For` can rotate its apparent IP. The key still includes the email, so a single account cannot be brute-forced regardless; only the per-IP component is spoofable. Tighten `TRUSTED_PROXIES` to the real proxy addresses if Wasmer ever publishes them.

---

## 9. Rollback

| Failure | Action |
| --- | --- |
| Frontend broken | Vercel dashboard → previous deployment → **Promote** (instant). |
| Backend code broken, DB fine | `wasmer deploy` the previous package (rebuild from the previous tag/commit). Migrations are additive, so old code runs on the new schema. |
| Migration damaged data | Restore the Phase 1 dump into the DB, then redeploy the previous backend package. |
| Wrong grades/attendance reported | Do **not** roll back. Use the admin Activity log to find the change, correct through the UI. |

---

## 10. Order of operations (summary)

1. Owner "go" → set the §0 secrets.
2. Build the clean package (§1).
3. `wasmer deploy` backend (§2).
3b. `SELECT VERSION()` via `db:show` + `migrate:status` (§3) — STOP if the DB is too old.
4. `migrate --force` (+ seed if empty) (§4).
5. Health + 3 logins + 429 (verify via Vercel too) (§5–§7).
6. **Then** merge `stage-14-release-blockers` (carrying stages 1–13) into `master` as one merge; Vercel redeploys the frontend.
7. Re-run the §8 verification checklist plus a second admin / second professor login (scope + ownership checks).
