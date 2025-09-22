"use strict";

let gl;
let canvas;
let program;

// Variabel untuk menampung buffer objek
let baseUnit, strip, button, keyhole, lineVertical, lineHorizontal, foundation, cctvHolder, cctv, cctvLens, cctvRadar;

// Variabel Matriks
let modelViewMatrix, projectionMatrix;
let modelViewMatrixLoc, projectionMatrixLoc;

// Variabel untuk interaksi kamera
let dragging = false;
let lastX = -1, lastY = -1;
let currentRotation = [20, -30];
let zoomFactor = 15.0;
let cctvMoveDirection = { x: 0, y: 0 };
let cctvRotation = [0, 0];
let isAutomaticCCTVMovement = false;

// Variabel untuk animasi palang (arm)
let targetGateAngle = 0.0;
let currentGateAngle = 0.0;

// Fungsi helper untuk membuat balok (cuboid)
function createCuboid(width, height, depth) {
    const w = width / 2;
    const h = height / 2;
    const d = depth / 2;

    const vertices = [
        vec4(-w, -h,  d, 1.0), vec4( w, -h,  d, 1.0),
        vec4( w,  h,  d, 1.0), vec4(-w,  h,  d, 1.0),
        vec4(-w, -h, -d, 1.0), vec4( w, -h, -d, 1.0),
        vec4( w,  h, -d, 1.0), vec4(-w,  h, -d, 1.0)
    ];

    const indices = new Uint16Array([
        1, 0, 3, 1, 3, 2, 0, 4, 7, 0, 7, 3,
        1, 5, 6, 1, 6, 2, 4, 5, 1, 4, 1, 0,
        6, 7, 4, 6, 4, 5, 2, 6, 7, 2, 7, 3
    ]);
    
    const vBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, flatten(vertices), gl.STATIC_DRAW);

    const iBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, iBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);

    return {
        vertexBuffer: vBuffer,
        indexBuffer: iBuffer,
        indexCount: indices.length
    };
}

// Fungsi helper untuk membuat silinder (tidak ada perubahan)
function createCylinder(radius, height, segments) {
    const cylinderVertices = [];
    const cylinderIndices = [];
    cylinderVertices.push(vec4(0, -height / 2, 0, 1.0));
    for (let i = 0; i < segments; i++) {
        const angle = (i / segments) * Math.PI * 2;
        cylinderVertices.push(vec4(radius * Math.cos(angle), -height / 2, radius * Math.sin(angle), 1.0));
    }
    cylinderVertices.push(vec4(0, height / 2, 0, 1.0));
    for (let i = 0; i < segments; i++) {
        const angle = (i / segments) * Math.PI * 2;
        cylinderVertices.push(vec4(radius * Math.cos(angle), height / 2, radius * Math.sin(angle), 1.0));
    }
    const baseOffset = 1;
    for (let i = 0; i < segments; i++) {
        cylinderIndices.push(0, baseOffset + i, baseOffset + (i + 1) % segments);
    }
    const topCenterOffset = segments + 1;
    const topOffset = topCenterOffset + 1;
    for (let i = 0; i < segments; i++) {
        cylinderIndices.push(topCenterOffset, topOffset + (i + 1) % segments, topOffset + i);
    }
    for (let i = 0; i < segments; i++) {
        const i0 = baseOffset + i;
        const i1 = baseOffset + (i + 1) % segments;
        const i2 = topOffset + (i + 1) % segments;
        const i3 = topOffset + i;
        cylinderIndices.push(i0, i1, i2);
        cylinderIndices.push(i0, i2, i3);
    }
    const vBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, flatten(cylinderVertices), gl.STATIC_DRAW);
    const iBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, iBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(cylinderIndices), gl.STATIC_DRAW);
    return { vertexBuffer: vBuffer, indexBuffer: iBuffer, indexCount: cylinderIndices.length };
}


