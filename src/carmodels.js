// Car bodies built the way real car modellers start: a side profile, a plan
// view and a cross-section, swept into one smooth surface. Each type takes its
// overall dimensions (length, width, height, wheelbase, wheel size) from a
// best-selling real vehicle. No badges or logos.

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

// ---------------------------------------------------------------- the cars
// u runs along the car from the front bumper (0) to the rear (1). Heights and
// half-widths are in metres. Ranges mark where glass, lights and trim sit.

export const CAR_TYPES = {
	sedan: {
		label: 'Midsize sedan', basedOn: 'Toyota Camry (2018–2024)',
		L: 4.885, W: 1.84, H: 1.445, wheelbase: 2.825, frontOverhang: 0.98, wheelR: 0.335, tireW: 0.235, rimR: 0.225,
		top: [ [ 0, 0.62 ], [ 0.012, 0.70 ], [ 0.04, 0.76 ], [ 0.1, 0.82 ], [ 0.22, 0.895 ], [ 0.31, 0.945 ], [ 0.4, 1.22 ], [ 0.47, 1.39 ], [ 0.56, 1.445 ], [ 0.66, 1.415 ], [ 0.74, 1.29 ], [ 0.8, 1.075 ], [ 0.86, 1.01 ], [ 0.95, 0.985 ], [ 0.985, 0.93 ], [ 1, 0.8 ] ],
		belt: [ [ 0, 0.62 ], [ 0.31, 0.935 ], [ 0.8, 1.03 ], [ 1, 1.0 ] ],
		bottom: [ [ 0, 0.36 ], [ 0.03, 0.24 ], [ 0.1, 0.175 ], [ 0.9, 0.175 ], [ 0.97, 0.26 ], [ 1, 0.4 ] ],
		halfW: [ [ 0, 0.7 ], [ 0.02, 0.84 ], [ 0.08, 0.905 ], [ 0.2, 0.92 ], [ 0.5, 0.92 ], [ 0.85, 0.915 ], [ 0.95, 0.88 ], [ 0.99, 0.8 ], [ 1, 0.72 ] ],
		roofW: [ [ 0, 0.6 ], [ 0.3, 0.62 ], [ 0.56, 0.665 ], [ 0.8, 0.62 ], [ 1, 0.6 ] ],
		windshield: [ 0.318, 0.465 ], rearGlass: [ 0.665, 0.795 ], sideGlass: [ 0.338, 0.705 ], pillars: [ [ 0.522, 0.545 ] ],
		head: { u: [ 0.004, 0.075 ], y: [ 0.62, 0.74 ], x: [ 0.42, 0.92 ] },
		tail: { u: [ 0.94, 1 ], y: [ 0.83, 0.97 ], x: [ 0.36, 0.95 ] },
		grille: { u: [ 0, 0.025 ], y: [ 0.34, 0.6 ], x: 0.56, chrome: false },
		eye: { x: - 0.37, y: 1.17, u: 0.535 }, maxFwd: 27, steerMax: 0.6,
	},
	suv: {
		label: 'Compact SUV', basedOn: 'Honda CR-V (2017–2022)',
		L: 4.596, W: 1.855, H: 1.689, wheelbase: 2.66, frontOverhang: 0.93, wheelR: 0.355, tireW: 0.235, rimR: 0.23,
		top: [ [ 0, 0.7 ], [ 0.012, 0.82 ], [ 0.05, 0.92 ], [ 0.12, 1.0 ], [ 0.24, 1.06 ], [ 0.3, 1.1 ], [ 0.4, 1.48 ], [ 0.47, 1.64 ], [ 0.58, 1.689 ], [ 0.8, 1.67 ], [ 0.9, 1.6 ], [ 0.95, 1.42 ], [ 0.975, 1.15 ], [ 0.99, 1.0 ], [ 1, 0.85 ] ],
		belt: [ [ 0, 0.7 ], [ 0.3, 1.09 ], [ 0.85, 1.17 ], [ 1, 1.1 ] ],
		bottom: [ [ 0, 0.42 ], [ 0.04, 0.28 ], [ 0.12, 0.205 ], [ 0.9, 0.205 ], [ 0.97, 0.3 ], [ 1, 0.46 ] ],
		halfW: [ [ 0, 0.74 ], [ 0.02, 0.86 ], [ 0.08, 0.915 ], [ 0.2, 0.927 ], [ 0.8, 0.927 ], [ 0.95, 0.9 ], [ 0.99, 0.83 ], [ 1, 0.76 ] ],
		roofW: [ [ 0, 0.64 ], [ 0.4, 0.68 ], [ 0.7, 0.7 ], [ 0.95, 0.64 ], [ 1, 0.6 ] ], flare: 0.035,
		windshield: [ 0.305, 0.465 ], rearGlass: [ 0.89, 0.972 ], sideGlass: [ 0.325, 0.885 ], pillars: [ [ 0.515, 0.538 ], [ 0.745, 0.768 ] ],
		head: { u: [ 0.004, 0.07 ], y: [ 0.8, 0.92 ], x: [ 0.45, 0.93 ] },
		tail: { u: [ 0.955, 1 ], y: [ 1.0, 1.36 ], x: [ 0.55, 0.95 ] },
		grille: { u: [ 0, 0.025 ], y: [ 0.44, 0.78 ], x: 0.58, chrome: false },
		eye: { x: - 0.37, y: 1.36, u: 0.53 }, maxFwd: 26, steerMax: 0.58,
	},
	pickup: {
		label: 'Full-size pickup', basedOn: 'Ford F-150 SuperCrew (2015–2020)',
		L: 5.89, W: 2.03, H: 1.96, wheelbase: 3.683, frontOverhang: 0.97, wheelR: 0.4, tireW: 0.275, rimR: 0.255,
		cabLength: 3.45, // the swept body stops behind the cab; the bed is built separately
		top: [ [ 0, 1.08 ], [ 0.006, 1.15 ], [ 0.02, 1.2 ], [ 0.06, 1.215 ], [ 0.3, 1.235 ], [ 0.365, 1.255 ], [ 0.47, 1.68 ], [ 0.55, 1.92 ], [ 0.63, 1.96 ], [ 0.96, 1.955 ], [ 0.99, 1.92 ], [ 1, 1.85 ] ],
		belt: [ [ 0, 1.08 ], [ 0.365, 1.245 ], [ 1, 1.32 ] ],
		bottom: [ [ 0, 0.5 ], [ 0.015, 0.42 ], [ 0.06, 0.36 ], [ 1, 0.36 ] ],
		halfW: [ [ 0, 0.945 ], [ 0.015, 0.985 ], [ 0.04, 0.995 ], [ 1, 0.995 ] ], flare: 0.04,
		roofW: [ [ 0, 0.8 ], [ 1, 0.82 ] ],
		windshield: [ 0.37, 0.565 ], rearGlass: [ 2, 2 ], sideGlass: [ 0.395, 0.965 ], pillars: [ [ 0.675, 0.7 ] ],
		head: { u: [ 0.002, 0.04 ], y: [ 0.96, 1.15 ], x: [ 0.62, 0.98 ] },
		tail: null,
		grille: { u: [ 0, 0.03 ], y: [ 0.55, 1.1 ], x: 0.62, chrome: true },
		eye: { x: - 0.42, y: 1.66, u: 0.72 }, maxFwd: 24, steerMax: 0.55,
	},
	rangerover: {
		label: 'Range Rover', basedOn: 'Range Rover (L460, 2022–)',
		L: 5.052, W: 2.047, H: 1.87, wheelbase: 2.997, frontOverhang: 0.93, wheelR: 0.41, tireW: 0.285, rimR: 0.285,
		// flat clamshell hood, high level belt line, a roof that falls away slightly to the rear
		top: [ [ 0, 0.86 ], [ 0.008, 0.98 ], [ 0.03, 1.05 ], [ 0.1, 1.09 ], [ 0.25, 1.12 ], [ 0.29, 1.14 ], [ 0.37, 1.55 ], [ 0.43, 1.8 ], [ 0.5, 1.87 ], [ 0.75, 1.86 ], [ 0.92, 1.83 ], [ 0.955, 1.78 ], [ 0.975, 1.55 ], [ 0.99, 1.2 ], [ 1, 1.0 ] ],
		belt: [ [ 0, 0.86 ], [ 0.29, 1.13 ], [ 0.9, 1.18 ], [ 1, 1.15 ] ],
		bottom: [ [ 0, 0.48 ], [ 0.03, 0.34 ], [ 0.1, 0.25 ], [ 0.9, 0.25 ], [ 0.97, 0.34 ], [ 1, 0.5 ] ],
		halfW: [ [ 0, 0.86 ], [ 0.015, 0.97 ], [ 0.06, 1.015 ], [ 0.2, 1.023 ], [ 0.85, 1.023 ], [ 0.96, 1.0 ], [ 0.99, 0.94 ], [ 1, 0.88 ] ],
		roofW: [ [ 0, 0.78 ], [ 0.45, 0.82 ], [ 0.8, 0.82 ], [ 1, 0.78 ] ],
		windshield: [ 0.3, 0.44 ], rearGlass: [ 0.952, 0.99 ], sideGlass: [ 0.315, 0.9 ],
		pillars: [ [ 0.52, 0.545 ], [ 0.74, 0.76 ] ], // black B and C pillars; the D pillar stays body colour
		head: { u: [ 0.003, 0.05 ], y: [ 0.93, 1.02 ], x: [ 0.62, 0.99 ] },
		tail: { u: [ 0.97, 1 ], y: [ 1.0, 1.3 ], x: [ 0.8, 1.0 ] },
		blackout: [ { u: [ 0.985, 1 ], y: [ 1.06, 1.16 ], x: [ 0, 0.8 ] } ], // gloss band joining the taillights
		grille: { u: [ 0, 0.02 ], y: [ 0.62, 0.95 ], x: 0.5, chrome: false },
		roofBlack: true,
		eye: { x: - 0.4, y: 1.56, u: 0.5 }, maxFwd: 30, steerMax: 0.55,
	},
	escalade: {
		label: 'Escalade', basedOn: 'Cadillac Escalade (2021–)',
		L: 5.382, W: 2.06, H: 1.948, wheelbase: 3.071, frontOverhang: 1.0, wheelR: 0.417, tireW: 0.275, rimR: 0.28,
		// tall flat nose, long flat roof, a near-vertical back
		top: [ [ 0, 0.98 ], [ 0.006, 1.1 ], [ 0.02, 1.16 ], [ 0.08, 1.19 ], [ 0.27, 1.22 ], [ 0.31, 1.25 ], [ 0.4, 1.7 ], [ 0.46, 1.92 ], [ 0.53, 1.948 ], [ 0.9, 1.94 ], [ 0.96, 1.9 ], [ 0.985, 1.8 ], [ 0.995, 1.5 ], [ 1, 1.1 ] ],
		belt: [ [ 0, 0.98 ], [ 0.31, 1.22 ], [ 0.92, 1.27 ], [ 1, 1.25 ] ],
		bottom: [ [ 0, 0.5 ], [ 0.015, 0.4 ], [ 0.07, 0.3 ], [ 0.93, 0.3 ], [ 0.98, 0.38 ], [ 1, 0.52 ] ],
		halfW: [ [ 0, 0.93 ], [ 0.012, 1.0 ], [ 0.05, 1.025 ], [ 0.2, 1.03 ], [ 0.9, 1.03 ], [ 0.97, 1.02 ], [ 0.995, 0.98 ], [ 1, 0.94 ] ],
		roofW: [ [ 0, 0.82 ], [ 0.5, 0.86 ], [ 1, 0.84 ] ],
		windshield: [ 0.31, 0.465 ], rearGlass: [ 0.98, 1 ], sideGlass: [ 0.33, 0.95 ],
		pillars: [ [ 0.53, 0.555 ], [ 0.75, 0.775 ] ],
		// headlamps plus the vertical light bars that run down the front corners
		head: [ { u: [ 0.003, 0.05 ], y: [ 1.0, 1.1 ], x: [ 0.6, 0.98 ] }, { u: [ 0, 0.04 ], y: [ 0.62, 1.0 ], x: [ 0.9, 1.05 ] } ],
		// tall taillights up the rear corners
		tail: { u: [ 0.975, 1 ], y: [ 0.9, 1.75 ], x: [ 0.86, 1.05 ] },
		grille: { u: [ 0, 0.025 ], y: [ 0.55, 1.12 ], x: 0.6, chrome: true },
		beltChrome: true,
		eye: { x: - 0.42, y: 1.66, u: 0.5 }, maxFwd: 28, steerMax: 0.52,
	},
};

