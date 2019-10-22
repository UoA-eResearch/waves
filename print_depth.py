#!/usr/bin/env python3
import scipy.io

nimat = scipy.io.loadmat("data/models/NI-930101_930630-DEPTH.mat")
simat = scipy.io.loadmat("data/models/SI-930101_930630-DEPTH.mat")

nishape = nimat["Yp"].shape
sishape = simat["Yp"].shape

print("island,i,j,lat,lon,depth")

for i in range(nishape[0]):
    for j in range(nishape[1]):
        lat = str(nimat["Yp"][i][j])
        lng = str(nimat["Xp"][i][j])
        depth = str(nimat["Depth_19930101_000000"][i][j])
        if depth == "nan":
          depth = 0
        print(f"NI,{i},{j},{lat},{lng},{depth}")

for i in range(sishape[0]):
    for j in range(sishape[1]):
        lat = str(simat["Yp"][i][j])
        lng = str(simat["Xp"][i][j])
        depth = str(simat["Depth_19930101_000000"][i][j])
        if depth == "nan":
          depth = 0
        print(f"SI,{i},{j},{lat},{lng},{depth}")
