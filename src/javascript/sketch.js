"use strict";

let canv, gl;
let animState;
let maxx, maxy
let midx, midy;

let widthHandle, heightHandle;
let pHandle, f;
let p =[]

const ORDER = 10;

const mrandom =  Math.random;
const mfloor = Math.floor;
const mround = Math.round;
const mceil = Math.ceil;
const mabs = Math.abs;
const mmin = Math.min;
const mmax = Math.max;

const mPI = Math.PI;
const mPIS2 = Math.PI / 2;
const m2PI = Math.PI * 2;
const msin = Math.sin;
const mcos = Math.cos;
const matan2 = Math.atan2;

const mhypot = Math.hypot;
const msqrt = Math.sqrt;

//-----------------------------------------------------------------------------
// miscellaneous functions
//-----------------------------------------------------------------------------

  function alea (min, max) {
// random number [min..max[ . If no max is provided, [0..min[

    if (typeof max == 'undefined') return min * mrandom();
    return min + (max - min) * mrandom();
  }

// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

  function intAlea (min, max) {
// random integer number [min..max[ . If no max is provided, [0..min[

    if (typeof max == 'undefined') {
      max = min; min = 0;
    }
    return mfloor(min + (max - min) * mrandom());
  } // intAlea

// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
  function distance (p0, p1) {

/* distance between points */

    return mhypot (p0[0] - p1[0], p0[1] - p1[1]);

  } // function distance

/*  ============================================================================
  This is based upon Johannes Baagoe's carefully designed and efficient hash
  function for use with JavaScript.  It has a proven "avalanche" effect such
  that every bit of the input affects every bit of the output 50% of the time,
  which is good.  See: http://baagoe.com/en/RandomMusings/hash/avalanche.xhtml
  ============================================================================
*/
/* This function returns a hash function depending on a seed.

if no seed is provided (or a falsy value), Math.random() is used.
The returned function always returns the same number in the range [0..1[ for the
same value of the argument. This argument may be a String or a Number or anything else
which can be 'toStringed'
Two returned functions obtained with two equal seeds are equivalent.
*/

function hashFunction(seed) {
  let n0 = 0xefc8249d;
  let n = n0;
  mash((seed || Math.random())); // pre-compute n for seed
  n0 = n; //

  function mash(data) {
    data = data.toString() + 'U';
    n = n0;
    for (let i = 0; i < data.length; i++) {
      n += data.charCodeAt(i);
      var h = 0.02519603282416938 * n;
      n = h >>> 0;
      h -= n;
      h *= n;
      n = h >>> 0;
      h -= n;
      n += h * 0x100000000; // 2^32
    } // for
    return (n >>> 0) * 2.3283064365386963e-10; // 2^-32
  } // mash
  return mash;
} // hashFunction(seed)

// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

function Noise1D (period, min = 0, max = 1, hash) {
/* returns a 1D noise function.
   the (mandatory) hash function must return a value between 0 and 1. The hash function
   will be called with an integer number for a parameter.
  the returned function takes one parameter, and will always return the same value if called with the same parameter
  period should be > 1. The bigger period is, the smoother the output noise is

suggestion : the hash parameter could be a function returned from a call to hashFunction above

*/

  let currx, y0, y1;  // cached valued, to reduce number of calls to 'hash'
  let phase = hash(0); // to shift the phase of different generators between each other;

  return function(x) {
    let xx = x / period + phase;
    let intx = mfloor(xx);

    if (intx - 1 === currx) { // next integer interval
      ++currx;
      y0 = y1;
      y1 = min + (max - min) * hash(currx + 1);
    } else if (intx !== currx) { // unrelated interval
      currx = intx;
      y0 = min + (max - min) * hash(currx);
      y1 = min + (max - min) * hash(currx + 1);
    }
    let frac = xx - currx;
    let z = (3 - 2 * frac) * frac * frac;
    return z * y1 + (1 - z) * y0;
  }
} // Noise1D
//-----------------------------------------------------------------------------
//-----------------------------------------------------------------------------

//************** Shader sources **************
let vertexSource = `
attribute vec2 position;


void main() {
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

let fragmentSource = `

  precision mediump float;

#define ORDER ${2 * ORDER}

  uniform float width;
  uniform float height;

  uniform vec2 p[ORDER];

  vec2 iResolution;
  vec2 z, znum, zden;


vec2 mult(vec2 z1, vec2 z2) {
  return vec2(z1.x * z2.x - z1.y * z2.y, z1.x * z2.y + z1.y * z2.x);
} // dmult

vec2 div( vec2 z1, vec2 z2) {
  return vec2(z1.x * z2.x + z1.y * z2.y, z1.y * z2.x - z1.x * z2.y) / (z2.x * z2.x + z2.y * z2.y);
} // div

