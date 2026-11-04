// Alchemy: clap your hands, then touch the ground, push forward or raise your hands
// to pull stone out of the city. The real pavement ripples outward from each
// transmutation, blue arcs crackle over it, and the new stone takes on the
// colour of whatever surface it was made from.

import * as THREE from 'three';

const UP = new THREE.Vector3( 0, 1, 0 );
const ARM_TIME = 5; // seconds your hands stay charged after a clap
const LIFETIME = 150; // seconds before a creation sinks back into the ground
const MAX_CREATIONS = 30;

// ---------------------------------------------------------------- textures

function valueNoise( size, seed ) {

	// tiling multi-octave value noise in 0..1
	const out = new Float32Array( size * size );
	let s = seed;
	const rand = () => ( s = ( s * 16807 ) % 2147483647 ) / 2147483647;
	for ( let oct = 0, amp = 0.5, cells = 4; oct < 5; oct ++, amp *= 0.5, cells *= 2 ) {

		const grid = new Float32Array( cells * cells ).map( rand );
		const step = size / cells;
		for ( let y = 0; y < size; y ++ ) {

			for ( let x = 0; x < size; x ++ ) {

				const gx = x / step, gy = y / step;
				const x0 = Math.floor( gx ) % cells, y0 = Math.floor( gy ) % cells;
				const x1 = ( x0 + 1 ) % cells, y1 = ( y0 + 1 ) % cells;
				let fx = gx - Math.floor( gx ), fy = gy - Math.floor( gy );
				fx = fx * fx * ( 3 - 2 * fx );
				fy = fy * fy * ( 3 - 2 * fy );
				const a = grid[ y0 * cells + x0 ], b = grid[ y0 * cells + x1 ];
				const c = grid[ y1 * cells + x0 ], d = grid[ y1 * cells + x1 ];
				out[ y * size + x ] += amp * ( ( a * ( 1 - fx ) + b * fx ) * ( 1 - fy ) + ( c * ( 1 - fx ) + d * fx ) * fy );

			}

		}

	}

	return out;

}

function makeStoneTextures() {

	const size = 256;
	const h = valueNoise( size, 7 );
	const veins = valueNoise( size, 91 );

	// rough stone with darker fracture lines
	for ( let i = 0; i < h.length; i ++ ) {

		const v = Math.abs( veins[ i ] - 0.5 );
		h[ i ] = h[ i ] * 0.85 + 0.15 - ( v < 0.018 ? 0.25 : 0 );

	}

	const color = document.createElement( 'canvas' );
	color.width = color.height = size;
	const cctx = color.getContext( '2d' );
	const cimg = cctx.createImageData( size, size );
	const normal = document.createElement( 'canvas' );
	normal.width = normal.height = size;
	const nctx = normal.getContext( '2d' );
	const nimg = nctx.createImageData( size, size );

	for ( let y = 0; y < size; y ++ ) {

		for ( let x = 0; x < size; x ++ ) {

			const i = y * size + x;
			const g = Math.round( 150 + 105 * ( h[ i ] - 0.5 ) );
			cimg.data.set( [ g, g, g, 255 ], i * 4 );

			const l = h[ y * size + ( x - 1 + size ) % size ], r = h[ y * size + ( x + 1 ) % size ];
			const u = h[ ( ( y - 1 + size ) % size ) * size + x ], d = h[ ( ( y + 1 ) % size ) * size + x ];
			const n = new THREE.Vector3( ( l - r ) * 6, ( u - d ) * 6, 1 ).normalize();
			nimg.data.set( [ ( n.x * 0.5 + 0.5 ) * 255, ( n.y * 0.5 + 0.5 ) * 255, ( n.z * 0.5 + 0.5 ) * 255, 255 ], i * 4 );

		}

	}

	cctx.putImageData( cimg, 0, 0 );
	nctx.putImageData( nimg, 0, 0 );

	const map = new THREE.CanvasTexture( color );
	map.colorSpace = THREE.SRGBColorSpace;
	const normalMap = new THREE.CanvasTexture( normal );
	for ( const t of [ map, normalMap ] ) {

		t.wrapS = t.wrapT = THREE.RepeatWrapping;
		t.anisotropy = 4;

	}

	return { map, normalMap };

}

