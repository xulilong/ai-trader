// 交易策略模块

const { analyzeTechnicals } = require('./indicators');
const config = require('./config');

/**
 * 策略配置
 */
const strategies = {
  // 趋势跟踪策略
  trendFollowing: {
    name: '趋势跟踪',
    description: '跟随均线多头排列趋势，买入强势股',
    weight: 0.4,
  },
  // 均值回归策略
  meanReversion: {
    name: '均值回归',
    description: '在超卖时买入，超买时卖出',
    weight: 0.3,
  },
  // 突破策略
  breakout: {
    name: '突破策略',
    description: '价格突破关键位置时跟随',
    weight: 0.3,
  },
};

/**
 * 趋势跟踪策略信号
 */
function trendFollowingSignal(candles, currentPrice) {
  if (!candles || candles.length < 30) return { score: 0, reason: '数据不足' };
  
  const closes = candles.map(c => c.close);
  const ma5 = calculateMA(closes, 5);
  const ma10 = calculateMA(closes, 10);
  const ma20 = calculateMA(closes, 20);
  
  if (!ma5 || !ma10 || !ma20) return { score: 0, reason: '均线数据不足' };
  
  let score = 0;
  const reasons = [];
  
  // 多头排列
  if (currentPrice > ma5 && ma5 > ma10 && ma10 > ma20) {
    score += 3;
    reasons.push('多头排列');
  }
  // 空头排列
  else if (currentPrice < ma5 && ma5 < ma10 && ma10 < ma20) {
    score -= 3;
    reasons.push('空头排列');
  }
  
  // 价格站上 20 日线
  if (currentPrice > ma20 && closes[candles.length - 2] <= ma20) {
    score += 2;
    reasons.push('突破 20 日线');
  }
  
  // 价格跌破 20 日线
  if (currentPrice < ma20 && closes[candles.length - 2] >= ma20) {
    score -= 2;
    reasons.push('跌破 20 日线');
  }
  
  return { score, reasons };
}

/**
 * 均值回归策略信号
 */
function meanReversionSignal(candles, currentPrice) {
  const analysis = analyzeTechnicals(candles);
  
  let score = 0;
  const reasons = [];
  
  if (analysis.indicators.rsi) {
    if (analysis.indicators.rsi < 30) {
      score += 2;
      reasons.push(`RSI 超卖 (${analysis.indicators.rsi.toFixed(1)})`);
    } else if (analysis.indicators.rsi > 70) {
      score -= 2;
      reasons.push(`RSI 超买 (${analysis.indicators.rsi.toFixed(1)})`);
    }
  }
  
  if (analysis.indicators.bollinger) {
    if (analysis.indicators.bollinger.percentB < 0.2) {
      score += 2;
      reasons.push('布林带下轨附近');
    } else if (analysis.indicators.bollinger.percentB > 0.8) {
      score -= 2;
      reasons.push('布林带上轨附近');
    }
  }
  
  if (analysis.indicators.kdj) {
    if (analysis.indicators.kdj.k < 20) {
      score += 1;
      reasons.push('KDJ 低位');
    } else if (analysis.indicators.kdj.k > 80) {
      score -= 1;
      reasons.push('KDJ 高位');
    }
  }
  
  return { score, reasons };
}

/**
 * 突破策略信号
 */
function breakoutSignal(candles, currentPrice, volume) {
  if (!candles || candles.length < 20) return { score: 0, reason: '数据不足' };
  
  const recent = candles.slice(-20);
  const highest20 = Math.max(...recent.map(c => c.high));
  const lowest20 = Math.min(...recent.map(c => c.low));
  const avgVolume = recent.reduce((sum, c) => sum + c.volume, 0) / recent.length;
  
  let score = 0;
  const reasons = [];
  
  // 突破 20 日高点
  if (currentPrice > highest20) {
    score += 3;
    reasons.push('突破 20 日新高');
    
    // 放量突破加分
    if (volume > avgVolume * 1.5) {
      score += 1;
      reasons.push('放量突破');
    }
  }
  
  // 跌破 20 日低点
  if (currentPrice < lowest20) {
    score -= 3;
    reasons.push('跌破 20 日新低');
  }
  
  return { score, reasons };
}

