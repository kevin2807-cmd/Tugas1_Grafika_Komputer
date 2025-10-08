"use strict";

let gl;
let canvas;
let program;

// Objek untuk menampung buffer geometri
let baseUnit, strip, button, keyhole, lineVertical, lineHorizontal, foundation, cctvHolder, cctv, cctvLens, cctvRadar, ground;

// Lokasi variabel Shader
let modelViewMatrixLoc, projectionMatrixLoc, normalMatrixLoc;

// Variabel untuk interaksi kamera
let dragging = false;
let lastX = -1, lastY = -1;
let currentRotation = [20, -30];
let projectionType = 'perspective';
let fieldOfView = 50; 
let zoomFactor = 15.0;

// Variabel untuk interaksi CCTV
let cctvMoveDirection = { x: 0, y: 0 };
let cctvRotation = [0, 0];
let isAutomaticCCTVMovement = false;

// Variabel untuk animasi palang
let targetGateAngle = 0.0;
let currentGateAngle = 0.0;

let lightPosX = 10.0;
let lightPosY = 20.0;
let lightPosZ = 15.0;
let lightBrightness = 1.0;

function createCuboidWithNormals(width, height, depth) {
    const w = width / 2;
    const h = height / 2;
    const d = depth / 2;

    const positions = [];
    const normals = [];

    const vertices = [
        vec4(-w, -h,  d, 1.0), vec4( w, -h,  d, 1.0),
        vec4( w,  h,  d, 1.0), vec4(-w,  h,  d, 1.0),
        vec4(-w, -h, -d, 1.0), vec4( w, -h, -d, 1.0),
        vec4( w,  h, -d, 1.0), vec4(-w,  h, -d, 1.0)
    ];

    const normalsList = [
        vec4(0.0, 0.0, 1.0, 0.0),   // depan
        vec4(0.0, 0.0, -1.0, 0.0),  // belakang
        vec4(0.0, 1.0, 0.0, 0.0),   // atas
        vec4(0.0, -1.0, 0.0, 0.0),  // bawah
        vec4(1.0, 0.0, 0.0, 0.0),   // kanan
        vec4(-1.0, 0.0, 0.0, 0.0)   // kiri
    ];

    function quad(a, b, c, d, normal) {
        positions.push(vertices[a], vertices[b], vertices[c], vertices[a], vertices[c], vertices[d]);
        for (let i = 0; i < 6; i++) normals.push(normal);
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

    return { vertexBuffer: vBuffer, normalBuffer: nBuffer, vertexCount: positions.length };
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
    
    // Sisi Atas
    for (let i = 0; i < segments; i++) {
        positions.push(topCenter, topRing[i], topRing[(i + 1) % segments]);
        normals.push(topNormal, topNormal, topNormal);
    }

    // Sisi Bawah
    for (let i = 0; i < segments; i++) {
        positions.push(bottomCenter, bottomRing[(i + 1) % segments], bottomRing[i]);
        normals.push(bottomNormal, bottomNormal, bottomNormal);
    }

    // Sisi samping
    for (let i = 0; i < segments; i++) {
        const p1 = topRing[i];
        const p2 = bottomRing[i];
        const p3 = bottomRing[(i + 1) % segments];
        const p4 = topRing[(i + 1) % segments];
        
        const sideNormal = vec4(p1[0], 0, p1[2], 0.0);
        
        positions.push(p1, p2, p3, p1, p3, p4);
        normals.push(sideNormal, sideNormal, sideNormal, sideNormal, sideNormal, sideNormal);
    }
    
    const vBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, flatten(positions), gl.STATIC_DRAW);

    const nBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, nBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, flatten(normals), gl.STATIC_DRAW);
    
    return { vertexBuffer: vBuffer, normalBuffer: nBuffer, vertexCount: positions.length };
}

