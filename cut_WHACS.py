#!/usr/bin/env python3

import os
import boto3
from tqdm import tqdm
from botocore.config import Config
import pandas as pd
import xarray as xr
from tqdm.contrib.concurrent import process_map
from glob import glob
pd.set_option("display.max_colwidth", None)
import re
import time

s3 = boto3.client(
    "s3",
    aws_access_key_id="I7194KQ9PPZDH0Q5JCQW",
    aws_secret_access_key="dikOS2q15n2N5rkp4GWPkuv6X50C7etZWShTZbds",
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
files["filename"] = files.file_path.apply(lambda x: os.path.basename(x))

have = pd.DataFrame(glob("WHACS/*_CI/*.nc"), columns=["file_path"])
have["filesize"] = have.file_path.apply(lambda x: os.path.getsize(x))
have["filename"] = have.file_path.apply(lambda x: os.path.basename(x))
have = have[have.filesize > 100]

print(files.filename.isin(have.filename).value_counts())
files = files[~files.filename.isin(have.filename)]
missing = files.variable.unique()
missing = sorted(list(missing))

def process_file(file_path):
  tmp_file_path = "/mnt/WHACS/" + os.path.basename(file_path)
  s3.download_file(Bucket="dapprd", Key=file_path, Filename=tmp_file_path)
  output_file = output_folder + os.path.basename(file_path)
  ds = xr.open_dataset(tmp_file_path)
  #NZ_points = ds.longitude.to_pandas().between(165, 180) & ds.latitude.to_pandas().between(-48, -33)
  #NZ_points = NZ_points[NZ_points].index
  CI_points = ds.longitude.to_pandas().between(-160.526733, -156.901245) & ds.latitude.to_pandas().between(-22.307520, -18.488075)
  CI_points = CI_points[CI_points].index
  #dt = re.search(r"_(\d+)-", os.path.basename(file_path)).group(1)
  #NZ_points = seapoint_lookup[dt]
  ds.sel(seapoint=CI_points).to_netcdf(output_file)
  os.remove(tmp_file_path)

for variable in tqdm(missing):
  output_folder = f"WHACS/{variable}_CI/"
  os.makedirs(output_folder, exist_ok=True)
  subset = files[files.variable == variable]
  process_map(process_file, subset.file_path)
  print(f"Processed {variable}, saved to {output_folder}")

print("All files processed.")
