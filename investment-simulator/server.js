#!/usr/bin/env node
// 简单的 HTTP 服务器，用于展示网页

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const WEB_DIR = path.join(__dirname, 'web');

const mimeTypes = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

const server = http.createServer((req, res) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  
  // 处理 API 请求
  if (req.url === '/api/state') {
    try {
      const stateFile = path.join(__dirname, 'state.json');
      if (fs.existsSync(stateFile)) {
        const state = fs.readFileSync(stateFile, 'utf8');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(state);
      } else {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'State file not found' }));
      }
      return;
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
      return;
    }
  }
  
  // 处理静态文件
  let filePath = path.join(WEB_DIR, req.url === '/' ? 'index.html' : req.url);
  
  // 安全检查，防止目录遍历
  if (!filePath.startsWith(WEB_DIR)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }
  
  const ext = path.extname(filePath);
  const contentType = mimeTypes[ext] || 'application/octet-stream';
  
  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404);
        res.end('File not found');
      } else {
        res.writeHead(500);
        res.end('Server error: ' + err.code);
      }
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
    }
  });
});

server.listen(PORT, () => {
  console.log('='.repeat(60));
  console.log('🦞 模拟投资系统 Web 服务器已启动');
  console.log('='.repeat(60));
  console.log(`📊 访问地址：http://localhost:${PORT}`);
  console.log(`📈 API 地址：http://localhost:${PORT}/api/state`);
  console.log('='.repeat(60));
  console.log('按 Ctrl+C 停止服务器');
});
