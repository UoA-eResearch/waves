var map = L.map('map', {
    center: [-41.235726,172.5118422],
    zoom: 6,
    minZoom: 5,
    maxZoom: 13,
    zoomControl: false
});
L.control.zoom({position: 'topright'}).addTo(map);
map.doubleClickZoom.disable();

var bounds = map.getBounds();
var degreeLimit = 10;
bounds._northEast.lat += degreeLimit * 3;
bounds._northEast.lng += degreeLimit;
bounds._southWest.lat -= degreeLimit;
bounds._southWest.lng -= degreeLimit;
map.setMaxBounds(bounds);

var colors = {
    "1": [127, 0, 0],
    "0.8": [255, 0, 0],
    "0.6": [255, 127, 0],
    "0.4": [255, 255, 0],
    "0.2": [255, 255, 127],
    "0": [255, 255, 255],
    "-0.2": [127, 255, 255],
    "-0.4": [0, 255, 255],
    "-0.6": [0, 127, 255],
    "-0.8": [0, 0, 255],
    "-1": [0, 0, 127]
}
var colorKey = Object.keys(colors).map(parseFloat).sort(function (a, b) {  return a - b;  });

var baseMaps = {
    "CartoDB Positron": L.tileLayer.provider('CartoDB.PositronNoLabels'),
    "CartoDB Dark Matter": L.tileLayer.provider("CartoDB.DarkMatterNoLabels"),
    "ESRI WorldImagery": L.tileLayer.provider("Esri.WorldImagery"),
};

baseMaps["CartoDB Positron"].addTo(map);

var drawnItems = new L.FeatureGroup();
map.addLayer(drawnItems);
shapeOptions = {
    fillOpacity: .2,
    fillColor: "black",
    color: "black",
    opacity: 1
}
var subset;
var drawControl = new L.Control.Draw({
    edit: {
        featureGroup: drawnItems,
        poly: {
            allowIntersection: false
        },
        remove: false
    },
    draw: {
        polygon: {
            allowIntersection: false,
            shapeOptions: shapeOptions
        },
        rectangle: {
            showArea: true,
            metric: ["km"],
            shapeOptions: shapeOptions
        },
        marker: false,
        circlemarker: false,
        polyline: false,
        circle: false,
    }
});
L.drawLocal.draw.toolbar.buttons.polygon = 'Select points in a polygon';
L.drawLocal.draw.toolbar.buttons.rectangle = 'Select points in a rectangle';
L.drawLocal.edit.toolbar.buttons = {
    edit: 'Edit selection',
    editDisabled: 'No selection to edit',
    remove: 'Delete selection',
    removeDisabled: 'No selection to delete'
}

map.addControl(drawControl);

$("#download_info #control").append($(".leaflet-draw"));

var markers = L.layerGroup().addTo(map);

function updateSelection() {
    if (!subset) return;
    var count = 0;
    if (subset.layerType == "circle") {
        var center = subset.getLatLng();
        var radius = subset.getRadius();
        markers.eachLayer(function(marker) {
            var markerll = marker.getLatLng();
            var dist = markerll.distanceTo(center);
            if (dist <= radius) {
                count++;
            }
        });
    } else {
        markers.eachLayer(function(marker) {
            if (subset.contains(marker.getLatLng())) {
                count++;
            }
        });
    }
    console.log(count + " points in ", subset);
    $("#selected_points").text(count);
    updateTotalRows();
}

function drawHandler(e) {
    console.log(e);
    var layer;
    if (e.layers) {
        e.layers.eachLayer(function (l) {
            layer = l;
            return false;
        });
    } else if (e.layer) {
        layer = e.layer;
    }
    console.log(layer);
    layer.options.interactive = false;
    if (subset) {
        drawnItems.removeLayer(subset);
    }
    drawnItems.addLayer(layer);
    subset = layer;
    updateSelection();
}

map.on(L.Draw.Event.CREATED, drawHandler);
map.on(L.Draw.Event.EDITSTART, function() {
    console.log("editstart");
    var drawBounds = drawnItems.getBounds();
    if (!map.getBounds().contains(drawBounds)) {
        map.flyToBounds(drawBounds);
    }
});
map.on(L.Draw.Event.EDITED, drawHandler);
map.on(L.Draw.Event.DELETESTOP, function() {
    subset = null;
    $("#selected_points").text(0);
    console.log("draw deleted");
})


