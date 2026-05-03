/* RENDERit V1.0.5 · Offline WebGL2 PBR viewport core */
(function () {
  'use strict';

  const TAU = Math.PI * 2;
  const EPS = 1e-6;
  const vec3 = {
    add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]],
    sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
    scale: (a, s) => [a[0] * s, a[1] * s, a[2] * s],
    dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
    cross: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
    len: (a) => Math.hypot(a[0], a[1], a[2]),
    norm(a) { const l = vec3.len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; }
  };

  function mat4Identity() { return [1, 0, 0, 0,  0, 1, 0, 0,  0, 0, 1, 0,  0, 0, 0, 1]; }
  function mat4Multiply(a, b) {
    const out = new Array(16);
    for (let c = 0; c < 4; c++) {
      for (let r = 0; r < 4; r++) {
        out[c * 4 + r] = a[0 * 4 + r] * b[c * 4 + 0] + a[1 * 4 + r] * b[c * 4 + 1] + a[2 * 4 + r] * b[c * 4 + 2] + a[3 * 4 + r] * b[c * 4 + 3];
      }
    }
    return out;
  }
  function mat4Perspective(fov, aspect, near, far) {
    const f = 1 / Math.tan(fov / 2);
    const nf = 1 / (near - far);
    return [f / aspect, 0, 0, 0,  0, f, 0, 0,  0, 0, (far + near) * nf, -1,  0, 0, (2 * far * near) * nf, 0];
  }
  function mat4LookAt(eye, target, up) {
    const z = vec3.norm(vec3.sub(eye, target));
    const x = vec3.norm(vec3.cross(up, z));
    const y = vec3.cross(z, x);
    return [x[0], y[0], z[0], 0,  x[1], y[1], z[1], 0,  x[2], y[2], z[2], 0,  -vec3.dot(x, eye), -vec3.dot(y, eye), -vec3.dot(z, eye), 1];
  }
  function mat4Model(position, rotation, scale) {
    const [x, y, z] = rotation;
    const [sx, sy, sz] = scale;
    const cx = Math.cos(x), sxn = Math.sin(x), cy = Math.cos(y), syn = Math.sin(y), cz = Math.cos(z), szn = Math.sin(z);
    const rx = [1,0,0,0, 0,cx,sxn,0, 0,-sxn,cx,0, 0,0,0,1];
    const ry = [cy,0,-syn,0, 0,1,0,0, syn,0,cy,0, 0,0,0,1];
    const rz = [cz,szn,0,0, -szn,cz,0,0, 0,0,1,0, 0,0,0,1];
    const sc = [sx,0,0,0, 0,sy,0,0, 0,0,sz,0, 0,0,0,1];
    const tr = [1,0,0,0, 0,1,0,0, 0,0,1,0, position[0],position[1],position[2],1];
    return mat4Multiply(tr, mat4Multiply(rz, mat4Multiply(ry, mat4Multiply(rx, sc))));
  }
  function transformPoint(m, p) {
    return [m[0]*p[0] + m[4]*p[1] + m[8]*p[2] + m[12], m[1]*p[0] + m[5]*p[1] + m[9]*p[2] + m[13], m[2]*p[0] + m[6]*p[1] + m[10]*p[2] + m[14]];
  }
  function compileShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      throw new Error(gl.getShaderInfoLog(shader) || 'Shader compilation failed');
    }
    return shader;
  }
  function createProgram(gl, vertexSource, fragmentSource) {
    const program = gl.createProgram();
    gl.attachShader(program, compileShader(gl, gl.VERTEX_SHADER, vertexSource));
    gl.attachShader(program, compileShader(gl, gl.FRAGMENT_SHADER, fragmentSource));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error(gl.getProgramInfoLog(program) || 'Program link failed');
    }
    return program;
  }
  function downloadBlob(name, blob) {
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = name;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(link.href), 1500);
  }

  const vertexShader = `#version 300 es
    precision highp float;
    layout(location=0) in vec3 aPosition;
    layout(location=1) in vec3 aNormal;
    layout(location=2) in vec2 aUv;
    uniform mat4 uModel;
    uniform mat4 uView;
    uniform mat4 uProjection;
    out vec3 vWorldPos;
    out vec3 vNormal;
    out vec2 vUv;
    void main(){
      vec4 world = uModel * vec4(aPosition, 1.0);
      vWorldPos = world.xyz;
      vNormal = normalize(mat3(uModel) * aNormal);
      vUv = aUv;
      gl_Position = uProjection * uView * world;
    }
  `;
  const fragmentShader = `#version 300 es
    precision highp float;
    in vec3 vWorldPos;
    in vec3 vNormal;
    in vec2 vUv;
    out vec4 fragColor;
    uniform vec3 uCameraPos;
    uniform vec3 uAlbedo;
    uniform float uRoughness;
    uniform float uMetalness;
    uniform float uClearcoat;
    uniform float uTransmission;
    uniform float uEmission;
    uniform bool uUseAlbedoMap;
    uniform sampler2D uAlbedoMap;
    uniform float uTextureRepeat;
    uniform float uExposure;
    uniform float uEnvStrength;
    uniform vec3 uEnvTop;
    uniform vec3 uEnvHorizon;
    uniform int uLightCount;
    uniform vec3 uLightPos[6];
    uniform vec3 uLightColor[6];
    uniform float uLightIntensity[6];
    const float PI = 3.14159265359;
    vec3 fresnelSchlick(float cosTheta, vec3 F0){ return F0 + (1.0 - F0) * pow(clamp(1.0 - cosTheta, 0.0, 1.0), 5.0); }
    float distributionGGX(vec3 N, vec3 H, float roughness){
      float a = roughness * roughness;
      float a2 = a * a;
      float NdotH = max(dot(N, H), 0.0);
      float NdotH2 = NdotH * NdotH;
      float denom = (NdotH2 * (a2 - 1.0) + 1.0);
      return a2 / max(PI * denom * denom, 0.0001);
    }
    float geometrySchlickGGX(float NdotV, float roughness){
      float r = roughness + 1.0;
      float k = (r * r) / 8.0;
      return NdotV / max(NdotV * (1.0 - k) + k, 0.0001);
    }
    float geometrySmith(vec3 N, vec3 V, vec3 L, float roughness){
      return geometrySchlickGGX(max(dot(N,V),0.0), roughness) * geometrySchlickGGX(max(dot(N,L),0.0), roughness);
    }
    vec3 aces(vec3 x){
      float a = 2.51; float b = 0.03; float c = 2.43; float d = 0.59; float e = 0.14;
      return clamp((x*(a*x+b))/(x*(c*x+d)+e), 0.0, 1.0);
    }
    void main(){
      vec3 N = normalize(vNormal);
      vec3 V = normalize(uCameraPos - vWorldPos);
      vec3 R = reflect(-V, N);
      vec3 albedo = pow(uAlbedo, vec3(2.2));
      if(uUseAlbedoMap){
        vec3 tex = texture(uAlbedoMap, vUv * max(uTextureRepeat, 0.1)).rgb;
        albedo *= pow(tex, vec3(2.2));
      }
      float roughness = clamp(uRoughness, 0.03, 1.0);
      float metalness = clamp(uMetalness, 0.0, 1.0);
      vec3 F0 = mix(vec3(0.04), albedo, metalness);
      vec3 Lo = vec3(0.0);
      for(int i = 0; i < 6; i++){
        if(i >= uLightCount) break;
        vec3 L = normalize(uLightPos[i] - vWorldPos);
        vec3 H = normalize(V + L);
        float dist = length(uLightPos[i] - vWorldPos);
        float attenuation = 1.0 / max(dist * dist * 0.18, 0.16);
        vec3 radiance = uLightColor[i] * uLightIntensity[i] * attenuation;
        float NDF = distributionGGX(N, H, roughness);
        float G = geometrySmith(N, V, L, roughness);
        vec3 F = fresnelSchlick(max(dot(H,V), 0.0), F0);
        vec3 numerator = NDF * G * F;
        float denom = 4.0 * max(dot(N,V), 0.0) * max(dot(N,L), 0.0) + 0.0001;
        vec3 specular = numerator / denom;
        vec3 kS = F;
        vec3 kD = (vec3(1.0) - kS) * (1.0 - metalness);
        float NdotL = max(dot(N,L), 0.0);
        Lo += (kD * albedo / PI + specular) * radiance * NdotL;
      }
      float skyMix = clamp(N.y * 0.5 + 0.5, 0.0, 1.0);
      vec3 env = mix(uEnvHorizon, uEnvTop, skyMix) * uEnvStrength;
      float fres = pow(1.0 - max(dot(N, V), 0.0), 3.0);
      vec3 clear = mix(vec3(0.0), env, uClearcoat * (0.18 + fres * 0.65));
      vec3 transmitted = mix(vec3(0.0), env * albedo, uTransmission * 0.55);
      vec3 ambient = albedo * env * (0.28 + 0.45 * (1.0 - metalness));
      vec3 color = ambient + Lo + clear + transmitted + albedo * uEmission * 2.4;
      color = aces(color * uExposure);
      color = pow(color, vec3(1.0/2.2));
      fragColor = vec4(color, 1.0);
    }
  `;

  const skyVertexShader = `#version 300 es
    precision highp float;
    layout(location=0) in vec2 aPosition;
    out vec2 vUv;
    void main(){ vUv = aPosition * 0.5 + 0.5; gl_Position = vec4(aPosition, 0.0, 1.0); }
  `;
  const skyFragmentShader = `#version 300 es
    precision highp float;
    in vec2 vUv;
    out vec4 fragColor;
    uniform vec3 uEnvTop;
    uniform vec3 uEnvHorizon;
    uniform vec3 uEnvGround;
    uniform float uEnvStrength;
    uniform bool uGrid;
    void main(){
      float y = vUv.y;
      vec3 color = mix(uEnvGround, uEnvHorizon, smoothstep(0.0, 0.55, y));
      color = mix(color, uEnvTop, smoothstep(0.5, 1.0, y));
      float vignette = smoothstep(0.95, 0.25, distance(vUv, vec2(0.5)));
      color *= (0.45 + vignette * 0.70) * max(uEnvStrength, 0.05);
      if(uGrid){
        vec2 g = abs(fract((vUv - 0.5) * 32.0) - 0.5);
        float line = 1.0 - smoothstep(0.0, 0.018, min(g.x, g.y));
        color += vec3(line * 0.018);
      }
      fragColor = vec4(color, 1.0);
    }
  `;

  function computeNormals(positions, indices) {
    const normals = new Float32Array(positions.length);
    for (let i = 0; i < indices.length; i += 3) {
      const ia = indices[i] * 3, ib = indices[i + 1] * 3, ic = indices[i + 2] * 3;
      const a = [positions[ia], positions[ia + 1], positions[ia + 2]];
      const b = [positions[ib], positions[ib + 1], positions[ib + 2]];
      const c = [positions[ic], positions[ic + 1], positions[ic + 2]];
      const n = vec3.norm(vec3.cross(vec3.sub(b, a), vec3.sub(c, a)));
      for (const idx of [ia, ib, ic]) { normals[idx] += n[0]; normals[idx + 1] += n[1]; normals[idx + 2] += n[2]; }
    }
    for (let i = 0; i < normals.length; i += 3) {
      const n = vec3.norm([normals[i], normals[i + 1], normals[i + 2]]);
      normals[i] = n[0]; normals[i + 1] = n[1]; normals[i + 2] = n[2];
    }
    return Array.from(normals);
  }

  function finalizeGeometry(name, positions, indices, normals, uvs) {
    if (!normals || normals.length !== positions.length) normals = computeNormals(positions, indices);
    let min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < positions.length; i += 3) {
      min = [Math.min(min[0], positions[i]), Math.min(min[1], positions[i + 1]), Math.min(min[2], positions[i + 2])];
      max = [Math.max(max[0], positions[i]), Math.max(max[1], positions[i + 1]), Math.max(max[2], positions[i + 2])];
    }
    const center = [(min[0]+max[0])/2, (min[1]+max[1])/2, (min[2]+max[2])/2];
    let radius = 0.1;
    for (let i = 0; i < positions.length; i += 3) radius = Math.max(radius, vec3.len(vec3.sub([positions[i], positions[i+1], positions[i+2]], center)));
    if (!uvs || uvs.length !== (positions.length / 3) * 2) {
      uvs = [];
      const spanX = Math.max(0.0001, max[0] - min[0]);
      const spanZ = Math.max(0.0001, max[2] - min[2]);
      const spanY = Math.max(0.0001, max[1] - min[1]);
      const useXY = spanZ < Math.min(spanX, spanY) * 0.2;
      for (let i = 0; i < positions.length; i += 3) {
        const u = (positions[i] - min[0]) / spanX;
        const v = useXY ? (positions[i + 1] - min[1]) / spanY : (positions[i + 2] - min[2]) / spanZ;
        uvs.push(u, v);
      }
    }
    return { name, positions, normals, uvs, indices, min, max, center, radius, triangleCount: indices.length / 3 };
  }

  function createBoxGeometry(size = 1) {
    const s = size / 2;
    const faces = [
      [[-s,-s,s],[s,-s,s],[s,s,s],[-s,s,s],[0,0,1]], [[s,-s,-s],[-s,-s,-s],[-s,s,-s],[s,s,-s],[0,0,-1]],
      [[-s,s,s],[s,s,s],[s,s,-s],[-s,s,-s],[0,1,0]], [[-s,-s,-s],[s,-s,-s],[s,-s,s],[-s,-s,s],[0,-1,0]],
      [[s,-s,s],[s,-s,-s],[s,s,-s],[s,s,s],[1,0,0]], [[-s,-s,-s],[-s,-s,s],[-s,s,s],[-s,s,-s],[-1,0,0]]
    ];
    const positions = [], normals = [], indices = [];
    for (const f of faces) {
      const base = positions.length / 3;
      for (let i = 0; i < 4; i++) { positions.push(...f[i]); normals.push(...f[4]); }
      indices.push(base, base+1, base+2, base, base+2, base+3);
    }
    return finalizeGeometry('Box', positions, indices, normals);
  }

  function createSphereGeometry(radius = 0.72, segments = 48, rings = 24) {
    const positions = [], normals = [], indices = [];
    for (let y = 0; y <= rings; y++) {
      const v = y / rings;
      const theta = v * Math.PI;
      for (let x = 0; x <= segments; x++) {
        const u = x / segments;
        const phi = u * TAU;
        const n = [Math.cos(phi) * Math.sin(theta), Math.cos(theta), Math.sin(phi) * Math.sin(theta)];
        positions.push(n[0] * radius, n[1] * radius, n[2] * radius);
        normals.push(...n);
      }
    }
    for (let y = 0; y < rings; y++) for (let x = 0; x < segments; x++) {
      const a = y * (segments + 1) + x;
      const b = a + segments + 1;
      indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
    return finalizeGeometry('Sphere', positions, indices, normals);
  }

  function createCylinderGeometry(radius = 0.55, height = 1.25, segments = 48) {
    const positions = [], normals = [], indices = [];
    for (let i = 0; i <= segments; i++) {
      const a = (i / segments) * TAU;
      const x = Math.cos(a) * radius, z = Math.sin(a) * radius;
      positions.push(x, -height/2, z, x, height/2, z);
      normals.push(Math.cos(a),0,Math.sin(a), Math.cos(a),0,Math.sin(a));
    }
    for (let i = 0; i < segments; i++) {
      const b = i * 2;
      indices.push(b, b+1, b+2, b+1, b+3, b+2);
    }
    const bottomCenter = positions.length / 3; positions.push(0,-height/2,0); normals.push(0,-1,0);
    const topCenter = positions.length / 3; positions.push(0,height/2,0); normals.push(0,1,0);
    for (let i = 0; i < segments; i++) {
      const b = i * 2, n = ((i+1) % segments) * 2;
      indices.push(bottomCenter, n, b, topCenter, b+1, n+1);
    }
    return finalizeGeometry('Cylinder', positions, indices, normals);
  }

  function createConeGeometry(radius = 0.62, height = 1.35, segments = 48) {
    const positions = [], normals = [], indices = [];
    const apex = [0, height / 2, 0];
    for (let i = 0; i <= segments; i++) {
      const a = (i / segments) * TAU;
      const x = Math.cos(a) * radius, z = Math.sin(a) * radius;
      const sideNormal = vec3.norm([x, radius / height, z]);
      positions.push(x, -height / 2, z, ...apex);
      normals.push(...sideNormal, ...sideNormal);
    }
    for (let i = 0; i < segments; i++) {
      const b = i * 2;
      indices.push(b, b + 1, b + 2);
    }
    const center = positions.length / 3;
    positions.push(0, -height / 2, 0);
    normals.push(0, -1, 0);
    for (let i = 0; i <= segments; i++) {
      const a = (i / segments) * TAU;
      positions.push(Math.cos(a) * radius, -height / 2, Math.sin(a) * radius);
      normals.push(0, -1, 0);
    }
    for (let i = 0; i < segments; i++) indices.push(center, center + i + 1, center + i + 2);
    return finalizeGeometry('Cone', positions, indices, normals);
  }

  function createPlaneGeometry(size = 1.6) {
    const s = size / 2;
    const positions = [-s, 0, -s, s, 0, -s, s, 0, s, -s, 0, s];
    const normals = [0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0];
    const indices = [0, 1, 2, 0, 2, 3];
    return finalizeGeometry('Plane', positions, indices, normals);
  }

  function createTorusGeometry(radius = 0.58, tube = 0.18, radialSegments = 56, tubeSegments = 16) {
    const positions = [], normals = [], indices = [];
    for (let j = 0; j <= tubeSegments; j++) {
      const v = (j / tubeSegments) * TAU;
      const cv = Math.cos(v), sv = Math.sin(v);
      for (let i = 0; i <= radialSegments; i++) {
        const u = (i / radialSegments) * TAU;
        const cu = Math.cos(u), su = Math.sin(u);
        const x = (radius + tube * cv) * cu;
        const y = tube * sv;
        const z = (radius + tube * cv) * su;
        positions.push(x, y, z);
        normals.push(cv * cu, sv, cv * su);
      }
    }
    const row = radialSegments + 1;
    for (let j = 0; j < tubeSegments; j++) {
      for (let i = 0; i < radialSegments; i++) {
        const a = j * row + i;
        const b = a + row;
        indices.push(a, b, a + 1, b, b + 1, a + 1);
      }
    }
    return finalizeGeometry('Torus', positions, indices, normals);
  }

  function createGroundGeometry(size = 18) {
    const s = size / 2;
    const positions = [-s,0,-s, s,0,-s, s,0,s, -s,0,s];
    const normals = [0,1,0, 0,1,0, 0,1,0, 0,1,0];
    const uvs = [0,0, 1,0, 1,1, 0,1];
    const indices = [0, 2, 1, 0, 3, 2];
    return finalizeGeometry('Reflective Ground', positions, indices, normals, uvs);
  }

  function parseOBJ(text, fallbackName = 'Imported OBJ') {
    const verts = [], norms = [];
    const groups = [];
    let active = null;

    function makeGroup(name) {
      const clean = String(name || fallbackName || 'OBJ Mesh').trim() || 'OBJ Mesh';
      active = { name: clean, positions: [], normals: [], indices: [], map: new Map() };
      groups.push(active);
      return active;
    }

    function addVertex(token) {
      if (!active) makeGroup(fallbackName);
      const key = token;
      if (active.map.has(key)) return active.map.get(key);
      const parts = token.split('/');
      const vi = parseInt(parts[0], 10);
      const ni = parts[2] ? parseInt(parts[2], 10) : 0;
      const v = verts[vi < 0 ? verts.length + vi : vi - 1];
      const n = ni ? norms[ni < 0 ? norms.length + ni : ni - 1] : null;
      if (!v) return 0;
      active.positions.push(v[0], v[1], v[2]);
      active.normals.push(...(n || [0, 0, 0]));
      const idx = active.positions.length / 3 - 1;
      active.map.set(key, idx);
      return idx;
    }

    text.replace(/\r/g, '').split('\n').forEach((line) => {
      const clean = line.trim();
      if (!clean || clean.startsWith('#')) return;
      const parts = clean.split(/\s+/);
      if (parts[0] === 'v') verts.push(parts.slice(1, 4).map(Number));
      else if (parts[0] === 'vn') norms.push(vec3.norm(parts.slice(1, 4).map(Number)));
      else if (parts[0] === 'o' || parts[0] === 'g') {
        const name = parts.slice(1).join(' ') || `${fallbackName} Part ${groups.length + 1}`;
        if (!active || active.indices.length) makeGroup(name);
        else active.name = name;
      } else if (parts[0] === 'usemtl') {
        const matName = parts.slice(1).join(' ');
        if (matName && active && active.indices.length) makeGroup(`${active.name} · ${matName}`);
      } else if (parts[0] === 'f' && parts.length >= 4) {
        if (!active) makeGroup(fallbackName);
        const poly = parts.slice(1).map(addVertex);
        for (let i = 1; i < poly.length - 1; i++) active.indices.push(poly[0], poly[i], poly[i + 1]);
      }
    });

    const geometries = groups
      .filter((group) => group.positions.length && group.indices.length)
      .map((group, index) => finalizeGeometry(group.name || `${fallbackName} Part ${index + 1}`, group.positions, group.indices, group.normals.some((n) => Math.abs(n) > EPS) ? group.normals : null));
    if (!geometries.length) throw new Error('The OBJ file did not contain renderable triangles.');
    return geometries;
  }

  function collectionBounds(geometries) {
    let min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
    geometries.forEach((geometry) => {
      min = [Math.min(min[0], geometry.min[0]), Math.min(min[1], geometry.min[1]), Math.min(min[2], geometry.min[2])];
      max = [Math.max(max[0], geometry.max[0]), Math.max(max[1], geometry.max[1]), Math.max(max[2], geometry.max[2])];
    });
    const center = [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2];
    let radius = 0.1;
    geometries.forEach((geometry) => {
      const corners = [
        [geometry.min[0], geometry.min[1], geometry.min[2]], [geometry.max[0], geometry.min[1], geometry.min[2]],
        [geometry.min[0], geometry.max[1], geometry.min[2]], [geometry.min[0], geometry.min[1], geometry.max[2]],
        [geometry.max[0], geometry.max[1], geometry.max[2]]
      ];
      corners.forEach((corner) => { radius = Math.max(radius, vec3.len(vec3.sub(corner, center))); });
    });
    return { min, max, center, radius };
  }


  function parseASCIISTL(text) {
    const positions = [], normals = [], indices = [];
    const normalPattern = /facet\s+normal\s+([-+eE0-9.]+)\s+([-+eE0-9.]+)\s+([-+eE0-9.]+)([\s\S]*?)endfacet/g;
    let match;
    while ((match = normalPattern.exec(text))) {
      const n = vec3.norm([Number(match[1]), Number(match[2]), Number(match[3])]);
      const verts = [...match[4].matchAll(/vertex\s+([-+eE0-9.]+)\s+([-+eE0-9.]+)\s+([-+eE0-9.]+)/g)].map((m) => [Number(m[1]), Number(m[2]), Number(m[3])]);
      if (verts.length >= 3) {
        const base = positions.length / 3;
        for (let i = 0; i < 3; i++) { positions.push(...verts[i]); normals.push(...n); }
        indices.push(base, base + 1, base + 2);
      }
    }
    if (!positions.length) throw new Error('Only ASCII STL is supported in this V1 runtime.');
    return finalizeGeometry('Imported STL', positions, indices, normals);
  }

  class RenderitEngine extends EventTarget {
    constructor(canvas, options = {}) {
      super();
      this.canvas = canvas;
      this.status = options.status || (() => {});
      this.gl = canvas.getContext('webgl2', { antialias: true, preserveDrawingBuffer: false, alpha: false, powerPreference: 'high-performance', desynchronized: true });
      if (!this.gl) throw new Error('WebGL2 is not available in this browser.');
      this.gl.getExtension('EXT_color_buffer_float');
      this.objects = [];
      this.lights = [
        { id: 'key', name: 'Key Area', position: [-3.2, 4.2, 3.4], color: [1, 1, 1], intensity: 5.0 },
        { id: 'rim', name: 'Rim Strip', position: [3.8, 2.4, -2.8], color: [0.76, 0.82, 1.0], intensity: 2.6 },
        { id: 'fill', name: 'Soft Fill', position: [0, 2.8, 4.8], color: [1.0, 0.96, 0.9], intensity: 1.4 }
      ];
      this.selectedId = null;
      this.camera = { target: [0, 0.35, 0], distance: 4.6, yaw: -0.66, pitch: -0.34, fov: 45 * Math.PI / 180 };
      this.environment = JSON.parse(JSON.stringify(window.RENDERitMaterials.environments.lunarLab));
      this.exposure = 1.0;
      this.groundVisible = true;
      this.gridVisible = true;
      this.floorReflection = 0.35;
      this.transformMode = 'select';
      this.groundTexture = null;
      this.groundTextureName = '';
      this.groundTextureRepeat = 8;
      this.pointer = { active: false, mode: null, x: 0, y: 0 };
      this.dirty = true;
      this.historyReady = false;
      this.suspendHistory = false;
      this.historyMax = 24;
      this.historyEntries = [];
      this.historyIndex = -1;
      this.lightPosBuffer = new Float32Array(18);
      this.lightColorBuffer = new Float32Array(18);
      this.lightIntensityBuffer = new Float32Array(6);
      this.initGL();
      this.groundObject = {
        id: 'ground-plane',
        name: 'Ground Plane',
        type: 'ground',
        geometry: this.uploadGeometry(createGroundGeometry()),
        material: window.RENDERitMaterials.normalizeMaterial({ id: 'groundMaterial', name: 'Ground Plane Material', color: [0.05, 0.052, 0.062], roughness: 0.48, metalness: 0.12, clearcoat: 0.35, transmission: 0, emission: 0, maps: {} }),
        position: [0, 0, 0],
        rotation: [0, 0, 0],
        scale: [1, 1, 1]
      };
      this.attachInput();
      this.resizeObserver = new ResizeObserver(() => this.resize());
      this.resizeObserver.observe(this.canvas.parentElement || this.canvas);
      this.resize();
      this.loadSample('cube');
      this.resetHistory('Initial Scene');
      this.historyReady = true;
      requestAnimationFrame((time) => this.frame(time));
    }

    initGL() {
      const gl = this.gl;
      this.program = createProgram(gl, vertexShader, fragmentShader);
      this.skyProgram = createProgram(gl, skyVertexShader, skyFragmentShader);
      this.uniforms = {};
      ['uModel','uView','uProjection','uCameraPos','uAlbedo','uRoughness','uMetalness','uClearcoat','uTransmission','uEmission','uUseAlbedoMap','uAlbedoMap','uTextureRepeat','uExposure','uEnvStrength','uEnvTop','uEnvHorizon','uLightCount','uLightPos','uLightColor','uLightIntensity'].forEach((name) => { this.uniforms[name] = gl.getUniformLocation(this.program, name); });
      this.skyUniforms = {};
      ['uEnvTop','uEnvHorizon','uEnvGround','uEnvStrength','uGrid'].forEach((name) => { this.skyUniforms[name] = gl.getUniformLocation(this.skyProgram, name); });
      this.skyVao = gl.createVertexArray();
      this.skyVbo = gl.createBuffer();
      gl.bindVertexArray(this.skyVao);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.skyVbo);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      gl.bindVertexArray(null);
      gl.enable(gl.DEPTH_TEST);
      gl.enable(gl.CULL_FACE);
      gl.cullFace(gl.BACK);
    }

    uploadGeometry(geometry) {
      const gl = this.gl;
      const vertexCount = geometry.positions.length / 3;
      const uvs = geometry.uvs && geometry.uvs.length === vertexCount * 2 ? geometry.uvs : new Array(vertexCount * 2).fill(0);
      const interleaved = new Float32Array(vertexCount * 8);
      for (let i = 0, v = 0, u = 0; i < geometry.positions.length; i += 3, v += 8, u += 2) {
        interleaved[v] = geometry.positions[i]; interleaved[v+1] = geometry.positions[i+1]; interleaved[v+2] = geometry.positions[i+2];
        interleaved[v+3] = geometry.normals[i]; interleaved[v+4] = geometry.normals[i+1]; interleaved[v+5] = geometry.normals[i+2];
        interleaved[v+6] = uvs[u]; interleaved[v+7] = uvs[u+1];
      }
      const vao = gl.createVertexArray();
      const vbo = gl.createBuffer();
      const ibo = gl.createBuffer();
      gl.bindVertexArray(vao);
      gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
      gl.bufferData(gl.ARRAY_BUFFER, interleaved, gl.STATIC_DRAW);
      gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 32, 0);
      gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 32, 12);
      gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 2, gl.FLOAT, false, 32, 24);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint32Array(geometry.indices), gl.STATIC_DRAW);
      gl.bindVertexArray(null);
      return Object.assign({}, geometry, { uvs, vao, vbo, ibo, indexCount: geometry.indices.length });
    }

    addObject(name, geometry, materialId = 'lunarClay', transform = {}) {
      const uploaded = geometry.vao ? geometry : this.uploadGeometry(geometry);
      const material = typeof materialId === 'object' ? window.RENDERitMaterials.normalizeMaterial(materialId) : window.RENDERitMaterials.cloneMaterial(materialId);
      const id = `obj-${Date.now()}-${Math.random().toString(16).slice(2)}`;
      const object = {
        id, name, geometry: uploaded,
        material,
        position: transform.position || [0, 0.65, 0],
        rotation: transform.rotation || [0, 0, 0],
        scale: transform.scale || [1, 1, 1]
      };
      this.objects.push(object);
      this.selectedId = id;
      if (!transform.skipNormalize) this.normalizeImportedObject(object);
      this.emitChange('object-added');
      return object;
    }

    normalizeImportedObject(object) {
      const radius = object.geometry.radius || 1;
      const scale = 1.25 / radius;
      if (!object._normalized && radius > 1.4) {
        object.scale = [scale, scale, scale];
        object.position[1] = Math.max(0.4, -object.geometry.center[1] * scale + 0.6);
        object._normalized = true;
      }
    }

    loadSample(type = 'cube') {
      this.objects = [];
      if (type === 'sphere') {
        this.addObject('Sphere', createSphereGeometry(0.78), 'obsidianGlass', { position: [0, 0.85, 0] });
      } else if (type === 'cylinder') {
        this.addObject('Cylinder', createCylinderGeometry(0.62, 1.35), 'studioChrome', { position: [0, 0.75, 0] });
      } else if (type === 'cone') {
        this.addObject('Cone', createConeGeometry(0.7, 1.45), 'warmTitanium', { position: [0, 0.78, 0] });
      } else if (type === 'torus') {
        this.addObject('Torus', createTorusGeometry(0.58, 0.18), 'pearlCoat', { position: [0, 0.82, 0], rotation: [0.4, 0.18, 0] });
      } else if (type === 'plane') {
        this.addObject('Plane', createPlaneGeometry(1.8), 'frostedPolymer', { position: [0, 0.04, 0] });
      } else if (type === 'stack') {
        this.addObject('Chrome Base', createCylinderGeometry(0.78, 0.25), 'studioChrome', { position: [0, 0.18, 0], scale: [1.25, 1, 1.25] });
        this.addObject('Pearl Product', createBoxGeometry(0.9), 'pearlCoat', { position: [-0.28, 0.86, 0], rotation: [0.05, 0.42, 0], scale: [0.78, 1.15, 0.78] });
        this.addObject('Frosted Accent', createSphereGeometry(0.42), 'frostedPolymer', { position: [0.72, 0.68, 0.18] });
      } else if (type === 'display') {
        this.addObject('Display Plinth', createCylinderGeometry(0.92, 0.2), 'blackAnodized', { position: [0, 0.14, 0], scale: [1.2, 1, 1.2] });
        this.addObject('Glass Hero', createTorusGeometry(0.52, 0.14), 'obsidianGlass', { position: [0, 0.86, 0], rotation: [0.7, 0.2, 0.0] });
        this.addObject('Light Core', createSphereGeometry(0.28), 'emissionWhite', { position: [0, 0.86, 0] });
      } else if (type === 'pyramid') {
        this.addObject('Pyramid', createConeGeometry(0.78, 1.35, 4), 'warmTitanium', { position: [0, 0.72, 0], rotation: [0, Math.PI / 4, 0] });
      } else if (type === 'capsule') {
        this.addObject('Capsule Body', createCylinderGeometry(0.42, 1.15), 'frostedPolymer', { position: [0, 0.84, 0] });
        this.addObject('Capsule Top', createSphereGeometry(0.42), 'pearlCoat', { position: [0, 1.42, 0], scale: [1, 0.82, 1] });
        this.addObject('Capsule Bottom', createSphereGeometry(0.42), 'pearlCoat', { position: [0, 0.26, 0], scale: [1, 0.82, 1] });
      } else if (type === 'plinth') {
        this.addObject('Low Plinth', createCylinderGeometry(0.95, 0.18), 'studioChrome', { position: [0, 0.12, 0], scale: [1.35, 1, 1.35] });
        this.addObject('Vertical Backplate', createPlaneGeometry(1.8), 'frostedPolymer', { position: [0, 0.9, -0.72], rotation: [Math.PI / 2, 0, 0], scale: [1.25, 1, 1] });
      } else if (type === 'hero-kit') {
        this.addObject('Hero Cube', createBoxGeometry(0.82), 'lunarClay', { position: [-0.38, 0.68, 0], rotation: [0.12, 0.5, 0.03] });
        this.addObject('Hero Ring', createTorusGeometry(0.42, 0.11), 'obsidianGlass', { position: [0.42, 0.78, 0.08], rotation: [0.76, -0.2, 0.1] });
        this.addObject('Hero Accent', createSphereGeometry(0.22), 'emissionWhite', { position: [0.18, 1.13, -0.18] });
      } else {
        this.addObject('Cube', createBoxGeometry(1.25), 'lunarClay', { position: [0, 0.76, 0], rotation: [0.0, 0.42, 0.0] });
      }
      this.status(`Loaded preset: ${type}.`);
      this.emitChange('sample-loaded');
    }


    importModel(file) {
      return file.text().then((text) => {
        const lower = file.name.toLowerCase();
        const baseName = file.name.replace(/\.(obj|stl)$/i, '').replace(/[\r\n]+/g, ' ').trim() || 'Imported Model';
        const geometries = lower.endsWith('.stl') ? [parseASCIISTL(text)] : parseOBJ(text, baseName);
        const bounds = collectionBounds(geometries);
        const scaleValue = bounds.radius > 1.4 ? 1.35 / bounds.radius : 1;
        const offset = [-bounds.center[0] * scaleValue, Math.max(0.35, -bounds.min[1] * scaleValue + 0.08), -bounds.center[2] * scaleValue];
        this.objects = [];
        geometries.forEach((geometry, index) => {
          this.addObject(geometry.name || `${baseName} Part ${index + 1}`, geometry, 'lunarClay', { position: offset.slice(), scale: [scaleValue, scaleValue, scaleValue], skipNormalize: true });
        });
        this.selectedId = this.objects[0]?.id || null;
        const tris = geometries.reduce((sum, geometry) => sum + geometry.triangleCount, 0);
        this.frameSelected();
        this.status(`Imported ${file.name} as ${geometries.length} object part(s) with ${tris.toLocaleString()} triangles.`);
        this.emitChange('model-imported');
      });
    }


    selectedObject() {
      if (this.selectedId === 'ground-plane') return this.groundObject;
      return this.objects.find((object) => object.id === this.selectedId) || this.objects[0] || null;
    }
    sceneItems() { return [this.groundObject, ...this.objects]; }
    selectObject(id) {
      if (id === 'ground-plane' || this.objects.some((object) => object.id === id)) {
        this.selectedId = id;
        this.emitChange('selection-changed');
      }
    }
    applyMaterial(materialId) {
      const object = this.selectedObject();
      if (!object) return;
      object.material = window.RENDERitMaterials.cloneMaterial(materialId);
      if (object.id === 'ground-plane') object.material.id = 'groundMaterial';
      this.status(`Applied ${object.material.name} to ${object.name}.`);
      this.emitChange('material-applied');
    }
    updateSelectedMaterial(values) {
      const object = this.selectedObject();
      if (!object) return;
      object.material = window.RENDERitMaterials.normalizeMaterial(Object.assign({}, object.material, values));
      this.emitChange('material-updated');
    }
    setEnvironment(id) {
      const env = window.RENDERitMaterials.environments[id];
      if (!env) return;
      this.environment = JSON.parse(JSON.stringify(env));
      this.status(`Environment set to ${env.name}.`);
      this.emitChange('environment-changed');
    }
    addLight() {
      const index = this.lights.length + 1;
      if (this.lights.length >= 6) { this.status('The V5 viewport supports up to six realtime lights.'); return; }
      this.lights.push({ id: `user-light-${Date.now()}`, name: `User Light ${index}`, position: [Math.sin(index) * 3, 2.2 + (index % 2), Math.cos(index) * 3], color: [1, 1, 1], intensity: 2.2 });
      this.emitChange('light-added');
    }
    duplicateSelected() {
      const src = this.selectedObject();
      if (!src || src.id === 'ground-plane') { this.status('The ground plane cannot be duplicated.'); return; }
      const obj = this.addObject(`${src.name} Copy`, src.geometry, src.material.id || 'lunarClay', { position: [src.position[0] + 0.7, src.position[1], src.position[2] - 0.35], rotation: [...src.rotation], scale: [...src.scale] });
      obj.material = JSON.parse(JSON.stringify(src.material));
      this.status(`Duplicated ${src.name}.`);
      this.emitChange('object-duplicated');
    }
    deleteSelected() {
      const selected = this.selectedObject();
      if (!selected) return;
      if (selected.id === 'ground-plane') { this.groundVisible = false; this.status('Ground plane hidden.'); this.emitChange('ground-hidden'); return; }
      this.objects = this.objects.filter((object) => object.id !== selected.id);
      this.selectedId = this.objects[0]?.id || null;
      this.status(`Deleted ${selected.name}.`);
      this.emitChange('object-deleted');
    }
    clearScene() { this.objects = []; this.selectedId = 'ground-plane'; this.status('Scene cleared. Ground plane kept for studio setup.'); this.emitChange('scene-cleared'); }
    resetCamera() { this.camera = { target: [0, 0.35, 0], distance: 4.6, yaw: -0.66, pitch: -0.34, fov: 45 * Math.PI / 180 }; this.requestRender(); }
    frameSelected() {
      const object = this.selectedObject();
      if (!object) return;
      const model = mat4Model(object.position, object.rotation, object.scale);
      const center = transformPoint(model, object.geometry.center || [0,0,0]);
      const scale = Math.max(object.scale[0], object.scale[1], object.scale[2]);
      this.camera.target = center;
      this.camera.distance = Math.max(1.4, (object.geometry.radius || 1) * scale * 3.1);
      this.status(`Framed ${object.name}.`);
    }

    getCameraPosition() {
      const cp = this.camera;
      const x = Math.cos(cp.pitch) * Math.sin(cp.yaw) * cp.distance;
      const y = Math.sin(cp.pitch) * cp.distance;
      const z = Math.cos(cp.pitch) * Math.cos(cp.yaw) * cp.distance;
      return [cp.target[0] + x, cp.target[1] + y, cp.target[2] + z];
    }

    projectWorld(point) {
      const width = this.canvas.clientWidth || this.canvas.width || 1;
      const height = this.canvas.clientHeight || this.canvas.height || 1;
      const eye = this.getCameraPosition();
      const view = mat4LookAt(eye, this.camera.target, [0, 1, 0]);
      const projection = mat4Perspective(this.camera.fov, width / Math.max(1, height), 0.05, 200);
      const vp = mat4Multiply(projection, view);
      const x = point[0], y = point[1], z = point[2], w = 1;
      const clipX = vp[0] * x + vp[4] * y + vp[8] * z + vp[12] * w;
      const clipY = vp[1] * x + vp[5] * y + vp[9] * z + vp[13] * w;
      const clipZ = vp[2] * x + vp[6] * y + vp[10] * z + vp[14] * w;
      const clipW = vp[3] * x + vp[7] * y + vp[11] * z + vp[15] * w;
      if (clipW <= 0.0001) return null;
      const ndcX = clipX / clipW;
      const ndcY = clipY / clipW;
      return { x: (ndcX * 0.5 + 0.5) * width, y: (1 - (ndcY * 0.5 + 0.5)) * height, z: clipZ / clipW };
    }

    getSelectionGuides() {
      const object = this.selectedObject();
      if (!object) return { visible: false };
      const model = mat4Model(object.position, object.rotation, object.scale);
      const centerWorld = object.id === 'ground-plane' ? [0, 0, 0] : transformPoint(model, object.geometry.center || [0, 0, 0]);
      const center = this.projectWorld(centerWorld);
      if (!center) return { visible: false };
      const maxScale = Math.max(object.scale[0], object.scale[1], object.scale[2]);
      const radiusWorld = Math.max(0.25, Math.min(3.5, (object.geometry.radius || 1) * maxScale));
      const eye = this.getCameraPosition();
      const forward = vec3.norm(vec3.sub(this.camera.target, eye));
      const right = vec3.norm(vec3.cross(forward, [0, 1, 0]));
      const edge = this.projectWorld(vec3.add(centerWorld, vec3.scale(right, radiusWorld)));
      const radius = edge ? Math.hypot(edge.x - center.x, edge.y - center.y) : 44;
      const axisLength = Math.max(0.55, Math.min(1.65, radiusWorld * 0.95));
      const axes = {};
      [['x',[axisLength,0,0]], ['y',[0,axisLength,0]], ['z',[0,0,axisLength]]].forEach(([key, offset]) => {
        const end = this.projectWorld(vec3.add(centerWorld, offset));
        axes[key] = end ? { visible: true, x: end.x, y: end.y } : { visible: false };
      });
      return { visible: true, name: object.name, center, radius, axes };
    }

    attachInput() {
      const canvas = this.canvas;
      canvas.addEventListener('contextmenu', (e) => e.preventDefault());
      canvas.addEventListener('pointerdown', (event) => {
        canvas.setPointerCapture(event.pointerId);
        this.pointer.active = true;
        this.pointer.x = event.clientX;
        this.pointer.y = event.clientY;
        if (event.altKey && event.button === 0) this.pointer.mode = 'orbit';
        else if (event.altKey && event.button === 1) this.pointer.mode = 'pan';
        else if (event.altKey && event.button === 2) this.pointer.mode = 'dolly';
        else if (this.transformMode && this.transformMode !== 'select' && this.selectedObject()) this.pointer.mode = `transform-${this.transformMode}`;
        else this.pointer.mode = 'select';
      });
      canvas.addEventListener('pointermove', (event) => {
        if (!this.pointer.active) return;
        const dx = event.clientX - this.pointer.x;
        const dy = event.clientY - this.pointer.y;
        this.pointer.x = event.clientX;
        this.pointer.y = event.clientY;
        if (this.pointer.mode === 'orbit') {
          this.camera.yaw -= dx * 0.006;
          this.camera.pitch = Math.max(-1.42, Math.min(1.28, this.camera.pitch + dy * 0.006));
          this.requestRender();
          this.dispatchEvent(new CustomEvent('change', { detail: { reason: 'camera-orbit' } }));
        } else if (this.pointer.mode === 'dolly') {
          this.camera.distance = Math.max(0.8, Math.min(60, this.camera.distance * (1 + dy * 0.012)));
          this.requestRender();
          this.dispatchEvent(new CustomEvent('change', { detail: { reason: 'camera-dolly' } }));
        } else if (this.pointer.mode === 'pan') {
          const eye = this.getCameraPosition();
          const forward = vec3.norm(vec3.sub(this.camera.target, eye));
          const right = vec3.norm(vec3.cross(forward, [0, 1, 0]));
          const up = vec3.norm(vec3.cross(right, forward));
          const amount = this.camera.distance * 0.0015;
          this.camera.target = vec3.add(this.camera.target, vec3.add(vec3.scale(right, -dx * amount), vec3.scale(up, dy * amount)));
          this.requestRender();
          this.dispatchEvent(new CustomEvent('change', { detail: { reason: 'camera-pan' } }));
        } else if (this.pointer.mode && this.pointer.mode.startsWith('transform-')) {
          this.dragTransform(this.pointer.mode.replace('transform-', ''), dx, dy);
        }
      });
      canvas.addEventListener('pointerup', (event) => {
        const finishedMode = this.pointer.mode;
        if (finishedMode === 'select') this.pick(event.clientX, event.clientY);
        else if (finishedMode && finishedMode.startsWith('transform-')) this.commitHistory(`Transformed ${this.selectedObject()?.name || 'Object'}`, 'transform-drag');
        this.pointer.active = false;
        this.pointer.mode = null;
      });
      canvas.addEventListener('dblclick', (event) => {
        event.preventDefault();
        this.pick(event.clientX, event.clientY);
      });
      canvas.addEventListener('wheel', (event) => {
        event.preventDefault();
        this.camera.distance = Math.max(0.8, Math.min(60, this.camera.distance * (1 + event.deltaY * 0.001)));
        this.requestRender();
        this.dispatchEvent(new CustomEvent('change', { detail: { reason: 'camera-wheel' } }));
      }, { passive: false });
    }

    pick(clientX, clientY) {
      const rect = this.canvas.getBoundingClientRect();
      const x = ((clientX - rect.left) / rect.width) * 2 - 1;
      const y = -(((clientY - rect.top) / rect.height) * 2 - 1);
      const eye = this.getCameraPosition();
      const forward = vec3.norm(vec3.sub(this.camera.target, eye));
      const right = vec3.norm(vec3.cross(forward, [0, 1, 0]));
      const up = vec3.norm(vec3.cross(right, forward));
      const aspect = rect.width / Math.max(1, rect.height);
      const tan = Math.tan(this.camera.fov / 2);
      const ray = vec3.norm(vec3.add(forward, vec3.add(vec3.scale(right, x * aspect * tan), vec3.scale(up, y * tan))));
      let hit = null;
      for (const object of this.objects) {
        const model = mat4Model(object.position, object.rotation, object.scale);
        const center = transformPoint(model, object.geometry.center || [0,0,0]);
        const radius = (object.geometry.radius || 1) * Math.max(object.scale[0], object.scale[1], object.scale[2]);
        const oc = vec3.sub(eye, center);
        const b = vec3.dot(oc, ray);
        const c = vec3.dot(oc, oc) - radius * radius;
        const h = b * b - c;
        if (h > 0) {
          const t = -b - Math.sqrt(h);
          if (t > 0 && (!hit || t < hit.t)) hit = { object, t };
        }
      }
      if (this.groundVisible && Math.abs(ray[1]) > 0.0001) {
        const t = (0 - eye[1]) / ray[1];
        if (t > 0 && (!hit || t < hit.t)) {
          const point = vec3.add(eye, vec3.scale(ray, t));
          if (Math.abs(point[0]) <= 9 && Math.abs(point[2]) <= 9) hit = { object: this.groundObject, t };
        }
      }
      if (hit) this.selectObject(hit.object.id);
    }

    dragTransform(mode, dx, dy) {
      const object = this.selectedObject();
      if (!object) return;
      if (object.id === 'ground-plane' && mode !== 'scale') return;
      if (mode === 'move') {
        const eye = this.getCameraPosition();
        const forward = vec3.norm(vec3.sub(this.camera.target, eye));
        const right = vec3.norm(vec3.cross(forward, [0, 1, 0]));
        const up = [0, 1, 0];
        const amount = this.camera.distance * 0.0018;
        object.position = vec3.add(object.position, vec3.add(vec3.scale(right, dx * amount), vec3.scale(up, -dy * amount)));
      } else if (mode === 'rotate') {
        object.rotation[1] += dx * 0.01;
        object.rotation[0] += dy * 0.01;
      } else if (mode === 'scale') {
        const factor = Math.max(0.05, 1 + (dx - dy) * 0.006);
        object.scale = object.scale.map((v) => Math.max(0.01, v * factor));
      }
      this.emitChange('transform-dragged');
    }

    dragAxis(axis, dx, dy) {
      const object = this.selectedObject();
      if (!object || object.id === 'ground-plane') return;
      const amount = this.camera.distance * 0.0022;
      if (axis === 'x') object.position[0] += dx * amount;
      else if (axis === 'y') object.position[1] -= dy * amount;
      else if (axis === 'z') object.position[2] += dx * amount;
      this.emitChange('axis-drag');
    }

    setTransformMode(mode) {
      this.transformMode = ['select','move','rotate','scale'].includes(mode) ? mode : 'select';
      this.canvas.classList.remove('transform-move','transform-rotate','transform-scale');
      if (this.transformMode !== 'select') this.canvas.classList.add(`transform-${this.transformMode}`);
      this.status(`Transform tool: ${this.transformMode}.`);
    }

    setSelectedTransform(values = {}) {
      const object = this.selectedObject();
      if (!object) return;
      object.name = values.name || object.name;
      if (object.id !== 'ground-plane') object.position = [Number(values.px), Number(values.py), Number(values.pz)].map((v, i) => Number.isFinite(v) ? v : object.position[i]);
      if (object.id !== 'ground-plane') object.rotation = [Number(values.rx), Number(values.ry), Number(values.rz)].map((v, i) => Number.isFinite(v) ? v * Math.PI / 180 : object.rotation[i]);
      object.scale = [Number(values.sx), Number(values.sy), Number(values.sz)].map((v, i) => Number.isFinite(v) ? Math.max(0.01, v) : object.scale[i]);
      this.emitChange('transform-updated');
    }

    resetSelectedTransform() {
      const object = this.selectedObject();
      if (!object) return;
      if (object.id !== 'ground-plane') { object.position = [0, 0.65, 0]; object.rotation = [0, 0, 0]; }
      object.scale = [1, 1, 1];
      this.emitChange('transform-reset');
    }

    nudgeSelected(axis, amount) {
      const object = this.selectedObject();
      if (!object || object.id === 'ground-plane') return;
      const index = { x: 0, y: 1, z: 2 }[axis];
      if (index === undefined) return;
      object.position[index] += Number(amount) || 0;
      this.emitChange('transform-nudged');
    }

    centerSelected() {
      const object = this.selectedObject();
      if (!object || object.id === 'ground-plane') return;
      const y = object.position[1];
      object.position = [0, y, 0];
      this.emitChange('object-centered');
    }

    frameAll() {
      const items = this.objects.length ? this.objects : [this.groundObject];
      const center = [0, 0.55, 0];
      const maxRadius = items.reduce((max, object) => Math.max(max, (object.geometry.radius || 1) * Math.max(...object.scale)), 1);
      this.camera.target = center;
      this.camera.distance = Math.max(3.2, maxRadius * 3.4);
      this.status('Framed all scene objects.');
      this.emitChange('frame-all');
    }

    setCameraView(view) {
      const views = {
        front: [0, -0.18], back: [Math.PI, -0.18], rear: [Math.PI, -0.18], left: [-Math.PI / 2, -0.18], right: [Math.PI / 2, -0.18], top: [0, -1.35], bottom: [0, 1.35], iso: [-0.66, -0.34]
      };
      const selected = views[view] || views.iso;
      this.camera.yaw = selected[0];
      this.camera.pitch = selected[1];
      this.status(`Camera view: ${view}.`);
      this.emitChange('camera-view');
    }

    updateCamera(values = {}) {
      const deg = Math.PI / 180;
      if (Number.isFinite(Number(values.fov))) this.camera.fov = Math.max(20, Math.min(90, Number(values.fov))) * deg;
      if (Number.isFinite(Number(values.distance))) this.camera.distance = Math.max(0.8, Math.min(60, Number(values.distance)));
      if (Number.isFinite(Number(values.pitch))) this.camera.pitch = Math.max(-80, Math.min(80, Number(values.pitch))) * deg;
      if (Number.isFinite(Number(values.yaw))) this.camera.yaw = Number(values.yaw) * deg;
      this.emitChange('camera-updated');
    }

    setGroundMaterial(values = {}) {
      this.groundObject.material = window.RENDERitMaterials.normalizeMaterial(Object.assign({}, this.groundObject.material, values));
      this.emitChange('ground-material');
    }

    setGroundTexture(file, repeat = this.groundTextureRepeat) {
      if (!file) return;
      const gl = this.gl;
      const url = URL.createObjectURL(file);
      const image = new Image();
      image.onload = () => {
        const texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
        gl.generateMipmap(gl.TEXTURE_2D);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
        this.groundTexture = texture;
        this.groundTextureName = file.name;
        this.groundTextureRepeat = Math.max(1, Math.min(64, Number(repeat) || 8));
        this.groundObject.material.maps = Object.assign({}, this.groundObject.material.maps, { albedo: file.name });
        this.status(`Loaded ground texture: ${file.name}.`);
        this.emitChange('ground-texture');
        this.commitHistory(`Loaded ground texture: ${file.name}`, 'ground-texture');
        URL.revokeObjectURL(url);
      };
      image.onerror = () => { this.status(`Ground texture failed to load: ${file.name}.`); URL.revokeObjectURL(url); };
      image.src = url;
    }

    resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.75);
      const rect = this.canvas.getBoundingClientRect();
      const width = Math.max(320, Math.floor(rect.width * dpr));
      const height = Math.max(220, Math.floor(rect.height * dpr));
      if (this.canvas.width !== width || this.canvas.height !== height) {
        this.canvas.width = width;
        this.canvas.height = height;
        this.requestRender();
        this.dispatchEvent(new CustomEvent('change', { detail: { reason: 'resize' } }));
      }
      this.gl.viewport(0, 0, width, height);
    }

    requestRender() {
      this.dirty = true;
    }

    frame(time) {
      if (this.dirty || this.pointer.active) {
        this.render();
        this.dirty = false;
      }
      requestAnimationFrame((nextTime) => this.frame(nextTime));
    }

    render(manualSize = false) {
      const gl = this.gl;
      if (!manualSize) this.resize();
      gl.clearColor(0, 0, 0, 1);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.disable(gl.DEPTH_TEST);
      gl.useProgram(this.skyProgram);
      gl.uniform3fv(this.skyUniforms.uEnvTop, this.environment.top);
      gl.uniform3fv(this.skyUniforms.uEnvHorizon, this.environment.horizon);
      gl.uniform3fv(this.skyUniforms.uEnvGround, this.environment.ground);
      gl.uniform1f(this.skyUniforms.uEnvStrength, this.environment.strength);
      gl.uniform1i(this.skyUniforms.uGrid, this.gridVisible ? 1 : 0);
      gl.bindVertexArray(this.skyVao);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      gl.bindVertexArray(null);
      gl.enable(gl.DEPTH_TEST);
      gl.useProgram(this.program);
      const eye = this.getCameraPosition();
      const view = mat4LookAt(eye, this.camera.target, [0, 1, 0]);
      const projection = mat4Perspective(this.camera.fov, this.canvas.width / Math.max(1, this.canvas.height), 0.05, 200);
      gl.uniformMatrix4fv(this.uniforms.uView, false, new Float32Array(view));
      gl.uniformMatrix4fv(this.uniforms.uProjection, false, new Float32Array(projection));
      gl.uniform3fv(this.uniforms.uCameraPos, eye);
      gl.uniform1f(this.uniforms.uExposure, this.exposure);
      gl.uniform1f(this.uniforms.uEnvStrength, this.environment.strength);
      gl.uniform3fv(this.uniforms.uEnvTop, this.environment.top);
      gl.uniform3fv(this.uniforms.uEnvHorizon, this.environment.horizon);
      const lights = this.lights.slice(0, 6);
      this.lightPosBuffer.fill(0);
      this.lightColorBuffer.fill(0);
      this.lightIntensityBuffer.fill(0);
      lights.forEach((light, i) => { this.lightPosBuffer.set(light.position, i*3); this.lightColorBuffer.set(light.color, i*3); this.lightIntensityBuffer[i] = light.intensity; });
      gl.uniform1i(this.uniforms.uLightCount, lights.length);
      gl.uniform3fv(this.uniforms.uLightPos, this.lightPosBuffer);
      gl.uniform3fv(this.uniforms.uLightColor, this.lightColorBuffer);
      gl.uniform1fv(this.uniforms.uLightIntensity, this.lightIntensityBuffer);
      if (this.groundVisible && this.groundObject?.geometry) {
        const groundMaterial = window.RENDERitMaterials.normalizeMaterial(Object.assign({}, this.groundObject.material, {
          roughness: Math.max(0.03, this.groundObject.material.roughness ?? (0.62 - this.floorReflection * 0.42)),
          metalness: this.groundObject.material.metalness ?? (this.floorReflection * 0.42),
          clearcoat: this.floorReflection
        }));
        gl.uniformMatrix4fv(this.uniforms.uModel, false, new Float32Array(mat4Model(this.groundObject.position, this.groundObject.rotation, this.groundObject.scale)));
        gl.uniform3fv(this.uniforms.uAlbedo, groundMaterial.color);
        gl.uniform1f(this.uniforms.uRoughness, groundMaterial.roughness);
        gl.uniform1f(this.uniforms.uMetalness, groundMaterial.metalness);
        gl.uniform1f(this.uniforms.uClearcoat, groundMaterial.clearcoat);
        gl.uniform1f(this.uniforms.uTransmission, 0.0);
        gl.uniform1f(this.uniforms.uEmission, 0.0);
        gl.uniform1i(this.uniforms.uUseAlbedoMap, this.groundTexture ? 1 : 0);
        gl.uniform1f(this.uniforms.uTextureRepeat, this.groundTextureRepeat);
        if (this.groundTexture) { gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.groundTexture); gl.uniform1i(this.uniforms.uAlbedoMap, 0); }
        gl.bindVertexArray(this.groundObject.geometry.vao);
        gl.drawElements(gl.TRIANGLES, this.groundObject.geometry.indexCount, gl.UNSIGNED_INT, 0);
      }
      for (const object of this.objects) {
        const material = window.RENDERitMaterials.normalizeMaterial(object.material);
        const model = mat4Model(object.position, object.rotation, object.scale);
        gl.uniformMatrix4fv(this.uniforms.uModel, false, new Float32Array(model));
        gl.uniform3fv(this.uniforms.uAlbedo, material.color);
        gl.uniform1f(this.uniforms.uRoughness, material.roughness);
        gl.uniform1f(this.uniforms.uMetalness, material.metalness);
        gl.uniform1f(this.uniforms.uClearcoat, material.clearcoat);
        gl.uniform1f(this.uniforms.uTransmission, material.transmission);
        gl.uniform1f(this.uniforms.uEmission, material.emission || 0);
        gl.uniform1i(this.uniforms.uUseAlbedoMap, 0);
        gl.uniform1f(this.uniforms.uTextureRepeat, 1);
        gl.bindVertexArray(object.geometry.vao);
        gl.drawElements(gl.TRIANGLES, object.geometry.indexCount, gl.UNSIGNED_INT, 0);
      }
      gl.bindVertexArray(null);
    }

    screenshot() {
      this.exportRender({ width: this.canvas.width, height: this.canvas.height, type: 'image/png', quality: 1, quick: true });
    }

    exportRender(options = {}) {
      const width = Math.max(320, Math.min(8192, Math.floor(Number(options.width) || this.canvas.width || 1920)));
      const height = Math.max(240, Math.min(8192, Math.floor(Number(options.height) || this.canvas.height || 1080)));
      const type = options.type === 'image/jpeg' ? 'image/jpeg' : 'image/png';
      const quality = Math.max(0.5, Math.min(1, Number(options.quality) || 0.92));
      const previous = { width: this.canvas.width, height: this.canvas.height };
      this.canvas.width = width;
      this.canvas.height = height;
      this.gl.viewport(0, 0, width, height);
      this.render(true);
      this.canvas.toBlob((blob) => {
        if (blob) {
          const ext = type === 'image/jpeg' ? 'jpg' : 'png';
          const label = options.quick ? 'viewport' : 'render';
          downloadBlob(`RENDERit_${label}_${width}x${height}_${new Date().toISOString().replace(/[:.]/g, '-')}.${ext}`, blob);
          this.status(`Exported ${width} × ${height} ${ext.toUpperCase()} render.`);
        }
        this.canvas.width = previous.width;
        this.canvas.height = previous.height;
        this.resize();
      }, type, quality);
    }

    serialize() {
      return {
        app: 'RENDERit', version: '1.0.5', savedAt: new Date().toISOString(),
        camera: this.camera, exposure: this.exposure, environment: this.environment,
        groundVisible: this.groundVisible, gridVisible: this.gridVisible, floorReflection: this.floorReflection, groundTextureRepeat: this.groundTextureRepeat, groundMaterial: this.groundObject.material,
        lights: this.lights,
        selectedId: this.selectedId,
        materialLibrary: Object.values(window.RENDERitMaterials.materials),
        environmentLibrary: Object.values(window.RENDERitMaterials.environments),
        objects: this.objects.map((object) => ({
          id: object.id, name: object.name, position: object.position, rotation: object.rotation, scale: object.scale,
          material: object.material,
          geometry: { name: object.geometry.name, positions: object.geometry.positions, normals: object.geometry.normals, indices: object.geometry.indices, center: object.geometry.center, radius: object.geometry.radius, triangleCount: object.geometry.triangleCount }
        }))
      };
    }

    loadProject(data, options = {}) {
      if (!data || data.app !== 'RENDERit') throw new Error('This file is not a RENDERit project.');
      this.objects = [];
      this.camera = data.camera || this.camera;
      this.exposure = Number(data.exposure) || 1;
      this.environment = data.environment || this.environment;
      this.groundVisible = data.groundVisible !== false;
      this.gridVisible = data.gridVisible !== false;
      this.floorReflection = Number(data.floorReflection ?? 0.35);
      this.groundTextureRepeat = Number(data.groundTextureRepeat || this.groundTextureRepeat);
      if (data.groundMaterial) this.groundObject.material = window.RENDERitMaterials.normalizeMaterial(data.groundMaterial);
      this.lights = Array.isArray(data.lights) ? data.lights.slice(0, 6) : this.lights;
      if (window.RENDERitMaterials.resetMaterialLibrary) window.RENDERitMaterials.resetMaterialLibrary(data.materialLibrary || []);
      else (data.materialLibrary || []).forEach((material) => window.RENDERitMaterials.upsertMaterial(material));
      if (window.RENDERitMaterials.resetEnvironmentLibrary) window.RENDERitMaterials.resetEnvironmentLibrary(data.environmentLibrary || []);
      else (data.environmentLibrary || []).forEach((environment) => window.RENDERitMaterials.upsertEnvironment(environment));
      (data.objects || []).forEach((raw) => {
        const geometry = this.uploadGeometry(finalizeGeometry(raw.geometry?.name || 'Project Geometry', raw.geometry.positions, raw.geometry.indices, raw.geometry.normals));
        const object = { id: raw.id || `obj-${Date.now()}`, name: raw.name || 'Project Object', geometry, material: window.RENDERitMaterials.normalizeMaterial(raw.material), position: raw.position || [0,0,0], rotation: raw.rotation || [0,0,0], scale: raw.scale || [1,1,1] };
        this.objects.push(object);
      });
      this.selectedId = data.selectedId || this.objects[0]?.id || null;
      this.status(`Loaded RENDERit project with ${this.objects.length} object(s).`);
      this.emitChange('project-loaded');
      if (!options.fromHistory && this.historyReady && !this.suspendHistory) this.resetHistory('Loaded Project');
    }

    cloneHistoryState() {
      return JSON.parse(JSON.stringify(this.serialize()));
    }

    resetHistory(label = 'Initial Scene') {
      this.historyEntries = [{ label, reason: 'initial', at: new Date().toISOString(), state: this.cloneHistoryState() }];
      this.historyIndex = 0;
      this.emitHistory();
    }

    commitHistory(label = 'Scene Edit', reason = 'edit') {
      if (!this.historyReady || this.suspendHistory) return;
      const entry = { label: String(label || 'Scene Edit'), reason, at: new Date().toISOString(), state: this.cloneHistoryState() };
      this.historyEntries = this.historyEntries.slice(0, this.historyIndex + 1);
      this.historyEntries.push(entry);
      if (this.historyEntries.length > this.historyMax) this.historyEntries.shift();
      this.historyIndex = this.historyEntries.length - 1;
      this.emitHistory();
    }

    getHistoryState() {
      return {
        index: this.historyIndex,
        canUndo: this.historyIndex > 0,
        canRedo: this.historyIndex >= 0 && this.historyIndex < this.historyEntries.length - 1,
        entries: this.historyEntries.map((entry, index) => ({
          index,
          label: entry.label,
          reason: entry.reason,
          at: entry.at,
          current: index === this.historyIndex
        }))
      };
    }

    emitHistory() {
      this.dispatchEvent(new CustomEvent('historychange', { detail: this.getHistoryState() }));
    }

    restoreHistoryIndex(index, statusMessage = 'Restored history state.') {
      const targetIndex = Number(index);
      const entry = this.historyEntries[targetIndex];
      if (!entry) return;
      this.suspendHistory = true;
      try {
        this.loadProject(entry.state, { fromHistory: true });
        this.historyIndex = targetIndex;
        this.status(statusMessage);
      } finally {
        this.suspendHistory = false;
      }
      this.requestRender();
      this.dispatchEvent(new CustomEvent('change', { detail: { reason: 'history-restore' } }));
      this.emitHistory();
    }

    undo() {
      if (this.historyIndex <= 0) { this.status('Nothing to undo.'); return; }
      const current = this.historyEntries[this.historyIndex];
      this.restoreHistoryIndex(this.historyIndex - 1, `Undo: ${current?.label || 'Scene Edit'}.`);
    }

    redo() {
      if (this.historyIndex >= this.historyEntries.length - 1) { this.status('Nothing to redo.'); return; }
      const next = this.historyEntries[this.historyIndex + 1];
      this.restoreHistoryIndex(this.historyIndex + 1, `Redo: ${next?.label || 'Scene Edit'}.`);
    }

    saveProject() {
      downloadBlob(`RENDERit_project_${new Date().toISOString().slice(0,10)}.renderit.json`, new Blob([JSON.stringify(this.serialize(), null, 2)], { type: 'application/json' }));
    }

    setStatusHandler(fn) { this.status = fn; }
    emitChange(reason) { this.requestRender(); this.dispatchEvent(new CustomEvent('change', { detail: { reason } })); }
  }

  function wrapHistory(methodName, labelFactory) {
    const original = RenderitEngine.prototype[methodName];
    if (typeof original !== 'function') return;
    RenderitEngine.prototype[methodName] = function (...args) {
      const result = original.apply(this, args);
      const commit = (value) => {
        try {
          const label = typeof labelFactory === 'function' ? labelFactory.call(this, args, value) : labelFactory;
          this.commitHistory(label || 'Scene Edit', methodName);
        } catch (error) {
          console.warn('History commit skipped:', error);
        }
        return value;
      };
      return result && typeof result.then === 'function' ? result.then(commit) : commit(result);
    };
  }

  wrapHistory('loadSample', function (args) { return `Loaded preset: ${args[0] || 'cube'}`; });
  wrapHistory('importModel', function (args) { return `Imported model: ${args[0]?.name || 'local file'}`; });
  wrapHistory('applyMaterial', function () { return `Applied material to ${this.selectedObject()?.name || 'selection'}`; });
  wrapHistory('updateSelectedMaterial', function () { return `Updated material on ${this.selectedObject()?.name || 'selection'}`; });
  wrapHistory('setEnvironment', function () { return `Changed environment: ${this.environment?.name || 'Environment'}`; });
  wrapHistory('addLight', 'Added light');
  wrapHistory('duplicateSelected', function () { return `Duplicated ${this.selectedObject()?.name || 'object'}`; });
  wrapHistory('deleteSelected', 'Deleted selected object');
  wrapHistory('clearScene', 'Cleared scene');
  wrapHistory('setSelectedTransform', function () { return `Updated transform: ${this.selectedObject()?.name || 'selection'}`; });
  wrapHistory('resetSelectedTransform', function () { return `Reset transform: ${this.selectedObject()?.name || 'selection'}`; });
  wrapHistory('nudgeSelected', function (args) { return `Nudged ${this.selectedObject()?.name || 'selection'} on ${String(args[0] || '').toUpperCase()} axis`; });
  wrapHistory('centerSelected', function () { return `Centered ${this.selectedObject()?.name || 'selection'}`; });
  wrapHistory('setGroundMaterial', 'Updated ground material');

  window.RENDERitEngine = RenderitEngine;
}());
