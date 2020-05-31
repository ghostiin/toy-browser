const http = require('http');

const server = http.createServer((req, res) => {
	res.setHeader('Content-Type', 'text/html');
	res.setHeader('X-Foo', 'bar');
	res.writeHead(200, { 'Content-Type': 'text/plain' });

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
