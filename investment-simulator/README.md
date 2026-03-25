# 🦞 模拟投资系统

龙哥的 AI 操盘手 - 基于技术指标的自动化模拟交易平台

## 📋 功能特性

### 核心功能
- ✅ **初始资金**: ¥10,000 虚拟资金
- ✅ **技术分析**: MACD、RSI、KDJ、布林带、均线系统
- ✅ **交易策略**: 趋势跟踪、均值回归、突破策略
- ✅ **风险管理**: 止损止盈、仓位控制、最大持仓限制
- ✅ **自动交易**: 基于信号自动执行买卖
- ✅ **交易记录**: 完整的交易历史和盈亏统计
- ✅ **网页展示**: 实时资金曲线、持仓明细、交易记录

### 技术指标
| 指标 | 参数 | 说明 |
|------|------|------|
| MACD | 12/26/9 | 趋势动能指标 |
| RSI | 14 | 超买超卖指标 |
| KDJ | 9/3/3 | 随机指标 |
| 布林带 | 20/2 | 波动率通道 |
| 均线 | 5/10/20 | 短期趋势 |

### 风险控制
- 单笔最大仓位：30%
- 止损线：-8%
- 止盈线：+20%
- 最大回撤：15%
- 同时持仓：最多 5 只股票
- 交易手续费：万分之 2.5

## 🚀 快速开始

### 1. 执行交易循环
```bash
cd /home/node/.openclaw/workspace/investment-simulator
./start.sh trade
```

### 2. 启动 Web 服务器
```bash
./start.sh server
```

访问：http://localhost:3000

### 3. 一键启动（交易 + 网页）
```bash
./start.sh all
```

## 📁 文件结构

```
investment-simulator/
├── config.js           # 系统配置
├── indicators.js       # 技术指标计算
├── strategy.js         # 交易策略
├── trading-engine.js   # 交易引擎
├── sim-trader.js       # 主程序
├── server.js           # Web 服务器
├── start.sh            # 启动脚本
├── state.json          # 当前状态（自动生成）
├── web/
│   └── index.html      # 网页界面
└── README.md           # 说明文档
```

## 📊 网页展示

访问 http://localhost:3000 查看：

- **核心统计**: 总资产、收益率、胜率、交易次数
- **资金曲线**: 可视化资产变化趋势
- **当前持仓**: 股票、成本、盈亏
- **交易记录**: 买卖历史、原因、盈亏

## ⚙️ 配置说明

编辑 `config.js` 调整参数：

```javascript
{
  initialCapital: 10000,        // 初始资金
  trading: {
    maxPositionPercent: 0.3,    // 单笔最大仓位
    commissionRate: 0.00025,    // 手续费率
  },
  risk: {
    stopLossPercent: 0.08,      // 止损比例
    takeProfitPercent: 0.20,    // 止盈比例
    maxHoldings: 5,             // 最大持仓数
  }
}
```

## 📈 股票数据

系统从以下位置加载股票数据：
- `/workspace/data/stock-watchlist.js` - 股票池
- `/workspace/data/stock-entry-signals.json` - 实时数据
- `/workspace/data/{股票代码}.json` - 个股历史数据

## 🔄 自动化

### 添加定时任务（cron）
```bash
# 每个交易日 9:25 执行交易
25 9 * * 1-5 cd /workspace/investment-simulator && ./start.sh trade
```

### 在 HEARTBEAT.md 中添加
```markdown
## 股票交易

- [ ] 每日 9:25 执行交易循环
- [ ] 监控持仓止损止盈
```

## 📝 交易逻辑

### 买入信号
1. 多头排列（均线向上）
2. RSI 超卖 (<30)
3. MACD 金叉
4. 突破 20 日高点
5. 综合评分 >= 3

### 卖出信号
1. 触发止损 (-8%)
2. 触发止盈 (+20%)
3. 空头排列（均线向下）
4. RSI 超买 (>70)
5. MACD 死叉
6. 综合评分 <= -3

## 🎯 使用建议

1. **定期执行**: 建议每个交易日开盘前执行
2. **监控网页**: 随时查看持仓和收益
3. **调整策略**: 根据市场情况优化 config.js
4. **记录复盘**: 定期查看交易记录总结经验

## ⚠️ 免责声明

本系统为**模拟交易**工具，使用虚拟资金，不构成任何投资建议。

实际交易存在风险，请谨慎决策。

---

**开发**: AI 操盘手  
**用户**: 龙哥  
**版本**: 1.0.0
