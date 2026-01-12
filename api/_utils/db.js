// api/_utils/db.js
const { Pool } = require('pg');

let pool;

function getPool() {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      max: 10,
      idleTimeoutMillis: 30000
    });
    
    pool.on('connect', () => {
      console.log('数据库连接成功');
    });
    
    pool.on('error', (err) => {
      console.error('数据库错误:', err);
    });
  }
  return pool;
}

// 健康检查
async function checkConnection() {
  try {
    const pool = getPool();
    const result = await pool.query('SELECT NOW()');
    return { success: true, time: result.rows[0].now };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// 初始化数据库
async function initDatabase() {
  try {
    const pool = getPool();
    
    const createTables = `
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(100) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        user_type VARCHAR(20) DEFAULT 'trial',
        trial_count INTEGER DEFAULT 0,
        trial_end_date TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_login TIMESTAMP
      );
      
      CREATE TABLE IF NOT EXISTS invitation_codes (
        id SERIAL PRIMARY KEY,
        code VARCHAR(100) UNIQUE NOT NULL,
        created_by VARCHAR(100),
        is_used BOOLEAN DEFAULT FALSE,
        used_by VARCHAR(100),
        used_date TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE TABLE IF NOT EXISTS records (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        match_name VARCHAR(200),
        handicap_type VARCHAR(10) NOT NULL,
        initial_handicap DECIMAL(5,2),
        current_handicap DECIMAL(5,2),
        initial_water DECIMAL(4,2),
        current_water DECIMAL(4,2),
        handicap_change DECIMAL(5,2),
        water_change DECIMAL(4,2),
        historical_record VARCHAR(10),
        recommendation VARCHAR(50),
        actual_result VARCHAR(10),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;
    
    await pool.query(createTables);
    
    // 创建默认管理员
    const adminCheck = await pool.query(
      "SELECT id FROM users WHERE username = 'admin'"
    );
    
    if (adminCheck.rows.length === 0) {
      await pool.query(
        "INSERT INTO users (username, password_hash, user_type) VALUES ('admin', 'admin123', 'admin')"
      );
      console.log('默认管理员创建成功');
    }
    
    return { success: true };
  } catch (error) {
    console.error('数据库初始化失败:', error);
    return { success: false, error: error.message };
  }
}

module.exports = { getPool, checkConnection, initDatabase };