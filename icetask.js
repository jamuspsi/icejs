// I hate to make this require knockout but it makes sense.  Ice is increasingly requiring it though.

IceTask = Ice.$extend('IceTask', {
    __init__: function(opts) {
        var self = this;
        self.$super();

        self.done_callbacks = ko.observableArray([]);
        self.error_callbacks = ko.observableArray([]);
        self.http_fail_callbacks = ko.observableArray([]);
        self.always_callbacks = ko.observableArray([]);
        self.opts = opts ? opts.kwargs : {};
        self.task_id = ko.observable(opts ? opts.task_id : null);
        self.traceback = ko.observable(null);
        self.inserted_date = ko.observable(null);
        self.started_date = ko.observable(null);
        self.finished_date = ko.observable(null);
        self.task_status = ko.observable(null);
        self.errors_json = ko.observable(null);

        self.errors = ko.computed(function() {
            console.log("The errors json is ", self.errors_json());
            if(!self.errors_json()) return [];
            return Ice.loads(self.errors_json());
        });

        self.current_xhr = null;
    },
    delay: function() {
        var self = this;
        var data = {
            'action': 'start',
            'kwargs': self.kwargs
        };
        return self.send_request(data);
    },

    __keys__: function() {
        return this.$super().concat([
            'task_id', 'traceback', 'inserted_date', 'started_date', 'finished_date', 'task_status',
            'errors_json',
        ]);
    },
    __nopatch__: function() {
        return this.$super().concat([
            'task_id', 'traceback', 'inserted_date', 'started_date', 'finished_date', 'task_status',
            'errors_json',
        ]);
    },
    is_final: function() {
        var self = this;
        return self.task_status() == 'COMPLETE' || self.task_status() == 'ERROR' || self.task_status() == 'EXCEPTION';
    },

    check: function() {
        var self = this;
        var data = {
            'action': 'check',
            'task_id': self.task_id()
        };
        return self.send_request(data);

    },
    start_polling: function() {
        var self = this;
        self.polling = true;
        self.check();
    },
    send_request: function(data) {
        var self = this;

        var xhr = self.current_xhr = $.ajax({
            type: 'POST',
            dataType: 'text',
            dataFilter: function(data, type) {
                return Ice.loads(data);
            },
            url: self.endpoint_url(),
            data: {'task_request_json': Ice.dumps(data)},
        });

        xhr.done(function(data, textStatus) {
            self.current_xhr = null;
            console.log("Got back a thing.  Here's the data", data);
            self.update_from_instance(data.task);

            if(self.task_status == 'COMPLETE') {
                self.on_done();
                self.on_always();
            } else if(self.task_status == 'ERROR' || self.task_status == 'EXCEPTION') {
                self.on_error()
                self.on_always();
            }
            if(self.polling) {
                if(self.is_final()) {
                    self.polling = false;
                } else {
                    window.setTimeout(_.bind(self.check, self), 3000);
                }
            }

        });
        xhr.fail(function(xhr_again, textStatus, errorThrown) {
            self.current_xhr = null;
            self.on_http_fail(xhr_again, textStatus, errorThrown);

            _.each(self.http_fail_callbacks, function(fn) {
                fn(self, xhr, textStatus, errorThrown);
            });

            if(self.polling) {
                window.setTimeout(_.bind(self.check, self), 10000);

            }
        })


        return xhr;
    },
    endpoint_url: function(fn) {
        var self = this;
        throw ('Unimplemented IceTask without endpoint ' + self.$class.$name);
    },
    done: function(callback) {
        var self = this;
        self.done_callbacks.push(callback);
        return self;
    },
    error: function(callback) {
        var self = this;
        self.error_callbacks.push(callback);
        return self;
    },
    always: function(callback) {
        var self = this;
        self.always_callbacks.push(callback);
        return self;
    },
    on_done: function() {
        var self = this;
        _.each(self.done_callbacks, function(fn) {
                fn();
        });
        return;
    },
    on_error: function() {
        var self = this;
        _.each(self.error_callbacks, function(fn) {
                fn(self);
        });
        return;
    },
    on_always: function() {
        var self = this;
        _.each(self.always_callbacks, function(fn) {
                fn(self);
        });
        return;

    },
    on_http_fail: function(task, xhr, textStatus, errorThrown) {
        var self = this;
        _.each(self.http_fail_callbacks, function(fn) {
                fn(task, xhr, textStatus, errorThrown);
        });
        return;

    }
});

