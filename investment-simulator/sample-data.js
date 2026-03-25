// 生成模拟股票数据用于测试

const fs = require('fs');
const path = require('path');

function generateCandles(days = 60, basePrice = 100) {
  const candles = [];
  let price = basePrice;
  const now = Date.now();
  
  for (let i = days; i >= 0; i--) {
    const date = new Date(now - i * 24 * 60 * 60 * 1000);
    const dateStr = date.toISOString().split('T')[0];
    
    // 随机波动 +/- 3%
    const change = (Math.random() - 0.5) * 0.06;
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

// 生成示例股票数据 - 从 watchlist 加载所有股票
const watchlistFile = path.join(__dirname, '..', 'data', 'stock-watchlist.js');
let sampleStocks = [];

if (fs.existsSync(watchlistFile)) {
  const watchlist = require(watchlistFile);
  const stocks = watchlist.WATCH_LIST || watchlist.stocks || watchlist.default || watchlist || [];
  // 取前 30 只股票生成数据
  sampleStocks = stocks.slice(0, 30).map(s => ({
    code: s.code,
    name: s.name,
    basePrice: Math.random() * 100 + 10, // 随机基准价格
  }));
} else {
  // 默认示例股票
  sampleStocks = [
    { code: '600519', name: '贵州茅台', basePrice: 1700 },
    { code: '000858', name: '五粮液', basePrice: 150 },
    { code: '601398', name: '工商银行', basePrice: 5.5 },
    { code: '601318', name: '中国平安', basePrice: 45 },
    { code: '002594', name: '比亚迪', basePrice: 220 },
    { code: '600036', name: '招商银行', basePrice: 35 },
    { code: '601012', name: '隆基绿能', basePrice: 25 },
    { code: '600276', name: '恒瑞医药', basePrice: 45 },
    { code: '000333', name: '美的集团', basePrice: 65 },
    { code: '600050', name: '中国联通', basePrice: 5 },
  ];
}

const outputDir = path.join(__dirname, 'data');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

console.log('生成模拟股票数据...');

sampleStocks.forEach(stock => {
  const candles = generateCandles(60, stock.basePrice);
  const currentPrice = candles[candles.length - 1].close;
  
  const stockData = {
    code: stock.code,
    name: stock.name,
    currentPrice,
    candles,
    volume: candles[candles.length - 1].volume,
    change: ((currentPrice - candles[0].close) / candles[0].close) * 100,
  };
  
  const outputFile = path.join(outputDir, `${stock.code}.json`);
  fs.writeFileSync(outputFile, JSON.stringify(stockData, null, 2));
  console.log(`✓ ${stock.code} ${stock.name} - ¥${currentPrice.toFixed(2)}`);
});

console.log(`\n数据已保存到：${outputDir}`);
console.log(`共生成 ${sampleStocks.length} 只股票，每只 60 天 K 线数据`);
