"use strict";

let gl;
let canvas;
let program;
let brickTexture;

let dragging = false;
let lastX = -1,
  lastY = -1;
let currentRotation = [20, -30];
let zoomFactor = 15.0;

let baseUnit,
  strip,
  button,
  keyhole,
  lineVertical,
  lineHorizontal,
  foundation,
  cctvHolder,
  cctv,
  cctvLens,
  cctvRadar,
  ground;

let projectionMatrix, modelViewMatrix;
let modelViewMatrixLoc, projectionMatrixLoc, normalMatrixLoc;

let cctvMoveDirection = { x: 0, y: 0 };
let cctvRotation = [0, 0];
let isAutomaticCCTVMovement = false;

let targetGateAngle = 0.0;
let currentGateAngle = 0.0;

let lightPosX = 10.0;
let lightPosY = 20.0;
let lightPosZ = 15.0;
let lightBrightness = 1.0;

let groundRotation = 0.0;
let foundationRotation = 0.0;
let baseUnitRotation = 0.0;
let cctvHolderRotation = 0.0;

var stack = [];
var figure = [];

const groundId = 0;
const foundationId = 1;
const baseUnitId = 2;
const baseDetailsId = 3;
const armPivotId = 4;
const cctvHolderId = 5;
const cctvHeadId = 6;
const cctvLensId = 7;
const cctvRadarId = 8;
const numNodes = 9;

const M_ORANGE = {
  a: vec4(0.8, 0.4, 0.0, 1.0),
  d: vec4(1.0, 0.5, 0.0, 1.0),
  s: vec4(0.8, 0.8, 0.8, 1.0),
  sh: 30.0,
};
const M_BLACK = {
  a: vec4(0.05, 0.05, 0.05, 1.0),
  d: vec4(0.1, 0.1, 0.1, 1.0),
  s: vec4(0.2, 0.2, 0.2, 1.0),
  sh: 10.0,
};
const M_CONCRETE = {
  a: vec4(0.5, 0.5, 0.5, 1.0),
  d: vec4(0.6, 0.6, 0.6, 1.0),
  s: vec4(0.1, 0.1, 0.1, 1.0),
  sh: 5.0,
};
const M_GREEN = {
  a: vec4(0.0, 0.5, 0.0, 1.0),
  d: vec4(0.0, 0.6, 0.0, 1.0),
  s: vec4(0.8, 0.8, 0.8, 1.0),
  sh: 100.0,
};
const M_RED = {
  a: vec4(0.5, 0.0, 0.0, 1.0),
  d: vec4(0.8, 0.0, 0.0, 1.0),
  s: vec4(0.8, 0.8, 0.8, 1.0),
  sh: 100.0,
};
const M_WHITE = {
  a: vec4(0.8, 0.8, 0.8, 1.0),
  d: vec4(1.0, 1.0, 1.0, 1.0),
  s: vec4(0.5, 0.5, 0.5, 1.0),
  sh: 20.0,
};
const M_GROUND = {
  a: vec4(0.3, 0.5, 0.3, 1.0),
  d: vec4(0.4, 0.6, 0.4, 1.0),
  s: vec4(0.0, 0.0, 0.0, 1.0),
  sh: 1.0,
};

function createNode(baseTransform, render, sibling, child) {
  // <-- Diubah
  var node = {
    baseTransform: baseTransform, // <-- BARU: Menyimpan translasi statis
    transform: baseTransform, // <-- Diubah: Transformasi total (awal = base)
    render: render,
    sibling: sibling,
    child: child,
  };
  return node;
}

function traverse(Id) {
  if (Id == null) return;
  stack.push(modelViewMatrix);
  modelViewMatrix = mult(modelViewMatrix, figure[Id].transform);
  if (figure[Id].render) figure[Id].render();
  if (figure[Id].child != null) traverse(figure[Id].child);
  modelViewMatrix = stack.pop();
  if (figure[Id].sibling != null) traverse(figure[Id].sibling);
}

function renderGround() {
  setMaterial(M_GROUND.a, M_GROUND.d, M_GROUND.s, M_GROUND.sh);
  drawObject(ground, modelViewMatrix);
}

function renderFoundation() {
  setMaterial(M_CONCRETE.a, M_CONCRETE.d, M_CONCRETE.s, M_CONCRETE.sh);
  drawObject(foundation, modelViewMatrix);
}

function renderBaseUnit() {
  setMaterial(M_ORANGE.a, M_ORANGE.d, M_ORANGE.s, M_ORANGE.sh);
  drawObject(baseUnit, modelViewMatrix);
}

