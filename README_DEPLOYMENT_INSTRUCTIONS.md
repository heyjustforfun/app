# ApexLedger Fund & Daily Task Portal — Full Deployment Guide

This package contains the complete, production-ready source code and live database export for the **ApexLedger Fund & Daily Task Management Portal**.

---

## 📦 What is Included in this Package:

1. **`database_dump_complete.sql`**: Full MySQL database dump with all 16 tables, including:
   - **All 23 Investor & Admin User Accounts** (Logins, passwords, 2FA, contact info).
   - **All Active Investment Packages** (`holdings` table).
   - **All Cash Balances** (Exact dollar balances for all users).
   - **All Daily Trade Tasks & Submissions** (79 tasks, 119 submissions).
   - **All Ledger Transactions** (169 deposits, withdrawals, and task yield credits).
   - **Live Messaging & Notifications** (397 chat messages, 770 notifications).
2. **`backend/`**: Node.js Express API server with authentication, tasks engine, wallet ledger, fund management, and live chat.
3. **`website/`**: Public marketing website with interactive funds showcase, CTA banners, and mobile app download section.
4. **`dashboard/`**: Investor and Admin SPA dashboard (Vite + React + Tailwind CSS) with 30-second live trade execution desk, wallet, deposits, withdrawals, and KYC.
5. **`render.yaml` & `railway.json`**: Pre-configured infrastructure blueprints for instant 1-click cloud deployment.

---

## 🚀 How to Host on Any Server (cPanel / VPS / Hostinger / Cloud)

### Step 1: Import the Database
1. Create a MySQL database (e.g. `fund_portal` or `railway`) on your host (via phpMyAdmin, cPanel MySQL Wizard, or MySQL CLI).
2. Import `database_dump_complete.sql`:
   ```bash
   mysql -u YOUR_DB_USER -p YOUR_DB_NAME < database_dump_complete.sql
   ```
   *(Or in phpMyAdmin: click your database → **Import** tab → select `database_dump_complete.sql` → click **Import**)*.

---

### Step 2: Configure Environment Variables
Create a `.env` file in the root directory (or in `backend/.env`) with your database credentials:

```ini
PORT=4100
NODE_ENV=production

# Database Connection (Option A: Connection String)
DATABASE_URL=mysql://YOUR_USER:YOUR_PASSWORD@YOUR_HOST:3306/YOUR_DB_NAME

# Database Connection (Option B: Discrete Variables)
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=YOUR_USER
DB_PASSWORD=YOUR_PASSWORD
DB_NAME=YOUR_DB_NAME

# JWT Authentication Secret
JWT_SECRET=a2ed94a5ed6f1b055a049c256c9cae72b608cd11d6e0a6a010d993dd6fceed43
```

---

### Step 3: Install Dependencies & Build Frontends
Run the following commands in the root directory:

```bash
# 1. Install all dependencies across root, backend, website, and dashboard
npm run install:all

# 2. Build production assets for website and dashboard
npm run build
```

---

### Step 4: Start the Server
```bash
# Start with Node.js
npm start

# Or with PM2 (for background 24/7 production on VPS / cPanel Node app)
pm2 start backend/src/server.js --name "apexledger-portal"
pm2 save
```

The Express server serves:
- **Public Marketing Website** at `/`
- **Customer & Admin Portal** at `/app` (with automatic redirects from `/login`, `/register`, `/tasks`, `/packages`, `/wallet`, `/admin`)
- **JSON REST API** at `/api/...`

---

## 🔑 Default Administrator Login:
- **Email:** `baalexsmith@gmail.com`
- **Username:** `admin`
- **Admin Desk:** `/app/admin`

*(All existing investors and passwords work immediately with zero reset required).*
