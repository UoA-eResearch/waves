#!/usr/bin/env python3

from bottle import Bottle, request, response, static_file, run, abort
import bottle_mysql
import csv
import os
import sys
from datetime import datetime
import csv
from zipfile import ZipFile, ZIP_DEFLATED
import time
import json

from gevent.pywsgi import WSGIServer
from geventwebsocket import WebSocketError
from geventwebsocket.handler import WebSocketHandler

application = Bottle()
plugin = bottle_mysql.Plugin(dbuser='wave_ro', dbpass='wave', dbname='wave', dbhost='wave.storm-surge.cloud.edu.au')
application.install(plugin)

@application.hook('after_request')
def enable_cors():
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Methods'] = 'PUT, GET, POST, DELETE, OPTIONS'
    response.headers['Access-Control-Allow-Headers'] = 'Origin, Accept, Content-Type, X-Requested-With, X-CSRF-Token'

def getParamsOrDefaults(params):
    if 'ftype' not in params:
        params['ftype'] = "HSIGN"
    if 'var' not in params:
        params['var'] = "m.*"
    if 'bounds' not in params:
        params['bounds'] = "Polygon((160 -30.5,187 -30.5,187 -49.5,160 -49.5, 160 -30.5))"
    if 'minDate' not in params:
        params['minDate'] = '1993-01-01 00:00:00'
    if 'maxDate' not in params:
        params['maxDate'] = '1993-01-01 00:00:00'
    if 'format' not in params:
        params['format'] = 'json'
    if "-" in params["ftype"]:
        params["lltable"] = "latlong_new"
        params["depthtable"] = "DEPTH_new"
    else:
        params["lltable"] = "latlong"
        params["depthtable"] = "DEPTH"
    return params

def getQueryForParams(params):
    if params["minDate"] == params["maxDate"]:
        optimal_index = "t"
    else:
        optimal_index = "ixyt"
    fromwhere = " FROM `" + params['ftype'] + "` m USE INDEX(" + optimal_index + ") INNER JOIN `" + params["lltable"] + "` l ON m.island = l.island AND m.x = l.x AND m.y = l.y INNER JOIN date d ON m.t = d.id INNER JOIN " + params["depthtable"] + " z ON m.island = z.island AND m.x = z.x AND m.y = z.y "
    fromwhere += "WHERE MBRContains(ST_GeomFromText('" + params['bounds'] + "'), l.latlong) AND d.datetime BETWEEN '" + params['minDate'] + "' AND '" + params['maxDate'] + "' AND z.Depth > 30"
    return fromwhere

def getFilenameForParams(params, ext = 'csv'):
    latlng = params['bounds'].split(",")[1].strip().split(" ")
    lng = float(latlng[0])
    lat = float(latlng[1])
    latS = "{0:05.1f}".format(abs(lat)).replace(".","")
    lngS = "{0:05.1f}".format(abs(lng)).replace(".","")
    if lat < 0:
        latS += "S"
    else:
        latS += "N"
    if lng < 0:
        lngS += "W"
    else:
        lngS += "E"
    filename = "{}-{}-{}-{}-{}{}.{}".format(
        params['ftype'],
        params['var'],
        params['minDate'][:params['minDate'].index(" ")].replace("-", ""),
        params['maxDate'][:params['maxDate'].index(" ")].replace("-", ""),
        lngS,
        latS,
        ext
    )
    return filename

def writeCSV(filename, results):
    filename_with_path = os.path.join("exports", filename)
    headers = sorted([k for k in results[0].keys() if k not in ["x", "y", "m.x", "m.y", "t", "island"]])
    with open(filename_with_path, 'w') as csvfile:
        writer = csv.DictWriter(csvfile, fieldnames=headers, extrasaction='ignore')
        writer.writeheader()
        writer.writerows(results)
    zipfilename = filename_with_path.replace(".csv", ".zip")
    with ZipFile(zipfilename, "w", ZIP_DEFLATED) as zip:
        zip.write(filename_with_path, filename)
    os.remove(filename_with_path)
    return zipfilename