function main() {
    canvas = document.getElementById("gl-canvas");
    gl = canvas.getContext("webgl");
    if (!gl) { alert("WebGL tidak tersedia."); return; }

    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0.8, 0.9, 1.0, 1.0);
    gl.enable(gl.DEPTH_TEST);

    program = initShaders(gl, "vertex-shader", "fragment-shader");
    gl.useProgram(program);
    const autoButton = document.getElementById("auto-mode-button");
    
    // === Inisialisasi Geometri Barrier Gate dan Detailnya ===
    baseUnit = createCuboid(1.5, 3.0, 1.0); 
    strip = createCuboid(1.0, 0.3, 0.3);

    // Detail baru
    button = createCylinder(0.150, 0.05, 18);
    keyhole = createCuboid(0.1, 0.2, 0.1);
    lineVertical = createCuboid(0.05, 1.5, 0.05);
    lineHorizontal = createCuboid(1.0, 0.05, 0.05);
    foundation = createCuboid(1.8, 0.5, 1.2);
    cctvHolder = createCuboid(0.2, 4.5, 0.2);
    cctv = createCuboid(0.80, 0.80, 1.55);
    cctvLens = createCuboid(0.45, 0.45, 0.05);
    cctvRadar = createCylinder(0.07, 0.05, 18);

    program.a_Position = gl.getAttribLocation(program, "a_Position");
    program.a_Color = gl.getAttribLocation(program, "a_Color");
    modelViewMatrixLoc = gl.getUniformLocation(program, "u_modelViewMatrix");
    projectionMatrixLoc = gl.getUniformLocation(program, "u_projectionMatrix");
    
    gl.enableVertexAttribArray(program.a_Position);

    projectionMatrix = perspective(50, canvas.width / canvas.height, 0.1, 100);
    gl.uniformMatrix4fv(projectionMatrixLoc, false, flatten(projectionMatrix));
    
    setupEventListeners();
    render();
}

function drawObject(obj, color, transformationMatrix) {
    gl.bindBuffer(gl.ARRAY_BUFFER, obj.vertexBuffer);
    gl.vertexAttribPointer(program.a_Position, 4, gl.FLOAT, false, 0, 0);
    gl.vertexAttrib4fv(program.a_Color, flatten(color));
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, obj.indexBuffer);
    gl.uniformMatrix4fv(modelViewMatrixLoc, false, flatten(transformationMatrix));
    gl.drawElements(gl.TRIANGLES, obj.indexCount, gl.UNSIGNED_SHORT, 0);
}