export const CAR_TYPE_KEYS = Object.keys( CAR_TYPES );

// ---------------------------------------------------------------- curves

// Monotone cubic interpolation through [u, value] points: smooth, no overshoot.
function curve( pts ) {

	const n = pts.length;
	const d = [], m = [];
	for ( let i = 0; i < n - 1; i ++ ) d.push( ( pts[ i + 1 ][ 1 ] - pts[ i ][ 1 ] ) / ( pts[ i + 1 ][ 0 ] - pts[ i ][ 0 ] ) );
	m[ 0 ] = d[ 0 ];
	m[ n - 1 ] = d[ n - 2 ];
	for ( let i = 1; i < n - 1; i ++ ) {

		if ( d[ i - 1 ] * d[ i ] <= 0 ) m[ i ] = 0;
		else {

			const h0 = pts[ i ][ 0 ] - pts[ i - 1 ][ 0 ], h1 = pts[ i + 1 ][ 0 ] - pts[ i ][ 0 ];
			m[ i ] = 3 * ( h0 + h1 ) / ( ( 2 * h1 + h0 ) / d[ i - 1 ] + ( h1 + 2 * h0 ) / d[ i ] );

		}

	}

	return u => {

		if ( u <= pts[ 0 ][ 0 ] ) return pts[ 0 ][ 1 ];
		if ( u >= pts[ n - 1 ][ 0 ] ) return pts[ n - 1 ][ 1 ];
		let i = 0;
		while ( u > pts[ i + 1 ][ 0 ] ) i ++;
		const h = pts[ i + 1 ][ 0 ] - pts[ i ][ 0 ], t = ( u - pts[ i ][ 0 ] ) / h;
		const t2 = t * t, t3 = t2 * t;
		return ( 2 * t3 - 3 * t2 + 1 ) * pts[ i ][ 1 ] + ( t3 - 2 * t2 + t ) * h * m[ i ] + ( - 2 * t3 + 3 * t2 ) * pts[ i + 1 ][ 1 ] + ( t3 - t2 ) * h * m[ i + 1 ];

	};

}

