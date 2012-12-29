var app = app || {};

(function(models){

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
        model: app.models.Stop,
        url: 'data/Red.json'
    });

})(app.collections = app.collections || {});

$(function() {
    var c = new app.collections.StopActivities();
    c.fetch({
        success: function() {
            
        }
    });
});