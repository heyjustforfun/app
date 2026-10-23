// Audit trail + in-app notifications. `db` may be the pool or a transaction connection.

export async function audit(db, req, action, entity, entityId = null, details = null) {
  await db.query(
    'INSERT INTO audit_log (actor_id, action, entity, entity_id, details, ip) VALUES (?, ?, ?, ?, ?, ?)',
    [req.user?.id ?? null, action, entity, entityId, details ? JSON.stringify(details) : null, req.ip || null],
  );
}

export async function notify(db, userId, title, body, link = null) {
  await db.query('INSERT INTO notifications (user_id, title, body, link) VALUES (?, ?, ?, ?)', [
    userId,
    title,
    body,
    link,
  ]);
}

export async function notifyAdmins(db, title, body, link = null) {
  const [admins] = await db.query("SELECT id FROM users WHERE (role = 'admin' OR role = 'agent') AND status = 'active'");
  for (const a of admins) await notify(db, a.id, title, body, link);
}
