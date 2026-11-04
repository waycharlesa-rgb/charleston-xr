// Vehicles: a car, a horse-drawn tour carriage and a small sailboat.
// Models are built in code (no downloaded assets). Physics is arcade-style:
// grounded on the photographed city by raycasts, blocked by walls, parked cars
// and anything you've transmuted.

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const UP = new THREE.Vector3( 0, 1, 0 );
const DOWN = new THREE.Vector3( 0, - 1, 0 );

export const SPECS = {
	car: {
		label: 'Car', maxFwd: 26, maxRev: 6, accel: 5.5, brake: 11, drag: 0.06,
		steerMax: 0.6, wheelbase: 2.8, halfWidth: 0.9, halfLength: 2.35, climb: 0.35,
		eye: new THREE.Vector3( - 0.37, 1.12, 0.1 ), exit: new THREE.Vector3( - 2.1, 0, 0 ),
		spawnAhead: 5,
	},
	carriage: {
		label: 'Carriage', maxFwd: 6.5, maxRev: 1.2, accel: 1.1, brake: 3, drag: 0.12,
		steerMax: 0.42, wheelbase: 4.4, halfWidth: 1.0, halfLength: 4.5, climb: 0.3,
		eye: new THREE.Vector3( 0, 2.15, - 0.85 ), exit: new THREE.Vector3( - 2.3, 0, 0.4 ),
		spawnAhead: 7,
	},
	boat: {
		label: 'Sailboat', maxFwd: 6.5, halfWidth: 1.3, halfLength: 4.0,
		eye: new THREE.Vector3( 0.55, 1.75, 2.7 ), exit: new THREE.Vector3( - 2.6, 0, 1.0 ),
	},
};

// ---------------------------------------------------------------- model helpers

function rbox( w, h, d, r, mat ) {

	return new THREE.Mesh( new RoundedBoxGeometry( w, h, d, 3, Math.min( r, w / 2, h / 2, d / 2 ) * 0.999 ), mat );

}

function put( parent, mesh, x, y, z ) {

	mesh.position.set( x, y, z );
	parent.add( mesh );
	return mesh;

}

// A tapered cylinder running from a to b.
function limb( a, b, rA, rB, mat, seg = 12 ) {

	const dir = new THREE.Vector3().subVectors( b, a );
	const len = dir.length();
	const geo = new THREE.CylinderGeometry( rB, rA, len, seg );
	geo.translate( 0, len / 2, 0 );
	const m = new THREE.Mesh( geo, mat );
	m.position.copy( a );
	m.quaternion.setFromUnitVectors( UP, dir.normalize() );
	return m;

}

function quad( a, b, c, d, mat ) {

	const g = new THREE.BufferGeometry();
	g.setAttribute( 'position', new THREE.Float32BufferAttribute( [ ...a, ...b, ...c, ...a, ...c, ...d ], 3 ) );
	g.computeVertexNormals();
	return new THREE.Mesh( g, mat );

}

function std( color, roughness = 0.6, metalness = 0, extra = {} ) {

	return new THREE.MeshStandardMaterial( { color, roughness, metalness, toneMapped: false, ...extra } );

}

// A small screen built into each vehicle (speedometer, gait, wind).
function makeDisplay( wM, hM ) {

	const c = document.createElement( 'canvas' );
	c.width = 512;
	c.height = Math.round( 512 * hM / wM );
	const tex = new THREE.CanvasTexture( c );
	tex.colorSpace = THREE.SRGBColorSpace;
	const mesh = new THREE.Mesh( new THREE.PlaneGeometry( wM, hM ), new THREE.MeshBasicMaterial( { map: tex, toneMapped: false } ) );
	return {
		mesh,
		draw( big, small, accent = '#a8d5d1' ) {

			const g = c.getContext( '2d' );
			g.fillStyle = '#0d1311';
			g.fillRect( 0, 0, c.width, c.height );
			g.fillStyle = accent;
			g.font = `700 ${ Math.round( c.height * 0.5 ) }px Karla, system-ui, sans-serif`;
			g.textAlign = 'center';
			g.fillText( big, c.width / 2, c.height * 0.58 );
			g.fillStyle = '#c9d2cc';
			g.font = `500 ${ Math.round( c.height * 0.2 ) }px Karla, system-ui, sans-serif`;
			g.fillText( small, c.width / 2, c.height * 0.88 );
			tex.needsUpdate = true;

		},
	};

}

function wheel( radius, width, tireMat, rimMat, spokes = 0, spokeMat = rimMat ) {

	const spin = new THREE.Group();
	if ( spokes ) {

		// carriage wheel: rim, spokes and hub
		const rim = new THREE.Mesh( new THREE.TorusGeometry( radius - 0.03, 0.035, 8, 40 ), rimMat );
		rim.rotation.y = Math.PI / 2;
		spin.add( rim );
		for ( let i = 0; i < spokes; i ++ ) {

			const a = i / spokes * Math.PI * 2;
			const s = limb( new THREE.Vector3( 0, 0, 0 ), new THREE.Vector3( 0, Math.cos( a ) * ( radius - 0.04 ), Math.sin( a ) * ( radius - 0.04 ) ), 0.018, 0.014, spokeMat, 6 );
			spin.add( s );

		}

		const hub = new THREE.Mesh( new THREE.CylinderGeometry( 0.07, 0.07, width + 0.06, 12 ).rotateZ( Math.PI / 2 ), spokeMat );
		spin.add( hub );

	} else {

		const tire = new THREE.Mesh( new THREE.CylinderGeometry( radius, radius, width, 28 ).rotateZ( Math.PI / 2 ), tireMat );
		const rim = new THREE.Mesh( new THREE.CylinderGeometry( radius * 0.62, radius * 0.62, width + 0.01, 20 ).rotateZ( Math.PI / 2 ), rimMat );
		spin.add( tire, rim );
		for ( let i = 0; i < 5; i ++ ) {

			const a = i / 5 * Math.PI * 2;
			const sp = new THREE.Mesh( new THREE.BoxGeometry( width + 0.02, 0.035, radius * 1.1 ), tireMat );
			sp.rotation.x = a;
			spin.add( sp );

		}

	}

	return spin;

}

// ---------------------------------------------------------------- the car

const PAINTS = [ 0x1f3b33, 0x7fb6b3, 0xb5523f, 0xe9dfc8, 0x1b1d22, 0x6b1f2a ];
let paintIndex = 0;

