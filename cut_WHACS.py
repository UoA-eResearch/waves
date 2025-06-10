#!/usr/bin/env python3

import xarray as xr
from glob import glob
import pandas as pd
from tqdm.contrib.concurrent import process_map
import os

files = pd.Series(glob("WHACS/000064350v001/data/release/WP3/WHACS/BoM-CSIRO/hindcast/ERA5/ERA5/WHACS/WWIII-v6.07/global/1hr/t01/*.nc"))
output_folder = "WHACS/t01_NZ/"
os.makedirs(output_folder, exist_ok=True)

def process_file(f):
  output_file = output_folder + os.path.basename(f)
  if os.path.isfile(output_file) and os.path.getsize(output_file) > 100:
    print(f"File {output_file} already exists, skipping.")
    return
  ds = xr.open_dataset(f)
  NZ_points = ds.longitude.to_pandas().between(165, 180) & ds.latitude.to_pandas().between(-48, -33)
  NZ_points = NZ_points[NZ_points].index
  ds.sel(seapoint=NZ_points).to_netcdf(output_file)

process_map(process_file, files, max_workers=8)