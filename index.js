import { Vector3, Mat4x4, Quaternion, Plane } from "./math.js";
import { Cube, ObjMesh } from "./mesh.js";
import { Color, Texture } from "./graphics.js";
import { Camera, GameObject, DirectionalLight, Rasterizer } from "./engine.js";

/** @typedef {import("./mesh.js").Triangle} Triangle */

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById("gameCanvas"));
const ctx = /** @type {CanvasRenderingContext2D} */ (canvas.getContext("2d"));
const rasterizer = new Rasterizer(canvas, ctx);
const fov = 60;
let znear = 0.01,
    zfar = 1000;
let projectionMatrix = Mat4x4.Projection(fov, canvas.height, canvas.width, znear, zfar);
let camera = new Camera(new Vector3(0, 10, -10), new Vector3(-25, 0, 0), 2, 0.2);
let nearPlane = new Plane(Vector3.forward, new Vector3(0, 0, znear));
/** @type {Record<string, boolean>} */
let keyStates = {};

const fpsInfo = /** @type {HTMLElement} */ (document.getElementById("fps"));
let frames = 0,
    fpsTimeCounter = 0;

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
    new Vector3(0, 0, 0),
    Vector3.zero,
    new Vector3(1, 1, 1),
    new Color(255, 255, 255),
    new ObjMesh("https://raw.githubusercontent.com/hachihao792001/hachihao792001.github.io/refs/heads/main/blogs/graphics3D/models/wooden watch tower2.obj"),
    woodTexture,
);
let ground = new GameObject(new Vector3(0, 0, 0), Vector3.zero, new Vector3(30, 1, 30), new Color(0, 255, 0), cubeMesh, brickTexture);
let lightCube = new GameObject(new Vector3(0, 2, 5), Vector3.zero, new Vector3(0.1, 0.1, 0.1), new Color(255, 255, 255), cubeMesh);

let lastTime = performance.now();
let dt = 0;

function updateGameObjectTransforms() {
    camera.updateMovement(dt, keyStates);
    if (keyStates["i"]) {
        lightCube.pos.z += dt * 2;
    } else if (keyStates["k"]) {
        lightCube.pos.z -= dt * 2;
    } else if (keyStates["j"]) {
        lightCube.pos.x -= dt * 2;
    } else if (keyStates["l"]) {
        lightCube.pos.x += dt * 2;
    } else if (keyStates["u"]) {
        lightCube.pos.y += dt * 2;
    } else if (keyStates["o"]) {
        lightCube.pos.y -= dt * 2;
    }

    let q = Quaternion.buildQuaternionEuler(new Vector3(0, dt * dirLightRotateSpeed, 0));
    dirLightRotation = Quaternion.multiply(q, dirLightRotation);
    dirLight.dir = dirLightRotation.rotateVector(dirLightDefaultDir);
}

/** @returns {Triangle[]} */
function gameObjectToWorldSpaceTriangles() {
    /** @type {Triangle[]} */
    let objectTris = [];
    objectTris.push(...ground.getTransformedTriangles());
    objectTris.push(...lightCube.getTransformedTriangles());
    objectTris.push(...woodTower.getTransformedTriangles());

    return objectTris;
}

/**
 * @param {Triangle[]} objectTris
 * @returns {Triangle[]}
 */
function objectSpaceToViewSpace(objectTris) {
    const viewMat = camera.getViewMatrix();

    /** @type {Triangle[]} */
    let visibleTris = [];
    for (let tri of objectTris) {
        if (Vector3.dot(tri.getNormal(), Vector3.sub(tri.getCenter(), camera.pos)) < 0) {
            tri.mulMat4x4(viewMat);
            visibleTris.push(...tri.clipAgainstPlane(nearPlane));
        }
    }

    return visibleTris;
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
    rasterizer.rasterizeClipSpaceTriangles(visibleTris, dirLight, pointLightIntensity, lightCube.pos, useShadow);
    rasterizer.drawCall();
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

    if (useShadow) {
        dirLight.buildViewAndProjectionMatrix();
        dirLight.buildShadowMap(objectTris);
    }

    let visibleTris = objectSpaceToViewSpace(objectTris);
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

shadowCheckbox.addEventListener("change", () => {
    useShadow = shadowCheckbox.checked;
});

canvas.addEventListener("click", async () => {
    await canvas.requestPointerLock({
        unadjustedMovement: true,
    });
});

canvas.addEventListener("mousemove", (e) => {
    if (document.pointerLockElement === canvas) {
        camera.updateRotation(e.movementX, e.movementY);
    }
});

window.addEventListener("keydown", (e) => {
    keyStates[e.key] = true;
});
window.addEventListener("keyup", (e) => {
    keyStates[e.key] = false;
});
