#!/usr/bin/env node
// 实时交易同步服务
// 每次交易后自动更新 state.json 并触发 GitHub Pages 部署

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const http = require('http');

const STATE_FILE = path.join(__dirname, 'state.json');
const WEB_DIR = path.join(__dirname, 'web');

// 腾讯行情 API（免费实时）
const TENCENT_QUOTE_URL = 'http://qt.gtimg.cn/q=';

class RealtimeSync {
  constructor() {
    this.state = this.loadState();
  }

  /**
   * 获取股票代码对应的腾讯 API 代码
   * 600/688 开头 → sh，其他 → sz
   */
  getMarketCode(stockCode) {
    const code = stockCode.toString();
    if (code.startsWith('600') || code.startsWith('688') || code.startsWith('601')) {
      return 'sh' + code;
    }
    return 'sz' + code;
  }

  /**
   * 从腾讯 API 获取实时行情
   * @param {string[]} stockCodes - 股票代码列表 ['600519', '601318', '600036']
   * @returns {Promise<Object>} - { '600519': { price: 1700, change: 15, changePercent: 0.89 }, ... }
   */
  async fetchQuotes(stockCodes) {
    const queryCodes = stockCodes.map(code => this.getMarketCode(code)).join(',');
    const url = TENCENT_QUOTE_URL + queryCodes;

    return new Promise((resolve, reject) => {
      http.get(url, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const prices = this.parseTencentQuote(data);
            resolve(prices);
          } catch (err) {
            reject(err);
          }
        });
      }).on('error', reject);
    });
  }

  /**
   * 解析腾讯行情返回数据
   * 格式：v_sh600519="51~贵州茅台~600519~1720.50~1705.00~1705.00~..."
   * 第 3 项 (索引 3) = 当前价格
   * 第 31 项 (索引 31) = 涨跌额
   * 第 32 项 (索引 32) = 涨跌幅 (%)
   */
  parseTencentQuote(data) {
    const prices = {};
    const lines = data.split('\n').filter(line => line.trim());

    for (const line of lines) {
      const match = line.match(/v_(sh|sz)(\d+)="([^"]+)"/);
      if (match) {
        const stockCode = match[2];
        const fields = match[3].split('~');
        
        if (fields.length >= 33) {
          prices[stockCode] = {
            price: parseFloat(fields[3]) || 0,
            change: parseFloat(fields[31]) || 0,
            changePercent: parseFloat(fields[32]) || 0,
            open: parseFloat(fields[4]) || 0,
            high: parseFloat(fields[33]) || 0,
            low: parseFloat(fields[34]) || 0,
            volume: parseFloat(fields[36]) || 0,
          };
        }
      }
    }
    return prices;
  }
  
  loadState() {
    try {
      if (fs.existsSync(STATE_FILE)) {
        return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
      }
    } catch (err) {
      console.error('[RealtimeSync] 加载状态失败:', err.message);
    }
    return this.createDefaultState();
  }
  
  createDefaultState() {
    return {
      capital: 10000,
      initialCapital: 10000,
      positions: {},
      tradeHistory: [],
      dailySnapshot: [],
      lastUpdate: new Date().toISOString(),
    };
  }
  
  /**
   * 更新持仓
   */
  updatePosition(stockCode, shares, avgCost, currentPrice) {
    this.state.positions[stockCode] = {
      shares,
      avgCost,
      currentPrice,
    };
    this.state.lastUpdate = new Date().toISOString();
    this.saveState();
  }
  
  /**
   * 添加交易记录
   */
  addTrade(trade) {
    this.state.tradeHistory.push(trade);
    this.state.lastUpdate = new Date().toISOString();
    this.saveState();
  }
  
  /**
   * 更新持仓价格
   */
  updatePrices(prices) {
    // prices: { '600519': 1700, '000858': 155, ... }
    Object.entries(prices).forEach(([code, price]) => {
      if (this.state.positions[code]) {
        this.state.positions[code].currentPrice = price;
      }
    });
    this.state.lastUpdate = new Date().toISOString();
    this.saveState();
  }

  /**
   * 从腾讯 API 同步真实行情价格
   */
  async syncRealtimePrices() {
    const stockCodes = Object.keys(this.state.positions);
    if (stockCodes.length === 0) {
      console.log('[RealtimeSync] 无持仓，跳过行情同步');
      return;
    }

    try {
      console.log('[RealtimeSync] 正在获取腾讯实时行情...', stockCodes.join(', '));
      const quotes = await this.fetchQuotes(stockCodes);
      
      // 更新价格
      Object.entries(quotes).forEach(([code, quote]) => {
        if (this.state.positions[code]) {
          this.state.positions[code].currentPrice = quote.price;
          this.state.positions[code].lastQuote = quote;
        }
      });

      this.state.lastUpdate = new Date().toISOString();
      this.saveState();

      console.log('[RealtimeSync] 行情同步完成，已更新', Object.keys(quotes).length, '只股票');
      return quotes;
    } catch (err) {
      console.error('[RealtimeSync] 获取行情失败:', err.message);
      throw err;
    }
  }
  
  /**
   * 创建每日快照
   */
  createSnapshot() {
    const totalAssets = this.calculateTotalAssets();
    const lastSnapshot = this.state.dailySnapshot[this.state.dailySnapshot.length - 1];
    const dailyReturn = lastSnapshot 
      ? (totalAssets - lastSnapshot.totalAssets) / lastSnapshot.totalAssets 
      : 0;
    const totalReturn = (totalAssets - this.state.initialCapital) / this.state.initialCapital;
    
    const snapshot = {
      date: new Date().toISOString().split('T')[0],
      timestamp: new Date().toISOString(),
      capital: this.state.capital,
      totalAssets,
      dailyReturn,
      totalReturn,
      positionCount: Object.keys(this.state.positions).length,
    };
    
    // 避免重复
    if (!lastSnapshot || lastSnapshot.date !== snapshot.date) {
      this.state.dailySnapshot.push(snapshot);
    }
    
    this.saveState();
    return snapshot;
  }
  
  /**
   * 计算总资产
   */
  calculateTotalAssets() {
    let total = this.state.capital;
    Object.values(this.state.positions).forEach(pos => {
      total += pos.shares * pos.currentPrice;
    });
    return total;
  }
  
  /**
   * 保存状态
   */
  saveState() {
    try {
      fs.writeFileSync(STATE_FILE, JSON.stringify(this.state, null, 2));
      
      // 同步到 web 目录
      const webStateFile = path.join(WEB_DIR, 'state.json');
      fs.copyFileSync(STATE_FILE, webStateFile);
      
      console.log('[RealtimeSync] 状态已保存');
    } catch (err) {
      console.error('[RealtimeSync] 保存状态失败:', err.message);
    }
  }
  
  /**
   * 触发 GitHub Pages 部署
   */
  async triggerDeploy() {
    return new Promise((resolve, reject) => {
      const workspaceDir = path.join(__dirname, '..');
      
      exec(`cd ${workspaceDir} && git add -f investment-simulator/state.json && git commit -m "📊 实时更新交易数据 - ${new Date().toISOString()}" && git push`, 
        (error, stdout, stderr) => {
          if (error) {
            console.error('[RealtimeSync] 触发部署失败:', error.message);
            reject(error);
          } else {
            console.log('[RealtimeSync] ✅ 已触发 GitHub Pages 部署');
            resolve({ stdout, stderr });
          }
        }
      );
    });
  }
  
  /**
   * 执行交易并同步
   */
  async executeTrade(trade) {
    console.log(`\n[RealtimeSync] 执行交易：${trade.type} ${trade.stockCode}`);
    
    // 添加交易记录
    this.addTrade(trade);
    
    // 更新持仓
    if (trade.type === 'BUY') {
      const existingPos = this.state.positions[trade.stockCode];
      if (existingPos) {
        const totalShares = existingPos.shares + trade.shares;
        const totalCost = existingPos.shares * existingPos.avgCost + trade.amount;
        existingPos.avgCost = totalCost / totalShares;
        existingPos.shares = totalShares;
        existingPos.currentPrice = trade.price;
      } else {
        this.state.positions[trade.stockCode] = {
          shares: trade.shares,
          avgCost: (trade.amount + trade.commission) / trade.shares,
          currentPrice: trade.price,
        };
      }
      this.state.capital -= trade.totalCost;
    } else if (trade.type === 'SELL') {
      const pos = this.state.positions[trade.stockCode];
      if (pos) {
        pos.shares -= trade.shares;
        pos.currentPrice = trade.price;
        if (pos.shares <= 0) {
          delete this.state.positions[trade.stockCode];
        }
      }
      this.state.capital += trade.totalReceive;
    }
    
    this.saveState();
    
    // 触发部署
    await this.triggerDeploy();
    
    return true;
  }
  
  /**
   * 获取当前状态
   */
  getState() {
    return {
      ...this.state,
      totalAssets: this.calculateTotalAssets(),
      stats: this.getStats(),
    };
  }
  
  /**
   * 获取统计信息
   */
  getStats() {
    const totalTrades = this.state.tradeHistory.filter(t => t.type === 'SELL').length;
    const winningTrades = this.state.tradeHistory.filter(t => t.type === 'SELL' && t.pnl > 0).length;
    const winRate = totalTrades > 0 ? ((winningTrades / totalTrades) * 100).toFixed(2) : 0;
    const totalAssets = this.calculateTotalAssets();
    const totalReturn = ((totalAssets - this.state.initialCapital) / this.state.initialCapital * 100).toFixed(2);
    
    return {
      totalTrades,
      winningTrades,
      winRate,
      totalReturn,
      totalAssets,
    };
  }
}

