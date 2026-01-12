// api/invitation.js
const { getPool } = require('./_utils/db');

function setHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function handleOptions(req, res) {
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return true;
  }
  return false;
}

module.exports = async (req, res) => {
  setHeaders(res);
  if (handleOptions(req, res)) return;
  
  const pool = getPool();
  
  // GET - 获取邀请码列表
  if (req.method === 'GET') {
    try {
      const { used } = req.query;
      
      let query = 'SELECT * FROM invitation_codes';
      let params = [];
      
      if (used !== undefined) {
        query += ' WHERE is_used = $1';
        params.push(used === 'true');
      }
      
      query += ' ORDER BY created_at DESC';
      
      const result = await pool.query(query, params);
      
      res.json({
        success: true,
        codes: result.rows
      });
      
    } catch (error) {
      res.status(500).json({ 
        success: false, 
        error: error.message 
      });
    }
    return;
  }
  
  // POST - 生成/导入邀请码
  if (req.method === 'POST') {
    try {
      const { codes, createdBy = 'admin' } = req.body;
      
      if (!codes || !Array.isArray(codes) || codes.length === 0) {
        return res.status(400).json({ 
          success: false, 
          error: '请提供有效的邀请码列表' 
        });
      }
      
      const inserted = [];
      
      for (const code of codes) {
        const trimmedCode = code.trim();
        if (!trimmedCode) continue;
        
        try {
          const result = await pool.query(
            `INSERT INTO invitation_codes (code, created_by) 
             VALUES ($1, $2) 
             ON CONFLICT (code) DO NOTHING 
             RETURNING code`,
            [trimmedCode, createdBy]
          );
          
          if (result.rows.length > 0) {
            inserted.push(trimmedCode);
          }
        } catch (error) {
          console.error(`插入邀请码失败: ${trimmedCode}`, error);
        }
      }
      
      res.json({
        success: true,
        inserted: inserted,
        count: inserted.length,
        message: `成功导入 ${inserted.length} 个邀请码`
      });
      
    } catch (error) {
      res.status(500).json({ 
        success: false, 
        error: error.message 
      });
    }
    return;
  }
  
  res.status(405).json({ 
    success: false, 
    error: '不支持的方法' 
  });
};