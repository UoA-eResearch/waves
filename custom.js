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

var nimarkers = L.layerGroup().addTo(map);
var simarkers = L.layerGroup().addTo(map);
var arrowmarkers = L.layerGroup();

function updateSelection() {
    if (!subset) return;
    window.nimask = [];
    window.simask = [];
    var count = 0;
    /*
    if (subset.layerType == "circle") {
        var center = subset.getLatLng();
        var radius = subset.getRadius();
        nimarkers.eachLayer(function(marker) {
            var markerll = marker.getLatLng();
            var dist = markerll.distanceTo(center);
            if (dist <= radius) {
                count++;
            }
        });
        simarkers.eachLayer(function(marker) {
            var markerll = marker.getLatLng();
            var dist = markerll.distanceTo(center);
            if (dist <= radius) {
                count++;
            }
        });
    } else { */
        nimarkers.eachLayer(function(marker) {
            if (subset.contains(marker.getLatLng())) {
                count++;
                var x = parseInt(marker.options.i);
                var y = parseInt(marker.options.j);
                window.nimask.push([x,y]);
            }
        });
        simarkers.eachLayer(function(marker) {
            if (subset.contains(marker.getLatLng())) {
                count++;
                var x = parseInt(marker.options.i);
                var y = parseInt(marker.options.j);
                window.simask.push([x,y]);
            }
        });
    //}
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
    "NI markers": nimarkers,
    "SI markers": simarkers,
    "Arrows": arrowmarkers,
    "City labels": labels,
    "City labels (white)": whitelabels,
}

L.control.layers(baseMaps, overlays, { position: 'topright' }).addTo(map);

var legendranges = {
    "Hsig": {
        min: 0,
        max: 10,
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
    for (var ii in islands) {
        var island = islands[ii];
        for (var key in markerLookup[island]) {
            var marker = markerLookup[island][key];
            var o = marker.options;
            var normalized_v = ((o.v - details.min) / (details.max - details.min));
            if (subvar == "Dir") {
                var color = fullcolormap(normalized_v)
            } else {
                var color = colormap(normalized_v);
            }
            marker.setStyle({color: color});
        }
    }
})
updateLegendColors();

function unpack(rows, key) {
    return rows.map(function(row) { return row[key]; });
}

var chartProgressInterval;

function plotData(container, results) {
    var d3 = Plotly.d3
    var dts = unpack(results, 'datetime')
    for (var i in dts) {
        dts[i] = moment(dts[i], "YYYYMMDD_HHmmss").format("YYYY-MM-DD HH:mm:ss");
    }
    console.log(dts)
    var values = unpack(results, 'value')
    var mean = d3.mean(values)
    var data = [{
        type: "scatter",
        mode: "lines",
        name: window.model,
        x: dts,
        y: values,
        line: {color: '#17BECF'}
    }];
    var layout = {
        title: window.model,
        xaxis: {
            title: "Date/Time"
        },
        yaxis: {
            title: window.model
        },
        shapes: [
            {
                type: 'line',
                x0: d3.min(dts),
                y0: mean,
                x1: d3.max(dts),
                y1: mean,
                line: {
                    color: 'red',
                    width: 4,
                    dash: 'dashdot'
                }
            },
        ]
    };
    Plotly.newPlot(container[0], data, layout);
    $(container).parent().append("<div class='mean'>Mean=" + mean + "</div>");
}

function popupHandler(popup) {
    console.log(popup);
    var dt = dataset.get(2);
    var x = parseInt(popup.target.options.i);
    var y = parseInt(popup.target.options.j);
    var island = popup.target.options.island;

    var bits = window.model.split("-");
    var ftype = bits[0];
    var subvar = bits[1];

    var payload = {
        start: moment(dt.start).format("YYYYMMDD_HHmmss"),
        end: moment(dt.end).format("YYYYMMDD_HHmmss"),
        file: ftype,
        var: subvar,
    }
    if (island == "ni") {
        payload.nimask = JSON.stringify([[x,y]]);
        payload.simask = JSON.stringify([]);
    } else {
        payload.nimask = JSON.stringify([]);
        payload.simask = JSON.stringify([[x,y]]);
    }
    var container = $("#graph", popup.popup._contentNode);
/*
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
        */
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
    //}
}

