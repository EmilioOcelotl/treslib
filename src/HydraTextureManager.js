// src/modules/HydraTextureManager.js
import Hydra from 'hydra-synth';
import * as THREE from 'three';

export default class HydraTextureManager {
    constructor(hydraCanvas, options = {}) {
        this.canvas = hydraCanvas;
        this.currentTextureIndex = 0;
        this.hydra = null;
        this.threeTexture = null;
        
        // Configuración escalable
        this.maxTextures = options.maxTextures || 10; // Por defecto hasta 10 texturas
        this.textureNames = options.textureNames || []; // Nombres personalizables
        
        this.initHydra();
        this.initTextures();
    }

    initHydra() {
        this.hydra = new Hydra({ 
            canvas: this.canvas, 
            autoLoop: true, 
            detectAudio: false 
        });
        
        this.threeTexture = new THREE.CanvasTexture(this.canvas);
        this.threeTexture.needsUpdate = true;
    }

    initTextures() {
        // Array escalable de texturas - puedes añadir hasta maxTextures
        this.textures = [
            // Texturas base (0-3) - compatibles con tu código actual
            () => {
                osc(12, 0.1, 0.4)
                    .color(0.8 * 8, 0.9 * 4, 1)
                    .modulate(noise(3, 0.1).rotate(0.1, 0.02).scale(1.1), 0.1)
                    .modulate(src(o0).scale(1.1).rotate(0.01), 0.1)
                    .invert()
                    .saturate(1.1)
                    .hue(2)
                    .out();
            },
            () => {
                osc(10, 0.08, 0.8)
                    .color(1 * 2, 0.8 * 4, 0.9)
                    .modulate(noise(4, 0.1).rotate(0.01, 0.02).scale(1.1), 0.1)
                    .modulate(src(o0).scale(1.1).rotate(0.01), 0.2)
                    .invert()
                    .saturate(1.1)
                    .out();
            },
            () => {
                osc(12, 0.1, 0.4) // bajar progresivamente
                    .color(1.5, 0.9 * 8, 0.8 * 4)
                    .modulate(noise(1, 0.1).rotate(0.1, 0.02).scale(1.01), 0.5)
                    .modulate(src(o0).scale(1.1).rotate(0.01), 0.1)
                    .invert()
                    .saturate(1.1)
                    .out();
            },
            () => {
                osc(10, 0.14, 0.4)
                    .color(2, 0.9 * 8, 0.8 * 4)
                    .modulate(voronoi(0.8, 0.1).rotate(0.01, 0.02).scale(1.01), 0.3)
                    .modulate(src(o0).scale(1.1).rotate(0.1), 0.2)
                    .invert()
                    .saturate(1.1)
                    .out();
            }
            // Puedes añadir más texturas aquí: índice 4, 5, 6... hasta maxTextures
        ];

        // Nombres escalables para las texturas
        this.textureNames = this.textureNames.length > 0 ? this.textureNames : [
            "OSC_BLUE_CYAN",
            "OSC_GREEN_PURPLE", 
            "OSC_ORANGE_RED",
            "VORONOI_RED_BLUE"
            // Añade más nombres según añadas texturas
        ];
    }

    setTexture(index) {
        if (this.isValidTextureIndex(index)) {
            this.currentTextureIndex = index;
            this.textures[index]();
            this.threeTexture.needsUpdate = true;
            return true;
        }
        console.warn(`Índice de textura inválido: ${index}. Máximo permitido: ${this.textures.length - 1}`);
        return false;
    }

    isValidTextureIndex(index) {
        return index >= 0 && index < this.textures.length;
    }

    getCurrentTextureIndex() {
        return this.currentTextureIndex;
    }

    getTextureCount() {
        return this.textures.length;
    }

    getTextureName(index = this.currentTextureIndex) {
        if (index >= 0 && index < this.textureNames.length) {
            return this.textureNames[index];
        }
        return `TEXTURE_${index}`;
    }

    // Método para añadir texturas dinámicamente
    addTexture(textureFunction, name = null) {
        if (this.textures.length < this.maxTextures) {
            this.textures.push(textureFunction);
            if (name) {
                this.textureNames.push(name);
            }
            return true;
        }
        console.warn(`Límite máximo de texturas alcanzado: ${this.maxTextures}`);
        return false;
    }

    getThreeJSTexture() {
        this.threeTexture.needsUpdate = true;
        return this.threeTexture;
    }

    getPixelData() {
        try {
            const canvas = document.createElement("canvas");
            canvas.width = this.canvas.width;
            canvas.height = this.canvas.height;
            const ctx = canvas.getContext("2d");
            ctx.drawImage(this.canvas, 0, 0);
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            return imageData;
        } catch (error) {
            console.error('Error getting pixel data:', error);
            return null;
        }
    }

    update() {
        this.threeTexture.needsUpdate = true;
    }
}