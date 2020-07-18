# 复盘：如何编写一个toy-browser

toy-browser是winter老师前端训练营的一个课程内容，这段时间在复习前端的基础知识，就包括经典的关于浏览器工作原理的问题：从用户输入一个url到浏览器呈现对应页面，这中间发生了什么？

这个问题正好可以结合toy-browser重新复习，毕竟从知道原理到真的能实现还是有一段距离。接下来就复盘下几个月前写的toy-browser，主要从下面2个方面：

- 浏览器的基本工作原理和流程
- toy-browser实现哪部分的浏览器功能？每个部分具体是如何实现的？实现的过程中有哪些要点？

    （当然这个toy-browser是真的toy，主要用于学习目的）

## 浏览器工作原理

其实网上将浏览器工作原理的文章已经很多了，可以去读 [神三元博客里的这篇](http://47.98.159.95/my_blog/browser-render/001.html#%E7%BD%91%E7%BB%9C%E8%AF%B7%E6%B1%82) ，他是在李兵老师那门浏览器原理的课程基础上补充整理了很多细节，已经足够完整深入了。

这里用一张图大致概括

![toy%20browser%20d9afc502357648c285ab13cf2b030e3e/Untitled.png](toy%20browser%20d9afc502357648c285ab13cf2b030e3e/Untitled.png)

从这种总结的图上我们可以看出在从输入url到呈现页面这个过程中浏览器主要进行了三部分的工作

- 网络： 发送http请求，接受响应报文
- 解析构建： 接受响应报文并且解析其中html构建dom树，解析css生成stylesheet，计算排版生成layout树
- 渲染呈现：接受解析构建的结果并且进行绘制，将绘制好的图像渲染到我们的屏幕上

## toy-browser的实现

toy-browser则是简化的实现网络、解析、渲染三个模块。

- 网络： client.js
- 解析：browserParser.js 负责dom树构建和css computing，layout.js负责计算布局
- 渲染：render.js

server.js用于模拟服务器，向浏览器返回html内容

### 实现网络部分功能

浏览器在网络部分干的两件关键的事是：

- 构建并发送http请求去请求用户输入的url
    
    - 我们编写了Request类来构建http请求，这里要注意构建的请求报文的格式，换行空行都要正确，且不能有多余空格，不然就无法被服务器端识别
- 能正确接收服务器返回的资源
    - 对于Response的接收，我们主要使用状态机的编程方式来进行报文头部和实体的识别
        - 对于报文实体：
        在我们模拟的server中，是以chunked的方式传输（因为服务器是直接write了html文件，并不提前知道我们传输的字符数，无法使用content-length）

            所以针对chunk传输的实体格式编写了对应的解析器来确保这部分能被正确识别保存

        - 解析完Response响应后就可以将识别到的完整body交给解析模块进行构建了

### 实现构建解析功能

构建解析模块负责的三件事

- 根据html构建DOM树（browserParser.js）
    - 根据html解析出DOM树这部分也是通过**状态机方法**完成的。首先想要得到解析html成一颗语法树结构的规则，最好的办法就是看规范里是如何规定的[https://html.spec.whatwg.org/multipage/parsing.html#data-state](https://html.spec.whatwg.org/multipage/parsing.html#data-state) 。html规范的描述就是以一种状态机方式进行描述的，比如

        ![toy%20browser%20d9afc502357648c285ab13cf2b030e3e/Untitled%201.png](toy%20browser%20d9afc502357648c285ab13cf2b030e3e/Untitled%201.png)

        为了简化我们这里只实现几条基本规则就可以了：识别开始标签，识别结束标签，识别自闭合标签，标签属性

    - 在状态及之外我们还有个建树器，建树器负责的工作就是接收到状态机发送过来的token然后生成一个dom节点，并正确的加入dom树（包括设定dom节点的父节点，孩子节点等工作）。这里使用了一个**栈**来辅助这部分工作，一开始我们就往栈中放入了document元素作为默认的根节点。对构建的任一dom节点A，当他未入栈之前，先它入栈的节点也就是当前栈顶就会是这个节点A的父节点，而这个节点A是当前栈顶节点的孩子节点。随后A加入栈中，直到当遇见A节点所对应的结束标签再弹出A节点。当构建结束，理想状态是这个辅助栈中只存在最开始document节点。(如果是真实浏览器来解析html有很强的容错机制，不过toy-browser...所以测试toybrowser的时候别写错html了....)
- css计算（browserParser.js）
    - toy-browser只实现了解析style标签内的css规则，这里借助了npm包css来帮助解析
    - toy-browser在一个dom节点构建好之后就会去收集的css rules中匹配有没有对应的css规则，将对应的css样式挂载dom.computedStyle中，在这个过程中
        - CSS选择器匹配规则
            - 选择器匹配都是从右至左的，最右不匹配那肯定不匹配，可以提高计算匹配的效率

            ```jsx
            div span #inner {}
            ```

        - css优先级比较
            - 使用一个四元组进行比较[inline-style,id,classes,elements],从左至右一位位比较，比如

            ```jsx
            // div#a.b .c[id=x]  // 0 1 3 1  [id=x] count as class
            // #a:not(#b) // 0 2 0 0   :not() no count
            // *.a // 0 0 1 0 * no count
            // div.a // 0 0 1 1
            //优先级比较  [0 1 3 1] < [0 2 0 0] 比较到第二位就可以返回了
            ```

            同样toy-browser在这里处理的也比较简单，仅支持id class tagelement，第一位inline-style永远就0

- layout计算（layout..js）
    - 得到了dom树和样式后，则要进行layout计算，在开始计算之前，编写个辅助方法getStyle来辅助
        - 统一css property的命名为属性时横线写法转驼峰写法
        - 还有就是将一些需要计算的属性，从他们的值（字符串）提取成number，为后面计算做准备（当然toy-browser仅支持px单位和rgba色彩值...）
        - toy-browser仅实现了对一个flex布局的layout计算，且不支持解析渲染文字,计算步骤大致为：
            1. 初始化flex-container的相关属性和计算所需的相关属性
            2. 收集flex container内的元素，判断和处理是否换行
            3. 计算每行元素在主轴上排列的相关属性值
            4. 计算每行元素在交叉轴上排列的相关属性值

### 实现渲染部分功能

toy-browser的渲染极其简陋hhhh就是绘制图块，layout计算完后，每个item都得到了width height left right等具体属性值，绘图工具库可以借助这些值来在具体的位置绘制具体的图块了。可以借绘制出来的结果来检查之前的构建过程是否正确。

```html
<html lang="en">
<head>
   <style>
       body #flex-container {
           background-color: rgb(0, 0, 255);
           width: 800px;
           height: 500px;
           display: flex;
		   justify-content: space-around;
		   align-items: center;
	   }
	   #flex1 {
		width:300px;
		height:300px;
		background-color: rgb(128, 0, 0);
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
</html>
```

![toy%20browser%20d9afc502357648c285ab13cf2b030e3e/viewport.jpg](toy%20browser%20d9afc502357648c285ab13cf2b030e3e/viewport.jpg)

*emm 有待更多的测试hhhh