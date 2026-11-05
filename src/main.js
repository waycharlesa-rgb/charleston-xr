import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { TilesRenderer } from '3d-tiles-renderer/three';
import { GoogleCloudAuthPlugin } from '3d-tiles-renderer/core/plugins';
import {
	GLTFExtensionsPlugin,
	ReorientationPlugin,
	TilesFadePlugin,
	UnloadTilesPlugin,
} from '3d-tiles-renderer/three/plugins';
import { computeBoundsTree, acceleratedRaycast } from 'three-mesh-bvh';
import { PLACES, ORIGIN, BOAT_SPOTS } from './places.js';
import { HarborAmbience } from './audio.js';
import { createAlchemy } from './alchemy.js';
import { createVehicles, SPECS } from './vehicles.js';
import { CAR_TYPES, CAR_TYPE_KEYS, registerCustomCar, clearCustomCar } from './carmodels.js';
import { createWristMenu } from './wristmenu.js';
import { createTraffic } from './traffic.js';

const D2R = Math.PI / 180;
const WALK = 1.4; // m/s, an easy stroll
const RUN = 4.0;
const FLY = 7; // m/s, gliding
const BOOST = 35; // m/s, crossing the peninsula in under a minute
const MAX_ALTITUDE = 1500;
const EYE = 1.7; // eye height in screen mode
const STEP_UP = 0.55; // tallest curb or stair you can step onto
const BODY = 0.35; // how close you can get to a wall
const QUALITY = { sharp: 8, balanced: 14, fast: 24 };

// Collision checks against the city use a BVH (a spatial index over each tile's
// triangles), built the first time a ray actually touches that tile. Without it,
// every ray tests every triangle and the headset's frame rate collapses.
THREE.BufferGeometry.prototype.computeBoundsTree = computeBoundsTree;
function lazyBVHRaycast( raycaster, intersects ) {

	if ( ! this.geometry.boundsTree ) this.geometry.computeBoundsTree( { indirect: true } );
	return acceleratedRaycast.call( this, raycaster, intersects );

}

// ?offline swaps the city for a test ground, so everything except the
// photographed tiles can be tried without an API key.
const OFFLINE = new URLSearchParams( location.search ).has( 'offline' );

// ---------------------------------------------------------------- storage

const store = {
	get( k, fallback = null ) {

		try {

			return localStorage.getItem( 'chs-xr:' + k ) ?? fallback;

		} catch {

			return fallback;

		}

	},
	set( k, v ) {

		try {

			localStorage.setItem( 'chs-xr:' + k, v );

		} catch { /* storage blocked: settings just won't persist */ }

	},
};

// ---------------------------------------------------------------- DOM

const $ = id => document.getElementById( id );
const ui = {
	menu: $( 'menu' ),
	keyForm: $( 'key-form' ),
	key: $( 'api-key' ),
	keyToggle: $( 'key-toggle' ),
	keyState: $( 'key-state' ),
	place: $( 'place' ),
	quality: $( 'quality' ),
	enterXR: $( 'enter-xr' ),
	enterScreen: $( 'enter-screen' ),
	xrNote: $( 'xr-note' ),
	status: $( 'status' ),
	hud: $( 'hud' ),
	hudPlace: $( 'hud-place' ),
	hudMode: $( 'hud-mode' ),
	hudMenu: $( 'hud-menu' ),
	vehicleExit: $( 'vehicle-toggle' ),
	carModel: $( 'car-model' ),
	modelFile: $( 'model-file' ),
	modelTurn: $( 'model-turn' ),
	modelRemove: $( 'model-remove' ),
	modelState: $( 'model-state' ),
	hint: $( 'hint' ),
	crosshair: $( 'crosshair' ),
	attribution: $( 'attribution' ),
	stats: $( 'show-stats' ),
	traffic: $( 'show-traffic' ),
	loading: $( 'loading' ),
};

for ( const p of PLACES ) {

	const opt = document.createElement( 'option' );
	opt.value = p.id;
	opt.textContent = p.name;
	ui.place.append( opt );

}

ui.place.value = store.get( 'place', 'battery' );
ui.quality.value = store.get( 'quality', 'balanced' );
ui.stats.checked = store.get( 'stats' ) === '1';
ui.stats.addEventListener( 'change', () => store.set( 'stats', ui.stats.checked ? '1' : '0' ) );
ui.traffic.checked = store.get( 'traffic', '1' ) === '1';
ui.traffic.addEventListener( 'change', () => {

	store.set( 'traffic', ui.traffic.checked ? '1' : '0' );
	traffic.setEnabled( ui.traffic.checked );

} );

// ---------------------------------------------------------------- scene

const renderer = new THREE.WebGLRenderer( { antialias: true, powerPreference: 'high-performance' } );
renderer.setPixelRatio( Math.min( window.devicePixelRatio, 2 ) );
renderer.setSize( window.innerWidth, window.innerHeight );
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.55;
renderer.xr.enabled = true;
renderer.xr.setReferenceSpaceType( 'local-floor' );
// three.js defaults to maximum foveation, which visibly blurs everything outside
// the centre of your view. Keep a little for performance.
renderer.xr.setFoveation( 0.2 );
const MAX_ANISO = renderer.capabilities.getMaxAnisotropy();
$( 'stage' ).append( renderer.domElement );

const scene = new THREE.Scene();
scene.fog = new THREE.Fog( 0xc8d3dc, 1800, 12000 );

const camera = new THREE.PerspectiveCamera( 70, window.innerWidth / window.innerHeight, 0.1, 20000 );
const rig = new THREE.Group(); // the player's feet
rig.add( camera );
camera.position.y = EYE;
scene.add( rig );

// Late-afternoon sky. The photographed city has its own baked daylight, so the
// sun only colours the sky; it does not relight the buildings.
const sky = new Sky();
sky.scale.setScalar( 15000 );
const su = sky.material.uniforms;
su.turbidity.value = 5;
su.rayleigh.value = 1.4;
su.mieCoefficient.value = 0.004;
su.mieDirectionalG.value = 0.82;
su.sunPosition.value.setFromSphericalCoords( 1, ( 90 - 28 ) * D2R, 245 * D2R );
{

	// Reflections for car paint, chrome, glass and the boat's hull come from this sky.
	const pmrem = new THREE.PMREMGenerator( renderer );
	const envScene = new THREE.Scene();
	envScene.add( sky );
	// the street below: without it, car sides would mirror bright sky instead of dark ground
	const groundDisc = new THREE.Mesh( new THREE.CircleGeometry( 500, 32 ).rotateX( - Math.PI / 2 ), new THREE.MeshBasicMaterial( { color: 0x3f3b35 } ) );
	groundDisc.position.y = - 1.5;
	envScene.add( groundDisc );
	scene.environment = pmrem.fromScene( envScene, 0, 0.1, 1000 ).texture;
	pmrem.dispose();

}

scene.add( sky );

const ambience = new HarborAmbience();

// ---------------------------------------------------------------- city tiles

let tiles = null;
let rootReady = false;
let testGround = null;
const draco = new DRACOLoader().setDecoderPath( './draco/' );

