// These have to be ordered by size (ascending) for them to be correctly drawn
var circles = [
	{ color: '#21a5ad', size: 84, angle: Math.PI / 3 },
	{ color: '#ffad10', size: 92, angle: - Math.PI / 3 },
	{ color: '#ef4239', size: 100, angle: 0 }
];
// To be able to "twist a circle", it has to be defined as a set of linked points
// This is the number of these points (you can see it if you set it to 3 or 4)
var segmentsPerCircle = 200;
// Time scaling factor : slower when closer to 0, faster when bigger than 1
var speed = .8;
// Easing function on the twist (indicates how fast the rotation goes at a given time)
// This is equivalent to an ease-in-out-quad
// A list of basic easings is available here https://gist.github.com/gre/1650294
function twistEasing(t) {
	return (t < .5) ? 2 * t * t : 1 - 2 * (t = 1 - t) * t;
}

var c = document.getElementById('c'),
	ctx = c.getContext('2d');
Math.PI2 = 2 * Math.PI; // ¯\_(ツ)_/¯

// "3d" rotation functions, around base axes
// I didn't feel like using matrices so it uses basic 2d geometry and rotation algorithms (trigonometry, pythagore)
// rotateZ is a standard 2d rotation around [0,0] (measures the distance, the current angle and increases it, then goes back to X,Y coordinates)
// rotateX and rotateY are the same but as if we were viewing the scene from above (for rotateY, so y becomes z) or from the right
function rotateX(p, a) {
	var d = Math.sqrt(p[2] * p[2] + p[1] * p[1]),
		na = Math.atan2(p[1], p[2]) + a;
	return [p[0], d * Math.sin(na), d * Math.cos(na)];
}
function rotateY(p, a) {
	var d = Math.sqrt(p[2] * p[2] + p[0] * p[0]),
		na = Math.atan2(p[2], p[0]) + a;
	return [d * Math.cos(na), p[1], d * Math.sin(na)];
}
function rotateZ(p, a) {
	var d = Math.sqrt(p[1] * p[1] + p[0] * p[0]),
		na = Math.atan2(p[1], p[0]) + a;
	return [d * Math.cos(na), d * Math.sin(na), p[2]];
}

// Change the canvas size and restore other properties (lost when we resize)
function resize() {
	c.width = c.offsetWidth;
	c.height = c.offsetHeight;
	ctx.translate(c.width *.5, c.height * .5);
	ctx.lineWidth = 5;
	ctx.lineCap = 'round';
	ctx.lineJoin = 'round';
}
window.addEventListener('resize', resize);
resize();

// Variables enabling mouse control (just adds an extra rotation around Y based on the mouse positions)
// To get a nicer result we smoothly transition to the new mouse position, so we have to use 2 variables
// (one for the actual angle and one for the final one, where the mouse points)
var angleOffset = 0, angleOffsetGoal = 0;
c.addEventListener('mousemove', function(e) { angleOffsetGoal = Math.PI2 * (e.clientX / c.width - .5); });
c.addEventListener('mouseout', function(e) { angleOffsetGoal = 0; });

// This is one of the main elements I guess, it creates a regular polygon (so something close to a circle with enough points)
// but also rotates the points around the X axis progressively from 0 at the left up to `angle` at the right
// this creates the "twist". Here is what it would look like with twelve points and different `angle` values https://imgur.com/a/5FmOn
function loxo(radius, angle, segments) {
	var r = [];
	for(var i = 0; i < segments; i++) {
		// We place the points regularly on a full circle so the angle increment is 2*PI (radians so 1 turn) divided by the number of segments
		// (and we multiply that by i to get the current one)
		var a = Math.PI2 * i / segments,
			c = Math.cos(a), s = Math.sin(a);
		var ax = Math.PI * .5;
		// c is the cosine, which is also the x position of the point on the circle with this angle
		// in [-1, 1], so (c + 1) * .5 gives the horizontal position from 0 (left) to 1 (right)
		// And the quantity of rotation around the X axis is basically `angle` multiplied by this 0 to 1 factor
		ax -= (c + 1) * .5 * angle;
		// Add the computed point to the list
		r.push([radius * c, radius * s * Math.sin(ax), radius * s * Math.cos(ax)]);
	}
	return r;
}

