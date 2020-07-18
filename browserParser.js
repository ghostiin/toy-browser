const css = require('css');
const layout = require('./layout.js'); // layout负责生成布局

// 用于存放当前处理的token
let currentToken = null;
// 存放当前处理的属性
let currenAttrute = null;

// 用栈来辅助我们生成dom树
//默认以document为根元素，也方便后面取出构造好的dom树
let stack = [ { type: 'document', children: [] } ];

// 存放当前出来的文字节点
let currentTextNode = null;

// 建立一个全局唯一量来标识读取到文件最后
const EOF = Symbol('EOF');

//负责处理CSS Rules的函数
let rules = [];

// 用于解析style标签内的样式
// 真实浏览器支持解析link引入的css文件，style中css样式，行内样式
// toybrowser实现比较简单，仅支持style标签
function addCSSRules(text) {
	let ast = css.parse(text);
	//console.log(JSON.stringify(ast, null, '   '));
	rules.push(...ast.stylesheet.rules);
}

//将rules 应用到 element上
function computeCSS(element) {
	//复制一份当前的stack 防止获取父元素时操作污染stack
	// 并且reverse，这样当前dom为第一个元素
	let elementsCopy = [ ...stack ].reverse();

	if (!element.computedStyle) {
		element.computedStyle = {}; //初始化计算属性
	}

	// 现存的css 规则是否有匹配stack节点里的样式
	for (let rule of rules) {
		//处理selector reverse是匹配的顺序是先内后外
		// eg.
		// div #inner { ... }
		// selectors = ['#inner','div']
		// 是先判断里面的 #inner是否匹配
		// 最里不匹配直接不匹配
		let selectors = rule.selectors[0].split(' ').reverse();
		let matched = false;
		if (!match(element, selectors[0])) {
			//直接匹配最内层 不成功则当前element节点不匹配这条rule
			// 继续判断stack中其他节点
			continue;
		}

		//分边遍历selectors和elementsCopy，看是否有匹配
		let j = 1;
		for (let i = 0; i < elementsCopy.length; i++) {
			if (match(elementsCopy[i], selectors[j])) {
				j++; //如果匹配一个selector 那么则继续匹配下一个selector j指针向前走1
				if (j >= selectors.length) {
					// j>=sel.len说明所有sel都成功匹配了
					break;
				}
			}
		}

		//如果slectors中的元素都能匹配上 即j >= selectors.length,则代表匹配成功
		if (j >= selectors.length) {
			matched = true; //匹配成功标记
		}
		if (matched) {
			// 匹配成功后进选择器优先级的计算
			// 如果当前匹配规则与已有的冲突，则会进行优先级比较
			let sp = specificity(rule.selectors[0]);
			let computedStyle = element.computedStyle;
			for (let dec of rule.declarations) {
				if (!computedStyle[dec.property]) {
					//如果没有该规则则挂上去
					computedStyle[dec.property] = {};
				}
				if (!computedStyle[dec.property].specificity) {
					// 当前加入的样式属性没有优先级，则将优先级初始化最内层selector所对应的优先级
					// 这样后面存在优先级比较就不会出现已挂载的节点样式优先级不存在的情况
					computedStyle[dec.property].value = dec.value;
					computedStyle[dec.property].specificity = sp;
				} else if (compare(computedStyle[dec.property].specificity, sp) < 0) {
					//如果规则冲突则比较当前要加入的规则与原存规则的优先级
					// 若现存规则优先级小于 当前要加入规则优先级
					// 则将规则更新为当前加入规则，并把优先级更新为当前规则sp
					computedStyle[dec.property].value = dec.value;
					computedStyle[dec.property].specificity = sp;
				}
			}
		}
	}
}

// match尽进行id class tagname 的匹配
function match(element, selector) {
	if (!selector || !element.attributes) return false;

	if (selector.charAt(0) === '#') {
		//匹配id选择器
		let attr = element.attributes.filter((attr) => attr.name === 'id')[0];
		if (attr && attr.value === selector.replace('#', '')) return true;
	} else if (selector.charAt(0) === '.') {
		//匹配class选择器
		let attr = element.attributes.filter((attr) => attr.name === 'class')[0];
		//如果一个节点挂了多个classname 前面只会处理成 class : “classname1 classname2”
		if (attr && attr.value.split(' ').includes(selector.replace('.', ''))) return true;
	} else if (element.tagName === selector) {
		//匹配标签选择器
		return true;
	} else {
		return false;
	}
}

// 优先级使用一个四元组表示[inline-styles,ids,classes,elements]
// 出现次数作为值
// eg.
// div#a.b .c[id=x]  // 0 1 3 1  [id=x] count as class
// #a:not(#b) // 0 2 0 0   :not() no count
// *.a // 0 0 1 0 * no count
// div.a // 0 0 1 1
// 这里处理的比较简单，并没有处理伪类伪元素之类的
// 只处理了id class和tag
function specificity(selector) {
	let spec = [ 0, 0, 0, 0 ];
	let sels = selector.split(' ');
	for (let sel of sels) {
		if (sel.charAt(0) === '#') {
			spec[1] += 1;
		} else if (sel.charAt(0) === '.') {
			spec[2] += 1;
		} else {
			spec[3] += 1;
		}
	}
	return spec;
}

