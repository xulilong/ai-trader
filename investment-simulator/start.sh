#!/bin/bash
# 模拟投资系统启动脚本

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "=============================================="
echo "🦞 模拟投资系统"
echo "=============================================="
echo ""

# 检查参数
case "$1" in
  "trade")
    echo "📊 执行交易循环..."
    node sim-trader.js
    ;;
  "server")
    echo "🌐 启动 Web 服务器..."
    node server.js
    ;;
  "export")
    echo "💾 导出状态..."
    node sim-trader.js --export
    ;;
  "stats")
    echo "📈 显示统计..."
    node sim-trader.js --stats
    ;;
  "all")
    echo "🚀 执行交易并启动 Web 服务器..."
    node sim-trader.js
    echo ""
    echo "启动 Web 服务器..."
    node server.js
    ;;
  *)
    echo "用法：$0 {trade|server|export|stats|all}"
    echo ""
    echo "命令说明:"
    echo "  trade   - 执行一次交易循环"
    echo "  server  - 启动 Web 展示服务器"
    echo "  export  - 导出当前状态到 JSON"
    echo "  stats   - 显示投资统计"
    echo "  all     - 执行交易并启动 Web 服务器"
    echo ""
    echo "示例:"
    echo "  $0 trade    # 执行交易"
    echo "  $0 server   # 启动网页 (端口 3000)"
    echo "  $0 all      # 执行交易 + 启动网页"
    echo ""
    echo "网页访问：http://localhost:3000"
    ;;
esac
