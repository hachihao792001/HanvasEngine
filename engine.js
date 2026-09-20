import { Color } from "./graphics.js";
import { Quaternion, Vector3, Mat4x4, MathExtend } from "./math.js";
import { Mesh, Triangle } from "./mesh.js";
import { Texture } from "./graphics.js";

let maxActiveLights = 16;
let ambientLight = 0.2;
let shadowMapSize = 512;
let shadowBias = 0.01;
let shadowMapDistance = 20;

export class Camera {
    /**
     * @param {Vector3} pos
     * @param {Vector3} euler
     * @param {number} speed
     * @param {number} sensitivity
     */
    constructor(pos, euler, speed, sensitivity) {
        this.pos = pos;
        this.rotation = Quaternion.buildQuaternionEuler(euler);
        this.speed = speed;
        this.sensitivity = sensitivity;
    }

    /**
     * @param {number} zNear
     * @param {number} zFar
     * @param {number} customZFar
     */
    getFrustumCenter(zNear, zFar, customZFar = -1) {
        let forward = this.getForward();

        let near = Vector3.add(this.pos, Vector3.mul(forward, zNear));
        if (customZFar == -1) customZFar = zFar;
        let far = Vector3.add(this.pos, Vector3.mul(forward, customZFar));
        return Vector3.div(Vector3.add(near, far), 2);
    }

    /**
     * @param {number} mouseMovementX
     * @param {number} mouseMovementY
     */
    updateRotation(mouseMovementX, mouseMovementY) {
        let q = Quaternion.buildQuaternionAxisAngle(Vector3.up, -mouseMovementX * this.sensitivity);

        let right = this.rotation.rotateVector(Vector3.right);
        q = Quaternion.multiply(q, Quaternion.buildQuaternionAxisAngle(right, -mouseMovementY * this.sensitivity));

        this.rotation = Quaternion.multiply(q, this.rotation);
    }

    /**
     * @param {number} dt
     * @param {Record<string, boolean>} keyStates
     */
    updateMovement(dt, keyStates) {
        let forward = this.getForward();
        let right = this.rotation.rotateVector(Vector3.right);

        if (keyStates["w"]) {
            this.pos = Vector3.add(this.pos, Vector3.mul(forward, dt * this.speed));
        }
        if (keyStates["s"]) {
            this.pos = Vector3.sub(this.pos, Vector3.mul(forward, dt * this.speed));
        }
        if (keyStates["a"]) {
            this.pos = Vector3.sub(this.pos, Vector3.mul(right, dt * this.speed));
        }
        if (keyStates["d"]) {
            this.pos = Vector3.add(this.pos, Vector3.mul(right, dt * this.speed));
        }
        if (keyStates["Shift"]) {
            this.pos = Vector3.add(this.pos, Vector3.mul(Vector3.down, dt * this.speed));
        }
        if (keyStates[" "]) {
            this.pos = Vector3.add(this.pos, Vector3.mul(Vector3.up, dt * this.speed));
        }
    }

    getForward() {
        let res = this.rotation.rotateVector(Vector3.forward);
        res.normalize();
        return res;
    }

    getViewMatrix() {
        return Mat4x4.ViewFromPosRot(this.pos, this.rotation);
    }
}

export class GameObject {
    static incrementingID = 0;

    /**
     * @param {Vector3} pos
     * @param {Vector3} eulerAngles
     * @param {Vector3} scale
     * @param {Color} color
     * @param {Mesh} mesh
     * @param {Texture | null} [texture]
     * @param {string} [name]
     */
    constructor(pos, eulerAngles, scale, color, mesh, texture = null, name = "") {
        this.id = GameObject.incrementingID++;
        this.name = name || `GameObject ${this.id}`;
        this.pos = pos;
        this.scale = scale;
        this.rotation = Quaternion.buildQuaternionEuler(eulerAngles);
        this.color = color;
        this.mesh = mesh;
        this.texture = texture;
    }

    /**
     * @param {number} eulerX
     * @param {number} eulerY
     * @param {number} eulerZ
     */
    rotate(eulerX, eulerY, eulerZ) {
        let q = Quaternion.buildQuaternionEuler(new Vector3(eulerX, eulerY, eulerZ));
        this.rotation = Quaternion.multiply(q, this.rotation);
    }

    getForward() {
        return this.rotation.rotateVector(Vector3.forward);
    }

