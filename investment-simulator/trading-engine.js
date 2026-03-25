// 交易引擎 - 核心执行模块

const fs = require('fs');
const path = require('path');
const config = require('./config');

class TradingEngine {
  constructor() {
    this.capital = config.initialCapital;
    this.initialCapital = config.initialCapital;
    this.positions = {}; // { stockCode: { shares, avgCost, currentPrice } }
    this.orders = [];
    this.tradeHistory = [];
    this.dailySnapshot = [];
    this.dataDir = config.dataSource.dataDir;
    this.simDir = path.dirname(__filename);
    
    this.loadData();
  }
  
  /**
   * 加载保存的数据
   */
  loadData() {
    try {
      const stateFile = path.join(this.simDir, 'state.json');
      if (fs.existsSync(stateFile)) {
        const state = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
        this.capital = state.capital || config.initialCapital;
        this.positions = state.positions || {};
        this.tradeHistory = state.tradeHistory || [];
        this.dailySnapshot = state.dailySnapshot || [];
        console.log(`[交易引擎] 加载状态成功，当前资金：${this.capital.toFixed(2)}`);
      }
    } catch (err) {
      console.error('[交易引擎] 加载状态失败:', err.message);
    }
  }
  
  /**
   * 保存当前状态
   */
  saveData() {
    try {
      const state = {
        capital: this.capital,
        positions: this.positions,
        tradeHistory: this.tradeHistory,
        dailySnapshot: this.dailySnapshot,
        lastUpdate: new Date().toISOString(),
      };
      const stateFile = path.join(this.simDir, 'state.json');
      fs.writeFileSync(stateFile, JSON.stringify(state, null, 2));
    } catch (err) {
      console.error('[交易引擎] 保存状态失败:', err.message);
    }
  }
  
  /**
   * 获取可用资金
   */
  getAvailableCapital() {
    let locked = 0;
    Object.values(this.positions).forEach(pos => {
      locked += pos.shares * pos.avgCost;
    });
    return this.capital - locked;
  }
  
  /**
   * 获取总资产（含持仓市值）
   */
  getTotalAssets(currentPrices = {}) {
    let total = this.capital;
    Object.entries(this.positions).forEach(([code, pos]) => {
      const price = currentPrices[code] || pos.currentPrice || pos.avgCost;
      const marketValue = pos.shares * price;
      const cost = pos.shares * pos.avgCost;
      total += marketValue - cost;
    });
    return total;
  }
  
  /**
   * 计算持仓盈亏
   */
  getPositionPnL(code, currentPrice) {
    const pos = this.positions[code];
    if (!pos) return null;
    
    const marketValue = pos.shares * currentPrice;
    const cost = pos.shares * pos.avgCost;
    const pnl = marketValue - cost;
    const pnlPercent = (pnl / cost) * 100;
    
    return {
      code,
      shares: pos.shares,
      avgCost: pos.avgCost,
      currentPrice,
      marketValue,
      cost,
      pnl,
      pnlPercent,
    };
  }
  
  /**
   * 买入操作
   */
  buy(stockCode, price, shares, reason = '') {
    const amount = price * shares;
    const commission = amount * config.trading.commissionRate;
    const totalCost = amount + commission;
    
    // 检查资金
    if (totalCost > this.getAvailableCapital()) {
      return { success: false, error: '资金不足' };
    }
    
    // 检查最小交易金额
    if (amount < config.trading.minTradeAmount) {
      return { success: false, error: '低于最小交易金额' };
    }
    
    // 检查持仓数量
    if (Object.keys(this.positions).length >= config.risk.maxHoldings && !this.positions[stockCode]) {
      return { success: false, error: '已达最大持仓数量' };
    }
    
    // 执行买入
    const trade = {
      id: `T${Date.now()}`,
      type: 'BUY',
      stockCode,
      price,
      shares,
      amount,
      commission,
      totalCost,
      timestamp: new Date().toISOString(),
      reason,
    };
    
    // 更新持仓
    if (this.positions[stockCode]) {
      const pos = this.positions[stockCode];
      const totalShares = pos.shares + shares;
      const totalCost = pos.shares * pos.avgCost + amount + commission;
      pos.avgCost = totalCost / totalShares;
      pos.shares = totalShares;
      pos.currentPrice = price;
    } else {
      this.positions[stockCode] = {
        shares,
        avgCost: (amount + commission) / shares,
        currentPrice: price,
      };
    }
    
    // 扣除资金
    this.capital -= totalCost;
    
    // 记录交易
    this.tradeHistory.push(trade);
    this.orders.push(trade);
    
    console.log(`[买入] ${stockCode} @${price} x${shares} = ${amount.toFixed(2)} (手续费：${commission.toFixed(2)})`);
    
    return { success: true, trade };
  }
  
