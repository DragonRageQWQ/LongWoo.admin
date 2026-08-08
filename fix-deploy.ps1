# LongWoo 平台 - 修复 Vercel 部署权限问题
# 问题原因：Git 提交作者信息为默认值，Vercel 无法识别为项目所有者
# 解决方案：修改 Git 作者信息后重新提交推送

$ErrorActionPreference = "Stop"

Write-Host "=== 修复 Vercel 部署权限 ===" -ForegroundColor Cyan
Write-Host ""

Set-Location "F:\TRAEweb\longwoo-platform"

# 1. 修改 Git 用户信息为 DragonRageQWQ
Write-Host "[1/4] 修改 Git 用户信息..." -ForegroundColor Yellow
git config user.name "DragonRageQWQ"
git config user.email "112858428+DragonRageQWQ@users.noreply.github.com"
Write-Host "  用户名: DragonRageQWQ" -ForegroundColor Green
Write-Host "  邮箱: 112858428+DragonRageQWQ@users.noreply.github.com" -ForegroundColor Green

# 2. 修改最近一次提交的作者信息
Write-Host "[2/4] 修改提交作者信息..." -ForegroundColor Yellow
git commit --amend --reset-author --no-edit
Write-Host "  提交作者已更新" -ForegroundColor Green

# 3. 配置代理（如果需要）
$proxy = git config --global http.proxy
if (-not $proxy) {
    Write-Host "[3/4] 配置 Git 代理..." -ForegroundColor Yellow
    git config --global http.proxy "http://127.0.0.1:7897"
    git config --global https.proxy "http://127.0.0.1:7897"
} else {
    Write-Host "[3/4] Git 代理已配置: $proxy" -ForegroundColor Green
}

# 4. 强制推送到 GitHub
Write-Host "[4/4] 强制推送到 GitHub..." -ForegroundColor Yellow
git push origin main --force
if ($LASTEXITCODE -ne 0) {
    Write-Host "推送失败，请检查网络连接" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "=== 修复完成！===" -ForegroundColor Green
Write-Host ""
Write-Host "Vercel 将自动检测到新提交并触发部署。" -ForegroundColor Cyan
Write-Host "请等待 1-2 分钟后访问 https://www.longwoo.studio 查看新页面" -ForegroundColor Cyan
Write-Host ""
Write-Host "如果 Vercel 仍然阻止部署，请访问：" -ForegroundColor Yellow
Write-Host "  https://vercel.com/long-woo1/long-woo-admin/deployments" -ForegroundColor White
Write-Host "  找到最新的 Blocked 部署，点击 Deployment Actions -> Redeploy" -ForegroundColor White
Write-Host ""
Read-Host "按 Enter 键关闭"
