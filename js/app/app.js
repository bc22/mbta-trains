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

    models.Line = Backbone.Model.extend({
        defaults: {
            Name: null,
            PlatformUrl: null,
            ActivityUrl: null
        }
    });

    models.Platform = Backbone.Model.extend({
        defaults: {
            Stop: null,
            Targets: []
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

    models.Favorite = Backbone.Model.extend({
        defaults: {
            Line: null,
            Station: null,
            Target: null
        }
    });

})(app.models = app.models || {});

(function(collections){

    collections.Lines = Backbone.Collection.extend({
        model: app.models.Line
    });

    collections.StopActivities = Backbone.Collection.extend({
        model: app.models.StopActivity,
        lineName: null,
        sync: function(method, model, options){
            options.timeout = 10000;
            options.dataType = 'jsonp';
            return Backbone.sync(method, model, options);
        },
        parse: function(response) {
            return response.query.results.row;
        },
        setCurrentLine: function(line) {
            this.lineName = line.get('Name');
            this.url = line.get('ActivityUrl');
        },
        comparator: function(item) {
            return Number(item.get('SecondsAway'))
        }
    });

    collections.Platforms = Backbone.Collection.extend({
        model: app.models.Platform,
        lineName: null,
        setCurrentLine: function(line) {
            this.lineName = line.get('Name');
            this.url = line.get('PlatformUrl');
        },
        getPlatformBySlug: function(slug) {
            return this.find(function(model){
                var id = slugify(model.get('Stop'));
                return id === slug;
            }, this);
        }
    });

    collections.Favorites = Backbone.Collection.extend({
        model: app.models.Favorite,
        localStorage: new Backbone.LocalStorage("favorites"),
        isFavorited: function(line, station, target) {
            var found = _(this.models).find(function(model) {
                return model.get('Line').toLowerCase() === line.toLowerCase() &&
                    model.get('Station').toLowerCase() === station.toLowerCase() &&
                    model.get('Target').toLowerCase() === target.toLowerCase();
            });
            return found;
        }
    });

})(app.collections = app.collections || {});

(function(views){

    views.BaseListView = Backbone.View.extend({
        tagName: 'ul',
        className: 'list inset'
    });

    views.LineListItem = Backbone.View.extend({
        tagName: 'li',
        events: {
            'click': function() {
                app.router.navigate('/' + this.model.get('Name').toLowerCase(), true);
                return false;
            }
        },
        render: function(){
            this.$el.html(this.model.get('Name'));
            return this;
        }
    });

    views.LineList = views.BaseListView.extend({
        render: function() {
            var divider = $('<li class="list-divider">Trains</li>');
            this.$el.append(divider);

            _(this.collection.models).each(function(line){
                this.$el.append(new views.LineListItem({model:line}).render().el);
            }, this);
            return this;
        }
    });

    views.LineListView = Backbone.View.extend({
        listView: null,
        favoriteView: null,
        initialize: function() {
            app.events.trigger('header:right:hide');
            app.events.trigger('header:left:hide');

            app.events.trigger('header:title:reset');

            this.listView = new views.LineList({
                collection: app.data.LineData
            });

            this.favoriteView = new views.FavoriteList({
                collection: app.data.Favorites
            })
        },
        render: function() {
            this.$el.append(this.favoriteView.render().el);
            this.$el.append(this.listView.render().el);
            return this;
        }
    });

    views.CurrentStopListItem = Backbone.View.extend({
        tagName: 'li',
        events: {
            'click': function() {
                var line = app.data.getCurrentLineName();
                var url = line + '/' + slugify(this.model.get('Stop'));
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
            var name = app.data.CurrentLine.get('Name');
            app.events.trigger('header:title:set', name);

            app.events.trigger('header:right:hide');
            app.events.trigger('header:lines:show');

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
            this.id = options.id;

            app.events.trigger('header:right:show');
            app.events.trigger('header:stops:show');

            var platform = app.data.PlatformData.getPlatformBySlug(this.id);

            if (platform) {
                app.events.trigger('header:title:set', platform.get('Stop'));
            }

            app.data.ActivityData.on('change', this.render, this);
            app.data.ActivityData.on('reset', this.render, this);
        },
        render: function() {
            this.cleanUpViews();

            var activities = app.data.ActivityData;

            // get all of the activities belonging to this station
            var data = _(activities.models).filter(function(activity){
                var id = slugify(activity.get('Stop'));
                return id === this.id && activity.get('Destination') !== activity.get('Stop');
            }, this);

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

            this.$el.html('');

            _(this.views).each(function(view){
                this.$el.append(view.render().el);
            }, this);

            return this;
        }
    });

    views.ActivityListItem = Backbone.View.extend({
        tagName: 'li',
        _template: null,
        initialize: function() {
            this._template = '<%=seconds%><br/><span style="color: gray;"><%=time%></span>'
        },
        render: function() {
            var m = moment();
            m.add('seconds', this.model.get('SecondsAway'));
            this.$el.html(_.template(this._template, {
                seconds:m.fromNow(),
                time:m.format('LLLL')
            }));
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

    views.HeaderView = Backbone.View.extend({
        leftButton: null,
        rightButton: null,
        title: null,
        initialTitle: 'MBTA Train Tracker',
        leftTarget: null,
        events: {
            'click #back-button': function() {
                _gaq.push(['_trackEvent', 'Header', $(this).text()]);

                app.router.navigate(this.leftTarget, true);
                return false;
            },
            'click #next-button': function() {
                _gaq.push(['_trackEvent', 'Header', 'Refresh']);

                app.data.ActivityData.reset();
                app.data.ActivityData.fetch();
                return false;
            }
        },
        initialize: function() {
            this.leftButton = $('#back-button');
            this.rightButton = $('#next-button');
            this.title = $('#title');

            app.events.on('header:stops:show', function() {
                this.leftTarget = app.data.getCurrentLineName();

                this.leftButton.text('Stops');
                this.leftButton.show();
            }, this);

            app.events.on('header:lines:show', function() {
                this.leftTarget = '';

                this.leftButton.text('Lines');
                this.leftButton.show();
            }, this);

            app.events.on('header:left:hide', function() {
                this.leftButton.hide();
            }, this);

            app.events.on('header:right:show', function() {
                this.rightButton.show();
            }, this);

            app.events.on('header:right:hide', function() {
                this.rightButton.hide();
            }, this);

            app.events.on('header:title:set', function(title) {
                this.title.text(title);
            }, this);

            app.events.on('header:title:reset', function() {
                this.title.text(this.initialTitle);
            }, this);
        }
    });

    views.FavoriteListItem = Backbone.View.extend({
        tagName: 'li',
        render: function() {
            this.$el.html(this.model.get('Station'));
            return this;
        }
    });

    views.FavoriteList = views.BaseListView.extend({
        render: function() {
            this.$el.html('');
            if (this.collection.models.length){
                var divider = $('<li class="list-divider">Favorites</li>');
                this.$el.append(divider);

                _(this.collection.models).each(function(favorite) {
                    var v = new app.views.FavoriteListItem({model:favorite});
                    this.$el.append(v.render().el);
                }, this);
            } else {
                this.$el.hide();
            }
            return this;
        }
    });

    views.TargetListItem = Backbone.View.extend({
        tagName:'li',
        station: null,
        events: {
            'click a': 'toggleFavorite'
        },
        initialize: function(options){
            this.station = options.station;
        },
        render: function() {
            var l = app.data.CurrentLine.get('Name');
            var s = this.station.get('Stop');
            var f = app.data.Favorites.isFavorited(l, s, this.model);

            if (f) {
                this.$el.html(this.model + '<a class="button-negaive">Unfavorite</a>');
            } else {
                this.$el.html(this.model + '<a class="button-positive">Favorite</a>');
            }

            return this;
        },
        toggleFavorite: function() {
            
        }
    });

    views.TargetList = views.BaseListView.extend({
        render: function() {
            var targets = this.model.get('Targets');
            _(targets).each(function(target) {
                var v = new app.views.TargetListItem({station:this.model, model:target});
                this.$el.append(v.render().el);
            }, this);
            return this;
        }
    });

    views.TargetListView = Backbone.View.extend({
        targetList: null,
        initialize: function() {
            this.targetList = new views.TargetList({
                model: this.model
            });
        },
        render: function() {
            this.$el.html(this.targetList.render().el);
            return this;
        },
        onClosing: function() {
            if (this.targetList) {
                this.targetList.close();
            }
        }
    });

})(app.views = app.views || {});

(function(routers){

    routers.Router = Backbone.Router.extend({
       routes: {
           '': 'index',
           ':line': 'line',
           ':line/:id': 'station',
           ':line/:id/favorite': 'favorite'
       },
       showView: function(view, callback) {
           _gaq.push(['_trackPageview']);

            if (this.currentView){
                this.currentView.close();
            }

            this.currentView = view;
            $('#content').html(this.currentView.render().el);

           if (callback) {
               callback();
           }

           return view;
        },
        index: function() {
            _gaq.push(['_trackEvent', 'Homepage', 'Index']);
            
            this.showView(new app.views.LineListView());
        },
        line: function(line) {
            _gaq.push(['_trackEvent', line, 'Index']);

            var resolved = app.data.getLineFromName(line);

            if (!resolved) {
                app.router.navigate('', true);
            } else {
                app.data.CurrentLine = resolved;
                loadData(function() {
                    var v = new app.views.CurrentStopView();
                    this.showView(v);
                }, this);
            }
        },
        station: function(line, id) {
            _gaq.push(['_trackEvent', line, id]);

            var resolved = app.data.getLineFromName(line);

            if (!resolved) {
                app.router.navigate('', true);
            } else {
                app.data.CurrentLine = resolved;
                loadData(function() {
                    var v = new app.views.PlatformListView({
                        id: id
                    });
                    this.showView(v);
                }, this);
            }
        },
        favorite: function(line, id) {
            _gaq.push(['_trackEvent', line, id]);

            var resolved = app.data.getLineFromName(line);

            if (!resolved) {
                app.router.navigate('', true);
            } else {
                app.data.CurrentLine = resolved;
                loadData(function() {
                    var platform = app.data.PlatformData.getPlatformBySlug(id);

                    var v = new app.views.TargetListView({
                        model: platform
                    });

                    this.showView(v);
                }, this);
            }
        }
    });

})(app.routers = app.routers || {});

function loadData(callback, context) {
    if (!context) {
        context = this;
    }

    app.data = app.data || {};
    app.data.CurrentLine = app.data.CurrentLine || null;

    app.data.getLineFromName = function(name) {
        return _(app.data.LineData.models).find(function(line){
            return line.get('Name').toLowerCase() === name.toLowerCase();
        });
    };

    app.data.getCurrentLineName = function() {
        return app.data.CurrentLine.get('Name').toLowerCase();
    };

    if (!app.data.LineData) {
        var getActivityUrl = function(csvFileName) {
            return 'http://query.yahooapis.com/v1/public/yql?q=select%20Destination%2CSecondsAway%2CStop%20from%20csv%20where%20url%3D%22http%3A%2F%2Fdeveloper.mbta.com%2Flib%2Frthr%2F'+ csvFileName + '.csv%22%20and%20columns%20%3D%20%22CurrentTime%2CLine%2CTripID%2CDestination%2CStopID%2CStop%2CSecondsAway%2CPosTimestamp%2CTrainNumber%2CPosLatitude%2CPosLongitude%2CPosHeading%2CNote%22%20and%20Line%20!%3D%20%22Line%22&format=json'
        };

        app.data.LineData = new app.collections.Lines([
            new app.models.Line({
                Name: 'Red',
                PlatformUrl: 'data/Red.json',
                ActivityUrl: getActivityUrl('red')
            }),
            new app.models.Line({
                Name: 'Orange',
                PlatformUrl: 'data/Orange.json',
                ActivityUrl: getActivityUrl('orange')
            }),
            new app.models.Line({
                Name: 'Blue',
                PlatformUrl: 'data/Blue.json',
                ActivityUrl: getActivityUrl('blue')
            })
        ]);
    }

    var counter = 0;
    var handleSuccess = function() {
        if (++counter === 2) {
            callback.call(context);
        }
    };

    if (!app.data.Favorites) {
        app.data.Favorites = new app.collections.Favorites();
        app.data.Favorites.fetch();
    }

    if (app.data.CurrentLine) {
        var lineName = app.data.CurrentLine.get('Name');

        app.data.ActivityData = app.data.ActivityData || new app.collections.StopActivities();

        if (lineName !== app.data.ActivityData.lineName) {
            app.data.ActivityData.setCurrentLine(app.data.CurrentLine);
            app.data.ActivityData.reset();
            app.data.ActivityData.fetch({success: handleSuccess});
        } else {
            handleSuccess();
        }

        app.data.PlatformData = app.data.PlatformData || new app.collections.Platforms();
        if (lineName !== app.data.PlatformData.lineName) {
            app.data.PlatformData.setCurrentLine(app.data.CurrentLine);
            app.data.PlatformData.reset();
            app.data.PlatformData.fetch({success: handleSuccess});
        } else {
            handleSuccess();
        }

    } else {
        callback.call(context);
    }
}

$(function() {
    loadData(function() {
        app.header = new app.views.HeaderView({
            el: '#header'
        });

        app.router = new app.routers.Router();
        Backbone.history.start();
    });
});