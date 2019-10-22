#!/usr/bin/env python

import scipy.io
import sys
import numpy as np

for f in sys.argv[1:]:
    mat = scipy.io.loadmat(f)
    for k,v in mat.items():
        if k.startswith("__"):
            continue
        infs = np.isinf(v)
        if infs.any():
           print(f,k,np.where(infs))
