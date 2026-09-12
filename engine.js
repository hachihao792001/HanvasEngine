import { Color } from "./graphics.js";
import { Vector2, Quaternion, Vector3, Mat4x4, MathExtend } from "./math.js";

let shadowMapSize = 512;
let shadowBias = 0.01;
let shadowMapDistance = 20;

export class Camera {
    constructor(pos, euler, speed, sensitivity) {
        this.pos = pos;
        this.rotation = Quaternion.buildQuaternionEuler(euler);
        this.speed = speed;
        this.sensitivity = sensitivity;
    }

    getFrustumCenter(customZFar = -1) {
        let forward = this.rotation.rotateVector(Vector3.forward);

        let near = Vector3.add(this.pos, Vector3.mul(forward, znear));
        if (customZFar == -1) customZFar = zfar;
        let far = Vector3.add(this.pos, Vector3.mul(forward, customZFar));
        return Vector3.div(Vector3.add(near, far), 2);
    }

    updateRotation(mouseMovementX, mouseMovementY) {
        let q = Quaternion.buildQuaternionAxisAngle(Vector3.up, -mouseMovementX * this.sensitivity);

        let right = this.rotation.rotateVector(Vector3.right);
        q = Quaternion.multiply(q, Quaternion.buildQuaternionAxisAngle(right, -mouseMovementY * this.sensitivity));

        this.rotation = Quaternion.multiply(q, this.rotation);
    }

    updateMovement(dt, keyStates) {
        let forward = this.rotation.rotateVector(Vector3.forward);
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

    getViewMatrix() {
        let forward = this.rotation.rotateVector(Vector3.forward);
        let right = this.rotation.rotateVector(Vector3.right);
        let up = this.rotation.rotateVector(Vector3.up);
        return Mat4x4.View(right, up, forward, this.pos);
    }
}

export class GameObject {
    constructor(pos, eulerAngles, scale, color, mesh, texture = null) {
        this.pos = pos;
        this.scale = scale;
        this.rotation = Quaternion.buildQuaternionEuler(eulerAngles);
        this.color = color;
        this.mesh = mesh;
        this.texture = texture;
    }

    rotate(eulerX, eulerY, eulerZ) {
        let q = Quaternion.buildQuaternionEuler(new Vector3(eulerX, eulerY, eulerZ));
        this.rotation = Quaternion.multiply(q, this.rotation);
    }

