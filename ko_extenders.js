/* Knockout extenders magic. */

ko.extenders.clamp = function clampObservable(obs, opts) {
    var min = opts.min;
    var max = opts.max;
    var nullable = opts.nullable;
    var floor = opts.floor;

    var clamped = ko.computed({
        read: obs,
        write: function(val) {

            if(val === '') {
                if(!nullable) {
                    clamped.revert();
                    return;
                }
                else {
                    obs(null);
                    return;
                }
            }

            if(isNaN(Number(val))) {
                clamped.revert();
                return;
            }

            if(min !== undefined && min !== null && val < min) {
                val = min;
            } else if(max !== undefined && max !== null && val > max) {
                val = max;
            }
            if(floor) {
                val = Math.floor(Number(val));
            }
            obs(Number(val));
            clamped.revert();

        }
    });

    clamped.revert = function () {
        obs.notifySubscribers(obs());
        clamped.notifySubscribers(clamped());
    };
    console.log("clamping obs ", obs);
    obs.clamped = clamped;
    return obs;
}

ko.extenders.trim = function trimObservable(obs, opts) {
    var trimmed = ko.computed({
        read: obs,
        write: function(val) {

            if(val === '') {
                obs(null);
            }

            obs(val.trim());
            trimmed.revert();

        }
    });

    trimmed.revert = function () {
        obs.notifySubscribers(obs());
        trimmed.notifySubscribers(trimmed());
    };
    obs.trimmed = trimmed;
    return obs;
};

ko.extenders.throttle = function(obs, opts) {
    var throttle = ko.observable(false);
    var throttled = ko.computed(function() {
        throttle();
        return obs.peek();
    });
    var trigger = _.throttle(function() {
        throttle(!throttle());
    }, 1000);

    obs.subscribeChanged(trigger);

    obs.throttled = throttled;
    return obs;
};

// Adds a method prefill(val) to an observable which sets the value, and also
// sets an added observable prefilled() to true.  When the extended observable changes,
// prefilled() becomes false.
ko.extenders.track_prefill = function(obs, opts) {
    obs.prefilled = ko.observable(false);
    obs.prefill = function(val) {
        if(!obs()) {
            obs(val);
            obs.prefilled(true);
        }
    }
    obs.subscribe(function() {
        obs.prefilled(false);
    }, obs, 'change');

    return obs;
};


ko.extenders.dirty_tracker = function(obs, opts) {
    obs.saving = false;
    obs.changed_during_save = false;
    obs.chained = [];
    obs.chained_to = [];

    obs.soil_callbacks = [];

    obs.save_start = function () {
        obs.saving = true;
        obs.changed_during_save = false;
    };

    obs.save_end = function() {
        obs.saving = false;
        if(!obs.changed_during_save) {
            obs.clean();
        }
    };

    obs.clean = function() {
        obs(false);  // No longer dirty.
        for(var x = 0; x < obs.chained.length; x++) {
            obs.chained[x].clean();
        }
    };

    obs.soil = function(changer, oldValue, newValue) {
        obs(true);
        obs.changed_observable = changer;
        obs.old_value = oldValue;
        obs.new_value = newValue;

        if(obs.saving) {
            obs.changed_during_save = true;
        }

        for(var x = 0; x< obs.chained_to.length; x++) {
            var dirty = obs.chained_to[x];
            dirty.soil(changer, oldValue, newValue);
        }

        for(var x = 0; x < obs.soil_callbacks.length; x++) {
            obs.soil_callbacks[x]();
        }

    };

    obs.observable = function(val) {
        return ko.observable(val).extend({'track_dirty': obs});
    }

    obs.chain_to = function(dirty) {
        dirty.chained.push(obs);
        obs.chained_to.push(dirty);

        // obs.subscribeChanged(function(newValue, oldValue) {
        //     console.log("Chaining dirty");
        //     if(newValue && !oldValue) {
        //         dirty.soil(obs, obs.old_value, obs.new_value);
        //     }
        // });
    }

    obs.onSoil = function(callback) {
        obs.soil_callbacks.push(callback);

    }

    obs(false);



    return obs;
}

ko.extenders.track_dirty = function(obs, dirty_bit) {
    obs.subscribeChanged(function(newValue, oldValue) {
        if(newValue === oldValue) {
            // this happens sometimes, I think when I manually trigger notifications from other reverts.
            return;
        }
        if(newValue === "" && oldValue === null) {
            obs(null); // No, go back to null.
            return;
        }
        if(newValue === null && oldValue === "") {
            return;
            // this is from me coercing it in the immediately preceding if.
        }
        dirty_bit.soil(obs, oldValue, newValue);


    });
    return obs;
}

kobe = function(opts) {
    var val = opts.val;
    opts = _.omit(opts, ['val']);

}

ko.observable.fn.toString = function() {
        return "observable: " + ko.toJSON(this(), null, 2);
    };

ko.computed.fn.toString = function() {
    return "computed: " + ko.toJSON(this(), null, 2);
};


ko.observable.fn.inc = function(v) {
    this(this() + v);
}

ko.extenders.masked_phone = function(target_obs, opts) {

    var comp = ko.computed({
        read: function() {
            var full = target_obs();
            if( /^\d{10}$/.test(full)) {
                return '(' + full.substr(0,3) + ') ' + full.substr(3, 3) + '-' + full.substr(6);

            }
            return target_obs();
        },
        write: function(val) {
            target_obs(val.replace(/\D/g, ''));
        },
    });

    target_obs.masked_phone = comp;
    return target_obs;

}

ko.observable.fn.toggle = function() {
    this(!this());
}


ko.extenders.datetime = function (obs, opts) {
    obs.html_date = ko.computed({
        'read': function() {
            console.trace('date read');
            if(!obs()) return obs();
            return obs().strftime('%Y-%m-%d');
        },
        'write': function(str) {
            console.trace('date write');
            var val = new Date(str + ' 0:0:00');
            obs(val);
        }
    });
    obs.html_time = ko.computed({
       'read': function() {
            console.trace('time read');
            if(!obs()) return obs();
            return obs().strftime('%H:%M:%S');
        },
        'write': function(str) {
            console.trace('time write');
            var val = new Date(obs().strftime('%Y-%m-%d') + ' ' + str);
            obs(val);
        }
    });


    obs.html_datetime = ko.computed({
       'read': function() {
            if(!obs()) return obs();
            return obs().strftime('%Y-%m-%dT%H:%M:%S');
        },
        'write': function(str) {
            var val = new Date(str.replace('T', ' '));;
            obs(val);
        }
    });

    return obs;
};

ko.bindingHandlers.mask_input = {
    init: function(element, valueAccessor) {
        // console.log("Setting up double_tap");
        $(element).mask(valueAccessor());

        ko.utils.domNodeDisposal.addDisposeCallback(element, function() {
        });
    },
    dispose: function(element, valueAccessor) {
        // console.log("Disposing doubletap");
        interact(element).unset();

    }
}
