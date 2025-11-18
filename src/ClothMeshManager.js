// src/modules/ClothMeshManager.js

import * as THREE from 'three';

export default class ClothMeshManager {
    constructor(hydraTextureManager, options = {}) {
        this.textureManager = hydraTextureManager;
        
        // Configuración de la geometría
        this.width = options.width || 4;
        this.height = options.height || 2;
        this.segments = options.segments || 200;
        
        // Parámetros de deformación (configurables desde fuera)
        this.colorInfluence = options.colorInfluence || 0.25;
        this.smoothingRadius = options.smoothingRadius || 0.25;
        this.waveParams = options.waveParams || {
            amplitude1: 0.3,
            frequency1: 4.0,
            amplitude2: 0.2, 
            frequency2: 3.5,
            // ... más parámetros según necesites
        };
        
        this.cloth = null;
        this.geometry = null;
        this.clothMaterial = null;
        this.clothSobelMaterial = null;
        this.originalPositions = null;
        this.timeUniform = { value: 0 };
        
        this.initCloth();
    }

    initCloth() {
        // Crear geometría
        this.geometry = new THREE.PlaneGeometry(this.width, this.height, this.segments, this.segments);
        this.originalPositions = this.geometry.attributes.position.array.slice();
        
        // Crear materiales
        this.createMaterials();
        
        // Crear mesh
        this.cloth = new THREE.Mesh(this.geometry, this.clothMaterial);
        this.cloth.rotation.x = -Math.PI / 4;
        this.cloth.position.z = 0;
        this.cloth.position.y = 0.25;
    }

    createMaterials() {
        // Material principal con textura Hydra
        this.clothMaterial = new THREE.MeshPhongMaterial({
            color: 0xffffff,
            specular: 0x222222,
            shininess: 30,
            emissive: 0x000000,
            emissiveIntensity: 0,
            map: this.textureManager.getThreeJSTexture(),
            reflectivity: 0.9,
            combine: THREE.MixOperation,
            shading: THREE.SmoothShading
        });

        // Material Sobel (efecto de bordes)
        this.clothSobelMaterial = new THREE.ShaderMaterial({
            uniforms: {
                tDiffuse: { value: this.textureManager.getThreeJSTexture() },
                resolution: { value: new THREE.Vector2(1920, 1080) },
                time: this.timeUniform
            },
            vertexShader: `
                varying vec2 vUv;
                void main() { 
                    vUv = uv; 
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); 
                }
            `,
            fragmentShader: `
                uniform sampler2D tDiffuse;
                uniform vec2 resolution;
                uniform float time;
                varying vec2 vUv;
                
                void main() {
                    float dx = 1.0 / resolution.x;
                    float dy = 1.0 / resolution.y;
                    
                    vec2 animatedUV = vUv + vec2(sin(time * 0.5 + vUv.y * 5.0) * 0.001, cos(time * 0.3 + vUv.x * 5.0) * 0.001);
                    
                    vec3 tl = texture2D(tDiffuse, animatedUV + vec2(-dx,-dy)).rgb;
                    vec3 t  = texture2D(tDiffuse, animatedUV + vec2(0.0,-dy)).rgb;
                    vec3 tr = texture2D(tDiffuse, animatedUV + vec2(dx,-dy)).rgb;
                    vec3 l  = texture2D(tDiffuse, animatedUV + vec2(-dx,0.0)).rgb;
                    vec3 r  = texture2D(tDiffuse, animatedUV + vec2(dx,0.0)).rgb;
                    vec3 bl = texture2D(tDiffuse, animatedUV + vec2(-dx,dy)).rgb;
                    vec3 b  = texture2D(tDiffuse, animatedUV + vec2(0.0,dy)).rgb;
                    vec3 br = texture2D(tDiffuse, animatedUV + vec2(dx,dy)).rgb;
                    
                    vec3 hor = -tl - 2.0*l - bl + tr + 2.0*r + br;
                    vec3 ver = -tl - 2.0*t - tr + bl + 2.0*b + br;
                    float edge = length(hor + ver);
                    
                    float pulse = 0.8 + 0.2 * sin(time * 2.0);
                    vec3 color = vec3(edge * pulse);
                    
                    gl_FragColor = vec4(color, 1.0);
                }
            `
        });
    }

