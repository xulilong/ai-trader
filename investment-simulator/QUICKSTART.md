# 🚀 模拟投资系统 - 快速上手指南

龙哥，你的模拟投资系统已经准备好了！

## ✅ 当前状态

- **初始资金**: ¥10,000
- **系统位置**: `/workspace/investment-simulator/`
- **Web 服务**: http://localhost:3000
- **股票池**: 100+ 只 A 股龙头股
- **技术指标**: MACD, RSI, KDJ, 布林带，均线

## 📊 查看交易面板

### 方式 1: 本地浏览器
```
http://localhost:3000
```

### 方式 2: 在飞书中打开
如果服务器在远程，使用端口转发或内网穿透访问

## 🎯 核心功能

### 1. 自动交易
```bash
cd /workspace/investment-simulator
./start.sh trade
```

系统会：
- 分析股票池中所有股票
- 根据技术指标生成买卖信号
- 自动执行交易（模拟）
- 更新持仓和资金曲线

### 2. 查看实时状态
访问网页查看：
- 📈 总资产和收益率
- 💼 当前持仓明细
- 📝 交易历史记录
- 📊 资金曲线图

### 3. 调整策略
编辑 `config.js`:
```javascript
{
  risk: {
    stopLossPercent: 0.08,    // 止损 8%
    takeProfitPercent: 0.20,  // 止盈 20%
  },
  trading: {
    maxPositionPercent: 0.3,  // 单只股票最多 30% 仓位
  }
}
```

## 🔄 自动化建议

### 添加到 HEARTBEAT.md
```markdown
## 股票交易

- [ ] 每日 9:25 执行 `cd /workspace/investment-simulator && ./start.sh trade`
- [ ] 监控持仓止损止盈
- [ ] 查看网页面板更新
```

### 或使用 cron
```bash
# 每个交易日 9:25 执行
25 9 * * 1-5 cd /workspace/investment-simulator && ./start.sh trade
```

## 📈 交易策略说明

### 买入信号（综合评分 >= 2）
- ✅ 多头排列（5 日>10 日>20 日均线）
- ✅ RSI 超卖 (<30)
- ✅ MACD 金叉
- ✅ 突破 20 日高点
- ✅ KDJ 低位

### 卖出信号（综合评分 <= -2 或触发风控）
- ❌ 触发止损 (-8%)
- ❌ 触发止盈 (+20%)
- ❌ 空头排列
- ❌ RSI 超买 (>70)
- ❌ MACD 死叉

## 🎮 使用示例

### 第一次运行
```bash
cd /workspace/investment-simulator

# 1. 生成股票数据（如果还没有）
node sample-data.js

# 2. 执行交易
./start.sh trade

# 3. 启动网页（后台运行）
./start.sh server &

# 4. 访问 http://localhost:3000
```

### 日常使用
```bash
# 一键完成交易 + 启动网页
./start.sh all
```

## 📁 重要文件

| 文件 | 说明 |
|------|------|
| `config.js` | 系统配置（止损、仓位等）|
| `state.json` | 当前状态（自动保存）|
| `data/*.json` | 股票 K 线数据 |
| `web/index.html` | 网页面板 |

## 🔧 常见问题

### Q: 如何重置系统？
```bash
rm state.json
node sim-trader.js  # 重新从 10000 开始
```

### Q: 如何添加新股票？
编辑 `/workspace/data/stock-watchlist.js` 添加股票代码

### Q: 如何修改初始资金？
编辑 `config.js` 中的 `initialCapital`

### Q: 网页不更新？
- 刷新浏览器（Ctrl+F5）
- 重新执行 `./start.sh trade` 生成新数据

## 💡 下一步优化

1. **接入真实数据**: 替换模拟数据为实时股票 API
2. **更多策略**: 添加量化策略（网格、轮动等）
3. **回测功能**: 历史数据回测策略表现
4. **消息通知**: 交易时发送飞书通知
5. **风险控制**: 添加大盘风控、行业风控

---

**有任何问题随时问我！** 🦞

系统已经运行，访问 http://localhost:3000 查看你的投资面板！