// The computing and drawing loop, calling itself with requestAnimationFrame
// (basically runs 60 times per second when possible)
function loop() {
	requestAnimationFrame(loop);
	// We move the mouse rotation towards its goal
	// (this formula makes it decelerate at the end, because it's always going 10% closer than what it was at the previous frame ; this gives a smooth transition)
	angleOffset += (angleOffsetGoal - angleOffset) * .1;
	ctx.clearRect(-c.width*.5,-c.height*.5,c.width,c.height);
	// We get a number between 0 and PI based on the current time indicating the progress of the animation
	var t = (Date.now() * 1e-3 * speed) % Math.PI;
	// global rotation : the assembly does half of a turn around Y (if you look at the extremity starting facing us, it ends up on the back)
	// (it's actually offseted by PI/2 because the loxo function gives circles facing us and we want to start the animation looking at the side)
	var rotationY = -t - Math.PI * .5;
	// You can also see the extremity do this up and down and then back to the middle thing, which is basically a sine wave
	// It can be seen in multiple ways but I chose to do a rotateZ after the first Y rotation
	// You can try setting this variable to 0 to see what it does (it's like 2d-rotating the result)
	var rotationZ = Math.PI * .5 * Math.cos(t);
	// The "twist" quantity is how much between 0 and 1 the circles should be
	var twist = twistEasing((Math.cos(t * 2 + Math.PI) + 1) * .5),
		twistAngle = twist * 2 * Math.PI2, // and we multiply that by the max angle (2 full turns) to get the `angle` we must send to the loxo function
		twistSign = (t * 2 > Math.PI ? 1 : -1);
	var circlesPoints = [];
	var i, l, j;
	for(i = 0, l = circles.length; i < l; i++) {
		var pts = loxo(circles[i].size, twistAngle, segmentsPerCircle);
		for(j = 0; j < segmentsPerCircle; j++) {
			// Just rotates the circle by their own angle (as defined at the very top) but moves them together when they are twisted
			// You can comment this next line to see what it looks like without it
			pts[j] = rotateX(pts[j], circles[i].angle * (1 - twist) * twistSign);
			// And apply every other rotation as computed earlier (global Y and Z, and the mouse rotation)
			// (you should read this chain starting by the innermost function call btw, assuming you consider the XYZ axes don't move with the transformation)
			// (if you consider the axes to be moving and not absolute, you can read from left to right)
			// (this is basically the same difference as when you read CSS transformations, cf this post https://codepen.io/bali_balo/post/chaining-transforms)
			pts[j] = rotateY(rotateZ(rotateY(pts[j], rotationY), rotationZ), angleOffset);
		}
		// Put the result in an array of arrays (array of circles and each circle is an array of points)
		circlesPoints.push(pts);
	}
	// Draw the result in two steps to get a correct z-ordering
	// First we draw everything that is "behind" the middle (that should be further from you than the center of the sphere)
	// going from the biggest circle (farther lines) to the smallest
	drawCircles(circlesPoints, true);
	// Then we draw the other half (closer to you)
	// this time drawing the smaller circles first (because on this half they are farther away)
	drawCircles(circlesPoints, false);
}
// Function that draws one half of all the circles (called twice to draw the full thing)
function drawCircles(circlesPoints, behind) {
	var i, l = circles.length;
	// Connects the dots basically
	for(var i = behind ? l - 1 : 0; i >= 0 && i < l; behind ? i-- : i++) {
		ctx.strokeStyle = circles[i].color;
		ctx.beginPath();
		for(var j = 0; j < segmentsPerCircle; j++) {
			var p = circlesPoints[i][j];
			// Gets rid of the points on the wrong half
			if(behind ? p[2] < 0 : p[2] > 0) continue;
			var prev = circlesPoints[i][(j || segmentsPerCircle) - 1];
			ctx.moveTo(prev[0], prev[1]);
			ctx.lineTo(p[0], p[1]);
		}
		ctx.stroke();
	}
}
// Starts the thing !
requestAnimationFrame(loop);
