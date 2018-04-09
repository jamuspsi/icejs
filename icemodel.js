
IceModel = Ice.$extend('IceModel', {
    __init__: function() {
        var self = this;
        self.$super();


        self.errors = ko.observableArray([]);
        self.field_errors = ko.observable({});

        self.vm = null;
    },
    save: function() {
        var self = this;

        if(!self.can_save()) return false;



        self.dirty.save_start();

        var def = self.$class.save_api.post({
            'patch': self.as_patch(),
        }).fail(function(errors, field_errors, data) {
            self.errors(errors);
            self.field_errors(field_errors);
            if(data && data.jsonable) {
                self.update_from_jsonable(data.jsonable);
            }

            self.dirty.saving(false);

        }).done(function(data) {
            self.dirty.save_end();
            self.clear_errors();
            console.log('save successful, jsonable to update from is ', data.jsonable);
            self.update_from_jsonable(data.jsonable);
            if(!self.dirty.changed_during_save) self.dirty.clean();


        }).always(function() {
        });

        return def;

    },

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
    clear_errors: function() {
        var self = this;
        self.errors([]);
        self.field_errors({});

    },

    delete: function() {
        var self = this;

        var def = self.$class.delete_api.post({
            'delete_pk': self.pk()
        }).fail(function(errors, field_errors) {
            self.errors(errors);
        });

        return def;

    },
    has_errors: function() {
        var self = this;

        return self.errors().length || _.keys(self.field_errors()).length;
    },
});
