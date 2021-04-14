const modules = {};

const real_require = typeof require !== 'undefined' ? require : null;
const real_module = typeof module !== 'undefined' ? module : null;


const browser_require = function(package_name, file_name, local_var) {
	if(modules[package_name]) {
		return modules[package_name].exports;
	}
	if(local_var && local_var in this) {
		return this[local_var];
	}
	return this; // allow us to destructure it out of globals, or fail
}

const node_rfr = function(package_name, file_name, local_var) {
	return real_require('rfr')(file_name || package_name);
}
const node_require = function(package_name, file_name, local_var) {
	return real_require(file_name || package_name);
}

const bnode = function(module_name, _module) {
	if(real_module) {
		// we're in node.
		// function set_exports(e) {
		// 	root.exports = e;
		// }
		return {
			'exports': _module.exports,
			'require': node_require,
			'rfr': node_rfr,
			'module': _module, // this will be module.
			// 'set_exports': set_exports,
		};

	} else {
		var mod = modules[module_name] = {
			'exports': {},
		};
		// function set_exports(e) {
		// 	modules[module_name] = e;
		// }
		// we're in browser.
		return {
			'exports': mod.exports,
			'require': browser_require,
			'rfr': browser_require,
			'module': mod,
			// 'set_exports': set_exports,
		}
	}
}
function bnode_define_curry(_module) {
	var define = function(module_name, factory) {
		factory(bnode(module_name, _module));
	};
	return define;
}

var define = bnode_define_curry(typeof module === 'object' ? module : this);
define('bnode', function({exports, require, rfr, module}) {


	module.exports = bnode_define_curry;
});
