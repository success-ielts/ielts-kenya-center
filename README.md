# ielts-kenya-center
IELTS Kenya Center - English learning, test preparation and student platform

## Production architecture

Permanent production architecture: GitHub → Cloudflare Workers → `ielts-kenyacenter.or.ke`, with Supabase as the backend/data layer and Resend for transactional email.

Cloudflare Workers Builds deploys the `main` branch automatically after successful builds.
