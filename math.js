export class MathExtend {
    /**
     * @param {Vector3} v0
     * @param {Vector3} v1
     * @param {Vector3} p
     * @returns {number}
     */
    static edgeFunction(v0, v1, p) {
        return (v0.y - v1.y) * (p.x - v0.x) + (v1.x - v0.x) * (p.y - v0.y);
    }

    /**
     *
     * @param {Number} ax
     * @param {Number} ay
     * @param {Number} az
     * @param {Number} bx
     * @param {Number} by
     * @param {Number} bz
     * @returns
     */
    static hypotSquare(ax, ay, az, bx, by, bz) {
        const dx = ax - bx;
        const dy = ay - by;
        const dz = az - bz;
        return dx * dx + dy * dy + dz * dz;
    }
}

export class Vector2 {
    /**
     * @param {number} [u]
     * @param {number} [v]
     * @param {number} [w]
     */
    constructor(u = 0, v = 0, w = 1) {
        this.u = u;
        this.v = v;
        this.w = w;
    }
    clone() {
        return new Vector2(this.u, this.v, this.w);
    }
    /**
     * @param {Vector2} vec
     * @param {number} value
     */
    static div(vec, value) {
        return new Vector2(vec.u / value, vec.v / value, vec.w / value);
    }
    /**
     * @param {Vector2} vec1
     * @param {Vector2} vec2
     * @param {number} t
     */
    static lerp(vec1, vec2, t) {
        return new Vector2(vec1.u + (vec2.u - vec1.u) * t, vec1.v + (vec2.v - vec1.v) * t, vec1.w + (vec2.w - vec1.w) * t);
    }
}

export class Vector3 {
    /**
     * @param {number} [x]
     * @param {number} [y]
     * @param {number} [z]
     * @param {number} [w]
     */
    constructor(x = 0, y = 0, z = 0, w = 1) {
        this.x = x;
        this.y = y;
        this.z = z;
        this.w = w;
    }

    /** @type {Vector3} */
    static zero;
    /** @type {Vector3} */
    static one;
    /** @type {Vector3} */
    static left;
    /** @type {Vector3} */
    static right;
    /** @type {Vector3} */
    static up;
    /** @type {Vector3} */
    static down;
    /** @type {Vector3} */
    static forward;

    clone() {
        return new Vector3(this.x, this.y, this.z, this.w);
    }

    /**
     * @param {Vector3} vec1
     * @param {Vector3} vec2
     */
    static add(vec1, vec2) {
        return new Vector3(vec1.x + vec2.x, vec1.y + vec2.y, vec1.z + vec2.z);
    }
    /**
     * @param {Vector3} vec1
     * @param {Vector3} vec2
     */
    static sub(vec1, vec2) {
        return new Vector3(vec1.x - vec2.x, vec1.y - vec2.y, vec1.z - vec2.z);
    }
    /**
     * @param {Vector3} vec
     * @param {number} value
     */
    static mul(vec, value) {
        return new Vector3(vec.x * value, vec.y * value, vec.z * value);
    }
    /**
     * @param {Vector3} vec
     * @param {number} value
     */
    static div(vec, value) {
        return new Vector3(vec.x / value, vec.y / value, vec.z / value);
    }
    /**
     * @param {Vector3} vec1
     * @param {Vector3} vec2
     */
    static scale(vec1, vec2) {
        return new Vector3(vec1.x * vec2.x, vec1.y * vec2.y, vec1.z * vec2.z);
    }
    /**
     * @param {Vector3} v1
     * @param {Vector3} v2
     * @returns {number}
     */
    static dot(v1, v2) {
        return v1.x * v2.x + v1.y * v2.y + v1.z * v2.z;
    }
    /**
     * @param {Vector3} v1
     * @param {Vector3} v2
     */
    static cross(v1, v2) {
        let v = new Vector3(v1.y * v2.z - v1.z * v2.y, v1.z * v2.x - v1.x * v2.z, v1.x * v2.y - v1.y * v2.x);
        return v;
    }
    /**
     * @param {Vector3} v1
     * @param {Vector3} v2
     * @param {number} t
     */
    static lerp(v1, v2, t) {
        return new Vector3(v1.x + (v2.x - v1.x) * t, v1.y + (v2.y - v1.y) * t, v1.z + (v2.z - v1.z) * t, v1.w + (v2.w - v1.w) * t);
    }
    magnitude() {
        return Math.hypot(this.x, this.y, this.z);
    }
    normalize() {
        let length = this.magnitude();
        if (length === 0) return this;
        this.x /= length;
        this.y /= length;
        this.z /= length;
        return this;
    }

