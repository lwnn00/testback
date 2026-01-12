// test-db.js - 简化版本，不需要dotenv
const { Pool } = require('pg');

async function testDatabase() {
    console.log('🔍 测试数据库连接...');
    
    // 从环境变量或直接设置获取数据库连接
    const DATABASE_URL = process.env.DATABASE_URL || 
        'postgresql://username:password@localhost:5432/football_db';
    
    console.log(`数据库连接: ${DATABASE_URL ? '已设置' : '未设置'}`);
    
    const pool = new Pool({
        connectionString: DATABASE_URL,
        ssl: DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false }
    });
    
    try {
        // 测试连接
        console.log('正在连接数据库...');
        const connResult = await pool.query('SELECT NOW() as time');
        console.log('✅ 数据库连接成功');
        console.log('数据库时间:', connResult.rows[0].time);
        console.log('数据库版本:', (await pool.query('SELECT version()')).rows[0].version.split(' ')[1]);
        
        // 检查表结构
        console.log('\n📊 检查数据库表...');
        const tablesResult = await pool.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public'
            ORDER BY table_name
        `);
        
        if (tablesResult.rows.length === 0) {
            console.log('无表存在，需要初始化数据库');
            
            // 提供初始化SQL
            console.log('\n📋 请运行以下SQL创建表:');
            console.log(`
                CREATE TABLE users (
                    id SERIAL PRIMARY KEY,
                    username VARCHAR(100) UNIQUE NOT NULL,
                    password_hash VARCHAR(255) NOT NULL,
                    user_type VARCHAR(20) DEFAULT 'trial',
                    trial_count INTEGER DEFAULT 0,
                    trial_end_date TIMESTAMP,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    last_login TIMESTAMP
                );
                
                CREATE TABLE invitation_codes (
                    id SERIAL PRIMARY KEY,
                    code VARCHAR(100) UNIQUE NOT NULL,
                    created_by VARCHAR(100),
                    is_used BOOLEAN DEFAULT FALSE,
                    used_by VARCHAR(100),
                    used_date TIMESTAMP,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
                
                CREATE TABLE records (
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
                
                -- 创建默认管理员用户
                INSERT INTO users (username, password_hash, user_type) 
                VALUES ('admin', 'admin123', 'admin');
            `);
        } else {
            console.log('数据库表列表:');
            tablesResult.rows.forEach(table => {
                console.log(`  - ${table.table_name}`);
            });
            
            // 检查每个表的记录数
            console.log('\n📈 各表记录数:');
            for (const table of tablesResult.rows) {
                try {
                    const countResult = await pool.query(`SELECT COUNT(*) as count FROM ${table.table_name}`);
                    console.log(`  ${table.table_name}: ${countResult.rows[0].count} 条记录`);
                } catch (err) {
                    console.log(`  ${table.table_name}: 查询失败 - ${err.message}`);
                }
            }
        }
        
        console.log('\n🎉 数据库测试完成！');
        
    } catch (error) {
        console.error('\n❌ 数据库连接失败:', error.message);
        console.log('\n📋 常见问题排查:');
        console.log('  1. 检查数据库服务是否运行');
        console.log('  2. 检查连接字符串格式');
        console.log('  3. 检查用户名密码是否正确');
        console.log('  4. 检查数据库权限');
        console.log('  5. 检查网络连接');
        
        // 提供连接字符串示例
        console.log('\n🔧 连接字符串示例:');
        console.log('  本地PostgreSQL: postgresql://postgres:password@localhost:5432/football_db');
        console.log('  Supabase: postgresql://postgres.[project]:[password]@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres');
        console.log('  Neon: postgresql://neondb_owner:[password]@ep-[name].ap-southeast-1.aws.neon.tech/football_db');
        
    } finally {
        await pool.end();
        console.log('\n🔗 数据库连接已关闭');
    }
}

// 运行测试
testDatabase();