@application.get('/')
def get(db):
    s = time.time()
    params = getParamsOrDefaults(request.params)
    if params["ftype"] == "DEPTH":
        query = "SELECT m.x AS x, m.y AS y, ST_Y(l.latlong) AS lat, ST_X(l.latlong) AS lng, Depth FROM DEPTH m INNER JOIN `latlong` l ON m.island = l.island AND m.x = l.x AND m.y = l.y WHERE MBRContains(ST_GeomFromText('" + params['bounds'] + "'), l.latlong) AND Depth > 30"
    elif "DEPTH" in params["ftype"]:
        query = "SELECT m.x AS x, m.y AS y, ST_Y(l.latlong) AS lat, ST_X(l.latlong) AS lng, Depth FROM DEPTH_new m INNER JOIN `latlong_new` l ON m.island = l.island AND m.x = l.x AND m.y = l.y WHERE MBRContains(ST_GeomFromText('" + params['bounds'] + "'), l.latlong) AND Depth > 30"
    else:
        fromwhere = getQueryForParams(params)
        query = "SELECT m.x AS x, m.y AS y, ST_Y(l.latlong) AS lat, ST_X(l.latlong) AS lng, {}, DATE_FORMAT(d.datetime, '%Y-%m-%d %H:%i:%s') AS datetime{}".format(params["var"], fromwhere)
    print(query)
    db.execute(query)
    print("{}s - query executed".format(time.time() - s))
    results = db.fetchall()
    print("{}s - all {} results fetched".format(time.time() - s, len(results)))
    if params['format'] == 'csv':
        filename = getFilenameForParams(params)
        zipfilename = writeCSV(filename, results)
        return {"url": zipfilename}
    else:
        return {"results": results}


@application.get('/range/<table>')
def get_range(db, table):
    db.execute(f"SELECT DATE_FORMAT(d.datetime, '%Y-%m-%d %H:%i:%s') as minDate FROM date d WHERE d.id = (SELECT MIN(t) FROM `{table}`)")
    result = db.fetchone()
    db.execute(f"SELECT DATE_FORMAT(d.datetime, '%Y-%m-%d %H:%i:%s') as maxDate FROM date d WHERE d.id = (SELECT MAX(t) FROM `{table}`)")
    result.update(db.fetchone())
    return result

@application.route('/websocket')
def handle_websocket(db):
    wsock = request.environ.get('wsgi.websocket')
    if not wsock:
        abort(400, 'Expected WebSocket request.')

    while True:
        try:
            s = time.time()
            message = wsock.receive()
            try:
                params = json.loads(message)
            except:
                wsock.send('{"error": "unable to parse JSON"}')
                continue
            params = getParamsOrDefaults(params)
            print(params)
            if params["ftype"] == "DEPTH":
                query = "SELECT m.x AS x, m.y AS y, ST_Y(l.latlong) AS lat, ST_X(l.latlong) AS lng, Depth FROM DEPTH m INNER JOIN `latlong` l ON m.island = l.island AND m.x = l.x AND m.y = l.y WHERE MBRContains(ST_GeomFromText('" + params['bounds'] + "'), l.latlong) AND Depth > 30"
                db.execute(query)
                results = db.fetchall()
            elif "DEPTH" in params["ftype"]:
                query = "SELECT m.x AS x, m.y AS y, ST_Y(l.latlong) AS lat, ST_X(l.latlong) AS lng, Depth FROM DEPTH_new m INNER JOIN `latlong_new` l ON m.island = l.island AND m.x = l.x AND m.y = l.y WHERE MBRContains(ST_GeomFromText('" + params['bounds'] + "'), l.latlong) AND Depth > 30"
                db.execute(query)
                results = db.fetchall()
            else:
                fromwhere = getQueryForParams(params)
                countquery = "SELECT COUNT(*) as count" + fromwhere
                print(countquery)
                db.execute(countquery)
                count = db.fetchone()['count']
                print("{}s - {} results to fetch".format(time.time() - s, count))
                results = []
                query = "SELECT ST_Y(l.latlong) AS lat, ST_X(l.latlong) AS lng, {}, DATE_FORMAT(d.datetime, '%Y-%m-%d %H:%i:%s') AS datetime{}".format(params["var"], fromwhere)
                chunksize = 500
                for i in range(0, count, chunksize):
                    if count - i < chunksize:
                        chunksize = count - i
                    chunked_query = query + " LIMIT {} OFFSET {}".format(chunksize, i)
                    db.execute(chunked_query)
                    print("{}s - query for chunk {} executed".format(time.time() - s, i))
                    theseresults = db.fetchall()
                    results.extend(theseresults)
                    pct_done = float(i) / float(count)
                    wsock.send(json.dumps({"progress": pct_done}))
            print("{}s - all {} results fetched".format(time.time() - s, len(results)))
            if params['format'] == 'csv':
                filename = getFilenameForParams(params)
                zipfilename = writeCSV(filename, results)
                wsock.send(json.dumps({"url": zipfilename}))
            else:
                wsock.send(json.dumps({"results": results}))
        except WebSocketError:
            break

@application.get('/exports/<filename>')
def serve_export(filename):
    print("request for " + filename)
    return static_file(filename, root='exports')

if __name__ == "__main__":
    application.run(
        host='localhost',
        port=8081,
        server='gunicorn',
        workers=16,
        worker_class="geventwebsocket.gunicorn.workers.GeventWebSocketWorker",
        timeout=86400,
        capture_output=True
    )
