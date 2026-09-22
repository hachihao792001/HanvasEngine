import { Vector3, Quaternion, Mat4x4, Plane, BoundingBox } from "./math.js";
import { Cube, Quad } from "./mesh.js";
import { Color, Texture } from "./graphics.js";
import { Camera, GameObject, Rasterizer } from "./engine.js";

/** @typedef {import("./mesh.js").Triangle} Triangle */
/** @typedef {import("./engine.js").DirectionalLight} DirectionalLight */

/**
 * @typedef {Object} RenderSettings
 * @property {number} canvasWidth
 * @property {number} canvasHeight
 * @property {Mat4x4} projectionMatrix
 * @property {Plane} nearPlane
 * @property {number} portalLimit
 * @property {DirectionalLight} dirLight
 * @property {number} pointLightIntensity
 * @property {GameObject[]} pointLights
 * @property {number} pointLightRange
 */

const portalEdgeCubeMesh = new Cube();
const portalBackQuadMesh = new Quad();

export class Portal extends GameObject {
    static edgeThickness = 0.1;

    /**
     * @param {string} name
     * @param {Vector3} pos
     * @param {Vector3} eulerAngles
     * @param {Vector3} scale
     * @param {Color} color
     * @param {number} canvasWidth
     * @param {number} canvasHeight
     * @param {CanvasRenderingContext2D} ctx
     */
    constructor(name, pos, eulerAngles, scale, color, canvasWidth, canvasHeight, ctx) {
        super(pos, eulerAngles, scale, color, new Quad(), null, name);
        for (let tri of this.mesh.tris) {
            tri.portal = this;
        }

        this.renderTexture = new Texture();
        this.rasterizer = new Rasterizer(canvasWidth, canvasHeight, ctx);
        this.resize(canvasWidth, canvasHeight);

        this.camera = new Camera(pos, eulerAngles, 8, 0.2);

        /** @type {Portal} */
        this.otherPortal = this;

        this.lastFramePlayerInFrontOfPortal = false;
        /** @type {Map<number, boolean>} */
        this.lastFrameGameObjectInFrontOfPortal = new Map();

        const edgeThickness = Portal.edgeThickness;
        let portalBack = this.transform.rotation.rotateVector(Vector3.back).normalize();
        let backOffset = Vector3.mul(portalBack, edgeThickness / 2);
        let portalUp = this.transform.rotation.rotateVector(Vector3.up);
        let portalRight = this.transform.rotation.rotateVector(Vector3.right);

        this.topCube = new GameObject(
            Vector3.add(pos, Vector3.add(Vector3.mul(portalUp, scale.y / 2 + edgeThickness / 2), backOffset)),
            eulerAngles,
            new Vector3(scale.x, edgeThickness, edgeThickness),
            color,
            portalEdgeCubeMesh,
            null,
            name + " top",
        );
        this.bottomCube = new GameObject(
            Vector3.add(pos, Vector3.add(Vector3.mul(portalUp, -scale.y / 2 - edgeThickness / 2), backOffset)),
            eulerAngles,
            new Vector3(scale.x, edgeThickness, edgeThickness),
            color,
            portalEdgeCubeMesh,
            null,
            name + " bottom",
        );
        this.leftCube = new GameObject(
            Vector3.add(pos, Vector3.add(Vector3.mul(portalRight, -scale.x / 2 - edgeThickness / 2), backOffset)),
            eulerAngles,
            new Vector3(edgeThickness, scale.y + edgeThickness * 2, edgeThickness),
            color,
            portalEdgeCubeMesh,
            null,
            name + " left",
        );
        this.rightCube = new GameObject(
            Vector3.add(pos, Vector3.add(Vector3.mul(portalRight, scale.x / 2 + edgeThickness / 2), backOffset)),
            eulerAngles,
            new Vector3(edgeThickness, scale.y + edgeThickness * 2, edgeThickness),
            color,
            portalEdgeCubeMesh,
            null,
            name + " right",
        );

        this.backQuad = new GameObject(
            Vector3.add(pos, Vector3.mul(portalBack, edgeThickness)),
            eulerAngles,
            new Vector3(scale.x, scale.y, 0.05),
            color,
            portalBackQuadMesh,
            null,
            name + " back",
        );
        this.backQuad.transform.rotation = Quaternion.multiply(
            Quaternion.buildQuaternionAxisAngle(portalUp, 180),
            this.backQuad.transform.rotation,
        );

        for (let framePart of [this.topCube, this.bottomCube, this.leftCube, this.rightCube, this.backQuad]) {
            framePart.setParent(this);
        }
    }

