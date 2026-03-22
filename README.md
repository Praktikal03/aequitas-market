# AEQUITAS MARKET — Custom Marketplace Build

## What's Ready

### Files built so far:

```
aequitas-market/
├── index.html              ← Homepage (hero, categories, fee comparison, CTA)
├── css/
│   └── design-system.css   ← Full brand design system (all colors, typography, components)
├── js/
│   ├── supabase-client.js  ← Database client + all helper functions (auth, listings, orders, fees)
│   └── navbar.js           ← Shared navigation (auto-renders, auth-aware, responsive)
├── pages/
│   ├── login.html          ← Login page (branded, role-based redirect)
│   └── signup.html         ← Signup page (buyer/seller toggle, Founding 100 banner, seller fields)
├── sql/
│   └── 001_schema.sql      ← Complete database schema (profiles, listings, orders, order_items, RLS policies, views)
└── README.md               ← This file
```

### What each file does:

- **001_schema.sql** — Run this in Supabase SQL Editor. Creates all 4 tables, security policies, auto-triggers, and helpful views.
- **design-system.css** — The entire visual system. Navy/amber/coral brand. Every component styled. Just link it in any page.
- **supabase-client.js** — All the database functions: auth (signup/login/logout), listings (CRUD), orders, image uploads, fee calculations. You just need to paste your Supabase URL and anon key.
- **navbar.js** — Drop `<div id="navbar"></div>` in any page and it auto-renders the nav bar with correct links based on whether user is logged in, a seller, or admin.
- **index.html** — Full homepage with hero section, category grid, value props, fee comparison bars, and CTA.
- **login.html** — Clean login with role-based redirect (sellers go to dashboard, buyers go to browse).
- **signup.html** — Supports both buyer and seller registration. Sellers see Founding 100 banner, shop name field, category picker, Instagram field.

---

## SETUP STEPS (for next session)

### Step 1: Create Supabase Project
1. Go to [supabase.com](https://supabase.com) and sign up (free)
2. Click "New Project"
3. Name it: `aequitas-market`
4. Set a database password (SAVE THIS — you'll need it)
5. Region: pick US West or wherever is closest
6. Wait for project to finish setting up (~2 min)

### Step 2: Run Database Schema
1. In Supabase dashboard, go to **SQL Editor**
2. Click "New Query"
3. Copy-paste the entire contents of `sql/001_schema.sql`
4. Click "Run"
5. Should see "Success" — all tables, policies, and triggers created

### Step 3: Create Storage Bucket
1. Go to **Storage** in the Supabase sidebar
2. Click "Create a new bucket"
3. Name: `listing-images`
4. Toggle "Public bucket" ON
5. Click "Create"

### Step 4: Get API Credentials
1. Go to **Settings → API**
2. Copy "Project URL" (looks like `https://abcdefg.supabase.co`)
3. Copy "anon/public" key (long string starting with `eyJ...`)
4. Open `js/supabase-client.js`
5. Replace `YOUR_SUPABASE_URL` with your project URL
6. Replace `YOUR_SUPABASE_ANON_KEY` with your anon key

### Step 5: Configure Auth
1. Go to **Authentication → Providers**
2. Email provider should be enabled by default
3. For development: Go to **Authentication → URL Configuration**
4. Set "Site URL" to your domain: `https://aequitasmarket.shop`
5. Add redirect URLs:
   - `https://aequitasmarket.shop`
   - `https://aequitasmarket.shop/pages/login.html`
   - `http://localhost:8000` (for local testing)

### Step 6: Make Yourself Admin
1. Sign up through the signup page
2. Go to Supabase **Table Editor → profiles**
3. Find your row
4. Change `role` from `buyer` to `admin`
5. Save

### Step 7: Deploy to Cloudflare Pages
1. Push all files to your GitHub repo
2. Go to Cloudflare dashboard → Workers & Pages → Create
3. Connect your GitHub repo
4. Build settings: none needed (it's static HTML)
5. Deploy
6. Set custom domain: `aequitasmarket.shop`

---

## REMAINING BUILD SESSIONS

| Session | What Gets Built |
|---------|----------------|
| 2 | Listing creation form + image upload + seller dashboard |
| 3 | Product browse page + search + category filtering + product detail page |
| 4 | Stripe Connect integration + checkout flow |
| 5 | Order management + buyer flow + delivery confirmation |
| 6 | Admin dashboard (approve sellers, review listings, release funds) |
| 7-8 | Polish, mobile testing, edge cases, final deploy |

---

## BRAND REFERENCE

- **Navy deep:** #0a1628
- **Navy:** #0f2140
- **Amber/Gold:** #d4a843
- **Coral (CTAs):** #e85d6c
- **Cream (background):** #faf6ee
- **Display font:** Playfair Display
- **Body font:** DM Sans
