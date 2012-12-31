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
            "StopID": null,
            "Stop": null
        }
    });

    models.StopActivity = Backbone.Model.extend({
        defaults: {
            CurrentTime: null,
            Line: null,
            TripID: null,
            Destination: null,
            StopID: null,
            Stop: null,
            SecondsAway: null,
            PosTimestamp: null,
            TrainNumber: null,
            PosLatitude: null,
            PosLongitude: null,
            PosHeading: null,
            Note: null
        }
    });

})(app.models = app.models || {});

(function(collections){

    collections.StopActivities = Backbone.Collection.extend({
        model: app.models.StopActivity,
        url: 'http://query.yahooapis.com/v1/public/yql?q=select%20*%20from%20csv%20where%20url%3D%22' +
            'http%3A%2F%2Fdeveloper.mbta.com%2Flib%2Frthr%2Fred.csv%22%20and%20columns%20%3D%20%22CurrentTime%2C'  +
            'Line%2CTripID%2CDestination%2CStopID%2CStop%2CSecondsAway%2CPosTimestamp%2CTrainNumber%2CPosLatitude%' +
            '2CPosLongitude%2CPosHeading%2CNote%22%20and%20Line%20!%3D%20%22Line%22&format=json',
        sync: function(method, model, options){
            options.timeout = 10000;
            options.dataType = 'jsonp';
            return Backbone.sync(method, model, options);
        },
        parse: function(response) {
            return response.query.results.row;
        },
        comparator: function(item) {
            return Number(item.get('SecondsAway'))
        }
    });

    collections.Platforms = Backbone.Collection.extend({
        model: app.models.Platform,
        url: 'data/Platforms.json'
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
                var url = 'platform/' + slugify(this.model.get('Stop'));
                app.router.navigate(url, true);
                return false;
            }
        },
        render: function() {
            this.$el.html(this.model.get('Stop'));
            return this;
        }
    });

    views.CurrentStopList = views.BaseListView.extend({
        render: function() {
            _(this.collection.models).each(function(station){
                var v = new app.views.CurrentStopListItem({model:station});
                this.$el.append(v.render().el);
            }, this);

            return this;
        }
    });

    views.CurrentStopView = Backbone.View.extend({
        listView: null,
        initialize: function() {
            this.listView = new app.views.CurrentStopList({
                collection: app.data.PlatformData
            });
        },
        render: function() {
            this.$el.html(this.listView.render().el);
            return this;
        },
        onClosing: function() {
            if (this.listView) {
                this.listView.close();
            }
        }
    });

    views.PlatformListView = Backbone.View.extend({
        views: [],
        cleanUpViews: function() {
            var v;
            while ((v = this.views.pop())) {
                v.close();
            }
        },
        initialize: function(options) {
            this.cleanUpViews();

            var activities = app.data.ActivityData;

            // get all of the activities belonging to this station
            var data = _(activities.models).filter(function(activity){
                var id = slugify(activity.get('Stop'));
                return id === options.id && activity.get('Destination') !== activity.get('Stop');
            });

            // group them by destination
            var grouped = _(data).groupBy(function(item) {
                return item.get('Destination');
            });

            _(grouped).each(function(group, key){
                var v = new app.views.ActivityList({
                    model: key,
                    activities: group
                });

                this.views.push(v);
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
            var m = moment();
            m.add('seconds', this.model.get('SecondsAway'));
            this.$el.html(m.fromNow());
            return this;
        }
    });

    views.ActivityList = views.BaseListView.extend({
        initialize: function(options){
            this.activities = options.activities;
        },
        render: function() {
            this.$el.html('');

            var divider = $('<li class="list-divider">' + this.model + '</li>');
            this.$el.append(divider);

            _(this.activities).each(function(item){
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
           'platform/:id': 'station'
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
        station: function(id) {
            var v = new app.views.PlatformListView({
                id: id
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