# Convex setup (replacing Firebase)

This app uses [Convex](https://convex.dev) as the database. WorkOS remains the auth provider; Convex is configured with **Custom JWT** so the same user identity is used.

## 1. Link Convex and generate types

```bash
npx convex dev
```

- Log in or create a Convex account when prompted.
- This creates a Convex deployment and generates `convex/_generated/` (and adds `CONVEX_DEPLOYMENT` / `NEXT_PUBLIC_CONVEX_URL` to `.env.local`).
- Keep `npx convex dev` running in a separate terminal while developing, or run it once so types are generated.

## 2. Custom JWT auth in Convex

1. In the [Convex dashboard](https://dashboard.convex.dev), open your project → **Settings** → **Authentication**.
2. Add a **Custom JWT** provider:
   - **Application ID**: `kcheng-app` (must match `CONVEX_JWT_APPLICATION_ID` in env).
   - **Issuer**: e.g. `https://kcheng-app` (must match `CONVEX_JWT_ISSUER` in env).
   - **JWKS URL**: URL or **data URI** for your RS256 public key. For **local development** use a data URI (no public URL needed); see step 3.
   - **Algorithm**: RS256.

## 3. Generate RS256 key pair and set env

Generate a key pair (e.g. with OpenSSL):

```bash
openssl genrsa -out private.pem 2048
openssl rsa -in private.pem -pubout -out public.pem
```

- **Private key**: add to `.env.local` as `CONVEX_JWT_PRIVATE_KEY`. Paste the full PEM (including `-----BEGIN PRIVATE KEY-----`). If you store it in a single line, use `\n` for newlines.
- **Public key for Convex**: you must expose it as **JWKS**. For **local dev** (no public URL):
  - Run `npm run jwks` (uses `public.pem`). Copy the printed data URI.
  - Paste it into Convex dashboard → Authentication → Custom JWT → **JWKS URL**.
  - Paste the same value into `convex/auth.config.ts` → `jwks` (already done if you ran the script and updated the file).
  - For production you can keep using the data URI or switch to a real URL like `https://yourdomain.com/.well-known/jwks.json`.

Optional env in `.env.local`:

- `CONVEX_JWT_ISSUER` – same value as in Convex dashboard (default `https://kcheng-app`).
- `CONVEX_JWT_APPLICATION_ID` – same as Application ID in Convex (default `kcheng-app`).

## 4. Env summary

In `.env.local` you should have:

- `NEXT_PUBLIC_CONVEX_URL` – set by `npx convex dev`.
- `CONVEX_JWT_PRIVATE_KEY` – RS256 private key (PEM).
- Optionally: `CONVEX_JWT_ISSUER`, `CONVEX_JWT_APPLICATION_ID`.

## 5. Remove Firebase (after migration)

Once all features use Convex and you’ve verified them:

- Remove `firebase` and `firebase-admin` from `package.json`.
- Delete `src/lib/firebase-admin.ts` and `src/lib/firebase.ts` if unused.

## References

- [Convex custom JWT](https://docs.convex.dev/auth/advanced/custom-jwt)
- [Convex + Next.js](https://docs.convex.dev/quickstart/nextjs)
