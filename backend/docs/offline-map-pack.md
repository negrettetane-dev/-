# Offline Vector Map Pack

The web application accepts a legal city-level `.pmtiles` vector package from the Mobility page.

## Browser flow

1. Open `/mobility` and download the city traffic snapshot.
2. Open the Offline panel and import the matching `.pmtiles` file.
3. Switch to the city offline map. The first import works from the selected file; subsequent browser sessions are served by `offline-map-sw.js` from Cache Storage.

## Required data contract

- The package must be licensed for offline redistribution.
- The package should use the OpenMapTiles source layer names: `water`, `landuse`, and `transportation`.
- The application renders road traffic, events, and POIs from its own cached snapshots above the vector base map.
- A package generated with different source layer names needs a matching MapLibre style before it can render correctly.

## Not allowed

Do not package AMap, Google Maps, or another provider's map tiles unless its offline distribution agreement explicitly permits it.
