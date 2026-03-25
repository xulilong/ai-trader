#!/usr/bin/env node

/**
 * Asana 每日任务推送脚本
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

// 格式化任务卡片为飞书卡片格式
function formatTaskCard(tasks, dateInfo) {
  const today = dateInfo.date;
  const todayTasks = tasks.filter(t => t.due_on === today && !t.completed);
  const tomorrowTasks = tasks.filter(t => {
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return t.due_on === tomorrow.toISOString().split('T')[0] && !t.completed;
  });
  const overdueTasks = tasks.filter(t => t.due_on && t.due_on < today && !t.completed);

  const sections = [];

  // 逾期任务
  if (overdueTasks.length > 0) {
    let overdueText = `**🚨 已逾期 (${overdueTasks.length}个)**\n`;
    overdueTasks.slice(0, 3).forEach((task, i) => {
      const projectName = task.projects?.[0]?.name || '无';
      overdueText += `\n**${i + 1}.** ${task.name}`;
      overdueText += `\n   📁 ${projectName} | ⏳ ${task.due_on}`;
    });
    sections.push({
      tag: "div",
      text: {
        tag: "lark_md",
        content: overdueText
      }
    });
  }

  // 今日任务
  if (todayTasks.length > 0) {
    let todayText = `**🔥 今日到期 (${todayTasks.length}个)**\n`;
    todayTasks.forEach((task, i) => {
      const projectName = task.projects?.[0]?.name || '无';
      todayText += `\n**${i + 1}.** ${task.name}`;
      todayText += `\n   📁 ${projectName}`;
      todayText += `\n   🔗 [查看任务](${task.permalink_url})`;
    });
    sections.push({
      tag: "div",
      text: {
        tag: "lark_md",
        content: todayText
      }
    });
  } else {
    sections.push({
      tag: "div",
      text: {
        tag: "lark_md",
        content: `**✅ 太棒啦！今天没有到期任务～**\n\n好好享受轻松的一天吧！(≧∇≦)`
      }
    });
  }

  // 明日任务
  if (tomorrowTasks.length > 0) {
    let tomorrowText = `**📌 明日到期 (${tomorrowTasks.length}个)**\n`;
    tomorrowTasks.slice(0, 3).forEach((task, i) => {
      const projectName = task.projects?.[0]?.name || '无';
      tomorrowText += `\n**${i + 1}.** ${task.name} - ${projectName}`;
    });
    sections.push({
      tag: "div",
      text: {
        tag: "lark_md",
        content: tomorrowText
      }
    });
  }

  return {
    sections,
    stats: {
      total: tasks.length,
      today: todayTasks.length,
      overdue: overdueTasks.length
    }
  };
}

// 发送飞书卡片消息
async function sendFeishuCard(cardContent, dateInfo) {
  const fs = require('fs');
  const { exec } = require('child_process');
  
  // 构建飞书交互式卡片 (Interactive Card)
  const feishuCard = {
    config: {
      wide_screen_mode: true
    },
    header: {
      template: "blue",
      title: {
        tag: "plain_text",
        content: `📅 龙哥的今日任务 · ${dateInfo.weekday}`
      }
    },
    elements: [
      {
        tag: "div",
        text: {
          tag: "lark_md",
          content: `**⏰ 日期：** ${dateInfo.fullDate}`
        }
      },
      {
        tag: "divider"
      },
      ...cardContent.sections,
      {
        tag: "divider"
      },
      {
        tag: "div",
        text: {
          tag: "lark_md",
          content: `**📊 今日概览**\n总任务：${cardContent.stats.total} | 今日到期：${cardContent.stats.today} | 已逾期：${cardContent.stats.overdue}`
        }
      },
      {
        tag: "action",
        actions: [
          {
            tag: "button",
            text: {
              tag: "plain_text",
              content: "💪 龙哥加油！"
            },
            type: "primary",
            style: "wired"
          }
        ]
      }
    ]
  };

  // 写入临时文件
  const tempPath = '/tmp/feishu-card.json';
  fs.writeFileSync(tempPath, JSON.stringify(feishuCard));

  // 使用 feishu_im_user_message 发送交互式卡片
  return new Promise((resolve, reject) => {
    const cmd = `node -e "
      const fs = require('fs');
      const card = JSON.parse(fs.readFileSync('/tmp/feishu-card.json', 'utf8'));
      const content = JSON.stringify({zh_cn: card});
      const {execSync} = require('child_process');
      try {
        execSync(\`openclaw feishu-im-user-message send --receive_id_type open_id --receive_id ${FEISHU_USER_ID} --msg_type interactive --content '\${content.replace(/'/g, \"'\")}'\`, {stdio: 'inherit'});
        process.exit(0);
      } catch(e) {
        process.exit(1);
      }
    "`;
    
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
    
    // 获取任务 - 使用 completed_since=now 获取未完成的任务
    const response = await asanaRequest(
      `/tasks?assignee=${ASSIGNEE_GID}&workspace=${WORKSPACE_GID}&completed_since=now&limit=100&opt_fields=gid,name,completed,assignee.name,due_on,projects.name,permalink_url,modified_at`,
      token
    );
    
    const tasks = response.data || [];
    console.log(`📋 获取到 ${tasks.length} 个未完成的任务`);
    
    // 格式化卡片
    const cardContent = formatTaskCard(tasks, dateInfo);
    
    // 发送飞书卡片消息
    console.log('📩 正在发送飞书卡片...');
    await sendFeishuCard(cardContent, dateInfo);
    console.log('✅ 卡片推送成功！');
    
  } catch (error) {
    console.error('❌ 错误:', error.message);
    process.exit(1);
  }
}

main();
