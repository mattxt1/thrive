# thrive (a veritas brand)

cloud-first personal banking web app.

## stack

- Next.js 14 (App Router) + TypeScript + Tailwind CSS
- Prisma ORM (PostgreSQL on Neon)
- Auth.js (NextAuth) with Credentials (added in phase 3)
- ESLint + Prettier + Husky + commitlint (Conventional Commits)

## cloud workflow (no local dev)

source of truth: GitHub → deploy on Vercel → DB on Neon → migrations/tests in GitHub Codespaces.

1. **GitHub**  
   Repo: `mattxt1/thrive`.

2. **Neon (Postgres)**
   - Create a project (see Phase 2 for details).
   - Copy the connection string as `DATABASE_URL` (keep SSL `?sslmode=require`).

3. **Vercel (hosting)**
   - Import the GitHub repo and deploy.
   - Set env vars in Vercel Project Settings → Environment Variables:
     - `NEXTAUTH_SECRET` (generate a strong secret)
     - (`NEXTAUTH_URL` is auto in production)
     - Skip `DATABASE_URL` until Phase 2.

4. **GitHub Codespaces (CLI-only)**
   - Open a Codespace on the repo.
   - Create a `.env` (do not commit) with the same variables:
     ```
     NEXTAUTH_URL=http://localhost:3000
     NEXTAUTH_SECRET=dev-only-secret
     DATABASE_URL=...from Neon...
     ```
   - Run Prisma migrations from Codespaces in Phase 2/3:
     ```
     npx prisma migrate deploy
     ```

## scripts

- `npm run dev` – local dev server (not used in CI)
- `npm run build` – production build
- `npm run lint` / `npm run lint:fix` – linting
- `npm run format` – Prettier format
- `postinstall` runs `prisma generate`

## brand rules

- brand names are strictly lowercase: **thrive**, **veritas**.
- realistic banking UX only; no “demo/sample/playground” wording in UI or docs.
