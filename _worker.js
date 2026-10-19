export default {
	async fetch(request, env, ctx) {
		const url = new URL(request.url);
		const pathname = url.pathname;

		// KV存储初始化
		const KV = env.DnsIp || null;

		// 检查是否是API请求
		if (request.method === 'POST' && pathname.startsWith('/api/')) {
			return await handleAPI(request, env, pathname);
		}

		// 获取或生成TOKEN
		let token = await KV?.get('token');

		// 检查是否已认证
		const authToken = url.searchParams.get('token') || getCookie(request, 'token');
		const isAuthenticated = authToken === token;

		// 路由处理
		if (pathname === '/') {
			// 首次访问且未认证，显示设置密码页面
			const firstVisit = await KV?.get('first_visit');
			if (!firstVisit) {
				return showSetupPage();
			}
			// 未认证，显示登录页
			if (!isAuthenticated) {
				return showLoginPage();
			}
			// 已认证，显示主页
			return showDashboard(await getConfig(KV), token);
		} else if (pathname === '/setup') {
			if (request.method === 'POST') {
				const formData = await request.formData();
				const newToken = formData.get('token');
				if (newToken && newToken.trim()) {
					await KV?.put('token', newToken.trim());
					await KV?.put('first_visit', 'true');
					return new Response(null, { status: 302, headers: { Location: '/login' } });
				}
				return showSetupPage('请输入密码不能为空');
			}
			return showSetupPage();
		} else if (pathname === '/login') {
			if (request.method === 'POST') {
				const formData = await request.formData();
				const inputToken = formData.get('token');
				if (inputToken === token) {
					const response = new Response(null, { status: 302, headers: { Location: '/' } });
					response.headers.set('Set-Cookie', 'token=' + token + '; Path=/; Max-Age=31536000');
					return response;
				}
				return showLoginPage('密码错误');
			}
			return showLoginPage();
		} else if (pathname === '/execute') {
			if (!isAuthenticated) {
				return new Response('Unauthorized', { status: 401 });
			}
			return await executeTask(env);
		}

		return new Response('Not Found', { status: 404 });
	},

	async scheduled(event, env, ctx) {
		// 定时执行任务
		const KV = env.DnsIp || null;
		const config = await getConfig(KV);
		await executeTaskForAllDomains(config, KV);
	}
};

// ==================== 工具函数 ====================

function generateToken() {
	const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
	let token = '';
	for (let i = 0; i < 16; i++) {
		token += chars.charAt(Math.floor(Math.random() * chars.length));
	}
	return token;
}

function getCookie(request, name) {
	const cookies = request.headers.get('Cookie') || '';
	const match = cookies.match(new RegExp('(^| )' + name + '=([^;]+)'));
	return match ? match[2] : null;
}

async function getConfig(KV) {
	if (!KV) return { domains: [], tgToken: '', tgId: '' };
	const configStr = await KV.get('config');
	return configStr ? JSON.parse(configStr) : { domains: [], tgToken: '', tgId: '' };
}

async function saveConfig(KV, config) {
	if (!KV) return;
	await KV.put('config', JSON.stringify(config));
}

// ==================== API处理 ====================

async function handleAPI(request, env, pathname) {
	const KV = env.DnsIp || null;
	const authToken = getCookie(request, 'token') || new URL(request.url).searchParams.get('token');
	const storedToken = await KV?.get('token');
	
	if (authToken !== storedToken) {
		return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), { 
			status: 401, 
			headers: { 'Content-Type': 'application/json' } 
		});
	}

	if (pathname === '/api/save-config') {
		const config = await request.json();
		await saveConfig(KV, config);
		return new Response(JSON.stringify({ success: true }), { 
			headers: { 'Content-Type': 'application/json' } 
		});
	} else if (pathname === '/api/get-config') {
		const config = await getConfig(KV);
		return new Response(JSON.stringify({ success: true, config }), { 
			headers: { 'Content-Type': 'application/json' } 
		});
	} else if (pathname === '/api/change-password') {
		const data = await request.json();
		if (data.newPassword) {
			await KV?.put('token', data.newPassword);
			return new Response(JSON.stringify({ success: true }), { 
				headers: { 'Content-Type': 'application/json' } 
			});
		}
		return new Response(JSON.stringify({ success: false, error: '新密码不能为空' }), { 
			status: 400, 
			headers: { 'Content-Type': 'application/json' } 
		});
	}

	return new Response(JSON.stringify({ success: false, error: 'Not Found' }), { 
		status: 404, 
		headers: { 'Content-Type': 'application/json' } 
	});
}

// ==================== 页面渲染 ====================

