#!/usr/bin/env node
// 生成有趋势的股票数据，产生更好的交易信号

const fs = require('fs');
const path = require('path');

function generateTrendCandles(days = 60, basePrice = 100, trend = 'up') {
  const candles = [];
  let price = basePrice;
  const now = Date.now();
  
  for (let i = days; i >= 0; i--) {
    const date = new Date(now - i * 24 * 60 * 60 * 1000);
    const dateStr = date.toISOString().split('T')[0];
    
    // 根据趋势调整波动
    let change;
    if (trend === 'up') {
      // 上涨趋势：小跌大涨
      change = (Math.random() - 0.35) * 0.05;
    } else if (trend === 'down') {
      // 下跌趋势：小涨大跌
      change = (Math.random() - 0.65) * 0.05;
    } else {
      // 震荡
      change = (Math.random() - 0.5) * 0.06;
    }
    
    const open = price;
    const close = price * (1 + change);
    const high = Math.max(open, close) * (1 + Math.random() * 0.02);
    const low = Math.min(open, close) * (1 - Math.random() * 0.02);
    const volume = Math.floor(1000000 + Math.random() * 5000000);
    
    candles.push({
      date: dateStr,
      open: parseFloat(open.toFixed(2)),
      high: parseFloat(high.toFixed(2)),
      low: parseFloat(low.toFixed(2)),
      close: parseFloat(close.toFixed(2)),
      volume,
    });
    
    price = close;
  }
  
  return candles;
}

// 生成不同趋势的股票
const stocks = [
  { code: '600519', name: '贵州茅台', basePrice: 1700, trend: 'up' },
  { code: '000858', name: '五粮液', basePrice: 150, trend: 'up' },
  { code: '601318', name: '中国平安', basePrice: 45, trend: 'up' },
  { code: '600036', name: '招商银行', basePrice: 35, trend: 'up' },
  { code: '002594', name: '比亚迪', basePrice: 220, trend: 'up' },
  { code: '601012', name: '隆基绿能', basePrice: 25, trend: 'up' },
  { code: '600276', name: '恒瑞医药', basePrice: 45, trend: 'up' },
  { code: '000333', name: '美的集团', basePrice: 65, trend: 'up' },
  { code: '600050', name: '中国联通', basePrice: 5, trend: 'up' },
  { code: '601398', name: '工商银行', basePrice: 5.5, trend: 'up' },
  { code: '601288', name: '农业银行', basePrice: 4, trend: 'down' },
  { code: '601939', name: '建设银行', basePrice: 6, trend: 'down' },
  { code: '000001', name: '平安银行', basePrice: 12, trend: 'down' },
  { code: '600809', name: '山西汾酒', basePrice: 180, trend: 'down' },
  { code: '601328', name: '交通银行', basePrice: 6, trend: 'down' },
];

const outputDir = path.join(__dirname, 'data');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

console.log('生成趋势股票数据...\n');

stocks.forEach(stock => {
  const candles = generateTrendCandles(60, stock.basePrice, stock.trend);
  const currentPrice = candles[candles.length - 1].close;
  const startPrice = candles[0].close;
  const change = ((currentPrice - startPrice) / startPrice) * 100;
  
  const stockData = {
    code: stock.code,
    name: stock.name,
    currentPrice,
    candles,
    volume: candles[candles.length - 1].volume,
    change,
    trend: stock.trend,
  };
  
  const outputFile = path.join(outputDir, `${stock.code}.json`);
  fs.writeFileSync(outputFile, JSON.stringify(stockData, null, 2));
  
  const trendIcon = stock.trend === 'up' ? '📈' : '📉';
  console.log(`${trendIcon} ${stock.code} ${stock.name} - ¥${currentPrice.toFixed(2)} (${change >= 0 ? '+' : ''}${change.toFixed(2)}%)`);
});

console.log(`\n✅ 数据已保存到：${outputDir}`);
console.log(`📊 共生成 ${stocks.length} 只股票，每只 60 天 K 线数据`);
