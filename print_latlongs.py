#!/usr/bin/env python
import scipy.io
import json

nimat = scipy.io.loadmat("data/NI-980101_980630-DIR.mat")
simat = scipy.io.loadmat("data/SI-980101_980630-DIR.mat")

latlongs = {
    "ni": {
        "lat": nimat["Yp"].tolist(),
        "lng": nimat["Xp"].tolist()
    },
    "si": {
        "lat": simat["Yp"].tolist(),
        "lng": simat["Xp"].tolist()
    }
}

print(json.dumps(latlongs))
