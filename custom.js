var map = L.map('map', {
    center: [-41.235726,172.5118422],
    zoom: 6,
    minZoom: 5,
    maxZoom: 13,
    zoomControl: false
});
L.control.zoom({position: 'topright'}).addTo(map);
map.doubleClickZoom.disable();

map.on('zoomend', function() {
    var zoom = map.getZoom();
    console.log(zoom);
    if (zoom == 5) {
        $(".arrow").css("font-size", "1.5rem");
    } else if (zoom == 6) {
        $(".arrow").css("font-size", "2.5rem");
    } else if (zoom >= 7) {
        $(".arrow").css("font-size", "4rem");
    }
});

var bounds = map.getBounds();
var degreeLimit = 10;
bounds._northEast.lat += degreeLimit * 3;
bounds._northEast.lng += degreeLimit;
bounds._southWest.lat -= degreeLimit;
bounds._southWest.lng -= degreeLimit;
map.setMaxBounds(bounds);

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
var arrowmarkers = L.layerGroup();

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
    "Markers": markers,
    "Arrows": arrowmarkers,
    "City labels": labels,
    "City labels (white)": whitelabels,
}

L.control.layers(baseMaps, overlays, { position: 'topright' }).addTo(map);

var legendranges = {
    "Hsig": {
        min: 0,
        max: 5,
        suffix: "m"
    },
    "RTpeak": {
        min: 1,
        max: 25,
        suffix: "s"
    },
    "RTm01": {
        min: 1,
        max: 25,
        suffix: "s"
    },
    "Dir": {
        min: 0,
        max: 360,
        suffix: "°"
    },
    "Depth": {
        min: 0,
        max: 1000,
        suffix: "m"
    }
}

var colormap = chroma.scale([chroma.hsv(270,1,1), chroma.hsv(180,1,1), chroma.hsv(90,1,1), chroma.hsv(0,1,1)]).mode("hsv");
var fullcolormap = chroma.scale([chroma.hsv(360,1,1), chroma.hsv(270,1,1), chroma.hsv(180,1,1), chroma.hsv(90,1,1), chroma.hsv(0,1,1)]).mode("hsv");
var logcolormap = chroma.scale([chroma.hsv(270,1,1), chroma.hsv(180,1,1), chroma.hsv(90,1,1), chroma.hsv(0,1,1)]).mode("hsv").domain([0, .1, .2, 1]);

function updateLegendColors(cmap = "default") {
    var colors = [];
    for (var i = 1; i >= 0; i -= .1) {
        if (cmap == "full") {
            colors.push(fullcolormap(i));
        } else if (cmap == "log") {
            colors.push(logcolormap(i));
        } else {
            colors.push(colormap(i));
        }
    }
    var gradientString = "linear-gradient(" + colors.join(",") + ")";
    $("#gradient").css("background", gradientString);
}

var legend = L.control({position: 'bottomright'});
legend.onAdd = function(map) {
    var div = L.DomUtil.create('div', 'info legend');
    var colorbar = '<h3>Legend</h3><div id="colorbar"><div id="gradient"></div>';
    colorbar += '<input type="number" id="max" class="label" value=1 style="width:50px" /><span id="maxsuffix"></span><div id="mid" class="label">0.5</div><div id="min" class="label">0</div>';
    colorbar += '</div><img id="compass" src="coloured_compass.png" style="width:100%;height:100%;display:none"></img>';
    div.innerHTML = colorbar;
    div.firstChild.onmousedown = div.firstChild.ondblclick = L.DomEvent.stopPropagation;
    return div;
}
legend.addTo(map);
$("#max").change(function() {
    var val = parseFloat(this.value);
    console.log(val);
    var details = legendranges[window.subvar];
    details.max = val;
    var midVal = (details.max + details.min) / 2;
    $("#mid").text(midVal.toFixed(dp) + details.suffix);
    var islands = ["ni", "si"];
    for (var i in markerLookup) {
        var marker = markerLookup[i];
        var o = marker.options;
        var normalized_v = ((o.v - details.min) / (details.max - details.min));
        if (subvar == "Dir") {
            var color = fullcolormap(normalized_v)
        } else {
            var color = colormap(normalized_v);
        }
        marker.setStyle({color: color});
    }
})
updateLegendColors();

