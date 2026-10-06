import { Vector3, Mat4x4, Quaternion, Plane } from "./math.js";
import { Cube, ObjMesh } from "./mesh.js";
import { Color, Texture } from "./graphics.js";
import { Camera, GameObject, DirectionalLight, Rasterizer } from "./engine.js";

/** @typedef {import("./mesh.js").Triangle} Triangle */

const gameCanvas = /** @type {HTMLCanvasElement} */ (document.getElementById("gameCanvas"));
const ctx = /** @type {CanvasRenderingContext2D} */ (gameCanvas.getContext("2d"));
const asciiParagraph = /** @type {HTMLParagraphElement} */ (document.getElementById("asciiParagraph"));
const rasterizer = new Rasterizer(gameCanvas.width, gameCanvas.height, ctx, asciiParagraph);
const fov = 60;
let znear = 0.01,
    zfar = 1000;
let projectionMatrix = Mat4x4.Projection(fov, gameCanvas.height, gameCanvas.width, znear, zfar);
let camera = new Camera(new Vector3(0, 10, -10), new Vector3(-25, 0, 0), 5, 0.2);
let nearPlane = new Plane(Vector3.forward, new Vector3(0, 0, znear));
/** @type {Record<string, boolean>} */
let keyStates = {};

const asciiCheckBox = /** @type {HTMLInputElement} */ (document.getElementById("useASCII"));
const asciiResRow = /** @type {HTMLElement} */ (document.getElementById("asciiResRow"));
const canvasResRow = /** @type {HTMLElement} */ (document.getElementById("canvasResRow"));
const renderDiv = /** @type {HTMLElement} */ (document.getElementById("render"));
const mouseLookButton = /** @type {HTMLInputElement} */ (document.getElementById("mouseLookButton"));

const canvasResWidthInput = /** @type {HTMLInputElement} */ (document.getElementById("canvasResWidth"));
const canvasResHeightInput = /** @type {HTMLInputElement} */ (document.getElementById("canvasResHeight"));
const asciiResWidthInput = /** @type {HTMLInputElement} */ (document.getElementById("asciiResWidth"));
const asciiResHeightInput = /** @type {HTMLInputElement} */ (document.getElementById("asciiResHeight"));

let useASCII = false;
let asciiWidth = 260;
let asciiHeight = 195;
let canvasRenderWidth = 600;
let canvasRenderHeight = 450;

canvasResWidthInput.value = canvasRenderWidth.toString();
canvasResHeightInput.value = canvasRenderHeight.toString();

const fpsInfo = /** @type {HTMLElement} */ (document.getElementById("fps"));
let frames = 0,
    fpsTimeCounter = 0;

const mobileControls = /** @type {HTMLElement} */ (document.getElementById("mobileControls"));
const mobileControlsButton = /** @type {HTMLInputElement} */ (document.getElementById("mobileControlsButton"));

const helpButton = /** @type {HTMLInputElement} */ (document.getElementById("helpButton"));
const helpPopup = /** @type {HTMLElement} */ (document.getElementById("helpPopup"));
const helpCloseButton = /** @type {HTMLInputElement} */ (document.getElementById("helpCloseButton"));

let lookInput = { x: 0, y: 0 };
let lookSpeed = 450;

const lightDirIntensitySlider = /** @type {HTMLInputElement} */ (document.getElementById("dirIntensity"));
const lightDirIntensityText = /** @type {HTMLElement} */ (document.getElementById("dirIntensityText"));
const lightDirRotateSpeedSlider = /** @type {HTMLInputElement} */ (document.getElementById("dirRotateSpeed"));
const lightDirRotateSpeedText = /** @type {HTMLElement} */ (document.getElementById("dirRotateSpeedText"));
let dirLightDefaultDir = new Vector3(-1, -1, -1);
let dirLight = new DirectionalLight(dirLightDefaultDir, parseFloat(lightDirIntensitySlider.value));
let dirLightRotation = Quaternion.buildQuaternionEuler(Vector3.zero);
let dirLightRotateSpeed = parseFloat(lightDirRotateSpeedSlider.value);

