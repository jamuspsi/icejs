IceTask = Ice.$extend('IceTask', {
    __init__: function(opts) {
        var self = this;
        self.$super();

        self.done_callbacks = [];
        self.fail_callbacks = [];
        self.always_callbacks = [];
        self.opts = opts ? opts.kwargs : {};
        self.task_id = opts ? opts.task_id : null;
        self.traceback = null;
        self.inserted_date = null;
        self.started_date = null;
        self.finished_date = null;
        self.task_status = null;
        self.errors_json = null;
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
        return self.task_status == 'COMPLETE' || self.task_status == 'ERROR' || self.task_status == 'EXCEPTION';
    },

    check: function() {
        var self = this;
        var data = {
            'action': 'check',
            'task_id': self.task_id
        };
        return self.send_request(data);

    },
    send_request: function(data) {
        var xhr = $.ajax({
            type: 'POST',
            dataType: 'text',
            dataFilter: function(data, type) {
                return Ice.loads(data);
            },
            url: self.endpoint_url(),
            data: {'task_request_json': Ice.dumps(data)},
        });
        xhr.done(function(data, textStatus) {
            self.on_done(data, textStatus);
            self.task_id = data.task_id;

            _.each(self.done_callbacks, function(fn) {
                fn(self, data, textStatus, xhr);
            });
        });
        xhr.fail(function(xhr_again, textStatus, errorThrown) {
            self.on_fail(xhr_again, textStatus, errorThrown);

            _.each(self.fail_callbacks, function(fn) {
                fn(self, xhr, textStatus, errorThrown);
            });
        })
        xhr.always(function(p1, p2, p3) {
            self.on_always(p1, p2, p3);
            _.each(self.always_callbacks, function(fn) {
                fn(self, p1, p2, p3);
            })
        });
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
    fail: function(callback) {
        var self = this;
        self.fail_callbacks.push(callback);
        return self;
    },
    always: function(callback) {
        var self = this;
        self.always_callbacks.push(callback);
        return self;
    },
    on_done: function(data, textStatus) {
        return;
    },
    on_fail: function(xhr, textStatus, errorThrown) {

    },
    on_always: function(p1, p2, p3) {

    },
});

