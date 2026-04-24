# ZQ-DnsIp
将多个域名IP解析至指定域名的worker.js脚本

## 部署方式

- **Workers** 部署：复制 [_worker.js](https://github.com/cmliu/CF-Workers-DD2D/blob/main/_worker.js) 代码，`保存并部署`即可
- **需要配置 KV 命名空间**：
  1. 在 Cloudflare Dashboard 创建 KV 命名空间
  2. 在 Worker 设置 → 变量 → KV 命名空间绑定中，添加绑定，变量名填 `DnsIp`

## 如何使用？

### 首次访问
1. 部署完成后，访问你的 Worker 域名
2. 系统会显示设置密码页面，请输入你自己想要的登录密码
3. 设置好密码后会跳转到登录页面

### 登录
- 在登录页面输入你设置的密码
- 登录成功后会进入管理面板

### 管理面板功能

#### Telegram 通知配置
- **TG Bot Token**：你的 Telegram 机器人 Token(可选)
- **TG Chat ID**：接收通知的 Chat ID(可选)

#### 域名配置
可以添加多个域名配置，每个域名独立设置：
- **CF 登录邮箱**：你的 Cloudflare 登录邮箱
- **CF 待解析域名**：要更新的域名（如 ddns.google.com）
- **CF Zone ID**：域名的区域 ID
- **CF API Token**：Cloudflare API 令牌(要有dns编辑权限)
- **DoH URL**：DNS over HTTPS 地址（可选，默认 https://cloudflare-dns.com/dns-query）
- **解析域名**：要获取 IP 的域名列表（可选，多个用逗号或换行分隔）
- **IPv4**：直接指定的 IPv4 地址（可选，多个用逗号或换行分隔）
- **IPv6**：直接指定的 IPv6 地址（可选，多个用逗号或换行分隔）
- **封禁IP**：不要解析的 IP 地址（可选，多个用逗号或换行分隔）
- **IP API**：从 API 获取 IP 的接口地址（可选，多个用逗号或换行分隔）


### 定时任务
- 在 Worker 设置 → 触发器 → Cron 触发器中添加
- 例如 `0 */8 * * *` 为每 8 小时执行一次
- 定时任务会自动读取保存的配置并执行