const AUTH_STYLES = `
		:root {
			--bg: #f5f7fb;
			--line: #e4eaf3;
			--text: #0f172a;
			--muted: #64748b;
			--brand: #2563eb;
			--brand-dark: #1d4ed8;
		}
		* { margin: 0; padding: 0; box-sizing: border-box; }
		body {
			font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
			background: radial-gradient(900px 480px at 50% -8%, #dbeafe 0%, rgba(219, 234, 254, 0) 62%), var(--bg);
			color: var(--text);
			min-height: 100vh;
			display: flex;
			align-items: center;
			justify-content: center;
			padding: 24px;
			-webkit-font-smoothing: antialiased;
		}
		.wrap { width: 100%; max-width: 410px; }
		.brand {
			display: flex;
			align-items: center;
			justify-content: center;
			gap: 9px;
			font-size: 15px;
			font-weight: 700;
			color: #1e293b;
			margin-bottom: 18px;
		}
		.card {
			background: #fff;
			border: 1px solid var(--line);
			border-radius: 16px;
			padding: 30px;
			box-shadow: 0 24px 60px -32px rgba(15, 23, 42, .35);
		}
		h1 { font-size: 21px; margin-bottom: 7px; }
		.sub { font-size: 13.5px; color: var(--muted); line-height: 1.6; margin-bottom: 22px; }
		.notice {
			background: #f1f6ff;
			border: 1px solid #dbe7ff;
			color: #1e40af;
			font-size: 13px;
			line-height: 1.6;
			padding: 11px 13px;
			border-radius: 10px;
			margin-bottom: 20px;
		}
		.err {
			background: #fef2f2;
			border: 1px solid #fecaca;
			color: #b91c1c;
			font-size: 13px;
			padding: 11px 13px;
			border-radius: 10px;
			margin-bottom: 20px;
		}
		label { display: block; font-size: 13px; font-weight: 600; color: #334155; margin-bottom: 8px; }
		input {
			width: 100%;
			height: 44px;
			padding: 0 14px;
			border: 1px solid #dbe3ef;
			border-radius: 10px;
			font-size: 14.5px;
			font-family: inherit;
			color: var(--text);
			background: #fcfdff;
			transition: border-color .15s, box-shadow .15s, background .15s;
		}
		input::placeholder { color: #9aa7bb; }
		input:focus {
			outline: none;
			background: #fff;
			border-color: var(--brand);
			box-shadow: 0 0 0 3px rgba(37, 99, 235, .16);
		}
		.btn {
			width: 100%;
			height: 44px;
			margin-top: 22px;
			border: none;
			border-radius: 10px;
			background: var(--brand);
			color: #fff;
			font-size: 14.5px;
			font-weight: 600;
			font-family: inherit;
			cursor: pointer;
			transition: background .15s, transform .1s;
		}
		.btn:hover { background: var(--brand-dark); }
		.btn:active { transform: translateY(1px); }
		.foot { text-align: center; font-size: 12px; color: #94a3b8; margin-top: 18px; }
`;

const DASH_STYLES = `
		:root {
			--bg: #f4f7fc;
			--line: #e4eaf3;
			--text: #0f172a;
			--muted: #64748b;
			--brand: #2563eb;
			--brand-dark: #1d4ed8;
		}
		* { margin: 0; padding: 0; box-sizing: border-box; }
		body {
			font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
			background: var(--bg);
			color: var(--text);
			-webkit-font-smoothing: antialiased;
		}
		.top {
			position: sticky;
			top: 0;
			z-index: 20;
			background: rgba(255, 255, 255, .9);
			backdrop-filter: blur(10px);
			border-bottom: 1px solid var(--line);
		}
		.top-inner {
			max-width: 1080px;
			margin: 0 auto;
			padding: 13px 24px;
			display: flex;
			align-items: center;
			justify-content: space-between;
			gap: 12px;
		}
		.brand { display: flex; align-items: center; gap: 9px; font-size: 15px; font-weight: 700; }
		.tag {
			font-size: 11.5px;
			font-weight: 600;
			color: #3b82f6;
			background: #eff6ff;
			border: 1px solid #dbeafe;
			padding: 2px 8px;
			border-radius: 999px;
		}
		.container { max-width: 1080px; margin: 24px auto 64px; padding: 0 24px; }
		.card {
			background: #fff;
			border: 1px solid var(--line);
			border-radius: 14px;
			padding: 22px 24px;
			margin-bottom: 16px;
			box-shadow: 0 14px 34px -28px rgba(15, 23, 42, .4);
		}
		.card-head {
			display: flex;
			align-items: center;
			justify-content: space-between;
			gap: 12px;
			margin-bottom: 18px;
		}
		.card-head h2 { font-size: 15.5px; font-weight: 700; }
		.hint { font-size: 12.5px; color: var(--muted); }
		.grid { display: grid; gap: 14px 16px; }
		.grid-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
		.field label { display: block; font-size: 12.5px; font-weight: 600; color: #475569; margin-bottom: 7px; }
		input, textarea {
			width: 100%;
			padding: 10px 12px;
			border: 1px solid #dbe3ef;
			border-radius: 9px;
			font-size: 13.5px;
			font-family: inherit;
			color: var(--text);
			background: #fcfdff;
			transition: border-color .15s, box-shadow .15s, background .15s;
		}
		input::placeholder, textarea::placeholder { color: #9aa7bb; }
		input:focus, textarea:focus {
			outline: none;
			background: #fff;
			border-color: var(--brand);
			box-shadow: 0 0 0 3px rgba(37, 99, 235, .14);
		}
		textarea { min-height: 74px; resize: vertical; line-height: 1.65; }
		.btn {
			display: inline-flex;
			align-items: center;
			justify-content: center;
			gap: 6px;
			height: 38px;
			padding: 0 16px;
			border: 1px solid transparent;
			border-radius: 9px;
			font-size: 13.5px;
			font-weight: 600;
			font-family: inherit;
			cursor: pointer;
			transition: background .15s, border-color .15s, color .15s, transform .1s;
		}
		.btn:active { transform: translateY(1px); }
		.btn-primary { background: var(--brand); color: #fff; }
		.btn-primary:hover { background: var(--brand-dark); }
		.btn-ghost { background: #fff; color: #334155; border-color: #dbe3ef; }
		.btn-ghost:hover { background: #f8fafc; border-color: #b9c6da; }
		.btn-danger { background: #fff; color: #dc2626; border-color: #fecaca; }
		.btn-danger:hover { background: #fef2f2; }
		.btn-sm { height: 32px; padding: 0 12px; font-size: 12.5px; border-radius: 8px; }
		.btn-group { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; }
		.domain-item {
			border: 1px solid var(--line);
			border-radius: 12px;
			margin-bottom: 14px;
			overflow: hidden;
		}
		.domain-item:last-child { margin-bottom: 0; }
		summary.domain-header {
			display: flex;
			align-items: center;
			gap: 12px;
			padding: 14px 18px;
			cursor: pointer;
			user-select: none;
			list-style: none;
			transition: background .15s;
		}
		summary.domain-header:hover { background: #f8fbff; }
		summary.domain-header::-webkit-details-marker { display: none; }
		details[open] > summary.domain-header { border-bottom: 1px dashed var(--line); }
		.domain-actions { margin-left: auto; display: flex; align-items: center; gap: 10px; }
		.chev {
			flex: 0 0 auto;
			width: 7px;
			height: 7px;
			margin-top: -4px;
			border-right: 1.7px solid #94a3b8;
			border-bottom: 1.7px solid #94a3b8;
			transform: rotate(45deg);
			transition: transform .2s, margin-top .2s;
		}
		details[open] > summary .chev { transform: rotate(-135deg); margin-top: 4px; }
		.domain-body { padding: 16px 18px 18px; }
		.domain-title { display: flex; align-items: center; gap: 9px; min-width: 0; font-size: 14px; font-weight: 600; }
		.badge {
			flex: none;
			width: 22px;
			height: 22px;
			border-radius: 7px;
			background: #eff6ff;
			color: #2563eb;
			font-size: 11.5px;
			font-weight: 700;
			display: flex;
			align-items: center;
			justify-content: center;
		}
		.domain-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
		.fieldset + .fieldset { margin-top: 16px; }
		.fieldset-title {
			font-size: 11.5px;
			font-weight: 700;
			letter-spacing: .04em;
			color: #94a3b8;
			margin-bottom: 10px;
		}
		.empty { text-align: center; font-size: 13px; color: #94a3b8; padding: 26px 0 12px; }
		.log {
			margin-top: 16px;
			background: #0f172a;
			color: #cbd5e1;
			border-radius: 11px;
			padding: 14px 16px;
			font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
			font-size: 12.5px;
			line-height: 1.75;
			max-height: 320px;
			overflow: auto;
			white-space: pre-wrap;
			word-break: break-word;
		}
		.hidden { display: none !important; }
		.alert { padding: 12px 14px; border-radius: 10px; font-size: 13px; margin-bottom: 16px; border: 1px solid transparent; }
		.alert-success { background: #f0fdf4; border-color: #bbf7d0; color: #15803d; }
		.alert-danger { background: #fef2f2; border-color: #fecaca; color: #b91c1c; }
		.modal {
			display: none;
			position: fixed;
			inset: 0;
			background: rgba(15, 23, 42, .45);
			align-items: center;
			justify-content: center;
			padding: 20px;
			z-index: 100;
		}
		.modal.show { display: flex; }
		.modal-content {
			background: #fff;
			border-radius: 14px;
			padding: 24px;
			width: 100%;
			max-width: 400px;
			box-shadow: 0 30px 60px -20px rgba(15, 23, 42, .45);
		}
		.modal-content h2 { font-size: 16px; margin-bottom: 18px; }
		@media (max-width: 720px) {
			.grid-2 { grid-template-columns: 1fr; }
			.top-inner { padding: 12px 14px; }
			.container { padding: 0 14px; margin-top: 16px; }
			.card { padding: 18px 16px; }
		}
`;