const inRange = ( v, r ) => r && v >= r[ 0 ] && v <= r[ 1 ];
const rects = r => ( ! r ? [] : Array.isArray( r ) ? r : [ r ] );
const inRect = ( r, u, y, x ) => inRange( u, r.u ) && inRange( y, r.y ) && inRange( x, r.x );

// ---------------------------------------------------------------- materials

export function carMaterials( { paint = 0x1f3b33, glassOpacity = 0.55 } = {} ) {

	const tm = { toneMapped: false };
	return {
		paint: new THREE.MeshPhysicalMaterial( { color: paint, metalness: 0.3, roughness: 0.38, clearcoat: 1, clearcoatRoughness: 0.06, envMapIntensity: 0.7, ...tm } ),
		glass: new THREE.MeshPhysicalMaterial( { color: 0x1a2329, roughness: 0.04, metalness: 0.1, envMapIntensity: 1.4, transparent: true, opacity: glassOpacity, side: THREE.DoubleSide, depthWrite: false, ...tm } ),
		trim: new THREE.MeshStandardMaterial( { color: 0x0d0e10, roughness: 0.45, ...tm } ),
		chrome: new THREE.MeshStandardMaterial( { color: 0xe4e6e8, roughness: 0.12, metalness: 1, ...tm } ),
		grille: new THREE.MeshStandardMaterial( { color: 0x101113, roughness: 0.55, metalness: 0.3, ...tm } ),
		head: new THREE.MeshPhysicalMaterial( { color: 0xdfe5ea, roughness: 0.08, metalness: 0.7, emissive: 0x2a2a28, ...tm } ),
		tail: new THREE.MeshPhysicalMaterial( { color: 0x8e1016, roughness: 0.18, emissive: 0x3a0306, clearcoat: 1, ...tm } ),
		rubber: new THREE.MeshStandardMaterial( { color: 0x151515, roughness: 0.9, ...tm } ),
		rim: new THREE.MeshStandardMaterial( { color: 0xc7cbd0, roughness: 0.25, metalness: 0.95, ...tm } ),
		dark: new THREE.MeshStandardMaterial( { color: 0x1b1c1e, roughness: 0.8, side: THREE.DoubleSide, ...tm } ),
		gloss: new THREE.MeshPhysicalMaterial( { color: 0x08090a, roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.04, ...tm } ),
		shadow: new THREE.MeshBasicMaterial( { map: shadowTexture(), color: 0x000000, transparent: true, opacity: 0.6, depthWrite: false, polygonOffset: true, polygonOffsetFactor: - 2, ...tm } ),
	};

}

