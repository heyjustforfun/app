// Customer-side support chat, notifications and documents.
import { Router } from 'express';
import { pool, query, one } from '../db.js';
import { HttpError, bad, intId, str } from '../lib/validate.js';
import { notifyAdmins } from '../lib/activity.js';
import { sendStored, uploader, storedPath } from '../lib/upload.js';

const router = Router();

// ---- Support chat ----------------------------------------------------------

router.get('/support', async (req, res) => {
  const after = Number(req.query.after) || 0;
  const messages = await query(
    'SELECT id, is_staff, body, attachment_path, attachment_name, attachment_type, attachment_size, created_at FROM messages WHERE user_id = ? AND id > ? ORDER BY id LIMIT 500',
    [req.user.id, after],
  );
  await pool.query('UPDATE messages SET read_at = NOW() WHERE user_id = ? AND is_staff = 1 AND read_at IS NULL', [req.user.id]);
  res.json({ messages });
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
  if (req.user.role === 'customer' && m.user_id !== req.user.id) {
    throw new HttpError(403, 'Access denied');
  }
  const isDownload = req.query.download === '1' || req.query.download === 'true';
  sendStored(res, m.attachment_path, m.attachment_name, { download: isDownload });
});

router.post('/support', async (req, res) => {
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
  const [r] = await pool.query(
    'INSERT INTO messages (user_id, sender_id, is_staff, body, attachment_path, attachment_name, attachment_type, attachment_size) VALUES (?, ?, 0, ?, ?, ?, ?, ?)',
    [req.user.id, req.user.id, body, attachmentPath, attachmentName, attachmentType, attachmentSize],
  );
  // Only ping admins for the first unread message in a burst
  const unread = await one('SELECT COUNT(*) AS n FROM messages WHERE user_id = ? AND is_staff = 0 AND read_at IS NULL', [req.user.id]);
  if (unread.n === 1) {
    const preview = body ? body.slice(0, 120) : `Attached: ${attachmentName || 'document/image'}`;
    await notifyAdmins(pool, 'New support message', `@${req.user.username}: ${preview}`, `/admin/support?user=${req.user.id}`);
  }
  res.status(201).json({
    message: await one(
      'SELECT id, is_staff, body, attachment_path, attachment_name, attachment_type, attachment_size, created_at FROM messages WHERE id = ?',
      [r.insertId],
    ),
  });
});

// ---- Notifications ---------------------------------------------------------

router.get('/notifications', async (req, res) => {
  const items = await query('SELECT id, title, body, link, read_at, created_at FROM notifications WHERE user_id = ? ORDER BY id DESC LIMIT 30', [
    req.user.id,
  ]);
  const unread = await one('SELECT COUNT(*) AS n FROM notifications WHERE user_id = ? AND read_at IS NULL', [req.user.id]);
  const chat =
    req.user.role === 'admin' || req.user.role === 'agent'
      ? await one('SELECT COUNT(*) AS n FROM messages WHERE is_staff = 0 AND read_at IS NULL')
      : await one('SELECT COUNT(*) AS n FROM messages WHERE user_id = ? AND is_staff = 1 AND read_at IS NULL', [req.user.id]);
  res.json({ notifications: items, unread: unread.n, unread_chat: chat.n });
});

router.post('/notifications/read-all', async (req, res) => {
  await pool.query('UPDATE notifications SET read_at = NOW() WHERE user_id = ? AND read_at IS NULL', [req.user.id]);
  res.json({ ok: true });
});

router.post('/notifications/:id/read', async (req, res) => {
  await pool.query('UPDATE notifications SET read_at = NOW() WHERE id = ? AND user_id = ?', [intId(req.params.id), req.user.id]);
  res.json({ ok: true });
});

// ---- Documents -------------------------------------------------------------

router.get('/documents', async (req, res) => {
  res.json({
    documents: await query(
      `SELECT d.id, d.title, d.category, d.original_name, d.mime, d.size, d.created_at, d.user_id IS NOT NULL AS personal, f.name AS fund_name
         FROM documents d LEFT JOIN funds f ON f.id = d.fund_id
        WHERE d.user_id IS NULL OR d.user_id = ? ORDER BY d.id DESC`,
      [req.user.id],
    ),
  });
});

router.get('/documents/:id/download', async (req, res) => {
  const d = await one('SELECT * FROM documents WHERE id = ?', [intId(req.params.id)]);
  if (!d || (d.user_id && d.user_id !== req.user.id && req.user.role !== 'admin' && req.user.role !== 'agent')) throw new HttpError(404, 'Document not found');
  sendStored(res, d.file_path, d.original_name);
});

export default router;
