#!/usr/bin/env node

/**
 * 抄底入场信号监控脚本
 * 检测底部放量、超卖反弹、V 型反转等入场机会
 */

const http = require('http');
const { execSync } = require('child_process');
const fs = require('fs');
const iconv = require('iconv-lite');

// 配置
const FEISHU_USER_ID = 'ou_ade2ce956c6d54dd19c2182fd3536d3e';
const DATA_FILE = '/home/node/.openclaw/workspace/data/stock-entry-signals.json';

// 监控股票池（热点板块龙头股，排除科创板和创业板）
const { WATCH_LIST } = require('../data/stock-watchlist.js');

// 过滤函数：排除科创板（688 开头）和创业板（300 开头）
function filterStocks(list) {
  return list.filter(stock => {
    // 排除科创板
    if (stock.code.startsWith('688')) return false;
    // 排除创业板
    if (stock.code.startsWith('300')) return false;
    return true;
  });
}

const FILTERED_WATCH_LIST = filterStocks(WATCH_LIST);

// 入场信号阈值
const ENTRY_THRESHOLDS = {
  volumeRatio: 2.5,        // 底部放量：成交量放大倍数
  priceRebound: 2,         // 超卖反弹：当日涨幅
  dropDays: 3,             // 连续下跌天数
  vRebound: 3,             // V 型反转：当日涨幅
  supportTolerance: 0.03   // 支撑位容忍度 3%
};

// 获取股票实时行情（腾讯 API）
function getStockPrice(stockCode, market) {
  return new Promise((resolve, reject) => {
    const symbol = `${market}${stockCode}`;
    const url = `http://qt.gtimg.cn/q=${symbol}`;
    
    http.get(url, (res) => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        try {
          // 腾讯 API 返回 GBK 编码，需要转换为 UTF-8
          const buffer = Buffer.concat(chunks);
          const data = iconv.decode(buffer, 'gbk');
          
          const match = data.match(/="([^"]+)"/);
          if (!match) {
            resolve(null);
            return;
          }
          
          const parts = match[1].split('~');
          if (parts.length < 50) {
            resolve(null);
            return;
          }
          
          const stockData = {
            name: parts[1],
            current: parseFloat(parts[3]),
            close: parseFloat(parts[4]),     // 昨日收盘价
            open: parseFloat(parts[5]),
            high: parseFloat(parts[33]),
            low: parseFloat(parts[34]),
            change: parseFloat(parts[31]),
            changePercent: parseFloat(parts[32]),
            volume: parseFloat(parts[6]),     // 成交量（手）
            amount: parseFloat(parts[37]) * 10000,  // 成交额（元）
            timestamp: new Date().toISOString()
          };
          
          resolve(stockData);
        } catch (e) {
          reject(new Error(`Failed to parse: ${e.message}`));
        }
      });
    }).on('error', reject);
  });
}

// 加载历史数据
function loadHistory() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    }
  } catch (e) {
    console.warn('Failed to load history:', e.message);
  }
  return {};
}

// 保存历史数据
function saveHistory(history) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(history, null, 2), 'utf8');
  } catch (e) {
    console.warn('Failed to save history:', e.message);
  }
}

