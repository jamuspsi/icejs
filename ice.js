var define = (this.nodeish||require('@nodeish'))(this.window||arguments);
define('icejs', function({exports, require, rfr, module}) {

Class = rfr('Class', 'classy/classy.js', 'Class');
var ko = rfr('ko', 'koplus/knockout-3.4.0.koplus.js', 'ko');
var {moment} = require('moment');
var _ = require('lodash', '', '_');


if(ko) {
    // Not exactly deep voodoo, but voodoo.
    var kocomputed_wrapper = exports.kocomputed_wrapper = function(f) {
        // Self doesn't exist at this time.
        f.constructor = kocomputed_wrapper;
        return f;

        var obj = function(self) {
            return _.bind(self);
        };
        obj.constructor = kocomputed_wrapper;
        return obj;
    };

    var componentObservable = exports.componentObservable = function(val) {
        var obs;
        if(ko.isObservable(val)) {
            obs = val;
        } else {
            obs = ko.observable(val);
        }
        obs.isComponent = true;
        return obs;
    }

    var componentListObservable = exports.componentListObservable = function(val) {
        var obs;
        if(ko.isObservable(val)) {
            obs = val;
        } else {
            obs = ko.observableArray(val || []);
        }
        obs.isComponentList = true;
        return obs;
    }


    var indexedListObservable = exports.indexedListObservable = function(initial, opts) {
        if(initial === undefined) initial = [];

        opts = opts || {};
        if(!opts.indexer) {
            opts.indexer = (obj)=>obj.id();
        }

        var list = ko.observableArray(initial);

        var obs = ko.pureComputed({
            'read': function() {
                return _.indexBy(list(), function(i) {
                    return opts.indexer(i);
                });
            },
            'write': function(val) {
                list(_.values(val));
            },
        });

        obs.push = _.bind(list.push, list);

        obs.as_jsonable = function() {
            return list;
        };
        obs.update_from_jsonable = function(jsonable) {
            list(jsonable);
        };
        obs.list = list;
        obs.isIndexedObservable = true;
        obs.isComponentList = true;
        return obs;
    };


    var forwardObservable = exports.forwardObservable = function(opts) {

        opts.initial = opts.initial || null;

        var store = opts.store || (function( ){
            return opts ? opts.id() : null;
        });

        if(!opts.restore) {
            throw 'No restore function provided!';
        }

        var concrete = ko.observable(opts.initial);
        var forwardref = ko.observable(null);

        var comp = ko.computed({
            'read': concrete,
            'write': function(val) {
                if(val && val.$forwardref) {
                    console.log("Storing forwardref ", val.$forwardref);
                    forwardref(val.$forwardref);
                } else {
                    concrete(val);
                    forwardref(opts.store(val));
                }
            }
        });
        comp.restore = function() {
            // var args = Array.prototype.slice.call(arguments);
            var forwardref = forwardref();
            if(!forwardref) {
                concrete(null);
                return;
            }
            var found = opts.restore(forwardref);
            concrete(found);
        }

        // this is what loads/dumps stores into.
        comp.forwardref = forwardref;
        comp.isForward = true;

        return comp;
    }


    var forwardIndexedObservable = exports.forwardIndexedObservable = function(opts) {
        var concrete = indexedListObservable(opts);

        if(!opts.store) {
            opts.store = opts.indexer;
        }

        if(!opts.restore) {
            throw 'No restore function provided!';
        }

        var forwardrefs = ko.observableArray(null);

        function sync_weakrefs() {
            forwardrefs(
                _.map(concrete.list(), opts.store)
            );
        }

        var comp = ko.computed({
            'read': concrete,
            'write': function(val) {
                if(val.$forwardref) {
                    forwardrefs(val.$forwardref);
                } else {
                    // replacing the whole dict.
                    concrete(val);
                    sync_weakrefs();
                }
            }
        });
        
        comp.restore = function() {
            var forwardrefs = [];
            if(forwardrefs()) 
                forwardrefs = forwardrefs();

            var found = _.map(forwardrefs, opts.restore);

            if(opts.prune_lost_references) {
                found = _.filter(found);
            }

            // replace the whole thing, and force a reindex.
            comp(found);
            
        }

        comp.push = function(o) {
            concrete.push(o);
            forwardrefs.push(opts.store(o));

            // I had this most recently before the refactor
            // as a complete reindex, but I can't see that being useful.
            //sync_weakref();
            // forwardref.push(o[opts.attr]());
        };

        comp.list = concrete.list;

        // this is what loads/dumps uses.
        comp.forwardref = forwardrefs;
        comp.isForward = true;
        return comp;
    }


}

if(ko) {
    /* Stolen from https://stackoverflow.com/questions/12822954/get-previous-value-of-an-observable-in-subscribe-of-same-observable */

    ko.subscribable.fn.subscribeChanged = function (callback) {
        var oldValue;
        this.subscribe(function (_oldValue) {
            oldValue = _oldValue;
        }, this, 'beforeChange');

        this.subscribe(function (newValue) {
            callback(newValue, oldValue);
        });
    };
}

exports.Ice = Ice = Class.$extend('Ice', {
    __init__: function() {
        var self = this;

        if(Ice.INSTANCE_COUNTERS[this.$class.$name] === undefined) {
            Ice.INSTANCE_COUNTERS[this.$class.$name] = 0;
        }
        this.ICEID = ++Ice.INSTANCE_COUNTERS[this.$class.$classname];

    },
    __postinit__: function() {
        // Construct a new ko.computed for THIS instance, since each one is different and should proc differently.
        // ko computeds have context and AREN'T METHODS.
        var self = this;

        _.each(self.$class.prototype, function(v,i) {
            /*if(kls.$name !== 'Crew') {
                return;
            }
            console.log("Checking ", kls.$name, " i ", i, " v ", v, " to see if it's a kocomputed");
            console.log(v.constructor);*/
            if(v && v.constructor === kocomputed_wrapper) {
                //console.log('It is!');
                //v.self = self;

                self[i] = ko.computed(function() {
                    //console.log("Running ", self.$class.$name, i, " computed with self=", self);
                    return v.apply(self, arguments);
                });
                self[i].magiced = true;
            }
        });

    },
    __postextend__: function(kls) {
        kls.$base = kls.$superclass;
        /* if(window.Ice && window.Ice.Registry) {
            Ice.Registry.register(kls);
        } */
        var base = kls;
        while(base) {
            if(base.Registry) {
                base.Registry.register(kls);
            }
            base = base.$base;
        }

    },

    // Essentially this is just a list of attrs to serialize.
    // Which is similar to what Ice is doing on the other side,
    // intended to bypass all the derivative data and methods and stuff.
    // fields is already a term being used on forms though, so I think I'm
    // Going to rename it to keys.
    __keys__: function() {
        return [];
    },

    isa: function(kls) {
    var walk = this.$class;
    while(walk !== undefined) {
        if(kls === walk){
        return true;
        }
        walk = walk.$superclass;
    }
    return false;

    },
    attrs: function() {
        var attrs = {};
        _.each(this, function(v,i,l) {
            if(v && ko && ko.isObservable(v)) {

                attrs[i] = v();
            } else if(typeof(v) !== 'function') {
                attrs[i] = v;
            }
        }, this);
        return attrs;

    },
    pretty: function() {
        return this.attrs();
    },

    python_kls: function() {
        return this.$class.$name;
    },
    as_jsonable: function() {
        var self = this;

        var __kls__ = Ice.Registry.override_kls_to_name[self.$class.$name];
        if(!__kls__) __kls__ = self.$class.$name;

        var jsonable = {'__kls__': __kls__};
        _.each(self.__keys__(), function(key) {
            var val = key in self ? self[key] : null;
            if(ko.isObservable(val)) {
                if(val.isForward) {
                    val = val.forwardref();
                } else if(val.isIndexedObservable) {
                    val = val.list();
                } else {
                    val = val();
                }
            }
            if(Ice.isa(val, Ice)) {
                val = val.as_jsonable();
            }
            jsonable[key] = val;
        });

        return jsonable;
    },
    __patchkeys__: function() {
        return this.__keys__();
    },
    __nopatch__: function() {
        return [];
    },

    as_patch: function() {
        var self = this;
        var patch = {};

        var patchkeys = _.difference(self.__patchkeys__(), self.__nopatch__());

        _.each(patchkeys, function(key) {
            var val = key in self ? self[key] : null;
            if(ko.isObservable(val)) {
                if(val.patch_on_write && !val.is_dirty()) return;

                if(val.isComponentList) {
                    // This automatically works with indexedListObservables because we're using map(), which will hit its values.
                    val = _.map(val(), function(component) {
                        return component ? component.as_patch() : component;
                    });
                } else if(val.isComponent) {
                    var component = val();
                    val = component ? component.as_patch() : component;
                } else {

                    val = val();
                }
            }
            patch[key] = val;
        });
        return patch;
    },
    update_from_jsonable: function(jsonable) {

        var self = this;

        if(jsonable.$class) {
            throw new Error('Cannot update from jsonable with a live class.  Did you mean to update_from_instance?');
        }
        
        _.each(self.__keys__(), function(key) {
            var val = jsonable[key];
            if (val && val.__kls__) {
                val = Ice.from_jsonable(val);
            }
            var target = self[key];
            if(target && ko.isObservable(target)) {
                if(target.isForward) {
                    target.forwardref(val);
                } else if(target.isIndexedObservable) {
                    target.list(val);
                } else {
                    target(val);
                }
            } else {
                self[key] = val;
            }
        });


    },
    update_from_instance: function(instance) {
        // Another instance of this method.
        var self = this;
        _.each(self.__keys__(), function(key) {
            var srcval = instance[key];
            if(srcval && ko.isObservable(srcval)) {
                srcval = srcval();
            }
            /*
            // This shouldn't be possible, because I'm in instance-land and it should just exist.
            if (srcval && srcval.__kls__) {
                srcval = Ice.from_jsonable(srcval);
            }*/
            var target = self[key];
            if(target && ko.isObservable(target) && ko.isWriteableObservable(target)) {
                // We're going to update this in place.
                // Wait, this doesn't work.  the component class may have changed.
                if(target.isComponent) {
                    if(target().$class === srcval.$class) {
                        // update it if the class is the same.
                        target().update_from_instance(srcval)
                    } else {
                        // otherwise, replace it.  I can't do better.
                        target(srcval);
                    }
                } else if(target.isComponentList) {
                    // Index the existing.
                    var by_position = target();
                    var existing = _.indexBy(by_position, o=>o.pk());
                    // existing may have null keys, but those won't ever hit.
                    // ^^ WRONG- they totally hit and cause all sorts of potential issues!


                    var newset = [];
                    _.each(srcval, function(comp, i) {
                        var pk = comp.pk();
                        var reuse = existing[pk];
                        // don't reuse it if it's not the same class.
                        if(pk && reuse && reuse.$class === comp.$class) {
                            reuse.update_from_instance(comp);
                            newset.push(reuse);
                        } else if(!pk && by_position[i] && !by_position[i].pk()) {
                            // We reuse blank instances that are in the same exact position.
                            // otherwise we just use the newly delivered ones.  It's a "slightly better"
                            // option that nevertheless might have some weird edge cases.
                            // delete this elif if necessary
                            reuse = by_position[i];
                            reuse.update_from_instance(comp);
                            newset.push(reuse);

                        } else {
                            newset.push(comp);
                        }
                    });
                    target(newset);
                } else {
                    target(srcval);
                }
            } else {
                self[key] = srcval;
            }
        });
    },
    restore_forward_refs: function() {
        // this method only actually makes sense when I'm deserializing a root, right?
        // Yeah, it's a manual call, so even if I were deserializing some template
        // or cloning a subobject, I just wouldn't call it.
        // If anything I might notate a class telling the deserializer to call this.
        var self = this;

        var root = this;
        var search_and_restore = function(obj) {
            for(k in obj) {
                if(!obj.hasOwnProperty(i)) {
                    continue;
                }

                var target = obj[k];
                if(ko.isObservable(target)) {
                    if(target.isForward) {
                        target.restore();
                    } else {
                        target = target();
                    }
                }
                if(Ice.isIce(target)) {
                    search_and_restore(target); // this maintains root through closure
                } else if(typeof target == 'object') {
                    // this is a (possible observable) array or object, so we attempt to
                    // restore it as well.
                    // heterogenous roots are going to be broken broken broken.
                    search_and_restore(target);
                }
            }

        };
        search_and_restore(self);
    },
});
Ice.INSTANCE_COUNTERS = {};
Ice.isIce = function(obj) {
    if(!obj) return false;
    return obj && obj.constructor === Class && obj.isa && obj.isa(Ice);
};
Ice.isa = function(o, kls) {
    return Ice.isIce(o) && o.isa(kls);
};

Ice.issubclass = function(kls, base) {
    while(kls) {
        if(kls === base) return true;
        kls = kls.$base;
    }
    return false;

}


Ice.datetime_to_Date = function(obj) {
    var val;
    if(obj.d) {
        val = new Date(obj.d);
    } else {
        val = new Date(obj.year, obj.month-1, obj.day, obj.hour, obj.minute, obj.second, obj.microsecond/1000);
    }
    if(window.moment) {
        return moment(val);
    }
    return val;
}

if(ko) {
    Ice.kocomputed = kocomputed_wrapper;
}

ClassRegistry = Ice.$extend('ClassRegistry', {
    __init__: function(kls) {
        var self = this;

        self.override_kls_to_name = {};
        self.override_name_to_kls = {};

        self.__typemap__ = {};
        if(kls) {
            self.register(kls);
            if(Ice.Registry && self !== Ice.Registry) {
                Ice.Registry.register(kls);
            }
            // Add a from_jsonable classmethod
            kls.from_jsonable = _.bind(self.from_jsonable, self);
        }
    },
    register: function(kls) {
        var self = this;

        self.__typemap__[kls.$name] = kls;
    },
    override: function(name, kls) {
        var self = this;

        // Serves two purposes:
        // 1. if a jsonable comes in with __kls__==name, then
        //    use this kls to instantiate it.
        // 2. When serializing an object of kls, store this in __kls__.

        // If there's a many-to-many situation, the most recent name overridden to a class
        // will be used for purpose 2.  Ex:
        // override(Foo, 'Bar')
        // override(Foo, 'Foo')
        // Foo will be serialized as Foo, both Foos and Bars will deserialize to Foo.

        self.override_name_to_kls[name] = kls;
        self.override_kls_to_name[kls.name] = name;

    },
    get_type: function(klsname) {
        var self = this;

        var override = self.override_name_to_kls[klsname];
        if(override) return override;

        return self.__typemap__[klsname];
    },
    from_jsonable: function(jsonable) {
        var self = this;

        if(Ice.isa(jsonable, Ice)) {
            return jsonable;
        }

        if(jsonable.__kls__ ==='Decimal') {
            return Number(jsonable.str);
        }
        if(jsonable.__kls__ === 'datetime') {
            return Ice.datetime_to_Date(jsonable);
        }

        var kls = self.get_type(jsonable.__kls__);
        if(!kls) {
            console.error("Couldn't find __kls__ ",
                jsonable.__kls__, ' for ', jsonable
            );

        }


        var obj = kls();
        obj.update_from_jsonable(jsonable);

        return obj;

    }
});

Ice.Registry = ClassRegistry(Ice);
Ice.get_type = _.bind(Ice.Registry.get_type, Ice.Registry);


Ice.loads = function (stringed) {
    var res = JSON.parse(stringed);
    return Ice.loadobj(res);
}
Ice.loadobj = function(plain_obj) {

    var wrapper = {
        'wrapped': plain_obj
    };
    function deepsearch(obj) {
        for(var i in obj) {
            if(!obj.hasOwnProperty(i)) {
                continue;
            }
            if(obj[i] && (obj[i].__type__ || obj[i].__kls__) == 'datetime') {
                obj[i] = Ice.datetime_to_Date(obj[i]);
            } else if(obj[i] && (obj[i].__type__ || obj[i].__kls__) == 'Decimal') {
                obj[i] = Number(obj[i].str);
            } else if(obj[i] && obj[i].__kls__) {
                deepsearch(obj[i]);
                obj[i] = Ice.from_jsonable(obj[i]);
            } else if(obj[i] && typeof(obj[i]) == 'object') {
                deepsearch(obj[i]);
                // this is written to replace-in-place: objects and Arrays (in this elif)
                // are searched again and replaced by index if there's something to do.
                // there's no else, so only (objects with a kls, property, or type attr) or objects
                // or lists are checked.  Everything else falls through and ISN'T recursively passed
                // to deepsearch. (We're not searching ints, for instance.)
            }
        }
    }
    //console.log('Deepsearching wrapper ', wrapper);
    deepsearch(wrapper);

    return wrapper.wrapped;
    //return res;
};

Ice.dumps = function(obj) {
    var copyobj = Ice.to_javascript_object(obj);
    return JSON.stringify(copyobj);
}

Ice.dumpobj = function(obj) {
    var copyobj = Ice.to_javascript_object(obj);
    return copyobj;
}

Ice.table = function(obj) {
    var keys;
    if(!Array.isArray(obj)) {
        obj = [obj];
    }

    var table = _.map(obj, function(o) {
        if(Ice.isa(o, Ice)) {
            return o.pretty()[2];
        }
        return o;
    });

    console.table(table);

}

Ice.to_javascript_object = function(obj) {
    function Date_to_datetime(obj) {
        return {
            '__kls__': 'datetime',
            'd': obj.toISOString(),
        };
        // return {
        //     '__kls__': 'datetime',
        //     'year': obj.getFullYear(),
        //     'month': obj.getMonth() + 1,
        //     'day': obj.getDate(),
        //     'hour': obj.getHours(),
        //     'minute': obj.getMinutes(),
        //     'second': obj.getSeconds(),
        //     'microsecond': obj.getMilliseconds() * 1000
        // };
    }

    function deepcopy(searchobj) {
        var copy;
        if(searchobj && Ice.isa(searchobj, Ice)) {
            return deepcopy(searchobj.as_jsonable());
        } else if (moment && moment.isMoment && moment.isMoment(searchobj)) {
            return searchobj._d;
/*
        } else {
            copy = searchobj.constructor ? searchobj.constructor() || {} : {};
        }
    */
        } else if(searchobj instanceof Promise) {
            return undefined;  // drop promises.  should probably drop functions too but


        } else if(searchobj !== undefined && searchobj !== null){
            // this is what constructs a new object or Array.
            copy = searchobj.constructor ? searchobj.constructor() || {} : {};
        } else {
            copy = searchobj;
        }

        // console.log("Deepcopying, starting with ", copy, copy.cid);
        for(var i in searchobj) {
            // console.log("Copying ", i, searchobj[i])

            if(!searchobj.hasOwnProperty(i)) {
                //console.log("skipping ", i);
                continue;
            }
            if(searchobj[i] && searchobj[i].constructor === Date) {
                //console.log("It's a date");
                copy[i] = Date_to_datetime(searchobj[i]);
            } else if(searchobj[i] && moment && moment.isMoment && moment.isMoment(searchobj[i])) {
                //console.log("It's a date");
                copy[i] = Date_to_datetime(searchobj[i]._d);
            } else if(searchobj[i] && Ice.isa(searchobj[i], Ice)) {
                //deepcopy(searchobj[i])
                copy[i] = deepcopy(searchobj[i].as_jsonable());
            } else if(searchobj[i] && typeof(searchobj[i]) == 'object') {
                //console.log("It's an object or array");
                copy[i] = deepcopy(searchobj[i]);
            } else if(typeof(searchobj[i]) === 'number' && searchobj[i] % 1) {
                copy[i] = {'__kls__': 'Decimal', 'str': searchobj[i].toString()};
            } else {
                //console.log("It's a primitive?")
                copy[i] = searchobj[i];
            }
        }
        // console.log("deeopcopy returning ", copy, copy.cid)
        return copy;
    }
    if(obj && Ice.isa(obj, Ice)) {
        obj = obj.as_jsonable();
    }
    if(typeof(obj) == 'object') {
        copyobj = deepcopy(obj);
    } else {
        copyobj = obj;
    }
    return copyobj;
};





});
