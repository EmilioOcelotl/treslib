// snapshotCompressor.js
export default class SnapshotCompressor {
    constructor(displayWidth = 80, displayHeight = 80) {
        this.targetWidth = displayWidth;
        this.targetHeight = displayHeight;
        this.ditherMatrix = [
            [0, 8, 2, 10],
            [12, 4, 14, 6],
            [3, 11, 1, 9],
            [15, 7, 13, 5]
        ].map(row => row.map(val => val * 4));
    }

    captureHydraFrame(hydraCanvas) {
        try {
            const imageData = this.prepareImage(hydraCanvas, hydraCanvas.width, hydraCanvas.height);
            const grayscale = this.convertToGrayscale(imageData);
            const dithered = this.applyDithering(grayscale);
            const compressed = this.compress2bpp(dithered);
            return this.bytesToHex(compressed);
        } catch (error) {
            console.error('Error capturando snapshot:', error);
            return '';
        }
    }

    // 👇 NUEVO MÉTODO PARA EXTRAER PALETA RISO
    extractRisoPalette(hydraCanvas) {
        try {
            const imageData = this.prepareImage(hydraCanvas, hydraCanvas.width, hydraCanvas.height);
            const data = imageData.data;
            const colorMap = {};
            
            // Muestrear colores dominantes
            for (let i = 0; i < data.length; i += 16) {
                const r = data[i];
                const g = data[i + 1];
                const b = data[i + 2];
                
                // Cuantizar a paleta reducida para agrupar similares
                const quantized = this.quantizeColor(r, g, b);
                const key = `${quantized.r},${quantized.g},${quantized.b}`;
                
                colorMap[key] = (colorMap[key] || 0) + 1;
            }
            
            // Ordenar por frecuencia y tomar los 4 más comunes
            const dominantColors = Object.entries(colorMap)
                .sort(([,a], [,b]) => b - a)
                .slice(0, 4)
                .map(([color]) => {
                    const [r, g, b] = color.split(',').map(Number);
                    return { r, g, b };
                });
            
            return dominantColors;
        } catch (error) {
            console.error('Error extrayendo paleta RISO:', error);
            return [];
        }
    }

    quantizeColor(r, g, b) {
        // Reducir a 4 niveles por canal (para riso)
        return {
            r: Math.floor(r / 64) * 64,
            g: Math.floor(g / 64) * 64,
            b: Math.floor(b / 64) * 64
        };
    }

    prepareImage(imageData, width, height) {
        const tempCanvas = document.createElement('canvas');
        const tempCtx = tempCanvas.getContext('2d');
        tempCanvas.width = width;
        tempCanvas.height = height;
        
        tempCtx.drawImage(imageData, 0, 0, width, height);
        
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = this.targetWidth;
        canvas.height = this.targetHeight;
        
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(tempCanvas, 0, 0, this.targetWidth, this.targetHeight);
        
        return ctx.getImageData(0, 0, this.targetWidth, this.targetHeight);
    }

    convertToGrayscale(imageData) {
        const data = imageData.data;
        const grayData = new Uint8ClampedArray(this.targetWidth * this.targetHeight);
        
        for (let i = 0, j = 0; i < data.length; i += 4, j++) {
            grayData[j] = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
        }
        
        return grayData;
    }

    applyDithering(grayscaleData) {
        const output = new Uint8Array(this.targetWidth * this.targetHeight);
        
        for (let y = 0; y < this.targetHeight; y++) {
            for (let x = 0; x < this.targetWidth; x++) {
                const index = y * this.targetWidth + x;
                const pixel = grayscaleData[index];
                const threshold = this.ditherMatrix[y % 4][x % 4];
                const value = pixel + threshold - 32;
                
                if (value < 64) {
                    output[index] = 0;
                } else if (value < 128) {
                    output[index] = 1;
                } else if (value < 192) {
                    output[index] = 2;
                } else {
                    output[index] = 3;
                }
            }
        }
        
        return output;
    }

    compress2bpp(imageArray) {
        const compressed = [];
        
        for (let y = 0; y < this.targetHeight; y++) {
            for (let x = 0; x < this.targetWidth; x += 4) {
                let byteVal = 0;
                for (let n = 0; n < 4; n++) {
                    if (x + n < this.targetWidth) {
                        const colorIdx = imageArray[y * this.targetWidth + x + n] & 0x03;
                        byteVal |= colorIdx << (6 - n * 2);
                    }
                }
                compressed.push(byteVal);
            }
        }
        return compressed;
    }

    bytesToHex(bytes) {
        return bytes.map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
    }

    hexToBytes(hexString) {
        const bytes = [];
        for (let i = 0; i < hexString.length; i += 2) {
            bytes.push(parseInt(hexString.substr(i, 2), 16));
        }
        return bytes;
    }

    decompress2bpp(compressedBytes) {
        const pixels = new Array(this.targetWidth * this.targetHeight);
        let pixelIndex = 0;

        for (let i = 0; i < compressedBytes.length; i++) {
            const byte = compressedBytes[i];
            for (let n = 0; n < 4; n++) {
                if (pixelIndex < pixels.length) {
                    const shift = 6 - n * 2;
                    const colorIndex = (byte >> shift) & 0x03;
                    pixels[pixelIndex++] = colorIndex;
                }
            }
        }
        return pixels;
    }

    ditheredToImageData(ditheredData) {
        const palette = [
            [0, 0, 0],
            [85, 85, 85],
            [170, 170, 170],
            [255, 255, 255]
        ];
        
        const imageData = new ImageData(this.targetWidth, this.targetHeight);
        const data = imageData.data;
        
        for (let i = 0; i < ditheredData.length; i++) {
            const color = palette[ditheredData[i]];
            const dataIndex = i * 4;
            data[dataIndex] = color[0];
            data[dataIndex + 1] = color[1];
            data[dataIndex + 2] = color[2];
            data[dataIndex + 3] = 255;
        }
        
        return imageData;
    }
}