function startTiles( apiKey ) {

	if ( tiles ) {

		scene.remove( tiles.group );
		tiles.dispose();

	}

	rootReady = false;
	tiles = new TilesRenderer();
	tiles.registerPlugin( new GoogleCloudAuthPlugin( { apiToken: apiKey, autoRefreshToken: true } ) );
	tiles.registerPlugin( new GLTFExtensionsPlugin( { dracoLoader: draco } ) );
	tiles.registerPlugin( new TilesFadePlugin() );
	tiles.registerPlugin( new UnloadTilesPlugin() );
	tiles.registerPlugin( new ReorientationPlugin( {
		lat: ORIGIN.lat * D2R,
		lon: ORIGIN.lon * D2R,
		height: 0,
		recenter: true,
	} ) );

	tiles.lruCache.maxBytesSize = 0.9 * 2 ** 30;
	tiles.lruCache.minBytesSize = 0.6 * 2 ** 30;
	applyQuality();

	tiles.addEventListener( 'load-model', ( { scene: model } ) => {

		model.traverse( o => {

			if ( o.isMesh ) o.raycast = lazyBVHRaycast;
			if ( ! o.material ) return;
			o.material.toneMapped = false; // keep the photographed colours exactly as captured
			// Sharp textures on surfaces seen at a slant: the street ahead, facades beside you.
			if ( o.material.map ) o.material.map.anisotropy = MAX_ANISO;
			alchemy.patchMaterial( o.material ); // let transmutations ripple the pavement

		} );

	} );

	tiles.addEventListener( 'load-root-tileset', () => {

		requestAnimationFrame( () => {

			rootReady = true;
			startTraffic();
			ui.keyState.textContent = 'Key works. The city is streaming in.';
			ui.keyState.dataset.state = 'ok';
			goTo( currentPlace(), true );

		} );

	} );

	tiles.addEventListener( 'load-error', ( { tile, error } ) => {

		if ( tile ) return; // a single tile failing is normal; the root failing is not
		ui.keyState.dataset.state = 'bad';
		const msg = String( error?.message || error );
		ui.keyState.textContent = /40[03]/.test( msg )
			? 'Google refused this key. Check that the Map Tiles API is enabled for it and that billing is set up.'
			: 'Could not reach Google’s 3D tiles: ' + msg;

	} );

	tiles.setCamera( camera );
	tiles.setResolutionFromRenderer( camera, renderer );
	scene.add( tiles.group );

}

function startTestGround() {

	// A paved square with a few blocks to land on and transmute out of.
	const c = document.createElement( 'canvas' );
	c.width = c.height = 256;
	const g = c.getContext( '2d' );
	g.fillStyle = '#8d8a83';
	g.fillRect( 0, 0, 256, 256 );
	g.strokeStyle = '#6f6c66';
	g.lineWidth = 3;
	for ( let i = 0; i <= 256; i += 64 ) {

		g.beginPath(); g.moveTo( i, 0 ); g.lineTo( i, 256 ); g.stroke();
		g.beginPath(); g.moveTo( 0, i ); g.lineTo( 256, i ); g.stroke();

	}

	const tex = new THREE.CanvasTexture( c );
	tex.colorSpace = THREE.SRGBColorSpace;
	tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
	tex.repeat.set( 800, 800 );
	const geo = new THREE.PlaneGeometry( 4000, 4000, 400, 400 ).rotateX( - Math.PI / 2 );
	const mat = new THREE.MeshBasicMaterial( { map: tex, toneMapped: false } );
	alchemy.patchMaterial( mat );
	testGround = new THREE.Group();
	const groundMesh = new THREE.Mesh( geo, mat );
	groundMesh.raycast = lazyBVHRaycast; // same fast ray tests as the real city tiles
	testGround.add( groundMesh );

	const palette = [ '#e7b9a3', '#f2e2a6', '#a8d5d1', '#d9c2e0', '#f3efe6' ];
	for ( let i = 0; i < 14; i ++ ) {

		const h = 8 + ( i * 7 ) % 14;
		const box = new THREE.Mesh(
			new THREE.BoxGeometry( 9, h, 12 ),
			new THREE.MeshBasicMaterial( { color: palette[ i % palette.length ], toneMapped: false } ),
		);
		const a = i / 14 * Math.PI * 2;
		box.position.set( Math.cos( a ) * 40, h / 2, Math.sin( a ) * 40 );
		box.lookAt( 0, h / 2, 0 );
		alchemy.patchMaterial( box.material );
		testGround.add( box );

	}

	scene.add( testGround );
	rootReady = true;
	startTraffic();
	ui.keyState.textContent = 'Test mode: a paved square instead of Charleston.';
	ui.keyState.dataset.state = 'ok';
	goTo( currentPlace(), true );

}

function applyQuality() {

	if ( ! tiles ) return;
	tiles.errorTarget = QUALITY[ ui.quality.value ] ?? QUALITY.balanced;

}

// ---------------------------------------------------------------- geo helpers

function toLocal( lat, lon, height, target = new THREE.Vector3() ) {

	if ( ! tiles ) {

		// test mode: flat-earth metres around the origin
		return target.set(
			( lon - ORIGIN.lon ) * Math.cos( ORIGIN.lat * D2R ) * 111320,
			0,
			- ( lat - ORIGIN.lat ) * 110540,
		);

	}

	tiles.group.updateMatrixWorld( true );
	tiles.ellipsoid.getCartographicToPosition( lat * D2R, lon * D2R, height, target );
	return target.applyMatrix4( tiles.group.matrixWorld );

}

function currentPlace() {

	return PLACES.find( p => p.id === ui.place.value ) || PLACES[ 0 ];

}

// ---------------------------------------------------------------- raycasting

const ray = new THREE.Raycaster();
ray.firstHitOnly = true;
const hits = [];
const _m = new THREE.Matrix3();
const DOWN = new THREE.Vector3( 0, - 1, 0 );

// Everything solid: the city (or test ground) plus whatever you've transmuted.
function castRay( origin, dir, far ) {

	ray.set( origin, dir );
	ray.near = 0;
	ray.far = far;
	hits.length = 0;
	if ( tiles ) tiles.raycast( ray, hits );
	if ( testGround ) ray.intersectObject( testGround, true, hits );
	if ( alchemy ) ray.intersectObject( alchemy.solids, true, hits );
	if ( ! hits.length ) return null;
	hits.sort( ( a, b ) => a.distance - b.distance );
	return hits[ 0 ];

}

function castTerrain( x, z, fromY, far ) {

	return castRay( new THREE.Vector3( x, fromY, z ), DOWN, far );

}

function hitNormal( hit, target ) {

	if ( ! hit.face ) return target.set( 0, 0, 0 );
	_m.getNormalMatrix( hit.object.matrixWorld );
	return target.copy( hit.face.normal ).applyMatrix3( _m ).normalize();

}

function groundBelow( x, z, fromY, far ) {

	const hit = castTerrain( x, z, fromY, far );
	return hit ? hit.point.y : null;

}

// ---------------------------------------------------------------- notices

let toastUntil = 0;
let hintTimer = 0;

function notify( title, sub = '' ) {

	showToast( title, sub );
	ui.hint.innerHTML = '';
	const b = document.createElement( 'strong' );
	b.textContent = title;
	ui.hint.append( b );
	if ( sub ) ui.hint.append( document.createTextNode( ' ' + sub ) );
	ui.hint.hidden = false;
	clearTimeout( hintTimer );
	hintTimer = setTimeout( () => ui.hint.hidden = true, 4000 );

}

// ---------------------------------------------------------------- alchemy

let activeHaptics = [];
function haptics( intensity, ms ) {

	for ( const h of activeHaptics ) {

		try {

			h.pulse( intensity, ms );

		} catch { /* not every controller supports rumble */ }

	}

}

const alchemy = createAlchemy( {
	scene, camera, rig, castRay, castTerrain, audio: ambience, notify, haptics,
} );

const vehicles = createVehicles( {
	scene, castRay, castTerrain, audio: ambience, notify, haptics, flourish: alchemy.flourish,
	castExtra: ( o, d, f ) => traffic.castCars( o, d, f ),
} );

const playerInfo = { feet: new THREE.Vector3(), dir: new THREE.Vector3(), riding: null, vehicles: [] };
const traffic = createTraffic( {
	scene, toLocal, castTerrain, obstacleSolids: alchemy.solids, audio: ambience,
	getPlayer() {

		readHead();
		playerInfo.feet.set( head.x, rig.position.y, head.z );
		playerInfo.dir.set( headDir.x, 0, headDir.z ).normalize();
		playerInfo.riding = vehicles.riding;
		playerInfo.vehicles = vehicles.list;
		return playerInfo;

	},
} );

function startTraffic() {

	traffic.setEnabled( ui.traffic.checked );
	traffic.start().catch( err => console.warn( 'Traffic could not load the street map:', err ) );

}

const wrist = createWristMenu( { scene, haptics, audio: ambience, onSelect: menuSelect } );

