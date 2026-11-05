// Downloads freely licensed reference photos of the modelled cars from
// Wikimedia Commons into reference/<car>/, with credits in credits.json.
// Run by .github/workflows/reference-photos.yml; the photos go to a separate
// branch and are only used to shape the models, never shipped with the game.
import { mkdirSync, writeFileSync } from 'node:fs';

const UA = 'charleston-xr-reference/0.1 (https://github.com/waycharlesa-rgb/charleston-xr)';
const API = 'https://commons.wikimedia.org/w/api.php';

const CARS = {
	rangerover: {
		categories: [ 'Category:Range Rover (L460)', 'Category:Range Rover L460' ],
		searches: [ 'Range Rover L460', 'Range Rover 2022 side', 'Range Rover 2023 rear' ],
	},
	escalade: {
		categories: [ 'Category:Cadillac Escalade (fifth generation)', 'Category:Cadillac Escalade (GMT T1XX)', 'Category:2021 Cadillac Escalade' ],
		searches: [ 'Cadillac Escalade 2021', 'Cadillac Escalade 2022', 'Cadillac Escalade fifth generation side', 'Cadillac Escalade 2021 rear' ],
	},
};

async function api( params ) {

	const url = API + '?' + new URLSearchParams( { format: 'json', formatversion: '2', origin: '*', ...params } );
	const res = await fetch( url, { headers: { 'User-Agent': UA } } );
	if ( ! res.ok ) throw new Error( `${ res.status } for ${ url }` );
	return res.json();

}

async function titlesFor( car ) {

	const titles = new Set();
	for ( const cat of car.categories ) {

		try {

			const j = await api( { action: 'query', list: 'categorymembers', cmtitle: cat, cmtype: 'file', cmlimit: '60' } );
			for ( const m of j.query?.categorymembers || [] ) titles.add( m.title );

		} catch ( e ) {

			console.warn( 'category failed', cat, e.message );

		}

	}

	for ( const q of car.searches ) {

		try {

			const j = await api( { action: 'query', list: 'search', srsearch: q, srnamespace: '6', srlimit: '25' } );
			for ( const m of j.query?.search || [] ) titles.add( m.title );

		} catch ( e ) {

			console.warn( 'search failed', q, e.message );

		}

	}

	return [ ...titles ].filter( t => /\.(jpe?g|png|webp)$/i.test( t ) ).slice( 0, 60 );

}

for ( const [ name, car ] of Object.entries( CARS ) ) {

	const dir = `reference/${ name }`;
	mkdirSync( dir, { recursive: true } );
	const titles = await titlesFor( car );
	console.log( name, titles.length, 'candidate files' );
	const credits = [];
	for ( let i = 0; i < titles.length; i += 20 ) {

		const batch = titles.slice( i, i + 20 );
		const j = await api( { action: 'query', titles: batch.join( '|' ), prop: 'imageinfo', iiprop: 'url|extmetadata|size', iiurlwidth: '1280' } );
		for ( const page of j.query?.pages || [] ) {

			const info = page.imageinfo?.[ 0 ];
			if ( ! info ) continue;
			const src = info.thumburl || info.url;
			const file = String( credits.length ).padStart( 2, '0' ) + '.jpg';
			try {

				const res = await fetch( src, { headers: { 'User-Agent': UA } } );
				if ( ! res.ok ) throw new Error( res.status );
				writeFileSync( `${ dir }/${ file }`, Buffer.from( await res.arrayBuffer() ) );
				const meta = info.extmetadata || {};
				credits.push( {
					file, title: page.title, source: info.descriptionurl,
					author: ( meta.Artist?.value || '' ).replace( /<[^>]+>/g, '' ).trim(),
					license: meta.LicenseShortName?.value || '',
					description: ( meta.ImageDescription?.value || '' ).replace( /<[^>]+>/g, '' ).trim().slice( 0, 200 ),
				} );
				await new Promise( r => setTimeout( r, 250 ) ); // be polite to Commons

			} catch ( e ) {

				console.warn( 'download failed', page.title, e.message );

			}

		}

	}

	writeFileSync( `${ dir }/credits.json`, JSON.stringify( credits, null, 1 ) );
	console.log( name, 'saved', credits.length );

}
