import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { TilesRenderer } from '3d-tiles-renderer/three';
import { GoogleCloudAuthPlugin } from '3d-tiles-renderer/core/plugins';
import {
	GLTFExtensionsPlugin,
	ReorientationPlugin,
	TilesFadePlugin,
	TileCompressionPlugin,
	UnloadTilesPlugin,
} from '3d-tiles-renderer/three/plugins';
import { PLACES, ORIGIN } from './places.js';
import { HarborAmbience } from './audio.js';

const D2R = Math.PI / 180;
const WALK = 1.4; // m/s, an easy stroll
const RUN = 4.0;
const EYE = 1.7; // eye height in screen mode
const STEP_UP = 0.55; // tallest curb or stair you can step onto
const BODY = 0.35; // how close you can get to a wall
const QUALITY = { sharp: 8, balanced: 14, fast: 24 };

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
	hudMenu: $( 'hud-menu' ),
	attribution: $( 'attribution' ),
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

// ---------------------------------------------------------------- scene

const renderer = new THREE.WebGLRenderer( { antialias: true, powerPreference: 'high-performance' } );
renderer.setPixelRatio( Math.min( window.devicePixelRatio, 2 ) );
renderer.setSize( window.innerWidth, window.innerHeight );
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.55;
renderer.xr.enabled = true;
renderer.xr.setReferenceSpaceType( 'local-floor' );
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
scene.add( sky );

// ---------------------------------------------------------------- city tiles

