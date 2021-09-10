const modules = {};

/* const real_require = typeof require !== 'undefined' ? require : null;
const real_module = typeof module !== 'undefined' ? module : null;
*/

const browser_require = function(package_name, file_name, local_var) {
    if(modules[package_name]) {
        return modules[package_name].exports;
    }
    if(local_var && local_var in this) {
        return this[local_var];
    }
    console.warn('Module ', package_name, ' not found through browser_require.  Falling back to loading from global scope.');
    return this; // allow us to destructure it out of globals, or fail
}

/*
const node_rfr = function(package_name, file_name, local_var) {
    return real_require('rfr')(file_name || package_name);
}
const node_require = function(node_args) {

};*/

const bnode = function(module_name, node_args) {

    if(node_args) {
        // we're in node.
        // function set_exports(e) {
        //  root.exports = e;
        // }
        return {
            'exports': node_args.exports,
            'module': node_args.module, // this will be module.
            '__filename': node_args.__filename,
            '__dirname': node_args.__dirname,

            'require': function(package_name, file_name, local_var) {
                    return node_args.require(file_name || package_name);
            },
            'rfr': function(package_name, file_name, local_var) {
                return node_args.require('rfr')(file_name || package_name);
            },
            // 'set_exports': set_exports,
        };

    } else {
        var mod = modules[module_name] = {
            'exports': {},
        };
        // function set_exports(e) {
        //  modules[module_name] = e;
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
function nodeish(node_args_or_window) {
    /*
    Module wrapper from https://stackoverflow.com/questions/15406062/in-what-scope-are-module-variables-stored-in-node-js
    (function (exports, require, module, __filename, __dirname) {
         // your code is here
    }); 
    */
    var node_args = null;
    // Are we in node?  node_args is either arguments or window.
    // If it's window, it'll have window.
    if(!node_args_or_window.window) {
        node_args = {
            exports: node_args_or_window[0],
            require: node_args_or_window[1],
            module: node_args_or_window[2],
            __filename: node_args_or_window[3],
            __dirname: node_args_or_window[4],
        };
    }


    var define = function(module_name, factory) {
        factory(bnode(module_name, node_args));
    };
    return define;
}

// var define = (this.nodeish || require('@nodeish'))(this.window||arguments);
var define = nodeish(this.window||arguments);
define('nodeish', function({exports, require, rfr, module}) {
    module.exports = nodeish;
});
