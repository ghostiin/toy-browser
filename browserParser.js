const css = require('css');
const layout = require('./layout.js');
let currentToken = null;
let currenAttrute = null;
//默认以document为根元素，也方便后面取出构造好的dom树
let stack = [ { type: 'document', children: [] } ];
let currentTextNode = null;

const EOF = Symbol('EOF');
//负责处理CSS Rules的函数
let rules = [];
function addCSSRules(text) {
	let ast = css.parse(text);
	//console.log(JSON.stringify(ast, null, '   '));
	rules.push(...ast.stylesheet.rules);
}

function computeCSS(element) {
	//将rules 应用到 element上

	let elementsCopy = [ ...stack ].reverse(); //复制一份当前的stack 防止获取父元素时操作污染stack
	if (!element.computedStyle) {
		element.computedStyle = {}; //初始化计算属性
	}
	for (let rule of rules) {
		//cssmatch(rule.selectors[0], element);
		let selectors = rule.selectors[0].split(' ').reverse(); //处理匹配的顺序是先内后外
		let matched = false;
		if (!match(element, selectors[0])) {
			//直接匹配最内层 不成功则继续
			continue;
		}

		//分边遍历selectors和elementsCopy，看是否有匹配
		let j = 1;
		for (let i = 0; i < elementsCopy.length; i++) {
			if (match(elementsCopy[i], selectors[j])) {
				j++; //如果匹配一个selector 那么则继续匹配下一个selector j指针向前走1
				if (j >= selectors.length) {
					break;
				}
			}
		}
		//如果slectors中的元素都能匹配上 即j === elementsCopy.length,则代表匹配成功
		if (j >= selectors.length) {
			matched = true; //匹配成功标记
		}
		if (matched) {
			let sp = specificity(rule.selectors[0]);
			let computedStyle = element.computedStyle;
			for (let dec of rule.declarations) {
				if (!computedStyle[dec.property]) {
					//如果没有该规则则挂上去
					computedStyle[dec.property] = {};
				}
				if (!computedStyle[dec.property].specificity) {
					computedStyle[dec.property].value = dec.value;
					computedStyle[dec.property].specificity = sp;
				} else if (compare(computedStyle[dec.property].specificity, sp) < 0) {
					//如果规则冲突则比较优先级
					for (let k = 0; k < 4; k++) {
						computedStyle[dec.property][dec.value][k] += sp;
					}
				}
				//将规则放入对应节点的computedStyle中
				computedStyle[dec.property].value = dec.value;
			}

			//console.log(element.computedStyle);
		}
	}
}

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

function compare(sp1, sp2) {
	if (sp1[0] - sp2[0]) {
		return sp1[0] - sp2[0];
	}
	if (sp1[1] - sp2[1]) {
		return sp1[1] - sp2[1];
	}
	if (sp1[2] - sp2[2]) {
		return sp1[2] - sp2[2];
	}
	return sp1[3] - sp2[3]; //前面都通过则 直至比较到最后一位
}

function emit(token) {
	//处理每个拿到的token
	if (token.type !== 'text') {
		//console.log(token);
		//暂不处理text节点
	}
	//栈顶指针;
	let top = stack[stack.length - 1];
	if (token.type === 'startTag') {
		//压栈
		//构造dom树的节点
		let element = {
			type: 'element',
			children: [],
			attributes: []
		};
		element.tagName = token.tagName;
		for (let p in token) {
			//遍历当前token的属性key
			//token中不是tagName和type的属性都是attr
			if (p !== 'type' && p !== 'tagName') {
				element.attributes.push({
					name: p,
					value: token[p]
				});
			}
		}
		//将属性都绑定到dom树节点上后
		//计算当前节点css属性确切值
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
			console.log('top', top);
			console.log('now', token);
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
function beforeAttributeName(c) {
	if (c.match(/^[\t\n\f ]$/)) {
		//处理多种空格
		return beforeAttributeName;
	} else if (c === '>' || c === '/' || c === EOF) {
		return afterAttributeName(c);
	} else if (c === '=') {
	} else {
		currenAttrute = {
			name: '',
			value: ''
		};
		return attributeName(c);
	}
}

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

function doubleQuoteAttributeValue(c) {
	if (c === '"') {
		currentToken[currenAttrute.name] = currenAttrute.value;
		return afterQuotedAttributeValue;
		//暂时不考虑&情况
	} else if (c === '\u0000') {
	} else if (c === EOF) {
	} else {
		currenAttrute.value += c;
		return doubleQuoteAttributeValue;
	}
}

function singleQuoteAttributeValue(c) {
	if (c === "'") {
		currentToken[currenAttrute.name] = currenAttrute.value;
		return afterQuotedAttributeValue;
		//暂时不考虑&情况
	} else if (c === '\u0000') {
	} else if (c === EOF) {
	} else {
		currenAttrute.value += c;
		return singleQuoteAttributeValue;
	}
}

function afterQuotedAttributeValue(c) {
	if (c.match(/^[\t\n\f ]$/)) {
		return beforeAttributeName;
	} else if (c === '/') {
		return selfClosingStartTag;
	} else if (c === '>') {
		currentToken[currenAttrute.name] = currenAttrute.value;
		emit(currentToken);
		return data;
	} else if (c === EOF) {
	} else {
		return beforeAttributeName(c);
	}
}

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

module.exports.parseHTML = function parseHTML(html) {
	let state = data;
	for (let c of html) {
		state = state(c);
	}
	state = state(EOF);
	//取出dom树
	console.log(stack[0]);
	return stack[0];
};
