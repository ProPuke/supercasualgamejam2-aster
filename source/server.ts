import { assert } from "https://deno.land/std@0.149.0/testing/asserts.ts";
import { serve } from "https://deno.land/std@0.149.0/http/mod.ts";
import EventEmitter from "https://deno.land/x/eventemitter@1.2.1/mod.ts";
import * as connection from "./connection.ts";
import Game, { Player, PlayMode } from "./Game.ts";
import { concat_arrayBuffers, uint8_to_string } from "./common.ts";

enum ClientSessionStage {
	handshake,
	playing
}

class ClientSession {
	websocket:WebSocket;
	events = new EventEmitter<{
	}>;
	stage = ClientSessionStage.handshake;
	player:Player|undefined;
	playerName = '';

	constructor(websocket:WebSocket) {
		this.websocket = websocket;
		this.websocket.binaryType = 'arraybuffer';
	}

	onClientConnect() {
		console.log(`+ ${this.playerName||'[unnamed]'}`);
	}

	onClientDisconnect() {
		if(this.player){
			const play = get_play();
			const index = play.players.indexOf(this.player);
			if(index>=0){
				play.players.splice(index, 1);
			}
		}
		console.log(`- ${this.playerName||'[unnamed]'}`);
	}

	async onClientMessage(data:ArrayBuffer) {
		switch(this.stage){
			case ClientSessionStage.handshake:
				[data, this.playerName] = uint8_to_string(data);
				if(this.playerName.length<1){
					console.error(`Error: missing client name. Killed.`);
					this.disconnect();
				}
				console.log(`++ ${this.playerName}`);
				this.stage = ClientSessionStage.playing;
			break;
			case ClientSessionStage.playing:
				if(!this.player) break;

				this.player.deserialise_input(data);
			break;
		}
	}

	onError(error:ErrorEvent|Event) {
		// console.error('error', error);
	}

	disconnect() {
		const index = sessions.indexOf(this);
		if(index>=0){
			sessions.splice(index, 1);
		}

		try{
			this.websocket.close();
		}catch(error){
			console.error(`Error closing socket: ${error}`);
		}
	}

	send_state() {
		const play = get_play();

		try{
			this.websocket.send(concat_arrayBuffers(play.serialise(this.player)));
		}catch(error){
			console.error(`Error sending to socket for ${this.playerName||'[unnamed]'}`);
			this.disconnect();
		}
	}
}

const game = new Game(undefined, false);
const maxPlayers = 4;

function get_play():PlayMode {
	assert(game.modes.length>0);
	const lastMode = game.modes[game.modes.length-1];
	assert(lastMode instanceof PlayMode);
	return lastMode as PlayMode;
}

let sessions:ClientSession[] = [];

{
	let lastTime = Date.now();

	setInterval(function() {
		let time = Date.now();
		const delta = (time-lastTime)/1000;
		game.update(delta);
		lastTime = time;
	}, 1000/20);
}

setInterval(function() {
	const play = get_play();

	if(play.activePlayers.length<maxPlayers){
		for(const session of sessions){
			if(session.stage==ClientSessionStage.playing&&!session.player){
				console.log(`Adding player to match ${session.playerName}`)
				session.player = play.add_player(session.playerName);
				break;
			}
		}
	}else{
		console.log(`${play.activePlayers.length}/${maxPlayers}`);
	}

	for(const session of sessions){
		session.send_state();
	}
}, 1000/20);

console.log(`Listening on port ${connection.port}...`);
await serve(async function(request:Request) {
	if(request.headers.get('upgrade')!='websocket') {
		return new Response(null, {status:501});
	}

	const { socket:websocket, response } = Deno.upgradeWebSocket(request);

	const session = new ClientSession(websocket);

	websocket.onopen = () => session.onClientConnect();
	websocket.onmessage = (message) => session.onClientMessage(message.data);
	websocket.onclose = () => {
		session.onClientDisconnect();
		const index = sessions.indexOf(session);
		if(index>=0){
			sessions.splice(index, 1);
		}
	}
	websocket.onerror = (error) => session.onError(error);

	sessions.push(session);

	return response;

}, { port: connection.port });
