const images = require('images');

function render(viewport, element) {
	if (element.style) {
		let img = images(element.style.width, element.style.height);
		//layout处理css property时候将横线写法全都转驼峰了
		if (element.style.backgroundColor) {
			//console.log(element.style.backgroundColor);
			let color = element.style.backgroundColor || 'rgba(0,0,0)';
			let [ r, g, b ] = color.match(/[\d\.]+/g);
			//console.log(r, g, b);
			img.fill(Number(r), Number(g), Number(b), 1);
			viewport.draw(img, element.style.left || 0, element.style.top || 0);
		}
	}
	if (element.children) {
		for (let child of element.children) {
			//console.log(child);
			render(viewport, child);
		}
	}
}

module.exports = render;
