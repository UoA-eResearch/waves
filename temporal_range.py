#!/usr/bin/env python3
import scipy.io
import sys
import pandas as pd

times = pd.date_range("1993-01-01", "2101-01-01", freq="3H")

def p(t):
    return pd.to_datetime(t, format="%Y%m%d_%H%M%S")

for f in sys.argv[1:]:
    w = scipy.io.whosmat(f)
    t = [x[0][5:] for x in w if x[0].startswith("Time")]
    print(t[0], t[-1], times.get_loc(p(t[0])), times.get_loc(p(t[-1])))
    print(t[20], times.get_loc(p(t[20])))

