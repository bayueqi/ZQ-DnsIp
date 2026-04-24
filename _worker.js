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

function showSetupPage(error = '') {
	let html = '<!DOCTYPE html>\n<html lang="zh-CN">\n<head>\n\t<meta charset="UTF-8">\n\t<meta name="viewport" content="width=device-width, initial-scale=1.0">\n\t<link rel="icon" href="https://img.520jacky.dpdns.org/i/2026/04/24/549044.svg" type="image/svg+xml">\n\t<title>ZQ-DnsIp - 设置密码</title>\n\t<style>\n\t\t* { margin: 0; padding: 0; box-sizing: border-box; }\n\t\tbody {\n\t\t\tfont-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif;\n\t\t\tbackground: linear-gradient(135deg, #667eea 0%, #764ba2 100%);\n\t\t\tmin-height: 100vh;\n\t\t\tdisplay: flex;\n\t\t\tjustify-content: center;\n\t\t\talign-items: center;\n\t\t\tpadding: 20px;\n\t\t}\n\t\t.container {\n\t\t\tbackground: white;\n\t\t\tborder-radius: 15px;\n\t\t\tpadding: 40px;\n\t\t\tmax-width: 500px;\n\t\t\twidth: 100%;\n\t\t\tbox-shadow: 0 10px 40px rgba(0,0,0,0.2);\n\t\t}\n\t\th1 { color: #333; margin-bottom: 20px; text-align: center; }\n\t\t.info {\n\t\t\tbackground: #d4edda;\n\t\t\tcolor: #155724;\n\t\t\tpadding: 15px;\n\t\t\tborder-radius: 8px;\n\t\t\tmargin-bottom: 20px;\n\t\t\tborder: 1px solid #c3e6cb;\n\t\t}\n\t\t.form-group { margin-bottom: 20px; }\n\t\tlabel { display: block; margin-bottom: 8px; color: #555; font-weight: 600; }\n\t\tinput[type="password"], input[type="text"] {\n\t\t\twidth: 100%;\n\t\t\tpadding: 12px 15px;\n\t\t\tborder: 2px solid #e0e0e0;\n\t\t\tborder-radius: 8px;\n\t\t\tfont-size: 16px;\n\t\t}\n\t\tinput:focus {\n\t\t\toutline: none;\n\t\t\tborder-color: #667eea;\n\t\t}\n\t\t.error {\n\t\t\tbackground: #f8d7da;\n\t\t\tcolor: #721c24;\n\t\t\tpadding: 10px;\n\t\t\tborder-radius: 8px;\n\t\t\tmargin-bottom: 20px;\n\t\t\tborder: 1px solid #f5c6cb;\n\t\t}\n\t\t.btn {\n\t\t\twidth: 100%;\n\t\t\tpadding: 15px;\n\t\t\tbackground: linear-gradient(135deg, #667eea 0%, #764ba2 100%);\n\t\t\tcolor: white;\n\t\t\tborder: none;\n\t\t\tborder-radius: 8px;\n\t\t\tfont-size: 16px;\n\t\t\tfont-weight: bold;\n\t\t\tcursor: pointer;\n\t\t}\n\t</style>\n</head>\n<body>\n\t<div class="container">\n\t\t<h1>🎉 欢迎使用 ZQ-DnsIp</h1>\n\t\t<div class="info">\n\t\t\t<p><strong>首次使用，请设置你的登录密码</strong></p>\n\t\t</div>';
	if (error) {
		html += '<div class="error">' + error + '</div>';
	}
	html += '\n\t\t<form method="post" action="/setup">\n\t\t\t<div class="form-group">\n\t\t\t\t<label>设置登录密码</label>\n\t\t\t\t<input type="text" name="token" placeholder="请输入你想设置的密码" required autocomplete="off">\n\t\t\t</div>\n\t\t\t<button type="submit" class="btn">保存密码</button>\n\t\t</form>\n\t</div>\n</body>\n</html>';
	return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}

