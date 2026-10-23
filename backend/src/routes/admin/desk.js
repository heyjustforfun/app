// Admin: dashboard stats, support desk, documents, inquiries, audit log and settings.
import { Router } from 'express';
import { pool, query, one } from '../../db.js';
import { DEFAULT_SETTINGS, getSettings } from '../../migrate.js';
import { HttpError, bad, intId, oneOf, page, str } from '../../lib/validate.js';
import { audit, notify } from '../../lib/activity.js';
import { uploader, storedPath, removeFile } from '../../lib/upload.js';

const router = Router();

router.get('/stats', async (_req, res) => {
  const [dep] = await query(
    `SELECT SUM(status='pending') AS pending_count, COALESCE(SUM(CASE WHEN status='pending' THEN amount END),0) AS pending_volume,
            COALESCE(SUM(CASE WHEN status='approved' THEN amount END),0) AS approved_volume FROM deposits`,
  );
  const [wd] = await query(
    `SELECT SUM(status='pending') AS pending_count, COALESCE(SUM(CASE WHEN status='pending' THEN amount END),0) AS pending_volume,
            COALESCE(SUM(CASE WHEN status='paid' THEN amount END),0) AS paid_volume FROM withdrawals`,
  );
  const users = await one("SELECT COUNT(*) AS total, SUM(status='active') AS active, SUM(kyc_status='pending') AS kyc_pending FROM users WHERE role='customer'");
  const aum = await one('SELECT COALESCE(SUM(h.units * f.current_nav),0) AS v FROM holdings h JOIN funds f ON f.id = h.fund_id');
  const cash = await one("SELECT COALESCE(SUM(cash_balance),0) AS v FROM users WHERE role='customer'");
  const inquiries = await one("SELECT COUNT(*) AS n FROM inquiries WHERE status='new'");
  const chat = await one('SELECT COUNT(DISTINCT user_id) AS n FROM messages WHERE is_staff = 0 AND read_at IS NULL');
  const taskSubs = await one("SELECT COUNT(*) AS n FROM user_task_submissions WHERE status='pending'");
  res.json({
    deposits: { pending: Number(dep.pending_count || 0), pending_volume: Number(dep.pending_volume), approved_volume: Number(dep.approved_volume) },
    withdrawals: { pending: Number(wd.pending_count || 0), pending_volume: Number(wd.pending_volume), paid_volume: Number(wd.paid_volume) },
    users: { total: users.total, active: Number(users.active || 0), kyc_pending: Number(users.kyc_pending || 0) },
    aum: Math.round(Number(aum.v) * 100) / 100,
    cash_held: Number(cash.v),
    inquiries_new: inquiries.n,
    support_unread: chat.n,
    tasks_pending: Number(taskSubs?.n || 0),
  });
});

// ---- Support desk ----------------------------------------------------------

router.get('/support/threads', async (_req, res) => {
  res.json({
    threads: await query(
      `SELECT u.id AS user_id, u.username, u.email, u.full_name, u.status, u.cash_balance, u.kyc_status,
              m.body AS last_body, m.is_staff AS last_is_staff, m.attachment_name, m.created_at AS last_at,
              (SELECT COUNT(*) FROM messages x WHERE x.user_id = u.id AND x.is_staff = 0 AND x.read_at IS NULL) AS unread
         FROM users u
         LEFT JOIN messages m ON m.id = (SELECT MAX(id) FROM messages WHERE user_id = u.id)
        WHERE u.role = 'customer'
        ORDER BY (m.id IS NOT NULL) DESC, COALESCE(m.created_at, u.created_at) DESC
        LIMIT 250`,
    ),
  });
});

router.get('/support/users', async (_req, res) => {
  res.json({
    users: await query(
      `SELECT id, username, email, full_name, phone, cash_balance, kyc_status, status
         FROM users WHERE role = 'customer'
        ORDER BY username ASC LIMIT 500`,
    ),
  });
});

router.post('/support/upload', uploader('chat').single('file'), async (req, res) => {
  if (!req.file) throw bad('Please choose an image or document to upload');
  res.status(201).json({
    attachment_path: storedPath('chat', req.file),
    attachment_name: req.file.originalname,
    attachment_type: req.file.mimetype,
    attachment_size: req.file.size,
  });
});

