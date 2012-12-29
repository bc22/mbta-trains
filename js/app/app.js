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
        url: 'data/Red.json'
    });

    collections.Platforms = Backbone.Collection.extend({
        model: app.models.Platform,
        url: 'data/Platforms.json'
    });

})(app.collections = app.collections || {});

$(function() {
    var c = new app.collections.Platforms();
    c.fetch({
        success: function() {
            alert(c.models.length);
        }
    });
});