// Panggil main() saat window dimuat
window.onload = function main() {
    canvas = document.getElementById("gl-canvas");
    gl = canvas.getContext("webgl2");
    if (!gl) { alert("WebGL 2.0 tidak tersedia."); return; }

    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0.8, 0.9, 1.0, 1.0);
    gl.enable(gl.DEPTH_TEST);

    program = initShaders(gl, "vertex-shader", "fragment-shader");
    gl.useProgram(program);
    
    // --- Inisialisasi Geometri dengan Normal ---
    baseUnit = createCuboidWithNormals(1.5, 3.0, 1.0); 
    strip = createCuboidWithNormals(1.0, 0.3, 0.3);
    button = createCylinderWithNormals(0.150, 0.05, 18);
    keyhole = createCuboidWithNormals(0.1, 0.2, 0.1);
    lineVertical = createCuboidWithNormals(0.05, 1.5, 0.05);
    lineHorizontal = createCuboidWithNormals(1.0, 0.05, 0.05);
    foundation = createCuboidWithNormals(1.8, 0.5, 1.2);
    cctvHolder = createCuboidWithNormals(0.2, 4.5, 0.2);
    cctv = createCuboidWithNormals(0.80, 0.80, 1.55);
    cctvLens = createCuboidWithNormals(0.45, 0.45, 0.05);
    cctvRadar = createCylinderWithNormals(0.07, 0.05, 18);
    ground = createCuboidWithNormals(20, 0.1, 20);

    // --- Dapatkan Lokasi Variabel Shader ---
    program.a_Position = gl.getAttribLocation(program, "a_Position");
    program.a_Normal = gl.getAttribLocation(program, "a_Normal"); // Lokasi normal
    
    modelViewMatrixLoc = gl.getUniformLocation(program, "u_modelViewMatrix");
    projectionMatrixLoc = gl.getUniformLocation(program, "u_projectionMatrix");
    normalMatrixLoc = gl.getUniformLocation(program, "u_normalMatrix"); // Lokasi Normal Matrix

    // Aktifkan attribute arrays
    gl.enableVertexAttribArray(program.a_Position);
    gl.enableVertexAttribArray(program.a_Normal);
    
    // --- Setup Properti Cahaya (Global) ---
    program.baseLightAmbient = vec4(0.3, 0.3, 0.3, 1.0);
    program.baseLightDiffuse = vec4(1.0, 1.0, 1.0, 1.0);
    program.lightSpecular = vec4(1.0, 1.0, 1.0, 1.0);
    setupEventListeners();
    render();
}

// Fungsi helper untuk mengatur material sebelum menggambar
function setMaterial(ambient, diffuse, specular, shininess) {
    const ambientProduct = mult(program.lightAmbient, ambient);
    const diffuseProduct = mult(program.lightDiffuse, diffuse);
    const specularProduct = mult(program.lightSpecular, specular);

    gl.uniform4fv(gl.getUniformLocation(program, "u_ambientProduct"), flatten(ambientProduct));
    gl.uniform4fv(gl.getUniformLocation(program, "u_diffuseProduct"), flatten(diffuseProduct));
    gl.uniform4fv(gl.getUniformLocation(program, "u_specularProduct"), flatten(specularProduct));
    gl.uniform1f(gl.getUniformLocation(program, "u_shininess"), shininess);
}


function drawObject(obj, transformationMatrix) {
    // Bind buffer posisi
    gl.bindBuffer(gl.ARRAY_BUFFER, obj.vertexBuffer);
    gl.vertexAttribPointer(program.a_Position, 4, gl.FLOAT, false, 0, 0);
    
    // Bind buffer normal
    gl.bindBuffer(gl.ARRAY_BUFFER, obj.normalBuffer);
    gl.vertexAttribPointer(program.a_Normal, 4, gl.FLOAT, false, 0, 0);
    
    // Kirim matriks
    const normalMat = normalMatrix(transformationMatrix, true); // Hitung Normal Matrix
    gl.uniformMatrix4fv(modelViewMatrixLoc, false, flatten(transformationMatrix));
    gl.uniformMatrix3fv(normalMatrixLoc, false, flatten(normalMat));

    // Gambar objek
    gl.drawArrays(gl.TRIANGLES, 0, obj.vertexCount);
}