function renderCCTVHolder() {
  setMaterial(M_BLACK.a, M_BLACK.d, M_BLACK.s, M_BLACK.sh);
  drawObject(cctvHolder, modelViewMatrix);
}

function renderCCTVHead() {
  setMaterial(M_WHITE.a, M_WHITE.d, M_WHITE.s, M_WHITE.sh);
  drawObject(cctv, modelViewMatrix);
}

function renderCCTVLens() {
  setMaterial(M_BLACK.a, M_BLACK.d, M_BLACK.s, M_BLACK.sh);
  drawObject(cctvLens, modelViewMatrix);
}

function renderCCTVRadar() {
  setMaterial(M_RED.a, M_RED.d, M_RED.s, M_RED.sh);
  drawObject(cctvRadar, modelViewMatrix);
}

function renderBaseDetails() {
  const detailDepth = 0.51;
  let lampMaterial = targetGateAngle === 0.0 ? M_RED : M_GREEN;
  setMaterial(lampMaterial.a, lampMaterial.d, lampMaterial.s, lampMaterial.sh);

  drawObject(
    button,
    mult(
      modelViewMatrix,
      mult(translate(0.25, 1, detailDepth), rotate(90, [1, 0, 0]))
    )
  );
  drawObject(
    button,
    mult(
      modelViewMatrix,
      mult(translate(-0.25, 1, detailDepth), rotate(90, [1, 0, 0]))
    )
  );

  setMaterial(M_BLACK.a, M_BLACK.d, M_BLACK.s, M_BLACK.sh);
  drawObject(
    lineVertical,
    mult(modelViewMatrix, translate(-0.5, -0.3, detailDepth))
  );
  drawObject(
    lineVertical,
    mult(modelViewMatrix, translate(0.5, -0.3, detailDepth))
  );
  drawObject(
    lineHorizontal,
    mult(modelViewMatrix, translate(0, -0.3 + 0.75, detailDepth))
  );
  drawObject(
    lineHorizontal,
    mult(modelViewMatrix, translate(0, -0.3 - 0.75, detailDepth))
  );
  drawObject(keyhole, mult(modelViewMatrix, translate(0.3, -0.2, detailDepth)));
}

function renderArmStrips() {
  for (let i = 0; i < 7; i++) {
    let currentMaterial = i % 2 === 0 ? M_WHITE : M_ORANGE;
    setMaterial(
      currentMaterial.a,
      currentMaterial.d,
      currentMaterial.s,
      currentMaterial.sh
    );
    let stripMatrix = mult(modelViewMatrix, translate(0.5 + i, 0, 0));
    drawObject(strip, stripMatrix);
  }
}

function initNodes(Id) {
  var m = mat4();

  switch (Id) {
    case groundId:
      m = translate(0, -2.05, 0);
      figure[groundId] = createNode(m, renderGround, null, foundationId);
      break;

    case foundationId:
      m = translate(0, 0.3, 0);
      figure[foundationId] = createNode(
        m,
        renderFoundation,
        cctvHolderId,
        baseUnitId
      );
      break;

    case baseUnitId:
      m = translate(0, 1.75, 0);
      figure[baseUnitId] = createNode(m, renderBaseUnit, null, baseDetailsId);
      break;

    case baseDetailsId:
      m = mat4();
      figure[baseDetailsId] = createNode(
        m,
        renderBaseDetails,
        armPivotId,
        null
      );
      break;

    case armPivotId:
      m = mult(translate(0, 1, 0), rotate(0, [0, 0, 1]));
      figure[armPivotId] = createNode(m, renderArmStrips, null, null);
      break;

    case cctvHolderId:
      m = translate(-1, 2.25, 0.4);
      figure[cctvHolderId] = createNode(m, renderCCTVHolder, null, cctvHeadId);
      break;

    case cctvHeadId:
      m = translate(0, 2.25, 0);
      figure[cctvHeadId] = createNode(m, renderCCTVHead, null, cctvLensId);
      break;

    case cctvLensId:
      m = translate(0, 0, 0.76);
      figure[cctvLensId] = createNode(m, renderCCTVLens, cctvRadarId, null);
      break;

    case cctvRadarId:
      m = mult(translate(0, 0, 0.77), rotate(90, [1, 0, 0]));
      figure[cctvRadarId] = createNode(m, renderCCTVRadar, null, null);
      break;
  }
}

function initAllNodes() {
  for (var i = 0; i < numNodes; i++) initNodes(i);
}

