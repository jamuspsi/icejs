if(typeof require != 'undefined') require('module-alias/register');
var define = (this.nodeish||require('@nodeish'))(this.window||arguments);
define('icejs/marshalling', function({exports, require, rfr, module}) {

    MarshalledCall = exports.MarshalledCall = Ice.$extend('MarshalledCall', {
        __init__: function(opts) {
        // I didn't see why this would be an object,
        // but it's because python wants it to be.

            var self = this;
            
            // required for loadsing
            opts = opts || {};

            self.messages = [];
            self.errors = [];
            self.logging = [];
            self.log_entries = [];

            self.url = opts.url || '';
            self.http_method = opts.http_method || 'post';
            
            self.action = opts.action;
            self.kwargs = opts.kwargs || {};
            self.meta = {};
            self.ret = undefined;

        },
        __keys__: function() {
            return this.$super().concat([
                'url',
                'messages', 'errors',
                'logging', 'log_entries',
                'url', 'http_method', 'action', 'kwargs', 'meta', 'ret',

            ]);
        },
        send: function() {
            var self = this;
            var call = self;

            if(!call.action) {
                throw new Error('A marshalled call MUST specify an action.');
            }


            var deferred = $.Deferred();
            deferred.marshalled_call = call;

            var xhr = call.xhr = $.ajax({
                url: call.url,
                method: call.http_method,
                dataType: 'text',
                contentType: 'application/json',
                data: Ice.dumps(call),
                dataFilter: function(data, type) {
                    return Ice.loads(data);
                },
            });
            var messages = call.messages = call.messages || [];
            var errors = call.errors = call.errors || [];

            function parse_json_response(jsonable) {
                // I don't want to do this in always() because it would
                // get done twice.  So done() and fail() will each call this.
                if(jsonable) {
                    if(jsonable.messages) {
                        messages.push(...jsonable.messages);
                    }
                    if(jsonable.errors) {
                        errors.push(...jsonable.errors);
                    }
                }

            }

            xhr.fail(function(xhr, textStatus, errorThrown) {
                var jsonable;

                try{
                    jsonable = Ice.loads(xhr.responseText);
                } catch(ex) {
                    // We got an error, we don't really expect a good response here.

                    // console.error('Failed to deserialize a response from the server.');
                    // throw ex;
                }
                call.http_status = textStatus;
                call.xhr_error = errorThrown;

                parse_json_response(jsonable);

                deferred.reject(null, jsonable, call);
            });
            xhr.done(function(data) {
                // data is already loads'd

                parse_json_response(data);
                if(errors.length) {
                    deferred.reject(data.ret, data, call);
                } else {
                    deferred.resolve(data.ret, data, call);
                }
            });

            return deferred;    
        }
        
    });

    MarshalledMethod = exports.MarshalledMethod = function(opts) {
        var method = _.extend({}, opts);

        method.action = opts.action;
        method.url = method.url || '';
        method.method = method.method || 'post';
        
        if(!method.action) {
            throw new Error('MarshalledAction MUST specify an action.');
        }

        function invoke(kwargs) {
            console.warn("invoke for action ", opts.action, " with kwargs ", kwargs);
            var call_opts = {
                'url': method.url,
                'method': method.method,
                'action': method.action,
                'kwargs': kwargs,
            };

            var call = MarshalledCall(call_opts);
            return call.send();
            // return call;
        };
        invoke.method = method;

        return invoke;
    };
    exports.MarshalledObject = window.MarshalledObject = IceModel.$extend('MarshalledObject', {
        __init__: function() {
            var self = this;
            self.$super();
             
            self.marshalled_methods = [];

        },
        __keys__: function() {
            return this.$super().concat([
                'marshalled_methods',
            ]);
        },
        setup: function() {
            var self = this;
            // Called before bindings
            _.each(self.marshalled_methods, function(action) {
                var marshalled_method = MarshalledMethod({
                    'url': '',
                    'method': 'post',
                    'action': action,
                });

                var wrapped = function(kwargs) {
                    if(self[action+'/kwargs']) {
                        kwargs = self[action+'/kwargs'](kwargs);
                        if(!kwargs) return; // bail out.
                    }

                    var def = marshalled_method(kwargs);
                    if(self[action+'/call']) {
                        self[action+'/call'](action, kwargs, def);
                    }
                    self.action_call(def, kwargs); // The global hook.

                    if(self[action+'/done']) {
                        def.done(_.bind(self[action+'/done'], self));
                    }
                    if(self[action+'/fail']) {
                        def.fail(_.bind(self[action+'/fail'], self));
                    }
                    if(self[action+'/always']) {
                        def.always(_.bind(self[action+'/always'], self));
                    }

                    return def;
                    
                }
                self[action] = wrapped;



            });
        },
    });

});
