import { MathExtend, Vector2, Vector3, Mat4x4, Quaternion, Plane, BoundingBox } from "./math.js";
import { Color, Texture } from "./graphics.js";
import { GameObject } from "./engine.js";

export class Triangle {
    /**
     * @param {Vector3[]} [vertices]
     * @param {Vector2[]} [uv]
     * @param {Color} [color]
     */
    constructor(vertices = [], uv = [], color = new Color(255, 255, 255)) {
        if (vertices.length == 0) {
            /** @type {Vector3[]} */
            this.vertices = [];
            for (let i = 0; i < 3; i++) {
                this.vertices.push(new Vector3(0, 0, 0));
            }
        } else {
            this.vertices = vertices;
        }

        this.uv = uv;
        this.worldVertices = [this.vertices[0].clone(), this.vertices[1].clone(), this.vertices[2].clone()];
        this.color = color;
        /** @type {Texture | null} */
        this.texture = null;
        this.signedDoubleArea = 0;
    }

    clone() {
        let tri = new Triangle();
        for (let i = 0; i < this.vertices.length; i++) {
            tri.vertices[i] = this.vertices[i].clone();
            tri.worldVertices[i] = this.worldVertices[i].clone();
            tri.uv[i] = this.uv[i].clone();
        }
        tri.color = this.color;
        tri.texture = this.texture;
        return tri;
    }

    updateWorldVertices() {
        for (let i = 0; i < this.vertices.length; i++) {
            this.worldVertices[i] = this.vertices[i].clone();
        }
    }

    /** @param {Mat4x4} m */
    mulMat4x4(m) {
        for (let v of this.vertices) {
            v.mulMat4x4(m);
        }
    }

    /** @param {Quaternion} q */
    rotate(q) {
        for (let i = 0; i < this.vertices.length; i++) {
            this.vertices[i] = q.rotateVector(this.vertices[i]);
        }
    }

    getCenter() {
        let x = (this.vertices[0].x + this.vertices[1].x + this.vertices[2].x) / 3.0;
        let y = (this.vertices[0].y + this.vertices[1].y + this.vertices[2].y) / 3.0;
        let z = (this.vertices[0].z + this.vertices[1].z + this.vertices[2].z) / 3.0;
        return new Vector3(x, y, z);
    }

    getNormal() {
        let v1 = Vector3.sub(this.vertices[0], this.vertices[1]);
        let v2 = Vector3.sub(this.vertices[1], this.vertices[2]);
        let normal = Vector3.cross(v1, v2);
        normal.normalize();
        return normal;
    }

    getWorldNormal() {
        let v1 = Vector3.sub(this.worldVertices[0], this.worldVertices[1]);
        let v2 = Vector3.sub(this.worldVertices[1], this.worldVertices[2]);
        let normal = Vector3.cross(v1, v2);
        normal.normalize();
        return normal;
    }

    perspectiveDivide() {
        for (let i = 0; i < this.vertices.length; i++) {
            let z = this.vertices[i].w;
            this.vertices[i] = Vector3.div(this.vertices[i], z);
            this.uv[i] = Vector2.div(this.uv[i], z);
        }
    }

    /**
     * @param {Plane} plane
     * @returns {boolean}
     */
    isIntersectingPlane(plane) {
        for (let i = 0; i < this.vertices.length; i++) {
            let next = (i + 1) % this.vertices.length;
            let t = plane.intersectWithLine(this.vertices[i], this.vertices[next])[0];
            if (t >= 0 && t <= 1) return true;
        }

        return false;
    }

