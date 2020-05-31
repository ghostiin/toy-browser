//取出computedStyle
function getStyle(element) {
	if (!element.style) element.style = {};

	for (let p in element.computedStyle) {
		if (p.split('-').length > 1) {
			// 横线 转 驼峰写法
			//与后面初始化变量属性匹配
			const f = p.split('-')[0];
			const b = p.split('-')[1];
			const ps = f + `${b[0].toUpperCase()}${b.slice(1)}`;
			element.style[ps] = element.computedStyle[p].value;
		} else {
			element.style[p] = element.computedStyle[p].value;
		}
	}

	for (let p in element.style) {
		if (element.style[p].toString().match(/px$/)) {
			//取出整数像素值
			element.style[p] = parseInt(element.style[p]);
		}
		if (element.style[p].toString().match(/^[0-9\.]+$/)) {
			//?这里貌似也取不到rgba里面的数值。。。
			element.style[p] = parseInt(element.style[p]);
		}
	}

	return element.style;
}

function layout(element) {
	if (!element.computedStyle) {
		return;
	}
	let elementStyle = getStyle(element);
	//console.log(elementStyle);

	//只处理flex layout
	if (elementStyle.display !== 'flex') {
		return;
	}

	//取出children中的element节点 滤掉text节点
	let items = element.children.filter((e) => e.type === 'element');
	//当前element的所有element chidren中排序他们的css order属性
	//https://developer.mozilla.org/zh-CN/docs/Web/CSS/order
	items.sort(function(a, b) {
		return (a.order || 0) - (b.order || 0);
	}); //取出children中的element节点 滤掉text节点

	let style = elementStyle;

	[ 'width', 'height' ].forEach((size) => {
		if (style[size] === 'auto' || style[size] === '') {
			style[size] = null; //如果宽高是自动或未设置则都初始化为null，后面再计算
		}
	});

	//初始化以下默认值
	//https://developer.mozilla.org/zh-CN/docs/Glossary/Flexbox
	//flex-direction Property

	if (!style.flexDirection || style.flexDirection === 'auto') {
		style.flexDirection = 'row';
	}
	//align-items
	if (!style.alignItems || style.alignItems === 'auto') {
		style.alignItems = 'stretch';
	}
	//justify-content
	if (!style.justifyContent || style.justifyContent === 'auto') {
		style.justifyContent = 'flex-start';
	}
	//flex-wrap
	if (!style.flexWrap || style.flexWrap === 'auto') {
		style.flexWrap = 'nowrap';
	}
	//align-content
	if (!style.alignContent || style.alignContent === 'auto') {
		style.alignContent = 'stretch';
	}
	//align-self
	// if(!style.alignSelf || style.alignSelf === )

	//main代表主轴，这五个是主轴相关变量，用于计算具体布局数值
	//从左到右排布每多一个元素为+元素宽度 sign为+1,从右至左排布每多一个元素为-元素宽度，sign就为-1（纵向同理）
	let mainSize, mainStart, mainEnd, mainSign, mainBase; //基于base起始计算
	//croess代表交叉轴，这五个是交叉轴相关变量
	let crossSize, crossStart, crossEnd, crossSign, crossBase;
	//根据flex属性初始化以上变量
	if (style.flexDirection === 'row') {
		mainSize = 'width'; //row方向 主轴的宽度看width属性
		mainStart = 'left'; //从左向右排布
		mainEnd = 'right';
		mainSign = +1; //从左至右不reverse
		mainBase = 0;

		crossSize = 'height';
		crossStart = 'top';
		crossEnd = 'bottom';
	}
	if (style.flexDirection === 'row-reverse') {
		mainSize = 'width';
		mainStart = 'right';
		mainEnd = 'left';
		mainSign = -1;
		mainBase = 0;

		crossSize = 'height';
		crossStart = 'top';
		crossEnd = 'bottom';
	}
	if (style.flexDirection === 'column') {
		mainSize = 'height';
		mainStart = 'top';
		mainEnd = 'bottom';
		mainSign = +1;
		mainBase = 0;

		crossSize = 'width';
		crossStart = 'left';
		crossEnd = 'right';
	}
	if (style.flexDirection === 'column-reverse') {
		mainSize = 'height';
		mainStart = 'bottom';
		mainEnd = 'top';
		mainSign = -1;
		mainBase = 0;

		crossSize = 'width';
		crossStart = 'left';
		crossEnd = 'right';
	}
	if (style.flexWrap === 'wrap-reverse') {
		let tmp = crossStart;
		crossStart = crossEnd;
		crossEnd = tmp;
		crossSign = -1;
	} else {
		crossBase = 0;
		crossSign = +1;
	}

	//处理flex container没有设定宽高的情况
	//这种由flex container的flex子元素来自动撑开
	let isAutoMainSize = false;
	if (!style[mainSize]) {
		elementStyle[mainSize] = 0;
		for (let i = 0; i < items.length; i++) {
			let itemStyle = getStyle(items[i]);
			if (itemStyle[mainSize] !== null || itemStyle[mainSize] !== void 0) {
				//void 0 => return pure undefined :D
				elementStyle[mainSize] += itemStyle[mainSize];
			}
		}
		isAutoMainSize = true;
	}

	//1. 收集元素 处理分行
	//收集一行内的元素
	let flexLine = [];
	//收集每行
	let flexLines = [ flexLine ];

	let mainSpace = elementStyle[mainSize]; //mainSpace是一个具体数值 mainSize是一个名称
	let crossSpace = 0;
	//循环处理当前元素的每个子元素
	for (let i = 0; i < items.length; i++) {
		let item = items[i];
		let itemStyle = getStyle(item);

		if (itemStyle[mainSize] === null) {
			itemStyle[mainSize] = 0;
		}

		if (itemStyle.flex) {
			flexLine.push(item); //如果该子元素有flex属性则加入一行
		} else if (style.flexWrap === 'nowrap' && isAutoMainSize) {
			//如果是自动撑开flex container 且为nowrap，子元素不带flex属性
			//该flex container将直接被该子元素压缩
			mainSpace -= itemStyle[mainSize];
			if (itemStyle[crossSize] !== null && itemStyle[crossSize] !== void 0) {
				//crossSize被最大元素撑开
				crossSpace = Math.max(crossSpce, itemStyle[crossSize]);
			}
			flexLine.push(item);
		} else {
			//非nowrap情况 子元素最大不能超过父元素container
			if (itemStyle[mainSize] > style[mainSize]) {
				itemStyle[mainSize] = style[mainSize];
			}
			//如果该行已经放不下，则新建一行，将新行加入行集
			//将该元素放入新行
			if (itemStyle[mainSize] > mainSpace) {
				flexLine.mainSpace = mainSpace;
				flexLine.crossSpace = crossSpace;
				flexLine = [];
				flexLine.push(item);
				flexLines.push(flexLine);
				//重置mainSpace crossSpace
				mainSpace = style[mainSize];
				crossSpace = 0;
			} else {
				//否则加入当前行
				flexLine.push(item);
			}
			//crossSpace一直为该行最大元素
			if (itemStyle[crossSize] !== null && itemStyle[crossSize] !== void 0) {
				crossSpace = Math.max(crossSpace, itemStyle[crossSize]);
			}
			//计算放入该元素后该行剩余未被分配space
			mainSpace -= itemStyle[mainSize];
		}
	}

	flexLine.mainSpace = mainSpace; //line剩下space
	if (style.flexWrap === 'nowrap' || isAutoMainSize) {
		flexLine.crossSpace = style[crossSize] !== undefined ? style[crossSize] : crossSpace;
	} else {
		flexLine.crossSpace = crossSpace;
	}

	//2. 计算主轴方向

	//只有一行时才有这种overflow情况，缩放所有子元素
	//nowrap
	if (mainSpace < 0) {
		//mainSpace<0所以这里计算出来的scale一定小于1
		//即缩小所有子元素
		const scale = style[mainSize] / (style[mainSize] - mainSpace);
		let currentMain = mainBase;
		for (let i = 0; i < items.length; i++) {
			let item = items[i];
			let itemStyle = getStyle(item);

			//在只有一行且overflow的情况下 flex元素直接被压缩掉
			if (itemStyle.flex) {
				itemStyle[mainSize] = 0;
			}

			//其余非flex元素在flex container中缩放
			itemStyle[mainSize] = itemStyle[mainSize] * scale;
			itemStyle[mainStart] = currentMain; //离容器Start的距离计算
			itemStyle[mainEnd] = itemStyle[mainStart] + mainSign * itemStyle[mainSize]; //计算元素end的位置

			//记录下个子元素的start位置
			currentMain = itemStyle[mainEnd];
		}
	} else {
		//处理每个flex行
		flexLines.forEach(function(line) {
			//line是个数组，包含应该在该行的items
			let mainSpace = line.mainSpace;
			let flexTotal = 0; //统计flex属性值的总和
			//console.log('line', line);
			for (let i = 0; i < line.length; i++) {
				let item = line[i];
				let itemStyle = getStyle(item);
				if (itemStyle.flex !== null && itemStyle.flex !== void 0) {
					flexTotal += itemStyle.flex;
					continue;
				}
			}
			//存在flex元素则处理
			if (flexTotal > 0) {
				let currentMain = mainBase;
				for (let i = 0; i < line.length; i++) {
					let item = line[i];
					let itemStyle = getStyle(item);
					if (itemStyle.flex) {
						//计算当前元素占几个flex元素space
						itemStyle[mainSize] = mainSpace / flexTotal * itemStyle.flex;
					}
					//计算start end
					itemStyle[mainStart] = currentMain;
					itemStyle[mainEnd] = currentMain + itemStyle[mainSize] * mainSign;
					//更新下次起始base
					currentMain = itemStyle[mainEnd];
				}
			} else {
				//如果没有flex元素在flex container中，则处理空白空间
				//justify-content align-content等属性生效

				let currentMain, gap;
				//处理justify-content属性
				if (style.justifyContent === 'flex-start') {
					currentMain = mainBase;
					gap = 0; //无间距
				}
				if (style.justifyContent === 'flex-end') {
					currentMain = mainBase;
					gap = 0;
				}
				if (style.justifyContent === 'center') {
					currentMain = mainBase + mainSpace / 2 * mainSign; //从中间向两边排布
					gap = 0;
				}
				if (style.justifyContent === 'space-between') {
					gap = mainSpace / (line.length - 1) * mainSign; //计算间距
					currentMain = mainBase;
				}
				if (style.justifyContent === 'space-around') {
					gap = mainSpace / line.length * mainSign;
					currentMain = gap / 2 + mainBase;
				}
				for (let i = 0; i < line.length; i++) {
					let item = line[i];
					let itemStyle = getStyle(item);
					itemStyle[mainStart] = currentMain;
					itemStyle[mainEnd] = itemStyle[mainStart] + mainSign * itemStyle[mainSize];
					currentMain = itemStyle[mainEnd] + gap;
				}
			}
		});
	}

	//3.计算交叉轴方向space
	//处理align-item align-self属性
	crossSpace = 0; //整个flex container的crossSpace

	if (!style[crossSize]) {
		//没有设置flex container的crossSpace则由flexLines自动撑开
		crossSpace = 0;
		elementStyle[crossSize] = 0;
		for (let i = 0; i < flexLines.length; i++) {
			elementStyle[crossSize] += flexLines[i].crossSpace;
		}
	} else {
		//flex-container设置了crossSpace的情况
		crossSpace = style[crossSize];
		for (let i = 0; i < flexLines.length; i++) {
			crossSpace -= flexLines[i].crossSpace; //计算剩余空白space
		}
	}
	//如果wrap-reverse，则从下向上排列
	if (style.flexWrap === 'wrap-reverse') {
		crossBase = style[crossSize];
	} else {
		crossBase = 0;
	}

	let lineSize = style[crossSize] / flexLines.length; //得到每个line应分配的space，用于下面align等属性的计算
	//计算交叉轴方向的gap
	let gap, currentCross;
	if (style.alignContent === 'flex-start') {
		currentCross = crossBase;
		gap = 0; //无间距
	}
	if (style.alignContent === 'flex-end') {
		currentCross = crossBase + crossSign * crossSpace;
		gap = 0;
	}
	if (style.alignContent === 'center') {
		currentCross = crossBase + crossSpace / 2 * crossSign; //从中间向两边排布
		gap = 0;
	}
	if (style.alignContent === 'space-between') {
		gap = crossSpace / (line.length - 1) * crossSign; //计算间距
		currentCross = crossBase;
	}
	if (style.alignContent === 'space-around') {
		gap = crossSpace / line.length * crossSign;
		currentCross = gap / 2 + crossBase;
	}
	if (style.alignContent === 'stretch') {
		currentCross = crossBase;
		gap = 0;
	}
	flexLines.forEach(function(line) {
		let lineCrossSize =
			style.alignContent === 'stretch' ? line.crossSpace + crossSpace / flexLines.length : line.crossSpace;
		for (let i = 0; i < line.length; i++) {
			let item = line[i];
			let itemStyle = getStyle(item);

			let align = itemStyle.alignSelf || style.alignItems;

			if (itemStyle[crossSize] === null) {
				itemStyle[crossSize] = align === 'stretch' ? lineCrossSize : 0;
			}

			if (style.alignContent === 'flex-start') {
				itemStyle[crossStart] = crossBase;
				itemStyle[crossEnd] = itemStyle[crossStart] + crossSign * itemStyle[crossSize];
			}
			if (style.alignContent === 'flex-end') {
				itemStyle[crossEnd] = crossBase + crossSign * lineCrossSize;
				itemStyle[crossStart] = itemStyle[crossEnd] - crossSign * itemStyle[crossSize];
			}
			if (style.alignContent === 'center') {
				itemStyle[crossStart] = crossBase + crossSign * (lineCrossSize - itemStyle[crossSize]) / 2;
				itemStyle[crossEnd] = itemStyle[crossStart] + crossSign * itemStyle[crossSign];
			}

			if (align === 'stretch') {
				itemStyle[crossStart] = crossBase;
				itemStyle[crossEnd] =
					crossBase +
					crossSign *
						(itemStyle[crossSize] !== null && itemStyle[crossSize] !== void 0
							? itemStyle[crossSize]
							: lineCrossSize);
				itemStyle[crossSize] = crossSign * (itemStyle[crossEnd] - itemStyle[crossStart]);
			}
		}
		crossBase += crossSign * (lineCrossSize + gap);
	});
	//console.log(items);
}

module.exports = layout;
