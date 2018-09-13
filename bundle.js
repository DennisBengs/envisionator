/**
 * SfxrParams
 *
 * Copyright 2010 Thomas Vian
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * @author Thomas Vian
 */
/** @constructor */
function SfxrParams() {
  //--------------------------------------------------------------------------
  //
  //  Settings String Methods
  //
  //--------------------------------------------------------------------------

  /**
   * Parses a settings array into the parameters
   * @param array Array of the settings values, where elements 0 - 23 are
   *                a: waveType
   *                b: attackTime
   *                c: sustainTime
   *                d: sustainPunch
   *                e: decayTime
   *                f: startFrequency
   *                g: minFrequency
   *                h: slide
   *                i: deltaSlide
   *                j: vibratoDepth
   *                k: vibratoSpeed
   *                l: changeAmount
   *                m: changeSpeed
   *                n: squareDuty
   *                o: dutySweep
   *                p: repeatSpeed
   *                q: phaserOffset
   *                r: phaserSweep
   *                s: lpFilterCutoff
   *                t: lpFilterCutoffSweep
   *                u: lpFilterResonance
   *                v: hpFilterCutoff
   *                w: hpFilterCutoffSweep
   *                x: masterVolume
   * @return If the string successfully parsed
   */
  this.setSettings = function(values)
  {
    for ( var i = 0; i < 24; i++ )
    {
      this[String.fromCharCode( 97 + i )] = values[i] || 0;
    }

    // I moved this here from the reset(true) function
    if (this['c'] < .01) {
      this['c'] = .01;
    }

    var totalTime = this['b'] + this['c'] + this['e'];
    if (totalTime < .18) {
      var multiplier = .18 / totalTime;
      this['b']  *= multiplier;
      this['c'] *= multiplier;
      this['e']   *= multiplier;
    }
  }
}

/**
 * SfxrSynth
 *
 * Copyright 2010 Thomas Vian
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * @author Thomas Vian
 */
/** @constructor */
function SfxrSynth() {
  // All variables are kept alive through function closures

  //--------------------------------------------------------------------------
  //
  //  Sound Parameters
  //
  //--------------------------------------------------------------------------

  this._params = new SfxrParams();  // Params instance

  //--------------------------------------------------------------------------
  //
  //  Synth Variables
  //
  //--------------------------------------------------------------------------

  var _envelopeLength0, // Length of the attack stage
      _envelopeLength1, // Length of the sustain stage
      _envelopeLength2, // Length of the decay stage

      _period,          // Period of the wave
      _maxPeriod,       // Maximum period before sound stops (from minFrequency)

      _slide,           // Note slide
      _deltaSlide,      // Change in slide

      _changeAmount,    // Amount to change the note by
      _changeTime,      // Counter for the note change
      _changeLimit,     // Once the time reaches this limit, the note changes

      _squareDuty,      // Offset of center switching point in the square wave
      _dutySweep;       // Amount to change the duty by

  //--------------------------------------------------------------------------
  //
  //  Synth Methods
  //
  //--------------------------------------------------------------------------

  /**
   * Resets the runing variables from the params
   * Used once at the start (total reset) and for the repeat effect (partial reset)
   */
  this.reset = function() {
    // Shorter reference
    var p = this._params;

    _period       = 100 / (p['f'] * p['f'] + .001);
    _maxPeriod    = 100 / (p['g']   * p['g']   + .001);

    _slide        = 1 - p['h'] * p['h'] * p['h'] * .01;
    _deltaSlide   = -p['i'] * p['i'] * p['i'] * .000001;

    if (!p['a']) {
      _squareDuty = .5 - p['n'] / 2;
      _dutySweep  = -p['o'] * .00005;
    }

    _changeAmount =  1 + p['l'] * p['l'] * (p['l'] > 0 ? -.9 : 10);
    _changeTime   = 0;
    _changeLimit  = p['m'] == 1 ? 0 : (1 - p['m']) * (1 - p['m']) * 20000 + 32;
  }

  // I split the reset() function into two functions for better readability
  this.totalReset = function() {
    this.reset();

    // Shorter reference
    var p = this._params;

    // Calculating the length is all that remained here, everything else moved somewhere
    _envelopeLength0 = p['b']  * p['b']  * 100000;
    _envelopeLength1 = p['c'] * p['c'] * 100000;
    _envelopeLength2 = p['e']   * p['e']   * 100000 + 12;
    // Full length of the volume envelop (and therefore sound)
    // Make sure the length can be divided by 3 so we will not need the padding "==" after base64 encode
    return ((_envelopeLength0 + _envelopeLength1 + _envelopeLength2) / 3 | 0) * 3;
  }

  /**
   * Writes the wave to the supplied buffer ByteArray
   * @param buffer A ByteArray to write the wave to
   * @return If the wave is finished
   */
  this.synthWave = function(buffer, length) {
    // Shorter reference
    var p = this._params;

    // If the filters are active
    var _filters = p['s'] != 1 || p['v'],
        // Cutoff multiplier which adjusts the amount the wave position can move
        _hpFilterCutoff = p['v'] * p['v'] * .1,
        // Speed of the high-pass cutoff multiplier
        _hpFilterDeltaCutoff = 1 + p['w'] * .0003,
        // Cutoff multiplier which adjusts the amount the wave position can move
        _lpFilterCutoff = p['s'] * p['s'] * p['s'] * .1,
        // Speed of the low-pass cutoff multiplier
        _lpFilterDeltaCutoff = 1 + p['t'] * .0001,
        // If the low pass filter is active
        _lpFilterOn = p['s'] != 1,
        // masterVolume * masterVolume (for quick calculations)
        _masterVolume = p['x'] * p['x'],
        // Minimum frequency before stopping
        _minFreqency = p['g'],
        // If the phaser is active
        _phaser = p['q'] || p['r'],
        // Change in phase offset
        _phaserDeltaOffset = p['r'] * p['r'] * p['r'] * .2,
        // Phase offset for phaser effect
        _phaserOffset = p['q'] * p['q'] * (p['q'] < 0 ? -1020 : 1020),
        // Once the time reaches this limit, some of the    iables are reset
        _repeatLimit = p['p'] ? ((1 - p['p']) * (1 - p['p']) * 20000 | 0) + 32 : 0,
        // The punch factor (louder at begining of sustain)
        _sustainPunch = p['d'],
        // Amount to change the period of the wave by at the peak of the vibrato wave
        _vibratoAmplitude = p['j'] / 2,
        // Speed at which the vibrato phase moves
        _vibratoSpeed = p['k'] * p['k'] * .01,
        // The type of wave to generate
        _waveType = p['a'];

    var _envelopeLength      = _envelopeLength0,     // Length of the current envelope stage
        _envelopeOverLength0 = 1 / _envelopeLength0, // (for quick calculations)
        _envelopeOverLength1 = 1 / _envelopeLength1, // (for quick calculations)
        _envelopeOverLength2 = 1 / _envelopeLength2; // (for quick calculations)

    // Damping muliplier which restricts how fast the wave position can move
    var _lpFilterDamping = 5 / (1 + p['u'] * p['u'] * 20) * (.01 + _lpFilterCutoff);
    if (_lpFilterDamping > .8) {
      _lpFilterDamping = .8;
    }
    _lpFilterDamping = 1 - _lpFilterDamping;

    var _finished = false,     // If the sound has finished
        _envelopeStage    = 0, // Current stage of the envelope (attack, sustain, decay, end)
        _envelopeTime     = 0, // Current time through current enelope stage
        _envelopeVolume   = 0, // Current volume of the envelope
        _hpFilterPos      = 0, // Adjusted wave position after high-pass filter
        _lpFilterDeltaPos = 0, // Change in low-pass wave position, as allowed by the cutoff and damping
        _lpFilterOldPos,       // Previous low-pass wave position
        _lpFilterPos      = 0, // Adjusted wave position after low-pass filter
        _periodTemp,           // Period modified by vibrato
        _phase            = 0, // Phase through the wave
        _phaserInt,            // Integer phaser offset, for bit maths
        _phaserPos        = 0, // Position through the phaser buffer
        _pos,                  // Phase expresed as a Number from 0-1, used for fast sin approx
        _repeatTime       = 0, // Counter for the repeats
        _sample,               // Sub-sample calculated 8 times per actual sample, averaged out to get the super sample
        _superSample,          // Actual sample writen to the wave
        _vibratoPhase     = 0; // Phase through the vibrato sine wave

    // Buffer of wave values used to create the out of phase second wave
    var _phaserBuffer = new Array(1024),
        // Buffer of random values used to generate noise
        _noiseBuffer  = new Array(32);
    for (var i = _phaserBuffer.length; i--; ) {
      _phaserBuffer[i] = 0;
    }
    for (var i = _noiseBuffer.length; i--; ) {
      _noiseBuffer[i] = Math.random() * 2 - 1;
    }

    for (var i = 0; i < length; i++) {
      if (_finished) {
        return i;
      }

      // Repeats every _repeatLimit times, partially resetting the sound parameters
      if (_repeatLimit) {
        if (++_repeatTime >= _repeatLimit) {
          _repeatTime = 0;
          this.reset();
        }
      }

      // If _changeLimit is reached, shifts the pitch
      if (_changeLimit) {
        if (++_changeTime >= _changeLimit) {
          _changeLimit = 0;
          _period *= _changeAmount;
        }
      }

      // Acccelerate and apply slide
      _slide += _deltaSlide;
      _period *= _slide;

      // Checks for frequency getting too low, and stops the sound if a minFrequency was set
      if (_period > _maxPeriod) {
        _period = _maxPeriod;
        if (_minFreqency > 0) {
          _finished = true;
        }
      }

      _periodTemp = _period;

      // Applies the vibrato effect
      if (_vibratoAmplitude > 0) {
        _vibratoPhase += _vibratoSpeed;
        _periodTemp *= 1 + Math.sin(_vibratoPhase) * _vibratoAmplitude;
      }

      _periodTemp |= 0;
      if (_periodTemp < 8) {
        _periodTemp = 8;
      }

      // Sweeps the square duty
      if (!_waveType) {
        _squareDuty += _dutySweep;
        if (_squareDuty < 0) {
          _squareDuty = 0;
        } else if (_squareDuty > .5) {
          _squareDuty = .5;
        }
      }

      // Moves through the different stages of the volume envelope
      if (++_envelopeTime > _envelopeLength) {
        _envelopeTime = 0;

        switch (++_envelopeStage)  {
          case 1:
            _envelopeLength = _envelopeLength1;
            break;
          case 2:
            _envelopeLength = _envelopeLength2;
        }
      }

      // Sets the volume based on the position in the envelope
      switch (_envelopeStage) {
        case 0:
          _envelopeVolume = _envelopeTime * _envelopeOverLength0;
          break;
        case 1:
          _envelopeVolume = 1 + (1 - _envelopeTime * _envelopeOverLength1) * 2 * _sustainPunch;
          break;
        case 2:
          _envelopeVolume = 1 - _envelopeTime * _envelopeOverLength2;
          break;
        case 3:
          _envelopeVolume = 0;
          _finished = true;
      }

      // Moves the phaser offset
      if (_phaser) {
        _phaserOffset += _phaserDeltaOffset;
        _phaserInt = _phaserOffset | 0;
        if (_phaserInt < 0) {
          _phaserInt = -_phaserInt;
        } else if (_phaserInt > 1023) {
          _phaserInt = 1023;
        }
      }

      // Moves the high-pass filter cutoff
      if (_filters && _hpFilterDeltaCutoff) {
        _hpFilterCutoff *= _hpFilterDeltaCutoff;
        if (_hpFilterCutoff < .00001) {
          _hpFilterCutoff = .00001;
        } else if (_hpFilterCutoff > .1) {
          _hpFilterCutoff = .1;
        }
      }

      _superSample = 0;
      for (var j = 8; j--; ) {
        // Cycles through the period
        _phase++;
        if (_phase >= _periodTemp) {
          _phase %= _periodTemp;

          // Generates new random noise for this period
          if (_waveType == 3) {
            for (var n = _noiseBuffer.length; n--; ) {
              _noiseBuffer[n] = Math.random() * 2 - 1;
            }
          }
        }

        // Gets the sample from the oscillator
        switch (_waveType) {
          case 0: // Square wave
            _sample = ((_phase / _periodTemp) < _squareDuty) ? .5 : -.5;
            break;
          case 1: // Saw wave
            _sample = 1 - _phase / _periodTemp * 2;
            break;
          case 2: // Sine wave (fast and accurate approx)
            _pos = _phase / _periodTemp;
            _pos = (_pos > .5 ? _pos - 1 : _pos) * 6.28318531;
            _sample = 1.27323954 * _pos + .405284735 * _pos * _pos * (_pos < 0 ? 1 : -1);
            _sample = .225 * ((_sample < 0 ? -1 : 1) * _sample * _sample  - _sample) + _sample;
            break;
          case 3: // Noise
            _sample = _noiseBuffer[Math.abs(_phase * 32 / _periodTemp | 0)];
        }

        // Applies the low and high pass filters
        if (_filters) {
          _lpFilterOldPos = _lpFilterPos;
          _lpFilterCutoff *= _lpFilterDeltaCutoff;
          if (_lpFilterCutoff < 0) {
            _lpFilterCutoff = 0;
          } else if (_lpFilterCutoff > .1) {
            _lpFilterCutoff = .1;
          }

          if (_lpFilterOn) {
            _lpFilterDeltaPos += (_sample - _lpFilterPos) * _lpFilterCutoff;
            _lpFilterDeltaPos *= _lpFilterDamping;
          } else {
            _lpFilterPos = _sample;
            _lpFilterDeltaPos = 0;
          }

          _lpFilterPos += _lpFilterDeltaPos;

          _hpFilterPos += _lpFilterPos - _lpFilterOldPos;
          _hpFilterPos *= 1 - _hpFilterCutoff;
          _sample = _hpFilterPos;
        }

        // Applies the phaser effect
        if (_phaser) {
          _phaserBuffer[_phaserPos % 1024] = _sample;
          _sample += _phaserBuffer[(_phaserPos - _phaserInt + 1024) % 1024];
          _phaserPos++;
        }

        _superSample += _sample;
      }

      // Averages out the super samples and applies volumes
      _superSample *= .125 * _envelopeVolume * _masterVolume;

      // Clipping if too loud
      buffer[i] = _superSample >= 1 ? 32767 : _superSample <= -1 ? -32768 : _superSample * 32767 | 0;
    }

    return length;
  }
}

