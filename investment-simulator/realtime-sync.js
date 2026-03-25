#!/usr/bin/env node
// 实时交易同步服务
// 每次交易后自动更新 state.json 并触发 GitHub Pages 部署

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const STATE_FILE = path.join(__dirname, 'state.json');
const WEB_DIR = path.join(__dirname, 'web');

class RealtimeSync {
  constructor() {
    this.state = this.loadState();
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
  } else {
    console.log('用法：node realtime-sync.js [status|snapshot|deploy]');
  }
}

module.exports = RealtimeSync;
