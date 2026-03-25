# 🔴 实时交易同步系统

## 📊 系统架构

```
交易决策 → realtime-sync.js → state.json → GitHub Pages → 网页展示
                ↓
          trading-api.js (RESTful API)
```

## 🌐 访问地址

### 主页面
- **GitHub Pages**: https://xulilong.github.io/ai-trader/
- **实时监控**: https://xulilong.github.io/ai-trader/realtime-dashboard.html

### API 接口
```bash
GET  /api/state      # 获取当前状态
GET  /api/positions  # 获取持仓
GET  /api/trades     # 获取交易历史
POST /api/trade      # 执行交易
POST /api/prices     # 更新价格
POST /api/execute    # 执行决策
POST /api/snapshot   # 创建快照
```

## 🔄 实时同步流程

### 1. 本地交易
```bash
cd investment-simulator
node sim-trader.js
```

### 2. 自动同步
- 交易记录写入 `state.json`
- 自动触发 git commit
- 推送到 GitHub
- GitHub Actions 部署 Pages

### 3. 网页更新
- 每 30 秒自动刷新
- 显示最新持仓和交易
- 资金曲线实时更新

## 📝 使用示例

### 执行交易并同步
```javascript
const RealtimeSync = require('./realtime-sync');
const sync = new RealtimeSync();

// 执行买入
await sync.executeTrade({
  type: 'BUY',
  stockCode: '600519',
  price: 1700,
  shares: 200,
  amount: 340000,
  commission: 85,
  totalCost: 340085,
  timestamp: new Date().toISOString(),
  reason: 'MACD 金叉'
});

// 触发部署
await sync.triggerDeploy();
```

### 使用 API
```bash
# 获取状态
curl http://localhost:3001/api/state

# 执行交易
curl -X POST http://localhost:3001/api/trade \
  -H "Content-Type: application/json" \
  -d '{
    "type": "BUY",
    "stockCode": "600519",
    "price": 1700,
    "shares": 200
  }'
```

## ⚙️ 配置说明

### 部署触发
每次交易后自动：
1. 更新 `state.json`
2. Git commit（带时间戳）
3. Git push
4. GitHub Actions 部署
5. Pages 更新（1-2 分钟）

### 网页刷新
- 自动刷新间隔：30 秒
- 数据来源：`state.json`
- 实时显示：持仓、交易、资金曲线

## 🎯 翻倍挑战进度

**初始资金**: ¥10,000  
**当前资产**: ¥14,892  
**目标**: ¥20,000  
**收益率**: +48.92%  
**剩余时间**: 25 天  

---

**🦞 所有操作实时同步，随时查看进展！**
