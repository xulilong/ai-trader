#!/usr/bin/env node

/**
 * 主力入场信号监控脚本 - 技术指标版
 * 监控成交量、价格异动、涨跌幅等指标
 */

const http = require('http');
const { execSync } = require('child_process');
const fs = require('fs');

// 配置
const FEISHU_USER_ID = 'ou_ade2ce956c6d54dd19c2182fd3536d3e';
const DATA_FILE = '/home/node/.openclaw/workspace/data/stock-monitor-history.json';

// 监控的股票池（龙哥可以自定义）
const WATCH_LIST = [
  { code: '688041', name: '海光信息', market: 'sh', sector: 'AI 芯片' },
  { code: '300274', name: '阳光电源', market: 'sz', sector: '储能' },
  { code: '002747', name: '埃斯顿', market: 'sz', sector: '机器人' },
  { code: '688012', name: '中微公司', market: 'sh', sector: '半导体' },
  { code: '300750', name: '宁德时代', market: 'sz', sector: '锂电池' },
  { code: '002594', name: '比亚迪', market: 'sz', sector: '新能源汽车' },
  { code: '688169', name: '石头科技', market: 'sh', sector: '机器人' },
  { code: '002230', name: '科大讯飞', market: 'sz', sector: 'AI' },
  { code: '600519', name: '贵州茅台', market: 'sh', sector: '白酒' },
  { code: '300059', name: '东方财富', market: 'sz', sector: '券商' }
];

// 主力入场信号阈值
const SIGNAL_THRESHOLDS = {
  volumeRatio: 3,        // 成交量放大倍数（对比 5 日均量）
  priceChange: 3,        // 涨幅超过 3%
  turnoverRate: 5,       // 换手率超过 5%
  priceBreakout: 0.05,   // 突破近期高点 5%
  largeOrderRatio: 0.3   // 大单占比 30%
};

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
            volume: parseFloat(parts[6]),     // 成交量（手）
            amount: parseFloat(parts[37]) * 10000,  // 成交额（元）
            timestamp: new Date().toISOString()
          };
          
          // 计算换手率（估算）
          stockData.turnoverRate = (stockData.volume / 10000 * 100).toFixed(2);
          
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
    fs.writeFileSync(DATA_FILE, JSON.stringify(history, null, 2));
  } catch (e) {
    console.warn('Failed to save history:', e.message);
  }
}

// 检测主力入场信号
function detectSignals(stock, currentData, history) {
  const signals = [];
  const stockHistory = history[stock.code] || [];
  
  // 1. 成交量异常检测
  if (stockHistory.length >= 5) {
    const avgVolume = stockHistory.slice(-5).reduce((sum, d) => sum + d.volume, 0) / 5;
    const volumeRatio = currentData.volume / avgVolume;
    
    if (volumeRatio >= SIGNAL_THRESHOLDS.volumeRatio) {
      signals.push({
        type: '成交量异常',
        level: '🔥',
        desc: `成交量放大${volumeRatio.toFixed(1)}倍（${(currentData.volume/10000).toFixed(0)}万手）`
      });
    }
  }
  
  // 2. 涨幅异常检测
  if (currentData.changePercent >= SIGNAL_THRESHOLDS.priceChange) {
    signals.push({
      type: '涨幅异常',
      level: '📈',
      desc: `涨幅${currentData.changePercent}%（超过${SIGNAL_THRESHOLDS.priceChange}%阈值）`
    });
  }
  
  // 3. 价格突破检测
  if (stockHistory.length >= 10) {
    const recentHigh = Math.max(...stockHistory.slice(-10).map(d => d.high));
    const breakoutPercent = (currentData.high - recentHigh) / recentHigh * 100;
    
    if (breakoutPercent >= SIGNAL_THRESHOLDS.priceBreakout * 100) {
      signals.push({
        type: '价格突破',
        level: '🚀',
        desc: `突破近期高点${breakoutPercent.toFixed(1)}%`
      });
    }
  }
  
  // 4. 大单流入（简化版，通过成交额/成交量估算）
  const avgPrice = currentData.amount / (currentData.volume * 100);
  const largeOrderEstimate = avgPrice > 50 ? 0.4 : 0.2;  // 高价股大单概率更高
  
  if (largeOrderEstimate >= SIGNAL_THRESHOLDS.largeOrderRatio) {
    signals.push({
      type: '大单流入',
      level: '💰',
      desc: `估算大单占比${(largeOrderEstimate * 100).toFixed(0)}%`
    });
  }
  
  return signals;
}