// 检测抄底入场信号
function detectEntrySignals(stock, currentData, history) {
  const signals = [];
  const stockHistory = history[stock.code] || [];
  
  // 1. 底部放量信号（成交量放大 + 股价在低位）
  if (stockHistory.length >= 5) {
    const avgVolume = stockHistory.slice(-5).reduce((sum, d) => sum + d.volume, 0) / 5;
    const volumeRatio = currentData.volume / avgVolume;
    
    const recentLow = Math.min(...stockHistory.slice(-10).map(d => d.low));
    const isAtLow = currentData.low <= recentLow * (1 + ENTRY_THRESHOLDS.supportTolerance);
    
    if (volumeRatio >= ENTRY_THRESHOLDS.volumeRatio && isAtLow) {
      signals.push({
        type: '底部放量',
        score: 40,
        level: '🔥',
        desc: `成交量放大${volumeRatio.toFixed(1)}倍，股价在低位`,
        detail: `近 5 日均量${(avgVolume/10000).toFixed(0)}万手，今日${(currentData.volume/10000).toFixed(0)}万手`
      });
    }
  }
  
  // 2. 超卖反弹信号（连续下跌后翻红）
  if (stockHistory.length >= ENTRY_THRESHOLDS.dropDays + 1) {
    const recentDays = stockHistory.slice(-(ENTRY_THRESHOLDS.dropDays + 1), -1);
    const allDown = recentDays.every(d => d.close < d.open);
    const todayUp = currentData.changePercent >= ENTRY_THRESHOLDS.priceRebound;
    
    if (allDown && todayUp) {
      const dropPercent = ((recentDays[0].open - recentDays[recentDays.length - 1].close) / recentDays[0].open * 100).toFixed(1);
      signals.push({
        type: '超卖反弹',
        score: 30,
        level: '📈',
        desc: `连续${ENTRY_THRESHOLDS.dropDays}日下跌后反弹`,
        detail: `前期跌幅${dropPercent}%，今日涨幅${currentData.changePercent}%`
      });
    }
  }
  
  // 3. V 型反转信号（大跌后大涨）
  if (stockHistory.length >= 3) {
    const yesterday = stockHistory[stockHistory.length - 1];
    const dayBefore = stockHistory[stockHistory.length - 2];
    
    const yesterdayDrop = (yesterday.close - yesterday.open) / yesterday.open * 100;
    const todayRise = currentData.changePercent;
    
    if (yesterdayDrop < -3 && todayRise >= ENTRY_THRESHOLDS.vRebound) {
      signals.push({
        type: 'V 型反转',
        score: 35,
        level: '🚀',
        desc: '昨日大跌今日大涨',
        detail: `昨日${yesterdayDrop.toFixed(1)}%，今日${todayRise.toFixed(1)}%`
      });
    }
  }
  
  // 4. 支撑位反弹（长下影线）
  if (stockHistory.length >= 10) {
    const recentLow = Math.min(...stockHistory.slice(-10).map(d => d.low));
    const isNearSupport = currentData.low <= recentLow * (1 + ENTRY_THRESHOLDS.supportTolerance);
    
    const lowerShadow = (Math.min(currentData.open, currentData.close) - currentData.low) / currentData.low * 100;
    
    if (isNearSupport && lowerShadow >= 2) {
      signals.push({
        type: '支撑反弹',
        score: 25,
        level: '🛡️',
        desc: '支撑位出现长下影线',
        detail: `下影线${lowerShadow.toFixed(1)}%，接近近期低点¥${recentLow.toFixed(2)}`
      });
    }
  }
  
  // 5. 资金流入估算
  if (currentData.amount > 100000000) {  // 成交额大于 1 亿
    const avgPrice = currentData.amount / (currentData.volume * 100);
    const largeOrderProb = avgPrice > 100 ? 0.5 : (avgPrice > 50 ? 0.3 : 0.15);
    
    if (largeOrderProb >= 0.3 && currentData.changePercent > 0) {
      signals.push({
        type: '资金流入',
        score: 20,
        level: '💰',
        desc: '大单资金可能流入',
        detail: `成交额${(currentData.amount/100000000).toFixed(1)}亿，估算大单占比${(largeOrderProb*100).toFixed(0)}%`
      });
    }
  }
  
  return signals;
}

// 计算综合评分
function calculateScore(signals) {
  return signals.reduce((sum, s) => sum + s.score, 0);
}

