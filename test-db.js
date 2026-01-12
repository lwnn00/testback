// test-db.js
require('dotenv').config();
const { Pool } = require('pg');

async function testDatabase() {
    console.log('🔍 测试数据库连接...');
    
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });
    
    try {
        // 测试连接
        const connResult = await pool.query('SELECT NOW() as time');
        console.log('✅ 数据库连接成功');
        console.log('数据库时间:', connResult.rows[0].time);
        
        // 检查表
        const tablesResult = await pool.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public'
            ORDER BY table_name
        `);
        
        console.log('\n📊 数据库表:');
        if (tablesResult.rows.length === 0) {
            console.log('  无表存在');
        } else {
            tablesResult.rows.forEach(table => {
                console.log(`  - ${table.table_name}`);
            });
        }
        
        // 测试CRUD操作
        console.log('\n🧪 测试CRUD操作...');
        
        // 1. 测试用户表
        const users = await pool.query("SELECT COUNT(*) FROM users");
        console.log(`  用户表记录数: ${users.rows[0].count}`);
        
        // 2. 测试邀请码表
        const codes = await pool.query("SELECT COUNT(*) FROM invitation_codes");
        console.log(`  邀请码表记录数: ${codes.rows[0].count}`);
        
        // 3. 测试记录表
        const records = await pool.query("SELECT COUNT(*) FROM records");
        console.log(`  记录表记录数: ${records.rows[0].count}`);
        
        console.log('\n🎉 所有测试通过！');
        
    } catch (error) {
        console.error('❌ 测试失败:', error.message);
        console.log('\n📋 排查建议:');
        console.log('  1. 检查 DATABASE_URL 环境变量');
        console.log('  2. 检查数据库是否运行');
        console.log('  3. 检查网络连接');
        console.log('  4. 检查数据库权限');
    } finally {
        await pool.end();
    }
}

testDatabase();