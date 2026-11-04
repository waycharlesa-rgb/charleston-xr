// Procedural harbor ambience: waves on the seawall, a light sea breeze and the
// occasional distant gull. Everything is synthesized, so there are no audio files.

export class HarborAmbience {

	constructor() {

		this.ctx = null;
		this.master = null;
		this.started = false;

	}

	start() {

		if ( this.started ) {

			this.ctx.resume();
			return;

		}

		const AC = window.AudioContext || window.webkitAudioContext;
		if ( ! AC ) return;

		const ctx = this.ctx = new AC();
		this.started = true;

		this.master = ctx.createGain();
		this.master.gain.value = 0;
		this.master.connect( ctx.destination );
		this.master.gain.linearRampToValueAtTime( 0.8, ctx.currentTime + 3 );

		const noise = this._noiseBuffer( 4 );

		// Waves: low-passed brown-ish noise, swelling every 6–9 seconds.
		const waves = this._loop( noise );
		const waveFilter = ctx.createBiquadFilter();
		waveFilter.type = 'lowpass';
		waveFilter.frequency.value = 520;
		const waveGain = ctx.createGain();
		waveGain.gain.value = 0.18;
		waves.connect( waveFilter ).connect( waveGain ).connect( this.master );
		this._swell( waveGain.gain, 0.06, 0.32, 6, 9 );
		this._swell( waveFilter.frequency, 380, 900, 6, 9 );

		// Breeze: band-passed noise drifting in pitch.
		const wind = this._loop( noise, 1.7 );
		const windFilter = ctx.createBiquadFilter();
		windFilter.type = 'bandpass';
		windFilter.frequency.value = 900;
		windFilter.Q.value = 0.6;
		const windGain = ctx.createGain();
		windGain.gain.value = 0.04;
		wind.connect( windFilter ).connect( windGain ).connect( this.master );
		this._swell( windFilter.frequency, 500, 1400, 10, 16 );
		this._swell( windGain.gain, 0.015, 0.06, 8, 14 );

		// Rushing air while flying fast; silent until setFlightSpeed() raises it.
		const rush = this._loop( noise, 2.3 );
		this.rushFilter = ctx.createBiquadFilter();
		this.rushFilter.type = 'bandpass';
		this.rushFilter.Q.value = 0.7;
		this.rushFilter.frequency.value = 600;
		this.rushGain = ctx.createGain();
		this.rushGain.gain.value = 0;
		rush.connect( this.rushFilter ).connect( this.rushGain ).connect( this.master );

		this._scheduleGull();

	}

	setFlightSpeed( mps ) {

		if ( ! this.rushGain ) return;
		const k = Math.min( 1, mps / 35 );
		const t = this.ctx.currentTime;
		this.rushGain.gain.setTargetAtTime( k * 0.5, t, 0.2 );
		this.rushFilter.frequency.setTargetAtTime( 400 + k * 1400, t, 0.2 );

	}

	stop() {

		if ( this.ctx ) this.ctx.suspend();

	}

	// ------------------------------------------------ alchemy and flight effects

	_burst( seconds, setup ) {

		const ctx = this.ctx;
		if ( ! ctx ) return;
		const src = ctx.createBufferSource();
		src.buffer = this._whiteNoise || ( this._whiteNoise = this._white( 2 ) );
		const out = ctx.createGain();
		out.connect( this.master );
		setup( src, out, ctx.currentTime );
		src.start();
		src.stop( ctx.currentTime + seconds );

	}

	_white( seconds ) {

		const ctx = this.ctx;
		const buffer = ctx.createBuffer( 1, ctx.sampleRate * seconds, ctx.sampleRate );
		const d = buffer.getChannelData( 0 );
		for ( let i = 0; i < d.length; i ++ ) d[ i ] = Math.random() * 2 - 1;
		return buffer;

	}

	clap() {

		this._burst( 0.15, ( src, out, t ) => {

			const bp = this.ctx.createBiquadFilter();
			bp.type = 'bandpass';
			bp.frequency.value = 1400;
			bp.Q.value = 0.8;
			out.gain.setValueAtTime( 0.9, t );
			out.gain.exponentialRampToValueAtTime( 0.001, t + 0.12 );
			src.connect( bp ).connect( out );

		} );

	}

	// a low electric hum while your hands are charged
	charge( on ) {

		const ctx = this.ctx;
		if ( ! ctx ) return;
		if ( on && ! this._hum ) {

			const g = ctx.createGain();
			g.gain.value = 0;
			g.gain.linearRampToValueAtTime( 0.05, ctx.currentTime + 0.2 );
			const trem = ctx.createGain();
			const lfo = ctx.createOscillator();
			lfo.frequency.value = 23;
			const lfoGain = ctx.createGain();
			lfoGain.gain.value = 0.5;
			lfo.connect( lfoGain ).connect( trem.gain );
			const a = ctx.createOscillator();
			a.type = 'sawtooth';
			a.frequency.value = 110;
			const b = ctx.createOscillator();
			b.type = 'square';
			b.frequency.value = 165.5;
			const lp = ctx.createBiquadFilter();
			lp.type = 'lowpass';
			lp.frequency.value = 900;
			a.connect( lp );
			b.connect( lp );
			lp.connect( trem ).connect( g ).connect( this.master );
			[ a, b, lfo ].forEach( o => o.start() );
			this._hum = { g, oscs: [ a, b, lfo ] };

		} else if ( ! on && this._hum ) {

			const { g, oscs } = this._hum;
			this._hum = null;
			g.gain.cancelScheduledValues( ctx.currentTime );
			g.gain.setValueAtTime( g.gain.value, ctx.currentTime );
			g.gain.linearRampToValueAtTime( 0, ctx.currentTime + 0.25 );
			oscs.forEach( o => o.stop( ctx.currentTime + 0.3 ) );

		}

	}

