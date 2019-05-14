#!/usr/bin/env python
import scipy.io
import json
import numpy as np

def process_mat(mat):
    mat = np.where(np.isnan(mat), None, mat)
    mat = mat.tolist()
    return mat

nimat = scipy.io.loadmat("data/NI-100701_101231-DEPTH.mat")
simat = scipy.io.loadmat("data/SI-100701_101231-DEPTH.mat")

depths = {
  "ni": process_mat(nimat["Depth_20100628_120000"]),
  "si": process_mat(simat["Depth_20100628_120000"])
}

print(json.dumps(depths))