    /**
     * @param {number} canvasWidth
     * @param {number} canvasHeight
     */
    resize(canvasWidth, canvasHeight) {
        this.renderTexture.width = canvasWidth;
        this.renderTexture.height = canvasHeight;
        this.renderTexture.pixels = new Uint8ClampedArray(canvasWidth * canvasHeight * 4);
        this.rasterizer.resize(canvasWidth, canvasHeight);
    }

    /** @param {Portal} otherPortal */
    setOtherPortal(otherPortal) {
        this.otherPortal = otherPortal;
    }

    getPlane() {
        let forward = this.transform.getForward();
        return new Plane(forward, Vector3.sub(this.transform.position, Vector3.mul(forward, 0.01)));
    }

    /** @param {Vector3} point */
    isPointDirectlyInFrontOrBackOfPortal(point) {
        let localPoint = this.transform.inverseTransformPoint(point);
        return Math.abs(localPoint.x) <= 0.5 && Math.abs(localPoint.y) <= 0.5;
    }

    /**
     * @param {Vector3} position
     * @param {Quaternion} rotation
     * @returns {[Vector3, Quaternion]}
     */
    calculateTransformToOtherPortalTransform(position, rotation) {
        let otherPortalUp = this.otherPortal.transform.rotation.rotateVector(Vector3.up).normalize();
        let rotate180 = Quaternion.buildQuaternionAxisAngle(otherPortalUp, 180);

        let worldPositionRelativeToThisPortal = Vector3.sub(position, this.transform.position);
        let localPositionRelativeToThisPortal = this.transform.rotation.inverseRotateVector(worldPositionRelativeToThisPortal);
        let worldPositionRelativeToOtherPortal = this.otherPortal.transform.rotation.rotateVector(localPositionRelativeToThisPortal);
        let newPos = Vector3.add(this.otherPortal.transform.position, rotate180.rotateVector(worldPositionRelativeToOtherPortal));

        let thisPortalInverseRotation = this.transform.rotation.conjugate();
        let localRotationRelativeToThisPortal = Quaternion.multiply(thisPortalInverseRotation, rotation);
        let worldRotationRelativeToOtherPortal = Quaternion.multiply(this.otherPortal.transform.rotation, localRotationRelativeToThisPortal);
        let newRotation = Quaternion.multiply(rotate180, worldRotationRelativeToOtherPortal);

        return [newPos, newRotation];
    }

    /** @param {GameObject} gameObject */
    createCloneObjectOnOtherPortal(gameObject) {
        let cloneObjectTransform = this.calculateTransformToOtherPortalTransform(gameObject.transform.position, gameObject.transform.rotation);
        let cloneObject = new GameObject(
            cloneObjectTransform[0],
            Vector3.zero,
            gameObject.transform.lossyScale.clone(),
            gameObject.color,
            gameObject.mesh,
            gameObject.texture,
        );
        cloneObject.transform.rotation = cloneObjectTransform[1];
        return cloneObject;
    }

    /**
     * @param {Vector3} playerCameraPos
     * @param {Quaternion} playerCameraRotation
     */
    updatePortalCameraBaseOnPlayer(playerCameraPos, playerCameraRotation) {
        let [cameraPos, cameraRotation] = this.calculateTransformToOtherPortalTransform(playerCameraPos, playerCameraRotation);
        this.camera.transform.position = cameraPos;
        this.camera.transform.rotation = cameraRotation;
    }

