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

		this._scheduleGull();

	}

	stop() {

		if ( this.ctx ) this.ctx.suspend();

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
