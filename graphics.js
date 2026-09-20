export class Color {
    /**
     * @param {number} r
     * @param {number} g
     * @param {number} b
     */
    constructor(r, g, b) {
        this.r = r;
        this.g = g;
        this.b = b;
    }

    /**
     * @param {number} r
     * @param {number} g
     * @param {number} b
     */
    updateColor(r, g, b) {
        this.r = r;
        this.g = g;
        this.b = b;
    }

    grayScale01() {
        return (this.r + this.g + this.b) / 3.0 / 255.0;
    }
}

export class Texture {
    /** @param {string} [url] */
    constructor(url = "") {
        /** @type {Uint8ClampedArray | null} */
        this.pixels = null;
        this.width = 0;
        this.height = 0;
        if (url) this.load(url);
    }

    /** @param {string} url */
    async load(url) {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.src = url;
        /** @type {Promise<void>} */
        const loaded = new Promise((resolve) => {
            img.onload = () => {
                resolve();
            };
        });
        await loaded;
        const tempCanvas = document.createElement("canvas");
        tempCanvas.width = img.width;
        tempCanvas.height = img.height;
        const tempCtx = /** @type {CanvasRenderingContext2D} */ (tempCanvas.getContext("2d"));
        tempCtx.drawImage(img, 0, 0);
        this.pixels = tempCtx.getImageData(0, 0, img.width, img.height).data;
        this.width = img.width;
        this.height = img.height;
    }
}
