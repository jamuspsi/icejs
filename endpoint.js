
Endpoint = Ice.$extend('Endpoint', {
    __init__: function(opts) {
        var self = this;

        opts = opts || {};
        /*
        opts = {
            'url': '', // some url to post to, default nothing (same page)
            'mode': 'queue', // queue up additional posts and process them in order.
            'mode': 'debounce', // queue up a maximum of one additional post, replacing any pending.
            'mode': 'reject', // refuse to queue, returning opts.full to the response handler
            'errors_key': 'errors', // on success, if this string exists in the json response, call failure with that
                                    // element instead of the success callbacks.  Also, on http error, create a
                                    // string representing that error and call the failure with that list.
            'field_errors_key': 'field_errors', // The key for field errors.
            'http_error_message': null,
        }
        */

        self.opts = opts || {};
        if(self.opts.errors_key === undefined) {
            self.opts.errors_key = 'errors';
        }
        if(self.opts.field_errors_key === undefined) {
            self.opts.field_errors_key = 'field_errors';
        }
        if(self.opts.base === undefined) {
            self.opts.base = {};
        }

        self.queue = [];

        self.xhr = null;


    },
    post: function(post) {
        var self = this;



        var deferred = $.Deferred();
        deferred.post_obj = post;



        if(self.opts.done) {
            deferred.done(self.opts.done);
        }
        if(self.opts.fail) {
            deferred.fail(self.opts.fail);
        }


        if(self.queue.length) {
            if(self.opts.mode == 'queue' || !self.opts.mode) {
                self.queue.push(deferred);
            } else if(self.opts.mdoe == 'debounce') {
                self.queue[0] = deferred;
            } else if(self.opts.mode == 'reject') {
                deferred.reject(['There is already a request in progress.']);

            }
        } else {

            self.queue.push(deferred);
        }

        self.pump();

        return deferred;

    },
    pump: function() {
        var self = this;

        if(self.xhr) {
            console.log("Not pumping ")
            return;
        }

        var deferred = self.queue.shift();
        if(!deferred) return;

        var post_data = _.extend({}, self.opts, deferred.post_obj);

        self.xhr = $.ajax({
            url: self.opts.url,
            method: self.opts.method || 'POST',
            dataType: 'text',
            data: Ice.dumps(post_data),
            dataFilter: function(data, type) {
                return Ice.loads(data);
            },
        }).fail(function(xhr, textStatus, errorThrown) {
            var http_error = self.opts.http_error_message;
            if(!http_error)
                http_error = 'API Error: ' + textStatus + ' ' + errorThrown;
            deferred.reject([http_error], {});

        }).done(function(data) {
            var errors = (self.opts.errors_key ? data[self.opts.errors_key] : []) || [];
            var field_errors = (self.opts.field_errors_key ? data[self.opts.field_errors_key] : {}) || {};
            if(errors.length || _.keys(field_errors).length) {
                deferred.reject(errors, field_errors, data);
            } else {
                deferred.resolve(data);
            }
        });

        /// XXX: Is this right?
        self.xhr.always(deferred.always);
        self.xhr.always(function() {
            self.xhr = null;
            self.pump();
        });

    },


});