function render() {
    // Animasi palang
    currentGateAngle += (targetGateAngle - currentGateAngle) * 0.05;

    // Animasi CCTV
    if (isAutomaticCCTVMovement) {
        cctvRotation[1] = Math.sin(Date.now() / 1000 * 0.5) * 45;
    } else {
        cctvRotation[0] += cctvMoveDirection.y * 0.5; 
        cctvRotation[1] += cctvMoveDirection.x * 0.5; 
        cctvRotation[0] = Math.max(-45, Math.min(45, cctvRotation[0]));
        cctvRotation[1] = Math.max(-90, Math.min(90, cctvRotation[1]));
    }

    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    const lightPosition = vec4(lightPosX, lightPosY, lightPosZ, 0.0);
    gl.uniform4fv(gl.getUniformLocation(program, "u_lightPosition"), flatten(lightPosition));

    // 2. Perbarui kecerahan cahaya dengan mengalikan nilai dasar
    program.lightAmbient = scale(lightBrightness, program.baseLightAmbient);
    program.lightDiffuse = scale(lightBrightness, program.baseLightDiffuse);
    
    // Setup Proyeksi Matrix
    let projectionMatrix;
    if (projectionType === 'perspective') {
        projectionMatrix = perspective(fieldOfView, canvas.width / canvas.height, 0.1, 100);
    } else {
        const aspect = canvas.width / canvas.height;
        projectionMatrix = ortho(-zoomFactor * aspect * 0.5, zoomFactor * aspect * 0.5, -zoomFactor * 0.5, zoomFactor * 0.5, -100, 100);
    }
    gl.uniformMatrix4fv(projectionMatrixLoc, false, flatten(projectionMatrix));
    
    // Setup View Matrix (Kamera)
    let baseViewMatrix = lookAt(vec3(0, 2, zoomFactor), vec3(0, 0, 0), vec3(0, 1, 0));
    baseViewMatrix = mult(baseViewMatrix, rotate(currentRotation[0], [1, 0, 0]));
    baseViewMatrix = mult(baseViewMatrix, rotate(currentRotation[1], [0, 1, 0]));
    

    // Parameter: ambient, diffuse, specular, shininess
    const M_ORANGE = { a: vec4(0.8, 0.4, 0.0, 1.0), d: vec4(1.0, 0.5, 0.0, 1.0), s: vec4(0.8, 0.8, 0.8, 1.0), sh: 30.0 };
    const M_BLACK = { a: vec4(0.05, 0.05, 0.05, 1.0), d: vec4(0.1, 0.1, 0.1, 1.0), s: vec4(0.2, 0.2, 0.2, 1.0), sh: 10.0 };
    const M_CONCRETE = { a: vec4(0.5, 0.5, 0.5, 1.0), d: vec4(0.6, 0.6, 0.6, 1.0), s: vec4(0.1, 0.1, 0.1, 1.0), sh: 5.0 };
    const M_GREEN = { a: vec4(0.0, 0.5, 0.0, 1.0), d: vec4(0.0, 0.6, 0.0, 1.0), s: vec4(0.8, 0.8, 0.8, 1.0), sh: 100.0 };
    const M_RED = { a: vec4(0.5, 0.0, 0.0, 1.0), d: vec4(0.8, 0.0, 0.0, 1.0), s: vec4(0.8, 0.8, 0.8, 1.0), sh: 100.0 };
    const M_WHITE = { a: vec4(0.8, 0.8, 0.8, 1.0), d: vec4(1.0, 1.0, 1.0, 1.0), s: vec4(0.5, 0.5, 0.5, 1.0), sh: 20.0 };
    const M_GROUND = { a: vec4(0.3, 0.5, 0.3, 1.0), d: vec4(0.4, 0.6, 0.4, 1.0), s: vec4(0.0, 0.0, 0.0, 1.0), sh: 1.0 };

    
    // Gambar Tanah
    setMaterial(M_GROUND.a, M_GROUND.d, M_GROUND.s, M_GROUND.sh);
    drawObject(ground, mult(baseViewMatrix, translate(0, -2.05, 0)));

    // Gambar Pondasi
    setMaterial(M_CONCRETE.a, M_CONCRETE.d, M_CONCRETE.s, M_CONCRETE.sh);
    drawObject(foundation, mult(baseViewMatrix, translate(0, -1.75, 0)));
    
    // Gambar Base Unit
    setMaterial(M_ORANGE.a, M_ORANGE.d, M_ORANGE.s, M_ORANGE.sh);
    let baseMatrix = mult(baseViewMatrix, translate(0, 0, 0));
    drawObject(baseUnit, baseMatrix);
    
    // Gambar CCTV
    setMaterial(M_BLACK.a, M_BLACK.d, M_BLACK.s, M_BLACK.sh);
    let cctvHolderMatrix = mult(baseViewMatrix, translate(-1, 0.2 , 0.4));
    drawObject(cctvHolder, cctvHolderMatrix);
    
    let cctvMatrix = mult(cctvHolderMatrix, mult(translate(0, 2.25, 0), mult(rotate(cctvRotation[1], [0, 1, 0]), rotate(cctvRotation[0], [1, 0, 0]))));
    setMaterial(M_WHITE.a, M_WHITE.d, M_WHITE.s, M_WHITE.sh);
    drawObject(cctv, cctvMatrix);
    
    setMaterial(M_BLACK.a, M_BLACK.d, M_BLACK.s, M_BLACK.sh);
    drawObject(cctvLens, mult(cctvMatrix, translate(0, 0, 0.76)));
    
    setMaterial(M_RED.a, M_RED.d, M_RED.s, M_RED.sh);
    drawObject(cctvRadar, mult(cctvMatrix, mult(translate(0, 0, 0.77), rotate(90, [1, 0, 0]))));
    
    // Gambar Detail pada Base Unit
    const detailDepth = 0.51; 
    let lampMaterial = (targetGateAngle === 0.0) ? M_RED : M_GREEN;
    setMaterial(lampMaterial.a, lampMaterial.d, lampMaterial.s, lampMaterial.sh);
    drawObject(button, mult(baseMatrix, mult(translate(0.25, 1, detailDepth), rotate(90, [1, 0, 0]))));
    drawObject(button, mult(baseMatrix, mult(translate(-0.25, 1, detailDepth), rotate(90, [1, 0, 0]))));
    
    setMaterial(M_BLACK.a, M_BLACK.d, M_BLACK.s, M_BLACK.sh);
    drawObject(lineVertical, mult(baseMatrix, translate(-0.5, -0.3, detailDepth)));
    drawObject(lineVertical, mult(baseMatrix, translate(0.5, -0.3, detailDepth)));
    drawObject(lineHorizontal, mult(baseMatrix, translate(0, -0.3 + 0.75, detailDepth)));
    drawObject(lineHorizontal, mult(baseMatrix, translate(0, -0.3 - 0.75, detailDepth)));
    drawObject(keyhole, mult(baseMatrix, translate(0.3, -0.2, detailDepth)));
    
    // Gambar Palang (Arm)
    let armBaseMatrix = mult(translate(0, 1, 0), rotate(currentGateAngle, [0, 0, 1]));
    for (let i = 0; i < 7; i++) {
        let currentMaterial = (i % 2 === 0) ? M_WHITE : M_ORANGE;
        setMaterial(currentMaterial.a, currentMaterial.d, currentMaterial.s, currentMaterial.sh);
        let stripMatrix = mult(armBaseMatrix, translate(0.5 + i, 0, 0));
        drawObject(strip, mult(baseViewMatrix, stripMatrix));
    }

    requestAnimationFrame(render);
}

