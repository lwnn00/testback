// api/stats.js
const { getPool } = require('./_utils/db');
const { recommendAsian, recommendSize, calculateWinRate } = require('./_utils/recommend');

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
  const { action } = req.query;
  
  // 推荐计算
  if (req.method === 'POST' && action === 'recommend') {
    try {
      const { type, ...data } = req.body;
      
      if (!type || !data) {
        return res.status(400).json({ 
          success: false, 
          error: '缺少推荐类型或数据' 
        });
      }
      
      let recommendation;
      
      if (type === 'asian') {
        recommendation = recommendAsian(data);
      } else if (type === 'size') {
        recommendation = recommendSize(data);
      } else {
        return res.status(400).json({ 
          success: false, 
          error: '不支持的推荐类型' 
        });
      }
      
      res.json({
        success: true,
        type: type,
        recommendation: recommendation.recommendation,
        details: recommendation.details,
        confidence: recommendation.confidence,
        score: recommendation.score,
        analysis: recommendation.analysis,
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
  
  // 获取统计数据
  if (req.method === 'GET' && action === 'stats') {
    try {
      const { userId } = req.query;
      
      if (!userId) {
        return res.status(400).json({ 
          success: false, 
          error: '缺少用户ID' 
        });
      }
      
      // 获取胜率数据
      const winRateData = await calculateWinRate(pool, userId);
      
      // 计算总胜率
      const totalStats = winRateData.reduce((acc, item) => {
        acc.total += parseInt(item.total);
        acc.wins += parseInt(item.wins);
        return acc;
      }, { total: 0, wins: 0 });
      
      const winRate = totalStats.total > 0 ? 
        (totalStats.wins / totalStats.total * 100).toFixed(1) : 0;
      
      // 按盘口类型统计
      const byType = {};
      winRateData.forEach(item => {
        if (!byType[item.handicap_type]) {
          byType[item.handicap_type] = { total: 0, wins: 0 };
        }
        byType[item.handicap_type].total += parseInt(item.total);
        byType[item.handicap_type].wins += parseInt(item.wins);
      });
      
      // 水位趋势统计
      const waterTrends = {};
      const handicapTrends = {};
      
      winRateData.forEach(item => {
        // 水位趋势
        if (item.water_trend) {
          if (!waterTrends[item.water_trend]) {
            waterTrends[item.water_trend] = { total: 0, wins: 0 };
          }
          waterTrends[item.water_trend].total += parseInt(item.total);
          waterTrends[item.water_trend].wins += parseInt(item.wins);
        }
        
        // 盘口趋势
        if (item.handicap_trend) {
          if (!handicapTrends[item.handicap_trend]) {
            handicapTrends[item.handicap_trend] = { total: 0, wins: 0 };
          }
          handicapTrends[item.handicap_trend].total += parseInt(item.total);
          handicapTrends[item.handicap_trend].wins += parseInt(item.wins);
        }
      });
      
      // 格式化数据供图表使用
      const chartData = {
        labels: ['水位上升', '水位下降', '盘口上升', '盘口下降', '低水位'],
        data: [
          waterTrends.water_up ? (waterTrends.water_up.wins / waterTrends.water_up.total * 100).toFixed(1) : 0,
          waterTrends.water_down ? (waterTrends.water_down.wins / waterTrends.water_down.total * 100).toFixed(1) : 0,
          handicapTrends.handicap_up ? (handicapTrends.handicap_up.wins / handicapTrends.handicap_up.total * 100).toFixed(1) : 0,
          handicapTrends.handicap_down ? (handicapTrends.handicap_down.wins / handicapTrends.handicap_down.total * 100).toFixed(1) : 0,
          winRateData.find(item => item.water_level === 'low_water') ? 
            (winRateData.filter(item => item.water_level === 'low_water').reduce((sum, item) => sum + parseInt(item.wins), 0) / 
             winRateData.filter(item => item.water_level === 'low_water').reduce((sum, item) => sum + parseInt(item.total), 0) * 100).toFixed(1) : 0
        ].map(v => parseFloat(v))
      };
      
      res.json({
        success: true,
        stats: {
          totalRecords: totalStats.total,
          totalWins: totalStats.wins,
          winRate: parseFloat(winRate),
          byType: Object.keys(byType).map(type => ({
            type: type,
            total: byType[type].total,
            wins: byType[type].wins,
            winRate: (byType[type].wins / byType[type].total * 100).toFixed(1)
          })),
          waterTrends,
          handicapTrends,
          chartData: chartData
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
  
  // 获取推荐记录
  if (req.method === 'GET' && action === 'history') {
    try {
      const { userId, limit = 10 } = req.query;
      
      if (!userId) {
        return res.status(400).json({ 
          success: false, 
          error: '缺少用户ID' 
        });
      }
      
      const result = await pool.query(
        `SELECT match_name, handicap_type, recommendation, actual_result, created_at 
         FROM records 
         WHERE user_id = $1 
         ORDER BY created_at DESC 
         LIMIT $2`,
        [userId, parseInt(limit)]
      );
      
      res.json({
        success: true,
        records: result.rows
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