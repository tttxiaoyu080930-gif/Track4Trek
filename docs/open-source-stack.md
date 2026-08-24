# Open geospatial stack decision

ArcGIS is not required for the first release. The project will use small, replaceable open components instead of a single commercial GIS platform.

## Selected MVP stack

- MapLibre GL JS for the interactive web map.
- OpenFreeMap for the OpenStreetMap-derived vector basemap.
- gpxjs for converting uploaded GPX tracks into GeoJSON.
- Turf.js for distance, sampling, segmentation, and other geometry operations.
- Open-Meteo Elevation API for global Copernicus GLO-90 elevation data.
- Open-Meteo Forecast API for hourly route weather.
- React, TypeScript, and Vite/vinext for the web application.
- Static/serverless hosting, with `siuyuk.xyz` as the public domain.

## Architecture rule

Map, elevation, weather, and analysis code must use separate adapters. This allows a public service to be replaced by self-hosted PMTiles, Open Topo Data, or another provider without rewriting the route-demand model.

## Important limits

- OpenFreeMap's public instance has no SLA. Keep the style URL configurable.
- Open-Meteo's free endpoint is for noncommercial use and has no uptime guarantee.
- The 90-metre elevation model can smooth narrow ridges and short steep climbs. Show a confidence note and compare embedded GPX elevation when available.
- Always display OpenStreetMap/OpenFreeMap and Copernicus/Open-Meteo attribution.

## Useful references

- https://maplibre.org/maplibre-gl-js/docs/
- https://openfreemap.org/
- https://github.com/Turfjs/turf
- https://github.com/We-Gold/gpxjs
- https://open-meteo.com/en/docs/elevation-api
- https://open-meteo.com/en/docs
- https://github.com/opengeos/geolibre-elevation-profile
- https://github.com/cfarnz/route-builder