// Adapted from http://codebase.es/riffwave/
var synth = new SfxrSynth();
// Export for the Closure Compiler
const jsfxr = function(settings) {
  // Initialize SfxrParams
  synth._params.setSettings(settings);
  // Synthesize Wave
  var envelopeFullLength = synth.totalReset();
  var data = new Uint8Array(((envelopeFullLength + 1) / 2 | 0) * 4 + 44);
  var used = synth.synthWave(new Uint16Array(data.buffer, 44), envelopeFullLength) * 2;
  var dv = new Uint32Array(data.buffer, 0, 44);
  // Initialize header
  dv[0] = 0x46464952; // "RIFF"
  dv[1] = used + 36;  // put total size here
  dv[2] = 0x45564157; // "WAVE"
  dv[3] = 0x20746D66; // "fmt "
  dv[4] = 0x00000010; // size of the following
  dv[5] = 0x00010001; // Mono: 1 channel, PCM format
  dv[6] = 0x0000AC44; // 44,100 samples per second
  dv[7] = 0x00015888; // byte rate: two bytes per sample
  dv[8] = 0x00100002; // 16 bits per sample, aligned on every two bytes
  dv[9] = 0x61746164; // "data"
  dv[10] = used;      // put number of samples here

  // Base64 encoding written by me, @maettig
  used += 44;
  var i = 0,
      base64Characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/',
      output = 'data:audio/wav;base64,';
  for (; i < used; i += 3)
  {
    var a = data[i] << 16 | data[i + 1] << 8 | data[i + 2];
    output += base64Characters[a >> 18] + base64Characters[a >> 12 & 63] + base64Characters[a >> 6 & 63] + base64Characters[a & 63];
  }
  return output;
}
'use strict';

/**
 * @file jsfxr-based sequencer
 * @version 1.0.0
 * @author Donitz 2018
 */

/*
    Track:
        i * 4 + 0: Time since last [seconds / rate]
        i * 4 + 1: Duration [seconds / rate]
        i * 4 + 2: MIDI number
        i * 4 + 3: Volume [1 / 255]
*/

const jsfxrSequence = (data, maxElapsedSeconds = 0.1) => {
    const notePool = new Map(),
        notes = [];

    let notesToLoad = 0;

    data.tracks.forEach((track, ti) => {
        const settings = data.instruments[ti];

        let t = 0;

        for (let n = 0; n < track.length; n += 4) {
            t += track[n] / data.rate;

            const i = track[n + 2] + 256 * ti;

            let pool = notePool.get(i);
            if (pool === undefined) {
                // Midi to frequency: (probably wrong)
                // f = 2^((d-69)/12)*440
                const f = Math.pow(2, (track[n + 2] - 69) / 12) * 440;

                // Frequency to setting: (probably wrong)
                // f = Fs / (100 / (x * x + 0.001)) * 8
                // x = 0.1 * sqrt((1250 * f) / Fs - 0.1)
                const x = 0.1 * Math.sqrt((1250 * f) / data.fs - 0.1);
                settings[5] = x;

                const src = jsfxr(settings);

                pool = {
                    next: 0,
                    players: new Array(data.channelsPerNote).fill(null).map(() => {
                        const p = new Audio();
                        notesToLoad++;
                        let loaded = false;
                        p.addEventListener('canplaythrough', () => {
                            if (!loaded) {
                                loaded = true;
                                notesToLoad--;
                            }
                        });
                        p.src = src;
                        return p;
                    }),
                };
                notePool.set(i, pool);
            }

            notes.push({ time: t, pool, volume: track[n + 3] / 255 });
        }
    });

    notes.sort((a, b) => a.time - b.time);

    let totalSeconds,
        nextNote,
        lastTime,
        stopping,
        stopped = true,
        loop_,
        volume_ = 1.0;

    const restart = () => {
        totalSeconds = 0;
        nextNote = 0;
        lastTime = new Date();
        stopping = false;
        if (stopped) {
            stopped = false;
            update();
        }
    };

    const update = () => {
        const ready = notesToLoad === 0;

        if (stopping) {
            stopped = true;
            return;
        }

        const newTime = new Date(),
            elapsedSeconds = Math.min((newTime - lastTime) / 1000, maxElapsedSeconds);
        lastTime = newTime;

        if (ready) {
            totalSeconds += elapsedSeconds;

            while (totalSeconds >= notes[nextNote].time) {
                const note = notes[nextNote++];

                const p = note.pool.players[note.pool.next];
                note.pool.next = (note.pool.next + 1) % data.channelsPerNote;

                if (volume_ > 0 && (document.hidden === undefined || !document.hidden)) {
                    p.volume = note.volume * volume_;
                    p.play();
                }

                if (nextNote === notes.length) {
                    if (loop_) {
                        restart();
                    } else {
                        stopped = true;
                        return;
                    }
                }
            }
        }

        setTimeout(update, 1);
    };

    return {
        play: (loop = false) => {
            loop_ = loop;
            restart();
        },
        stop: () => {
            stopping = true;
        },
        setVolume: (volume) => {
            volume_ = volume;
        },
    };
};
'use strict';

/**
 * @file audio resources
 * @version 1.0.0
 * @author Donitz 2018
 */

let muted = false;

const createSound = (settings, count, minVolume = 1, maxVolume = 1) => {
    const src = jsfxr(settings);
    const players = new Array(count).fill(null).map(() => {
        const p = new Audio();
        p.src = src;
        return p;
    });
    let i = 0;
    return () => {
        if (muted) {
            return;
        }
        const p = players[i];
        i = (i + 1) % count;
        p.volume = minVolume + Math.random() * (maxVolume - minVolume);
        if (p.paused) {
            p.play();
        } else {
            p.currentTime = 0;
        }
    };
};

const masterVolume = 0.75;