map.createPane('labels');
map.getPane('labels').style.zIndex = 625;
map.getPane('labels').style.pointerEvents = 'none';
var labels = L.tileLayer.provider("Stamen.TonerLabels", {
    pane: "labels",
    interactive: false,
    opacity: .8,
});
labels.addTo(map);

map.createPane('whitelabels');
map.getPane('whitelabels').style.zIndex = 625;
map.getPane('whitelabels').style.pointerEvents = 'none';
map.getPane('whitelabels').style.filter = 'invert(100%)';
var whitelabels = L.tileLayer.provider("Stamen.TonerLabels", {
    pane: "whitelabels",
    interactive: false,
    opacity: .8,
});

var overlays = {
    "Selections": drawnItems,
    "Data points": markers,
    "City labels": labels,
    "City labels (white)": whitelabels,
}

L.control.layers(baseMaps, overlays, { position: 'topright' }).addTo(map);

var legend = L.control({position: 'bottomright'});
legend.onAdd = function(map) {
    var div = L.DomUtil.create('div', 'info legend');
    var colors = [];
    for (var i = 1; i >= -1; i -= .2) {
        colors.push(getColor(i));
    }
    var colorbar = '<h3>Legend</h3><div id="colorbar"><div id="gradient" style="background-image: linear-gradient(' + colors.join(",") + ');"></div>';
    colorbar += '<div id="max" class="label">1m</div><div id="mid" class="label">0m</div><div id="min" class="label">-1m</div>';
    colorbar += '</div>';
    div.innerHTML = colorbar;
    div.firstChild.onmousedown = div.firstChild.ondblclick = L.DomEvent.stopPropagation;
    return div;
}
legend.addTo(map);

function getColor(value){
    if (value <= colorKey[0]) {
        var color = colors[colorKey[0]];
        return "rgb(" + color.join(",") + ")";
    } else if (value >= colorKey[colorKey.length - 1]) {
        var color = colors[colorKey[colorKey.length - 1]];
        return "rgb(" + color.join(",") + ")";
    }
    for (var i = 0; i < colorKey.length - 1; i++) {
        var low = colorKey[i];
        var high = colorKey[i + 1];
        if (value >= low && value <= high) {
            var lowC = colors[low];
            var highC = colors[high];
            var factor = (value - low) / (high - low);
            var r = Math.round(lowC[0] + (highC[0] - lowC[0]) * factor);
            var g = Math.round(lowC[1] + (highC[1] - lowC[1]) * factor);
            var b = Math.round(lowC[2] + (highC[2] - lowC[2]) * factor);
            return "rgb(" + r + "," + g + "," + b + ")";
        }
    }
}

function unpack(rows, key) {
    return rows.map(function(row) { return row[key]; });
}

var chartProgressInterval;

function plotData(container, results) {
    var data = [{
        type: "scatter",
        mode: "lines",
        name: 'Storm Surge Height',
        x: unpack(results, 'datetime'),
        y: unpack(results, 'height'),
        line: {color: '#17BECF'}
    }];
    var layout = {
        title: 'Storm surge height over time',
        xaxis: {
            title: "Date/Time"
        },
        yaxis: {
            title: "Storm Surge Height (m)"
        },
    };
    Plotly.newPlot(container[0], data, layout);
}

function popupHandler(popup) {
    console.log(popup);
    var dt = dataset.get(2);
    var bounds = Terraformer.WKT.convert(popup.target.toGeoJSON().geometry);
    var payload = {
        minDate: dt.start.formatYYYYMMDD() + " 12:00",
        maxDate: dt.end.formatYYYYMMDD() + " 12:00",
        model: window.model,
        bounds: bounds
    }
    var container = $("#graph", popup.popup._contentNode);

    try {
        var ws = new WebSocket(wsUrl);
        ws.onopen = function() {
            ws.send(JSON.stringify(payload));
        };
        ws.onmessage = function (evt) {
            var data = JSON.parse(evt.data);
            console.log(data);
            if ('progress' in data) {
                var pct = Math.round(data.progress * 100);
                $("#chartprogress", popup.popup._contentNode).text(pct + "%");
                $("#chartprogress", popup.popup._contentNode).css("width", pct + "%");
                $("#chartprogress", popup.popup._contentNode).attr("aria-valuenow", pct);
            } else {
                container.text("");
                plotData(container, data.results);
                ws.close();
            }
        };
    } catch(err) {
        var start = new Date();
        var days = $('#selected_days').text();
        var est_time_instance = Math.round(days * rows_per_sec);
        clearInterval(chartProgressInterval);
        chartProgressInterval = setInterval(function() {
            var elapsed = (new Date() - start) / 1000;
            var pct = Math.round(elapsed / est_time_instance * 100);
            console.log(elapsed, pct);
            if (pct > 99) {
                pct = 99;
            }
        }, 1000);
        $.getJSON(baseUrl, payload, function(data) {
            console.log(data);
            clearInterval(chartProgressInterval);
            container.text("");
            plotData(container, data.results);
        });
    }
}

