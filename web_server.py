#!/usr/bin/env python

import scipy.io
import numpy as np
from bottle import Bottle, run, request, response, abort, static_file
import json
import os
import csv
from zipfile import ZipFile, ZIP_DEFLATED
from datetime import datetime, timedelta

app = Bottle()

mat_cache = []

valid_keys = json.load(open("file_types_and_keys.json"))
latlongs = json.load(open("latlongs.json"))
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
        "latlongs": latlongs
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
        year = dt.strftime("%y") # 2 digit year
        dt_string = dt.strftime("%Y%m%d_%H%M%S")
        mat = None
        for m in mat_cache:
            if m["year"] == year and m["ftype"] == ftype:
                mat = m
                break
        if not mat:
            nimat = None
            simat = None
            for f in files:
                if f.startswith("NI-" + year) and f.endswith(ftype + ".mat"):
                    print("loading " + f)
                    nimat = scipy.io.loadmat("data/" + f)
                if f.startswith("SI-" + year) and f.endswith(ftype + ".mat"):
                    print("loading " + f)
                    simat = scipy.io.loadmat("data/" + f)
            if len(mat_cache) > 5:
                mat_cache.pop()
            if not nimat or not simat:
                abort(500, "Mat for {}_{}_{} not found!".format(ftype, var, dt_string))
            mat = {
                "year": year,
                "ftype": ftype,
                "nimat": nimat,
                "simat": simat
            }
            mat_cache.insert(0, mat)
        key = "{}_{}".format(var, dt_string)
        nimat = mat["nimat"][key]
        simat = mat["simat"][key]
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

run(app, host='localhost', port=8082)