const sounds = {
    addDir: [
        createSound([0,,0.0857,0.451,0.1379,0.28,,,,,,,,,,,,,1,,,,,0.5], 3, 0.75 * masterVolume, 0.75 * masterVolume),
        createSound([0,,0.0857,0.451,0.1379,0.35,,,,,,,,,,,,,1,,,,,0.5], 3, 0.75 * masterVolume, 0.75 * masterVolume),
        createSound([0,,0.0857,0.451,0.1379,0.42,,,,,,,,,,,,,1,,,,,0.5], 3, 0.75 * masterVolume, 0.75 * masterVolume),
        createSound([0,,0.0857,0.451,0.1379,0.49,,,,,,,,,,,,,1,,,,,0.5], 3, 0.75 * masterVolume, 0.75 * masterVolume),
    ],
    eraseDir: createSound([0,,0.0857,0.451,0.1379,0.15,,,,,,,,,,,,,1,,,,,0.5], 3, 0.75 * masterVolume, 0.75 * masterVolume),
    botActivate: createSound([0,,0.2605,,0.23,0.2225,,0.227,,0.23,0.6365,,,,,,,,1,,,,,0.5], 1, 0.75 * masterVolume, 0.75 * masterVolume),
    botUnpowered: createSound([0,,0.2605,,0.23,0.345,,-0.2179,,0.23,0.6365,,,,,,,,1,,,,,0.5], 1, 0.75 * masterVolume, 0.75 * masterVolume),
    botBlocked: createSound([1,,0.3172,,0.2736,0.2288,,0.0734,,0.4237,0.2363,,,,,,,,1,,,,,0.5], 4, 0.2 * masterVolume, 0.2 * masterVolume),
    botKilled: createSound([3,,0.2192,0.4762,0.3306,0.3345,,-0.2955,,,,-0.6227,0.7424,,,0.5294,-0.2207,-0.1787,1,,,,,0.5], 1, 0.4 * masterVolume, 0.4 * masterVolume),
    botWalk: createSound([0,,0.0825,,0.0974,0.223,,,,,,,,0.4959,,,,,1,,,0.1,,0.5], 2, 0.5 * masterVolume, 0.75 * masterVolume),
    botFly: createSound([0,,0.27,,0.251,0.451,,0.3133,,,,,,0.0211,,0.5839,,,1,,,,,0.5], 2, 0.3 * masterVolume, 0.3 * masterVolume),
    sensorTrigger: createSound([0,,0.1613,,0.2094,0.2289,,0.2338,,,,,,0.349,,0.6415,,,1,,,,,0.5], 2, 0.75 * masterVolume, 0.75 * masterVolume),
    fadeOut: createSound([3,,0.2942,,0.2239,0.368,,-0.249,,,,,,0.0483,,,,,1,,,0.2108,,0.5], 1, 0.5 * masterVolume, 0.5 * masterVolume),
    fadeIn: createSound([3,,0.2942,,0.2239,0.3011,,0.2288,,,,,,0.0483,,,,,1,,,0.2108,,0.5], 1, 0.5 * masterVolume, 0.5 * masterVolume),
    hubActivate: createSound([0,,0.0595,,0.3271,0.2945,,0.2968,,,,,,0.5668,,0.457,,,1,,,,,0.5], 1, masterVolume, masterVolume),
    liftChange: createSound([0,,0.1297,,0.1137,0.379,,0.2551,,,,,,0.3982,,,,,1,,,,,0.5], 2, 0.75 * masterVolume, 0.75 * masterVolume),
    talk: createSound([0,,0.15,,0.0299,0.2299,,,,,,,,0.5036,,,,,1,,,0.1,,0.5], 6, 0.5 * masterVolume, 0.75 * masterVolume),
    selfKilled: createSound([3,,0.1818,,0.67,0.0952,,0.1283,,,,,,,,,0.2695,-0.1691,1,,,,,0.5], 1, masterVolume, masterVolume),
    noise: createSound([3,,0.42,,,0.629,,,,,,,,,,,,,1,,,,,0.5], 1, 0.45, 0.45),
    gameStart: createSound([0,,0.1984,,0.4481,0.3487,,0.2839,,,,,,0.5726,,0.4374,,,1,,,,,0.5], 1, masterVolume, masterVolume),
    music: jsfxrSequence({"rate":160,"fs":44100,"channelsPerNote":5,"adjustSustainDuration":false,"instruments":[null,[0,null,null,0.5,0.4,0.25,null,null,null,null,null,null,null,null,null,null,null,null,1,null,null,null,null,0.5],[2,null,0.18,0.05,0.3,0.34,null,null,null,null,null,null,null,null,null,null,null,null,1,null,null,null,null,0.5],[3,null,0.09,0.35,0.12,0.43,null,null,null,null,null,null,null,null,null,null,null,null,1,null,null,null,null,0.35],null,null,null,null,null,null,null,null,null,null,null,null,null],"tracks":[[],[1150,96,71,81,120,24,71,81,24,48,69,81,48,24,67,81,24,24,64,81,48,24,70,81,48,24,69,81,48,24,67,81,24,24,64,81,24,24,67,81,24,24,64,81,24,24,62,81,24,24,59,81,24,24,57,81,24,24,55,81,24,24,64,81,24,24,76,81,48,24,76,81,24,24,76,81,0,24,74,81,48,24,76,81,0,24,74,81,24,24,76,81,0,24,73,81,48,24,76,81,0,24,73,81,24,24,76,81,0,24,72,81,48,24,76,81,0,24,72,81,24,24,76,81,0,24,70,81,24,24,71,81,24,24,76,81,0,24,74,81,24,24,76,81,0,24,71,81,24,24,70,81,24,24,76,81,0,24,69,81,24,24,76,81,0,24,67,81,24,24,64,81,24,24,76,81,0,24,67,81,24,24,76,81,0,24,69,81,24,24,76,81,0,24,67,81,24,24,76,81,0,24,69,81,24,24,71,81,0,24,76,81,24,24,79,81,24,24,70,81,24,24,78,81,24,24,69,81,24,24,77,81,24,24,67,81,24,24,76,81,24,24,74,81,24,24,65,81,24,24,72,81,24,24,70,81,24,48,71,81,48,24,67,81,24,24,66,81,48,48,65,81,48,24,62,81,24,24,59,81,24,24,63,81,24,24,58,81,24,24,67,81,24,24,64,81,24,24,67,81,24,24,71,81,24,96,76,81,144,72,47,81,0,72,53,81,0,72,62,81,0,72,70,81,72,24,75,81,24,24,70,81,24,24,66,81,24,96,61,81,144,72,47,81,0,72,53,81,0,72,62,81,0,72,70,81,72,24,64,81,24,24,67,81,24,24,71,81,24,96,79,81,144,72,47,81,0,72,53,81,0,72,62,81,0,72,70,81,72,24,75,81,24,24,70,81,24,24,66,81,24,96,61,81,144,72,47,81,0,72,53,81,0,72,62,81,0,72,70,81,1224,24,71,81,24,24,59,81,24,24,83,81,24,24,95,81,24,24,71,81,24,24,59,81,24,24,72,81,24,24,60,81,24,24,84,81,24,24,96,81,24,24,72,81,24,24,60,81,24,24,73,81,24,24,61,81,24,24,85,81,24,24,97,81,24,24,73,81,24,24,61,81,24,24,72,81,24,24,60,81,24,24,84,81,24,24,96,81,24,24,72,81,24,24,60,81,24,24,71,81,24,24,59,81,24,24,83,81,24,24,95,81,24,24,71,81,24,24,59,81,24,24,72,81,24,24,60,81,24,24,84,81,24,24,96,81,24,24,72,81,24,24,60,81,24,24,74,81,24,24,62,81,24,24,86,81,24,24,98,81,24,24,74,81,24,24,62,81,24,24,83,81,24,24,71,81,24,24,95,81,24,24,107,81,24,24,83,81,24,24,71,81,24,256,76,81,0,256,88,81,0,256,64,81,1296,32,52,51,48,32,55,51,24,16,47,51,48,88,53,51,168,48,47,51,48,24,53,51,24,48,51,51,48,24,52,51,96,24,62,51,48,24,62,51,24,32,52,51,0,24,61,51,48,32,55,51,0,24,61,51,24,16,47,51,0,24,60,51,48,88,53,51,0,24,60,51,96,24,62,51,48,24,62,51,24,48,47,51,0,24,59,51,48,24,53,51,0,24,59,51,24,48,51,51,0,24,59,51,48,24,52,51,0,24,59,51,24,24,64,61,0,16,60,38,48,24,64,61,48,24,64,61,48,24,64,61,48,24,64,61,48,24,64,61,48,24,64,61,48,24,64,61,48,24,64,61,48,24,64,61,48,24,64,61,48,24,64,61,48,24,64,61,48,24,64,61,48,24,64,61,48,24,64,61,48,24,64,61,48,24,64,61,48,24,64,61,48,24,64,61,48,24,64,61,48,24,64,61,48,24,64,61,48,24,64,61,48,24,76,61,0,256,36,61,24,24,64,61,24,24,76,61,24,24,64,61,24,24,76,61,24,24,64,61,24,24,76,61,24,24,64,61,24,24,76,61,24,24,64,61,24,24,76,61,24,24,64,61,24,24,76,61,0,256,38,61,24,24,64,61,24,24,76,61,24,24,64,61,24,24,76,61,24,24,64,61,24,24,76,61,24,24,64,61,24,24,76,61,24,24,64,61,24,24,76,61,24,24,64,61,24,24,76,61,0,256,36,61,24,24,64,61,24,24,76,61,24,24,64,61,24,24,76,61,24,24,64,61,24,24,76,61,24,24,64,61,24,24,76,61,24,24,64,61,24,24,76,61,24,24,64,61,24,24,76,61,0,256,38,61,24,24,64,61,24,24,76,61,24,24,64,61,24,24,76,61,24,24,64,61,24,24,76,61,24,24,64,61,24,24,76,61,24,24,64,61,24,24,76,61,24,24,64,61,24,24,76,61,24,24,64,61,24,24,76,61,24,24,64,61,24,24,76,61,24,24,64,61,24,24,76,61,24,24,64,61,24,24,76,61,24,24,64,61,24,24,76,61,24,24,64,61,24,24,76,61,24,24,64,61,24,24,76,61,24,24,64,61,24,24,76,61,24,24,64,61,24,24,76,61,24,24,64,61,24,24,76,61,24,24,64,61,24,24,76,61,24,24,64,61,24,24,76,61,24,24,64,61,24,24,76,61,24,24,64,61,24,24,76,61,24,24,64,61,24,24,76,61,24,24,64,61,24,24,76,61,24,24,64,61,24,24,76,61,24,24,64,61,24,24,76,61,24,24,64,61,24,24,76,61,24,24,64,61,24,24,76,61,24,24,64,61,24,24,76,61,24,24,64,61,24,24,76,61,24,24,64,61,24,24,76,61,24,24,64,61,24,24,76,61,24,24,64,61,24,24,76,61,24,24,64,61,24,24,76,61,24,24,64,61,24,24,76,61,24,24,64,61,24,24,76,61,24,24,64,61,24,24,76,61,24,24,64,61,24,24,76,61,24,24,64,61,24,24,76,61,24,24,64,61,24,24,76,61,24,24,64,61,24,24,76,61,24,24,64,61,24,24,76,61,24,24,64,61,24,24,76,61,24,24,64,61,24,24,76,61,24,24,64,61,24,24,76,61,24,24,64,61,24,24,76,61,24,24,64,61,24,24,76,61,24,24,64,61,24,24,76,61,24,24,64,61,24,24,76,61,24,24,64,61],[118,24,40,101,24,96,43,101,120,24,43,101,24,96,42,101,120,24,42,101,24,48,35,101,48,24,41,101,24,48,39,101,48,120,40,101,144,24,40,101,24,96,43,101,120,24,43,101,24,96,42,101,120,24,42,101,24,48,35,101,48,24,41,101,24,48,39,101,48,120,40,101,144,24,40,101,24,96,43,101,120,24,43,101,24,96,42,101,120,24,42,101,24,48,35,101,48,24,41,101,24,48,39,101,48,24,40,101,24,96,40,101,120,24,40,101,24,96,43,101,120,24,43,101,24,96,42,101,120,24,42,101,24,48,35,101,48,24,41,101,24,48,39,101,48,24,40,101,24,96,40,101,120,24,40,101,24,96,43,101,120,24,43,101,24,96,42,101,120,24,42,101,24,48,35,101,48,24,41,101,24,48,39,101,48,24,40,101,24,48,40,101,48,24,43,101,24,24,45,101,48,100,46,101,120,48,47,101,48,48,40,101,48,24,43,101,24,24,45,101,48,100,46,101,120,32,50,101,48,48,40,101,48,24,43,101,24,24,45,101,48,100,46,101,120,48,55,101,48,48,40,101,48,24,43,101,24,24,45,101,48,100,46,101,96,24,59,101,24,24,62,101,24,24,63,101,24,96,64,101,120,24,64,101,24,96,67,101,120,24,67,101,24,96,66,101,120,24,66,101,24,48,59,101,48,24,65,101,24,48,63,101,48,24,64,101,24,96,64,101,120,24,64,101,24,96,67,101,120,24,67,101,24,96,66,101,120,24,66,101,24,48,59,101,48,24,65,101,24,48,63,101,48,24,64,101,24,96,64,101,120,24,64,101,24,96,67,101,120,24,67,101,24,96,66,101,120,24,66,101,24,48,59,101,48,24,65,101,24,48,63,101,48,24,64,101,24,96,64,101,120,24,64,101,24,96,67,101,120,24,67,101,24,96,66,101,120,24,66,101,24,48,59,101,24,16,58,101,24,16,57,101,24,16,55,101,24,16,52,101,24,16,50,101,24,96,40,101,0,16,52,101,120,24,40,101,24,96,43,101,120,24,43,101,24,96,42,101,120,24,42,101,24,48,35,101,48,24,41,101,24,48,39,101,48,120,40,101,144,24,40,101,24,96,43,101,120,24,43,101,24,96,42,101,120,24,42,101,24,48,35,101,48,24,41,101,24,48,39,101,48,24,40,101,24,96,40,101,120,24,40,101,24,96,43,101,120,24,43,101,24,96,42,101,120,24,42,101,24,48,35,101,48,24,41,101,24,48,39,101,48,24,40,101,24,96,40,101,120,24,40,101,24,96,43,101,120,24,43,101,24,96,42,101,120,24,42,101,24,48,35,101,48,24,41,101,24,48,39,101,48,24,40,101,24,48,36,101,48,48,52,101,48,48,54,101,48,48,55,101,48,48,57,101,48,48,59,101,48,48,62,101,0,48,38,101,48,48,57,101,48,48,59,101,48,48,62,101,48,48,66,101,48,48,67,101,48,48,36,101,48,48,52,101,0,48,55,101,48,48,54,101,0,48,57,101,48,48,55,101,0,48,59,101,48,48,57,101,0,48,62,101,48,48,59,101,0,48,64,101,48,48,62,101,0,48,38,101,48,48,57,101,0,48,62,101,48,48,59,101,0,48,64,101,48,48,62,101,0,48,66,101,48,48,66,101,0,48,69,101,48,48,67,101,0,48,74,101,48,48,36,101,0,256,24,101,48,48,52,101,0,48,55,101,48,48,54,101,0,48,57,101,48,48,55,101,0,48,59,101,48,48,57,101,0,48,62,101,48,48,59,101,0,48,64,101,48,48,62,101,0,48,38,101,0,256,26,101,48,48,57,101,0,48,62,101,48,48,59,101,0,48,64,101,48,48,62,101,0,48,66,101,48,48,66,101,0,48,69,101,48,48,67,101,0,48,74,101,48,48,36,101,0,256,24,101,0,48,52,101,48,48,52,101,0,48,55,101,0,48,59,101,48,48,54,101,0,48,57,101,0,48,62,101,48,48,55,101,0,48,59,101,0,48,64,101,48,48,57,101,0,48,62,101,0,48,67,101,48,48,59,101,0,48,64,101,0,48,71,101,48,48,62,101,0,48,38,101,0,256,26,101,0,48,74,101,48,48,57,101,0,48,62,101,0,48,69,101,48,48,59,101,0,48,64,101,0,48,71,101,48,48,62,101,0,48,66,101,0,48,74,101,48,48,66,101,0,48,69,101,0,48,81,101,48,48,67,101,0,48,74,101,0,48,83,101,48,256,88,101,0,96,52,101,0,96,76,16,0,96,40,103,120,24,52,101,0,24,76,16,24,96,50,101,0,96,74,16,0,96,40,103,120,24,50,101,0,24,74,16,24,96,49,101,0,96,73,16,0,96,40,103,0,256,57,79,120,24,49,101,0,24,73,16,24,96,48,101,0,96,72,16,0,96,40,103,0,144,64,71,120,24,48,101,0,24,72,16,24,96,52,101,0,96,76,16,0,96,40,103,0,256,71,95,120,24,52,101,0,24,76,16,24,96,50,101,0,96,74,16,0,96,40,103,120,24,50,101,0,24,74,16,0,280,69,95,24,96,49,101,0,96,73,16,0,96,40,103,0,256,57,79,120,24,49,101,0,24,73,16,24,96,48,101,0,96,72,16,0,96,40,103,0,144,64,71,120,24,48,101,0,24,72,16,0,24,67,95,24,96,52,101,0,96,40,103,0,256,64,101,120,24,52,101,24,96,50,101,0,96,40,103,96,24,62,101,24,24,50,101,0,24,64,101,24,96,49,101,0,96,40,103,0,48,67,101,48,48,64,101,48,48,62,101,24,24,49,101,24,96,48,101,0,96,40,103,0,48,64,101,48,48,62,101,48,24,57,101,24,24,48,101,0,24,55,101,24,96,52,101,0,96,40,103,0,256,59,101,120,24,52,101,24,96,50,101,0,96,40,103,72,32,62,101,48,24,50,101,0,280,64,101,24,96,49,101,0,96,40,103,48,24,62,101,48,24,59,101,24,24,49,101,24,24,45,101,0,24,58,101,24,24,47,101,24,24,45,101,0,24,57,101,24,24,43,101,24,24,40,101,0,24,55,101,24,24,38,101,24,96,40,101,0,256,52,101,120,24,40,101,24,96,43,101,120,24,43,101,24,96,42,101,120,24,42,101,24,48,35,101,48,24,41,101,24,48,39,101,48,120,40,101,144,24,40,101,24,96,43,101,120,24,43,101,24,96,42,101,120,24,42,101,24,48,35,101,48,24,41,101,24,48,39,101,48,120,40,101],[574,24,59,71,72,48,59,71,48,48,62,71,72,48,62,71,72,48,61,71,72,48,61,71,72,24,61,71,24,24,60,71,24,24,62,71,24,24,60,71,24,24,59,71,24,24,54,71,24,24,53,71,24,48,52,71,72,48,59,71,48,48,62,71,72,48,62,71,72,48,61,71,72,48,61,71,72,24,61,71,24,24,60,71,24,24,62,71,24,24,60,71,24,24,59,71,24,24,54,71,24,24,53,71,24,48,52,71,72,48,59,71,48,48,62,71,72,48,62,71,72,48,61,71,72,48,61,71,72,24,61,71,24,24,60,71,24,24,62,71,24,24,60,71,24,24,59,71,24,24,54,71,24,24,53,71,24,48,52,71,72,48,59,71,48,48,62,71,72,48,62,71,72,48,61,71,72,48,61,71,72,24,61,71,24,24,60,71,24,24,62,71,24,24,60,71,24,24,59,71,24,24,54,71,24,24,53,71,24,16,64,71,48,16,64,71,24,16,64,71,48,16,64,71,24,16,64,71,48,16,64,71,24,16,64,71,48,16,64,71,24,16,64,71,48,16,64,71,24,16,64,71,48,16,64,71,24,16,64,71,48,16,64,71,24,16,64,71,48,16,64,71,24,16,64,71,48,16,64,71,24,16,64,71,48,16,64,71,24,16,64,71,48,16,64,71,24,16,64,71,48,16,64,71,24,16,64,71,48,16,64,71,24,16,64,71,48,16,64,71,24,16,64,71,48,16,64,71,24,16,64,71,48,16,64,71,24,16,64,71,48,16,64,71,24,16,64,71,48,16,64,71,24,16,64,71,48,16,64,71,24,16,64,71,48,16,64,71,24,16,64,71,48,16,64,71,24,16,64,71,48,16,64,71,24,16,64,71,48,16,64,71,24,16,64,71,48,16,64,71,24,16,64,71,48,16,64,71,24,16,64,71,48,16,64,71,24,16,64,71,48,16,64,71,24,16,64,71,48,16,64,71,24,16,64,71,48,16,64,71,24,16,64,71,48,16,64,71,24,16,64,71,48,16,64,71,24,16,64,71,48,16,64,71,24,16,64,71,48,16,64,71,24,16,64,71,48,16,64,71,24,16,64,71,48,16,64,71,24,16,64,71,48,16,64,71,24,16,64,71,48,16,64,71,24,16,64,71,48,16,64,71,24,16,64,71,48,16,64,71,24,16,64,71,48,16,64,71,24,16,64,71,48,16,64,71,24,16,64,71,48,16,64,71,24,16,64,71,48,16,64,71,24,16,64,71,48,16,64,71,24,16,64,71,48,16,64,71,24,16,64,71,48,16,64,71,24,16,64,71,48,16,64,71,24,16,64,71,48,16,64,71,1176,32,52,91,48,16,59,91,24,32,52,91,48,168,58,91,168,48,49,91,48,24,57,91,24,48,47,91,48,96,55,91,168,32,52,91,48,16,59,91,24,32,52,91,48,168,58,91,168,48,49,91,48,24,57,91,24,48,47,91,48,96,55,91,168,24,48,91,0,256,36,91,24,24,55,91,24,24,64,91,24,24,76,91,24,24,67,91,24,24,64,91,24,24,48,91,24,24,55,91,24,24,64,91,24,24,76,91,24,24,67,91,24,24,48,91,24,24,50,91,0,256,38,91,24,24,57,91,24,24,66,91,24,24,76,91,24,24,69,91,24,24,62,91,24,24,50,91,24,24,57,91,24,24,66,91,24,24,76,91,24,24,69,91,24,24,62,91,24,24,48,91,0,256,36,91,24,24,55,91,24,24,64,91,24,24,76,91,24,24,67,91,24,24,64,91,24,24,48,91,24,24,55,91,24,24,64,91,24,24,76,91,24,24,67,91,24,24,48,91,24,24,50,91,0,256,38,91,24,24,57,91,24,24,66,91,24,24,76,91,24,24,69,91,24,24,62,91,24,24,50,91,24,24,57,91,24,24,66,91,24,24,76,91,24,24,69,91,24,24,62,91,24,24,48,91,0,256,36,91,24,24,55,91,24,24,64,91,24,24,76,91,24,24,67,91,24,24,64,91,24,24,48,91,24,24,55,91,24,24,64,91,24,24,76,91,24,24,67,91,24,24,48,91,24,24,50,91,0,256,38,91,24,24,57,91,24,24,66,91,24,24,76,91,24,24,69,91,24,24,62,91,24,24,50,91,24,24,57,91,24,24,66,91,24,24,76,91,24,24,69,91,24,24,62,91,24,24,48,91,0,256,36,91,24,24,55,91,24,24,64,91,24,24,76,91,24,24,67,91,24,24,64,91,24,24,48,91,24,24,55,91,24,24,64,91,24,24,76,91,24,24,67,91,24,24,48,91,24,24,50,91,0,256,38,91,24,24,57,91,24,24,66,91,24,24,76,91,24,24,69,91,24,24,62,91,24,24,50,91,24,24,57,91,24,24,66,91,24,24,76,91,24,24,69,91,24,24,62,91,24,256,40,91,0,48,64,91,48,24,64,91,24,48,64,91,48,24,64,91,24,48,64,91,48,24,64,91,24,48,64,91,48,24,64,91,24,48,64,91,48,24,64,91,24,48,64,91,48,24,64,91,24,48,64,91,48,24,64,91,24,48,64,91,48,24,64,91,24,48,64,91,48,24,64,91,24,48,64,91,48,24,64,91,24,48,64,91,48,24,64,91,24,48,64,91,48,24,64,91,24,48,64,91,48,24,64,91,24,48,64,91,48,24,64,91,24,48,64,91,48,24,64,91,24,48,64,91,48,24,64,91,1176,16,52,91,48,16,52,91,48,16,52,91,48,16,52,91,48,16,52,91,48,16,52,91,48,16,52,91,48,16,52,91,48,16,52,91,48,16,52,91,48,16,52,91,48,16,52,91,48,16,52,91,48,16,52,91,48,16,52,91,48,16,52,91,48,16,52,91,48,16,52,91,48,16,52,91,48,16,52,91,48,16,52,91,48,16,52,91,48,16,52,91,48,16,52,91],[],[],[],[],[],[],[],[],[],[],[],[],[]]}),
};

