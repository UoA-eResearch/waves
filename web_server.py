#!/usr/bin/env python

import scipy.io
import numpy as np
from bottle import Bottle, run, request, response, abort, static_file
import json
import os
import csv
from zipfile import ZipFile, ZIP_DEFLATED
from datetime import datetime, timedelta
import psutil
import pandas as pd

MAX_MEMORY_PCT = 90

app = Bottle()

mat_cache = []

valid_keys = json.load(open("file_types_and_keys.json"))
latlongs = json.load(open("latlongs.json"))
depth = pd.read_csv("depth_filtered.csv")
files = os.listdir("data")
date_ranges = set()
for f in files:
    date_range = f.split("-")[1]
    date_ranges.add(date_range)
date_ranges = sorted([x for x in date_ranges if x[0] == "9"]) + sorted([x for x in date_ranges if x[0] != "9"])

@app.hook('after_request')
def enable_cors():
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Methods'] = 'PUT, GET, POST, DELETE, OPTIONS'
    response.headers['Access-Control-Allow-Headers'] = 'Origin, Accept, Content-Type, X-Requested-With, X-CSRF-Token'

@app.route('/ranges')
def ranges():
    return {
        "keys": valid_keys,
        "date_ranges": date_ranges,
        "latlongs": latlongs,
        "depth": depth
    }

@app.get('/exports/<filename>')
def serve_export(filename):
    print("request for " + filename)
    return static_file(filename, root='exports')

def process_mat(mat):
    mat = np.where(np.isnan(mat), None, mat)
    mat = mat.tolist()
    return mat

def writeCSV(filename, results):
    filename_with_path = os.path.join("exports", filename)
    with open(filename_with_path, 'w') as csvfile:
        writer = csv.DictWriter(csvfile, fieldnames=["island", "lat", "lng", "datetime", "value"])
        writer.writeheader()
        writer.writerows(results)
    zipfilename = filename_with_path.replace(".csv", ".zip")
    with ZipFile(zipfilename, "w", ZIP_DEFLATED) as zip:
        zip.write(filename_with_path, filename)
    os.remove(filename_with_path)
    return zipfilename

@app.route('/')
def main():
    global mat_cache
    ftype = request.params.get('file') or 'PTDIR'
    var = request.params.get('var') or 'Depth'
    start = request.params.get('start') or '19930101_000000'
    end = request.params.get('end') or '19930101_000000'
    nimask = request.params.get('nimask')
    simask = request.params.get('simask')
    resp_format = request.params.get('format') or 'json'
    startDT = datetime.strptime(start, "%Y%m%d_%H%M%S")
    endDT = datetime.strptime(end, "%Y%m%d_%H%M%S")
    dt = startDT
    results = []
    while dt <= endDT:
        nimat = None
        simat = None
        dt_string = dt.strftime("%Y%m%d_%H%M%S")
        ymd = dt.strftime("%y%m%d") # 2 digit year
        for m in mat_cache:
            if m["fstart"] <= ymd and m["fend"] >= ymd and m["ftype"] == ftype:
                if m["island"] == "NI":
                    nimat = m["mat"]
                elif m["island"] == "SI":
                    simat = m["mat"]
            if nimat and simat:
                break
        if not nimat or not simat:
            for f in files:
                date_range = f.split("-")[1]
                fstart, fend = date_range.split("_")
                if fstart <= ymd and fend >= ymd and f.endswith("-" + ftype + ".mat"):
                    if f.startswith("NI-"):
                        print("loading " + f)
                        nimat = scipy.io.loadmat("data/" + f)
                        mat = {
                            "fstart": fstart,
                            "fend": fend,
                            "ftype": ftype,
                            "island": "NI",
                            "mat": nimat
                        }
                        mat_cache.insert(0, mat)
                    if f.startswith("SI-"):
                        print("loading " + f)
                        simat = scipy.io.loadmat("data/" + f)
                        mat = {
                            "fstart": fstart,
                            "fend": fend,
                            "ftype": ftype,
                            "island": "SI",
                            "mat": simat
                        }
                        mat_cache.insert(0, mat)
            current_memory_usage_pct = psutil.virtual_memory().percent
            if current_memory_usage_pct > MAX_MEMORY_PCT:
                print("Memory usage {}% is over {}%! Popping {}-{} from cache".format(
                    current_memory_usage_pct, MAX_MEMORY_PCT, mat_cache[-1]["fstart"], mat_cache[-1]["ftype"]
                ))
                mat_cache.pop()
            if not mat:
                abort(500, "Mat for {}_{}_{} not found!".format(ftype, var, dt_string))
        key = "{}_{}".format(var, dt_string)
        nimat = nimat[key]
        simat = simat[key]
        if nimask != None and simask != None:
            nimask_list = json.loads(nimask)
            for pair in nimask_list:
                results.append({
                    "island": "ni",
                    "lat": latlongs["ni"]["lat"][pair[0]][pair[1]],
                    "lng": latlongs["ni"]["lng"][pair[0]][pair[1]],
                    "datetime": dt_string,
                    "value": float(nimat[pair[0], pair[1]])
                })
            simask_list = json.loads(simask)
            for pair in simask_list:
                results.append({
                    "island": "si",
                    "lat": latlongs["si"]["lat"][pair[0]][pair[1]],
                    "lng": latlongs["si"]["lng"][pair[0]][pair[1]],
                    "datetime": dt_string,
                    "value": float(simat[pair[0], pair[1]])
                })
        dt += timedelta(hours=3)

    if start != end:
        if resp_format == "csv":
            filename = "{}_{}_{}.csv".format(ftype, var, dt_string)
            zipfilename = writeCSV(filename, results)
            return {
                "url": zipfilename
            }
        else:
            return {
                "results": results
            }
    else:
        # Get entire matrix for a particular time
        nzmin = float(np.nanmin([np.nanmin(nimat), np.nanmin(simat)]))
        nzmax = float(np.nanmax([np.nanmax(nimat), np.nanmax(simat)]))
        print(nzmin, nzmax)
        return {
            "ni": process_mat(nimat),
            "si": process_mat(simat),
            "min": nzmin,
            "max": nzmax
        }

if __name__ == "__main__":
    app.run(
        host='localhost',
        port=8082,
        server='gunicorn',
        workers=8,
        worker_class="geventwebsocket.gunicorn.workers.GeventWebSocketWorker",
        timeout=3600,
        capture_output=True
    )
