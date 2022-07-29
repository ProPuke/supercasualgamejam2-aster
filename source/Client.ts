import EventEmitter from 'https://deno.land/x/eventemitter@1.2.1/mod.ts'
import { string_to_uint8 } from "./common.ts";

export default class Client {
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
			this.socket.send(string_to_uint8(playerName));
			this.events.emit('connected');
		};

		this.socket.onclose = () => {
			this.events.emit('disconnected');
		};

		this.socket.onmessage = (message) => {
			this.events.emit('message', message.data as ArrayBuffer);
		};
	}

	send(data:ArrayBuffer) {
		this.socket.send(data);
	}
}
