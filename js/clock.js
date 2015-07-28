
(function(window) {
	if (!window.console || !window.console.log) { return; }

	console.log('Clock');
	console.log('http://github.com/soundio/clock');
	console.log('Map beats against time and schedule fn calls');
	console.log('––––––––––––––––––––––––––––––––––––––––––––');
})(this);


(function(window) {
	"use strict";

	var debug = true;

	var AudioObject = window.AudioObject;
	var Collection  = window.Collection;
	var assign      = Object.assign;

	var lookahead = 0.050; // seconds

	function noop() {}

	function isDefined(val) {
		return val !== undefined && val !== null;
	}

	function tempoToRate(tempo) { return tempo / 60; }

	function rateToTempo(rate) { return rate * 60; }

	// A cue looks like this:
	// [beat, time, fn, lookahead, timeout]

	function createTimeout(cues, data, ms) {
		return setTimeout(function(time, fn) {
			fn(time);
			var i = cues.indexOf(data);
			cues.splice(i, 1);
		}, ms, data[1], data[2]);
	}

	function cue(cues, currentTime, beat, time, fn, lookahead) {
		var diff = time - currentTime;

		// If we are already more than 20ms past the cue time ignore
		// the cue. Not 100% sure this the behaviour we want.
		if (diff < -0.02) { return; }

		// If eventTime is within the next few milliseconds fire the
		// cue fn right away.
		if (diff < (lookahead + 0.02)) {
			fn(time);
			return;
		}

		// Cue up a function to fire at a time displaced by lookahead,
		// storing the time, fn and timer in cues.
		var data = [beat, time, fn, lookahead];
		var ms = Math.floor((diff - lookahead) * 1000);

		data.push(createTimeout(cues, data, ms));
		cues.push(data);
	}

	function uncueAll(cues) {
		var n = cues.length;

		while (n--) {
			clearTimeout(cues[n][4]);
		}

		cues.length = 0;
	}

	function uncueBeat(cues, beat, fn) {
		var n = cues.length;

		while (n--) {
			if (beat === cues[n][0]) {
				if (!fn || fn === cues[n][2]) {
					cues.splice(n, 1);
					clearTimeout(cues[n][4]);
				}
			}
		}
	}

	function uncueFn(cues, fn) {
		var n = cues.length;

		while (n--) {
			if (fn === cues[n][2]) {
				cues.splice(n, 1);
				clearTimeout(cues[n][4]);
			}
		}
	}

	function uncueLater(cues, time, fn) {
		var n = cues.length;
		var data;

		while (n--) {
			data = cues[n];
			if (time >= data[0]) {
				if (!fn || fn === data[1]) {
					cues.splice(n, 1);
					clearTimeout(data[2]);
				}
			}
		}
	}

	function recueAfterTime(clock, cues, time) {
		var n = clock.length;
		var data;
console.log(clock, n);
		while (--n) {
			data = cues[n];
			if (time < data[0]) {
				clearTimeout(data[3]);
				//clock[n] = createCue(cues, data[0], data[1]);
			}
		}
	}

	function recueAfterBeat(clock, cues, beat) {
		var n = cues.length;
		var data, diff, ms;

		while (--n) {
			data = cues[n];
			if (beat < data[0]) {
				// Clear the existing timeout in data[4]
				clearTimeout(data[4]);

				// Recalculate the time in data[1] from the beat in data[0]
				data[1] = clock.timeAtBeat(data[0]);
				diff = data[1] - clock.time;

				// If cue time is in the near future fire fn in data[2] right
				// away and remove cue from list
				if (diff < (data[3] + 0.02)) {
					data[2](time);
					cues.splice(n, 1);
				}
				// Otherwise create a new timer and stick it in data[4]
				else {
					ms = Math.floor((diff - data[3]) * 1000);
					data[4] = createTimeout(cues, data, ms);
				}
			}
		}
	}

	function deleteTimesAfterBeat(clock, beat) {
		var n = -1;
		var entry;

		while (clock[++n]) {
			entry = clock[n];
			if (entry.beat > beat) { delete clock[n].time; }
		}
	}

	function UnityNode() {
		var oscillator = audio.createOscillator();
		var waveshaper = audio.createWaveShaper();

		var curve = new Float32Array(2);
		curve[0] = curve[1] = 1;

		oscillator.type = 'square';
		oscillator.connect(waveshaper);
		oscillator.frequency.value = 100;
		waveshaper.curve = curve;
		oscillator.start();

		return waveshaper;
	}

	function Clock(audio, data) {
		var clock = this;
		var starttime = audio.currentTime;

		var unityNode    = UnityNode();
		var rateNode     = audio.createGain();
		var durationNode = audio.createGain();
		var rate = 1;

		rateNode.channelCount = 1;
		durationNode.channelCount = 1;
		rateNode.gain.setValueAtTime(rate, starttime);
		durationNode.gain.setValueAtTime(rate, starttime);

		unityNode.connect(rateNode);
		unityNode.connect(durationNode);

		// Set up clock as a collection of tempo data.
		Collection.call(this, data || [], { index: 'beat' });

		// Set up clock as an audio object with outputs "rate" and
		// "duration" and audio property "rate". 
		AudioObject.call(this, audio, undefined, {
			rate:     rateNode,
			duration: durationNode,
		}, {
			rate: {
				get: function() {
					return rate;
				},

				set: function(value, time, duration, curve) {
					AudioObject.automate(rateNode.gain, value, time, 0, 'step');
					AudioObject.automate(durationNode.gain, 1/value, time, 0, 'step');
					rate = value;

console.log('SET RATE', time.toFixed(3));

					// A tempo change must be created where rate has been set
					// externally. Calls to setTempo from within clock should
					// first set setTempo to noop to avoid this.
					addTempo(time, rate);
				}
			}
		});

		var cues = [];

		function addTempo(time, rate) {
			var beat  = clock.beatAtTime(time);
			var tempo = rateToTempo(rate);
			var entry = clock.find(beat);

			if (entry && entry.tempo !== tempo) {
				entry.tempo = tempo;
				entry.time = time;
				recueAfterBeat(clock, cues, beat);
			}
			else {
				clock.add({
					tempo: tempo,
					beat: beat,
					time: time
				});
			}
		}

		function cueTempo(entry) {
			clock.cue(entry.beat, function(time) {
				var rate = tempoToRate(entry.tempo);
				var _addTempo = addTempo;
				addTempo = noop;
				clock.automate('rate', rate, time, 'step');
				addTempo = _addTempo;
				if (debug) console.log('Clock: cued tempo bpm:', entry.tempo, 'rate:', rate);
			});
		}

		this
		.on('add', function(clock, entry) {
			deleteTimesAfterBeat(entry.beat);
			cueTempo(entry);
			recueAfterBeat(clock, cues, entry.beat);
		});

		Object.defineProperties(this, {
			startTime: { get: function() { return starttime; }},
			time: { get: function() { return audio.currentTime; }},
			beat: { get: function() { return this.beatAtTime(audio.currentTime); }}
		});

		assign(this, {
			start: function(time) {
				deleteTimesAfterBeat(this, 0);
				starttime = isDefined(time) ? time : audio.currentTime ;

				// Cue up tempo changes
				this.forEach(cueTempo);

				//recueAfterBeat(cues, this, 0);
				this.trigger('start', starttime);
				return this;
			},

			tempo: function(beat, tempo) {
//				var entry = this.find(beat);
//
//				if (entry && entry.tempo !== tempo) {
//					entry.tempo = tempo;
//					recueAfterBeat(clock, cues, beat);
//				}
//				else {
//					this.add({
//						tempo: tempo,
//						beat: beat
//					});
//				}
//
//				return entry;
			},

			on: function(beat, fn) {
				cue(cues, audio.currentTime, beat, this.timeAtBeat(beat), fn, 0);
				return this;
			},

			cue: function(beat, fn, offset) {
				cue(cues, audio.currentTime, beat, this.timeAtBeat(beat), fn, isDefined(offset) ? offset : lookahead);
				return this;
			},

			uncue: function(beat, fn) {
				if (arguments.length === 0) {
					uncueAll(cues);
				}
				else if (typeof beat === 'number') {
					uncueBeat(cues, beat, fn);
				}
				else {
					uncueFn(cues, beat);
				}

				return this;
			},

			uncueAfter: function(beat, fn) {
				uncueLater(cues, this.timeAtBeat(beat), fn);
				return this;
			},

			onTime: function(time, fn) {
				// Make the cue timer 
				cue(cues, audio.currentTime, time, fn, 0);
				return this;
			},

			cueTime: function(time, fn, offset) {
				// Make the cue timer
				cue(cues, audio.currentTime, time, fn, isDefined(offset) ? offset : lookahead);
				return this;
			},

			uncueTime: function(time, fn) {
				if (typeof time === 'number') {
					uncue(cues, time, fn);
				}
				else {
					uncue(cues, undefined, time);
				}

				return this;
			},

			uncueAfterTime: function(time, fn) {
				uncueLater(cues, time, fn);
				return this;
			}
		});
	}

	assign(Clock.prototype, Collection.prototype, AudioObject.prototype, {
		timeAtBeat: function(beat) {
			// Sort tempos by beat
			this.sort();

			var tempos = this;
			var n = 0;
			var entry = tempos[n];

			if (!entry) {
				// Where there are no tempo entries, make time
				// equivalent to beat
				return this.startTime + beat;
			}

			var b1 = 0;
			var rate = 1;
			var time = 0;

			while (entry && entry.beat < beat) {
				time = entry.time || (entry.time = time + (entry.beat - b1) / rate);

				// Next entry
				b1 = entry.beat;
				rate = tempoToRate(entry.tempo);
				entry = tempos[++n];
			}

			return this.startTime + time + (beat - b1) / rate;
		},

		beatAtTime: function(time) {
			// Sort tempos by beat
			this.sort();

			var tempos = this;
			var n = 0;
			var entry = tempos[n];

			if (!entry) {
				// Where there are no tempo entries, make beat
				// equivalent to time
				return time - this.startTime;
			}

			var beat = 0;
			var rate = 1;
			var t2 = this.startTime;
			var t1 = t2;

			while (t2 < time) {
				rate  = tempoToRate(entry.tempo);
				beat  = entry.beat;
				entry = tempos[++n];
				t1 = t2;

				if (!entry) { break; }

				t2 = tempos.timeAtBeat(entry.beat);
			}

			return beat + (time - t1) * rate;
		}
	});

	assign(Clock, {
		tempoToRate: tempoToRate,
		rateToTempo: rateToTempo
	});

	// setTimeout severely slows down in Chrome when the document is
	// no longer visible. We may want to recue the timers with a longer
	// lookahead.
	document.addEventListener("visibilitychange", function(e) {
		if (document.hidden) {
			if (debug) console.log('Clock: Page hidden. Do something about timers?');
		}
		else {
			if (debug) console.log('Clock: Page shown. Do something about timers?');
		}
	});

	window.Clock = Clock;
})(window);