function authPage(options) {
	const { title, subtitle, notice, error, fieldLabel, placeholder, action, submitText, isPassword } = options;
	const parts = [
		'<!DOCTYPE html>',
		'<html lang="zh-CN">',
		'<head>',
		'\t<meta charset="UTF-8">',
		'\t<meta name="viewport" content="width=device-width, initial-scale=1.0">',
		'\t<link rel="icon" href="https://img.520jacky.dpdns.org/i/2026/04/24/549044.svg" type="image/svg+xml">',
		'\t<title>ZQ-DnsIp - ' + title + '</title>',
		'\t<style>' + AUTH_STYLES + '\t</style>',
		'</head>',
		'<body>',
		'\t<div class="wrap">',
		'\t\t<div class="brand">ZQ-DnsIp</div>',
		'\t\t<div class="card">',
		'\t\t\t<h1>' + title + '</h1>',
		'\t\t\t<p class="sub">' + subtitle + '</p>',
		error ? '\t\t\t<div class="err">' + error + '</div>' : '',
		notice ? '\t\t\t<div class="notice">' + notice + '</div>' : '',
		'\t\t\t<form method="post" action="' + action + '">',
		'\t\t\t\t<label>' + fieldLabel + '</label>',
		'\t\t\t\t<input type="' + (isPassword ? 'password' : 'text') + '" name="token" placeholder="' + placeholder + '" required autocomplete="' + (isPassword ? 'current-password' : 'off') + '">',
		'\t\t\t\t<button type="submit" class="btn">' + submitText + '</button>',
		'\t\t\t</form>',
		'\t\t</div>',
		'\t\t<p class="foot">Cloudflare Worker · 域名 IP 自动解析</p>',
		'\t</div>',
		'</body>',
		'</html>'
	];
	return new Response(parts.filter(Boolean).join('\n'), {
		headers: { 'Content-Type': 'text/html; charset=utf-8' }
	});
}

function showSetupPage(error = '') {
	return authPage({
		title: '设置登录密码',
		subtitle: '首次使用，为管理面板设置一个登录密码。',
		notice: '密码保存在 KV 中，请自行妥善保管。',
		error: error,
		fieldLabel: '登录密码',
		placeholder: '请输入你想设置的密码',
		action: '/setup',
		submitText: '保存并进入',
		isPassword: false
	});
}

function showLoginPage(error = '') {
	return authPage({
		title: '登录管理面板',
		subtitle: '输入密码以继续。',
		notice: '',
		error: error,
		fieldLabel: '密码',
		placeholder: '输入你的登录密码',
		action: '/login',
		submitText: '登录',
		isPassword: true
	});
}

