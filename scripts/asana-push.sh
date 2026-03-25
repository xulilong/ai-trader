#!/bin/bash
# Asana 每日任务推送 - Shell 包装脚本
# 每天早上 9 点（北京时间）执行

cd /home/node/.openclaw/workspace
node scripts/asana-daily-push.js
