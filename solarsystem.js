// === Interactive Solar System with Phong Lighting ===

// ===== Canvas and Context =====
const canvas = document.getElementById("glCanvas");
const gl = canvas.getContext("webgl");
if (!gl) alert("WebGL not supported.");
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

// ===== Shaders (Phong Lighting) =====
const vertexShaderSource = `
  attribute vec3 aPosition;
  attribute vec3 aNormal;

  uniform mat4 uModelMatrix;
  uniform mat4 uViewMatrix;
  uniform mat4 uProjectionMatrix;

  varying vec3 vNormal;
  varying vec3 vFragPos;

  void main(void) {
    vec4 worldPos = uModelMatrix * vec4(aPosition, 1.0);
    vFragPos = worldPos.xyz;
    vNormal = mat3(uModelMatrix) * aNormal;
    gl_Position = uProjectionMatrix * uViewMatrix * worldPos;
  }
`;

const fragmentShaderSource = `
  precision mediump float;

  varying vec3 vNormal;
  varying vec3 vFragPos;

  uniform vec3 uLightPos;
  uniform vec3 uViewPos;
  uniform vec4 uColor;

  void main(void) {
    vec3 norm = normalize(vNormal);
    vec3 lightDir = normalize(uLightPos - vFragPos);
    float diff = max(dot(norm, lightDir), 0.0);

    vec3 viewDir = normalize(uViewPos - vFragPos);
    vec3 reflectDir = reflect(-lightDir, norm);
    float spec = pow(max(dot(viewDir, reflectDir), 0.0), 32.0);

    vec3 ambient = 0.1 * uColor.rgb;
    vec3 diffuse = diff * uColor.rgb;
    vec3 specular = spec * vec3(1.0);

    vec3 result = ambient + diffuse + specular;
    gl_FragColor = vec4(result, 1.0);
  }
`;

// ===== Compile Shaders =====
function compileShader(type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS))
    console.error(gl.getShaderInfoLog(shader));
  return shader;
}

const vs = compileShader(gl.VERTEX_SHADER, vertexShaderSource);
const fs = compileShader(gl.FRAGMENT_SHADER, fragmentShaderSource);

// ===== Create Program =====
const program = gl.createProgram();
gl.attachShader(program, vs);
gl.attachShader(program, fs);
gl.linkProgram(program);
gl.useProgram(program);

// ===== Attribute Locations =====
const aPosition = gl.getAttribLocation(program, "aPosition");
const aNormal = gl.getAttribLocation(program, "aNormal");

// ===== Uniform Locations =====
const uModelMatrix = gl.getUniformLocation(program, "uModelMatrix");
const uViewMatrix = gl.getUniformLocation(program, "uViewMatrix");
const uProjectionMatrix = gl.getUniformLocation(program, "uProjectionMatrix");
const uLightPos = gl.getUniformLocation(program, "uLightPos");
const uViewPos = gl.getUniformLocation(program, "uViewPos");
const uColor = gl.getUniformLocation(program, "uColor");

// ===== Create Sphere Geometry =====
function createSphere(radius, segments) {
  const positions = [];
  const normals = [];
  const indices = [];

  for (let lat = 0; lat <= segments; lat++) {
    const theta = lat * Math.PI / segments;
    const sinTheta = Math.sin(theta);
    const cosTheta = Math.cos(theta);

    for (let lon = 0; lon <= segments; lon++) {
      const phi = lon * 2 * Math.PI / segments;
      const sinPhi = Math.sin(phi);
      const cosPhi = Math.cos(phi);

      const x = cosPhi * sinTheta;
      const y = cosTheta;
      const z = sinPhi * sinTheta;

      positions.push(radius * x, radius * y, radius * z);
      normals.push(x, y, z);
    }
  }

  for (let lat = 0; lat < segments; lat++) {
    for (let lon = 0; lon < segments; lon++) {
      const first = lat * (segments + 1) + lon;
      const second = first + segments + 1;

      indices.push(first, second, first + 1);
      indices.push(second, second + 1, first + 1);
    }
  }

  return { positions: new Float32Array(positions), normals: new Float32Array(normals), indices: new Uint16Array(indices) };
}

const sphere = createSphere(1, 24);

// ===== Buffers =====
const vao = gl.createVertexArray();
gl.bindVertexArray(vao);

const posBuffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, posBuffer);
gl.bufferData(gl.ARRAY_BUFFER, sphere.positions, gl.STATIC_DRAW);
gl.enableVertexAttribArray(aPosition);
gl.vertexAttribPointer(aPosition, 3, gl.FLOAT, false, 0, 0);

const normalBuffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer);
gl.bufferData(gl.ARRAY_BUFFER, sphere.normals, gl.STATIC_DRAW);
gl.enableVertexAttribArray(aNormal);
gl.vertexAttribPointer(aNormal, 3, gl.FLOAT, false, 0, 0);

const indexBuffer = gl.createBuffer();
gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, sphere.indices, gl.STATIC_DRAW);

// ===== Camera =====
const { mat4, vec3 } = glMatrix;
let camera = { x: 0, y: 2, z: 15, pitch: 0, yaw: 0 };
const keys = {};

document.addEventListener("keydown", e => keys[e.key.toLowerCase()] = true);
document.addEventListener("keyup", e => keys[e.key.toLowerCase()] = false);

canvas.addEventListener("mousemove", e => {
  if (e.buttons === 1) {
    camera.yaw += e.movementX * 0.002;
    camera.pitch -= e.movementY * 0.002;
  }
});

function resetCamera() { camera = { x: 0, y: 2, z: 15, pitch: 0, yaw: 0 }; }

// ===== Projection =====
const projectionMatrix = mat4.create();
mat4.perspective(projectionMatrix, Math.PI / 4, canvas.width / canvas.height, 0.1, 100.0);

// ===== Render =====
let time = 0;
gl.enable(gl.DEPTH_TEST);

function drawPlanet(distance, size, color, orbitSpeed, rotationSpeed, viewMatrix) {
  const model = mat4.create();
  mat4.rotateY(model, model, time * orbitSpeed);
  mat4.translate(model, model, [distance, 0, 0]);
  mat4.rotateY(model, model, time * rotationSpeed);
  mat4.scale(model, model, [size, size, size]);

  gl.uniformMatrix4fv(uModelMatrix, false, model);
  gl.uniformMatrix4fv(uViewMatrix, false, viewMatrix);
  gl.uniformMatrix4fv(uProjectionMatrix, false, projectionMatrix);
  gl.uniform4fv(uColor, color);

  gl.drawElements(gl.TRIANGLES, sphere.indices.length, gl.UNSIGNED_SHORT, 0);
}

function render() {
  time += 0.01;
  gl.clearColor(0, 0, 0, 1);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  // Camera movement
  const speed = 0.2;
  let forward = Math.cos(camera.yaw);
  let right = Math.sin(camera.yaw);
  if (keys['w']) { camera.x += right * speed; camera.z -= forward * speed; }
  if (keys['s']) { camera.x -= right * speed; camera.z += forward * speed; }
  if (keys['a']) { camera.x -= forward * speed; camera.z -= right * speed; }
  if (keys['d']) { camera.x += forward * speed; camera.z += right * speed; }
  if (keys['q']) camera.y += speed;
  if (keys['e']) camera.y -= speed;
  if (keys['r']) resetCamera();

  const view = mat4.create();
  mat4.rotateX(view, view, camera.pitch);
  mat4.rotateY(view, view, camera.yaw);
  mat4.translate(view, view, [-camera.x, -camera.y, -camera.z]);

  const lightPos = [0.0, 0.0, 0.0]; // Sun position
  const viewPos = [camera.x, camera.y, camera.z];
  gl.uniform3fv(uLightPos, lightPos);
  gl.uniform3fv(uViewPos, viewPos);

  // Draw planets
  drawPlanet(0, 2.5, [1.0, 1.0, 0.0, 1.0], 0, 0, view); // Sun
  drawPlanet(5, 0.4, [0.7, 0.7, 0.7, 1.0], 1.2, 3, view); // Mercury
  drawPlanet(7, 0.6, [0.9, 0.7, 0.3, 1.0], 1.0, 2, view); // Venus
  drawPlanet(9, 0.7, [0.2, 0.6, 1.0, 1.0], 0.8, 2, view); // Earth
  drawPlanet(11, 0.5, [1.0, 0.3, 0.3, 1.0], 0.7, 2, view); // Mars

  requestAnimationFrame(render);
}
render();