const pointLightIntensitySlider = /** @type {HTMLInputElement} */ (document.getElementById("pointIntensity"));
const pointLightIntensityText = /** @type {HTMLElement} */ (document.getElementById("pointIntensityText"));
let pointLightIntensity = parseFloat(pointLightIntensitySlider.value);
const pointLightRangeSlider = /** @type {HTMLInputElement} */ (document.getElementById("pointRange"));
const pointLightRangeText = /** @type {HTMLElement} */ (document.getElementById("pointRangeText"));
let pointLightRange = parseFloat(pointLightRangeSlider.value);

const shadowCheckbox = /** @type {HTMLInputElement} */ (document.getElementById("useShadow"));
let useShadow = true;

let brickTexture = new Texture(
    "https://raw.githubusercontent.com/hachihao792001/hachihao792001.github.io/refs/heads/main/blogs/graphics3D/images/textures/brick.jpg",
);
let woodTexture = new Texture(
    "https://raw.githubusercontent.com/hachihao792001/hachihao792001.github.io/refs/heads/main/blogs/graphics3D/images/textures/Wood_Tower_Col.jpg",
);

let cubeMesh = new Cube();
let woodTower = new GameObject(
    new Vector3(0, -0.17, 0),
    Vector3.zero,
    new Vector3(1, 1, 1),
    new Color(255, 255, 255),
    new ObjMesh("https://raw.githubusercontent.com/hachihao792001/hachihao792001.github.io/refs/heads/main/blogs/graphics3D/models/wooden watch tower2.obj"),
    woodTexture,
);
let ground = new GameObject(new Vector3(0, 0, 0), Vector3.zero, new Vector3(30, 1, 30), new Color(0, 255, 0), cubeMesh, brickTexture);
let pointLights = [
    new GameObject(new Vector3(0, 2, 5), Vector3.zero, new Vector3(0.1, 0.1, 0.1), new Color(255, 255, 255), cubeMesh, null, "Point light 1"),
    new GameObject(new Vector3(0, 2, -5), Vector3.zero, new Vector3(0.1, 0.1, 0.1), new Color(255, 255, 255), cubeMesh, null, "Point light 2"),
];

let lastTime = performance.now();
let dt = 0;

function updateGameObjectTransforms() {
    camera.updateMovement(dt, keyStates);
    if (lookInput.x != 0 || lookInput.y != 0) {
        camera.updateRotation(lookInput.x * dt * lookSpeed, lookInput.y * dt * lookSpeed);
    }

    let q = Quaternion.buildQuaternionEuler(new Vector3(0, dt * dirLightRotateSpeed, 0));
    dirLightRotation = Quaternion.multiply(q, dirLightRotation);
    dirLight.dir = dirLightRotation.rotateVector(dirLightDefaultDir);
}

/** @returns {Triangle[]} */
function gameObjectToWorldSpaceTriangles() {
    /** @type {Triangle[]} */
    let objectTris = [];
    objectTris.push(...ground.getTransformedTrianglesWithChildren());
    for (let light of pointLights) {
        objectTris.push(...light.getTransformedTrianglesWithChildren());
    }
    objectTris.push(...woodTower.getTransformedTrianglesWithChildren());

    return objectTris;
}

/** @param {Triangle[]} objectTris */
function buildShadowMap(objectTris) {
    if (useShadow) {
        dirLight.buildViewAndProjectionMatrix();
        dirLight.buildShadowMap(objectTris);
    }
}

/**
 * @param {Triangle[]} objectTris
 * @returns {Triangle[]}
 */
function worldSpaceToViewSpace(objectTris) {
    const viewMat = camera.getViewMatrix();

    /** @type {Triangle[]} */
    let visibleTris = [];
    for (let tri of objectTris) {
        if (Vector3.dot(tri.getNormal(), Vector3.sub(tri.getCenter(), camera.transform.position)) < 0) {
            tri.mulMat4x4(viewMat);
            visibleTris.push(...tri.clipAgainstPlane(nearPlane));
        }
    }

    return visibleTris;
}

/**
 * @param {Triangle[]} visibleTris
 */