// An original transmutation circle: double outer ring with ticks, a seven-point
// star, seven node circles and an inner ring of small geometric marks.
function makeCircleTexture() {

	const S = 1024, c = document.createElement( 'canvas' );
	c.width = c.height = S;
	const g = c.getContext( '2d' );
	g.translate( S / 2, S / 2 );
	g.strokeStyle = '#fff';
	g.fillStyle = '#fff';
	g.lineCap = 'round';

	const ring = ( r, w ) => {

		g.lineWidth = w;
		g.beginPath();
		g.arc( 0, 0, r, 0, Math.PI * 2 );
		g.stroke();

	};

	ring( 490, 10 );
	ring( 462, 5 );
	for ( let i = 0; i < 84; i ++ ) {

		const a = i / 84 * Math.PI * 2, long = i % 12 === 0;
		g.lineWidth = long ? 6 : 3;
		g.beginPath();
		g.moveTo( Math.cos( a ) * 462, Math.sin( a ) * 462 );
		g.lineTo( Math.cos( a ) * ( long ? 420 : 445 ), Math.sin( a ) * ( long ? 420 : 445 ) );
		g.stroke();

	}

	// {7/3} star
	const R = 400;
	g.lineWidth = 7;
	g.beginPath();
	for ( let i = 0; i <= 7; i ++ ) {

		const a = ( ( i * 3 ) % 7 ) / 7 * Math.PI * 2 - Math.PI / 2;
		if ( i === 0 ) g.moveTo( Math.cos( a ) * R, Math.sin( a ) * R );
		else g.lineTo( Math.cos( a ) * R, Math.sin( a ) * R );

	}

	g.stroke();

	for ( let i = 0; i < 7; i ++ ) {

		const a = i / 7 * Math.PI * 2 - Math.PI / 2;
		const x = Math.cos( a ) * R, y = Math.sin( a ) * R;
		g.lineWidth = 6;
		g.beginPath();
		g.arc( x, y, 42, 0, Math.PI * 2 );
		g.stroke();
		g.beginPath();
		g.arc( x, y, 12, 0, Math.PI * 2 );
		g.fill();

	}

	ring( 230, 6 );
	ring( 205, 3 );
	// marks between the inner rings: alternating bars, dots and chevrons
	for ( let i = 0; i < 21; i ++ ) {

		const a = i / 21 * Math.PI * 2;
		g.save();
		g.rotate( a );
		g.translate( 0, - 217 );
		g.lineWidth = 3;
		if ( i % 3 === 0 ) g.fillRect( - 2, - 9, 4, 18 );
		else if ( i % 3 === 1 ) {

			g.beginPath();
			g.arc( 0, 0, 5, 0, Math.PI * 2 );
			g.fill();

		} else {

			g.beginPath();
			g.moveTo( - 7, 5 );
			g.lineTo( 0, - 6 );
			g.lineTo( 7, 5 );
			g.stroke();

		}

		g.restore();

	}

	// inner square turned 45°, and a centre point
	g.lineWidth = 6;
	g.strokeRect( - 120, - 120, 240, 240 );
	g.rotate( Math.PI / 4 );
	g.strokeRect( - 120, - 120, 240, 240 );
	g.beginPath();
	g.arc( 0, 0, 22, 0, Math.PI * 2 );
	g.fill();

	const tex = new THREE.CanvasTexture( c );
	tex.colorSpace = THREE.SRGBColorSpace;
	return tex;

}

function makeDustTexture() {

	const c = document.createElement( 'canvas' );
	c.width = c.height = 64;
	const g = c.getContext( '2d' );
	const grad = g.createRadialGradient( 32, 32, 0, 32, 32, 32 );
	grad.addColorStop( 0, 'rgba(255,255,255,0.9)' );
	grad.addColorStop( 0.5, 'rgba(255,255,255,0.35)' );
	grad.addColorStop( 1, 'rgba(255,255,255,0)' );
	g.fillStyle = grad;
	g.fillRect( 0, 0, 64, 64 );
	return new THREE.CanvasTexture( c );

}

function makeGlowTexture() {

	const c = document.createElement( 'canvas' );
	c.width = c.height = 128;
	const g = c.getContext( '2d' );
	const grad = g.createRadialGradient( 64, 64, 0, 64, 64, 64 );
	grad.addColorStop( 0, 'rgba(255,255,255,1)' );
	grad.addColorStop( 0.25, 'rgba(170,235,255,0.8)' );
	grad.addColorStop( 1, 'rgba(60,160,255,0)' );
	g.fillStyle = grad;
	g.fillRect( 0, 0, 128, 128 );
	const t = new THREE.CanvasTexture( c );
	t.colorSpace = THREE.SRGBColorSpace;
	return t;

}

// ---------------------------------------------------------------- geometry

