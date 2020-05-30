const net = require('net');
const browserParser = require('./browserParser');

class Request {
	//method url=host+port+path
	//headers
	//      content-type\content-length
	//body
	constructor(options) {
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

	toString() {
		return `${this.method} ${this.path} HTTP/1.1\r
${Object.keys(this.headers).map((key) => `${key}: ${this.headers[key]}`).join(`\r\n`)}
\r
${this.bodyText}`;
	}

	send(connection) {
		return new Promise((resolve, reject) => {
			const parser = new ResponseBodyParser();
			if (connection) {
				connection.write(this.toString());
			} else {
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
			connection.on('data', (data) => {
				parser.receive(data.toString());
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

class Response {}

class ResponseBodyParser {
	//定义状态机
	constructor() {
		this.WAITING_STATUS_LINE = 0; //等待响应首行status_line
		this.WAITING_STATUS_LINE_END = 1; //等待响应首行结束 /r/n
		this.WAITING_HEADER_NAME = 2; //header name
		this.WAITING_HEADER_SPACE = 3;
		this.WAITING_HEADER_VALUE = 4; //冒号后的header value
		this.WAITING_HEADER_LINE_END = 5; //等待headers部分结束
		this.WAITING_HEADER_BLOCK_END = 6; //响应空行
		this.WAITING_BODY = 7;

		this.current = this.WAITING_STATUS_LINE; //当前初始状态
		this.statusLine = '';
		this.headers = {};
		this.headerName = '';
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
	receive(string) {
		for (let i = 0; i < string.length; i++) {
			this.receiveChar(string.charAt(i));
		}
	}
	receiveChar(char) {
		//console.log(this.current, JSON.stringify(char));
		if (this.current === this.WAITING_STATUS_LINE) {
			if (char === '\r') {
				this.current = this.WAITING_STATUS_LINE_END;
			} else if (char === '\n') {
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
				this.current = this.WAITING_HEADER_SPACE;
			} else if (char === '\r') {
				this.current = this.WAITING_HEADER_BLOCK_END;
				if (this.headers['Transfer-Encoding'] === 'chunked') {
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

class chunkBodyParser {
	constructor() {
		this.WAITING_LENGTH = 0;
		this.WAITING_LENGTH_LINE_END = 1; // \r\n
		this.READING_CHUNK = 2;
		this.READING_CHUNK_END = 3; //\r
		this.WAITING_NEW_LINE = 4; //\n

		this.length = 0;
		this.content = [];
		this.isFinished = false;
		this.current = this.WAITING_LENGTH;
	}
	receiveChar(char) {
		//console.log(JSON.stringify(char), this.current);
		if (this.current === this.WAITING_LENGTH) {
			if (char === '\r') {
				if (this.length === 0) {
					this.isFinished = true;
					//console.log('content', this.content);
				}
				this.current = this.WAITING_LENGTH_LINE_END;
			} else {
				//接收n位数的长度
				//16进制
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

void (async function() {
	let req = new Request({
		method: 'POST',
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

	let response = await req.send();
	console.log('here', response);
	let dom = browserParser.parseHTML(response.body);
})();