// ---------------------------------------------------------------- player pose

const head = new THREE.Vector3();
const headDir = new THREE.Vector3();
let yaw = 0;
let pitch = 0;
let vy = 0;
let awaitingGround = true;
let spawnedAt = 0;
let quietFor = 0;
let flying = false;
let speedNow = 0;
let turnFlash = 0;

function readHead() {

	camera.updateMatrixWorld( true );
	camera.getWorldPosition( head );
	camera.getWorldDirection( headDir );

}

function headYaw() {

	readHead();
	return Math.atan2( - headDir.x, - headDir.z );

}

// Turn the player around their own head, so turning never slides them sideways.
function turnBy( angle ) {

	if ( vehicles.riding ) {

		seatYawOffset += angle;
		turnFlash = 0.15;
		return;

	}

	readHead();
	const before = head.clone();
	rig.rotation.y += angle;
	yaw = rig.rotation.y;
	readHead();
	rig.position.x += before.x - head.x;
	rig.position.z += before.z - head.z;
	turnFlash = 0.15;

}

function goTo( place, initial = false, remember = true ) {

	if ( ! rootReady ) return;
	if ( vehicles.riding ) vehicles.exit(); // the vehicle stays parked where you left it
	if ( remember ) {

		ui.place.value = place.id;
		store.set( 'place', place.id );

	}

	// Ground in downtown Charleston is ~26 m below the WGS84 ellipsoid (geoid offset).
	const spot = toLocal( place.lat, place.lon, - 25 );
	const look = toLocal( place.look.lat, place.look.lon, - 25, new THREE.Vector3() );
	const wantYaw = Math.atan2( - ( look.x - spot.x ), - ( look.z - spot.z ) );

	turnBy( wantYaw - headYaw() );
	readHead();
	rig.position.x += spot.x - head.x;
	rig.position.z += spot.z - head.z;
	rig.position.y = spot.y;
	pitch = 0;
	if ( ! renderer.xr.isPresenting ) camera.rotation.x = 0;
	vy = 0;
	flying = false;
	awaitingGround = true;
	quietFor = 0;
	spawnedAt = performance.now();
	updateModeLabel();

	ui.hudPlace.textContent = place.name;
	showToast( 'Loading ' + place.name + '…', 'The street sharpens as Google’s scans stream in.' );
	ui.loading.hidden = false;

}

function nextPlace( dir = 1 ) {

	const i = PLACES.indexOf( currentPlace() );
	goTo( PLACES[ ( i + dir + PLACES.length ) % PLACES.length ] );

}

function toggleFlight() {

	if ( awaitingGround ) return;
	if ( vehicles.riding ) {

		exitVehicle();
		return;

	}

	flying = ! flying;
	vy = 0;
	ambience.whoosh( flying );
	haptics( 0.4, 60 );
	updateModeLabel();
	notify( flying ? 'Flying' : 'Landing', flying
		? 'Look where you want to go. Look up to climb.'
		: 'You’ll drift gently back to the ground.' );

}

function updateModeLabel() {

	const v = vehicles?.riding;
	if ( v ) {

		const s = Math.abs( v.speed );
		ui.hudMode.textContent = v.kind === 'car' ? `Driving · ${ Math.round( s * 2.237 ) } mph`
			: v.kind === 'carriage' ? `Carriage · ${ s < 0.1 ? 'halt' : s < 2.2 ? 'walk' : s < 4.5 ? 'trot' : 'canter' }`
				: `Sailing · ${ ( s * 1.944 ).toFixed( 1 ) } kn${ v.inIrons ? ' · in irons' : '' }`;
		ui.hudMode.dataset.mode = 'fly';

	} else {

		ui.hudMode.textContent = flying ? 'Flying' : 'On foot';
		ui.hudMode.dataset.mode = flying ? 'fly' : 'walk';

	}

	ui.vehicleExit.textContent = v ? 'Get out (V)' : 'Get in (V)';

}

// ---------------------------------------------------------------- vehicles

const headLocalEntry = new THREE.Vector3( 0, EYE, 0 );
let seatYawOffset = 0;
let pendingBoat = null;
const _seat = new THREE.Vector3();
const _off = new THREE.Vector3();
const UPV = new THREE.Vector3( 0, 1, 0 );

function feetPosition() {

	readHead();
	return new THREE.Vector3( head.x, rig.position.y, head.z );

}

function enterVehicle( v ) {

	if ( ! v ) return;
	flying = false;
	awaitingGround = false;
	ui.loading.hidden = true;
	vy = 0;
	rig.updateMatrixWorld( true );
	if ( renderer.xr.isPresenting ) {

		// keep your real head where it is relative to your body, and face forward
		readHead();
		headLocalEntry.copy( head );
		rig.worldToLocal( headLocalEntry );
		seatYawOffset = - ( headYaw() - rig.rotation.y );

	} else {

		headLocalEntry.set( 0, EYE, 0 );
		yaw = 0; // in a vehicle, mouse look is relative to the vehicle
		pitch = 0;

	}

	vehicles.enter( v );
	placeInSeat();
	updateModeLabel();

}

function placeInSeat() {

	const v = vehicles.riding;
	if ( ! v ) return;
	vehicles.eyeWorld( v, _seat );
	rig.rotation.y = v.yaw + ( renderer.xr.isPresenting ? seatYawOffset : yaw );
	_off.copy( headLocalEntry ).applyAxisAngle( UPV, rig.rotation.y );
	rig.position.copy( _seat ).sub( _off );
	if ( ! renderer.xr.isPresenting ) camera.rotation.set( pitch, 0, 0 );

}

function exitVehicle() {

	const v = vehicles.riding;
	const out = vehicles.exit();
	if ( ! out ) return;
	readHead();
	rig.position.x += out.x - head.x;
	rig.position.z += out.z - head.z;
	const g = castTerrain( out.x, out.z, Math.max( out.y, v.pos.y ) + 3, 30 );
	rig.position.y = g ? g.point.y : out.y;
	if ( ! renderer.xr.isPresenting ) {

		yaw = rig.rotation.y;
		pitch = 0;

	}

	if ( ! g ) {

		awaitingGround = true;
		quietFor = 0;
		spawnedAt = performance.now();

	}

	if ( v.kind === 'boat' ) notify( 'Walking on water', 'You can walk back to the boat and get in again.' );
	updateModeLabel();

}

function summon( kind ) {

	if ( ! rootReady || awaitingGround ) return;
	if ( vehicles.riding ) exitVehicle();
	readHead();
	let feet = new THREE.Vector3( head.x, rig.position.y, head.z );
	if ( flying ) {

		const g = castTerrain( head.x, head.z, head.y, 3000 );
		if ( ! g ) return notify( 'No ground below', 'Fly lower and try again.' );
		feet = g.point.clone();

	}

	const v = vehicles.summonGround( kind, feet, headYaw(), kind === 'car' ? carChoice : null );
	if ( v ) setTimeout( () => {

		if ( ! vehicles.riding ) enterVehicle( v );

	}, 1100 );

}

function summonBoat() {

	if ( ! rootReady ) return;
	readHead();
	let best = BOAT_SPOTS[ 0 ], bd = Infinity;
	for ( const spot of BOAT_SPOTS ) {

		const d = toLocal( spot.lat, spot.lon, - 25 ).distanceTo( head );
		if ( d < bd ) {

			bd = d;
			best = spot;

		}

	}

	pendingBoat = best;
	goTo( best, false, false );
	ui.hudPlace.textContent = best.name;

}

function launchBoat() {

	const spot = pendingBoat;
	pendingBoat = null;
	readHead();
	const pos = new THREE.Vector3( head.x, rig.position.y, head.z );
	// the sea breeze here comes from the southwest
	const a = toLocal( spot.lat, spot.lon, - 25 );
	const n = toLocal( spot.lat + 0.001, spot.lon, - 25 ).sub( a ).setY( 0 ).normalize();
	const e = new THREE.Vector3().crossVectors( n, UPV ).normalize();
	const windFrom = n.clone().add( e ).negate().normalize();
	const look = toLocal( spot.look.lat, spot.look.lon, - 25 );
	const boatYaw = Math.atan2( - ( look.x - a.x ), - ( look.z - a.z ) );
	const v = vehicles.place( 'boat', pos, boatYaw, { seaLevel: pos.y, windFrom } );
	setTimeout( () => {

		if ( ! vehicles.riding ) enterVehicle( v );

	}, 1100 );

}

