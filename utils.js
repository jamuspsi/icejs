function ShowFullErrorStacks() {

     window.onerror = function (errorMsg, url, lineNumber, columnNumber, errorObject) {
                var errMsg;
                //check the errorObject as IE and FF don't pass it through (yet)
                if (errorObject && errorObject !== undefined) {
                        errMsg = errorObject.message;
                    }
                    else {
                        errMsg = errorMsg;
                    }
                console.error('Error: ' + errMsg);
        };
}

luhn = function(cardNumber) {
    if(typeof cardNumber !== 'string' || cardNumber.length < 2)
        return false;
    var digits = cardNumber.split('').reverse().map(function(x) {
        return parseInt(x, 10);
    }).filter(function(x) {
        return !isNaN(x);
    });
    var s1 = digits.filter(function(x, i) {
        return i % 2 === 0;
    }).reduce(function(a, x) {
        return a + x;
    }, 0);
    var s2 = digits.filter(function(x, i) {
        return i % 2 === 1;
    }).map(function(x) {
        return (x * 2).toString().split('').reduce(function(a, x) {
            return a + parseInt(x, 10);
        }, 0);
    }).reduce(function(a, x) {
        return a + x;
    }, 0);
    return (s1 + s2) % 10 === 0;
};




function loadExternalKnockoutTemplates(src_prefix, callback) {
    var sel = 'div[kot]:not([loaded]),script[kot]:not([loaded])';
    var $toload = $(sel);
    function oncomplete() {
        console.log("Loaded this", this);
        this.attr('loaded', true);
        var $not_loaded = $(sel);
        if(!$not_loaded.length) {
            callback();
        }
    }
    if(!$toload.length) {
        callback();
        return;
    }

    _.each($toload, function(elem) {
        var $elem = $(elem);
        var kot = $elem.attr('kot');
        var src = (src_prefix || '') + kot;
        $elem.attr('id', kot);
        $elem.attr('type', 'text/html');
        $elem.attr('src', src);
        // console.log("Trying to load for ", $elem);
        $elem.load(src, _.bind(oncomplete, $elem));
        // console.log("Loaded in theory.");
    });
}

function LazyTemplate(src_prefix, template) {
    if(template === undefined) {
        template = src_prefix;
        src_prefix = LazyTemplate.default_path;
        console.log("Auto prepending ", src_prefix, " to ", template);
    }

    var computed = LazyTemplate.computeds[template];
    if(computed) {
        // console.log('returning computed()', computed());
        return computed();
    }

    var signal = LazyTemplate.signals[template];
    if(!signal) {
        signal = LazyTemplate.signals[template] = ko.observable(false);
    }

    computed = window.lt_obs = ko.computed(function() {
        signal();
        // Try to find the template.
        var sel = 'div[type="text/html"][loaded][id="' + template + '"]';
        sel += ',script[type="text/html"][loaded][id="' + template + '"]';
        //console.log("Looking for", sel);
        var s = $(sel);
        if(s.length) {
            // console.log('I am going to return the normal one.', template);
            return template;
        }

        // Are we loading it?
        s = $('div[type="text/html"][id="' + template + '"],script[type="text/html"][id="' + template + '"]');
        if(!s.length) {
            // Begin loading it.
            s = $('<div kot="' + template + '" type="text/html" style="display: none">');
            s.appendTo($('body'));
            //console.log(loadExternalKnockoutTemplates);
            loadExternalKnockoutTemplates(src_prefix, function() {
                // One or more may have finished.
                _.each(LazyTemplate.signals, function(signal, template) {
                    var sel = 'div[type="text/html"][loaded][id="' + template + '"]';
                    if($(sel).length) {
                        // Signal this computed to re-evaluate.
                        console.log('Going to signal ', template, 'that it is loaded.');
                        signal(true);
                        signal.notifySubscribers(signal());
                        //computed.notifySubscribers(computed());
                    }
                });
            });
        }
        return 'not_loaded_yet.html';
    });
    computed.signal = signal;
    LazyTemplate.computeds[template] = computed;
    return computed();
}
LazyTemplate.computeds = {};
LazyTemplate.signals = {};
LazyTemplate.default_path;

function MonkeypatchKoTemplateBinding() {
    var templateWithContext = _.omit(ko.bindingHandlers.template);
    templateWithContext.baseupdate = templateWithContext.update;
    templateWithContext.update = function(element, valueAccessor, allBindings, data, context) {

        var options = ko.utils.unwrapObservable(valueAccessor());

        var extra_context = _.omit(options || {}, ['data', 'name', 'as']);
        ko.utils.extend(context, {context: extra_context});

        return ko.bindingHandlers.template.baseupdate.apply(this, arguments);
    };

    // Good bye knockout template binding, brian just raped you, and you liked it :)
    // console.log("Magic!");
    ko.bindingHandlers.template = templateWithContext;
}


var moneyObs = function(init) {
    var obs = ko.observable(0);
    var fixed = ko.computed({
        read: function() {
            return obs().toFixed(2);
        },
        write: function(val) {
            var parsed = parseFloat(val, 10);
            if(isNaN(parsed)) {
                result.notifySubscribers(obs());
                return;
            }
            obs(parseFloat(parsed, 10));
        }
    });

    obs.fixed = fixed;
    obs(init||0);
    //result(init);
    return fixed;

    /*result.fixed = ko.comput
    return result;*/
};


function quantityObservable(initial) {
    var internal_obs = ko.observable(initial);
    var computed = ko.computed({
        'read': internal_obs,
        'write': function(new_val) {
            console.log('test', new_val, Number(new_val), isNaN(Number(new_val)));
            if(isNaN(Number(new_val)) || new_val === '') {
                computed.revert();
                return;
            }
            if(new_val < 1) {
                internal_obs(1);
                computed.revert();

            } else {
                internal_obs(Number(new_val));
            }
        }

    });
    computed.revert = function () {
        computed.notifySubscribers(computed());
        internal_obs.notifySubscribers(internal_obs());
    };
    return computed;
}

function cloneObservable(obs) {
    return ko.computed({
        read: obs,
        write: obs,
    });
}


function clampObservable(obs, min, max) {
    var clamped = ko.computed({
        read: obs,
        write: function(val) {
            if(min !== undefined && val < min) {
                val = min;
            } else if(max !== undefined && val > max) {
                val = max;
            }
            obs(max);
            clamped.notifySubscribers(clamped());
        }
    });
    return clamped;
}



function tidyObservable(dirtyobs, val, is_already_wrapped) {
    var obs;
    if(!is_already_wrapped) {
        obs = ko.observable(val);
    } else {
        //console.log("Not wrapping because obs is ", obs);
        obs = val;
    }
    //var
    //obs.tidy = window.tidyCount++;
    obs.subscribeChanged(function(newValue, oldValue) {
        //console.log("changed, newvalue is ", newValue, "oldvalue is ", oldValue);
        if(newValue === oldValue) {
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
        if(!dirtyobs()) {
            // console.log("Making dirty from ", oldValue, newValue);
            //window.dirtything = obs;
            dirtyobs(true);
        }
    });
    return obs;
}