sounds.music.setVolume(0.75 * masterVolume);
'use strict';

/**
 * @file maps
 * @version 1.0.0
 * @author Donitz 2018
 */

const baseMaps = [
    'abbbbbbbbbbbbc' +
    'giiiiiiiiiiiih' +
    'giiiiiiiiiiiih' +
    'abbbbbbbbbbbbc' +
    'g            h' +
    'g            h' +
    'g            h' +
    'g            h' +
    'g            h' +
    'g            h' +
    'g            h' +
    'g            h' +
    'deeeeeeeeeeeef',

    '              ' +
    '              ' +
    '           ** ' +
    'deeeeeeeeeeeef' +
    '              ' +
    '              ' +
    '              ' +
    '              ' +
    '              ' +
    '              ' +
    '              ' +
    '              ' +
    '             %',

    '              ' +
    '              ' +
    '              ' +
    '??????????????' +
    '?            ?' +
    '?            ?' +
    '?            ?' +
    '?            ?' +
    '?            ?' +
    '?            ?' +
    '?            ?' +
    '?            ?' +
    '??????????????'];

const maps = [[
    ';             ' +
    '   P      P   ' +
    '              ' +
    '              ' +
    ' DDDDDDDDDDDD ' +
    '              ' +
    '  mn          ' +
    '              ' +
    '              ' +
    '              ' +
    '           "  ' +
    ' CCCCCCCCCCCC ' +
    '              ',
].concat(baseMaps), [
    ':             ' +
    ' *****        ' +
    '              ' +
    '              ' +
    '              ' +
    '              ' +
    '  ABBBBBBBBA  ' +
    '  B        B  ' +
    '  B >^  <  B  ' +
    '  ABBBBBBBBA  ' +
    '              ' +
    '              ' +
    '              ',

    '              ' +
    '              ' +
    '              ' +
    '              ' +
    '              ' +
    '              ' +
    '              ' +
    '   llllllll   ' +
    '   llllllll   ' +
    '              ' +
    '              ' +
    '              ' +
    '              ',
].concat(baseMaps), [
    ':             ' +
    ' ********     ' +
    '              ' +
    '              ' +
    '              ' +
    ' ABBBBBBBBBBA ' +
    ' B          B ' +
    ' B    ABA   B ' +
    ' B >^     < B ' +
    ' ABBBA   ABBA ' +
    '     B   B    ' +
    '     B   B    ' +
    '              ',

    '              ' +
    '              ' +
    '              ' +
    '              ' +
    '              ' +
    '      j       ' +
    '  llllllllll  ' +
    '  llll   lll  ' +
    '  llllllllll  ' +
    '      lll     ' +
    '              ' +
    '              ' +
    '              ',
].concat(baseMaps), [
    ':             ' +
    ' ************ ' +
    '              ' +
    '              ' +
    '      BBB     ' +
    ' ABBBBA ABBBA ' +
    ' B<         B ' +
    ' ABB   =BB  B ' +
    ' B          B ' +
    ' B      >^  B ' +
    ' B B B BBB=BA ' +
    ' B B B B      ' +
    '              ',

    '              ' +
    '              ' +
    '              ' +
    '              ' +
    '              ' +
    '       j      ' +
    '  llllllllll  ' +
    '    jjjj  jl  ' +
    '  lllllllljl  ' +
    '  lllllllljl  ' +
    '          j   ' +
    '              ' +
    '              ',

    '              ' +
    '              ' +
    '              ' +
    '              ' +
    '              ' +
    '       !      ' +
    '       .      ' +
    '       +. +   ' +
    '          .   ' +
    '          .   ' +
    '          +   ' +
    '              ' +
    '              ',
].concat(baseMaps), [
    ':             ' +
    ' ************ ' +
    '              ' +
    '              ' +
    '     ~~~~     ' +
    ' ?   ....   ? ' +
    ' ?FEE    EEF? ' +
    ' ?E  +.+   E? ' +
    ' ?E =  .   E? ' +
    ' ?E        E? ' +
    ' ?E>^     <E? ' +
    ' ?FEEEEEEEEF? ' +
    '              ',

    '              ' +
    '              ' +
    '              ' +
    '              ' +
    '              ' +
    '              ' +
    '     +        ' +
    '     ..       ' +
    '      ++.     ' +
    '              ' +
    '              ' +
    '              ' +
    '              ',

    '              ' +
    '              ' +
    '              ' +
    '              ' +
    '              ' +
    '              ' +
    '     .+       ' +
    '              ' +
    '    +.  +     ' +
    '        .     ' +
    '              ' +
    '              ' +
    '              ',

    '              ' +
    '              ' +
    '              ' +
    '              ' +
    '              ' +
    '              ' +
    '   kkkkkkkk   ' +
    '   kkkkkkkk   ' +
    '   kkkkkkkk   ' +
    '   kkkkkkkk   ' +
    '   kkkkkkkk   ' +
    '              ' +
    '              ',
].concat(baseMaps), [
    ':             ' +
    ' ************ ' +
    ' ******       ' +
    '              ' +
    '      FEEF    ' +
    '      E -E    ' +
    '  EEE E<.E    ' +
    '  E|FEEF E    ' +
    '  E.     FF   ' +
    '  E >^# .!E   ' +
    '  FEEEEEEEF   ' +
    '              ' +
    '              ',

    '              ' +
    '              ' +
    '              ' +
    '              ' +
    '              ' +
    '       ll     ' +
    '       ll     ' +
    '   l    l     ' +
    '   llllll     ' +
    '   lllllll    ' +
    '              ' +
    '              ' +
    '              ',
].concat(baseMaps), [
    ':             ' +
    ' ************ ' +
    ' **           ' +
    '              ' +
    '              ' +
    '    GGGGGG    ' +
    '    GG   G    ' +
    '    G ## G    ' +
    '    G ## G    ' +
    '    G>^#<G    ' +
    '    GGGGGG    ' +
    '              ' +
    '              ',

    '              ' +
    '              ' +
    '              ' +
    '              ' +
    '              ' +
    '      ooo     ' +
    '     oooo     ' +
    '     oooo     ' +
    '     oooo     ' +
    '     oooo     ' +
    '              ' +
    '              ' +
    '              ',
].concat(baseMaps), [
    ':             ' +
    '              ' +
    '              ' +
    '              ' +
    ' ???BA        ' +
    ' B   B AB     ' +
    ' ABB B B.++ + ' +
    ' B B B B! ... ' +
    ' B   ABAB  +  ' +
    ' B   B~ B     ' +
    ' B>^  .<B     ' +
    ' ABBBBBBA     ' +
    '              ',

    '              ' +
    ' ************ ' +
    '              ' +
    '              ' +
    ' ppp          ' +
    '              ' +
    '        o .+= ' +
    '        o.    ' +
    '         + .+ ' +
    '              ' +
    '              ' +
    '              ' +
    '              ',

    '              ' +
    '              ' +
    '              ' +
    '              ' +
    '              ' +
    '  lll         ' +
    '    l         ' +
    '  l l         ' +
    '  lll    .+   ' +
    '  lll ll      ' +
    '  llllll      ' +
    '              ' +
    '              ',
].concat(baseMaps), [
    ':             ' +
    ' ************ ' +
    '              ' +
    '              ' +
    '              ' +
    '  ??????????  ' +
    '  H D      I  ' +
    '  H   mn   I  ' +
    '  H>^    < I  ' +
    '  DCCK**LCCD  ' +
    '     H  I     ' +
    '         I    ' +
    '              ',

    '              ' +
    '              ' +
    '              ' +
    '              ' +
    '              ' +
    '              ' +
    '              ' +
    '              ' +
    '              ' +
    '      ii      ' +
    '              ' +
    '     ~.       ' +
    '              ',

    '              ' +
    '              ' +
    '              ' +
    '              ' +
    '              ' +
    '              ' +
    '   oooooooo   ' +
    '   oooooooo   ' +
    '   oooooooo   ' +
    '      ii      ' +
    '      ii      ' +
    '              ' +
    '              ',
].concat(baseMaps), [
    ':             ' +
    ' ************ ' +
    ' **********   ' +
    '              ' +
    '              ' +
    ' JJJJJJJJJ    ' +
    ' J   ~ J J    ' +
    ' J!. . J JJJ  ' +
    ' J#      =    ' +
    '  #>^     =<  ' +
    ' JJJJJJJJJJJ  ' +
    '              ' +
    '              ',

    '              ' +
    '              ' +
    '              ' +
    '              ' +
    '              ' +
    '              ' +
    '              ' +
    '              ' +
    '         .    ' +
    '         ++   ' +
    '          .   ' +
    '              ' +
    '              ',

    '              ' +
    '              ' +
    '              ' +
    '              ' +
    '              ' +
    '              ' +
    '              ' +
    '         .    ' +
    '         ++   ' +
    '          .   ' +
    '              ' +
    '              ' +
    '              ',

    '              ' +
    '              ' +
    '              ' +
    '              ' +
    '              ' +
    '              ' +
    '  lllll l     ' +
    '  lllll l     ' +
    '  llllllllll  ' +
    '  llllllllll  ' +
    '              ' +
    '              ' +
    '              ',
].concat(baseMaps), [
    ':             ' +
    ' **           ' +
    '              ' +
    '              ' +
    '              ' +
    ' DDDDDDDDD    ' +
    '              ' +
    ' -.   ?       ' +
    '              ' +
    ' CCCCCCCCC    ' +
    ' DDDDDDDDD    ' +
    ' >^ $         ' +
    '              ',

    '              ' +
    '              ' +
    '              ' +
    '              ' +
    '              ' +
    '              ' +
    ' ooooooooo    ' +
    ' oomnooooo    ' +
    ' ooooooooo    ' +
    '              ' +
    '    !         ' +
    '    .         ' +
    '              ',

    '              ' +
    '              ' +
    '              ' +
    '              ' +
    ' pppppppppppp ' +
    '       pppppp ' +
    '       pppppp ' +
    '       pppppp ' +
    '       pppppp ' +
    '       pppppp ' +
    ' pppppppppppp ' +
    '  ppppppppppp ' +
    '              ',
].concat(baseMaps)];

