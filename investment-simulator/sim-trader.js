#!/usr/bin/env node
// 模拟交易主程序

const fs = require('fs');
const path = require('path');
const TradingEngine = require('./trading-engine');
const { makeDecision } = require('./strategy');
const config = require('./config');

class SimTrader {
  constructor() {
    this.dataDir = config.dataSource.dataDir;
    this.watchlist = this.loadWatchlist();
    this.engine = new TradingEngine();
  }
  
  /**
   * 加载股票池
   */
  loadWatchlist() {
    try {
      const watchlistFile = path.join(this.dataDir, 'stock-watchlist.js');
      if (fs.existsSync(watchlistFile)) {
        const watchlist = require(watchlistFile);
        // 支持多种导出格式
        return watchlist.WATCH_LIST || watchlist.stocks || watchlist.default || watchlist || [];
      }
    } catch (err) {
      console.error('[SimTrader] 加载股票池失败:', err.message);
    }
    return [];
  }
  
  /**
   * 加载股票数据
   */
  loadStockData(stockCode) {
    try {
      // 优先从本地数据目录加载
      const localDataFile = path.join(__dirname, 'data', `${stockCode}.json`);
      if (fs.existsSync(localDataFile)) {
        const data = JSON.parse(fs.readFileSync(localDataFile, 'utf8'));
        return data;
      }
      
      // 尝试从主数据目录加载
      const dataFile = path.join(this.dataDir, `${stockCode}.json`);
      if (fs.existsSync(dataFile)) {
        const data = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
        return data;
      }
      
      // 尝试从 entry signals 文件加载
      const signalsFile = path.join(this.dataDir, 'stock-entry-signals.json');
      if (fs.existsSync(signalsFile)) {
        const signalsContent = fs.readFileSync(signalsFile, 'utf8');
        const signals = JSON.parse(signalsContent);
        const stockData = Array.isArray(signals) ? signals.find(s => s.code === stockCode) : null;
        if (stockData) {
          return {
            code: stockData.code,
            name: stockData.name,
            currentPrice: stockData.price,
            candles: stockData.candles || [],
            volume: stockData.volume || 0,
          };
        }
      }
    } catch (err) {
      console.error(`[SimTrader] 加载${stockCode}数据失败:`, err.message);
    }
    return null;
  }
  
  /**
   * 执行单只股票的交易决策
   */
  executeDecision(stockCode) {
    const stockData = this.loadStockData(stockCode);
    if (!stockData || !stockData.candles || stockData.candles.length < 30) {
      console.log(`[SimTrader] ${stockCode} 数据不足，跳过`);
      return null;
    }
    
    const currentPrice = stockData.currentPrice || stockData.candles[stockData.candles.length - 1].close;
    
    // 获取交易决策
    const decision = makeDecision(
      { ...stockData, currentPrice },
      this.engine,
      stockCode
    );
    
    console.log(`\n[${stockCode}] 决策：${decision.action} (置信度：${(decision.confidence * 100).toFixed(0)}%)`);
    console.log(`  原因：${decision.reason}`);
    
    // 执行交易
    let result = null;
    if (decision.action === 'BUY' && decision.targetShares) {
      result = this.engine.buy(
        stockCode,
        currentPrice,
        decision.targetShares,
        decision.reason
      );
    } else if (decision.action === 'SELL' && decision.targetShares) {
      result = this.engine.sell(
        stockCode,
        currentPrice,
        decision.targetShares,
        decision.reason
      );
    }
    
    // 更新持仓价格
    if (this.engine.positions[stockCode]) {
      this.engine.updatePositionPrice(stockCode, currentPrice);
    }
    
    return {
      stockCode,
      currentPrice,
      decision,
      result,
    };
  }
  
  /**
   * 运行一轮交易
   */
  runTradingCycle() {
    console.log('\n' + '='.repeat(60));
    console.log(`[SimTrader] 开始交易循环 - ${new Date().toISOString()}`);
    console.log('='.repeat(60));
    
    const results = [];
    
    // 遍历股票池
    for (const stock of this.watchlist) {
      const code = stock.code || stock;
      console.log(`\n分析：${code}`);
      const result = this.executeDecision(code);
      if (result) {
        results.push(result);
      }
      
      // 避免过快请求
      // if (this.watchlist.length > 1) {
      //   await sleep(100);
      // }
    }
    
    // 创建每日快照
    const currentPrices = {};
    results.forEach(r => {
      if (r.currentPrice) {
        currentPrices[r.stockCode] = r.currentPrice;
      }
    });
    
    const snapshot = this.engine.createDailySnapshot(currentPrices);
    
    // 保存状态
    this.engine.saveData();
    
    // 输出统计
    console.log('\n' + '='.repeat(60));
    console.log('[SimTrader] 交易循环完成');
    console.log('='.repeat(60));
    this.printStats();
    
    return {
      results,
      snapshot,
      stats: this.engine.getStats(),
    };
  }
  
  /**
   * 打印统计信息
   */
  printStats() {
    const stats = this.engine.getStats();
    console.log('\n📊 投资统计');
    console.log('-'.repeat(40));
    console.log(`初始资金：¥${stats.initialCapital.toFixed(2)}`);
    console.log(`当前总资产：¥${stats.currentAssets.toFixed(2)}`);
    console.log(`总收益率：${stats.totalReturn}%`);
    console.log(`交易次数：${stats.totalTrades}`);
    console.log(`胜率：${stats.winRate}%`);
    console.log(`持仓数量：${stats.positionCount}`);
    console.log(`总手续费：¥${stats.totalCommission}`);
  }
  
  /**
   * 获取完整状态（用于网页）
   */
  getState() {
    return this.engine.getState();
  }
  
  /**
   * 导出状态到 JSON（用于网页）
   */
  exportState() {
    const state = this.getState();
    const outputFile = path.join(__dirname, 'state.json');
    fs.writeFileSync(outputFile, JSON.stringify(state, null, 2));
    console.log(`[SimTrader] 状态已导出到：${outputFile}`);
    return state;
  }
}

// CLI 执行
if (require.main === module) {
  const trader = new SimTrader();
  
  const args = process.argv.slice(2);
  
  if (args.includes('--export') || args.includes('-e')) {
    trader.exportState();
  } else if (args.includes('--stats') || args.includes('-s')) {
    trader.printStats();
  } else if (args.includes('--help') || args.includes('-h')) {
    console.log('用法：node sim-trader.js [选项]');
    console.log('选项:');
    console.log('  --export, -e    导出状态到 JSON');
    console.log('  --stats, -s     显示统计信息');
    console.log('  --help, -h      显示帮助');
    console.log('  (无参数)        运行交易循环');
  } else {
    // 运行交易循环
    trader.runTradingCycle();
    trader.exportState();
  }
}

module.exports = SimTrader;
