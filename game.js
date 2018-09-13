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
