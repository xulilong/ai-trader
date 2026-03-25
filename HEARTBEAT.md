# HEARTBEAT.md

# Keep this file empty (or with only comments) to skip heartbeat API calls.

# Add tasks below when you want the agent to check something periodically.

---

## Asana 任务推送处理

当收到 "Asana 每日任务推送时间到了" 的系统事件时，执行：
```bash
node /home/node/.openclaw/workspace/scripts/asana-daily-push-card.js
```
