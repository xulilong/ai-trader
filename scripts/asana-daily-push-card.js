#!/usr/bin/env node

/**
 * Asana 每日任务推送脚本 - 飞书卡片版
 * 每天早上 9 点（北京时间）获取龙哥的 Asana 任务并推送到飞书
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

// 配置
const ASANA_TOKEN_PATH = path.join(process.env.HOME, '.clawdbot/asana/token.json');
const WORKSPACE_GID = '141498773378715';
const ASSIGNEE_GID = '1205266104616595';
const FEISHU_USER_ID = 'ou_ade2ce956c6d54dd19c2182fd3536d3e';

// 读取 Asana Token
function loadAsanaToken() {
  const tokenData = JSON.parse(fs.readFileSync(ASANA_TOKEN_PATH, 'utf8'));
  return tokenData.access_token;
}

// Asana API 请求
function asanaRequest(endpoint, token) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'app.asana.com',
      port: 443,
      path: `/api/1.0${endpoint}`,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error(`Failed to parse response: ${e.message}`));
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

// 获取今日日期（北京时间）
function getBeijingDate() {
  const now = new Date();
  const beijingTime = new Date(now.getTime() + (8 * 60 * 60 * 1000));
  return {
    date: beijingTime.toISOString().split('T')[0],
    weekday: beijingTime.toLocaleDateString('zh-CN', { weekday: 'long' }),
    fullDate: beijingTime.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' })
  };
}

// 格式化任务为简洁文本
function formatTasksText(tasks, dateInfo) {
  const today = dateInfo.date;
  const todayTasks = tasks.filter(t => t.due_on === today && !t.completed);
  const tomorrowTasks = tasks.filter(t => {
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return t.due_on === tomorrow.toISOString().split('T')[0] && !t.completed;
  });
  const overdueTasks = tasks.filter(t => t.due_on && t.due_on < today && !t.completed);

  let text = `📅 **龙哥的今日任务** · ${dateInfo.weekday}\n`;
  text += `⏰ ${dateInfo.fullDate}\n\n`;

  if (overdueTasks.length > 0) {
    text += `🚨 **已逾期 (${overdueTasks.length}个)**\n`;
    overdueTasks.slice(0, 3).forEach((task, i) => {
      text += `${i + 1}. ${task.name} (${task.projects?.[0]?.name || '无'})\n`;
    });
    text += `\n`;
  }

  if (todayTasks.length > 0) {
    text += `🔥 **今日到期 (${todayTasks.length}个)**\n`;
    todayTasks.forEach((task, i) => {
      text += `${i + 1}. **${task.name}**\n   📁 ${task.projects?.[0]?.name || '无'}\n   🔗 ${task.permalink_url}\n\n`;
    });
  } else if (overdueTasks.length === 0) {
    text += `✅ 太棒啦！今天没有到期任务～\n好好享受轻松的一天吧！(≧∇∇)\n\n`;
  }

  if (tomorrowTasks.length > 0) {
    text += `📌 **明日到期 (${tomorrowTasks.length}个)**\n`;
    tomorrowTasks.slice(0, 5).forEach((task, i) => {
      text += `${i + 1}. ${task.name} - ${task.projects?.[0]?.name || '无'}\n`;
    });
    text += `\n`;
  }

  text += `━━━━━━━━━━\n`;
  text += `📊 **概览**：总 ${tasks.length} | 今日 ${todayTasks.length} | 逾期 ${overdueTasks.length}\n`;
  text += `💪 龙哥加油！`;

  return text;
}

// 发送飞书消息
async function sendFeishuMessage(message) {
  const { exec } = require('child_process');
  
  return new Promise((resolve, reject) => {
    const cmd = `openclaw message send --channel feishu --target user:${FEISHU_USER_ID} --message '${message.replace(/'/g, "'\\''")}'`;
    
    exec(cmd, { timeout: 30000 }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(`Failed to send message: ${stderr || error.message}`));
      } else {
        resolve({ stdout, stderr });
      }
    });
  });
}

// 主函数
async function main() {
  try {
    console.log('🚀 开始获取 Asana 任务...');
    
    const token = loadAsanaToken();
    const dateInfo = getBeijingDate();
    
    // 获取任务
    const response = await asanaRequest(
      `/tasks?assignee=${ASSIGNEE_GID}&workspace=${WORKSPACE_GID}&completed_since=now&limit=100&opt_fields=gid,name,completed,assignee.name,due_on,projects.name,permalink_url,modified_at`,
      token
    );
    
    const tasks = response.data || [];
    console.log(`📋 获取到 ${tasks.length} 个未完成的任务`);
    
    // 格式化消息
    const message = formatTasksText(tasks, dateInfo);
    console.log('\n📱 推送内容:\n');
    console.log(message);
    console.log('\n');
    
    // 发送飞书消息
    console.log('📩 正在发送到飞书...');
    await sendFeishuMessage(message);
    console.log('✅ 推送成功！');
    
  } catch (error) {
    console.error('❌ 错误:', error.message);
    process.exit(1);
  }
}

main();