function showDashboard(config, token) {
	config = config || {};
	config.domains = config.domains || [];
	const parts = [
		'<!DOCTYPE html>',
		'<html lang="zh-CN">',
		'<head>',
		'\t<meta charset="UTF-8">',
		'\t<meta name="viewport" content="width=device-width, initial-scale=1.0">',
		'\t<link rel="icon" href="https://img.520jacky.dpdns.org/i/2026/04/24/549044.svg" type="image/svg+xml">',
		'\t<title>ZQ-DnsIp - 管理面板</title>',
		'\t<style>' + DASH_STYLES + '\t</style>',
		'</head>',
		'<body>',
		'\t<div class="top">',
		'\t\t<div class="top-inner">',
		'\t\t\t<div class="brand"><span>ZQ-DnsIp</span><span class="tag">管理面板</span></div>',
		'\t\t\t<button class="btn btn-ghost btn-sm" onclick="showChangePasswordModal()">修改密码</button>',
		'\t\t</div>',
		'\t</div>',
		'',
		'\t<div class="container">',
		'\t\t<div id="alert" class="hidden"></div>',
		'',
		'\t\t<section class="card">',
		'\t\t\t<div class="card-head">',
		'\t\t\t\t<h2>Telegram 通知</h2>',
		'\t\t\t\t<span class="hint">可选，用于接收执行结果</span>',
		'\t\t\t</div>',
		'\t\t\t<div class="grid grid-2">',
		'\t\t\t\t<div class="field">',
		'\t\t\t\t\t<label>TG Bot Token</label>',
		'\t\t\t\t\t<input type="text" id="tgToken" placeholder="123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11">',
		'\t\t\t\t</div>',
		'\t\t\t\t<div class="field">',
		'\t\t\t\t\t<label>TG Chat ID</label>',
		'\t\t\t\t\t<input type="text" id="tgId" placeholder="123456789">',
		'\t\t\t\t</div>',
		'\t\t\t</div>',
		'\t\t</section>',
		'',
		'\t\t<section class="card">',
		'\t\t\t<div class="card-head">',
		'\t\t\t\t<h2>域名配置</h2>',
		'\t\t\t\t<button class="btn btn-primary btn-sm" onclick="addDomain()">+ 添加域名</button>',
		'\t\t\t</div>',
		'\t\t\t<div id="domainList"></div>',
		'\t\t\t<div id="emptyHint" class="empty hidden">还没有配置，点击右上角「添加域名」开始</div>',
		'\t\t</section>',
		'',
		'\t\t<section class="card">',
		'\t\t\t<div class="card-head">',
		'\t\t\t\t<h2>执行</h2>',
		'\t\t\t\t<span class="hint">保存配置后可立即执行一次</span>',
		'\t\t\t</div>',
		'\t\t\t<div class="btn-group">',
		'\t\t\t\t<button class="btn btn-primary" onclick="saveConfig()">保存配置</button>',
		'\t\t\t\t<button class="btn btn-ghost" onclick="executeTask()">立即执行</button>',
		'\t\t\t</div>',
		'\t\t\t<pre id="logArea" class="log hidden"></pre>',
		'\t\t</section>',
		'\t</div>',
		'',
		'\t<div id="passwordModal" class="modal">',
		'\t\t<div class="modal-content">',
		'\t\t\t<h2>修改登录密码</h2>',
		'\t\t\t<div class="field">',
		'\t\t\t\t<label>新密码</label>',
		'\t\t\t\t<input type="text" id="newPassword" placeholder="输入新密码">',
		'\t\t\t</div>',
		'\t\t\t<div class="btn-group" style="margin-top:16px;justify-content:flex-end;">',
		'\t\t\t\t<button class="btn btn-ghost" onclick="closePasswordModal()">取消</button>',
		'\t\t\t\t<button class="btn btn-primary" onclick="changePassword()">确认修改</button>',
		'\t\t\t</div>',
		'\t\t</div>',
		'\t</div>',
		'',
		'<script>',
		'\tlet config = ' + JSON.stringify(config) + ';',
		'',
		'\tfunction showAlert(message, type = "success") {',
		'\t\tconst alert = document.getElementById("alert");',
		'\t\talert.textContent = message;',
		'\t\talert.className = "alert alert-" + type;',
		'\t\tsetTimeout(() => alert.className = "hidden", 3000);',
		'\t}',
		'',
		'\tfunction renderDomains() {',
		'\t\tconst container = document.getElementById("domainList");',
		'\t\tcontainer.innerHTML = config.domains.map((domain, index) => `',
		'\t\t\t<details class="domain-item" data-index="${index}">',
		'\t\t\t\t<summary class="domain-header">',
		'\t\t\t\t\t<div class="domain-title">',
		'\t\t\t\t\t\t<span class="badge">${index + 1}</span>',
		'\t\t\t\t\t\t<span class="domain-name">${domain.cfDomain || "未配置解析域名"}</span>',
		'\t\t\t\t\t</div>',
		'\t\t\t\t\t<div class="domain-actions">',
		'\t\t\t\t\t\t<button class="btn btn-danger btn-sm" onclick="event.preventDefault(); event.stopPropagation(); removeDomain(${index})">删除</button>',
		'\t\t\t\t\t\t<span class="chev"></span>',
		'\t\t\t\t\t</div>',
		'\t\t\t\t</summary>',
		'\t\t\t\t<div class="domain-body">',
		'',
		'\t\t\t\t<div class="fieldset">',
		'\t\t\t\t\t<div class="fieldset-title">CLOUDFLARE 凭据</div>',
		'\t\t\t\t\t<div class="grid grid-2">',
		'\t\t\t\t\t\t<div class="field">',
		'\t\t\t\t\t\t\t<label>CF 登录邮箱</label>',
		'\t\t\t\t\t\t\t<input type="text" data-field="cfMail" placeholder="admin@gmail.com" value="${domain.cfMail || ""}">',
		'\t\t\t\t\t\t</div>',
		'\t\t\t\t\t\t<div class="field">',
		'\t\t\t\t\t\t\t<label>CF 待解析域名</label>',
		'\t\t\t\t\t\t\t<input type="text" data-field="cfDomain" placeholder="ddns.google.com" value="${domain.cfDomain || ""}">',
		'\t\t\t\t\t\t</div>',
		'\t\t\t\t\t\t<div class="field">',
		'\t\t\t\t\t\t\t<label>CF Zone ID</label>',
		'\t\t\t\t\t\t\t<input type="text" data-field="cfZoneId" placeholder="区域 ID" value="${domain.cfZoneId || ""}">',
		'\t\t\t\t\t\t</div>',
		'\t\t\t\t\t\t<div class="field">',
		'\t\t\t\t\t\t\t<label>CF API Token</label>',
		'\t\t\t\t\t\t\t<input type="text" data-field="cfKey" placeholder="API 令牌" value="${domain.cfKey || ""}">',
		'\t\t\t\t\t\t</div>',
		'\t\t\t\t\t</div>',
		'\t\t\t\t</div>',
		'',
		'\t\t\t\t<div class="fieldset">',
		'\t\t\t\t\t<div class="fieldset-title">解析来源</div>',
		'\t\t\t\t\t<div class="grid">',
		'\t\t\t\t\t\t<div class="field">',
		'\t\t\t\t\t\t\t<label>DoH URL</label>',
		'\t\t\t\t\t\t\t<input type="text" data-field="doh" placeholder="https://cloudflare-dns.com/dns-query" value="${domain.doh || ""}">',
		'\t\t\t\t\t\t</div>',
		'\t\t\t\t\t\t<div class="field">',
		'\t\t\t\t\t\t\t<label>解析域名（逗号或换行分隔）</label>',
		'\t\t\t\t\t\t\t<textarea data-field="domains" placeholder="cdn.example.com, cdn2.example.com">${domain.domains || ""}</textarea>',
		'\t\t\t\t\t\t</div>',
		'\t\t\t\t\t</div>',
		'\t\t\t\t</div>',
		'',
		'\t\t\t\t<div class="fieldset">',
		'\t\t\t\t\t<div class="fieldset-title">IP 来源与排除</div>',
		'\t\t\t\t\t<div class="grid grid-2">',
		'\t\t\t\t\t\t<div class="field">',
		'\t\t\t\t\t\t\t<label>IPv4（逗号或换行分隔）</label>',
		'\t\t\t\t\t\t\t<textarea data-field="ipv4" placeholder="8.8.8.8, 1.1.1.1">${domain.ipv4 || ""}</textarea>',
		'\t\t\t\t\t\t</div>',
		'\t\t\t\t\t\t<div class="field">',
		'\t\t\t\t\t\t\t<label>IPv6（逗号或换行分隔）</label>',
		'\t\t\t\t\t\t\t<textarea data-field="ipv6" placeholder="2406:8dc0:...">${domain.ipv6 || ""}</textarea>',
		'\t\t\t\t\t\t</div>',
		'\t\t\t\t\t\t<div class="field">',
		'\t\t\t\t\t\t\t<label>封禁 IP（逗号或换行分隔）</label>',
		'\t\t\t\t\t\t\t<textarea data-field="banIp" placeholder="1.1.1.1">${domain.banIp || ""}</textarea>',
		'\t\t\t\t\t\t</div>',
		'\t\t\t\t\t\t<div class="field">',
		'\t\t\t\t\t\t\t<label>IP API（逗号或换行分隔）</label>',
		'\t\t\t\t\t\t\t<textarea data-field="ipApi" placeholder="https://example.com/api/ip">${domain.ipApi || ""}</textarea>',
		'\t\t\t\t\t\t</div>',
		'\t\t\t\t\t</div>',
		'\t\t\t\t</div>',
		'\t\t\t\t</div>',
		'\t\t\t</details>',
		'\t\t`).join("");',
		'',
		'\t\tdocument.getElementById("emptyHint").classList.toggle("hidden", config.domains.length > 0);',
		'\t\tdocument.getElementById("tgToken").value = config.tgToken || "";',
		'\t\tdocument.getElementById("tgId").value = config.tgId || "";',
		'\t}',
		'',
		'\tfunction collectConfig() {',
		'\t\tconst domains = [];',
		'\t\tdocument.querySelectorAll(".domain-item").forEach(item => {',
		'\t\t\tconst domain = {};',
		'\t\t\titem.querySelectorAll("[data-field]").forEach(input => {',
		'\t\t\t\tdomain[input.dataset.field] = input.value;',
		'\t\t\t});',
		'\t\t\tdomains.push(domain);',
		'\t\t});',
		'\t\treturn {',
		'\t\t\ttgToken: document.getElementById("tgToken").value,',
		'\t\t\ttgId: document.getElementById("tgId").value,',
		'\t\t\tdomains',
		'\t\t};',
		'\t}',
		'',
		'\tfunction addDomain() {',
		'\t\tconfig = collectConfig();',
		'\t\tconfig.domains.push({});',
		'\t\trenderDomains();',
		'\t}',
		'',
		'\tfunction removeDomain(index) {',
		'\t\tconfig = collectConfig();',
		'\t\tconfig.domains.splice(index, 1);',
		'\t\trenderDomains();',
		'\t}',
		'',
		'\tasync function saveConfig() {',
		'\t\tconfig = collectConfig();',
		'\t\tconst response = await fetch("/api/save-config", {',
		'\t\t\tmethod: "POST",',
		'\t\t\theaders: { "Content-Type": "application/json" },',
		'\t\t\tbody: JSON.stringify(config)',
		'\t\t});',
		'\t\tconst result = await response.json();',
		'\t\tif (result.success) showAlert("配置保存成功！");',
		'\t\telse showAlert("保存失败: " + result.error, "danger");',
		'\t}',
		'',
		'\tfunction showChangePasswordModal() {',
		'\t\tdocument.getElementById("passwordModal").classList.add("show");',
		'\t}',
		'',
		'\tfunction closePasswordModal() {',
		'\t\tdocument.getElementById("passwordModal").classList.remove("show");',
		'\t}',
		'',
		'\tasync function changePassword() {',
		'\t\tconst newPassword = document.getElementById("newPassword").value;',
		'\t\tif (!newPassword) {',
		'\t\t\tshowAlert("密码不能为空", "danger");',
		'\t\t\treturn;',
		'\t\t}',
		'\t\tconst response = await fetch("/api/change-password", {',
		'\t\t\tmethod: "POST",',
		'\t\t\theaders: { "Content-Type": "application/json" },',
		'\t\t\tbody: JSON.stringify({ newPassword })',
		'\t\t});',
		'\t\tconst result = await response.json();',
		'\t\tif (result.success) {',
		'\t\t\tshowAlert("密码修改成功！请重新登录");',
		'\t\t\tsetTimeout(() => {',
		'\t\t\t\tdocument.location.href = "/login";',
		'\t\t\t}, 1500);',
		'\t\t} else {',
		'\t\t\tshowAlert("密码修改失败: " + result.error, "danger");',
		'\t\t}',
		'\t}',
		'',
		'\tasync function executeTask() {',
		'\t\tconst logArea = document.getElementById("logArea");',
		'\t\tlogArea.classList.remove("hidden");',
		'\t\tlogArea.innerHTML = "执行中...\\n";',
		'',
		'\t\ttry {',
		'\t\t\tconst configData = collectConfig();',
		'\t\t\tconst response = await fetch("/execute", {',
		'\t\t\t\tmethod: "POST",',
		'\t\t\t\theaders: { "Content-Type": "application/json" },',
		'\t\t\t\tbody: JSON.stringify(configData)',
		'\t\t\t});',
		'\t\t\tconst result = await response.json();',
		'\t\t\tlogArea.innerHTML = result.log || "执行完成";',
		'\t\t} catch (e) {',
		'\t\t\tlogArea.innerHTML = "错误: " + e.message;',
		'\t\t}',
		'\t}',
		'',
		'\trenderDomains();',
		'</script>',
		'</body>',
		'</html>'
	];
	return new Response(parts.join('\n'), {
		headers: { 'Content-Type': 'text/html; charset=utf-8' }
	});
}