var baseUrl = "https://stormsurge.nectar.auckland.ac.nz/storm/";
var wsUrl = "wss://stormsurge.nectar.auckland.ac.nz/storm/websocket";
var markerLookup = [];

function fetchDataForModel(model, minDate, maxDate) {
    if (!maxDate) {
        maxDate = minDate;
    }
    console.log("fetching", baseUrl, model, minDate, maxDate);
    location.hash = model + "@" + minDate;
    $.getJSON(baseUrl, { model: model, minDate: minDate, maxDate: maxDate }, function(data) {
        console.log("Got " + data.results.length + " results for " + model);
        if (data.results.length == 0) return;
        var minHeight = Infinity;
        var maxHeight = -Infinity;
        for (var i in data.results) {
            var e = data.results[i];
            if (e.height < minHeight) minHeight = e.height;
            if (e.height > maxHeight) maxHeight = e.height;
        }
        if (minHeight < -maxHeight) {
            maxHeight = -minHeight;
        }
        if (maxHeight > -minHeight) {
            minHeight = -maxHeight;
        }
        var dp = 4;
        $("#colorbar #max").text(maxHeight.toFixed(dp) + "m");
        $("#colorbar #min").text(minHeight.toFixed(dp) + "m");
        for (var i in data.results) {
            var e = data.results[i];
            var title = "(" + e.lat + "°," + e.lng + "°)";
            var desc = title + ": " + e.height.toFixed(dp) + "m";
            var progress = '<div class="progress">';
            progress += '<div id="chartprogress" class="progress-bar progress-bar-striped progress-bar-animated" role="progressbar" aria-valuenow="0%" aria-valuemin="0%" aria-valuemax="100%" style="width: 0%">';
            progress += '</div></div><h6>Loading...</h6>'
            var popup = '<h4>' + title + '</h4><div id="graph">' + progress + '</div>';
            var normalised_height = 2 * (e.height - minHeight) / (maxHeight - minHeight) - 1;
            var color = getColor(normalised_height);
            if (markerLookup[i]) {
                markerLookup[i].setStyle({color: color}).setTooltipContent(desc);
            } else {
                var marker = L.circleMarker([e.lat, e.lng], {radius: 4, color: color, fillOpacity: 1})
                    .addTo(markers).bindTooltip(desc).bindPopup(popup, {minWidth: 800, autoPanPadding: [400, 100]}).on("popupopen", popupHandler);
                markerLookup[i] = marker;
            }
        }
        if (subset) {
            updateSelection();
        }
    }).fail(function(e) {
        alert("There was an error fetching data for " + model + ": " + e.status + " " + e.statusText);
        console.error(e);
    });
}

var ONE_DAY_MS = 1000 * 60 * 60 * 24;
var ONE_YEAR_MS = ONE_DAY_MS * 365;

function fetchRangesForModel(model) {
    $.getJSON(baseUrl + "ranges", { model: model }, function(data) {
        var start = new Date(data.minDate);
        var end = new Date(data.maxDate);
        dataset.update({id: 1, content: model, start: start, end: end});
        var ct = timeline.getCustomTime(1);
        if (ct < start || ct > end) {
            timeline.setCustomTime(start, 1);
            timeline.setCustomTimeTitle("Drag this control to display the storm surge data for a specific date. Current time: " + start.formatYYYYMMDD() + " 12:00", 1);
            timeline.setWindow(start.getTime() - ONE_YEAR_MS, end.getTime() + ONE_YEAR_MS);
        }
        var dateRange = dataset.get(2);
        if (dateRange.start < start || dateRange.end > end) {
            dataset.update({id: 2, start: start, end: end});
        }
        markers.clearLayers();
        markerLookup = [];
        var dateString = timeline.getCustomTime(1).formatYYYYMMDD() + " 12:00";
        fetchDataForModel(model, dateString);
    }).fail(function(e) {
        alert("There was an error fetching data ranges for " + model + ": " + e.status + " " + e.statusText);
        console.error(e);
    });
}

