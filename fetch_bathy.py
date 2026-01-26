#!/usr/bin/env python3
"""
Seals Data Tile Fetcher - Pre-downloads COG and NOAA hillshade tiles for local serving.

Usage:
  python scripts/fetch_bathy.py [mode]

Modes:
  all (default) - Download both COG and NOAA tiles
  cog          - Download only COG tiles
  noaa         - Download only NOAA tiles
  manifest     - Generate manifest only (no downloads)
  list         - Print all URLs and paths (no downloads)
"""

import asyncio
import aiohttp
import json
import math
import sys
from pathlib import Path
from typing import List, Dict, Tuple
from tqdm.asyncio import tqdm_asyncio
import argparse
import mercantile

# ==============================================================================
# CONFIGURATION - Change these values to fetch different tile sets
# ==============================================================================

# Origin point (lat, lon)
ORIGIN = (-48.50, -56.000)

# Tile zoom level
TILE_ZOOM = 8

# X offset range (relative to origin tile)
DX_MIN, DX_MAX = -6, 8

# Y offset range (relative to origin tile)
DY_MIN, DY_MAX = -8, 4

# Download settings
CONCURRENCY = 12
TIMEOUT_SECS = 20
RETRIES = 3

# Path configuration
MANIFEST_PATH = Path("static/seals-data.json")
CSV_PATH = Path("seals-data.csv")
COG_TILE_DIR = Path("static/tiles/cog_penguin")
NOAA_TILE_DIR = Path("static/tiles/noaa_penguin")

# URL templates
COG_URL_TEMPLATE = "https://cogserver-staging-myzvqet7ua-uw.a.run.app/get_rgb_tile/{z}/{x}/{y}.png?dataset=GlobalTopoBath.tif"
NOAA_WMS_TEMPLATE = (
    "https://gis.ngdc.noaa.gov/arcgis/services/DEM_mosaics/DEM_global_mosaic_hillshade/ImageServer/WMSServer"
    "?bbox={x1},{y1},{x2},{y2}"
    "&format=image/png"
    "&service=WMS"
    "&version=1.1.1"
    "&request=GetMap"
    "&srs=EPSG:3857"
    "&transparent=true"
    "&width=512"
    "&height=512"
    "&layers=DEM_global_mosaic_hillshade:ColorHillshade"
)

# ==============================================================================
# UTILITY FUNCTIONS
# ==============================================================================

def lat_long_to_web_mercator(lat: float, lon: float) -> Tuple[float, float]:
    """
    Convert lat/lon to Web Mercator (EPSG:3857) coordinates.
    """
    R = 6378137  # Earth's radius in meters
    x = R * lon * math.pi / 180
    sin_lat = math.sin(lat * math.pi / 180)
    y = R * math.log((1 + sin_lat) / (1 - sin_lat)) / 2
    return (x, y)


def compute_tile_manifest(origin: Tuple[float, float], zoom: int,
                          dx_min: int, dx_max: int,
                          dy_min: int, dy_max: int) -> List[Dict]:
    """
    Compute the manifest of all tiles to fetch based on origin and ranges.
    """
    lat, lon = origin
    
    # Get the tile containing the origin point
    initial_tile = mercantile.tile(lon, lat, zoom)
    initial_x, initial_y = initial_tile.x, initial_tile.y
    
    manifest = []
    
    for dx in range(dx_min, dx_max + 1):
        for dy in range(dy_min, dy_max + 1):
            x = initial_x + dx
            y = initial_y + dy
            
            # Get the bounding box for this tile
            tile = mercantile.Tile(x, y, zoom)
            bounds = mercantile.bounds(tile)
            
            # Convert bbox to Web Mercator (EPSG:3857)
            # bounds: LngLatBbox(west, south, east, north)
            x1, y1 = lat_long_to_web_mercator(bounds.south, bounds.west)
            x2, y2 = lat_long_to_web_mercator(bounds.north, bounds.east)
            
            # Construct URLs
            cog_url = COG_URL_TEMPLATE.format(z=zoom, x=x, y=y)
            noaa_url = NOAA_WMS_TEMPLATE.format(x1=x1, y1=y1, x2=x2, y2=y2)
            
            # Local paths (flat naming: Cogserver-X-Y.png, NOAA-X-Y.png)
            cog_local = COG_TILE_DIR / f"Cogserver-{x}-{y}.png"
            noaa_local = NOAA_TILE_DIR / f"NOAA-{x}-{y}.png"
            
            manifest.append({
                "z": zoom,
                "x": x,
                "y": y,
                "cogUrl": cog_url,
                "noaaUrl": noaa_url,
                "cogLocal": str(cog_local),
                "noaaLocal": str(noaa_local),
            })
    
    return manifest


