export class Color {
    constructor(r, g, b) {
        this.r = r;
        this.g = g;
        this.b = b;
    }

    updateColor(r, g, b) {
        this.r = r;
        this.g = g;
        this.b = b;
    }
}

export class Texture {
    constructor(url) {
        this.pixels = null;
        this.width = 0;
        this.height = 0;
        this.load(url);
    }

    async load(url) {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.src = url;
        await new Promise((resolve) => {
            img.onload = () => {
                resolve();
            };
        });
        const tempCanvas = document.createElement("canvas");
        tempCanvas.width = img.width;
        tempCanvas.height = img.height;
        const tempCtx = tempCanvas.getContext("2d");
        tempCtx.drawImage(img, 0, 0);
        this.pixels = tempCtx.getImageData(0, 0, img.width, img.height).data;
        this.width = img.width;
        this.height = img.height;
    }
}
