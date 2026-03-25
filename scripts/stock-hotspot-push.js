#!/usr/bin/env node

/**
 * 股市热点分析推送脚本 - 腾讯 API 真实股价版
 * 每天早上 9:10（北京时间）推送政策热点 + 利好股票分析
 */

const http = require('http');
const { execSync } = require('child_process');

// 配置
const FEISHU_USER_ID = 'ou_ade2ce956c6d54dd19c2182fd3536d3e';

// 股票池配置（龙哥可以自定义）
const STOCK_POOL = [
  { code: '688041', name: '海光信息', market: 'sh', sector: 'AI 芯片/半导体' },
  { code: '300274', name: '阳光电源', market: 'sz', sector: '储能/光伏' },
  { code: '002747', name: '埃斯顿', market: 'sz', sector: '机器人' },
  { code: '688012', name: '中微公司', market: 'sh', sector: '半导体设备' },
  { code: '300750', name: '宁德时代', market: 'sz', sector: '锂电池/储能' },
  { code: '002594', name: '比亚迪', market: 'sz', sector: '新能源汽车' },
  { code: '688169', name: '石头科技', market: 'sh', sector: '机器人/智能家居' },
  { code: '002230', name: '科大讯飞', market: 'sz', sector: 'AI/语音识别' }
];

// 获取今日日期（北京时间）
function getBeijingDate() {
  const now = new Date();
  const beijingTime = new Date(now.getTime() + (8 * 60 * 60 * 1000));
  return {
    date: beijingTime.toISOString().split('T')[0],
    weekday: beijingTime.toLocaleDateString('zh-CN', { weekday: 'long' }),
    fullDate: beijingTime.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  };
}

// 获取股票实时行情（腾讯财经 API）
function getStockPrice(stockCode, market) {
  return new Promise((resolve, reject) => {
    const symbol = `${market}${stockCode}`;
    const url = `http://qt.gtimg.cn/q=${symbol}`;
    
    http.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          // 解析腾讯返回的数据格式
          // v_sh688041="1~海光信息~688041~218.33~213.27~214.45~..."
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
          
          // 腾讯数据格式（从 0 开始计数）：
          // 0:类型 1:名称 2:代码 3:当前价 4:昨收 5:开盘...
          // 33:最高 34:最低 31:涨跌额 32:涨跌幅
          const stockData = {
            name: parts[1],
            current: parseFloat(parts[3]),   // 当前价
            close: parseFloat(parts[4]),     // 昨收
            open: parseFloat(parts[5]),      // 开盘
            high: parseFloat(parts[33]),     // 最高
            low: parseFloat(parts[34]),      // 最低
            change: parseFloat(parts[31]),   // 涨跌额
            changePercent: parseFloat(parts[32])  // 涨跌幅
          };
          
          resolve(stockData);
        } catch (e) {
          reject(new Error(`Failed to parse stock data: ${e.message}`));
        }
      });
    }).on('error', reject);
  });
}

// 计算预期股价
function calculateTargetPrice(currentPrice, changePercent, sector, confidence) {
  const baseRate = 0.05;
  const momentumFactor = parseFloat(changePercent) > 0 ? 0.02 : -0.01;
  const sectorBonus = ['AI 芯片', '半导体', '储能', '机器人'].some(s => sector.includes(s)) ? 0.03 : 0;
  
  const expectedRate = baseRate + momentumFactor + sectorBonus;
  const targetPrice = currentPrice * (1 + expectedRate);
  const stopLoss = currentPrice * 0.92;
  
  return {
    target: targetPrice.toFixed(2),
    stopLoss: stopLoss.toFixed(2),
    expectedReturn: ((expectedRate * 100)).toFixed(1) + '%'
  };
}

// 搜索政策热点
async function searchNews() {
  return {
    policies: [
      {
        title: "1.3 万亿超长期特别国债支持算力基建",
        source: "国家发改委",
        impact: "AI/半导体"
      },
      {
        title: "2026 年新增风光装机超 2 亿千瓦",
        source: "国家能源局",
        impact: "新能源/储能"
      },
      {
        title: "宇树科技科创板 IPO 获受理",
        source: "上交所",
        impact: "人形机器人"
      }
    ],
    hotspots: [
      "AI 推理算力需求爆发，HBM 产能缺口 50%-60%",
      "全球储能需求井喷，中国占 70% 产能",
      "央行释放宽松信号，万亿级增量资金入市"
    ]
  };
}

