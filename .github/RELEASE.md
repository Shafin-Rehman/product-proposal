# Release Checklist

Use this checklist

## Pre-Deployment

- [ ] All CI checks pass on the `main` branch
- [ ] All tests pass locally (`npm test`)
- [ ] No uncommitted changes on the release branch
- [ ] Environment variables are set in Vercel for the production environment:
  - [ ] `SUPABASE_URL`
  - [ ] `SUPABASE_ANON_KEY`
  - [ ] `SUPABASE_SERVICE_ROLE_KEY`
  - [ ] `DATABASE_URL`
  - [ ] `VERCEL_TOKEN`
  - [ ] `VERCEL_ORG_ID`
  - [ ] `VERCEL_PROJECT_ID`
- [ ] Database migrations have been reviewed and dry-run against staging (`STAGING_DATABASE_URL`)
- [ ] Migration dry-run passed with no errors

## Deployment

- [ ] Merge PR into `main` via GitHub (no direct pushes)
- [ ] CI pipeline (`App CI`) completes successfully
- [ ] CD pipeline (`Deploy to Vercel`) triggers automatically and completes successfully
- [ ] Deployment URL is accessible via public URL

## Post-Deployment

- [ ] `/api/health` does not report any issues (health check passes)
- [ ] App loads from a clean browser (incognito/private window)
- [ ] Login flow works end-to-end
- [ ] Logout clears session and redirects to `/login`
- [ ] Protected routes redirect unauthenticated users to `/login`
- [ ] No console errors on page load
