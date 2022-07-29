// deno-fmt-ignore-file
// deno-lint-ignore-file
// This code was bundled using `deno bundle` and it's not recommended to edit it manually

class EventEmitter {
    _events_ = new Map();
    on(event, listener) {
        if (!this._events_.has(event)) this._events_.set(event, new Set());
        this._events_.get(event).add(listener);
        return this;
    }
    once(event, listener) {
        const l = listener;
        l.__once__ = true;
        return this.on(event, l);
    }
    off(event, listener) {
        if (!event && listener) throw new Error("Why is there a listener defined here?");
        else if (!event && !listener) this._events_.clear();
        else if (event && !listener) this._events_.delete(event);
        else if (event && listener && this._events_.has(event)) {
            const _ = this._events_.get(event);
            _.delete(listener);
            if (_.size === 0) this._events_.delete(event);
        } else {
            throw new Error("Unknown action!");
        }
        return this;
    }
    emitSync(event, ...args) {
        if (!this._events_.has(event)) return this;
        const _ = this._events_.get(event);
        for (let [, listener] of _.entries()){
            const r = listener(...args);
            if (r instanceof Promise) r.catch(console.error);
            if (listener.__once__) {
                delete listener.__once__;
                _.delete(listener);
            }
        }
        if (_.size === 0) this._events_.delete(event);
        return this;
    }
    async emit(event, ...args) {
        if (!this._events_.has(event)) return this;
        const _ = this._events_.get(event);
        for (let [, listener] of _.entries()){
            try {
                await listener(...args);
                if (listener.__once__) {
                    delete listener.__once__;
                    _.delete(listener);
                }
            } catch (error) {
                console.error(error);
            }
        }
        if (_.size === 0) this._events_.delete(event);
        return this;
    }
    queue(event, ...args) {
        (async ()=>await this.emit(event, ...args))().catch(console.error);
        return this;
    }
    pull(event, timeout) {
        return new Promise(async (resolve, reject)=>{
            let timeoutId;
            let listener = (...args)=>{
                if (timeoutId !== null) clearTimeout(timeoutId);
                resolve(args);
            };
            timeoutId = typeof timeout !== "number" ? null : setTimeout(()=>(this.off(event, listener), reject(new Error("Timed out!"))));
            this.once(event, listener);
        });
    }
}
const tau = Math.PI * 2;
function clamp(x, a = 0.0, b = 1.0) {
    return Math.max(a, Math.min(b, x));
}
function lerp(from, to, x) {
    return to * x + from * (1.0 - x);
}
function deltaLerp(from, to, x, delta) {
    return lerp(from, to, 1.0 - (1.0 - x) ** delta);
}
function distance(from, to) {
    return length(vector(from, to));
}
function vector(from, to) {
    return [
        to[0] - from[0],
        to[1] - from[1]
    ];
}
function length(x) {
    return Math.sqrt(x[0] * x[0] + x[1] * x[1]);
}
function rescale(x, target) {
    const len = length(x);
    if (len < 0.0001) {
        return [
            target,
            0
        ];
    } else {
        const rescale = target / len;
        return [
            x[0] * rescale,
            x[1] * rescale
        ];
    }
}
function add(a, b) {
    return [
        a[0] + b[0],
        a[1] + b[1]
    ];
}
function scale(a, b) {
    return [
        a[0] * b,
        a[1] * b
    ];
}
function dot(a, b) {
    return a[0] * b[0] + a[1] * b[1];
}
function dir(angle, length) {
    return [
        +Math.cos(angle) * length,
        -Math.sin(angle) * length
    ];
}
function toward(a, b, distance, clamp = true) {
    const vec = vector(a, b);
    if (clamp && length(vec) <= distance) return [
        b[0],
        b[1]
    ];
    return add(a, rescale(vec, distance));
}
function roughly(a, b) {
    return Math.abs(a - b) < 0.001;
}
function easeOutQuad(x) {
    return 1 - (1 - x) * (1 - x);
}
function easeOutElastic(x) {
    const c4 = 2 * Math.PI / 3;
    return x == 0 ? 0 : x == 1 ? 1 : 2 ** (-10 * x) * Math.sin((x * 10 - 0.75) * c4) + 1;
}
function concat_arrayBuffers(arrayBuffers) {
    let length = 0;
    for (const buffer of arrayBuffers){
        length += buffer.byteLength;
    }
    const result = new Uint8Array(length);
    let i = 0;
    for (const buffer1 of arrayBuffers){
        result.set(new Uint8Array(buffer1.buffer), i);
        i += buffer1.byteLength;
    }
    return result.buffer;
}
function string_to_uint8(value) {
    const data = [];
    for(let i = 0; i < value.length; i++){
        data.push(value.charCodeAt(i));
    }
    return new Uint8Array([
        data.length,
        ...data
    ]);
}
function uint8_to_string(buffer) {
    const length = new Uint8Array(buffer.slice(0, 1))[0];
    buffer = buffer.slice(1);
    const data = new Uint8Array(buffer.slice(0, length));
    buffer = buffer.slice(length);
    let value = '';
    for (const item of data){
        value += String.fromCharCode(item);
    }
    return [
        buffer,
        value
    ];
}
class Client {
    socket;
    events = new EventEmitter;
    constructor(address, playerName){
        this.socket = new WebSocket(address);
        this.socket.binaryType = 'arraybuffer';
        this.socket.onopen = ()=>{
            this.socket.send(string_to_uint8(playerName));
            this.events.emit('connected');
        };
        this.socket.onclose = ()=>{
            this.events.emit('disconnected');
        };
        this.socket.onmessage = (message)=>{
            this.events.emit('message', message.data);
        };
    }
    send(data) {
        this.socket.send(data);
    }
}
const address = `ws://localhost:${8764}`;
class Mode {
    startTime = Date.now();
    on_button_down(button) {
        return false;
    }
    on_button_up(button) {
        return false;
    }
    update(delta) {}
    draw(r) {}
}
class Unit {
    health;
    knockback;
    lastDamageTime;
    constructor(pos){
        this.pos = pos;
        this.health = 10;
        this.knockback = [
            0,
            0
        ];
        this.lastDamageTime = 0;
    }
    take_damage(from, player) {
        if (this.health < 1) return false;
        this.lastDamageTime = Date.now();
        this.knockback = add(this.knockback, rescale(vector(from, this.pos), 60));
        this.health -= 1;
        return true;
    }
    update(play, delta) {
        if (this.knockback[0] || this.knockback[1]) {
            const motion = toward([
                0,
                0
            ], this.knockback, delta * 200, true);
            this.knockback[0] -= motion[0];
            this.knockback[1] -= motion[1];
            this.pos[0] += motion[0];
            this.pos[1] += motion[1];
        }
    }
    serialise() {
        const data = [];
        data.push(new Float32Array([
            this.pos[0],
            this.pos[1],
            this.knockback[0],
            this.knockback[1]
        ]));
        data.push(new Uint8Array([
            this.health
        ]));
        return data;
    }
    static deserialise_data(buffer) {
        const [posX, posY, knockbackX, knockbackY] = Array.from(new Float32Array(buffer.slice(0, 4 * 4)));
        buffer = buffer.slice(4 * 4);
        const health = new Uint8Array(buffer.slice(0, 1))[0];
        buffer = buffer.slice(1);
        return [
            buffer,
            health,
            [
                posX,
                posY
            ],
            [
                knockbackX,
                knockbackY
            ]
        ];
    }
    pos;
}
class Player extends Unit {
    id;
    velocity;
    targetDir;
    angle;
    speed;
    lastExhaustTime;
    lastFireTime;
    score;
    static invulnerabilityDuration = 0.8;
    isAccelerating;
    isFiring;
    isUp;
    isDown;
    isLeft;
    isRight;
    constructor(name, pos, angle = Math.PI / 2){
        super(pos);
        this.name = name;
        this.id = 0 | Math.random() * 655536;
        this.velocity = [
            0,
            0
        ];
        this.speed = 700.0;
        this.lastExhaustTime = 0;
        this.lastFireTime = 0;
        this.score = 0;
        this.isAccelerating = false;
        this.isFiring = false;
        this.isUp = false;
        this.isDown = false;
        this.isLeft = false;
        this.isRight = false;
        this.targetDir = angle;
        this.angle = angle;
    }
    take_damage(from, player) {
        if (Date.now() - this.lastDamageTime < Player.invulnerabilityDuration * 1000) return false;
        const result = super.take_damage(from, player);
        if (this.health < 1) {
            this.clear_input();
        }
        return result;
    }
    add_score(amount) {
        this.score += amount;
    }
    clear_input() {
        this.isAccelerating = false;
        this.isFiring = false;
        this.isUp = false;
        this.isDown = false;
        this.isLeft = false;
        this.isRight = false;
    }
    serialise() {
        const data = super.serialise();
        data.push(new Uint16Array([
            this.id
        ]));
        data.push(string_to_uint8(this.name));
        data.push(new Float32Array([
            this.velocity[0],
            this.velocity[1],
            this.targetDir,
            this.angle
        ]));
        data.push(new Uint32Array([
            this.score
        ]));
        data.push(new Uint8Array([
            this.isAccelerating ? 1 : 0,
            this.isFiring ? 1 : 0,
            this.isUp ? 1 : 0,
            this.isDown ? 1 : 0,
            this.isLeft ? 1 : 0,
            this.isRight ? 1 : 0
        ]));
        return data;
    }
    static deserialise(buffer) {
        let pos;
        let health;
        let knockback;
        [buffer, health, pos, knockback] = Unit.deserialise_data(buffer);
        const id = new Uint16Array(buffer.slice(0, 2))[0];
        buffer = buffer.slice(2);
        let name;
        [buffer, name] = uint8_to_string(buffer);
        const [velocityX, velocityY, targetDir, angle] = Array.from(new Float32Array(buffer.slice(0, 4 * 4)));
        buffer = buffer.slice(4 * 4);
        const score = new Uint32Array(buffer.slice(0, 1 * 4))[0];
        buffer = buffer.slice(1 * 4);
        const [isAccelerating, isFiring, isUp, isDown, isLeft, isRight] = Array.from(new Uint8Array(buffer.slice(0, 6)));
        buffer = buffer.slice(6);
        const player = new Player(name, pos, angle);
        player.health = health;
        player.id = id;
        player.knockback = knockback;
        player.velocity = [
            velocityX,
            velocityY
        ];
        player.targetDir = targetDir;
        player.score = score;
        player.isAccelerating = !!isAccelerating;
        player.isFiring = !!isFiring;
        player.isUp = !!isUp;
        player.isDown = !!isDown;
        player.isLeft = !!isLeft;
        player.isRight = !!isRight;
        return [
            buffer,
            player
        ];
    }
    serialise_input() {
        const data = [];
        data.push(new Float32Array([
            this.pos[0],
            this.pos[1],
            this.velocity[0],
            this.velocity[1],
            this.targetDir,
            this.angle
        ]));
        console.log('send', [
            this.pos[0],
            this.pos[1],
            this.velocity[0],
            this.velocity[1],
            this.targetDir,
            this.angle
        ]);
        data.push(new Uint8Array([
            this.isAccelerating ? 1 : 0,
            this.isFiring ? 1 : 0,
            this.isUp ? 1 : 0,
            this.isDown ? 1 : 0,
            this.isLeft ? 1 : 0,
            this.isRight ? 1 : 0
        ]));
        return data;
    }
    deserialise_input(buffer) {
        const [posX, posY, velocityX, velocityY, targetDir, angle] = Array.from(new Float32Array(buffer.slice(0, 6 * 4)));
        buffer = buffer.slice(6 * 4);
        const [isAccelerating, isFiring, isUp, isDown, isLeft, isRight] = Array.from(new Uint8Array(buffer.slice(0, 6)));
        buffer = buffer.slice(6);
        this.pos = [
            posX,
            posY
        ];
        this.velocity = [
            velocityX,
            velocityY
        ];
        this.targetDir = targetDir;
        this.angle = angle;
        this.isAccelerating = !!isAccelerating;
        this.isFiring = !!isFiring;
        this.isUp = !!isUp;
        this.isDown = !!isDown;
        this.isLeft = !!isLeft;
        this.isRight = !!isRight;
        return buffer;
    }
    name;
}
class Exhaust {
    velocity;
    angle;
    phase;
    speed;
    constructor(pos, angle = Math.PI / 2){
        this.pos = pos;
        this.velocity = [
            0,
            0
        ];
        this.phase = 0.0;
        this.speed = 200.0;
        this.angle = angle;
    }
    pos;
}
class Shot {
    velocity;
    angle;
    age;
    constructor(owner, pos, angle = Math.PI / 2, speed){
        this.owner = owner;
        this.pos = pos;
        this.speed = speed;
        this.velocity = [
            0,
            0
        ];
        this.age = 0.0;
        this.angle = angle;
    }
    serialise() {
        const data = [];
        data.push(new Uint16Array([
            this.owner === null ? 0 : this.owner.id + 1
        ]));
        data.push(new Float32Array([
            this.pos[0],
            this.pos[1],
            this.speed,
            this.velocity[0],
            this.velocity[1],
            this.angle,
            this.age
        ]));
        return data;
    }
    static deserialise(players, buffer) {
        const playerId = new Uint16Array(buffer.slice(0, 2))[0];
        buffer = buffer.slice(2);
        const [posX, posY, speed, velocityX, velocityY, angle, age] = Array.from(new Float32Array(buffer.slice(0, 7 * 4)));
        buffer = buffer.slice(7 * 4);
        let player = null;
        if (playerId > 0) {
            for (const search of players){
                if (search.id == playerId - 1) {
                    player = search;
                    break;
                }
            }
        }
        const shot = new Shot(player, [
            posX,
            posY
        ], angle, speed);
        shot.velocity = [
            velocityX,
            velocityY
        ];
        shot.age = age;
        return [
            buffer,
            shot
        ];
    }
    owner;
    pos;
    speed;
}
class Obstacle {
    lastHitTime;
    constructor(pos, radius){
        this.pos = pos;
        this.radius = radius;
        this.lastHitTime = 0.0;
    }
    on_hit() {
        this.lastHitTime = Date.now();
    }
    serialise() {
        const data = [];
        data.push(new Float32Array([
            this.pos[0],
            this.pos[1],
            this.radius
        ]));
        return data;
    }
    static deserialise(buffer) {
        const [posX, posY, radius] = Array.from(new Float32Array(buffer.slice(0, 3 * 4)));
        buffer = buffer.slice(3 * 4);
        const obstacle = new Obstacle([
            posX,
            posY
        ], radius);
        return [
            buffer,
            obstacle
        ];
    }
    pos;
    radius;
}
class Enemy extends Unit {
    get radius() {
        return 20;
    }
    constructor(pos){
        super(pos);
        this.health = 5;
    }
    update(play, delta) {
        super.update(play, delta);
    }
    serialise() {
        const data = super.serialise();
        return data;
    }
    static deserialise(buffer) {
        let pos;
        let health;
        let knockback;
        [buffer, health, pos, knockback] = Unit.deserialise_data(buffer);
        const enemy = new Enemy(pos);
        enemy.health = health;
        enemy.knockback = knockback;
        return [
            buffer,
            enemy
        ];
    }
}
class EnemySpinner extends Enemy {
    fireDelay = 0.5;
    ammo = 3;
    constructor(pos){
        super(pos);
        this.health = 5;
    }
    get radius() {
        return this.health * 6;
    }
    update(play, delta) {
        super.update(play, delta);
        let closestPlayer;
        let closestDistance = 0.0;
        for (const player of play.players){
            if (player.health < 1) continue;
            const dist = distance(player.pos, this.pos);
            if (dist < 300 && (!closestPlayer || dist < closestDistance)) {
                closestPlayer = player;
                closestDistance = dist;
            }
        }
        if (!closestPlayer) {
            for (const shot of play.shots){
                if (!shot.owner) continue;
                const dist1 = distance(shot.pos, this.pos);
                if (dist1 < 300 && (!closestPlayer || dist1 < closestDistance)) {
                    closestPlayer = shot.owner;
                    closestDistance = dist1;
                }
            }
        }
        if (closestPlayer) {
            this.pos = add(this.pos, rescale(vector(this.pos, closestPlayer.pos), 80 * delta));
            this.fireDelay -= delta;
            if (this.fireDelay < 0 && this.ammo > 0) {
                const shots = 6;
                for(let x = tau / 6 * (Date.now() / 1000 % 1.0); x < tau; x += tau / shots){
                    play.shots.push(new Shot(null, add(this.pos, dir(x, 35)), x, 150));
                }
                this.ammo--;
                if (this.ammo < 1) {
                    this.ammo = 3;
                    this.fireDelay = 1.5;
                } else {
                    this.fireDelay = 0.4;
                }
            }
        }
    }
}
class ScoreMarker {
    timeCreated;
    constructor(pos, text){
        this.pos = pos;
        this.text = text;
        this.timeCreated = Date.now();
    }
    pos;
    text;
}
class ConnectingMode extends Mode {
    isConnecting;
    constructor(game){
        super();
        this.game = game;
        this.isConnecting = true;
        const client = new Client(address, game.localPlayerName);
        const onConnected = ()=>{
            client.events.off('connected', onConnected);
            client.events.off('disconnected', onDisconnected);
            this.game.remove_mode(this);
            this.game.push_mode(new PlayMode(this.game, client, false));
        };
        const onDisconnected = ()=>{
            client.events.off('connected', onConnected);
            client.events.off('disconnected', onDisconnected);
            this.isConnecting = false;
            this.startTime = Date.now();
            setTimeout(()=>{
                this.game.remove_mode(this);
                this.game.push_mode(new ConnectingMode(this.game));
            }, 4500);
        };
        client.events.once('connected', onConnected);
        client.events.once('disconnected', onDisconnected);
    }
    draw(r) {
        const chars = (Date.now() - this.startTime) / 1000 / 0.01;
        r.draw_text([
            0,
            r.size[1] * 0.5 - 18
        ], r.size[0], 0.5, '20px sans-serif', this.isConnecting ? 'Connecting...' : 'Unable to connect. Retrying...', '#fff', chars);
    }
    game;
}
class PlayMode extends Mode {
    players;
    exhausts;
    shots;
    obstacles;
    enemies;
    scoreMarkers;
    localPlayer;
    cameraPos;
    worldSize;
    idealEnemyCount;
    lastClientUpdateTime;
    constructor(game, client, spawnPlayer){
        super();
        this.game = game;
        this.client = client;
        this.players = [];
        this.exhausts = [];
        this.shots = [];
        this.obstacles = [];
        this.enemies = [];
        this.scoreMarkers = [];
        this.cameraPos = [
            0,
            0
        ];
        this.worldSize = [
            2000,
            2000
        ];
        this.lastClientUpdateTime = 0;
        this.idealEnemyCount = this.worldSize[0] * this.worldSize[1] / 100000;
        this.cameraPos = scale(this.worldSize, 0.5);
        if (client) {
            const onDisconnected = ()=>{
                client.events.off('disconnected', onDisconnected);
                client.events.off('message', onMessage);
                this.game.remove_mode(this);
                if (true) {
                    this.game.push_mode(new ConnectingMode(this.game));
                }
            };
            const onMessage = (data)=>{
                this.deserialise(data);
            };
            client.events.once('disconnected', onDisconnected);
            client.events.on('message', onMessage);
            return;
        }
        for(let i = 0; i < this.worldSize[0] * this.worldSize[1] / 50000; i++){
            do {
                const pos = [
                    Math.random() * this.worldSize[0],
                    Math.random() * this.worldSize[1]
                ];
                if (!this.pos_is_available(pos, 50 / 2)) continue;
                this.obstacles.push(new Obstacle(pos, 50));
            }while (false)
        }
        for(let i1 = 0; i1 < this.idealEnemyCount; i1++){
            do {
                const pos1 = [
                    Math.random() * this.worldSize[0],
                    Math.random() * this.worldSize[1]
                ];
                if (!this.pos_is_available(pos1, 20, false)) continue;
                this.enemies.push(new EnemySpinner(pos1));
            }while (false)
        }
        if (spawnPlayer) {
            this.localPlayer = this.add_player(this.game.localPlayerName);
            this.cameraPos = this.localPlayer.pos;
        }
    }
    add_player(name) {
        let newPlayerPos = [
            0,
            0
        ];
        for(let i = 0; i < 50; i++){
            newPlayerPos = [
                Math.random() * this.worldSize[0],
                Math.random() * this.worldSize[1]
            ];
            if (this.pos_is_available(newPlayerPos, 20, false)) break;
        }
        for (const [i1, enemy] of this.enemies.entries()){
            if (distance(newPlayerPos, enemy.pos) < enemy.radius + 20 + 250) {
                this.enemies.splice(i1, 1);
            }
        }
        const player = new Player(name, newPlayerPos, Math.PI * -0.25);
        this.players.push(player);
        return player;
    }
    get activePlayers() {
        return this.players.filter((x)=>x.health > 0);
    }
    serialise(player) {
        const data = [];
        data.push(new Float64Array([
            Date.now()
        ]));
        data.push(new Uint16Array([
            player ? player.id + 1 : 0,
            this.worldSize[0],
            this.worldSize[1],
            this.players.length
        ]));
        for (const player1 of this.players){
            data.push(...player1.serialise());
        }
        data.push(new Uint16Array([
            this.shots.length
        ]));
        for (const shot of this.shots){
            data.push(...shot.serialise());
        }
        data.push(new Uint16Array([
            this.obstacles.length
        ]));
        for (const obstacle of this.obstacles){
            data.push(...obstacle.serialise());
        }
        data.push(new Uint16Array([
            this.enemies.length
        ]));
        for (const enemy of this.enemies){
            data.push(...enemy.serialise());
        }
        return data;
    }
    deserialise(buffer) {
        const time = new Float64Array(buffer.slice(0, 8))[0];
        buffer = buffer.slice(8);
        time - Date.now();
        const [playerId, sizeX, sizeY, playerCount] = new Uint16Array(buffer.slice(0, 4 * 2));
        buffer = buffer.slice(4 * 2);
        this.players.slice();
        this.worldSize = [
            sizeX,
            sizeY
        ];
        this.players.length = 0;
        this.localPlayer = undefined;
        for(let i = 0; i < playerCount; i++){
            let player;
            [buffer, player] = Player.deserialise(buffer);
            this.players.push(player);
            if (playerId > 0 && player.id == playerId - 1) {
                this.localPlayer = player;
            }
        }
        const shotCount = new Uint16Array(buffer.slice(0, 2))[0];
        buffer = buffer.slice(2);
        this.shots.length = 0;
        for(let i1 = 0; i1 < shotCount; i1++){
            let shot;
            [buffer, shot] = Shot.deserialise(this.players, buffer);
            this.shots.push(shot);
        }
        const obstacleCount = new Uint16Array(buffer.slice(0, 2))[0];
        buffer = buffer.slice(2);
        this.obstacles.length = 0;
        for(let i2 = 0; i2 < obstacleCount; i2++){
            let obstacle;
            [buffer, obstacle] = Obstacle.deserialise(buffer);
            this.obstacles.push(obstacle);
        }
        const enemyCount = new Uint16Array(buffer.slice(0, 2))[0];
        buffer = buffer.slice(2);
        this.enemies.length = 0;
        for(let i3 = 0; i3 < enemyCount; i3++){
            let enemy;
            [buffer, enemy] = Enemy.deserialise(buffer);
            this.enemies.push(enemy);
        }
    }
    send_client_update() {
        if (!this.client || !this.localPlayer) return;
        this.lastClientUpdateTime = Date.now();
        this.client.send(concat_arrayBuffers(this.localPlayer.serialise_input()));
    }
    pos_is_available(pos, radius, checkEnemies = true) {
        if (pos[0] < 0 + radius) return false;
        if (pos[1] < 0 + radius) return false;
        if (pos[0] >= this.worldSize[0] - radius) return false;
        if (pos[1] >= this.worldSize[1] - radius) return false;
        for (const obstacle of this.obstacles){
            if (length(vector(pos, obstacle.pos)) < obstacle.radius + radius) {
                return false;
            }
        }
        if (checkEnemies) {
            for (const enemy of this.enemies){
                if (length(vector(pos, enemy.pos)) < enemy.radius + radius) {
                    return false;
                }
            }
        }
        return true;
    }
    add_scoreMarker(pos, text) {
        if (!this.game.render) return;
        this.scoreMarkers.push(new ScoreMarker(pos, text));
    }
    camera_to_world(pos) {
        if (!this.game.render) return pos;
        return add(add(this.cameraPos, scale(this.game.render.size, -0.5)), pos);
    }
    on_button_down(button) {
        if (this.localPlayer) {
            let inputChanged = false;
            if (this.localPlayer.health > 0) {
                switch(button){
                    case 'ArrowUp':
                        inputChanged = true;
                        this.localPlayer.isUp = true;
                        if (!this.localPlayer.isFiring) {
                            this.localPlayer.targetDir = Math.PI * +0.5;
                            this.localPlayer.isAccelerating = true;
                        }
                        break;
                    case 'ArrowDown':
                        inputChanged = true;
                        this.localPlayer.isDown = true;
                        if (!this.localPlayer.isFiring) {
                            this.localPlayer.targetDir = Math.PI * -0.5;
                            this.localPlayer.isAccelerating = true;
                        }
                        break;
                    case 'ArrowLeft':
                        inputChanged = true;
                        this.localPlayer.isLeft = true;
                        if (!this.localPlayer.isFiring) {
                            this.localPlayer.targetDir = Math.PI * +1.0;
                            this.localPlayer.isAccelerating = true;
                        }
                        break;
                    case 'ArrowRight':
                        inputChanged = true;
                        this.localPlayer.isRight = true;
                        if (!this.localPlayer.isFiring) {
                            this.localPlayer.targetDir = Math.PI * +0.0;
                            this.localPlayer.isAccelerating = true;
                        }
                        break;
                    case 'ControlLeft':
                    case 'ControlRight':
                        inputChanged = true;
                        this.localPlayer.isFiring = true;
                        break;
                }
            } else {
                switch(button){
                    case 'KeyR':
                        if (this.localPlayer && this.localPlayer.health < 1) {
                            this.game.remove_mode(this);
                            this.game.push_mode(new PlayMode(this.game, this.client, !this.client));
                        }
                        break;
                }
            }
            if (inputChanged) {
                this.send_client_update();
            }
        }
        return true;
    }
    on_button_up(button) {
        if (!this.localPlayer) return true;
        let inputChanged = false;
        switch(button){
            case 'ArrowUp':
                inputChanged = true;
                this.localPlayer.isUp = false;
                break;
            case 'ArrowDown':
                inputChanged = true;
                this.localPlayer.isDown = false;
                break;
            case 'ArrowLeft':
                inputChanged = true;
                this.localPlayer.isLeft = false;
                break;
            case 'ArrowRight':
                inputChanged = true;
                this.localPlayer.isRight = false;
                break;
            case 'ControlLeft':
            case 'ControlRight':
                inputChanged = true;
                this.localPlayer.isFiring = false;
                break;
        }
        if (!this.localPlayer.isUp && !this.localPlayer.isDown && !this.localPlayer.isLeft && !this.localPlayer.isRight) {
            this.localPlayer.isAccelerating = false;
        }
        if (inputChanged) {
            this.send_client_update();
        }
        return true;
    }
    update(delta) {
        const now = Date.now();
        if (this.enemies.length < this.idealEnemyCount) {
            const positions = [];
            for(let i = 0; i < 5; i++){
                const pos = [
                    Math.random() * this.worldSize[0],
                    Math.random() * this.worldSize[1]
                ];
                let playerDistance = 0;
                for (const player of this.players){
                    const dist = distance(pos, player.pos);
                    if (!playerDistance || dist < playerDistance) {
                        playerDistance = dist;
                    }
                }
                positions.push([
                    playerDistance,
                    pos
                ]);
            }
            positions.sort((a, b)=>b[0] - a[0]);
            this.enemies.push(new EnemySpinner(positions[0][1]));
        }
        for (const player1 of this.players){
            if (player1.health > 0) {
                player1.update(this, delta);
                if (!player1.isFiring) {
                    let targetDirInvalid = false;
                    if (roughly(player1.targetDir, Math.PI * +0.5) && !this.game.is_button_down('ArrowUp')) {
                        targetDirInvalid = true;
                    }
                    if (roughly(player1.targetDir, Math.PI * -0.5) && !this.game.is_button_down('ArrowDown')) {
                        targetDirInvalid = true;
                    }
                    if (roughly(player1.targetDir, Math.PI * +1.0) && !this.game.is_button_down('ArrowLeft')) {
                        targetDirInvalid = true;
                    }
                    if (roughly(player1.targetDir, Math.PI * +0.0) && !this.game.is_button_down('ArrowRight')) {
                        targetDirInvalid = true;
                    }
                    if (targetDirInvalid) {
                        if (player1.isLeft != player1.isRight) {
                            player1.targetDir = player1.isLeft ? Math.PI : 0.0;
                        } else if (player1.isUp != player1.isDown) {
                            player1.targetDir = player1.isUp ? Math.PI * +0.5 : Math.PI * -0.5;
                        }
                    }
                }
                while(player1.targetDir - player1.angle > +Math.PI){
                    player1.angle += Math.PI * 2;
                }
                while(player1.targetDir - player1.angle < -Math.PI){
                    player1.angle -= Math.PI * 2;
                }
                player1.angle = deltaLerp(player1.angle, player1.targetDir, 0.99999, delta);
                let targetVelocity = player1.isAccelerating ? [
                    +Math.cos(player1.angle) * player1.speed,
                    -Math.sin(player1.angle) * player1.speed
                ] : [
                    0,
                    0
                ];
                if (player1.isFiring) {
                    targetVelocity[0] = (player1.isLeft ? -1 : 0) + (player1.isRight ? +1 : 0);
                    targetVelocity[1] = (player1.isUp ? -1 : 0) + (player1.isDown ? +1 : 0);
                    let length1 = Math.sqrt(targetVelocity[0] * targetVelocity[0] + targetVelocity[1] * targetVelocity[1]);
                    if (length1 > 1) {
                        targetVelocity[0] /= length1;
                        targetVelocity[1] /= length1;
                    }
                    targetVelocity[0] *= player1.speed * 0.5;
                    targetVelocity[1] *= player1.speed * 0.5;
                }
                player1.velocity[0] = deltaLerp(player1.velocity[0], targetVelocity[0], lerp(player1.isFiring ? 0.85 : 0.5, 1.0, Math.sign(player1.velocity[0]) != Math.sign(targetVelocity[0]) ? 0.85 : 0.0), delta);
                player1.velocity[1] = deltaLerp(player1.velocity[1], targetVelocity[1], lerp(player1.isFiring ? 0.85 : 0.5, 1.0, Math.sign(player1.velocity[1]) != Math.sign(targetVelocity[1]) ? 0.85 : 0.0), delta);
                if (player1.isAccelerating) {
                    if (now - player1.lastExhaustTime > 200) {
                        this.exhausts.push(new Exhaust([
                            player1.pos[0],
                            player1.pos[1]
                        ], player1.angle));
                        player1.lastExhaustTime = now;
                    }
                }
            } else {
                player1.velocity[0] = deltaLerp(player1.velocity[0], 0, 0.7, delta);
                player1.velocity[1] = deltaLerp(player1.velocity[1], 0, 0.7, delta);
            }
            player1.pos[0] += player1.velocity[0] * delta;
            player1.pos[1] += player1.velocity[1] * delta;
            for (const obstacle of this.obstacles){
                if (distance(player1.pos, obstacle.pos) < obstacle.radius + 10) {
                    const vec = vector(obstacle.pos, player1.pos);
                    const dir1 = dot(rescale(vec, 1.0), rescale(player1.velocity, 1.0));
                    player1.pos = add(obstacle.pos, rescale(vec, obstacle.radius + 10.01));
                    if (dir1 < 0) {
                        player1.velocity = add(player1.velocity, rescale(vec, length(player1.velocity)));
                    }
                }
            }
            if (player1.pos[0] < 10) {
                player1.pos[0] = 10;
                if (player1.velocity[0] < 0) {
                    player1.velocity[0] = player1.velocity[0] * -0.3;
                }
            }
            if (player1.pos[1] < 10) {
                player1.pos[1] = 10;
                if (player1.velocity[1] < 0) {
                    player1.velocity[1] = player1.velocity[1] * -0.3;
                }
            }
            if (player1.pos[0] > this.worldSize[0] - 10) {
                player1.pos[0] = this.worldSize[0] - 10;
                if (player1.velocity[0] > 1) {
                    player1.velocity[0] = player1.velocity[0] * -0.3;
                }
            }
            if (player1.pos[1] > this.worldSize[1] - 10) {
                player1.pos[1] = this.worldSize[1] - 10;
                if (player1.velocity[1] > 1) {
                    player1.velocity[1] = player1.velocity[1] * -0.3;
                }
            }
            if (player1.isFiring && now - player1.lastFireTime > 300) {
                player1.lastFireTime = now;
                this.shots.push(new Shot(player1, add([
                    player1.pos[0],
                    player1.pos[1]
                ], dir(player1.angle, 15)), player1.angle, 900));
            }
        }
        for (const [i1, exhaust] of this.exhausts.entries()){
            exhaust.pos[0] += +Math.cos(exhaust.angle) * -exhaust.speed * delta;
            exhaust.pos[1] += -Math.sin(exhaust.angle) * -exhaust.speed * delta;
            exhaust.phase += 2.0 * delta;
            if (exhaust.phase > 1.0) {
                this.exhausts.splice(i1, 1);
            }
        }
        for (const [i2, enemy] of this.enemies.entries()){
            enemy.update(this, delta);
            enemy.pos[0] = clamp(enemy.pos[0], enemy.radius, this.worldSize[0] - enemy.radius);
            enemy.pos[1] = clamp(enemy.pos[1], enemy.radius, this.worldSize[1] - enemy.radius);
            for (const obstacle1 of this.obstacles){
                const vec1 = vector(obstacle1.pos, enemy.pos);
                if (length(vec1) < obstacle1.radius) {
                    enemy.pos = add(obstacle1.pos, rescale(vec1, obstacle1.radius));
                }
            }
            for (const player2 of this.players){
                const vec2 = vector(enemy.pos, player2.pos);
                if (length(vec2) < enemy.radius + 5) {
                    player2.take_damage(enemy.pos, null);
                    player2.pos = toward(enemy.pos, player2.pos, enemy.radius + 5, false);
                }
            }
        }
        for (const [i3, shot] of this.shots.entries()){
            shot.pos[0] += +Math.cos(shot.angle) * shot.speed * delta;
            shot.pos[1] += -Math.sin(shot.angle) * shot.speed * delta;
            shot.age += delta;
            let destroyed = false;
            if (!destroyed) {
                if (shot.pos[0] < 10 || shot.pos[1] < 10 || shot.pos[0] >= this.worldSize[0] - 10 || shot.pos[1] >= this.worldSize[1] - 10) {
                    this.shots.splice(i3, 1);
                    destroyed = true;
                }
            }
            if (!destroyed) {
                for (const obstacle2 of this.obstacles){
                    if (distance(shot.pos, obstacle2.pos) < obstacle2.radius + 10) {
                        obstacle2.on_hit();
                        this.shots.splice(i3, 1);
                        destroyed = true;
                        break;
                    }
                }
            }
            if (destroyed) {
                continue;
            }
            if (shot.owner && shot.age > 1.5) {
                this.shots.splice(i3, 1);
                continue;
            }
            if (destroyed) continue;
            if (shot.owner) {
                for (const [i21, enemy1] of this.enemies.entries()){
                    if (distance(shot.pos, enemy1.pos) < enemy1.radius + 8) {
                        if (enemy1.take_damage(shot.pos, shot.owner)) {
                            if (enemy1.health < 1) {
                                shot.owner.add_score(25);
                                this.add_scoreMarker(add(enemy1.pos, [
                                    0,
                                    enemy1.radius
                                ]), `+25`);
                            } else {
                                shot.owner.add_score(5);
                                this.add_scoreMarker(add(enemy1.pos, [
                                    0,
                                    enemy1.radius
                                ]), `+5`);
                            }
                        }
                        if (enemy1.health < 1) {
                            this.enemies.splice(i21, 1);
                        }
                        this.shots.splice(i3, 1);
                        destroyed = true;
                        break;
                    }
                }
            } else {
                for (const player3 of this.players){
                    if (player3.health < 1) continue;
                    if (distance(shot.pos, player3.pos) < 20 + 8) {
                        player3.take_damage(shot.pos, shot.owner);
                        this.shots.splice(i3, 1);
                        destroyed = true;
                        break;
                    }
                }
            }
        }
        for (const [i4, marker] of this.scoreMarkers.entries()){
            if (now - marker.timeCreated > 1000) {
                this.scoreMarkers.splice(i4, 1);
            }
        }
        if (this.localPlayer) {
            const vec3 = vector(this.localPlayer.pos, this.cameraPos);
            if (length(vec3) > 100) {
                this.cameraPos = add(this.localPlayer.pos, rescale(vec3, 100));
            }
        }
        if (Date.now() - this.lastClientUpdateTime > 300) {
            this.send_client_update();
        }
    }
    draw(r) {
        function draw_ship(pos, angle, firing, lastDamageTime = 0) {
            const forward = [
                Math.cos(angle),
                -Math.sin(angle)
            ];
            const right = [
                -forward[1],
                forward[0]
            ];
            const shape = [
                [
                    forward[0] * -10,
                    forward[1] * -10
                ],
                [
                    forward[0] * -20 + right[0] * -20,
                    forward[1] * -20 + right[1] * -20
                ],
                [
                    forward[0] * 25,
                    forward[1] * 25
                ],
                [
                    forward[0] * -20 + right[0] * +20,
                    forward[1] * -20 + right[1] * +20
                ]
            ];
            r.draw_poly(pos, shape, true, '#fff', 4, firing ? '#400' : '#000');
            if (firing) {
                r.draw_poly(pos, [
                    [
                        forward[0] * 8 + right[0] * -7,
                        forward[1] * 8 + right[1] * -7
                    ],
                    [
                        forward[0] * 25,
                        forward[1] * 25
                    ],
                    [
                        forward[0] * 8 + right[0] * +7,
                        forward[1] * 8 + right[1] * +7
                    ]
                ], false, false, 5, '#f00');
            }
            const damagePhase = clamp(1.0 - (Date.now() - lastDamageTime) / 300);
            if (damagePhase > 0.0) {
                r.alpha(damagePhase);
                r.draw_poly(pos, shape, true, '#f00', 8, '#f00');
                r.alpha(1.0);
            }
        }
        function draw_exhaust(pos, angle, phase) {
            let forward = [
                Math.cos(angle),
                -Math.sin(angle)
            ];
            let right = [
                -forward[1],
                forward[0]
            ];
            r.alpha(1.0 - phase);
            r.begin_transform_scale(pos, lerp(1.0, 2.0, phase));
            r.draw_poly(pos, [
                [
                    forward[0] * -20 + right[0] * -20,
                    forward[1] * -20 + right[1] * -20
                ],
                [
                    forward[0] * -10,
                    forward[1] * -10
                ],
                [
                    forward[0] * -20 + right[0] * +20,
                    forward[1] * -20 + right[1] * +20
                ]
            ], false, false, 4, '#444');
            r.end_transform();
            r.alpha(1.0);
        }
        function draw_shot(pos, owned, angle, phase) {
            let forward = [
                Math.cos(angle),
                -Math.sin(angle)
            ];
            let right = [
                -forward[1],
                forward[0]
            ];
            let colour = owned ? '#f00' : '#f86';
            r.draw_poly(pos, [
                [
                    forward[0] * -7 + right[0] * -10,
                    forward[1] * -7 + right[1] * -10
                ],
                [
                    forward[0] * 10,
                    forward[1] * 10
                ],
                [
                    forward[0] * -7 + right[0] * +10,
                    forward[1] * -7 + right[1] * +10
                ]
            ], false, false, 7, '#000');
            r.draw_poly(pos, [
                [
                    forward[0] * -7 + right[0] * -10,
                    forward[1] * -7 + right[1] * -10
                ],
                [
                    forward[0] * 10,
                    forward[1] * 10
                ],
                [
                    forward[0] * -7 + right[0] * +10,
                    forward[1] * -7 + right[1] * +10
                ]
            ], false, false, 4, colour);
        }
        function draw_obstacle(pos, radius) {
            r.draw_circle(pos, radius, '#fff', 4, '#000');
        }
        function draw_enemy(pos, radius, lastDamageTime = 0) {
            const points = [];
            for(let x = 0; x < tau; x += tau / 6){
                points.push(dir(x, radius * (1.0 + Math.cos(x + Date.now() / 200) * 0.3)));
            }
            const damagePhase = clamp(1.0 - (Date.now() - lastDamageTime) / 300);
            r.draw_poly(pos, points, true, '#f86', 4, '#000');
            if (damagePhase > 0.0) {
                r.alpha(damagePhase);
                r.draw_poly(pos, points, true, '#fff');
                r.alpha(1.0);
            }
        }
        const now = Date.now();
        const startPhase = clamp((Date.now() - this.startTime) / 600);
        r.begin_transform_scale(scale(r.size, 0.5), lerp(20, 1, easeOutQuad(easeOutQuad(startPhase))));
        r.begin_transform_translate(add(scale(this.cameraPos, -1), scale(r.size, 0.5)));
        r.draw_box([
            0,
            0
        ], this.worldSize, false, 5, '#222');
        for (const exhaust of this.exhausts){
            draw_exhaust(exhaust.pos, exhaust.angle, exhaust.phase);
        }
        for (const player of this.players){
            const invulnerableTime = now - player.lastDamageTime;
            if (invulnerableTime < Player.invulnerabilityDuration * 1000 && (0 | invulnerableTime / 100) % 2 == 0) {} else {
                if (player.health < 1) {
                    r.alpha(0.5);
                }
                draw_ship(player.pos, player.angle, player.isFiring, player.lastDamageTime);
                r.alpha(1.0);
            }
        }
        for (const enemy of this.enemies){
            draw_enemy(enemy.pos, enemy.radius, enemy.lastDamageTime);
        }
        for (const shot of this.shots){
            draw_shot(shot.pos, shot.owner == this.localPlayer, shot.angle, shot.age);
        }
        for (const obstacle of this.obstacles){
            const collideTime = (Date.now() - obstacle.lastHitTime) / 1000.0;
            const phase = clamp(collideTime / 0.5);
            draw_obstacle(obstacle.pos, obstacle.radius + lerp(-5, 0, easeOutElastic(phase)));
        }
        for (const player1 of this.players){
            r.draw_text([
                player1.pos[0] - 50,
                player1.pos[1] - 60
            ], 100, 0.5, 'bold 20px sans-serif', player1.name, player1.health > 0 ? '#000' : '#0008');
            const invulnerableTime1 = now - player1.lastDamageTime;
            if (player1.health > 0 && player1.health < 10) {
                if (invulnerableTime1 < Player.invulnerabilityDuration * 1000 && (0 | invulnerableTime1 / 100) % 2 == 0) {} else {
                    for(let i = 0; i < 10; i++){
                        r.draw_box_gradient_v([
                            player1.pos[0] - 64 + i * 13,
                            player1.pos[1] - 50
                        ], [
                            10,
                            16
                        ], i < player1.health ? [
                            '#0f0',
                            '#0a0'
                        ] : [
                            '#800',
                            '#600'
                        ]);
                        r.draw_box([
                            player1.pos[0] - 64 + i * 13,
                            player1.pos[1] - 50
                        ], [
                            10,
                            16
                        ], false, 1, '#000');
                    }
                }
            }
        }
        for (const marker of this.scoreMarkers){
            const phase1 = clamp((now - marker.timeCreated) / 1000);
            r.alpha(1.0 - phase1 * phase1 * phase1);
            r.begin_transform_scale(marker.pos, lerp(1.0, 2.5, Math.pow(phase1, 0.5)));
            r.draw_text(add(marker.pos, [
                -200,
                phase1 * -50
            ]), 400, 0.5, 'bold 20px sans-serif', marker.text, '#fd3');
            r.end_transform();
            r.alpha(1.0);
        }
        r.end_transform();
        if (this.players.length > 1) {
            const pos = [
                r.size[0] - 30 - 300 - 10 * 2,
                30
            ];
            const scoreboardPlayers = this.players.slice();
            scoreboardPlayers.sort((a, b)=>b.score - a.score);
            r.draw_box(pos, [
                300 + 10 * 2,
                10 + scoreboardPlayers.length * 26 + 10
            ], '#fffa', 3, '#444');
            for (const [row, player2] of scoreboardPlayers.entries()){
                r.draw_text([
                    pos[0] + 10,
                    pos[1] + 10 + 26 * (row + 1) - 26 * 0.3
                ], 300 * 0.7, 0.0, '20px sans-serif', `${row + 1}. ${player2.name}`, '#000');
                r.draw_text([
                    pos[0] + 10,
                    pos[1] + 10 + 26 * (row + 1) - 26 * 0.3
                ], 300, 1.0, 'bold 20px sans-serif', player2.score.toFixed(0), '#000');
            }
        }
        if (this.localPlayer) {
            const font = 'bold 60px sans-serif';
            const width1 = r.get_text_width(font, this.localPlayer.score.toFixed(0));
            const pos1 = [
                30,
                30
            ];
            r.draw_box(pos1, [
                width1 + 10 * 2,
                50 + 10 * 2
            ], '#fffa', 3, '#444');
            r.draw_text([
                pos1[0] + 10,
                pos1[1] + 10 + 45
            ], width1, 0.0, font, this.localPlayer.score.toFixed(0), '#000');
        }
        r.end_transform();
        if (!this.localPlayer) {
            r.draw_box([
                0,
                0
            ], r.size, '#fff6');
        }
        if (this.localPlayer && this.localPlayer.health < 1) {
            const gameoverTime = (now - this.localPlayer.lastDamageTime) / 1000.0;
            const gameoverPhase = clamp(gameoverTime / 1.0);
            r.alpha(gameoverPhase);
            r.draw_box([
                0,
                0
            ], r.size, '#fffa');
            r.alpha(1.0);
            let chars = gameoverTime / 0.07;
            chars -= 10;
            r.draw_text([
                0,
                r.size[1] * 0.6
            ], r.size[0], 0.5, 'bold 100px sans-serif', 'Game Over', '#000', chars);
            chars -= 10;
            r.draw_text([
                0,
                r.size[1] * 0.6 + 70
            ], r.size[0], 0.5, 'bold 50px sans-serif', `You achieved ${this.localPlayer.score} points`, '#000', chars);
            chars -= 30;
            r.draw_text([
                0,
                r.size[1] * 0.6 + 70 + 70
            ], r.size[0], 0.5, 'bold 25px sans-serif', `Press R to respawn and try again`, '#000', chars);
        }
        if (startPhase < 1) {
            r.alpha(1.0 - startPhase);
            r.draw_box([
                0,
                0
            ], r.size, '#aaa');
            r.alpha(1.0);
        }
    }
    game;
    client;
}
var StartModePhase;
(function(StartModePhase) {
    StartModePhase[StartModePhase["welcome"] = 0] = "welcome";
    StartModePhase[StartModePhase["instructions"] = 1] = "instructions";
    StartModePhase[StartModePhase["starting"] = 2] = "starting";
})(StartModePhase || (StartModePhase = {}));
class StartMode extends Mode {
    booped;
    phase;
    phaseTime;
    instructionTime;
    introLines;
    constructor(game){
        super();
        this.game = game;
        this.booped = false;
        this.phase = StartModePhase.welcome;
        this.phaseTime = 0;
        this.instructionTime = 0;
        this.introLines = [
            'Use arrow keys to move',
            'Hold Ctrl to fire',
            'Shoot the gelatinous hexagonal ameba for points',
            '(Beware, shooting nearby will anger them)',
            '',
            'Click again to start!'
        ];
    }
    on_button_down(button) {
        switch(this.phase){
            case StartModePhase.welcome:
                if (button == 'Mouse0') {
                    let name = null;
                    while(!name){
                        name = prompt('What shall we call you?');
                    }
                    this.game.set_player_name(name);
                    this.introLines.unshift(`Hello ${name}`);
                    this.phase = StartModePhase.instructions;
                    this.phaseTime = Date.now();
                    this.instructionTime = Date.now();
                }
                break;
            case StartModePhase.instructions:
                if (button == 'Mouse0') {
                    this.phase = StartModePhase.starting;
                    this.phaseTime = Date.now();
                }
                break;
        }
        return true;
    }
    update(delta) {
        if (this.phase == StartModePhase.starting && Date.now() - this.phaseTime > 1000) {
            this.game.remove_mode(this);
            if (true) {
                this.game.push_mode(new ConnectingMode(this.game));
            }
        }
    }
    draw(r) {
        const now = Date.now();
        function draw_logo(y) {
            const time = Date.now() / 1000;
            const colours = [
                '#d26d6d',
                '#d2a56d',
                '#d2cf6d',
                '#a0d26d',
                '#73d26d',
                '#6dd2ab',
                '#6da1d2',
                '#936dd2',
                '#d26db3', 
            ];
            for(let offset = 6; offset > 0; offset--){
                r.draw_text([
                    0 + offset * 3,
                    y + offset * 3 + Math.sin(time * 6 + offset) * 4
                ], r.size[0], 0.5, '200px sans-serif', 'Astro', colours[(offset + Math.floor(time / 0.3)) % colours.length]);
            }
            r.draw_text([
                0 - 1,
                y - 1
            ], r.size[0], 0.5, '200px sans-serif', 'Astro', '#ccc');
            r.draw_text([
                0,
                y
            ], r.size[0], 0.5, '200px sans-serif', 'Astro', '#000');
        }
        switch(this.phase){
            case StartModePhase.welcome:
                draw_logo(r.size[1] / 3 + 100);
                r.begin_transform_scale([
                    r.size[0] / 2,
                    r.size[1] / 2
                ], 1 + Math.sin(now / 300) * 0.2);
                r.draw_text([
                    0,
                    r.size[1] / 2 + 10
                ], r.size[0], 0.5, '30px sans-serif', 'Click screen to start', '#fff');
                r.end_transform();
                break;
            case StartModePhase.instructions:
            case StartModePhase.starting:
                const time = (now - this.phaseTime) / 1000;
                const introTime = (now - this.instructionTime) / 1000;
                let instructionChars = introTime / 0.04;
                const nudgeUp = Math.pow(clamp(introTime / 1), 0.4) * 100;
                const startingPhase = this.phase == StartModePhase.starting ? clamp(time / 0.5) : 0.0;
                r.alpha(1.0 - startingPhase);
                draw_logo(r.size[1] / 3 + 100 - nudgeUp);
                let y = r.size[1] / 2 + 10 - nudgeUp;
                for (const [i, line] of this.introLines.entries()){
                    r.draw_text([
                        0,
                        y
                    ], r.size[0], 0.5, '30px sans-serif', line, i == this.introLines.length - 1 ? '#000' : '#fff', instructionChars);
                    y += 34;
                    instructionChars -= line.length;
                    instructionChars -= 20;
                }
                r.alpha(1.0);
                break;
        }
    }
    game;
}
class Game {
    localPlayerName = 'unnamed';
    render;
    modes = [];
    buttonsDown = new Set();
    constructor(render, showMenu = true){
        this.render = render;
        if (showMenu) {
            this.push_mode(new StartMode(this));
        } else {
            this.push_mode(new PlayMode(this, null, true));
        }
    }
    push_mode(mode) {
        this.modes.push(mode);
    }
    remove_mode(mode) {
        const index = this.modes.indexOf(mode);
        if (index >= 0) {
            this.modes.splice(index, 1);
        }
    }
    on_button_down(button) {
        this.buttonsDown.add(button);
        for(let i = this.modes.length - 1; i >= 0; i--){
            if (this.modes[i].on_button_down(button)) break;
        }
    }
    on_button_up(button) {
        this.buttonsDown.delete(button);
        for(let i = this.modes.length - 1; i >= 0; i--){
            if (this.modes[i].on_button_up(button)) break;
        }
    }
    is_button_down(button) {
        return this.buttonsDown.has(button);
    }
    set_player_name(name) {
        this.localPlayerName = name;
    }
    update(delta) {
        for (const mode of this.modes){
            mode.update(delta);
        }
    }
    draw() {
        const r = this.render;
        if (!r) return;
        r.clear('#aaa');
        for (const mode of this.modes){
            mode.draw(r);
        }
    }
}
const { Deno  } = globalThis;
typeof Deno?.noColor === "boolean" ? Deno.noColor : true;
new RegExp([
    "[\\u001B\\u009B][[\\]()#;?]*(?:(?:(?:(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]+)*|[a-zA-Z\\d]+(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]*)*)?\\u0007)",
    "(?:(?:\\d{1,4}(?:;\\d{0,4})*)?[\\dA-PR-TZcf-nq-uy=><~]))", 
].join("|"), "g");
var DiffType;
(function(DiffType) {
    DiffType["removed"] = "removed";
    DiffType["common"] = "common";
    DiffType["added"] = "added";
})(DiffType || (DiffType = {}));
class AssertionError extends Error {
    name = "AssertionError";
    constructor(message){
        super(message);
    }
}
function assert(expr, msg = "") {
    if (!expr) {
        throw new AssertionError(msg);
    }
}
class Render {
    context;
    pixelScale = 1.0;
    oldTransform = [];
    constructor(canvas){
        const context = canvas.getContext('2d');
        assert(context);
        this.context = context;
    }
    get size() {
        return [
            this.context.canvas.width * this.pixelScale,
            this.context.canvas.height * this.pixelScale
        ];
    }
    set_resolution(width, height, pixelScale) {
        this.context.canvas.width = width / pixelScale;
        this.context.canvas.height = height / pixelScale;
        this.pixelScale = pixelScale;
        const transform = new DOMMatrix();
        transform.scaleSelf(1.0 / pixelScale, 1.0 / pixelScale);
        this.context.setTransform(transform);
    }
    clear(colour) {
        this.context.fillStyle = colour;
        this.context.fillRect(0, 0, this.size[0], this.size[1]);
    }
    alpha(x) {
        this.context.globalAlpha = x;
    }
    begin_transform_scale(centre, scale) {
        const transform = this.context.getTransform();
        this.oldTransform.push(transform);
        this.context.setTransform(transform.translate(centre[0], centre[1]).scaleSelf(scale, scale).translateSelf(-centre[0], -centre[1]));
    }
    begin_transform_translate(translate) {
        const transform = this.context.getTransform();
        this.oldTransform.push(transform);
        this.context.setTransform(transform.translate(Math.round(translate[0]), Math.round(translate[1])));
    }
    end_transform() {
        this.context.setTransform(this.oldTransform.pop());
    }
    draw_poly(offset, coords, closed, fillColour, strokeWidth = 0, strokeColour = '') {
        let first = true;
        this.context.beginPath();
        for (const coord of coords){
            this.context[first ? 'moveTo' : 'lineTo'](offset[0] + coord[0], offset[1] + coord[1]);
            first = false;
        }
        if (closed) {
            this.context.closePath();
        }
        if (fillColour !== false) {
            this.context.fillStyle = fillColour;
            this.context.fill();
        }
        if (strokeWidth > 0) {
            this.context.lineWidth = strokeWidth;
            this.context.strokeStyle = strokeColour;
            this.context.stroke();
        }
    }
    draw_text(pos, width, alignX, font, text, colour, maxChars = false) {
        this.context.font = font;
        this.context.fillStyle = colour;
        const textWidth = this.get_text_width(font, text);
        this.context.fillText(maxChars === false ? text : text.substring(0, maxChars), pos[0] + (width - textWidth) * alignX, pos[1], width);
    }
    get_text_width(font, text) {
        this.context.font = font;
        return this.context.measureText(text).width;
    }
    draw_circle(pos, radius, fillColour, strokeWidth = 0, strokeColour = '') {
        this.context.beginPath();
        this.context.arc(pos[0], pos[1], radius, 0, Math.PI * 2);
        if (fillColour !== false) {
            this.context.fillStyle = fillColour;
            this.context.fill();
        }
        if (strokeWidth > 0) {
            this.context.lineWidth = strokeWidth;
            this.context.strokeStyle = strokeColour;
            this.context.stroke();
        }
    }
    draw_box(pos, size, fillColour, strokeWidth = 0, strokeColour = '') {
        this.context.beginPath();
        this.context.rect(Math.round(pos[0]), Math.round(pos[1]), Math.round(size[0]), Math.round(size[1]));
        if (fillColour !== false) {
            this.context.fillStyle = fillColour;
            this.context.fill();
        }
        if (strokeWidth > 0) {
            this.context.lineWidth = strokeWidth;
            this.context.strokeStyle = strokeColour;
            this.context.stroke();
        }
    }
    draw_box_rounded(pos, size, colour, cornerRadius, strokeWidth = 0, stroke = '') {
        this.context.fillStyle = colour;
        this.context.beginPath();
        this.context.moveTo(pos[0] + cornerRadius, pos[1]);
        this.context.lineTo(pos[0] + size[0] - cornerRadius, pos[1]);
        this.context.arc(pos[0] + size[0] - cornerRadius, pos[1] + cornerRadius, cornerRadius, Math.PI * 1.5, Math.PI * 2, false);
        this.context.lineTo(pos[0] + size[0], pos[1] + size[1] - cornerRadius);
        this.context.arc(pos[0] + size[0] - cornerRadius, pos[1] + size[1] - cornerRadius, cornerRadius, Math.PI * 0.0, Math.PI * 0.5, false);
        this.context.lineTo(pos[0] + cornerRadius, pos[1] + size[1]);
        this.context.arc(pos[0] + cornerRadius, pos[1] + size[1] - cornerRadius, cornerRadius, Math.PI * 0.5, Math.PI * 1.0, false);
        this.context.lineTo(pos[0], pos[1] + cornerRadius);
        this.context.arc(pos[0] + cornerRadius, pos[1] + cornerRadius, cornerRadius, Math.PI * 1.0, Math.PI * 1.5, false);
        this.context.closePath();
        this.context.fill();
        if (stroke) {
            this.context.lineWidth = strokeWidth;
            this.context.strokeStyle = stroke;
            this.context.stroke();
        }
    }
    draw_box_gradient_h(pos, size, colours) {
        const gradient = this.context.createLinearGradient(pos[0], pos[1], pos[0] + size[0], pos[1]);
        for (const [i, colour] of colours.entries()){
            gradient.addColorStop(i / (colours.length - 1), colour);
        }
        this.context.fillStyle = gradient;
        this.context.fillRect(pos[0], pos[1], size[0], size[1]);
    }
    draw_box_gradient_v(pos, size, colours) {
        const gradient = this.context.createLinearGradient(pos[0], pos[1], pos[0], pos[1] + size[1]);
        for (const [i, colour] of colours.entries()){
            gradient.addColorStop(i / (colours.length - 1), colour);
        }
        this.context.fillStyle = gradient;
        this.context.fillRect(pos[0], pos[1], size[0], size[1]);
    }
}
window.addEventListener('contextmenu', function(event) {
    event.preventDefault();
});
const render = new Render(document.getElementsByTagName('canvas')[0]);
const game = new Game(render);
window.addEventListener('mousedown', function(event) {
    game.on_button_down(`Mouse${event.button}`);
});
window.addEventListener('keydown', function(event) {
    event.preventDefault();
    game.on_button_down(event.code);
});
window.addEventListener('keyup', function(event) {
    event.preventDefault();
    game.on_button_up(event.code);
});
let lastTime = Date.now();
(function draw() {
    const now = Date.now();
    const delta = (now - lastTime) / 1000;
    render.set_resolution(window.innerWidth, window.innerHeight, 1);
    game.update(delta);
    game.draw();
    lastTime = now;
    window.requestAnimationFrame(draw);
})();
