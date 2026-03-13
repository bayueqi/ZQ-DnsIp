// 定义域名数组
let domains = [];
// 定义IPv4和IPv6数组，用于存储解析后的IP地址
let IPv4 = [];
let IPv6 = [];
let banIP = [];
// 定义API列表
let ipAPI = [];//'https://ipdb.030101.xyz/api/bestproxy.txt'
// 定义DoH（DNS over HTTPS）URL
let dohURL = 'https://cloudflare-dns.com/dns-query';

//Cloudflare DDNS
let CF邮箱 = '';//admin@gmail.com
let CF域名 = '';//ddns.google.com
let CF区域ID = '';//6f0b34f36efb4bdaf5e22d68ac8e5c96
let CFAPI令牌 = '';//tGb4_4f3efb4bdaf5e22d68ac8exRnJTC6-IWocs

let 执行日志 = '';

let BotToken ='';
let ChatID =''; 
let tgmsg = '';

let 解析成功次数 = 0;
let 解析失败次数 = 0;

export default {
	async fetch(request, env, ctx) {
		执行日志 = '';
		let result = '';
		try {
			if (env.DOMAIN) domains = await ADD(env.DOMAIN);
			if (env.IPV4) IPv4 = await ADD(env.IPV4);
			if (env.IPV6) IPv6 = await ADD(env.IPV6);
			if (env.BANIP) banIP = await ADD(env.BANIP);
			if (env.IPAPI) ipAPI = await ADD(env.IPAPI);
			dohURL = env.DOH || dohURL;
			
			CF邮箱 = env.CFMAIL || CF邮箱;
			CF域名 = env.CFDOMAIN || CF域名;
			CF区域ID = env.CFZONEID || CF区域ID; 
			CFAPI令牌 = env.CFKEY || CFAPI令牌; 
			
			BotToken = env.TGTOKEN || BotToken;
			ChatID = env.TGID || ChatID; 
			
			log('变量加载完成');
			if ((domains.length + IPv4.length + IPv6.length + ipAPI.length) == 0) {
				domains = ['cdn.xn--b6gac.eu.org'];
				log('DOMAIN、IPV4、IPV6、IPAPI变量值均为空，添加 演示解析域名 cdn.xn--b6gac.eu.org')
			}
			// 更新IPv4和IPv6数组
			const d2ip = await updateIPArrays(domains);
			IPv4 = IPv4.concat(d2ip[0]);
			IPv6 = IPv6.concat(d2ip[1]);
			log('域名解析完成');
			
			const api2ip = await API2ip(ipAPI);
			IPv4 = IPv4.concat(api2ip[0]);
			IPv6 = IPv6.concat(api2ip[1]);
			log('API调用完成');
			
			// 对数组进行去重
			IPv4 = [...new Set(IPv4)];
			IPv6 = [...new Set(IPv6)];
			log('IP去重完成');
			
			// 处理被banIP
			IPv4 = IPv4.filter(ip => !banIP.includes(ip));
			IPv6 = IPv6.filter(ip => !banIP.includes(ip));
			log('BAN_IP清理完成');
		
			const url = new URL(request.url);
			console.log(url.pathname);
			if (url.pathname == '/go') {
				const token = url.searchParams.get('token');
				const action = url.searchParams.get('action');
				
				// 如果是提交密码验证
				if (action === 'execute' && token) {
					if (env.TOKEN && env.TOKEN != token) {
						log('token不正确');
						result = await 密码输入界面(env, '密码错误，请重新输入');
					} else {
						log('手动执行');
						result = await 输出结果(1, env);
					}
				} else {
					// 显示密码输入界面
					result = await 密码输入界面(env);
				}
			} else {
				result = await 输出结果(0, env);
			}
		} catch (error) {
			log(`发生错误: ${error.message}`);
			console.error(error);
			// 即使发生错误，也确保调用输出结果
			result = await 输出结果(0, env);
		}
		
		// 直接返回输出结果作为响应
		return result;
	},
	
	// 添加对scheduled事件的处理
	async scheduled(event, env, ctx) {
		// 在这里执行定期任务的逻辑
		console.log("Cron job started at " + new Date().toUTCString());
		
		// 复用fetch方法中的逻辑
		if (env.DOMAIN) domains = await ADD(env.DOMAIN);
		if (env.IPV4) IPv4 = await ADD(env.IPV4);
		if (env.IPV6) IPv6 = await ADD(env.IPV6);
		if (env.BANIP) banIP = await ADD(env.BANIP);
		if (env.IPAPI) ipAPI = await ADD(env.IPAPI);
		dohURL = env.DOH || dohURL;
	
		CF邮箱 = env.CFMAIL || CF邮箱;
		CF域名 = env.CFDOMAIN || CF域名;
		CF区域ID = env.CFZONEID || CF区域ID; 
		CFAPI令牌 = env.CFKEY || CFAPI令牌; 
	
		BotToken = env.TGTOKEN || BotToken;
		ChatID = env.TGID || ChatID; 
	
		log('Cron: 变量加载完成');
		if( (domains.length + IPv4.length + IPv6.length + ipAPI.length) == 0){
			domains = ['cdn.xn--b6gac.eu.org'];
			log('DOMAIN、IPV4、IPV6、IPAPI变量值均为空，添加 演示解析域名 cdn.xn--b6gac.eu.org')
		}
		// 更新IPv4和IPv6数组
		const d2ip = await updateIPArrays(domains);
		IPv4 = IPv4.concat(d2ip[0]);
		IPv6 = IPv6.concat(d2ip[1]);
		log('Cron: 域名解析完成');
	
		const api2ip = await API2ip(ipAPI);
		IPv4 = IPv4.concat(api2ip[0]);
		IPv6 = IPv6.concat(api2ip[1]);
		log('Cron: API调用完成');
	
		// 对数组进行去重
		IPv4 = [...new Set(IPv4)];
		IPv6 = [...new Set(IPv6)];
		log('Cron: IP去重完成');
	
		// 处理被banIP
		IPv4 = IPv4.filter(ip => !banIP.includes(ip));
		IPv6 = IPv6.filter(ip => !banIP.includes(ip));
		log('Cron: BAN_IP清理完成');

		// 执行输出结果，但不需要返回Response对象
		await 输出结果(1, env);
		
		console.log("Cron job completed at " + new Date().toUTCString());
	}
};