async function executeTask(env) {
	const KV = env.DnsIp || null;
	const config = await getConfig(KV);
	const log = [];
	const results = await executeTaskForAllDomains(config, KV, log);
	return new Response(JSON.stringify({ success: true, log: log.join('\n'), results }), {
		headers: { 'Content-Type': 'application/json' }
	});
}

async function executeTaskForAllDomains(config, KV, logRef = null) {
	const results = [];
	const log = logRef || [];
	
	for (const domainConfig of config.domains) {
		if (!domainConfig.cfDomain || !domainConfig.cfZoneId || !domainConfig.cfKey) {
			log?.push('跳过配置不完整的域名');
			continue;
		}
		try {
			const result = await processDomain(domainConfig, log);
			results.push(result);
		} catch (e) {
			log?.push('处理域名 ' + domainConfig.cfDomain + ' 出错: ' + e.message);
			results.push({ 
				domain: domainConfig.cfDomain, 
				success: false, 
				error: e.message,
				successCount: 0,
				failCount: 0,
				ipv4List: [],
				ipv6List: []
			});
		}
	}
	
	// 发送TG通知
	if (config.tgToken && config.tgId && results.length > 0) {
		try {
			let totalMessage = 'ZQ-DnsIp:\n';
			// 把所有域名的信息合并到一条消息中
			for (const result of results) {
				totalMessage += `\n${result.domain} 解析完成! 成功: ${result.successCount} 失败: ${result.failCount}`;
				// 添加IPv4记录
				if (result.ipv4List && result.ipv4List.length > 0) {
					for (const ip of result.ipv4List) {
						totalMessage += `\nA记录: ${ip}`;
					}
				}
				// 添加IPv6记录
				if (result.ipv6List && result.ipv6List.length > 0) {
					for (const ip of result.ipv6List) {
						totalMessage += `\nAAAA记录: ${ip}`;
					}
				}
			}
			// 只发送一条通知
			await sendTGMessage(config.tgToken, config.tgId, totalMessage);
			log?.push('TG通知发送成功');
		} catch (e) {
			log?.push('TG通知发送失败: ' + e.message);
		}
	}
	
	return results;
}