function buildCar() {

	const root = new THREE.Group();
	const body = new THREE.Group();
	root.add( body );

	const paint = new THREE.MeshPhysicalMaterial( {
		color: PAINTS[ paintIndex ++ % PAINTS.length ], metalness: 0.45, roughness: 0.3,
		clearcoat: 1, clearcoatRoughness: 0.06, toneMapped: false,
	} );
	const trim = std( 0x121315, 0.7 );
	const chrome = std( 0xe2e2e2, 0.12, 1 );
	const leather = std( 0x8a5a3c, 0.7 );
	const headliner = std( 0xcfc8bb, 0.9, 0, { side: THREE.DoubleSide } );
	const rubber = std( 0x161616, 0.92 );
	const glass = new THREE.MeshPhysicalMaterial( {
		color: 0x9fb7c2, roughness: 0.05, metalness: 0, transparent: true, opacity: 0.22,
		side: THREE.DoubleSide, depthWrite: false, toneMapped: false,
	} );
	const lamp = new THREE.MeshBasicMaterial( { color: 0xfff4dc, toneMapped: false } );
	const tail = new THREE.MeshBasicMaterial( { color: 0xa3141b, toneMapped: false } );

	// body panels around an open cabin, so the view from the driver's seat works
	put( body, rbox( 1.84, 0.56, 1.36, 0.14, paint ), 0, 0.63, - 1.63 ); // nose and hood
	put( body, rbox( 1.84, 0.6, 1.06, 0.14, paint ), 0, 0.66, 1.78 ); // trunk
	for ( const s of [ - 1, 1 ] ) put( body, rbox( 0.1, 0.58, 2.3, 0.04, paint ), s * 0.87, 0.64, 0.12 ); // doors
	put( body, rbox( 1.72, 0.16, 2.3, 0.04, trim ), 0, 0.37, 0.12 ); // floor
	put( body, rbox( 1.86, 0.08, 4.6, 0.04, trim ), 0, 0.33, 0.02 ); // rocker and underbody

	// glasshouse: windshield, rear window and side windows (no glass across your lap)
	const yb = 0.92, yt = 1.4, zf = - 0.95, zfr = - 0.3, zrr = 1.0, zr = 1.3, hw = 0.82;
	put( body, quad( [ - hw, yb, zf ], [ hw, yb, zf ], [ hw, yt, zfr ], [ - hw, yt, zfr ], glass ), 0, 0, 0 );
	put( body, quad( [ hw, yb, zr ], [ - hw, yb, zr ], [ - hw, yt, zrr ], [ hw, yt, zrr ], glass ), 0, 0, 0 );
	for ( const s of [ - 1, 1 ] ) {

		const x = s * hw;
		put( body, quad( [ x, yb, zf ], [ x, yb, zr ], [ x, yt, zrr ], [ x, yt, zfr ], glass ), 0, 0, 0 );
		body.add( limb( new THREE.Vector3( x, yb, zf ), new THREE.Vector3( x, yt, zfr ), 0.035, 0.03, paint, 6 ) ); // A pillar
		body.add( limb( new THREE.Vector3( x, yb, 0.42 ), new THREE.Vector3( x, yt, 0.42 ), 0.035, 0.035, paint, 6 ) ); // B pillar
		body.add( limb( new THREE.Vector3( x, yb, zr ), new THREE.Vector3( x, yt, zrr ), 0.05, 0.04, paint, 6 ) ); // C pillar
		put( body, rbox( 0.06, 0.07, 0.12, 0.02, paint ), s * 0.97, 1.0, - 0.62 ); // mirror

	}

	put( body, rbox( 1.68, 0.06, 1.36, 0.03, paint ), 0, yt + 0.02, ( zfr + zrr ) / 2 ); // roof
	const liner = new THREE.Mesh( new THREE.PlaneGeometry( 1.6, 1.28 ).rotateX( Math.PI / 2 ), headliner );
	put( body, liner, 0, yt - 0.015, ( zfr + zrr ) / 2 );

	// interior
	put( body, rbox( 1.64, 0.24, 0.46, 0.06, trim ), 0, 0.86, - 0.78 ); // dashboard
	for ( const s of [ - 1, 1 ] ) {

		put( body, rbox( 0.5, 0.12, 0.5, 0.05, leather ), s * 0.37, 0.56, 0.2 );
		const back = put( body, rbox( 0.5, 0.62, 0.1, 0.05, leather ), s * 0.37, 0.86, 0.47 );
		back.rotation.x = - 0.15;

	}

	put( body, rbox( 1.42, 0.12, 0.45, 0.05, leather ), 0, 0.56, 1.02 );
	const rear = put( body, rbox( 1.42, 0.58, 0.1, 0.05, leather ), 0, 0.84, 1.27 );
	rear.rotation.x = - 0.15;

	const steering = new THREE.Group();
	steering.position.set( - 0.37, 0.99, - 0.5 );
	steering.rotation.x = - 1.1;
	steering.add( new THREE.Mesh( new THREE.TorusGeometry( 0.18, 0.017, 8, 36 ), trim ) );
	steering.add( new THREE.Mesh( new THREE.BoxGeometry( 0.34, 0.025, 0.02 ), trim ) );
	steering.add( new THREE.Mesh( new THREE.CylinderGeometry( 0.035, 0.035, 0.05, 12 ).rotateX( Math.PI / 2 ), chrome ) );
	const steerSpin = new THREE.Group();
	steerSpin.add( ...steering.children );
	steering.add( steerSpin );
	body.add( steering );
	body.add( limb( new THREE.Vector3( - 0.37, 0.8, - 0.78 ), new THREE.Vector3( - 0.37, 0.97, - 0.53 ), 0.025, 0.025, trim, 8 ) );

	const display = makeDisplay( 0.17, 0.085 );
	display.mesh.position.set( - 0.37, 0.995, - 0.66 );
	display.mesh.rotation.x = - 0.45;
	body.add( display.mesh );

	// front and back
	put( body, rbox( 1.92, 0.14, 0.14, 0.06, chrome ), 0, 0.4, - 2.32 );
	put( body, rbox( 1.92, 0.14, 0.14, 0.06, chrome ), 0, 0.42, 2.34 );
	put( body, rbox( 0.9, 0.2, 0.04, 0.02, trim ), 0, 0.63, - 2.31 );
	for ( const s of [ - 1, 1 ] ) {

		put( body, new THREE.Mesh( new THREE.CylinderGeometry( 0.09, 0.09, 0.04, 20 ).rotateX( Math.PI / 2 ), lamp ), s * 0.62, 0.68, - 2.31 );
		put( body, rbox( 0.36, 0.1, 0.03, 0.01, tail ), s * 0.65, 0.78, 2.32 );

	}

	// wheels
	const wheels = [];
	for ( const [ x, z, front ] of [ [ - 0.8, - 1.4, true ], [ 0.8, - 1.4, true ], [ - 0.8, 1.4, false ], [ 0.8, 1.4, false ] ] ) {

		const pivot = new THREE.Group();
		pivot.position.set( x, 0.34, z );
		const spin = wheel( 0.34, 0.24, rubber, chrome );
		pivot.add( spin );
		root.add( pivot );
		wheels.push( { pivot, spin, front, radius: 0.34, local: new THREE.Vector3( x, 0, z ) } );

	}

	return { root, body, wheels, steering: steerSpin, display };

}

