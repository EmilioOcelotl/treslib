// src/modules/Pattern2DGenerator.js

export default class Pattern2DGenerator {
    constructor(width = 80, height = 80) {
        this.width = width;
        this.height = height;

        // Matriz de dither expandida para variación
        this.ditherMatrix = [
            [0, 12, 3, 15, 6, 9],
            [8, 4, 11, 7, 14, 2],
            [2, 14, 1, 13, 4, 11],
            [10, 6, 9, 3, 12, 0],
            [5, 13, 7, 1, 10, 8],
            [15, 3, 12, 5, 0, 14]
        ].map(row => row.map(v => (v * 4) + (Math.random() * 8 - 4)));
    }

    // ====================
    // MÉTODOS PÚBLICOS
    // ====================

    generateFromID(id) {
        const field = this.generateIntensityField(id);
        const dithered = this.applyDithering(field);
        const heightMap = this.normalizeHeightMap(field);
        const fractureMap = this.generateFracturePattern(id);
        
        return {
            id,
            dithered,        // Array de bytes (0-3)
            heightMap,       // Float32Array (0-1)
            fractureMap,     // Float32Array (0-1)
            rawField: field, // Campo original
            width: this.width,
            height: this.height
        };
    }

    createTexture(ditheredData) {
        const imageData = this.ditheredToImageData(ditheredData);
        return this.imageDataToTexture(imageData);
    }

    renderToCanvas(ditheredData, canvas, scale = 4) {
        const ctx = canvas.getContext('2d');
        const imageData = this.ditheredToImageData(ditheredData);
        
        canvas.width = this.width * scale;
        canvas.height = this.height * scale;
        
        ctx.imageSmoothingEnabled = false;
        
        // Crear imagen temporal para escalar
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = this.width;
        tempCanvas.height = this.height;
        const tempCtx = tempCanvas.getContext('2d');
        tempCtx.putImageData(imageData, 0, 0);
        
        ctx.drawImage(tempCanvas, 0, 0, canvas.width, canvas.height);
    }

    // ====================
    // GENERACIÓN DE PATRONES
    // ====================