router.get('/support/attachment/:id', async (req, res) => {
  const msgId = intId(req.params.id, 'attachment');
  const m = await one('SELECT id, user_id, attachment_path, attachment_name, attachment_type FROM messages WHERE id = ?', [msgId]);
  if (!m || !m.attachment_path) throw new HttpError(404, 'Attachment not found');
  const isDownload = req.query.download === '1' || req.query.download === 'true';
  sendStored(res, m.attachment_path, m.attachment_name, { download: isDownload });
});

router.get('/support/threads/:userId', async (req, res) => {
  const userId = intId(req.params.userId, 'user');
  const user = await one('SELECT id, username, email, full_name, phone, kyc_status, status, cash_balance FROM users WHERE id = ?', [userId]);
  if (!user) throw new HttpError(404, 'User not found');
  const after = Number(req.query.after) || 0;
  const messages = await query(
    `SELECT m.id, m.is_staff, m.body, m.attachment_path, m.attachment_name, m.attachment_type, m.attachment_size, m.created_at, s.username AS sender
       FROM messages m JOIN users s ON s.id = m.sender_id
      WHERE m.user_id = ? AND m.id > ? ORDER BY m.id LIMIT 500`,
    [userId, after],
  );
  await pool.query('UPDATE messages SET read_at = NOW() WHERE user_id = ? AND is_staff = 0 AND read_at IS NULL', [userId]);
  res.json({ user, messages });
});

router.post('/support/threads/:userId', async (req, res) => {
  const userId = intId(req.params.userId, 'user');
  const b = req.body || {};
  const rawBody = (b.body ?? '').trim();
  const attachmentPath = b.attachment_path ? String(b.attachment_path).slice(0, 255) : null;
  const attachmentName = b.attachment_name ? String(b.attachment_name).slice(0, 255) : null;
  const attachmentType = b.attachment_type ? String(b.attachment_type).slice(0, 100) : null;
  const attachmentSize = b.attachment_size ? Number(b.attachment_size) : null;

  if (!rawBody && !attachmentPath) {
    throw bad('Please provide a message or attach a file');
  }
  const body = rawBody ? str(rawBody, { name: 'Message', max: 4000 }) : '';
  if (!(await one('SELECT id FROM users WHERE id = ?', [userId]))) throw new HttpError(404, 'User not found');
  const [r] = await pool.query(
    'INSERT INTO messages (user_id, sender_id, is_staff, body, attachment_path, attachment_name, attachment_type, attachment_size) VALUES (?, ?, 1, ?, ?, ?, ?, ?)',
    [userId, req.user.id, body, attachmentPath, attachmentName, attachmentType, attachmentSize],
  );
  const notifyText = body ? body.slice(0, 160) : `Support sent an attachment: ${attachmentName || 'file'}`;
  await notify(pool, userId, 'New reply from support', notifyText, '/support');
  res.status(201).json({
    message: await one(
      'SELECT m.id, m.is_staff, m.body, m.attachment_path, m.attachment_name, m.attachment_type, m.attachment_size, m.created_at, s.username AS sender FROM messages m JOIN users s ON s.id = m.sender_id WHERE m.id = ?',
      [r.insertId],
    ),
  });
});

// ---- Documents -------------------------------------------------------------

router.get('/documents', async (_req, res) => {
  res.json({
    documents: await query(
      `SELECT d.id, d.title, d.category, d.original_name, d.size, d.created_at, d.user_id, u.username, f.name AS fund_name
         FROM documents d LEFT JOIN users u ON u.id = d.user_id LEFT JOIN funds f ON f.id = d.fund_id
        ORDER BY d.id DESC LIMIT 500`,
    ),
  });
});