    /** @param {Mat4x4} m */
    mulMat4x4(m) {
        let x = this.x;
        let y = this.y;
        let z = this.z;
        let w = this.w;
        this.x = m.m[0][0] * x + m.m[0][1] * y + m.m[0][2] * z + m.m[0][3] * w;
        this.y = m.m[1][0] * x + m.m[1][1] * y + m.m[1][2] * z + m.m[1][3] * w;
        this.z = m.m[2][0] * x + m.m[2][1] * y + m.m[2][2] * z + m.m[2][3] * w;
        this.w = m.m[3][0] * x + m.m[3][1] * y + m.m[3][2] * z + m.m[3][3] * w;
    }
}
Vector3.zero = new Vector3(0, 0, 0);
Vector3.one = new Vector3(1, 1, 1);
Vector3.left = new Vector3(-1, 0, 0);
Vector3.right = new Vector3(1, 0, 0);
Vector3.up = new Vector3(0, 1, 0);
Vector3.down = new Vector3(0, -1, 0);
Vector3.forward = new Vector3(0, 0, 1);

export class Mat4x4 {
    constructor() {
        /** @type {number[][]} */
        this.m = [
            [0, 0, 0, 0],
            [0, 0, 0, 0],
            [0, 0, 0, 0],
            [0, 0, 0, 0],
        ];
    }

    /**
     * @param {number} fov
     * @param {number} h
     * @param {number} w
     * @param {number} zNear
     * @param {number} zFar
     */
    static Projection(fov, h, w, zNear, zFar) {
        let fovMultiplier = 1.0 / Math.tan(((fov * 0.5) / 180.0) * Math.PI);
        let matrix = new Mat4x4();
        matrix.m[0][0] = (h / w) * fovMultiplier;
        matrix.m[1][1] = fovMultiplier;
        matrix.m[2][2] = zFar / (zFar - zNear);
        matrix.m[2][3] = (-zNear * zFar) / (zFar - zNear);
        matrix.m[3][2] = 1.0;
        return matrix;
    }

    /**
     * @param {number} size
     * @param {number} zNear
     * @param {number} zFar
     */
    static Orthographic(size, zNear, zFar) {
        let matrix = new Mat4x4();
        matrix.m[0][0] = 2.0 / size;
        matrix.m[1][1] = 2.0 / size;
        matrix.m[2][2] = 1.0 / (zFar - zNear);
        matrix.m[2][3] = -zNear / (zFar - zNear);
        matrix.m[3][3] = 1.0;
        return matrix;
    }

    /**
     * @param {Vector3} r
     * @param {Vector3} u
     * @param {Vector3} f
     * @param {Vector3} t
     */
    static View(r, u, f, t) {
        let matrix = new Mat4x4();
        matrix.m[0][0] = r.x;
        matrix.m[0][1] = r.y;
        matrix.m[0][2] = r.z;
        matrix.m[1][0] = u.x;
        matrix.m[1][1] = u.y;
        matrix.m[1][2] = u.z;
        matrix.m[2][0] = f.x;
        matrix.m[2][1] = f.y;
        matrix.m[2][2] = f.z;
        matrix.m[0][3] = -Vector3.dot(r, t);
        matrix.m[1][3] = -Vector3.dot(u, t);
        matrix.m[2][3] = -Vector3.dot(f, t);
        matrix.m[3][3] = 1;
        return matrix;
    }

    /**
     *
     * @param {Vector3} pos
     * @param {Quaternion} rotation
     * @returns
     */
    static ViewWithPosRot(pos, rotation) {
        let forward = rotation.rotateVector(Vector3.forward);
        let right = rotation.rotateVector(Vector3.right);
        let up = rotation.rotateVector(Vector3.up);
        return Mat4x4.View(right, up, forward, pos);
    }

    /**
     * @param {number} x
     * @param {number} y
     * @param {number} z
     */
    static Translation(x, y, z) {
        let matrix = new Mat4x4();
        matrix.m[0][0] = 1;
        matrix.m[1][1] = 1;
        matrix.m[2][2] = 1;
        matrix.m[3][3] = 1;
        matrix.m[0][3] = x;
        matrix.m[1][3] = y;
        matrix.m[2][3] = z;
        return matrix;
    }

    /**
     * @param {number} x
     * @param {number} y
     * @param {number} z
     */
    static Scale(x, y, z) {
        let matrix = new Mat4x4();
        matrix.m[0][0] = x;
        matrix.m[1][1] = y;
        matrix.m[2][2] = z;
        matrix.m[3][3] = 1;
        return matrix;
    }
}

export class Quaternion {
    /**
     * @param {number} [a]
     * @param {number} [b]
     * @param {number} [c]
     * @param {number} [d]
     */
    constructor(a = 1, b = 0, c = 0, d = 0) {
        this.a = a;
        this.b = b;
        this.c = c;
        this.d = d;
    }

