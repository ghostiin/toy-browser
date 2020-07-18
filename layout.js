//取出computedStyle，进行一些预处理
// 为layout计算做准备
function getStyle(element) {
	if (!element.style) element.style = {};

	// 处理1： 横线命名转换为驼峰写法
	for (let p in element.computedStyle) {
		if (p.split('-').length > 1) {
			// 横线 转 驼峰写法
			//与后面初始化变量属性匹配
			const f = p.split('-')[0];
			const b = p.split('-')[1];
			const ps = f + `${b[0].toUpperCase()}${b.slice(1)}`;
			element.style[ps] = element.computedStyle[p].value;
			// console.log(p, ps);
		} else {
			element.style[p] = element.computedStyle[p].value;
		}
	}

	// 处理2：将需要计算的数值取出
	// eg. '80px' -> 80
	for (let p in element.style) {
		if (element.style[p].toString().match(/px$/)) {
			//取出整数像素值
			element.style[p] = parseInt(element.style[p]);
		}
		if (element.style[p].toString().match(/^[0-9\.]+$/)) {
			//开始位置是数字则也把这个数字值取出来
			element.style[p] = parseInt(element.style[p]);
		}
	}

	return element.style;
}

function layout(element) {
	if (!element.computedStyle) {
		return;
	}

	// 取出当前进行layout运算的节点的样式
	let elementStyle = getStyle(element);
	//console.log(elementStyle);

	//toy browser只处理flex layout
	if (elementStyle.display !== 'flex') {
		return;
	}

	// 当一个元素设置了display:flex
	// 则它是一个flex container
	// 取出它的children dom进行layout计算
	//取出children中的element节点 滤掉text节点
	// toy browser只处理简单的图像绘制排版，不涉及文字渲染排版
	// 所以这里过滤掉文字节点
	let items = element.children.filter((e) => e.type === 'element');

	let style = elementStyle;
	// 初始化width & height属性
	[ 'width', 'height' ].forEach((size) => {
		if (style[size] === 'auto' || style[size] === '') {
			style[size] = null; //如果宽高是自动或未设置则都初始化为null，后面再计算
		}
	});

	// 对于弹性布局flex中的container
	// 有以下的属性需要初始化或计算
	// *toybrowser不处理缩写属性

	// order：指定了item的排列顺序，order值越小排在月前面
	//当前element的所有element chidren中排序他们的css order属性
	//https://developer.mozilla.org/zh-CN/docs/Web/CSS/order
	items.sort(function(a, b) {
		return (a.order || 0) - (b.order || 0);
	});

	// flex-direction： 设置了flex container中主轴的方向以及起始
	// 默认值为row
	if (!style.flexDirection || style.flexDirection === 'auto') {
		style.flexDirection = 'row';
	}

	//flex-wrap： 设置了flex-container内的item是否可以换行
	//默认nowrap，不换行
	if (!style.flexWrap || style.flexWrap === 'auto') {
		style.flexWrap = 'nowrap';
	}

	//align-items： 设置了 flex items在交叉轴的方向上的对齐方式
	// 默认是stretch,伸展到占满容器的交叉轴(高度或宽度)
	if (!style.alignItems || style.alignItems === 'auto') {
		style.alignItems = 'stretch';
	}

	//justify-content： 设置了flex container在主轴上的空白空间分配
	// 默认是flex-start，也就是从主轴起始方向开始排列item，剩余的是空白空间
	if (!style.justifyContent || style.justifyContent === 'auto') {
		style.justifyContent = 'flex-start';
	}

	//align-content： 当项目有多个轴线时生效，设定多个轴线的对齐方式
	//默认值stretch，也就是多根轴线平分交叉轴方向空间
	if (!style.alignContent || style.alignContent === 'auto') {
		style.alignContent = 'stretch';
	}

	//初始化一些计算时要用到的变量值
	//main代表主轴，这五个是主轴相关变量，用于计算具体布局数值
	// mainSize ： 指明主轴的大小应该看width还是height <-- 并非是确切值！
	// mainStart： 主轴的起始方向，也是第一个元素开始排列的地方
	//mainEnd： 主轴的结束方向
	//mainSign： 指明主轴的起始结束方向是否reverse，
	//			left->right/top->bottom为正常+1
	// 			right->left/bottom->top为reverse -1
	// eg.
	//从左到右排布每多一个元素为+元素宽度 sign为+1,
	// 从右至左排布每多一个元素为-元素宽度，sign就为-1（纵向同理）
	//mainBase: 用于在排版计算过程中记录当前排列应该起始的位置，计算开始base
	let mainSize, mainStart, mainEnd, mainSign, mainBase;
	//croess代表交叉轴，这五个是交叉轴相关变量，具体含义类比main
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
			if (itemStyle[mainSize] !== null || itemStyle[mainSize] !== undefined) {
				elementStyle[mainSize] += itemStyle[mainSize];
			}
		}
		isAutoMainSize = true;
	}

	//1. 收集元素 处理分行
	//收集一行内的元素
	// 每一个flexLine
	// {
	// 	mainSpace： 该行主轴上size，
	// 	crossSpace：该行交叉轴上size，
	// 	[ 存放该行里排列的元素]
	// }
	let flexLine = [];
	//收集行
	let flexLines = [ flexLine ];

	// 主轴上的空间大小 （==flex container的width or height
	let mainSpace = elementStyle[mainSize]; //mainSpace是一个具体数值 mainSize是一个名称
	//交叉轴上空间大小
	let crossSpace = 0;

	//循环处理当前元素（flex container）的每个子元素（flex item）
	// 将item排入当前的flexLine或者新起一行
	for (let i = 0; i < items.length; i++) {
		let item = items[i];
		// 取出当前item的样式
		let itemStyle = getStyle(item);

		// item在主轴方向没有设置size则初始化为0
		// 因为toybrowser不处理文字也就不处理文字撑开容器的情况了
		if (itemStyle[mainSize] === null) {
			itemStyle[mainSize] = 0;
		}

		if (itemStyle.flex) {
			flexLine.push(item); //如果该子元素有flex属性则加入一行
		} else if (style.flexWrap === 'nowrap' && isAutoMainSize) {
			//如果是自动撑开flex container 且为nowrap，子元素不带flex属性
			//该flex container将直接被该子元素压缩(不考虑文字撑开的情况)
			mainSpace -= itemStyle[mainSize];
			if (itemStyle[crossSize] !== null && itemStyle[crossSize] !== undefined) {
				//crossSpace被最大元素撑开
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
				// 该行已经被flex item撑开到与容器同宽了
				flexLine.mainSpace = mainSpace;
				flexLine.crossSpace = crossSpace;

				//新建一行
				flexLine = [];
				flexLine.push(item);
				flexLines.push(flexLine);

				//重置mainSpace crossSpace
				mainSpace = style[mainSize];
				crossSpace = 0;
			} else {
				//放得下否则加入当前行
				flexLine.push(item);
			}
			//crossSpace为max（元素设定高度或宽度，该行被元素撑开的最大高度或宽度）
			if (itemStyle[crossSize] !== null && itemStyle[crossSize] !== undefined) {
				crossSpace = Math.max(crossSpace, itemStyle[crossSize]);
			}
			//计算放入该元素后该行剩余未被分配space
			mainSpace -= itemStyle[mainSize];
		}
	}

	flexLine.mainSpace = mainSpace; //line剩下space
	if (style.flexWrap === 'nowrap' || isAutoMainSize) {
		// 不允许换行或者容器自动被撑开情况下
		// 如果设置flex container的crossSpace大小，则容器的crossSpace为container的crpssSpace
		flexLine.crossSpace = style[crossSize] !== undefined ? style[crossSize] : crossSpace;
	} else {
		flexLine.crossSpace = crossSpace;
	}

	//2. 计算主轴方向上的排列

	//nowrap
	//只有一行时才有这种overflow情况，缩放所有子元素
	if (mainSpace < 0) {
		//剩余mainSpace<0所以这里计算出来的scale系数一定小于1
		//即缩小所有子元素（flex-shirnk属性默认为1，即开启缩放）
		const scale = style[mainSize] / (style[mainSize] - mainSpace);

		let currentMain = mainBase;
		for (let i = 0; i < items.length; i++) {
			let item = items[i];
			let itemStyle = getStyle(item);

			//在只有一行且overflow的情况下 flex元素直接被压缩掉
			//（因为toybrower不考虑文字撑开）
			if (itemStyle.flex) {
				itemStyle[mainSize] = 0;
			}

			//其余非flex元素（不含flex相关属性的元素）
			// 在flex container中等比缩放的被框在container里面
			itemStyle[mainSize] = itemStyle[mainSize] * scale;
			itemStyle[mainStart] = currentMain; //离容器Start的距离计算
			itemStyle[mainEnd] = itemStyle[mainStart] + mainSign * itemStyle[mainSize]; //计算元素end的位置

			//更新下个子元素的start位置
			currentMain = itemStyle[mainEnd];
		}
	} else {
		// 可以换行情况下
		//处理每个flex行
		flexLines.forEach(function(line) {
			//line是个数组，包含应该在该行的items
			let mainSpace = line.mainSpace;
			let flexTotal = 0; //统计flex属性值的总和
			//console.log('line', line);
			for (let i = 0; i < line.length; i++) {
				let item = line[i];
				let itemStyle = getStyle(item);
				if (itemStyle.flex !== null && itemStyle.flex !== undefined) {
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
					// toybrowser对于简写的flex只处理flex-grow
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
				//处理justify-content属性： 处理主轴方向上的空白
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
					// x个元素 x-1个间隙平分空白
					gap = mainSpace / (line.length - 1) * mainSign; //计算间距
					currentMain = mainBase;
				}
				if (style.justifyContent === 'space-around') {
					// 为每个元素周围分配相同的固定大小
					// 所以元素与元素间的间隔时 固定间隔
					// 元素与边缘间隔时 固定间隔/2
					gap = mainSpace / line.length * mainSign;
					currentMain = gap / 2 + mainBase;
				}
				// 确定好空白间隔值和排列起始位置后就可以一次计算每个元素在主轴上的位置了
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

	//3.计算交叉轴方向排列

	crossSpace = 0; //记录整个flex container的空白crossSpace

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

	//计算交叉轴方向的gap
	let gap;
	// 当flex container允许换行，有多个轴线时 align-content才生效
	if (style.alignContent === 'flex-start') {
		crossBase += 0;
		gap = 0; //无间距
	}
	if (style.alignContent === 'flex-end') {
		crossBase = crossBase + crossSign * crossSpace;
		gap = 0;
	}
	if (style.alignContent === 'center') {
		crossBase = crossBase + crossSpace / 2 * crossSign; //从中间向两边排布
		gap = 0;
	}
	if (style.alignContent === 'space-between') {
		crossBase += 0;
		gap = crossSpace / (flexLines.length - 1) * crossSign; //计算间距
	}
	if (style.alignContent === 'space-around') {
		gap = crossSpace / flexLines.length * crossSign;
		crossBase = gap / 2 + crossBase;
	}
	if (style.alignContent === 'stretch') {
		crossBase += 0;
		gap = 0;
	}

	// 处理每一行
	flexLines.forEach(function(line) {
		// 计算每行在交叉轴方向上的大小
		let lineCrossSize =
			style.alignContent === 'stretch' ? line.crossSpace + crossSpace / flexLines.length : line.crossSpace;
		// console.log(lineCrossSize);
		// 计算每行内元素
		for (let i = 0; i < line.length; i++) {
			let item = line[i];
			let itemStyle = getStyle(item);

			// 若flex item自身有align self属性
			// 则忽略align item
			let align = itemStyle.alignSelf || style.alignItems;
			// console.log(align);

			if (itemStyle[crossSize] === null) {
				itemStyle[crossSize] = align === 'stretch' ? lineCrossSize : 0;
			}

			if (align === 'flex-start') {
				itemStyle[crossStart] = crossBase;
				itemStyle[crossEnd] = itemStyle[crossStart] + crossSign * itemStyle[crossSize];
			}
			if (align === 'flex-end') {
				itemStyle[crossEnd] = crossBase + crossSign * lineCrossSize;
				itemStyle[crossStart] = itemStyle[crossEnd] - crossSign * itemStyle[crossSize];
			}
			if (align === 'center') {
				itemStyle[crossStart] = crossBase + crossSign * (lineCrossSize - itemStyle[crossSize]) / 2;
				itemStyle[crossEnd] = itemStyle[crossStart] + crossSign * itemStyle[crossSign];
			}

			if (align === 'stretch') {
				itemStyle[crossStart] = crossBase;
				itemStyle[crossEnd] =
					crossBase +
					crossSign *
						(itemStyle[crossSize] !== null && itemStyle[crossSize] !== undefined
							? itemStyle[crossSize]
							: lineCrossSize);
				itemStyle[crossSize] = crossSign * (itemStyle[crossEnd] - itemStyle[crossStart]);
			}
		}
		// 每行结束后更新下一行crossBase
		crossBase += crossSign * (lineCrossSize + gap);
	});
	//console.log(items);
}

module.exports = layout;