var baseUrl = "https://wave.storm-surge.cloud.edu.au/wave/"
var wsUrl = "wss://stormsurge.nectar.auckland.ac.nz/storm/websocket";
var markerLookup = {
    "ni": {},
    "si": {}
};
var arrowMarkerLookup = {
    "ni": {},
    "si": {}
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
    $("#colorbar #max").val(max.toFixed(dp));
    $("#colorbar #maxsuffix").text(details.suffix);
    $("#colorbar #mid").text(midVal.toFixed(dp) + details.suffix);
    $("#colorbar #min").text(min.toFixed(dp) + details.suffix);
    var n = 0;
    var islands = ["ni", "si"];
    for (var ii in islands) {
        var island = islands[ii];
        for (var i in data[island]) {
            var row = data[island][i];
            for (var j in row) {
                var v = row[j];
                var marker = markerLookup[island][i + "_" + j];
                if (!marker) continue;
                if (subvar == "RTpeak" || subvar == "RTm01") {
                    if (v < 3.5) {
                        v = null;
                    }
                }
                if (!v) {
                    if (island == "ni") {
                        nimarkers.removeLayer(marker);
                    } else {
                        simarkers.removeLayer(marker);
                    }
                    continue;
                }
                marker.options.v = v;
                var desc = marker.options.desc + ": " + v.toFixed(dp);
                var normalized_v = ((v - min) / (max - min));
                if (normalized_v < 0) normalized_v = 0;
                if (normalized_v > 1) normalized_v = 1;
                if (subvar == "Dir") {
                    var color = fullcolormap(normalized_v)
                } else {
                    var color = colormap(normalized_v);
                }
                if (island == "ni") {
                    marker.setStyle({color: color}).setTooltipContent(desc).addTo(nimarkers);
                } else {
                    marker.setStyle({color: color}).setTooltipContent(desc).addTo(simarkers);
                }
                if (subvar == "Dir") {
                    var arrowMarker = arrowMarkerLookup[island][i + "_" + j];
                    if (arrowMarker) {
                        arrowMarker.setRotationAngle(v + 180);
                        arrowMarker.addTo(arrowmarkers);
                    }
                }
            }
        }
    }
    if (subset) {
        updateSelection();
    }
}

function fetchDataForModel(model, dt) {
    location.hash = model + "@" + dateFormat(dt);
    dt = moment(dt).format("YYYYMMDD_HHmmss");
    console.log("fetching", baseUrl, model, dt);
    var bits = model.split("-");
    var ftype = bits[0];
    var subvar = bits[1];
    window.subvar = subvar;
    map.spin(true);
    if (subvar != "Dir") {
        $.getJSON(baseUrl, { file: "DIR", var: "Dir", start: dt, end: dt }, function(data) {
            var islands = ["ni", "si"];
            for (var ii in islands) {
                var island = islands[ii];
                for (var key in arrowMarkerLookup[island]) {
                    var arrowMarker = arrowMarkerLookup[island][key];
                    var o = arrowMarker.options;
                    var v = data[island][o.i][o.j];
                    arrowMarker.setRotationAngle(v + 180);
                    arrowMarker.addTo(arrowmarkers);
                }
            }
        });
    }
    if (subvar == "Depth") {
        map.spin(false);
        handleData(window.ranges.depth);
    } else {
        $.getJSON(baseUrl, { file: ftype, var: subvar, start: dt, end: dt }, handleData).fail(function(e) {
            alert("There was an error fetching data for " + model + ": " + e.status + " " + e.statusText);
            console.error(e);
        });
    }
}