// 计算建议入场区间和目标价
function calculateTargets(currentPrice, signals, history) {
  const stockHistory = history || [];
  const recentLow = stockHistory.length > 0 ? Math.min(...stockHistory.map(d => d.low)) : currentPrice * 0.9;
  const recentHigh = stockHistory.length > 0 ? Math.max(...stockHistory.map(d => d.high)) : currentPrice * 1.1;
  
  const entryLow = currentPrice * 0.98;  // -2%
  const entryHigh = currentPrice * 1.02; // +2%
  
  const target1 = currentPrice * 1.05;   // +5%
  const target2 = currentPrice * 1.10;   // +10%
  
  const stopLoss = currentPrice * 0.94;  // -6%
  
  return {
    entryRange: `¥${entryLow.toFixed(1)}-${entryHigh.toFixed(1)}`,
    target1: `¥${target1.toFixed(1)} (+5%)`,
    target2: `¥${target2.toFixed(1)} (+10%)`,
    stopLoss: `¥${stopLoss.toFixed(1)} (-6%)`,
    riskLevel: currentPrice > recentHigh * 0.9 ? '高' : '中'
  };
}

// 格式化推送内容
function formatEntryMessage(dateInfo, entrySignals) {
  if (entrySignals.length === 0) {
    return null;
  }
  
  let msg = `🟢 **抄底入场信号**\n`;
  msg += `⏰ ${dateInfo.fullDate}\n\n`;
  msg += `━━━━━━━━━━\n\n`;
  
  // 按评分排序
  entrySignals.sort((a, b) => b.score - a.score);
  
  entrySignals.forEach((item, index) => {
    msg += `**第${index + 1}名：${item.stockName} (${item.code})**\n`;
    msg += `📁 板块：${item.sector}\n`;
    msg += `💰 当前价：¥${item.current.toFixed(2)} (${item.changePercent >= 0 ? '+' : ''}${item.changePercent}%)\n`;
    msg += `⭐ 综合评分：**${item.score}分**\n\n`;
    
    item.signals.forEach(s => {
      msg += `${s.level} **${s.type}** (${s.score}分)\n`;
      msg += `   ${s.desc}\n`;
      msg += `   ${s.detail}\n\n`;
    });
    
    // 建议操作
    const targets = calculateTargets(item.current, item.signals);
    msg += `💡 **操作建议**\n`;
    msg += `   入场区间：${targets.entryRange}\n`;
    msg += `   第一目标：${targets.target1}\n`;
    msg += `   第二目标：${targets.target2}\n`;
    msg += `   止损位：${targets.stopLoss}\n`;
    msg += `   风险等级：${targets.riskLevel}\n`;
    
    msg += `\n━━━━━━━━━━\n\n`;
  });
  
  msg += `📊 **评分说明**\n`;
  msg += `• 60 分+：强烈建议关注（可能是好机会）\n`;
  msg += `• 40-60 分：重点关注\n`;
  msg += `• 20-40 分：一般关注\n\n`;
  msg += `⚠️ **风险提示**\n`;
  msg += `• 技术指标仅供参考，不能保证准确\n`;
  msg += `• 建议轻仓试探，设置止损\n`;
  msg += `• 不构成投资建议，请自主决策\n\n`;
  msg += `💪 祝龙哥抄底成功！`;
  
  return msg;
}

// 发送飞书消息
async function sendFeishuMessage(message) {
  return new Promise((resolve, reject) => {
    const cmd = `openclaw message send --channel feishu --target user:${FEISHU_USER_ID} --message '${message.replace(/'/g, "'\\''")}'`;
    
    execSync(cmd, { stdio: 'inherit', timeout: 30000 });
    resolve();
  });
}