function showLoginPage(error = '') {
	let html = '<!DOCTYPE html>\n<html lang="zh-CN">\n<head>\n\t<meta charset="UTF-8">\n\t<meta name="viewport" content="width=device-width, initial-scale=1.0">\n\t<link rel="icon" href="https://img.520jacky.dpdns.org/i/2026/04/24/549044.svg" type="image/svg+xml">\n\t<title>ZQ-DnsIp - 登录</title>\n\t<style>\n\t\t* { margin: 0; padding: 0; box-sizing: border-box; }\n\t\tbody {\n\t\t\tfont-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif;\n\t\t\tbackground: linear-gradient(135deg, #667eea 0%, #764ba2 100%);\n\t\t\tmin-height: 100vh;\n\t\t\tdisplay: flex;\n\t\t\tjustify-content: center;\n\t\t\talign-items: center;\n\t\t\tpadding: 20px;\n\t\t}\n\t\t.container {\n\t\t\tbackground: white;\n\t\t\tborder-radius: 15px;\n\t\t\tpadding: 40px;\n\t\t\tmax-width: 400px;\n\t\t\twidth: 100%;\n\t\t\tbox-shadow: 0 10px 40px rgba(0,0,0,0.2);\n\t\t}\n\t\th1 { color: #333; margin-bottom: 30px; text-align: center; }\n\t\t.form-group { margin-bottom: 20px; }\n\t\tlabel { display: block; margin-bottom: 8px; color: #555; font-weight: 600; }\n\t\tinput[type="password"] {\n\t\t\twidth: 100%;\n\t\t\tpadding: 12px 15px;\n\t\t\tborder: 2px solid #e0e0e0;\n\t\t\tborder-radius: 8px;\n\t\t\tfont-size: 16px;\n\t\t}\n\t\tinput[type="password"]:focus {\n\t\t\toutline: none;\n\t\t\tborder-color: #667eea;\n\t\t}\n\t\t.error {\n\t\t\tbackground: #f8d7da;\n\t\t\tcolor: #721c24;\n\t\t\tpadding: 10px;\n\t\t\tborder-radius: 8px;\n\t\t\tmargin-bottom: 20px;\n\t\t\tborder: 1px solid #f5c6cb;\n\t\t}\n\t\t.btn {\n\t\t\twidth: 100%;\n\t\t\tpadding: 15px;\n\t\t\tbackground: linear-gradient(135deg, #667eea 0%, #764ba2 100%);\n\t\t\tcolor: white;\n\t\t\tborder: none;\n\t\t\tborder-radius: 8px;\n\t\t\tfont-size: 16px;\n\t\t\tfont-weight: bold;\n\t\t\tcursor: pointer;\n\t\t}\n\t</style>\n</head>\n<body>\n\t<div class="container">\n\t\t<h1>🔐 登录 ZQ-DnsIp</h1>';
	if (error) {
		html += '<div class="error">' + error + '</div>';
	}
	html += '\n\t\t<form method="post" action="/login">\n\t\t\t<div class="form-group">\n\t\t\t\t<label>请输入密码</label>\n\t\t\t\t<input type="password" name="token" placeholder="输入你的登录密码" required>\n\t\t\t</div>\n\t\t\t<button type="submit" class="btn">登录</button>\n\t\t</form>\n\t</div>\n</body>\n</html>';
	return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}