var ONE_DAY_MS = 1000 * 60 * 60 * 24;
var ONE_YEAR_MS = ONE_DAY_MS * 365;

function fetchRanges() {
    $.getJSON(baseUrl + "ranges", function(data) {
        console.log(data);
        window.latlongs = data.latlongs;
        window.ranges = data;
        var islands = ["ni", "si"];
        for (var ii in islands) {
            var island = islands[ii];
            for (var i in data.latlongs[island].lat) {
                var row = data.latlongs[island].lat[i];
                for (var j in row) {
                    var lat = data.latlongs[island].lat[i][j];
                    var lng = data.latlongs[island].lng[i][j];
                    var depth = data.depth[island][i][j];
                    if (depth < 10) continue;
                    var desc = island.toUpperCase() + ":(" + lat.toFixed(dp) + "°," + lng.toFixed(dp) + "°)/(" + i + "," + j + ")";
                    var progress = '<div class="progress">';
                    progress += '<div id="chartprogress" class="progress-bar progress-bar-striped progress-bar-animated" role="progressbar" aria-valuenow="0%" aria-valuemin="0%" aria-valuemax="100%" style="width: 0%">';
                    progress += '</div></div><h6>Loading...</h6>'
                    var popup = '<h4>' + desc + '</h4><div id="graph">' + progress + '</div>';
                    var options = {radius: 2000, color:"black", fillOpacity: 1, island: island, i: i, j: j, desc: desc};
                    var marker = L.circle([lat, lng], options);

                    marker.bindTooltip(desc).bindPopup(popup, {minWidth: 800, autoPanPadding: [400, 100]}).on("popupopen", popupHandler);
                    markerLookup[island][i + "_" + j] = marker;
                    if (i % 5 == 0 && j % 5 == 0) {
                        var arrowMarker = new L.marker([lat, lng],{
                            icon: arrowIcon,
                            rotationOrigin: "center center",
                            interactive: false,
                            i: i,
                            j: j,
                            island: island
                        });
                        arrowMarkerLookup[island][i + "_" + j] = arrowMarker;
                    }
                }
            }
        }
        $("#model").val(window.model);
        var start = data.date_ranges[0].split("_")[0];
        start = moment(start, "YYMMDD");
        var end = data.date_ranges[data.date_ranges.length - 1];
        end = end.split("_")[1];
        end = moment(end, "YYMMDD").hour(23);
        dataset.update({id: 1, start: start, end: end});
        var ct = timeline.getCustomTime(1);
        console.log(start, end, ct);
        if (ct < start || ct > end) {
            timeline.setCustomTime(start, 1);
            timeline.setCustomTimeTitle("Drag this control to display the storm surge data for a specific date. Current time: " + dateFormat(start), 1);
        }
        timeline.setWindow(start.clone().subtract(1, "year"), end.clone().add(1, "year"));
        var dateRange = dataset.get(2);
        if (dateRange.start < start || dateRange.end > end) {
            dataset.update({id: 2, start: start, end: start.clone().add(5, "months")});
        }
        var dateString = dateFormat(timeline.getCustomTime(1));
        console.log(window.model);
        fetchDataForModel(window.model, dateString);
    }).fail(function(e) {
        alert("There was an error fetching data ranges " + ": " + e.status + " " + e.statusText);
        console.error(e);
    });
}

$("#model").change(function(e) {
    window.model = this.value;
    fetchDataForModel(this.value, timeline.getCustomTime(1));
});

var interval;

