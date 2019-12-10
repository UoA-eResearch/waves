#!/usr/bin/env python3
import scipy.io
import sys

for f in sys.argv[1:]:
    w = scipy.io.whosmat(f)
    t = [x[0][5:] for x in w if x[0].startswith("Time")]
    print(t[0], t[-1])