function loadTexture(gl, url) {
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  const pixel = new Uint8Array([0, 0, 255, 255]);
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.RGBA,
    1,
    1,
    0,
    gl.RGBA,
    gl.UNSIGNED_BYTE,
    pixel
  );
  const image = new Image();
  image.onload = function () {
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
    if (isPowerOf2(image.width) && isPowerOf2(image.height)) {
      gl.generateMipmap(gl.TEXTURE_2D);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
    } else {
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    }
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  };
  image.src = url;
  return texture;
}

function isPowerOf2(value) {
  return (value & (value - 1)) === 0;
}

function createCuboidWithNormals(width, height, depth) {
  const w = width / 2;
  const h = height / 2;
  const d = depth / 2;
  const positions = [];
  const normals = [];
  const texCoords = [];
  const vertices = [
    vec4(-w, -h, d, 1.0),
    vec4(w, -h, d, 1.0),
    vec4(w, h, d, 1.0),
    vec4(-w, h, d, 1.0),
    vec4(-w, -h, -d, 1.0),
    vec4(w, -h, -d, 1.0),
    vec4(w, h, -d, 1.0),
    vec4(-w, h, -d, 1.0),
  ];
  const normalsList = [
    vec4(0.0, 0.0, 1.0, 0.0),
    vec4(0.0, 0.0, -1.0, 0.0),
    vec4(0.0, 1.0, 0.0, 0.0),
    vec4(0.0, -1.0, 0.0, 0.0),
    vec4(1.0, 0.0, 0.0, 0.0),
    vec4(-1.0, 0.0, 0.0, 0.0),
  ];
  const uv = [vec2(0, 0), vec2(1, 0), vec2(1, 1), vec2(0, 1)];
  function quad(a, b, c, d, normal) {
    positions.push(
      vertices[a],
      vertices[b],
      vertices[c],
      vertices[a],
      vertices[c],
      vertices[d]
    );
    for (let i = 0; i < 6; i++) normals.push(normal);
    texCoords.push(uv[1], uv[0], uv[3], uv[1], uv[3], uv[2]);
  }
  quad(1, 0, 3, 2, normalsList[0]);
  quad(2, 3, 7, 6, normalsList[2]);
  quad(3, 0, 4, 7, normalsList[5]);
  quad(6, 5, 1, 2, normalsList[4]);
  quad(4, 5, 6, 7, normalsList[1]);
  quad(5, 4, 0, 1, normalsList[3]);
  const vBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, flatten(positions), gl.STATIC_DRAW);
  const nBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, nBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, flatten(normals), gl.STATIC_DRAW);
  const tBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, tBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, flatten(texCoords), gl.STATIC_DRAW);
  return {
    vertexBuffer: vBuffer,
    normalBuffer: nBuffer,
    texCoordBuffer: tBuffer,
    vertexCount: positions.length,
  };
}

function createCylinderWithNormals(radius, height, segments) {
  const positions = [];
  const normals = [];
  const topCenter = vec4(0, height / 2, 0, 1.0);
  const bottomCenter = vec4(0, -height / 2, 0, 1.0);
  const topNormal = vec4(0, 1, 0, 0);
  const bottomNormal = vec4(0, -1, 0, 0);
  const topRing = [];
  const bottomRing = [];
  for (let i = 0; i < segments; i++) {
    const angle = (i / segments) * 2.0 * Math.PI;
    const x = radius * Math.cos(angle);
    const z = radius * Math.sin(angle);
    topRing.push(vec4(x, height / 2, z, 1.0));
    bottomRing.push(vec4(x, -height / 2, z, 1.0));
  }
  for (let i = 0; i < segments; i++) {
    positions.push(topCenter, topRing[i], topRing[(i + 1) % segments]);
    normals.push(topNormal, topNormal, topNormal);
  }
  for (let i = 0; i < segments; i++) {
    positions.push(bottomCenter, bottomRing[(i + 1) % segments], bottomRing[i]);
    normals.push(bottomNormal, bottomNormal, bottomNormal);
  }
  for (let i = 0; i < segments; i++) {
    const p1 = topRing[i];
    const p2 = bottomRing[i];
    const p3 = bottomRing[(i + 1) % segments];
    const p4 = topRing[(i + 1) % segments];
    const sideNormal = vec4(p1[0], 0, p1[2], 0.0);
    positions.push(p1, p2, p3, p1, p3, p4);
    normals.push(
      sideNormal,
      sideNormal,
      sideNormal,
      sideNormal,
      sideNormal,
      sideNormal
    );
  }
  const vBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, flatten(positions), gl.STATIC_DRAW);
  const nBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, nBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, flatten(normals), gl.STATIC_DRAW);
  return {
    vertexBuffer: vBuffer,
    normalBuffer: nBuffer,
    vertexCount: positions.length,
  };
}

