# switdb.com aliases

Private invite-only email alias dashboard for `switdb.com`.

## Local setup

1. Copy `.env.example` to `.env.local`.
2. Fill in `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`.
3. Run `npm install`.
4. Run `npm run dev`.

## Supabase setup

Run `database/schema.sql` in the Supabase SQL editor. Auth users are created manually in the Supabase dashboard. Public signup is not exposed by this app.

## Cloudflare Worker

The Worker lives in `worker/index.ts` and expects these secrets:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Deploy with `npm run worker:deploy`, then attach the Worker to the `switdb.com` Email Routing catch-all rule.
