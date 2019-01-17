#!/usr/bin/env python

import scipy.io
import sys
import json

results = {}
for f in sys.argv[1:]:
    mat = scipy.io.loadmat(f)
    keys = mat.keys()
    unique_keys = set()
    for key in keys:
        if key.startswith("__"):
            continue
        if "_" in key:
            key = key[:-16]
        unique_keys.add(key)
    ftype = f.split("-")[-1][:-4]
    results[ftype] = sorted(unique_keys)

print(json.dumps(results, indent=4))