function sortNearestFirst(visibleTris) {
    for (let tri of visibleTris) {
        const vertices = tri.vertices;
        const centerX = (vertices[0].x + vertices[1].x + vertices[2].x) / 3;
        const centerY = (vertices[0].y + vertices[1].y + vertices[2].y) / 3;
        const centerZ = (vertices[0].z + vertices[1].z + vertices[2].z) / 3;
        tri.viewDistanceSquared = centerX * centerX + centerY * centerY + centerZ * centerZ;
    }
    visibleTris.sort((a, b) => a.viewDistanceSquared - b.viewDistanceSquared);
}

/** @param {Triangle[]} visibleTris */
function viewSpaceToClipSpace(visibleTris) {
    for (let tri of visibleTris) {
        tri.mulMat4x4(projectionMatrix);
        tri.perspectiveDivide();
    }
}

/** @param {Triangle[]} visibleTris */
function rasterize(visibleTris) {
    rasterizer.clearScreen();
    rasterizer.rasterizeClipSpaceTriangles(visibleTris, dirLight, pointLightIntensity, pointLights, pointLightRange, useShadow);
    rasterizer.drawCall(useASCII);

    let x = rasterizer.screenCenterX,
        y = rasterizer.screenCenterY;
    ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
    ctx.fillRect(x - 2, y - 2, 5, 5);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(x - 1, y - 1, 3, 3);
}

/** @param {number} [time] */
function update(time = performance.now()) {
    dt = (time - lastTime) / 1000;
    lastTime = time;

    fpsTimeCounter += dt;
    frames++;
    if (fpsTimeCounter >= 1) {
        fpsInfo.textContent = `FPS: ${frames}`;
        frames = 0;
        fpsTimeCounter = 0;
    }

    updateGameObjectTransforms();
    let objectTris = gameObjectToWorldSpaceTriangles();
    buildShadowMap(objectTris);
    let visibleTris = worldSpaceToViewSpace(objectTris);
    sortNearestFirst(visibleTris);
    viewSpaceToClipSpace(visibleTris);
    rasterize(visibleTris);

    requestAnimationFrame(update);
}

update();

lightDirIntensitySlider.addEventListener("input", () => {
    dirLight.intensity = parseFloat(lightDirIntensitySlider.value);
    lightDirIntensityText.textContent = dirLight.intensity.toFixed(2);
});

lightDirRotateSpeedSlider.addEventListener("input", () => {
    dirLightRotateSpeed = parseFloat(lightDirRotateSpeedSlider.value);
    lightDirRotateSpeedText.textContent = dirLightRotateSpeed.toFixed(2);
});

pointLightIntensitySlider.addEventListener("input", () => {
    pointLightIntensity = parseFloat(pointLightIntensitySlider.value);
    pointLightIntensityText.textContent = pointLightIntensity.toFixed(2);
});

pointLightRangeSlider.addEventListener("input", () => {
    pointLightRange = parseFloat(pointLightRangeSlider.value);
    pointLightRangeText.textContent = pointLightRange.toFixed(0);
});

shadowCheckbox.addEventListener("change", () => {
    useShadow = shadowCheckbox.checked;
});

/**
 *
 * @param {HTMLInputElement} input
 * @param {Number} min
 * @param {Number} max
 * @param {Number} current
 * @returns
 */
function readResolution(input, min, max, current) {
    let value = parseInt(input.value);
    if (isNaN(value)) return current;
    return Math.max(min, Math.min(max, value));
}

function updateRenderResolution() {
    gameCanvas.width = useASCII ? asciiWidth : canvasRenderWidth;
    gameCanvas.height = useASCII ? asciiHeight : canvasRenderHeight;

    projectionMatrix = Mat4x4.Projection(fov, gameCanvas.height, gameCanvas.width, znear, zfar);
    rasterizer.updateResolution(gameCanvas.width, gameCanvas.height);
}

function readAndApplyResolutionInput() {
    canvasRenderWidth = readResolution(canvasResWidthInput, 16, 1920, canvasRenderWidth);
    canvasRenderHeight = readResolution(canvasResHeightInput, 16, 1440, canvasRenderHeight);
    canvasResWidthInput.value = canvasRenderWidth.toString();
    canvasResHeightInput.value = canvasRenderHeight.toString();
    if (!useASCII) updateRenderResolution();
}
canvasResWidthInput.addEventListener("change", readAndApplyResolutionInput);
canvasResHeightInput.addEventListener("change", readAndApplyResolutionInput);

