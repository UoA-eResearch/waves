#!/usr/bin/env python3

import os
import boto3
from tqdm import tqdm
from botocore.config import Config
import pandas as pd
import xarray as xr
from tqdm.contrib.concurrent import process_map
pd.set_option("display.max_colwidth", None)

s3 = boto3.client(
    "s3",
    aws_access_key_id="M9W9DXJKS5IZ3THLBEPT",
    aws_secret_access_key="sXCE+kb6fsC6cCG0HnHWyG62knWEXrkhUzBIk0Qk",
    endpoint_url="https://s3.data.csiro.au",
    config=Config(signature_version="s3v4")
)

paginator = s3.get_paginator("list_objects_v2")
pages = paginator.paginate(Bucket="dapprd", Prefix="000064350v001/data/release/WP3/WHACS/BoM-CSIRO/hindcast/ERA5/ERA5/WHACS/WWIII-v6.07/global/1hr/")

files = []
for page in pages:
  for obj in page.get("Contents", []):
    key = obj["Key"]
    if key.endswith(".nc"):
      files.append(key)

files = pd.DataFrame(files, columns=["file_path"])
files["variable"] = files["file_path"].str.extract(r"/1hr/(\w+)/")

have = [s.strip("_NZ") for s in os.listdir("WHACS")]
missing = set(files.variable.unique()) - set(have)
missing = sorted(list(missing))

def process_file(file_path):
  tmp_file_path = "/mnt/WHACS/" + os.path.basename(file_path)
  s3.download_file(Bucket="dapprd", Key=file_path, Filename=tmp_file_path)
  output_file = output_folder + os.path.basename(file_path)
  ds = xr.open_dataset(tmp_file_path)
  NZ_points = ds.longitude.to_pandas().between(165, 180) & ds.latitude.to_pandas().between(-48, -33)
  NZ_points = NZ_points[NZ_points].index
  ds.sel(seapoint=NZ_points).to_netcdf(output_file)
  os.remove(tmp_file_path)

for variable in tqdm(missing):
  output_folder = f"WHACS/{variable}_NZ/"
  os.makedirs(output_folder, exist_ok=True)
  subset = files[files.variable == variable]
  process_map(process_file, subset.file_path)
  print(f"Processed {variable}, saved to {output_folder}")

print("All files processed.")