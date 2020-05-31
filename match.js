const CSSwhat = require('css-what');
const CSSselect = require('css-select');
function match(rules, elements) {
	const selectors = CSSwhat.parse(selector); //因为从右至左解析
	console.log(selectors);
	// let idList = element.attributes.filter((attr) => attr.name === 'id');
	// let classList = element.attributes.filter((attr) => attr.name === 'class');
}

module.exports = match;
