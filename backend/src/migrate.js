import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { pool, one, query } from './db.js';
import { config } from './config.js';

const TABLES = [
  `CREATE TABLE IF NOT EXISTS users (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(40) NOT NULL UNIQUE,
    email VARCHAR(190) NOT NULL UNIQUE,
    phone VARCHAR(40) NULL,
    full_name VARCHAR(120) NULL,
    password_hash VARCHAR(100) NOT NULL,
    token_version INT UNSIGNED NOT NULL DEFAULT 0,
    role ENUM('customer','admin') NOT NULL DEFAULT 'customer',
    status ENUM('active','suspended') NOT NULL DEFAULT 'active',
    cash_balance DECIMAL(18,2) NOT NULL DEFAULT 0,
    kyc_status ENUM('none','pending','verified','rejected') NOT NULL DEFAULT 'none',
    national_id VARCHAR(60) NULL UNIQUE,
    kyc_document VARCHAR(255) NULL,
    kyc_note VARCHAR(255) NULL,
    referral_code VARCHAR(16) NOT NULL UNIQUE,
    referred_by INT UNSIGNED NULL,
    last_login_at DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_users_referred_by (referred_by)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS funds (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(120) NOT NULL,
    slug VARCHAR(140) NOT NULL UNIQUE,
    tagline VARCHAR(200) NULL,
    description TEXT NULL,
    strategy VARCHAR(255) NULL,
    risk_level ENUM('low','medium','high') NOT NULL DEFAULT 'medium',
    min_investment DECIMAL(18,2) NOT NULL DEFAULT 100,
    management_fee_pct DECIMAL(5,2) NOT NULL DEFAULT 1.00,
    current_nav DECIMAL(18,6) NOT NULL DEFAULT 1,
    status ENUM('open','closed') NOT NULL DEFAULT 'open',
    sort_order INT NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS nav_history (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    fund_id INT UNSIGNED NOT NULL,
    nav DECIMAL(18,6) NOT NULL,
    as_of DATE NOT NULL,
    note VARCHAR(255) NULL,
    created_by INT UNSIGNED NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_nav_fund_date (fund_id, as_of),
    CONSTRAINT fk_nav_fund FOREIGN KEY (fund_id) REFERENCES funds(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS holdings (
    user_id INT UNSIGNED NOT NULL,
    fund_id INT UNSIGNED NOT NULL,
    units DECIMAL(24,6) NOT NULL DEFAULT 0,
    invested DECIMAL(18,2) NOT NULL DEFAULT 0,
    PRIMARY KEY (user_id, fund_id),
    CONSTRAINT fk_hold_user FOREIGN KEY (user_id) REFERENCES users(id),
    CONSTRAINT fk_hold_fund FOREIGN KEY (fund_id) REFERENCES funds(id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS transactions (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id INT UNSIGNED NOT NULL,
    type ENUM('deposit','withdrawal','withdrawal_reversal','subscription','redemption','adjustment') NOT NULL,
    fund_id INT UNSIGNED NULL,
    amount DECIMAL(18,2) NOT NULL,
    units DECIMAL(24,6) NULL,
    nav DECIMAL(18,6) NULL,
    balance_after DECIMAL(18,2) NOT NULL,
    description VARCHAR(255) NOT NULL,
    reference_id INT UNSIGNED NULL,
    created_by INT UNSIGNED NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_tx_user (user_id, id),
    CONSTRAINT fk_tx_user FOREIGN KEY (user_id) REFERENCES users(id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS deposits (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id INT UNSIGNED NOT NULL,
    amount DECIMAL(18,2) NOT NULL,
    method VARCHAR(40) NOT NULL,
    reference VARCHAR(120) NULL,
    receipt_path VARCHAR(255) NULL,
    status ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
    admin_note VARCHAR(255) NULL,
    reviewed_by INT UNSIGNED NULL,
    reviewed_at DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_dep_status (status),
    CONSTRAINT fk_dep_user FOREIGN KEY (user_id) REFERENCES users(id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS withdrawals (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id INT UNSIGNED NOT NULL,
    amount DECIMAL(18,2) NOT NULL,
    fee_pct DECIMAL(5,2) NOT NULL DEFAULT 20.00,
    fee_amount DECIMAL(18,2) NOT NULL DEFAULT 0.00,
    net_amount DECIMAL(18,2) NOT NULL DEFAULT 0.00,
    bank_name VARCHAR(120) NOT NULL,
    account_name VARCHAR(120) NOT NULL,
    account_number VARCHAR(60) NOT NULL,
    status ENUM('pending','paid','rejected') NOT NULL DEFAULT 'pending',
    payout_reference VARCHAR(120) NULL,
    admin_note VARCHAR(255) NULL,
    reviewed_by INT UNSIGNED NULL,
    reviewed_at DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_wd_status (status),
    CONSTRAINT fk_wd_user FOREIGN KEY (user_id) REFERENCES users(id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS messages (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id INT UNSIGNED NOT NULL,
    sender_id INT UNSIGNED NOT NULL,
    is_staff TINYINT(1) NOT NULL DEFAULT 0,
    body TEXT NULL,
    attachment_path VARCHAR(255) NULL,
    attachment_name VARCHAR(255) NULL,
    attachment_type VARCHAR(100) NULL,
    attachment_size INT UNSIGNED NULL,
    read_at DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_msg_thread (user_id, id),
    CONSTRAINT fk_msg_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS notifications (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id INT UNSIGNED NOT NULL,
    title VARCHAR(160) NOT NULL,
    body VARCHAR(500) NOT NULL,
    link VARCHAR(160) NULL,
    read_at DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_notif_user (user_id, id),
    CONSTRAINT fk_notif_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS documents (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id INT UNSIGNED NULL,
    fund_id INT UNSIGNED NULL,
    title VARCHAR(160) NOT NULL,
    category ENUM('report','factsheet','statement','legal','other') NOT NULL DEFAULT 'other',
    file_path VARCHAR(255) NOT NULL,
    original_name VARCHAR(255) NOT NULL,
    mime VARCHAR(100) NOT NULL,
    size INT UNSIGNED NOT NULL,
    uploaded_by INT UNSIGNED NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_doc_user (user_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS audit_log (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    actor_id INT UNSIGNED NULL,
    action VARCHAR(60) NOT NULL,
    entity VARCHAR(40) NOT NULL,
    entity_id INT UNSIGNED NULL,
    details TEXT NULL,
    ip VARCHAR(64) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_audit_entity (entity, entity_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS inquiries (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(120) NOT NULL,
    email VARCHAR(190) NOT NULL,
    topic VARCHAR(80) NOT NULL,
    message TEXT NOT NULL,
    status ENUM('new','closed') NOT NULL DEFAULT 'new',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS daily_tasks (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    task_code VARCHAR(32) NULL,
    title VARCHAR(180) NOT NULL,
    description TEXT NULL,
    instructions TEXT NULL,
    link_url VARCHAR(255) NULL,
    reward_amount DECIMAL(18,2) NOT NULL DEFAULT 0.00,
    reward_mode ENUM('fixed','percent_investment') NOT NULL DEFAULT 'percent_investment',
    reward_pct DECIMAL(6,3) NOT NULL DEFAULT 1.000,
    trade_duration_seconds INT UNSIGNED NOT NULL DEFAULT 30,
    expire_minutes INT UNSIGNED NOT NULL DEFAULT 180,
    expires_at DATETIME NULL,
    task_date DATE NOT NULL,
    task_slot TINYINT UNSIGNED NOT NULL DEFAULT 1,
    target_type ENUM('all','specific') NOT NULL DEFAULT 'all',
    target_package VARCHAR(40) NOT NULL DEFAULT 'all',
    target_user_id INT UNSIGNED NULL,
    requires_proof BOOLEAN NOT NULL DEFAULT TRUE,
    status ENUM('active','inactive','archived') NOT NULL DEFAULT 'active',
    created_by INT UNSIGNED NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_task_code (task_code),
    INDEX idx_task_date (task_date),
    INDEX idx_task_status (status),
    INDEX idx_task_target (target_type, target_user_id),
    INDEX idx_task_package (target_package),
    CONSTRAINT fk_task_creator FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT fk_task_target_user FOREIGN KEY (target_user_id) REFERENCES users(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS user_task_submissions (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    task_id INT UNSIGNED NOT NULL,
    user_id INT UNSIGNED NOT NULL,
    status ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
    proof_text TEXT NULL,
    proof_file VARCHAR(255) NULL,
    reward_paid DECIMAL(18,2) NOT NULL DEFAULT 0.00,
    reviewed_by INT UNSIGNED NULL,
    reviewed_at DATETIME NULL,
    admin_note VARCHAR(255) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_user_task (user_id, task_id),
    INDEX idx_sub_status (status),
    CONSTRAINT fk_sub_task FOREIGN KEY (task_id) REFERENCES daily_tasks(id) ON DELETE CASCADE,
    CONSTRAINT fk_sub_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_sub_reviewer FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS settings (
    k VARCHAR(60) PRIMARY KEY,
    v TEXT NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS referral_commissions (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    referrer_id INT UNSIGNED NOT NULL,
    referred_user_id INT UNSIGNED NOT NULL,
    fund_id INT UNSIGNED NOT NULL,
    package_name VARCHAR(120) NOT NULL,
    package_amount DECIMAL(18,2) NOT NULL,
    commission_rate DECIMAL(5,2) NOT NULL DEFAULT 10.00,
    commission_amount DECIMAL(18,2) NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_ref_referrer (referrer_id),
    INDEX idx_ref_referred (referred_user_id),
    CONSTRAINT fk_refcom_referrer FOREIGN KEY (referrer_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_refcom_referred FOREIGN KEY (referred_user_id) REFERENCES users(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
];

export const DEFAULT_SETTINGS = {
  company_name: 'ApexLedger Capital',
  support_email: 'support@example.com',
  support_phone: '',
  office_address: '',
  regulatory_notice:
    'Investments can go down as well as up and you may get back less than you invest. Past performance is not a reliable indicator of future results.',
  binance_id: '1282494665',
  bank_name: '',
  bank_account_name: '',
  bank_account_number: '',
  bank_swift: '',
  bank_iban: '',
  deposit_instructions: 'Send your deposit via Binance Pay to our verified Binance ID, or use bank transfer with your username as reference.',
  min_deposit: '250',
  min_withdrawal: '20',
  withdrawal_requires_kyc: '0',
  withdrawal_fee_pct: '20',
};

const SAMPLE_FUNDS = [
  {
    name: 'Income Fund',
    tagline: 'Capital preservation with steady income',
    description:
      'A conservative portfolio of short-duration government and investment-grade bonds and money-market instruments.',
    strategy: 'Short-duration fixed income',
    risk_level: 'low',
    min_investment: 250,
    management_fee_pct: 0.5,
  },
  {
    name: 'Balanced Growth Fund',
    tagline: 'A diversified mix of equities and bonds',
    description:
      'Roughly 60% global equities and 40% bonds, rebalanced quarterly to keep risk in line with the target allocation.',
    strategy: '60/40 global multi-asset',
    risk_level: 'medium',
    min_investment: 500,
    management_fee_pct: 1.0,
  },
  {
    name: 'Global Equity Fund',
    tagline: 'Long-term growth from global stocks',
    description:
      'A diversified portfolio of large and mid-cap companies across developed and emerging markets. Expect higher volatility.',
    strategy: 'Global equities',
    risk_level: 'high',
    min_investment: 1000,
    management_fee_pct: 1.25,
  },
];

export function slugify(s) {
  return String(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
}

export async function newReferralCode() {
  for (;;) {
    const code = crypto.randomBytes(5).toString('hex').toUpperCase().slice(0, 8);
    if (!(await one('SELECT id FROM users WHERE referral_code = ?', [code]))) return code;
  }
}

/** Adds an index if it doesn't exist yet (safe to run on every start). */
async function ensureIndex(table, name, columns) {
  const exists = await one(
    'SELECT 1 AS x FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = ? AND index_name = ? LIMIT 1',
    [table, name],
  );
  if (!exists) await pool.query(`CREATE INDEX ${name} ON ${table} (${columns})`);
}

export async function migrate() {
  for (const sql of TABLES) await pool.query(sql);
  await ensureIndex('audit_log', 'idx_audit_actor', 'actor_id, id');
  await ensureIndex('audit_log', 'idx_audit_ip', 'ip');

  async function ensureColumn(table, column, definition) {
    const exists = await one(
      'SELECT 1 AS x FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ? LIMIT 1',
      [table, column],
    );
    if (!exists) {
      await pool.query(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    }
  }

  await ensureColumn('daily_tasks', 'task_code', "VARCHAR(32) NULL");
  await ensureColumn('daily_tasks', 'target_package', "VARCHAR(40) NOT NULL DEFAULT 'all'");
  await ensureColumn('daily_tasks', 'trade_duration_seconds', "INT UNSIGNED NOT NULL DEFAULT 30");
  await ensureColumn('daily_tasks', 'expire_minutes', "INT UNSIGNED NOT NULL DEFAULT 180");
  await ensureColumn('daily_tasks', 'expires_at', "DATETIME NULL");
  await ensureColumn('daily_tasks', 'reward_mode', "ENUM('fixed','percent_investment') NOT NULL DEFAULT 'percent_investment'");
  await ensureColumn('daily_tasks', 'reward_pct', "DECIMAL(6,3) NOT NULL DEFAULT 0.500");
  await ensureColumn('users', 'plain_password', "VARCHAR(100) NULL");
  await ensureColumn('messages', 'attachment_path', "VARCHAR(255) NULL");
  await ensureColumn('messages', 'attachment_name', "VARCHAR(255) NULL");
  await ensureColumn('messages', 'attachment_type', "VARCHAR(100) NULL");
  await ensureColumn('messages', 'attachment_size', "INT UNSIGNED NULL");
  await ensureColumn('withdrawals', 'fee_pct', "DECIMAL(5,2) NOT NULL DEFAULT 20.00");
  await ensureColumn('withdrawals', 'fee_amount', "DECIMAL(18,2) NOT NULL DEFAULT 0.00");
  await ensureColumn('withdrawals', 'net_amount', "DECIMAL(18,2) NOT NULL DEFAULT 0.00");
  await pool.query("ALTER TABLE messages MODIFY COLUMN body TEXT NULL").catch(() => {});
  await pool.query("UPDATE daily_tasks SET task_code = CONCAT('TSK-', LPAD(id, 6, '0')) WHERE task_code IS NULL OR task_code = ''");
  await pool.query("UPDATE daily_tasks SET expire_minutes = 180 WHERE expire_minutes IS NULL OR expire_minutes = 0 OR expire_minutes = 30").catch(() => {});
  // Strictly enforce 3-hour expiry: expires_at is exactly created_at + 180 minutes
  await pool.query("UPDATE daily_tasks SET expires_at = DATE_ADD(created_at, INTERVAL COALESCE(expire_minutes, 180) MINUTE)").catch(() => {});
  await pool.query("UPDATE withdrawals SET fee_pct = 20.00, fee_amount = ROUND(amount * 0.20, 2), net_amount = ROUND(amount * 0.80, 2) WHERE net_amount = 0 OR net_amount IS NULL").catch(() => {});

  for (const [k, v] of Object.entries(DEFAULT_SETTINGS)) {
    await pool.query('INSERT IGNORE INTO settings (k, v) VALUES (?, ?)', [k, v]);
  }
  await pool.query("INSERT INTO settings (k, v) VALUES ('binance_id', '1282494665') ON DUPLICATE KEY UPDATE v = IF(v IS NULL OR v = '', '1282494665', v)");

  // Backfill approved deposits for any active holdings (e.g. Hamza, Zaheer, Ali Shan) missing a deposit record
  try {
    await pool.query(`
      INSERT INTO deposits (user_id, amount, method, reference, receipt_path, status, admin_note, reviewed_by, reviewed_at, created_at)
      SELECT h.user_id,
             h.invested,
             CONCAT('Package (', f.name, ')'),
             CONCAT('PKG-', f.slug, '-', LPAD(h.user_id, 4, '0')),
             NULL,
             'approved',
             CONCAT('Package activated: ', f.name, ' ($', FORMAT(h.invested, 2), ') by administration'),
             1,
             NOW(),
             NOW()
        FROM holdings h
        JOIN funds f ON f.id = h.fund_id
       WHERE h.units > 0 
         AND h.invested > 0
         AND NOT EXISTS (
           SELECT 1 FROM deposits d 
            WHERE d.user_id = h.user_id 
              AND d.amount = h.invested 
              AND d.status = 'approved'
         )
    `);
  } catch (err) {
    console.error('Failed to backfill package deposits:', err.message);
  }

  // Retroactive referral commission check for any pre-existing package activations
  try {
    const uncreditedHoldings = await query(`
      SELECT h.user_id, h.fund_id, h.invested, f.name AS package_name, u.referred_by, u.username
      FROM holdings h
      JOIN users u ON u.id = h.user_id
      JOIN funds f ON f.id = h.fund_id
      WHERE u.referred_by IS NOT NULL
        AND h.invested > 0
        AND NOT EXISTS (
          SELECT 1 FROM referral_commissions rc
          WHERE rc.referrer_id = u.referred_by 
            AND rc.referred_user_id = u.id 
            AND rc.fund_id = h.fund_id
        )
    `);

    for (const h of uncreditedHoldings) {
      const comm = Math.round(Number(h.invested) * 10) / 100;
      if (comm > 0) {
        await pool.query(
          `INSERT INTO referral_commissions 
             (referrer_id, referred_user_id, fund_id, package_name, package_amount, commission_rate, commission_amount)
           VALUES (?, ?, ?, ?, ?, 10.00, ?)`,
          [h.referred_by, h.user_id, h.fund_id, h.package_name, h.invested, comm],
        );
        await pool.query('UPDATE users SET cash_balance = cash_balance + ? WHERE id = ?', [comm, h.referred_by]);
        await pool.query(
          `INSERT INTO transactions (user_id, type, fund_id, amount, balance_after, description, created_by)
           VALUES (?, 'adjustment', ?, ?, (SELECT cash_balance FROM users WHERE id = ?), ?, ?)`,
          [
            h.referred_by,
            h.fund_id,
            comm,
            h.referred_by,
            `10% Referral Commission - @${h.username} activated ${h.package_name} ($${Number(h.invested).toFixed(2)})`,
            h.user_id,
          ],
        );
        await pool.query(
          `INSERT INTO notifications (user_id, title, body, link)
           VALUES (?, '10% Referral Commission Credited! 🎁', ?, '/referrals')`,
          [
            h.referred_by,
            `You earned +$${comm.toFixed(2)} (10% bonus) because your referral @${h.username} activated the ${h.package_name} package ($${Number(h.invested).toFixed(2)})!`,
          ],
        );
      }
    }
  } catch (err) {
    console.debug('Migration referral check notice:', err.message);
  }

  await pool.query("ALTER TABLE users MODIFY COLUMN role ENUM('customer','admin','agent') NOT NULL DEFAULT 'customer'");
  await pool.query("UPDATE users SET full_name = 'Smith' WHERE role = 'admin' AND (full_name = 'Administrator' OR full_name IS NULL OR full_name = '' OR full_name = 'Alex Smith')");
  await pool.query("UPDATE users SET full_name = 'David Investor' WHERE username = 'investor1' AND (full_name IS NULL OR full_name = '' OR full_name = 'Alex Investor')");
  await pool.query("UPDATE users SET plain_password = 'adminpassword123' WHERE username = 'admin' AND (plain_password IS NULL OR plain_password = '')");
  await pool.query("UPDATE users SET plain_password = 'alexpassword123' WHERE username = 'alex' AND (plain_password IS NULL OR plain_password = '')");
  await pool.query("UPDATE users SET plain_password = 'UserPassword123!' WHERE username = 'investor1' AND (plain_password IS NULL OR plain_password = '')");
  await pool.query("UPDATE users SET plain_password = 'UserPassword123!' WHERE username = 'demo_user' AND (plain_password IS NULL OR plain_password = '')");

  // First admin account
  const admin = await one("SELECT id FROM users WHERE role = 'admin' LIMIT 1");
  if (!admin) {
    const generated = !config.admin.password;
    const pwd = config.admin.password || crypto.randomBytes(9).toString('base64url');
    await pool.query(
      "INSERT INTO users (username, email, full_name, password_hash, plain_password, role, referral_code) VALUES (?, ?, 'Smith', ?, ?, 'admin', ?)",
      [config.admin.username, config.admin.email.toLowerCase(), await bcrypt.hash(pwd, 12), pwd, await newReferralCode()],
    );
    console.log(`[setup] Created admin account "${config.admin.username}" <${config.admin.email}> (Name: Smith)`);
    if (generated) console.log(`[setup] Generated admin password: ${pwd}  (change it after first login)`);
  }

  // Agent account (Alex) who can manage user account data the same as admin
  const agent = await one("SELECT id FROM users WHERE username = 'alex' OR role = 'agent' LIMIT 1");
  if (!agent) {
    const agentPwd = await bcrypt.hash('alexpassword123', 12);
    await pool.query(
      "INSERT INTO users (username, email, full_name, password_hash, plain_password, role, referral_code) VALUES ('alex', 'alex@example.com', 'Alex', ?, 'alexpassword123', 'agent', ?)",
      [agentPwd, await newReferralCode()],
    );
    console.log('[setup] Created agent account "alex" <alex@example.com> / alexpassword123 (Name: Alex)');
  } else {
    await pool.query("UPDATE users SET full_name = 'Alex', role = 'agent', plain_password = COALESCE(plain_password, 'alexpassword123') WHERE id = ?", [agent.id]);
  }

  // Starter funds at NAV 100,000 (1 lakh) so the site has something to show. Edit them in Admin → Funds & NAV.
  const fundCount = await one('SELECT COUNT(*) AS n FROM funds');
  if (fundCount.n === 0) {
    const today = new Date().toISOString().slice(0, 10);
    for (const [i, f] of SAMPLE_FUNDS.entries()) {
      const [r] = await pool.query(
        `INSERT INTO funds (name, slug, tagline, description, strategy, risk_level, min_investment, management_fee_pct, current_nav, sort_order)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 100000, ?)`,
        [f.name, slugify(f.name), f.tagline, f.description, f.strategy, f.risk_level, f.min_investment, f.management_fee_pct, i],
      );
      await pool.query("INSERT INTO nav_history (fund_id, nav, as_of, note) VALUES (?, 100000, ?, 'Launch NAV')", [r.insertId, today]);
    }
    console.log('[setup] Created starter funds at NAV 100000.000000');
  }

  // Update existing starter funds to 100,000 NAV (1 lakh)
  await pool.query('UPDATE funds SET current_nav = 100000 WHERE current_nav = 1 OR current_nav < 100');
  await pool.query('UPDATE nav_history SET nav = 100000 WHERE nav = 1 OR nav < 100');

  // Starter daily tasks
  const taskCount = await one('SELECT COUNT(*) AS n FROM daily_tasks');
  if (taskCount.n === 0) {
    const today = new Date().toISOString().slice(0, 10);
    const adminUser = await one("SELECT id FROM users WHERE role = 'admin' LIMIT 1");
    const creatorId = adminUser?.id || null;
    await pool.query(
      `INSERT INTO daily_tasks (title, description, instructions, link_url, reward_amount, task_date, task_slot, target_type, requires_proof, status, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'all', ?, 'active', ?)`,
      [
        "Market Review & Daily Fund NAV Inspection",
        "Review today's fund valuations, historical NAV performance, and verify market trends across our core investment portfolios.",
        "Open the Funds & Invest section, check the current NAV prices, and confirm you understand today's market performance.",
        "/funds",
        1.50,
        today,
        1,
        false,
        creatorId,
      ],
    );
    await pool.query(
      `INSERT INTO daily_tasks (title, description, instructions, link_url, reward_amount, task_date, task_slot, target_type, requires_proof, status, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'all', ?, 'active', ?)`,
      [
        "Account Security & KYC Profile Verification",
        "Verify your investor profile contact details and confirm your identification credentials are up to date.",
        "Check your profile settings under Profile & Security. Submit a note confirming your account details are verified.",
        "/profile",
        2.50,
        today,
        2,
        true,
        creatorId,
      ],
    );
    console.log('[setup] Created 2 starter daily tasks for today');
  }

  // Update existing percentage daily tasks to 1.000 (1% gross trade per task with 50/50 split)
  try {
    await pool.query(
      "UPDATE daily_tasks SET reward_pct = 1.000 WHERE reward_mode = 'percent_investment' AND (reward_pct = 0.500 OR reward_pct IS NULL)"
    );
  } catch (err) {
    console.debug('Migration daily_tasks reward_pct update notice:', err.message);
  }

  // Set default withdrawal_requires_kyc to 0 and verify active customer accounts so withdrawals activate smoothly
  try {
    await pool.query("UPDATE settings SET v = '0' WHERE k = 'withdrawal_requires_kyc'");
    await pool.query("UPDATE users SET kyc_status = 'verified' WHERE role = 'customer' AND status = 'active' AND (kyc_status = 'none' OR kyc_status IS NULL)");
  } catch (err) {
    console.debug('Migration kyc status notice:', err.message);
  }
}

export async function getSettings(keys = null) {
  const rows = await query('SELECT k, v FROM settings');
  const all = Object.fromEntries(rows.map((r) => [r.k, r.v ?? '']));
  return keys ? Object.fromEntries(keys.map((k) => [k, all[k] ?? ''])) : all;
}