    /** @returns {Triangle[]} */
    getTransformedTriangles() {
        /** @type {Triangle[]} */
        let transformedTris = [];
        for (let tri of this.mesh.tris) {
            let transformedTri = tri.clone();
            transformedTri.mulMat4x4(Mat4x4.Scale(this.scale.x, this.scale.y, this.scale.z));
            transformedTri.rotate(this.rotation);
            transformedTri.mulMat4x4(Mat4x4.Translation(this.pos.x, this.pos.y, this.pos.z));
            transformedTri.updateWorldVertices();
            transformedTri.texture = this.texture;
            transformedTris.push(transformedTri);
        }
        return transformedTris;
    }
}

export class DirectionalLight {
    /**
     * @param {Vector3} dir
     * @param {number} intensity
     */
    constructor(dir, intensity) {
        this.dir = dir.normalize();
        this.intensity = intensity;
        this.viewMatrix = new Mat4x4();
        this.projectionMatrix = new Mat4x4();
        /** @type {number[][]} */
        this.shadowMap = [];
        for (let i = 0; i < shadowMapSize; i++) {
            /** @type {number[]} */
            let row = [];
            for (let j = 0; j < shadowMapSize; j++) {
                row.push(Infinity);
            }
            this.shadowMap.push(row);
        }
    }

    buildViewAndProjectionMatrix() {
        let up = Math.abs(Vector3.dot(this.dir, Vector3.up)) < 0.99 ? Vector3.up : Vector3.forward;
        let right = Vector3.cross(up, this.dir).normalize();
        up = Vector3.cross(this.dir, right).normalize();
        //let frustumCenter = camera.getFrustumCenter(znear, zfar, shadowMapDistance);
        let frustumCenter = Vector3.zero;
        let lightPos = Vector3.sub(frustumCenter, Vector3.mul(this.dir, shadowMapDistance));
        this.viewMatrix = Mat4x4.View(right, up, this.dir, lightPos);
        this.projectionMatrix = Mat4x4.Orthographic(shadowMapDistance, 0.1, shadowMapDistance);
    }

    /** @param {Triangle[]} tris */
    buildShadowMap(tris) {
        for (let i = 0; i < shadowMapSize; i++) {
            for (let j = 0; j < shadowMapSize; j++) {
                this.shadowMap[i][j] = Infinity;
            }
        }

        for (let tri of tris) {
            let shadowTri = tri.clone();

            if (Vector3.dot(tri.getWorldNormal(), this.dir) >= 0) continue;

            shadowTri.mulMat4x4(this.viewMatrix);
            shadowTri.mulMat4x4(this.projectionMatrix);
            shadowTri.perspectiveDivide();

            for (let i = 0; i < shadowTri.vertices.length; i++) {
                shadowTri.vertices[i].x = ((shadowTri.vertices[i].x + 1) * shadowMapSize) / 2;
                shadowTri.vertices[i].y = ((-shadowTri.vertices[i].y + 1) * shadowMapSize) / 2;
            }

            const bbox = shadowTri.boundingBox(shadowMapSize, shadowMapSize);

            shadowTri.calculateSignedDoubleArea();

            let edgeFunctionRow01 = MathExtend.edgeFunction(shadowTri.vertices[0], shadowTri.vertices[1], new Vector3(bbox.minX, bbox.minY, 0));
            let edgeFunctionRow12 = MathExtend.edgeFunction(shadowTri.vertices[1], shadowTri.vertices[2], new Vector3(bbox.minX, bbox.minY, 0));
            let edgeFunctionRow20 = MathExtend.edgeFunction(shadowTri.vertices[2], shadowTri.vertices[0], new Vector3(bbox.minX, bbox.minY, 0));

            for (let y = bbox.minY; y <= bbox.maxY; y++) {
                let edgeFunction01 = edgeFunctionRow01;
                let edgeFunction12 = edgeFunctionRow12;
                let edgeFunction20 = edgeFunctionRow20;
                for (let x = bbox.minX; x <= bbox.maxX; x++) {
                    if (edgeFunction01 > 0 && edgeFunction12 > 0 && edgeFunction20 > 0) {
                        const baryCoord0 = edgeFunction12 / shadowTri.signedDoubleArea;
                        const baryCoord1 = edgeFunction20 / shadowTri.signedDoubleArea;
                        const baryCoord2 = edgeFunction01 / shadowTri.signedDoubleArea;
                        const z = shadowTri.vertices[0].z * baryCoord0 + shadowTri.vertices[1].z * baryCoord1 + shadowTri.vertices[2].z * baryCoord2;
                        if (z < this.shadowMap[y][x]) {
                            this.shadowMap[y][x] = z;
                        }
                    }
                    edgeFunction01 += shadowTri.vertices[0].y - shadowTri.vertices[1].y;
                    edgeFunction12 += shadowTri.vertices[1].y - shadowTri.vertices[2].y;
                    edgeFunction20 += shadowTri.vertices[2].y - shadowTri.vertices[0].y;
                }
                edgeFunctionRow01 += shadowTri.vertices[1].x - shadowTri.vertices[0].x;
                edgeFunctionRow12 += shadowTri.vertices[2].x - shadowTri.vertices[1].x;
                edgeFunctionRow20 += shadowTri.vertices[0].x - shadowTri.vertices[2].x;
            }
        }
    }

