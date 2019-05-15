#!/usr/bin/env python
import scipy.io
import json
import numpy as np
import csv

lloffshore = {}

with open('latlongs_offshore.csv') as csvfile:
    reader = csv.DictReader(csvfile)
    for r in reader:
      lat = round(float(r["lat"]), 6)
      lng = round(float(r["long"]), 6)
      if lat not in lloffshore:
        lloffshore[lat] = {}
      lloffshore[lat][lng] = r["offshore"]

def process_mat(mat):
    mat = np.where(np.isnan(mat), None, mat)
    mat = mat.tolist()
    return mat

nimat = scipy.io.loadmat("data/NI-100701_101231-DEPTH.mat")
simat = scipy.io.loadmat("data/SI-100701_101231-DEPTH.mat")

nishape = nimat["Yp"].shape
sishape = simat["Yp"].shape

for i in range(nishape[0]):
    for j in range(nishape[1]):
        lat = round(float(nimat["Yp"][i][j]), 6)
        lng = round(float(nimat["Xp"][i][j]), 6)
        if lloffshore[lat][lng] == "0":
          nimat["Depth_20100628_120000"][i][j] = None

for i in range(sishape[0]):
    for j in range(sishape[1]):
        lat = round(float(simat["Yp"][i][j]), 6)
        lng = round(float(simat["Xp"][i][j]), 6)
        if lloffshore[lat][lng] == "0":
          simat["Depth_20100628_120000"][i][j] = None

depths = {
  "ni": process_mat(nimat["Depth_20100628_120000"]),
  "si": process_mat(simat["Depth_20100628_120000"])
}

print(json.dumps(depths))
