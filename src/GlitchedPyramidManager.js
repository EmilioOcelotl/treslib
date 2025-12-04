// src/modules/GlitchedPyramidManager.js

import * as THREE from 'three';

export default class GlitchedPyramidManager {
    constructor(patternGenerator, options = {}) {
        this.patternGenerator = patternGenerator;
        
        // Configuración de la pirámide
        this.baseSize = options.baseSize || 2.0;
        this.topSize = options.topSize || 0.8;
        this.height = options.height || 3.0;
        this.segments = options.segments || 5;
        
        // Parámetros de deformación
        this.fractureThreshold = options.fractureThreshold || 0.4;
        this.glitchAmount = options.glitchAmount || 0.3;
        this.animationSpeed = options.animationSpeed || 1.0;
        
        // Estado
        this.pyramid = null;
        this.wireframe = null;
        this.fractureLines = null;
        this.originalPositions = null;
        this.time = 0;
        this.animate = true;
        this.glitchActive = true;
        this.displayMode = 'solid'; // 'solid', 'wire', 'fracture'
        
        // Datos del patrón actual
        this.currentPatternData = null;
        
        // Materiales
        this.solidMaterial = null;
        this.wireMaterial = null;
        this.fractureMaterial = null;
        
        // Inicializar
        this.createMaterials();
    }

    // ====================
    // INICIALIZACIÓN
    // ====================

    createMaterials() {
        // Material sólido con vertex colors
        this.solidMaterial = new THREE.MeshPhongMaterial({
            vertexColors: true,
            shininess: 50,
            side: THREE.DoubleSide,
            flatShading: true,
            transparent: true,
            opacity: 0.9
        });
        
        // Material wireframe
        this.wireMaterial = new THREE.MeshBasicMaterial({
            color: 0x88cc88,
            wireframe: true,
            transparent: true,
            opacity: 0.8
        });
        
        // Material para líneas de fractura
        this.fractureMaterial = new THREE.LineBasicMaterial({
            color: 0xff4444,
            linewidth: 2,
            transparent: true,
            opacity: 0.7
        });
    }

    createPyramid(patternData) {
        this.currentPatternData = patternData;
        
        // Generar geometría
        const geometryData = this.generatePyramidGeometry(patternData);
        
        // Crear geometría Three.js
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(geometryData.vertices, 3));
        geometry.setAttribute('normal', new THREE.BufferAttribute(geometryData.normals, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(geometryData.colors, 3));
        geometry.setIndex(new THREE.BufferAttribute(geometryData.indices, 1));
        
        // Crear mesh principal
        this.pyramid = new THREE.Mesh(geometry, this.solidMaterial);
        this.pyramid.castShadow = true;
        this.pyramid.receiveShadow = false;
        this.pyramid.userData = {
            type: 'glitchedPyramid',
            id: patternData.id,
            vertexCount: geometryData.vertexCount,
            faceCount: geometryData.faceCount
        };
        
        // Guardar posiciones originales para animación
        this.originalPositions = geometryData.vertices.slice();
        
        // Crear wireframe
        const wireGeometry = new THREE.WireframeGeometry(geometry);
        this.wireframe = new THREE.LineSegments(
            wireGeometry,
            new THREE.LineBasicMaterial({ 
                color: 0x444444, 
                transparent: true, 
                opacity: 0.3,
                linewidth: 1
            })
        );
        this.pyramid.add(this.wireframe);
        this.wireframe.visible = false;
        
        // Crear líneas de fractura
        this.createFractureLines(geometryData);
        
        // Configurar visualización inicial
        this.updateDisplayMode();
        
        return this.pyramid;
    }

    // ====================
    // GENERACIÓN DE GEOMETRÍA
    // ====================

