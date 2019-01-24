#!/usr/bin/env python

import scipy.io
import numpy as np
from bottle import Bottle, run, request, response, abort
import json
import os

app = Bottle()

last_mat = {"name": "", "mat": None}

valid_keys = json.load(open("file_types_and_keys.json"))
latlongs = json.load(open("latlongs.json"))
files = os.listdir("data")
date_ranges = set()
for f in files:
    date_range = f.split("-")[1]
    date_ranges.add(date_range)
date_ranges = sorted(date_ranges)

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

@app.route('/')
def main():
    global last_mat
    island = request.params.get('island') or 'NI'
    ftype = request.params.get('file') or 'PTDIR'
    var = request.params.get('var') or 'Depth'
    dt = request.params.get('dt') or '19930101_000000'
    year = dt[2:4]
    mat = None
    if last_mat["name"].startswith(island + "-" + year) and last_mat["name"].endswith(ftype + ".mat"):
        print("using cached mat")
        mat = last_mat["mat"]
    else:
        for f in files:
            if f.startswith(island + "-" + year) and f.endswith(ftype + ".mat"):
                print("loading " + f)
                mat = scipy.io.loadmat("data/" + f)
                last_mat = {
                    "name": f,
                    "mat": mat
                }
    if not mat:
        abort(500, "Mat for {}_{}_{}_{} not found!".format(island, ftype, var, dt))
    else:
        key = "{}_{}".format(var, dt)
        results = mat[key]
        results = np.where(np.isnan(results), None, results)
        results = results.tolist()
        return {
            "results": results
        }

run(app, host='localhost', port=8081)