async function processDomain(config, log) {
	const domain = config.cfDomain;
	log?.push('开始处理域名: ' + domain);
	
	// 解析IP
	const ipv4 = await parseIPList(config.ipv4);
	const ipv6 = await parseIPList(config.ipv6);
	const banIp = await parseIPList(config.banIp);
	
	// 从域名解析
	const domainList = await parseIPList(config.domains);
	const dnsResult = await resolveDomains(domainList, config.doh || 'https://cloudflare-dns.com/dns-query', log);
	
	// 从API获取
	const apiList = await parseIPList(config.ipApi);
	const apiResult = await fetchFromAPIs(apiList, log);
	
	// 合并和过滤IP
	let allIPv4 = [...ipv4, ...dnsResult.ipv4, ...apiResult.ipv4];
	let allIPv6 = [...ipv6, ...dnsResult.ipv6, ...apiResult.ipv6];
	
	// 去重
	allIPv4 = [...new Set(allIPv4)];
	allIPv6 = [...new Set(allIPv6)];
	
	// 过滤封禁IP
	allIPv4 = allIPv4.filter(ip => !banIp.includes(ip));
	allIPv6 = allIPv6.filter(ip => !banIp.includes(ip));
	
	// 限制数量
	const maxIPs = 10;
	if (allIPv4.length + allIPv6.length > maxIPs) {
		const all = [...allIPv4, ...allIPv6].sort(() => 0.5 - Math.random()).slice(0, maxIPs);
		allIPv4 = all.filter(ip => /^\d+\.\d+\.\d+\.\d+$/.test(ip));
		allIPv6 = all.filter(ip => !/^\d+\.\d+\.\d+\.\d+$/.test(ip));
		log?.push('IP数量超过' + maxIPs + '个，已随机保留' + maxIPs + '个');
	}
	
	log?.push('最终IPv4: ' + allIPv4.length + '个, IPv6: ' + allIPv6.length + '个');
	
	// 更新Cloudflare DNS
	const updateResult = await updateCloudflareDNS(config, allIPv4, allIPv6, log);
	
	return { 
		domain, 
		success: updateResult.success, 
		successCount: updateResult.successCount, 
		failCount: updateResult.failCount,
		ipv4List: allIPv4,
		ipv6List: allIPv6
	};
}

