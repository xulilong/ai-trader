// 技术分析指标计算模块

/**
 * 计算移动平均线 (MA)
 */
function calculateMA(prices, period) {
  if (prices.length < period) return null;
  const slice = prices.slice(-period);
  const sum = slice.reduce((a, b) => a + b, 0);
  return sum / period;
}

/**
 * 计算指数移动平均线 (EMA)
 */
function calculateEMA(prices, period) {
  if (prices.length < period) return null;
  const multiplier = 2 / (period + 1);
  let ema = prices.slice(0, period).reduce((a, b) => a + b, 0) / period;
  
  for (let i = period; i < prices.length; i++) {
    ema = (prices[i] - ema) * multiplier + ema;
  }
  return ema;
}

/**
 * 计算 MACD
 * 返回：{ macd, signal, histogram }
 */
function calculateMACD(prices, fast = 12, slow = 26, signal = 9) {
  if (prices.length < slow + signal) return null;
  
  const emaFast = calculateEMA(prices, fast);
  const emaSlow = calculateEMA(prices, slow);
  
  if (emaFast === null || emaSlow === null) return null;
  
  const macdLine = emaFast - emaSlow;
  
  // 计算信号线需要历史 MACD 值，简化处理
  // 实际应该用 MACD 线计算 EMA
  const prevEmaFast = calculateEMA(prices.slice(0, -1), fast);
  const prevEmaSlow = calculateEMA(prices.slice(0, -1), slow);
  const prevMacd = prevEmaFast && prevEmaSlow ? prevEmaFast - prevEmaSlow : macdLine;
  
  const signalMultiplier = 2 / (signal + 1);
  const signalLine = (macdLine - prevMacd) * signalMultiplier + prevMacd;
  const histogram = macdLine - signalLine;
  
  return { macd: macdLine, signal: signalLine, histogram };
}

/**
 * 计算 RSI
 */
function calculateRSI(prices, period = 14) {
  if (prices.length < period + 1) return null;
  
  let gains = 0;
  let losses = 0;
  
  for (let i = prices.length - period; i < prices.length; i++) {
    const change = prices[i] - prices[i - 1];
    if (change > 0) gains += change;
    else losses -= change;
  }
  
  if (losses === 0) return 100;
  const rs = gains / losses;
  return 100 - (100 / (1 + rs));
}

/**
 * 计算 KDJ
 * 返回：{ k, d, j }
 */
function calculateKDJ(candles, n = 9, m1 = 3, m2 = 3) {
  if (candles.length < n) return null;
  
  const recent = candles.slice(-n);
  const highest = Math.max(...recent.map(c => c.high));
  const lowest = Math.min(...recent.map(c => c.low));
  const currentClose = candles[candles.length - 1].close;
  
  if (highest === lowest) return { k: 50, d: 50, j: 50 };
  
  const rsv = ((currentClose - lowest) / (highest - lowest)) * 100;
  
  // 简化计算，实际应该用 RSV 的 EMA
  const k = rsv;
  const d = k; // 简化
  const j = 3 * k - 2 * d;
  
  return { k, d, j };
}

/**
 * 计算布林带
 * 返回：{ upper, middle, lower, percentB }
 */
function calculateBollinger(prices, period = 20, stdDev = 2) {
  if (prices.length < period) return null;
  
  const slice = prices.slice(-period);
  const middle = slice.reduce((a, b) => a + b, 0) / period;
  
  const squaredDiffs = slice.map(p => Math.pow(p - middle, 2));
  const variance = squaredDiffs.reduce((a, b) => a + b, 0) / period;
  const std = Math.sqrt(variance);
  
  const upper = middle + stdDev * std;
  const lower = middle - stdDev * std;
  const currentPrice = prices[prices.length - 1];
  const percentB = (currentPrice - lower) / (upper - lower);
  
  return { upper, middle, lower, percentB };
}

/**
 * 计算成交量均线
 */
