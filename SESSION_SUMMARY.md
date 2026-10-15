### Session summary: 10/14/2026 00:47:04


**What we did:**
- Fixed token persistence in auth.jsx (saved access_token/token_type in session)
- Confirmed api.js reads token from session; RoleGate/UI unaffected
- Built front-end (vite) successfully
- Renamed Vercel project: univers-tech-frontend → universtech; added and verified new domain, removed old domain alias; API + login verified live
- Playwright end-to-end verified: admin/student/professor stay logged in on live site

**Commits:** e86b88f (token fix)

**Live URLs:** https://universtech.vercel.app (new), https://univers-tech-frontend.vercel.app (404 now)

**Notes:** package.json name kept as univers-tech-frontend; folder name front-end; backend unchanged.