    /**
     * @param {Plane} plane
     * @returns {Triangle[]}
     */
    clipAgainstPlane(plane) {
        /** @type {Triangle[]} */
        let outTris = [];

        /** @type {number[]} */
        let frontPoints = [];
        /** @type {number[]} */
        let behindPoints = [];

        for (let i = 0; i < this.vertices.length; i++) {
            if (plane.isPointInFrontOfPlane(this.vertices[i])) {
                frontPoints.push(i);
            } else {
                behindPoints.push(i);
            }
        }

        if (frontPoints.length == 3) {
            outTris.push(this.clone());
        } else if (frontPoints.length == 1 && behindPoints.length == 2) {
            let outTri = new Triangle();

            if (behindPoints[0] == 0 && behindPoints[1] == 2) {
                behindPoints[0] = 2;
                behindPoints[1] = 0;
            }

            let f = this.vertices[frontPoints[0]];
            let b0 = this.vertices[behindPoints[0]];
            let b1 = this.vertices[behindPoints[1]];

            let [t1, intersection1] = plane.intersectWithLine(f, b0);
            let [t2, intersection2] = plane.intersectWithLine(f, b1);

            outTri.vertices[0] = f;
            outTri.vertices[1] = intersection1;
            outTri.vertices[2] = intersection2;
            outTri.worldVertices[0] = this.worldVertices[frontPoints[0]];
            outTri.worldVertices[1] = Vector3.lerp(this.worldVertices[frontPoints[0]], this.worldVertices[behindPoints[0]], t1);
            outTri.worldVertices[2] = Vector3.lerp(this.worldVertices[frontPoints[0]], this.worldVertices[behindPoints[1]], t2);
            outTri.uv[0] = this.uv[frontPoints[0]];
            outTri.uv[1] = Vector2.lerp(this.uv[frontPoints[0]], this.uv[behindPoints[0]], t1);
            outTri.uv[2] = Vector2.lerp(this.uv[frontPoints[0]], this.uv[behindPoints[1]], t2);
            outTri.color = this.color;
            outTri.texture = this.texture;
            outTris.push(outTri);
        } else if (frontPoints.length == 2 && behindPoints.length == 1) {
            let outTri1 = new Triangle(),
                outTri2 = new Triangle();

            if (frontPoints[0] == 0 && frontPoints[1] == 2) {
                frontPoints[0] = 2;
                frontPoints[1] = 0;
            }

            let f0 = this.vertices[frontPoints[0]];
            let f1 = this.vertices[frontPoints[1]];
            let b = this.vertices[behindPoints[0]];

            let [t1, intersection1] = plane.intersectWithLine(f0, b);
            let [t2, intersection2] = plane.intersectWithLine(f1, b);

            outTri1.vertices[0] = f0;
            outTri1.vertices[1] = f1;
            outTri1.vertices[2] = intersection1;
            outTri1.worldVertices[0] = this.worldVertices[frontPoints[0]];
            outTri1.worldVertices[1] = this.worldVertices[frontPoints[1]];
            outTri1.worldVertices[2] = Vector3.lerp(this.worldVertices[frontPoints[0]], this.worldVertices[behindPoints[0]], t1);
            outTri1.uv[0] = this.uv[frontPoints[0]];
            outTri1.uv[1] = this.uv[frontPoints[1]];
            outTri1.uv[2] = Vector2.lerp(this.uv[frontPoints[0]], this.uv[behindPoints[0]], t1);
            outTri1.color = this.color;
            outTri1.texture = this.texture;
            outTris.push(outTri1);

            outTri2.vertices[0] = f1.clone();
            outTri2.vertices[1] = intersection2;
            outTri2.vertices[2] = intersection1.clone();
            outTri2.worldVertices[0] = this.worldVertices[frontPoints[1]].clone();
            outTri2.worldVertices[1] = Vector3.lerp(this.worldVertices[frontPoints[1]], this.worldVertices[behindPoints[0]], t2);
            outTri2.worldVertices[2] = Vector3.lerp(this.worldVertices[frontPoints[0]], this.worldVertices[behindPoints[0]], t1);
            outTri2.uv[0] = this.uv[frontPoints[1]].clone();
            outTri2.uv[1] = Vector2.lerp(this.uv[frontPoints[1]], this.uv[behindPoints[0]], t2);
            outTri2.uv[2] = Vector2.lerp(this.uv[frontPoints[0]], this.uv[behindPoints[0]], t1);
            outTri2.color = this.color;
            outTri2.texture = this.texture;
            outTris.push(outTri2);
        }

        return outTris;
    }

    /**
     * @param {number} maxWidth
     * @param {number} maxHeight
     * @returns {BoundingBox}
     */
    boundingBox(maxWidth, maxHeight) {
        let minX = Math.min(this.vertices[0].x, this.vertices[1].x, this.vertices[2].x);
        let maxX = Math.max(this.vertices[0].x, this.vertices[1].x, this.vertices[2].x);
        let minY = Math.min(this.vertices[0].y, this.vertices[1].y, this.vertices[2].y);
        let maxY = Math.max(this.vertices[0].y, this.vertices[1].y, this.vertices[2].y);

        minX = Math.max(0, Math.trunc(minX));
        maxX = Math.min(maxWidth - 1, Math.trunc(maxX));
        minY = Math.max(0, Math.trunc(minY));
        maxY = Math.min(maxHeight - 1, Math.trunc(maxY));

        return new BoundingBox(minX, maxX, minY, maxY);
    }

    calculateSignedDoubleArea() {
        this.signedDoubleArea = MathExtend.edgeFunction(this.vertices[0], this.vertices[1], this.vertices[2]);
    }

