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

            self.url = opts.url || null;
            self.http_method = opts.http_method || 'post';
            
            self.action = opts.action;
            self.kwargs = opts.kwargs || {};
            self.meta = {};
            self.ret = undefined;

            self.pk = opts.pk || null;

        },
        __keys__: function() {
            return this.$super().concat([
                'url',
                'messages', 'errors',
                'logging', 'log_entries',
                'url', 'http_method', 'action', 'kwargs', 'meta', 'ret',
                'pk',
            ]);
        },
        send: function() {
            var self = this;
            var call = self;

            if(!call.action) {
                throw new Error('A marshalled call MUST specify an action.');
            }
            if(!self.url) {
                throw new Error('All marshalled calls must have a reversed, not implied uri');
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

                deferred.reject(null, call, jsonable);
            });
            xhr.done(function(data) {
                // data is already loads'd

                parse_json_response(data);
                if(errors.length) {
                    deferred.reject(data.ret, call, data);
                } else {
                    deferred.resolve(data.ret, call, data);
                }
            });

            return deferred;    
        }
        
    });

    MarshalledMethod = exports.MarshalledMethod = function(opts) {
        var method = _.extend({}, opts);

        method.action = opts.action;
        // method.url = method.url || '';
        // method.instance_url = method.instance_endpoint_url;

        method.method = method.method || 'post';
        
        if(!method.action) {
            throw new Error('MarshalledAction MUST specify an action.');
        }

        function invoke(self_pk, kwargs) {
            console.warn("invoke for action ", opts.action, " with kwargs ", kwargs);
            var call_opts = {
                // 'url': method.url,
                'method': method.method,
                'action': method.action,
                'kwargs': kwargs,
            };

            if(self_pk) {
                call_opts.pk = self_pk;
                call_opts.url = method.marshalling.instance_endpoint_url.replace('%7Bpk%7D', self_pk);
            } else {
                call_opts.url = method.marshalling.class_endpoint_url;
            }

            var call = MarshalledCall(call_opts);
            return call.send();
            // return call;
        };
        invoke.method = method;

        return invoke;
    };
    exports.MarshalledObject = MarshalledObject = Ice.$extend('MarshalledObject', {
        __init__: function() {
            var self = this;
            self.$super();
             
            // self.marshalled_methods = [];

        },
        // __keys__: function() {
        //     return this.$super().concat([
        //         'marshalled_methods',
        //     ]);
        // },
        setup: function() {
            var self = this;
            // Called before bindings
            
        },
    });

    MarshalledObject.$marshall_all = function(blobs) {
        blobs.forEach(blob=>MarshalledObject.$marshall(blob));

        _.each(deferred_implementations, function(impl, name) {
            Ice.$implement(name, impl, true); // Try to late-implement
        });
    };

    MarshalledObject.$marshall = function(blob) {
        // array wrap for fun.
        var existing = Ice.get_type(blob.name);
        if(existing && !existing.$marshalled) {
            return; // Ignore this one
        }

        var baseclass = Ice.get_type(blob.base_class);
        if(!baseclass) {
            throw 'Could not marshall class '+ blob.name+ ' because the base class '+ blob.base_class+ ' could not be found';
        }
        var methods = {
            __init__: function() {
                var self = this;
                self.$super();

                blob.fields.forEach(f=>{
                    var obs;
                    if(f.t == 'Components') {
                        obs = componentListObservable([]);
                    } else if(f.t == 'Component') {
                        obs = componentObservable(null);
                    } else {
                        var dv = f.default;
                        if(dv && typeof dv == 'object') {
                            dv = dv.constructor();
                        }
                        obs = ko.observable(dv);
                    }

                    obs.fieldinfo = f; // extra reference per field per instance, a bit heavy
                    if(f.select) {
                        obs.extend({
                            'selection': {
                                null_option: f.null_option,
                                null_text: f.null_text,
                                options: f.options,
                            }
                        })
                    }
                    if(f.money) {
                        obs.extend({
                            'money': {
                                nullable: f.null,
                            }
                        });
                        obs.fixed.fieldinfo = f;
                    }
                    if(f.input_type == 'date') {
                        obs.extend({'datetime': {}});
                    }
                    if(f.t == 'ForeignKey') {
                        console.log("Creating _id on ", f.name)
                        var key = key = function(o) { return o.pk ? o.pk() : o; };

                        
                        obs._id = ko.pure({
                            'read': function() {
                                return obs() ? key(obs()) : null;
                            },
                            'write': function(id) {
                                val = _.find(obs.tweaked_options(), o=>o && key(o) == id);
                                obs(val); // If this is undefined, sobeit.
                            }
                        });
                        obs._id._object = obs;
                        self[f.name+'_id'] = obs._id;
                    }

                    if(self.feedback) {
                        obs.feedback = self.feedback;
                        obs.error = ()=>self.feedback().get(f.name);

                        if(obs.fixed) {
                            obs.fixed.feedback = obs.feedback;
                            obs.fixed.error = obs.error;
                        }
                    }

                    // console.log("Checking for dirty on ", self.$class.$name, ": ", self.dirty);
                    if(!f.ignore_dirty && self.dirty) {
                        obs.extend({
                            'report_dirty': self.dirty,
                        });

                        // setup chaining for components
                        if(f.t == 'Component') {
                            obs.subscribeChanged(obj=>{
                                if(obj && obj.dirty && obj.dirty.chained_to && !obj.dirty.chained_to.length) {
                                    obj.dirty.chain_to(self.dirty);
                                }
                            });

                        // and for component lists
                        } else if(f.t == 'Components') {
                            if(f.name == 'items') {
                                console.log("Subscribing to items observable", obs);
                            }

                            obs.subscribeChanged(objs=>{
                                if(f.name == 'items') {

                                    console.log("Components changed to ", objs, "so trying to chain dirty");
                                }
                                _.each(objs, obj=>{
                                    if(obj && obj.dirty && obj.dirty.chained_to && !obj.dirty.chained_to.length) {
                                        if(f.name == 'items') {
                                            console.log("Chaining dirty on ", obj);
                                        }
                                        obj.dirty.chain_to(self.dirty);
                                    }
                                });
                            });
                            
                        }
                    }
                    self[f.name] = obs;
                });
            },
            __keys__: function() {
                return this.$super().concat(blob.keys);
            },
            __patchkeys__: function() {
                return this.$super().concat(blob.patchkeys);
            },
        };


        _.each(blob.marshalled_methods, function(action) {
            var marshalled_method = MarshalledMethod({
                'url': blob.class_endpoint_url,
                'method': 'post',
                'action': action,
                'marshalling': blob,
            });

            var wrapped = function(kwargs) {
                var self = this;

                if(self[action+'/kwargs']) {
                    kwargs = self[action+'/kwargs'](kwargs);
                    if(!kwargs) return; // bail out.
                }

                var self_pk = self.pk ? self.pk() : null;
                var def = marshalled_method(self_pk, kwargs);
                if(self[action+'/call']) {
                    self[action+'/call'](action, kwargs, def);
                }
                if(self['__marshalled__/call']) {
                    self['__marshalled__/call'](action, kwargs, def);
                }

                if(self['__marshalled__/done']) {
                    def.done(_.bind(self['__marshalled__/done'], self));
                }
                if(self['__marshalled__/fail']) {
                    def.fail(_.bind(self['__marshalled__/fail'], self));
                }
                if(self['__marshalled__/always']) {
                    def.always(_.bind(self['__marshalled__/always'], self));
                }

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
            wrapped.marshalling = blob;
            wrapped.marshalled_method = marshalled_method;
            methods[action] = wrapped;

        });





        var newclass = baseclass.$extend(blob.name, methods);
        newclass.$marshalled = blob;
        newclass.$methods = methods;

        return newclass;
    };

    var orig_ice_extend = Ice.$extend; // this is classy's extend

    var deferred_implementations = {};

    Ice.$implement = MarshalledObject.$implement = function(name, impl, disable_deferring) {
    
        // check to see if this class is already marshalled

        var marshalled = Ice.get_type(name);
        // if so, have it extend itself?
        if(!marshalled) {
            if(disable_deferring) {
                console.warn('Could not implement class '+name+' because it could not be found.');
                return;
            }
            deferred_implementations[name] = impl;
            return;
        }

        if(!marshalled.$marshalled) {
            throw 'Could not implement class '+name+' because it is not a marshalled class.  Did you double-implement?';
        }

        // create a new class extending off the original marshalled class.
        var implemented = marshalled.$extend(name, impl);
        marshalled.$name = marshalled.$classname = marshalled.$name+'__Marshalled__';

        // but also, we need to change the bases of every one of its subclasses.
        // which is a recursive process... 
        // okay the thing is, this should only really be done to marshalled ones.
        // if multiple classes in the inheritance chain are getting marshalled,
        // then as long as their implementations are calling $implement IN ORDER
        // there's no need for recursion here.  Okay yes there is.
        // but not much need for anything else.


        _.each(marshalled.$subclasses, subcls=>{
            if(subcls === implemented) return; // Don't rebase this one, we just made it!
            console.log("About to rebase subcls ", subcls.$name, !!subcls.$marshalled, " because the marshaleld subclass ", marshalled.$name, ' is implemented.');
            subcls.$rebase(implemented);
            var replaced = implemented.$extend(subcls.$name, subcls.$methods);

            // in case any of these subclassed ones are themselves marshalled
            // stand-ins.
            replaced.$marshalled = subcls.$marshalled;
            replaced.$methods = subcls.$methods;
        });
        return implemented;
    };

    // Ice.$rebase = 





});