/**
 * 计算移动平均（辅助函数）
 */
function calculateMA(prices, period) {
  if (prices.length < period) return null;
  const slice = prices.slice(-period);
  const sum = slice.reduce((a, b) => a + b, 0);
  return sum / period;
}

/**
 * 综合策略决策
 * 返回：{ action: 'BUY'|'SELL'|'HOLD', confidence, reason, targetShares }
 */
function makeDecision(stockData, engine, stockCode) {
  const { candles, currentPrice, volume } = stockData;
  
  if (!candles || candles.length < 30) {
    return { action: 'HOLD', confidence: 0, reason: '数据不足' };
  }
  
  // 获取各策略信号
  const trendSignal = trendFollowingSignal(candles, currentPrice);
  const meanSignal = meanReversionSignal(candles, currentPrice);
  const breakoutSignalResult = breakoutSignal(candles, currentPrice, volume);
  
  // 加权综合评分
  const totalScore = (
    trendSignal.score * strategies.trendFollowing.weight +
    meanSignal.score * strategies.meanReversion.weight +
    breakoutSignalResult.score * strategies.breakout.weight
  );
  
  // 收集所有原因
  const allReasons = [
    ...trendSignal.reasons,
    ...meanSignal.reasons,
    ...breakoutSignalResult.reasons,
  ];
  
  // 检查持仓状态
  const position = engine.positions[stockCode];
  const hasPosition = !!position;
  
  // 检查止损止盈
  if (hasPosition) {
    const riskCheck = engine.checkStopLossTakeProfit(stockCode, currentPrice);
    if (riskCheck) {
      return {
        action: 'SELL',
        confidence: 0.9,
        reason: riskCheck.reason,
        targetShares: position.shares,
        urgency: riskCheck.urgency,
      };
    }
  }
  
  // 根据评分和持仓状态决定操作
  let action = 'HOLD';
  let confidence = Math.min(Math.abs(totalScore) / 10, 1);
  
  // 降低买入阈值，更容易产生交易
  if (totalScore >= 2 && !hasPosition) {
    action = 'BUY';
    // 计算目标仓位
    const availableCapital = engine.getAvailableCapital();
    const maxPositionValue = availableCapital * config.trading.maxPositionPercent;
    const targetShares = Math.floor(maxPositionValue / currentPrice / 100) * 100; // 100 股整数倍
    
    if (targetShares < 100) {
      action = 'HOLD';
      confidence = 0;
      allReasons.push('资金不足最小仓位');
    } else {
      return {
        action,
        confidence,
        reason: allReasons.join('; '),
        targetShares,
        score: totalScore,
      };
    }
  } else if (totalScore <= -2 && hasPosition) {
    action = 'SELL';
    return {
      action,
      confidence,
      reason: allReasons.join('; '),
      targetShares: position.shares,
      score: totalScore,
    };
  }
  
  return {
    action: 'HOLD',
    confidence: 0,
    reason: allReasons.length > 0 ? allReasons.join('; ') : '无明确信号',
    score: totalScore,
  };
}

/**
 * 计算合理仓位
 */
function calculatePositionSize(engine, stockCode, currentPrice, signalStrength) {
  const availableCapital = engine.getAvailableCapital();
  const basePosition = availableCapital * config.trading.maxPositionPercent;
  
  // 根据信号强度调整
  const adjustedPosition = basePosition * (0.5 + signalStrength * 0.5);
  
  // 计算股数（100 股整数倍）
  const shares = Math.floor(adjustedPosition / currentPrice / 100) * 100;
  
  return Math.max(shares, 0);
}

module.exports = {
  strategies,
  trendFollowingSignal,
  meanReversionSignal,
  breakoutSignal,
  makeDecision,
  calculatePositionSize,
};