    /**
     * 
     * @param {Number} pointLightRange 
     * @param {GameObject[]} pointLights 
     * @returns {Vector3[]}
     */
    getPointLightsThatCanAffectTri(pointLightRange, pointLights) {
        let triWorldNormal = this.getWorldNormal();

        const triWorldCenterX = (this.worldVertices[0].x + this.worldVertices[1].x + this.worldVertices[2].x) / 3;
        const triWorldCenterY = (this.worldVertices[0].y + this.worldVertices[1].y + this.worldVertices[2].y) / 3;
        const triWorldCenterZ = (this.worldVertices[0].z + this.worldVertices[1].z + this.worldVertices[2].z) / 3;

        let triBoundingCircleRadius2 = 0;
        for (let i = 0; i < 3; i++) {
            const currentWorldVertex = this.worldVertices[i];
            const currentRadius2 = MathExtend.hypotSquare(
                currentWorldVertex.x,
                currentWorldVertex.y,
                currentWorldVertex.z,
                triWorldCenterX,
                triWorldCenterY,
                triWorldCenterZ,
            );
            if (currentRadius2 > triBoundingCircleRadius2) triBoundingCircleRadius2 = currentRadius2;
        }
        const reach = pointLightRange + Math.sqrt(triBoundingCircleRadius2);

        const triPlaneD = Vector3.dot(triWorldNormal, this.worldVertices[0]);

        let activeLights = [];
        for (let i = 0; i < pointLights.length; i++) {
            const lightPos = pointLights[i].pos;

            if (Vector3.dot(triWorldNormal, lightPos) <= triPlaneD) continue;

            const lightDistance2 = MathExtend.hypotSquare(lightPos.x, lightPos.y, lightPos.z, triWorldCenterX, triWorldCenterY, triWorldCenterZ);
            if (lightDistance2 > reach * reach) continue;

            activeLights.push(lightPos);
        }
        return activeLights;
    }
}

export class Mesh {
    /** @param {Triangle[]} [tris] */
    constructor(tris = []) {
        this.tris = tris;
    }

    /**
     * @param {Triangle[]} tris
     * @param {Color} [color]
     */
    setTriangles(tris, color = new Color(255, 255, 255)) {
        this.tris = [];
        for (let tri of tris) {
            this.tris.push(
                new Triangle(
                    [tri.vertices[0].clone(), tri.vertices[1].clone(), tri.vertices[2].clone()],
                    [tri.uv[0].clone(), tri.uv[1].clone(), tri.uv[2].clone()],
                    color,
                ),
            );
        }
    }
}

export class Quad extends Mesh {
    constructor() {
        super(Quad.generateInitialTriangles());
    }

    static generateInitialTriangles() {
        let tris = [];
        let color = new Color(255, 255, 255);

        tris.push(
            new Triangle(
                [new Vector3(0.5, -0.5, 0), new Vector3(0.5, 0.5, 0), new Vector3(-0.5, 0.5, 0)],
                [new Vector2(1, 0), new Vector2(1, 1), new Vector2(0, 1)],
                color,
            ),
        );

        tris.push(
            new Triangle(
                [new Vector3(0.5, -0.5, 0), new Vector3(-0.5, 0.5, 0), new Vector3(-0.5, -0.5, 0)],
                [new Vector2(1, 0), new Vector2(0, 1), new Vector2(0, 0)],
                color,
            ),
        );

        return tris;
    }
}

export class Cube extends Mesh {
    constructor() {
        super(Cube.generateInitialTriangles());
    }

