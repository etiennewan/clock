# Clock
Clock maps a beat clock against Web Audio context's time clock and provides
functions for scheduling function calls.

## Dependencies and tests

Clock depends on two repos that can be installed as git submodules:

- <a href="https://github.com/cruncher/collection">github.com/cruncher/collection</a>
- <a href="https://github.com/soundio/audio-object">github.com/soundio/audio-object</a>

Install with submodules:

	git clone https://github.com/soundio/clock.git
	cd clock
	git submodule update --init

Tests use Karma. To run tests:

	npm install
	karma start

## Clock(audio, data)

Constructs a tempo clock, where <code>audio</code> is a Web Audio context and
<code>data</code> is an optional array of tempo changes.

    var audio = new window.AudioContext();
    var clock = new Clock(audio);

A clock is tool for scheduling function calls on times or beats.
A clock is a Collection of tempo data, used to map a <code>beat</code> clock
against the audio context's <code>time</code> clock. It is also an AudioObject
with a default output representing the current beat <code>rate</code>.

## clock

### .add(tempo)

Adds a tempo change to the list. Set tempo to 120bpm at beat 42:

    clock.add({
        beat: 42,
        rate: 2
    });

### .find(beat)

Returns tempo change found at <code>beat</code> or <code>undefined</code>.

### .remove(beat)

Removes tempo change found at <code>beat</code>.

### .cueTime(time, fn)<br/>.cueBeat(beat, fn)

Cue a function to be called just before <code>time</code> or <code>beat</code>.
<code>fn</code> is called with the argument <code>time</code>, which can used to
accurately schedule Web Audio changes.

    clock.cueBeat(42, function(time) {
        gainParam.setValueAtTime(time, 0.25);
        bufferSourceNode.start(time);
    });

##### .cueTime(time, fn, lookahead)<br/>.cueBeat(time, fn, lookahead)

Pass in a number <code>lookahead</code> to override the default <code>-60</code> ms.

### .onTime(time, fn)<br/>.onBeat(beat, fn)

Shorthand for <code>clock.cueTime(time, fn, 0)</code> or
<code>clock.cueBeat(beat, fn, 0)</code>, calls <code>fn</code>
at the time or beat specified with <code>0</code> ms lookahead.

### .uncueTime(time, fn)<br/>.uncueBeat(beat, fn)

Removes <code>fn</code> at <code>time</code> or <code>beat</code> from the timer queue.
Either or both <code>time</code> and <code>fn</code> can be given. To remove all cues
at <code>time</code> or <code>beat</code> from the timer queue:

    clock.uncueTime(time)
    clock.uncueBeat(beat)

To removes all cues to <code>fn</code> from the timer queue:

    clock.uncueTime(fn)

### .uncueAfterTime(time, fn)<br/>.uncueAfterBeat(beat, fn)

Removes all cues to <code>fn</code> after <code>time</code> or <code>beat</code>.
Either or both <code>time</code>/<code>beat</code> and <code>fn</code> can be given.
To remove all cues after <code>time</code> or <code>beat</code> from the timer queue:

    clock.uncueAfterTime(time)
    clock.uncueAfterBeat(beat)

### .timeAtBeat(beat)

Returns the audio context time at <code>beat</code>.

### .beatAtTime(time)

Returns the beat at <code>time</code>.