    /**
     * @param {Vector3} pixelWorldPos
     * @param {Vector3} triWorldNormal
     */
    isInShadow(pixelWorldPos, triWorldNormal) {
        let dotProduct = Vector3.dot(triWorldNormal, this.dir);
        if (dotProduct >= 0) return false;

        let texelSize = shadowMapDistance / shadowMapSize;
        let normalOffset = texelSize * (1 - Math.abs(dotProduct));

        let lightSpacePos = Vector3.add(pixelWorldPos, Vector3.mul(triWorldNormal, normalOffset));
        lightSpacePos.mulMat4x4(this.viewMatrix);
        lightSpacePos.mulMat4x4(this.projectionMatrix);

        lightSpacePos = Vector3.div(lightSpacePos, lightSpacePos.w);

        const x = Math.floor(((lightSpacePos.x + 1) * shadowMapSize) / 2);
        const y = Math.floor(((-lightSpacePos.y + 1) * shadowMapSize) / 2);

        if (x < 0 || x >= shadowMapSize || y < 0 || y >= shadowMapSize) return false;

        return lightSpacePos.z > this.shadowMap[y][x] + shadowBias;
    }
}

export class Rasterizer {
    /**
     * @param {Number} canvasWidth
     * @param {Number} canvasHeight
     * @param {CanvasRenderingContext2D} ctx
     * @param {HTMLParagraphElement} asciiParagraph
     */
    constructor(canvasWidth, canvasHeight, ctx, asciiParagraph) {
        this.canvasWidth = canvasWidth;
        this.canvasHeight = canvasHeight;
        this.ctx = ctx;
        this.asciiParagraph = asciiParagraph;

        this.imageData = this.ctx.createImageData(this.canvasWidth, this.canvasHeight);
        this.screenBuffer = this.imageData.data;
        this.depthBuffer = new Float64Array(this.canvasWidth * this.canvasHeight);

        this.screenBuffer.fill(255);
        this.depthBuffer.fill(Infinity);

        /** @type {Vector3[]} */
        this.activeLights = new Array(maxActiveLights);
    }

    /**
     *
     * @param {Number} canvasWidth
     * @param {Number} canvasHeight
     */
    resize(canvasWidth, canvasHeight) {
        this.canvasWidth = canvasWidth;
        this.canvasHeight = canvasHeight;

        this.imageData = this.ctx.createImageData(this.canvasWidth, this.canvasHeight);
        this.screenBuffer = this.imageData.data;
        this.depthBuffer = new Float64Array(this.canvasWidth * this.canvasHeight);

        this.screenBuffer.fill(255);
        this.depthBuffer.fill(Infinity);
    }

    clearScreen() {
        this.screenBuffer.fill(244);
        this.depthBuffer.fill(Infinity);
    }

