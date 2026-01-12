// api/records.js
const { getPool } = require('./_utils/db');
const { recommendAsian, recommendSize } = require('./_utils/recommend');

function setHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
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
  
  // GET - 获取记录
  if (req.method === 'GET') {
    try {
      const { userId, type, limit = 50, offset = 0 } = req.query;
      
      if (!userId) {
        return res.status(400).json({ 
          success: false, 
          error: '缺少用户ID' 
        });
      }
      
      let query = 'SELECT * FROM records WHERE user_id = $1';
      let params = [userId];
      let paramIndex = 2;
      
      if (type) {
        query += ` AND handicap_type = $${paramIndex}`;
        params.push(type);
        paramIndex++;
      }
      
      query += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      params.push(parseInt(limit), parseInt(offset));
      
      const result = await pool.query(query, params);
      
      // 获取总数
      const countResult = await pool.query(
        'SELECT COUNT(*) as total FROM records WHERE user_id = $1',
        [userId]
      );
      
      res.json({
        success: true,
        records: result.rows.map(record => ({
          id: record.id,
          matchName: record.match_name,
          handicapType: record.handicap_type,
          initialHandicap: parseFloat(record.initial_handicap),
          currentHandicap: parseFloat(record.current_handicap),
          initialWater: parseFloat(record.initial_water),
          currentWater: parseFloat(record.current_water),
          handicapChange: parseFloat(record.handicap_change),
          waterChange: parseFloat(record.water_change),
          historicalRecord: record.historical_record,
          recommendation: record.recommendation,
          actualResult: record.actual_result,
          createdAt: record.created_at
        })),
        pagination: {
          total: parseInt(countResult.rows[0].total),
          limit: parseInt(limit),
          offset: parseInt(offset)
        }
      });
      
    } catch (error) {
      res.status(500).json({ 
        success: false, 
        error: error.message 
      });
    }
    return;
  }
  
  // POST - 保存记录
  if (req.method === 'POST') {
    try {
      const record = req.body;
      const userId = record.userId || record.user_id;
      
      if (!userId) {
        return res.status(400).json({ 
          success: false, 
          error: '缺少用户ID' 
        });
      }
      
      // 检查用户
      const userCheck = await pool.query(
        'SELECT user_type, trial_count, trial_end_date FROM users WHERE id = $1',
        [userId]
      );
      
      if (userCheck.rows.length === 0) {
        return res.status(404).json({ 
          success: false, 
          error: '用户不存在' 
        });
      }
      
      const user = userCheck.rows[0];
      
      // 试用用户检查
      if (user.user_type === 'trial') {
        const now = new Date();
        const trialEnd = new Date(user.trial_end_date);
        
        if (now > trialEnd) {
          return res.status(403).json({ 
            success: false, 
            error: '试用期已过期，请注册正式会员' 
          });
        }
        
        if (user.trial_count >= 18) {
          return res.status(403).json({ 
            success: false, 
            error: '试用次数已用完，请注册正式会员' 
          });
        }
      }
      
      // 计算推荐
      const recommendationData = {
        initialHandicap: parseFloat(record.initialHandicap || record.initial_handicap),
        currentHandicap: parseFloat(record.currentHandicap || record.current_handicap),
        initialWater: parseFloat(record.initialWater || record.initial_water),
        currentWater: parseFloat(record.currentWater || record.current_water),
        historicalRecord: record.historicalRecord || record.historical_record
      };
      
      const handicapType = record.handicapType || record.handicap_type;
      let recommendation;
      
      if (handicapType === 'asian') {
        recommendation = recommendAsian(recommendationData);
      } else if (handicapType === 'size') {
        recommendation = recommendSize(recommendationData);
      } else {
        recommendation = { recommendation: '未知' };
      }
      
      // 计算变化
      const handicapChange = recommendationData.currentHandicap - recommendationData.initialHandicap;
      const waterChange = recommendationData.currentWater - recommendationData.initialWater;
      
      // 保存记录
      const result = await pool.query(
        `INSERT INTO records (
          user_id, match_name, handicap_type, 
          initial_handicap, current_handicap,
          initial_water, current_water,
          handicap_change, water_change,
          historical_record, recommendation, actual_result
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING id, created_at`,
        [
          userId,
          record.matchName || record.match_name || '未命名赛事',
          handicapType,
          recommendationData.initialHandicap,
          recommendationData.currentHandicap,
          recommendationData.initialWater,
          recommendationData.currentWater,
          handicapChange,
          waterChange,
          recommendationData.historicalRecord,
          recommendation.recommendation || '未知',
          record.actualResult || record.actual_result || ''
        ]
      );
      
      // 更新试用次数
      if (user.user_type === 'trial') {
        await pool.query(
          'UPDATE users SET trial_count = trial_count + 1 WHERE id = $1',
          [userId]
        );
      }
      
      res.json({
        success: true,
        recordId: result.rows[0].id,
        createdAt: result.rows[0].created_at,
        recommendation: recommendation
      });
      
    } catch (error) {
      res.status(500).json({ 
        success: false, 
        error: error.message 
      });
    }
    return;
  }
  
  // PUT - 更新记录
  if (req.method === 'PUT') {
    try {
      const { id } = req.query;
      const { actualResult } = req.body;
      
      if (!id) {
        return res.status(400).json({ 
          success: false, 
          error: '缺少记录ID' 
        });
      }
      
      await pool.query(
        'UPDATE records SET actual_result = $1 WHERE id = $2',
        [actualResult, id]
      );
      
      res.json({ success: true });
      
    } catch (error) {
      res.status(500).json({ 
        success: false, 
        error: error.message 
      });
    }
    return;
  }
  
  // DELETE - 删除记录
  if (req.method === 'DELETE') {
    try {
      const { id } = req.query;
      
      if (!id) {
        return res.status(400).json({ 
          success: false, 
          error: '缺少记录ID' 
        });
      }
      
      await pool.query('DELETE FROM records WHERE id = $1', [id]);
      
      res.json({ success: true });
      
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