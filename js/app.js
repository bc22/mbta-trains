function slugify(a){a=a.replace(/[^-a-zA-Z0-9,&\s]+/ig,"");a=a.replace(/-/gi,"_");a=a.replace(/\s/gi,"-");return a.toLowerCase()}function throttle(b,a){var c=null;return function(){var e=this,d=arguments;clearTimeout(c);c=setTimeout(function(){b.apply(e,d)},a)}}Backbone.View.prototype.close=function(){this.unbind();this.remove();if(this.onClosing){this.onClosing()}};var app=app||{};app.events=app.events||_.extend({},Backbone.Events);(function(a){a.Line=Backbone.Model.extend({defaults:{Name:null,PlatformUrl:null,ActivityUrl:null}});a.Platform=Backbone.Model.extend({defaults:{StopID:null,Stop:null}});a.StopActivity=Backbone.Model.extend({defaults:{CurrentTime:null,Line:null,TripID:null,Destination:null,StopID:null,Stop:null,SecondsAway:null,PosTimestamp:null,TrainNumber:null,PosLatitude:null,PosLongitude:null,PosHeading:null,Note:null}})})(app.models=app.models||{});(function(a){a.Lines=Backbone.Collection.extend({model:app.models.Line});a.StopActivities=Backbone.Collection.extend({model:app.models.StopActivity,lineName:null,sync:function(d,c,b){b.timeout=10000;b.dataType="jsonp";return Backbone.sync(d,c,b)},parse:function(b){return b.query.results.row},setCurrentLine:function(b){this.lineName=b.get("Name");this.url=b.get("ActivityUrl")},comparator:function(b){return Number(b.get("SecondsAway"))}});a.Platforms=Backbone.Collection.extend({model:app.models.Platform,lineName:null,setCurrentLine:function(b){this.lineName=b.get("Name");this.url=b.get("PlatformUrl")}})})(app.collections=app.collections||{});(function(a){a.BaseListView=Backbone.View.extend({tagName:"ul",className:"list inset"});a.LineListItem=Backbone.View.extend({tagName:"li",events:{click:function(){app.router.navigate("/"+this.model.get("Name").toLowerCase(),true);return false}},render:function(){this.$el.html(this.model.get("Name"));return this}});a.LineList=a.BaseListView.extend({render:function(){var b=$('<li class="list-divider">Trains</li>');this.$el.append(b);_(this.collection.models).each(function(c){this.$el.append(new a.LineListItem({model:c}).render().el)},this);return this}});a.LineListView=Backbone.View.extend({listView:null,initialize:function(){app.events.trigger("header:right:hide");app.events.trigger("header:left:hide");app.events.trigger("header:title:reset");this.listView=new a.LineList({collection:app.data.LineData})},render:function(){this.$el.html(this.listView.render().el);return this}});a.CurrentStopListItem=Backbone.View.extend({tagName:"li",events:{click:function(){var b=app.data.getCurrentLineName();var c=b+"/"+slugify(this.model.get("Stop"));app.router.navigate(c,true);return false}},render:function(){this.$el.html(this.model.get("Stop"));return this}});a.CurrentStopList=a.BaseListView.extend({render:function(){_(this.collection.models).each(function(c){var b=new app.views.CurrentStopListItem({model:c});this.$el.append(b.render().el)},this);return this}});a.CurrentStopView=Backbone.View.extend({listView:null,initialize:function(){this.listView=new app.views.CurrentStopList({collection:app.data.PlatformData})},render:function(){var b=app.data.CurrentLine.get("Name");app.events.trigger("header:title:set",b);app.events.trigger("header:right:hide");app.events.trigger("header:lines:show");this.$el.html(this.listView.render().el);return this},onClosing:function(){if(this.listView){this.listView.close()}}});a.PlatformListView=Backbone.View.extend({views:[],cleanUpViews:function(){var b;while((b=this.views.pop())){b.close()}},initialize:function(c){this.id=c.id;app.events.trigger("header:right:show");app.events.trigger("header:stops:show");var b=app.data.PlatformData.find(function(d){var e=slugify(d.get("Stop"));return e===this.id},this);if(b){app.events.trigger("header:title:set",b.get("Stop"))}app.data.ActivityData.on("change",this.render,this);app.data.ActivityData.on("reset",this.render,this)},render:function(){this.cleanUpViews();var d=app.data.ActivityData;var c=_(d.models).filter(function(e){var f=slugify(e.get("Stop"));return f===this.id&&e.get("Destination")!==e.get("Stop")},this);var b=_(c).groupBy(function(e){return e.get("Destination")});_(b).each(function(g,f){var e=new app.views.ActivityList({model:f,activities:g});this.views.push(e)},this);this.$el.html("");_(this.views).each(function(e){this.$el.append(e.render().el)},this);return this}});a.ActivityListItem=Backbone.View.extend({tagName:"li",_template:null,initialize:function(){_template=$("#tpl-activity-item").html()},render:function(){var b=moment();b.add("seconds",this.model.get("SecondsAway"));this.$el.html(_.template(_template,{seconds:b.fromNow(),time:b.format("LLLL")}));return this}});a.ActivityList=a.BaseListView.extend({initialize:function(b){this.activities=b.activities},render:function(){this.$el.html("");var b=$('<li class="list-divider">'+this.model+"</li>");this.$el.append(b);_(this.activities).each(function(d){var c=new app.views.ActivityListItem({model:d});this.$el.append(c.render().el)},this);return this}});a.HeaderView=Backbone.View.extend({leftButton:null,rightButton:null,title:null,initialTitle:"MBTA Train Tracker",leftTarget:null,events:{"click #back-button":function(){_gaq.push(["_trackEvent","Header",$(this).text()]);app.router.navigate(this.leftTarget,true);return false},"click #next-button":function(){_gaq.push(["_trackEvent","Header","Refresh"]);app.data.ActivityData.reset();app.data.ActivityData.fetch();return false}},initialize:function(){this.leftButton=$("#back-button");this.rightButton=$("#next-button");this.title=$("#title");app.events.on("header:stops:show",function(){this.leftTarget=app.data.getCurrentLineName();this.leftButton.text("Stops");this.leftButton.show()},this);app.events.on("header:lines:show",function(){this.leftTarget="";this.leftButton.text("Lines");this.leftButton.show()},this);app.events.on("header:left:hide",function(){this.leftButton.hide()},this);app.events.on("header:right:show",function(){this.rightButton.show()},this);app.events.on("header:right:hide",function(){this.rightButton.hide()},this);app.events.on("header:title:set",function(b){this.title.text(b)},this);app.events.on("header:title:reset",function(){this.title.text(this.initialTitle)},this)}})})(app.views=app.views||{});(function(a){a.Router=Backbone.Router.extend({routes:{"":"index",":line":"line",":line/:id":"station"},showView:function(b){_gaq.push(["_trackPageview"]);if(this.currentView){this.currentView.close()}this.currentView=b;$("#content").html(this.currentView.render().el);return b},index:function(){_gaq.push(["_trackEvent","Homepage","Index"]);this.showView(new app.views.LineListView())},line:function(c){_gaq.push(["_trackEvent",c,"Index"]);var b=app.data.getLineFromName(c);if(!b){app.router.navigate("",true)}else{app.data.CurrentLine=b;loadData(function(){var d=new app.views.CurrentStopView();this.showView(d)},this)}},station:function(c,d){_gaq.push(["_trackEvent",c,d]);var b=app.data.getLineFromName(c);if(!b){app.router.navigate("",true)}else{app.data.CurrentLine=b;loadData(function(){var e=new app.views.PlatformListView({id:d});this.showView(e)},this)}}})})(app.routers=app.routers||{});function loadData(f,d){if(!d){d=this}app.data=app.data||{};app.data.CurrentLine=app.data.CurrentLine||null;app.data.getLineFromName=function(g){return _(app.data.LineData.models).find(function(h){return h.get("Name").toLowerCase()===g.toLowerCase()})};app.data.getCurrentLineName=function(){return app.data.CurrentLine.get("Name").toLowerCase()};if(!app.data.LineData){var c=function(g){return"http://query.yahooapis.com/v1/public/yql?q=select%20Destination%2CSecondsAway%2CStop%20from%20csv%20where%20url%3D%22http%3A%2F%2Fdeveloper.mbta.com%2Flib%2Frthr%2F"+g+".csv%22%20and%20columns%20%3D%20%22CurrentTime%2CLine%2CTripID%2CDestination%2CStopID%2CStop%2CSecondsAway%2CPosTimestamp%2CTrainNumber%2CPosLatitude%2CPosLongitude%2CPosHeading%2CNote%22%20and%20Line%20!%3D%20%22Line%22&format=json"};app.data.LineData=new app.collections.Lines([new app.models.Line({Name:"Red",PlatformUrl:"data/Red.json",ActivityUrl:c("red")}),new app.models.Line({Name:"Orange",PlatformUrl:"data/Orange.json",ActivityUrl:c("orange")}),new app.models.Line({Name:"Blue",PlatformUrl:"data/Blue.json",ActivityUrl:c("blue")})])}if(app.data.CurrentLine){var b=0;var a=function(){if(++b===2){f.call(d)}};var e=app.data.CurrentLine.get("Name");app.data.ActivityData=app.data.ActivityData||new app.collections.StopActivities();if(e!==app.data.ActivityData.lineName){app.data.ActivityData.setCurrentLine(app.data.CurrentLine);app.data.ActivityData.reset();app.data.ActivityData.fetch({success:a})}else{a()}app.data.PlatformData=app.data.PlatformData||new app.collections.Platforms();if(e!==app.data.PlatformData.lineName){app.data.PlatformData.setCurrentLine(app.data.CurrentLine);app.data.PlatformData.reset();app.data.PlatformData.fetch({success:a})}else{a()}}else{f.call(d)}}$(function(){loadData(function(){app.header=new app.views.HeaderView({el:"#header"});app.router=new app.routers.Router();Backbone.history.start()})});