    static generateInitialTriangles() {
        /** @type {Triangle[]} */
        let tris = [];
        let color = new Color(255, 255, 255);

        // FRONT
        tris.push(
            new Triangle(
                [new Vector3(-0.5, -0.5, -0.5), new Vector3(-0.5, 0.5, -0.5), new Vector3(0.5, 0.5, -0.5)],
                [new Vector2(0, 0), new Vector2(0, 1), new Vector2(1, 1)],
                color,
            ),
        );
        tris.push(
            new Triangle(
                [new Vector3(-0.5, -0.5, -0.5), new Vector3(0.5, 0.5, -0.5), new Vector3(0.5, -0.5, -0.5)],
                [new Vector2(0, 0), new Vector2(1, 1), new Vector2(1, 0)],
                color,
            ),
        );

        // RIGHT
        tris.push(
            new Triangle(
                [new Vector3(0.5, -0.5, -0.5), new Vector3(0.5, 0.5, -0.5), new Vector3(0.5, 0.5, 0.5)],
                [new Vector2(0, 0), new Vector2(1, 0), new Vector2(1, 1)],
                color,
            ),
        );

        tris.push(
            new Triangle(
                [new Vector3(0.5, -0.5, -0.5), new Vector3(0.5, 0.5, 0.5), new Vector3(0.5, -0.5, 0.5)],
                [new Vector2(0, 0), new Vector2(1, 1), new Vector2(0, 1)],
                color,
            ),
        );

        // BACK
        tris.push(
            new Triangle(
                [new Vector3(0.5, -0.5, 0.5), new Vector3(0.5, 0.5, 0.5), new Vector3(-0.5, 0.5, 0.5)],
                [new Vector2(1, 0), new Vector2(1, 1), new Vector2(0, 1)],
                color,
            ),
        );

        tris.push(
            new Triangle(
                [new Vector3(0.5, -0.5, 0.5), new Vector3(-0.5, 0.5, 0.5), new Vector3(-0.5, -0.5, 0.5)],
                [new Vector2(1, 0), new Vector2(0, 1), new Vector2(0, 0)],
                color,
            ),
        );

        // LEFT
        tris.push(
            new Triangle(
                [new Vector3(-0.5, -0.5, 0.5), new Vector3(-0.5, 0.5, 0.5), new Vector3(-0.5, 0.5, -0.5)],
                [new Vector2(0, 1), new Vector2(1, 1), new Vector2(1, 0)],
                color,
            ),
        );

        tris.push(
            new Triangle(
                [new Vector3(-0.5, -0.5, 0.5), new Vector3(-0.5, 0.5, -0.5), new Vector3(-0.5, -0.5, -0.5)],
                [new Vector2(0, 1), new Vector2(1, 0), new Vector2(0, 0)],
                color,
            ),
        );

        // TOP
        tris.push(
            new Triangle(
                [new Vector3(-0.5, 0.5, -0.5), new Vector3(-0.5, 0.5, 0.5), new Vector3(0.5, 0.5, 0.5)],
                [new Vector2(0, 0), new Vector2(0, 1), new Vector2(1, 1)],
                color,
            ),
        );

        tris.push(
            new Triangle(
                [new Vector3(-0.5, 0.5, -0.5), new Vector3(0.5, 0.5, 0.5), new Vector3(0.5, 0.5, -0.5)],
                [new Vector2(0, 0), new Vector2(1, 1), new Vector2(1, 0)],
                color,
            ),
        );

        // BOTTOM
        tris.push(
            new Triangle(
                [new Vector3(0.5, -0.5, 0.5), new Vector3(-0.5, -0.5, 0.5), new Vector3(-0.5, -0.5, -0.5)],
                [new Vector2(1, 1), new Vector2(0, 1), new Vector2(0, 0)],
                color,
            ),
        );

        tris.push(
            new Triangle(
                [new Vector3(0.5, -0.5, 0.5), new Vector3(-0.5, -0.5, -0.5), new Vector3(0.5, -0.5, -0.5)],
                [new Vector2(1, 1), new Vector2(0, 0), new Vector2(1, 0)],
                color,
            ),
        );

        return tris;
    }
}

export class ObjMesh extends Mesh {
    /** @param {string} objURL */
    constructor(objURL) {
        super();
        this.load(objURL);
    }

    /** @param {string} url */
    async load(url) {
        const response = await fetch(url);
        const objText = await response.text();
        const triangles = this.parseOBJ(objText);
        this.setTriangles(triangles);
    }

    /**
     * @param {string} objText
     * @returns {Triangle[]}
     */
    parseOBJ(objText) {
        /** @type {Vector3[]} */
        const vertices = [];
        /** @type {Vector2[]} */
        const uvs = [];
        /** @type {Triangle[]} */
        const triangles = [];
        const lines = objText.split("\n");

        for (let line of lines) {
            if (!line || line.startsWith("#")) continue;

            if (line.startsWith("v ")) {
                const values = line.split(" ");
                vertices.push(new Vector3(parseFloat(values[1]), parseFloat(values[2]), parseFloat(values[3])));
            } else if (line.startsWith("vt ")) {
                const values = line.split(" ");
                uvs.push(new Vector2(parseFloat(values[1]), 1 - parseFloat(values[2])));
            } else if (line.startsWith("f ")) {
                const vertexInfoStrs = line.split(" ").slice(1);

                /** @type {Vector3[]} */
                let triVertices = [];
                /** @type {Vector2[]} */
                let triUVs = [];
                for (let vertexInfoStr of vertexInfoStrs) {
                    const vertexInfo = vertexInfoStr.split("/");
                    const vertexCoord = vertices[parseInt(vertexInfo[0]) - 1];
                    const vertexUV = uvs[parseInt(vertexInfo[1]) - 1];

                    triVertices.push(vertexCoord);
                    triUVs.push(vertexUV);
                }
                let newTri = new Triangle(triVertices, triUVs);
                triangles.push(newTri);
            }
        }

        return triangles;
    }
}
