#!/usr/bin/env python3

from fastapi import FastAPI, Response, HTTPException
from fastapi.responses import PlainTextResponse
from fastapi.middleware.cors import CORSMiddleware
import pandas as pd
import xarray as xr
from glob import glob
import pandas as pd
import time

s = time.time()
files = pd.Series(sorted(glob("WHACS/hs/*.nc")))

ds = xr.open_dataset(files[535])
NZ_points = ds.longitude.to_pandas().between(165, 180) & ds.latitude.to_pandas().between(-48, -33)
NZ_points = NZ_points[NZ_points].index

print(f"Found {len(NZ_points)} NZ points in the first file")
ds = xr.open_mfdataset(files)
ds = ds.isel(seapoint=list(NZ_points)).drop_vars("projected_coordinate_system")
print(f"Loaded dataset in {time.time() - s:.2f} seconds")

app = FastAPI(root_path="/WHACS_API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def get_var(minDate:str = "1994-02-01 01:00:00", maxDate:str = "1994-02-01 01:00:00", var:str = "hs", format:str = "json"):
    try:
        s = time.time()
        df = ds.sel(time=slice(minDate, maxDate)).to_dataframe()
        print(f"Subset data in {time.time() - s:.2f} seconds")
        if format == "json":
            return {"results": df.to_dict("records")}
        elif format == "csv":
            csv = df.to_csv(index=False)
            return PlainTextResponse(csv)
    except Exception as e:
        print(e)
        raise HTTPException(status_code=500, detail=str(e))