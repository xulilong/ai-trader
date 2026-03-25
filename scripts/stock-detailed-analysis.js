#!/usr/bin/env node

/**
 * 股票详细分析脚本
 * 深度分析特定股票的入场信号
 */

const http = require('http');
const fs = require('fs');

// 配置
const DATA_FILE = '/home/node/.openclaw/workspace/data/stock-entry-signals.json';
const ANALYZE_STOCKS = [
  { code: '000338', name: '潍柴动力', market: 'sz', sector: '汽车零部件' },
  { code: '601899', name: '紫金矿业', market: 'sh', sector: '有色金属' },
  { code: '600547', name: '山东黄金', market: 'sh', sector: '黄金' }
];

// 获取股票实时行情（腾讯 API）
function getStockPrice(stockCode, market) {
  return new Promise((resolve, reject) => {
    const symbol = `${market}${stockCode}`;
    const url = `http://qt.gtimg.cn/q=${symbol}`;
    
    http.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
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
            close: parseFloat(parts[4]),
            open: parseFloat(parts[5]),
            high: parseFloat(parts[33]),
            low: parseFloat(parts[34]),
            change: parseFloat(parts[31]),
            changePercent: parseFloat(parts[32]),
            volume: parseFloat(parts[6]),
            amount: parseFloat(parts[37]) * 10000,
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

// 检测入场信号（详细版）
function detectSignalsDetailed(stock, currentData, history) {
  const signals = [];
  const stockHistory = history[stock.code] || [];
  
  // 1. 底部放量信号
  if (stockHistory.length >= 5) {
    const avgVolume = stockHistory.slice(-5).reduce((sum, d) => sum + d.volume, 0) / 5;
    const volumeRatio = currentData.volume / avgVolume;
    
    const recentLow = Math.min(...stockHistory.slice(-10).map(d => d.low));
    const isAtLow = currentData.low <= recentLow * 1.03;
    
    if (volumeRatio >= 2.5 && isAtLow) {
      signals.push({
        type: '底部放量',
        score: 40,
        level: '🔥',
        desc: '成交量放大，股价在低位',
        detail: `近 5 日均量${(avgVolume/10000).toFixed(0)}万手，今日${(currentData.volume/10000).toFixed(0)}万手，放大${volumeRatio.toFixed(1)}倍`,
        data: { volumeRatio, avgVolume, currentVolume: currentData.volume }
      });
    }
  }
  
  // 2. 超卖反弹信号
  if (stockHistory.length >= 4) {
    const recentDays = stockHistory.slice(-4, -1);
    const allDown = recentDays.every(d => d.close < d.open);
    const todayUp = currentData.changePercent >= 2;
    
    if (allDown && todayUp) {
      const dropPercent = ((recentDays[0].open - recentDays[recentDays.length - 1].close) / recentDays[0].open * 100).toFixed(1);
      signals.push({
        type: '超卖反弹',
        score: 30,
        level: '📈',
        desc: '连续 3 日下跌后反弹',
        detail: `前期跌幅${dropPercent}%，今日涨幅${currentData.changePercent}%`,
        data: { dropPercent, todayChange: currentData.changePercent }
      });
    }
  }
  
  // 3. V 型反转信号
  if (stockHistory.length >= 2) {
    const yesterday = stockHistory[stockHistory.length - 1];
    const yesterdayDrop = (yesterday.close - yesterday.open) / yesterday.open * 100;
    const todayRise = currentData.changePercent;
    
    if (yesterdayDrop < -3 && todayRise >= 3) {
      signals.push({
        type: 'V 型反转',
        score: 35,
        level: '🚀',
        desc: '昨日大跌今日大涨',
        detail: `昨日${yesterdayDrop.toFixed(1)}%，今日${todayRise.toFixed(1)}%`,
        data: { yesterdayDrop, todayRise }
      });
    }
  }
  
  // 4. 支撑位反弹（长下影线）
  if (stockHistory.length >= 10) {
    const recentLow = Math.min(...stockHistory.slice(-10).map(d => d.low));
    const isNearSupport = currentData.low <= recentLow * 1.03;
    
    const lowerShadow = (Math.min(currentData.open, currentData.close) - currentData.low) / currentData.low * 100;
    
    if (isNearSupport && lowerShadow >= 2) {
      signals.push({
        type: '支撑反弹',
        score: 25,
        level: '🛡️',
        desc: '支撑位出现长下影线',
        detail: `下影线${lowerShadow.toFixed(1)}%，接近近期低点¥${recentLow.toFixed(2)}`,
        data: { lowerShadow, recentLow, currentLow: currentData.low }
      });
    }
  }
  
  // 5. 资金流入估算
  if (currentData.amount > 100000000) {
    const avgPrice = currentData.amount / (currentData.volume * 100);
    const largeOrderProb = avgPrice > 100 ? 0.5 : (avgPrice > 50 ? 0.3 : 0.15);
    
    if (largeOrderProb >= 0.3 && currentData.changePercent > 0) {
      signals.push({
        type: '资金流入',
        score: 20,
        level: '💰',
        desc: '大单资金可能流入',
        detail: `成交额${(currentData.amount/100000000).toFixed(1)}亿，估算大单占比${(largeOrderProb*100).toFixed(0)}%`,
        data: { amount: currentData.amount, largeOrderProb }
      });
    }
  }
  
  return signals;
}

// 计算目标价
function calculateTargets(currentPrice, history) {
  const stockHistory = history || [];
  const recentLow = stockHistory.length > 0 ? Math.min(...stockHistory.map(d => d.low)) : currentPrice * 0.9;
  const recentHigh = stockHistory.length > 0 ? Math.max(...stockHistory.map(d => d.high)) : currentPrice * 1.1;
  
  return {
    entryLow: (currentPrice * 0.98).toFixed(2),
    entryHigh: (currentPrice * 1.02).toFixed(2),
    target1: (currentPrice * 1.05).toFixed(2),
    target2: (currentPrice * 1.10).toFixed(2),
    stopLoss: (currentPrice * 0.94).toFixed(2),
    support: recentLow.toFixed(2),
    resistance: recentHigh.toFixed(2)
  };
}

// 格式化详细分析报告
function formatDetailedAnalysis(stock, currentData, signals, history) {
  const score = signals.reduce((sum, s) => sum + s.score, 0);
  const targets = calculateTargets(currentData.current, history[stock.code]);
  
  let report = `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
  report += `**${stock.name} (${stock.code})**\n`;
  report += `📁 板块：${stock.sector}\n\n`;
  
  report += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
  
  // 实时数据
  report += `📊 **实时行情**\n\n`;
  report += `💰 当前价：¥${currentData.current.toFixed(2)}\n`;
  report += `📈 涨跌：${currentData.change >= 0 ? '+' : ''}${currentData.change.toFixed(2)} (${currentData.changePercent.toFixed(2)}%)\n`;
  report += `📊 今开：¥${currentData.open.toFixed(2)}\n`;
  report += `📉 最低：¥${currentData.low.toFixed(2)}\n`;
  report += `📈 最高：¥${currentData.high.toFixed(2)}\n`;
  report += `📊 昨收：¥${currentData.close.toFixed(2)}\n`;
  report += `💰 成交额：${(currentData.amount/100000000).toFixed(2)}亿\n`;
  report += `📊 成交量：${(currentData.volume/10000).toFixed(0)}万手\n\n`;
  
  report += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
  
  // 信号详情
  report += `🎯 **入场信号分析**\n\n`;
  report += `⭐ 综合评分：**${score}分** `;
  if (score >= 60) {
    report += `🔴 **强烈建议关注**\n\n`;
  } else if (score >= 40) {
    report += `🟡 **重点关注**\n\n`;
  } else {
    report += `⚪ **一般关注**\n\n`;
  }
  
  signals.forEach((s, i) => {
    report += `${i + 1}. **${s.type}** (${s.score}分) ${s.level}\n`;
    report += `   ${s.desc}\n`;
    report += `   ${s.detail}\n\n`;
  });
  
  report += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
  
  // 操作建议
  report += `💡 **操作建议**\n\n`;
  report += `🎯 入场区间：¥${targets.entryLow} - ¥${targets.entryHigh}\n`;
  report += `🎯 第一目标：¥${targets.target1} (+5%)\n`;
  report += `🎯 第二目标：¥${targets.target2} (+10%)\n`;
  report += `🛑 止损位：¥${targets.stopLoss} (-6%)\n`;
  report += `📊 支撑位：¥${targets.support}\n`;
  report += `📊 压力位：¥${targets.resistance}\n\n`;
  
  report += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
  
  // 风险提示
  report += `⚠️ **风险提示**\n\n`;
  report += `• 技术指标仅供参考，不能保证准确\n`;
  report += `• 建议轻仓试探（不超过总仓位 20%）\n`;
  report += `• 严格执行止损纪律\n`;
  report += `• 如有利空消息，重新评估风险\n\n`;
  
  report += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  
  return {
    report,
    score,
    signals: signals.map(s => s.type)
  };
}

// 主函数
async function main() {
  try {
    console.log('🚀 开始详细分析股票...\n');
    
    const history = loadHistory();
    const reports = [];
    
    for (const stock of ANALYZE_STOCKS) {
      console.log(`📈 分析 ${stock.name} (${stock.code})...\n`);
      
      const data = await getStockPrice(stock.code, stock.market);
      if (!data) {
        console.log('   ❌ 获取数据失败\n');
        continue;
      }
      
      const signals = detectSignalsDetailed(stock, data, history);
      const score = signals.reduce((sum, s) => sum + s.score, 0);
      
      console.log(`   ✅ 发现${signals.length}个信号，评分${score}分\n`);
      
      const analysis = formatDetailedAnalysis(stock, data, signals, history);
      reports.push({
        stock,
        data,
        signals,
        score,
        analysis
      });
    }
    
    // 输出报告
    console.log('\n');
    console.log('═══════════════════════════════════════\n');
    console.log('📋 **详细分析报告**\n');
    console.log('═══════════════════════════════════════\n');
    
    // 按评分排序
    reports.sort((a, b) => b.score - a.score);
    
    reports.forEach((r, i) => {
      console.log(`**第${i + 1}名：${r.stock.name} (${r.stock.code}) - ${r.score}分**\n`);
      console.log(r.analysis.report);
      console.log('\n');
    });
    
    // 保存详细报告
    const reportText = reports.map(r => r.analysis.report).join('\n\n');
    fs.writeFileSync('/home/node/.openclaw/workspace/data/stock-detailed-analysis.txt', reportText);
    console.log('📄 详细报告已保存到：/home/node/.openclaw/workspace/data/stock-detailed-analysis.txt\n');
    
  } catch (error) {
    console.error('❌ 错误:', error.message);
    process.exit(1);
  }
}

main();