    generatePyramidGeometry(patternData) {
        const { heightMap, fractureMap } = patternData;
        const baseSegments = this.segments * 4;
        const topSegments = Math.max(3, Math.floor(this.segments * (this.topSize / this.baseSize) * 4));
        
        const vertices = [];
        const normals = [];
        const colors = [];
        const indices = [];
        
        // Generar vértices de la base
        for (let i = 0; i <= baseSegments; i++) {
            const angle = (i / baseSegments) * Math.PI * 2;
            const x = Math.cos(angle) * this.baseSize;
            const z = Math.sin(angle) * this.baseSize;
            
            // Coordenadas UV para muestrear el patrón
            const u = (Math.cos(angle) * 0.5 + 0.5);
            const v = (Math.sin(angle) * 0.5 + 0.5);
            
            // Muestrear heightMap y fractureMap
            const heightValue = this.patternGenerator.sampleHeightMap(heightMap, u, v);
            const fractureValue = this.patternGenerator.sampleFractureMap(fractureMap, u, v);
            
            // Aplicar fractura (hueco si supera el umbral)
            const isFractured = fractureValue > this.fractureThreshold;
            const localHeight = isFractured ? -this.height * 0.3 : 0;
            
            // Aplicar glitch (deformación aleatoria)
            const glitchX = isFractured ? (Math.random() - 0.5) * this.glitchAmount * 2 : 0;
            const glitchY = isFractured ? (Math.random() - 0.5) * this.glitchAmount * 2 : 0;
            
            vertices.push(
                x + glitchX,
                localHeight,
                z + glitchY
            );
            
            // Color basado en altura y fractura
            const baseColor = isFractured ? 0.8 : 0.3 + heightValue * 0.5;
            const hueVariation = (Math.random() - 0.5) * 0.1;
            colors.push(
                baseColor + hueVariation,
                baseColor * 0.8,
                baseColor * 0.6
            );
            
            // Normal temporal (se calculará después)
            normals.push(0, 1, 0);
        }
        
        // Generar vértices de la parte superior
        for (let i = 0; i <= topSegments; i++) {
            const angle = (i / topSegments) * Math.PI * 2;
            const x = Math.cos(angle) * this.topSize;
            const z = Math.sin(angle) * this.topSize;
            
            // Coordenadas UV para la parte superior
            const u = (Math.cos(angle) * 0.3 + 0.5);
            const v = (Math.sin(angle) * 0.3 + 0.5);
            
            // Muestrear heightMap
            const heightValue = this.patternGenerator.sampleHeightMap(heightMap, u, v);
            
            // Aplicar glitch sutil
            const glitchX = (Math.random() - 0.5) * this.glitchAmount;
            const glitchY = (Math.random() - 0.5) * this.glitchAmount;
            
            vertices.push(
                x + glitchX,
                this.height + heightValue * 0.5,
                z + glitchY
            );
            
            // Color más claro en la parte superior
            const topColor = 0.5 + heightValue * 0.3;
            colors.push(
                topColor,
                topColor * 0.9,
                topColor * 0.7
            );
            
            normals.push(0, 1, 0);
        }
        
        // Vértice central superior (punta truncada)
        vertices.push(0, this.height + this.topSize * 0.5, 0);
        colors.push(0.9, 0.8, 0.6);
        normals.push(0, 1, 0);
        
        // Generar caras laterales
        for (let i = 0; i < baseSegments; i++) {
            const baseIdx1 = i;
            const baseIdx2 = (i + 1) % baseSegments;
            const topIdx1 = baseSegments + 1 + Math.floor(i * (topSegments / baseSegments));
            const topIdx2 = baseSegments + 1 + Math.floor((i + 1) * (topSegments / baseSegments));
            
            // Cara cuadrangular (dos triángulos)
            indices.push(baseIdx1, baseIdx2, topIdx1);
            indices.push(baseIdx2, topIdx2, topIdx1);
        }
        
        // Generar tapa superior
        const topCenterIdx = vertices.length / 3 - 1;
        for (let i = 0; i < topSegments; i++) {
            const topIdx1 = baseSegments + 1 + i;
            const topIdx2 = baseSegments + 1 + (i + 1) % topSegments;
            indices.push(topIdx1, topIdx2, topCenterIdx);
        }
        
        // Calcular normales
        this.calculateNormals(vertices, indices, normals);
        
        return {
            vertices: new Float32Array(vertices),
            normals: new Float32Array(normals),
            colors: new Float32Array(colors),
            indices: new Uint16Array(indices),
            vertexCount: vertices.length / 3,
            faceCount: indices.length / 3
        };
    }