const mapNames = [
    '',
    'A NEW HOPE',
    'PITFALL',
    'UP AND AWAY',
    'SHADOW',
    'TRIGGER',
    'CLAUSTROPHOBIA',
    'PATIENCE',
    'META',
    'EXAM',
    'DO IT',
];

const dialogues = [
    // Title
    'ENVISIONATOR\n\n\nMADE BY DONITZ FOR JS13KGAMES\nMUSIC:\nNURYKABE MIDI 01 - CONTRE01 BY MORUSQUE\n(CC BY 3.0, HIGHLY EDITED)\nCONTROLS:\n\u2190\u2192\u2191\u2193 - MOVE    Z - ACTION\nX - ERASE    M - MUTE\nPRESS Z TO START',

    // Level 1
    '~~~Hey!~~ You there!~~\nYes you!~~ Come over here!|' +
    'Do you see the little robot,~~\nthe one on the monitor?|' +
    'That\'s a Fixed Input Field Operator.~~\nYou need to get it through the door.|' +
    'Use the arrow keys to define moves,~~\nthen press Z to activate the FIFO.|',

    // Level 2
    '~~~The building is under lockdown and\nall outside communications are down.|' +
    'I was working late in my lab when the\ndoors locked,~~ and now I\'m locked in.|' +
    'Fortunately the FIFO control network\nwas isolated and is still active.|',

    // Level 3
    '~~~As you may have noticed,~\nthe room layout is ridiculous.|' +
    'Some speculate the architect was mad.~~\nOthers say they were built by weasels.|',

    // Level 4
    '~~~I told them a plasma beam security\nsystem was overkill.|' +
    'They said,~ "that\'s the point"~~~\nWhat\'s next?~ A self-destruct button?|',

    // Level 5
    '~~~Please hurry.~~~ It smells in here~~.~~.~~.~~\nSmells like,~~~~~ p~a~p~e~r~s~?~&' +
    'Okay fine!~~ I\'m stuck in the toilet.~~\nAll the more reason for you to hurry!|',

    // Level 6
    '~~~You know,~~ I don\'t even know what\nthe FIFO is used for.|' +
    'Is it like a vacuum cleaner,~~\nor a mobile bar?|' +
    'I want one!|',

    // Level 7
    '~~~What are you doing?~~ Don\'t touch the%&' +
    'H~e~e~e~e~y.~~~ This is the room with\nthe thing!~~~~ Wow,~~ just look at that!|' +
    'Marvelous.|',

    // Level 8
    '~~~WHO~~~~ %*BANG*~~~ REINFORCES~~ %*CRASH*~~~~\nA~~~~ %*KADONK*~~~~ TOILET DOOR!?|' +
    '*huff*~~.~~.~~.~~~~\nOkay,~~ back to unrolling toilet paper.|',

    // Level 9
    '~~~Just one more level to go!~~ I can already\nfeel the fresh air in my hair.|' +
    'Yes~~',

    // Level 10
    '~~~There it is!~~~ The door to our freedom!~~~\nQuick!~ Use the beam to blast it open!|',

    '>~~~~~~~~~~~~~~~~~~~~~~~~Since this is the last time we~~ speak~~~~~~%>~~~\nI have something to admit.~~~~~~~~~~~~~~\n\n' +
    '    There was no toilet.~~~~%>~~~~~~~~~~~~~~~~\n        I caused the lockdown.~~~~%>~~~~~~~~~~~~~~~~\n                I~~ ~~a~~m>~>~>~>~>~>~>~>~~~>^',
];
'use strict';