    getTransformedTriangles() {
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
    constructor(dir, intensity) {
        this.dir = dir.normalize();
        this.intensity = intensity;
        this.shadowMap = [];
        for (let i = 0; i < shadowMapSize; i++) {
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
        //let frustumCenter = camera.getFrustumCenter(shadowMapDistance);
        let frustumCenter = Vector3.zero;
        let lightPos = Vector3.sub(frustumCenter, Vector3.mul(this.dir, shadowMapDistance));
        this.viewMatrix = Mat4x4.View(right, up, this.dir, lightPos);
        this.projectionMatrix = Mat4x4.Orthographic(shadowMapDistance, 0.1, shadowMapDistance);
    }

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

            let edgeFunctionRow01 = MathExtend.edgeFunction(shadowTri.vertices[0], shadowTri.vertices[1], new Vector3(bbox[0], bbox[2], 0));
            let edgeFunctionRow12 = MathExtend.edgeFunction(shadowTri.vertices[1], shadowTri.vertices[2], new Vector3(bbox[0], bbox[2], 0));
            let edgeFunctionRow20 = MathExtend.edgeFunction(shadowTri.vertices[2], shadowTri.vertices[0], new Vector3(bbox[0], bbox[2], 0));

            for (let y = bbox[2]; y <= bbox[3]; y++) {
                let edgeFunction01 = edgeFunctionRow01;
                let edgeFunction12 = edgeFunctionRow12;
                let edgeFunction20 = edgeFunctionRow20;
                for (let x = bbox[0]; x <= bbox[1]; x++) {
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
    constructor(canvas, ctx) {
        this.canvas = canvas;
        this.ctx = ctx;
        this.imageData = ctx.createImageData(canvas.width, canvas.height);
        this.screenBuffer = [];
        this.depthBuffer = [];

        for (let i = 0; i < canvas.height; i++) {
            let screenRow = [];
            let depthRow = [];
            for (let j = 0; j < canvas.width; j++) {
                screenRow.push(new Color(255, 255, 255));
                depthRow.push(Infinity);
            }
            this.screenBuffer.push(screenRow);
            this.depthBuffer.push(depthRow);
        }
    }

    clearScreen() {
        for (let i = 0; i < this.screenBuffer.length; i++) {
            for (let j = 0; j < this.screenBuffer[i].length; j++) {
                this.screenBuffer[i][j].updateColor(240, 240, 240);
                this.depthBuffer[i][j] = Infinity;
            }
        }
    }

    rasterizeClipSpaceTriangles(tris, dirLight, pointLightIntensity, pointLightPos, useShadow) {
        for (let tri of tris) {
            let vertices = tri.vertices;
            for (let i = 0; i < vertices.length; i++) {
                vertices[i] = new Vector3(
                    vertices[i].x * (this.canvas.width / 2) + this.canvas.width / 2,
                    -vertices[i].y * (this.canvas.height / 2) + this.canvas.height / 2,
                    vertices[i].z,
                );
            }

            tri.calculateSignedDoubleArea();

            let triWorldNormal = tri.getWorldNormal();
            let dirLightDiffuse = (1 - (Vector3.dot(triWorldNormal, dirLight.dir) + 1) / 2) * dirLight.intensity;
            const bbox = tri.boundingBox(this.canvas.width, this.canvas.height);

            let edgeFunctionRow01 = MathExtend.edgeFunction(tri.vertices[0], tri.vertices[1], new Vector3(bbox[0], bbox[2], 0));
            let edgeFunctionRow12 = MathExtend.edgeFunction(tri.vertices[1], tri.vertices[2], new Vector3(bbox[0], bbox[2], 0));
            let edgeFunctionRow20 = MathExtend.edgeFunction(tri.vertices[2], tri.vertices[0], new Vector3(bbox[0], bbox[2], 0));

            let perspectiveWorldVertices = [
                Vector3.mul(tri.worldVertices[0], tri.uv[0].w),
                Vector3.mul(tri.worldVertices[1], tri.uv[1].w),
                Vector3.mul(tri.worldVertices[2], tri.uv[2].w),
            ];

            for (let y = bbox[2]; y <= bbox[3]; y++) {
                let edgeFunction01 = edgeFunctionRow01;
                let edgeFunction12 = edgeFunctionRow12;
                let edgeFunction20 = edgeFunctionRow20;
                for (let x = bbox[0]; x <= bbox[1]; x++) {
                    if (edgeFunction01 > 0 && edgeFunction12 > 0 && edgeFunction20 > 0) {
                        const baryCoord0 = edgeFunction12 / tri.signedDoubleArea;
                        const baryCoord1 = edgeFunction20 / tri.signedDoubleArea;
                        const baryCoord2 = edgeFunction01 / tri.signedDoubleArea;
                        const z = tri.vertices[0].z * baryCoord0 + tri.vertices[1].z * baryCoord1 + tri.vertices[2].z * baryCoord2;

                        if (z < this.depthBuffer[y][x]) {
                            this.depthBuffer[y][x] = z;

                            let pixelInvZ = tri.uv[0].w * baryCoord0 + tri.uv[1].w * baryCoord1 + tri.uv[2].w * baryCoord2;

                            let pixelWorldPos = new Vector3(
                                perspectiveWorldVertices[0].x * baryCoord0 +
                                    perspectiveWorldVertices[1].x * baryCoord1 +
                                    perspectiveWorldVertices[2].x * baryCoord2,
                                perspectiveWorldVertices[0].y * baryCoord0 +
                                    perspectiveWorldVertices[1].y * baryCoord1 +
                                    perspectiveWorldVertices[2].y * baryCoord2,
                                perspectiveWorldVertices[0].z * baryCoord0 +
                                    perspectiveWorldVertices[1].z * baryCoord1 +
                                    perspectiveWorldVertices[2].z * baryCoord2,
                            );
                            pixelWorldPos = Vector3.div(pixelWorldPos, pixelInvZ);

                            let inShadow = useShadow ? dirLight.isInShadow(pixelWorldPos, triWorldNormal) : false;
                            let shadowFactor = inShadow ? 0.5 : 1.0;

                            let pointLightDiffuse = 0;
                            if (pointLightIntensity > 0) {
                                let pointLightVec = Vector3.sub(pixelWorldPos, pointLightPos);
                                let distance = pointLightVec.magnitude();
                                pointLightVec.normalize();
                                pointLightDiffuse = 1 - (Vector3.dot(triWorldNormal, pointLightVec) + 1) / 2;
                                let attenuation = 1 / (1 + 0.1 * distance * distance);
                                pointLightDiffuse *= attenuation * pointLightIntensity;
                            }

                            let lightIntensity = (dirLightDiffuse + pointLightDiffuse) * shadowFactor;

                            let texColor = tri.color;
                            if (tri.texture && tri.texture.pixels) {
                                let pixelUV = new Vector2(
                                    tri.uv[0].u * baryCoord0 + tri.uv[1].u * baryCoord1 + tri.uv[2].u * baryCoord2,
                                    tri.uv[0].v * baryCoord0 + tri.uv[1].v * baryCoord1 + tri.uv[2].v * baryCoord2,
                                    pixelInvZ,
                                );
                                pixelUV = Vector2.div(pixelUV, pixelUV.w);

                                const texX = Math.floor(pixelUV.u * (tri.texture.width - 1));
                                const texY = Math.floor(pixelUV.v * (tri.texture.height - 1));
                                const texIndex = (texY * tri.texture.width + texX) * 4;
                                texColor = new Color(tri.texture.pixels[texIndex], tri.texture.pixels[texIndex + 1], tri.texture.pixels[texIndex + 2]);
                            }

                            this.screenBuffer[y][x].updateColor(
                                Math.min(255, texColor.r * lightIntensity),
                                Math.min(255, texColor.g * lightIntensity),
                                Math.min(255, texColor.b * lightIntensity),
                            );
                        }
                    }
                    edgeFunction01 += tri.vertices[0].y - tri.vertices[1].y;
                    edgeFunction12 += tri.vertices[1].y - tri.vertices[2].y;
                    edgeFunction20 += tri.vertices[2].y - tri.vertices[0].y;
                }
                edgeFunctionRow01 += tri.vertices[1].x - tri.vertices[0].x;
                edgeFunctionRow12 += tri.vertices[2].x - tri.vertices[1].x;
                edgeFunctionRow20 += tri.vertices[0].x - tri.vertices[2].x;
            }
        }
    }

    drawCall() {
        let index = 0;
        for (let y = 0; y < this.canvas.height; y++) {
            for (let x = 0; x < this.canvas.width; x++) {
                const c = this.screenBuffer[y][x];
                this.imageData.data[index++] = c.r;
                this.imageData.data[index++] = c.g;
                this.imageData.data[index++] = c.b;
                this.imageData.data[index++] = 255;
            }
        }

        this.ctx.putImageData(this.imageData, 0, 0);
    }
}