	// crackling arcs plus the grind and rumble of stone breaking through
	transmute( seconds = 1 ) {

		const ctx = this.ctx;
		if ( ! ctx ) return;

		this._burst( seconds + 0.4, ( src, out, t ) => {

			const hp = ctx.createBiquadFilter();
			hp.type = 'highpass';
			hp.frequency.value = 2600;
			src.connect( hp ).connect( out );
			// random on/off steps make noise sound like electrical arcing
			for ( let x = t; x < t + seconds + 0.3; x += 0.012 + Math.random() * 0.03 ) {

				const fade = 1 - ( x - t ) / ( seconds + 0.3 );
				out.gain.setValueAtTime( Math.random() < 0.55 ? 0.45 * fade : 0.02, x );

			}

			out.gain.setValueAtTime( 0, t + seconds + 0.35 );

		} );

		this._burst( seconds + 1.2, ( src, out, t ) => {

			const lp = ctx.createBiquadFilter();
			lp.type = 'lowpass';
			lp.frequency.value = 160;
			src.playbackRate.value = 0.5;
			out.gain.setValueAtTime( 0, t );
			out.gain.linearRampToValueAtTime( 1.6, t + 0.08 );
			out.gain.linearRampToValueAtTime( 0.9, t + seconds );
			out.gain.linearRampToValueAtTime( 0, t + seconds + 1.1 );
			src.connect( lp ).connect( out );

		} );

		const sub = ctx.createOscillator();
		const sg = ctx.createGain();
		sub.frequency.value = 42;
		sg.gain.setValueAtTime( 0, ctx.currentTime );
		sg.gain.linearRampToValueAtTime( 0.35, ctx.currentTime + 0.05 );
		sg.gain.linearRampToValueAtTime( 0, ctx.currentTime + seconds + 0.6 );
		sub.connect( sg ).connect( this.master );
		sub.start();
		sub.stop( ctx.currentTime + seconds + 0.7 );

	}

	// ------------------------------------------------ vehicles

	setEngine( on, load = 0, throttle = 0 ) {

		const ctx = this.ctx;
		if ( ! ctx ) return;
		if ( ! this._engine ) {

			const g = ctx.createGain();
			g.gain.value = 0;
			const lp = ctx.createBiquadFilter();
			lp.type = 'lowpass';
			lp.frequency.value = 400;
			const a = ctx.createOscillator();
			a.type = 'sawtooth';
			const b = ctx.createOscillator();
			b.type = 'square';
			a.connect( lp );
			b.connect( lp );
			lp.connect( g ).connect( this.master );
			a.start();
			b.start();
			this._engine = { g, lp, a, b };

		}

		const e = this._engine, t = ctx.currentTime;
		const f = 34 + load * 120 + throttle * 12; // firing frequency rises with speed
		e.a.frequency.setTargetAtTime( f, t, 0.08 );
		e.b.frequency.setTargetAtTime( f * 0.5, t, 0.08 );
		e.lp.frequency.setTargetAtTime( 250 + throttle * 700 + load * 500, t, 0.1 );
		e.g.gain.setTargetAtTime( on ? 0.07 + throttle * 0.05 : 0, t, 0.15 );

	}

	hoof( speed = 1 ) {

		this._burst( 0.08, ( src, out, t ) => {

			const bp = this.ctx.createBiquadFilter();
			bp.type = 'bandpass';
			bp.frequency.value = 700 + Math.random() * 500;
			bp.Q.value = 3;
			out.gain.setValueAtTime( 0.35 + Math.min( 0.3, speed * 0.05 ), t );
			out.gain.exponentialRampToValueAtTime( 0.001, t + 0.06 );
			src.connect( bp ).connect( out );

		} );

	}

	setWater( mps ) {

		const ctx = this.ctx;
		if ( ! ctx ) return;
		if ( ! this._water ) {

			const src = this._loop( this._noiseBuffer( 3 ), 1.4 );
			const lp = ctx.createBiquadFilter();
			lp.type = 'lowpass';
			lp.frequency.value = 900;
			const g = ctx.createGain();
			g.gain.value = 0;
			src.connect( lp ).connect( g ).connect( this.master );
			this._water = { g, lp };

		}

		const k = Math.min( 1, mps / 6 );
		this._water.g.gain.setTargetAtTime( k * 0.5, ctx.currentTime, 0.3 );
		this._water.lp.frequency.setTargetAtTime( 500 + k * 1500, ctx.currentTime, 0.3 );

	}