/**
 * @file game logic of envisionator
 * @version 1.0.0
 * @author Donitz 2018
 */

window.addEventListener('load', () => {
const Key = { UP: 38, RIGHT: 39, DOWN: 40, LEFT: 37, ACTION: 90, BACK: 88, MUTE: 77 },
    Dir = { UP: 0, RIGHT: 1, DOWN: 2, LEFT: 3 },
    key2Dir = [Key.UP, Key.RIGHT, Key.DOWN, Key.LEFT],
    dirX = [0, 1, 0, -1],
    dirY = [-1, 0, 1, 0],
    stepInterval = 0.3,
    tileSize = 12,
    mapSize = { x: 14, y: 13 },
    canvasSize = { x: mapSize.x * tileSize, y: mapSize.y * tileSize };

const keyDown = new Set(),
    wasPressed = code => {
        if (!keyDown.has(code)) {
            return false;
        }
        keyDown.clear();
        return true;
    };
window.addEventListener('keydown', e => !e.repeat && keyDown.add(e.keyCode));

const lerp = (a, b, t) => a * (1 - t) + b * t;

const sprites = document.body.children[0],
    container = document.body.children[1],
    canvasBG = container.children[0],
    canvasFG = container.children[3],
    terminal = container.children[1],
    mapName = container.children[2],
    contextBG = canvasBG.getContext('2d'),
    contextFG = canvasFG.getContext('2d');

canvasFG.width = canvasBG.width = canvasSize.x;
canvasFG.height = canvasBG.height = canvasSize.y;

const drawSprite = (tx, ty, x, y, rotations = 0, background = false) => {
    const context = background ? contextBG : contextFG;
    context.translate(Math.round((x + 0.5) * tileSize), Math.round((y + 0.5) * tileSize));
    if (rotations !== 0) {
        context.rotate(rotations * Math.PI * 0.5);
    }
    context.drawImage(
        sprites, tx * tileSize, ty * tileSize, tileSize, tileSize,
        -tileSize * 0.5, -tileSize * 0.5, tileSize, tileSize);
    context.setTransform(1, 0, 0, 1, 0, 0);
};

const clearScreen = (bg) => (bg ? contextBG : contextFG).clearRect(0, 0, canvasBG.width, canvasBG.height);

const handleResize = () => {
    const wx = window.innerWidth,
        wy = window.innerHeight,
        a = canvasSize.x / canvasSize.y;

    let x, y, s;
    if (wx / wy > a) {
        x = (wx - wy * a) / 2;
        y = 0;
        s = wy / canvasSize.y;
    } else {
        x = 0;
        y = (wy - wx / a) / 2;
        s = wx / canvasSize.x;
    }

    const s1 = container.style, s2 = terminal.style, s3 = mapName.style;

    s1.width = `${canvasSize.x * s}px`;
    s1.height = `${canvasSize.y * s}px`;
    s1.left = `${x}px`;
    s1.top = `${y}px`;
    s2.fontSize = s3.fontSize = `${5.5 * s}px`;
    s2.lineHeight = s3.lineHeight = `${12 * s}px`;
    s2.left = s3.left = `${15 * s}px`;
    s2.width = s3.width = `${(canvasFG.width - 30) * s}px`;
    s2.top = `${12 * s}px`;
    s3.top = `${48 * s}px`;
};
window.addEventListener('resize', handleResize);
handleResize();

const entities = [],
    storedInputs = [];

let currentMap = -1,
    nextMap = 0,
    restart = true,
    paused = false,
    dialogue = null,
    entitiesToDraw = null,
    lastTime,
    secondsUntilStep,
    elapsedSeconds,
    totalSeconds,
    stepFraction,
    stepLoopCount;

const loopFrame = (first, fps, count) => first + Math.floor(totalSeconds * fps) % count;

const find = c => entities.filter(e => e.c === c);

const createEntity = (x_, y_, l_, c_, dir_) => {
    const cc = c_.charCodeAt();

     // Empty
    if (/[ .]/.test(c_)) {
        return;
    }

    const e = { x: x_, y: y_, z: 0, l: l_, p: 0, c: c_, xp: x_, yp: y_, solid: false, fixed: true, stick: false, visible: true };
    entities.push(e);

    e.start = () => {};

    e.earlyStep = () => {
        e.xp = e.x;
        e.yp = e.y;
    };

    e.loopStep = () => false;

    e.draw = () => {};

    e.move = (dir, push = false) => {
        const dx = dirX[dir], dy = dirY[dir], toPush = [e], dragged = new Set();
        let x = e.x, y = e.y, found = true;

        while (found) {
            found = false;
            x += dx;
            y += dy;
            for (const e2 of entities) {
                if (!e2.solid) {
                    continue;
                }
                if (e2.xp === x && e2.yp === y && (e2.x !== x && dy !== 0 || e2.y !== y && dx !== 0) ||
                    e2.x === x && e2.y === y && (e2.xp !== x && dy !== 0 || e2.yp !== y && dx !== 0)) {
                    return false;
                }
                if (e2.x === x && e2.y === y) {
                    if (e2.fixed || !push) {
                        return false;
                    }
                    toPush.unshift(e2);
                    found = true;
                }
            }
        }
        toPush.forEach(e2 => {
            entities.forEach(e3 => {
                if (e3.x === e2.x && e3.y === e2.y - 1 && e3.solid && !e3.fixed && e3.stick && !dragged.has(e3)) {
                    e3.move(dir);
                    dragged.add(e3);
                }
            });
            e2.x += dx;
            e2.y += dy;
        });
        return true;
    };

    e.drawShadows = () => {
        for (let i = 0; i < 4; i++) {
            if (!entities.some(e2 => e2.x === e.x + dirX[i] && e2.y === e.y + dirY[i] && /[i-oA-P]/.test(e2.c))) {
                drawSprite(3 + i, 3, e.x, e.y, 0, true);
            }
        }
    };

    // Invisible block
    if (c_ === '?') {
        e.solid = true;
        e.visible = false;
    }

    // Background/Block
    if (/[a-p]/i.test(c_)) {
        const isBackground = /[a-p]/.test(c_);

        e.z = isBackground ? -1 : 0;
        e.solid = !isBackground;

        e.draw = () => {
            drawSprite(cc - (isBackground ? 97 : 65), isBackground ? 0 : 1, e.x, e.y, 0, true);
            if (!isBackground && currentMap > 0) {
                e.drawShadows();
            }
            e.visible = false;
        };
    }

    // Box
    if (c_ === '#') {
        e.z = 5;
        e.p = 5;
        e.solid = true;
        e.fixed = false;
        e.stick = true;

        e.earlyStep = () => {
            e.xp = e.x;
            e.yp = e.y;
        };

        e.loopStep = () => e.x === e.xp && e.y === e.yp && e.move(Dir.DOWN);

        e.draw = () => drawSprite(1, 7, lerp(e.xp, e.x, stepFraction), lerp(e.yp, e.y, stepFraction));
    }

    // Input
    if (c_ === '*') {
        e.visible = false;
        e.key = null;
        e.color = null;

        e.start = () => {
            const inputs = find('*'), i = inputs.indexOf(e), l = inputs.length;
            e.key = i === l - 2 ? 4 : i === l - 1 ? 5 : null;
            e.color = i === l - 2 ? 1 : 2;
        };

        e.earlyStep = () => {
            e.solid = e.key !== null;
        };

        e.draw = () => {
            if (e.color !== null) {
                drawSprite(e.color, 3, e.x, e.y);
            }
            if (e.key !== null) {
                drawSprite(e.key + (e.color === 1 ? 6 : 0), 2, e.x, e.y);
            }
        };
    }

    // Bot
    if (c_ === '@') {
        let hub = null, dead = false, unpowered = false, flyHeight = 0, flyHeightLast = 0, walking, blocked,
            nextInput = 0, lastInput = -1, inputs, moveDir = null, deathTime = 0;

        e.z = 6;
        e.p = 4;
        e.solid = true;
        e.fixed = false;

        e.kill = (unpowered_) => {
            if (dead || unpowered && unpowered_) {
                return;
            }
            if (unpowered_) {
                sounds.botUnpowered();
            } else {
                sounds.botKilled();
            }
            e.x = e.xp;
            e.y = e.yp;
            paused = true;
            dead = !unpowered_;
            unpowered = unpowered_;
            find('%')[0].fadeToNextMap(0.75);
        };

        e.start = () => {
            inputs = find('*');
        };

        e.earlyStep = () => {
            e.xp = e.x;
            e.yp = e.y;

            e.stick = true;

            if (flyHeight === 0) {
                if (e.move(Dir.DOWN)) {
                    e.stick = false;
                }
            }

            walking = false;
            blocked = false;
        };

        e.loopStep = () => {
            if (e.x !== e.xp) {
                flyHeightLast = flyHeight = 0;
            }

            const inExit = entities.some(e2 => e2.x === e.x && e2.y === e.y && e2.c === '<');
            if (inExit) {
                paused = true;
                nextMap++;
                find('%')[0].fadeToNextMap(0.4);
                return false;
            }

            if (e.x !== e.xp || e.y !== e.yp || paused) {
                return false;
            }

            const grounded = entities.some(e2 => e2 !== this && e2.solid &&
                (e2.x === e.x && e2.y === e.y + 1 || e2.xp === e.x && e2.yp === e.y + 1 && e2.xp !== e2.x));
            if (flyHeight > 0) {
                for (let y = 1; y <= flyHeight + 1; y++) {
                    const found = entities.some(e2 => e2.x === e.x && e2.y === e.y + y && e2.solid);
                    if (found && y < flyHeight + 1 || !found && y === flyHeight + 1) {
                        flyHeightLast = flyHeight = 0;
                    }
                }
            }

            if (stepLoopCount === 0) {
                if (grounded || flyHeight > 0) {
                    if (lastInput > -1) {
                        if (lastInput === nextInput) {
                            e.kill(true);
                            return false;
                        }
                        const input = inputs[lastInput++];
                        moveDir = input.key;
                        input.color = 1;
                    }
                }
            }

            flyHeightLast = flyHeight;
            let moved = false;
            if (grounded || flyHeight > 0) {
                if (moveDir !== null) {
                    if (e.move(moveDir, true)) {
                        moved = true;
                        if (moveDir === Dir.UP) {
                            flyHeight++;
                            sounds.botFly();
                        } else
                        if (moveDir === Dir.DOWN) {
                            flyHeight--;
                            sounds.botFly();
                        } else {
                            walking = flyHeight === 0;
                            flyHeightLast = flyHeight = 0;
                        }
                        moveDir = null;
                        if (walking) {
                            sounds.botWalk();
                        }
                    } else {
                        blocked = true;
                        sounds.botBlocked();
                    }
                }
            } else if (flyHeight === 0 && e.x === e.xp && e.y === e.yp) {
                moved = e.move(Dir.DOWN);
            }

            if (moved) {
                e.stick = false;
            }

            hub = entities.find(e2 => e2.x === e.x && e2.y === e.y && e2.c === '^' && e2.on) || null;
            if (hub !== null) {
                paused = true;

                keyDown.clear();

                inputs.forEach((e2, i) => {
                    e2.visible = true;
                    if (i < inputs.length - 2) {
                        e2.key = i < storedInputs.length ? storedInputs[i] : null;
                        e2.color = i === storedInputs.length ? 0 : 2;
                    }
                });

                nextInput = storedInputs.length;
                lastInput = 0;

                sounds.hubActivate();
            }

            return moved;
        };

        e.draw = () => {
            if (hub !== null) {
                if (nextInput > 0) {
                    if (wasPressed(Key.BACK)) {
                        if (nextInput < inputs.length - 2) {
                            inputs[nextInput].color = 2;
                        }
                        const input = inputs[--nextInput];
                        input.key = null;
                        input.color = 0;
                        sounds.eraseDir();
                    }
                    if (wasPressed(Key.ACTION)) {
                        storedInputs.length = 0;
                        for (let i = 0; i < nextInput; i++) {
                            storedInputs.push(inputs[i].key);
                        }
                        if (nextInput < inputs.length - 2) {
                            inputs[nextInput].color = 2;
                        }
                        paused = false;
                        hub.on = false;
                        hub = null;
                        sounds.botActivate();
                    }
                }
                if (nextInput < inputs.length - 2) {
                    key2Dir.forEach((key, i) => {
                        if (wasPressed(key)) {
                            const input = inputs[nextInput++];
                            input.key = i;
                            input.color = 2;
                            if (nextInput < inputs.length - 2) {
                                inputs[nextInput].color = 0;
                            }
                            sounds.addDir[i]();
                        }
                    });
                }
            }

            const d = lerp(flyHeightLast, flyHeight, stepFraction);
            for (let i = 0; i < d - 0.01; i++) {
                drawSprite(loopFrame(0, 10, 4), 9, e.x, e.y + flyHeight - Math.min(d, i));
            }

            let tx;
            if (dead || unpowered) {
                deathTime += elapsedSeconds;
                tx = (dead ? 6 : 10) + Math.min(Math.floor(deathTime * 6), 3);
            } else if (hub !== null && stepFraction > 0.95) {
                tx = loopFrame(4, 2, 2);
            } else if (blocked) {
                tx = 14;
            } else if (walking) {
                tx = Math.floor(stepFraction * 4) % 4;
            } else {
                tx = 0;
            }

            drawSprite(tx, 8, lerp(e.xp, e.x, stepFraction), lerp(e.yp, e.y, stepFraction));
        };
    }

    // Lift
    if (c_ === '=') {
        let dir = null, first = true, firstStep = true;

        e.z = 7;
        e.p = 3;
        e.solid = true;

        e.loopStep = () => {
            if (first || e.x !== e.xp || e.y !== e.yp) {
                first = false;
                return false;
            }

            const guide = entities.find(e2 => e2.x === e.x && e2.y === e.y && e2.c === '+');
            if (guide !== undefined && dir !== guide.dir) {
                dir = guide.dir;
                if (!firstStep) {
                    sounds.liftChange();
                }
            }

            firstStep = false;

            return dir !== null && e.move(dir, true);
        };

        e.draw = () => {
            const x = lerp(e.xp, e.x, stepFraction), y = lerp(e.yp, e.y, stepFraction);
            drawSprite(0, 7, x, y);
            drawSprite(6 + dir, 2, x, y);
        };
    }

    // Entrance/Exit
    if (/[><]/.test(c_)) {
        const exit = c_ === '<';

        e.z = 1;

        if (!exit) {
            createEntity(x_ + 1, y_, 0, '@', 0);
        }

        if (exit || currentMap > 1) {
            e.draw = () => drawSprite(loopFrame(exit ? 2 : 0, 2, 2), 4, e.x, e.y);
        }
    }

    // Hub
    if (/[\^"]/.test(c_)) {
        const deco = c_ === '"';

        let height;

        e.z = 2;

        e.on = !deco;

        e.start = () => {
            for (height = 0; height < mapSize.y; height++) {
                if (entities.some(e2 => e2.x === e.x && e2.y === e.y - height - 1 && /[A-P?]/.test(e2.c))) {
                    break;
                }
            }
        };

        e.draw = () => {
            for (let y = e.y - height; y < e.y - 1; y++) {
                drawSprite(0, 5, e.x, y, 0, deco);
            }
            if (height > 0) {
                drawSprite(1, 5, e.x, e.y - 1, 0, deco);
            }
            if (e.on) {
                drawSprite(2, 5, e.x, e.y);
            }
        };
    }

    // Sensor on/off and plasma beam on/off
    if (/[!|~-]/.test(c_)) {
        const dx = dirX[dir_], dy = dirY[dir_], sensor = /[!|]/.test(c_);
        let visualDist = 0, actualDist = 0, triggerDist = null, on = /[!~]/.test(c_);

        e.z = sensor ? 3 : 4;
        e.p = sensor ? 2 : 1;

        e.extend = (dist) => {
            visualDist += dist;
            actualDist += dist;
        };

        e.switch = () => {
            on = !on;
            triggerDist = null;
        };

        e.start = e.loopStep = () => {
            const maxDist = 18;
            visualDist = actualDist = maxDist;

            for (let dist = 1; dist < maxDist; dist++) {
                const x = e.x + dx * dist, y = e.y + dy * dist;
                for (const e2 of entities) {
                    if (e2.solid) {
                        if (e2.x === x && e2.y === y && visualDist === maxDist) {
                            visualDist = dist;
                        }
                        if (e2.xp === x && e2.yp === y && actualDist === maxDist) {
                            if (on && !sensor && e2.c === '@') {
                                e2.kill(false);
                            }
                            actualDist = dist;
                        }
                    }
                }
                if (visualDist !== maxDist && actualDist !== maxDist) {
                    break;
                }
            }

            if (triggerDist === null) {
                triggerDist = actualDist;
            }

            if (on && sensor && triggerDist !== actualDist) {
                entities.filter(e2 => /[+!|~-]/.test(e2.c)).forEach(e2 => e2.switch());
                sounds.sensorTrigger();
            }

            return false;
        };

        e.draw = () => {
            if (on) {
                const d = lerp(actualDist, visualDist, stepFraction);
                const tx = sensor ? actualDist !== visualDist ? 9 : loopFrame(6, 8, 2) : loopFrame(0, 8, 4);
                for (let i = 1; i < d - 1.01; i++) {
                    drawSprite(tx, 6, e.x + dx * Math.min(d - 1, i), e.y + dy * Math.min(d, i), dir_);
                }
                if (d > 1.25) {
                    drawSprite(tx, 6, e.x + dx * (d - 1), e.y + dy * (d - 1), dir_);
                }
                drawSprite(sensor ? actualDist !== visualDist ? 10 : 8 : loopFrame(4, 4, 2), 6, e.x + dx * (d - 0.5), e.y + dy * (d - 0.5), dir_);
            }
            drawSprite(sensor ? on ? 8 : 9 : on ? 7 : 6, 5, e.x, e.y, dir_);
        };
    }

    // Guide
    if (c_ === '+') {
        e.z = 8;
        e.dir = dir_;

        e.switch = () => {
            e.dir = (e.dir + 2) % 4;
        };

        e.draw = () => drawSprite(12 + e.dir, 2, e.x, e.y);
    }

    // Ending
    if (c_ === '$') {
        let hidden, phase = -1, holeRadius = 0;

        e.z = 10;

        e.nextPhase = () => {
            sounds.music.setVolume(0);
            sounds.music.stop();

            phase++;
            if (phase === 3) {
                hidden.forEach(e2 => {
                    e2.visible = true;
                });
            }
            if (phase === 6) {
                find('-')[0].extend(7);
            }
            if (phase === 7) {
                terminal.textContent = '';
            }
            if (phase === 8) {
                sounds.selfKilled();
            }
        };

        e.start = () => {
            hidden = entities.filter(e2 => e2.x > 6 && e2.x < 13 && e2.y > 3 && e2.y < 12 && e2.c !== 'p');
            hidden.forEach(e2 => {
                e2.visible = false;
            });
        };

        e.earlyStep = () => {
            const player = find('@')[0];
            if (player.x === e.x && player.y === e.y) {
                mapName.textContent = '';
                paused = true;
                find(':')[0].visible = true;
                dialogue = dialogues[currentMap + 1].split('');
            }
        };

        e.draw = () => {
            if (phase < 2) {
                drawSprite(14, 7, 6, 7);
                drawSprite(15, 7, 6, 8);
            } else {
                drawSprite(2 + Math.min(phase - 2, 4), 7, 6, 7);
                drawSprite(12, 7, 6, 8);
            }
            if (phase > 2) {
                drawSprite(7 + Math.max(0, Math.min(phase - 5, 4)), 7, 7, 7);
                drawSprite(13, 7, 7, 8);
            }
            if (phase > -1) {
                const a = Math.min(Math.max(0, 40 + phase * 20 + Math.sin(totalSeconds * 3) * 20));
                document.body.style.background = phase === 12 ? '#000000' : phase > 7 ? '#ffffff' : `rgb(${a}, 0, 0)`;
                if (phase > 7 && phase < 12) {
                    holeRadius = Math.min(canvasFG.width * 2, holeRadius + elapsedSeconds * canvasFG.width);
                    contextFG.fillStyle = '#ffffff';
                    contextFG.beginPath();
                    contextFG.arc(canvasFG.width / 2, canvasFG.height / 2, holeRadius, 0, 2 * Math.PI);
                    contextFG.fill();
                }
            }
            if (phase === 12) {
                clearScreen(false);
                clearScreen(true);
            }
        };
    }

    // Title screen
    if (c_ === ';') {
        terminal.textContent = dialogues[0];
        terminal.style.textAlign = 'center';

        e.earlyStep = () => {
            if (wasPressed(Key.ACTION)) {
                nextMap++;
                paused = true;
                find('%')[0].fadeToNextMap(0);
                sounds.gameStart();
            }
        };
    }

    // Text
    if (c_ === ':') {
        let inputs = null, ending = null, shiftTime = 0, noiseTime = 0;

        terminal.textContent = '';
        terminal.style.textAlign = 'left';
        mapName.textContent = '';

        paused = true;

        e.z = 11;

        e.start = () => {
            inputs = find('*');
            ending = find('$')[0];
        };

        e.draw = () => {
            if (dialogue.length > 0) {
                const lc = dialogue[0];

                inputs.forEach((e2, i) => {
                    e2.visible = i === inputs.length - 1 && lc === '|';
                });

                if (lc === '&') {
                    terminal.textContent = '';
                    dialogue.shift();
                } else if (lc === '|') {
                    if (wasPressed(Key.ACTION)) {
                        terminal.textContent = '';
                        dialogue.shift();
                    }
                } else if (lc === '~') {
                    shiftTime += elapsedSeconds;
                    if (shiftTime > 0.25) {
                        shiftTime -= 0.25;
                        dialogue.shift();
                    }
                } else if (lc === '%') {
                    noiseTime = 0.3;
                    dialogue.shift();
                    sounds.noise();
                } else if (lc === '>') {
                    ending.nextPhase();
                    dialogue.shift();
                } else if (lc !== '^') {
                    terminal.textContent += dialogue.shift();
                    keyDown.clear();
                    if (/[aeiouy]/i.test(lc)) {
                        sounds.talk();
                    }
                }
            }

            if (dialogue.length === 0) {
                terminal.textContent = '';
                paused = false;
                e.visible = false;

                mapName.textContent = mapNames[currentMap];
            }

            if (noiseTime > 0) {
                noiseTime -= elapsedSeconds;
                for (let x = 1; x < mapSize.x - 1; x++) {
                    for (let y = 4; y < mapSize.y - 1; y++) {
                        drawSprite(loopFrame(13, 10, 2), 9, x, y);
                    }
                    for (let y = 1; y < 3; y++) {
                        drawSprite(loopFrame(13, 10, 2), 9, x, y);
                    }
                }
            }
        };
    }

    // Fade-in/out
    if (c_ === '%') {
        let fadeIn = true, fadeTime = 0, soundPlayed = false;

        e.z = 9;

        e.fadeToNextMap = (timeToFade) => {
            fadeTime = -timeToFade;
            fadeIn = false;
            soundPlayed = false;
        };

        e.draw = () => {
            fadeTime += elapsedSeconds;
            const frame = Math.max(0, Math.floor(fadeTime * 15));
            if (fadeTime > 0 && !soundPlayed) {
                soundPlayed = true;
                if (fadeIn) {
                    sounds.fadeIn();
                } else {
                    sounds.fadeOut();
                }
            }
            if (frame > 6 && !fadeIn) {
                restart = true;
            }
            if (frame < 8) {
                for (let x = 1; x < mapSize.x - 1; x++) {
                    for (let y = 4; y < mapSize.y - 1; y++) {
                        drawSprite(fadeIn ? 11 - frame : 4 + frame, 9, x, y);
                    }
                }
            }
        };
    }
};

const update = () => {
    if (wasPressed(Key.MUTE)) {
        muted = !muted;
        if (muted) {
            sounds.music.stop();
        } else {
            sounds.music.play(true);
        }
    }

    if (restart) {
        restart = false;
        loadMap();
    }

    const newTime = new Date();
    elapsedSeconds = Math.min((newTime - (lastTime || newTime)) / 1000, 2);

    totalSeconds += elapsedSeconds;
    lastTime = newTime;
    secondsUntilStep -= elapsedSeconds;

    if (paused) {
        secondsUntilStep = Math.max(secondsUntilStep, 0);
    } else {
        while (secondsUntilStep <= 0) {
            secondsUntilStep += stepInterval;
            entities.forEach(e => e.earlyStep());
            let done = false;
            stepLoopCount = 0;
            while (!done) {
                done = true;
                entities.forEach(e => {
                    if (e.loopStep()) {
                        done = false;
                    }
                });
                stepLoopCount++;
            }
        }
    }

    stepFraction = 1 - secondsUntilStep / stepInterval;

    clearScreen(false);
    entitiesToDraw.forEach(e => e.visible && e.draw());

    requestAnimationFrame(update);
};

const loadMap = () => {
    if (currentMap !== nextMap) {
        currentMap = nextMap;
        dialogue = dialogues[currentMap].split('');
        storedInputs.length = 0;
    }

    entities.length = 0;
    secondsUntilStep = 0;
    totalSeconds = 0;
    paused = false;

    clearScreen(true);

    maps[currentMap].forEach((l, i) => {
        const c = (x, y) => (x < 0 || y < 0 || x >= mapSize.x || y >= mapSize.y ? ' ' : l[x + y * mapSize.x]);
        for (let y = 0; y < mapSize.y; y++) {
            for (let x = 0; x < mapSize.x; x++) {
                createEntity(x, y, i, c(x, y), c(x + 1, y) === '.' ? 1 : c(x, y + 1) === '.' ? 2 : c(x - 1, y) === '.' ? 3 : 0);
            }
        }
    });
    entities.sort((a, b) => (b.p - b.x * 0.00001 - b.y * 0.001 - b.l * 0.1) - (a.p - a.x * 0.00001 - a.y * 0.001 - a.l * 0.1));
    entitiesToDraw = entities.slice(0).sort((a, b) => (a.z - a.x * 0.00001 - a.y * 0.001 - a.l * 0.1) - (b.z - b.x * 0.00001 - b.y * 0.001 - b.l * 0.1));
    entities.forEach(e => e.start());
};

update();

sounds.music.play(true);
});
