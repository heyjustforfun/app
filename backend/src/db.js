import mysql from 'mysql2/promise';
import { config } from './config.js';

export const pool = mysql.createPool(
  process.env.MYSQL_URL || process.env.DATABASE_URL
    ? {
        uri: process.env.MYSQL_URL || process.env.DATABASE_URL,
        waitForConnections: true,
        connectionLimit: 10,
        decimalNumbers: true,
        dateStrings: ['DATE'],
        timezone: 'Z',
        charset: 'utf8mb4',
      }
    : {
        ...config.db,
        waitForConnections: true,
        connectionLimit: 10,
        decimalNumbers: true,
        dateStrings: ['DATE'],
        timezone: 'Z',
        charset: 'utf8mb4',
      }
);

// Store and read every DATETIME in UTC regardless of the server's local time zone.
pool.pool.on('connection', (conn) => conn.query("SET time_zone = '+00:00'"));

export async function query(sql, params = []) {
  const [rows] = await pool.query(sql, params);
  return rows;
}

export async function one(sql, params = []) {
  const rows = await query(sql, params);
  return rows[0] || null;
}

/** Runs fn(conn) inside a transaction; rolls back on any thrown error. */
export async function tx(fn) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const result = await fn(conn);
    await conn.commit();
    return result;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}