let tiles = null;
let rootReady = false;
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
	tiles.registerPlugin( new TileCompressionPlugin() );
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

		// Keep the photographed colours exactly as captured.
		model.traverse( o => {

			if ( o.material ) o.material.toneMapped = false;

		} );

	} );

	tiles.addEventListener( 'load-root-tileset', () => {

		requestAnimationFrame( () => {

			rootReady = true;
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

function applyQuality() {

	if ( ! tiles ) return;
	const base = QUALITY[ ui.quality.value ] ?? QUALITY.balanced;
	// In the headset each eye already renders at high resolution, so ease off a little.
	tiles.errorTarget = renderer.xr.isPresenting ? base * 1.25 : base;

}

// ---------------------------------------------------------------- geo helpers

const _v = new THREE.Vector3();

function toLocal( lat, lon, height, target = new THREE.Vector3() ) {

	tiles.group.updateMatrixWorld( true );
	tiles.ellipsoid.getCartographicToPosition( lat * D2R, lon * D2R, height, target );
	return target.applyMatrix4( tiles.group.matrixWorld );

}

function currentPlace() {

	return PLACES.find( p => p.id === ui.place.value ) || PLACES[ 0 ];

}

// ---------------------------------------------------------------- player pose

const head = new THREE.Vector3();
const headDir = new THREE.Vector3();
let yaw = 0;
let pitch = 0;
let vy = 0;
let awaitingGround = true;
let spawnedAt = 0;

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

	readHead();
	const before = head.clone();
	rig.rotation.y += angle;
	yaw = rig.rotation.y;
	readHead();
	rig.position.x += before.x - head.x;
	rig.position.z += before.z - head.z;

}

function goTo( place, initial = false ) {

	if ( ! rootReady ) return;
	ui.place.value = place.id;
	store.set( 'place', place.id );

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
	camera.rotation.x = renderer.xr.isPresenting ? camera.rotation.x : 0;
	vy = 0;
	awaitingGround = true;
	spawnedAt = performance.now();

	ui.hudPlace.textContent = place.name;
	showToast( place.name, place.blurb );
	if ( ! initial ) ui.loading.hidden = false;

}

function nextPlace( dir = 1 ) {

	const i = PLACES.indexOf( currentPlace() );
	goTo( PLACES[ ( i + dir + PLACES.length ) % PLACES.length ] );

}

// ---------------------------------------------------------------- physics

const ray = new THREE.Raycaster();
ray.firstHitOnly = true;
const hits = [];
const _n = new THREE.Vector3();
const _m = new THREE.Matrix3();
const DOWN = new THREE.Vector3( 0, - 1, 0 );

function castRay( origin, dir, far ) {

	if ( ! tiles ) return null;
	ray.set( origin, dir );
	ray.near = 0;
	ray.far = far;
	hits.length = 0;
	tiles.raycast( ray, hits );
	if ( ! hits.length ) return null;
	hits.sort( ( a, b ) => a.distance - b.distance );
	return hits[ 0 ];

}

function hitNormal( hit, target ) {

	if ( ! hit.face ) return target.set( 0, 0, 0 );
	_m.getNormalMatrix( hit.object.matrixWorld );
	return target.copy( hit.face.normal ).applyMatrix3( _m ).normalize();

}

function groundBelow( x, z, fromY, far ) {

	const hit = castRay( _v.set( x, fromY, z ), DOWN, far );
	return hit ? hit.point.y : null;

}

const move = new THREE.Vector3();
const fwd = new THREE.Vector3();
const right = new THREE.Vector3();

// forward/strafe in -1..1, speed in m/s
function stepPlayer( dt, forward, strafe, speed ) {

	readHead();

	// Waiting to land: probe from high above until the ground under us has loaded.
	if ( awaitingGround ) {

		const g = groundBelow( head.x, head.z, rig.position.y + 400, 800 );
		const settled = tiles && tiles.stats.downloading + tiles.stats.parsing < 4;
		if ( g !== null && ( settled || performance.now() - spawnedAt > 6000 ) ) {

			rig.position.y = g;
			awaitingGround = false;
			ui.loading.hidden = true;

		}

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
	if ( move.lengthSq() > 0 ) {

		const waist = new THREE.Vector3( head.x, rig.position.y + 1.0, head.z );
		for ( let pass = 0; pass < 2 && move.lengthSq() > 0; pass ++ ) {

			const len = move.length();
			const hit = castRay( waist, move.clone().divideScalar( len ), len + BODY );
			if ( ! hit ) break;
			hitNormal( hit, _n );
			_n.y = 0;
			if ( _n.lengthSq() < 1e-4 ) {

				move.set( 0, 0, 0 );
				break;

			}

			_n.normalize();
			const into = move.dot( _n );
			if ( into < 0 ) move.addScaledVector( _n, - into );
			if ( pass === 1 ) move.set( 0, 0, 0 );

		}

	}

	const nx = head.x + move.x;
	const nz = head.z + move.z;
	const g = groundBelow( nx, nz, rig.position.y + 1.6, 300 );

	if ( g === null ) {

		// Nothing loaded under the next step yet: hold still rather than walk into a void.
		return;

	}

	if ( g > rig.position.y + STEP_UP && move.lengthSq() > 0 ) return; // a ledge too tall to climb

	rig.position.x += move.x;
	rig.position.z += move.z;

	if ( g >= rig.position.y - 0.05 ) {

		// Stepping up (or on level ground): ease onto the new height.
		rig.position.y += ( g - rig.position.y ) * Math.min( 1, dt * 12 );
		vy = 0;

	} else {

		vy -= 9.8 * dt;
		rig.position.y = Math.max( g, rig.position.y + vy * dt );
		if ( rig.position.y === g ) vy = 0;

	}

}

// ---------------------------------------------------------------- screen controls

const keys = new Set();
let dragging = false;

addEventListener( 'keydown', e => {

	if ( e.target.closest( 'input, select, textarea' ) ) return;
	keys.add( e.code );
	if ( e.code === 'Escape' && ! ui.menu.open ) openMenu();
	if ( e.code === 'KeyN' ) nextPlace( 1 );
	if ( e.code === 'KeyB' ) nextPlace( - 1 );

} );
addEventListener( 'keyup', e => keys.delete( e.code ) );
addEventListener( 'blur', () => keys.clear() );

const canvas = renderer.domElement;
canvas.addEventListener( 'pointerdown', e => {

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

	const f = ( keys.has( 'KeyW' ) || keys.has( 'ArrowUp' ) ? 1 : 0 ) - ( keys.has( 'KeyS' ) || keys.has( 'ArrowDown' ) ? 1 : 0 );
	const s = ( keys.has( 'KeyD' ) ? 1 : 0 ) - ( keys.has( 'KeyA' ) ? 1 : 0 );
	const turn = ( keys.has( 'ArrowLeft' ) ? 1 : 0 ) - ( keys.has( 'ArrowRight' ) ? 1 : 0 );
	yaw += turn * 1.6 * dt;
	rig.rotation.y = yaw;
	camera.rotation.set( pitch, 0, 0 );
	const speed = keys.has( 'ShiftLeft' ) || keys.has( 'ShiftRight' ) ? RUN : WALK;
	// walk along the ground, not where the camera tilts
	stepPlayer( dt, f, s, speed );

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

function pinching( frame, source, ref ) {

	const thumb = source.hand.get( 'thumb-tip' );
	const index = source.hand.get( 'index-finger-tip' );
	if ( ! thumb || ! index || ! frame.getJointPose ) return false;
	const a = frame.getJointPose( thumb, ref );
	const b = frame.getJointPose( index, ref );
	if ( ! a || ! b ) return false;
	const dx = a.transform.position.x - b.transform.position.x;
	const dy = a.transform.position.y - b.transform.position.y;
	const dz = a.transform.position.z - b.transform.position.z;
	const d = Math.hypot( dx, dy, dz );
	const was = pinchState[ source.handedness ];
	return was ? d < 0.035 : d < 0.018; // hysteresis so a held pinch doesn't flicker

}

function xrInput( dt, frame ) {

	const session = renderer.xr.getSession();
	const ref = renderer.xr.getReferenceSpace();
	let forward = 0;
	let strafe = 0;
	let speed = WALK;
	let leftPinch = false;
	let rightPinch = false;

	for ( const source of session.inputSources ) {

		const side = source.handedness;

		if ( source.hand ) {

			const p = pinching( frame, source, ref );
			pinchState[ side ] = p;
			if ( side === 'left' ) leftPinch = p;
			if ( side === 'right' ) rightPinch = p;
			continue;

		}

		const gp = source.gamepad;
		if ( ! gp ) continue;
		const ax = gp.axes.length >= 4 ? gp.axes[ 2 ] : gp.axes[ 0 ] || 0;
		const ay = gp.axes.length >= 4 ? gp.axes[ 3 ] : gp.axes[ 1 ] || 0;
		const btn = i => !! ( gp.buttons[ i ] && gp.buttons[ i ].pressed );

		if ( side === 'left' ) {

			const dead = v => ( Math.abs( v ) < 0.15 ? 0 : v );
			forward = - dead( ay );
			strafe = dead( ax );
			if ( btn( 3 ) || btn( 1 ) ) speed = RUN; // click the stick or squeeze grip to hurry
			if ( edge( 'left-x', btn( 4 ) ) ) nextPlace( 1 );
			if ( edge( 'left-y', btn( 5 ) ) ) nextPlace( - 1 );

		} else if ( side === 'right' ) {

			if ( edge( 'snap-r', ax > 0.7 ) ) turnBy( - Math.PI / 6 );
			if ( edge( 'snap-l', ax < - 0.7 ) ) turnBy( Math.PI / 6 );
			if ( edge( 'right-a', btn( 4 ) ) ) nextPlace( 1 );
			if ( edge( 'right-b', btn( 5 ) ) ) nextPlace( - 1 );

		}

	}

	// Hands: pinch your left fingers to walk where you look; pinch both to hurry.
	// Hold a right-hand pinch on its own for a second to travel to the next landmark.
	if ( leftPinch ) {

		forward = 1;
		speed = rightPinch ? RUN : WALK;

	}

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

	stepPlayer( dt, forward, strafe, speed );

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

// Arrival card, shown low in your view for a few seconds.
const toast = makePanel( 1024, 256, 0.16 );
toast.mesh.position.set( 0, - 0.2, - 0.9 );
toast.mesh.visible = false;
camera.add( toast.mesh );
let toastUntil = 0;

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
const ringGeo = new THREE.RingGeometry( 0.018, 0.024, 48, 1, Math.PI / 2, 0.0001 );
const ring = new THREE.Mesh( ringGeo, new THREE.MeshBasicMaterial( { color: 0xa8d5d1, depthTest: false, transparent: true, fog: false, toneMapped: false } ) );
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

const ambience = new HarborAmbience();

function openMenu() {

	if ( document.pointerLockElement ) document.exitPointerLock();
	ui.menu.open = true;
	ui.hud.hidden = true;

}

function closeMenu() {

	ui.menu.open = false;
	ui.hud.hidden = false;

}

function haveKey() {

	return !! store.get( 'key' );

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
	startTiles( k );
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
	toast.mesh.visible = true;
	credit.mesh.visible = true;
	camera.position.set( 0, 0, 0 );
	camera.rotation.set( 0, 0, 0 );
	applyQuality();
	showToast( currentPlace().name, currentPlace().blurb );

} );

renderer.xr.addEventListener( 'sessionend', () => {

	toast.mesh.visible = false;
	credit.mesh.visible = false;
	ring.visible = false;
	camera.position.set( 0, EYE, 0 );
	camera.quaternion.identity();
	yaw = rig.rotation.y;
	pitch = 0;
	applyQuality();
	openMenu();

} );

addEventListener( 'resize', () => {

	camera.aspect = window.innerWidth / window.innerHeight;
	camera.updateProjectionMatrix();
	renderer.setSize( window.innerWidth, window.innerHeight );

} );

// ---------------------------------------------------------------- loop

const clock = new THREE.Clock();
let attrTimer = 0;

renderer.setAnimationLoop( ( time, frame ) => {

	const dt = Math.min( clock.getDelta(), 0.1 );
	const inXR = renderer.xr.isPresenting;

	if ( tiles && rootReady ) {

		if ( inXR ) xrInput( dt, frame );
		else if ( ! ui.menu.open ) screenInput( dt );
		else {

			rig.rotation.y = yaw;
			camera.rotation.set( pitch, 0, 0 );
			stepPlayer( dt, 0, 0, 0 );

		}

	}

	if ( tiles ) {

		camera.updateMatrixWorld();
		if ( inXR ) tiles.setResolution( camera, 1800, 1900 );
		else tiles.setResolutionFromRenderer( camera, renderer );
		tiles.update();

		attrTimer -= dt;
		if ( attrTimer <= 0 ) {

			attrTimer = 1;
			const text = tiles.getAttributions()
				.filter( a => a.type === 'string' && a.value )
				.map( a => a.value )
				.join( ' · ' );
			const line = 'Google' + ( text ? ' · ' + text : '' );
			ui.attribution.textContent = line;
			drawCredit( line );

		}

	}

	if ( inXR ) toast.mesh.visible = performance.now() < toastUntil;

	readHead();
	sky.position.copy( head );
	renderer.render( scene, camera );

} );

// ---------------------------------------------------------------- boot

if ( haveKey() ) {

	ui.keyState.textContent = 'Checking the saved key with Google…';
	startTiles( store.get( 'key' ) );

}

ui.menu.open = true;
checkXR();
refreshButtons();