$("#download").click(function() {
    var dt = dataset.get(2);

    var model = $("#exportmodel").val();

    var bits = model.split("-");
    var ftype = bits[0];
    var subvar = bits[1];

    var payload = {
        start: moment(dt.start).format("YYYYMMDD_HHmmss"),
        end: moment(dt.end).format("YYYYMMDD_HHmmss"),
        file: ftype,
        var: subvar,
        format: "csv"
    }
    if (subset) {
        payload.nimask = JSON.stringify(window.nimask);
        payload.simask = JSON.stringify(window.simask);
    }
    /*
    gtag('event', 'request', {
        'event_category': 'export',
        'event_label': JSON.stringify(payload)
    });
    */
    $("#statustext").text("Preparing export...");
    $("#download").attr("disabled", "disabled");
    $("#download").attr("class", "btn btn-secondary");
    $("#cancel_download").show();
    $("#downloadprogress").text("0%");
    $("#downloadprogress").css("width", "0%");
    $("#downloadprogress").attr("aria-valuenow", 0);
    $("#downloadprogresswrapper").show();
    /*
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
        */
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
                /*
                gtag('event', 'download', {
                    'event_category': 'export',
                    'event_label': url
                });
                */
            });
            /*
            gtag('event', 'ready', {
                'event_category': 'export',
                'event_label': url
            });
            */
        }).fail(function(e) {
            if (e.statusText != "abort" && e.statusText != "error") {
                var error = "There was an error exporting data for " + window.model + ": " + e.status + " " + e.statusText;
                alert(error);
                $("#statustext").html(error);
                /*
                gtag('event', 'error', {
                    'event_category': 'export',
                    'event_label': e.statusText
                });
                */
            }
            console.error(e);
        }).always(function(e) {
            $("#cancel_download").hide();
            $("#downloadprogresswrapper").hide();
            $("#download").removeAttr("disabled");
            $("#download").attr("class", "btn btn-primary");
            clearInterval(interval);
        });
    //}
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
    {id: 1, content: 'Data range', start: new Date(1871, 0, 1, 12), end: new Date(2100, 0, 1, 12), editable: false, selectable: false},
    {id: 2, content: 'Timeseries export range', start: new Date(1871, 0, 1, 12), end: new Date(1900, 0, 1, 12), editable: {updateTime: true, remove: false}, style: "display: none"}
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
    if (start == "Invalid Date") return;
    if (start < bounds.start) return;
    if (start > bounds.end - ONE_DAY_MS) start = new Date(bounds.end - ONE_DAY_MS);
    dataset.update({id: 2, start: start, end: dataset.get(2).end});
    updateSelectedDays();
});

$("#current").change(function() {
    var bounds = dataset.get(1);
    var newTime = new Date(this.value);
    if (newTime == "Invalid Date") return;
    if (newTime < bounds.start) return;
    if (newTime > bounds.end) newTime = new Date(bounds.end);
    newTime = snapDate(newTime);
    timeline.setCustomTime(newTime, 1);
    fetchDataForModel(window.model, newTime);
})

$("#end").change(function() {
    var bounds = dataset.get(1);
    var end = new Date(this.value);
    if (end == "Invalid Date") return;
    if (end > bounds.end) end = bounds.end;
    if (end < bounds.start) return;
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
    snap: snapDate,/*
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
    },*/
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
        }, 1000);
    } else {
        $("#play i").attr("class", "fas fa-play");
        clearInterval(playInterval);
    }
});


$('#exportmodel').multiselect();

var model = "HSIGN-Hsig";
if (location.hash.length > 1) {
    var bits = decodeURIComponent(location.hash.slice(1)).split("@");
    model = bits[0];
    timeline.addCustomTime(bits[1], 1);
} else {
    timeline.addCustomTime("1871-1-1 12:00", 1);
}
window.model = model;
var dateString = timeline.getCustomTime(1);
timeline.setCustomTimeTitle("Drag this control to display the wave data for a specific date. Current time: " + dateString, 1);
$("#current").val(moment(dateString).format("YYYY-MM-DDTHH:mm"));
fetchRanges();

$('#vis-tab').on('shown.bs.tab', function (e) {
    console.log("vis");
    dataset.update({id: 2, style:"display:none"});
})

$('#export-tab').on('shown.bs.tab', function (e) {
    console.log("export");
    dataset.update({id: 2, style:"display:block"});
})