    /**
     * @param {Triangle[]} tris
     * @param {DirectionalLight} dirLight
     * @param {number} pointLightIntensity
     * @param {GameObject[]} pointLights
     * @param {Number} pointLightRange
     * @param {boolean} useShadow
     */
    rasterizeClipSpaceTriangles(tris, dirLight, pointLightIntensity, pointLights, pointLightRange, useShadow) {
        const screenBuffer = this.screenBuffer;
        const depthBuffer = this.depthBuffer;
        const canvasWidth = this.canvasWidth;
        const canvasHeight = this.canvasHeight;
        const activeLights = this.activeLights;
        const pointLightRange2 = pointLightRange * pointLightRange;

        for (let tri of tris) {
            let vertices = tri.vertices;
            for (let i = 0; i < vertices.length; i++) {
                vertices[i] = new Vector3(
                    vertices[i].x * (canvasWidth / 2) + canvasWidth / 2,
                    -vertices[i].y * (canvasHeight / 2) + canvasHeight / 2,
                    vertices[i].z,
                );
            }

            tri.calculateSignedDoubleArea();
            const signedDoubleArea = tri.signedDoubleArea;

            const triWorldNormal = tri.getWorldNormal();
            const worldNormalX = triWorldNormal.x,
                worldNormalY = triWorldNormal.y,
                worldNormalZ = triWorldNormal.z;

            const dirLightDiffuse = (1 - (Vector3.dot(triWorldNormal, dirLight.dir) + 1) / 2) * dirLight.intensity;
            const activeLightCount = pointLightIntensity > 0 ? tri.getPointLightsThatCanAffectTri(pointLightRange, pointLights, activeLights) : 0;

            const bbox = tri.boundingBox(canvasWidth, canvasHeight);

            let edgeFunctionRow01 = MathExtend.edgeFunction(tri.vertices[0], tri.vertices[1], new Vector3(bbox.minX, bbox.minY, 0));
            let edgeFunctionRow12 = MathExtend.edgeFunction(tri.vertices[1], tri.vertices[2], new Vector3(bbox.minX, bbox.minY, 0));
            let edgeFunctionRow20 = MathExtend.edgeFunction(tri.vertices[2], tri.vertices[0], new Vector3(bbox.minX, bbox.minY, 0));

            // everything the per pixel loop needs, read once instead of once per pixel
            const vertex0 = tri.vertices[0],
                vertex1 = tri.vertices[1],
                vertex2 = tri.vertices[2];
            const vertex0Z = vertex0.z,
                vertex1Z = vertex1.z,
                vertex2Z = vertex2.z;

            const edgeSlopeX01 = vertex0.y - vertex1.y;
            const edgeSlopeX12 = vertex1.y - vertex2.y;
            const edgeSlopeX20 = vertex2.y - vertex0.y;
            const edgeSlopeY01 = vertex1.x - vertex0.x;
            const edgeSlopeY12 = vertex2.x - vertex1.x;
            const edgeSlopeY20 = vertex0.x - vertex2.x;

            const uv0 = tri.uv[0],
                uv1 = tri.uv[1],
                uv2 = tri.uv[2];
            const uv0U = uv0.u,
                uv1U = uv1.u,
                uv2U = uv2.u;
            const uv0V = uv0.v,
                uv1V = uv1.v,
                uv2V = uv2.v;
            const uv0W = uv0.w,
                uv1W = uv1.w,
                uv2W = uv2.w;

            const world0 = tri.worldVertices[0],
                world1 = tri.worldVertices[1],
                world2 = tri.worldVertices[2];
            const perspectiveWorld0X = world0.x * uv0W,
                perspectiveWorld0Y = world0.y * uv0W,
                perspectiveWorld0Z = world0.z * uv0W;
            const perspectiveWorld1X = world1.x * uv1W,
                perspectiveWorld1Y = world1.y * uv1W,
                perspectiveWorld1Z = world1.z * uv1W;
            const perspectiveWorld2X = world2.x * uv2W,
                perspectiveWorld2Y = world2.y * uv2W,
                perspectiveWorld2Z = world2.z * uv2W;

            const triColor = tri.color;
            const texture = tri.texture;
            const texturePixels = texture ? texture.pixels : null;
            const textureWidth = texture ? texture.width : 0,
                textureHeight = texture ? texture.height : 0;

            for (let y = bbox.minY; y <= bbox.maxY; y++) {
                let edgeFunction01 = edgeFunctionRow01;
                let edgeFunction12 = edgeFunctionRow12;
                let edgeFunction20 = edgeFunctionRow20;
                let pixelIndex = y * canvasWidth + bbox.minX;
                for (let x = bbox.minX; x <= bbox.maxX; x++) {
                    if (edgeFunction01 > 0 && edgeFunction12 > 0 && edgeFunction20 > 0) {
                        const baryCoord0 = edgeFunction12 / signedDoubleArea;
                        const baryCoord1 = edgeFunction20 / signedDoubleArea;
                        const baryCoord2 = edgeFunction01 / signedDoubleArea;
                        const z = vertex0Z * baryCoord0 + vertex1Z * baryCoord1 + vertex2Z * baryCoord2;

                        if (z < depthBuffer[pixelIndex]) {
                            depthBuffer[pixelIndex] = z;

                            const pixelInvZ = uv0W * baryCoord0 + uv1W * baryCoord1 + uv2W * baryCoord2;

                            const pixelWorldX =
                                (perspectiveWorld0X * baryCoord0 + perspectiveWorld1X * baryCoord1 + perspectiveWorld2X * baryCoord2) / pixelInvZ;
                            const pixelWorldY =
                                (perspectiveWorld0Y * baryCoord0 + perspectiveWorld1Y * baryCoord1 + perspectiveWorld2Y * baryCoord2) / pixelInvZ;
                            const pixelWorldZ =
                                (perspectiveWorld0Z * baryCoord0 + perspectiveWorld1Z * baryCoord1 + perspectiveWorld2Z * baryCoord2) / pixelInvZ;

                            let shadowFactor = 1.0;
                            if (useShadow && dirLight.isInShadow(new Vector3(pixelWorldX, pixelWorldY, pixelWorldZ), triWorldNormal)) {
                                shadowFactor = 0.5;
                            }

                            let totalPointLightDiffuse = 0;
                            if (pointLightIntensity > 0) {
                                for (let i = 0; i < activeLightCount; i++) {
                                    const lightPos = activeLights[i];
                                    const pointLightVecX = lightPos.x - pixelWorldX;
                                    const pointLightVecY = lightPos.y - pixelWorldY;
                                    const pointLightVecZ = lightPos.z - pixelWorldZ;
                                    const distanceFromPixelToPointLight2 =
                                        pointLightVecX * pointLightVecX + pointLightVecY * pointLightVecY + pointLightVecZ * pointLightVecZ;
                                    if (distanceFromPixelToPointLight2 >= pointLightRange2) continue;

                                    const distance = Math.sqrt(distanceFromPixelToPointLight2);
                                    const dot = (worldNormalX * pointLightVecX + worldNormalY * pointLightVecY + worldNormalZ * pointLightVecZ) / distance;
                                    const currentPointLightDiffuse = (1 + dot) / 2;
                                    const pointLightDistanceRatio = distanceFromPixelToPointLight2 / pointLightRange2;
                                    const inverseSquareDistance = 1 / (1 + 0.02 * distanceFromPixelToPointLight2);
                                    const attenuation = (1 - pointLightDistanceRatio) * inverseSquareDistance;
                                    totalPointLightDiffuse += currentPointLightDiffuse * attenuation;
                                }
                                totalPointLightDiffuse *= pointLightIntensity;
                            }

                            const lightIntensity = Math.max(ambientLight, (dirLightDiffuse + totalPointLightDiffuse) * shadowFactor);

                            let texR = triColor.r,
                                texG = triColor.g,
                                texB = triColor.b;
                            if (texturePixels) {
                                const pixelU = (uv0U * baryCoord0 + uv1U * baryCoord1 + uv2U * baryCoord2) / pixelInvZ;
                                const pixelV = (uv0V * baryCoord0 + uv1V * baryCoord1 + uv2V * baryCoord2) / pixelInvZ;
                                const texX = Math.floor(pixelU * (textureWidth - 1));
                                const texY = Math.floor(pixelV * (textureHeight - 1));
                                const texIndex = (texY * textureWidth + texX) * 4;
                                texR = texturePixels[texIndex];
                                texG = texturePixels[texIndex + 1];
                                texB = texturePixels[texIndex + 2];
                            }

                            const colorIndex = pixelIndex * 4;
                            screenBuffer[colorIndex] = Math.min(255, texR * lightIntensity);
                            screenBuffer[colorIndex + 1] = Math.min(255, texG * lightIntensity);
                            screenBuffer[colorIndex + 2] = Math.min(255, texB * lightIntensity);
                        }
                    }
                    edgeFunction01 += edgeSlopeX01;
                    edgeFunction12 += edgeSlopeX12;
                    edgeFunction20 += edgeSlopeX20;
                    pixelIndex++;
                }
                edgeFunctionRow01 += edgeSlopeY01;
                edgeFunctionRow12 += edgeSlopeY12;
                edgeFunctionRow20 += edgeSlopeY20;
            }
        }
    }

    drawCall(useASCII = false) {
        if (!useASCII) {
            this.ctx.putImageData(this.imageData, 0, 0);
        } else {
            let renderString = "";
            let grayScaleASCII = "$@B%8&WM#*oahkbdpqwmZO0QLCJUYXzcvunxrjft/\\|()1{}[]?-_+~<>i!lI;:,\"^`'. ";
            for (let y = 0; y < this.canvasHeight; y++) {
                for (let x = 0; x < this.canvasWidth; x++) {
                    let index = (y * this.canvasWidth + x) * 4;
                    let color = new Color(this.imageData.data[index], this.imageData.data[index + 1], this.imageData.data[index + 2]);
                    let grayScale01 = color.grayScale01();
                    let pixelLetter = grayScaleASCII[Math.floor((1 - grayScale01) * (grayScaleASCII.length - 1))];
                    renderString += pixelLetter;
                }
                renderString += "\n";
            }

            if (this.asciiParagraph != null && this.asciiParagraph.innerText != renderString) this.asciiParagraph.innerText = renderString;
        }
    }
}