function enterNearest() {

	if ( vehicles.riding ) return;
	const v = vehicles.nearest( feetPosition(), 7 );
	if ( v ) enterVehicle( v );
	else notify( 'Nothing to get into', 'Summon a vehicle from the menu, or walk up to one you left.' );

}

// which car you summon: chosen on the palm menu or the on-screen picker, remembered
let carChoice = CAR_TYPES[ store.get( 'car' ) ] ? store.get( 'car' ) : 'rangerover';
const customWasChosen = store.get( 'car' ) === 'custom'; // the model itself loads a moment later

function setCarChoice( type ) {

	carChoice = type;
	store.set( 'car', type );
	if ( ui.carModel ) ui.carModel.value = type;

}

function menuItems() {

	const riding = vehicles.riding;
	const near = ! riding && vehicles.nearest( feetPosition(), 7 );
	return [
		{ id: 'car', label: `Summon the ${ CAR_TYPES[ carChoice ].label }` },
		{ id: 'car-model', label: `Car: ${ CAR_TYPES[ carChoice ].label }  ›` },
		{ id: 'carriage', label: 'Summon a carriage' },
		{ id: 'boat', label: 'Sail from the harbor' },
		riding
			? { id: 'exit', label: 'Get out', accent: true }
			: { id: 'enter', label: near ? `Get in the ${ SPECS[ near.kind ].label.toLowerCase() }` : 'Get in', enabled: !! near, accent: !! near },
	];

}

function menuSelect( id ) {

	if ( id === 'car-model' ) setCarChoice( CAR_TYPE_KEYS[ ( CAR_TYPE_KEYS.indexOf( carChoice ) + 1 ) % CAR_TYPE_KEYS.length ] );
	else if ( id === 'car' || id === 'carriage' ) summon( id );
	else if ( id === 'boat' ) summonBoat();
	else if ( id === 'enter' ) enterNearest();
	else if ( id === 'exit' ) exitVehicle();

}

// ---------------------------------------------------------------- movement

const _n = new THREE.Vector3();
const move = new THREE.Vector3();
const fwd = new THREE.Vector3();
const right = new THREE.Vector3();
const _o = new THREE.Vector3();

// Slide a movement vector along whatever it would run into.
function collide( origin, mv ) {

	for ( let pass = 0; pass < 2 && mv.lengthSq() > 0; pass ++ ) {

		const len = mv.length();
		const hit = castRay( origin, _o.copy( mv ).divideScalar( len ), len + BODY );
		if ( ! hit ) return;
		hitNormal( hit, _n );
		if ( ! flying ) _n.y = 0;
		if ( _n.lengthSq() < 1e-4 ) {

			mv.set( 0, 0, 0 );
			return;

		}

		_n.normalize();
		const into = mv.dot( _n );
		if ( into < 0 ) mv.addScaledVector( _n, - into );
		if ( pass === 1 ) mv.set( 0, 0, 0 );

	}

}

// forward/strafe/vertical in -1..1, speed in m/s
function stepPlayer( dt, forward, strafe, speed, vertical = 0 ) {

	readHead();

	// Waiting to land: probe from high above until the ground under us has loaded.
	if ( awaitingGround ) {

		// Only land once the detailed tiles around us are in; landing on the rough
		// first-pass shape of the city can leave you inside a blob or on a roof.
		const busy = tiles ? tiles.stats.queued + tiles.stats.downloading + tiles.stats.parsing : 0;
		quietFor = busy === 0 ? quietFor + dt : 0;
		const g = groundBelow( head.x, head.z, rig.position.y + 400, 800 );
		if ( g !== null && ( quietFor > 0.6 || performance.now() - spawnedAt > 15000 ) ) {

			rig.position.y = g;
			awaitingGround = false;
			ui.loading.hidden = true;
			if ( pendingBoat ) launchBoat();
			else if ( renderer.xr.isPresenting ) showToast( currentPlace().name, currentPlace().blurb );

		} else if ( g !== null && g > rig.position.y - 3 ) {

			rig.position.y = g; // hover at the current best guess of street level while waiting

		}

		speedNow = 0;
		return;

	}

	if ( flying ) {

		flyStep( dt, forward, strafe, speed, vertical );
		return;

	}

	fwd.set( headDir.x, 0, headDir.z );
	if ( fwd.lengthSq() < 1e-6 ) fwd.set( 0, 0, - 1 );
	fwd.normalize();
	right.set( - fwd.z, 0, fwd.x );
	move.set( 0, 0, 0 ).addScaledVector( fwd, forward ).addScaledVector( right, strafe );
	if ( move.lengthSq() > 1 ) move.normalize();
	move.multiplyScalar( speed * dt );

	// Walls: cast at waist height in the walking direction and slide along what we hit.
	if ( move.lengthSq() > 0 ) collide( new THREE.Vector3( head.x, rig.position.y + 1.0, head.z ), move );

	const nx = head.x + move.x;
	const nz = head.z + move.z;
	const above = rig.position.y + 1.6;
	let g = groundBelow( nx, nz, above, 60 );
	if ( g === null ) g = groundBelow( nx, nz, above, 3000 ); // a long drop, e.g. after flying

	// Nothing loaded under the next step yet: hold still rather than walk into a void.
	if ( g === null ) {

		speedNow = 0;
		return;

	}

	if ( g > rig.position.y + STEP_UP && move.lengthSq() > 0 ) return; // a ledge too tall to climb

	rig.position.x += move.x;
	rig.position.z += move.z;
	speedNow = move.length() / Math.max( dt, 1e-4 );

	if ( g >= rig.position.y - 0.05 ) {

		// Stepping up (or on level ground, or riding a rising pillar): ease onto the new height.
		rig.position.y += ( g - rig.position.y ) * Math.min( 1, dt * 12 );
		vy = 0;

	} else {

		// Falling. Gods come down gently: speed scales with the drop that's left.
		const drop = rig.position.y - g;
		const target = - Math.min( 20, 1.5 + drop * 1.4 );
		vy += ( target - vy ) * Math.min( 1, dt * 3 );
		rig.position.y = Math.max( g, rig.position.y + vy * dt );
		if ( rig.position.y === g ) vy = 0;

	}

}

function flyStep( dt, forward, strafe, speed, vertical ) {

	// Fly where you look, including up and down.
	fwd.copy( headDir ).normalize();
	right.set( - headDir.z, 0, headDir.x ).normalize();
	move.set( 0, 0, 0 )
		.addScaledVector( fwd, forward )
		.addScaledVector( right, strafe )
		.addScaledVector( new THREE.Vector3( 0, 1, 0 ), vertical );
	if ( move.lengthSq() > 1 ) move.normalize();
	move.multiplyScalar( speed * dt );

	if ( move.lengthSq() > 0 ) collide( head.clone(), move );

	rig.position.add( move );
	speedNow = move.length() / Math.max( dt, 1e-4 );

	// never sink into the ground; never leave the atmosphere
	readHead();
	const g = groundBelow( head.x, head.z, head.y + 0.5, 3000 );
	if ( g !== null && rig.position.y < g ) rig.position.y = g;
	if ( g !== null && rig.position.y > g + MAX_ALTITUDE ) rig.position.y = g + MAX_ALTITUDE;

}

// ---------------------------------------------------------------- screen controls

const keys = new Set();
let dragging = false;

function screenCast( kind ) {

	if ( ! alchemy.armed() ) return;
	readHead();
	if ( kind === 'push' ) alchemy.cast( 'push', { origin: head.clone(), dir: headDir.clone() } );
	if ( kind === 'ground' ) alchemy.cast( 'ground', { from: new THREE.Vector3( head.x, rig.position.y, head.z ), facing: headDir.clone() } );
	if ( kind === 'raise' ) alchemy.cast( 'raise', { head: head.clone(), floorY: rig.position.y } );

}