// ---------------------------------------------------------------- the horse

function buildHorse() {

	const g = new THREE.Group();
	const coat = std( 0x6a3f25, 0.62 );
	const dark = std( 0x1c1410, 0.8 );
	const hoofMat = std( 0x2a2622, 0.5 );
	const harness = std( 0x15100d, 0.5 );
	const brass = std( 0xc8a24a, 0.3, 0.9 );
	const V = ( x, y, z ) => new THREE.Vector3( x, y, z );

	const torso = new THREE.Group();
	g.add( torso );
	const ell = ( sx, sy, sz, x, y, z, m = coat ) => {

		const e = new THREE.Mesh( new THREE.SphereGeometry( 1, 24, 16 ), m );
		e.scale.set( sx, sy, sz );
		e.position.set( x, y, z );
		torso.add( e );
		return e;

	};

	ell( 0.36, 0.4, 0.82, 0, 1.4, 0 ); // barrel
	ell( 0.34, 0.4, 0.4, 0, 1.43, - 0.62 ); // chest and shoulders
	ell( 0.37, 0.41, 0.42, 0, 1.47, 0.6 ); // hindquarters

	const neckHead = new THREE.Group();
	neckHead.position.set( 0, 1.6, - 0.82 );
	torso.add( neckHead );
	neckHead.add( limb( V( 0, 0, 0 ), V( 0, 0.55, - 0.42 ), 0.25, 0.14, coat, 16 ) ); // neck
	neckHead.add( limb( V( 0, 0.6, - 0.46 ), V( 0, 0.27, - 0.86 ), 0.14, 0.085, coat, 14 ) ); // head
	const muzzle = new THREE.Mesh( new THREE.SphereGeometry( 0.095, 14, 10 ), coat );
	muzzle.position.set( 0, 0.26, - 0.87 );
	neckHead.add( muzzle );
	for ( const s of [ - 1, 1 ] ) {

		const ear = new THREE.Mesh( new THREE.ConeGeometry( 0.035, 0.13, 8 ), coat );
		ear.position.set( s * 0.06, 0.72, - 0.47 );
		ear.rotation.z = - s * 0.2;
		neckHead.add( ear );
		const eye = new THREE.Mesh( new THREE.SphereGeometry( 0.022, 8, 6 ), dark );
		eye.position.set( s * 0.105, 0.52, - 0.6 );
		neckHead.add( eye );
		neckHead.add( limb( V( s * 0.11, 0.5, - 0.56 ), V( s * 0.09, 0.3, - 0.82 ), 0.012, 0.012, harness, 5 ) ); // bridle cheek strap

	}

	const mane = rbox( 0.06, 0.12, 0.6, 0.03, dark );
	mane.position.set( 0, 0.36, - 0.17 );
	mane.rotation.x = 0.66;
	neckHead.add( mane );

	// collar and saddle pad of the harness
	const collar = new THREE.Mesh( new THREE.TorusGeometry( 0.25, 0.05, 10, 24 ), harness );
	collar.position.set( 0, 1.72, - 0.85 );
	collar.rotation.x = - 0.6;
	collar.scale.set( 0.9, 1.2, 1 );
	torso.add( collar );
	const pad = rbox( 0.62, 0.06, 0.35, 0.03, harness );
	pad.position.set( 0, 1.79, - 0.1 );
	torso.add( pad );
	for ( const s of [ - 1, 1 ] ) {

		const stud = new THREE.Mesh( new THREE.SphereGeometry( 0.025, 8, 6 ), brass );
		stud.position.set( s * 0.24, 1.78, - 0.95 );
		torso.add( stud );

	}

	const tail = new THREE.Group();
	tail.position.set( 0, 1.62, 0.98 );
	tail.add( limb( V( 0, 0, 0 ), V( 0, - 0.75, 0.22 ), 0.05, 0.11, dark, 10 ) );
	torso.add( tail );

	const legs = [];
	// trot: diagonal pairs move together
	for ( const [ x, z, front, phase ] of [ [ - 0.19, - 0.62, true, 0 ], [ 0.19, - 0.62, true, Math.PI ], [ - 0.2, 0.62, false, Math.PI ], [ 0.2, 0.62, false, 0 ] ] ) {

		const hip = new THREE.Group();
		hip.position.set( x, 1.18, z );
		torso.add( hip );
		hip.add( limb( V( 0, 0.12, 0 ), V( 0, - 0.46, 0 ), front ? 0.1 : 0.12, 0.065, coat, 10 ) );
		const knee = new THREE.Group();
		knee.position.set( 0, - 0.46, 0 );
		hip.add( knee );
		knee.add( limb( V( 0, 0, 0 ), V( 0, - 0.56, 0 ), 0.05, 0.042, coat, 8 ) );
		const hoof = new THREE.Mesh( new THREE.CylinderGeometry( 0.055, 0.068, 0.09, 12 ), hoofMat );
		hoof.position.y = - 0.6;
		knee.add( hoof );
		legs.push( { hip, knee, front, phase } );

	}

	return { group: g, torso, neckHead, tail, legs, gait: 0, lastStep: 0 };

}

