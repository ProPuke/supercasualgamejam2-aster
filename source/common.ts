export type Vec2 = [number,number];

export const tau = Math.PI*2;

export function clamp(x:number, a:number = 0.0, b:number = 1.0) {
	return Math.max(a, Math.min(b, x));
}

export function lerp(from:number, to:number, x:number) {
	return to*x+from*(1.0-x);
}

export function deltaLerp(from:number, to:number, x:number, delta:number) {
	return lerp(from, to, 1.0-(1.0-x)**delta);
}

export function distance(from:Vec2, to:Vec2) {
	return length(vector(from, to));
}

export function vector(from:Vec2, to:Vec2):Vec2 {
	return [to[0]-from[0], to[1]-from[1]];
}

export function length(x:Vec2) {
	return Math.sqrt(x[0]*x[0]+x[1]*x[1]);
}

export function rescale(x:Vec2, target:number):Vec2 {
	const len = length(x);
	if(len<0.0001){
		return [target,0];
	}else{
		const rescale = target/len;
		return [x[0]*rescale, x[1]*rescale];
	}
}

export function add(a:Vec2, b:Vec2):Vec2 {
	return [a[0]+b[0], a[1]+b[1]];
}

export function scale(a:Vec2, b:number):Vec2 {
	return [a[0]*b, a[1]*b];
}

export function dot(a:Vec2, b:Vec2):number {
	return a[0]*b[0]+a[1]*b[1];
}

export function dir(angle:number, length:number):Vec2 {
	return [+Math.cos(angle)*length, -Math.sin(angle)*length];
}

export function toward(a:Vec2, b:Vec2, distance:number, clamp = true):Vec2 {
	const vec = vector(a, b);
	if(clamp&&length(vec)<=distance) return [b[0], b[1]];

	return add(a, rescale(vec, distance));
}

export function roughly(a:number, b:number) {
	return Math.abs(a-b)<0.001;
}

export function easeOutQuad(x:number):number {
	return 1-(1-x)*(1-x);
}

export function easeOutBounce(x:number):number {
	const n1 = 7.5625;
	const d1 = 2.75;
	
	if (x < 1 / d1) {
		return n1 * x * x;
	} else if (x < 2 / d1) {
		return n1 * (x -= 1.5 / d1) * x + 0.75;
	} else if (x < 2.5 / d1) {
		return n1 * (x -= 2.25 / d1) * x + 0.9375;
	} else {
		return n1 * (x -= 2.625 / d1) * x + 0.984375;
	}
}

export function easeOutElastic(x:number):number {
	const c4 = (2 * Math.PI) / 3;
	
	return x == 0
	  ? 0
	  : x == 1
	  ? 1
	  : 2**(-10*x) * Math.sin((x * 10 - 0.75) * c4) + 1;
}

export function concat_arrayBuffers(arrayBuffers:ArrayBuffer[]):ArrayBuffer {
	let length = 0;
	for(const buffer of arrayBuffers){
		length += buffer.byteLength;
	}

	const result = new Uint8Array(length);

	let i=0;
	for(const buffer of arrayBuffers){
		result.set(new Uint8Array((buffer as any).buffer), i);
		i += buffer.byteLength;
	}

	return result.buffer;
}

export function string_to_uint8(value:string):Uint8Array {
	const data:number[] = [];
	for(let i=0;i<value.length;i++){
		data.push(value.charCodeAt(i));
	}
	return new Uint8Array([data.length, ...data])
}

export function uint8_to_string(buffer:ArrayBuffer):[ArrayBuffer, string] {
	const length = new Uint8Array(buffer.slice(0, 1))[0]; buffer = buffer.slice(1);
	const data = new Uint8Array(buffer.slice(0, length)); buffer = buffer.slice(length);

	let value = '';
	for(const item of data){
		value += String.fromCharCode(item);
	}

	return [buffer, value];
}