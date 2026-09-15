const pool = require('../../config/db');

async function getAuditLogs({
  limit,
  offset,
  isAdmin,
  userId,
  resourceType,
  action,
  search,
  startDate,
  endDate,
}) {
  const conditions = [];
  const params = [];

  if (isAdmin) {
    if (userId) {
      params.push(userId);
      conditions.push(`al.user_id = $${params.length}`);
    }
  } else {
    params.push(userId);
    conditions.push(`al.user_id = $${params.length}`);
  }

  if (resourceType) {
    params.push(resourceType);
    conditions.push(`al.resource_type = $${params.length}`);
  }

  if (action) {
    params.push(`%${action}%`);
    conditions.push(`al.action ILIKE $${params.length}`);
  }

  if (search) {
    params.push(`%${search}%`);
    const searchIdx1 = params.length;
    params.push(`%${search}%`);
    const searchIdx2 = params.length;
    conditions.push(
      `(u.email ILIKE $${searchIdx1} OR u.full_name ILIKE $${searchIdx2})`
    );
  }

  if (startDate) {
    params.push(startDate);
    conditions.push(`al.created_at >= $${params.length}`);
  }

  if (endDate) {
    params.push(endDate);
    conditions.push(`al.created_at <= $${params.length}`);
  }

  const whereClause = conditions.length
    ? `WHERE ${conditions.join(' AND ')}`
    : '';

  const countResult = await pool.query(
    `SELECT COUNT(*)
     FROM audit_logs al
     LEFT JOIN users u ON al.user_id = u.id
     ${whereClause}`,
    params
  );

  const total = Number(countResult.rows[0].count);

  const dataParams = [...params, limit, offset];
  const limitIndex = dataParams.length - 1;
  const offsetIndex = dataParams.length;

  const logs = await pool.query(
    `SELECT al.*, u.full_name AS actor_name, u.email AS actor_email
     FROM audit_logs al
     LEFT JOIN users u ON al.user_id = u.id
     ${whereClause}
     ORDER BY al.created_at DESC
     LIMIT $${limitIndex} OFFSET $${offsetIndex}`,
    dataParams
  );

  return {
    records: logs.rows,
    total,
  };
}

async function logEvent(data) {
  const {
    userId,
    action,
    resourceType,
    resourceId,
    details,
    oldValue,
    newValue,
    ipAddress,
    userAgent,
  } = data || {};
  await pool.query(
    `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, details, old_value, new_value, ip_address, user_agent)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [
      userId || null,
      action,
      resourceType || null,
      resourceId || null,
      details ? JSON.stringify(details) : null,
      oldValue ? JSON.stringify(oldValue) : null,
      newValue ? JSON.stringify(newValue) : null,
      ipAddress || null,
      userAgent || null,
    ]
  );
}
module.exports = {
  getAuditLogs,
  logEvent,
};