function animateHorse( h, speed, dt, onStep ) {

	const s = Math.abs( speed );
	h.gait += dt * ( s > 0.05 ? 2.4 + s * 1.15 : 0 );
	const amp = Math.min( 0.55, s * 0.16 );
	for ( const L of h.legs ) {

		const p = h.gait + L.phase;
		L.hip.rotation.x = Math.sin( p ) * amp * ( speed < 0 ? - 1 : 1 );
		const lift = Math.max( 0, Math.sin( p + 1.2 ) ) * amp * 1.6;
		L.knee.rotation.x = L.front ? lift : - lift;

	}

	h.torso.position.y = Math.abs( Math.sin( h.gait ) ) * amp * 0.06;
	h.neckHead.rotation.x = Math.sin( h.gait * 2 ) * amp * 0.08;
	h.tail.rotation.x = 0.15 + Math.sin( h.gait * 0.5 ) * 0.05;
	h.tail.rotation.z = Math.sin( performance.now() / 900 ) * 0.12;

	// hooves strike twice per stride in a trot
	const beat = Math.floor( h.gait / Math.PI );
	if ( s > 0.25 && beat !== h.lastStep ) onStep?.( s );
	h.lastStep = beat;

}

// ---------------------------------------------------------------- the carriage

function buildCarriage() {

	const root = new THREE.Group();
	const body = new THREE.Group();
	root.add( body );
	const wood = std( 0x5a3a24, 0.65 );
	const black = std( 0x141414, 0.45, 0.2 );
	const red = std( 0x7d1d1f, 0.5 );
	const canvas = std( 0xf1ece0, 0.95, 0, { side: THREE.DoubleSide } );
	const seat = std( 0x2d3a35, 0.8 );

	put( body, rbox( 1.72, 0.12, 3.5, 0.03, wood ), 0, 1.0, 0.45 ); // bed
	for ( const s of [ - 1, 1 ] ) put( body, rbox( 0.05, 0.3, 3.5, 0.02, black ), s * 0.86, 1.2, 0.45 ); // side rails
	for ( const z of [ 0.1, 0.9, 1.7 ] ) {

		put( body, rbox( 1.55, 0.08, 0.42, 0.03, seat ), 0, 1.4, z );
		const back = put( body, rbox( 1.55, 0.45, 0.06, 0.02, seat ), 0, 1.66, z + 0.22 );
		back.rotation.x = - 0.12;
		for ( const s of [ - 1, 1 ] ) put( body, rbox( 0.06, 0.34, 0.06, 0.01, black ), s * 0.7, 1.22, z );

	}

	// driver's box at the front, higher than the passenger benches
	put( body, rbox( 1.5, 0.45, 0.6, 0.04, black ), 0, 1.28, - 0.95 );
	put( body, rbox( 1.3, 0.09, 0.45, 0.03, seat ), 0, 1.55, - 0.88 );
	const dback = put( body, rbox( 1.3, 0.3, 0.05, 0.02, seat ), 0, 1.75, - 0.64 );
	dback.rotation.x = - 0.1;
	put( body, rbox( 1.4, 0.35, 0.05, 0.02, black ), 0, 1.25, - 1.45 ); // dashboard board

	// canopy
	put( body, rbox( 1.9, 0.05, 3.7, 0.02, canvas ), 0, 2.75, 0.4 );
	for ( const s of [ - 1, 1 ] ) put( body, new THREE.Mesh( new THREE.PlaneGeometry( 3.7, 0.12 ).rotateY( Math.PI / 2 ), canvas ), s * 0.95, 2.67, 0.4 );
	for ( const [ x, z ] of [ [ - 0.82, - 1.3 ], [ 0.82, - 1.3 ], [ - 0.82, 2.15 ], [ 0.82, 2.15 ] ] ) {

		body.add( limb( new THREE.Vector3( x, 1.05, z ), new THREE.Vector3( x, 2.73, z ), 0.025, 0.025, black, 8 ) );

	}

	// shafts out to the horse
	for ( const s of [ - 1, 1 ] ) body.add( limb( new THREE.Vector3( s * 0.48, 1.05, - 1.3 ), new THREE.Vector3( s * 0.42, 1.3, - 4.0 ), 0.035, 0.03, black, 8 ) );

	const display = makeDisplay( 0.3, 0.12 );
	display.mesh.position.set( 0, 1.33, - 1.42 );
	display.mesh.rotation.x = - 0.25;
	body.add( display.mesh );

	const wheels = [];
	for ( const [ x, z, r, front ] of [ [ - 0.98, - 0.75, 0.5, true ], [ 0.98, - 0.75, 0.5, true ], [ - 0.98, 1.7, 0.66, false ], [ 0.98, 1.7, 0.66, false ] ] ) {

		const pivot = new THREE.Group();
		pivot.position.set( x, r, z );
		const spin = wheel( r, 0.08, black, black, 12, red );
		pivot.add( spin );
		root.add( pivot );
		wheels.push( { pivot, spin, front, radius: r, local: new THREE.Vector3( x, 0, z ) } );

	}

	const horse = buildHorse();
	horse.group.position.set( 0, 0, - 4.6 );
	root.add( horse.group );

	return { root, body, wheels, horse, display };

}

// ---------------------------------------------------------------- the sailboat