let _shadowTex = null;
export function shadowTexture() {

	if ( _shadowTex ) return _shadowTex;
	const c = document.createElement( 'canvas' );
	c.width = c.height = 128;
	const g = c.getContext( '2d' );
	const grad = g.createRadialGradient( 64, 64, 10, 64, 64, 64 );
	grad.addColorStop( 0, 'rgba(255,255,255,1)' );
	grad.addColorStop( 0.55, 'rgba(255,255,255,0.75)' );
	grad.addColorStop( 1, 'rgba(255,255,255,0)' );
	g.fillStyle = grad;
	g.fillRect( 0, 0, 128, 128 );
	_shadowTex = new THREE.CanvasTexture( c );
	return _shadowTex;

}

// ---------------------------------------------------------------- the swept body

const K = 23; // points in each half cross-section
// band k lies between point k and k+1
const BAND = k => ( k <= 2 ? 'under' : k <= 11 ? 'side' : k === 12 ? 'belt' : k <= 16 ? 'window' : k === 17 ? 'rail' : 'roof' );

function section( yb, yt, belt, w, wr ) {

	const P = [];
	// underside to the lower edge of the sill
	P.push( [ 0, yb ], [ w * 0.6, yb ], [ w - 0.06, yb + 0.015 ], [ w - 0.01, yb + 0.07 ] );
	// body side up to the window line, with a slight bulge (9 points)
	const g = THREE.MathUtils.clamp( ( yt - belt - 0.12 ) / 0.18, 0, 1 ); // how much greenhouse there is here
	const ye = Math.min( belt, yt - 0.1 );
	const ys = yb + 0.12;
	const yTop = Math.max( ys + 0.01, ye );
	for ( let j = 0; j < 9; j ++ ) {

		const t = j / 8;
		P.push( [ w * ( 0.985 + Math.sin( Math.PI * t ) * 0.012 ), ys + ( yTop - ys ) * t ] );

	}

	// window side (or the hood's shoulder where there is no window)
	const topX = THREE.MathUtils.lerp( w - 0.06, wr, g );
	const x0 = w * 0.975;
	for ( let j = 1; j <= 5; j ++ ) {

		const t = j / 5;
		const e = g > 0.5 ? t : Math.sin( t * Math.PI / 2 );
		P.push( [ x0 + ( topX - x0 ) * e, yTop + ( yt - 0.04 - yTop ) * t ] );

	}

	// roof (or hood) edge and crown across to the centreline
	P.push( [ topX - 0.025, yt - 0.016 ], [ topX - 0.075, yt - 0.003 ] );
	for ( let j = 1; j <= 3; j ++ ) {

		const x = ( topX - 0.075 ) * ( 1 - j / 3 );
		P.push( [ x, yt + 0.01 * ( 1 - ( x / topX ) ** 2 ) - 0.003 ] );

	}

	return { P, g };

}