addEventListener( 'keydown', e => {

	if ( e.target.closest( 'input, select, textarea' ) ) return;
	if ( ui.menu.open && e.code !== 'Escape' ) return;
	keys.add( e.code );
	if ( e.repeat ) return;
	if ( e.code === 'Escape' && ! ui.menu.open ) openMenu();
	if ( e.code === 'KeyN' ) nextPlace( 1 );
	if ( e.code === 'KeyB' ) nextPlace( - 1 );
	if ( e.code === 'KeyF' ) toggleFlight();
	if ( e.code === 'KeyC' ) alchemy.clap();
	if ( e.code === 'KeyT' ) screenCast( 'push' );
	if ( e.code === 'KeyG' ) screenCast( 'ground' );
	if ( e.code === 'KeyR' ) screenCast( 'raise' );
	if ( e.code === 'KeyX' ) alchemy.clearAll();
	if ( e.code === 'Digit1' ) summon( 'car' );
	if ( e.code === 'Digit2' ) summon( 'carriage' );
	if ( e.code === 'Digit3' ) summonBoat();
	if ( e.code === 'KeyV' ) vehicles.riding ? exitVehicle() : enterNearest();
	if ( e.code === 'Space' ) e.preventDefault();

} );
addEventListener( 'keyup', e => keys.delete( e.code ) );
addEventListener( 'blur', () => keys.clear() );

const canvas = renderer.domElement;
canvas.addEventListener( 'pointerdown', e => {

	if ( alchemy.armed() && ( document.pointerLockElement === canvas || e.pointerType !== 'mouse' ) ) {

		screenCast( 'push' );
		return;

	}

	dragging = true;
	canvas.setPointerCapture( e.pointerId );
	if ( e.pointerType === 'mouse' && canvas.requestPointerLock ) {

		try {

			const p = canvas.requestPointerLock();
			if ( p && p.catch ) p.catch( () => {} );

		} catch { /* pointer lock unavailable: dragging still works */ }

	}

} );
canvas.addEventListener( 'pointerup', () => dragging = false );
canvas.addEventListener( 'pointermove', e => {

	if ( renderer.xr.isPresenting ) return;
	if ( ! dragging && document.pointerLockElement !== canvas ) return;
	const k = e.pointerType === 'touch' ? 0.005 : 0.0025;
	yaw -= e.movementX * k;
	pitch = THREE.MathUtils.clamp( pitch - e.movementY * k, - 1.4, 1.4 );

} );

function screenInput( dt ) {

	if ( vehicles.riding ) {

		alchemy.setScreenGlow( true );
		ui.crosshair.hidden = ! alchemy.armed();
		const k = c => keys.has( c );
		return {
			throttle: k( 'KeyW' ) || k( 'ArrowUp' ) ? 1 : 0,
			brake: k( 'KeyS' ) || k( 'ArrowDown' ) ? 1 : 0,
			steer: ( k( 'KeyD' ) || k( 'ArrowRight' ) ? 1 : 0 ) - ( k( 'KeyA' ) || k( 'ArrowLeft' ) ? 1 : 0 ),
			handbrake: k( 'Space' ),
		};

	}

	const f = ( keys.has( 'KeyW' ) || keys.has( 'ArrowUp' ) ? 1 : 0 ) - ( keys.has( 'KeyS' ) || keys.has( 'ArrowDown' ) ? 1 : 0 );
	const s = ( keys.has( 'KeyD' ) ? 1 : 0 ) - ( keys.has( 'KeyA' ) ? 1 : 0 );
	const v = ( keys.has( 'Space' ) || keys.has( 'KeyE' ) ? 1 : 0 ) - ( keys.has( 'KeyQ' ) ? 1 : 0 );
	const turn = ( keys.has( 'ArrowLeft' ) ? 1 : 0 ) - ( keys.has( 'ArrowRight' ) ? 1 : 0 );
	yaw += turn * 1.6 * dt;
	rig.rotation.y = yaw;
	camera.rotation.set( pitch, 0, 0 );
	const fast = keys.has( 'ShiftLeft' ) || keys.has( 'ShiftRight' );
	const speed = flying ? ( fast ? BOOST : FLY ) : ( fast ? RUN : WALK );
	stepPlayer( dt, f, s, speed, v );
	alchemy.setScreenGlow( true );
	ui.crosshair.hidden = ! alchemy.armed();
	return null;

}

// ---------------------------------------------------------------- headset controls

const pressed = new Map(); // edge detection for buttons and stick flicks
function edge( id, isDown ) {

	const was = pressed.get( id ) || false;
	pressed.set( id, isDown );
	return isDown && ! was;

}

const pinchState = { left: false, right: false };
let travelHold = 0;
let leftPinchStart = 0;
let leftPinchEnd = - 10;
let leftPinchLen = 10;

const _p = new THREE.Vector3();
const _q = new THREE.Vector3();

function jointDistance( frame, source, ref, a, b ) {

	const ja = source.hand.get( a ), jb = source.hand.get( b );
	if ( ! ja || ! jb || ! frame.getJointPose ) return null;
	const pa = frame.getJointPose( ja, ref ), pb = frame.getJointPose( jb, ref );
	if ( ! pa || ! pb ) return null;
	const A = pa.transform.position, B = pb.transform.position;
	return Math.hypot( A.x - B.x, A.y - B.y, A.z - B.z );

}

function pinching( frame, source, ref ) {

	const d = jointDistance( frame, source, ref, 'thumb-tip', 'index-finger-tip' );
	if ( d === null ) return false;
	return pinchState[ source.handedness ] ? d < 0.035 : d < 0.018; // hysteresis so a held pinch doesn't flicker

}

// a pose in the reference space, moved into world space
function toWorld( pos, target ) {

	return target.set( pos.x, pos.y, pos.z ).applyMatrix4( rig.matrixWorld );

}

