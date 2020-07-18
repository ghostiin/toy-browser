const net = require('net');
const images = require('images');
const browserParser = require('./browserParser');
const render = require('./render');
const { request } = require('http');

// Request模块负责浏览器构建http请求
// eg.
// GET / HTTP/1.1
// X-Foo2: customed
// Content-Type: application/x-www-form-urlencoded
// Content-Length: 8

// name=1ce
class Request {
	constructor(options) {
		// 构建相关的http request header
		// method path http版本
		// headers
		// 空行\r\n
		// body
		this.method = options.method || 'GET';
		this.host = options.host;
		this.port = options.port || 80;
		this.path = options.path || {};
		this.body = options.body || {};
		this.headers = options.headers || {};
		if (!this.headers['Content-Type']) {
			this.headers['Content-Type'] = 'application/x-www-form-urlencoded';
		}
		if (this.headers['Content-Type'] === 'application/json') {
			this.bodyText = JSON.stringify(this.body);
		} else if (this.headers['Content-Type'] === 'application/x-www-form-urlencoded') {
			// 在GET请求
			// 参数以 key=value形式带在url后
			// 且get请求参数仅支持URL编码
			this.bodyText = Object.keys(this.body)
				.map((key) => {
					return `${key}=${encodeURIComponent(this.body[key])}`;
				})
				.join('&');
		}

		//calc contentlength
		//编码后的大小
		this.headers['Content-Length'] = this.bodyText.length;
	}

	// 调用toString方法返回合法构建的http request字符串
	// 注意换行和空格问题
	toString() {
		return `${this.method} ${this.path} HTTP/1.1\r
${Object.keys(this.headers).map((key) => `${key}: ${this.headers[key]}`).join(`\r\n`)}
\r
${this.bodyText}`;
	}

	// http request发送方法
	send(connection) {
		// 使用promise包装
		return new Promise((resolve, reject) => {
			// 调用下面定义的Response Parser，
			// 用于接收到Response数据时进行解析
			const parser = new ResponseBodyParser();
			if (connection) {
				// connection建立则发送构建好的request
				connection.write(this.toString());
			} else {
				// 否则先建立connection(tcp)
				connection = net.createConnection(
					{
						host: this.host,
						port: this.port
					},
					() => {
						connection.write(this.toString());
					}
				);
			}

			// 当connection收到返回的Response则调用Response Parser解析
			connection.on('data', (data) => {
				//打印收到的原始响应
				console.log('Response:');
				console.log(data.toString());
				console.log('--------------------------');
				// 将数据传输给parser
				parser.receive(data.toString());
				// 解析完成则promise-> fulfilled
				if (parser.isFinished) {
					resolve(parser.response);
				}
				connection.end();
			});
			connection.on('error', (err) => {
				reject(err);
				connection.end();
			});
		});
	}
}

class ResponseBodyParser {
	// 使用状态机的方法来编写解析Response的逻辑
	constructor() {
		//等待接收响应首行
		this.WAITING_STATUS_LINE = 0;
		// 等待接收响应首行结束-> 遇见 /r/n
		this.WAITING_STATUS_LINE_END = 1;
		// 等待接收头部字段名称
		this.WAITING_HEADER_NAME = 2;
		// 等待接收头部字段中的空格
		this.WAITING_HEADER_SPACE = 3;
		// 等待接收冒号后的头部字段对应值
		this.WAITING_HEADER_VALUE = 4;
		// 等待接受头部结束 -> /r/n
		this.WAITING_HEADER_LINE_END = 5;
		// 等待响应头部结束后的空行
		this.WAITING_HEADER_BLOCK_END = 6;
		// 等待响应body
		this.WAITING_BODY = 7;

		// 当前状态机接受字符对应状态，初始化时等待响应首行
		this.current = this.WAITING_STATUS_LINE;
		// 存放响应首行
		this.statusLine = '';
		// 存放头部字段
		this.headers = {};
		// 当前处理的头部字段名
		this.headerName = '';
		// 当前处理的头部字段值
		this.headerValue = '';
	}

	get isFinished() {
		return this.bodyParser && this.bodyParser.isFinished;
	}

	get response() {
		this.statusLine.match(/HTTP\/1.1 ([0-9]+) ([\s\S]+)/);
		console.log();
		return {
			statusCode: RegExp.$1,
			statusText: RegExp.$2,
			headers: this.headers,
			body: this.bodyParser.content.join('')
		};
	}

