function slugify(text) {
    text = text.replace(/[^-a-zA-Z0-9,&\s]+/ig, '');
    text = text.replace(/-/gi, "_");
    text = text.replace(/\s/gi, "-");
    return text.toLowerCase();
}

function throttle(fn, delay) {
    var timer = null;
    return function () {
        var context = this, args = arguments;
        clearTimeout(timer);
        timer = setTimeout(function () {
            fn.apply(context, args);
        }, delay);
    };
}

function buildYqlQuery(models) {
    var fragments = [];

    var t = _.template('(Stop = "<%=Station%>" and Destination = "<%=Target%>")');
    _(models).each(function(model){
        fragments.push(t(model));
    }, this);

    var joined = "(" + fragments.join(" OR ") + ")";

    return encodeURIComponent(joined);
}