  /**
   * 卖出操作
   */
  sell(stockCode, price, shares, reason = '') {
    const pos = this.positions[stockCode];
    if (!pos) {
      return { success: false, error: '无此持仓' };
    }
    
    if (shares > pos.shares) {
      return { success: false, error: '持仓不足' };
    }
    
    const amount = price * shares;
    const commission = amount * config.trading.commissionRate;
    const stampTax = amount * config.trading.stampTaxRate;
    const totalReceive = amount - commission - stampTax;
    
    // 计算盈亏
    const cost = shares * pos.avgCost;
    const pnl = amount - cost - commission - stampTax;
    const pnlPercent = (pnl / cost) * 100;
    
    // 执行卖出
    const trade = {
      id: `T${Date.now()}`,
      type: 'SELL',
      stockCode,
      price,
      shares,
      amount,
      commission,
      stampTax,
      totalReceive,
      pnl,
      pnlPercent,
      timestamp: new Date().toISOString(),
      reason,
    };
    
    // 更新持仓
    pos.shares -= shares;
    pos.currentPrice = price;
    
    if (pos.shares <= 0) {
      delete this.positions[stockCode];
    }
    
    // 增加资金
    this.capital += totalReceive;
    
    // 记录交易
    this.tradeHistory.push(trade);
    this.orders.push(trade);
    
    console.log(`[卖出] ${stockCode} @${price} x${shares} = ${amount.toFixed(2)} (盈亏：${pnl.toFixed(2)}, ${pnlPercent.toFixed(2)}%)`);
    
    return { success: true, trade };
  }
  
  /**
   * 检查止损止盈
   */
  checkStopLossTakeProfit(stockCode, currentPrice) {
    const pos = this.positions[stockCode];
    if (!pos) return null;
    
    const pnlPercent = (currentPrice - pos.avgCost) / pos.avgCost;
    
    // 止损检查
    if (pnlPercent <= -config.risk.stopLossPercent) {
      return {
        action: 'SELL',
        reason: `止损 (${(pnlPercent * 100).toFixed(2)}%)`,
        urgency: 'high',
      };
    }
    
    // 止盈检查
    if (pnlPercent >= config.risk.takeProfitPercent) {
      return {
        action: 'SELL',
        reason: `止盈 (${(pnlPercent * 100).toFixed(2)}%)`,
        urgency: 'medium',
      };
    }
    
    return null;
  }
  
  /**
   * 更新持仓价格
   */
  updatePositionPrice(stockCode, price) {
    if (this.positions[stockCode]) {
      this.positions[stockCode].currentPrice = price;
    }
  }
  
  /**
   * 创建每日快照
   */
  createDailySnapshot(currentPrices = {}) {
    const totalAssets = this.getTotalAssets(currentPrices);
    const dailyReturn = this.dailySnapshot.length > 0
      ? (totalAssets - this.dailySnapshot[this.dailySnapshot.length - 1].totalAssets) / this.dailySnapshot[this.dailySnapshot.length - 1].totalAssets
      : 0;
    
    const snapshot = {
      date: new Date().toISOString().split('T')[0],
      timestamp: new Date().toISOString(),
      capital: this.capital,
      totalAssets,
      dailyReturn,
      totalReturn: (totalAssets - this.initialCapital) / this.initialCapital,
      positions: Object.entries(this.positions).map(([code, pos]) => ({
        code,
        shares: pos.shares,
        avgCost: pos.avgCost,
        currentPrice: currentPrices[code] || pos.currentPrice,
        marketValue: pos.shares * (currentPrices[code] || pos.currentPrice),
        pnlPercent: ((currentPrices[code] || pos.currentPrice) - pos.avgCost) / pos.avgCost,
      })),
      positionCount: Object.keys(this.positions).length,
    };
    
    // 避免重复
    const lastSnapshot = this.dailySnapshot[this.dailySnapshot.length - 1];
    if (!lastSnapshot || lastSnapshot.date !== snapshot.date) {
      this.dailySnapshot.push(snapshot);
    }
    
    this.saveData();
    return snapshot;
  }
  
  /**
   * 获取交易统计
   */
  getStats() {
    const totalTrades = this.tradeHistory.filter(t => t.type === 'SELL').length;
    const winningTrades = this.tradeHistory.filter(t => t.type === 'SELL' && t.pnl > 0).length;
    const losingTrades = this.tradeHistory.filter(t => t.type === 'SELL' && t.pnl <= 0).length;
    
    const totalPnl = this.tradeHistory
      .filter(t => t.type === 'SELL')
      .reduce((sum, t) => sum + t.pnl, 0);
    
    const totalCommission = this.tradeHistory
      .reduce((sum, t) => sum + t.commission + (t.stampTax || 0), 0);
    
    const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;
    
    const currentAssets = this.getTotalAssets();
    const totalReturn = ((currentAssets - this.initialCapital) / this.initialCapital) * 100;
    
    return {
      initialCapital: this.initialCapital,
      currentCapital: this.capital,
      currentAssets,
      totalReturn: totalReturn.toFixed(2),
      totalTrades,
      winningTrades,
      losingTrades,
      winRate: winRate.toFixed(2),
      totalPnl: totalPnl.toFixed(2),
      totalCommission: totalCommission.toFixed(2),
      positionCount: Object.keys(this.positions).length,
      tradeHistoryLength: this.tradeHistory.length,
    };
  }
  
  /**
   * 获取完整状态（用于网页展示）
   */
  getState() {
    return {
      config: {
        initialCapital: config.initialCapital,
        risk: config.risk,
        trading: config.trading,
      },
      stats: this.getStats(),
      positions: Object.entries(this.positions).map(([code, pos]) => ({
        code,
        shares: pos.shares,
        avgCost: pos.avgCost,
        currentPrice: pos.currentPrice,
        marketValue: pos.shares * pos.currentPrice,
        pnl: (pos.currentPrice - pos.avgCost) * pos.shares,
        pnlPercent: ((pos.currentPrice - pos.avgCost) / pos.avgCost) * 100,
      })),
      recentTrades: this.tradeHistory.slice(-20).reverse(),
      dailySnapshot: this.dailySnapshot.slice(-30),
      lastUpdate: new Date().toISOString(),
    };
  }
}

module.exports = TradingEngine;
