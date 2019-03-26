#!/usr/bin/env python

import scipy.io
import sys
import os
import pandas as pd
import numpy as np
import mysql.connector
import config
from multiprocessing import Pool, cpu_count

files_to_process = sys.argv[1:]
times = pd.date_range("1993-01-01", "2013-01-01", freq="3H")

def init():
    global db, cur
    db = mysql.connector.connect(
        host="localhost",
        user="wave",
        passwd=config.passwd,
        db="wave"
    )
    cur = db.cursor()

def log(msg):
    print(pd.Timestamp.now().strftime("%Y-%m-%d %H:%M:%S") + ": " + msg)

if "date" in files_to_process:
    # Build date table
    files_to_process.remove("date")
    init()

    sql = """CREATE TABLE IF NOT EXISTS `date` (
                `id` smallint(5) UNSIGNED NOT NULL,
                `datetime` datetime NOT NULL,
                PRIMARY KEY (`id`)
                ) ENGINE=InnoDB DEFAULT CHARSET=latin1;"""
    cur.execute(sql)
    db.commit()

    sql = "REPLACE INTO date (id, datetime) VALUES (%s, %s)"
    values = []
    for k, v in enumerate(times):
        values.append((k, str(v)))
    cur.executemany(sql, values)
    db.commit()
    log("date table built. {} rows inserted".format(cur.rowcount))

if "ll" in files_to_process:
    files_to_process.remove("ll")
    init()

    sql = """CREATE TABLE IF NOT EXISTS `latlong` (
                `island` enum('NI','SI') NOT NULL,
                `x` tinyint(3) UNSIGNED NOT NULL,
                `y` tinyint(3) UNSIGNED NOT NULL,
                `latlong` point NOT NULL,
                PRIMARY KEY (`island`,`x`,`y`),
                KEY `island` (`island`)
                ) ENGINE=InnoDB DEFAULT CHARSET=latin1;"""
    cur.execute(sql)
    db.commit()

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
    log("latlong table built. {} rows inserted".format(cur.rowcount))

if "depth" in files_to_process:
    files_to_process.remove("depth")
    init()

    sql = """CREATE TABLE IF NOT EXISTS `depth` (
                `island` enum('NI','SI') NOT NULL,
                `x` tinyint(3) UNSIGNED NOT NULL,
                `y` tinyint(3) UNSIGNED NOT NULL,
                `depth` double NOT NULL,
                PRIMARY KEY (`island`,`x`,`y`)
                ) ENGINE=InnoDB DEFAULT CHARSET=latin1;"""
    cur.execute(sql)
    db.commit()
    nimat = scipy.io.loadmat("data/NI-930101_931231-PDIR.mat")
    simat = scipy.io.loadmat("data/SI-930101_931231-PDIR.mat")

    nishape = nimat["Yp"].shape
    sishape = simat["Yp"].shape
    sql = "REPLACE INTO depth (island, x, y, depth) VALUES (%s, %s, %s, %s)"
    values = []
    for i in range(nishape[0]):
        for j in range(nishape[1]):
            depth = nimat["Depth_19930101_000000"][i][j]
            if not np.isnan(depth):
                values.append(("NI", i, j, float(depth)))
    for i in range(sishape[0]):
        for j in range(sishape[1]):
            depth = simat["Depth_19930101_000000"][i][j]
            if not np.isnan(depth):
                values.append(("SI", i, j, float(depth)))
    cur.executemany(sql, values)
    db.commit()
    log("depth table built. {} rows inserted".format(cur.rowcount))

def load_file(args):
    i = args[0]
    f = args[1]
    log("loading {}/{}: {}".format(i, len(files_to_process), f))

    filename_without_ext = os.path.splitext(os.path.basename(f))[0]
    island, date_range, ftype = filename_without_ext.split("-")

    start, end = date_range.split("_")
    start = pd.to_datetime(start, yearfirst=True)
    end = pd.to_datetime(end, yearfirst=True)
    startid = times.get_loc(start)
    endid = times.get_loc(end)

    sql = "SELECT EXISTS(SELECT 1 FROM `{}` WHERE t={})".format(ftype, startid)
    try:
        cur.execute(sql)
        result = cur.fetchone()[0]
        # This file has already been inserted
        if result:
            log("Already done, skipping")
            return
    except:
        pass

    mat = scipy.io.loadmat(f)
    keys = mat.keys()
    unique_keys = set()
    for key in keys:
        if key.startswith("__"):
            continue
        if "_" in key:
            key = key[:-16]
        if key not in ["Xp", "Yp", "Depth", "Time"]:
            unique_keys.add(key)
    sql = """CREATE TABLE IF NOT EXISTS `{}` (
                `island` enum('NI','SI') NOT NULL,
                `x` tinyint(3) UNSIGNED NOT NULL,
                `y` tinyint(3) UNSIGNED NOT NULL,
                `t` smallint(5) UNSIGNED NOT NULL
          """.format(ftype)
    for var in unique_keys:
        sql += ",`{}` double DEFAULT NULL\n".format(var)
    sql += ") ENGINE=InnoDB DEFAULT CHARSET=latin1;"
    print(sql)
    cur.execute(sql)
    db.commit()

    sql = "REPLACE INTO `{}` (island, x, y, t, {}) VALUES (%s, %s, %s, %s, {})".format(
        ftype,
        ",".join(unique_keys),
        ",".join("%s" for k in unique_keys)
    )
    values = []

    shape = mat["Xp"].shape
    values = []
    for t in range(startid, endid + 1):
        date = times[t]
        dateStr = date.strftime("%Y%m%d_%H%M%S")
        for i in range(shape[0]):
            for j in range(shape[1]):
                thisRow = [island, i, j, t]
                for var in unique_keys:
                    key = var + "_" + dateStr
                    val = float(mat[key][i][j])
                    if np.isnan(val):
                        val = None
                    thisRow.append(val)
                values.append(thisRow)

    log("values prepared, commencing executemany")
    cur.executemany(sql, values)
    db.commit()

    log("{} done. {} rows inserted".format(filename_without_ext, cur.rowcount))


PROCESSES = cpu_count() / 2
p = Pool(processes=PROCESSES, initializer=init)
p.map(load_file, enumerate(files_to_process))