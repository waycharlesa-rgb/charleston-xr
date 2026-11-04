// OpenStreetMap streets and footpaths for downtown Charleston.
// Used by scripts/fetch-osm.mjs (at build time, on GitHub's servers) and by the
// game as a fallback if the baked file is missing. Map data © OpenStreetMap
// contributors, available under the Open Database License.

export const BBOX = { south: 32.7640, west: - 79.9460, north: 32.7950, east: - 79.9180 };

const TYPES = [
	'trunk', 'trunk_link', 'primary', 'primary_link', 'secondary', 'secondary_link',
	'tertiary', 'tertiary_link', 'unclassified', 'residential', 'living_street',
	'pedestrian', 'footway', 'path',
];

export const QUERY = `[out:json][timeout:120];
way["highway"~"^(${ TYPES.join( '|' ) })$"](${ BBOX.south },${ BBOX.west },${ BBOX.north },${ BBOX.east });
(._;>;);
out body qt;`;

export const ENDPOINTS = [
	'https://overpass-api.de/api/interpreter',
	'https://overpass.kumi.systems/api/interpreter',
	'https://overpass.private.coffee/api/interpreter',
];

// Turn an Overpass response into a compact graph:
// { nodes: [[lat, lon], ...], ways: [{ t, o, n: [nodeIndex...], l }] }
export function processOverpass( json ) {

	const coords = new Map();
	const ways = [];
	for ( const el of json.elements ) {

		if ( el.type === 'node' ) coords.set( el.id, [ el.lat, el.lon ] );

	}

	const index = new Map();
	const nodes = [];
	for ( const el of json.elements ) {

		if ( el.type !== 'way' || ! el.tags ) continue;
		const tg = el.tags;
		if ( tg.area === 'yes' || tg.access === 'private' || tg.access === 'no' ) continue;
		if ( tg.footway === 'crossing' ) continue;
		const n = [];
		for ( const id of el.nodes ) {

			const c = coords.get( id );
			if ( ! c ) continue;
			if ( ! index.has( id ) ) {

				index.set( id, nodes.length );
				nodes.push( [ + c[ 0 ].toFixed( 6 ), + c[ 1 ].toFixed( 6 ) ] );

			}

			n.push( index.get( id ) );

		}

		if ( n.length < 2 ) continue;
		const ow = tg.oneway;
		const o = ow === 'yes' || ow === 'true' || ow === '1' ? 1 : ow === '-1' ? - 1 : 0;
		const w = { t: tg.highway, o, n };
		if ( tg.lanes ) w.l = parseInt( tg.lanes, 10 ) || undefined;
		if ( tg.name ) w.name = tg.name;
		ways.push( w );

	}

	return {
		attribution: '© OpenStreetMap contributors (ODbL)',
		bbox: BBOX,
		fetched: new Date().toISOString(),
		nodes,
		ways,
	};

}

export async function fetchOverpass( fetchImpl = fetch, headers = {} ) {

	let lastError = null;
	for ( const url of ENDPOINTS ) {

		try {

			const res = await fetchImpl( url, {
				method: 'POST',
				headers: { 'Content-Type': 'application/x-www-form-urlencoded', ...headers },
				body: 'data=' + encodeURIComponent( QUERY ),
			} );
			if ( ! res.ok ) throw new Error( `${ url } answered ${ res.status }` );
			return processOverpass( await res.json() );

		} catch ( e ) {

			lastError = e;

		}

	}

	throw lastError;

}