window.onload = function main() {
  canvas = document.getElementById("gl-canvas");
  gl = canvas.getContext("webgl2");
  if (!gl) {
    alert("WebGL 2.0 tidak tersedia.");
    return;
  }

  gl.viewport(0, 0, canvas.width, canvas.height);
  gl.clearColor(0.8, 0.9, 1.0, 1.0);
  gl.enable(gl.DEPTH_TEST);

  program = initShaders(gl, "vertex-shader", "fragment-shader");
  gl.useProgram(program);

  baseUnit = createCuboidWithNormals(1.5, 3.0, 1.0);
  strip = createCuboidWithNormals(1.0, 0.3, 0.3);
  button = createCylinderWithNormals(0.15, 0.05, 18);
  keyhole = createCuboidWithNormals(0.1, 0.2, 0.1);
  lineVertical = createCuboidWithNormals(0.05, 1.5, 0.05);
  lineHorizontal = createCuboidWithNormals(1.0, 0.05, 0.05);
  foundation = createCuboidWithNormals(1.8, 0.5, 1.2);
  cctvHolder = createCuboidWithNormals(0.2, 4.5, 0.2);
  cctv = createCuboidWithNormals(0.8, 0.8, 1.55);
  cctvLens = createCuboidWithNormals(0.45, 0.45, 0.05);
  cctvRadar = createCylinderWithNormals(0.07, 0.05, 18);
  ground = createCuboidWithNormals(20, 0.1, 20);

  brickTexture = loadTexture(gl, "TIGER.png");

  program.a_Position = gl.getAttribLocation(program, "a_Position");
  program.a_Normal = gl.getAttribLocation(program, "a_Normal");
  program.a_TexCoord = gl.getAttribLocation(program, "a_TexCoord");
  program.u_textureSamplerLoc = gl.getUniformLocation(
    program,
    "u_textureSampler"
  );

  modelViewMatrixLoc = gl.getUniformLocation(program, "u_modelViewMatrix");
  projectionMatrixLoc = gl.getUniformLocation(program, "u_projectionMatrix");
  normalMatrixLoc = gl.getUniformLocation(program, "u_normalMatrix");

  gl.enableVertexAttribArray(program.a_Position);
  gl.enableVertexAttribArray(program.a_Normal);
  gl.enableVertexAttribArray(program.a_TexCoord);

  program.baseLightAmbient = vec4(0.3, 0.3, 0.3, 1.0);
  program.baseLightDiffuse = vec4(1.0, 1.0, 1.0, 1.0);
  program.lightSpecular = vec4(1.0, 1.0, 1.0, 1.0);

  setupEventListeners();
  initAllNodes();
  render();
};

function setMaterial(ambient, diffuse, specular, shininess) {
  const ambientProduct = mult(program.lightAmbient, ambient);
  const diffuseProduct = mult(program.lightDiffuse, diffuse);
  const specularProduct = mult(program.lightSpecular, specular);

  gl.uniform4fv(
    gl.getUniformLocation(program, "u_ambientProduct"),
    flatten(ambientProduct)
  );
  gl.uniform4fv(
    gl.getUniformLocation(program, "u_diffuseProduct"),
    flatten(diffuseProduct)
  );
  gl.uniform4fv(
    gl.getUniformLocation(program, "u_specularProduct"),
    flatten(specularProduct)
  );
  gl.uniform1f(gl.getUniformLocation(program, "u_shininess"), shininess);
}

function drawObject(obj, transformationMatrix) {
  gl.bindBuffer(gl.ARRAY_BUFFER, obj.vertexBuffer);
  gl.vertexAttribPointer(program.a_Position, 4, gl.FLOAT, false, 0, 0);

  gl.bindBuffer(gl.ARRAY_BUFFER, obj.normalBuffer);
  gl.vertexAttribPointer(program.a_Normal, 4, gl.FLOAT, false, 0, 0);

  if (obj.texCoordBuffer) {
    gl.bindBuffer(gl.ARRAY_BUFFER, obj.texCoordBuffer);
    gl.vertexAttribPointer(program.a_TexCoord, 2, gl.FLOAT, false, 0, 0);
  }

  const normalMat = normalMatrix(transformationMatrix, true);
  gl.uniformMatrix4fv(modelViewMatrixLoc, false, flatten(transformationMatrix));
  gl.uniformMatrix3fv(normalMatrixLoc, false, flatten(normalMat));

  gl.drawArrays(gl.TRIANGLES, 0, obj.vertexCount);
}

