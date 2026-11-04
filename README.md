# Charleston XR

A walkable, photorealistic downtown Charleston, SC for the Samsung Galaxy XR (or any WebXR headset), built on Google's Photorealistic 3D Tiles. This is the base for a story game.

## What works now

- Real-scale downtown streamed from Google's 3D city scans
- Eight landmarks to start from or jump between: the Battery, White Point Garden, Rainbow Row, Waterfront Park, Four Corners of Law, City Market, King Street, Marion Square
- Walking with ground following, steps and curbs, and sliding along walls
- Hand tracking, controllers, or keyboard and mouse
- Late-afternoon sky with haze, and synthesized harbor sound (waves, breeze, gulls)
- Google attribution on screen and in the headset

## Run it

```bash
cd charleston-xr
npm install
npm run build      # writes dist/
npm run serve      # http://localhost:8080
```

WebXR only runs on `https://` (or `localhost`), so to use it on the headset the `dist/` folder has to be hosted on an HTTPS site.

## API key

Open the page and paste a Google Maps Platform key that has the **Map Tiles API** enabled. The key is saved in that browser's local storage only. It is never written into the code. Restrict the key in Google Cloud to the Map Tiles API and to the site's address.

## Files

| File | What it does |
|---|---|
| `src/main.js` | Scene, tile streaming, movement, headset input, menus |
| `src/places.js` | Landmark coordinates. Adjust these if a spot lands you on a roof |
| `src/audio.js` | Procedural harbor ambience |
| `index.html` | Start menu and on-screen display |
| `build.mjs` | Bundles everything into `dist/` |