function sweptBody( def, length, mats, wheelsZ, S = 160 ) {

	const top = curve( def.top ), belt = curve( def.belt ), bottom = curve( def.bottom );
	const halfW = curve( def.halfW ), roofW = curve( def.roofW );
	const z0 = - def.L / 2;

	// grid of points: stations x (right half then mirrored left half)
	const stations = [];
	for ( let i = 0; i <= S; i ++ ) {

		const lin = i / S;
		const u = 0.5 * lin + 0.5 * ( 0.5 - 0.5 * Math.cos( Math.PI * lin ) ); // a little denser at the ends, where the shape turns
		const yt = top( u ), w = halfW( u );
		const { P, g } = section( bottom( u ), yt, belt( u ), w, Math.min( roofW( u ), w - 0.05 ) );
		stations.push( { u, z: z0 + u * length, P, g, belt: belt( u ), yt, w } );

	}

	// vertex grid with shared normals so the surface shades smoothly across materials
	const cols = 2 * K - 1; // right half k=0..K-1, then left half K-2..0 (mirrored)
	const pos = [];
	const col = ( k ) => ( k < K ? k : 2 * K - 2 - k );
	for ( const st of stations ) {

		for ( let c = 0; c < cols; c ++ ) {

			const [ x, y ] = st.P[ col( c ) ];
			pos.push( new THREE.Vector3( c < K ? x : - x, y, st.z ) );

		}

	}

	const nrm = pos.map( () => new THREE.Vector3() );
	const idx = ( i, c ) => i * cols + c;
	const quads = [];
	const _a = new THREE.Vector3(), _b = new THREE.Vector3();
	for ( let i = 0; i < S; i ++ ) {

		for ( let c = 0; c < cols - 1; c ++ ) {

			// keep outward winding on both halves
			const q = [ idx( i, c ), idx( i + 1, c ), idx( i + 1, c + 1 ), idx( i, c + 1 ) ];
			const fn = _a.subVectors( pos[ q[ 2 ] ], pos[ q[ 0 ] ] ).cross( _b.subVectors( pos[ q[ 3 ] ], pos[ q[ 1 ] ] ) ).clone();
			for ( const v of q ) nrm[ v ].add( fn );
			quads.push( { q, i, c } );

		}

	}

	for ( const n of nrm ) n.normalize();
	// the winding above faces inward on the right half; flip all at the end
	for ( const n of nrm ) n.negate();

	const out = new Map(); // material -> { p: [], n: [] }
	const emit = ( mat, ids ) => {

		if ( ! out.has( mat ) ) out.set( mat, { p: [], n: [] } );
		const o = out.get( mat );
		for ( const v of ids ) {

			o.p.push( pos[ v ].x, pos[ v ].y, pos[ v ].z );
			o.n.push( nrm[ v ].x, nrm[ v ].y, nrm[ v ].z );

		}

	};

	for ( const { q, i, c } of quads ) {

		const st = stations[ i ], st2 = stations[ i + 1 ];
		const u = ( st.u + st2.u ) / 2;
		const k = col( c ) < col( c + 1 ) ? col( c ) : col( c + 1 ); // lower index of the band
		const cx = ( pos[ q[ 0 ] ].x + pos[ q[ 2 ] ].x ) / 2, cy = ( pos[ q[ 0 ] ].y + pos[ q[ 2 ] ].y ) / 2, cz = ( pos[ q[ 0 ] ].z + pos[ q[ 2 ] ].z ) / 2;
		const ax = Math.abs( cx );

		const band = BAND( k );
		// wheel openings: leave holes in the body side
		if ( k >= 2 && k <= 12 && wheelsZ.some( wz => ( cz - wz ) ** 2 + ( cy - def.wheelR ) ** 2 < ( def.wheelR + 0.075 ) ** 2 ) ) continue;

		let mat = mats.paint;
		const greenhouse = ( st.g + st2.g ) / 2 > 0.5;
		const w = ( st.w + st2.w ) / 2;
		if ( band === 'under' ) mat = mats.dark;
		else if ( ( u < 0.06 || u > 0.94 ) && cy < Math.min( st.yt, st2.yt ) * 0.42 && ax < w - 0.12 ) mat = mats.trim; // lower bumper valance
		if ( inRange( u, def.grille.u ) && inRange( cy, def.grille.y ) && ax < def.grille.x ) mat = def.grille.chrome ? mats.chrome : mats.grille;
		if ( band !== 'roof' && rects( def.blackout ).some( r => inRect( r, u, cy, ax ) ) ) mat = mats.gloss;
		if ( band !== 'roof' && rects( def.head ).some( r => inRect( r, u, cy, ax ) ) ) mat = mats.head;
		if ( band !== 'roof' && rects( def.tail ).some( r => inRect( r, u, cy, ax ) ) ) mat = mats.tail;
		const aboveBelt = cy > ( st.belt + st2.belt ) / 2 - 0.02;
		if ( band === 'roof' && aboveBelt && ( inRange( u, def.windshield ) || inRange( u, def.rearGlass ) ) ) mat = mats.glass;
		else if ( def.roofBlack && greenhouse && ( band === 'roof' || band === 'rail' ) ) mat = mats.gloss; // contrast roof
		else if ( greenhouse ) {

			if ( band === 'belt' ) mat = def.beltChrome ? mats.chrome : mats.trim; // window seal along the belt line
			else if ( band === 'window' && inRange( u, def.sideGlass ) ) mat = def.pillars.some( r => inRange( u, r ) ) ? mats.trim : mats.glass;
			else if ( band === 'rail' && ( inRange( u, def.windshield ) || inRange( u, def.sideGlass ) ) ) mat = mats.trim; // pillars and drip rail

		}

		emit( mat, [ q[ 0 ], q[ 2 ], q[ 1 ], q[ 0 ], q[ 3 ], q[ 2 ] ] );

	}

	// close the ends
	for ( const [ i, flip ] of [ [ 0, false ], [ S, true ] ] ) {

		const st = stations[ i ];
		const center = new THREE.Vector3( 0, ( st.P[ 0 ][ 1 ] + st.yt ) / 2, st.z );
		const n = new THREE.Vector3( 0, 0, flip ? 1 : - 1 );
		for ( let c = 0; c < cols - 1; c ++ ) {

			const a = pos[ idx( i, c ) ], b = pos[ idx( i, c + 1 ) ];
			const cy = ( a.y + b.y ) / 2;
			let mat = cy < st.P[ 0 ][ 1 ] + 0.12 ? mats.trim : mats.paint;
			if ( def.grille && i === 0 && inRange( cy, def.grille.y ) ) mat = def.grille.chrome ? mats.chrome : mats.grille;
			if ( ! out.has( mat ) ) out.set( mat, { p: [], n: [] } );
			const o = out.get( mat );
			const tri = flip ? [ center, a, b ] : [ center, b, a ];
			for ( const v of tri ) {

				o.p.push( v.x, v.y, v.z );
				o.n.push( n.x, n.y, n.z );

			}

		}

	}

	const meshes = [];
	for ( const [ mat, { p, n } ] of out ) {

		const geo = new THREE.BufferGeometry();
		geo.setAttribute( 'position', new THREE.Float32BufferAttribute( p, 3 ) );
		geo.setAttribute( 'normal', new THREE.Float32BufferAttribute( n, 3 ) );
		meshes.push( new THREE.Mesh( geo, mat ) );

	}

	return { meshes, top, belt, halfW };

}

