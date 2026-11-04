# Charleston XR

A walkable, photorealistic downtown Charleston, SC for the Samsung Galaxy XR (or any WebXR headset), built on Google's Photorealistic 3D Tiles. This is the base for a story game.

## What works now

- Real-scale downtown streamed from Google's 3D city scans
- Eight landmarks to start from or jump between: the Battery, White Point Garden, Rainbow Row, Waterfront Park, Four Corners of Law, City Market, King Street, Marion Square
- Walking with ground following, steps and curbs, and sliding along walls
- Hand tracking, controllers, or keyboard and mouse
- **Flying**: two quick left-hand pinches (or B/Y, or F) to take off, then fly where you look. A comfort vignette dims the edges of your view at speed
- **Vehicles**: turn your left palm up for a menu, then summon a car or a horse-drawn carriage (it rises out of the street through a transmutation circle and you climb in), or sail a boat from the nearest stretch of harbor. Steer by holding your hands like a wheel and tilting them; right pinch to go, left to brake. The boat sails by real wind rules: the breeze is from the southwest and you can't point within about 40° of it
- **Alchemy**: clap to charge your hands, then touch the ground for a wave of stone spikes, push forward to burst stone from the ground or a wall you're looking at, or raise both hands to ride a pillar 12 m up. The pavement ripples, blue arcs crackle, and the stone takes the colour of the surface it came from. Creations sink back after a few minutes
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

### Test mode

Add `?offline` to the address to swap Charleston for a plain paved square. Everything except the photographed city works without an API key, which is handy for trying flight and alchemy on a computer.

## API key

Open the page and paste a Google Maps Platform key that has the **Map Tiles API** enabled. The key is saved in that browser's local storage only. It is never written into the code. Restrict the key in Google Cloud to the Map Tiles API and to the site's address.

## Files

| File | What it does |
|---|---|
| `src/main.js` | Scene, tile streaming, movement, headset input, menus |
| `src/places.js` | Landmark coordinates. Adjust these if a spot lands you on a roof |
| `src/vehicles.js` | Car, carriage and sailboat: models, driving, sailing |
| `src/wristmenu.js` | The palm-up menu |
| `src/alchemy.js` | Clap detection, transmutations, arcs, ripple and stone |
| `src/audio.js` | Procedural harbor ambience and sound effects |
| `index.html` | Start menu and on-screen display |
| `build.mjs` | Bundles everything into `dist/` |