    /**
     * @param {Vector3} playerCameraPos
     * @param {number} crossMargin
     */
    refreshLastFramePlayerInFrontOfPortal(playerCameraPos, crossMargin) {
        this.lastFramePlayerInFrontOfPortal = this.getPlane().distanceToPoint(playerCameraPos) >= crossMargin;
    }

    /**
     * @param {Vector3} playerCameraPos
     * @param {Quaternion} playerCameraRotation
     * @param {number} crossMargin
     * @returns {[Vector3, Quaternion] | null}
     */
    getPlayerTeleportedTransformIfGoThroughPortal(playerCameraPos, playerCameraRotation, crossMargin) {
        let wasInFront = this.lastFramePlayerInFrontOfPortal;
        let isPlayerInFrontOfPortal = this.getPlane().distanceToPoint(playerCameraPos) >= crossMargin;
        this.lastFramePlayerInFrontOfPortal = isPlayerInFrontOfPortal;

        if (wasInFront && !isPlayerInFrontOfPortal && this.isPointDirectlyInFrontOrBackOfPortal(playerCameraPos)) {
            return this.calculateTransformToOtherPortalTransform(playerCameraPos, playerCameraRotation);
        }
        return null;
    }

    /**
     * @param {GameObject} gameObject
     * @returns {[Vector3, Quaternion] | null}
     */
    getGameObjectTeleportedTransformIfGoThroughPortal(gameObject) {
        let wasInFront = this.lastFrameGameObjectInFrontOfPortal.get(gameObject.id) ?? false;
        let isGameObjectInFrontOfPortal = this.getPlane().isPointInFrontOfPlane(gameObject.transform.position);
        this.lastFrameGameObjectInFrontOfPortal.set(gameObject.id, isGameObjectInFrontOfPortal);

        if (wasInFront && !isGameObjectInFrontOfPortal && this.isPointDirectlyInFrontOrBackOfPortal(gameObject.transform.position)) {
            return this.calculateTransformToOtherPortalTransform(gameObject.transform.position, gameObject.transform.rotation);
        }
        return null;
    }

    /**
     * @param {Triangle[]} objectTris
     * @param {Texture | null} textureForPortal
     * @param {RenderSettings} settings
     * @param {BoundingBox | null} [renderBBox]
     * @returns {Triangle[]}
     */
    runRenderPipeline(objectTris, textureForPortal, settings, renderBBox = null) {
        this.rasterizer.clearScreen(renderBBox);

        const viewMatPortal = this.camera.getViewMatrix();
        const otherPortalPlane = this.otherPortal.getPlane();
        const cameraPos = this.camera.transform.position;

        /** @type {Triangle[]} */
        let visibleTris = [];
        for (let tri of objectTris) {
            if (!tri.portal && Vector3.dot(tri.getNormal(), Vector3.sub(tri.getCenter(), cameraPos)) >= 0) continue;

            let workTri = tri.clone();
            if (workTri.portal) workTri.texture = textureForPortal;

            for (let clippedTri of workTri.clipAgainstPlane(otherPortalPlane)) {
                clippedTri.mulMat4x4(viewMatPortal);
                visibleTris.push(...clippedTri.clipAgainstPlane(settings.nearPlane));
            }
        }

        for (let tri of visibleTris) {
            tri.mulMat4x4(settings.projectionMatrix);
            tri.perspectiveDivide();
        }

        this.rasterizer.rasterizeClipSpaceTriangles(
            visibleTris,
            settings.dirLight,
            settings.pointLightIntensity,
            settings.pointLights,
            settings.pointLightRange,
            renderBBox,
        );

        return visibleTris;
    }

    /**
     * @param {Triangle[]} clipSpaceTris
     * @param {number} canvasWidth
     * @param {BoundingBox | null} [renderBBox]
     */
    updateTextureForQuad(clipSpaceTris, canvasWidth, renderBBox = null) {
        for (let tri of clipSpaceTris) {
            if (!tri.portal) continue;

            let bbox = tri.boundingBox(this.renderTexture.width, this.renderTexture.height);
            if (renderBBox != null) {
                bbox = BoundingBox.intersect(renderBBox, bbox);
                if (!bbox.isValid()) continue;
            }

            for (let y = bbox.minY; y <= bbox.maxY; y++) {
                const rowStart = (y * canvasWidth + bbox.minX) * 4;
                const rowEnd = (y * canvasWidth + bbox.maxX + 1) * 4;
                /** @type {Uint8ClampedArray} */ (this.renderTexture.pixels).set(this.rasterizer.screenBuffer.subarray(rowStart, rowEnd), rowStart);
            }
        }

        this.texture = this.renderTexture;
    }