// ---------------------------------------------------------------- wheels

function wheelModel( def, mats ) {

	const R = def.wheelR, w = def.tireW, rr = def.rimR;
	const spin = new THREE.Group();
	// tire with rounded shoulders, turned around the X axis
	const prof = [ [ rr, - w / 2 ], [ R - 0.05, - w / 2 ], [ R - 0.012, - w / 2 + 0.028 ], [ R, - w / 2 + 0.07 ], [ R, w / 2 - 0.07 ], [ R - 0.012, w / 2 - 0.028 ], [ R - 0.05, w / 2 ], [ rr, w / 2 ] ]
		.map( ( [ r, y ] ) => new THREE.Vector2( r, y ) );
	spin.add( new THREE.Mesh( new THREE.LatheGeometry( prof, 32 ).rotateZ( Math.PI / 2 ), mats.rubber ) );
	// rim: barrel, outer lip, five spokes and a hub, with a brake disc behind
	spin.add( new THREE.Mesh( new THREE.CylinderGeometry( rr, rr, w * 0.82, 28, 1, true ).rotateZ( Math.PI / 2 ), mats.dark ) );
	const lip = new THREE.Mesh( new THREE.TorusGeometry( rr - 0.01, 0.014, 6, 32 ).rotateY( Math.PI / 2 ), mats.rim );
	lip.position.x = w * 0.4;
	spin.add( lip );
	const disc = new THREE.Mesh( new THREE.CylinderGeometry( rr * 0.8, rr * 0.8, 0.025, 24 ).rotateZ( Math.PI / 2 ), mats.grille );
	disc.position.x = - 0.02;
	spin.add( disc );
	for ( let i = 0; i < 5; i ++ ) {

		const s = new THREE.Mesh( new THREE.BoxGeometry( 0.035, rr * 0.92, 0.05 ), mats.rim );
		s.geometry.translate( 0, rr * 0.46, 0 );
		s.rotation.x = i / 5 * Math.PI * 2;
		s.position.x = w * 0.36;
		spin.add( s );

	}

	const hub = new THREE.Mesh( new THREE.CylinderGeometry( 0.055, 0.06, 0.05, 16 ).rotateZ( Math.PI / 2 ), mats.rim );
	hub.position.x = w * 0.38;
	spin.add( hub );
	return spin;

}

// ---------------------------------------------------------------- pickup bed

function pickupBed( def, mats, rearWheelZ ) {

	const g = new THREE.Group();
	const z0 = - def.L / 2 + def.cabLength + 0.04, z1 = def.L / 2 - 0.03;
	const hw = def.W / 2 - 0.02, yb = 0.55, yt = 1.3, R = def.wheelR + 0.075;
	// outer bed sides, as a grid so the wheel opening can be left open
	for ( const s of [ - 1, 1 ] ) {

		const p = [];
		const NZ = 40, NY = 10;
		for ( let i = 0; i < NZ; i ++ ) {

			for ( let j = 0; j < NY; j ++ ) {

				const za = z0 + ( z1 - z0 ) * i / NZ, zb = z0 + ( z1 - z0 ) * ( i + 1 ) / NZ;
				const ya = yb + ( yt - yb ) * j / NY, yc = yb + ( yt - yb ) * ( j + 1 ) / NY;
				const cz = ( za + zb ) / 2, cy = ( ya + yc ) / 2;
				if ( ( cz - rearWheelZ ) ** 2 + ( cy - def.wheelR ) ** 2 < R * R ) continue;
				const x = s * hw;
				const quad = s > 0 ? [ [ x, ya, za ], [ x, ya, zb ], [ x, yc, zb ], [ x, ya, za ], [ x, yc, zb ], [ x, yc, za ] ] : [ [ x, ya, za ], [ x, yc, zb ], [ x, ya, zb ], [ x, ya, za ], [ x, yc, za ], [ x, yc, zb ] ];
				for ( const v of quad ) p.push( ...v );

			}

		}

		const geo = new THREE.BufferGeometry();
		geo.setAttribute( 'position', new THREE.Float32BufferAttribute( p, 3 ) );
		geo.computeVertexNormals();
		g.add( new THREE.Mesh( geo, mats.paint ) );
		// inner wall and rail cap
		const inner = new THREE.Mesh( new THREE.BoxGeometry( 0.04, yt - 0.88, z1 - z0 ), mats.paint );
		inner.position.set( s * ( hw - 0.06 ), ( yt + 0.88 ) / 2, ( z0 + z1 ) / 2 );
		g.add( inner );
		const rail = new THREE.Mesh( new RoundedBoxGeometry( 0.1, 0.04, z1 - z0, 2, 0.015 ), mats.trim );
		rail.position.set( s * ( hw - 0.03 ), yt + 0.01, ( z0 + z1 ) / 2 );
		g.add( rail );
		// vertical taillight on the bed's rear corner
		const tl = new THREE.Mesh( new RoundedBoxGeometry( 0.12, 0.42, 0.04, 2, 0.015 ), mats.tail );
		tl.position.set( s * ( hw - 0.07 ), 1.05, z1 + 0.05 );
		g.add( tl );
		// wheel-well liner
		const liner = new THREE.Mesh( new THREE.CylinderGeometry( R, R, 0.3, 20, 1, true, 0, Math.PI ).rotateZ( Math.PI / 2 ), mats.dark );
		liner.position.set( s * ( hw - 0.16 ), def.wheelR, rearWheelZ );
		g.add( liner );

	}

	const floor = new THREE.Mesh( new THREE.BoxGeometry( def.W - 0.2, 0.05, z1 - z0 ), mats.dark );
	floor.position.set( 0, 0.88, ( z0 + z1 ) / 2 );
	g.add( floor );
	const bottomPan = new THREE.Mesh( new THREE.BoxGeometry( def.W - 0.06, 0.04, z1 - z0 ), mats.dark );
	bottomPan.position.set( 0, yb, ( z0 + z1 ) / 2 );
	g.add( bottomPan );
	const front = new THREE.Mesh( new THREE.BoxGeometry( def.W - 0.06, yt - yb, 0.05 ), mats.paint );
	front.position.set( 0, ( yt + yb ) / 2, z0 );
	g.add( front );
	const gate = new THREE.Mesh( new RoundedBoxGeometry( def.W - 0.04, yt - yb, 0.07, 2, 0.025 ), mats.paint );
	gate.position.set( 0, ( yt + yb ) / 2, z1 );
	g.add( gate );
	const bumper = new THREE.Mesh( new RoundedBoxGeometry( def.W - 0.02, 0.2, 0.2, 2, 0.05 ), mats.chrome );
	bumper.position.set( 0, 0.5, z1 + 0.09 );
	g.add( bumper );
	return g;

}

