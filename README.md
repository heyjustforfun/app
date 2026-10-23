# ApexLedger Fund Portal

An investment fund platform with three parts:

| Folder       | What it is                                                                 | Served at |
| ------------ | -------------------------------------------------------------------------- | --------- |
| `website/`   | Public marketing site (React + Vite + Tailwind + Framer Motion animations)  | `/`       |
| `dashboard/` | Investor portal + Staff admin hub (React, installable as an app / PWA)     | `/app`    |
| `backend/`   | REST API (Node.js + Express + MySQL); also serves both built frontends     | `/api`    |

In production everything runs as **one Node.js app**, which is what Hostinger's Node.js hosting expects.

## How the money flow works

1. Investor registers → uploads an ID document (KYC). One ID number can only be linked to one account.
2. Investor sends a bank transfer and submits the amount + reference/receipt → **Deposit Review Queue**.
3. Staff check the company bank statement and approve → cash is credited to the investor's wallet.
4. Investor **invests** cash into a fund → receives units at the fund's current NAV.
5. Staff **publish the NAV** for each fund (from the fund administrator's valuation) → every holding revalues.
6. Investor **redeems** units → cash returns to their wallet at the current NAV.
7. Investor requests a **withdrawal** (KYC required) → amount is reserved → staff send the wire and record its reference, or reject it, which returns the money.

Every staff action (approvals, NAV publishing, balance corrections, edits, suspensions) is written to the **Audit Log** with actor and IP address. Manual balance adjustments require a reason, which the investor sees in their ledger.

> **Legal note:** Taking money from the public to invest on their behalf is regulated in almost every country (fund manager / investment adviser / collective-investment licensing). Get the appropriate licence and legal review of your terms and risk disclosures before accepting real deposits.

## Modules

**Website:** live market ticker, animated hero with a live fund terminal, about, how-it-works, fund cards with NAV sparklines, features, a growth illustrator (clearly labelled hypothetical), contact form → admin inbox, app install section, footer risk warning.

**Investor dashboard:** portfolio overview with a 90-day value chart, funds and invest/redeem with NAV history charts, deposit (bank details + receipt upload), withdrawals, full account statement (printable), documents, referral link, live support chat, profile, password and KYC, notifications, install-as-app.

**Admin hub:** command hub with queues, user directory (search, add, edit, suspend, delete, reset password, audited balance adjustment, per-user detail), deposit approvals, withdrawal settlements, KYC reviews, funds and NAV publishing (with a large-move safeguard), support desk, document publishing (all investors or one user), website inquiries, audit log, and platform settings (company info, deposit bank account, limits).

## Run locally

Requirements: Node.js 20+ and a MySQL 8 / MariaDB 10.6+ server.

```bash
npm run install:all
cp backend/.env.example backend/.env      # then edit DB_* and set NODE_ENV=development
npm run seed:demo                          # OPTIONAL demo data; never run this on the live database
```

Run these in three terminals:

```bash
npm run dev:api         # http://localhost:4100   (API; creates tables automatically)
npm run dev:website     # http://localhost:5173   (website)
npm run dev:dashboard   # http://localhost:5174/app (dashboard)
```

Demo logins (after `seed:demo`): `demo_user` / `demo12345`. The admin is whatever you set in `ADMIN_USERNAME` / `ADMIN_PASSWORD`.

To test the production build locally: `npm run build && npm start`, then open http://localhost:4100.

## Deploy on Hostinger (Business plan, Node.js Web App)

### 1. Create the database
hPanel → **Databases → MySQL Databases** → create a database and user. Note the full names (they look like `u123456789_fund`).

### 2. Push the code to GitHub
```bash
git remote add origin https://github.com/<you>/<repo>.git
git push -u origin main
```

### 3. Create the Node.js app
hPanel → **Websites → Add website → Node.js Web App** → *Import Git repository* (or upload a ZIP of this folder **without** `node_modules`, `dist` and `.env`).

Build settings:

| Setting         | Value                    |
| --------------- | ------------------------ |
| Framework       | Express (or "Other")     |
| Node version    | 20.x or 22.x             |
| Root directory  | `/` (repository root)    |
| Install command | `npm install`            |
| Build command   | `npm run build`          |
| Entry file      | `backend/src/server.js`  |

### 4. Environment variables
Add these in the app's **Environment variables** section (see `backend/.env.example`):

```
NODE_ENV=production
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=u123456789_fund
DB_PASSWORD=********
DB_NAME=u123456789_fund
JWT_SECRET=<64+ random characters>
ADMIN_EMAIL=you@yourdomain.com
ADMIN_USERNAME=admin
ADMIN_PASSWORD=<strong password>
UPLOAD_DIR=/home/u123456789/fund-uploads
```

Use `127.0.0.1`, not the `srvXXXX.hstgr.io` host, because the app runs on the same server as MySQL. Do **not** set `PORT`; Hostinger provides it.

### 5. Deploy and first login
Deploy. On first start the API creates all tables, the admin account and three starter funds at NAV 1.00. Then:

1. Visit `https://yourdomain.com/app/login` and sign in as the admin.
2. **Platform Settings:** enter your company name, support email and the bank account investors should pay into.
3. **Funds & NAV:** rename or edit the starter funds (or create your own) and publish real NAVs.
4. Turn on SSL in hPanel if it isn't already (the session cookie is `Secure` in production).

### Updating
Push to GitHub and redeploy. Tables are created with `IF NOT EXISTS`, so data is preserved. Keep `UPLOAD_DIR` outside the app folder so uploaded receipts and documents survive redeploys.

## Branding
The brand name appears in `website/src/lib/api.js`, `dashboard/src/lib/api.js` (`BRAND`), both `index.html` titles and `dashboard/public/manifest.webmanifest`. Company name, contact details and the risk warning are editable in **Admin → Platform Settings**.

## Security notes
- Passwords are hashed with bcrypt; sessions use an httpOnly, SameSite=Lax JWT cookie. A password change, suspension or role change signs out every other session.
- Mutating API calls require an `X-Requested-With` header (CSRF protection), and login/registration are rate-limited.
- Uploads are limited to PDF/JPG/PNG/WEBP up to 8 MB, stored with random names and served only to the owner or admins.
- All balance changes happen inside database transactions with row locks, so double approvals and overdrafts are rejected.