function readAndApplyASCIIResolutionInput() {
    asciiWidth = readResolution(asciiResWidthInput, 8, 500, asciiWidth);
    asciiHeight = readResolution(asciiResHeightInput, 8, 400, asciiHeight);
    asciiResWidthInput.value = asciiWidth.toString();
    asciiResHeightInput.value = asciiHeight.toString();
    if (useASCII) updateRenderResolution();
}
asciiResWidthInput.addEventListener("change", readAndApplyASCIIResolutionInput);
asciiResHeightInput.addEventListener("change", readAndApplyASCIIResolutionInput);

async function requestMouseLook() {
    try {
        await renderDiv.requestPointerLock({
            unadjustedMovement: true,
        });
    } catch (e) {
        try {
            await renderDiv.requestPointerLock();
        } catch (fallbackError) {
            // mobile
        }
    }
}

mouseLookButton.addEventListener("click", requestMouseLook);

gameCanvas.addEventListener("mousedown", () => {
    if (document.pointerLockElement !== renderDiv) requestMouseLook();
});

document.addEventListener("mousemove", (e) => {
    if (document.pointerLockElement === renderDiv) {
        camera.updateRotation(e.movementX, e.movementY);
    }
});

document.addEventListener("pointerlockchange", () => {
    mouseLookButton.textContent = document.pointerLockElement === renderDiv ? "Mouse look on - Esc to release" : "Press here to look around (ASCII)";
});

asciiCheckBox.addEventListener("change", () => {
    useASCII = asciiCheckBox.checked;
    updateRenderResolution();
    asciiParagraph.style.display = useASCII ? "" : "none";
    gameCanvas.style.display = useASCII ? "none" : "";
    mouseLookButton.style.display = useASCII ? "" : "none";
    asciiResRow.style.display = useASCII ? "" : "none";
    canvasResRow.style.display = useASCII ? "none" : "";
    if (document.pointerLockElement != null) document.exitPointerLock();
});

window.addEventListener("keydown", (e) => {
    keyStates[e.key] = true;
});
window.addEventListener("keyup", (e) => {
    keyStates[e.key] = false;
});
mobileControlsButton.addEventListener("click", () => {
    mobileControls.style.display = mobileControls.style.display == "none" ? "" : "none";
    mobileControlsButton.blur();
});

helpButton.addEventListener("click", () => {
    helpPopup.style.display = helpPopup.style.display == "none" ? "" : "none";
    helpButton.blur();
});

helpCloseButton.addEventListener("click", () => {
    helpPopup.style.display = "none";
    helpCloseButton.blur();
});

/** @type {NodeListOf<HTMLButtonElement>} */
const keyButtons = mobileControls.querySelectorAll("button[data-key]");
keyButtons.forEach((button) => {
    const key = /** @type {string} */ (button.getAttribute("data-key"));
    button.addEventListener("pointerdown", (/** @type {PointerEvent}*/ e) => {
        e.preventDefault();
        keyStates[key] = true;
        button.setPointerCapture(e.pointerId);
    });
    const release = () => {
        keyStates[key] = false;
    };
    button.addEventListener("pointerup", release);
    button.addEventListener("pointercancel", release);
});

/** @type {NodeListOf<HTMLButtonElement>} */
const lookButtons = mobileControls.querySelectorAll("button[data-look]");
lookButtons.forEach((button) => {
    if (!button.dataset.look) return;
    const dir = button.dataset.look.split(",");
    const x = parseInt(dir[0]),
        y = parseInt(dir[1]);
    let pressed = false;
    button.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        if (pressed) return;
        pressed = true;
        lookInput.x += x;
        lookInput.y += y;
        button.setPointerCapture(e.pointerId);
    });
    const release = () => {
        if (!pressed) return;
        pressed = false;
        lookInput.x -= x;
        lookInput.y -= y;
    };
    button.addEventListener("pointerup", release);
    button.addEventListener("pointercancel", release);
});