async function sendMessage(msg) {
	if ( BotToken !== '' && ChatID !== ''){
		let url = "https://api.telegram.org/bot"+ BotToken +"/sendMessage?chat_id=" + ChatID + "&parse_mode=HTML&text=" + encodeURIComponent(msg);
		console.log(msg);
		log(`TG推送完成`);
		
		return fetch(url, {
			method: 'get',
			headers: {
				'Accept': 'text/html,application/xhtml+xml,application/xml;',
				'Accept-Encoding': 'gzip, deflate, br',
				'User-Agent': 'Mozilla/5.0 Chrome/90.0.4430.72'
			}
		});
	} else {
		log(`TG推送关闭`);
	}
}

// 更新IP数组的函数
async function API2ip(APIs) {
	let IP4 = [];
	let IP6 = [];
	if (!APIs || APIs.length === 0) {
		return [IP4, IP6];
	}

	let newIP = "";

	// 创建一个AbortController对象，用于控制fetch请求的取消
	const controller = new AbortController();

	const timeout = setTimeout(() => {
		controller.abort(); // 取消所有请求
	}, 2000); // 2秒后触发

	try {
		// 使用Promise.allSettled等待所有API请求完成，无论成功或失败
		// 对api数组进行遍历，对每个API地址发起fetch请求
		const responses = await Promise.allSettled(APIs.map(apiUrl => fetch(apiUrl, {
			method: 'get', 
			headers: {
				'Accept': 'text/html,application/xhtml+xml,application/xml;',
				'User-Agent': 'cmliu/CF-Workers-DD2D'
			},
			signal: controller.signal // 将AbortController的信号量添加到fetch请求中，以便于需要时可以取消请求
		}).then(response => response.ok ? response.text() : Promise.reject())));

		// 遍历所有响应
		for (const response of responses) {
			// 检查响应状态是否为'fulfilled'，即请求成功完成
			if (response.status === 'fulfilled') {
				// 获取响应的内容
				const content = await response.value;
				newIP += content + '\n';
			}
		}
	} catch (error) {
		console.error(error);
	} finally {
		// 无论成功或失败，最后都清除设置的超时定时器
		clearTimeout(timeout);
	}

	const newIPs = await ADD(newIP);
	// 正则表达式匹配IPv4地址
	const ipv4Regex = /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;

	// 正则表达式匹配IPv6地址
	const ipv6Regex = /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9])?[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9])?[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9])?[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9])?[0-9]))$/;

	newIPs.forEach(ip => {
		if (ipv4Regex.test(ip)) {
			IP4.push(ip);
			log(`API获取 A记录${ip}`);
		} else if (ipv6Regex.test(ip)) {
			IP6.push(ip);
			log(`API获取 AAAA记录${ip}`);
		}
	});

	return [IP4, IP6];
}