	// sails flapping when you point too close to the wind
	luff( on ) {

		const ctx = this.ctx;
		if ( ! ctx || on === !! this._luff ) return;
		if ( on ) {

			const src = this._loop( this._whiteNoise || ( this._whiteNoise = this._white( 2 ) ), 0.8 );
			const bp = ctx.createBiquadFilter();
			bp.type = 'bandpass';
			bp.frequency.value = 350;
			const g = ctx.createGain();
			g.gain.value = 0;
			const lfo = ctx.createOscillator();
			lfo.frequency.value = 6.5;
			const lg = ctx.createGain();
			lg.gain.value = 0.12;
			lfo.connect( lg ).connect( g.gain );
			lfo.start();
			src.connect( bp ).connect( g ).connect( this.master );
			this._luff = { src, lfo, g };

		} else {

			const { src, lfo } = this._luff;
			this._luff = null;
			src.stop( ctx.currentTime + 0.1 );
			lfo.stop( ctx.currentTime + 0.1 );

		}

	}

	crash( strength = 0.5 ) {

		this._burst( 0.5, ( src, out, t ) => {

			const lp = this.ctx.createBiquadFilter();
			lp.type = 'lowpass';
			lp.frequency.value = 600;
			out.gain.setValueAtTime( 0.4 + strength * 0.9, t );
			out.gain.exponentialRampToValueAtTime( 0.001, t + 0.45 );
			src.connect( lp ).connect( out );

		} );

	}

	whoosh( up = true ) {

		this._burst( 0.9, ( src, out, t ) => {

			const bp = this.ctx.createBiquadFilter();
			bp.type = 'bandpass';
			bp.Q.value = 1.2;
			bp.frequency.setValueAtTime( up ? 300 : 1400, t );
			bp.frequency.exponentialRampToValueAtTime( up ? 1600 : 250, t + 0.8 );
			out.gain.setValueAtTime( 0, t );
			out.gain.linearRampToValueAtTime( 0.35, t + 0.25 );
			out.gain.linearRampToValueAtTime( 0, t + 0.85 );
			src.connect( bp ).connect( out );

		} );

	}

	_noiseBuffer( seconds ) {

		const ctx = this.ctx;
		const len = ctx.sampleRate * seconds;
		const buffer = ctx.createBuffer( 1, len, ctx.sampleRate );
		const data = buffer.getChannelData( 0 );
		let last = 0;
		for ( let i = 0; i < len; i ++ ) {

			// brown noise
			last = ( last + 0.02 * ( Math.random() * 2 - 1 ) ) / 1.02;
			data[ i ] = last * 3.5;

		}

		return buffer;

	}

	_loop( buffer, rate = 1 ) {

		const src = this.ctx.createBufferSource();
		src.buffer = buffer;
		src.loop = true;
		src.playbackRate.value = rate;
		src.start();
		return src;

	}

	_swell( param, min, max, minPeriod, maxPeriod ) {

		const ctx = this.ctx;
		let t = ctx.currentTime;
		const schedule = () => {

			const now = ctx.currentTime;
			while ( t < now + 30 ) {

				const period = minPeriod + Math.random() * ( maxPeriod - minPeriod );
				param.linearRampToValueAtTime( max * ( 0.7 + Math.random() * 0.3 ), t + period * 0.4 );
				param.linearRampToValueAtTime( min, t + period );
				t += period;

			}

		};

		schedule();
		setInterval( schedule, 10000 );

	}

	_scheduleGull() {

		const delay = 9000 + Math.random() * 20000;
		setTimeout( () => {

			if ( this.ctx.state === 'running' ) this._gull();
			this._scheduleGull();

		}, delay );

	}

	_gull() {

		const ctx = this.ctx;
		const pan = ctx.createStereoPanner();
		pan.pan.value = Math.random() * 2 - 1;
		pan.connect( this.master );

		const calls = 2 + Math.floor( Math.random() * 3 );
		let t = ctx.currentTime;
		for ( let i = 0; i < calls; i ++ ) {

			const osc = ctx.createOscillator();
			osc.type = 'sawtooth';
			const filter = ctx.createBiquadFilter();
			filter.type = 'bandpass';
			filter.frequency.value = 2200;
			filter.Q.value = 4;
			const g = ctx.createGain();
			g.gain.value = 0;

			const base = 1300 + Math.random() * 300;
			osc.frequency.setValueAtTime( base * 1.35, t );
			osc.frequency.exponentialRampToValueAtTime( base, t + 0.28 );
			g.gain.linearRampToValueAtTime( 0.025, t + 0.03 );
			g.gain.linearRampToValueAtTime( 0, t + 0.3 );

			osc.connect( filter ).connect( g ).connect( pan );
			osc.start( t );
			osc.stop( t + 0.35 );
			t += 0.32 + Math.random() * 0.12;

		}

	}

}
