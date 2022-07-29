import { concat_arrayBuffers, string_to_uint8, uint8_to_string } from "./common.ts";

export class WriteBuffer {
	buffers:ArrayBuffer[] = [];

	write_string(value:string) {
		this.buffers.push(string_to_uint8(value));
	}

	write_bool(...values:boolean[]) {
		const data:number[] = [];
		for(const value of values){
			data.push(value?1:0);
		}
		this.write_uint8(...data);
	}

	write_uint8(...values:number[]) {
		this.buffers.push(new Uint8Array(values));
	}

	write_uint16(...values:number[]) {
		this.buffers.push(new Uint16Array(values));
	}

	write_uint32(...values:number[]) {
		this.buffers.push(new Uint32Array(values));
	}

	write_float32(...values:number[]) {
		this.buffers.push(new Float32Array(values));
	}

	write_float64(...values:number[]) {
		this.buffers.push(new Float64Array(values));
	}

	get_buffer() {
		return concat_arrayBuffers(this.buffers);
	}
}

export class ReadBuffer {
	x = 0;

	constructor(public buffer:ArrayBuffer) {

	}

	read_string() {
		let value:string;
		[this.buffer, value] = uint8_to_string(this.buffer.slice(this.x));
		this.x = 0;
		return value;
	}

	read_bool(count:number) {
		const values:boolean[] = [];
		for(const value of this.read_uint8(count)){
			values.push(!!value);
		}
		return values;
	}

	read_uint8(count:number) {
		return new Uint8Array(this.buffer.slice(this.x, this.x+=count*1));
	}

	read_uint16(count:number) {
		return new Uint16Array(this.buffer.slice(this.x, this.x+=count*2));
	}

	read_uint32(count:number) {
		return new Uint32Array(this.buffer.slice(this.x, this.x+=count*4));
	}

	read_float32(count:number) {
		return new Float32Array(this.buffer.slice(this.x, this.x+=count*4));
	}

	read_float64(count:number) {
		return new Float64Array(this.buffer.slice(this.x, this.x+=count*8));
	}
}