// 使用DoH解析域名的函数
async function fetchDNSRecords(domain, type) {
	// 构建查询参数
	const query = new URLSearchParams({
		name: domain,
		type: type
	});
	const url = `${dohURL}?${query.toString()}`;

	// 发送HTTP GET请求
	const response = await fetch(url, {
		method: 'GET',
		headers: {
			'Accept': 'application/dns-json' // 接受DNS JSON格式的响应
		}
	});

	// 检查响应是否成功
	if (!response.ok) {
		throw new Error(`获取DNS记录失败: ${response.statusText}`);
	}

	// 解析响应数据
	const data = await response.json();
	return data.Answer || [];
}

// 更新IP数组的函数
async function updateIPArrays(domains) {
	let IP4 = [];
	let IP6 = [];
	for (const domain of domains) {
		try {
			// 获取域名的A记录
			const aRecords = await fetchDNSRecords(domain, 'A');
			for (const record of aRecords) {
				if (record.type === 1) { // A记录
					IP4.push(record.data);
					log(`解析域名 ${domain} A记录${record.data}`);
				}
			}
			
			// 获取域名的AAAA记录
			const aaaaRecords = await fetchDNSRecords(domain, 'AAAA');
			for (const record of aaaaRecords) {
				if (record.type === 28) { // AAAA记录
					IP6.push(record.data);
					log(`解析域名 ${domain} AAAA记录${record.data}`);
				}
			}
		} catch (error) {
			console.error(`解析域名 ${domain} 时出错:`, error);
		}
	}
	
	return [IP4, IP6];
}