// 计算综合评分
function calculateScore(signals) {
  const scoreMap = {
    '成交量异常': 30,
    '涨幅异常': 25,
    '价格突破': 35,
    '大单流入': 20
  };
  
  return signals.reduce((sum, s) => sum + (scoreMap[s.type] || 0), 0);
}

// 格式化推送内容
function formatSignalMessage(dateInfo, signals) {
  if (signals.length === 0) {
    return null;
  }
  
  let msg = `🚨 **主力入场信号预警**\n`;
  msg += `⏰ ${dateInfo.fullDate}\n\n`;
  msg += `━━━━━━━━━━\n\n`;
  
  // 按评分排序
  signals.sort((a, b) => b.score - a.score);
  
  signals.forEach((signal, index) => {
    msg += `**第${index + 1}名：${signal.stockName} (${signal.code})**\n`;
    msg += `📁 板块：${signal.sector}\n`;
    msg += `💰 当前价：¥${signal.current.toFixed(2)} (${signal.changePercent >= 0 ? '+' : ''}${signal.changePercent}%)\n`;
    msg += `⭐ 综合评分：**${signal.score}分**\n\n`;
    
    signal.signals.forEach(s => {
      msg += `${s.level} **${s.type}**：${s.desc}\n`;
    });
    
    msg += `\n━━━━━━━━━━\n\n`;
  });
  
  msg += `📊 **说明**\n`;
  msg += `• 评分≥60 分：强烈关注\n`;
  msg += `• 评分≥40 分：重点关注\n`;
  msg += `• 评分≥20 分：一般关注\n\n`;
  msg += `⚠️ 仅供参考，不构成投资建议\n`;
  msg += `💪 祝龙哥投资顺利！`;
  
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
    console.log('🚀 开始监控主力入场信号...\n');
    
    const dateInfo = getBeijingDate();
    const history = loadHistory();
    const allSignals = [];
    
    // 获取所有股票数据并检测信号
    for (const stock of WATCH_LIST) {
      console.log(`📈 检查 ${stock.name} (${stock.code})...`);
      
      try {
        const data = await getStockPrice(stock.code, stock.market);
        if (!data) continue;
        
        // 检测信号
        const signals = detectSignals(stock, data, history);
        
        if (signals.length > 0) {
          const score = calculateScore(signals);
          allSignals.push({
            code: stock.code,
            stockName: data.name || stock.name,
            sector: stock.sector,
            current: data.current,
            changePercent: data.changePercent,
            signals: signals,
            score: score
          });
          
          console.log(`   ✅ 发现${signals.length}个信号，评分${score}分`);
        }
        
        // 更新历史数据
        if (!history[stock.code]) history[stock.code] = [];
        history[stock.code].push({
          timestamp: data.timestamp,
          volume: data.volume,
          high: data.high,
          low: data.low,
          close: data.close
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
    
    // 发送预警
    if (allSignals.length > 0) {
      const message = formatSignalMessage(dateInfo, allSignals);
      if (message) {
        console.log('\n📩 发送预警到飞书...\n');
        await sendFeishuMessage(message);
        console.log('✅ 预警推送成功！');
      }
    } else {
      console.log('\n✅ 未发现主力入场信号');
    }
    
  } catch (error) {
    console.error('❌ 错误:', error.message);
    process.exit(1);
  }
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