function hullGeometry() {

	const L = 8, HB = 1.3, DEPTH = 0.75, STATIONS = 28, RING = 14;
	const pos = [], col = [], idx = [];
	const white = new THREE.Color( 0xf4f2ec ), stripe = new THREE.Color( 0x1d3557 ), bottom = new THREE.Color( 0x6e2a22 );
	const rings = [];

	for ( let i = 0; i <= STATIONS; i ++ ) {

		const t = i / STATIONS; // 0 bow .. 1 stern
		const z = - L / 2 + t * L;
		const b = HB * ( t < 0.55 ? Math.pow( Math.sin( t / 0.55 * Math.PI / 2 ), 0.7 ) : 1 - 0.22 * Math.pow( ( t - 0.55 ) / 0.45, 2 ) );
		const d = DEPTH * Math.pow( Math.sin( Math.PI * Math.min( 0.96, t * 0.9 + 0.08 ) ), 0.6 );
		const deck = 0.72 + 0.28 * Math.pow( 1 - t, 2 );
		const ring = [];
		const pts = [ [ - b * 0.97, deck ] ];
		for ( let k = 0; k <= RING; k ++ ) {

			const a = - Math.PI / 2 + Math.PI * k / RING;
			pts.push( [ b * Math.sin( a ), - d * Math.cos( a ) ] );

		}

		pts.push( [ b * 0.97, deck ] );
		for ( const [ x, y ] of pts ) {

			ring.push( pos.length / 3 );
			pos.push( x, y, z );
			const c = y > 0.1 ? white : y > - 0.04 ? stripe : bottom;
			col.push( c.r, c.g, c.b );

		}

		rings.push( { ring, deck, b, z } );

	}

	for ( let i = 0; i < STATIONS; i ++ ) {

		const A = rings[ i ].ring, B = rings[ i + 1 ].ring;
		for ( let k = 0; k < A.length - 1; k ++ ) idx.push( A[ k ], B[ k ], A[ k + 1 ], A[ k + 1 ], B[ k ], B[ k + 1 ] );

	}

	// transom
	const T = rings[ STATIONS ].ring;
	for ( let k = 1; k < T.length - 1; k ++ ) idx.push( T[ 0 ], T[ k ], T[ k + 1 ] );

	const g = new THREE.BufferGeometry();
	g.setAttribute( 'position', new THREE.Float32BufferAttribute( pos, 3 ) );
	g.setAttribute( 'color', new THREE.Float32BufferAttribute( col, 3 ) );
	g.setIndex( idx );
	g.computeVertexNormals();

	// teak deck across the top
	const dpos = [], didx = [];
	for ( const r of rings ) dpos.push( - r.b * 0.97, r.deck + 0.005, r.z, r.b * 0.97, r.deck + 0.005, r.z );
	for ( let i = 0; i < rings.length - 1; i ++ ) {

		const a = i * 2;
		didx.push( a, a + 1, a + 2, a + 1, a + 3, a + 2 );

	}

	const dg = new THREE.BufferGeometry();
	dg.setAttribute( 'position', new THREE.Float32BufferAttribute( dpos, 3 ) );
	dg.setIndex( didx );
	dg.computeVertexNormals();

	return { hull: g, deck: dg };

}

function sailGeometry( luff, foot, rows = 10, cols = 8 ) {

	// triangle with the luff on +Y and the foot along +Z, cambered in +X
	const pos = [], idx = [];
	for ( let r = 0; r <= rows; r ++ ) {

		const v = r / rows;
		for ( let c = 0; c <= cols; c ++ ) {

			const u = c / cols;
			const chord = foot * ( 1 - v );
			pos.push( 0, v * luff, u * chord );

		}

	}

	for ( let r = 0; r < rows; r ++ ) {

		for ( let c = 0; c < cols; c ++ ) {

			const a = r * ( cols + 1 ) + c, b = a + cols + 1;
			idx.push( a, b, a + 1, a + 1, b, b + 1 );

		}

	}

	const g = new THREE.BufferGeometry();
	g.setAttribute( 'position', new THREE.Float32BufferAttribute( pos, 3 ) );
	g.setIndex( idx );
	g.userData = { rows, cols, luff, foot, base: pos.slice() };
	g.computeVertexNormals();
	return g;

}

function setCamber( geo, amount ) {

	const { rows, cols, base } = geo.userData;
	const p = geo.attributes.position;
	for ( let r = 0; r <= rows; r ++ ) {

		const v = r / rows;
		for ( let c = 0; c <= cols; c ++ ) {

			const u = c / cols;
			const i = r * ( cols + 1 ) + c;
			p.setXYZ( i, amount * Math.sin( Math.PI * u ) * ( 1 - v * 0.5 ), base[ i * 3 + 1 ], base[ i * 3 + 2 ] );

		}

	}

	p.needsUpdate = true;
	geo.computeVertexNormals();

}

function buildBoat() {

	const root = new THREE.Group();
	const body = new THREE.Group();
	root.add( body );
	const { hull, deck } = hullGeometry();
	body.add( new THREE.Mesh( hull, new THREE.MeshPhysicalMaterial( { vertexColors: true, roughness: 0.25, clearcoat: 0.8, toneMapped: false } ) ) );
	body.add( new THREE.Mesh( deck, std( 0xa77b4f, 0.75 ) ) );

	const gel = std( 0xf2f0ea, 0.35 );
	const dark = std( 0x1c2226, 0.4 );
	const alu = std( 0xc9ced3, 0.3, 0.9 );
	const cushion = std( 0x284a5c, 0.85 );

	put( body, rbox( 1.55, 0.36, 2.3, 0.1, gel ), 0, 0.92, 0.0 ); // cabin top
	for ( const s of [ - 1, 1 ] ) put( body, rbox( 0.02, 0.1, 1.4, 0.02, dark ), s * 0.78, 0.96, 0.0 ); // portlights
	// cockpit coamings and benches
	for ( const s of [ - 1, 1 ] ) {

		put( body, rbox( 0.08, 0.3, 2.2, 0.03, gel ), s * 0.85, 0.85, 2.45 );
		put( body, rbox( 0.42, 0.12, 2.0, 0.04, cushion ), s * 0.58, 0.82, 2.5 );

	}

	put( body, rbox( 1.6, 0.3, 0.08, 0.03, gel ), 0, 0.85, 1.32 ); // bulkhead

	// mast and rigging
	const mastBase = new THREE.Vector3( 0, 0.75, - 0.9 );
	const masthead = new THREE.Vector3( 0, 11.2, - 0.9 );
	body.add( limb( mastBase, masthead, 0.065, 0.045, alu, 10 ) );
	const wire = new THREE.LineBasicMaterial( { color: 0x5c6670 } );
	const stays = [
		[ masthead, new THREE.Vector3( 0, 1.0, - 3.95 ) ],
		[ masthead, new THREE.Vector3( 0, 0.8, 3.95 ) ],
		[ masthead, new THREE.Vector3( - 1.2, 0.8, - 0.6 ) ],
		[ masthead, new THREE.Vector3( 1.2, 0.8, - 0.6 ) ],
	];
	for ( const [ a, b ] of stays ) body.add( new THREE.Line( new THREE.BufferGeometry().setFromPoints( [ a, b ] ), wire ) );
	for ( const s of [ - 1, 1 ] ) body.add( limb( new THREE.Vector3( s * 1.2, 0.8, 0.5 ), new THREE.Vector3( s * 1.2, 1.4, 3.6 ), 0.012, 0.012, alu, 6 ) ); // lifelines

	const sailMat = new THREE.MeshStandardMaterial( { color: 0xf7f5ef, roughness: 0.9, side: THREE.DoubleSide, toneMapped: false } );

	// mainsail on a swinging boom
	const boomPivot = new THREE.Group();
	boomPivot.position.set( 0, 1.65, - 0.9 );
	body.add( boomPivot );
	boomPivot.add( limb( new THREE.Vector3( 0, 0, 0 ), new THREE.Vector3( 0, 0, 3.6 ), 0.05, 0.045, alu, 8 ) );
	const mainGeo = sailGeometry( 9.3, 3.5 );
	const main = new THREE.Mesh( mainGeo, sailMat );
	main.position.y = 0.06;
	boomPivot.add( main );

	// jib on the forestay
	const forestayTack = new THREE.Vector3( 0, 1.0, - 3.95 );
	const jibOuter = new THREE.Group();
	jibOuter.position.copy( forestayTack );
	const stay = new THREE.Vector3().subVectors( masthead, forestayTack );
	jibOuter.rotation.x = Math.atan2( stay.z, stay.y );
	body.add( jibOuter );
	const jibInner = new THREE.Group();
	jibOuter.add( jibInner );
	const jibGeo = sailGeometry( stay.length() * 0.82, 2.6, 8, 6 );
	jibInner.add( new THREE.Mesh( jibGeo, sailMat ) );

	// wind indicator at the masthead: it points into the wind
	const windex = new THREE.Group();
	windex.position.copy( masthead ).add( new THREE.Vector3( 0, 0.15, 0 ) );
	windex.add( limb( new THREE.Vector3( 0, 0, 0.3 ), new THREE.Vector3( 0, 0, - 0.35 ), 0.012, 0.012, dark, 6 ) );
	const vane = new THREE.Mesh( new THREE.ConeGeometry( 0.08, 0.18, 3 ).rotateX( - Math.PI / 2 ), new THREE.MeshBasicMaterial( { color: 0xd23b2a, toneMapped: false } ) );
	vane.position.z = - 0.4;
	windex.add( vane );
	body.add( windex );

	// tiller
	const tiller = new THREE.Group();
	tiller.position.set( 0, 0.95, 3.85 );
	tiller.add( limb( new THREE.Vector3( 0, 0, 0 ), new THREE.Vector3( 0, 0.05, - 1.1 ), 0.03, 0.022, std( 0x8a5a2b, 0.5 ), 8 ) );
	body.add( tiller );

	const display = makeDisplay( 0.34, 0.16 );
	display.mesh.position.set( 0, 0.9, 1.37 );
	display.mesh.rotation.y = 0;
	body.add( display.mesh );

	return { root, body, boomPivot, main, mainGeo, jibInner, jibGeo, windex, tiller, display };

}