// ---------------------------------------------------------------- assembly

export function buildCarModel( typeKey, { paint, interior = false, glassOpacity, detail = 160 } = {} ) {

	const def = CAR_TYPES[ typeKey ];
	const mats = carMaterials( { paint, glassOpacity: glassOpacity ?? ( interior ? 0.28 : 0.55 ) } );
	const root = new THREE.Group();
	const body = new THREE.Group();
	root.add( body );

	const zF = - def.L / 2 + def.frontOverhang, zR = zF + def.wheelbase;
	const length = def.cabLength || def.L;
	const swept = sweptBody( def, length, mats, [ zF, zR ], detail );
	for ( const m of swept.meshes ) body.add( m );

	// inside of the shell, seen from the driver's seat
	if ( interior ) {

		// door cards, headliner and pillar trim: everything but the glass, seen from inside
		const inside = new THREE.MeshStandardMaterial( { color: 0x2b2a28, roughness: 0.85, side: THREE.BackSide, toneMapped: false } );
		const liner = new THREE.MeshStandardMaterial( { color: 0x9c968c, roughness: 0.95, side: THREE.BackSide, toneMapped: false } );
		for ( const m of swept.meshes ) {

			if ( m.material === mats.glass ) continue;
			body.add( new THREE.Mesh( m.geometry, m.material === mats.paint ? liner : inside ) );

		}

	}

	// wheel-well liners, so the openings don't show the inside of the body
	for ( const z of def.cabLength ? [ zF ] : [ zF, zR ] ) {

		for ( const s of [ - 1, 1 ] ) {

			const R = def.wheelR + 0.075;
			const liner = new THREE.Mesh( new THREE.CylinderGeometry( R, R, 0.34, 20, 1, true, 0, Math.PI ).rotateZ( Math.PI / 2 ), mats.dark );
			liner.position.set( s * ( swept.halfW( ( z + def.L / 2 ) / length ) - 0.17 ), def.wheelR, z );
			body.add( liner );

		}

	}

	// fender lips tidy the edge of each wheel opening
	for ( const z of [ zF, zR ] ) {

		const onBed = def.cabLength && z === zR;
		const u = ( z + def.L / 2 ) / length;
		const hw = onBed ? def.W / 2 - 0.02 : swept.halfW( u );
		for ( const s of [ - 1, 1 ] ) {

			const lip = new THREE.Mesh( new THREE.TorusGeometry( def.wheelR + 0.08, def.flare || 0.022, 6, 28, Math.PI ).rotateY( Math.PI / 2 ), def.flare ? mats.trim : mats.paint );
			lip.position.set( s * ( hw - 0.012 ), def.wheelR, z );
			body.add( lip );

		}

	}

	if ( def.cabLength ) {

		body.add( pickupBed( def, mats, zR ) );
		// rear cab window
		const yb = swept.belt( 1 ) + 0.06, yt = swept.top( 1 ) - 0.12;
		const win = new THREE.Mesh( new RoundedBoxGeometry( 1.32, yt - yb, 0.02, 2, 0.008 ), mats.glass );
		win.position.set( 0, ( yb + yt ) / 2, - def.L / 2 + def.cabLength + 0.008 );
		body.add( win );

	}

	// mirrors and door handles
	const uMirror = def.windshield[ 0 ] + 0.03;
	const zm = - def.L / 2 + uMirror * length, ym = swept.belt( uMirror ) + 0.06;
	for ( const s of [ - 1, 1 ] ) {

		const arm = new THREE.Mesh( new RoundedBoxGeometry( 0.14, 0.04, 0.06, 2, 0.015 ), mats.trim );
		arm.position.set( s * ( swept.halfW( uMirror ) + 0.02 ), ym, zm );
		body.add( arm );
		const head = new THREE.Mesh( new RoundedBoxGeometry( 0.1, 0.13, 0.17, 2, 0.04 ), mats.paint );
		head.position.set( s * ( swept.halfW( uMirror ) + 0.11 ), ym + 0.02, zm + 0.03 );
		body.add( head );
		for ( const u of [ 0.47, 0.64 ] ) {

			const uu = def.cabLength ? 0.55 + ( u - 0.47 ) * 1.5 : u;
			const handle = new THREE.Mesh( new RoundedBoxGeometry( 0.02, 0.03, 0.15, 2, 0.008 ), mats.chrome );
			handle.position.set( s * ( swept.halfW( uu ) - 0.0 ), swept.belt( uu ) - 0.09, - def.L / 2 + uu * length );
			body.add( handle );

		}

	}

	// wheels
	const wheels = [];
	const track = def.W / 2 - def.tireW / 2 - 0.05;
	for ( const [ x, z, front ] of [ [ - track, zF, true ], [ track, zF, true ], [ - track, zR, false ], [ track, zR, false ] ] ) {

		const pivot = new THREE.Group();
		pivot.position.set( x, def.wheelR, z );
		const spin = wheelModel( def, mats );
		if ( x < 0 ) spin.scale.x = - 1; // rim faces outward on both sides
		pivot.add( spin );
		root.add( pivot );
		wheels.push( { pivot, spin, front, radius: def.wheelR, local: new THREE.Vector3( x, 0, z ) } );

	}

	// soft shadow on the ground
	const shadow = new THREE.Mesh( new THREE.PlaneGeometry( def.W * 1.25, def.L * 1.12 ).rotateX( - Math.PI / 2 ), mats.shadow );
	shadow.position.y = 0.03;
	shadow.renderOrder = 1;
	root.add( shadow );

	const model = { root, body, wheels, def, mats, shadow };
	if ( interior ) addInterior( model, swept, length );
	return model;

}

