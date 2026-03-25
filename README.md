# 🦞 龙哥的 AI 操盘手

> 基于技术指标的自动化模拟投资交易系统

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-v18+-green.svg)](https://nodejs.org/)

## 📋 项目简介

这是一个**自动化模拟投资交易系统**，使用虚拟资金进行 A 股交易练习。系统基于多种技术指标（MACD、RSI、KDJ、布林带等）生成交易信号，自动执行买卖操作，并提供实时网页监控面板。

**初始资金**: ¥10,000（虚拟）

## ✨ 核心功能

### 📊 技术分析
- **MACD**: 趋势动能指标
- **RSI**: 超买超卖指标
- **KDJ**: 随机指标
- **布林带**: 波动率通道
- **均线系统**: 5/10/20 日均线

### 🤖 交易策略
- **趋势跟踪**: 跟随均线多头排列
- **均值回归**: 超卖买入，超买卖出
- **突破策略**: 突破关键位置跟随

### 🛡️ 风险管理
- 单笔最大仓位：30%
- 止损线：-8%
- 止盈线：+20%
- 最大回撤：15%
- 同时持仓：最多 5 只股票

### 🌐 网页监控
- 实时总资产和收益率
- 持仓明细和盈亏
- 交易历史记录
- 资金曲线可视化

## 🚀 快速开始

### 环境要求
- Node.js v18+
- npm 或 yarn

### 安装

```bash
# 克隆项目
git clone https://github.com/YOUR_USERNAME/ai-trader.git
cd ai-trader/investment-simulator

# 安装依赖（如有需要）
npm install
```

### 使用

```bash
# 执行交易循环
./start.sh trade

# 启动 Web 服务器
./start.sh server

# 一键完成（交易 + 网页）
./start.sh all
```

访问 **http://localhost:3000** 查看监控面板

## 📁 项目结构

```
.
├── investment-simulator/       # 模拟投资系统
│   ├── config.js              # 系统配置
│   ├── indicators.js          # 技术指标计算
│   ├── strategy.js            # 交易策略
│   ├── trading-engine.js      # 交易引擎
│   ├── sim-trader.js          # 主程序
│   ├── server.js              # Web 服务器
│   ├── start.sh               # 启动脚本
│   ├── sample-data.js         # 数据生成器
│   ├── web/
│   │   └── index.html         # 网页界面
│   └── data/                  # 股票数据
├── scripts/                   # 自动化脚本
│   ├── asana-daily-push.js    # Asana 任务推送
│   ├── stock-monitor.js       # 股票监控
│   └── ...
├── data/                      # 数据文件
│   └── stock-watchlist.js     # 股票池
└── README.md                  # 项目说明
```

## 📖 详细文档

- [系统总览](INVESTMENT-SYSTEM.md)
- [快速上手](investment-simulator/QUICKSTART.md)
- [详细文档](investment-simulator/README.md)

## ⚙️ 配置说明

编辑 `investment-simulator/config.js`:

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

## 📈 交易逻辑

### 买入信号（综合评分 >= 2）
✅ 多头排列（5 日>10 日>20 日均线）  
✅ RSI 超卖 (<30)  
✅ MACD 金叉  
✅ 突破 20 日高点  
✅ KDJ 低位  

### 卖出信号（综合评分 <= -2 或触发风控）
❌ 触发止损 (-8%)  
❌ 触发止盈 (+20%)  
❌ 空头排列  
❌ RSI 超买 (>70)  
❌ MACD 死叉  

## 🔄 自动化

### 使用 cron
```bash
# 每个交易日 9:25 执行
25 9 * * 1-5 cd /path/to/investment-simulator && ./start.sh trade
```

### 使用 HEARTBEAT
在 `HEARTBEAT.md` 中添加：
```markdown
## 股票交易
- [ ] 每日 9:25 执行交易循环
- [ ] 监控持仓止损止盈
```

## 🛠️ 开发计划

- [ ] 接入真实股票数据 API
- [ ] 添加更多量化策略（网格、轮动）
- [ ] 历史数据回测功能
- [ ] 飞书消息通知
- [ ] 大盘风控系统
- [ ] 行业分散配置

## ⚠️ 免责声明

本系统为**模拟交易**工具，使用虚拟资金，不构成任何投资建议。

实际交易存在风险，请谨慎决策。

## 📄 许可证

MIT License

## 👤 作者

- 龙哥的 AI 操盘手

---

**🦞 Happy Trading!**