function render() {
  currentGateAngle += (targetGateAngle - currentGateAngle) * 0.05;

  if (isAutomaticCCTVMovement) {
    cctvRotation[1] = Math.sin((Date.now() / 1000) * 0.5) * 45;
  } else {
    cctvRotation[0] += cctvMoveDirection.y * 0.5;
    cctvRotation[1] += cctvMoveDirection.x * 0.5;
    cctvRotation[0] = Math.max(-45, Math.min(45, cctvRotation[0]));
    cctvRotation[1] = Math.max(-90, Math.min(90, cctvRotation[1]));
  }

  let groundDynamic = rotate(groundRotation, [0, 1, 0]);
  figure[groundId].transform = mult(
    figure[groundId].baseTransform, // <-- Membaca translasi dari initNodes
    groundDynamic
  );

  // Rotasi Pondasi
  let foundationDynamic = rotate(foundationRotation, [0, 1, 0]);
  figure[foundationId].transform = mult(
    figure[foundationId].baseTransform, // <-- Membaca translasi dari initNodes
    foundationDynamic
  );

  // Rotasi Base Unit
  let baseDynamic = rotate(baseUnitRotation, [0, 1, 0]);
  figure[baseUnitId].transform = mult(
    figure[baseUnitId].baseTransform, // <-- Membaca translasi dari initNodes
    baseDynamic
  );

  // Rotasi Tiang CCTV
  let holderDynamic = rotate(cctvHolderRotation, [0, 1, 0]);
  figure[cctvHolderId].transform = mult(
    figure[cctvHolderId].baseTransform, // <-- Membaca translasi dari initNodes
    holderDynamic
  );

  // Animasi Palang (Arm)
  let armDynamic = rotate(currentGateAngle, [0, 0, 1]);
  figure[armPivotId].transform = mult(
    figure[armPivotId].baseTransform, // <-- Membaca T(0,1,0) dari initNodes
    armDynamic
  );

  // Animasi Kepala CCTV
  let cctvHeadDynamic = mult(
    rotate(cctvRotation[1], [0, 1, 0]),
    rotate(cctvRotation[0], [1, 0, 0])
  );
  figure[cctvHeadId].transform = mult(
    figure[cctvHeadId].baseTransform, // <-- Membaca T(0,2.25,0) dari initNodes
    cctvHeadDynamic
  );

  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, brickTexture);
  gl.uniform1i(program.u_textureSamplerLoc, 0);

  const lightPosition = vec4(lightPosX, lightPosY, lightPosZ, 0.0);
  gl.uniform4fv(
    gl.getUniformLocation(program, "u_lightPosition"),
    flatten(lightPosition)
  );
  program.lightAmbient = scale(lightBrightness, program.baseLightAmbient);
  program.lightDiffuse = scale(lightBrightness, program.baseLightDiffuse);

  projectionMatrix = perspective(50, canvas.width / canvas.height, 0.1, 100);
  gl.uniformMatrix4fv(projectionMatrixLoc, false, flatten(projectionMatrix));

  modelViewMatrix = lookAt(
    vec3(0, 2, zoomFactor),
    vec3(0, 0, 0),
    vec3(0, 1, 0)
  );
  modelViewMatrix = mult(
    modelViewMatrix,
    rotate(currentRotation[0], [1, 0, 0])
  );
  modelViewMatrix = mult(
    modelViewMatrix,
    rotate(currentRotation[1], [0, 1, 0])
  );

  traverse(groundId);
  requestAnimationFrame(render);
}

