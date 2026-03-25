// 模拟投资系统配置

module.exports = {
  // 初始资金
  initialCapital: 10000,
  
  // 交易配置
  trading: {
    // 单笔最大仓位（占总资金比例）
    maxPositionPercent: 0.3,
    // 最小交易金额
    minTradeAmount: 100,
    // 交易手续费（万分之 2.5）
    commissionRate: 0.00025,
    // 印花税（卖出时千分之 0.5）
    stampTaxRate: 0.0005,
  },
  
  // 风险控制 - 激进模式（翻倍挑战）
  risk: {
    // 单只股票最大亏损比例（止损）- 更紧
    stopLossPercent: 0.05,
    // 单只股票最大盈利比例（止盈）- 快速获利
    takeProfitPercent: 0.15,
    // 总资金最大回撤
    maxDrawdown: 0.20,
    // 同时持有最大股票数
    maxHoldings: 5,
  },
  
  // 技术指标参数
  indicators: {
    // MACD
    macd: { fast: 12, slow: 26, signal: 9 },
    // RSI
    rsi: { period: 14, oversold: 30, overbought: 70 },
    // KDJ
    kdj: { n: 9, m1: 3, m2: 3 },
    // 布林带
    bollinger: { period: 20, stdDev: 2 },
    // 均线
    ma: { short: 5, medium: 10, long: 20 },
  },
  
  // 数据源
  dataSource: {
    // 股票数据目录
    dataDir: '/home/node/.openclaw/workspace/data',
    // 缓存目录
    cacheDir: '/home/node/.openclaw/workspace/investment-simulator/cache',
  },
  
  // 运行模式
  mode: {
    // 模拟模式：'backtest'回测 / 'paper'纸面交易 / 'live'实时
    type: 'paper',
    // 交易时间检查
    checkTradingHours: true,
    // 自动执行交易
    autoExecute: true,
  },
  
  // 通知配置
  notification: {
    // 飞书通知
    enabled: true,
    // 通知类型：'all'所有 / 'trade'仅交易 / 'alert'仅告警
    level: 'trade',
  },
};