function setupEventListeners() {
    let hasDragged = false;
    canvas.addEventListener("mousedown", (e) => {
        dragging = true; lastX = e.clientX; lastY = e.clientY; hasDragged = false; 
    });
    canvas.addEventListener("mouseup", () => {
        dragging = false;
        if (!hasDragged) { targetGateAngle = (targetGateAngle === 0.0) ? -90.0 : 0.0; }
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
        document.getElementById('zoom-slider').value = zoomFactor;
        document.getElementById('zoom-value').textContent = zoomFactor.toFixed(1);
    });

    const autoButton = document.getElementById("auto-mode-button");
    autoButton.addEventListener("click", () => {
        isAutomaticCCTVMovement = !isAutomaticCCTVMovement;
        autoButton.textContent = isAutomaticCCTVMovement ? "Mode: Otomatis (Tekan untuk Manual)" : "Mode: Manual (Tekan untuk Otomatis)";
        if (!isAutomaticCCTVMovement) cctvRotation = [0, 0];
    });

    window.addEventListener("keydown", (e) => {
        if (e.key.startsWith("Arrow")) e.preventDefault();
        switch(e.key) {
            case "ArrowUp":    cctvMoveDirection.y = 1; break; 
            case "ArrowDown":  cctvMoveDirection.y = -1; break;
            case "ArrowLeft":  cctvMoveDirection.x = 1; break;
            case "ArrowRight": cctvMoveDirection.x = -1; break;   
        }
    });
    window.addEventListener("keyup", (e) => {
        if (e.key.startsWith("Arrow")) e.preventDefault();
        switch(e.key) {
            case "ArrowUp": case "ArrowDown": cctvMoveDirection.y = 0; break;
            case "ArrowLeft": case "ArrowRight": cctvMoveDirection.x = 0; break;
        }
    });

    const projectionSelect = document.getElementById('projection-type');
    const fovSlider = document.getElementById('fov-slider');
    const fovValue = document.getElementById('fov-value');
    const fovControl = document.getElementById('fov-control');
    const zoomSlider = document.getElementById('zoom-slider');
    const zoomValue = document.getElementById('zoom-value');

    projectionSelect.addEventListener('change', (e) => {
        projectionType = e.target.value;
        fovControl.style.display = (projectionType === 'perspective') ? 'flex' : 'none';
    });
    fovSlider.addEventListener('input', (e) => {
        fieldOfView = parseFloat(e.target.value);
        fovValue.textContent = fieldOfView + '°';
    });
    zoomSlider.addEventListener('input', (e) => {
        zoomFactor = parseFloat(e.target.value);
        zoomValue.textContent = zoomFactor.toFixed(1);
    });

        const lightXSlider = document.getElementById('light-x-slider');
    const lightXValue = document.getElementById('light-x-value');
    lightXSlider.addEventListener('input', (e) => {
        lightPosX = parseFloat(e.target.value);
        lightXValue.textContent = lightPosX;
    });

    const lightYSlider = document.getElementById('light-y-slider');
    const lightYValue = document.getElementById('light-y-value');
    lightYSlider.addEventListener('input', (e) => {
        lightPosY = parseFloat(e.target.value);
        lightYValue.textContent = lightPosY;
    });

    const lightZSlider = document.getElementById('light-z-slider');
    const lightZValue = document.getElementById('light-z-value');
    lightZSlider.addEventListener('input', (e) => {
        lightPosZ = parseFloat(e.target.value);
        lightZValue.textContent = lightPosZ;
    });
    
    const brightnessSlider = document.getElementById('brightness-slider');
    const brightnessValue = document.getElementById('brightness-value');
    brightnessSlider.addEventListener('input', (e) => {
        lightBrightness = parseFloat(e.target.value);
        brightnessValue.textContent = lightBrightness.toFixed(2);
    });
}