function unpack(rows, key) {
    return rows.map(function(row) { return row[key]; });
}

var chartProgressInterval;

function plotData(container, results) {
    var details = legendranges[subvar];
    var suffix = "";
    if (details) {
        var suffix = details.suffix;
    }
    var title = subvar + "(" + suffix + ")";
    var d3 = Plotly.d3
    var dts = unpack(results, 'datetime')
    var values = unpack(results, subvar)
    var mean = d3.mean(values)
    var means = [];
    for (i in dts) {
        means.push(mean);
    }
    var data = [{
        type: "scatter",
        mode: "lines",
        name: title,
        x: dts,
        y: values,
        line: {color: '#17BECF'}
    },
    {
        type: "scatter",
        mode: "lines",
        name: "mean",
        x: dts,
        y: means,
        line: {color: "red"}
    }];
    var layout = {
        title: title + " over time",
        xaxis: {
            title: "Date/Time"
        },
        yaxis: {
            title: title,
            hoverformat: '.1f'
        }
    };
    Plotly.newPlot(container[0], data, layout);

    var meanS = Math.round(mean * 10) / 10 + suffix;
    $(container).parent().append("<div class='mean'>Mean=" + meanS + "</div>");
}

function popupHandler(popup) {
    console.log(popup);
    var dt = dataset.get(2);
    var bounds = Terraformer.WKT.convert(popup.target.toGeoJSON().geometry);

    var bits = model.replace("NZ-HIST-000-", "").rsplit("-", 1);
    var ftype = bits[0];
    var subvar = bits[1];

    var payload = {
        minDate: dateFormat(dt.start),
        maxDate: dateFormat(dt.end),
        ftype: ftype,
        var: subvar,
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

var baseUrl = "https://wave.storm-surge.cloud.edu.au/wave_mysql/"
var wsUrl = "wss://wave.storm-surge.cloud.edu.au/wave_mysql/websocket";
var markerLookup = {}
var arrowMarkerLookup = {}

var ranges = {
    "NZ-HIST-000": {
        "min": "1993-01-01 00:00",
        "max": "2012-12-31 21:00"
    },
    "NZ-HIST-H": {
        "min": "1993/01/01 00:00",
        "max": "2005/12/31 21:00"
    },
    "NZ-PROJ-M": {
        "min": "2026/01/01 00:00",
        "max": "2045/12/31 21:00"
    },
    "NZ-PROJ-E": {
        "min": "2081/01/01 00:00",
        "max": "2100/12/31 21:00"
    }
}

var dp = 4;

var arrowIcon = new L.divIcon({
    className : "arrowIcon",
    html : "<div class='arrow' style='font-size: 2.5rem;color:black; -webkit-text-stroke: 1px black;'>↑</div>"
})

function handleData(data) {
    console.log(data);
    map.spin(false);
    var maxHSV = 250;
    var details = legendranges[subvar];
    if (!details) {
        details = {suffix: ""}
        var values = unpack(data.results, subvar);
        var d3 = Plotly.d3;
        details.min = d3.min(values);
        details.max = d3.max(values);
        legendranges[subvar] = details;
    }
    var min = details.min;
    var max = details.max;
    if (subvar == "Dir") {
        //$("#colorbar").hide();
        //$("#compass").show();
        map.addLayer(arrowmarkers);
        maxHSV = 360;
        updateLegendColors("full");
    } else {
        $("#colorbar").show();
        $("#compass").hide();
        updateLegendColors();
    }
    var midVal = (max + min) / 2;
    dp = 1;
    $("#colorbar #max").val(max.toFixed(dp));
    $("#colorbar #maxsuffix").text(details.suffix);
    $("#colorbar #mid").text(midVal.toFixed(dp) + details.suffix);
    $("#colorbar #min").text(min.toFixed(dp) + details.suffix);
    var n = 0;
    console.log(data);
    window.lastvar = subvar;
    for (var i in data.results) {
        var d = data.results[i];
        var v = d[subvar];
        var desc = "(" + d.lat.toFixed(dp) + "°," + d.lng.toFixed(dp) + "°)=" + v.toFixed(dp);
        var normalized_v = ((v - min) / (max - min));
        if (normalized_v < 0) normalized_v = 0;
        if (normalized_v > 1) normalized_v = 1;
        if (subvar == "Dir") {
            var color = fullcolormap(normalized_v)
        } else {
            var color = colormap(normalized_v);
        }
        var marker = markerLookup[d.lat + "_" + d.lng];
        if (!marker) {
            var options = {radius: 2000, color: color, fillOpacity: 1};
            var marker = L.circle([d.lat, d.lng], options);
            var progress = '<div class="progress">';
            progress += '<div id="chartprogress" class="progress-bar progress-bar-striped progress-bar-animated" role="progressbar" aria-valuenow="0%" aria-valuemin="0%" aria-valuemax="100%" style="width: 0%">';
            progress += '</div></div><h6>Loading...</h6>'
            var popup = '<h4>' + desc + '</h4><div id="graph">' + progress + '</div>';
            marker.bindTooltip(desc).addTo(markers).bindPopup(popup, {minWidth: 800, autoPanPadding: [400, 100]}).on("popupopen", popupHandler);
            markerLookup[d.lat + "_" + d.lng] = marker;
        } else {
            marker.setStyle({color: color}).setTooltipContent(desc);
        }
        marker.options.v = v;
        marker.addTo(markers);
        if (subvar == "Dir") {
            if (d.x % 5 == 0 && d.y % 5 == 0) {
                var arrowMarker = arrowMarkerLookup[d.lat + "_" + d.lng];
                if (!arrowMarker) {
                    var arrowMarker = new L.marker([d.lat, d.lng],{
                        icon: arrowIcon,
                        rotationOrigin: "center center",
                        interactive: false,
                    });
                    arrowMarker.addTo(arrowmarkers);
                    arrowMarkerLookup[d.lat + "_" + d.lng] = arrowMarker;
                }
                arrowMarker.setRotationAngle(d.Dir + 180);
            }
        }
    }
    if (subset) {
        updateSelection();
    }
}

function fetchDataForModel(model, dt) {
    location.hash = model + "@" + dateFormat(dt);
    dt = moment(dt).format("YYYY-MM-DD HH:mm:ss");
    console.log("fetching", baseUrl, model, dt);
    var bits = model.replace("NZ-HIST-000-", "").rsplit("-", 1);
    var ftype = bits[0];
    var subvar = bits[1];
    window.subvar = subvar;
    map.spin(true);
    if (subvar != "Dir") {
        var dirftype = "DIR";
        if (ftype.includes("-")) {
            dirftype = ftype.rsplit("-", 1)[0] + "-DIR";
        }
        $.getJSON(baseUrl, { ftype: dirftype, var: "Dir", minDate: dt, maxDate: dt }, function(data) {
            for (var i in data.results) {
                var v = data.results[i];
                if (v.x % 5 == 0 && v.y % 5 == 0) {
                    var arrowMarker = arrowMarkerLookup[v.lat + "_" + v.lng];
                    if (!arrowMarker) {
                        var arrowMarker = new L.marker([v.lat, v.lng],{
                            icon: arrowIcon,
                            rotationOrigin: "center center",
                            interactive: false,
                        });
                        arrowMarker.addTo(arrowmarkers);
                        arrowMarkerLookup[v.lat + "_" + v.lng] = arrowMarker;
                    }
                    arrowMarker.setRotationAngle(v.Dir + 180);
                }
            }
        });
    }
    $.getJSON(baseUrl, { ftype: ftype, var: subvar, minDate: dt, maxDate: dt }, handleData).fail(function(e) {
        alert("There was an error fetching data for " + model + ": " + e.status + " " + e.statusText);
        console.error(e);
    });
}

var ONE_DAY_MS = 1000 * 60 * 60 * 24;
var ONE_YEAR_MS = ONE_DAY_MS * 365;

function fetchRangeForModel(model) {
    for (var k in ranges) {
        if (model.includes(k)) {
            range=ranges[k];
            break;
        }
    }
    console.log(model);
    console.log(range);
    var start = moment(range.min);
    var end = moment(range.max);
    dataset.update({id: 1, content: model, start: start, end: end});
    var ct = timeline.getCustomTime(1);
    if (ct < start || ct > end) {
        timeline.setCustomTime(start, 1);
        timeline.setCustomTimeTitle("Drag this control to display data for a specific date. Current time: " + dateFormat(start), 1);
    }
    timeline.setWindow(moment(start).subtract(1, "year"), moment(end).add(1, "year"));
    var dateRange = dataset.get(2);
    if (dateRange.start < start || dateRange.end > end) {
        dataset.update({id: 2, start: start, end: moment(start).add(1, "year")});
    }
    markers.clearLayers();
    arrowmarkers.clearLayers();
    markerLookup = [];
    arrowMarkerLookup = [];
    fetchDataForModel(model, timeline.getCustomTime(1));
}

$("#model").change(function(e) {
    window.model = $("#model").val() + "-" + $("#var").val();
    if ($("#var").val() == "DEPTH-Depth") {
        markers.clearLayers();
        arrowmarkers.clearLayers();
        markerLookup = [];
        arrowMarkerLookup = [];
        fetchDataForModel(window.model, timeline.getCustomTime(1));
    } else {
        fetchRangeForModel(window.model, timeline.getCustomTime(1));
    }
});
$("#var").change(function(e) {
    window.model = $("#model").val() + "-" + $("#var").val();
    fetchDataForModel(window.model, timeline.getCustomTime(1));
})

var interval;

$("#download").click(function() {
    $("#statustext").text("Preparing export...");
    $("#download_status").text("");
    $("#download").attr("disabled", "disabled");
    $("#download").attr("class", "btn btn-secondary");
    $("#cancel_download").show();
    var dt = dataset.get(2);
    var model = $("#model").val();
    if (model.includes("NZ-HIST-000")) {
        var vars = $("#exportmodelvars").val();
    } else {
        var vars = $("#exportmodelvarsnew").val();
    }
    window.pending = 0;
    window.wsconnections = []
    $.each(vars, function(i, v) {
        var bits = v.split("-");
        var ftype = bits[0];
        if (model != "NZ-HIST-000") {
            ftype = model + "-" + ftype;
        }
        var subvar = bits[1];

        var payload = {
            minDate: dateFormat(dt.start),
            maxDate: dateFormat(dt.end),
            ftype: ftype,
            var: subvar,
            format: "csv"
        }
        if (subset) {
            wkt = Terraformer.WKT.convert(subset.toGeoJSON().geometry);
            console.log(wkt);
            payload.bounds = wkt;
        }
        /*
        gtag('event', 'request', {
            'event_category': 'export',
            'event_label': JSON.stringify(payload)
        });
        */

        $("#download_status").append('<div id="' + ftype + '_progress">' + ftype + ':<div class="downloadprogress progress-bar progress-bar-striped progress-bar-animated" role="progressbar" aria-valuenow="0%" aria-valuemin="0%" aria-valuemax="100%" style="width: 0%">0%</div></div>')

        var ws = new WebSocket(wsUrl);
        window.pending++;
        window.wsconnections.push(ws);
        ws.onopen = function() {
            ws.send(JSON.stringify(payload));
        };
        ws.onmessage = function (evt) {
            var data = JSON.parse(evt.data);
            console.log(data);
            if ('progress' in data) {
                var pct = Math.round(data.progress * 100);
                $("#" + ftype + "_progress .downloadprogress").text(pct + "%");
                $("#" + ftype + "_progress .downloadprogress").css("width", pct + "%");
                $("#" + ftype + "_progress .downloadprogress").attr("aria-valuenow", pct);
            } else {
                var url = baseUrl + data.url;
                $("#" + ftype + "_progress").html(ftype + ' is ready - click <a href="' + url + '">here</a> to download');
                /*
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
                */
                ws.close();
                window.pending--;
                if (window.pending == 0) {
                    console.log("all done!");
                    $("#cancel_download").hide();
                    $("#download").removeAttr("disabled");
                    $("#download").attr("class", "btn btn-primary");
                    $("#statustext").html("Export complete");
                }
            }
        }
    });
});

$("#cancel_download").click(function() {
    $("#cancel_download").hide();
    $("#download").removeAttr("disabled");
    $("#download").attr("class", "btn btn-primary");
    $("#statustext").html("Export cancelled");
    if (window.wsconnections) {
        for (var i in window.wsconnections) {
            window.wsconnections[i].close();
        }
    } else if (window.currentXHR) {
        window.currentXHR.abort();
        clearInterval(interval);
    }
});

function dateFormat(date){
    return moment(date).format("YYYY-MM-DD HH:mm");
}

function snapDate(date) {
    var hour = date.getHours();
    date.setHours(Math.round(hour / 3) * 3);
    date.setMinutes(0);
    date.setSeconds(0);
    return date;
}

// DOM element where the Timeline will be attached
var container = document.getElementById('timeline');

var dataset = new vis.DataSet([
    {id: 1, content: 'Data range', start: new Date(1993, 0, 1, 0), end: new Date(2012, 11, 31, 0), editable: false, selectable: false},
    {id: 2, content: 'On-click display range', start: new Date(1993, 0, 1, 0), end: new Date(1994, 0, 1, 0), editable: {updateTime: true, remove: false}}
]);

dataset.on('update', function (event, properties) {
    var range = properties.data[0];
    if (range.id != 2) return;
    console.log(range);
    $("#download_info #start").val(moment(range.start).format("YYYY-MM-DDTHH:mm"));
    $("#download_info #end").val(moment(range.end).format("YYYY-MM-DDTHH:mm"));
    $(".vis-drag-left").attr("title", "Export range control: click and drag to define the beginning of the time series you want to export. Currently set to " + dateFormat(range.start));
    $(".vis-drag-right").attr("title", "Export range control: click and drag to define the end of the time series you want to export. Currently set to " + dateFormat(range.end));
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
    if (start == "Invalid Date") start = new Date(bounds.start);
    if (start.getFullYear() < 1000) return; // user typing year
    if (start < bounds.start) start = new Date(bounds.start);
    if (start > bounds.end - ONE_DAY_MS) start = new Date(bounds.end - ONE_DAY_MS);
    dataset.update({id: 2, start: start, end: dataset.get(2).end});
    updateSelectedDays();
});

$("#current").change(function() {
    var bounds = dataset.get(1);
    var newTime = new Date(this.value);
    if (newTime == "Invalid Date") newTime = new Date(bounds.start);
    if (newTime.getFullYear() < 1000) return; // user typing year
    if (newTime < bounds.start) newTime = new Date(bounds.start);
    if (newTime > bounds.end) newTime = new Date(bounds.end);
    $("#current").val(moment(newTime).format("YYYY-MM-DDTHH:mm"));
    newTime = snapDate(newTime);
    timeline.setCustomTime(newTime, 1);
    fetchDataForModel(window.model, newTime);
})

$("#end").change(function() {
    var bounds = dataset.get(1);
    var end = new Date(this.value);
    if (end == "Invalid Date") end = new Date(bounds.start);
    if (end.getFullYear() < 1000) return; // user typing year
    if (end < bounds.start) end = new Date(bounds.start);
    if (end > bounds.end) end = new Date(bounds.end);
    dataset.update({id: 2, start: dataset.get(2).start, end: end});
    updateSelectedDays();
});

$("#download_info #start").val(moment(dataset.get(2).start).format("YYYY-MM-DDTHH:mm"));
$("#download_info #end").val(moment(dataset.get(2).end).format("YYYY-MM-DDTHH:mm"));
updateSelectedDays();

// Configuration for the Timeline
var options = {
    width: "100%",
    min: "1800-1-1",
    max: "2200-1-1",
    zoomable: true,
    zoomMin: 1000 * 60 * 60 * 24,
    editable: {
        updateTime: true,
        remove: false,
        overrideItems: false
    },
    snap: snapDate,
    onMoving: function (item, callback) {
        console.log(item, callback);
        var bounds = dataset.get(1);

        if (item.start > item.end - ONE_DAY_MS) item.start = new Date(item.end - ONE_DAY_MS);
        if (item.end.getTime() < item.start.getTime() + ONE_DAY_MS) item.end = new Date(item.start.getTime() + ONE_DAY_MS);
        if (item.start < bounds.start) item.start = bounds.start;
        if (item.start > bounds.end - ONE_DAY_MS) item.start = new Date(bounds.end - ONE_DAY_MS);
        if (item.end < bounds.start + ONE_DAY_MS) item.end = new Date(bounds.start + ONE_DAY_MS);
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
    var dt = snapDate(e.time);
    var bounds = dataset.get(1);
    if (dt < bounds.start) {
        dt = bounds.start;
    } else if (dt > bounds.end) {
        dt = bounds.end;
    }
    timeline.setCustomTime(dt, 1);
    var dateString = dateFormat(dt);
    $("#current").val(moment(dt).format("YYYY-MM-DDTHH:mm"));
    timeline.setCustomTimeTitle("Drag this control to display the storm surge data for a specific date. Current time: " + dateString, 1);
    console.log("timechange", e, dateString);
    fetchDataForModel(window.model, dt);
});

$(".vis-panel.vis-bottom").bind('wheel', function (event) {
    console.log("scroll on bottom");
    if (event.originalEvent.deltaY < 0) {
        timeline.zoomIn(1);
    } else {
        timeline.zoomOut(1);
    }
});

//$(".vis-current-time").prepend('<img id="curDateImg" data-toggle="tooltip" data-placement="top" src="images/pin.svg" title="Current time: ' + new Date() + '"/>');

var range = dataset.get(2);

$(".vis-drag-left").attr("title", "Export range control: click and drag to define the beginning of the time series you want to export. Currently set to " + dateFormat(range.start));
$(".vis-drag-right").attr("title", "Export range control: click and drag to define the end of the time series you want to export. Currently set to " + dateFormat(range.end));

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
            ct = snapDate(ct);
            var newTime = moment(ct).add(3, "hours");
            if (newTime < bounds.start || newTime > bounds.end) {
                newTime = bounds.start;
            }
            timeline.setCustomTime(newTime, 1);
            var dateString = dateFormat(newTime);
            $("#current").val(moment(newTime).format("YYYY-MM-DDTHH:mm"));
            timeline.setCustomTimeTitle("Drag this control to display the storm surge data for a specific date. Current time: " + dateString, 1);
            fetchDataForModel(window.model, dateString);
        }, 2000);
    } else {
        $("#play i").attr("class", "fas fa-play");
        clearInterval(playInterval);
    }
});