// 输出结果的函数
async function 输出结果(on, env) {
	解析成功次数 = 0;
	解析失败次数 = 0;

	// 构建IPv6输出字符串
	let IPv6Text = ''
	if (IPv6.length != 0){
		IPv6Text = `<div class="section-content"><h4>IPv6</h4><ul>${IPv6.map(ip => `<li>${ip}</li>`).join('')}</ul></div>`;
	}

	let APIText = ''
	if (ipAPI.length != 0){
		APIText = `<div class="section-content"><h4>IP API</h4><ul>${ipAPI.map(api => `<li>${api}</li>`).join('')}</ul></div>`;
	}

	let banIPTest = ''
	if (banIP.length != 0){
		banIPTest = `<div class="section-content"><h4>BAN IP</h4><ul>${banIP.map(ip => `<li>${ip}</li>`).join('')}</ul></div>`;
	}

	let domainsTest = '';
	if (domains.length != 0){
		domainsTest = `<div class="section-content"><h4>解析域名</h4><ul>${domains.map(domain => `<li>${domain}</li>`).join('')}</ul></div>`;
	}

	// 构建解析记录列表
	const 解析记录列表 = [...IPv4.map(ip => ({ type: 'A', content: ip })), ...IPv6.map(ip => ({ type: 'AAAA', content: ip }))];

	const CF配置检查 = CF域名 + CF区域ID + CFAPI令牌 + CF邮箱;
	let CF配置信息
	if (CF配置检查 && CF配置检查 != '' && on == 1){
		CF配置信息 = `<div class="config-item"><strong>域名：</strong>${CF域名}</div>
<div class="config-item"><strong>邮箱：</strong>${CF邮箱.substring(0, 1)}******</div>
<div class="config-item"><strong>区域ID：</strong>${CF区域ID.substring(0, 3)}*************************${CF区域ID.substring(CF区域ID.length - 4)}</div>
<div class="config-item"><strong>API令牌：</strong>${CFAPI令牌.substring(0, 3)}*************************${CFAPI令牌.substring(CFAPI令牌.length - 4)}</div>`;
		const 域名现有解析ID_URL = `https://api.cloudflare.com/client/v4/zones/${CF区域ID}/dns_records?name=${CF域名}`;
		const response = await fetch(域名现有解析ID_URL, {
			method: 'GET',
			headers: {
				'X-Auth-Email': CF邮箱,
				'Authorization': `Bearer ${CFAPI令牌}`,
				'Content-Type': 'application/json'
			}
		});
		const data = await response.json();
		console.log(JSON.stringify(data, null, 2));
		let 域名现有解析ID = [];
		if (!data.success || data.result.length === 0){
			log(`${CF域名} 域名解析为空，跳过删除域名流程`)
		} else {
			for (let record of data.result) {
				域名现有解析ID.push(record.id);
			}
			log(`现有域名ID\n${域名现有解析ID.join('\n')}`);
		}

		// 并发删除域名
		await 批量删除域名(域名现有解析ID);

		await new Promise(resolve => setTimeout(resolve, 8000));

		// 调用批量添加解析
		await 批量添加解析(解析记录列表);

	} else {
		if(on == 0){
			CF配置信息 = `<div class="config-item"><strong>域名：</strong>${CF域名}</div>
<div class="config-item"><strong>邮箱：</strong>${CF邮箱.substring(0, 1)}******</div>
<div class="config-item"><strong>区域ID：</strong>${CF区域ID.substring(0, 3)}*************************${CF区域ID.substring(CF区域ID.length - 4)}</div>
<div class="config-item"><strong>API令牌：</strong>${CFAPI令牌.substring(0, 3)}*************************${CFAPI令牌.substring(CFAPI令牌.length - 4)}</div>`;
		} else {
			CF配置信息 = '<div class="error-message">Cloudflare配置信息错误！</div>'
		}
		
	}
	
	// 构建执行日志HTML
	const logLines = 执行日志.split('\n').filter(line => line.trim() !== '');
	const logHtml = logLines.map(line => `<div class="log-line">${line}</div>`).join('');
	
	// 构建IPv4 HTML
	const ipv4Html = `<div class="section-content"><h4>IPv4</h4><ul>${IPv4.map(ip => `<li>${ip}</li>`).join('')}</ul></div>`;
	
	// 构建最终的HTML输出
	const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>ZQ-DnsIp</title>
	<style>
		* {
			margin: 0;
			padding: 0;
			box-sizing: border-box;
		}
		
		body {
			font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
			background-color: #f5f7fa;
			color: #333;
			line-height: 1.6;
			padding: 20px;
		}
		
		.container {
			max-width: 1200px;
			margin: 0 auto;
			background-color: #fff;
			border-radius: 10px;
			box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
			overflow: hidden;
		}
		
		.header {
			background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
			color: white;
			padding: 30px;
			text-align: center;
		}
		
		.header .logo {
			margin-bottom: 20px;
			display: flex;
			justify-content: center;
		}
		
		.header h1 {
			font-size: 2.5em;
			margin-bottom: 10px;
			font-weight: 600;
		}
		
		.header p {
			font-size: 1.1em;
			opacity: 0.9;
		}
		
		.content {
			padding: 30px;
		}
		
		.section {
			margin-bottom: 30px;
			border: 1px solid #e0e0e0;
			border-radius: 8px;
			overflow: hidden;
		}
		
		.section-header {
			background-color: #f8f9fa;
			padding: 15px 20px;
			border-bottom: 1px solid #e0e0e0;
			font-weight: 600;
			font-size: 1.1em;
			color: #555;
		}
		
		.section-content {
			padding: 20px;
		}
		
		.config-item {
			margin-bottom: 10px;
			padding: 8px 0;
			border-bottom: 1px solid #f0f0f0;
		}
		
		.config-item:last-child {
			border-bottom: none;
		}
		
		ul {
			list-style-type: none;
			margin-left: 20px;
		}
		
		li {
			margin-bottom: 8px;
			position: relative;
		}
		
		li:before {
			content: "•";
			color: #667eea;
			font-weight: bold;
			position: absolute;
			left: -15px;
		}
		
		.log-section {
			max-height: 300px;
			overflow-y: auto;
			background-color: #f8f9fa;
			border: 1px solid #e0e0e0;
			border-radius: 5px;
		}
		
		.log-line {
			padding: 5px 15px;
			border-bottom: 1px solid #e0e0e0;
			font-family: 'Courier New', Courier, monospace;
			font-size: 0.9em;
		}
		
		.log-line:last-child {
			border-bottom: none;
		}
		
		.error-message {
			color: #dc3545;
			font-weight: 600;
			padding: 10px;
			background-color: #f8d7da;
			border: 1px solid #f5c6cb;
			border-radius: 5px;
		}
		
		.footer {
			background-color: #f8f9fa;
			padding: 20px;
			text-align: center;
			border-top: 1px solid #e0e0e0;
			margin-top: 30px;
		}
		
		.footer a {
			color: #667eea;
			text-decoration: none;
			font-weight: 500;
		}
		
		.footer a:hover {
			text-decoration: underline;
		}
		
		.stats {
			display: flex;
			gap: 20px;
			margin-top: 20px;
			padding: 15px;
			background-color: #f8f9fa;
			border-radius: 8px;
		}
		
		.stat-item {
			flex: 1;
			text-align: center;
		}
		
		.stat-number {
			font-size: 1.5em;
			font-weight: 600;
			margin-bottom: 5px;
		}
		
		.success {
			color: #28a745;
		}
		
		.failure {
			color: #dc3545;
		}
		
		.action-area {
			padding: 20px;
			background-color: #f8f9fa;
			border-radius: 8px;
			text-align: center;
		}
		
		.token-info {
			margin: 15px 0;
			padding: 10px;
			background-color: #e3f2fd;
			border-radius: 5px;
			color: #1976d2;
		}
		
		.action-button {
			display: inline-block;
			padding: 12px 30px;
			background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
			color: white;
			text-decoration: none;
			border-radius: 50px;
			font-weight: 600;
			transition: all 0.3s ease;
			margin-top: 10px;
		}
		
		.action-button:hover {
			transform: translateY(-2px);
			box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
		}
		
		@media (max-width: 768px) {
			.container {
				margin: 0 10px;
			}
			
			.header h1 {
				font-size: 2em;
			}
			
			.content {
				padding: 20px;
			}
			
			.stats {
				flex-direction: column;
				gap: 10px;
			}
		}
	</style>
</head>
<body>
	<div class="container">
		<div class="header">
			<div class="logo">
				<svg xmlns="http://www.w3.org/2000/svg" width="60" height="60" viewBox="0 0 200 200">
				  <circle cx="100" cy="100" r="95" fill="rgba(255,255,255,0.2)" stroke="rgba(255,255,255,0.8)" stroke-width="2"/>
				  <rect x="60" y="60" width="80" height="40" rx="5" fill="rgba(255,255,255,0.8)"/>
				  <rect x="70" y="70" width="60" height="20" rx="2" fill="rgba(255,255,255,0.6)"/>
				  <path d="M100 100 L100 120" stroke="rgba(255,255,255,0.8)" stroke-width="2" stroke-linecap="round"/>
				  <rect x="50" y="130" width="100" height="30" rx="5" fill="rgba(255,255,255,0.8)" stroke="rgba(255,255,255,0.6)" stroke-width="2"/>
				  <circle cx="65" cy="145" r="3" fill="rgba(255,255,255,0.8)"/>
				  <circle cx="85" cy="145" r="3" fill="rgba(255,255,255,0.8)"/>
				  <circle cx="105" cy="145" r="3" fill="rgba(255,255,255,0.8)"/>
				  <circle cx="125" cy="145" r="3" fill="rgba(255,255,255,0.8)"/>
				  <circle cx="145" cy="145" r="3" fill="rgba(255,255,255,0.8)"/>
				  <path d="M140 70 L150 60 L160 70" stroke="rgba(255,255,255,0.8)" stroke-width="2" stroke-linecap="round"/>
				  <path d="M140 80 L150 70 L160 80" stroke="rgba(255,255,255,0.8)" stroke-width="2" stroke-linecap="round"/>
				  <path d="M140 90 L150 80 L160 90" stroke="rgba(255,255,255,0.8)" stroke-width="2" stroke-linecap="round"/>
				  <rect x="30" y="40" width="40" height="20" rx="3" fill="rgba(255,255,255,0.6)"/>
				</svg>
			</div>
			<h1>ZQ-DnsIp</h1>
			<p>域名IP解析管理工具</p>
		</div>
		
		<div class="content">
			<div class="section">
				<div class="section-header">Cloudflare 域名配置信息</div>
				<div class="section-content">
					${CF配置信息}
				</div>
			</div>
			
			<div class="section">
				<div class="section-header">配置信息</div>
				<div class="section-content">
					<h4>DoH</h4>
					<p>${dohURL}</p>
					${domainsTest}
					${APIText}
				</div>
			</div>
			
			<div class="section">
				<div class="section-header">整理结果</div>
				<div class="section-content">
					${ipv4Html}
					${IPv6Text}
					${banIPTest}
				</div>
			</div>
			
			${on == 1 ? `
			<div class="stats">
				<div class="stat-item">
					<div class="stat-number success">${解析成功次数}</div>
					<div>成功解析</div>
				</div>
				<div class="stat-item">
					<div class="stat-number failure">${解析失败次数}</div>
					<div>失败解析</div>
				</div>
			</div>
			` : ''}
			
			<div class="section">
				<div class="section-header">执行日志</div>
				<div class="section-content log-section">
					${logHtml}
				</div>
			</div>
			
			<div class="section">
				<div class="section-header">操作</div>
				<div class="section-content">
					<div class="action-area">
						<h4>手动执行</h4>
						<p>点击下方按钮执行DNS解析任务</p>
						<p class="token-info">${env.TOKEN ? '已设置Token，需要验证' : '未设置Token，直接执行'}</p>
					<a href="/go" class="action-button">执行解析任务</a>
					</div>
				</div>
			</div>
		</div>
	</div>
</body>
</html>`;
	
	if(on == 1) await sendMessage(`ZQ-DnsIp:\n${CF域名} 解析完成! 成功: ${解析成功次数} 失败: ${解析失败次数}${tgmsg}`);
	
	// 返回HTML响应
	return new Response(html, {
		headers: {
			'Content-Type': 'text/html; charset=utf-8'
		}
	});
}

async function log(text) {
	// 获取当前的 UTC 时间
	const now = new Date();
	
	// 将 UTC 时间转换为中国时间 (CST, UTC+8)
	const offset = 8 * 60 * 60 * 1000; // 8 小时的毫秒数
	const chinaTime = new Date(now.getTime() + offset);
		
	// 格式化为 yyyy-MM-dd HH:mm:ss
	const formattedTime = formatDate(chinaTime);
	执行日志 += formattedTime + ' ' + text + '\n' ;
	console.log(text);
}

function formatDate(date) {
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, '0');
	const day = String(date.getDate()).padStart(2, '0');
	const hours = String(date.getHours()).padStart(2, '0');
	const minutes = String(date.getMinutes()).padStart(2, '0');
	const seconds = String(date.getSeconds()).padStart(2, '0');
	
	return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

async function ADD(envadd) {
	var addtext = envadd.replace(/[ |"'\r\n]+/g, ',').replace(/,+/g, ','); // 将空格、双引号、单引号和换行符替换为逗号
	if (addtext.charAt(0) == ',') addtext = addtext.slice(1);
	if (addtext.charAt(addtext.length - 1) == ',') addtext = addtext.slice(0, addtext.length - 1);
	const add = addtext.split(',');
	return add;
}

// 密码输入界面函数
async function 密码输入界面(env, errorMessage = '') {
	const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>ZQ-DnsIp - 密码验证</title>
	<style>
		* {
			margin: 0;
			padding: 0;
			box-sizing: border-box;
		}
		
		body {
			font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
			background-color: #f5f7fa;
			color: #333;
			line-height: 1.6;
			padding: 20px;
			display: flex;
			justify-content: center;
			align-items: center;
			min-height: 100vh;
		}
		
		.container {
			max-width: 500px;
			width: 100%;
			background-color: #fff;
			border-radius: 10px;
			box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
			overflow: hidden;
			padding: 40px;
		}
		
		.header {
			background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
			color: white;
			padding: 30px;
			text-align: center;
			margin: -40px -40px 40px -40px;
		}
		
		.header .logo {
			margin-bottom: 20px;
			display: flex;
			justify-content: center;
		}
		
		.header h1 {
			font-size: 2em;
			margin-bottom: 10px;
			font-weight: 600;
		}
		
		.form-group {
			margin-bottom: 20px;
		}
		
		label {
			display: block;
			margin-bottom: 8px;
			font-weight: 600;
			color: #555;
		}
		
		input[type="password"] {
			width: 100%;
			padding: 12px 15px;
			border: 1px solid #e0e0e0;
			border-radius: 5px;
			font-size: 16px;
			transition: border-color 0.3s ease;
		}
		
		input[type="password"]:focus {
			outline: none;
			border-color: #667eea;
			box-shadow: 0 0 0 2px rgba(102, 126, 234, 0.1);
		}
		
		.error-message {
			background-color: #f8d7da;
			color: #721c24;
			padding: 10px 15px;
			border-radius: 5px;
			margin-bottom: 20px;
			border: 1px solid #f5c6cb;
		}
		
		.form-actions {
			display: flex;
			gap: 10px;
			margin-top: 30px;
		}
		
		.btn {
			flex: 1;
			padding: 12px;
			border: none;
			border-radius: 5px;
			font-size: 16px;
			font-weight: 600;
			cursor: pointer;
			transition: all 0.3s ease;
		}
		
		.btn-primary {
			background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
			color: white;
		}
		
		.btn-primary:hover {
			transform: translateY(-2px);
			box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
		}
		
		.btn-secondary {
			background-color: #f8f9fa;
			color: #333;
			border: 1px solid #e0e0e0;
		}
		
		.btn-secondary:hover {
			background-color: #e9ecef;
		}
		
		.info-text {
			margin-top: 20px;
			padding: 15px;
			background-color: #e3f2fd;
			border-radius: 5px;
			color: #1976d2;
			font-size: 14px;
		}
		
		@media (max-width: 768px) {
			.container {
				padding: 20px;
				margin: 10px;
			}
			
			.header {
				margin: -20px -20px 20px -20px;
				padding: 20px;
			}
			
			.form-actions {
				flex-direction: column;
			}
		}
	</style>
</head>
<body>
	<div class="container">
		<div class="header">
			<div class="logo">
				<svg xmlns="http://www.w3.org/2000/svg" width="60" height="60" viewBox="0 0 200 200">
				  <circle cx="100" cy="100" r="95" fill="rgba(255,255,255,0.2)" stroke="rgba(255,255,255,0.8)" stroke-width="2"/>
				  <rect x="60" y="60" width="80" height="40" rx="5" fill="rgba(255,255,255,0.8)"/>
				  <rect x="70" y="70" width="60" height="20" rx="2" fill="rgba(255,255,255,0.6)"/>
				  <path d="M100 100 L100 120" stroke="rgba(255,255,255,0.8)" stroke-width="2" stroke-linecap="round"/>
				  <rect x="50" y="130" width="100" height="30" rx="5" fill="rgba(255,255,255,0.8)" stroke="rgba(255,255,255,0.6)" stroke-width="2"/>
				  <circle cx="65" cy="145" r="3" fill="rgba(255,255,255,0.8)"/>
				  <circle cx="85" cy="145" r="3" fill="rgba(255,255,255,0.8)"/>
				  <circle cx="105" cy="145" r="3" fill="rgba(255,255,255,0.8)"/>
				  <circle cx="125" cy="145" r="3" fill="rgba(255,255,255,0.8)"/>
				  <circle cx="145" cy="145" r="3" fill="rgba(255,255,255,0.8)"/>
				  <path d="M140 70 L150 60 L160 70" stroke="rgba(255,255,255,0.8)" stroke-width="2" stroke-linecap="round"/>
				  <path d="M140 80 L150 70 L160 80" stroke="rgba(255,255,255,0.8)" stroke-width="2" stroke-linecap="round"/>
				  <path d="M140 90 L150 80 L160 90" stroke="rgba(255,255,255,0.8)" stroke-width="2" stroke-linecap="round"/>
				  <rect x="30" y="40" width="40" height="20" rx="3" fill="rgba(255,255,255,0.6)"/>
				</svg>
			</div>
			<h1>ZQ-DnsIp</h1>
			<p>密码验证</p>
		</div>
		
		${errorMessage ? `<div class="error-message">${errorMessage}</div>` : ''}
		
		<form action="/go" method="get">
			<input type="hidden" name="action" value="execute">
			
			<div class="form-group">
				<label for="token">请输入执行密码</label>
				<input type="password" id="token" name="token" placeholder="输入TOKEN密码" required>
			</div>
			
			<div class="form-actions">
				<button type="submit" class="btn btn-primary">执行解析任务</button>
				<a href="/" class="btn btn-secondary" style="display: inline-block; text-align: center; text-decoration: none;">返回首页</a>
			</div>
		</form>
		
		<div class="info-text">
			<p><strong>提示：</strong></p>
			<p>• 如果未设置TOKEN变量，直接点击执行即可</p>
			<p>• 如果设置了TOKEN变量，需要输入正确的TOKEN密码</p>
		</div>
	</div>
</body>
</html>`;
	
	return new Response(html, {
		headers: {
			'Content-Type': 'text/html; charset=utf-8'
		}
	});
}

