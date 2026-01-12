// api/auth.js
const { getPool } = require('./_utils/db');

// 通用响应头设置
function setHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

// 处理OPTIONS请求
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
  
  const { action } = req.query;
  const pool = getPool();
  
  // 健康检查
  if (req.method === 'GET' && (!action || action === 'health')) {
    try {
      await pool.query('SELECT 1');
      res.json({ 
        success: true, 
        message: '认证服务正常',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({ 
        success: false, 
        error: error.message 
      });
    }
    return;
  }
  
  // 登录
  if (req.method === 'POST' && action === 'login') {
    try {
      const { username, password } = req.body;
      
      if (!username || !password) {
        return res.status(400).json({ 
          success: false, 
          error: '用户名和密码不能为空' 
        });
      }
      
      const result = await pool.query(
        `SELECT id, username, user_type, trial_count, trial_end_date 
         FROM users WHERE username = $1 AND password_hash = $2`,
        [username, password]
      );
      
      if (result.rows.length > 0) {
        const user = result.rows[0];
        
        // 更新登录时间
        await pool.query(
          'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1',
          [user.id]
        );
        
        // 检查试用状态
        let status = 'normal';
        let message = '登录成功';
        
        if (user.user_type === 'trial') {
          const now = new Date();
          const trialEnd = new Date(user.trial_end_date);
          
          if (now > trialEnd) {
            status = 'trial_expired';
            message = '试用期已过期';
          } else if (user.trial_count >= 18) {
            status = 'trial_limit';
            message = '试用次数已用完';
          }
        }
        
        res.json({
          success: true,
          user: {
            id: user.id,
            username: user.username,
            userType: user.user_type,
            trialCount: user.trial_count,
            trialEndDate: user.trial_end_date
          },
          status: status,
          message: message
        });
      } else {
        res.status(401).json({ 
          success: false, 
          error: '用户名或密码错误' 
        });
      }
    } catch (error) {
      res.status(500).json({ 
        success: false, 
        error: error.message 
      });
    }
    return;
  }
  
  // 注册
  if (req.method === 'POST' && action === 'register') {
    try {
      const { username, password, invitationCode } = req.body;
      
      if (!username || username.length < 3) {
        return res.status(400).json({ 
          success: false, 
          error: '用户名至少需要3个字符' 
        });
      }
      
      if (!password || password.length < 6) {
        return res.status(400).json({ 
          success: false, 
          error: '密码至少需要6个字符' 
        });
      }
      
      // 检查用户名
      const userCheck = await pool.query(
        'SELECT id FROM users WHERE username = $1',
        [username]
      );
      
      if (userCheck.rows.length > 0) {
        return res.status(400).json({ 
          success: false, 
          error: '用户名已存在' 
        });
      }
      
      // 验证邀请码
      let userType = 'trial';
      if (invitationCode) {
        const codeCheck = await pool.query(
          'SELECT * FROM invitation_codes WHERE code = $1 AND is_used = false',
          [invitationCode]
        );
        
        if (codeCheck.rows.length > 0) {
          userType = 'registered';
          await pool.query(
            'UPDATE invitation_codes SET is_used = true, used_by = $1, used_date = CURRENT_TIMESTAMP WHERE code = $2',
            [username, invitationCode]
          );
        } else {
          return res.status(400).json({ 
            success: false, 
            error: '无效的邀请码' 
          });
        }
      }
      
      // 创建用户
      const trialEndDate = new Date();
      trialEndDate.setDate(trialEndDate.getDate() + 7);
      
      const result = await pool.query(
        `INSERT INTO users (username, password_hash, user_type, trial_start_date, trial_end_date) 
         VALUES ($1, $2, $3, CURRENT_TIMESTAMP, $4) 
         RETURNING id, username, user_type, trial_count`,
        [username, password, userType, trialEndDate]
      );
      
      res.json({
        success: true,
        user: result.rows[0]
      });
      
    } catch (error) {
      res.status(500).json({ 
        success: false, 
        error: error.message 
      });
    }
    return;
  }
  
  // 获取用户信息
  if (req.method === 'GET' && action === 'user') {
    try {
      const { userId } = req.query;
      
      if (!userId) {
        return res.status(400).json({ 
          success: false, 
          error: '缺少用户ID' 
        });
      }
      
      const result = await pool.query(
        'SELECT id, username, user_type, trial_count, trial_end_date FROM users WHERE id = $1',
        [userId]
      );
      
      if (result.rows.length > 0) {
        res.json({
          success: true,
          user: result.rows[0]
        });
      } else {
        res.status(404).json({ 
          success: false, 
          error: '用户不存在' 
        });
      }
    } catch (error) {
      res.status(500).json({ 
        success: false, 
        error: error.message 
      });
    }
    return;
  }
  
  // 方法不支持
  res.status(405).json({ 
    success: false, 
    error: '不支持的方法' 
  });
};