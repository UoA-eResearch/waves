#!/usr/bin/env python

import scipy.io
import numpy as np
from bottle import Bottle, run, request, response, abort
import json
import os

app = Bottle()

mat_cache = []

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

def process_mat(mat):
    mat = np.where(np.isnan(mat), None, mat)
    mat = mat.tolist()
    return mat

@app.route('/')
def main():
    global mat_cache
    ftype = request.params.get('file') or 'PTDIR'
    var = request.params.get('var') or 'Depth'
    dt = request.params.get('dt') or '19930101_000000'
    year = dt[2:4]
    mat = None
    for m in mat_cache:
        if m["year"] == year and m["ftype"] == ftype:
            print("using cached mat")
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
        mat = {
            "year": year,
            "ftype": ftype,
            "nimat": nimat,
            "simat": simat
        }
        mat_cache.insert(0, mat)
    if not mat:
        abort(500, "Mat for {}_{}_{} not found!".format(ftype, var, dt))
    else:
        key = "{}_{}".format(var, dt)
        nimat = mat["nimat"][key]
        simat = mat["simat"][key]
        nzmin = float(np.nanmin([np.nanmin(nimat), np.nanmin(simat)]))
        nzmax = float(np.nanmax([np.nanmax(nimat), np.nanmax(simat)]))
        print(nzmin, nzmax)
        return {
            "ni": process_mat(nimat),
            "si": process_mat(simat),
            "min": nzmin,
            "max": nzmax
        }

run(app, host='localhost', port=8081)