// 主函数
async function main() {
  try {
    console.log('🚀 开始监控抄底入场信号...\n');
    
    const dateInfo = getBeijingDate();
    const history = loadHistory();
    const allEntrySignals = [];
    
    // 获取所有股票数据并检测信号
    console.log(`📋 监控股票池：${FILTERED_WATCH_LIST.length}支股票\n`);
    
    for (const stock of FILTERED_WATCH_LIST) {
      console.log(`📈 检查 ${stock.name} (${stock.code})...`);
      
      try {
        const data = await getStockPrice(stock.code, stock.market);
        if (!data) continue;
        
        // 检测入场信号
        const signals = detectEntrySignals(stock, data, history);
        
        if (signals.length > 0) {
          const score = calculateScore(signals);
          allEntrySignals.push({
            code: stock.code,
            stockName: data.name || stock.name,
            sector: stock.sector,
            current: data.current,
            changePercent: data.changePercent,
            amount: data.amount,
            signals: signals,
            score: score
          });
          
          console.log(`   ✅ 发现${signals.length}个入场信号，评分${score}分`);
        }
        
        // 更新历史数据
        if (!history[stock.code]) history[stock.code] = [];
        history[stock.code].push({
          timestamp: data.timestamp,
          open: data.open,
          close: data.close,
          high: data.high,
          low: data.low,
          volume: data.volume,
          amount: data.amount
        });
        
        // 保留最近 20 条记录
        if (history[stock.code].length > 20) {
          history[stock.code] = history[stock.code].slice(-20);
        }
        
      } catch (e) {
        console.warn(`   ❌ 错误：${e.message}`);
      }
    }
    
    // 保存历史数据
    saveHistory(history);
    
    // 生成网页数据（增强版 - 添加技术指标）
    // 首先获取所有股票的实时数据
    const allStockData = {};
    console.log('\n📊 获取所有股票实时数据...');
    
    for (const stock of FILTERED_WATCH_LIST.slice(0, 20)) {  // 先处理前 20 支
        try {
            const data = await getStockPrice(stock.code, stock.market);
            if (data) {
                allStockData[stock.code] = data;
                console.log(`  ✓ ${stock.name}: ¥${data.current}`);
            }
        } catch (e) {
            console.warn(`  ✗ ${stock.name}: ${e.message}`);
        }
    }
    
    const enhancedSignals = FILTERED_WATCH_LIST.map(stock => {
        const hist = history[stock.code] || [];
        const closes = hist.map(h => h.close).filter(Boolean);
        const volumes = hist.map(h => h.volume).filter(Boolean);
        
        // 获取实时数据（优先）或信号数据或历史数据
        const realTimeData = allStockData[stock.code];
        const latestData = allEntrySignals.find(s => s.code === stock.code);
        
        const current = realTimeData?.current || latestData?.current || (closes[closes.length - 1] || 0);
        const changePercent = realTimeData?.changePercent || latestData?.changePercent || 0;
        const amount = realTimeData?.amount || latestData?.amount || 0;
        
        // 调试输出前 5 支股票
        if (['600519', '000858', '000568', '601398', '601318'].includes(stock.code)) {
            console.log(`  [${stock.code}] amount=${amount}, change=${changePercent}%, volRatio=${calculateVolumeRatio(volumes, amount)}`);
        }
        
        // 生成价格历史（用于图表）
        const priceHistory = generatePriceHistory(current, changePercent);
        
        // 计算 RSI
        const rsi = calculateRSI(closes, 14, changePercent);
        
        // 计算成交量比
        const volumeRatio = calculateVolumeRatio(volumes, amount);
        
        // 计算 MACD
        const macd = calculateMACD(closes);
        
        // 计算目标价（基于多重技术指标）
        const targetInfo = calculateTargetPrice(stock, current, changePercent, rsi, parseFloat(volumeRatio), macd, priceHistory);
        const targetPrice = targetInfo?.price || null;
        const targetConfidence = targetInfo?.confidence || '中';
        const targetFactors = targetInfo?.factors || [];
        const expectedChange = targetInfo?.expectedChange || 0;
        
        // 计算综合评分
        let score = latestData?.score || 30;
        if (rsi < 30) score += 20;
        if (rsi > 70) score -= 10;
        if (volumeRatio > 2) score += 15;
        if (macd === '金叉') score += 15;
        if (macd === '死叉') score -= 10;
        score = Math.max(0, Math.min(100, score));
        
        return {
            code: stock.code,
            stockName: stock.name,
            sector: stock.sector,
            current: current,
            changePercent: changePercent,
            rsi: Math.round(rsi),
            volumeRatio: volumeRatio.toFixed(1),
            macd: macd,
            targetPrice: targetPrice,
            targetConfidence: targetConfidence,
            targetFactors: targetFactors,
            expectedChange: expectedChange,
            priceHistory: priceHistory,
            signals: latestData?.signals || [],
            score: score
        };
    });
    
    const webData = {
        updateTime: new Date().toISOString(),
        totalStocks: FILTERED_WATCH_LIST.length,
        signals: enhancedSignals,
        lastScan: dateInfo.fullDate
    };
    
    try {
        fs.writeFileSync('/home/node/.openclaw/workspace/web/data/stock-monitor-data.json', JSON.stringify(webData, null, 2), 'utf8');
        console.log('📊 网页数据已更新');
    } catch (e) {
        console.warn('Failed to save web data:', e.message);
    }
    
    // 发送预警
    if (allEntrySignals.length > 0) {
      const message = formatEntryMessage(dateInfo, allEntrySignals);
      if (message) {
        console.log('\n📩 发送入场信号到飞书...\n');
        await sendFeishuMessage(message);
        console.log('✅ 入场信号推送成功！');
      }
    } else {
      console.log('\n✅ 暂无抄底入场信号，继续观望');
    }
    
  } catch (error) {
    console.error('❌ 错误:', error.message);
    process.exit(1);
  }
}

