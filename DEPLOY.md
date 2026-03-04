# Deploy GCO Office Management to the cloud

Your app is a **Next.js 14** app with **Supabase**. Here’s how to host it in the cloud.

---

## Option 1: Vercel (recommended for Next.js)

1. **Push your code to GitHub** (if you haven’t already):
   - Create a repo on [github.com](https://github.com), then:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
   git push -u origin main
   ```

2. **Deploy on Vercel**:
   - Go to [vercel.com](https://vercel.com) and sign in (e.g. with GitHub).
   - Click **Add New** → **Project** and import your GitHub repo.
   - Vercel will detect Next.js. Click **Deploy**.

3. **Add environment variables** (before or after first deploy):
   - In the project on Vercel: **Settings** → **Environment Variables**.
   - Add:
     - `NEXT_PUBLIC_SUPABASE_URL` = your Supabase project URL
     - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = your Supabase anon/public key  
   (Same values as in `.env.local`. Get them from Supabase Dashboard → **Settings** → **API**.)

4. **Redeploy** so the new env vars are used: **Deployments** → ⋮ on latest → **Redeploy**.

5. **Supabase Auth (required for login)**:
   - Supabase Dashboard → **Authentication** → **URL Configuration**.
   - **Site URL**: set to your Vercel URL, e.g. `https://your-app.vercel.app`
   - **Redirect URLs**: add `https://your-app.vercel.app/**` and `https://your-app.vercel.app/auth/callback`
   - Save.

After this, your app will be live at `https://your-app.vercel.app` (or your custom domain).

---

## Option 2: Cloudflare Pages

1. **Push your code to GitHub** (same as Option 1).

2. **Deploy on Cloudflare (Workers or Pages)**:
   - Go to [dash.cloudflare.com](https://dash.cloudflare.com) → **Workers & Pages** → **Create** → connect your Git repo (e.g. **mico-ocim-dev/guidance**), branch **main**.
   - The project uses **OpenNext** for Cloudflare. Set the **Build** or **Deploy command** (the one that runs after `npm install`) to:
     - **`npm run deploy`**
     - This runs `opennextjs-cloudflare build` (creates `.open-next/`) then `opennextjs-cloudflare deploy` (runs `wrangler deploy`). The repo’s `wrangler.toml` points to `.open-next/worker.js` and `.open-next/assets`, so no extra build output directory is needed.
   - If your dashboard has separate “Build command” and “Deploy command”: set **Build command** to `npm run opennext-build`, **Deploy command** to `npx wrangler deploy`.
   - Click **Save and Deploy**.

3. **Environment variables** (Pages project → **Settings** → **Environment variables**):
   - Add for **Production** (and Preview if you want):
     - `NEXT_PUBLIC_SUPABASE_URL` = your Supabase project URL
     - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = your Supabase anon key  
   Redeploy after adding them.

4. **Supabase Auth**:
   - Supabase Dashboard → **Authentication** → **URL Configuration**.
   - **Site URL**: your Cloudflare Pages URL, e.g. `https://your-project.pages.dev`
   - **Redirect URLs**: add `https://your-project.pages.dev/**` and `https://your-project.pages.dev/auth/callback`

Your app will be live at your Cloudflare Workers/Pages URL. **Important:** The deploy command must run `npm run deploy` (or `npm run opennext-build` then `npx wrangler deploy`) so that the OpenNext build runs first and produces `.open-next/` before Wrangler deploys.

---

## Option 3: Other cloud platforms

- **Netlify**: Connect your Git repo; build command: `npm run build`, publish directory: `.next` (or use the Next.js runtime / Netlify plugin).
- **Railway / Render / Fly.io**: Use **Docker** or set build command `npm run build` and start command `npm run start`; add the same env vars and expose the port (usually 3000).
- **AWS / GCP / Azure**: Run `npm run build && npm run start` in a container or VM; put the app behind a load balancer and set env vars in the environment.

On every platform, you **must** set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and add your production URL to Supabase **Redirect URLs**.

---

## Checklist before going live

- [ ] Env vars set on the hosting platform
- [ ] Supabase **Site URL** and **Redirect URLs** include your production URL
- [ ] Database migrations (001–005) already run on your Supabase project
- [ ] Optional: custom domain in Vercel/host and in Supabase redirect list