    /**
     * @param {Vector3} cameraPos
     * @param {Quaternion} cameraRot
     * @param {RenderSettings} settings
     * @returns {BoundingBox | null}
     */
    getQuadBoundingBox(cameraPos, cameraRot, settings) {
        let viewMatPortal = Mat4x4.ViewFromPosRot(cameraPos, cameraRot);
        const canvasWidth = settings.canvasWidth,
            canvasHeight = settings.canvasHeight;

        /** @type {Triangle[]} */
        let visibleTris = [];
        for (let tri of this.getTransformedTriangles()) {
            if (Vector3.dot(tri.getNormal(), Vector3.sub(tri.getCenter(), cameraPos)) < 0) {
                tri.mulMat4x4(viewMatPortal);
                visibleTris.push(...tri.clipAgainstPlane(settings.nearPlane));
            }
        }

        /** @type {BoundingBox | null} */
        let totalBBox = null;
        for (let tri of visibleTris) {
            tri.mulMat4x4(settings.projectionMatrix);
            tri.perspectiveDivide();

            let vertices = tri.vertices;
            for (let i = 0; i < vertices.length; i++) {
                vertices[i] = new Vector3(
                    vertices[i].x * (canvasWidth / 2) + canvasWidth / 2,
                    -vertices[i].y * (canvasHeight / 2) + canvasHeight / 2,
                    vertices[i].z,
                );
            }

            const triBBox = tri.boundingBox(canvasWidth, canvasHeight);
            if (triBBox.isValid()) {
                totalBBox = totalBBox == null ? triBBox : BoundingBox.union(totalBBox, triBBox);
            }
        }

        return totalBBox;
    }

    /**
     * @param {Camera} playerCamera
     * @param {Triangle[]} objectTris
     * @param {RenderSettings} settings
     */
    recursivePortalOperation(playerCamera, objectTris, settings) {
        /** @type {[Vector3, Quaternion][]} */
        let cameraTransforms = [[playerCamera.transform.position, playerCamera.transform.rotation]];
        let firstBoundingBox = this.getQuadBoundingBox(playerCamera.transform.position, playerCamera.transform.rotation, settings);
        if (firstBoundingBox == null || !firstBoundingBox.isValid()) return;

        let quadBoundingBoxes = [firstBoundingBox];
        let deepest = 0;
        for (let i = 1; i <= settings.portalLimit; i++) {
            cameraTransforms.push(this.calculateTransformToOtherPortalTransform(cameraTransforms[i - 1][0], cameraTransforms[i - 1][1]));
            deepest = i;

            let newQuadBoundingBox = this.getQuadBoundingBox(cameraTransforms[i][0], cameraTransforms[i][1], settings);
            if (newQuadBoundingBox == null || !BoundingBox.isOverlap(quadBoundingBoxes[i - 1], newQuadBoundingBox)) break;
            quadBoundingBoxes.push(BoundingBox.intersect(quadBoundingBoxes[i - 1], newQuadBoundingBox));
        }

        if (deepest == 0) return;

        for (let i = deepest; i >= 1; i--) {
            this.camera.transform.position = cameraTransforms[i][0];
            this.camera.transform.rotation = cameraTransforms[i][1];
            let textureForPortal = i == deepest ? null : this.renderTexture;
            let clipSpaceTris = this.runRenderPipeline(objectTris, textureForPortal, settings, quadBoundingBoxes[i - 1]);
            this.updateTextureForQuad(clipSpaceTris, settings.canvasWidth, quadBoundingBoxes[i - 1]);
        }
    }
}
