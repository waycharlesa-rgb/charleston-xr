// Traffic and pedestrians on downtown Charleston's real street network
// (OpenStreetMap). Cars keep right, respect one-way streets, take turns at
// intersections, follow each other and stop for people, crosswalks and stone.
// Pedestrians walk the mapped sidewalks and crosswalks and get out of your way.
// Both are drawn with instancing so dozens of them cost only a few draw calls.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { buildCarModel, CAR_TYPES, CAR_TYPE_KEYS, shadowTexture } from './carmodels.js';
import { fetchOverpass } from './osm.js';

const DRIVE = new Set( [ 'trunk', 'trunk_link', 'primary', 'primary_link', 'secondary', 'secondary_link', 'tertiary', 'tertiary_link', 'unclassified', 'residential', 'living_street' ] );
const WALK = new Set( [ 'footway', 'pedestrian', 'path' ] );
const SPEED = { trunk: 13, trunk_link: 9, primary: 11, primary_link: 8, secondary: 11, secondary_link: 8, tertiary: 9, tertiary_link: 7, unclassified: 7, residential: 7, living_street: 4 };

const MAX_CARS = 16;
const MAX_PEDS = 36;
const CAR_NEAR = 70, CAR_FAR = 230, CAR_DROP = 270;
const PED_NEAR = 20, PED_FAR = 110, PED_DROP = 150;

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3();
const _p = new THREE.Vector3();
const _e = new THREE.Euler();
const UP = new THREE.Vector3( 0, 1, 0 );
const HIDDEN = new THREE.Matrix4().makeScale( 0, 0, 0 );

// ---------------------------------------------------------------- instanced car

function instancedCars( type, count ) {

	const model = buildCarModel( type, { paint: 0xffffff, detail: 80 } ); // lighter body for traffic
	model.root.updateMatrixWorld( true );
	const byMat = new Map();
	model.root.traverse( o => {

		if ( ! o.isMesh || o.userData.noInstance ) return;
		let g = o.geometry.clone().applyMatrix4( o.matrixWorld );
		for ( const k of Object.keys( g.attributes ) ) if ( k !== 'position' && k !== 'normal' && ! ( k === 'uv' && o.material.map ) ) g.deleteAttribute( k );
		if ( g.index ) g = g.toNonIndexed();
		if ( ! g.attributes.uv && o.material.map ) return;
		if ( o.matrixWorld.determinant() < 0 ) {

			// mirrored parts (left-hand wheels): restore the triangle winding
			for ( const name of Object.keys( g.attributes ) ) {

				const a = g.attributes[ name ];
				for ( let i = 0; i < a.count; i += 3 ) {

					for ( let c = 0; c < a.itemSize; c ++ ) {

						const t = a.array[ ( i + 1 ) * a.itemSize + c ];
						a.array[ ( i + 1 ) * a.itemSize + c ] = a.array[ ( i + 2 ) * a.itemSize + c ];
						a.array[ ( i + 2 ) * a.itemSize + c ] = t;

					}

				}

			}

		}

		if ( ! byMat.has( o.material ) ) byMat.set( o.material, [] );
		byMat.get( o.material ).push( g );

	} );

	const meshes = [];
	let paint = null;
	for ( const [ mat, geos ] of byMat ) {

		// all parts that share a material must have the same attributes to merge
		const keys = Object.keys( geos[ 0 ].attributes ).sort().join();
		const usable = geos.filter( g => Object.keys( g.attributes ).sort().join() === keys );
		const im = new THREE.InstancedMesh( mergeGeometries( usable ), mat, count );
		im.frustumCulled = false;
		im.instanceMatrix.setUsage( THREE.DynamicDrawUsage );
		for ( let i = 0; i < count; i ++ ) im.setMatrixAt( i, HIDDEN );
		if ( mat === model.mats.paint ) {

			paint = im;
			for ( let i = 0; i < count; i ++ ) im.setColorAt( i, new THREE.Color( 1, 1, 1 ) );

		}

		meshes.push( im );

	}

	return { meshes, paint, def: model.def };

}

// common car colours on American roads: white, black, greys and silver lead
const CAR_COLOURS = [
	[ 0xf2f2ee, 25 ], [ 0x111214, 20 ], [ 0x5c5f63, 17 ], [ 0xb8bcc2, 12 ], [ 0x1f3550, 9 ],
	[ 0x8e1c1c, 9 ], [ 0x1f3b33, 3 ], [ 0x7fb6b3, 2 ], [ 0x6b5b45, 3 ],
];
function pickColour() {

	let r = Math.random() * 100;
	for ( const [ c, w ] of CAR_COLOURS ) if ( ( r -= w ) <= 0 ) return c;
	return CAR_COLOURS[ 0 ][ 0 ];

}