function xrInput( dt, frame ) {

	const session = renderer.xr.getSession();
	const ref = renderer.xr.getReferenceSpace();
	rig.updateMatrixWorld( true );
	readHead();

	let forward = 0;
	let strafe = 0;
	let vertical = 0;
	let fast = false;
	let leftPinch = false;
	let rightPinch = false;
	const palms = [ null, null ];
	activeHaptics = [];
	const riding = vehicles.riding;
	const drive = { throttle: 0, brake: 0, steer: 0 };
	let menuPalm = null;
	let menuTip = null;
	let menuRay = null;
	let menuForce = false;
	let trackedHands = 0;

	for ( const source of session.inputSources ) {

		const side = source.handedness;
		const slot = side === 'left' ? 0 : side === 'right' ? 1 : - 1;

		if ( source.hand ) {

			trackedHands ++;
			const p = pinching( frame, source, ref );
			pinchState[ side ] = p;
			if ( side === 'left' ) leftPinch = p;
			if ( side === 'right' ) rightPinch = p;

			const palm = source.hand.get( 'middle-finger-metacarpal' );
			const pose = palm && frame.getJointPose ? frame.getJointPose( palm, ref ) : null;
			if ( pose && slot >= 0 ) palms[ slot ] = toWorld( pose.transform.position, new THREE.Vector3() );
			if ( pose && side === 'left' ) {

				// -Y of a hand joint points out of the palm
				const o = pose.transform.orientation;
				const normal = new THREE.Vector3( 0, - 1, 0 )
					.applyQuaternion( new THREE.Quaternion( o.x, o.y, o.z, o.w ) )
					.applyQuaternion( rig.quaternion );
				menuPalm = { pos: palms[ 0 ], normal };

			}

			if ( side === 'right' ) {

				const tipJoint = source.hand.get( 'index-finger-tip' );
				const tp = tipJoint && frame.getJointPose ? frame.getJointPose( tipJoint, ref ) : null;
				if ( tp ) menuTip = toWorld( tp.transform.position, new THREE.Vector3() );

			}

			continue;

		}

		const gp = source.gamepad;
		if ( source.gripSpace && slot >= 0 ) {

			const pose = frame.getPose( source.gripSpace, ref );
			if ( pose ) palms[ slot ] = toWorld( pose.transform.position, new THREE.Vector3() );

		}

		if ( ! gp ) continue;
		if ( gp.hapticActuators?.[ 0 ] ) activeHaptics.push( gp.hapticActuators[ 0 ] );
		const ax = gp.axes.length >= 4 ? gp.axes[ 2 ] : gp.axes[ 0 ] || 0;
		const ay = gp.axes.length >= 4 ? gp.axes[ 3 ] : gp.axes[ 1 ] || 0;
		const btn = i => !! ( gp.buttons[ i ] && gp.buttons[ i ].pressed );
		const dead = v => ( Math.abs( v ) < 0.15 ? 0 : v );

		const value = i => ( gp.buttons[ i ] ? gp.buttons[ i ].value : 0 );

		if ( side === 'left' ) {

			forward = - dead( ay );
			strafe = dead( ax );
			if ( btn( 3 ) ) fast = true; // click the stick to hurry
			if ( edge( 'left-x', btn( 4 ) ) && ! riding ) nextPlace( 1 );
			if ( edge( 'left-y', btn( 5 ) ) ) toggleFlight();
			drive.brake = value( 0 );
			drive.steer = dead( ax );
			if ( btn( 1 ) && palms[ 0 ] ) {

				// hold the left grip to show the menu above this controller
				menuForce = true;
				menuPalm = { pos: palms[ 0 ], normal: new THREE.Vector3( 0, 1, 0 ) };

			}

		} else if ( side === 'right' ) {

			drive.throttle = value( 0 );
			if ( source.targetRaySpace ) {

				const aim = frame.getPose( source.targetRaySpace, ref );
				if ( aim ) {

					const o = aim.transform.orientation;
					const dir = new THREE.Vector3( 0, 0, - 1 )
						.applyQuaternion( new THREE.Quaternion( o.x, o.y, o.z, o.w ) )
						.applyQuaternion( rig.quaternion );
					menuRay = { origin: toWorld( aim.transform.position, new THREE.Vector3() ), dir, pressed: edge( 'menu-trigger', btn( 0 ) ) };

				}

			}


			if ( edge( 'snap-r', ax > 0.7 ) ) turnBy( - Math.PI / 6 );
			if ( edge( 'snap-l', ax < - 0.7 ) ) turnBy( Math.PI / 6 );
			if ( flying ) vertical = - dead( ay );
			if ( btn( 3 ) ) fast = true;
			if ( edge( 'right-a', btn( 4 ) ) && ! riding ) nextPlace( 1 );
			if ( edge( 'right-b', btn( 5 ) ) ) toggleFlight();

			// trigger while charged: transmute where this controller points
			if ( edge( 'right-trigger', btn( 0 ) ) && alchemy.armed() && source.targetRaySpace ) {

				const aim = frame.getPose( source.targetRaySpace, ref );
				if ( aim ) {

					const o = aim.transform.orientation;
					const q = new THREE.Quaternion( o.x, o.y, o.z, o.w );
					const dir = new THREE.Vector3( 0, 0, - 1 ).applyQuaternion( q ).applyQuaternion( rig.quaternion );
					alchemy.cast( 'push', { origin: toWorld( aim.transform.position, _q ), dir } );

				}

			}

		}

	}

	// the palm-up menu (or left-grip menu with controllers)
	wrist.setItems( menuItems() );
	const menuOpen = wrist.update( dt, { head, palm: menuPalm, tip: menuTip, ray: menuForce ? menuRay : null, forceShow: menuForce } );

	if ( riding ) {

		// Hands: hold them like a wheel (or reins, or a tiller) and tilt to steer.
		// Right pinch to go, left pinch to brake or back up.
		const [ L, R ] = palms;
		if ( L && R && trackedHands === 2 ) {

			const flatDist = Math.hypot( L.x - R.x, L.z - R.z );
			if ( flatDist > 0.15 ) drive.steer = THREE.MathUtils.clamp( Math.atan2( L.y - R.y, flatDist ) / 0.7, - 1, 1 );

		}

		if ( rightPinch ) drive.throttle = 1;
		if ( leftPinch && ! menuOpen ) drive.brake = 1;
		pinchState._leftWas = leftPinch;
		alchemy.trackPalms( palms, head, headDir, dt );
		return drive;

	}

	// Hands: pinch your left fingers to walk where you look; pinch both to hurry.
	// Pinch left twice quickly to take off or land.
	const now = performance.now() / 1000;
	if ( leftPinch && ! pinchState._leftWas ) {

		if ( now - leftPinchEnd < 0.4 && leftPinchLen < 0.35 ) toggleFlight();
		leftPinchStart = now;

	}

	if ( ! leftPinch && pinchState._leftWas ) {

		leftPinchEnd = now;
		leftPinchLen = now - leftPinchStart;

	}

	pinchState._leftWas = leftPinch;

	if ( leftPinch ) {

		forward = 1;
		fast = rightPinch;

	}

	// Hold a right-hand pinch on its own for a second to travel to the next landmark.
	if ( rightPinch && ! leftPinch ) {

		travelHold += dt;
		setTravelProgress( travelHold / 1.0 );
		if ( travelHold >= 1.0 ) {

			travelHold = - 1.5; // cooldown before another jump can start
			nextPlace( 1 );

		}

	} else {

		travelHold = Math.min( 0, travelHold + dt );
		setTravelProgress( 0 );

	}

	alchemy.trackPalms( palms, head, headDir, dt );

	const speed = flying ? ( fast ? BOOST : FLY ) : ( fast ? RUN : WALK );
	stepPlayer( dt, forward, strafe, speed, vertical );
	return null;

}

// ---------------------------------------------------------------- in-headset panels

function makePanel( w, h, scale ) {

	const c = document.createElement( 'canvas' );
	c.width = w;
	c.height = h;
	const tex = new THREE.CanvasTexture( c );
	tex.colorSpace = THREE.SRGBColorSpace;
	const mat = new THREE.MeshBasicMaterial( { map: tex, transparent: true, depthTest: false, depthWrite: false, toneMapped: false, fog: false } );
	const mesh = new THREE.Mesh( new THREE.PlaneGeometry( scale * w / h, scale ), mat );
	mesh.renderOrder = 999;
	return { canvas: c, ctx: c.getContext( '2d' ), tex, mesh };

}

// Arrival card and notices, shown low in your view for a few seconds.
const toast = makePanel( 1024, 256, 0.16 );
toast.mesh.position.set( 0, - 0.2, - 0.9 );
toast.mesh.visible = false;
camera.add( toast.mesh );

function showToast( title, sub ) {

	const { ctx, canvas: c, tex } = toast;
	ctx.clearRect( 0, 0, c.width, c.height );
	ctx.fillStyle = 'rgba(28, 36, 33, 0.82)';
	roundRect( ctx, 8, 8, c.width - 16, c.height - 16, 36 );
	ctx.fill();
	ctx.fillStyle = '#a8d5d1';
	ctx.fillRect( 64, 70, 6, 116 );
	ctx.fillStyle = '#f3efe6';
	ctx.font = '600 72px "Cormorant Garamond", Georgia, serif';
	ctx.fillText( title, 100, 128 );
	ctx.fillStyle = '#c9d2cc';
	ctx.font = '34px Karla, system-ui, sans-serif';
	ctx.fillText( sub.length > 62 ? sub.slice( 0, 60 ) + '…' : sub, 102, 186 );
	tex.needsUpdate = true;
	toastUntil = performance.now() + 5000;

}

// Attribution, small and low in your view, as Google requires.
const credit = makePanel( 1024, 64, 0.022 );
credit.mesh.position.set( 0, - 0.42, - 0.9 );
credit.mesh.visible = false;
camera.add( credit.mesh );
let creditText = '';