def write_manifest(manifest: List[Dict], manifest_path: Path):
    """Write manifest to JSON file."""
    manifest_path.parent.mkdir(parents=True, exist_ok=True)
    with open(manifest_path, 'w') as f:
        json.dump(manifest, f, indent=2)
    print(f"✓ Manifest written to {manifest_path}")


def write_csv_manifest(manifest: List[Dict], csv_path: Path):
    """Write manifest to CSV file for easy inspection."""
    with open(csv_path, 'w') as f:
        f.write("z,x,y,cogUrl,noaaUrl,cogLocal,noaaLocal\n")
        for entry in manifest:
            f.write(f"{entry['z']},{entry['x']},{entry['y']},"
                   f"{entry['cogUrl']},{entry['noaaUrl']},"
                   f"{entry['cogLocal']},{entry['noaaLocal']}\n")
    print(f"✓ CSV manifest written to {csv_path}")


def should_download(path: Path, min_size: int = 100) -> bool:
    """Check if a file should be downloaded (doesn't exist or is too small)."""
    if not path.exists():
        return True
    return path.stat().st_size <= min_size


# ==============================================================================
# DOWNLOAD FUNCTIONS
# ==============================================================================

async def download_file_with_retry(session: aiohttp.ClientSession,
                                   url: str,
                                   output_path: Path,
                                   retries: int = RETRIES) -> bool:
    """
    Download a file with exponential backoff retry logic.
    Returns True on success, False on failure.
    """
    output_path.parent.mkdir(parents=True, exist_ok=True)
    
    for attempt in range(retries):
        try:
            timeout = aiohttp.ClientTimeout(total=TIMEOUT_SECS)
            async with session.get(url, timeout=timeout) as response:
                if response.status == 200:
                    content = await response.read()
                    with open(output_path, 'wb') as f:
                        f.write(content)
                    return True
                else:
                    if attempt == retries - 1:
                        print(f"\n✗ Failed to download {url}: HTTP {response.status}")
                        return False
        except asyncio.TimeoutError:
            if attempt == retries - 1:
                print(f"\n✗ Timeout downloading {url}")
                return False
        except Exception as e:
            if attempt == retries - 1:
                print(f"\n✗ Error downloading {url}: {e}")
                return False
        
        # Exponential backoff
        if attempt < retries - 1:
            await asyncio.sleep(2 ** attempt)
    
    return False


async def download_tiles(manifest: List[Dict], download_mode: str):
    """
    Download tiles based on the manifest and mode.
    """
    # Build download list
    download_tasks = []
    
    for entry in manifest:
        if download_mode in ['all', 'cog']:
            cog_path = Path(entry['cogLocal'])
            if should_download(cog_path):
                download_tasks.append({
                    'url': entry['cogUrl'],
                    'path': cog_path,
                    'type': 'COG'
                })
        
        if download_mode in ['all', 'noaa']:
            noaa_path = Path(entry['noaaLocal'])
            if should_download(noaa_path):
                download_tasks.append({
                    'url': entry['noaaUrl'],
                    'path': noaa_path,
                    'type': 'NOAA'
                })
    
    if not download_tasks:
        print("✓ All tiles already downloaded (skipping files > 100 bytes)")
        return True
    
    print(f"Downloading {len(download_tasks)} tiles...")
    
    # Create semaphore to limit concurrency
    semaphore = asyncio.Semaphore(CONCURRENCY)
    
    async def download_with_semaphore(task):
        async with semaphore:
            return await download_file_with_retry(session, task['url'], task['path'])
    
    # Download with progress bar
    connector = aiohttp.TCPConnector(limit=CONCURRENCY)
    async with aiohttp.ClientSession(connector=connector) as session:
        results = await tqdm_asyncio.gather(
            *[download_with_semaphore(task) for task in download_tasks],
            desc="Downloading tiles"
        )
    
    # Check for failures
    failures = [task for task, success in zip(download_tasks, results) if not success]
    
    if failures:
        print(f"\n✗ {len(failures)} tiles failed to download:")
        for task in failures[:10]:  # Show first 10 failures
            print(f"  - {task['url']}")
        if len(failures) > 10:
            print(f"  ... and {len(failures) - 10} more")
        return False
    
    print(f"✓ Successfully downloaded {len(download_tasks)} tiles")
    return True