// what's on the road: plenty of SUVs and pickups in the Lowcountry
const TYPE_MIX = [ [ 'sedan', 40 ], [ 'suv', 38 ], [ 'pickup', 22 ] ];
function pickType() {

	let r = Math.random() * 100;
	for ( const [ t, w ] of TYPE_MIX ) if ( ( r -= w ) <= 0 ) return t;
	return 'sedan';

}

// ---------------------------------------------------------------- instanced people

const SHIRTS = [ 0xf2efe8, 0x1f3550, 0x9c2f2f, 0x7fb6b3, 0xe7b9a3, 0x2b2b2b, 0xd9c27a, 0x5b7f4a, 0xb8c4d6, 0x6b4d7a ];
const PANTS = [ 0x2c3e5c, 0xc8b48a, 0x1b1b1b, 0x5e5e5e, 0xe8e2d4, 0x3f4f3a ];
const SKIN = [ 0x8d5524, 0xc68642, 0xe0ac69, 0xf1c27d, 0xffdbac, 0x5c3a21, 0xa0662f ];
const HAIR = [ 0x1a1410, 0x3b2617, 0x6b4a2b, 0xc9a25b, 0x9a9a9a, 0x7a3b1d ];
const pick = a => a[ Math.floor( Math.random() * a.length ) ];

function instancedPeople( count ) {

	const mat = () => new THREE.MeshStandardMaterial( { color: 0xffffff, roughness: 0.85, envMapIntensity: 0.45, toneMapped: false } );
	const make = ( geo, n ) => {

		const im = new THREE.InstancedMesh( geo, mat(), n );
		im.frustumCulled = false;
		im.instanceMatrix.setUsage( THREE.DynamicDrawUsage );
		for ( let i = 0; i < n; i ++ ) {

			im.setMatrixAt( i, HIDDEN );
			im.setColorAt( i, new THREE.Color( 1, 1, 1 ) );

		}

		return im;

	};

	// torso tapers from shoulders to waist; a short neck is merged in
	const torsoGeo = mergeGeometries( [
		new THREE.CylinderGeometry( 0.19, 0.15, 0.56, 14, 1 ).scale( 1, 1, 0.62 ).toNonIndexed(),
		new THREE.SphereGeometry( 0.19, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2 ).scale( 1, 0.35, 0.62 ).translate( 0, 0.28, 0 ).toNonIndexed(),
		new THREE.CylinderGeometry( 0.05, 0.055, 0.12, 10 ).translate( 0, 0.36, 0 ).toNonIndexed(),
	].map( g => {

		g.deleteAttribute( 'uv' );
		return g;

	} ) );
	const headGeo = new THREE.SphereGeometry( 0.1, 16, 12 ).scale( 0.9, 1.12, 1 );
	const hairGeo = new THREE.SphereGeometry( 0.106, 16, 8, 0, Math.PI * 2, 0, Math.PI * 0.55 ).scale( 0.92, 1.1, 1.04 );
	const armGeo = new THREE.CapsuleGeometry( 0.042, 0.5, 4, 8 ).translate( 0, - 0.29, 0 );
	const legGeo = new THREE.CapsuleGeometry( 0.068, 0.72, 4, 8 ).translate( 0, - 0.42, 0 );
	const shoeGeo = new THREE.BoxGeometry( 0.1, 0.07, 0.25 ).translate( 0, - 0.84, - 0.04 );

	const shadow = new THREE.InstancedMesh(
		new THREE.PlaneGeometry( 0.75, 0.75 ).rotateX( - Math.PI / 2 ),
		new THREE.MeshBasicMaterial( { map: shadowTexture(), color: 0x000000, transparent: true, opacity: 0.45, depthWrite: false, polygonOffset: true, polygonOffsetFactor: - 2, toneMapped: false } ),
		count,
	);
	shadow.frustumCulled = false;
	shadow.instanceMatrix.setUsage( THREE.DynamicDrawUsage );
	for ( let i = 0; i < count; i ++ ) {

		shadow.setMatrixAt( i, HIDDEN );
		shadow.setColorAt( i, new THREE.Color( 1, 1, 1 ) );

	}

	return {
		shadow,
		torso: make( torsoGeo, count ),
		head: make( headGeo, count ),
		hair: make( hairGeo, count ),
		arms: make( armGeo, count * 2 ),
		legs: make( legGeo, count * 2 ),
		shoes: make( shoeGeo, count * 2 ),
	};

}

// ---------------------------------------------------------------- the system

