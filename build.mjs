// Bundles the game into dist/ as a static site: index.html, app.js and the Draco decoder.
import { build } from 'esbuild';
import { cpSync, mkdirSync, rmSync } from 'node:fs';

rmSync( 'dist', { recursive: true, force: true } );
mkdirSync( 'dist/draco', { recursive: true } );

await build( {
	entryPoints: [ 'src/main.js' ],
	bundle: true,
	format: 'esm',
	target: 'es2022',
	minify: true,
	sourcemap: true,
	outfile: 'dist/app.js',
	logLevel: 'info',
} );

cpSync( 'index.html', 'dist/index.html' );
for ( const f of [ 'draco_decoder.js', 'draco_decoder.wasm', 'draco_wasm_wrapper.js' ] ) {

	cpSync( `node_modules/three/examples/jsm/libs/draco/gltf/${ f }`, `dist/draco/${ f }` );

}

console.log( 'Built dist/' );