function rockyColumn( radius, length, pointed, seed ) {

	const geo = pointed
		? new THREE.ConeGeometry( radius, length, 7, 5, false )
		: new THREE.CylinderGeometry( radius * 0.9, radius, length, 10, 6, false );
	geo.translate( 0, length / 2, 0 );

	const pos = geo.attributes.position;
	const v = new THREE.Vector3();
	let s = seed * 9301 + 49297;
	const rand = () => ( s = ( s * 9301 + 49297 ) % 233280 ) / 233280;
	const jitter = new Map(); // keep seams welded: same input position, same offset

	for ( let i = 0; i < pos.count; i ++ ) {

		v.fromBufferAttribute( pos, i );
		const isTop = ! pointed && v.y > length - 1e-4;
		const key = `${ v.x.toFixed( 3 ) },${ v.y.toFixed( 3 ) },${ v.z.toFixed( 3 ) }`;
		if ( ! jitter.has( key ) ) jitter.set( key, [ rand(), rand() ] );
		const [ a, b ] = jitter.get( key );
		const r = Math.hypot( v.x, v.z );
		if ( r > 1e-4 ) {

			const k = isTop ? 1 + ( a - 0.5 ) * 0.08 : 1 + ( a - 0.5 ) * 0.28;
			v.x *= k;
			v.z *= k;

		}

		if ( ! isTop && v.y > 0.01 && v.y < length - 0.01 ) v.y += ( b - 0.5 ) * length * 0.04;
		pos.setXYZ( i, v.x, v.y, v.z );

	}

	geo.computeVertexNormals();

	// stretch the texture to real-world metres
	const uv = geo.attributes.uv;
	for ( let i = 0; i < uv.count; i ++ ) uv.setXY( i, uv.getX( i ) * radius * 2.2, uv.getY( i ) * length * 0.45 );

	return geo;

}

// ---------------------------------------------------------------- the system

