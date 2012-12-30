Backbone.View.prototype.close = function() {
    this.unbind();
    this.remove();

    if (this.onClosing) {
        this.onClosing();
    }
};

var app = app || {};

(function(models){

    models.Platform = Backbone.Model.extend({
        defaults: {
            Line: null,
            PlatformKey: null,
            PlatformName: null,
            StationName: null,
            PlatformOrder: null,
            StartOfLine: null,
            EndOfLine: null,
            Branch: null,
            Direction: null,
            stop_id: null,
            stop_code: null,
            stop_name: null,
            stop_desc: null,
            stop_lat: null,
            stop_lon: null
        }
    });

    models.StopActivity = Backbone.Model.extend({
        defaults: {
            Line: null,
            Trip: null,
            PlatformKey: null,
            InformationType: null,
            Time: null,
            TimeRemaining: null,
            Revenue: null,
            Route: null
        }
    });

})(app.models = app.models || {});

(function(collections){

    collections.StopActivities = Backbone.Collection.extend({
        model: app.models.StopActivity,
        url: 'http://query.yahooapis.com/v1/public/yql?q=select%20*%20from%20xml%20where%20url%3D\'http%3A%2F%2Fdeveloper.mbta.com%2FData%2FRed.xml\'&format=json&diagnostics=true',
        sync: function(method, model, options){
            options.timeout = 10000;
            options.dataType = 'jsonp';
            return Backbone.sync(method, model, options);
        },
        parse: function(response) {
            return response.query.results.Root.Red;
        },
        getByPlatformKey: function(platformKey) {
            return this.filter(function(model) {
                var v = model.get('PlatformKey');
                return v.toLowerCase() === platformKey.toLowerCase();
            });
        }
    });

    collections.Platforms = Backbone.Collection.extend({
        model: app.models.Platform,
        url: 'data/Platforms.json',
        groupedByStation: function() {
            return this.groupBy(function(model) {
                return model.get('StationName');
            });
        },
        getPlatformsByStation: function(station){
            return this.filter(function(model) {
                var v = model.get('StationName');
                return v.toLowerCase() === station.toLowerCase();
            });
        }
    });

})(app.collections = app.collections || {});

(function(views){

    views.BaseListView = Backbone.View.extend({
        tagName: 'ul',
        className: 'list inset'
    });

    views.CurrentStopListItem = Backbone.View.extend({
        tagName: 'li',
        events: {
            'click': function() {
                var url = 'platform/' + this.model.toLowerCase();
                app.router.navigate(url, true);
                return false;
            }
        },
        render: function() {
            this.$el.html(this.model);
            return this;
        }
    });

    views.CurrentStopList = views.BaseListView.extend({
        render: function() {
            var groups = this.collection.groupedByStation();

            _(groups).each(function(platforms, key){
                var v = new app.views.CurrentStopListItem({model:key, collection: this.collection});
                this.$el.append(v.render().el);
            }, this);

            return this;
        }
    });

    views.CurrentStopView = Backbone.View.extend({
        initialize: function() {
            this.collection = app.data.PlatformData;
        },
        render: function() {
            var v = new app.views.CurrentStopList({
                collection: this.collection
            });
            this.$el.html(v.render().el);
            return this;
        }
    });

    views.PlatformListView = Backbone.View.extend({
        views: [],
        initialize: function(options) {
            var v;
            while ((v = this.views.pop())) {
                v.close();
            }

            var p = app.data.PlatformData.getPlatformsByStation(options.name);

            var activity = app.data.ActivityData;

            _(p).each(function(platform){
                var key = platform.get('PlatformKey');

                var items = activity.getByPlatformKey(key);

                if (items.length) {
                    var v = new app.views.ActivityList({
                        model: platform,
                        collection: activity
                    });

                    this.views.push(v);
                }
            }, this);
        },
        render: function() {
            this.$el.html('');
            _(this.views).each(function(view){
                this.$el.append(view.render().el);
            }, this);
            return this;
        }
    });

    views.ActivityListItem = Backbone.View.extend({
        tagName: 'li',
        render: function() {
            var m = moment(this.model.get('Time'));
            this.$el.html(m.fromNow());
            return this;
        }
    });

    views.ActivityList = views.BaseListView.extend({
        render: function() {
            this.$el.html('');

            var direction = this.model.get('Direction');

            if (direction === 'SB') {
                direction = 'South Bound'
            } else if (direction === 'NB') {
                direction = 'North Bound';
            }

            var divider = $('<li class="list-divider">' + direction + '</li>');
            this.$el.append(divider);

            var key = this.model.get('PlatformKey');

            var items = this.collection.getByPlatformKey(key);

            _(items).each(function(item){
                var v = new app.views.ActivityListItem({
                    model: item
                });

                this.$el.append(v.render().el);
            }, this);

            return this;
        }
    });

})(app.views = app.views || {});

(function(routers){

    routers.Router = Backbone.Router.extend({
       routes: {
           '': 'index',
           'platform/:name': 'platform'
       },
       showView: function(view) {
            if (this.currentView){
                this.currentView.close();
            }

            this.currentView = view;
            $('#content').html(this.currentView.render().el);
            return view;
        },
        index: function() {
            this.showView(new app.views.CurrentStopView());
        },
        platform: function(name) {
            var v = new app.views.PlatformListView({
                name: name
            });
            this.showView(v);
        }
    });

})(app.routers = app.routers || {});

function loadData(callback) {
    app.data = app.data || {};

    if (!app.data.PlatformData) {
        app.data.PlatformData = new app.collections.Platforms();
    }

    var count = 0;
    var handleSuccess = function() {
        if (++count === 2 && callback) {
            callback();
        }
    };

    app.data.PlatformData.fetch({
        success: handleSuccess
    });

    if (!app.data.ActivityData) {
        app.data.ActivityData = new app.collections.StopActivities();
    }

    app.data.ActivityData.fetch({
        success: handleSuccess
    });
}

$(function() {
    loadData(function() {
        app.router = new app.routers.Router();
        Backbone.history.start();
    });
});