const http = require('http');

const server = http.createServer((req, res) => {
	res.setHeader('X-Foo', 'bar');
	// 在真实浏览器中，当Content-Type值为text/html时，浏览器将接收到的
	// 响应实体作为html解析，
	// 如果Content-Type为application/octet-stream字节流这种类型
	// 浏览器会调用下载器模块下载文件
	res.writeHead(200, { 'Content-Type': 'text/html' });

	const str1 = `<html lang="en">
<head>
   <style>
       body #flex-container {
           background-color: rgb(0, 0, 255);
           width: 800px;
           height: 500px;
           display: flex;
           justify-content: space-between;
	   }
	   #flex1 {
		width:300px;
		height:300px;
		background-color: rgb(255, 0, 0);
		}
		.flex2 {
		width:300px;
		height:300px;
		background-color: rgb(0, 128, 0);
		}
   </style>
</head>
<body>
    <div id="flex-container">
        <div id="flex1"></div>
        <div id="flex2" class="flex2 classname2"></div>
	</div>
</body>
</html>`;
	res.end(str1);
});

server.listen(8088);