export function createAlchemy( { scene, camera, rig, castRay, castTerrain, audio, notify, haptics } ) {

	const stone = makeStoneTextures();
	const circleTex = makeCircleTexture();
	const glowTex = makeGlowTexture();

	const solids = new THREE.Group();
	solids.name = 'transmutations';
	scene.add( solids );

	const fxGroup = new THREE.Group();
	scene.add( fxGroup );

	// Lights for the stone only; the photographed city is unlit by design.
	const sun = new THREE.DirectionalLight( 0xfff1dc, 1.3 );
	sun.position.set( - 0.6, 0.55, 0.45 ).multiplyScalar( 100 );
	const sky = new THREE.HemisphereLight( 0xdbe6f0, 0x6e6152, 0.9 );
	const flash = new THREE.PointLight( 0x8fe3ff, 0, 18, 1.6 );
	scene.add( sun, sky, flash );
	let flashLevel = 0;

	// Shared ripple uniforms injected into every city tile.
	const ripple = {
		uRipple: { value: new THREE.Vector4( 0, 0, 0, 99 ) },
		uRippleStrength: { value: 0 },
	};

	function patchMaterial( material ) {

		if ( ! material || material.userData.alchemyPatched ) return;
		material.userData.alchemyPatched = true;
		const prev = material.onBeforeCompile;
		material.onBeforeCompile = ( shader, renderer ) => {

			if ( prev ) prev.call( material, shader, renderer );
			shader.uniforms.uRipple = ripple.uRipple;
			shader.uniforms.uRippleStrength = ripple.uRippleStrength;
			shader.vertexShader = shader.vertexShader
				.replace( 'void main() {', /* glsl */`
					uniform vec4 uRipple;
					uniform float uRippleStrength;
					float alchemyRipple( vec3 wp ) {
						float age = uRipple.w;
						if ( age > 3.0 ) return 0.0;
						float d = distance( wp.xz, uRipple.xz );
						float ground = 1.0 - smoothstep( 1.5, 4.0, abs( wp.y - uRipple.y ) );
						float front = age * 14.0;
						float packet = exp( - pow( ( d - front ) / 2.5, 2.0 ) );
						float fade = ( 1.0 - age / 3.0 ) * ( 1.0 - smoothstep( 25.0, 45.0, d ) );
						return uRippleStrength * ground * packet * fade * sin( ( d - front ) * 2.2 );
					}
					void main() {` )
				.replace( '#include <project_vertex>', /* glsl */`
					vec4 mvPosition = vec4( transformed, 1.0 );
					#ifdef USE_BATCHING
						mvPosition = batchingMatrix * mvPosition;
					#endif
					#ifdef USE_INSTANCING
						mvPosition = instanceMatrix * mvPosition;
					#endif
					mvPosition = modelMatrix * mvPosition;
					mvPosition.y += alchemyRipple( mvPosition.xyz );
					mvPosition = viewMatrix * mvPosition;
					gl_Position = projectionMatrix * mvPosition;` );

		};

		const prevKey = material.customProgramCacheKey;
		material.customProgramCacheKey = () => ( prevKey ? prevKey.call( material ) : '' ) + '|alchemy';
		material.needsUpdate = true;

	}

	function startRipple( p, strength = 0.28 ) {

		ripple.uRipple.value.set( p.x, p.y, p.z, 0 );
		ripple.uRippleStrength.value = strength;

	}

	// ------------------------------------------------ effects

	const effects = []; // { update(dt, t) -> bool alive }

	function spawnCircle( point, normal, radius, life = 2.2 ) {

		const mat = new THREE.MeshBasicMaterial( {
			map: circleTex, color: 0x9be7ff, transparent: true, opacity: 0,
			blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, fog: false,
			polygonOffset: true, polygonOffsetFactor: - 4,
		} );
		const mesh = new THREE.Mesh( new THREE.PlaneGeometry( radius * 2, radius * 2 ), mat );
		mesh.quaternion.setFromUnitVectors( new THREE.Vector3( 0, 0, 1 ), normal );
		mesh.position.copy( point ).addScaledVector( normal, 0.06 );
		mesh.renderOrder = 5;
		fxGroup.add( mesh );
		let age = 0;
		effects.push( { update( dt ) {

			age += dt;
			mesh.rotateZ( dt * 0.6 );
			const s = Math.min( 1, age / 0.18 );
			mesh.scale.setScalar( 0.6 + 0.4 * s );
			mat.opacity = age < 0.18 ? s : Math.max( 0, 1 - ( age - 0.6 ) / ( life - 0.6 ) );
			if ( age >= life ) {

				fxGroup.remove( mesh );
				mesh.geometry.dispose();
				mat.dispose();
				return false;

			}

			return true;

		} } );

	}

	// Blue arcs: jagged lightning regenerated every few frames.
	const ARC_SEGMENTS = 1600;
	const arcGeo = new THREE.BufferGeometry();
	arcGeo.setAttribute( 'position', new THREE.BufferAttribute( new Float32Array( ARC_SEGMENTS * 6 ), 3 ) );
	arcGeo.setDrawRange( 0, 0 );
	const arcMat = new THREE.LineBasicMaterial( {
		color: 0xaef0ff, transparent: true, opacity: 0.95,
		blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, fog: false,
	} );
	const arcLines = new THREE.LineSegments( arcGeo, arcMat );
	arcLines.frustumCulled = false;
	arcLines.renderOrder = 6;
	scene.add( arcLines );
	const arcEmitters = []; // { center, radius, normal, until, count, getCenter? }
	let arcTimer = 0;

	function addArcs( center, radius, duration, count = 7, normal = UP ) {

		arcEmitters.push( { center: center.clone(), radius, normal: normal.clone(), until: performance.now() / 1000 + duration, count } );

	}

	const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _t1 = new THREE.Vector3(), _t2 = new THREE.Vector3();
	function rebuildArcs() {

		const now = performance.now() / 1000;
		const arr = arcGeo.attributes.position.array;
		let n = 0;
		for ( let e = arcEmitters.length - 1; e >= 0; e -- ) {

			const em = arcEmitters[ e ];
			if ( now > em.until ) {

				arcEmitters.splice( e, 1 );
				continue;

			}

			const c = em.getCenter ? em.getCenter() : em.center;
			if ( ! c ) continue;
			// tangent frame on the surface
			_t1.copy( Math.abs( em.normal.y ) > 0.9 ? new THREE.Vector3( 1, 0, 0 ) : UP ).cross( em.normal ).normalize();
			_t2.copy( em.normal ).cross( _t1 );

			for ( let k = 0; k < em.count; k ++ ) {

				const ang = Math.random() * Math.PI * 2, r = em.radius * ( 0.3 + Math.random() * 0.7 );
				_a.copy( c ).addScaledVector( _t1, Math.cos( ang ) * r ).addScaledVector( _t2, Math.sin( ang ) * r );
				const steps = 6 + Math.floor( Math.random() * 4 );
				const reach = em.radius * ( 0.35 + Math.random() * 0.5 );
				const dir = new THREE.Vector3().copy( em.normal ).multiplyScalar( 0.6 + Math.random() )
					.addScaledVector( _t1, Math.random() - 0.5 ).addScaledVector( _t2, Math.random() - 0.5 ).normalize();
				for ( let s = 0; s < steps && n < ARC_SEGMENTS; s ++ ) {

					_b.copy( _a ).addScaledVector( dir, reach / steps )
						.addScaledVector( _t1, ( Math.random() - 0.5 ) * reach * 0.35 )
						.addScaledVector( _t2, ( Math.random() - 0.5 ) * reach * 0.35 )
						.addScaledVector( em.normal, ( Math.random() - 0.3 ) * reach * 0.2 );
					arr.set( [ _a.x, _a.y, _a.z, _b.x, _b.y, _b.z ], n * 6 );
					n ++;
					_a.copy( _b );

				}

			}

		}

		arcGeo.setDrawRange( 0, n * 2 );
		arcGeo.attributes.position.needsUpdate = true;
		arcGeo.computeBoundingSphere();

	}

	// Dust thrown up as stone breaks through.
	const dustTex = makeDustTexture();
	function spawnDust( point, radius, amount = 50 ) {

		const geo = new THREE.BufferGeometry();
		const p = new Float32Array( amount * 3 ), vel = [];
		for ( let i = 0; i < amount; i ++ ) {

			const a = Math.random() * Math.PI * 2, r = radius * Math.sqrt( Math.random() );
			p.set( [ point.x + Math.cos( a ) * r, point.y + 0.1, point.z + Math.sin( a ) * r ], i * 3 );
			vel.push( new THREE.Vector3( Math.cos( a ) * ( 0.5 + Math.random() ), 0.6 + Math.random() * 1.8, Math.sin( a ) * ( 0.5 + Math.random() ) ) );

		}

		geo.setAttribute( 'position', new THREE.BufferAttribute( p, 3 ) );
		const mat = new THREE.PointsMaterial( {
			map: dustTex, color: 0xb7a58e, size: 0.9, transparent: true, opacity: 0.55,
			depthWrite: false, toneMapped: false, sizeAttenuation: true,
		} );
		const pts = new THREE.Points( geo, mat );
		fxGroup.add( pts );
		let age = 0;
		effects.push( { update( dt ) {

			age += dt;
			for ( let i = 0; i < amount; i ++ ) {

				vel[ i ].multiplyScalar( 1 - dt * 1.2 );
				vel[ i ].y -= dt * 0.4;
				p[ i * 3 ] += vel[ i ].x * dt;
				p[ i * 3 + 1 ] += vel[ i ].y * dt;
				p[ i * 3 + 2 ] += vel[ i ].z * dt;

			}

			geo.attributes.position.needsUpdate = true;
			mat.size = 0.9 + age * 1.2;
			mat.opacity = 0.55 * Math.max( 0, 1 - age / 2.2 );
			if ( age > 2.2 ) {

				fxGroup.remove( pts );
				geo.dispose();
				mat.dispose();
				return false;

			}

			return true;

		} } );

	}

	function pulseFlash( point, level = 6 ) {

		flash.position.copy( point ).add( new THREE.Vector3( 0, 1.5, 0 ) );
		flashLevel = Math.max( flashLevel, level );

	}

	// ------------------------------------------------ creations

	const creations = [];
	const _c = new THREE.Color();
	const sampler = document.createElement( 'canvas' );
	sampler.width = sampler.height = 6;
	const sctx = sampler.getContext( '2d', { willReadFrequently: true } );

	// Average the photo texture around a hit so stone made from asphalt looks like
	// asphalt, and stone made from a brick wall looks like brick.
	function surfaceColor( hit ) {

		const fallback = new THREE.Color( 0.62, 0.6, 0.56 );
		try {

			const map = hit?.object?.material?.map;
			const img = map?.image;
			if ( ! img || ! hit.uv || ! img.width ) return fallback;
			const u = ( ( hit.uv.x % 1 ) + 1 ) % 1;
			let v = ( ( hit.uv.y % 1 ) + 1 ) % 1;
			if ( map.flipY ) v = 1 - v;
			const sx = Math.max( 0, Math.min( img.width - 6, u * img.width - 3 ) );
			const sy = Math.max( 0, Math.min( img.height - 6, v * img.height - 3 ) );
			sctx.clearRect( 0, 0, 6, 6 );
			sctx.drawImage( img, sx, sy, 6, 6, 0, 0, 6, 6 );
			const d = sctx.getImageData( 0, 0, 6, 6 ).data;
			let r = 0, g = 0, b = 0;
			for ( let i = 0; i < d.length; i += 4 ) {

				r += d[ i ];
				g += d[ i + 1 ];
				b += d[ i + 2 ];

			}

			const n = d.length / 4;
			_c.setRGB( r / n / 255, g / n / 255, b / n / 255, THREE.SRGBColorSpace );
			// lift it toward stone so very dark asphalt still reads as rock
			return _c.clone().lerp( fallback, 0.3 ).multiplyScalar( 1.35 );

		} catch {

			return fallback;

		}

	}

	function createColumn( { base, axis, radius, length, pointed, rise, delay = 0, tint, ease = 'out' } ) {

		const geo = rockyColumn( radius, length, pointed, Math.random() * 1000 | 0 );
		const mat = new THREE.MeshStandardMaterial( {
			map: stone.map, normalMap: stone.normalMap, color: tint,
			roughness: 0.95, metalness: 0, toneMapped: false,
		} );
		const mesh = new THREE.Mesh( geo, mat );
		mesh.userData.solid = true;
		const holder = new THREE.Group();
		holder.quaternion.setFromUnitVectors( UP, axis );
		holder.position.copy( base ).addScaledVector( axis, - 0.25 );
		holder.add( mesh );
		mesh.position.y = - length;
		solids.add( holder );

		const item = { holder, mesh, length, born: performance.now() / 1000, state: 'rising', t: - delay, rise, ease };
		creations.push( item );

		while ( creations.filter( c => c.state !== 'sinking' ).length > MAX_CREATIONS ) {

			const old = creations.find( c => c.state !== 'sinking' );
			old.state = 'sinking';
			old.t = 0;

		}

		return item;

	}

	function updateCreations( dt ) {

		const now = performance.now() / 1000;
		for ( let i = creations.length - 1; i >= 0; i -- ) {

			const c = creations[ i ];
			c.t += dt;
			if ( c.state === 'rising' ) {

				if ( c.t < 0 ) continue;
				let k = Math.min( 1, c.t / c.rise );
				k = c.ease === 'inout' ? k * k * ( 3 - 2 * k ) : 1 - Math.pow( 1 - k, 3 );
				c.mesh.position.y = - c.length * ( 1 - k );
				if ( c.t >= c.rise ) c.state = 'standing';

			} else if ( c.state === 'standing' ) {

				if ( now - c.born > LIFETIME ) {

					c.state = 'sinking';
					c.t = 0;

				}

			} else if ( c.state === 'sinking' ) {

				const k = Math.min( 1, c.t / 2.0 );
				c.mesh.position.y = - c.length * k * k;
				if ( k >= 1 ) {

					solids.remove( c.holder );
					c.mesh.geometry.dispose();
					c.mesh.material.dispose();
					creations.splice( i, 1 );

				}

			}

		}

	}

	// ------------------------------------------------ transmutations

	const _h = new THREE.Vector3();

	function horizontal( dir ) {

		const f = new THREE.Vector3( dir.x, 0, dir.z );
		if ( f.lengthSq() < 1e-6 ) f.set( 0, 0, - 1 );
		return f.normalize();

	}

	// Hands on the ground: a line of stone spikes races away from you.
	function spikeWave( from, facing ) {

		const fwd = horizontal( facing );
		const side = new THREE.Vector3( - fwd.z, 0, fwd.x );
		const startHit = castTerrain( from.x, from.z, from.y + 2.5, 8 );
		if ( ! startHit ) return false;
		const start = startHit.point.clone();
		const tint = surfaceColor( startHit );

		spawnCircle( start, UP, 1.6 );
		addArcs( start, 1.6, 1.4, 8 );
		startRipple( start, 0.3 );
		pulseFlash( start, 8 );
		spawnDust( start, 1.2, 30 );

		let lastY = start.y;
		const count = 11;
		for ( let i = 0; i < count; i ++ ) {

			const d = 1.6 + i * 1.3;
			_h.copy( start ).addScaledVector( fwd, d ).addScaledVector( side, ( Math.random() - 0.5 ) * 0.8 );
			const hit = castTerrain( _h.x, _h.z, lastY + 3, 8 );
			if ( ! hit ) break;
			lastY = hit.point.y;
			const axis = UP.clone().addScaledVector( fwd, 0.35 + Math.random() * 0.15 )
				.addScaledVector( side, ( Math.random() - 0.5 ) * 0.3 ).normalize();
			const t = i / ( count - 1 );
			createColumn( {
				base: hit.point, axis, radius: 0.35 + t * 0.55, length: 1.1 + t * 3.2,
				pointed: true, rise: 0.32, delay: i * 0.06, tint,
			} );
			if ( i % 3 === 2 ) {

				const p = hit.point.clone();
				setTimeout( () => {

					spawnDust( p, 1.0, 20 );
					addArcs( p, 1.2, 0.5, 4 );

				}, i * 60 );

			}

		}

		audio?.transmute( 1.3 );
		return true;

	}

	// Push forward: stone bursts out of whatever you're looking at.
	function pushAt( origin, dir ) {

		const hit = castRay( origin, dir, 150 );
		if ( ! hit ) {

			notify?.( 'Nothing to transmute', 'Aim at the ground or a wall within about 150 m.' );
			return false;

		}

		const n = new THREE.Vector3( 0, 1, 0 );
		if ( hit.face ) {

			n.copy( hit.face.normal ).transformDirection( hit.object.matrixWorld );
			if ( n.dot( dir ) > 0 ) n.negate();

		}

		const tint = surfaceColor( hit );
		const p = hit.point;

		if ( n.y > 0.55 ) {

			createColumn( { base: p, axis: UP, radius: 1.3, length: 7, pointed: false, rise: 0.75, tint } );
			spawnCircle( p, n, 2.6 );
			addArcs( p, 2.2, 1.6, 9 );
			startRipple( p, 0.32 );
			spawnDust( p, 1.8, 60 );

		} else {

			// A spike punches out of the facade.
			const axis = n.clone().add( new THREE.Vector3( 0, 0.08, 0 ) ).normalize();
			createColumn( { base: p, axis, radius: 0.75, length: 4.5, pointed: true, rise: 0.45, tint } );
			spawnCircle( p, n, 1.8 );
			addArcs( p, 1.6, 1.2, 7, n );
			spawnDust( p, 0.8, 30 );

		}

		pulseFlash( p, 9 );
		audio?.transmute( 1.0 );
		return true;

	}

	// Raise both hands: a pillar lifts you high above the street.
	function raiseUnder( headPos, floorY ) {

		const hit = castTerrain( headPos.x, headPos.z, floorY + 1.5, 6 );
		const base = hit ? hit.point.clone() : new THREE.Vector3( headPos.x, floorY, headPos.z );
		const tint = hit ? surfaceColor( hit ) : new THREE.Color( 0.62, 0.6, 0.56 );
		createColumn( { base, axis: UP, radius: 1.25, length: 12, pointed: false, rise: 2.6, tint, ease: 'inout' } );
		spawnCircle( base, UP, 2.4, 3 );
		addArcs( base, 2.0, 2.6, 8 );
		startRipple( base, 0.22 );
		spawnDust( base, 1.6, 60 );
		pulseFlash( base, 7 );
		audio?.transmute( 2.6 );
		return true;

	}

	// ------------------------------------------------ charged hands

	const glows = [ 0, 1 ].map( () => {

		const s = new THREE.Sprite( new THREE.SpriteMaterial( {
			map: glowTex, color: 0x9be7ff, transparent: true, blending: THREE.AdditiveBlending,
			depthWrite: false, depthTest: false, toneMapped: false, fog: false,
		} ) );
		s.scale.setScalar( 0.16 );
		s.renderOrder = 7;
		s.visible = false;
		scene.add( s );
		return s;

	} );

	// Screen mode has no tracked hands, so the glow sits at the bottom of the view.
	const screenGlows = [ - 1, 1 ].map( side => {

		const s = new THREE.Sprite( glows[ 0 ].material );
		s.position.set( side * 0.22, - 0.24, - 0.6 );
		s.scale.setScalar( 0.12 );
		s.visible = false;
		camera.add( s );
		return s;

	} );

	let armedUntil = 0;
	let lastClap = - 10;
	let hintsShown = 0;
	const palmsNow = [ null, null ];
	const palmHandEmitters = [];

	function armed() {

		return performance.now() / 1000 < armedUntil;

	}

	function clap( point ) {

		const now = performance.now() / 1000;
		if ( now - lastClap < 0.5 ) return;
		lastClap = now;
		armedUntil = now + ARM_TIME;
		audio?.clap();
		audio?.charge( true );
		haptics?.( 0.7, 80 );
		if ( point ) {

			addArcs( point, 0.12, 0.6, 5 );
			pulseFlash( point, 2 );

		}

		for ( let i = 0; i < 2; i ++ ) {

			palmHandEmitters[ i ] = { center: new THREE.Vector3(), radius: 0.07, normal: UP.clone(), until: armedUntil, count: 2, getCenter: () => palmsNow[ i ] };
			arcEmitters.push( palmHandEmitters[ i ] );

		}

		if ( hintsShown < 2 ) {

			hintsShown ++;
			notify?.( 'Hands charged', 'Touch the ground, push forward, or raise both hands.' );

		}

	}

	function disarm() {

		armedUntil = 0;
		audio?.charge( false );
		for ( const e of palmHandEmitters ) if ( e ) e.until = 0;

	}

	// Spend the charge on one transmutation.
	function cast( kind, data ) {

		if ( ! armed() ) return false;
		let ok = false;
		if ( kind === 'ground' ) ok = spikeWave( data.from, data.facing );
		else if ( kind === 'push' ) ok = pushAt( data.origin, data.dir );
		else if ( kind === 'raise' ) ok = raiseUnder( data.head, data.floorY );
		if ( ok ) {

			disarm();
			haptics?.( 1.0, 160 );

		}

		return ok;

	}

	// ------------------------------------------------ gesture recognition
	// palms: [left, right] world positions or null. Works for tracked hands and
	// for controllers (their grips stand in for palms).

	const prevRel = [ null, null ];
	const relNow = [ new THREE.Vector3(), new THREE.Vector3() ];
	const distHistory = [];

	function trackPalms( palms, head, headDir, dt ) {

		const now = performance.now() / 1000;
		const floorY = rig.position.y;
		for ( let i = 0; i < 2; i ++ ) palmsNow[ i ] = palms[ i ] ? palms[ i ].clone() : null;

		const [ L, R ] = palms;
		if ( L && R ) {

			const d = L.distanceTo( R );
			distHistory.push( [ now, d ] );
			while ( distHistory.length && now - distHistory[ 0 ][ 0 ] > 0.4 ) distHistory.shift();
			const maxRecent = Math.max( ...distHistory.map( h => h[ 1 ] ) );
			if ( d < 0.07 && maxRecent > 0.16 ) {

				clap( _h.copy( L ).add( R ).multiplyScalar( 0.5 ) );
				distHistory.length = 0;

			}

		} else distHistory.length = 0;

		// velocity relative to the rig, so walking or flying doesn't count as a push
		const vel = [ null, null ];
		for ( let i = 0; i < 2; i ++ ) {

			if ( ! palms[ i ] ) {

				prevRel[ i ] = null;
				continue;

			}

			relNow[ i ].copy( palms[ i ] ).sub( rig.position );
			if ( prevRel[ i ] && dt > 0 ) vel[ i ] = relNow[ i ].clone().sub( prevRel[ i ] ).divideScalar( dt );
			prevRel[ i ] = ( prevRel[ i ] || new THREE.Vector3() ).copy( relNow[ i ] );

		}

		for ( const g of glows ) g.visible = false;
		if ( ! armed() ) return;

		for ( let i = 0; i < 2; i ++ ) {

			if ( ! palms[ i ] ) continue;
			glows[ i ].visible = true;
			glows[ i ].position.copy( palms[ i ] );
			glows[ i ].scale.setScalar( 0.13 + Math.sin( now * 18 + i ) * 0.025 );

		}

		if ( now - lastClap < 0.25 ) return; // let the clap finish first

		// 1. a palm on the ground
		for ( let i = 0; i < 2; i ++ ) {

			if ( palms[ i ] && palms[ i ].y - floorY < 0.3 ) {

				cast( 'ground', { from: palms[ i ], facing: headDir } );
				return;

			}

		}

		// 2. both hands raised above your head
		if ( L && R && L.y > head.y + 0.08 && R.y > head.y + 0.08 ) {

			cast( 'raise', { head, floorY } );
			return;

		}

		// 3. a fast push toward where you're looking
		for ( let i = 0; i < 2; i ++ ) {

			if ( ! vel[ i ] ) continue;
			const ahead = _h.copy( palms[ i ] ).sub( head ).dot( headDir );
			if ( vel[ i ].dot( headDir ) > 1.7 && ahead > 0.3 ) {

				cast( 'push', { origin: head.clone(), dir: headDir.clone() } );
				return;

			}

		}

	}

	function setScreenGlow( on ) {

		const show = on && armed();
		for ( const s of screenGlows ) {

			s.visible = show;
			if ( show ) s.scale.setScalar( 0.1 + Math.sin( performance.now() / 55 ) * 0.015 );

		}

	}

	// ------------------------------------------------ per-frame

	function update( dt ) {

		ripple.uRipple.value.w += dt;
		if ( armedUntil !== 0 && ! armed() ) disarm(); // charge ran out
		flashLevel *= Math.exp( - dt * 5 );
		flash.intensity = flashLevel * ( 0.7 + Math.random() * 0.6 );

		arcTimer -= dt;
		if ( arcTimer <= 0 ) {

			arcTimer = 0.045;
			rebuildArcs();

		}

		arcMat.opacity = 0.7 + Math.random() * 0.3;

		for ( let i = effects.length - 1; i >= 0; i -- ) if ( ! effects[ i ].update( dt ) ) effects.splice( i, 1 );
		updateCreations( dt );

	}

	// A circle, arcs and dust without making stone: used when vehicles are summoned.
	function flourish( point, radius, duration = 1 ) {

		spawnCircle( point, UP, radius, duration + 1.2 );
		addArcs( point, radius * 0.9, duration, 10 );
		spawnDust( point, radius * 0.7, 50 );
		pulseFlash( point, 8 );
		startRipple( point, 0.22 );
		audio?.transmute( duration );

	}

	return {
		solids,
		flourish,
		patchMaterial,
		update,
		trackPalms,
		clap,
		cast,
		armed,
		setScreenGlow,
		clearAll() {

			for ( const c of creations ) {

				if ( c.state !== 'sinking' ) {

					c.state = 'sinking';
					c.t = 0;

				}

			}

		},
	};

}
