import Client from "./Client.ts";
import { add, clamp, concat_arrayBuffers, deltaLerp, dir, distance, dot, easeOutBounce, easeOutElastic, easeOutQuad, length, lerp, rescale, roughly, scale, string_to_uint8, sub, tau, toward, uint8_to_string, Vec2, vector } from "./common.ts";
import Render from "./Render.ts";
import * as connection from "./connection.ts";
import { ReadBuffer, WriteBuffer } from "./Buffer.ts";
import PacketType from "./PacketType.ts";

class Mode {
	startTime = Date.now();
	
	on_button_down(button:string) { return false; }
	on_button_up(button:string) { return false; }

	update(delta:number) {

	}

	draw(r:Render) {

	}
}

class Unit {
	visualOffset:Vec2 = [0,0];
	health = 10;
	knockback:Vec2 = [0,0];
	lastDamageTime = 0;

	constructor(public pos:Vec2) {
	}

	get visualPos() {
		return add(this.pos, this.visualOffset);
	}

	take_damage(from:Vec2, player:Player|null):boolean {
		if(this.health<1) return false;

		this.lastDamageTime = Date.now();

		this.knockback = add(this.knockback, rescale(vector(from, this.pos), 60));

		this.health -= 1;

		return true;
	}

	update(play:PlayMode, delta:number) {
		if(this.knockback[0]||this.knockback[1]){
			const motion = toward([0,0], this.knockback, delta*200, true);
			this.knockback[0] -= motion[0];
			this.knockback[1] -= motion[1];
			this.pos[0] += motion[0];
			this.pos[1] += motion[1];
		}
	}

	serialise(buffer:WriteBuffer) {
		buffer.write_float32(this.pos[0], this.pos[1], this.knockback[0], this.knockback[1]);
		buffer.write_uint8(this.health);
	}

	static deserialise_data(buffer:ReadBuffer):[number, Vec2, Vec2] {
		const [posX, posY, knockbackX, knockbackY] = buffer.read_float32(4);
		const [health] = buffer.read_uint8(1);

		return [health, [posX, posY], [knockbackX, knockbackY]];
	}
}

export class Player extends Unit {
	id = 0|(Math.random()*655536);
	velocity:Vec2 = [0,0];
	targetDir:number;
	angle:number;
	angleOffset = 0;
	speed = 700.0;
	lastExhaustTime = 0;
	lastFireTime = 0;
	score = 0;

	static readonly invulnerabilityDuration = 0.8;

	isAccelerating = false;
	isFiring = false;
	isUp = false;
	isDown = false;
	isLeft = false;
	isRight = false;
	
	constructor(public name:string, pos:Vec2, angle:number = Math.PI/2) {
		super(pos);
		this.targetDir = angle;
		this.angle = angle;
	}

	get visualAngle() {
		return this.angle+this.angleOffset;
	}

	take_damage(from:Vec2, player:Player|null) {
		if(Date.now()-this.lastDamageTime<Player.invulnerabilityDuration*1000) return false;

		const result = super.take_damage(from, player);

		if(this.health<1){
			this.clear_input();
		}

		return result;
	}

