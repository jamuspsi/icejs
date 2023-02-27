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
                        obs.subscribe(function(changes) {
                            console.log("ComponentListObservvable changed", changes);
                            changes.forEach(function(change) {
                                if(change.status == 'added') {
                                    var comp = change.value;
                                    if(comp && comp[f.component_parent_field]) {
                                        // console.log("Assigning parent ", f.component_parent_field, self);
                                        comp[f.component_parent_field](self);
                                    }
                                }
                            });
                        }, null, 'arrayChange');

                    } else if(f.t == 'Component') {
                        obs = componentObservable(null);
                        obs.subscribeChanged(function(comp) {
                            if(comp && comp[f.component_parent_field]) {
                                comp[f.component_parent_field](self);
                            }
                        });
                    } else {
                        var dv = f.default;
                        if(dv && typeof dv == 'object') {
                            dv = dv.constructor();
                        }
                        obs = ko.observable(dv);
                    }

                    obs.fieldinfo = f; // extra reference per field per instance, a bit heavy

                    if(f.t == 'ForeignKey') {
                        var obs = ko.observable();
                        obs._trans_update = false;
                        var _id = ko.observable();
                        obs._id = _id;
                        obs.fieldinfo = f;
                        obs.object_lookup = null;
                        obs.refresh = function() {
                            var newval = _id();
                            if(newval !== null && newval !== undefined) {
                                if(obs.object_lookup) {
                                    var obj = obs.object_lookup(newval);
                                    obs(obj);
                                }
                            }

                        }
                        // when ID is set, attempt to set obs if possible.

                        _id.subscribeChanged(function(newval) {
                            if(obs._trans_update) {
                                return;
                            }
                            obs._trans_update = true;
                            try {
                                obs.refresh();
                            } finally {
                                obs._trans_update = false;
                            }

                        });
                        obs.subscribeChanged(function(newval) {
                            if(obs._trans_update) {
                                return;
                            }
                            obs._trans_update = true;

                            try {   
                                if(!newval) {
                                    _id(newval);
                                } else {
                                    _id(newval.pk());
                                }
                            } finally {
                                obs._trans_update = false;
                            }
                        });
                        /*
                        var object_obs = ko.observable();
                        object_obs.poking = 0;
                        obs = ko.pure({
                            read: function() {
                                obs._id(); // subscribe to this.

                                if(object_obs.poking) {
                                    return object_obs();
                                }
                                if(object_obs()) {
                                    return object_obs();
                                } else if(obs._id() !== null && obs._id() !== undefined) {
                                    try {
                                        var obj = obs.object_lookup(obs._id());
                                        object_obs(obj);
                                        return object_obs();                                        
                                    } catch {
                                        return undefined;
                                    }
                                }
                            },
                            write: function(obj) {
                                object_obs(obj);
                                object_obs.poking += 1;
                                obs._id(obj ? obj.pk() : null);
                                object_obs.poking -= 1;
                            },
                        });
                        obs.object_obs = object_obs;
                        obs.fieldinfo = f;
                        obs._id = ko.observable();
                        obs.object_lookup = null;
                        obs._id.subscribeChanged(function(id) {
                            // clear the "Cached" object_obs
                            if(!object_obs.poking) {
                                object_obs.poking += 1;
                                object_obs(null);
                                object_obs.poking -= 1;
                            }
                        });
                        */
                        self[f.name+'_id'] = obs._id;

                    }

                    if(f.select) {
                        obs.extend({
                            'selection': {
                                null_option: f.null_option,
                                null_text: f.null_text,
                                options: f.options,
                            }
                        })
                    }
                    /*
                    if(f.money) {
                        obs.extend({
                            'money': {
                                nullable: f.null,
                                min: f.min,
                                max: f.max,
                                increments_of: f.increments_of,
                            }
                        });
                        obs.text_input_obs.fieldinfo = f;
                    }
                    */
                    
                    if(f.t == 'IntegerField') {
                        obs.extend({
                            'clamp': {
                                min: f.min,
                                max: f.max,
                                nullable: f.null,
                                floor: f.floor,
                            },
                        })
                    }
                    if(f.t == 'DecimalField') {
                        var textextender = 'decimal';
                        if(f.money) {
                            textextender = 'money';
                        }

                        obs.extend({
                            'decimal': {
                                min: f.min,
                                max: f.max,
                                nullable: f.null,
                                floor: f.floor,
                                increments_of: f.increments_of,
                                trailing_zeros: f.trailing_zeros,

                            },
                        })
                    }

                    if(f.input_type == 'date') {
                        obs.extend({'datetime': {}});
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
                                // console.log("Subscribing to items observable", obs);
                            }

                            obs.subscribeChanged(objs=>{
                                if(f.name == 'items') {

                                    // console.log("Components changed to ", objs, "so trying to chain dirty");
                                }
                                _.each(objs, obj=>{
                                    if(obj && obj.dirty && obj.dirty.chained_to && !obj.dirty.chained_to.length) {
                                        if(f.name == 'items') {
                                            // console.log("Chaining dirty on ", obj);
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
            console.log("Deferring implementation of ", name);
            deferred_implementations[name] = impl;
            return;
        }

        if(!marshalled.$marshalled) {
            throw 'Could not implement class '+name+' because it is not a marshalled class.  Did you double-implement?';
        }

        console.group("Implementing ", name, ' with subclasses ', marshalled.$subclasses.map(s=>s.$name));

        // create a new class extending off the original marshalled class.
        var previous_subclasses = marshalled.$subclasses;
        marshalled.$subclasses = [];

        var implemented = marshalled.$extend(name, impl);
        marshalled.$name = marshalled.$classname = marshalled.$name+'__Marshalled__';
        // Re-register the marshalled version.
        Ice.Registry.register(marshalled);

        // but also, we need to change the bases of every one of its subclasses.
        // which is a recursive process... 
        // okay the thing is, this should only really be done to marshalled ones.
        // if multiple classes in the inheritance chain are getting marshalled,
        // then as long as their implementations are calling $implement IN ORDER
        // there's no need for recursion here.  Okay yes there is.
        // but not much need for anything else.

        // marshalled subclasses must now be effectively ONLY the implementation.
        if(previous_subclasses.length) {
            console.log("A newly implemented class ", name, " had subclasses ", _.map(previous_subclasses, subcls=>subcls.$name));
        }
        // console.log("Checking to see if I need to rebase any subclasses of ", marshalled.$name);
        _.each(previous_subclasses, subcls=>{
            if(subcls === implemented) return; // Don't rebase this one, we just made it!
            console.log("About to rebase subcls ", subcls.$namec, !!subcls.$marshalled, " because the marshaleld subclass ", marshalled.$name, ' is implemented.');
            subcls.$rebase(implemented);

            /* What the heck is this even for???            
            var replaced = implemented.$extend(subcls.$name, subcls.$methods);
            // in case any of these subclassed ones are themselves marshalled
            // stand-ins.
            replaced.$marshalled = subcls.$marshalled;
            replaced.$methods = subcls.$methods;
            */
        });
        console.groupEnd();

        return implemented;

    };

    // Ice.$rebase = 





});