router.post('/documents', uploader('documents').single('file'), async (req, res) => {
  try {
    if (!req.file) throw bad('Please choose a file to upload');
    const b = req.body || {};
    const title = str(b.title, { name: 'Title', max: 160 });
    const category = oneOf(b.category || 'other', ['report', 'factsheet', 'statement', 'legal', 'other'], 'Category');
    const userId = b.user_id ? intId(b.user_id, 'user') : null;
    const fundId = b.fund_id ? intId(b.fund_id, 'fund') : null;
    if (userId && !(await one('SELECT id FROM users WHERE id = ?', [userId]))) throw bad('Selected user does not exist');

    const [r] = await pool.query(
      'INSERT INTO documents (user_id, fund_id, title, category, file_path, original_name, mime, size, uploaded_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [userId, fundId, title, category, storedPath('documents', req.file), req.file.originalname.slice(0, 255), req.file.mimetype, req.file.size, req.user.id],
    );
    await audit(pool, req, 'document.upload', 'document', r.insertId, { title, user_id: userId });
    if (userId) await notify(pool, userId, 'New document available', title, '/documents');
    res.status(201).json({ id: r.insertId });
  } catch (err) {
    if (req.file) removeFile(storedPath('documents', req.file));
    throw err;
  }
});

router.delete('/documents/:id', async (req, res) => {
  const id = intId(req.params.id, 'document');
  const d = await one('SELECT file_path, title FROM documents WHERE id = ?', [id]);
  if (!d) throw new HttpError(404, 'Document not found');
  await pool.query('DELETE FROM documents WHERE id = ?', [id]);
  removeFile(d.file_path);
  await audit(pool, req, 'document.delete', 'document', id, { title: d.title });
  res.json({ ok: true });
});

// ---- Website inquiries -----------------------------------------------------

router.get('/inquiries', async (req, res) => {
  const status = req.query.status === 'closed' ? 'closed' : 'new';
  res.json({ inquiries: await query('SELECT * FROM inquiries WHERE status = ? ORDER BY id DESC LIMIT 300', [status]) });
});

router.post('/inquiries/:id/status', async (req, res) => {
  const id = intId(req.params.id, 'inquiry');
  const status = oneOf(req.body?.status, ['new', 'closed'], 'Status');
  await pool.query('UPDATE inquiries SET status = ? WHERE id = ?', [status, id]);
  res.json({ ok: true });
});

// ---- Audit log -------------------------------------------------------------

router.get('/audit', async (req, res) => {
  const { limit, offset, page: p, size } = page(req, 50);
  const filters = [];
  const params = [];
  if (req.query.entity) {
    filters.push('a.entity = ?');
    params.push(String(req.query.entity));
  }
  if (req.query.entity_id) {
    filters.push('a.entity_id = ?');
    params.push(Number(req.query.entity_id));
  }
  const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
  const rows = await query(
    `SELECT a.*, u.username AS actor FROM audit_log a LEFT JOIN users u ON u.id = a.actor_id ${where} ORDER BY a.id DESC LIMIT ? OFFSET ?`,
    [...params, limit, offset],
  );
  const total = await one(`SELECT COUNT(*) AS n FROM audit_log a ${where}`, params);
  res.json({ entries: rows, total: total.n, page: p, size });
});

// ---- Settings --------------------------------------------------------------

router.get('/settings', async (_req, res) => {
  res.json({ settings: await getSettings(Object.keys(DEFAULT_SETTINGS)) });
});

router.put('/settings', async (req, res) => {
  const incoming = req.body?.settings || {};
  const changed = {};
  for (const key of Object.keys(DEFAULT_SETTINGS)) {
    if (!(key in incoming)) continue;
    const v = String(incoming[key] ?? '').slice(0, 2000);
    if (['min_deposit', 'min_withdrawal'].includes(key) && (!Number.isFinite(Number(v)) || Number(v) < 0)) {
      throw bad(`${key.replace('_', ' ')} must be a non-negative number`);
    }
    await pool.query('INSERT INTO settings (k, v) VALUES (?, ?) ON DUPLICATE KEY UPDATE v = VALUES(v)', [key, v]);
    changed[key] = v;
  }
  await audit(pool, req, 'settings.update', 'settings', null, changed);
  res.json({ settings: await getSettings(Object.keys(DEFAULT_SETTINGS)) });
});

export default router;
