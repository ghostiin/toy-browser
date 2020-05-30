const http = require('http');

const server = http.createServer((req, res) => {
	res.setHeader('Content-Type', 'text/html');
	res.setHeader('X-Foo', 'bar');
	res.writeHead(200, { 'Content-Type': 'text/plain' });
	const str = `<html lang="en">
<head>
   <style>
   #flex-container {
   background-color: #000;
   width: 800px;
   height: 500px;
   display: flex;
   }
   #flex1 {
   width:300px;
   height:300px;
   background-color: rgb(255, 0, 0);
   }
   #flex2 {
   flex:1;
   background-color: rgb(0, 128, 0);
   }
   </style>
</head>
<body>
<div id="flex-container">
<div id="flex1"></div>
<div id="flex2"></div>
</div>
</body>
</html>`;
	res.end(str);
	// 	res.end(
	// 		`<html maaa=a >
	// <head>
	// <style>
	// body div #myid{
	//         width:100px;
	//         background-color: #ff5000;
	// }
	// body div img{
	//         width:30px;
	//         background-color: #ff1111;
	// }
	// </style>
	// </head>
	// <body>
	// <div>
	//     <img id="myid"/>
	//     <img />
	// </div>
	// </body>
	// </html>`
	// 	);
	// res.end('<img id="test"/>');
});

server.listen(8088);
