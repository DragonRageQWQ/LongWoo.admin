# LongWoo 平台 - 前端UI替换部署脚本
# 请在项目目录下以管理员身份运行此脚本

$ErrorActionPreference = "Stop"

Write-Host "=== LongWoo 前端UI替换部署 ===" -ForegroundColor Cyan
Write-Host ""

# 切换到项目目录
Set-Location "F:\TRAEweb\longwoo-platform"

# 配置代理（如果需要）
$proxy = git config --global http.proxy
if (-not $proxy) {
    Write-Host "[1/5] 配置 Git 代理 (端口 7897)..." -ForegroundColor Yellow
    git config --global http.proxy "http://127.0.0.1:7897"
    git config --global https.proxy "http://127.0.0.1:7897"
} else {
    Write-Host "[1/5] Git 代理已配置: $proxy" -ForegroundColor Green
}

# 添加所有更改
Write-Host "[2/5] 添加文件到 Git..." -ForegroundColor Yellow
git add -A
if ($LASTEXITCODE -ne 0) {
    Write-Host "错误: 无法添加文件" -ForegroundColor Red
    exit 1
}

# 显示更改摘要
Write-Host ""
Write-Host "更改摘要:" -ForegroundColor Cyan
git status --short
Write-Host ""

# 提交更改
Write-Host "[3/5] 提交更改..." -ForegroundColor Yellow
git commit -m "feat: 替换前端UI设计，保留管理后台

- 添加静态HTML首页和订单流程页面到 public/
- 添加设计资源图片到 public/assets/
- 配置 next.config.ts 使用 rewrites 提供 static HTML
- 修改 page.tsx 重定向到静态首页
- 移除 layout.tsx 中的 Header/Footer 避免冲突
- 更新登录入口指向 /login 路由
- 保留管理后台 (/admin) 和工作室面板 (/studio)"

if ($LASTEXITCODE -ne 0) {
    Write-Host "警告: 提交可能未产生更改（已是最新）" -ForegroundColor Yellow
}

# 推送到 GitHub
Write-Host "[4/5] 推送到 GitHub..." -ForegroundColor Yellow
git push origin main
if ($LASTEXITCODE -ne 0) {
    Write-Host "尝试强制推送..." -ForegroundColor Yellow
    git push -u origin main --force
}

Write-Host "[5/5] 部署完成！" -ForegroundColor Green
Write-Host ""
Write-Host "Vercel 将自动检测到新推送并开始部署。" -ForegroundColor Cyan
Write-Host "访问 https://vercel.com 查看部署状态" -ForegroundColor Cyan
Write-Host "部署完成后访问 https://www.longwoo.studio 查看效果" -ForegroundColor Cyan
Write-Host ""
Read-Host "按 Enter 键关闭"