	// 接收response并且一个字符一个字符的传入reciveChar进行解析
	receive(string) {
		for (let i = 0; i < string.length; i++) {
			this.receiveChar(string.charAt(i));
		}
	}
	// 处理每位输入字符
	receiveChar(char) {
		//console.log(this.current, JSON.stringify(char));
		if (this.current === this.WAITING_STATUS_LINE) {
			if (char === '\r') {
				this.current = this.WAITING_STATUS_LINE_END;
			} else if (char === '\n') {
				// 到此时肯定以及接收到完整的\r\n
				// 证明响应首行已经结束，进入下一状态
				this.current = this.WAITING_HEADER_NAME;
			} else {
				this.statusLine += char;
			}
		} else if (this.current === this.WAITING_STATUS_LINE_END) {
			if (char === '\n') {
				this.current = this.WAITING_HEADER_NAME;
			}
		} else if (this.current === this.WAITING_HEADER_NAME) {
			if (char === ':') {
				// 遇冒号则说明header name读取完毕
				this.current = this.WAITING_HEADER_SPACE;
			} else if (char === '\r') {
				this.current = this.WAITING_HEADER_BLOCK_END;
				if (this.headers['Transfer-Encoding'] === 'chunked') {
					// 如果读到Tranfer-Encding=chunked
					// 则说明为分块传输，初始化chunked body解析器
					this.bodyParser = new chunkBodyParser();
				}
			} else {
				this.headerName += char;
			}
		} else if (this.current === this.WAITING_HEADER_SPACE) {
			if (char === ' ') {
				this.current = this.WAITING_HEADER_VALUE;
			}
		} else if (this.current === this.WAITING_HEADER_VALUE) {
			if (char === '\r') {
				this.current = this.WAITING_HEADER_LINE_END;
				this.headers[this.headerName] = this.headerValue;
				this.headerName = '';
				this.headerValue = '';
			} else {
				this.headerValue += char;
			}
		} else if (this.current === this.WAITING_HEADER_LINE_END) {
			if (char === '\n') {
				this.current = this.WAITING_HEADER_NAME;
			}
		} else if (this.current === this.WAITING_HEADER_BLOCK_END) {
			if (char === '\n') this.current = this.WAITING_BODY;
		} else if (this.current === this.WAITING_BODY) {
			this.bodyParser.receiveChar(char);
		}
	}
}

// 当Transfer-Encoding为chunked的时候 解析chunked body
//eg.
// 下面发送内容段的长度(hex) \r\n
// 内容段\r\n
// 同上知道没有内容段需要发送了，此时
// 0\r\n 告知结束
// \r\n
class chunkBodyParser {
	constructor() {
		// 等待接受一个chunk的长度
		this.WAITING_LENGTH = 0;
		// 接受长度完毕
		this.WAITING_LENGTH_LINE_END = 1; // \r\n
		// 开始读取对应的chunk内容
		this.READING_CHUNK = 2;
		// 读取chunk内容完毕
		this.READING_CHUNK_END = 3; //\r
		// 等待读取下一个chunk
		this.WAITING_NEW_LINE = 4; //\n

		// 存放当前读取的chunk的长度
		this.length = 0;
		// 将每次读取的chunk内容以数组形式存放
		this.content = [];
		this.isFinished = false;
		this.current = this.WAITING_LENGTH;
	}
	receiveChar(char) {
		if (this.current === this.WAITING_LENGTH) {
			if (char === '\r') {
				// 当读取到 0\r\n时 说明chunk传输结束
				if (this.length === 0) {
					this.isFinished = true;
				}
				this.current = this.WAITING_LENGTH_LINE_END;
			} else {
				// 接收chunk的长度
				// chunk的length是16进制 -> 转换为10进制
				// 因为是按位读取的，所以注意位数的处理 11->1*16+1
				this.length *= 16;
				this.length += parseInt(char, 16);
			}
		} else if (this.current === this.WAITING_LENGTH_LINE_END) {
			if (char === '\n') {
				this.current = this.READING_CHUNK;
			}
		} else if (this.current === this.READING_CHUNK) {
			this.content.push(char);
			this.length--;
			if (this.length === 0) {
				this.current = this.READING_CHUNK_END;
				//console.log('content', this.content);
			}
		} else if (this.current === this.READING_CHUNK_END) {
			if (char === '\r') {
				this.current = this.WAITING_NEW_LINE;
			}
		} else if (this.current === this.WAITING_NEW_LINE) {
			if (char === '\n') {
				this.current = this.WAITING_LENGTH;
			}
		}
	}
}

// 模拟一次发送url到页面渲染的过程
void (async function() {
	// 网络相关部分
	// 1. 模拟 浏览器根据输入url构建请求

	let req = new Request({
		method: 'GET',
		host: '127.0.0.1',
		port: '8088',
		path: '/',
		headers: {
			['X-Foo2']: 'customed'
		},
		body: {
			name: '1ce'
		}
	});
	console.log('Request:');
	console.log(req.toString());
	console.log('-------------------');

	// 解析构建部分
	// 2. 获取服务器返回的响应
	let response = await req.send();
	console.log('analyze Response:');
	console.log(response);

	// 3. 解析HTML生成DOM树，解析css，计算layout
	// 具体细节详见 browserParser.js
	let dom = browserParser.parseHTML(response.body);
	//console.log(dom);

	// 4. 模拟浏览器的渲染过程
	let viewport = images(800, 500);
	render(viewport, dom);
	viewport.save('viewport.jpg');
})();
