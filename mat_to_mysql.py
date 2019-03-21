#!/usr/bin/env python

import scipy.io
import sys
import os
import pandas as pd
import mysql.connector

db = mysql.connector.connect(
  host="localhost",
  user="wave",
  passwd="wave",
  db="wave"
)
cur = db.cursor()

if sys.argv[1] == "date":
    # Build date table

    times = pd.date_range("1993-01-01", "2013-01-01", freq="3H")
    sql = "REPLACE INTO date (id, datetime) VALUES (%s, %s)"
    values = []
    for k, v in enumerate(times):
        values.append((k, str(v)))
    cur.executemany(sql, values)
    db.commit()
    print("date table built. {} rows inserted".format(cur.rowcount))

elif sys.argv[1] == "ll":
    nimat = scipy.io.loadmat("data/NI-930101_931231-PDIR.mat")
    simat = scipy.io.loadmat("data/SI-930101_931231-PDIR.mat")

    nishape = nimat["Yp"].shape
    sishape = simat["Yp"].shape
    sql = "REPLACE INTO latlong (island, x, y, latlong) VALUES (%s, %s, %s, POINT(%s, %s))"
    values = []
    for i in range(nishape[0]):
        for j in range(nishape[1]):
            lat = nimat["Yp"][i][j]
            lng = nimat["Xp"][i][j]
            values.append(("NI", i, j, float(lng), float(lat)))
    for i in range(sishape[0]):
        for j in range(sishape[1]):
            lat = simat["Yp"][i][j]
            lng = simat["Xp"][i][j]
            values.append(("SI", i, j, float(lng), float(lat)))
    cur.executemany(sql, values)
    db.commit()
    print("latlong table built. {} rows inserted".format(cur.rowcount))