	add_score(amount:number) {
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

	serialise(buffer:WriteBuffer) {
		super.serialise(buffer);
		buffer.write_string(this.name);
		buffer.write_float32(this.velocity[0], this.velocity[1], this.targetDir, this.angle);
		buffer.write_uint32(this.score);
		buffer.write_bool(this.isAccelerating, this.isFiring, this.isUp, this.isDown, this.isLeft, this.isRight);
	}

	deserialise(buffer:ReadBuffer, local = false) {
		if(local){
			let pos, knockback:Vec2;
			[this.health, pos, knockback] = Unit.deserialise_data(buffer);
		}else{
			const oldPos = this.visualPos;
			[this.health, this.pos, this.knockback] = Unit.deserialise_data(buffer);
			if(oldPos[0]||oldPos[1]){
				this.visualOffset = sub(oldPos, this.pos);
			}else{
				this.visualOffset = [0,0];
			}
		}

		this.name = buffer.read_string();
		if(local){
			buffer.read_float32(4);
		}else{
			const oldAngle = this.visualAngle;
			[this.velocity[0], this.velocity[1], this.targetDir, this.angle] = buffer.read_float32(4);
			if(oldAngle||this.angleOffset){
				this.angleOffset = oldAngle - this.angle;
			}else{
				this.angleOffset = 0;
			}
		}
		[this.score] = buffer.read_uint32(1);
		if(local){
			buffer.read_bool(6);
		}else{
			[this.isAccelerating, this.isFiring, this.isUp, this.isDown, this.isLeft, this.isRight] = buffer.read_bool(6);
		}
	}

	serialise_input(buffer:WriteBuffer) {
		buffer.write_float32(this.pos[0], this.pos[1], this.velocity[0], this.velocity[1], this.targetDir, this.angle);
		buffer.write_uint8(this.isAccelerating?1:0, this.isFiring?1:0, this.isUp?1:0, this.isDown?1:0, this.isLeft?1:0, this.isRight?1:0);
	}

	deserialise_input(buffer:ReadBuffer) {
		const [posX, posY, velocityX, velocityY, targetDir, angle] = buffer.read_float32(6);
		const [isAccelerating, isFiring, isUp, isDown, isLeft, isRight] = buffer.read_uint8(6);

		this.pos = [posX, posY];
		this.velocity = [velocityX, velocityY];
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
}

class Exhaust {
	velocity:Vec2 = [0,0];
	angle:number;
	phase = 0.0;
	speed = 200.0;
	
	constructor(public pos:Vec2, angle:number = Math.PI/2) {
		this.angle = angle;
	}
}

class Shot {
	velocity:Vec2 = [0,0];
	angle:number;
	age = 0.0;
	
	constructor(public owner:Player|null, public pos:Vec2, angle:number = Math.PI/2, public speed:number) {
		this.angle = angle;
	}

	serialise(buffer:WriteBuffer) {
		buffer.write_uint16(this.owner===null?0:this.owner.id+1);
		buffer.write_float32(this.pos[0], this.pos[1], this.speed, this.velocity[0], this.velocity[1], this.angle, this.age);
	}

	static deserialise(players:Player[], buffer:ReadBuffer):Shot {
		const [playerId] = buffer.read_uint16(1);
		const [posX, posY, speed, velocityX, velocityY, angle, age] = buffer.read_float32(7);

		let player:Player|null = null;
		if(playerId>0){
			for(const search of players){
				if(search.id==playerId-1){
					player = search;
					break;
				}
			}
		}

		const shot = new Shot(player, [posX, posY], angle, speed);
		shot.velocity = [velocityX, velocityY];
		shot.age = age;

		return shot;
	}
}

class Obstacle {
	lastHitTime = 0.0;

	constructor(public pos:Vec2, public radius:number) {
	}

	on_hit() {
		this.lastHitTime = Date.now();
	}

	serialise(buffer:WriteBuffer) {
		buffer.write_float32(this.pos[0], this.pos[1], this.radius);
	}

	static deserialise(buffer:ReadBuffer):Obstacle {
		const [posX, posY, radius] = buffer.read_float32(3);

		const obstacle = new Obstacle([posX, posY], radius);

		return obstacle;
	}
}

abstract class Enemy extends Unit {
	get radius() { return 20; }

	constructor(pos:Vec2) {
		super(pos);
		this.health = 5;
	}

	update(play:PlayMode, delta:number) {
		super.update(play, delta);
	}

	serialise(buffer:WriteBuffer) {
		super.serialise(buffer);
	}
}

class EnemySpinner extends Enemy {
	fireDelay = 0.5;
	ammo = 3;

	constructor(pos:Vec2) {
		super(pos);
		this.health = 5;
	}

	get radius() { return lerp(10, 30, this.health/5); }

	serialise(buffer:WriteBuffer) {
		super.serialise(buffer);
	}

	static deserialise(buffer:ReadBuffer):Enemy {
		const [health, pos, knockback] = Unit.deserialise_data(buffer);

		const enemy = new EnemySpinner(pos);
		enemy.health = health;
		enemy.knockback = knockback;

		return enemy;
	}

	update(play:PlayMode, delta:number) {
		super.update(play, delta);

		let closestPlayer:Player|undefined;
		let closestPlayerShot:Player|undefined;
		let closestDistance = 0.0;

		for(const player of play.players){
			if(player.health<1) continue;

			const dist = distance(player.pos, this.pos);
			if(dist<300&&(!closestPlayer||dist<closestDistance)){
				closestPlayer = player;
				closestDistance = dist;
			}
		}

		if(!closestPlayer){
			for(const shot of play.shots){
				if(!shot.owner) continue;

				const dist = distance(shot.pos, this.pos);
				if(dist<300&&(!closestPlayer||dist<closestDistance)){
					closestPlayer = shot.owner;
					closestDistance = dist;
				}
			}
		}

		if(closestPlayer){
			this.pos = add(this.pos, rescale(vector(this.pos, closestPlayer.pos), 80*delta));

			this.fireDelay -= delta;
			if(this.fireDelay<0&&this.ammo>0){
				const shots = 6;
				for(let x=(tau/shots)*((Date.now()/1000)%1.0);x<tau;x+=tau/shots){
					play.shots.push(new Shot(null, add(this.pos, dir(x, 35)), x, 150));
				}
				this.ammo--;

				if(this.ammo<1){
					this.ammo = 3;
					this.fireDelay = 1.5;
				}else{
					this.fireDelay = 0.4;
				}
			}
		}
	}
}

class ScoreMarker {
	timeCreated = Date.now();

	constructor(public pos:Vec2, public text:string) {

	}
}

class ConnectingMode extends Mode {
	isConnecting = true;

	constructor(public game:Game) {
		super();

		const client = new Client(connection.address, game.localPlayerName);

		const onConnected = () => {
			client.events.off('connected', onConnected);
			client.events.off('disconnected', onDisconnected);

			this.game.remove_mode(this);
			this.game.push_mode(new PlayMode(this.game, client, false));
		};

		const onDisconnected = () => {
			client.events.off('connected', onConnected);
			client.events.off('disconnected', onDisconnected);

			this.isConnecting = false;
			this.startTime = Date.now();

			setTimeout(() => {
				this.game.remove_mode(this);
				this.game.push_mode(new ConnectingMode(this.game));
			}, 4500);
		};

		client.events.once('connected', onConnected);
		client.events.once('disconnected', onDisconnected);
	}

	draw(r:Render) {
		const chars = (Date.now()-this.startTime)/1000/0.01;
		r.draw_text([0, r.size[1]*0.5-18], r.size[0], 0.5, '20px sans-serif', this.isConnecting?'Connecting...':'Unable to connect. Retrying...', '#fff', chars);
	}
}

export class PlayMode extends Mode {
	players:Player[] = [];
	exhausts:Exhaust[] = [];
	shots:Shot[] = [];
	obstacles:Obstacle[] = [];
	enemies:Enemy[] = [];
	scoreMarkers:ScoreMarker[] = [];
	localPlayer:Player|undefined;
	cameraPos:Vec2 = [0,0]
	worldSize:Vec2 = [3000,3000];
	idealEnemyCount:number;
	lastClientUpdateTime = 0;

	constructor(public game:Game, public client:Client|null, spawnPlayer:boolean) {
		super();

		this.idealEnemyCount = 5;

		this.cameraPos = scale(this.worldSize, 0.5);

		if(client){
			const onDisconnected = () => {
				client.events.off('disconnected', onDisconnected);
				client.events.off('message', onMessage);

				this.game.remove_mode(this);
				if(connection.enabled){
					this.game.push_mode(new ConnectingMode(this.game));
				}else{
					this.game.push_mode(new PlayMode(this.game, null, true));
				}
			}

			const onMessage = (data:ArrayBuffer) => {
				const buffer = new ReadBuffer(data);
				const [packetTypeId] = buffer.read_uint8(1);
				const packetType:PacketType = packetTypeId;
				switch(packetType){
					case PacketType.fullUpdate:
						this.deserialise(buffer, true);
					break;
					case PacketType.partialUpdate:
						this.deserialise(buffer, false);
					break;
				}
			};

			client.events.once('disconnected', onDisconnected);
			client.events.on('message', onMessage);

			return;
		}

		for(let i=0;i<this.worldSize[0]*this.worldSize[1]/50000;i++){
			do{
				const pos:Vec2 = [Math.random()*this.worldSize[0], Math.random()*this.worldSize[1]];
				const radius = 50;
				
				if(!this.pos_is_available(pos, radius/2)) continue; //allow some overlap here

				this.obstacles.push(new Obstacle(pos, radius));
			}while(false);
		}

		for(let i=0;i<this.idealEnemyCount;i++){
			do{
				const pos:Vec2 = [Math.random()*this.worldSize[0], Math.random()*this.worldSize[1]];
				const radius = 20;
				
				if(!this.pos_is_available(pos, radius, false)) continue;

				this.enemies.push(new EnemySpinner(pos));
			}while(false);
		}

		if(spawnPlayer){
			this.localPlayer = this.add_player(this.game.localPlayerName);
			this.cameraPos = this.localPlayer.pos;
		}
	}

	add_player(name:string):Player {
		let newPlayerPos:Vec2 = [0,0];
		for(let i=0;i<50;i++){
			newPlayerPos = [Math.random()*this.worldSize[0], Math.random()*this.worldSize[1]];
			const radius = 20;
			
			if(this.pos_is_available(newPlayerPos, radius, false)) break;
		}

		for(const [i, enemy] of this.enemies.entries()){
			if(distance(newPlayerPos, enemy.pos)<enemy.radius+20+250){
				this.enemies.splice(i,1);
			}
		}

		const player = new Player(name, newPlayerPos, Math.PI*-0.25);
		this.players.push(player);

		return player;
	}

	remove_player(player:Player) {
		const index = this.players.indexOf(player);
		if(index>=0){
			this.players.splice(index, 1);
		}

		if(!this.client){
			if(this.players.length<1){
				this.idealEnemyCount = Math.max(3, Math.round(this.idealEnemyCount/2));
				for(const enemy of this.enemies){
					enemy.health = Math.max(0, enemy.health-Math.round(Math.random()*2));
				}
				this.game.remove_mode(this);
				this.game.push_mode(new PlayMode(this.game, null, false));
			}
		}
	}

	get activePlayers():Player[] {
		return this.players.filter(x => x.health>0);
	}

	serialise(player:Player|undefined, buffer:WriteBuffer, full:boolean) {
		buffer.write_float64(Date.now());
		buffer.write_uint16(player?player.id+1:0, this.worldSize[0], this.worldSize[1], this.players.length);
		for(const player of this.players){
			buffer.write_uint16(player.id);
			player.serialise(buffer);
		}
		buffer.write_uint16(this.shots.length);
		for(const shot of this.shots){
			shot.serialise(buffer);
		}
		if(full){
			buffer.write_uint16(this.obstacles.length);
			for(const obstacle of this.obstacles){
				obstacle.serialise(buffer);
			}
		}
		buffer.write_uint16(this.enemies.length);
		for(const enemy of this.enemies){
			enemy.serialise(buffer);
		}
	}

	deserialise(buffer:ReadBuffer, full:boolean) {
		const [time] = buffer.read_float64(1);

		const timeOffset = time-Date.now();

		const [playerId, sizeX, sizeY, playerCount] = buffer.read_uint16(4);

		const oldPlayers = this.players.slice();
		const oldLocalPlayer = this.localPlayer;
		
		this.worldSize = [sizeX, sizeY];
		this.players.length = 0;
		this.localPlayer = undefined;
		for(let i=0;i<playerCount;i++){
			const [id] = buffer.read_uint16(1);
			const player = oldPlayers.find(x => x.id==id)||new Player('unnamed', [0,0], 0);
			player.id = id;
			player.deserialise(buffer, player==oldLocalPlayer);
			this.players.push(player);

			if(playerId>0&&player.id==playerId-1){
				this.localPlayer = player;
			}
		}

		const [shotCount] = buffer.read_uint16(1);
		this.shots.length = 0;
		for(let i=0;i<shotCount;i++){
			const shot = Shot.deserialise(this.players, buffer);
			this.shots.push(shot);
		}

		if(full){
			const [obstacleCount] = buffer.read_uint16(1);
			this.obstacles.length = 0;
			for(let i=0;i<obstacleCount;i++){
				const obstacle = Obstacle.deserialise(buffer);
				this.obstacles.push(obstacle);
			}
		}

		const [enemyCount] = buffer.read_uint16(1);
		this.enemies.length = 0;
		for(let i=0;i<enemyCount;i++){
			const enemy = EnemySpinner.deserialise(buffer);
			this.enemies.push(enemy);
		}
	}

	send_client_update() {
		if(!this.client||!this.localPlayer) return;

		this.lastClientUpdateTime = Date.now();
		const buffer = new WriteBuffer;
		this.localPlayer.serialise_input(buffer);
		this.client.send(buffer.get_buffer());
	}

	pos_is_available(pos:Vec2, radius:number, checkEnemies = true) {
		if(pos[0]<0+radius) return false;
		if(pos[1]<0+radius) return false;
		if(pos[0]>=this.worldSize[0]-radius) return false;
		if(pos[1]>=this.worldSize[1]-radius) return false;

		for(const obstacle of this.obstacles){
			if(length(vector(pos, obstacle.pos))<obstacle.radius+radius){
				return false;
			}
		}

		if(checkEnemies){
			for(const enemy of this.enemies){
				if(length(vector(pos, enemy.pos))<enemy.radius+radius){
					return false;
				}
			}
		}

		return true;
	}

	add_scoreMarker(pos:Vec2, text:string) {
		if(!this.game.render) return;

		this.scoreMarkers.push(new ScoreMarker(pos, text));
	}

	camera_to_world(pos:Vec2) {
		if(!this.game.render) return pos;
		return add(add(this.cameraPos, scale(this.game.render.size, -0.5)), pos);
	}

	on_button_down(button:string) {
		if(this.localPlayer){
			let inputChanged = false;

			if(this.localPlayer.health>0){
				switch(button) {
					case 'ArrowUp':
						inputChanged = true;
						this.localPlayer.isUp = true;
						if(!this.localPlayer.isFiring){
							this.localPlayer.targetDir = Math.PI*+0.5;
							this.localPlayer.isAccelerating = true;
						}
					break;
					case 'ArrowDown':
						inputChanged = true;
						this.localPlayer.isDown = true;
						if(!this.localPlayer.isFiring){
							this.localPlayer.targetDir = Math.PI*-0.5;
							this.localPlayer.isAccelerating = true;
						}
					break;
					case 'ArrowLeft':
						inputChanged = true;
						this.localPlayer.isLeft = true;
						if(!this.localPlayer.isFiring){
							this.localPlayer.targetDir = Math.PI*+1.0;
							this.localPlayer.isAccelerating = true;
						}
					break;
					case 'ArrowRight':
						inputChanged = true;
						this.localPlayer.isRight = true;
						if(!this.localPlayer.isFiring){
							this.localPlayer.targetDir = Math.PI*+0.0;
							this.localPlayer.isAccelerating = true;
						}
					break;
					case 'ControlLeft':
					case 'ControlRight':
						inputChanged = true;
						this.localPlayer.isFiring = true;
					break;
				}

			}else{
				switch(button) {
					case 'KeyR':
						if(this.localPlayer&&this.localPlayer.health<1){
							this.game.remove_mode(this);
							if(connection.enabled){
								if(this.client){
									this.client.disconnect();
								}
								this.game.push_mode(new ConnectingMode(this.game));
							}else{
								this.game.push_mode(new PlayMode(this.game, this.client, !this.client));
							}
						}
					break;
				}
			}

			if(inputChanged){
				this.send_client_update();
			}
		}

		return true;
	}

	on_button_up(button:string) {
		if(!this.localPlayer) return true;

		let inputChanged = false;

		switch(button) {
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

		if(!this.localPlayer.isUp&&!this.localPlayer.isDown&&!this.localPlayer.isLeft&&!this.localPlayer.isRight){
			this.localPlayer.isAccelerating = false;
		}

		if(inputChanged){
			this.send_client_update();
		}

		return true;
	}

	update(delta:number) {
		const now = Date.now();

		if(!this.client){
			if(this.enemies.length<this.idealEnemyCount){
				const positions:[number, Vec2][] = [];

				for(let i=0;i<5;i++){
					const pos:Vec2 = [Math.random()*this.worldSize[0], Math.random()*this.worldSize[1]];

					let playerDistance = 0;
					for(const player of this.players){
						const dist = distance(pos, player.pos);
						if(!playerDistance||dist<playerDistance){
							playerDistance = dist;
						}
					}

					positions.push([playerDistance, pos]);
				}

				positions.sort((a,b) => b[0]-a[0]);

				this.enemies.push(new EnemySpinner(positions[0][1]));
			}
		}

		for(const player of this.players){
			player.visualOffset[0] = deltaLerp(player.visualOffset[0], 0, 0.95, delta);
			player.visualOffset[1] = deltaLerp(player.visualOffset[1], 0, 0.95, delta);
			player.angleOffset = deltaLerp(player.angleOffset, 0, 0.95, delta);

			if(player.health>0){
				player.update(this, delta);

				if(!player.isFiring) {
					let targetDirInvalid = false;

					if(roughly(player.targetDir, Math.PI*+0.5)&&!this.game.is_button_down('ArrowUp')){
						targetDirInvalid = true;
					}
			
					if(roughly(player.targetDir, Math.PI*-0.5)&&!this.game.is_button_down('ArrowDown')){
						targetDirInvalid = true;
					}
			
					if(roughly(player.targetDir, Math.PI*+1.0)&&!this.game.is_button_down('ArrowLeft')){
						targetDirInvalid = true;
					}
			
					if(roughly(player.targetDir, Math.PI*+0.0)&&!this.game.is_button_down('ArrowRight')){
						targetDirInvalid = true;
					}
			
					if(targetDirInvalid){
						if(player.isLeft!=player.isRight){
							player.targetDir = player.isLeft?Math.PI:0.0;
			
						}else if(player.isUp!=player.isDown){
							player.targetDir = player.isUp?Math.PI*+0.5:Math.PI*-0.5;
						}
					}
				}

				while(player.targetDir-player.angle>+Math.PI){
					player.angle += Math.PI*2;
				}
		
				while(player.targetDir-player.angle<-Math.PI){
					player.angle -= Math.PI*2;
				}

				player.angle = deltaLerp(player.angle, player.targetDir, 0.99999, delta);

				let targetVelocity = player.isAccelerating?[+Math.cos(player.angle)*player.speed, -Math.sin(player.angle)*player.speed]:[0,0];

				if(player.isFiring){
					targetVelocity[0] = (player.isLeft?-1:0) + (player.isRight?+1:0);
					targetVelocity[1] = (player.isUp?-1:0) + (player.isDown?+1:0);

					let length = Math.sqrt(targetVelocity[0]*targetVelocity[0]+targetVelocity[1]*targetVelocity[1]);
					if(length>1){
						targetVelocity[0] /= length;
						targetVelocity[1] /= length;
					}

					targetVelocity[0] *= player.speed*0.5;
					targetVelocity[1] *= player.speed*0.5;
				}

				player.velocity[0] = deltaLerp(player.velocity[0], targetVelocity[0], lerp(player.isFiring?0.85:0.5, 1.0, Math.sign(player.velocity[0])!=Math.sign(targetVelocity[0])?0.85:0.0), delta);
				player.velocity[1] = deltaLerp(player.velocity[1], targetVelocity[1], lerp(player.isFiring?0.85:0.5, 1.0, Math.sign(player.velocity[1])!=Math.sign(targetVelocity[1])?0.85:0.0), delta);

				if(player.isAccelerating){
					if(now-player.lastExhaustTime>200){
						this.exhausts.push(new Exhaust([player.pos[0], player.pos[1]], player.angle));
						player.lastExhaustTime = now;
					}
				}

			}else{
				player.velocity[0] = deltaLerp(player.velocity[0], 0, 0.7, delta);
				player.velocity[1] = deltaLerp(player.velocity[1], 0, 0.7, delta);
			}

			player.pos[0] += player.velocity[0]*delta;
			player.pos[1] += player.velocity[1]*delta;

			for(const obstacle of this.obstacles){
				if(distance(player.pos, obstacle.pos)<obstacle.radius+10){
					const vec = vector(obstacle.pos, player.pos);
					const dir = dot(rescale(vec, 1.0), rescale(player.velocity, 1.0));
					player.pos = add(obstacle.pos, rescale(vec, obstacle.radius+10.01));
					if(dir<0){
						// player.velocity = scale(player.velocity, 1.0+dir);
						player.velocity = add(player.velocity, rescale(vec, length(player.velocity)));
					}
				}
			}

			if(player.pos[0]<10){
				player.pos[0] = 10;
				if(player.velocity[0]<0){
					player.velocity[0] = player.velocity[0]*-0.3;
				}
			}

			if(player.pos[1]<10){
				player.pos[1] = 10;
				if(player.velocity[1]<0){
					player.velocity[1] = player.velocity[1]*-0.3;
				}
			}

			if(player.pos[0]>this.worldSize[0]-10){
				player.pos[0] = this.worldSize[0]-10;
				if(player.velocity[0]>1){
					player.velocity[0] = player.velocity[0]*-0.3;
				}
			}

			if(player.pos[1]>this.worldSize[1]-10){
				player.pos[1] = this.worldSize[1]-10;
				if(player.velocity[1]>1){
					player.velocity[1] = player.velocity[1]*-0.3;
				}
			}

			if(player.isFiring&&now-player.lastFireTime>300){
				player.lastFireTime = now;
				this.shots.push(new Shot(player, add([player.pos[0], player.pos[1]], dir(player.angle, 15)), player.angle, 900));
			}
		}

		for(const [i, exhaust] of this.exhausts.entries()){
			exhaust.pos[0] += +Math.cos(exhaust.angle)*-exhaust.speed*delta;
			exhaust.pos[1] += -Math.sin(exhaust.angle)*-exhaust.speed*delta;
			exhaust.phase += 2.0*delta;
			if(exhaust.phase>1.0){
				this.exhausts.splice(i,1);
			}
		}

		for(const [i, enemy] of this.enemies.entries()){
			enemy.update(this, delta);

			enemy.pos[0] = clamp(enemy.pos[0], enemy.radius, this.worldSize[0]-enemy.radius);
			enemy.pos[1] = clamp(enemy.pos[1], enemy.radius, this.worldSize[1]-enemy.radius);

			for(const obstacle of this.obstacles){
				const vec = vector(obstacle.pos, enemy.pos);
				if(length(vec)<obstacle.radius){
					enemy.pos = add(obstacle.pos, rescale(vec, obstacle.radius));
				}
			}

			for(const player of this.players){
				const vec = vector(enemy.pos, player.pos);
				if(length(vec)<enemy.radius+5){
					player.take_damage(enemy.pos, null);
					player.pos = toward(enemy.pos, player.pos, enemy.radius+5, false);
				}
			}
		}

		for(const [i, shot] of this.shots.entries()){
			shot.pos[0] += +Math.cos(shot.angle)*shot.speed*delta;
			shot.pos[1] += -Math.sin(shot.angle)*shot.speed*delta;
			shot.age += delta;

			let destroyed = false;

			if(!destroyed){
				if(shot.pos[0]<10||shot.pos[1]<10||shot.pos[0]>=this.worldSize[0]-10||shot.pos[1]>=this.worldSize[1]-10){
					this.shots.splice(i, 1);
					destroyed = true;
				}
			}

			if(!destroyed){
				for(const obstacle of this.obstacles){
					if(distance(shot.pos, obstacle.pos)<obstacle.radius+10){
						obstacle.on_hit();
						this.shots.splice(i, 1);
						destroyed = true;
						break;
					}
				}
			}

			if(destroyed){
				continue;
			}

			if(shot.owner&&shot.age>1.5){
				this.shots.splice(i, 1);
				continue;
			}

			// for(const [i2, otherShot] of this.shots.entries()){
			// 	if(otherShot==shot) continue;
			// 	if(distance(shot.pos, otherShot.pos)<20){
			// 		this.shots.splice(Math.max(i,i2), 1);
			// 		this.shots.splice(Math.min(i,i2), 1);
			// 		destroyed = true;
			// 		break;
			// 	}
			// }

			if(destroyed) continue;

			if(shot.owner){
				for(const [i2, enemy] of this.enemies.entries()){
					if(distance(shot.pos, enemy.pos)<enemy.radius+8){
						if(enemy.take_damage(shot.pos, shot.owner)){
							if(enemy.health<1){
								shot.owner.add_score(25);
								this.add_scoreMarker(add(enemy.pos, [0, enemy.radius]), `+25`);
	
							}else{
								shot.owner.add_score(5);
								this.add_scoreMarker(add(enemy.pos, [0, enemy.radius]), `+5`);
							}
						}
						if(enemy.health<1){
							this.enemies.splice(i2, 1);
							this.idealEnemyCount = Math.min(this.worldSize[0]*this.worldSize[1]/70000, this.idealEnemyCount+1+Math.floor(this.idealEnemyCount/4));
						}
						this.shots.splice(i, 1);
						destroyed = true;
						break;
					}
				}

				if(destroyed) continue;

				for(const player of this.players){
					if(shot.owner==player||player.health<1) continue;

					if(distance(shot.pos, player.pos)<20+8){
						if(player.take_damage(shot.pos, shot.owner)){
							shot.owner.add_score(1);
							this.add_scoreMarker(add(player.pos, [0, 20]), `+1`);
						}

						this.shots.splice(i, 1);
						destroyed = true;
						break;
					}
				}

			}else{
				for(const player of this.players){
					if(player.health<1) continue;

					if(distance(shot.pos, player.pos)<20+8){
						player.take_damage(shot.pos, shot.owner);
						this.shots.splice(i, 1);
						destroyed = true;
						break;
					}
				}
			}
		}

		for(const [i, marker] of this.scoreMarkers.entries()){
			if(now-marker.timeCreated>1000){
				this.scoreMarkers.splice(i,1);
			}
		}

		if(this.localPlayer){
			const vec = vector(this.localPlayer.pos, this.cameraPos);
			if(length(vec)>100){
				this.cameraPos = add(this.localPlayer.pos, rescale(vec, 100));
			}
		}

		if(Date.now()-this.lastClientUpdateTime>300){
			this.send_client_update();
		}
	}

	draw(r:Render) {
		function draw_ship(pos:Vec2, angle:number, firing:boolean, lastDamageTime:number = 0) {
			const forward:Vec2 = [Math.cos(angle), -Math.sin(angle)];
			const right:Vec2 = [-forward[1], forward[0]];

			const shape:Vec2[] = [[forward[0]*-10, forward[1]*-10], [forward[0]*-20+right[0]*-20, forward[1]*-20+right[1]*-20], [forward[0]*25, forward[1]*25], [forward[0]*-20+right[0]*+20, forward[1]*-20+right[1]*+20]];
	
			r.draw_poly(pos, shape, true, '#fff', 4, firing?'#400':'#000');

			if(firing){
				r.draw_poly(pos, [[forward[0]*8+right[0]*-7, forward[1]*8+right[1]*-7], [forward[0]*25, forward[1]*25], [forward[0]*8+right[0]*+7, forward[1]*8+right[1]*+7]], false, false, 5, '#f00');
			}

			const damagePhase = clamp(1.0-(Date.now()-lastDamageTime)/300);

			if(damagePhase>0.0){
				r.alpha(damagePhase);
				r.draw_poly(pos, shape, true, '#f00', 8, '#f00');
				r.alpha(1.0);
			}
		}

		function draw_exhaust(pos:Vec2, angle:number, phase:number) {
			let forward:Vec2 = [Math.cos(angle), -Math.sin(angle)];
			let right:Vec2 = [-forward[1], forward[0]];

			r.alpha(1.0-phase);
			r.begin_transform_scale(pos, lerp(1.0, 2.0, phase));
			r.draw_poly(pos, [[forward[0]*-20+right[0]*-20, forward[1]*-20+right[1]*-20], [forward[0]*-10, forward[1]*-10], [forward[0]*-20+right[0]*+20, forward[1]*-20+right[1]*+20]], false, false, 4, '#444');
			r.end_transform();
			r.alpha(1.0);
		}

		function draw_shot(pos:Vec2, owned:boolean, angle:number, phase:number) {
			let forward:Vec2 = [Math.cos(angle), -Math.sin(angle)];
			let right:Vec2 = [-forward[1], forward[0]];

			let colour = owned?'#f00':'#f86';

			r.draw_poly(pos, [[forward[0]*-7+right[0]*-10, forward[1]*-7+right[1]*-10], [forward[0]*10, forward[1]*10], [forward[0]*-7+right[0]*+10, forward[1]*-7+right[1]*+10]], false, false, 7, '#000');
			r.draw_poly(pos, [[forward[0]*-7+right[0]*-10, forward[1]*-7+right[1]*-10], [forward[0]*10, forward[1]*10], [forward[0]*-7+right[0]*+10, forward[1]*-7+right[1]*+10]], false, false, 4, colour);
		}

		function draw_obstacle(pos:Vec2, radius:number) {
			r.draw_circle(pos, radius, '#fff', 4, '#000');
		}

		function draw_enemy(pos:Vec2, radius:number, lastDamageTime:number = 0) {
			const points:Vec2[] = [];
			for(let x=0;x<tau;x+=tau/6){
				points.push(dir(x, radius*(1.0+Math.cos(x+Date.now()/200)*0.3)));
			}

			const damagePhase = clamp(1.0-(Date.now()-lastDamageTime)/300);

			r.draw_poly(pos, points, true, '#f86', 4, '#000');

			if(damagePhase>0.0){
				r.alpha(damagePhase);
				r.draw_poly(pos, points, true, '#fff');
				r.alpha(1.0);
			}
		}

		const now = Date.now();

		const startPhase = clamp((Date.now()-this.startTime)/600);

		r.begin_transform_scale(scale(r.size, 0.5), lerp(20, 1, easeOutQuad(easeOutQuad(startPhase))));

			r.begin_transform_translate(add(scale(this.cameraPos, -1), scale(r.size, 0.5)));

				r.draw_box([0,0], this.worldSize, false, 5, '#222');

				for(const exhaust of this.exhausts){
					draw_exhaust(exhaust.pos, exhaust.angle, exhaust.phase);
				}
				for(const player of this.players){
					const invulnerableTime = now - player.lastDamageTime;
					if(invulnerableTime<Player.invulnerabilityDuration*1000&&(0|(invulnerableTime/100))%2==0){
						//invisible flash
					}else{
						if(player.health<1){
							r.alpha(0.5);
						}
						draw_ship(player.visualPos, player.visualAngle, player.isFiring, player.lastDamageTime);
						r.alpha(1.0);
					}
				}
				for(const enemy of this.enemies){
					draw_enemy(enemy.pos, enemy.radius, enemy.lastDamageTime);
				}
				for(const shot of this.shots){
					draw_shot(shot.pos, shot.owner==this.localPlayer, shot.angle, shot.age);
				}
				for(const obstacle of this.obstacles){
					const collideTime = (Date.now()-obstacle.lastHitTime)/1000.0;
					const phase = clamp(collideTime/0.5);
					draw_obstacle(obstacle.pos, obstacle.radius+lerp(-5, 0, easeOutElastic(phase)));
				}
				for(const player of this.players){
					const playerPos = player.visualPos;
					r.draw_text([playerPos[0]-50, playerPos[1]-60], 100, 0.5, 'bold 20px sans-serif', player.name, player.health>0?'#000':'#0008');

					const invulnerableTime = now - player.lastDamageTime;
					if(player.health>0&&player.health<10){
						if(invulnerableTime<Player.invulnerabilityDuration*1000&&(0|(invulnerableTime/100))%2==0){
							//invisible flash
						}else{
							for(let i=0;i<10;i++){
								r.draw_box_gradient_v([playerPos[0]-64+i*13, playerPos[1]-50], [10,16], i<player.health?['#0f0', '#0a0']:['#800', '#600']);
								r.draw_box([playerPos[0]-64+i*13, playerPos[1]-50], [10,16], false, 1, '#000');
							}
						}
					}
				}
				for(const marker of this.scoreMarkers){
					const phase = clamp((now-marker.timeCreated)/1000);
					r.alpha(1.0-phase*phase*phase);
					r.begin_transform_scale(marker.pos, lerp(1.0, 2.5, Math.pow(phase, 0.5)));
					r.draw_text(add(marker.pos, [-200, phase*-50]), 400, 0.5, 'bold 20px sans-serif', marker.text, '#fd3');
					r.end_transform();
					r.alpha(1.0);
				}

			r.end_transform();

			if(this.players.length>1) {
				const padding = 10;
				const margin = 30;
				const width = 300;
				const pos:Vec2 = [r.size[0]-margin-width-padding*2, margin];

				const scoreboardPlayers = this.players.slice();
				scoreboardPlayers.sort((a, b) => b.score-a.score);

				const lineHeight = 26;

				r.draw_box(pos, [width+padding*2, padding+scoreboardPlayers.length*lineHeight+padding], '#fffa', 3, '#444');

				for(const [row, player] of scoreboardPlayers.entries()){
					r.draw_text([pos[0]+padding, pos[1]+padding+lineHeight*(row+1)-lineHeight*0.3], width*0.7, 0.0, '20px sans-serif', `${row+1}. ${player.name}`, '#000');
					r.draw_text([pos[0]+padding, pos[1]+padding+lineHeight*(row+1)-lineHeight*0.3], width, 1.0, 'bold 20px sans-serif', player.score.toFixed(0), '#000');
				}
			}

			if(this.localPlayer) {
				const padding = 10;
				const margin = 30;
				const font = 'bold 60px sans-serif';
				const width = r.get_text_width(font, this.localPlayer.score.toFixed(0));
				const height = 50;
				const pos:Vec2 = [margin, margin];

				r.draw_box(pos, [width+padding*2, height+padding*2], '#fffa', 3, '#444');

				r.draw_text([pos[0]+padding, pos[1]+padding+45], width, 0.0, font, this.localPlayer.score.toFixed(0), '#000');
			}

		r.end_transform();

		if(!this.localPlayer){
			r.draw_box([0,0], r.size, '#fff6');

			// r.draw_text([0, r.size[1]*0.6], r.size[0], 0.5, 'bold 100px sans-serif', 'Game Over', '#000', chars);
		}

		if(this.localPlayer&&this.localPlayer.health<1){
			const gameoverTime = (now-this.localPlayer.lastDamageTime)/1000.0;
			const gameoverPhase = clamp(gameoverTime/1.0);

			r.alpha(gameoverPhase);
				r.draw_box([0,0], r.size, '#fffa');
			r.alpha(1.0);

			let chars = gameoverTime/0.07;
			chars -= 10;
			r.draw_text([0, r.size[1]*0.6], r.size[0], 0.5, 'bold 100px sans-serif', 'Game Over', '#000', chars);
			chars -= 10;
			r.draw_text([0, r.size[1]*0.6+70], r.size[0], 0.5, 'bold 50px sans-serif', `You achieved ${this.localPlayer.score} points`, '#000', chars);
			chars -= 30;
			r.draw_text([0, r.size[1]*0.6+70+70], r.size[0], 0.5, 'bold 25px sans-serif', `Press R to respawn and try again`, '#000', chars);
		}

		if(startPhase<1){
			r.alpha(1.0-startPhase);
				r.draw_box([0,0], r.size, '#aaa');
			r.alpha(1.0);
		}
	}
}

enum StartModePhase {
	welcome,
	instructions,
	starting
};

class StartMode extends Mode {
	booped = false;
	phase = StartModePhase.welcome;
	phaseTime = 0;
	instructionTime = 0;

	introLines:string[] = [
		'Use arrow keys to move',
		'Hold Ctrl to fire',
		'Shoot the gelatinous hexagonal ameba for points',
		'(Beware, shooting nearby will anger them)',
		'',
		'Click again to start!'
	]

	constructor(public game:Game) {
		super();
	}

	on_button_down(button:string) {
		switch(this.phase){
			case StartModePhase.welcome:
				if(button=='Mouse0'){
					let name:string|null = null;
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
				if(button=='Mouse0'){
					this.phase = StartModePhase.starting;
					this.phaseTime = Date.now();
				}
			break;
		}

		return true;
	}

	update(delta:number) {
		if(this.phase==StartModePhase.starting&&Date.now()-this.phaseTime>1000){
			this.game.remove_mode(this);
			if(connection.enabled){
				this.game.push_mode(new ConnectingMode(this.game));
			}else{
				this.game.push_mode(new PlayMode(this.game, null, true));
			}
		}
	}

	draw(r:Render) {
		const now = Date.now();

		function draw_logo(y:number) {
			const time = Date.now()/1000;
			const colours:string[] = [
				'#d26d6d',
				'#d2a56d',
				'#d2cf6d',
				'#a0d26d',
				'#73d26d',
				'#6dd2ab',
				'#6da1d2',
				'#936dd2',
				'#d26db3',
			]
			for(let offset=6;offset>0;offset--){
				r.draw_text([0+offset*3, y+offset*3+Math.sin(time*6+offset)*4], r.size[0], 0.5, '200px sans-serif', 'Astro', colours[(offset+Math.floor(time/0.3))%colours.length]);
			}
			r.draw_text([0-1, y-1], r.size[0], 0.5, '200px sans-serif', 'Astro', '#ccc');
			r.draw_text([0, y], r.size[0], 0.5, '200px sans-serif', 'Astro', '#000');
		}

		switch(this.phase){
			case StartModePhase.welcome:
				draw_logo(r.size[1]/3+100);

				r.begin_transform_scale([r.size[0]/2, r.size[1]/2], 1+Math.sin(now/300)*0.2);
				r.draw_text([0, r.size[1]/2+10], r.size[0], 0.5, '30px sans-serif', 'Click screen to start', '#fff');
				r.end_transform();
			break;
			case StartModePhase.instructions:
			case StartModePhase.starting:
				const time = (now-this.phaseTime)/1000;

				const introTime = (now-this.instructionTime)/1000;
				let instructionChars = introTime/0.04;

				const nudgeUp = Math.pow(clamp(introTime/1), 0.4)*100;
	
				const startingPhase = this.phase==StartModePhase.starting?clamp(time/0.5):0.0;
	
				// r.begin_transform_scale([r.size[0]/2, r.size[1]/2], 1+Math.pow(phase,0.4)*2);
				r.alpha(1.0-startingPhase);

				draw_logo(r.size[1]/3+100-nudgeUp);

				let y = r.size[1]/2+10-nudgeUp;
				for(const [i,line] of this.introLines.entries()){
					r.draw_text([0, y], r.size[0], 0.5, '30px sans-serif', line, i==this.introLines.length-1?'#000':'#fff', instructionChars);
					y += 34;
					instructionChars -= line.length;
					instructionChars -= 20;
				}
	
				r.alpha(1.0);
				// r.end_transform();
			break;
		}
	}
}

export default class Game {
	localPlayerName = 'unnamed';
	render:Render|undefined;
	modes:Mode[] = [];

	buttonsDown = new Set<string>();

	constructor(render:Render|undefined, showMenu = true, spawnPlayer = true) {
		this.render = render;

		if(showMenu){
			this.push_mode(new StartMode(this));
		}else{
			this.push_mode(new PlayMode(this, null, spawnPlayer));
		}
	}

	push_mode(mode:Mode) {
		this.modes.push(mode);
	}

	remove_mode(mode:Mode) {
		const index = this.modes.indexOf(mode);
		if(index>=0){
			this.modes.splice(index, 1);
		}
	}

	on_button_down(button:string) {
		this.buttonsDown.add(button);
		for(let i=this.modes.length-1;i>=0;i--){
			if(this.modes[i].on_button_down(button)) break;
		}
	}

	on_button_up(button:string) {
		this.buttonsDown.delete(button);
		for(let i=this.modes.length-1;i>=0;i--){
			if(this.modes[i].on_button_up(button)) break;
		}
	}

	is_button_down(button:string) {
		return this.buttonsDown.has(button);
	}

	set_player_name(name:string) {
		this.localPlayerName = name;
	}

	update(delta:number) {
		for(const mode of this.modes){
			mode.update(delta);
		}
	}

	draw() {
		const r = this.render;
		if(!r) return;

		r.clear('#aaa');

		for(const mode of this.modes){
			mode.draw(r);
		}
	}
}
