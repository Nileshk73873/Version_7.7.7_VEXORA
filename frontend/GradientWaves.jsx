import React, { useEffect, useRef } from 'react';

function hexToRgb(hex) {
  let c = hex.replace('#', '');
  if (c.length === 3) c = c.split('').map(x => x + x).join('');
  const num = parseInt(c, 16);
  return [((num >> 16) & 255) / 255, ((num >> 8) & 255) / 255, (num & 255) / 255];
}

export default function GradientWaves({
  horizonColor = "#5227FF",
  waveColor = "#FF9FFC",
  crestColor = "#FFFFFF",
  speed = 0.4,
  amplitude = 2.5,
  waveScale = 0.6,
  waveRatio = 0.9,
  swell = 35,
  turbulence = 20,
  tilt = 1.11,
  zoom = 1.0,
  height = 5.5,
  fogDepth = 15,
  detail = "medium",
  brightness = 1.0,
  opacity = 1.0,
  mouseInteraction = false,
  parallaxStrength = 0.5,
  grain = true,
  grainIntensity = 0.05,
}) {
  const canvasRef = useRef(null);
  const mouseRef = useRef({ x: 0, y: 0, targetX: 0, targetY: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (!gl) return;

    const vsSource = `
      attribute vec2 aPosition;
      varying vec2 vUv;
      void main() {
        vUv = (aPosition + 1.0) * 0.5;
        gl_Position = vec4(aPosition, 0.0, 1.0);
      }
    `;

    const fsSource = `
      precision highp float;
      varying vec2 vUv;
      uniform float uTime;
      uniform vec2 uResolution;
      uniform vec2 uMouse;
      
      uniform vec3 uHorizonColor;
      uniform vec3 uWaveColor;
      uniform vec3 uCrestColor;
      
      uniform float uSpeed;
      uniform float uAmplitude;
      uniform float uWaveScale;
      uniform float uWaveRatio;
      uniform float uSwell;
      uniform float uTurbulence;
      uniform float uTilt;
      uniform float uZoom;
      uniform float uHeight;
      uniform float uFogDepth;
      uniform float uBrightness;
      uniform float uGrainIntensity;
      uniform float uOpacity;

      // Smooth noise functions
      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
      }

      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(
          mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), u.x),
          mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
          u.y
        );
      }

      float fbm(vec2 p) {
        float v = 0.0;
        float a = 0.5;
        mat2 rot = mat2(0.8, 0.6, -0.6, 0.8);
        for (int i = 0; i < 4; ++i) {
          v += a * noise(p);
          p = rot * p * 2.0;
          a *= 0.5;
        }
        return v;
      }

      // Continuous wave surface displacement
      float getWaveHeight(vec2 st, float t) {
        vec2 p = st * (uWaveScale * 1.2);
        p.y *= uWaveRatio;
        
        float timeShift = t * uSpeed * 0.7;
        
        // Multi-layered smooth wave harmonics
        float w1 = sin(p.x * 2.2 + timeShift) * cos(p.y * 1.6 + timeShift * 0.8);
        float w2 = sin((p.x * 1.5 + p.y * 1.8) - timeShift * 1.1) * 0.6;
        float w3 = cos(p.x * 3.2 - timeShift * 1.4) * 0.25;
        
        vec2 turbP = st * (uTurbulence * 0.03) + vec2(timeShift * 0.25, timeShift * 0.15);
        float turb = fbm(turbP) * (uSwell * 0.03);
        
        return (w1 + w2 + w3 + turb) * (uAmplitude * 0.25);
      }

      void main() {
        vec2 uv = vUv;
        vec2 st = (gl_FragCoord.xy - 0.5 * uResolution.xy) / min(uResolution.x, uResolution.y);

        // Perspective transform and tilt
        st *= uZoom;
        st.y += (uHeight - 5.5) * 0.05 - 0.1;
        st += uMouse * 0.05;

        float t = uTime;
        float height = getWaveHeight(st, t);

        // Calculate smooth normal vectors for surface lighting
        vec2 eps = vec2(0.01, 0.0);
        float hL = getWaveHeight(st - eps.xy, t);
        float hR = getWaveHeight(st + eps.xy, t);
        float hD = getWaveHeight(st - eps.yx, t);
        float hU = getWaveHeight(st + eps.yx, t);
        
        vec3 N = normalize(vec3(hL - hR, 0.08, hD - hU));
        vec3 L = normalize(vec3(0.2, 0.9, 0.4)); // Soft overhead light
        vec3 V = vec3(0.0, 0.0, 1.0);

        float diff = max(0.0, dot(N, L));
        float spec = pow(max(0.0, dot(reflect(-L, N), V)), 14.0);

        // Deep void background color (#0A0E14)
        vec3 bgVoid = vec3(0.039, 0.055, 0.078);
        
        // Height normalized factor for color blending
        float hNorm = clamp((height + uAmplitude * 0.3) / (uAmplitude * 0.6), 0.0, 1.0);
        
        // Deep purple to lavender wave color palette
        vec3 waveColor = mix(uHorizonColor, uWaveColor, hNorm * 0.75 + diff * 0.25);
        
        // Apply crest highlights
        waveColor = mix(waveColor, uCrestColor, spec * 0.45);

        // Smooth vertical fade: wave field fills bottom and center, softly fading into dark void at top
        float waveMask = smoothstep(0.45 * uTilt, -0.35, st.y + height * 0.4);
        
        // Distance fog fade matching BG Studio depth
        float fog = exp(-abs(st.y - 0.2) * (15.0 / uFogDepth));
        
        vec3 color = mix(bgVoid, waveColor, clamp(waveMask * fog, 0.0, 1.0));
        color *= uBrightness;

        // Subtle film grain
        if (uGrainIntensity > 0.0) {
          float grainNoise = (hash(gl_FragCoord.xy + fract(uTime * 0.1)) - 0.5) * uGrainIntensity;
          color += vec3(grainNoise);
        }

        gl_FragColor = vec4(clamp(color, 0.0, 1.0), uOpacity);
      }
    `;

    function createShader(gl, type, source) {
      const shader = gl.createShader(type);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error('Shader compile error:', gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
      }
      return shader;
    }

    const vs = createShader(gl, gl.VERTEX_SHADER, vsSource);
    const fs = createShader(gl, gl.FRAGMENT_SHADER, fsSource);
    if (!vs || !fs) return;

    const program = gl.createProgram();
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error('Program link error:', gl.getProgramInfoLog(program));
      return;
    }

    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([
        -1, -1,
         1, -1,
        -1,  1,
        -1,  1,
         1, -1,
         1,  1,
      ]),
      gl.STATIC_DRAW
    );

    const aPositionLoc = gl.getAttribLocation(program, 'aPosition');
    const uTimeLoc = gl.getUniformLocation(program, 'uTime');
    const uResLoc = gl.getUniformLocation(program, 'uResolution');
    const uMouseLoc = gl.getUniformLocation(program, 'uMouse');
    
    const uHorizonLoc = gl.getUniformLocation(program, 'uHorizonColor');
    const uWaveLoc = gl.getUniformLocation(program, 'uWaveColor');
    const uCrestLoc = gl.getUniformLocation(program, 'uCrestColor');
    
    const uSpeedLoc = gl.getUniformLocation(program, 'uSpeed');
    const uAmpLoc = gl.getUniformLocation(program, 'uAmplitude');
    const uWaveScaleLoc = gl.getUniformLocation(program, 'uWaveScale');
    const uWaveRatioLoc = gl.getUniformLocation(program, 'uWaveRatio');
    const uSwellLoc = gl.getUniformLocation(program, 'uSwell');
    const uTurbulenceLoc = gl.getUniformLocation(program, 'uTurbulence');
    const uTiltLoc = gl.getUniformLocation(program, 'uTilt');
    const uZoomLoc = gl.getUniformLocation(program, 'uZoom');
    const uHeightLoc = gl.getUniformLocation(program, 'uHeight');
    const uFogLoc = gl.getUniformLocation(program, 'uFogDepth');
    const uBrightnessLoc = gl.getUniformLocation(program, 'uBrightness');
    const uGrainLoc = gl.getUniformLocation(program, 'uGrainIntensity');
    const uOpacityLoc = gl.getUniformLocation(program, 'uOpacity');

    let animationFrameId;
    let startTime = performance.now();

    const resize = () => {
      if (!canvas) return;
      const width = canvas.parentElement ? canvas.parentElement.clientWidth : window.innerWidth;
      const height = canvas.parentElement ? canvas.parentElement.clientHeight : window.innerHeight;
      canvas.width = width * window.devicePixelRatio;
      canvas.height = height * window.devicePixelRatio;
      gl.viewport(0, 0, canvas.width, canvas.height);
    };

    resize();
    window.addEventListener('resize', resize);

    const handleMouseMove = (e) => {
      if (!mouseInteraction) return;
      const rect = canvas.getBoundingClientRect();
      mouseRef.current.targetX = ((e.clientX - rect.left) / rect.width - 0.5) * parallaxStrength;
      mouseRef.current.targetY = ((e.clientY - rect.top) / rect.height - 0.5) * parallaxStrength;
    };

    if (mouseInteraction) {
      window.addEventListener('mousemove', handleMouseMove);
    }

    const render = () => {
      const now = performance.now();
      const elapsed = (now - startTime) / 1000;

      mouseRef.current.x += (mouseRef.current.targetX - mouseRef.current.x) * 0.05;
      mouseRef.current.y += (mouseRef.current.targetY - mouseRef.current.y) * 0.05;

      gl.useProgram(program);

      gl.enableVertexAttribArray(aPositionLoc);
      gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
      gl.vertexAttribPointer(aPositionLoc, 2, gl.FLOAT, false, 0, 0);

      gl.uniform1f(uTimeLoc, elapsed);
      gl.uniform2f(uResLoc, canvas.width, canvas.height);
      gl.uniform2f(uMouseLoc, mouseRef.current.x, mouseRef.current.y);
      
      gl.uniform3fv(uHorizonLoc, hexToRgb(horizonColor));
      gl.uniform3fv(uWaveLoc, hexToRgb(waveColor));
      gl.uniform3fv(uCrestLoc, hexToRgb(crestColor));
      
      gl.uniform1f(uSpeedLoc, speed);
      gl.uniform1f(uAmpLoc, amplitude);
      gl.uniform1f(uWaveScaleLoc, waveScale);
      gl.uniform1f(uWaveRatioLoc, waveRatio);
      gl.uniform1f(uSwellLoc, swell);
      gl.uniform1f(uTurbulenceLoc, turbulence);
      gl.uniform1f(uTiltLoc, tilt);
      gl.uniform1f(uZoomLoc, zoom);
      gl.uniform1f(uHeightLoc, height);
      gl.uniform1f(uFogLoc, fogDepth);
      gl.uniform1f(uBrightnessLoc, brightness);
      gl.uniform1f(uGrainLoc, grain ? grainIntensity : 0);
      gl.uniform1f(uOpacityLoc, opacity);

      gl.drawArrays(gl.TRIANGLES, 0, 6);

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', resize);
      if (mouseInteraction) {
        window.removeEventListener('mousemove', handleMouseMove);
      }
      cancelAnimationFrame(animationFrameId);
    };
  }, [
    horizonColor, waveColor, crestColor, speed, amplitude, waveScale, waveRatio,
    swell, turbulence, tilt, zoom, height, fogDepth, brightness, opacity,
    mouseInteraction, parallaxStrength, grain, grainIntensity
  ]);

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full block"
      style={{ width: '100%', height: '100%' }}
    />
  );
}
