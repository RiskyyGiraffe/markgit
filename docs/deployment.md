# Deployment

Production split for `markgit.com`:

- Web: Vercel project from `packages/web`
- API: Node service on the `penguin` VPS behind nginx

## API on `penguin`

The repo includes:

- `scripts/deploy-api.sh` to rsync the monorepo, sync the API env file, build the API, and restart the systemd service
- `ops/systemd/markgit-api.service` for the long-running API process
- `ops/nginx/api.markgit.com.conf` as the reverse proxy site template
- `ops/api.env.example` as the production API env template

Deploy the API:

```bash
pnpm deploy:api
```

This expects:

- SSH alias `penguin`
- deploy path `/home/ubuntu/projects/markgit`
- API env at `/etc/markgit/api.env`

The script copies the local root `.env` into `/etc/markgit/api.env`. Update that file on the server when Stripe or database secrets change.

Validate the service:

```bash
ssh penguin 'systemctl status markgit-api --no-pager'
ssh penguin 'curl -sS http://127.0.0.1:3000/health'
```

## nginx

Install nginx on the VPS and enable the site:

```bash
ssh penguin 'sudo apt-get update && sudo apt-get install -y nginx'
scp ops/nginx/api.markgit.com.conf penguin:/tmp/api.markgit.com.conf
ssh penguin "sudo mv /tmp/api.markgit.com.conf /etc/nginx/sites-available/api.markgit.com && sudo ln -sf /etc/nginx/sites-available/api.markgit.com /etc/nginx/sites-enabled/api.markgit.com && sudo nginx -t && sudo systemctl reload nginx"
```

Once `api.markgit.com` resolves to the VPS, issue TLS:

```bash
ssh penguin 'sudo apt-get install -y certbot python3-certbot-nginx'
ssh penguin 'sudo certbot --nginx -d api.markgit.com'
```

## Vercel

Create a Vercel project from this repo with:

- Framework: `Next.js`
- Root Directory: `packages/web`
- Install Command: `pnpm install --frozen-lockfile`
- Build Command: `pnpm --filter @tolty/web build`

Set these production env vars in Vercel:

- `DATABASE_URL`
- `BETTER_AUTH_URL=https://markgit.com`
- `BETTER_AUTH_SECRET`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GITHUB_CLIENT_ID`
- `GITHUB_CLIENT_SECRET`
- `TOLTY_API_URL=https://api.markgit.com`
- `COOKIE_ENCRYPTION_SECRET`
- `NEXT_PUBLIC_APP_URL=https://markgit.com`

`packages/web/.env.production.example` mirrors the expected set.

## Cloudflare

DNS records needed:

- `A` record `api` -> `44.211.128.201`
- apex `markgit.com` -> Vercel
- `CNAME` `www` -> Vercel

Use the exact apex and verification values Vercel shows when you add the domain to the project. For the API hostname, start with `DNS only` until nginx and TLS are confirmed, then proxy it if you want Cloudflare in front.

## Stripe cutover

After the domains are live:

1. Set `BETTER_AUTH_URL` and `NEXT_PUBLIC_APP_URL` to `https://markgit.com`
2. Set `TOLTY_API_URL` to `https://api.markgit.com`
3. Create a live Stripe webhook for `https://api.markgit.com/webhooks/stripe`
4. Replace `STRIPE_WEBHOOK_SECRET` on the VPS with the new live value
5. Re-run a provider Connect onboarding flow and a wallet Checkout flow against the production URLs
