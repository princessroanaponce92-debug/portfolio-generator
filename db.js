require('dotenv').config();
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
  waitForConnections: true,
  connectionLimit: 5,
  multipleStatements: true,
  connectTimeout: 20000,
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000,
  maxIdle: 2,
  idleTimeout: 30000
});


const RETRY = ['ECONNRESET', 'PROTOCOL_CONNECTION_LOST', 'ETIMEDOUT', 'EPIPE', 'ECONNREFUSED'];

async function withRetry(fn) {
  try {
    return await fn();
  } catch (e) {
    if (RETRY.includes(e.code)) {
      await new Promise(r => setTimeout(r, 1000));
      return fn();
    }
    throw e;
  }
}

module.exports = {
  query: (...args) => withRetry(() => pool.query(...args)),
  getConnection: () => withRetry(() => pool.getConnection()),
  end: () => pool.end()
};