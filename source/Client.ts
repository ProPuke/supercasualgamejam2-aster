import EventEmitter from 'https://deno.land/x/eventemitter@1.2.1/mod.ts'
import { string_to_uint8 } from "./common.ts";

export default class Client {
	open = true;
	socket:WebSocket;
	events = new EventEmitter<{
		connected:()=>void,
		disconnected:()=>void,
		message:(data:ArrayBuffer)=>void
	}>;

	constructor(address:string, playerName:string) {
		this.socket = new WebSocket(address);
		this.socket.binaryType = 'arraybuffer';

		this.socket.onopen = () => {
			if(!this.open) return;
			this.socket.send(string_to_uint8(playerName));
			this.events.emit('connected');
		};

		this.socket.onclose = () => {
			if(!this.open) return;
			this.events.emit('disconnected');
		};

		this.socket.onmessage = (message) => {
			if(!this.open) return;
			this.events.emit('message', message.data as ArrayBuffer);
		};
	}

	send(data:ArrayBuffer) {
		this.socket.send(data);
	}

	disconnect() {
		if(!this.open) return;
		this.open = false;
		this.socket.close();
	}
}