async function parseIPList(str) {
	if (!str) return [];
	return str.replace(/[ \t\r\n]+/g, ',').replace(/,+/g, ',').replace(/^,|,$/g, '').split(',').filter(Boolean);
}

async function resolveDomains(domains, dohUrl, log) {
	let ipv4 = [], ipv6 = [];
	const 批次大小 = 5; // 每批解析5个域名
	const 批次间隔 = 1000; // 批次间隔1秒

	for (let i = 0; i < domains.length; i += 批次大小) {
		const 当前批次 = domains.slice(i, i + 批次大小);
		
		// 并发解析当前批次的域名
		const 解析promises = 当前批次.map(async domain => {
			try {
				// 获取域名的A记录
				const aRecords = await fetchDNS(domain, 'A', dohUrl);
				for (const record of aRecords) {
					if (record.type === 1) { // A记录
						ipv4.push(record.data);
						log?.push('解析 ' + domain + ' A记录' + record.data);
					}
				}
				
				// 获取域名的AAAA记录
				const aaaaRecords = await fetchDNS(domain, 'AAAA', dohUrl);
				for (const record of aaaaRecords) {
					if (record.type === 28) { // AAAA记录
						ipv6.push(record.data);
						log?.push('解析 ' + domain + ' AAAA记录' + record.data);
					}
				}
			} catch (e) {
				log?.push('解析 ' + domain + ' 失败: ' + e.message);
			}
		});
		
		await Promise.all(解析promises);
		
		// 如果还有下一批，则等待指定的间隔时间
		if (i + 批次大小 < domains.length) {
			await new Promise(resolve => setTimeout(resolve, 批次间隔));
		}
	}
	
	return { ipv4, ipv6 };
}

async function fetchDNS(domain, type, dohUrl) {
	for (let i = 0; i < 3; i++) { // 重试3次
		try {
			const url = new URL(dohUrl);
			url.searchParams.set('name', domain);
			url.searchParams.set('type', type);
			const response = await fetch(url.toString(), {
				headers: { 'Accept': 'application/dns-json' }
			});
			
			if (!response.ok) {
				throw new Error('获取DNS记录失败: ' + response.statusText);
			}
			
			const data = await response.json();
			return data.Answer || [];
		} catch (e) {
			if (i === 2) throw e; // 最后一次重试失败
			await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1))); // 指数退避重试
		}
	}
}

async function fetchFromAPIs(apis, log) {
	let ipv4 = [], ipv6 = [];
	if (!apis || apis.length === 0) {
		return { ipv4, ipv6 };
	}

	let newIP = '';
	const 批次大小 = 3; // 每批调用3个API
	const 批次间隔 = 1500; // 批次间隔1.5秒

	for (let i = 0; i < apis.length; i += 批次大小) {
		const 当前批次 = apis.slice(i, i + 批次大小);
		
		// 创建一个AbortController对象，用于控制fetch请求的取消
		const controller = new AbortController();

		const timeout = setTimeout(() => {
			controller.abort(); // 取消所有请求
		}, 5000); // 5秒后触发

		try {
			// 使用Promise.allSettled等待当前批次的API请求完成
			const responses = await Promise.allSettled(当前批次.map(apiUrl => fetch(apiUrl, {
				method: 'get', 
				headers: {
					'Accept': 'text/html,application/xhtml+xml,application/xml;',
					'User-Agent': 'cmliu/CF-Workers-DD2D'
				},
				signal: controller.signal // 将AbortController的信号量添加到fetch请求中
			}).then(response => response.ok ? response.text() : Promise.reject())));

			// 遍历所有响应
			for (const response of responses) {
				// 检查响应状态是否为'fulfilled'，即请求成功完成
				if (response.status === 'fulfilled') {
					// 获取响应的内容
					const content = response.value;
					newIP += content + '\n';
				}
			}
		} catch (error) {
			log?.push('API批量请求出错: ' + error.message);
		} finally {
			// 无论成功或失败，最后都清除设置的超时定时器
			clearTimeout(timeout);
		}
		
		// 如果还有下一批，则等待指定的间隔时间
		if (i + 批次大小 < apis.length) {
			await new Promise(resolve => setTimeout(resolve, 批次间隔));
		}
	}

	const newIPs = parseIPListSync(newIP);
	// 正则表达式匹配IPv4地址
	const ipv4Regex = /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;

	// 正则表达式匹配IPv6地址
	const ipv6Regex = /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9])?[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9])?[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9])?[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9])?[0-9]))$/;

	newIPs.forEach(ip => {
		if (ipv4Regex.test(ip)) {
			ipv4.push(ip);
			log?.push('API获取 A记录' + ip);
		} else if (ipv6Regex.test(ip)) {
			ipv6.push(ip);
			log?.push('API获取 AAAA记录' + ip);
		}
	});

	return { ipv4, ipv6 };
}

function parseIPListSync(str) {
	if (!str) return [];
	return str.replace(/[ \t\r\n]+/g, ',').replace(/,+/g, ',').replace(/^,|,$/g, '').split(',').filter(Boolean);
}