function showDashboard(config, token) {
	const html = '<!DOCTYPE html>\n<html lang="zh-CN">\n<head>\n\t<meta charset="UTF-8">\n\t<meta name="viewport" content="width=device-width, initial-scale=1.0">\n\t<link rel="icon" href="https://img.520jacky.dpdns.org/i/2026/04/24/549044.svg" type="image/svg+xml">\n\t<title>ZQ-DnsIp - 管理面板</title>\n\t<style>\n\t\t* { margin: 0; padding: 0; box-sizing: border-box; }\n\t\tbody {\n\t\t\tfont-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif;\n\t\t\tbackground: #f5f7fa;\n\t\t\tcolor: #333;\n\t\t}\n\t\t.header {\n\t\t\tbackground: linear-gradient(135deg, #667eea 0%, #764ba2 100%);\n\t\t\tcolor: white;\n\t\t\tpadding: 20px 30px;\n\t\t\tdisplay: flex;\n\t\t\tjustify-content: space-between;\n\t\t\talign-items: center;\n\t\t}\n\t\t.container { max-width: 1200px; margin: 30px auto; padding: 0 20px; }\n\t\t.card {\n\t\t\tbackground: white;\n\t\t\tborder-radius: 10px;\n\t\t\tpadding: 25px;\n\t\t\tmargin-bottom: 20px;\n\t\t\tbox-shadow: 0 2px 10px rgba(0,0,0,0.1);\n\t\t}\n\t\t.card h2 { color: #667eea; margin-bottom: 20px; display: flex; align-items: center; gap: 10px; }\n\t\t.form-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 15px; margin-bottom: 15px; }\n\t\t.form-group { margin-bottom: 15px; }\n\t\tlabel { display: block; margin-bottom: 8px; color: #555; font-weight: 600; font-size: 14px; }\n\t\tinput[type="text"], textarea, select {\n\t\t\twidth: 100%;\n\t\t\tpadding: 10px 12px;\n\t\t\tborder: 2px solid #e0e0e0;\n\t\t\tborder-radius: 6px;\n\t\t\tfont-size: 14px;\n\t\t}\n\t\ttextarea { min-height: 80px; resize: vertical; }\n\t\t.domain-item {\n\t\t\tbackground: #f8f9fa;\n\t\t\tborder: 1px solid #e0e0e0;\n\t\t\tborder-radius: 8px;\n\t\t\tpadding: 20px;\n\t\t\tmargin-bottom: 15px;\n\t\t}\n\t\t.domain-header {\n\t\t\tdisplay: flex;\n\t\t\tjustify-content: space-between;\n\t\t\talign-items: center;\n\t\t\tmargin-bottom: 15px;\n\t\t\tpadding-bottom: 10px;\n\t\t\tborder-bottom: 1px solid #e0e0e0;\n\t\t}\n\t\t.btn {\n\t\t\tpadding: 10px 20px;\n\t\t\tborder: none;\n\t\t\tborder-radius: 6px;\n\t\t\tfont-size: 14px;\n\t\t\tfont-weight: 600;\n\t\t\tcursor: pointer;\n\t\t\ttransition: all 0.3s;\n\t\t}\n\t\t.btn-primary { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; }\n\t\t.btn-success { background: #28a745; color: white; }\n\t\t.btn-danger { background: #dc3545; color: white; }\n\t\t.btn-secondary { background: #6c757d; color: white; }\n\t\t.btn:hover { transform: translateY(-2px); box-shadow: 0 3px 10px rgba(0,0,0,0.2); }\n\t\t.btn-group { display: flex; gap: 10px; flex-wrap: wrap; }\n\t\t.log-area {\n\t\t\tbackground: #1e1e1e;\n\t\t\tcolor: #d4d4d4;\n\t\t\tfont-family: "Courier New", monospace;\n\t\t\tpadding: 15px;\n\t\t\tborder-radius: 8px;\n\t\t\tmax-height: 300px;\n\t\t\toverflow-y: auto;\n\t\t\tmargin-top: 15px;\n\t\t}\n\t\t.hidden { display: none; }\n\t\t.alert { padding: 15px; border-radius: 8px; margin-bottom: 15px; }\n\t\t.alert-success { background: #d4edda; color: #155724; border: 1px solid #c3e6cb; }\n\t\t.alert-danger { background: #f8d7da; color: #721c24; border: 1px solid #f5c6cb; }\n\t\t.modal {\n\t\t\tdisplay: none;\n\t\t\tposition: fixed;\n\t\t\ttop: 0;\n\t\t\tleft: 0;\n\t\t\twidth: 100%;\n\t\t\theight: 100%;\n\t\t\tbackground: rgba(0,0,0,0.5);\n\t\t\tjustify-content: center;\n\t\t\talign-items: center;\n\t\t\tz-index: 1000;\n\t\t}\n\t\t.modal.show { display: flex; }\n\t\t.modal-content {\n\t\t\tbackground: white;\n\t\t\tborder-radius: 10px;\n\t\t\tpadding: 30px;\n\t\t\tmax-width: 400px;\n\t\t\twidth: 90%;\n\t\t}\n\t</style>\n</head>\n<body>\n\t<div class="header">\n\t\t<h1>🎛️ ZQ-DnsIp 管理面板</h1>\n\t\t<button class="btn btn-secondary" onclick="showChangePasswordModal()">修改密码</button>\n\t</div>\n\t\n\t<div class="container">\n\t\t<div id="alert" class="hidden"></div>\n\t\t\n\t\t<!-- Telegram配置 -->\n\t\t<div class="card">\n\t\t\t<h2>📱 Telegram 通知配置</h2>\n\t\t\t<div class="form-row">\n\t\t\t\t<div class="form-group">\n\t\t\t\t\t<label>TG Bot Token</label>\n\t\t\t\t\t<input type="text" id="tgToken" placeholder="例如: 123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11">\n\t\t\t\t</div>\n\t\t\t\t<div class="form-group">\n\t\t\t\t\t<label>TG Chat ID</label>\n\t\t\t\t\t<input type="text" id="tgId" placeholder="例如: 123456789">\n\t\t\t\t</div>\n\t\t\t</div>\n\t\t</div>\n\t\t\n\t\t<!-- 域名配置列表 -->\n\t\t<div class="card">\n\t\t\t<h2>🌐 域名配置</h2>\n\t\t\t<div id="domainList"></div>\n\t\t\t<button class="btn btn-primary" onclick="addDomain()">+ 添加域名</button>\n\t\t</div>\n\t\t\n\t\t<!-- 操作按钮 -->\n\t\t<div class="card">\n\t\t\t<div class="btn-group">\n\t\t\t\t<button class="btn btn-success" onclick="saveConfig()">💾 保存配置</button>\n\t\t\t\t<button class="btn btn-primary" onclick="executeTask()">▶️ 立即执行</button>\n\t\t\t</div>\n\t\t\t<div id="logArea" class="log-area hidden"></div>\n\t\t</div>\n\t</div>\n\n\t<!-- 修改密码模态框 -->\n\t<div id="passwordModal" class="modal">\n\t\t<div class="modal-content">\n\t\t\t<h2>修改登录密码</h2>\n\t\t\t<div class="form-group">\n\t\t\t\t<label>新密码</label>\n\t\t\t\t<input type="text" id="newPassword" placeholder="输入新密码">\n\t\t\t</div>\n\t\t\t<div class="btn-group">\n\t\t\t\t<button class="btn btn-primary" onclick="changePassword()">确认修改</button>\n\t\t\t\t<button class="btn btn-secondary" onclick="closePasswordModal()">取消</button>\n\t\t\t</div>\n\t\t</div>\n\t</div>\n\n<script>\n\tlet config = ' + JSON.stringify(config) + ';\n\t\n\tfunction showAlert(message, type = "success") {\n\t\tconst alert = document.getElementById("alert");\n\t\talert.textContent = message;\n\t\talert.className = "alert alert-" + type;\n\t\tsetTimeout(() => alert.className = "hidden", 3000);\n\t}\n\t\n\tfunction renderDomains() {\n\t\tconst container = document.getElementById("domainList");\n\t\tcontainer.innerHTML = config.domains.map((domain, index) => `\n\t\t\t<div class="domain-item" data-index="${index}">\n\t\t\t\t<div class="domain-header">\n\t\t\t\t\t<strong>域名: ${domain.cfDomain || "未命名"}</strong>\n\t\t\t\t\t<button class="btn btn-danger" onclick="removeDomain(${index})">删除</button>\n\t\t\t\t</div>\n\t\t\t\t<div class="form-row">\n\t\t\t\t\t<div class="form-group">\n\t\t\t\t\t\t<label>CF 登录邮箱</label>\n\t\t\t\t\t\t<input type="text" data-field="cfMail" placeholder="admin@gmail.com" value="${domain.cfMail || ""}">\n\t\t\t\t\t</div>\n\t\t\t\t\t<div class="form-group">\n\t\t\t\t\t\t<label>CF 待解析域名</label>\n\t\t\t\t\t\t<input type="text" data-field="cfDomain" placeholder="ddns.google.com" value="${domain.cfDomain || ""}">\n\t\t\t\t\t</div>\n\t\t\t\t\t<div class="form-group">\n\t\t\t\t\t\t<label>CF Zone ID</label>\n\t\t\t\t\t\t<input type="text" data-field="cfZoneId" placeholder="区域ID" value="${domain.cfZoneId || ""}">\n\t\t\t\t\t</div>\n\t\t\t\t\t<div class="form-group">\n\t\t\t\t\t\t<label>CF API Token</label>\n\t\t\t\t\t\t<input type="text" data-field="cfKey" placeholder="API令牌" value="${domain.cfKey || ""}">\n\t\t\t\t\t</div>\n\t\t\t\t</div>\n\t\t\t\t<div class="form-row">\n\t\t\t\t\t<div class="form-group">\n\t\t\t\t\t\t<label>DoH URL</label>\n\t\t\t\t\t\t<input type="text" data-field="doh" placeholder="默认https://cloudflare-dns.com/dns-query" value="${domain.doh || ""}">\n\t\t\t\t\t</div>\n\t\t\t\t</div>\n\t\t\t\t<div class="form-row">\n\t\t\t\t\t<div class="form-group">\n\t\t\t\t\t\t<label>解析域名 (多个用逗号或换行分隔)</label>\n\t\t\t\t\t\t<textarea data-field="domains" placeholder="cdn.example.com,cdn2.example.com">${domain.domains || ""}</textarea>\n\t\t\t\t\t</div>\n\t\t\t\t</div>\n\t\t\t\t<div class="form-row">\n\t\t\t\t\t<div class="form-group">\n\t\t\t\t\t\t<label>IPv4 (多个用逗号或换行分隔)</label>\n\t\t\t\t\t\t<textarea data-field="ipv4" placeholder="8.8.8.8,1.1.1.1">${domain.ipv4 || ""}</textarea>\n\t\t\t\t\t</div>\n\t\t\t\t\t<div class="form-group">\n\t\t\t\t\t\t<label>IPv6 (多个用逗号或换行分隔)</label>\n\t\t\t\t\t\t<textarea data-field="ipv6" placeholder="2406:8dc0:...">${domain.ipv6 || ""}</textarea>\n\t\t\t\t\t</div>\n\t\t\t\t</div>\n\t\t\t\t<div class="form-row">\n\t\t\t\t\t<div class="form-group">\n\t\t\t\t\t\t<label>封禁IP (多个用逗号或换行分隔)</label>\n\t\t\t\t\t\t<textarea data-field="banIp" placeholder="1.1.1.1">${domain.banIp || ""}</textarea>\n\t\t\t\t\t</div>\n\t\t\t\t\t<div class="form-group">\n\t\t\t\t\t\t<label>IP API (多个用逗号或换行分隔)</label>\n\t\t\t\t\t\t<textarea data-field="ipApi" placeholder="https://example.com/api/ip">${domain.ipApi || ""}</textarea>\n\t\t\t\t\t</div>\n\t\t\t\t</div>\n\t\t\t</div>\n\t\t`).join("");\n\t\t\n\t\tdocument.getElementById("tgToken").value = config.tgToken || "";\n\t\tdocument.getElementById("tgId").value = config.tgId || "";\n\t}\n\t\n\tfunction collectConfig() {\n\t\tconst domains = [];\n\t\tdocument.querySelectorAll(".domain-item").forEach(item => {\n\t\t\tconst domain = {};\n\t\t\titem.querySelectorAll("[data-field]").forEach(input => {\n\t\t\t\tdomain[input.dataset.field] = input.value;\n\t\t\t});\n\t\t\tdomains.push(domain);\n\t\t});\n\t\treturn {\n\t\t\ttgToken: document.getElementById("tgToken").value,\n\t\t\ttgId: document.getElementById("tgId").value,\n\t\t\tdomains\n\t\t};\n\t}\n\t\n\tfunction addDomain() {\n\t\t// 先收集当前配置，避免已输入的值丢失\n\t\tconfig = collectConfig();\n\t\tconfig.domains.push({});\n\t\trenderDomains();\n\t}\n\t\n\tfunction removeDomain(index) {\n\t\t// 先收集当前配置，避免已输入的值丢失\n\t\tconfig = collectConfig();\n\t\tconfig.domains.splice(index, 1);\n\t\trenderDomains();\n\t}\n\t\n\tasync function saveConfig() {\n\t\tconfig = collectConfig();\n\t\tconst response = await fetch("/api/save-config", {\n\t\t\tmethod: "POST",\n\t\t\theaders: { "Content-Type": "application/json" },\n\t\t\tbody: JSON.stringify(config)\n\t\t});\n\t\tconst result = await response.json();\n\t\tif (result.success) showAlert("配置保存成功！");\n\t\telse showAlert("保存失败: " + result.error, "danger");\n\t}\n\t\n\tfunction showChangePasswordModal() {\n\t\tdocument.getElementById("passwordModal").classList.add("show");\n\t}\n\t\n\tfunction closePasswordModal() {\n\t\tdocument.getElementById("passwordModal").classList.remove("show");\n\t}\n\t\n\tasync function changePassword() {\n\t\tconst newPassword = document.getElementById("newPassword").value;\n\t\tif (!newPassword) {\n\t\t\tshowAlert("密码不能为空", "danger");\n\t\t\treturn;\n\t\t}\n\t\tconst response = await fetch("/api/change-password", {\n\t\t\tmethod: "POST",\n\t\t\theaders: { "Content-Type": "application/json" },\n\t\t\tbody: JSON.stringify({ newPassword })\n\t\t});\n\t\tconst result = await response.json();\n\t\tif (result.success) {\n\t\t\tshowAlert("密码修改成功！请重新登录");\n\t\t\tsetTimeout(() => {\n\t\t\t\tdocument.location.href = "/login";\n\t\t\t}, 1500);\n\t\t} else {\n\t\t\tshowAlert("密码修改失败: " + result.error, "danger");\n\t\t}\n\t}\n\t\n\tasync function executeTask() {\n\t\tconst logArea = document.getElementById("logArea");\n\t\tlogArea.classList.remove("hidden");\n\t\tlogArea.innerHTML = "执行中...\\n";\n\t\t\n\t\ttry {\n\t\t\tconst configData = collectConfig();\n\t\t\tconst response = await fetch("/execute", {\n\t\t\t\tmethod: "POST",\n\t\t\t\theaders: { "Content-Type": "application/json" },\n\t\t\t\tbody: JSON.stringify(configData)\n\t\t\t});\n\t\t\tconst result = await response.json();\n\t\t\tlogArea.innerHTML = result.log || "执行完成";\n\t\t} catch (e) {\n\t\t\tlogArea.innerHTML = "错误: " + e.message;\n\t\t}\n\t}\n\t\n\trenderDomains();\n</script>\n</body>\n</html>';
	return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}

// ==================== 任务执行 ====================

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
