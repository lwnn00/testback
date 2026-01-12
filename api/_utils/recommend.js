// api/_utils/recommend.js

// 让球盘推荐算法
function recommendAsian(data) {
  const { 
    initialHandicap, 
    currentHandicap, 
    initialWater, 
    currentWater, 
    historicalRecord 
  } = data;
  
  // 计算变化
  const handicapChange = currentHandicap - initialHandicap;
  const waterChange = currentWater - initialWater;
  
  let score = 0;
  let details = [];
  
  // 规则1: 盘口上升且水位下降 -> 上盘
  if (handicapChange > 0 && waterChange < 0) {
    score += 2;
    details.push('盘口上升 + 水位下降 → 强烈上盘信号');
  }
  
  // 规则2: 盘口下降且水位上升 -> 下盘
  if (handicapChange < 0 && waterChange > 0) {
    score -= 2;
    details.push('盘口下降 + 水位上升 → 强烈下盘信号');
  }
  
  // 规则3: 历史战绩影响
  if (historicalRecord === 'win') {
    score += 1;
    details.push('历史赢盘 → 看好延续');
  } else if (historicalRecord === 'loss') {
    score -= 1;
    details.push('历史输盘 → 可能反弹');
  }
  
  // 规则4: 水位绝对值影响
  if (currentWater < 0.85) {
    score += 1;
    details.push('低水位 → 机构防范');
  } else if (currentWater > 1.05) {
    score -= 1;
    details.push('高水位 → 机构诱盘');
  }
  
  // 规则5: 盘口变化幅度
  if (Math.abs(handicapChange) > 0.5) {
    if (handicapChange > 0) {
      score += 1;
      details.push('盘口大幅上升 → 上盘优势');
    } else {
      score -= 1;
      details.push('盘口大幅下降 → 下盘优势');
    }
  }
  
  // 生成推荐
  let recommendation;
  if (score >= 3) {
    recommendation = { result: '上盘', confidence: '高', color: 'green' };
  } else if (score >= 1) {
    recommendation = { result: '上盘', confidence: '中', color: 'light-green' };
  } else if (score <= -3) {
    recommendation = { result: '下盘', confidence: '高', color: 'red' };
  } else if (score <= -1) {
    recommendation = { result: '下盘', confidence: '中', color: 'light-red' };
  } else {
    recommendation = { result: '观望', confidence: '低', color: 'gray' };
  }
  
  return {
    recommendation: recommendation.result,
    confidence: recommendation.confidence,
    color: recommendation.color,
    score: score,
    details: details,
    analysis: {
      handicapChange: handicapChange.toFixed(2),
      waterChange: waterChange.toFixed(2),
      signalStrength: Math.abs(score)
    }
  };
}

// 大小盘推荐算法
function recommendSize(data) {
  const { 
    initialHandicap, 
    currentHandicap, 
    initialWater, 
    currentWater, 
    historicalRecord 
  } = data;
  
  // 计算变化
  const handicapChange = currentHandicap - initialHandicap;
  const waterChange = currentWater - initialWater;
  
  let score = 0;
  let details = [];
  
  // 规则1: 盘口上升且水位上升 -> 大球
  if (handicapChange > 0 && waterChange > 0) {
    score += 2;
    details.push('盘口上升 + 水位上升 → 强烈大球信号');
  }
  
  // 规则2: 盘口下降且水位下降 -> 小球
  if (handicapChange < 0 && waterChange < 0) {
    score -= 2;
    details.push('盘口下降 + 水位下降 → 强烈小球信号');
  }
  
  // 规则3: 历史战绩影响
  if (historicalRecord === 'win') {
    score += 1;
    details.push('历史赢盘 → 看好延续');
  } else if (historicalRecord === 'loss') {
    score -= 1;
    details.push('历史输盘 → 可能反弹');
  }
  
  // 规则4: 水位绝对值影响
  if (currentWater < 0.85) {
    score += 1;
    details.push('低水位 → 机构防范小球');
  } else if (currentWater > 1.05) {
    score -= 1;
    details.push('高水位 → 机构诱大球');
  }
  
  // 规则5: 盘口大小判断
  if (currentHandicap > 2.75) {
    score -= 0.5;
    details.push('高盘口 → 小球倾向');
  } else if (currentHandicap < 2.0) {
    score += 0.5;
    details.push('低盘口 → 大球倾向');
  }
  
  // 生成推荐
  let recommendation;
  if (score >= 3) {
    recommendation = { result: '大球', confidence: '高', color: 'green' };
  } else if (score >= 1) {
    recommendation = { result: '大球', confidence: '中', color: 'light-green' };
  } else if (score <= -3) {
    recommendation = { result: '小球', confidence: '高', color: 'red' };
  } else if (score <= -1) {
    recommendation = { result: '小球', confidence: '中', color: 'light-red' };
  } else {
    recommendation = { result: '观望', confidence: '低', color: 'gray' };
  }
  
  return {
    recommendation: recommendation.result,
    confidence: recommendation.confidence,
    color: recommendation.color,
    score: score,
    details: details,
    analysis: {
      handicapChange: handicapChange.toFixed(2),
      waterChange: waterChange.toFixed(2),
      signalStrength: Math.abs(score)
    }
  };
}

// 胜率统计
async function calculateWinRate(pool, userId) {
  try {
    const result = await pool.query(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN actual_result = 'win' THEN 1 ELSE 0 END) as wins,
        handicap_type,
        CASE 
          WHEN water_change > 0 THEN 'water_up'
          WHEN water_change < 0 THEN 'water_down'
          ELSE 'water_neutral'
        END as water_trend,
        CASE 
          WHEN handicap_change > 0 THEN 'handicap_up'
          WHEN handicap_change < 0 THEN 'handicap_down'
          ELSE 'handicap_neutral'
        END as handicap_trend,
        CASE 
          WHEN current_water < 0.90 THEN 'low_water'
          ELSE 'normal_water'
        END as water_level
      FROM records 
      WHERE user_id = $1 AND actual_result IS NOT NULL
      GROUP BY handicap_type, water_trend, handicap_trend, water_level
    `, [userId]);
    
    return result.rows;
  } catch (error) {
    console.error('胜率计算错误:', error);
    return [];
  }
}

module.exports = { recommendAsian, recommendSize, calculateWinRate };