function render() {
    currentGateAngle += (targetGateAngle - currentGateAngle) * 0.05;


    if (isAutomaticCCTVMovement) {
        const swingSpeed = 0.5;
        const maxAngle = 45;
        cctvRotation[1] = Math.sin(Date.now() / 1000 * swingSpeed) * maxAngle;
    }
    else{
        const cctvMoveSpeed = 0.5;
        cctvRotation[0] += cctvMoveDirection.y * cctvMoveSpeed; 
        cctvRotation[1] += cctvMoveDirection.x * cctvMoveSpeed; 

    // Batasi rotasi vertikal (tilt) antara -45 dan 45 derajat
        cctvRotation[0] = Math.max(-45, Math.min(45, cctvRotation[0]));
    // Batasi rotasi horizontal (pan) antara -45 dan 45 derajat
        cctvRotation[1] = Math.max(-45, Math.min(45, cctvRotation[1]));
    }


    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    let baseViewMatrix = lookAt(vec3(0, 2, zoomFactor), vec3(0, 0, 0), vec3(0, 1, 0));
    baseViewMatrix = mult(baseViewMatrix, rotate(currentRotation[0], [1, 0, 0]));
    baseViewMatrix = mult(baseViewMatrix, rotate(currentRotation[1], [0, 1, 0]));
    
    // Gambar Lantai/Tanah
    const ground = createCuboid(20, 0.1, 20);
    const groundColor = vec4(0.4, 0.6, 0.4, 1.0);
    // Posisi tanah disesuaikan agar pas di bawah pondasi
    let groundMatrix = mult(baseViewMatrix, translate(0, -2.05, 0)); 
    drawObject(ground, groundColor, groundMatrix);

    // === Gambar Barrier Gate ===
    const orangeColor = vec4(1.0, 0.5, 0.0, 1.0); 
    const blackColor = vec4(0.1, 0.1, 0.1, 1.0);
    const concreteColor = vec4(0.6, 0.6, 0.6, 1.0);
    const greenColor = vec4(0.0, 0.6, 0.0, 1.0);
    const redColor = vec4(0.6, 0.0, 0.0, 1.0);
    const whiteColor1 = vec4(1.0, 1.0, 1.0, 1.0);
    
    // 1. Gambar Pondasi terlebih dahulu
    let foundationMatrix = mult(baseViewMatrix, translate(0, -1.75, 0));
    drawObject(foundation, concreteColor, foundationMatrix);

    // 2. Gambar Kotak Mesin (Base Unit) di atas pondasi
    let baseMatrix = mult(baseViewMatrix, translate(0, 0, 0));
    drawObject(baseUnit, orangeColor, baseMatrix);


    // 3. Gambar CCTV di atas kotak mesin


    let cctvHolderMatrix = mult(baseViewMatrix, translate(-1, 0.2 , 0.4));
    drawObject(cctvHolder, blackColor, cctvHolderMatrix);

    let cctvMatrix = mult(cctvHolderMatrix, translate(0, 2.25, 0));
    cctvMatrix = mult(cctvMatrix, rotate(cctvRotation[1], [0, 1, 0])); 
    cctvMatrix = mult(cctvMatrix, rotate(cctvRotation[0], [1, 0, 0])); 
    drawObject(cctv, whiteColor1, cctvMatrix);

    let cctvLensMatrix = mult(cctvMatrix, translate(0, 0, -0.76));
    drawObject(cctvLens, blackColor, cctvLensMatrix);
    let cctvRadarMatrix = mult(cctvMatrix, translate(0, 0, -0.77));
    cctvRadarMatrix = mult(cctvRadarMatrix, rotate(90, [1, 0, 0]));
    drawObject(cctvRadar, redColor, cctvRadarMatrix);


    // 4. Gambar Kotak Detail di depan kotak mesin
    const detailDepth = -0.51; 

    // Tombol Bulat Hitam di atas
    let lamp;
    if(targetGateAngle === 0.0){
        lamp = redColor;
    } else {
        lamp = greenColor;
    }
    let buttonMatrix = mult(baseMatrix, translate(0.25, 1, detailDepth)); 
    buttonMatrix = mult(buttonMatrix, rotate(90, [1, 0, 0])); 
    drawObject(button, lamp, buttonMatrix);

    let buttonMatrix2 = mult(baseMatrix, translate(-0.25, 1, detailDepth)); 
    buttonMatrix2 = mult(buttonMatrix2, rotate(90, [1, 0, 0])); 
    drawObject(button, lamp, buttonMatrix2);

    // Garis/Lekukan Persegi Panjang
    const lineCenterY = -0.3; 
    
    // Garis Vertikal Kiri & Kanan
    let vLineLeftMatrix = mult(baseMatrix, translate(-0.5, lineCenterY, detailDepth));
    drawObject(lineVertical, blackColor, vLineLeftMatrix);
    let vLineRightMatrix = mult(baseMatrix, translate(0.5, lineCenterY, detailDepth));
    drawObject(lineVertical, blackColor, vLineRightMatrix);

    // Garis Horizontal Atas & Bawah
    let hLineTopMatrix = mult(baseMatrix, translate(0, lineCenterY + 0.75, detailDepth));
    drawObject(lineHorizontal, blackColor, hLineTopMatrix);
    let hLineBottomMatrix = mult(baseMatrix, translate(0, lineCenterY - 0.75, detailDepth));
    drawObject(lineHorizontal, blackColor, hLineBottomMatrix);

    // Lubang Kunci (Keyhole)
    let keyholeMatrix = mult(baseMatrix, translate(0.3, -0.2, detailDepth));
    drawObject(keyhole, blackColor, keyholeMatrix);

    // === Gambar Palang (Arm) dengan Pola Selang-seling ===
    const whiteColor = vec4(1.0, 1.0, 1.0, 1.0);
    const numStrips = 7;
    
    // Posisi engsel disesuaikan dengan tinggi kotak mesin yang baru
    let armBaseMatrix = translate(0, 1, 0);
    armBaseMatrix = mult(armBaseMatrix, rotate(currentGateAngle, [0, 0, 1]));

    for (let i = 0; i < numStrips; i++) {
        let currentColor = (i % 2 === 0) ? whiteColor : orangeColor;
        const stripPositionX = 0.5 + i;
        let stripMatrix = mult(armBaseMatrix, translate(stripPositionX, 0, 0));
        let finalStripMatrix = mult(baseViewMatrix, stripMatrix);
        drawObject(strip, currentColor, finalStripMatrix);
    }

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
            if (targetGateAngle === 0.0) {
                targetGateAngle = -90.0;
            } else {
                targetGateAngle = 0.0;
            }
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
    });

        const autoButton = document.getElementById("auto-mode-button");
    

    autoButton.addEventListener("click", () => {
        isAutomaticCCTVMovement = !isAutomaticCCTVMovement;


        if (isAutomaticCCTVMovement) {
            autoButton.textContent = "Mode: Otomatis (Tekan untuk Manual)";
        } else {
            autoButton.textContent = "Mode: Manual (Tekan untuk Otomatis)";
            cctvRotation = [0, 0];
        }
    });

    window.addEventListener("keydown", (e) => {
        e.preventDefault(); 
        switch(e.key) {
            case "ArrowUp":   cctvMoveDirection.y = -1; break; 
            case "ArrowDown": cctvMoveDirection.y = 1; break;
            case "ArrowLeft": cctvMoveDirection.x = 1; break;
            case "ArrowRight":cctvMoveDirection.x = -1; break;  
        }
    });

    window.addEventListener("keyup", (e) => {
        e.preventDefault();
        switch(e.key) {
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
}