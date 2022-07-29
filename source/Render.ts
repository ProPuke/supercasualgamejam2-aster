import { assert } from 'https://deno.land/std@0.149.0/testing/asserts.ts'

import { Vec2 } from './common.ts'

export default class Render {
	context:CanvasRenderingContext2D;

	pixelScale = 1.0;

	oldTransform:DOMMatrix[] = [];

	constructor(canvas:HTMLCanvasElement) {
		const context = canvas.getContext('2d');
		assert(context);

		this.context = context;
	}

	get size():Vec2 {
		return [this.context.canvas.width*this.pixelScale, this.context.canvas.height*this.pixelScale];
	}

	set_resolution(width:number, height:number, pixelScale:number) {
		this.context.canvas.width = width/pixelScale;
		this.context.canvas.height = height/pixelScale;
		this.pixelScale = pixelScale;

		const transform = new DOMMatrix();
		transform.scaleSelf(1.0/pixelScale, 1.0/pixelScale);
		this.context.setTransform(transform);
	}

	clear(colour:string) {
		// this.context.clearRect(0, 0, this.size[0], this.size[1]);
		this.context.fillStyle = colour;
		this.context.fillRect(0, 0, this.size[0], this.size[1]);
	}

	alpha(x:number) {
		this.context.globalAlpha = x;
	}

	begin_transform_scale(centre:Vec2, scale:number) {
		const transform = this.context.getTransform();
		this.oldTransform.push(transform);

		this.context.setTransform(transform.translate(centre[0], centre[1]).scaleSelf(scale, scale).translateSelf(-centre[0], -centre[1]));
	}

	begin_transform_translate(translate:Vec2) {
		const transform = this.context.getTransform();
		this.oldTransform.push(transform);

		this.context.setTransform(transform.translate(Math.round(translate[0]), Math.round(translate[1])));
	}

	end_transform() {
		this.context.setTransform(this.oldTransform.pop())
	}

	draw_poly(offset:Vec2, coords:Vec2[], closed:boolean, fillColour:string|false, strokeWidth:number = 0, strokeColour:string = '') {
		let first = true;
		this.context.beginPath();
		for(const coord of coords) {
			this.context[first?'moveTo':'lineTo'](offset[0]+coord[0], offset[1]+coord[1]);
			first = false;
		}
		
		if(closed) {
			this.context.closePath();
		}

		if(fillColour!==false){
			this.context.fillStyle = fillColour;
			this.context.fill();
		}

		if(strokeWidth>0){
			this.context.lineWidth = strokeWidth;
			this.context.strokeStyle = strokeColour;
			this.context.stroke();
		}
	}

	draw_text(pos:Vec2, width:number, alignX:number, font:string, text:string, colour:string, maxChars:number|false = false){
		this.context.font = font;
		this.context.fillStyle = colour;
		const textWidth = this.get_text_width(font, text);
		this.context.fillText(maxChars===false?text:text.substring(0, maxChars), pos[0]+(width-textWidth)*alignX, pos[1], width);
	}

	get_text_width(font:string, text:string){
		this.context.font = font;
		return this.context.measureText(text).width;
	}

	draw_circle(pos:Vec2, radius:number, fillColour:string|false, strokeWidth:number = 0, strokeColour:string = '') {
		this.context.beginPath();
		this.context.arc(pos[0], pos[1], radius, 0, Math.PI*2);

		if(fillColour!==false){
			this.context.fillStyle = fillColour;
			this.context.fill();
		}

		if(strokeWidth>0){
			this.context.lineWidth = strokeWidth;
			this.context.strokeStyle = strokeColour;
			this.context.stroke();
		}
	}

	draw_box(pos:Vec2, size:Vec2, fillColour:string|false, strokeWidth:number = 0, strokeColour:string = ''){
		this.context.beginPath();
		this.context.rect(Math.round(pos[0]), Math.round(pos[1]), Math.round(size[0]), Math.round(size[1]));

		if(fillColour!==false){
			this.context.fillStyle = fillColour;
			this.context.fill();
		}

		if(strokeWidth>0){
			this.context.lineWidth = strokeWidth;
			this.context.strokeStyle = strokeColour;
			this.context.stroke();
		}
	}

	draw_box_rounded(pos:Vec2, size:Vec2, colour:string, cornerRadius:number, strokeWidth:number = 0, stroke:string = ''){
		this.context.fillStyle = colour;

		this.context.beginPath();
		this.context.moveTo(pos[0]+cornerRadius,pos[1]);
		this.context.lineTo(pos[0]+size[0]-cornerRadius,pos[1]);
		this.context.arc(pos[0]+size[0]-cornerRadius,pos[1]+cornerRadius,cornerRadius,Math.PI*1.5,Math.PI*2,false);
		this.context.lineTo(pos[0]+size[0],pos[1]+size[1]-cornerRadius);
		this.context.arc(pos[0]+size[0]-cornerRadius,pos[1]+size[1]-cornerRadius,cornerRadius,Math.PI*0.0,Math.PI*0.5,false);
		this.context.lineTo(pos[0]+cornerRadius,pos[1]+size[1]);
		this.context.arc(pos[0]+cornerRadius,pos[1]+size[1]-cornerRadius,cornerRadius,Math.PI*0.5,Math.PI*1.0,false);
		this.context.lineTo(pos[0],pos[1]+cornerRadius);
		this.context.arc(pos[0]+cornerRadius,pos[1]+cornerRadius,cornerRadius,Math.PI*1.0,Math.PI*1.5,false);
		this.context.closePath();

		this.context.fill();
		if(stroke){
			this.context.lineWidth = strokeWidth;
			this.context.strokeStyle = stroke;
			this.context.stroke();
		}
	}

	draw_box_gradient_h(pos:Vec2, size:Vec2, colours:string[]){
		const gradient = this.context.createLinearGradient(pos[0], pos[1], pos[0]+size[0], pos[1]);
		for(const [i, colour] of colours.entries()){
			gradient.addColorStop(i/(colours.length-1), colour);
		}

		this.context.fillStyle = gradient;
		this.context.fillRect(pos[0], pos[1], size[0], size[1]);
	}

	draw_box_gradient_v(pos:Vec2, size:Vec2, colours:string[]){
		const gradient = this.context.createLinearGradient(pos[0], pos[1], pos[0], pos[1]+size[1]);
		for(const [i, colour] of colours.entries()){
			gradient.addColorStop(i/(colours.length-1), colour);
		}

		this.context.fillStyle = gradient;
		this.context.fillRect(pos[0], pos[1], size[0], size[1]);
	}
}