$("#model").change(function(e) {
    window.model = this.value;
    markers.clearLayers();
    markerLookup = [];
    fetchRangesForModel(this.value);
});

var interval;

$("#download").click(function() {
    var dt = dataset.get(2);
    var payload = {
        minDate: dt.start.formatYYYYMMDD() + " 12:00",
        maxDate: dt.end.formatYYYYMMDD() + " 12:00",
        model: window.model,
        format: "csv"
    }
    if (subset) {
        wkt = Terraformer.WKT.convert(subset.toGeoJSON().geometry);
        console.log(wkt);
        payload.bounds = wkt;
    }
    gtag('event', 'request', {
        'event_category': 'export',
        'event_label': JSON.stringify(payload)
    });
    $("#statustext").text("Preparing export...");
    $("#download").attr("disabled", "disabled");
    $("#download").attr("class", "btn btn-secondary");
    $("#cancel_download").show();
    $("#downloadprogress").text("0%");
    $("#downloadprogress").css("width", "0%");
    $("#downloadprogress").attr("aria-valuenow", 0);
    $("#downloadprogresswrapper").show();
    try {
        window.ws = new WebSocket(wsUrl);
        window.ws.onopen = function() {
            ws.send(JSON.stringify(payload));
        };
        window.ws.onmessage = function (evt) {
            var data = JSON.parse(evt.data);
            console.log(data);
            if ('progress' in data) {
                var pct = Math.round(data.progress * 100);
                $("#downloadprogress").text(pct + "%");
                $("#downloadprogress").css("width", pct + "%");
                $("#downloadprogress").attr("aria-valuenow", pct);
            } else {
                var url = baseUrl + data.url;
                $("#statustext").html('Your export is ready for download - please click <a href="' + url + '">here</a> to download');
                $("#statustext a").click(function() {
                    gtag('event', 'download', {
                        'event_category': 'export',
                        'event_label': url
                    });
                });
                gtag('event', 'ready', {
                    'event_category': 'export',
                    'event_label': url
                });
                $("#cancel_download").hide();
                $("#downloadprogresswrapper").hide();
                $("#download").removeAttr("disabled");
                $("#download").attr("class", "btn btn-primary");
                ws.close();
            }
        };
    } catch(err) {
        var start = new Date();
        clearInterval(interval);
        var est_time_instance = window.est_time;
        interval = setInterval(function() {
            var elapsed = (new Date() - start) / 1000;
            var pct = Math.round(elapsed / est_time_instance * 100);
            console.log(elapsed, pct);
            if (pct > 99) {
                pct = 99;
            }
            $("#downloadprogress").text(pct + "%");
            $("#downloadprogress").css("width", pct + "%");
            $("#downloadprogress").attr("aria-valuenow", pct);
        }, 1000);
        window.currentXHR = $.getJSON(baseUrl, payload, function(data) {
            var url = baseUrl + data.url;
            $("#statustext").html('Your export is ready for download - please click <a href="' + url + '">here</a> to download');
            $("#statustext a").click(function() {
                gtag('event', 'download', {
                    'event_category': 'export',
                    'event_label': url
                });
            });
            gtag('event', 'ready', {
                'event_category': 'export',
                'event_label': url
            });
        }).fail(function(e) {
            if (e.statusText != "abort" && e.statusText != "error") {
                var error = "There was an error exporting data for " + window.model + ": " + e.status + " " + e.statusText;
                alert(error);
                $("#statustext").html(error);
                gtag('event', 'error', {
                    'event_category': 'export',
                    'event_label': e.statusText
                });
            }
            console.error(e);
        }).always(function(e) {
            $("#cancel_download").hide();
            $("#downloadprogresswrapper").hide();
            $("#download").removeAttr("disabled");
            $("#download").attr("class", "btn btn-primary");
            clearInterval(interval);
        });
    }
});