function drawCredit( text ) {

	if ( text === creditText ) return;
	creditText = text;
	const { ctx, canvas: c, tex } = credit;
	ctx.clearRect( 0, 0, c.width, c.height );
	ctx.fillStyle = 'rgba(255,255,255,0.75)';
	ctx.font = '600 34px Karla, system-ui, sans-serif';
	ctx.textAlign = 'center';
	ctx.fillText( text, c.width / 2, 44 );
	tex.needsUpdate = true;

}

// Ring that fills while you hold the right-hand travel pinch.
const ring = new THREE.Mesh(
	new THREE.RingGeometry( 0.018, 0.024, 48, 1, Math.PI / 2, 0.0001 ),
	new THREE.MeshBasicMaterial( { color: 0xa8d5d1, depthTest: false, transparent: true, fog: false, toneMapped: false } ),
);
ring.position.set( 0, 0, - 0.8 );
ring.renderOrder = 999;
ring.visible = false;
camera.add( ring );
let ringShown = 0;

function setTravelProgress( p ) {

	p = THREE.MathUtils.clamp( p, 0, 1 );
	if ( p === ringShown ) return;
	ringShown = p;
	ring.visible = p > 0.05;
	ring.geometry.dispose();
	ring.geometry = new THREE.RingGeometry( 0.018, 0.024, 48, 1, Math.PI / 2, Math.max( 0.0001, - p * Math.PI * 2 ) );

}

// Comfort vignette: the edges of your view dim while you move fast or snap-turn,
// which cuts motion sickness a lot when flying.
const vignette = new THREE.Mesh(
	new THREE.PlaneGeometry( 2, 2 ),
	new THREE.ShaderMaterial( {
		uniforms: { uStrength: { value: 0 } },
		vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 ); }',
		fragmentShader: `
			uniform float uStrength; varying vec2 vUv;
			void main(){
				float d = length( vUv - 0.5 ) * 2.0;
				float a = smoothstep( mix( 1.0, 0.35, uStrength ), mix( 1.3, 0.75, uStrength ), d ) * uStrength;
				gl_FragColor = vec4( 0.0, 0.0, 0.0, a );
			}`,
		transparent: true, depthTest: false, depthWrite: false,
	} ),
);
vignette.position.set( 0, 0, - 0.3 );
vignette.renderOrder = 1000;
vignette.visible = false;
camera.add( vignette );
let vignetteLevel = 0;

function roundRect( ctx, x, y, w, h, r ) {

	ctx.beginPath();
	ctx.moveTo( x + r, y );
	ctx.arcTo( x + w, y, x + w, y + h, r );
	ctx.arcTo( x + w, y + h, x, y + h, r );
	ctx.arcTo( x, y + h, x, y, r );
	ctx.arcTo( x, y, x + w, y, r );
	ctx.closePath();

}

// ---------------------------------------------------------------- menu & sessions

function openMenu() {

	if ( document.pointerLockElement ) document.exitPointerLock();
	ui.menu.open = true;
	ui.hud.hidden = true;
	ui.crosshair.hidden = true;
	alchemy.setScreenGlow( false );

}

function closeMenu() {

	ui.menu.open = false;
	ui.hud.hidden = false;

}

function haveKey() {

	return OFFLINE || !! store.get( 'key' );

}

function setStatus( text ) {

	ui.status.textContent = text;

}

ui.key.value = store.get( 'key', '' );
ui.keyToggle.addEventListener( 'click', () => {

	const show = ui.key.type === 'password';
	ui.key.type = show ? 'text' : 'password';
	ui.keyToggle.textContent = show ? 'Hide' : 'Show';

} );

ui.keyForm.addEventListener( 'submit', e => {

	e.preventDefault();
	const k = ui.key.value.trim();
	if ( ! k ) {

		ui.keyState.textContent = 'Paste your Google Maps API key first.';
		ui.keyState.dataset.state = 'bad';
		return;

	}

	store.set( 'key', k );
	ui.keyState.textContent = 'Checking the key with Google…';
	ui.keyState.dataset.state = '';
	if ( ! OFFLINE ) startTiles( k );
	refreshButtons();

} );

ui.place.addEventListener( 'change', () => {

	store.set( 'place', ui.place.value );
	goTo( currentPlace(), true );

} );

ui.quality.addEventListener( 'change', () => {

	store.set( 'quality', ui.quality.value );
	applyQuality();

} );

ui.enterScreen.addEventListener( 'click', () => {

	closeMenu();
	ambience.start();

} );

ui.hudMenu.addEventListener( 'click', openMenu );
for ( const k of CAR_TYPE_KEYS ) {

	const o = document.createElement( 'option' );
	o.value = k;
	o.textContent = CAR_TYPES[ k ].label;
	o.title = 'Modelled on the ' + CAR_TYPES[ k ].basedOn;
	ui.carModel.append( o );

}

ui.carModel.value = CAR_TYPES[ carChoice ] ? carChoice : 'rangerover';

// ---------------------------------------------------------------- your own car model
// Kept in this browser's IndexedDB, never uploaded: a model's licence usually
// allows personal use but not redistribution, and the game's site is public.

const idb = {
	open() {

		return new Promise( ( resolve, reject ) => {

			const req = indexedDB.open( 'charleston-xr', 1 );
			req.onupgradeneeded = () => req.result.createObjectStore( 'files' );
			req.onsuccess = () => resolve( req.result );
			req.onerror = () => reject( req.error );

		} );

	},
	async run( mode, fn ) {

		const db = await this.open();
		return new Promise( ( resolve, reject ) => {

			const tx = db.transaction( 'files', mode );
			const req = fn( tx.objectStore( 'files' ) );
			tx.oncomplete = () => resolve( req?.result );
			tx.onerror = () => reject( tx.error );

		} );

	},
	get: k => idb.run( 'readonly', s => s.get( k ) ),
	set: ( k, v ) => idb.run( 'readwrite', s => s.put( v, k ) ),
	del: k => idb.run( 'readwrite', s => s.delete( k ) ),
};

let customFile = null; // { name, buf, turn }

function showCustomOption( label ) {

	let opt = ui.carModel.querySelector( 'option[value="custom"]' );
	if ( ! opt ) {

		opt = document.createElement( 'option' );
		opt.value = 'custom';
		ui.carModel.append( opt );

	}

	opt.textContent = label;

}

async function loadCustomModel( file, { select = true } = {} ) {

	ui.modelState.textContent = 'Loading ' + file.name + '…';
	const loader = new GLTFLoader().setDRACOLoader( draco );
	try {

		const gltf = await loader.parseAsync( file.buf.slice( 0 ), './' );
		const name = file.name.replace( /\.glb$/i, '' );
		const info = registerCustomCar( gltf.scene, { name, turn: file.turn } );
		customFile = file;
		showCustomOption( 'Your model: ' + name );
		if ( select ) setCarChoice( 'custom' );
		ui.modelTurn.disabled = false;
		ui.modelRemove.disabled = false;
		const heavy = info.tris > 300000 ? ' That is heavy for the headset; expect a lower frame rate.' : '';
		ui.modelState.textContent = `Loaded “${ name }”: ${ info.L.toFixed( 2 ) } m long, ${ info.H.toFixed( 2 ) } m tall, ${ info.tris.toLocaleString() } triangles.${ heavy } Summon a car to drive it.`;

	} catch ( err ) {

		ui.modelState.textContent = 'Could not read that file as a 3D model: ' + ( err?.message || err ) + '. Use a single .glb file.';

	}

}

ui.modelFile.addEventListener( 'change', async () => {

	const f = ui.modelFile.files?.[ 0 ];
	if ( ! f ) return;
	const file = { name: f.name, buf: await f.arrayBuffer(), turn: false };
	await loadCustomModel( file );
	try {

		await idb.set( 'car-model', file );

	} catch { /* storage blocked: the model works until the page is closed */ }

} );

ui.modelTurn.addEventListener( 'click', async () => {

	if ( ! customFile ) return;
	customFile.turn = ! customFile.turn;
	await loadCustomModel( customFile );
	try {

		await idb.set( 'car-model', customFile );

	} catch { /* fine without storage */ }

} );