// ---------------------------------------------------------------- the system

export function createVehicles( { scene, castRay, castTerrain, audio, notify, flourish, haptics } ) {

	const group = new THREE.Group();
	group.name = 'vehicles';
	scene.add( group );

	const list = []; // at most one of each kind
	const _v = new THREE.Vector3();
	const _w = new THREE.Vector3();
	const _q = new THREE.Quaternion();

	function forwardOf( yaw, target = new THREE.Vector3() ) {

		return target.set( - Math.sin( yaw ), 0, - Math.cos( yaw ) );

	}

	function localToWorld( v, local, target = new THREE.Vector3() ) {

		_q.setFromAxisAngle( UP, v.yaw );
		return target.copy( local ).applyQuaternion( _q ).add( v.pos );

	}

	function make( kind ) {

		const model = kind === 'car' ? buildCar() : kind === 'carriage' ? buildCarriage() : buildBoat();
		model.root.traverse( o => {

			if ( o.isMesh ) o.castShadow = false;

		} );
		return {
			kind, spec: SPECS[ kind ], model,
			pos: new THREE.Vector3(), yaw: 0, speed: 0, steer: 0, power: 0,
			pitch: 0, roll: 0, rise: 1, seaLevel: 0, windFrom: new THREE.Vector3( 1, 0, 0 ),
			displayTimer: 0, stuckFlash: 0,
		};

	}

	function place( kind, pos, yaw, extra = {} ) {

		let v = list.find( x => x.kind === kind );
		if ( ! v ) {

			v = make( kind );
			list.push( v );
			group.add( v.model.root );

		}

		v.pos.copy( pos );
		v.yaw = yaw;
		v.speed = 0;
		v.steer = 0;
		v.power = 0;
		v.rise = 0; // grows out of the ground
		Object.assign( v, extra );
		if ( kind === 'boat' ) v.pos.y = v.seaLevel;
		flourish?.( pos.clone(), kind === 'boat' ? 4 : kind === 'carriage' ? 4.2 : 3, 1.0 );
		sync( v, 0 );
		return v;

	}

	// ------------------------------------------------ ground-based physics

	function sampleGround( v, local ) {

		localToWorld( v, local, _w );
		const hit = castTerrain( _w.x, _w.z, v.pos.y + 1.2, 4 );
		return hit ? hit.point.y : null;

	}

	function blocked( v, dist ) {

		// rays from both front (or rear) corners, at bumper and hood height
		const s = v.spec;
		const dir = forwardOf( v.yaw, new THREE.Vector3() ).multiplyScalar( Math.sign( v.speed ) || 1 );
		const endZ = v.speed >= 0 ? - s.halfLength : ( v.kind === 'carriage' ? 2.2 : s.halfLength );
		for ( const x of [ - s.halfWidth * 0.85, s.halfWidth * 0.85 ] ) {

			for ( const h of [ 0.45, 1.0 ] ) {

				localToWorld( v, _v.set( x, h, endZ + ( v.speed >= 0 ? 0.3 : - 0.3 ) ), _w );
				const hit = castRay( _w, dir, dist + 0.3 );
				if ( hit ) return hit;

			}

		}

		return null;

	}

	function driveGround( v, dt, input ) {

		const s = v.spec;
		const { throttle = 0, brake = 0, steer = 0, handbrake = false } = input || {};

		if ( throttle > 0 ) {

			if ( v.speed < - 0.3 ) v.speed += s.brake * throttle * dt;
			else v.speed += s.accel * throttle * dt * ( 1 - Math.max( 0, v.speed ) / s.maxFwd );

		}

		if ( brake > 0 ) {

			if ( v.speed > 0.3 ) v.speed -= s.brake * brake * dt;
			else v.speed = Math.max( - s.maxRev, v.speed - s.accel * 0.6 * brake * dt );

		}

		v.speed -= v.speed * s.drag * dt;
		if ( ! throttle && ! brake ) v.speed -= Math.sign( v.speed ) * Math.min( Math.abs( v.speed ), 0.6 * dt );
		if ( handbrake ) v.speed *= Math.max( 0, 1 - 4 * dt );

		v.steer += ( steer - v.steer ) * Math.min( 1, dt * 5 );
		const angle = v.steer * s.steerMax / ( 1 + v.speed * v.speed / 220 );
		v.yaw -= v.speed / s.wheelbase * Math.tan( angle ) * dt;

		const step = v.speed * dt;
		if ( Math.abs( step ) > 1e-5 ) {

			const hit = blocked( v, Math.abs( step ) );
			if ( hit ) {

				const impact = Math.abs( v.speed );
				v.speed = - v.speed * 0.2;
				if ( impact > 2 ) {

					audio?.crash( Math.min( 1, impact / 15 ) );
					haptics?.( Math.min( 1, impact / 10 ), 120 );

				}

			} else {

				forwardOf( v.yaw, _v );
				const nx = v.pos.x + _v.x * step, nz = v.pos.z + _v.z * step;
				const g = castTerrain( nx, nz, v.pos.y + 1.2, 6 );
				if ( g && g.point.y > v.pos.y + s.climb ) {

					v.speed = 0; // a kerb or step too tall for the wheels

				} else {

					v.pos.x = nx;
					v.pos.z = nz;

				}

			}

		}

		// settle on the ground: height from the wheels, tilt for the body only
		const hs = v.model.wheels.map( w => sampleGround( v, w.local ) );
		const known = hs.filter( h => h !== null );
		if ( known.length ) {

			const target = known.reduce( ( a, b ) => a + b, 0 ) / known.length;
			if ( target < v.pos.y ) v.pos.y = Math.max( target, v.pos.y - 9.8 * dt * 2 );
			else v.pos.y += ( target - v.pos.y ) * Math.min( 1, dt * 10 );
			const f = ( ( hs[ 0 ] ?? target ) + ( hs[ 1 ] ?? target ) ) / 2, r = ( ( hs[ 2 ] ?? target ) + ( hs[ 3 ] ?? target ) ) / 2;
			const l = ( ( hs[ 0 ] ?? target ) + ( hs[ 2 ] ?? target ) ) / 2, rt = ( ( hs[ 1 ] ?? target ) + ( hs[ 3 ] ?? target ) ) / 2;
			const wb = Math.abs( v.model.wheels[ 0 ].local.z - v.model.wheels[ 2 ].local.z );
			v.pitch += ( THREE.MathUtils.clamp( Math.atan2( f - r, wb ), - 0.3, 0.3 ) - v.pitch ) * Math.min( 1, dt * 8 );
			v.roll += ( THREE.MathUtils.clamp( Math.atan2( rt - l, v.spec.halfWidth * 1.8 ), - 0.25, 0.25 ) - v.roll ) * Math.min( 1, dt * 8 );

		}

	}

	// ------------------------------------------------ sailing

	function sail( v, dt, input ) {

		const { throttle = 0, brake = 0, steer = 0 } = input || {};
		const t = performance.now() / 1000;

		// throttle trims the sails in, brake eases them out
		v.power = THREE.MathUtils.clamp( v.power + ( throttle - brake ) * dt * 0.6, 0, 1 );
		const fwd = forwardOf( v.yaw, _v );
		const angle = Math.acos( THREE.MathUtils.clamp( fwd.dot( v.windFrom ), - 1, 1 ) ) * 180 / Math.PI;
		const eff = angle < 38 ? 0 : angle < 90 ? 0.55 + 0.45 * ( angle - 38 ) / 52 : angle < 150 ? 1 - 0.15 * ( angle - 90 ) / 60 : 0.85 - 0.15 * ( angle - 150 ) / 30;
		v.inIrons = angle < 38;
		v.windAngle = angle;
		let target = v.spec.maxFwd * eff * v.power;
		if ( brake > 0 && v.power === 0 ) target = - 0.8; // scull backwards out of a tight spot
		v.speed += ( target - v.speed ) * dt / ( target > v.speed ? 4 : 6 );

		v.steer += ( steer - v.steer ) * Math.min( 1, dt * 4 );
		const rudder = 0.1 + 0.2 * Math.min( 1, Math.abs( v.speed ) / 2.5 );
		v.yaw -= v.steer * rudder * dt * ( v.speed >= 0 ? 1 : - 1 );

		// which side the wind is on decides where the boom swings
		const side = Math.sign( fwd.x * v.windFrom.z - fwd.z * v.windFrom.x ) || 1; // +1: wind from starboard
		v.windSide = side;

		const step = v.speed * dt;
		if ( Math.abs( step ) > 1e-5 ) {

			const dir = forwardOf( v.yaw, new THREE.Vector3() ).multiplyScalar( Math.sign( step ) );
			const bow = _w.copy( v.pos ).addScaledVector( dir, v.spec.halfLength + 0.3 );
			const land = castTerrain( bow.x, bow.z, v.seaLevel + 8, 14 );
			const pier = castRay( new THREE.Vector3( bow.x, v.seaLevel + 0.6, bow.z ), dir, Math.abs( step ) + 0.4 );
			if ( ( land && land.point.y > v.seaLevel + 0.5 ) || pier ) {

				if ( Math.abs( v.speed ) > 1.5 ) {

					audio?.crash( Math.min( 1, Math.abs( v.speed ) / 6 ) );
					haptics?.( 0.6, 120 );

				}

				v.speed = - v.speed * 0.15;
				if ( ! v.stuckFlash ) notify?.( 'Aground', 'Ease the sails, push the brake to back off, and steer for open water.' );
				v.stuckFlash = 4;

			} else {

				v.pos.addScaledVector( dir, Math.abs( step ) );

			}

		}

		v.stuckFlash = Math.max( 0, v.stuckFlash - dt );

		// float, heel and bob
		const heel = v.inIrons ? 0 : eff * v.power * 0.3 * side;
		v.roll += ( heel - v.roll ) * Math.min( 1, dt * 1.5 );
		v.pitch = Math.sin( t * 0.9 ) * 0.02 + Math.sin( t * 1.7 ) * 0.01;
		v.pos.y = v.seaLevel + Math.sin( t * 1.1 ) * 0.06 + Math.sin( t * 2.3 ) * 0.025;

		// sails
		const m = v.model;
		let boom;
		if ( v.inIrons || v.power < 0.02 ) {

			boom = Math.sin( t * 7 ) * 0.08 * ( v.power + 0.3 ); // luffing
			setCamber( m.mainGeo, 0.04 * Math.sin( t * 9 ) );
			setCamber( m.jibGeo, 0.04 * Math.sin( t * 8 + 1 ) );

		} else {

			boom = - side * THREE.MathUtils.degToRad( THREE.MathUtils.clamp( ( angle - 25 ) / 2, 8, 80 ) );
			setCamber( m.mainGeo, - side * 0.35 * ( 0.4 + 0.6 * v.power ) );
			setCamber( m.jibGeo, - side * 0.3 * ( 0.4 + 0.6 * v.power ) );

		}

		m.boomPivot.rotation.y += ( boom - m.boomPivot.rotation.y ) * Math.min( 1, dt * 3 );
		m.jibInner.rotation.y = m.boomPivot.rotation.y * 0.6;
		m.tiller.rotation.y = v.steer * 0.5;
		// windex points into the wind, in boat space
		const windYaw = Math.atan2( - v.windFrom.x, - v.windFrom.z );
		m.windex.rotation.y = windYaw - v.yaw;
		audio?.setWater( Math.abs( v.speed ) );
		audio?.luff( v.inIrons && v.power > 0.05 );

	}

	// ------------------------------------------------ per frame

	function sync( v, dt ) {

		const m = v.model;
		m.root.position.copy( v.pos );
		m.root.rotation.set( 0, v.yaw, 0 );
		m.body.rotation.set( v.pitch, 0, v.roll );
		v.rise = Math.min( 1, v.rise + dt / 0.9 );
		const k = 1 - Math.pow( 1 - v.rise, 3 );
		m.root.scale.set( 1, Math.max( 0.001, k ), 1 );

		if ( m.wheels ) {

			for ( const w of m.wheels ) {

				w.spin.rotation.x -= v.speed * dt / w.radius;
				if ( w.front ) w.pivot.rotation.y = - v.steer * v.spec.steerMax;

			}

		}

		if ( m.steering ) m.steering.rotation.z = v.steer * 2.2;
		if ( m.horse ) {

			animateHorse( m.horse, v.speed, dt, s => audio?.hoof( s ) );
			m.horse.group.rotation.y = - v.steer * 0.25;

		}

	}

	function drawDisplay( v ) {

		const mph = Math.round( Math.abs( v.speed ) * 2.237 );
		if ( v.kind === 'car' ) v.model.display.draw( String( mph ), v.speed < - 0.2 ? 'mph · reverse' : 'mph' );
		else if ( v.kind === 'carriage' ) {

			const s = Math.abs( v.speed );
			const gait = s < 0.1 ? 'Halt' : s < 2.2 ? 'Walk' : s < 4.5 ? 'Trot' : 'Canter';
			v.model.display.draw( gait, `${ mph } mph` );

		} else {

			const kn = ( Math.abs( v.speed ) * 1.944 ).toFixed( 1 );
			const sails = `sails ${ Math.round( v.power * 100 ) }%`;
			v.model.display.draw( `${ kn } kn`, v.inIrons ? `${ sails } · too close to the wind` : `${ sails } · wind ${ Math.round( v.windAngle || 0 ) }°`, v.inIrons ? '#f0a48f' : '#a8d5d1' );

		}

	}

	let riding = null;

	function update( dt, input ) {

		for ( const v of list ) {

			const inp = v === riding ? input : null;
			if ( v.kind === 'boat' ) sail( v, dt, inp );
			else driveGround( v, dt, inp );
			sync( v, dt );
			v.displayTimer -= dt;
			if ( v.displayTimer <= 0 ) {

				v.displayTimer = 0.2;
				drawDisplay( v );

			}

		}

		if ( riding && riding.kind === 'car' ) audio?.setEngine( true, Math.abs( riding.speed ) / riding.spec.maxFwd, input?.throttle || 0 );
		else audio?.setEngine( false );
		if ( ! riding || riding.kind !== 'boat' ) {

			audio?.setWater( 0 );
			audio?.luff( false );

		}

	}

	return {
		group,
		list,
		get riding() {

			return riding;

		},
		place,
		forwardOf,
		localToWorld,
		// spawn a ground vehicle in front of a standing player, facing the way they face
		summonGround( kind, feet, yaw ) {

			const s = SPECS[ kind ];
			const f = forwardOf( yaw, new THREE.Vector3() );
			const p = feet.clone().addScaledVector( f, s.spawnAhead );
			// don't land on top of another parked vehicle
			for ( let tries = 0; tries < 4; tries ++ ) {

				const clash = list.some( o => o.kind !== kind && o.kind !== 'boat' && o.pos.distanceTo( p ) < ( o.spec.halfLength + s.halfLength ) * 0.8 );
				if ( ! clash ) break;
				p.addScaledVector( f, 4 );

			}

			const hit = castTerrain( p.x, p.z, feet.y + 2, 12 );
			if ( ! hit ) {

				notify?.( 'No room here', 'Face an open street and try again.' );
				return null;

			}

			return place( kind, hit.point, yaw );

		},
		enter( v ) {

			riding = v;
			const tips = {
				car: [ 'Driving', 'Right pinch or right trigger to go, left to brake. Hold your hands like a wheel to steer.' ],
				carriage: [ 'At the reins', 'Right pinch to urge the horse on, left to slow. Tilt your hands to steer.' ],
				boat: [ 'Sailing', 'Wind is from the southwest. Right pinch trims the sails in, left eases them. Tilt your hands to steer.' ],
			};
			notify?.( ...tips[ v.kind ] );

		},
		exit() {

			const v = riding;
			riding = null;
			if ( ! v ) return null;
			v.steer = 0;
			return localToWorld( v, v.spec.exit, new THREE.Vector3() );

		},
		nearest( point, maxDist ) {

			let best = null, bd = maxDist;
			for ( const v of list ) {

				const d = v.pos.distanceTo( point );
				if ( d < bd ) {

					bd = d;
					best = v;

				}

			}

			return best;

		},
		eyeWorld( v, target = new THREE.Vector3() ) {

			localToWorld( v, v.spec.eye, target );
			// follow the body's bob and tilt height a little, without rotating your view
			target.y += v.model.body.position.y;
			return target;

		},
		update,
	};

}