    calculateNormals(vertices, indices, normals) {
        // Resetear normales
        for (let i = 0; i < normals.length; i++) {
            normals[i] = 0;
        }
        
        // Calcular normales por cara
        for (let i = 0; i < indices.length; i += 3) {
            const a = indices[i] * 3;
            const b = indices[i + 1] * 3;
            const c = indices[i + 2] * 3;
            
            const v1 = [vertices[a], vertices[a + 1], vertices[a + 2]];
            const v2 = [vertices[b], vertices[b + 1], vertices[b + 2]];
            const v3 = [vertices[c], vertices[c + 1], vertices[c + 2]];
            
            const edge1 = [v2[0] - v1[0], v2[1] - v1[1], v2[2] - v1[2]];
            const edge2 = [v3[0] - v1[0], v3[1] - v1[1], v3[2] - v1[2]];
            
            const normal = [
                edge1[1] * edge2[2] - edge1[2] * edge2[1],
                edge1[2] * edge2[0] - edge1[0] * edge2[2],
                edge1[0] * edge2[1] - edge1[1] * edge2[0]
            ];
            
            // Normalizar
            const length = Math.sqrt(normal[0]**2 + normal[1]**2 + normal[2]**2);
            if (length > 0) {
                normal[0] /= length;
                normal[1] /= length;
                normal[2] /= length;
            }
            
            // Sumar a cada vértice de la cara
            normals[a] += normal[0];
            normals[a + 1] += normal[1];
            normals[a + 2] += normal[2];
            
            normals[b] += normal[0];
            normals[b + 1] += normal[1];
            normals[b + 2] += normal[2];
            
            normals[c] += normal[0];
            normals[c + 1] += normal[1];
            normals[c + 2] += normal[2];
        }
        
        // Normalizar todas las normales
        for (let i = 0; i < normals.length; i += 3) {
            const nx = normals[i];
            const ny = normals[i + 1];
            const nz = normals[i + 2];
            const length = Math.sqrt(nx*nx + ny*ny + nz*nz);
            if (length > 0) {
                normals[i] /= length;
                normals[i + 1] /= length;
                normals[i + 2] /= length;
            }
        }
    }

    createFractureLines(geometryData) {
        if (this.fractureLines) {
            this.pyramid.remove(this.fractureLines);
        }
        
        const fractureVertices = [];
        const vertices = geometryData.vertices;
        const indices = geometryData.indices;
        
        // Encontrar aristas que conectan vértices fracturados
        for (let i = 0; i < indices.length; i += 3) {
            const i1 = indices[i] * 3;
            const i2 = indices[i + 1] * 3;
            const i3 = indices[i + 2] * 3;
            
            const y1 = vertices[i1 + 1];
            const y2 = vertices[i2 + 1];
            const y3 = vertices[i3 + 1];
            
            // Si un vértice está muy por debajo (fractura)
            const fractureThreshold = -0.1;
            
            if (y1 < fractureThreshold || y2 < fractureThreshold || y3 < fractureThreshold) {
                // Añadir aristas del triángulo fracturado
                fractureVertices.push(
                    vertices[i1], vertices[i1 + 1], vertices[i1 + 2],
                    vertices[i2], vertices[i2 + 1], vertices[i2 + 2],
                    
                    vertices[i2], vertices[i2 + 1], vertices[i2 + 2],
                    vertices[i3], vertices[i3 + 1], vertices[i3 + 2],
                    
                    vertices[i3], vertices[i3 + 1], vertices[i3 + 2],
                    vertices[i1], vertices[i1 + 1], vertices[i1 + 2]
                );
            }
        }
        
        if (fractureVertices.length > 0) {
            const lineGeometry = new THREE.BufferGeometry();
            lineGeometry.setAttribute('position', new THREE.Float32BufferAttribute(fractureVertices, 3));
            
            this.fractureLines = new THREE.LineSegments(lineGeometry, this.fractureMaterial);
            this.pyramid.add(this.fractureLines);
            this.fractureLines.visible = false;
        }
    }

    // ====================
    // ANIMACIÓN Y ACTUALIZACIÓN
    // ====================

