

CrudVM = Ice.$extend('CrudVM', {

    __init__: function() {
        var self = this;
        self.$super();

        self.errors = ko.observableArray([]);

        self.collection = ko.observableArray([]);
        // self.indexed_collection = ko.computed(function() {
        //     return _.indexBy(self.collection(), function(obj) {
        //         return obj.pk();
        //     });
        // });


    },
    setup: function() {
        var self = this;

        self.fetch_collection();


    },
    fetch_collection: function() {
        var self = this;

        self.item_class.fetch_api.post().done(function(data) {
            console.log("Fetch completed, I got ", data);
            self.collection(data.collection);

            _.each(self.collection(), function(item) {
                if(item.dirty) item.dirty.clean();
            });

        }).fail(function(errors) {
            window.alert('Could not fetch collection.');
            self.errors(errors);
        });

    },
    add_item: function() {
        var self = this;
        var item = new self.item_class();

        self.collection.push(item);
    },
    delete_item: function(item) {
        var self = this;
        if(!item.pk()) {
            self.collection.remove(item);
            return;
        }

        item.delete().done(function() {
            self.collection.remove(item);
        })

    },

    save_item: function(item) {
        var self = this;
        item.save();
    },

});
