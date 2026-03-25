# 🦞 龙哥的模拟投资系统

> 基于技术指标的自动化模拟交易平台  
> 初始资金：¥10,000（虚拟）

## 📍 系统位置

```
/workspace/investment-simulator/
```

## 🌐 访问面板

**Web 界面**: http://localhost:3000

## 🚀 快速命令

```bash
# 执行交易循环
cd /workspace/investment-simulator && ./start.sh trade

# 启动 Web 服务器
./start.sh server

# 一键完成（交易 + 网页）
./start.sh all

# 查看统计
./start.sh stats
```

## 📊 核心功能

| 功能 | 说明 |
|------|------|
| 技术分析 | MACD、RSI、KDJ、布林带、均线系统 |
| 交易策略 | 趋势跟踪、均值回归、突破策略 |
| 风险管理 | 止损 8%、止盈 20%、最大仓位 30% |
| 自动交易 | 基于信号自动执行买卖 |
| 交易记录 | 完整的交易历史和盈亏统计 |
| 网页展示 | 实时资金曲线、持仓明细 |

## 📈 交易逻辑

### 买入条件（综合评分 >= 2）
- 多头排列（均线向上）
- RSI 超卖 (<30)
- MACD 金叉
- 突破 20 日高点
- KDJ 低位

### 卖出条件（综合评分 <= -2 或触发风控）
- 触发止损 (-8%)
- 触发止盈 (+20%)
- 空头排列（均线向下）
- RSI 超买 (>70)
- MACD 死叉

## ⚙️ 配置参数

编辑 `/workspace/investment-simulator/config.js`:

```javascript
{
  initialCapital: 10000,        // 初始资金
  risk: {
    stopLossPercent: 0.08,      // 止损 8%
    takeProfitPercent: 0.20,    // 止盈 20%
    maxHoldings: 5,             // 最多 5 只股票
  },
  trading: {
    maxPositionPercent: 0.3,    // 单笔最大 30% 仓位
    commissionRate: 0.00025,    // 手续费万分之 2.5
  }
}
```

## 📁 文件结构

```
investment-simulator/
├── config.js              # 配置
├── indicators.js          # 技术指标
├── strategy.js            # 交易策略
├── trading-engine.js      # 交易引擎
├── sim-trader.js          # 主程序
├── server.js              # Web 服务器
├── start.sh               # 启动脚本
├── state.json             # 当前状态
├── sample-data.js         # 数据生成器
├── README.md              # 详细文档
├── QUICKSTART.md          # 快速上手
├── web/
│   └── index.html         # 网页界面
└── data/                  # 股票数据
    ├── 600519.json        # 贵州茅台
    ├── 000858.json        # 五粮液
    └── ...
```

## 🔄 自动化建议

### 添加到 HEARTBEAT.md
```markdown
## 股票交易

- [ ] 每日 9:25 执行交易循环
- [ ] 监控持仓止损止盈
- [ ] 查看网页面板
```

### 或使用 cron
```bash
# 每个交易日 9:25 执行
25 9 * * 1-5 cd /workspace/investment-simulator && ./start.sh trade
```

## 📝 下一步优化

1. **接入真实数据**: 使用新浪财经/腾讯财经 API
2. **更多策略**: 网格交易、行业轮动
3. **回测功能**: 历史数据验证策略
4. **消息通知**: 交易时发送飞书消息
5. **风险控制**: 大盘风控、行业分散

---

**开发**: AI 操盘手  
**用户**: 龙哥  
**版本**: 1.0.0  
**最后更新**: 2026-03-25
