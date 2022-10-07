var define = (this.nodeish||require('@nodeish'))(this.window||arguments);
define('icemodel', function({exports, require, rfr, module}) {

    var {Ice} = rfr('icejs', 'icejs/ice.js');
    var {MarshalledObject} = rfr('icejs/marshalling', 'icejs/marshalling.js');

    var ko = rfr('ko', 'koplus/knockout-3.4.0.koplus.js', 'ko');
    var _ = require('lodash', '', '_');


exports.IceModel = IceModel = MarshalledObject.$extend('IceModel', {
    __init__: function() {
        var self = this;
        self.$super();

        self.pk = ko.observable(null);
        self.errors = ko.observableArray([]);
        self.field_errors = ko.observable({});

        self.dirty = ko.observable(false).extend({'dirty_tracker': true});

        self.vm = null;

        self.feedback = ko.observable(ValidationFeedback.BLANK);
    },
    __keys__: function() {
        return this.$super().concat(['pk']);
    },
    __patchkeys__: function() {
        return ['pk'];
    },
    begin_save: function() {
        var self = this;
        self.dirty.begin_save();
    },
    abort_save: function() {
        var self = this;
        self.dirty.saving(false);
    },
    finish_save: function(instance) {
        var self = this;
        self.dirty.finish_save();
        
        /* Fixme
        if(self.dirty()) {
            // we changed since we started saving, so discard this instance.
            return;
        } */
        if(instance){
            self.update_from_instance(instance);
        }

    },
    // save: function() {
    //     var self = this;

    //     if(!self.can_save()) return null;



    //     self.dirty.save_start();

    //     var def = self.$class.save_api.post({
    //         'patch': self.as_patch(),
    //     }).fail(function(data, errors, field_errors) {
    //         self.errors(errors);
    //         self.field_errors(field_errors);
    //         if(data && data.jsonable) {
    //             self.update_from_jsonable(data.jsonable);
    //         }

    //         self.dirty.saving(false);

    //     }).done(function(data) {
    //         self.dirty.save_end();
    //         self.clear_errors();
    //         console.log('save successful, jsonable to update from is ', data.jsonable);
    //         if(data && data.jsonable) {
    //             self.update_from_jsonable(data.jsonable);
    //         }
    //         if(!self.dirty.changed_during_save) self.dirty.clean();


    //     }).always(function() {
    //     });

    //     return def;

    // },

    // Cleaning on client side is fairly duplicative and doesn't matter most of the time.
    // Now that the errors/field_errors are brought back through standard API stuff, this
    // probably is just extra effort.
    // clean: function() {
    //     var self = this;
    //     self.clear_errors();
    //     return;
    // },
    can_save: function() {
        var self = this;

        return true;

        // self.clean();

        // if(self.errors().length) {
        //     return false;
        // }
        // if(_.keys(self.field_errors()).length) {
        //     return false;
        // }
        // return true;
    },

    'delete': function() {
        var self = this;

        var def = self.$class.delete_api.post({
            'delete_pk': self.pk()
        }).fail(function(errors, field_errors) {
            self.errors(errors);
        });

        return def;

    },
    update_from_jsonable: function(jsonable) {
        var self = this;
        self.$super(jsonable);
        self.dirty.clean();
        // console.log("Cleaning post update");
    },
    update_from_instance: function(instance) {
        var self = this;
        self.$super(instance);
        self.dirty.clean();
    },

    set_feedback: function(feedback) {
        var self = this;
        self.feedback(feedback);
        _.each(feedback.component_feedbacks(), function(sub, fieldname) {
            var field = self[fieldname];
            if(field.isComponent && field()) {
                field().set_feedback(sub);
            }
        });
        _.each(feedback.componentlist_feedbacks(), function(subs, fieldname) {
            var field = self[fieldname];
            if(field.isComponentList && field()) {
                var comps = field();
                _.each(subs, function(sub, i) {
                    comps[i].set_feedback(sub);
                });                
            }
        });
    },

    save_status: function() {
        var self = this;
        self.dirty(); // subscribe.

        if(self.dirty.saving()) {
            return 'saving';
        }
        if(!self.pk()) {
            if(self.feedback() && self.feedback().rejected()) {
                return 'rejected';
            }
            if(self.feedback() && self.feedback().has_any_error()) {
                return 'errors';
            }
            return 'new';
        }
        
        if(self.dirty()) {
            return 'dirty';
        }

        if(self.feedback() && self.feedback().rejected()) {
            return 'rejected';
        }
        if(self.feedback() && self.feedback().has_any_error()) {
            return 'errors';
        }
        return 'saved';
    },
});

ValidationFeedback = Ice.$extend('ValidationFeedback', {
    __init__: function() {
        var self = this;
        self.$super();

        self.object_errors = ko.observableArray([]);
        self.fields = ko.observableArray([]);
        self.component_feedbacks = ko.observableArray([]);
        self.componentlist_feedbacks = ko.observableArray([]);
        self.has_any_error = ko.observable();
        self.strictness = ko.observable();
        self.rejected = ko.observable();
    },
    __keys__: function() {
        return this.$super().concat([
            'object_errors',
            'fields',
            'component_feedbacks',
            'componentlist_feedbacks',
            'has_any_error',
            'strictness',
            'rejected',
        ]);
    },
    get: function(fieldname) {
        var self = this;
        if(!fieldname) {
            return self.object_errors().join('; ');
        } else {
            return (self.fields()[fieldname] || []).join('; ');
        }
    },
    has_any: function(...these) {
        var self = this;
        if(!these.length) {
            return !!self.has_any_error();
        }
        return !!_.any(these, f=>self.get(f));

    },
    has_object_errors: function() {
        var self = this;
        return self.object_errors().length;
    },
});

BlankValidationFeedback = ValidationFeedback.$extend('BlankValidationFeedback', {
    __init__: function() {
        var self = this;
        self.$super();

        self.is_blank = true;
    },
});
ValidationFeedback.BLANK = BlankValidationFeedback();



// NotImplementedException = function(method) {
//     this.value = method;
//     this.message = 'Unimplemented method';
//     this.toString = function() {
//         return this.message + ' ' + this.method;
//     }
// };


});
