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

                // Duration: (again, probably wrong)
                // t = (x^2 * 100000) / Fs
                // x = sqrt(Fs * t) / 316.2278
                // Sustain duration limited to 100000/Fs seconds
                const aTime = (Math.pow(settings[1] || 0, 2) * 100000) / data.fs;
                const sTime = (Math.pow(settings[2] || 0, 2) * 100000) / data.fs;
                const timeDiff = track[n + 1] / data.rate - (aTime + sTime);
                const sDiff = Math.sqrt(data.fs * Math.abs(timeDiff)) / 316.2278 * Math.sign(timeDiff);
                const oldS = settings[2];
                if (data.adjustSustainDuration) {
                    settings[2] = Math.max(0, Math.min(1, (settings[2] || 0) + sDiff));
                }

                const src = jsfxr(settings);

                if (data.adjustSustainDuration) {
                    settings[2] = oldS;
                }

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
