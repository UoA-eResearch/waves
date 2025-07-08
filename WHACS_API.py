#!/usr/bin/env python3

from fastapi import FastAPI, Response, HTTPException
from fastapi.responses import PlainTextResponse
from fastapi.middleware.cors import CORSMiddleware
import pandas as pd
import xarray as xr
from glob import glob
import pandas as pd
import time
import os
import numpy as np

app = FastAPI(root_path="/WHACS_API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def get_var(minDate:str = "1994-02-01 01:00:00", maxDate:str = "1994-02-01 01:00:00", var:str = "hs", lat:float=None, lng:float=None, format:str = "json"):
    try:
        s = time.time()
        print(minDate, maxDate, var, format)
        months = pd.date_range(minDate[:7], maxDate[:7], freq="MS")
        print(months)
        dfs = []
        for month in months:
            filename = glob(f"WHACS/{var}_NZ/{var}_WHACS_hindcast_WHACS_ERA5_1hr_{month.year}{month.month:02d}*")[0]
            print(filename)
            if not os.path.isfile(filename):
                raise HTTPException(status_code=404, detail=f"File {filename} not found")
            with xr.open_dataset(filename) as ds:
                if lat is not None and lng is not None:
                    point = (ds.longitude.to_pandas() == lng) & (ds.latitude.to_pandas() == lat)
                    print(point[point])
                    ds = ds.sel(seapoint=point.idxmax())
                dfs.append(ds.drop_vars("projected_coordinate_system").sel(time=slice(minDate, maxDate)).to_dataframe().reset_index())
        df = pd.concat(dfs, ignore_index=True)
        print(f"Subset data in {time.time() - s:.2f} seconds")
        if format == "json":
            return {"results": df.replace({np.nan:None}).to_dict("records"), "count": len(df), "filename": os.path.basename(filename), "timing": f"{time.time() - s:.2f} seconds"}
        elif format == "csv":
            csv = df.to_csv(index=False)
            return PlainTextResponse(csv)
    except Exception as e:
        print(e)
        raise HTTPException(status_code=500, detail=str(e))