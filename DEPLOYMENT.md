# 🚀 部署指南

## GitHub 自动部署配置完成！

### ✅ 已配置的工作流

| 工作流 | 文件 | 说明 |
|--------|------|------|
| **CI/CD** | `.github/workflows/ci.yml` | 代码检查、测试、多 Node 版本验证 |
| **自动部署** | `.github/workflows/deploy.yml` | 推送后自动部署到 GitHub Pages |
| **Pages** | `.github/workflows/pages.yml` | 专门处理静态页面部署 |

### 📋 推送步骤

```bash
cd /home/node/.openclaw/workspace

# 推送到 GitHub
git push -u origin main
```

**注意**: 已配置 Token 认证，直接推送即可！

### 🌐 访问地址

推送成功后：

- **GitHub 仓库**: https://github.com/xulilong/ai-trader
- **GitHub Pages**: https://xulilong.github.io/ai-trader/
- **Actions 面板**: https://github.com/xulilong/ai-trader/actions

### ⚙️ 启用 GitHub Pages

1. 访问仓库 Settings → Pages
2. Source 选择 **GitHub Actions**
3. 等待部署完成

### 🔄 自动部署流程

```
push to main → CI 检查 → 生成数据 → 部署到 Pages → 完成
```

每次推送到 `main` 分支都会自动触发部署！

---

**🦞 准备就绪！执行 `git push` 开始部署！**
