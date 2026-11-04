// A small menu that floats above your left palm when you turn it face up.
// Tap a row with your right index finger. With controllers, hold the left grip
// to show it and point the right controller at a row, then pull the trigger.

import * as THREE from 'three';

const W = 0.17; // metres
const ROW_H = 0.032;
const PAD = 0.008;

export function createWristMenu( { scene, onSelect, haptics, audio } ) {

	const canvas = document.createElement( 'canvas' );
	const tex = new THREE.CanvasTexture( canvas );
	tex.colorSpace = THREE.SRGBColorSpace;
	const mat = new THREE.MeshBasicMaterial( { map: tex, transparent: true, depthTest: false, depthWrite: false, toneMapped: false, fog: false } );
	const panel = new THREE.Mesh( new THREE.PlaneGeometry( 1, 1 ), mat );
	panel.renderOrder = 998;
	panel.visible = false;
	scene.add( panel );

	const cursor = new THREE.Mesh(
		new THREE.CircleGeometry( 0.004, 16 ),
		new THREE.MeshBasicMaterial( { color: 0xa8d5d1, depthTest: false, transparent: true, toneMapped: false } ),
	);
	cursor.renderOrder = 999;
	panel.add( cursor );

	let items = [];
	let hover = - 1;
	let cooldown = 0;
	let h = 0;
	let drawnKey = '';

	function setItems( list ) {

		items = list;

	}

	function draw() {

		const key = JSON.stringify( items ) + hover;
		if ( key === drawnKey ) return;
		drawnKey = key;
		h = PAD * 2 + items.length * ROW_H;
		const px = 1024;
		canvas.width = px;
		canvas.height = Math.round( px * h / W );
		panel.scale.set( W, h, 1 );
		const g = canvas.getContext( '2d' );
		const s = px / W;
		g.clearRect( 0, 0, canvas.width, canvas.height );
		g.fillStyle = 'rgba(28,36,33,0.92)';
		roundRect( g, 0, 0, canvas.width, canvas.height, 40 );
		g.fill();
		items.forEach( ( it, i ) => {

			const y = ( PAD + i * ROW_H ) * s;
			if ( i === hover && it.enabled !== false ) {

				g.fillStyle = 'rgba(168,213,209,0.25)';
				roundRect( g, PAD * s * 0.6, y + 6, canvas.width - PAD * s * 1.2, ROW_H * s - 12, 24 );
				g.fill();

			}

			g.fillStyle = it.enabled === false ? 'rgba(201,210,204,0.35)' : it.accent ? '#a8d5d1' : '#f3efe6';
			g.font = `${ it.accent ? 700 : 500 } ${ Math.round( ROW_H * s * 0.42 ) }px Karla, system-ui, sans-serif`;
			g.textBaseline = 'middle';
			g.fillText( it.label, PAD * s * 1.6, y + ROW_H * s / 2 );

		} );
		tex.needsUpdate = true;

	}

	// which row a point on the panel (in panel-local units, -0.5..0.5) falls on
	function rowAt( local ) {

		const yTop = 0.5 - local.y; // 0 at top edge, 1 at bottom
		const yM = yTop * h - PAD;
		if ( Math.abs( local.x ) > 0.5 || yM < 0 ) return - 1;
		const r = Math.floor( yM / ROW_H );
		return r >= 0 && r < items.length ? r : - 1;

	}

	function activate( i ) {

		const it = items[ i ];
		if ( ! it || it.enabled === false || cooldown > 0 ) return;
		cooldown = 0.8;
		haptics?.( 0.5, 40 );
		audio?.clap?.();
		onSelect( it.id );

	}

	const _local = new THREE.Vector3();
	const _n = new THREE.Vector3();
	const _ray = new THREE.Ray();
	const _plane = new THREE.Plane();
	const _hit = new THREE.Vector3();

	// palm: { pos, normal } in world space, or null. tip: right index tip (world) or null.
	// ray: { origin, dir, pressed } from the right controller, or null.
	function update( dt, { head, palm, tip, ray, forceShow } ) {

		cooldown = Math.max( 0, cooldown - dt );
		const show = !! palm && ( forceShow || ( palm.normal.y > 0.45 && _n.subVectors( head, palm.pos ).dot( palm.normal ) > 0 ) );
		panel.visible = show;
		if ( ! show ) {

			hover = - 1;
			return false;

		}

		draw();
		// float above the palm, facing your eyes
		panel.position.copy( palm.pos ).addScaledVector( palm.normal, 0.07 ).add( new THREE.Vector3( 0, h / 2, 0 ) );
		panel.lookAt( head );

		hover = - 1;
		cursor.visible = false;
		panel.updateMatrixWorld();

		if ( tip ) {

			_local.copy( tip );
			panel.worldToLocal( _local );
			const depth = _local.z * 1; // panel is unscaled in z
			const r = rowAt( _local );
			if ( r >= 0 && Math.abs( depth ) < 0.06 ) {

				hover = r;
				if ( Math.abs( depth ) < 0.012 ) activate( r );

			}

		}

		if ( ray ) {

			_n.set( 0, 0, 1 ).applyQuaternion( panel.quaternion );
			_plane.setFromNormalAndCoplanarPoint( _n, panel.position );
			_ray.set( ray.origin, ray.dir );
			if ( _ray.intersectPlane( _plane, _hit ) ) {

				_local.copy( _hit );
				panel.worldToLocal( _local );
				const r = rowAt( _local );
				if ( r >= 0 ) {

					hover = r;
					cursor.visible = true;
					cursor.position.set( _local.x, _local.y, 0.001 );
					cursor.scale.set( 1 / W, 1 / h, 1 );
					if ( ray.pressed ) activate( r );

				}

			}

		}

		draw();
		return true;

	}

	return { setItems, update, panel };

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