ui.modelRemove.addEventListener( 'click', async () => {

	customFile = null;
	clearCustomCar();
	ui.carModel.querySelector( 'option[value="custom"]' )?.remove();
	if ( carChoice === 'custom' ) setCarChoice( 'rangerover' );
	ui.modelTurn.disabled = true;
	ui.modelRemove.disabled = true;
	ui.modelFile.value = '';
	ui.modelState.textContent = 'Removed. Load a .glb file to use your own model.';
	try {

		await idb.del( 'car-model' );

	} catch { /* nothing stored */ }

} );

// bring back a model loaded on an earlier visit
idb.get( 'car-model' ).then( f => {

	if ( f?.buf ) loadCustomModel( f, { select: customWasChosen } );

} ).catch( () => {} );
ui.carModel.addEventListener( 'change', () => {

	setCarChoice( ui.carModel.value );
	ui.carModel.blur();

} );
for ( const b of document.querySelectorAll( '[data-vehicle]' ) ) {

	b.addEventListener( 'click', () => {

		const act = b.dataset.vehicle;
		if ( act === 'boat' ) summonBoat();
		else if ( act === 'toggle' ) vehicles.riding ? exitVehicle() : enterNearest();
		else summon( act );
		b.blur();

	} );

}

let xrSupported = false;

async function checkXR() {

	try {

		xrSupported = !! ( navigator.xr && await navigator.xr.isSessionSupported( 'immersive-vr' ) );

	} catch {

		xrSupported = false;

	}

	ui.xrNote.hidden = xrSupported;
	refreshButtons();

}

function refreshButtons() {

	const ready = haveKey();
	ui.enterScreen.disabled = ! ready;
	ui.enterXR.disabled = ! ( ready && xrSupported );
	setStatus( ready ? '' : 'Add your API key to start.' );

}

ui.enterXR.addEventListener( 'click', async () => {

	try {

		const session = await navigator.xr.requestSession( 'immersive-vr', {
			optionalFeatures: [ 'local-floor', 'hand-tracking', 'layers' ],
		} );
		ambience.start();
		await renderer.xr.setSession( session );

	} catch ( err ) {

		setStatus( 'The headset view could not start: ' + ( err?.message || err ) );

	}

} );

renderer.xr.addEventListener( 'sessionstart', () => {

	ui.menu.open = false;
	ui.hud.hidden = true;
	ui.crosshair.hidden = true;
	alchemy.setScreenGlow( false );
	toast.mesh.visible = true;
	credit.mesh.visible = true;
	vignette.visible = true;
	camera.position.set( 0, 0, 0 );
	camera.rotation.set( 0, 0, 0 );
	applyQuality();
	showToast( currentPlace().name, currentPlace().blurb );

} );

renderer.xr.addEventListener( 'sessionend', () => {

	toast.mesh.visible = false;
	credit.mesh.visible = false;
	vignette.visible = false;
	ring.visible = false;
	camera.position.set( 0, EYE, 0 );
	camera.quaternion.identity();
	yaw = rig.rotation.y;
	pitch = 0;
	ambience.setFlightSpeed( 0 );
	applyQuality();
	openMenu();

} );

addEventListener( 'resize', () => {

	camera.aspect = window.innerWidth / window.innerHeight;
	camera.updateProjectionMatrix();
	renderer.setSize( window.innerWidth, window.innerHeight );

} );

// ---------------------------------------------------------------- loop

// Pixels per eye, so the tiles load the detail each eye can actually show.
function xrEyeResolution() {

	const layer = renderer.xr.getBaseLayer?.();
	let w = layer?.textureWidth || layer?.framebufferWidth || 0;
	let h = layer?.textureHeight || layer?.framebufferHeight || 0;
	if ( ! w || ! h ) return [ 1800, 1900 ];
	if ( w > h * 1.5 ) w /= 2; // both eyes side by side in one image
	return [ w, h ];

}

// Optional readout to help diagnose performance in the headset.
let fpsFrames = 0;
let fpsLast = 0;
let fps = 0;
function statsLine() {

	if ( ! ui.stats.checked ) return '';
	const st = tiles?.stats;
	const loading = st ? st.queued + st.downloading + st.parsing : 0;
	const tr = traffic.stats;
	return `${ fps } fps · ${ loading } loading · ${ st ? st.visible : 0 } tiles · ${ tr.cars } cars · ${ tr.people } people · `;

}

const clock = new THREE.Clock();
let labelTimer = 0;
let attrTimer = 0;

renderer.setAnimationLoop( ( time, frame ) => {

	const dt = Math.min( clock.getDelta(), 0.1 );
	const inXR = renderer.xr.isPresenting;
	fpsFrames ++;
	if ( time - fpsLast > 1000 ) {

		fps = Math.round( fpsFrames * 1000 / ( time - fpsLast ) );
		fpsFrames = 0;
		fpsLast = time;

	}

	if ( rootReady ) {

		let drive = null;
		if ( inXR ) drive = xrInput( dt, frame );
		else if ( ! ui.menu.open ) drive = screenInput( dt );
		else if ( ! vehicles.riding ) {

			rig.rotation.y = yaw;
			camera.rotation.set( pitch, 0, 0 );
			stepPlayer( dt, 0, 0, 0 );

		}

		vehicles.update( dt, drive );
		traffic.update( dt );
		ambience.setListener( head, headDir );
		if ( vehicles.riding ) {

			placeInSeat();
			speedNow = Math.abs( vehicles.riding.speed );

		}

		labelTimer -= dt;
		if ( labelTimer <= 0 ) {

			labelTimer = 0.25;
			updateModeLabel();

		}

	}

	alchemy.update( dt );
	ambience.setFlightSpeed( flying ? speedNow : 0 );

	if ( tiles ) {

		camera.updateMatrixWorld();
		if ( inXR ) tiles.setResolution( camera, ...xrEyeResolution() );
		else tiles.setResolutionFromRenderer( camera, renderer );
		tiles.update();

		attrTimer -= dt;
		if ( attrTimer <= 0 ) {

			attrTimer = 0.5;
			const text = tiles.getAttributions()
				.filter( a => a.type === 'string' && a.value )
				.map( a => a.value )
				.join( ' · ' );
			const line = statsLine() + 'Google' + ( text ? ' · ' + text : '' ) + ( traffic.ready ? ' · Streets © OpenStreetMap contributors' : '' );
			ui.attribution.textContent = line;
			drawCredit( line );

		}

	}

	if ( inXR ) {

		toast.mesh.visible = performance.now() < toastUntil;
		turnFlash = Math.max( 0, turnFlash - dt );
		const want = Math.max( THREE.MathUtils.clamp( ( speedNow - 3 ) / 20, 0, 0.85 ), turnFlash > 0 ? 0.6 : 0 );
		vignetteLevel += ( want - vignetteLevel ) * Math.min( 1, dt * 6 );
		vignette.material.uniforms.uStrength.value = vignetteLevel;
		vignette.visible = vignetteLevel > 0.01;

	}

	readHead();
	sky.position.copy( head );
	renderer.render( scene, camera );

} );

// ---------------------------------------------------------------- boot

if ( OFFLINE ) startTestGround();
else if ( haveKey() ) {

	ui.keyState.textContent = 'Checking the saved key with Google…';
	startTiles( store.get( 'key' ) );

}

updateModeLabel();
ui.menu.open = true;
checkXR();
refreshButtons();

// handy for testing from the browser console
// place the screen camera at x,y,z looking at tx,ty,tz (for screenshots and debugging)
function setView( x, y, z, tx, ty, tz ) {

	const dx = tx - x, dy = ty - y, dz = tz - z;
	yaw = Math.atan2( - dx, - dz );
	pitch = Math.atan2( dy, Math.hypot( dx, dz ) );
	rig.position.set( x, y - EYE, z );
	flying = true; // hold position instead of falling
	awaitingGround = false;

}

window.charleston = { setView, wrist, menuItems, alchemy, vehicles, traffic, summon, summonBoat, enterVehicle, exitVehicle, toggleFlight, nextPlace, rig, camera, notify, screenCast, keys };