function addInterior( model, swept, length ) {

	const { def, body } = model;
	const z0 = - def.L / 2;
	const leather = new THREE.MeshStandardMaterial( { color: 0x3a3330, roughness: 0.75, toneMapped: false } );
	const dash = new THREE.MeshStandardMaterial( { color: 0x161719, roughness: 0.7, toneMapped: false } );
	const uDash = def.windshield[ 0 ] + 0.04;
	const zDash = z0 + uDash * length + 0.12;
	const belt = swept.belt( def.eye.u );
	const hw = swept.halfW( def.eye.u ) - 0.1;
	const dashBox = new THREE.Mesh( new RoundedBoxGeometry( hw * 2, 0.22, 0.5, 3, 0.07 ), dash );
	dashBox.position.set( 0, belt - 0.16, zDash );
	body.add( dashBox );

	const zEye = z0 + def.eye.u * length;
	for ( const s of [ - 1, 1 ] ) {

		const seat = new THREE.Mesh( new RoundedBoxGeometry( 0.52, 0.14, 0.52, 3, 0.05 ), leather );
		seat.position.set( s * Math.abs( def.eye.x ), def.eye.y - 0.62, zEye + 0.12 );
		body.add( seat );
		const back = new THREE.Mesh( new RoundedBoxGeometry( 0.52, 0.66, 0.12, 3, 0.05 ), leather );
		back.position.set( s * Math.abs( def.eye.x ), def.eye.y - 0.25, zEye + 0.42 );
		back.rotation.x = - 0.16;
		body.add( back );

	}

	const wheel = new THREE.Group();
	// about 25° back from vertical, its rim a hand's width below your eye line
	wheel.position.set( def.eye.x, def.eye.y - 0.36, zDash + 0.34 );
	wheel.rotation.x = - 0.42;
	const spinWheel = new THREE.Group();
	spinWheel.add( new THREE.Mesh( new THREE.TorusGeometry( 0.19, 0.017, 10, 40 ), dash ) );
	spinWheel.add( new THREE.Mesh( new THREE.BoxGeometry( 0.34, 0.03, 0.025 ), dash ) );
	spinWheel.add( new THREE.Mesh( new THREE.CylinderGeometry( 0.055, 0.055, 0.05, 16 ).rotateX( Math.PI / 2 ), dash ) );
	wheel.add( spinWheel );
	body.add( wheel );

	// a speedometer screen in the dash, behind the wheel
	const c = document.createElement( 'canvas' );
	c.width = 512;
	c.height = 256;
	const tex = new THREE.CanvasTexture( c );
	tex.colorSpace = THREE.SRGBColorSpace;
	const screen = new THREE.Mesh( new THREE.PlaneGeometry( 0.2, 0.1 ), new THREE.MeshBasicMaterial( { map: tex, toneMapped: false } ) );
	screen.position.set( def.eye.x, belt - 0.03, zDash + 0.2 );
	screen.rotation.x = - 0.6;
	screen.userData.noInstance = true;
	body.add( screen );
	model.steering = spinWheel;
	model.display = {
		mesh: screen,
		draw( big, small, accent = '#a8d5d1' ) {

			const g = c.getContext( '2d' );
			g.fillStyle = '#0d1311';
			g.fillRect( 0, 0, 512, 256 );
			g.fillStyle = accent;
			g.font = '700 128px Karla, system-ui, sans-serif';
			g.textAlign = 'center';
			g.fillText( big, 256, 150 );
			g.fillStyle = '#c9d2cc';
			g.font = '500 50px Karla, system-ui, sans-serif';
			g.fillText( small, 256, 225 );
			tex.needsUpdate = true;

		},
	};

}