    generateIntensityField(id) {
        const field = new Float32Array(this.width * this.height);

        // ---- Semillas del ID ----
        let mainSeed = 0;
        let seed2 = 0;
        for (let i = 0; i < id.length; i++) {
            const code = id.charCodeAt(i);
            mainSeed += code * (i + 1);
            seed2 += code * (id.length - i);
        }

        // ---- Parámetros de generación ----
        const freqX = (mainSeed % 9) + 1.5;
        const freqY = (seed2 % 13) + 2.5;
        const phaseShift = (mainSeed % 100) / 100 * Math.PI * 2;

        // ---- Patrones base ----
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                const idx = y * this.width + x;

                const val1 = Math.sin(x / freqX + phaseShift) * Math.cos(y / 20);
                const val2 = Math.cos(y / freqY - phaseShift) * Math.sin(x / 25);
                const val3 = Math.sin(x * y * 0.001) * Math.cos((x + y) * 0.01);
                const val4 = Math.sin((x + y * 0.7) / 3) * Math.cos((y - x * 0.7) / 4);

                let v = (val1 + val2) * 64 + val3 * 32 + val4 * 16;
                field[idx] = v;
            }
        }

        // ---- Inyección de patrones del ID ----
        for (let i = 0; i < id.length; i++) {
            const charCode = id.charCodeAt(i);
            const pattern = (charCode % 7) + 2;
            const offset = charCode % 5;

            for (let y = 0; y < this.height; y++) {
                const patternPos = (y + offset) % pattern;
                if (patternPos === 0) {
                    for (let x = 0; x < this.width; x++) {
                        const idx = y * this.width + x;
                        const drift = Math.sin(x * 0.1 + i) * 40;
                        field[idx] += drift + (charCode % 30);
                    }
                }
            }
        }

        // ---- Corrupción por bloques ----
        const blocks = [
            {x: 0, y: 0, w: this.width, h: this.height/3},
            {x: this.width/4, y: this.height/3, w: this.width/2, h: this.height/3},
            {x: 0, y: 2*this.height/3, w: this.width, h: this.height/3}
        ];

        blocks.forEach(block => {
            const shiftX = (mainSeed % 5) - 2;
            const shiftY = (seed2 % 3) - 1;
            
            for (let y = block.y; y < block.y + block.h && y < this.height; y++) {
                for (let x = block.x; x < block.x + block.w && x < this.width; x++) {
                    const srcX = Math.max(0, Math.min(this.width-1, x + shiftX));
                    const srcY = Math.max(0, Math.min(this.height-1, y + shiftY));
                    const srcIdx = srcY * this.width + srcX;
                    const dstIdx = y * this.width + x;
                    
                    if (Math.random() > 0.7) {
                        field[dstIdx] = field[srcIdx] * 0.8 + Math.random() * 50;
                    }
                }
            }
        });

        // ---- Eco vertical ----
        for (let y = 1; y < this.height; y++) {
            const echoStrength = 0.4 + Math.sin(y * 0.1) * 0.2;
            for (let x = 0; x < this.width; x++) {
                const idx = y * this.width + x;
                const prevIdx = (y - 1) * this.width + x;
                
                if (Math.random() > 0.1) {
                    field[idx] = field[idx] * (1 - echoStrength) + field[prevIdx] * echoStrength;
                }
            }
        }

        // ---- Refuerzo de detalles ----
        for (let i = 0; i < field.length; i++) {
            if (i % 37 === 0) {
                field[i] += Math.sin(i * 0.1) * 60;
            }
            if (i % 13 === 0) {
                field[i] += Math.cos(i * 0.05) * 20;
            }
        }

        return field;
    }

    generateFracturePattern(id) {
        const pattern = new Float32Array(this.width * this.height);
        let seed = 0;
        for (let c of id) seed += c.charCodeAt(0);
        
        // Patrón de fractura radial basado en ID
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                const idx = y * this.width + x;
                
                const centerX = this.width / 2;
                const centerY = this.height / 2;
                const dx = (x - centerX) / this.width;
                const dy = (y - centerY) / this.height;
                const distance = Math.sqrt(dx*dx + dy*dy) * 2;
                const angle = Math.atan2(dy, dx);
                
                const radial = Math.sin(distance * 20 + seed) * 0.5 + 0.5;
                const angular = Math.sin(angle * 8 + seed * 0.3) * 0.3 + 0.7;
                const noise = Math.sin(x * 0.1 + seed) * Math.cos(y * 0.1 + seed) * 0.2;
                
                pattern[idx] = (radial * angular + noise) * 0.8;
            }
        }
        
        return pattern;
    }

    normalizeHeightMap(field) {
        let min = Infinity, max = -Infinity;
        for (let v of field) {
            if (v < min) min = v;
            if (v > max) max = v;
        }

        const range = max - min;
        const normalized = new Float32Array(field.length);

        for (let i = 0; i < field.length; i++) {
            let val = (field[i] - min) / range;
            val = Math.pow(val, 1.3); // Acentuar contrastes
            normalized[i] = val;
        }

        return normalized;
    }

    applyDithering(grayscaleData) {
        const output = new Uint8Array(this.width * this.height);

        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                const index = y * this.width + x;
                const pixel = grayscaleData[index];
                
                const matrixY = y % this.ditherMatrix.length;
                const matrixX = x % this.ditherMatrix[0].length;
                const threshold = this.ditherMatrix[matrixY][matrixX];
                
                const diagonalBias = Math.sin((x + y) * 0.1) * 10;
                const value = pixel + threshold + diagonalBias - 40;

                // 4 niveles de gris
                if (value < 60) output[index] = 0;
                else if (value < 120) output[index] = 1;
                else if (value < 180) output[index] = 2;
                else output[index] = 3;
            }
        }

        // Añadir glitches aleatorios
        const glitchCount = Math.floor(this.width * this.height * 0.015);
        for (let g = 0; g < glitchCount; g++) {
            const idx = Math.floor(Math.random() * output.length);
            output[idx] = (output[idx] + Math.floor(Math.random() * 3) + 1) % 4;
        }

        return output;
    }

    // ====================
    // UTILIDADES DE RENDER
    // ====================

    ditheredToImageData(ditheredData) {
        const palette = [
            [0, 0, 0],      // Negro
            [85, 85, 85],   // Gris oscuro
            [170, 170, 170], // Gris claro
            [255, 255, 255]  // Blanco
        ];

        const imageData = new ImageData(this.width, this.height);
        const data = imageData.data;

        for (let i = 0; i < ditheredData.length; i++) {
            const color = palette[ditheredData[i]];
            const idx = i * 4;
            
            data[idx] = color[0];
            data[idx + 1] = color[1];
            data[idx + 2] = color[2];
            data[idx + 3] = 255;
        }

        return imageData;
    }

    imageDataToTexture(imageData) {
        const canvas = document.createElement('canvas');
        canvas.width = this.width;
        canvas.height = this.height;
        const ctx = canvas.getContext('2d');
        ctx.putImageData(imageData, 0, 0);
        
        // En un entorno real, esto devolvería una THREE.Texture
        // return new THREE.CanvasTexture(canvas);
        
        return canvas;
    }

    // ====================
    // INTERPOLACIÓN PARA 3D
    // ====================

    sampleHeightMap(heightMap, u, v) {
        const x = u * (this.width - 1);
        const y = v * (this.height - 1);
        const x1 = Math.floor(x);
        const y1 = Math.floor(y);
        const x2 = Math.min(x1 + 1, this.width - 1);
        const y2 = Math.min(y1 + 1, this.height - 1);
        
        const tx = x - x1;
        const ty = y - y1;
        
        const h00 = heightMap[y1 * this.width + x1];
        const h10 = heightMap[y1 * this.width + x2];
        const h01 = heightMap[y2 * this.width + x1];
        const h11 = heightMap[y2 * this.width + x2];
        
        // Interpolación bilineal
        return h00 * (1 - tx) * (1 - ty) +
               h10 * tx * (1 - ty) +
               h01 * (1 - tx) * ty +
               h11 * tx * ty;
    }

    sampleFractureMap(fractureMap, u, v) {
        // Misma lógica que sampleHeightMap pero para fracturas
        const x = u * (this.width - 1);
        const y = v * (this.height - 1);
        const x1 = Math.floor(x);
        const y1 = Math.floor(y);
        const x2 = Math.min(x1 + 1, this.width - 1);
        const y2 = Math.min(y1 + 1, this.height - 1);
        
        const tx = x - x1;
        const ty = y - y1;
        
        const f00 = fractureMap[y1 * this.width + x1];
        const f10 = fractureMap[y1 * this.width + x2];
        const f01 = fractureMap[y2 * this.width + x1];
        const f11 = fractureMap[y2 * this.width + x2];
        
        return f00 * (1 - tx) * (1 - ty) +
               f10 * tx * (1 - ty) +
               f01 * (1 - tx) * ty +
               f11 * tx * ty;
    }

    // ====================
    // SERIALIZACIÓN
    // ====================

    serialize(data) {
        return {
            id: data.id,
            width: data.width,
            height: data.height,
            dithered: Array.from(data.dithered),
            heightMap: Array.from(data.heightMap),
            fractureMap: Array.from(data.fractureMap)
        };
    }

    deserialize(serialized) {
        return {
            id: serialized.id,
            dithered: new Uint8Array(serialized.dithered),
            heightMap: new Float32Array(serialized.heightMap),
            fractureMap: new Float32Array(serialized.fractureMap),
            width: serialized.width,
            height: serialized.height
        };
    }
}