async function updateCloudflareDNS(config, ipv4List, ipv6List, log) {
	const zoneId = config.cfZoneId;
	const cfMail = config.cfMail;
	const cfKey = config.cfKey;
	const domain = config.cfDomain;
	
	// 获取现有记录
	const listUrl = 'https://api.cloudflare.com/client/v4/zones/' + zoneId + '/dns_records?name=' + domain;
	const listResponse = await fetch(listUrl, {
		headers: {
			'X-Auth-Email': cfMail,
			'Authorization': 'Bearer ' + cfKey,
			'Content-Type': 'application/json'
		}
	});
	const listData = await listResponse.json();
	console.log(JSON.stringify(listData, null, 2));
	
	let 域名现有解析ID = [];
	if (!listData.success || listData.result.length === 0) {
		log?.push(domain + ' 域名解析为空，跳过删除域名流程');
	} else {
		for (const record of listData.result) {
			域名现有解析ID.push(record.id);
		}
		log?.push('现有域名ID\n' + 域名现有解析ID.join('\n'));
	}

	// 批量删除域名
	await 批量删除域名(域名现有解析ID, zoneId, cfMail, cfKey, domain, log);

	await new Promise(resolve => setTimeout(resolve, 8000));

	// 构建解析记录列表
	const 解析记录列表 = [...ipv4List.map(ip => ({ type: 'A', content: ip })), ...ipv6List.map(ip => ({ type: 'AAAA', content: ip }))];

	// 调用批量添加解析
	const result = await 批量添加解析(解析记录列表, zoneId, cfMail, cfKey, domain, log);
	
	return result;
}

async function 批量删除域名(域名ID数组, zoneId, cfMail, cfKey, domain, log) {
	const 批次大小 = 3; // 每批删除3个域名
	const 批次间隔 = 2000; // 批次间隔2秒

	for (let i = 0; i < 域名ID数组.length; i += 批次大小) {
		const 当前批次 = 域名ID数组.slice(i, i + 批次大小);
		
		// 并发删除当前批次的域名
		const 删除promises = 当前批次.map(域名ID => 删除域名(域名ID, zoneId, cfMail, cfKey, domain, log));
		const results = await Promise.allSettled(删除promises);
		
		results.forEach((result, index) => {
			if (result.status === 'fulfilled') {
				log?.push(domain + ':' + 当前批次[index] + ' 删除成功');
			} else {
				log?.push(domain + ':' + 当前批次[index] + ' 删除失败: ' + result.reason);
			}
		});

		// 如果还有下一批，则等待指定的间隔时间
		if (i + 批次大小 < 域名ID数组.length) {
			await new Promise(resolve => setTimeout(resolve, 批次间隔));
		}
	}
}

// 删除单个域名的函数
async function 删除域名(域名ID, zoneId, cfMail, cfKey, domain, log) {
	const 删除域名_URL = 'https://api.cloudflare.com/client/v4/zones/' + zoneId + '/dns_records/' + 域名ID;
	const response = await fetch(删除域名_URL, {
		method: 'DELETE',
		headers: {
			'X-Auth-Email': cfMail,
			'Authorization': 'Bearer ' + cfKey,
			'Content-Type': 'application/json'
		}
	});
	const data = await response.json();
	console.log(JSON.stringify(data, null, 2));
	if (!data.success) {
		throw new Error('删除失败: ' + JSON.stringify(data.errors));
	}
}

async function 批量添加解析(解析记录列表, zoneId, cfMail, cfKey, domain, log) {
	let 解析成功次数 = 0, 解析失败次数 = 0;
	const 批次大小 = 3; // 每批添加3个解析记录
	const 批次间隔 = 2000; // 批次间隔2秒

	for (let i = 0; i < 解析记录列表.length; i += 批次大小) {
		const 当前批次 = 解析记录列表.slice(i, i + 批次大小);
		
		// 并发发送当前批次的请求
		await Promise.all(当前批次.map(记录 => 添加解析(记录.type, 记录.content, zoneId, cfMail, cfKey, domain, log).then(success => {
			if (success) 解析成功次数++;
			else 解析失败次数++;
		})));
		
		// 如果还有下一批，则等待指定的间隔时间
		if (i + 批次大小 < 解析记录列表.length) {
			await new Promise(resolve => setTimeout(resolve, 批次间隔));
		}
	}

	log?.push(domain + ' 更新完成: 成功' + 解析成功次数 + ', 失败' + 解析失败次数);
	return { success: 解析失败次数 === 0, successCount: 解析成功次数, failCount: 解析失败次数 };
}

// 添加解析函数
async function 添加解析(A, IP, zoneId, cfMail, cfKey, domain, log) {
	const 添加解析_URL = 'https://api.cloudflare.com/client/v4/zones/' + zoneId + '/dns_records';
	try {
		const response = await fetch(添加解析_URL, {
			method: 'POST',
			headers: {
			'X-Auth-Email': cfMail,
			'Authorization': 'Bearer ' + cfKey,
			'Content-Type': 'application/json',
			},
			body: JSON.stringify({
			type: A,
			name: domain,
			content: IP,
			ttl: 60,
			proxied: false
			})
		});
		const data = await response.json();
		console.log(JSON.stringify(data, null, 2));
		if (data.success) {
			log?.push(domain + ' 成功 ' + A + '记录: ' + IP);
			return true;
		} else {
			log?.push(domain + ' 失败 ' + A + '记录: ' + IP);
			return false;
		}
	} catch (e) {
		log?.push(domain + ' 失败 ' + A + '记录: ' + IP);
		return false;
	}
}

async function sendTGMessage(token, chatId, text) {
	const url = 'https://api.telegram.org/bot' + token + '/sendMessage';
	await fetch(url, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			chat_id: chatId,
			text: text,
			parse_mode: 'HTML'
		})
	});
}
