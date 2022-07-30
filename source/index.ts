import Game from './Game.ts'
import Render from './Render.ts'

window.addEventListener('contextmenu', function(event){
	event.preventDefault();
});

const render = new Render(document.getElementsByTagName('canvas')[0]);
const game = new Game(render);

window.addEventListener('mousedown', function(event){
	// event.preventDefault();
	game.on_button_down(`Mouse${event.button}`);
});

window.addEventListener('keydown', function(event){
	event.preventDefault();
	game.on_button_down(event.key);
});

window.addEventListener('keyup', function(event){
	event.preventDefault();
	game.on_button_up(event.key);
});

let lastTime = Date.now();

(function draw() {
	const now = Date.now();
	const delta = (now-lastTime)/1000;

	render.set_resolution(window.innerWidth, window.innerHeight, 1);

	game.update(delta);
	game.draw();
	lastTime = now;
	window.requestAnimationFrame(draw);
})();