$("#cancel_download").click(function() {
    $("#cancel_download").hide();
    $("#downloadprogresswrapper").hide();
    $("#download").removeAttr("disabled");
    $("#download").attr("class", "btn btn-primary");
    $("#statustext").html("Export cancelled");
    if (window.ws) {
        window.ws.close();
    } else if (window.currentXHR) {
        window.currentXHR.abort();
        clearInterval(interval);
    }
});

Date.prototype.formatYYYYMMDD = function(){
    var day = ("0" + this.getDate()).slice(-2);
    var month = ("0" + (this.getMonth() + 1)).slice(-2);
    var year = this.getFullYear();
    return year + "-" + month + "-" + day;
}

// DOM element where the Timeline will be attached
var container = document.getElementById('timeline');

var dataset = new vis.DataSet([
    {id: 1, content: 'Data range', start: new Date(1871, 0, 1, 12), end: new Date(2100, 0, 1, 12), editable: false, selectable: false},
    {id: 2, content: 'Timeseries export range', start: new Date(1871, 0, 1, 12), end: new Date(1900, 0, 1, 12), editable: {updateTime: true, remove: false}}
]);

dataset.on('update', function (event, properties) {
    var range = properties.data[0];
    if (range.id != 2) return;
    console.log(range);
    $("#download_info #start").val(range.start.formatYYYYMMDD());
    $("#download_info #end").val(range.end.formatYYYYMMDD());
    $(".vis-drag-left").attr("title", "Export range control: click and drag to define the beginning of the time series you want to export. Currently set to " + range.start.formatYYYYMMDD());
    $(".vis-drag-right").attr("title", "Export range control: click and drag to define the end of the time series you want to export. Currently set to " + range.end.formatYYYYMMDD());
    updateSelectedDays();
});

var rows_per_sec = 0.003255148915457394;

function secondsToStr (s) {
    function numberEnding (number) {
        return (number > 1) ? 's' : '';
    }

    var years = Math.floor(s / 31536000);
    if (years) {
        return years + ' year' + numberEnding(years);
    }
    //TODO: Months! Maybe weeks? 
    var days = Math.floor((s %= 31536000) / 86400);
    if (days) {
        return days + ' day' + numberEnding(days);
    }
    var hours = Math.floor((s %= 86400) / 3600);
    if (hours) {
        return hours + ' hour' + numberEnding(hours);
    }
    var minutes = Math.floor((s %= 3600) / 60);
    if (minutes) {
        return minutes + ' minute' + numberEnding(minutes);
    }
    var seconds = s % 60;
    if (seconds) {
        return seconds + ' second' + numberEnding(seconds);
    }
    return 'less than a second'; //'just now' //or other string you like;
}

function updateTotalRows() {
    var days = $('#selected_days').text();
    var points = $('#selected_points').text();
    var total = days * points;
    if (total == 0) {
        $("#download").attr("disabled", "disabled");
        $("#est_time_wrapper").hide();
    } else {
        $("#download").removeAttr("disabled");
        $("#est_time_wrapper").show();
    }
    var est_time = Math.round(total * rows_per_sec);
    $('#total_rows').text(total);
    window.est_time = est_time;
    $('#est_time').text(secondsToStr(est_time));
}

function updateSelectedDays() {
    var start = dataset.get(2).start;
    var end = dataset.get(2).end;
    var days = Math.round((end - start) / ONE_DAY_MS);
    $('#selected_days').text(days);
    updateTotalRows();
}

$("#start").change(function() {
    var bounds = dataset.get(1);
    var start = new Date(this.value);
    if (start == "Invalid Date") return;
    if (start < bounds.start) return;
    if (start > bounds.end - ONE_DAY_MS) start = new Date(bounds.end - ONE_DAY_MS);
    dataset.update({id: 2, start: start, end: dataset.get(2).end});
    updateSelectedDays();
});

$("#end").change(function() {
    var bounds = dataset.get(1);
    var end = new Date(this.value);
    if (end == "Invalid Date") return;
    if (end > bounds.end) end = bounds.end;
    if (end < bounds.start.getTime() + ONE_DAY_MS) return;
    dataset.update({id: 2, start: dataset.get(2).start, end: end});
    updateSelectedDays();
});