void main(){

  iResolution = vec2(width, height);

// z = -1...+1 on shortest dimension

  z = (gl_FragCoord.xy - 0.5 * iResolution ) / min(width, height) * 2.0 ;


// calculate (z-p1) / (z-p2) * (z-p3) / (z-p4)...

  znum = z - p[0];
  zden = z - p[1];
  for (int k = 2; k < ORDER; k += 2) {
    znum = mult(znum, z - p[k]);
    zden = mult(zden, z - p[k + 1]);
  }
  z = div(znum, zden);

// take imaginary part of log :
  float s =  atan(z.x + length(z), z.y) / 3.14159265; // thanks to wikipedia!

  gl_FragColor = vec4(vec3(s), 1.0);
}
`;

//************** Utility functions **************

//Compile shader and combine with source
function compileShader(shaderSource, shaderType){
  let shader = gl.createShader(shaderType);
  gl.shaderSource(shader, shaderSource);
  gl.compileShader(shader);
  if(!gl.getShaderParameter(shader, gl.COMPILE_STATUS)){
    throw "Shader compile failed with: " + gl.getShaderInfoLog(shader);
  }
  return shader;
}

//From https://codepen.io/jlfwong/pen/GqmroZ
//Utility to complain loudly if we fail to find the attribute/uniform
function getAttribLocation(program, name) {
  let attributeLocation = gl.getAttribLocation(program, name);
  if (attributeLocation === -1) {
    throw 'Cannot find attribute ' + name + '.';
  }
  return attributeLocation;
}

function getUniformLocation(program, name) {
  let attributeLocation = gl.getUniformLocation(program, name);
  if (attributeLocation === null) {
    throw 'Cannot find uniform ' + name + '.';
  }
  return attributeLocation;
}


//---------------------------------------------------------
/* trick to have 'animate' to appear as a function in my text editor and
create a local scope for it */

function animate() {}
animate = (function() {

let startTime;

return function(tStamp){

  let dt;

  if (animState == 0 && startOver()) {
    ++animState;
    startTime = tStamp;
  }

  switch (animState) {

    case 1 :
      dt = tStamp - startTime;
      //Send uniforms to program

      for (let k = 0; k < 2 * ORDER; ++k) {
        let pp = [f[k][0](dt), f[k][1](dt)];
        p[2 * k] = pp[0];
        p[2 * k + 1] = pp[1];
      }
      gl.uniform2fv(pHandle,p);

      //Draw a triangle strip connecting vertices 0-4
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      break;
  } // switch

  requestAnimationFrame(animate);

} // animate
})();

//--------------------------------------------------------------------
function relativeCoord (element, clientX, clientY) {

  let style = element.currentStyle || window.getComputedStyle(element, null),
      paddingLeftWidth = parseInt(style.paddingLeft, 10),
      paddingTopWidth = parseInt(style.paddingTop, 10),
      borderLeftWidth = parseInt(style.borderLeftWidth, 10),
      borderTopWidth = parseInt(style.borderTopWidth, 10),
      rect = element.getBoundingClientRect(),
      x = clientX - paddingLeftWidth - borderLeftWidth - rect.left,
      y = clientY - paddingTopWidth - borderTopWidth - rect.top;

  return [x, y];
}
//- - - - - - - - - - - - - - - - - - - - - - - - - - - - -

function mouseMove (event) {

  let clx, cly;
//  if (event.buttons & 1) { // if left button
    [clx, cly] = relativeCoord(canv, event.clientX, event.clientY);
    mousePos.x = clx;
    mousePos.y = cly;
//  }
} // mouseMove

//---------------------------------------------------------

function startOver() {

  maxx = window.innerWidth;
  maxy = window.innerHeight;
  canv.width = maxx;
  canv.height = maxy;
  if (mmin (maxx, maxy) < 100) return false; // not worth working

  canv.style.left = (window.innerWidth - maxx) / 2 + 'px';
  canv.style.top = (window.innerHeight - maxy) / 2 + 'px';

  midx = window.innerWidth / 2; // reference for x mouse position
  midy = window.innerHeight / 2; // reference for x mouse position

  gl.viewport(0, 0, maxx, maxy);
  gl.uniform1f(widthHandle, maxx);
  gl.uniform1f(heightHandle, maxy);

// functions for the points
  f = [];
  for (let k = 0 ; k < 2 * ORDER; ++k) {
    f[k] = noise2D();
  }

  return true;

  function noise2D() {
    return [Noise1D(alea(5000, 10000),-1,1,hashFunction()),
            Noise1D(alea(5000, 10000),-1,1,hashFunction())];
  }

} // startOver

//---------------------------------------------------------
function initShadersStuff() {

  //************** Create shaders **************

  //Create vertex and fragment shaders
  let vertexShader = compileShader(vertexSource, gl.VERTEX_SHADER);
  let fragmentShader = compileShader(fragmentSource, gl.FRAGMENT_SHADER);

  //Create shader programs
  let program = gl.createProgram();
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);

  gl.useProgram(program);

  //Set up rectangle covering entire canvas
  let vertexData = new Float32Array([
    -1.0,  1.0,   // top left
    -1.0, -1.0,   // bottom left
     1.0,  1.0,   // top right
     1.0, -1.0,   // bottom right
  ]);

  // Create vertex buffer
  let vertexDataBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vertexDataBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, vertexData, gl.STATIC_DRAW);
  // Layout of our data in the vertex buffer
  let positionHandle = getAttribLocation(program, 'position');
  gl.enableVertexAttribArray(positionHandle);
  gl.vertexAttribPointer(positionHandle,
    2,        // position is a vec2 (2 values per component)
    gl.FLOAT, // each component is a float
    false,    // don't normalize values
    2 * 4,    // two 4 byte float components per vertex (32 bit float is 4 bytes)
    0         // how many bytes inside the buffer to start from
    );

  //Get uniform handles

  widthHandle = getUniformLocation(program, 'width');
  heightHandle = getUniformLocation(program, 'height');
  pHandle = getUniformLocation(program, 'p');

}
//---------------------------------------------------------
// beginning of execution

  {
    canv = document.createElement('canvas');
    canv.style.position="absolute";
    document.body.appendChild(canv);
    gl = canv.getContext('webgl');
//    canv.style.cursor = 'move';
  } // canvas creation

  window.addEventListener('mousemove', mouseMove);

  initShadersStuff();

  animState = 0; // to startOver
  requestAnimationFrame(animate);