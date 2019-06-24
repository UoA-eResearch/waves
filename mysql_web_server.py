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
        params['var'] = "Hsig"
    if 'bounds' not in params:
        params['bounds'] = "Polygon((160 -30.5,187 -30.5,187 -49.5,160 -49.5, 160 -30.5))"
    if 'minDate' not in params:
        params['minDate'] = '1993-01-01 00:00:00'
    if 'maxDate' not in params:
        params['maxDate'] = '1993-01-01 00:00:00'
    if 'format' not in params:
        params['format'] = 'json'
    return params

def getQueryForParams(params):
    fromwhere = " FROM `" + params['ftype'] + "` m INNER JOIN `latlong` l ON m.island = l.island AND m.x = l.x AND m.y = l.y INNER JOIN date d ON m.t = d.id "
    fromwhere += "WHERE MBRContains(ST_GeomFromText('" + params['bounds'] + "'), l.latlong) AND d.datetime BETWEEN '" + params['minDate'] + "' AND '" + params['maxDate'] + "'"
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
    with open(filename_with_path, 'w') as csvfile:
        writer = csv.DictWriter(csvfile, fieldnames=["lat", "lng", "datetime", "height"])
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
    fromwhere = getQueryForParams(params)
    query = "SELECT ST_Y(l.latlong) AS lat, ST_X(l.latlong) AS lng, {}, DATE_FORMAT(d.datetime, '%Y-%m-%d %H:%i:%s') AS datetime{}".format(params["var"], fromwhere)
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
        workers=8,
        worker_class="geventwebsocket.gunicorn.workers.GeventWebSocketWorker",
        timeout=3600,
        capture_output=True
    )