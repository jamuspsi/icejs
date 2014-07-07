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

function loadExternalKnockoutTemplates(src_prefix, callback) {
    var sel = 'script[kot]:not([loaded])';
    $toload = $(sel);
    function oncomplete() {
        //console.log("Loaded this", this);
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
        //_.defer(function() {
            //console.log("trying to load remote src ", src);
            $elem.load(src, _.bind(oncomplete, $elem));
        //});
    });
}

function LazyTemplate(src_prefix, template) {
    var computed = LazyTemplate.computeds[template];
    if(computed) {
        return computed();
    }

    var signal = LazyTemplate.signals[template];
    if(!signal) {
        signal = LazyTemplate.signals[template] = ko.observable(false);
    }

    computed = window.lt_obs = ko.computed(function() {
        signal();
        // Try to find the template.
        var sel = 'script[type="text/html"][loaded][id="' + template + '"]';
        //console.log("Looking for", sel);
        var s = $(sel);
        if(s.length) {
            //console.log('I am going to return the normal one.');
            return template;
        }

        // Are we loading it?
        s = $('script[type="text/html"][id="' + template + '"]');
        if(!s.length) {
            // Begin loading it.
            s = $('<script kot="' + template + '">');
            s.appendTo($('body'));
            //console.log(loadExternalKnockoutTemplates);
            loadExternalKnockoutTemplates(src_prefix, function() {
                // One or more may have finished.
                _.each(LazyTemplate.signals, function(signal, template) {
                    var sel = 'script[type="text/html"][loaded][id="' + template + '"]';
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
    console.log("Magic!");
    ko.bindingHandlers.template = templateWithContext;
}