String.prototype.rsplit = function(sep, maxsplit) {
    var split = this.split(sep);
    return maxsplit ? [ split.slice(0, -maxsplit).join(sep) ].concat(split.slice(-maxsplit)) : split;
}

var model = "NZ-HIST-000";
var variable = "HSIGN-Hsig";
if ($("#model").length) {
    model = $("#model").val();
}
if (location.hash.length > 1) {
    var bits = decodeURIComponent(location.hash.slice(1)).split("@");
    var model_var = bits[0];
    var dt = bits[1];
    model = model_var.substring(0,11);
    variable = model_var.substring(12);
    console.log(model, variable);
    $("#model").val(model);
    $("#var").val(variable);
    timeline.addCustomTime(dt, 1);
} else {
    timeline.addCustomTime("1993-01-01 00:00", 1);
}
window.model = model + "-" + variable;
var dateString = timeline.getCustomTime(1);
timeline.setCustomTimeTitle("Drag this control to display the wave data for a specific date. Current time: " + dateString, 1);
$("#current").val(moment(dateString).format("YYYY-MM-DDTHH:mm"));
fetchRangeForModel(model);

$('#vis-tab').on('shown.bs.tab', function (e) {
    console.log("vis");
    dataset.update({id: 2, content:"On-click display range"});
})

$('#export-tab').on('shown.bs.tab', function (e) {
    console.log("export");
    dataset.update({id: 2, content:"Timeseries export range"});
    $("#download_info #start").val(moment(dataset.get(2).start).format("YYYY-MM-DDTHH:mm"));
    $("#download_info #end").val(moment(dataset.get(2).end).format("YYYY-MM-DDTHH:mm"));
})