function setupEventListeners() {
  let hasDragged = false;
  canvas.addEventListener("mousedown", (e) => {
    dragging = true;
    lastX = e.clientX;
    lastY = e.clientY;
    hasDragged = false;
  });
  canvas.addEventListener("mouseup", () => {
    dragging = false;
    if (!hasDragged) {
      targetGateAngle = targetGateAngle === 0.0 ? -90.0 : 0.0;
    }
  });
  canvas.addEventListener("mousemove", (e) => {
    if (dragging) {
      hasDragged = true;
      const deltaX = e.clientX - lastX;
      const deltaY = e.clientY - lastY;
      currentRotation[1] += deltaX;
      currentRotation[0] += deltaY;
      lastX = e.clientX;
      lastY = e.clientY;
    }
  });
  canvas.addEventListener("wheel", (e) => {
    e.preventDefault();
    zoomFactor += e.deltaY * -0.02;
    zoomFactor = Math.min(Math.max(8, zoomFactor), 40);
    document.getElementById("zoom-slider").value = zoomFactor; // <-- Anda mungkin tidak punya ini, hapus jika error
    document.getElementById("zoom-value").textContent = zoomFactor.toFixed(1); // <-- Anda mungkin tidak punya ini, hapus jika error
  });

  const autoButton = document.getElementById("auto-mode-button");
  autoButton.addEventListener("click", () => {
    isAutomaticCCTVMovement = !isAutomaticCCTVMovement;
    autoButton.textContent = isAutomaticCCTVMovement
      ? "Mode: Otomatis (Tekan untuk Manual)"
      : "Mode: Manual (Tekan untuk Otomatis)";
    if (!isAutomaticCCTVMovement) cctvRotation = [0, 0];
  });

  window.addEventListener("keydown", (e) => {
    if (e.key.startsWith("Arrow")) e.preventDefault();
    switch (e.key) {
      case "ArrowUp":
        cctvMoveDirection.y = 1;
        break;
      case "ArrowDown":
        cctvMoveDirection.y = -1;
        break;
      case "ArrowLeft":
        cctvMoveDirection.x = 1;
        break;
      case "ArrowRight":
        cctvMoveDirection.x = -1;
        break;
    }
  });
  window.addEventListener("keyup", (e) => {
    if (e.key.startsWith("Arrow")) e.preventDefault();
    switch (e.key) {
      case "ArrowUp":
      case "ArrowDown":
        cctvMoveDirection.y = 0;
        break;
      case "ArrowLeft":
      case "ArrowRight":
        cctvMoveDirection.x = 0;
        break;
    }
  });

  const lightXSlider = document.getElementById("light-x-slider");
  const lightXValue = document.getElementById("light-x-value");
  lightXSlider.addEventListener("input", (e) => {
    lightPosX = parseFloat(e.target.value);
    lightXValue.textContent = lightPosX;
  });

  const lightYSlider = document.getElementById("light-y-slider");
  const lightYValue = document.getElementById("light-y-value");
  lightYSlider.addEventListener("input", (e) => {
    lightPosY = parseFloat(e.target.value);
    lightYValue.textContent = lightPosY;
  });

  const lightZSlider = document.getElementById("light-z-slider");
  const lightZValue = document.getElementById("light-z-value");
  lightZSlider.addEventListener("input", (e) => {
    lightPosZ = parseFloat(e.target.value);
    lightZValue.textContent = lightPosZ;
  });

  const brightnessSlider = document.getElementById("brightness-slider");
  const brightnessValue = document.getElementById("brightness-value");
  brightnessSlider.addEventListener("input", (e) => {
    lightBrightness = parseFloat(e.target.value);
    brightnessValue.textContent = lightBrightness.toFixed(2);
  });

  const groundRotateSlider = document.getElementById("ground-rotate-slider");
  const groundRotateValue = document.getElementById("ground-rotate-value");
  groundRotateSlider.addEventListener("input", (e) => {
    groundRotation = parseFloat(e.target.value);
    groundRotateValue.textContent = groundRotation;
  });

  const foundationRotateSlider = document.getElementById(
    "foundation-rotate-slider"
  );
  const foundationRotateValue = document.getElementById(
    "foundation-rotate-value"
  );
  foundationRotateSlider.addEventListener("input", (e) => {
    foundationRotation = parseFloat(e.target.value);
    foundationRotateValue.textContent = foundationRotation;
  });

  const baseRotateSlider = document.getElementById("base-rotate-slider");
  const baseRotateValue = document.getElementById("base-rotate-value");
  baseRotateSlider.addEventListener("input", (e) => {
    baseUnitRotation = parseFloat(e.target.value);
    baseRotateValue.textContent = baseUnitRotation;
  });

  const cctvHolderRotateSlider = document.getElementById(
    "cctv-holder-rotate-slider"
  );
  const cctvHolderRotateValue = document.getElementById(
    "cctv-holder-rotate-value"
  );
  cctvHolderRotateSlider.addEventListener("input", (e) => {
    cctvHolderRotation = parseFloat(e.target.value);
    cctvHolderRotateValue.textContent = cctvHolderRotation;
  });
}
