# IELTS Kenya Center — Production Operations

Production: https://ielts-kenyacenter.or.ke
Source of truth: GitHub success-ielts/ielts-kenya-center, main
Runtime: Cloudflare Worker + Static Assets
Data/Auth: Supabase project inpbhtlwtnsiibffyzhu
Email: Resend
Known-good rollback branch: rollback/production-bc8429c
Known-good commit: bc8429c86edf580f1de16eddc03dd95fa30ecad0

This is an operations runbook. Do not use it to redesign learning, authentication, authorization, password recovery, DNS, or the retired AppDeploy integration.

## 1. Backups and recovery

### Supabase
1. Confirm the incident and freeze risky production changes.
2. Supabase Dashboard → Database → Backups.
3. Identify the backup or PITR recovery point immediately before the desired recovery point.
4. Prefer Restore to a New Project for a non-destructive recovery test when the plan supports it.
5. Validate schema, critical row counts, RLS, Auth integration, and application compatibility in the recovered target.
6. Restore production only after an explicit incident decision authorizes downtime/data loss.
7. Record backup timestamp, recovery point, validation result, and incident ID.

Database backups do not include Storage API objects; recover Storage separately. If PITR is enabled, use its recovery-time selector rather than guessing a daily backup.

### Restore-readiness check performed 2026-09-18
- Project status: ACTIVE_HEALTHY
- PostgreSQL: 17.6
- Read-only snapshot query succeeded.
- profiles 14; roles 11; profile_roles 0; courses 4; course_modules 9; lessons 11; enrollments 0; lesson_progress 0.
- RLS enabled on all 11 application tables checked.
- No production data was overwritten or restored.

Backup inventory/retention was not directly exposed by the connected Supabase project tool, so the owner should confirm current backup/PITR availability in Supabase Dashboard.

### GitHub rollback
Identify the last certified commit, preserve it, and revert or redeploy through the normal pipeline. Existing rollback branch: rollback/production-bc8429c.

### Cloudflare Worker rollback
1. Cloudflare Dashboard → Workers & Pages → Worker → Deployments.
2. Identify the last known-good Worker version and correlate it to a certified Git commit.
3. Use wrangler rollback VERSION_ID or the Dashboard Rollback action.
4. Verify homepage, /api/_healthcheck, and production smoke.
5. Record both the Cloudflare version ID and Git commit.

A Worker rollback does not roll back external database/data changes.

## 2. Monitoring

The hourly .github/workflows/production-monitor.yml checks:
- production homepage
- /api/_healthcheck
- safe release identifier
- unauthenticated admin API boundary
- Supabase API availability
- Resend domain verification
- latest main Build and Deploy result
- latest production smoke result and matching commit

Cloudflare observability is enabled. Use Workers metrics/logs for Worker exceptions, HTTP/error trends, invocation failures, resource failures, volume, and latency. Authentication failures should be investigated using aggregate status/path information only; never log passwords, cookies, authorization headers, recovery links, or sensitive request bodies.

GitHub Actions failures are the primary CI/CD alert path. A failed build, deploy, domain verification, or production smoke is not a certified release.

Resend currently has automated domain/API acceptance checks. Final delivery and bounce monitoring should use Resend email events/webhooks or the Resend metrics/logs APIs; HTTP 200 from a send request is not proof of mailbox delivery.

## 3. Incident response

Detect
↓
Confirm impact
↓
Stop risky deployments
↓
Identify last known-good release
↓
Roll back if necessary
↓
Verify health + smoke
↓
Investigate root cause
↓
Apply targeted fix
↓
Re-deploy
↓
Record incident

Preserve the failing SHA and diagnostic logs before changing anything. Never put secrets, tokens, cookies, passwords, recovery URLs, or personal user data in incident notes. Close an incident only after impact, root cause, corrective action, and verification are recorded.

## 4. Controlled deployment policy

change
→ typecheck
→ build
→ commit
→ push
→ GitHub Actions
→ Cloudflare deploy
→ domain verification
→ production smoke
→ release accepted

A deployment that succeeds but has a failed smoke is not certified. Emergency changes require a documented reason and must be followed by the normal verification pipeline as soon as safely possible.

## 5. Secret rotation

Never place secret values in source, browser bundles, screenshots, logs, documentation, or chat.

CLOUDFLARE_API_TOKEN:
Create a least-privilege replacement; update the GitHub Actions repository/environment secret; run the normal deployment and verification; revoke the old token only after success.

CLOUDFLARE_ACCOUNT_ID:
This is an identifier, not a secret. Keep it in the existing deployment secret/configuration location. If the account changes, verify the target Worker before deployment.

SUPABASE_PUBLISHABLE_KEY:
Rotate in Supabase; update GitHub secret SUPABASE_PUBLISHABLE_KEY; deploy; verify domain and smoke; confirm browser secret scan.

SUPABASE_SECRET_KEY:
Generate a server-only replacement; update GitHub secret SUPABASE_SECRET_KEY; deploy; verify smoke; revoke the old key only after success. Never bundle it into frontend code.

RESEND_API_KEY:
Create a least-privilege replacement; update GitHub secret RESEND_API_KEY; deploy; verify Resend domain and smoke; revoke the old key only after success.

## 6. Repository protection

Audit result: main is currently UNPROTECTED.

Recommended owner-controlled protection:
- prevent force-push
- prevent branch deletion
- require successful Build/typecheck checks before normal merge
- use pull requests for normal changes where practical
- preserve an emergency administrator bypass so the owner cannot be locked out
- keep deployment credentials in GitHub Secrets/Environment secrets
- preserve rollback branches/tags

Do not make production smoke a pre-merge required check because it runs after deployment; it remains the post-deploy release acceptance gate.

## 7. Release identification

Production /api/_healthcheck now returns:

{
  "ok": true,
  "service": "ielts-kenya-center",
  "release": "<commit-sha>"
}

The deployment workflow supplies github.sha through Wrangler's non-secret --var RELEASE_ID value. The release identifier contains no credentials.

## 8. Recovery notes

This file is the primary operations runbook. Keep operational notes under docs/. Never store secret values, recovery URLs, passwords, access tokens, refresh tokens, cookies, or user-sensitive data there.

## 9. Cadence

Every release: build → deploy → domain verification → production smoke.
Hourly: production monitor.
Monthly: review branch protection, GitHub Secrets, Worker versions, Supabase backup/PITR availability, and Resend deliverability monitoring.
Quarterly: non-destructive restore-readiness exercise using a new recovery target/project where supported.
After every incident: preserve evidence, record root cause, and update this runbook when procedures change.
