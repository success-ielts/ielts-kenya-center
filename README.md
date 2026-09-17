# ielts-kenya-center
IELTS Kenya Center - English learning, test preparation and student platform

## Production architecture

The existing application source was recovered from the currently deployed AppDeploy snapshot into GitHub. AppDeploy remains available temporarily for rollback/reference during the migration.

Permanent target architecture: GitHub → Cloudflare Workers → `ielts-kenyacenter.or.ke`, with Supabase as the backend/data layer and Resend for transactional email.