// CLI 使用
if (require.main === module) {
  const sync = new RealtimeSync();
  
  const args = process.argv.slice(2);
  
  if (args[0] === 'status') {
    console.log(JSON.stringify(sync.getState(), null, 2));
  } else if (args[0] === 'snapshot') {
    const snapshot = sync.createSnapshot();
    console.log('📊 每日快照:', snapshot);
  } else if (args[0] === 'deploy') {
    sync.triggerDeploy();
  } else if (args[0] === 'sync') {
    // 从腾讯 API 同步真实行情
    sync.syncRealtimePrices()
      .then(quotes => {
        console.log('\n📈 实时行情:');
        Object.entries(quotes).forEach(([code, q]) => {
          const pos = sync.state.positions[code];
          const pnl = (q.price - pos.avgCost) * pos.shares;
          const pnlPercent = ((q.price - pos.avgCost) / pos.avgCost * 100).toFixed(2);
          console.log(`  ${code} ${pos.name}: ¥${q.price}  涨跌：${q.change > 0 ? '+' : ''}${q.change} (${q.changePercent}%)  持仓盈亏：${pnl > 0 ? '+' : ''}${pnl.toFixed(2)} (${pnlPercent}%)`);
        });
        const totalAssets = sync.calculateTotalAssets();
        const totalReturn = ((totalAssets - sync.state.initialCapital) / sync.state.initialCapital * 100).toFixed(2);
        console.log(`\n💰 总资产：¥${totalAssets.toFixed(2)}  总收益：${totalReturn}%`);
      })
      .catch(err => {
        console.error('同步失败:', err.message);
        process.exit(1);
      });
  } else {
    console.log('用法：node realtime-sync.js [status|snapshot|deploy|sync]');
  }
}

module.exports = RealtimeSync;
