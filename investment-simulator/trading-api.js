#!/usr/bin/env node
// 交易 API 服务器 - 提供 RESTful 接口

const http = require('http');
const fs = require('fs');
const path = require('path');
const RealtimeSync = require('./realtime-sync');
const TradingEngine = require('./trading-engine');
const { makeDecision } = require('./strategy');

const PORT = process.env.PORT || 3001;
const STATE_FILE = path.join(__dirname, 'state.json');

const sync = new RealtimeSync();

// CORS 头
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
};

// API 路由处理
const routes = {
  // 获取当前状态
  'GET /api/state': () => {
    return sync.getState();
  },
  
  // 获取持仓
  'GET /api/positions': () => {
    return { positions: sync.state.positions };
  },
  
  // 获取交易历史
  'GET /api/trades': () => {
    return { trades: sync.state.tradeHistory.slice(-50).reverse() };
  },
  
  // 获取每日快照
  'GET /api/snapshots': () => {
    return { snapshots: sync.state.dailySnapshot };
  },
  
  // 执行交易
  'POST /api/trade': async (body) => {
    const { type, stockCode, price, shares, reason } = body;
    
    if (!type || !stockCode || !price || !shares) {
      throw new Error('缺少必要参数');
    }
    
    const trade = {
      id: `T${Date.now()}`,
      type,
      stockCode,
      price: parseFloat(price),
      shares: parseInt(shares),
      amount: parseFloat(price) * parseInt(shares),
      commission: parseFloat(price) * parseInt(shares) * 0.00025,
      timestamp: new Date().toISOString(),
      reason: reason || '',
    };
    
    // 计算总金额
    if (type === 'BUY') {
      trade.totalCost = trade.amount + trade.commission;
    } else if (type === 'SELL') {
      trade.stampTax = trade.amount * 0.0005;
      trade.totalReceive = trade.amount - trade.commission - trade.stampTax;
      // 计算盈亏
      const pos = sync.state.positions[stockCode];
      if (pos) {
        trade.pnl = trade.amount - (shares * pos.avgCost) - trade.commission - trade.stampTax;
        trade.pnlPercent = (trade.pnl / (shares * pos.avgCost)) * 100;
      }
    }
    
    await sync.executeTrade(trade);
    
    return { success: true, trade };
  },
  
  // 更新价格
  'POST /api/prices': (body) => {
    const { prices } = body; // { '600519': 1700, ... }
    if (!prices) {
      throw new Error('缺少价格数据');
    }
    sync.updatePrices(prices);
    return { success: true };
  },
  
  // 执行交易决策
  'POST /api/execute': async (body) => {
    const { stockCode } = body;
    if (!stockCode) {
      throw new Error('缺少股票代码');
    }
    
    // 加载股票数据
    const dataDir = path.join(__dirname, 'data');
    const dataFile = path.join(dataDir, `${stockCode}.json`);
    
    if (!fs.existsSync(dataFile)) {
      throw new Error('股票数据不存在');
    }
    
    const stockData = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
    const currentPrice = stockData.currentPrice;
    
    // 创建临时引擎获取决策
    const engine = new TradingEngine();
    // 使用 sync 的状态
    engine.positions = sync.state.positions;
    engine.capital = sync.state.capital;
    
    const decision = makeDecision(stockData, engine, stockCode);
    
    if (decision.action === 'HOLD') {
      return { success: false, reason: '无交易信号', decision };
    }
    
    // 执行交易
    const trade = {
      id: `T${Date.now()}`,
      type: decision.action,
      stockCode,
      price: currentPrice,
      shares: decision.targetShares || 0,
      amount: currentPrice * (decision.targetShares || 0),
      commission: currentPrice * (decision.targetShares || 0) * 0.00025,
      timestamp: new Date().toISOString(),
      reason: decision.reason,
    };
    
    if (decision.action === 'BUY') {
      trade.totalCost = trade.amount + trade.commission;
    } else {
      const pos = sync.state.positions[stockCode];
      if (pos) {
        trade.stampTax = trade.amount * 0.0005;
        trade.totalReceive = trade.amount - trade.commission - trade.stampTax;
        trade.pnl = trade.amount - (trade.shares * pos.avgCost) - trade.commission - trade.stampTax;
        trade.pnlPercent = (trade.pnl / (trade.shares * pos.avgCost)) * 100;
      }
    }
    
    await sync.executeTrade(trade);
    
    return { success: true, trade, decision };
  },
  
  // 创建快照
  'POST /api/snapshot': () => {
    const snapshot = sync.createSnapshot();
    return { success: true, snapshot };
  },
  
  // 重置状态
  'POST /api/reset': () => {
    sync.state = sync.createDefaultState();
    sync.saveState();
    return { success: true };
  },
};

const server = http.createServer(async (req, res) => {
  const url = req.url;
  const method = req.method;
  
  // CORS 预检
  if (method === 'OPTIONS') {
    res.writeHead(200, corsHeaders);
    res.end();
    return;
  }
  
  // 查找路由
  const routeKey = `${method} ${url}`;
  const handler = routes[routeKey];
  
  if (!handler) {
    // 静态文件服务
    if (url.startsWith('/web/')) {
      const filePath = path.join(__dirname, url.replace('/web', 'web'));
      if (fs.existsSync(filePath)) {
        const ext = path.extname(filePath);
        const mimeTypes = {
          '.html': 'text/html',
          '.js': 'text/javascript',
          '.css': 'text/css',
          '.json': 'application/json',
          '.png': 'image/png',
        };
        res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'text/plain' });
        res.end(fs.readFileSync(filePath));
        return;
      }
    }
    
    res.writeHead(404, corsHeaders);
    res.end(JSON.stringify({ error: 'Not found' }));
    return;
  }
  
  try {
    // 读取请求体
    let body = {};
    if (method === 'POST' || method === 'PUT') {
      body = await new Promise((resolve, reject) => {
        let data = '';
        req.on('data', chunk => data += chunk);
        req.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(e);
          }
        });
        req.on('error', reject);
      });
    }
    
    // 执行处理
    const result = await handler(body);
    
    res.writeHead(200, corsHeaders);
    res.end(JSON.stringify(result));
  } catch (err) {
    console.error('[API Error]', err.message);
    res.writeHead(400, corsHeaders);
    res.end(JSON.stringify({ error: err.message }));
  }
});

server.listen(PORT, () => {
  console.log('='.repeat(60));
  console.log('🦞 交易 API 服务器已启动');
  console.log('='.repeat(60));
  console.log(`📊 API 地址：http://localhost:${PORT}`);
  console.log('\n可用接口:');
  console.log('  GET  /api/state      - 获取当前状态');
  console.log('  GET  /api/positions  - 获取持仓');
  console.log('  GET  /api/trades     - 获取交易历史');
  console.log('  POST /api/trade      - 执行交易');
  console.log('  POST /api/prices     - 更新价格');
  console.log('  POST /api/execute    - 执行交易决策');
  console.log('  POST /api/snapshot   - 创建快照');
  console.log('  POST /api/reset      - 重置状态');
  console.log('='.repeat(60));
});
