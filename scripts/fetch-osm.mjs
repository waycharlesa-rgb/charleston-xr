// Downloads downtown Charleston's streets and footpaths from OpenStreetMap and
// writes data/osm-downtown.json. Run by .github/workflows/osm-data.yml.
import { writeFileSync, mkdirSync } from 'node:fs';
import { fetchOverpass } from '../src/osm.js';

const data = await fetchOverpass( fetch, {
	'User-Agent': 'charleston-xr/0.1 (https://github.com/waycharlesa-rgb/charleston-xr)',
} );

mkdirSync( 'data', { recursive: true } );
writeFileSync( 'data/osm-downtown.json', JSON.stringify( data ) );

const counts = {};
for ( const w of data.ways ) counts[ w.t ] = ( counts[ w.t ] || 0 ) + 1;
console.log( `Saved ${ data.nodes.length } nodes and ${ data.ways.length } ways`, counts );