    update(deltaTime) {
        if (!this.pyramid || !this.animate) return;
        
        this.time += deltaTime * this.animationSpeed;
        
        // Animación de rotación sutil
        this.pyramid.rotation.y = Math.sin(this.time * 0.3) * 0.1;
        this.pyramid.rotation.x = Math.cos(this.time * 0.2) * 0.05;
        
        // Pulsación en las fracturas
        if (this.fractureLines && this.fractureLines.visible) {
            const pulse = Math.sin(this.time * 3) * 0.5 + 0.5;
            this.fractureLines.material.color.setHSL(0.0, 1, 0.5 + pulse * 0.3);
            this.fractureLines.material.opacity = 0.5 + pulse * 0.3;
        }
        
        // Efecto glitch aleatorio
        if (this.glitchActive && Math.random() < 0.01) {
            this.applyRandomGlitch();
        }
    }

    applyRandomGlitch() {
        if (!this.pyramid) return;
        
        const glitchAmount = this.glitchAmount * 0.1;
        
        // Aplicar desplazamiento aleatorio
        this.pyramid.position.x += (Math.random() - 0.5) * glitchAmount;
        this.pyramid.position.z += (Math.random() - 0.5) * glitchAmount;
        
        // Pequeña rotación aleatoria
        this.pyramid.rotation.z += (Math.random() - 0.5) * 0.05;
        
        // Reset después de un momento
        setTimeout(() => {
            if (this.pyramid) {
                this.pyramid.position.x = 0;
                this.pyramid.position.z = 0;
                this.pyramid.rotation.z = 0;
            }
        }, 100);
    }

    // ====================
    // CONTROL DE VISUALIZACIÓN
    // ====================

    setDisplayMode(mode) {
        this.displayMode = mode;
        this.updateDisplayMode();
    }

    updateDisplayMode() {
        if (!this.pyramid) return;
        
        switch(this.displayMode) {
            case 'solid':
                this.pyramid.material = this.solidMaterial;
                if (this.wireframe) this.wireframe.visible = false;
                if (this.fractureLines) this.fractureLines.visible = false;
                break;
                
            case 'wire':
                this.pyramid.material = this.wireMaterial;
                if (this.wireframe) this.wireframe.visible = true;
                if (this.fractureLines) this.fractureLines.visible = true;
                break;
                
            case 'fracture':
                this.pyramid.material = this.wireMaterial;
                if (this.wireframe) this.wireframe.visible = false;
                if (this.fractureLines) this.fractureLines.visible = true;
                break;
        }
    }

    // ====================
    // CONFIGURACIÓN
    // ====================

    setParameters(params) {
        if (params.baseSize !== undefined) this.baseSize = params.baseSize;
        if (params.topSize !== undefined) this.topSize = params.topSize;
        if (params.height !== undefined) this.height = params.height;
        if (params.segments !== undefined) this.segments = params.segments;
        if (params.fractureThreshold !== undefined) this.fractureThreshold = params.fractureThreshold;
        if (params.glitchAmount !== undefined) this.glitchAmount = params.glitchAmount;
        if (params.animationSpeed !== undefined) this.animationSpeed = params.animationSpeed;
        
        // Si hay datos actuales, regenerar
        if (params.regenerate && this.currentPatternData) {
            this.createPyramid(this.currentPatternData);
        }
    }

    toggleAnimation() {
        this.animate = !this.animate;
        return this.animate;
    }

    toggleGlitch() {
        this.glitchActive = !this.glitchActive;
        return this.glitchActive;
    }

    // ====================
    // UTILIDADES
    // ====================

    getMesh() {
        return this.pyramid;
    }

    getStats() {
        if (!this.pyramid) return { vertices: 0, faces: 0, memory: 0 };
        
        const geometry = this.pyramid.geometry;
        const vertexCount = geometry.attributes.position.count;
        const faceCount = geometry.index ? geometry.index.count / 3 : 0;
        const memory = (vertexCount * 12) + (faceCount * 6); // Estimación en bytes
        
        return {
            vertices: vertexCount,
            faces: faceCount,
            memoryKB: Math.round(memory / 1024 * 100) / 100
        };
    }

    dispose() {
        if (this.pyramid) {
            this.pyramid.geometry.dispose();
            this.pyramid.material.dispose();
            if (this.wireframe) this.wireframe.geometry.dispose();
            if (this.wireframe) this.wireframe.material.dispose();
            if (this.fractureLines) this.fractureLines.geometry.dispose();
            if (this.fractureLines) this.fractureLines.material.dispose();
        }
    }
}