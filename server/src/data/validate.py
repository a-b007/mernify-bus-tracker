#!/usr/bin/env python3
"""
Validation script for Bengaluru Bus Digital Twin data files.
Checks:
1. Every stop's coordinates are within Bengaluru bbox (12.7-13.2 lat, 77.3-77.9 lng)
2. Every route's stops exist in stops.json
3. Every bus references a valid route
4. offsetM increases monotonically per route
5. Every stop referenced by a route has that route in its routeIds
"""

import json
import os
import sys

DATA_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", "data"))

errors = []
warnings = []

print("=== STARTING DATA VALIDATION ===")
print(f"Data directory: {DATA_DIR}")

# 1. Load stops.json
stops_file = os.path.join(DATA_DIR, "stops.json")
if not os.path.exists(stops_file):
    print(f"ERROR: {stops_file} does not exist!")
    sys.exit(1)

with open(stops_file, "r", encoding="utf-8") as f:
    stops = json.load(f)

print(f"Loaded {len(stops)} stops.")

# Check bbox and required fields for stops
stop_ids = set()
LAT_MIN, LAT_MAX = 12.7, 13.2
LNG_MIN, LNG_MAX = 77.3, 77.9
ZONES = {"central", "north", "south", "east", "west", "southeast", "northeast", "northwest", "southwest"}

for stop in stops:
    s_id = stop.get("_id")
    if not s_id:
        errors.append("Stop missing _id")
        continue
    if s_id in stop_ids:
        errors.append(f"Duplicate stop _id: {s_id}")
    stop_ids.add(s_id)
    
    loc = stop.get("loc", {})
    if loc.get("type") != "Point":
        errors.append(f"Stop {s_id} loc.type is not 'Point'")
    coords = loc.get("coordinates", [])
    if len(coords) != 2:
        errors.append(f"Stop {s_id} coordinates invalid")
    else:
        lng, lat = coords
        if not (LAT_MIN <= lat <= LAT_MAX):
            errors.append(f"Stop {s_id} latitude {lat} outside bbox [{LAT_MIN}, {LAT_MAX}]")
        if not (LNG_MIN <= lng <= LNG_MAX):
            errors.append(f"Stop {s_id} longitude {lng} outside bbox [{LNG_MIN}, {LNG_MAX}]")
            
    zone = stop.get("zone")
    if zone not in ZONES:
        warnings.append(f"Stop {s_id} has non-standard zone '{zone}'")

stops_by_id = {s["_id"]: s for s in stops}

# 2. Load routes.json
routes_file = os.path.join(DATA_DIR, "routes.json")
if not os.path.exists(routes_file):
    print(f"ERROR: {routes_file} does not exist!")
    sys.exit(1)

with open(routes_file, "r", encoding="utf-8") as f:
    routes = json.load(f)

print(f"Loaded {len(routes)} routes.")

route_ids = set()
for route in routes:
    r_id = route.get("_id")
    if not r_id:
        errors.append("Route missing _id")
        continue
    if r_id in route_ids:
        errors.append(f"Duplicate route _id: {r_id}")
    route_ids.add(r_id)
    
    r_stops = route.get("stops", [])
    if len(r_stops) < 15 or len(r_stops) > 50:
        warnings.append(f"Route {r_id} has {len(r_stops)} stops (recommended 15-50)")
        
    last_offset = -1
    for idx, rs in enumerate(r_stops):
        s_id = rs.get("stopId")
        if s_id not in stops_by_id:
            errors.append(f"Route {r_id} references nonexistent stop {s_id}")
        else:
            # Check routeIds back-reference
            if r_id not in stops_by_id[s_id]["routeIds"]:
                errors.append(f"Stop {s_id} missing route {r_id} in routeIds")
                
        offset = rs.get("offsetM")
        if offset is None:
            errors.append(f"Route {r_id} stop #{idx} missing offsetM")
        elif offset <= last_offset:
            errors.append(f"Route {r_id} offsetM not monotonically increasing at stop #{idx} ({offset} <= {last_offset})")
        last_offset = offset if offset is not None else last_offset

# 3. Load buses.json
buses_file = os.path.join(DATA_DIR, "buses.json")
if not os.path.exists(buses_file):
    print(f"ERROR: {buses_file} does not exist!")
    sys.exit(1)

with open(buses_file, "r", encoding="utf-8") as f:
    buses = json.load(f)

print(f"Loaded {len(buses)} buses.")

bus_ids = set()
for bus in buses:
    b_id = bus.get("_id")
    if not b_id:
        errors.append("Bus missing _id")
        continue
    if b_id in bus_ids:
        errors.append(f"Duplicate bus _id: {b_id}")
    bus_ids.add(b_id)
    
    r_id = bus.get("routeId")
    if r_id not in route_ids:
        errors.append(f"Bus {b_id} references invalid routeId: {r_id}")

print("\n=== VALIDATION SUMMARY ===")
print(f"Total stops: {len(stops)} (expected ~2000)")
print(f"Total routes: {len(routes)} (expected 80)")
print(f"Total buses: {len(buses)} (expected 600)")
print(f"Total errors: {len(errors)}")
print(f"Total warnings: {len(warnings)}")

if errors:
    print("\nERRORS ENCOUNTERED:")
    for e in errors[:20]:
        print(f"  ❌ {e}")
    if len(errors) > 20:
        print(f"  ... and {len(errors) - 20} more errors")
    sys.exit(1)
else:
    print("\n✅ ALL VALIDATION CHECKS PASSED!")
    sys.exit(0)