function calculateVMA(volumes, period = 5) {
  return calculateMA(volumes, period);
}

/**
 * 计算 OBV (能量潮)
 */
function calculateOBV(candles) {
  if (candles.length < 2) return null;
  
  let obv = 0;
  for (let i = 1; i < candles.length; i++) {
    if (candles[i].close > candles[i - 1].close) {
      obv += candles[i].volume;
    } else if (candles[i].close < candles[i - 1].close) {
      obv -= candles[i].volume;
    }
  }
  return obv;
}

/**
 * 综合技术指标分析
 * 返回交易信号：'strong_buy', 'buy', 'hold', 'sell', 'strong_sell'
 */
function analyzeTechnicals(candles, config = {}) {
  if (!candles || candles.length < 30) {
    return { signal: 'hold', confidence: 0, indicators: {} };
  }
  
  const closes = candles.map(c => c.close);
  const volumes = candles.map(c => c.volume);
  
  // 计算各项指标
  const macd = calculateMACD(closes);
  const rsi = calculateRSI(closes);
  const kdj = calculateKDJ(candles);
  const bollinger = calculateBollinger(closes);
  const ma5 = calculateMA(closes, 5);
  const ma10 = calculateMA(closes, 10);
  const ma20 = calculateMA(closes, 20);
  const vma = calculateVMA(volumes, 5);
  const currentVolume = volumes[volumes.length - 1];
  
  // 评分系统
  let score = 0;
  const signals = [];
  
  // MACD 信号
  if (macd) {
    if (macd.histogram > 0 && macd.macd > macd.signal) {
      score += 2;
      signals.push('MACD 金叉');
    } else if (macd.histogram < 0 && macd.macd < macd.signal) {
      score -= 2;
      signals.push('MACD 死叉');
    }
  }
  
  // RSI 信号
  if (rsi) {
    if (rsi < 30) {
      score += 2;
      signals.push('RSI 超卖');
    } else if (rsi > 70) {
      score -= 2;
      signals.push('RSI 超买');
    }
  }
  
  // KDJ 信号
  if (kdj) {
    if (kdj.k < 20 && kdj.j < 0) {
      score += 2;
      signals.push('KDJ 低位');
    } else if (kdj.k > 80 && kdj.j > 100) {
      score -= 2;
      signals.push('KDJ 高位');
    }
  }
  
  // 布林带信号
  if (bollinger) {
    if (bollinger.percentB < 0.2) {
      score += 1;
      signals.push('布林带下轨');
    } else if (bollinger.percentB > 0.8) {
      score -= 1;
      signals.push('布林带上轨');
    }
  }
  
  // 均线信号
  if (ma5 && ma10 && ma20) {
    const current = closes[closes.length - 1];
    if (current > ma5 && ma5 > ma10 && ma10 > ma20) {
      score += 2;
      signals.push('多头排列');
    } else if (current < ma5 && ma5 < ma10 && ma10 < ma20) {
      score -= 2;
      signals.push('空头排列');
    }
  }
  
  // 成交量信号
  if (vma && currentVolume > vma * 1.5) {
    score += 1;
    signals.push('放量');
  }
  
  // 确定信号
  let signal = 'hold';
  if (score >= 5) signal = 'strong_buy';
  else if (score >= 2) signal = 'buy';
  else if (score <= -5) signal = 'strong_sell';
  else if (score <= -2) signal = 'sell';
  
  const confidence = Math.min(Math.abs(score) / 10, 1);
  
  return {
    signal,
    confidence,
    score,
    signals,
    indicators: {
      macd,
      rsi,
      kdj,
      bollinger,
      ma: { ma5, ma10, ma20 },
      volume: { current: currentVolume, avg: vma },
    }
  };
}

module.exports = {
  calculateMA,
  calculateEMA,
  calculateMACD,
  calculateRSI,
  calculateKDJ,
  calculateBollinger,
  calculateVMA,
  calculateOBV,
  analyzeTechnicals,
};
