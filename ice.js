
if(window.ko) {
    // Not exactly deep voodoo, but voodoo.
    kocomputed_wrapper = function(f) {
        // Self doesn't exist at this time.
        f.constructor = kocomputed_wrapper;
        return f;

        var obj = function(self) {
            return _.bind(self);
        };
        obj.constructor = kocomputed_wrapper;
        return obj;
    };

    function componentObservable(val) {
        var obs;
        if(ko.isObservable(val)) {
            obs = val;
        } else {
            obs = ko.observable(val);
        }
        obs.isComponent = true;
        return obs;
    }

    function componentListObservable(val) {
        var obs;
        if(ko.isObservable(val)) {
            obs = val;
        } else {
            obs = ko.observableArray(val || []);
        }
        obs.isComponentList = true;
        return obs;
    }


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

if(window.moment) {
    window.moment.fn.strftime = function() {
        return this._i ? this._i.strftime.apply(this._i, arguments) : '';
    };
}


window.Ice = Ice = Class.$extend('Ice', {
    __init__: function() {
        var self = this;

        this.evChanged = IceEvent(this);
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
        if(window.Ice && window.Ice.Registry) {
            Ice.Registry.register(kls);
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
            if(v && v.constructor === IceObservable){
                attrs[i] = v();
            } else if(v && ko && ko.isObservable(v)) {

                attrs[i] = v();
            } else if(typeof(v) !== 'function') {
                attrs[i] = v;
            }
        }, this);
        return attrs;

    },
    pretty: function() {
        return [this.$class.$classname, this.ICEID, this.attrs()];
    },
    unsub: function(unsub) {
        _.each(this, function(v,i,l) {
            if(!v) {
                return;
            }
            if(v.constructor === IceObservable) {
                v.unsub(unsub);
            } else if(v.constructor === IceEvent) {
                v.unsub(unsub);
            }
            /* This becomes recursive, let's not.
            if(Ice.isIce(v)) {
                v.unsub(this);
            }*/
        });
    },
    python_kls: function() {
        return this.$class.$name;
    },
    as_jsonable: function() {
        var self = this;
        var jsonable = {'__kls__': self.python_kls()};
        _.each(self.__keys__(), function(key) {
            var val = key in self ? self[key] : null;
            if(ko.isObservable(val)) {
                val = val();
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
        _.each(self.__keys__(), function(key) {
            var val = jsonable[key];
            if (val && val.__kls__) {
                val = Ice.from_jsonable(val);
            }
            var target = self[key];
            if(target && ko.isObservable(target)) {
                target(val);
            } else {
                self[key] = val;
            }
        });
    },
    update_from_instance: function(instance) {
        // Another instance of this method.
        var self = this;
        _.each(self.__keys__(), function(key) {
            var val = instance[key];
            if(val && ko.isObservable(val)) {
                val = val();
            }

            if (val && val.__kls__) {
                val = Ice.from_jsonable(val);
            }
            var target = self[key];
            if(target && ko.isObservable(target)) {
                if(ko.isWriteableObservable(target)) {
                    target(val);
                }
            } else {
                self[key] = val;
            }
        });
    }
});
Ice.INSTANCE_COUNTERS = {};
Ice.isIce = function(obj) {
    return obj && obj.constructor === Class && obj.isa && obj.isa(Ice);
};
Ice.isa = function(o, kls) {
    return Ice.isIce(o) && o.isa(kls);
};

if(window.ko) {
    Ice.kocomputed = kocomputed_wrapper;

}

ClassRegistry = Ice.$extend('ClassRegistry', {
    __init__: function(kls) {
        var self = this;

        self.__typemap__ = {};
        if(kls) {
            self.register(kls);
            if(Ice.Registry && self !== Ice.Registry) {
                Ice.Registry.register(kls);
            }
            kls.from_jsonable = _.bind(self.from_jsonable, self);
        }
    },
    register: function(kls) {
        var self = this;

        self.__typemap__[kls.$name] = kls;
    },
    get_type: function(klsname) {
        var self = this;

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
            return datetime_to_Date(jsonable);
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


Ice.loads = function (stringed) {
    var res = JSON.parse(stringed);

    var wrapper = {
        'wrapped': res
    };
    function deepsearch(obj) {
        for(var i in obj) {
            if(!obj.hasOwnProperty(i)) {
                continue;
            }
            if(obj[i] && (obj[i].__type__ || obj[i].__kls__) == 'datetime') {
                obj[i] = datetime_to_Date(obj[i]);
            } else if(obj[i] && (obj[i].__type__ || obj[i].__kls__) == 'Decimal') {
                obj[i] = Number(obj[i].str);
            } else if(obj[i] && obj[i].__kls__) {
                deepsearch(obj[i]);
                obj[i] = Ice.from_jsonable(obj[i]);
            } else if(obj[i] && typeof(obj[i]) == 'object') {
                deepsearch(obj[i]);
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
             'year': obj.getFullYear(),
             'month': obj.getMonth() + 1,
             'day': obj.getDate(),
             'hour': obj.getHours(),
             'minute': obj.getMinutes(),
             'second': obj.getSeconds(),
             'microsecond': obj.getMilliseconds() * 1000
        };
    }

    function deepcopy(searchobj) {
        var copy;
        if(searchobj && Ice.isa(searchobj, Ice)) {
            return deepcopy(searchobj.as_jsonable());
        } else if (window.moment && window.moment.isMoment && window.moment.isMoment(searchobj)) {
            return searchobj._d;

        } else {
            copy = searchobj.constructor() || {};
        }
        // console.log("Deepcopying, starting with ", copy, copy.cid);
        window.debug = copy;
        for(var i in searchobj) {
            // console.log("Copying ", i, searchobj[i])

            if(!searchobj.hasOwnProperty(i)) {
                //console.log("skipping ", i);
                continue;
            }
            if(searchobj[i] && searchobj[i].constructor === Date) {
                //console.log("It's a date");
                copy[i] = Date_to_datetime(searchobj[i]);
            } else if(searchobj[i] && window.moment && window.moment.isMoment && window.moment.isMoment(searchobj[i])) {
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
}