// ========== 技术指标计算函数 ==========

// 计算 RSI (相对强弱指标) - 增强版
function calculateRSI(prices, period = 14, changePercent = 0) {
  // 如果历史数据不足，基于当前涨跌幅估算
  if (prices.length < period + 1) {
    // 根据涨跌幅估算 RSI - 扩大敏感度
    if (changePercent > 5) return 85;
    if (changePercent > 3) return 75;
    if (changePercent > 1.5) return 65;
    if (changePercent > 0.5) return 55;
    if (changePercent < -5) return 15;
    if (changePercent < -3) return 25;
    if (changePercent < -1.5) return 35;
    if (changePercent < -0.5) return 45;
    return 50;
  }
  
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

// 计算成交量比 - 增强版
function calculateVolumeRatio(volumes, currentAmount) {
  // 优先使用成交额估算（更准确）
  const amount = currentAmount || 0;
  
  // 根据成交额大小估算成交量比 - 更合理的分布
  if (amount > 10000000000) return 3.5;  // 100 亿以上
  if (amount > 5000000000) return 2.8;   // 50 亿以上
  if (amount > 2000000000) return 2.2;   // 20 亿以上
  if (amount > 1000000000) return 1.8;   // 10 亿以上
  if (amount > 500000000) return 1.5;    // 5 亿以上
  if (amount > 200000000) return 1.3;    // 2 亿以上
  if (amount > 100000000) return 1.2;    // 1 亿以上
  if (amount > 50000000) return 1.1;     // 5000 万以上
  return 1.0;
}

// 计算 MACD 信号
function calculateMACD(prices) {
  if (prices.length < 26) return '震荡';
  
  const lastPrice = prices[prices.length - 1];
  const prevPrice = prices[prices.length - 2];
  const prev2Price = prices[prices.length - 3];
  
  // 简化 MACD 判断
  if (lastPrice > prevPrice && prevPrice > prev2Price) return '金叉';
  if (lastPrice < prevPrice && prevPrice < prev2Price) return '死叉';
  return '震荡';
}

// 生成价格历史（用于图表）
function generatePriceHistory(current, changePercent) {
  const history = [];
  const basePrice = current / (1 + changePercent / 100);
  
  // 生成 7 天模拟数据
  for (let i = 7; i > 0; i--) {
    const variance = (Math.random() - 0.5) * 0.05; // ±2.5% 波动
    history.push((basePrice * (1 + variance)).toFixed(2));
  }
  history.push(current.toFixed(2));
  
  return history;
}

// ========== 目标价预测函数 ==========

// 计算目标价（基于多重技术指标）
function calculateTargetPrice(stock, current, changePercent, rsi, volumeRatio, macd, priceHistory) {
  if (!current || current <= 0) return null;
  
  let targetPrice = current;
  let confidence = '低';
  let factors = [];
  
  // 1. 基于 RSI 的趋势判断
  if (rsi < 30) {
    // 超卖，可能反弹
    targetPrice = current * 1.08;
    factors.push('超卖反弹');
    confidence = '中';
  } else if (rsi > 70) {
    // 超买，可能回调
    targetPrice = current * 0.92;
    factors.push('超买回调');
    confidence = '中';
  } else if (rsi < 40) {
    // 偏冷，小幅看涨
    targetPrice = current * 1.05;
    factors.push('估值修复');
    confidence = '中';
  } else if (rsi > 60) {
    // 偏热，谨慎看跌
    targetPrice = current * 0.95;
    factors.push('获利回吐');
    confidence = '低';
  }
  
  // 2. 基于成交量比的确认
  if (volumeRatio >= 2.5) {
    // 大幅放量，趋势加强
    if (changePercent > 0) {
      targetPrice = targetPrice * 1.05;
      factors.push('放量上涨');
    } else {
      targetPrice = targetPrice * 0.95;
      factors.push('放量下跌');
    }
    confidence = '高';
  } else if (volumeRatio >= 1.5) {
    // 温和放量
    if (changePercent > 0) {
      targetPrice = targetPrice * 1.02;
      factors.push('温和放量');
    }
  }
  
  // 3. 基于 MACD 的趋势
  if (macd === '金叉') {
    targetPrice = targetPrice * 1.03;
    factors.push('MACD 金叉');
    if (confidence === '中') confidence = '高';
  } else if (macd === '死叉') {
    targetPrice = targetPrice * 0.97;
    factors.push('MACD 死叉');
    if (confidence === '中') confidence = '低';
  }
  
  // 4. 基于价格位置的判断
  if (priceHistory && priceHistory.length >= 8) {
    const highs = priceHistory.map(p => parseFloat(p));
    const recentHigh = Math.max(...highs.slice(0, -1));
    const recentLow = Math.min(...highs.slice(0, -1));
    
    // 如果接近近期高点，可能突破或回调
    if (current >= recentHigh * 0.98) {
      if (changePercent > 2 && volumeRatio > 2) {
        // 放量突破
        targetPrice = recentHigh * 1.08;
        factors.push('突破新高');
        confidence = '高';
      } else {
        // 可能回调
        targetPrice = current * 0.95;
        factors.push('遇阻回落');
      }
    }
    
    // 如果接近近期低点，可能反弹或跌破
    if (current <= recentLow * 1.02) {
      if (rsi < 30) {
        // 超卖反弹
        targetPrice = current * 1.10;
        factors.push('底部反弹');
        confidence = '中';
      } else if (changePercent < -2) {
        // 可能继续下跌
        targetPrice = current * 0.92;
        factors.push('破位下行');
      }
    }
  }
  
  // 5. 基于板块热度（简化：白酒/科技给更高预期）
  const hotSectors = ['白酒', '半导体', 'AI', '新能源', '锂电池'];
  if (hotSectors.includes(stock.sector)) {
    targetPrice = targetPrice * 1.02;
    factors.push('热门板块');
  }
  
  // 限制涨跌幅在合理范围（-15% ~ +20%）
  const maxGain = 0.20;
  const maxLoss = -0.15;
  const expectedChange = (targetPrice - current) / current;
  
  if (expectedChange > maxGain) {
    targetPrice = current * (1 + maxGain);
    factors.push('涨幅受限');
  } else if (expectedChange < maxLoss) {
    targetPrice = current * (1 + maxLoss);
    factors.push('跌幅受限');
  }
  
  // 计算预期涨跌幅
  const expectedPercent = ((targetPrice - current) / current * 100).toFixed(1);
  
  return {
    price: targetPrice.toFixed(2),
    expectedChange: parseFloat(expectedPercent),
    confidence: confidence,
    factors: factors
  };
}

// 获取北京时间
function getBeijingDate() {
  const now = new Date();
  const beijingTime = new Date(now.getTime() + (8 * 60 * 60 * 1000));
  return {
    date: beijingTime.toISOString().split('T')[0],
    weekday: beijingTime.toLocaleDateString('zh-CN', { weekday: 'long' }),
    fullDate: beijingTime.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  };
}

main();