async function 批量删除域名(域名ID数组) {
	const 批次大小 = 4; // 每批并发请求的数量
	const 批次间隔 = 2000; // 批次之间的间隔时间（毫秒）
  
	for (let i = 0; i < 域名ID数组.length; i += 批次大小) {
		const 当前批次 = 域名ID数组.slice(i, i + 批次大小);
		
		// 并发删除当前批次的域名
		const 删除promises = 当前批次.map(域名ID => 删除域名(域名ID));
		const results = await Promise.allSettled(删除promises);
		
		results.forEach((result, index) => {
			if (result.status === 'fulfilled') {
			log(`${CF域名}:${当前批次[index]} 删除成功`);
			} else {
			log(`${CF域名}:${当前批次[index]} 删除失败: ${result.reason}`);
			}
		});
	
		// 如果还有下一批，则等待指定的间隔时间
		if (i + 批次大小 < 域名ID数组.length) {
			await new Promise(resolve => setTimeout(resolve, 批次间隔));
		}
	}
}
  
// 删除单个域名的函数保持不变
async function 删除域名(域名ID) {
	const 删除域名_URL = `https://api.cloudflare.com/client/v4/zones/${CF区域ID}/dns_records/${域名ID}`;
	const response = await fetch(删除域名_URL, {
		method: 'DELETE',
		headers: {
			'X-Auth-Email': CF邮箱,
			'Authorization': `Bearer ${CFAPI令牌}`,
			'Content-Type': 'application/json'
		}
	});
	const data = await response.json();
	console.log(JSON.stringify(data, null, 2));
	if (!data.success) {
		throw new Error(`删除失败: ${JSON.stringify(data.errors)}`);
	}
}