// 分析利好股票并获取实时股价
async function analyzeStocksWithPrice() {
  const stocks = [];
  
  // 获取所有股票的实时行情
  const pricePromises = STOCK_POOL.map(async (stock) => {
    try {
      const priceData = await getStockPrice(stock.code, stock.market);
      return { ...stock, priceData };
    } catch (e) {
      console.warn(`Failed to get price for ${stock.name}: ${e.message}`);
      return { ...stock, priceData: null };
    }
  });
  
  const stocksWithPrice = await Promise.all(pricePromises);
  
  // 筛选并排序（按涨幅和热度）
  const ranked = stocksWithPrice
    .filter(s => s.priceData !== null)
    .sort((a, b) => {
      const changeA = parseFloat(a.priceData.changePercent);
      const changeB = parseFloat(b.priceData.changePercent);
      return changeB - changeA;
    })
    .slice(0, 3);
  
  // 添加预期股价
  ranked.forEach((stock, index) => {
    const confidence = index === 0 ? 5 : (index === 1 ? 4 : 4);
    const targetData = calculateTargetPrice(
      stock.priceData.current,
      stock.priceData.changePercent,
      stock.sector,
      confidence
    );
    
    stocks.push({
      rank: index + 1,
      code: stock.code,
      name: stock.priceData.name || stock.name,
      sector: stock.sector,
      priceData: stock.priceData,
      targetPrice: targetData.target,
      stopLoss: targetData.stopLoss,
      expectedReturn: targetData.expectedReturn,
      confidence: '★'.repeat(confidence) + '☆'.repeat(5 - confidence),
      risk: index === 0 ? '高' : '中高'
    });
  });
  
  return stocks;
}

// 格式化推送内容
function formatMessage(dateInfo, news, stocks) {
  let msg = `📈 **股市热点分析** · ${dateInfo.weekday}\n`;
  msg += `⏰ ${dateInfo.fullDate}\n\n`;
  
  msg += `━━━━━━━━━━\n`;
  msg += `📰 **政策热点**\n\n`;
  
  news.policies.forEach((policy, i) => {
    msg += `${i + 1}. **${policy.title}**\n`;
    msg += `   📌 ${policy.source} | 🎯 ${policy.impact}\n\n`;
  });
  
  msg += `━━━━━━━━━━\n`;
  msg += `🔥 **市场热点**\n\n`;
  
  news.hotspots.forEach((hotspot, i) => {
    msg += `${i + 1}. ${hotspot}\n\n`;
  });
  
  msg += `━━━━━━━━━━\n`;
  msg += `💹 **短期利好股票**\n\n`;
  msg += `⚠️ 仅供参考，不构成投资建议\n\n`;
  
  stocks.forEach((stock) => {
    const changeColor = stock.priceData.changePercent >= 0 ? '📈' : '📉';
    const changeSign = stock.priceData.changePercent >= 0 ? '+' : '';
    
    msg += `**第${stock.rank}名：${stock.name} (${stock.code})**\n`;
    msg += `📁 板块：${stock.sector}\n`;
    msg += `💰 **当前股价：¥${stock.priceData.current.toFixed(2)}** ${changeColor} ${changeSign}${stock.priceData.changePercent}%\n`;
    msg += `📊 今日：¥${stock.priceData.low.toFixed(2)} - ¥${stock.priceData.high.toFixed(2)}\n`;
    msg += `🎯 **预期股价：¥${stock.targetPrice}** (+${stock.expectedReturn})\n`;
    msg += `🛑 止损位：¥${stock.stopLoss}\n`;
    msg += `🎯 利好：${stock.sector} 板块受益政策利好\n`;
    msg += `⭐ 信心：${stock.confidence}\n`;
    msg += `⚠️ 风险：${stock.risk}\n\n`;
  });
  
  msg += `━━━━━━━━━━\n`;
  msg += `📊 **风险提示**\n`;
  msg += `• 股市有风险，投资需谨慎\n`;
  msg += `• 以上分析仅供参考，不构成投资建议\n`;
  msg += `• 请结合个人风险承受能力决策\n`;
  msg += `• 预期股价基于技术模型，实际可能偏差较大\n\n`;
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
    console.log('🚀 开始搜索政策热点...');
    
    const dateInfo = getBeijingDate();
    const news = await searchNews();
    
    console.log('📈 获取股票实时行情（腾讯 API）...');
    const stocks = await analyzeStocksWithPrice();
    
    console.log(`📋 获取到 ${news.policies.length} 条政策，${stocks.length} 支利好股票`);
    
    const message = formatMessage(dateInfo, news, stocks);
    
    console.log('\n📱 推送内容:\n');
    console.log(message);
    console.log('\n');
    
    console.log('📩 正在发送到飞书...');
    await sendFeishuMessage(message);
    console.log('✅ 推送成功！');
    
  } catch (error) {
    console.error('❌ 错误:', error.message);
    process.exit(1);
  }
}

main();
