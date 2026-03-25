#!/usr/bin/env node
// 龙虾活动日志系统

const fs = require('fs');
const path = require('path');

const LOG_FILE = path.join(__dirname, 'activity-log.json');

class ActivityLogger {
  constructor() {
    this.logs = this.loadLogs();
  }
  
  loadLogs() {
    try {
      if (fs.existsSync(LOG_FILE)) {
        return JSON.parse(fs.readFileSync(LOG_FILE, 'utf8'));
      }
    } catch (err) {
      console.error('[ActivityLogger] 加载日志失败:', err.message);
    }
    return [];
  }
  
  saveLogs() {
    try {
      fs.writeFileSync(LOG_FILE, JSON.stringify(this.logs, null, 2));
    } catch (err) {
      console.error('[ActivityLogger] 保存日志失败:', err.message);
    }
  }
  
  /**
   * 记录活动
   */
  logActivity(type, title, details = '') {
    const activity = {
      id: `A${Date.now()}`,
      timestamp: new Date().toISOString(),
      type, // 'trading', 'analysis', 'rest', 'learning', 'other'
      title,
      details,
      icon: this.getIconForType(type),
    };
    
    this.logs.unshift(activity);
    
    // 保留最近 100 条
    if (this.logs.length > 100) {
      this.logs = this.logs.slice(0, 100);
    }
    
    this.saveLogs();
    
    console.log(`[Activity] ${activity.icon} ${title}`);
    
    return activity;
  }
  
  /**
   * 获取活动图标
   */
  getIconForType(type) {
    const icons = {
      'trading': '💼',
      'analysis': '📊',
      'rest': '☕',
      'learning': '📚',
      'other': '🦞',
    };
    return icons[type] || icons['other'];
  }
  
  /**
   * 获取今日活动
   */
  getTodayLogs() {
    const today = new Date().toISOString().split('T')[0];
    return this.logs.filter(log => log.timestamp.startsWith(today));
  }
  
  /**
   * 获取最近活动
   */
  getRecentLogs(limit = 20) {
    return this.logs.slice(0, limit);
  }
  
  /**
   * 导出日志到网页
   */
  exportToWeb() {
    const webLogFile = path.join(__dirname, 'web', 'activity-log.json');
    fs.writeFileSync(webLogFile, JSON.stringify(this.logs, null, 2));
    console.log('[ActivityLogger] 日志已导出到网页目录');
  }
}

// CLI 使用
if (require.main === module) {
  const logger = new ActivityLogger();
  
  const args = process.argv.slice(2);
  
  if (args[0] === 'log') {
    const [type, title, ...details] = args.slice(1);
    logger.logActivity(type || 'other', title || '未命名活动', details.join(' '));
    logger.exportToWeb();
  } else if (args[0] === 'today') {
    console.log(JSON.stringify(logger.getTodayLogs(), null, 2));
  } else if (args[0] === 'recent') {
    console.log(JSON.stringify(logger.getRecentLogs(parseInt(args[1]) || 20), null, 2));
  } else if (args[0] === 'export') {
    logger.exportToWeb();
  } else {
    console.log('用法：node activity-log.js [log|today|recent|export]');
    console.log('  log <type> <title> [details] - 记录活动');
    console.log('  today - 查看今日活动');
    console.log('  recent [limit] - 查看最近活动');
    console.log('  export - 导出到网页目录');
  }
}

module.exports = ActivityLogger;
