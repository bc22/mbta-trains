Backbone.View.prototype.close = function() {
    this.unbind();
    this.remove();

    if (this.onClosing) {
        this.onClosing();
    }
};

var app = app || {};

app.events = app.events || _.extend({}, Backbone.Events);

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
            this.collection = new app.collections.Platforms();
            this.collection.fetch({async:false});
        },
        render: function() {
            var v = new app.views.CurrentStopList({
                collection: this.collection
            });
            this.$el.html(v.render().el);
            return this;
        }
    });

    views.PlatformListItem = Backbone.View.extend({
        tagName: 'li',
        events: {
            'click': function() {
                var station = this.model.get('StationName').toLowerCase();
                var direction = this.model.get('PlatformKey').toLowerCase();
                var url = 'platform/' + station + '/' + direction;
                app.router.navigate(url, true);
            }
        },
        render: function() {
            var direction = this.model.get('Direction');

            if (direction === 'NB') {
                this.$el.html('South Bound');
            } else if (direction === 'SB') {
                this.$el.html('North Bound');
            }

            return this;
        }
    });

    views.PlatformList = views.BaseListView.extend({
        render: function() {
            var platforms = this.collection.getPlatformsByStation(this.model);

            _(platforms).each(function(platform){
                var v = new views.PlatformListItem({model:platform});
                this.$el.append(v.render().el);
            }, this);

            return this;
        }
    });

    views.PlatformListView = Backbone.View.extend({
        platformList: null,
        initialize: function() {
            this.collection = new app.collections.Platforms();
            this.collection.fetch({async:false});

            this.platformList = new views.PlatformList({
                collection: this.collection,
                model: this.model
            });
        },
        render: function() {
            this.$el.html(this.platformList.render().el);
            return this;
        }
    });

    views.ActivityListItem = Backbone.View.extend({
        tagName: 'li',
        render: function() {
            var time = this.model.get('Time');
            var m = moment(time);
            this.$el.html(m.fromNow());
            return this;
        }
    });

    views.ActivityList = views.BaseListView.extend({
        initialize: function(options) {
            this.PlatformKey = options.PlatformKey;
        },
        render: function() {
            var items = this.collection.getByPlatformKey(this.PlatformKey);
            _(items).each(function(item){
                var v = new views.ActivityListItem({model:item});
                this.$el.append(v.render().el);
            }, this);
            return this;
        }
    });

    views.ActivityView = Backbone.View.extend({
        listView: null,
        initialize: function(options) {
            this.collection = new app.collections.StopActivities();
            this.collection.fetch({async:false});

            listView = new views.ActivityList({
                PlatformKey: options.PlatformKey,
                collection: this.collection
            });

            this.collection.bind("reset", this.render, this);
            this.collection.bind("add", this.render, this);
        },
        render: function() {
            this.$el.html(listView.render().el);
            return this;
        }
    });

})(app.views = app.views || {});

(function(routers){

    routers.Router = Backbone.Router.extend({
       routes: {
           '': 'index',
           'platform/:name/:direction': 'direction',
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
            this.showView(new app.views.PlatformListView({model:name}));
        },
        direction: function(name, direction) {
            this.showView(new app.views.ActivityView({PlatformKey:direction}));
        }
    });

})(app.routers = app.routers || {});

$(function() {
    app.router = new app.routers.Router();
    Backbone.history.start();
});