// 优先级的比较是将四元组对应位一一比较
// 一位通过就返回
// [0 1 3 1] < [0 2 0 0]
function compare(sp1, sp2) {
	if (sp1[0] - sp2[0]) {
		return sp1[0] - sp2[0]; // 返回>0 sp1优于sp2
	}
	if (sp1[1] - sp2[1]) {
		return sp1[1] - sp2[1]; // 返回>0 sp1优于sp2
	}
	if (sp1[2] - sp2[2]) {
		return sp1[2] - sp2[2]; // 返回>0 sp1优于sp2
	}
	return sp1[3] - sp2[3]; //前面都无法通过则直至比较到最后一位
}

// 建树器
//处理每个拿到的token，生成相应的dom节点并且计入dom树（stack数组中）
function emit(token) {
	if (token.type !== 'text') {
		//console.log(token);
		//暂不处理text节点
	}

	//当前栈顶的DOM节点
	let top = stack[stack.length - 1];

	if (token.type === 'startTag') {
		// 是startTag说明这里遇见了一个新的html节点
		// 进行初始化构造dom树的节点，压栈
		let element = {
			type: 'element',
			children: [],
			attributes: []
		};
		// 记录当前节点的tagName
		element.tagName = token.tagName;
		// 记录当前节点的attributes
		for (let p in token) {
			//遍历当前token的属性key
			//token中key不是tagName和type的属性都是attr
			if (p !== 'type' && p !== 'tagName') {
				element.attributes.push({
					name: p,
					value: token[p]
				});
			}
		}

		//将属性都绑定到dom树节点上后
		//进行css computing
		// 计算当前节点css属性确切值，并挂载dom节点上
		// 在真实浏览器中，css计算在dom树构建完成后，会计算css生成stylesheet对象，
		computeCSS(element);

		//将构造好的dom节点压入 当前栈顶的children中
		top.children.push(element);

		//当前栈顶就是当前token的父节点
		element.parent = top;

		if (!token.isSelfClosing) {
			stack.push(element); //非自封闭tag就入栈，自封闭入栈即出栈
		}
		currentTextNode = null;
	} else if (token.type === 'endTag') {
		if (top.tagName !== token.tagName) {
			// console.log('top', top);
			// console.log('now', token);
			throw new Error('Tags cant match!'); //简单的容错处理
		} else {
			//在判断end tag时 style内容一定已经被挂上去不为空了
			//如果是style标签，在弹出前收集style标签内的CSS规则
			if (top.tagName === 'style') {
				addCSSRules(top.children[0].content);
			}
			//在top取得子元素后进行layout
			layout(top);
			//匹配栈顶则弹出栈顶
			stack.pop();
		}
		currentTextNode = null;
	} else if (token.type === 'text') {
		if (currentTextNode === null) {
			currentTextNode = {
				type: 'text',
				content: ''
			};
			top.children.push(currentTextNode);
		}

		currentTextNode.content += token.content;
	}
}

// 下面是解析html相关方法
// html具体的解析方法可以读html spec
// https://html.spec.whatwg.org/multipage/parsing.html#tokenization
// 规范的描述就非常的状态机，分析每个token，遇见什么字符就转移到什么state中去

//12.2.5.1 Data state
function data(c) {
	if (c === '<') {
		return tagOpen;
	} else if (c === EOF) {
		emit({
			type: 'EOF'
		});
		return;
	} else {
		emit({
			type: 'text',
			content: c
		});
		return data;
	}
}

//12.2.5.6 Tag open state
function tagOpen(c) {
	if (c === '/') {
		return endTagOpen;
	} else if (c.match(/^[a-zA-Z]$/)) {
		currentToken = {
			type: 'startTag',
			tagName: ''
		};
		return tagName(c); //reconsume
	} else {
		emit({
			type: 'text',
			content: c
		});
		return;
	}
}

// 处理tagName
function tagName(c) {
	if (c.match(/^[\t\n\f ]$/)) {
		//处理多种空格
		return beforeAttributeName;
	} else if (c === '/') {
		return selfClosingStartTag;
	} else if (c.match(/^[a-zA-Z]$/)) {
		currentToken.tagName += c;
		return tagName;
	} else if (c === '>') {
		emit(currentToken);
		return data;
	} else {
		currentToken.tagName += c;
		return tagName;
	}
}

// 处理结束标记的开始
function endTagOpen(c) {
	if (c === '>') {
	} else if (c.match(/^[a-zA-Z]$/)) {
		currentToken = {
			type: 'endTag',
			tagName: ''
		};
		return tagName(c);
	} else if (c === EOF) {
	} else {
		return;
	}
}