# ==============================================================================
# CLI FUNCTIONS
# ==============================================================================

def print_tile_list(manifest: List[Dict], mode: str):
    """Print all tiles in the manifest."""
    print(f"Tile manifest ({len(manifest)} tiles):")
    print()
    
    for entry in manifest:
        if mode in ['all', 'cog']:
            print(f"COG:  {entry['cogUrl']}")
            print(f"  -> {entry['cogLocal']}")
        if mode in ['all', 'noaa']:
            print(f"NOAA: {entry['noaaUrl']}")
            print(f"  -> {entry['noaaLocal']}")
        print()


def print_summary(manifest: List[Dict]):
    """Print summary of the tile set."""
    if not manifest:
        print("Empty manifest")
        return
    
    z_values = set(e['z'] for e in manifest)
    x_values = [e['x'] for e in manifest]
    y_values = [e['y'] for e in manifest]
    
    print(f"\n{'='*60}")
    print("SUMMARY")
    print(f"{'='*60}")
    print(f"Origin:       {ORIGIN[0]:.6f}, {ORIGIN[1]:.6f} (lat, lon)")
    print(f"Zoom level:   {', '.join(map(str, sorted(z_values)))}")
    print(f"Total tiles:  {len(manifest)}")
    print(f"X range:      {min(x_values)} to {max(x_values)}")
    print(f"Y range:      {min(y_values)} to {max(y_values)}")
    print(f"COG tiles:    {COG_TILE_DIR}")
    print(f"NOAA tiles:   {NOAA_TILE_DIR}")
    print(f"Manifest:     {MANIFEST_PATH}")
    print(f"CSV export:   {CSV_PATH}")
    print(f"{'='*60}\n")


# ==============================================================================
# MAIN
# ==============================================================================

async def main():
    parser = argparse.ArgumentParser(
        description='Fetch seals data tiles for local serving',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__
    )
    parser.add_argument(
        'mode',
        nargs='?',
        default='all',
        choices=['all', 'cog', 'noaa', 'manifest', 'list'],
        help='Download mode (default: all)'
    )
    parser.add_argument(
        '--origin',
        type=str,
        help='Override origin as "lat,lon" (e.g., "36.708,-121.902")'
    )
    parser.add_argument(
        '--zoom',
        type=int,
        help='Override tile zoom level (e.g., 11)'
    )
    
    args = parser.parse_args()
    
    # Override config if specified
    origin = ORIGIN
    zoom = TILE_ZOOM
    
    if args.origin:
        try:
            lat, lon = map(float, args.origin.split(','))
            origin = (lat, lon)
        except ValueError:
            print("✗ Invalid origin format. Use: lat,lon (e.g., 36.708,-121.902)")
            sys.exit(1)
    
    if args.zoom:
        zoom = args.zoom
    
    # Generate manifest
    print(f"Generating tile manifest...")
    manifest = compute_tile_manifest(origin, zoom, DX_MIN, DX_MAX, DY_MIN, DY_MAX)
    
    # Write manifest
    write_manifest(manifest, MANIFEST_PATH)
    write_csv_manifest(manifest, CSV_PATH)
    
    print_summary(manifest)
    
    # Handle modes
    mode = args.mode
    
    if mode == 'list':
        print_tile_list(manifest, 'all')
        return
    
    if mode == 'manifest':
        print("✓ Manifest generated. Run with 'all', 'cog', or 'noaa' to download tiles.")
        return
    
    # Download tiles
    success = await download_tiles(manifest, mode)
    
    if not success:
        print("\n✗ Some tiles failed to download. Check errors above.")
        sys.exit(1)
    
    print("\n✓ All tiles downloaded successfully!")
    print(f"\nTo use these tiles, ensure your dev server serves the 'static/' directory at '/'.")
    print(f"With your Vite config, this should work automatically.")


if __name__ == '__main__':
    asyncio.run(main())