$("#download_info #start").val(dataset.get(2).start.formatYYYYMMDD());
$("#download_info #end").val(dataset.get(2).end.formatYYYYMMDD());
updateSelectedDays();

// Configuration for the Timeline
var options = {
    width: "100%",
    min: "1800-1-1",
    max: "2200-1-1",
    zoomable: true,
    zoomMin: 1000 * 60 * 60 * 24 * 7,
    editable: {
        updateTime: true,
        remove: false,
        overrideItems: false
    },
    snap: function (date, scale, step) {
        date.setHours(12, 0, 0, 0);
        return date;
    },
    onMoving: function (item, callback) {
        console.log(item, callback);
        var bounds = dataset.get(1);
        if (item.start > item.end - ONE_DAY_MS) item.start = new Date(item.end - ONE_DAY_MS);
        if (item.end.getTime() < item.start.getTime() + ONE_DAY_MS) item.end = new Date(item.start.getTime() + ONE_DAY_MS);
        if (item.start < bounds.start) item.start = bounds.start;
        if (item.start > bounds.end - ONE_DAY_MS) item.start = new Date(bounds.end - ONE_DAY_MS);
        if (item.end < bounds.start.getTime() + ONE_DAY_MS) item.end = new Date(bounds.start.getTime() + ONE_DAY_MS);
        if (item.end > bounds.end) item.end = bounds.end;
        dataset.update({id: 2, start: item.start, end: item.end});

        callback(item); // send back the (possibly) changed item
    },
};

// Create a Timeline
var timeline = new vis.Timeline(container, dataset, options);

timeline.setSelection(2);
timeline.on("select", function() {
    // enforce selection on range
    timeline.setSelection(2);
});

timeline.on('timechanged', function(e) {
    e.time.setHours(12, 0, 0, 0);
    timeline.setCustomTime(e.time, 1);
    var dateString = e.time.formatYYYYMMDD() + " 12:00";
    timeline.setCustomTimeTitle("Drag this control to display the storm surge data for a specific date. Current time: " + dateString, 1);
    console.log("timechange", e, dateString);
    fetchDataForModel(window.model, dateString);
});

$(".vis-panel.vis-bottom").bind('wheel', function (event) {
    console.log("scroll on bottom");
    if (event.originalEvent.deltaY < 0) {
        timeline.zoomIn(1);
    } else {
        timeline.zoomOut(1);
    }
});

$(".vis-current-time").prepend('<img id="curDateImg" data-toggle="tooltip" data-placement="top" src="images/pin.svg" title="Current time: ' + new Date() + '"/>');

var range = dataset.get(2);

$(".vis-drag-left").attr("title", "Export range control: click and drag to define the beginning of the time series you want to export. Currently set to " + range.start.formatYYYYMMDD());
$(".vis-drag-right").attr("title", "Export range control: click and drag to define the end of the time series you want to export. Currently set to " + range.end.formatYYYYMMDD());

$('[data-toggle="tooltip"]').tooltip()

var playing = false;
var playInterval;

$("#play").click(function() {
    console.log("play");
    playing = !playing;
    if (playing) {
        $("#play i").attr("class", "fas fa-pause");
        playInterval = setInterval(function() {
            var bounds = dataset.get(1);
            var ct = timeline.getCustomTime(1);
            var newTime = new Date(ct.getTime() + ONE_DAY_MS);
            if (newTime < bounds.start || newTime > bounds.end) {
                newTime = bounds.start;
            }
            timeline.setCustomTime(newTime, 1);
            var dateString = newTime.formatYYYYMMDD() + " 12:00";
            timeline.setCustomTimeTitle("Drag this control to display the storm surge data for a specific date. Current time: " + dateString, 1);
            fetchDataForModel(window.model, dateString);
        }, 1000);
    } else {
        $("#play i").attr("class", "fas fa-play");
        clearInterval(playInterval);
    }
});

var model = "Model_20CR";
if (location.hash.length > 1) {
    var bits = decodeURIComponent(location.hash.slice(1)).split("@");
    model = bits[0];
    timeline.addCustomTime(bits[1], 1);
} else {
    timeline.addCustomTime("1871-1-1 12:00", 1);
}
$("#model").val(model).change();
var dateString = timeline.getCustomTime(1);
timeline.setCustomTimeTitle("Drag this control to display the storm surge data for a specific date. Current time: " + dateString, 1);