    updateGeometry() {
        const positions = this.cloth.geometry.attributes.position;
        const imageData = this.textureManager.getPixelData();
        
        if (!imageData) return;
        
        const data = imageData.data;
        const canvasWidth = imageData.width;
        const canvasHeight = imageData.height;

        for (let i = 0; i < positions.count; i++) {
            const ix = i * 3, iy = i * 3 + 1, iz = i * 3 + 2;
            const x = this.originalPositions[ix], y = this.originalPositions[iy];
            const u = x / this.width + 0.5, v = y / this.height + 0.5;
            
            // Calcular intensidad del color con smoothing
            const intensity = this.calculateSmoothedIntensity(data, canvasWidth, canvasHeight, u, v);
            
            // Aplicar deformación de ondas
            const waveDisplacement = this.multiWave(x, y, this.timeUniform.value);
            
            // Combinar deformaciones
            positions.array[iz] = waveDisplacement + (intensity - 0.5) * this.colorInfluence;
            positions.array[ix] = x + Math.sin(y * 2.0 + this.timeUniform.value * 1.5) * 0.01;
            positions.array[iy] = y + Math.cos(x * 1.7 + this.timeUniform.value * 1.2) * 0.01;
        }

        positions.needsUpdate = true;
        this.cloth.geometry.computeVertexNormals();
    }

    calculateSmoothedIntensity(data, width, height, u, v) {
        let totalR = 0, totalG = 0, totalB = 0, sampleCount = 0;

        for (let dx = -this.smoothingRadius; dx <= this.smoothingRadius; dx++) {
            for (let dy = -this.smoothingRadius; dy <= this.smoothingRadius; dy++) {
                const px = Math.floor(u * (width - 1)) + dx;
                const py = Math.floor((1 - v) * (height - 1)) + dy;
                if (px >= 0 && px < width && py >= 0 && py < height) {
                    const pixelIndex = (py * width + px) * 4;
                    totalR += data[pixelIndex];
                    totalG += data[pixelIndex + 1];
                    totalB += data[pixelIndex + 2];
                    sampleCount++;
                }
            }
        }

        const r = totalR / sampleCount / 255;
        const g = totalG / sampleCount / 255;
        const b = totalB / sampleCount / 255;
        const intensity = r * 0.3 + g * 0.6 + b * 0.1;
        return this.smoothstep(0.2, 0.8, intensity);
    }

    multiWave(x, y, t) {
        const wave1 = Math.sin(x * 4.0 + t * 1.0) * 0.3;
        const wave2 = Math.cos(x * 3.5 + y * 2.0 + t * 1.3) * 0.2;
        const wave3 = Math.sin(x * 1.0 + y * 1.5 + t * 0.7) * 0.8;
        const wave4 = Math.sin(x * 5.2 + y * 3.7 + t * 1.7) * Math.cos(x * 2.3 + y * 1.9 + t * 0.9) * 0.05;
        return wave1 + wave2 * wave3 + wave4;
    }

    smoothstep(min, max, value) {
        const x = Math.max(0, Math.min(1, (value - min) / (max - min)));
        return x * x * (3 - 2 * x);
    }

    update(timeDelta = 0.01) {
        this.timeUniform.value += timeDelta;
        this.updateGeometry();
    }

    getMesh() {
        return this.cloth;
    }

    setMaterial(materialType) {
        switch(materialType) {
            case 'sobel':
                this.cloth.material = this.clothSobelMaterial;
                break;
            case 'standard':
            default:
                this.cloth.material = this.clothMaterial;
                break;
        }
    }

    setDeformationParams(params) {
        if (params.colorInfluence !== undefined) this.colorInfluence = params.colorInfluence;
        if (params.smoothingRadius !== undefined) this.smoothingRadius = params.smoothingRadius;
        if (params.waveParams) this.waveParams = { ...this.waveParams, ...params.waveParams };
    }
}