// 处理AttrName之前的初始化工作
function beforeAttributeName(c) {
	if (c.match(/^[\t\n\f ]$/)) {
		//处理多种空格
		return beforeAttributeName;
	} else if (c === '>' || c === '/' || c === EOF) {
		// 读取到后尖括号，自闭/或是文件结尾
		// 说明attrName无论有没有开始，都已经结束了
		return afterAttributeName(c);
	} else if (c === '=') {
	} else {
		// 初始化全局变量currentAttrubute的值
		// 为下面接受name和value做准备
		currenAttrute = {
			name: '',
			value: ''
		};
		return attributeName(c);
	}
}

// 处理接受属性name
function attributeName(c) {
	if (c.match(/^[\t\n\f ]$/) || c === '/' || c === '>' || c === EOF) {
		return afterAttributeName(c);
	} else if (c === '=') {
		return beforeAttributeValue;
	} else if (c === '\u0000') {
	} else if (c === '"' || c === "'" || c === '<') {
	} else {
		currenAttrute.name += c;
		return attributeName;
	}
}

// 处理读取完attrName之后
function afterAttributeName(c) {
	if (c.match(/^[\t\n\f ]$/)) {
		return afterAttributeName;
	} else if (c === '/') {
		return selfClosingStartTag;
	} else if (c === '=') {
		return beforeAttributeValue;
	} else if (c === '>') {
		currentToken[currenAttrute.name] = currenAttrute.value;
		emit(currentToken);
		return data;
	} else if (c === 'EOF') {
	} else {
		currentToken[currenAttrute.name] = currenAttrute.value;
		currenAttrute = {
			name: '',
			value: ''
		};
		return attributeName(c);
	}
}

// 处理AttrValue之前的初始化工作
function beforeAttributeValue(c) {
	if (c.match(/^[\t\n\f ]$/) || c === '/' || c === '>' || c === EOF) {
		// currentToken[currentAttribute.name] = currenAttrute.value;
		return beforeAttributeValue;
	} else if (c === '"') {
		return doubleQuoteAttributeValue;
	} else if (c === "'") {
		return singleQuoteAttributeValue;
	} else {
		return UnquotedAttributeValue(c);
	}
}

// 处理双引号括起来的attrValue
function doubleQuoteAttributeValue(c) {
	if (c === '"') {
		// 如果遇见",则说明attrName是接收完了的
		// 将该AttrName加入当前Token的属性中
		currentToken[currenAttrute.name] = currenAttrute.value;
		return afterQuotedAttributeValue;
	} else if (c === '\u0000') {
		// \u0000空格
	} else if (c === EOF) {
	} else {
		currenAttrute.value += c;
		return doubleQuoteAttributeValue;
	}
}

// 处理单引号括起来的attrValue
function singleQuoteAttributeValue(c) {
	if (c === "'") {
		// 同 " 处理方法
		currentToken[currenAttrute.name] = currenAttrute.value;
		return afterQuotedAttributeValue;
	} else if (c === '\u0000') {
	} else if (c === EOF) {
	} else {
		currenAttrute.value += c;
		return singleQuoteAttributeValue;
	}
}

// 当读取完一组attrName和Value后
function afterQuotedAttributeValue(c) {
	if (c.match(/^[\t\n\f ]$/)) {
		return beforeAttributeName;
	} else if (c === '/') {
		return selfClosingStartTag;
	} else if (c === '>') {
		// 读取到后尖括号说明当前token 的所有attr已经读取完
		// 可以发送该token到建树器生成相应dom节点了
		currentToken[currenAttrute.name] = currenAttrute.value;
		emit(currentToken);
		return data;
	} else if (c === EOF) {
	} else {
		return beforeAttributeName(c);
	}
}

// 处理没被引号括起来的Attr value
function UnquotedAttributeValue(c) {
	if (c.match(/^[\t\n\f ]$/)) {
		currentToken[currenAttrute.name] = currenAttrute.value;
		return beforeAttributeName;
	} else if (c === '/') {
		currentToken[currenAttrute.name] = currenAttrute.value;
		return selfClosingStartTag;
	} else if (c === '>') {
		currentToken[currenAttrute.name] = currenAttrute.value;
		emit(currentToken);
		return data;
	} else if (c === '\u0000') {
	} else if (c === '"' || c === "'" || c === '<' || c === '=' || c === '`') {
	} else if (c === EOF) {
	} else {
		currenAttrute.value += c;
		return UnquotedAttributeValue;
	}
}

// 处理自闭tag
function selfClosingStartTag(c) {
	if (c === '>') {
		currentToken.isSelfClosing = true;
		emit(currentToken);
		return data;
	} else if (c === EOF) {
	} else {
		return beforeAttributeName(c);
	}
}

module.exports.parseHTML = function parseHTML(html) {
	// 这里使用mealy型状态机
	// 1.每个函数都代表一种状态
	// 2. 函数参数就是输入值
	// 3.在函数内可以自由处理，返回值为下一状态函数

	// 初始化状态为 data state
	let state = data;
	for (let c of html) {
		state = state(c);
	}
	// 用EOF来表明读取完毕
	state = state(EOF);

	//取出dom树
	// console.log(stack[0]);
	return stack[0];
};