async function 批量添加解析(解析记录列表) {
	const 批次大小 = 4; // 每批并发请求的数量
	const 批次间隔 =2000; // 批次之间的间隔时间（毫秒）
  
	for (let i = 0; i < 解析记录列表.length; i += 批次大小) {
		const 当前批次 = 解析记录列表.slice(i, i + 批次大小);
		
		// 并发发送当前批次的请求
		await Promise.all(当前批次.map(记录 => 添加解析(记录.type, 记录.content)));
		
		// 如果还有下一批，则等待指定的间隔时间
		if (i + 批次大小 < 解析记录列表.length) {
			await new Promise(resolve => setTimeout(resolve, 批次间隔));
		}
	}
}
  
// 修改添加解析函数，返回一个 Promise
async function 添加解析(A, IP) {
	const 添加解析_URL = `https://api.cloudflare.com/client/v4/zones/${CF区域ID}/dns_records`;
	try {
		const response = await fetch(添加解析_URL, {
			method: 'POST',
			headers: {
			'X-Auth-Email': CF邮箱,
			'Authorization': `Bearer ${CFAPI令牌}`,
			'Content-Type': 'application/json',
			},
			body: JSON.stringify({
			type: A,
			name: CF域名,
			content: IP,
			ttl: 60,
			proxied: false
			})
		});
		const data = await response.json();
		console.log(JSON.stringify(data, null, 2));
		if (data.success) {
			解析成功次数 += 1;
			tgmsg += `\n${A}记录: ${IP}`
			log(`${CF域名} 成功 ${A}记录: ${IP}`);
		} else {
			解析失败次数 += 1;
			tgmsg += `\n失败: ${IP}`
			log(`${CF域名} 失败 ${A}记录: ${IP}`);
		}
	} catch (error) {
		解析失败次数 += 1;
		tgmsg += `\n失败: ${IP}`
		log(`${CF域名} 失败 ${A}记录: ${IP}`);
	}
}