export function createTraffic( { scene, toLocal, castTerrain, obstacleSolids, audio, getPlayer } ) {

	const group = new THREE.Group();
	group.name = 'traffic';
	scene.add( group );

	let ready = false;
	let enabled = true;
	let data = null;

	// graph
	let NX, NZ; // node positions
	const lanes = []; // directed car lanes
	let outLanes = []; // node -> lane indices
	let degree = []; // node -> number of distinct neighbours on the road network
	const walks = []; // undirected walking segments
	let walkAdj = []; // node -> walk segment indices
	let crossingNodes = null;

	const carMeshes = {};
	for ( const t of CAR_TYPE_KEYS ) {

		carMeshes[ t ] = instancedCars( t, MAX_CARS );
		for ( const m of carMeshes[ t ].meshes ) group.add( m );

	}
	const people = instancedPeople( MAX_PEDS );
	for ( const m of Object.values( people ) ) group.add( m );

	const cars = [];
	const peds = [];
	for ( let i = 0; i < MAX_CARS; i ++ ) cars.push( { active: false, slot: i } );
	for ( let i = 0; i < MAX_PEDS; i ++ ) peds.push( { active: false, slot: i } );

	// ------------------------------------------------ loading

	async function load() {

		try {

			const res = await fetch( './osm-downtown.json' );
			if ( ! res.ok ) throw new Error( res.status );
			data = await res.json();

		} catch {

			data = await fetchOverpass(); // the baked file is missing: ask OpenStreetMap directly

		}

	}

	function build() {

		const N = data.nodes.length;
		NX = new Float32Array( N );
		NZ = new Float32Array( N );
		const v = new THREE.Vector3();
		for ( let i = 0; i < N; i ++ ) {

			toLocal( data.nodes[ i ][ 0 ], data.nodes[ i ][ 1 ], - 25, v );
			NX[ i ] = v.x;
			NZ[ i ] = v.z;

		}

		outLanes = Array.from( { length: N }, () => [] );
		walkAdj = Array.from( { length: N }, () => [] );
		const nb = Array.from( { length: N }, () => new Set() );
		crossingNodes = new Set();

		const addLane = ( a, b, w, offset ) => {

			const dx = NX[ b ] - NX[ a ], dz = NZ[ b ] - NZ[ a ];
			const len = Math.hypot( dx, dz );
			if ( len < 0.05 ) return;
			outLanes[ a ].push( lanes.length );
			lanes.push( { a, b, len, dx: dx / len, dz: dz / len, offset, speed: SPEED[ w.t ] || 7 } );

		};

		for ( const w of data.ways ) {

			if ( DRIVE.has( w.t ) ) {

				const twoWay = w.o === 0;
				const offset = twoWay ? ( w.t.startsWith( 'primary' ) || w.t.startsWith( 'secondary' ) || w.t.startsWith( 'trunk' ) ? 1.9 : 1.6 ) : ( ( w.l || 1 ) > 1 ? 1.6 : 0 );
				for ( let i = 0; i < w.n.length - 1; i ++ ) {

					const a = w.n[ i ], b = w.n[ i + 1 ];
					nb[ a ].add( b );
					nb[ b ].add( a );
					if ( w.o >= 0 ) addLane( a, b, w, offset );
					if ( w.o <= 0 && w.o !== 1 ) addLane( b, a, w, offset );

				}

			} else if ( WALK.has( w.t ) ) {

				for ( let i = 0; i < w.n.length - 1; i ++ ) {

					const a = w.n[ i ], b = w.n[ i + 1 ];
					const len = Math.hypot( NX[ b ] - NX[ a ], NZ[ b ] - NZ[ a ] );
					if ( len < 0.05 ) continue;
					walkAdj[ a ].push( walks.length );
					walkAdj[ b ].push( walks.length );
					walks.push( { a, b, len, crossing: !! w.c } );
					if ( w.c ) {

						crossingNodes.add( a );
						crossingNodes.add( b );

					}

				}

			}

		}

		degree = nb.map( s => s.size );
		ready = true;

	}

	// ------------------------------------------------ geometry helpers

	function lanePoint( li, s, target ) {

		const L = lanes[ li ];
		const t = Math.max( 0, Math.min( L.len, s ) );
		// keep right: the lane sits to the right of the centreline
		return target.set( NX[ L.a ] + L.dx * t - L.dz * L.offset, 0, NZ[ L.a ] + L.dz * t + L.dx * L.offset );

	}

	function chooseNext( li ) {

		const L = lanes[ li ];
		const opts = outLanes[ L.b ].filter( o => lanes[ o ].b !== L.a );
		if ( ! opts.length ) return outLanes[ L.b ].length ? outLanes[ L.b ][ 0 ] : - 1; // dead end: turn around
		// prefer carrying on straight
		let total = 0;
		const w = opts.map( o => {

			const dot = lanes[ o ].dx * L.dx + lanes[ o ].dz * L.dz;
			const x = 0.3 + Math.max( 0, dot ) * 2.5;
			total += x;
			return x;

		} );
		let r = Math.random() * total;
		for ( let i = 0; i < opts.length; i ++ ) if ( ( r -= w[ i ] ) <= 0 ) return opts[ i ];
		return opts[ 0 ];

	}

	// ensure a car's route reaches at least `ahead` metres past its progress
	function extendRoute( car, ahead ) {

		let total = - car.s;
		for ( const li of car.route ) total += lanes[ li ].len;
		while ( total < ahead && car.route.length < 40 ) {

			const next = chooseNext( car.route[ car.route.length - 1 ] );
			if ( next < 0 ) break;
			car.route.push( next );
			total += lanes[ next ].len;

		}

	}

	function routePoint( car, ahead, target ) {

		let s = car.s + ahead;
		for ( const li of car.route ) {

			if ( s <= lanes[ li ].len ) return lanePoint( li, s, target );
			s -= lanes[ li ].len;

		}

		const last = car.route[ car.route.length - 1 ];
		return lanePoint( last, lanes[ last ].len, target );

	}

	// distance along the route to the next real intersection, and which node it is
	function nextIntersection( car, within ) {

		let d = lanes[ car.route[ 0 ] ].len - car.s;
		for ( let i = 0; i < car.route.length && d < within; i ++ ) {

			const node = lanes[ car.route[ i ] ].b;
			if ( degree[ node ] >= 3 || crossingNodes.has( node ) ) return { node, d };
			if ( i + 1 < car.route.length ) d += lanes[ car.route[ i + 1 ] ].len;

		}

		return null;

	}

	function groundAt( x, z, fromY, far ) {

		const hit = castTerrain( x, z, fromY, far );
		return hit ? hit.point.y : null;

	}

	// ------------------------------------------------ spawning

	function far( x, z, p, min, max ) {

		const d = Math.hypot( x - p.x, z - p.z );
		return d > min && d < max;

	}

	function spawnCar( car, player ) {

		for ( let tries = 0; tries < 30; tries ++ ) {

			const li = Math.floor( Math.random() * lanes.length );
			const L = lanes[ li ];
			const s = Math.random() * L.len;
			lanePoint( li, s, _p );
			if ( ! far( _p.x, _p.z, player.feet, CAR_NEAR, CAR_FAR ) ) continue;
			// out of sight if possible, so cars don't pop in in front of you
			const vx = _p.x - player.feet.x, vz = _p.z - player.feet.z;
			const seen = ( vx * player.dir.x + vz * player.dir.z ) / Math.hypot( vx, vz ) > 0.5;
			if ( seen && tries < 20 && ! filling ) continue;
			if ( cars.some( c => c.active && Math.hypot( c.x - _p.x, c.z - _p.z ) < 15 ) ) continue;
			const y = groundAt( _p.x, _p.z, player.feet.y + 60, 200 );
			if ( y === null ) continue;
			const type = pickType();
			car.type = type;
			Object.assign( car, {
				active: true, route: [ li ], s, x: _p.x, z: _p.z, y,
				yaw: Math.atan2( - L.dx, - L.dz ), speed: L.speed * 0.6, waited: 0, honkAt: 0,
				bumped: 0, groundTimer: Math.random() * 0.3,
			} );
			car.colour = new THREE.Color( pickColour() );
			extendRoute( car, 40 );
			return;

		}

	}

	function spawnPed( ped, player ) {

		for ( let tries = 0; tries < 30; tries ++ ) {

			const wi = Math.floor( Math.random() * walks.length );
			const W = walks[ wi ];
			if ( W.crossing ) continue;
			const t = Math.random() * W.len;
			const k = t / W.len;
			const x = NX[ W.a ] + ( NX[ W.b ] - NX[ W.a ] ) * k, z = NZ[ W.a ] + ( NZ[ W.b ] - NZ[ W.a ] ) * k;
			if ( ! far( x, z, player.feet, PED_NEAR, PED_FAR ) ) continue;
			const vx = x - player.feet.x, vz = z - player.feet.z;
			const d = Math.hypot( vx, vz );
			const seen = ( vx * player.dir.x + vz * player.dir.z ) / d > 0.6;
			if ( seen && d < 60 && tries < 20 && ! filling ) continue;
			const y = groundAt( x, z, player.feet.y + 60, 200 );
			if ( y === null ) continue;
			const h = 0.9 + Math.random() * 0.18;
			Object.assign( ped, {
				active: true, walk: wi, forward: Math.random() < 0.5, t, x, z, y, yaw: 0,
				speed: 1.05 + Math.random() * 0.45, scale: h, phase: Math.random() * 6,
				pause: 0, dodgeX: 0, dodgeZ: 0, dodge: 0, groundTimer: Math.random() * 0.3, crossWait: 0,
			} );
			const c = new THREE.Color();
			people.torso.setColorAt( ped.slot, c.set( pick( SHIRTS ) ) );
			for ( const side of [ 0, 1 ] ) people.arms.setColorAt( ped.slot * 2 + side, c );
			const skin = new THREE.Color( pick( SKIN ) );
			people.head.setColorAt( ped.slot, skin );
			people.hair.setColorAt( ped.slot, c.set( pick( HAIR ) ) );
			const pants = new THREE.Color( pick( PANTS ) );
			for ( const side of [ 0, 1 ] ) people.legs.setColorAt( ped.slot * 2 + side, pants );
			const shoes = new THREE.Color( pick( [ 0x1b1b1b, 0x3a2a1c, 0xf2f2f2, 0x6b4a2b ] ) );
			for ( const side of [ 0, 1 ] ) people.shoes.setColorAt( ped.slot * 2 + side, shoes );
			for ( const m of Object.values( people ) ) m.instanceColor.needsUpdate = true;
			return;

		}

	}

	// ------------------------------------------------ cars

	const _t = new THREE.Vector3();
	const _ray = new THREE.Ray();
	const stoneRay = new THREE.Raycaster();
	const _box = new THREE.Box3( new THREE.Vector3( - 0.95, 0, - 2.4 ), new THREE.Vector3( 0.95, 1.5, 2.4 ) );

	function updateCar( car, dt, player, i ) {

		const L0 = lanes[ car.route[ 0 ] ];
		let limit = L0.speed;
		const fx = - Math.sin( car.yaw ), fz = - Math.cos( car.yaw );

		// slow for bends ahead
		routePoint( car, 14, _t );
		const bend = Math.abs( Math.atan2( fx * ( _t.z - car.z ) - fz * ( _t.x - car.x ), fx * ( _t.x - car.x ) + fz * ( _t.z - car.z ) ) );
		if ( bend > 0.35 ) limit = Math.min( limit, 4.5 );

		// keep a gap to anything ahead in our path: cars, you, your vehicles, people crossing
		let gap = Infinity;
		let blockedByPlayer = false;
		const consider = ( x, z, len, isPlayer = false ) => {

			const rx = x - car.x, rz = z - car.z;
			const ahead = rx * fx + rz * fz;
			const side = Math.abs( rx * fz - rz * fx );
			if ( ahead > 0 && ahead < 30 && side < 1.8 ) {

				const g = ahead - len;
				if ( g < gap ) {

					gap = g;
					blockedByPlayer = isPlayer;

				}

			}

		};

		const myLen = CAR_TYPES[ car.type ].L;
		for ( const o of cars ) if ( o !== car && o.active ) consider( o.x, o.z, ( myLen + CAR_TYPES[ o.type ].L ) / 2 + 0.6 );
		for ( const v of player.vehicles ) consider( v.pos.x, v.pos.z, v.kind === 'carriage' ? 7 : 5.5, true );
		if ( ! player.riding ) consider( player.feet.x, player.feet.z, 2.8, true );
		for ( const p of peds ) if ( p.active && p.onCrossing ) consider( p.x, p.z, 3 );

		// stone in the road
		if ( ( i + frame ) % 6 === 0 && obstacleSolids.children.length ) {

			_ray.origin.set( car.x, car.y + 0.8, car.z );
			_ray.direction.set( fx, 0, fz );
			stoneRay.set( _ray.origin, _ray.direction );
			stoneRay.far = 18;
			const hit = stoneRay.intersectObject( obstacleSolids, true )[ 0 ];
			car.stoneGap = hit ? hit.distance - 2.6 : Infinity;

		}

		if ( car.stoneGap < gap ) {

			gap = car.stoneGap;
			blockedByPlayer = true;

		}

		// take turns at intersections: the car nearer the junction goes first
		const ix = nextIntersection( car, 16 );
		if ( ix && ix.d > 1 ) {

			const nx = NX[ ix.node ], nz = NZ[ ix.node ];
			for ( const o of cars ) {

				if ( o === car || ! o.active ) continue;
				const od = Math.hypot( o.x - nx, o.z - nz );
				if ( od < 9 && od < ix.d && ( o.speed > 0.5 || od < 5 ) ) {

					gap = Math.min( gap, ix.d - 6 );
					break;

				}

			}

			// people on a crosswalk at this junction
			if ( crossingNodes.has( ix.node ) ) {

				for ( const p of peds ) {

					if ( p.active && p.onCrossing && Math.hypot( p.x - nx, p.z - nz ) < 8 ) {

						gap = Math.min( gap, ix.d - 4 );
						break;

					}

				}

			}

		}

		if ( car.bumped > 0 ) {

			car.bumped -= dt;
			gap = - 1;

		}

		const target = Math.max( 0, Math.min( limit, ( gap - 1.5 ) * 0.9 ) );
		car.speed += Math.max( - 7 * dt, Math.min( 2.5 * dt, target - car.speed ) );

		// honk if you're in the way
		if ( blockedByPlayer && car.speed < 0.5 ) {

			car.waited += dt;
			if ( car.waited > 2.5 && performance.now() > car.honkAt ) {

				car.honkAt = performance.now() + 5000 + Math.random() * 3000;
				audio?.honk( car.x, car.y, car.z );

			}

		} else car.waited = 0;

		// pure pursuit: steer toward a point ahead on the route
		const look = 4 + car.speed * 0.6;
		routePoint( car, look, _t );
		const want = Math.atan2( - ( _t.x - car.x ), - ( _t.z - car.z ) );
		let dy = want - car.yaw;
		dy = Math.atan2( Math.sin( dy ), Math.cos( dy ) );
		car.yaw += THREE.MathUtils.clamp( dy, - 1.6 * dt, 1.6 * dt ) * Math.min( 1, 0.4 + car.speed / 4 );
		car.x += - Math.sin( car.yaw ) * car.speed * dt;
		car.z += - Math.cos( car.yaw ) * car.speed * dt;

		// advance progress along the route
		car.s += car.speed * dt;
		while ( car.route.length > 1 && car.s > lanes[ car.route[ 0 ] ].len ) {

			car.s -= lanes[ car.route[ 0 ] ].len;
			car.route.shift();

		}

		extendRoute( car, 40 );
		// if we've drifted off the route (e.g. pushed by a crash), snap back onto it
		routePoint( car, 0, _t );
		if ( Math.hypot( _t.x - car.x, _t.z - car.z ) > 8 ) {

			car.x = _t.x;
			car.z = _t.z;

		}

		car.groundTimer -= dt;
		if ( car.groundTimer <= 0 ) {

			car.groundTimer = 0.25;
			const y = groundAt( car.x, car.z, car.y + 1.5, 5 );
			if ( y !== null ) car.targetY = y;

		}

		if ( car.targetY !== undefined ) car.y += ( car.targetY - car.y ) * Math.min( 1, dt * 6 );

	}

	// ------------------------------------------------ people

	function walkEnds( p ) {

		const W = walks[ p.walk ];
		return p.forward ? [ W.a, W.b ] : [ W.b, W.a ];

	}

	function updatePed( p, dt, player ) {

		const W = walks[ p.walk ];
		const [ from, to ] = walkEnds( p );
		p.onCrossing = W.crossing;

		// wait at the kerb if a car is close
		if ( p.crossWait > 0 ) p.crossWait -= dt;
		let moving = p.pause <= 0 && p.crossWait <= 0;
		if ( p.pause > 0 ) p.pause -= dt;

		// step aside for you
		const px = player.feet.x - p.x, pz = player.feet.z - p.z;
		const dirx = ( NX[ to ] - NX[ from ] ) / W.len, dirz = ( NZ[ to ] - NZ[ from ] ) / W.len;
		const ahead = px * dirx + pz * dirz;
		if ( ! player.riding && ahead > 0 && ahead < 1.6 && Math.abs( px * dirz - pz * dirx ) < 0.7 ) moving = false;

		// jump clear of anything driving at them
		const threats = player.vehicles.filter( v => Math.abs( v.speed ) > 1.5 );
		for ( const v of threats ) {

			const vx = p.x - v.pos.x, vz = p.z - v.pos.z;
			const d = Math.hypot( vx, vz );
			const vfx = - Math.sin( v.yaw ) * Math.sign( v.speed ), vfz = - Math.cos( v.yaw ) * Math.sign( v.speed );
			const coming = ( vx * vfx + vz * vfz ) > 0;
			const side = vx * vfz - vz * vfx;
			if ( coming && d < 3 + Math.abs( v.speed ) * 0.5 && Math.abs( side ) < 2.2 && p.dodge <= 0 ) {

				const s = Math.sign( side ) || 1;
				p.dodgeX = vfz * s * 4.5;
				p.dodgeZ = - vfx * s * 4.5;
				p.dodge = 0.45;
				p.pause = 1.5;

			}

		}

		if ( p.dodge > 0 ) {

			p.dodge -= dt;
			p.x += p.dodgeX * dt;
			p.z += p.dodgeZ * dt;
			p.yaw = Math.atan2( - p.dodgeX, - p.dodgeZ );
			moving = false;

		} else if ( moving ) {

			p.t += p.speed * dt;
			if ( p.t >= W.len ) {

				// pick the next path at this node, rarely turning back
				const node = to;
				const opts = walkAdj[ node ].filter( wi => wi !== p.walk );
				let next = p.walk;
				if ( opts.length && Math.random() > 0.05 ) next = opts[ Math.floor( Math.random() * opts.length ) ];
				p.t -= W.len;
				const N = walks[ next ];
				p.forward = N.a === node;
				p.walk = next;
				if ( Math.random() < 0.03 ) p.pause = 1.5 + Math.random() * 4;
				// look both ways before stepping into the street
				if ( N.crossing && cars.some( c => c.active && Math.hypot( c.x - NX[ node ], c.z - NZ[ node ] ) < 14 && c.speed > 1 ) ) {

					p.crossWait = 1.5;
					p.t = 0;

				}

			}

			const W2 = walks[ p.walk ];
			const [ f2, t2 ] = walkEnds( p );
			const k = Math.min( 1, p.t / W2.len );
			const tx = NX[ f2 ] + ( NX[ t2 ] - NX[ f2 ] ) * k, tz = NZ[ f2 ] + ( NZ[ t2 ] - NZ[ f2 ] ) * k;
			// drift back onto the path after a dodge
			p.x += ( tx - p.x ) * Math.min( 1, dt * 2 );
			p.z += ( tz - p.z ) * Math.min( 1, dt * 2 );
			const want = Math.atan2( - ( NX[ t2 ] - NX[ f2 ] ), - ( NZ[ t2 ] - NZ[ f2 ] ) );
			let dy = Math.atan2( Math.sin( want - p.yaw ), Math.cos( want - p.yaw ) );
			p.yaw += dy * Math.min( 1, dt * 6 );

		}

		p.moving = moving;
		if ( moving ) p.phase += dt * p.speed * 3.4;

		p.groundTimer -= dt;
		if ( p.groundTimer <= 0 ) {

			p.groundTimer = 0.3;
			const y = groundAt( p.x, p.z, p.y + 1.3, 4 );
			if ( y !== null && Math.abs( y - p.y ) < 1.2 ) p.targetY = y;

		}

		if ( p.targetY !== undefined ) p.y += ( p.targetY - p.y ) * Math.min( 1, dt * 8 );

	}

	// ------------------------------------------------ drawing

	const _base = new THREE.Matrix4();
	const _part = new THREE.Matrix4();

	// Only cars on the road are drawn: each type's instances are packed and
	// the instance count trimmed, so empty slots cost the GPU nothing.
	function drawCars() {

		for ( const t of CAR_TYPE_KEYS ) {

			const set = carMeshes[ t ];
			let n = 0;
			for ( const car of cars ) {

				if ( ! car.active || car.type !== t ) continue;
				_q.setFromAxisAngle( UP, car.yaw );
				_m.compose( _p.set( car.x, car.y, car.z ), _q, _s.set( 1, 1, 1 ) );
				for ( const im of set.meshes ) im.setMatrixAt( n, _m );
				set.paint.setColorAt( n, car.colour );
				n ++;

			}

			for ( const im of set.meshes ) {

				im.count = n;
				im.instanceMatrix.needsUpdate = true;

			}

			set.paint.instanceColor.needsUpdate = true;

		}

	}

	function drawPed( p ) {

		const swing = p.moving ? Math.sin( p.phase ) : 0;
		const bob = p.moving ? Math.abs( Math.cos( p.phase ) ) * 0.03 : 0;
		_q.setFromAxisAngle( UP, p.yaw );
		_base.compose( _p.set( p.x, p.y, p.z ), _q, _s.setScalar( p.scale ) );
		const set = ( im, i, x, y, z, rx = 0 ) => {

			_part.compose( _p.set( x, y, z ), _q.setFromEuler( _e.set( rx, 0, 0 ) ), _s.set( 1, 1, 1 ) );
			im.setMatrixAt( i, _m.multiplyMatrices( _base, _part ) );

		};

		set( people.shadow, p.slot, 0, 0.03, 0 );
		set( people.torso, p.slot, 0, 1.17 + bob, 0 );
		set( people.head, p.slot, 0, 1.66 + bob, - 0.01 );
		set( people.hair, p.slot, 0, 1.675 + bob, - 0.005 );
		set( people.arms, p.slot * 2, - 0.225, 1.47 + bob, 0, swing * 0.35 );
		set( people.arms, p.slot * 2 + 1, 0.225, 1.47 + bob, 0, - swing * 0.35 );
		for ( const [ i, side ] of [ [ 0, - 1 ], [ 1, 1 ] ] ) {

			const a = side * swing * 0.32;
			set( people.legs, p.slot * 2 + i, side * 0.095, 0.9 + bob, 0, a );
			set( people.shoes, p.slot * 2 + i, side * 0.095, 0.9 + bob, 0, a );

		}

	}

	function hideCar( car ) {

		car.active = false;

	}

	function hidePed( p ) {

		p.active = false;
		for ( const [ k, im ] of Object.entries( people ) ) {

			const n = k === 'arms' || k === 'legs' || k === 'shoes' ? 2 : 1;
			for ( let j = 0; j < n; j ++ ) im.setMatrixAt( p.slot * n + j, HIDDEN );

		}

	}

	// ------------------------------------------------ per frame

	let frame = 0;
	let spawnTimer = 0;
	let filling = 5; // seconds at the start when people and cars may appear in view

	function update( dt ) {

		if ( ! ready || ! enabled ) return;
		frame ++;
		const player = getPlayer();

		spawnTimer -= dt;
		filling = Math.max( 0, filling - dt );
		if ( spawnTimer <= 0 ) {

			spawnTimer = 0.25;
			for ( let n = 0; n < 3; n ++ ) {

				const car = cars.find( c => ! c.active );
				if ( car && lanes.length ) spawnCar( car, player );

			}

			for ( let n = 0; n < 5; n ++ ) {

				const ped = peds.find( q => ! q.active );
				if ( ped && walks.length ) spawnPed( ped, player );

			}

		}

		cars.forEach( ( car, i ) => {

			if ( ! car.active ) return;
			if ( Math.hypot( car.x - player.feet.x, car.z - player.feet.z ) > CAR_DROP ) return hideCar( car );
			updateCar( car, dt, player, i );

		} );

		for ( const p of peds ) {

			if ( ! p.active ) continue;
			if ( Math.hypot( p.x - player.feet.x, p.z - player.feet.z ) > PED_DROP ) {

				hidePed( p );
				continue;

			}

			updatePed( p, dt, player );
			drawPed( p );

		}

		drawCars();
		for ( const im of Object.values( people ) ) im.instanceMatrix.needsUpdate = true;

	}

	// Ray test against the traffic cars, for your own vehicle's collisions.
	function castCars( origin, dir, far ) {

		let best = null;
		for ( const car of cars ) {

			if ( ! car.active ) continue;
			if ( Math.hypot( car.x - origin.x, car.z - origin.z ) > far + 5 ) continue;
			_q.setFromAxisAngle( UP, - car.yaw );
			_ray.origin.set( origin.x - car.x, origin.y - car.y, origin.z - car.z ).applyQuaternion( _q );
			_ray.direction.copy( dir ).applyQuaternion( _q );
			const d0 = CAR_TYPES[ car.type ];
			_box.min.set( - d0.W / 2, 0, - d0.L / 2 );
			_box.max.set( d0.W / 2, d0.H, d0.L / 2 );
			if ( _ray.intersectBox( _box, _t ) ) {

				const d = _t.distanceTo( _ray.origin );
				if ( d <= far && ( ! best || d < best.distance ) ) {

					best = {
						distance: d,
						point: _t.clone().applyQuaternion( _q.invert() ).add( new THREE.Vector3( car.x, car.y, car.z ) ),
						onImpact: () => {

							car.bumped = 3;
							car.honkAt = 0;
							car.waited = 3;
							audio?.honk( car.x, car.y, car.z );

						},
					};

				}

			}

		}

		return best;

	}

	return {
		group,
		async start() {

			if ( ready ) return;
			if ( ! data ) await load();
			build();

		},
		update,
		castCars,
		setEnabled( on ) {

			enabled = on;
			group.visible = on;
			if ( ! on ) {

				cars.forEach( c => c.active && hideCar( c ) );
				peds.forEach( p => p.active && hidePed( p ) );

			}

		},
		get stats() {

			return { cars: cars.filter( c => c.active ).length, people: peds.filter( p => p.active ).length, lanes: lanes.length, walks: walks.length };

		},
		get ready() {

			return ready;

		},
		// for tests and debugging from the console
		_cars: () => cars,
		_peds: () => peds,
	};

}