    /**
     * @param {Vector3} axis
     * @param {number} angle
     */
    static buildQuaternionAxisAngle(axis, angle) {
        let radian = (angle / 180.0) * Math.PI;
        const half = radian / 2;
        const s = -Math.sin(half);
        return new Quaternion(Math.cos(half), axis.x * s, axis.y * s, axis.z * s);
    }

    /** @param {Vector3} eulerAngles */
    static buildQuaternionEuler(eulerAngles) {
        const a = (eulerAngles.x / 180) * Math.PI * 0.5;
        const b = (eulerAngles.y / 180) * Math.PI * 0.5;
        const c = (eulerAngles.z / 180) * Math.PI * 0.5;

        const cosA = Math.cos(a);
        const sinA = Math.sin(a);
        const cosB = Math.cos(b);
        const sinB = Math.sin(b);
        const cosC = Math.cos(c);
        const sinC = Math.sin(c);

        return new Quaternion(
            cosC * cosB * cosA + sinC * sinB * sinA,
            -cosC * cosB * sinA + sinC * sinB * cosA,
            -cosC * sinB * cosA - sinC * cosB * sinA,
            -sinC * cosB * cosA + cosC * sinB * sinA,
        );
    }

    /**
     * @param {Quaternion} p
     * @param {Quaternion} q
     */
    static multiply(p, q) {
        let a = p.a * q.a - p.b * q.b - p.c * q.c - p.d * q.d;
        let b = p.a * q.b + p.b * q.a + p.c * q.d - p.d * q.c;
        let c = p.a * q.c - p.b * q.d + p.c * q.a + p.d * q.b;
        let d = p.a * q.d + p.b * q.c - p.c * q.b + p.d * q.a;
        return new Quaternion(a, b, c, d);
    }

    conjugate() {
        return new Quaternion(this.a, -this.b, -this.c, -this.d);
    }

    /** @param {Vector3} v */
    rotateVector(v) {
        const qVec = new Quaternion(0, v.x, v.y, v.z);
        const res = Quaternion.multiply(Quaternion.multiply(this, qVec), this.conjugate());
        return new Vector3(res.b, res.c, res.d);
    }
}

export class Plane {
    /**
     * @param {Vector3} normal
     * @param {Vector3} P
     */
    constructor(normal, P) {
        this.normal = normal.normalize();
        this.P = P;
        this.D = Vector3.dot(this.normal, this.P);
    }

    /** @param {Vector3} p */
    isPointInFrontOfPlane(p) {
        return Vector3.dot(p, this.normal) >= this.D;
    }

    /**
     * @param {Vector3} A
     * @param {Vector3} B
     * @returns {[number, Vector3]} how far along AB the plane sits, and the intersection point
     */
    intersectWithLine(A, B) {
        let An = Vector3.dot(A, this.normal);
        let Bn = Vector3.dot(B, this.normal);
        let vectorAB = Vector3.sub(B, A);
        let t = (this.D - An) / (Bn - An);
        let vectorAM = Vector3.mul(vectorAB, t);
        return [t, Vector3.add(A, vectorAM)];
    }
}

export class BoundingBox {
    /**
     *
     * @param {Number} minX
     * @param {Number} maxX
     * @param {Number} minY
     * @param {Number} maxY
     */
    constructor(minX, maxX, minY, maxY) {
        this.minX = minX;
        this.maxX = maxX;
        this.minY = minY;
        this.maxY = maxY;
    }

    isValid() {
        return this.minX <= this.maxX && this.minY <= this.maxY;
    }

    /**
     *
     * @param {BoundingBox} bbox1
     * @param {BoundingBox} bbox2
     * @returns
     */
    static union(bbox1, bbox2) {
        return new BoundingBox(
            Math.min(bbox1.minX, bbox2.minX),
            Math.max(bbox1.maxX, bbox2.maxX),
            Math.min(bbox1.minY, bbox2.minY),
            Math.max(bbox1.maxY, bbox2.maxY),
        );
    }

    /**
     *
     * @param {BoundingBox} bbox1
     * @param {BoundingBox} bbox2
     * @returns
     */
    static intersect(bbox1, bbox2) {
        return new BoundingBox(
            Math.max(bbox1.minX, bbox2.minX),
            Math.min(bbox1.maxX, bbox2.maxX),
            Math.max(bbox1.minY, bbox2.minY),
            Math.min(bbox1.maxY, bbox2.maxY),
        );
    }

    /**
     *
     * @param {BoundingBox} bbox1
     * @param {BoundingBox} bbox2
     * @returns
     */
    static isOverlap(bbox1, bbox2) {
        return (
            ((bbox1.minX < bbox2.maxX && bbox1.maxX > bbox2.minX) || (bbox2.minX < bbox1.maxX && bbox2.maxX > bbox1.minX)) &&
            ((bbox1.minY < bbox2.maxY && bbox1.maxY > bbox2.minY) || (bbox2.minY < bbox1.maxY && bbox2.maxY > bbox1.minY))
        );
    }
}
