'use client'

/**
 * Voice Powered Orb Component
 * Based on 21st.dev voice-powered-orb by isaiahbjork
 * Uses OGL for WebGL rendering with audio frequency analysis
 */

import { useEffect, useRef, useCallback } from 'react'
import { Renderer, Program, Mesh, Plane } from 'ogl'
import { cn } from '@/lib/utils'

// Vertex shader - simple passthrough
const VERTEX_SHADER = `
  attribute vec2 position;
  attribute vec2 uv;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position, 0.0, 1.0);
  }
`

// Fragment shader - creates the animated ring orb effect (matching 21st.dev reference)
const FRAGMENT_SHADER = `
  precision highp float;

  uniform float uTime;
  uniform float uAmplitude;
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  uniform vec3 uColorC;
  uniform vec2 uResolution;
  uniform float uSpeaking;

  varying vec2 vUv;

  #define PI 3.14159265359

  // Simplex 2D noise
  vec3 permute(vec3 x) { return mod(((x*34.0)+1.0)*x, 289.0); }

  float snoise(vec2 v) {
    const vec4 C = vec4(0.211324865405187, 0.366025403784439,
             -0.577350269189626, 0.024390243902439);
    vec2 i  = floor(v + dot(v, C.yy) );
    vec2 x0 = v -   i + dot(i, C.xx);
    vec2 i1;
    i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
    vec4 x12 = x0.xyxy + C.xxzz;
    x12.xy -= i1;
    i = mod(i, 289.0);
    vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0 ))
    + i.x + vec3(0.0, i1.x, 1.0 ));
    vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy),
      dot(x12.zw,x12.zw)), 0.0);
    m = m*m ;
    m = m*m ;
    vec3 x = 2.0 * fract(p * C.www) - 1.0;
    vec3 h = abs(x) - 0.5;
    vec3 ox = floor(x + 0.5);
    vec3 a0 = x - ox;
    m *= 1.79284291400159 - 0.85373472095314 * ( a0*a0 + h*h );
    vec3 g;
    g.x  = a0.x  * x0.x  + h.x  * x0.y;
    g.yz = a0.yz * x12.xz + h.yz * x12.yw;
    return 130.0 * dot(m, g);
  }

  // Fractional Brownian Motion
  float fbm(vec2 p) {
    float f = 0.0;
    float w = 0.5;
    for (int i = 0; i < 5; i++) {
      f += w * snoise(p);
      p *= 2.0;
      w *= 0.5;
    }
    return f;
  }

  void main() {
    vec2 uv = vUv;
    vec2 center = vec2(0.5);
    float dist = length(uv - center);

    // Calculate angle for color rotation
    vec2 fromCenter = uv - center;
    float angle = atan(fromCenter.y, fromCenter.x);

    // Base animation speed (faster when speaking)
    float speed = mix(0.3, 1.2, uSpeaking);
    float time = uTime * speed;

    // Noise-based distortion for organic edge
    float noiseScale = mix(3.0, 5.0, uSpeaking);
    float noiseStrength = mix(0.02, 0.06, uAmplitude);
    float noise = fbm(vec2(angle * 2.0, time * 0.5) + uv * noiseScale);

    // Ring parameters
    float ringRadius = 0.32 + uAmplitude * 0.05;
    float ringThickness = 0.08 + uAmplitude * 0.04;

    // Distorted distance for organic shape
    float distortedDist = dist + noise * noiseStrength;

    // Create ring shape (hollow circle)
    float innerEdge = smoothstep(ringRadius - ringThickness, ringRadius - ringThickness + 0.02, distortedDist);
    float outerEdge = smoothstep(ringRadius + ringThickness + 0.02, ringRadius + ringThickness, distortedDist);
    float ring = innerEdge * outerEdge;

    // Rotating color gradient around the ring
    float colorAngle = angle + time * 0.5;

    // Create smooth color blend using sine waves (no branching)
    float c1 = sin(colorAngle) * 0.5 + 0.5;
    float c2 = sin(colorAngle + PI * 0.666) * 0.5 + 0.5;
    float c3 = sin(colorAngle + PI * 1.333) * 0.5 + 0.5;

    // Normalize weights
    float total = c1 + c2 + c3;
    c1 /= total;
    c2 /= total;
    c3 /= total;

    // Blend colors from uniforms
    vec3 color = uColorA * c1 + uColorB * c2 + uColorC * c3;

    // Boost brightness for vibrant appearance
    color *= 1.6;

    // Inner glow (soft glow inside the ring)
    float innerGlow = smoothstep(ringRadius - ringThickness - 0.1, ringRadius - ringThickness, distortedDist);
    innerGlow *= smoothstep(ringRadius, ringRadius - ringThickness * 0.5, distortedDist);
    innerGlow *= 0.3;

    // Outer glow
    float outerGlow = smoothstep(ringRadius + ringThickness + 0.15, ringRadius + ringThickness, distortedDist);
    outerGlow *= (1.0 - outerEdge) * 0.4;

    // Combine ring with glows
    vec3 finalColor = color * ring;
    finalColor += color * innerGlow * 0.5;
    finalColor += color * outerGlow;

    // Alpha
    float alpha = ring + innerGlow * 0.5 + outerGlow;
    alpha = clamp(alpha, 0.0, 1.0);

    gl_FragColor = vec4(finalColor, alpha);
  }
`

export interface VoicePoweredOrbProps {
  /** Whether the orb is currently active/speaking */
  isSpeaking?: boolean
  /** Audio amplitude level (0-1) for animation intensity */
  amplitude?: number
  /** Primary color */
  colorA?: string
  /** Secondary color */
  colorB?: string
  /** Tertiary color */
  colorC?: string
  /** Additional CSS classes */
  className?: string
  /** Size in pixels */
  size?: number
}

function hexToRgb(hex: string): [number, number, number] {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  if (result) {
    return [
      parseInt(result[1], 16) / 255,
      parseInt(result[2], 16) / 255,
      parseInt(result[3], 16) / 255
    ]
  }
  return [0.2, 0.5, 1.0] // Default blue
}

export function VoicePoweredOrb({
  isSpeaking = false,
  amplitude = 0,
  colorA = '#4F46E5', // Indigo
  colorB = '#7C3AED', // Violet
  colorC = '#06B6D4', // Cyan
  className,
  size = 200
}: VoicePoweredOrbProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rendererRef = useRef<Renderer | null>(null)
  const programRef = useRef<Program | null>(null)
  const meshRef = useRef<Mesh | null>(null)
  const animationRef = useRef<number>(0)
  const startTimeRef = useRef<number>(Date.now())
  const smoothAmplitudeRef = useRef<number>(0)

  // Store current prop values in refs for animation loop access
  const isSpeakingRef = useRef(isSpeaking)
  const amplitudeRef = useRef(amplitude)
  const colorARef = useRef(colorA)
  const colorBRef = useRef(colorB)
  const colorCRef = useRef(colorC)

  // Update refs when props change
  useEffect(() => { isSpeakingRef.current = isSpeaking }, [isSpeaking])
  useEffect(() => { amplitudeRef.current = amplitude }, [amplitude])
  useEffect(() => { colorARef.current = colorA }, [colorA])
  useEffect(() => { colorBRef.current = colorB }, [colorB])
  useEffect(() => { colorCRef.current = colorC }, [colorC])

  // Initialize WebGL once on mount
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const renderer = new Renderer({
      canvas,
      width: size,
      height: size,
      dpr: Math.min(window.devicePixelRatio, 2),
      alpha: true,
      premultipliedAlpha: false,
    })
    rendererRef.current = renderer

    const gl = renderer.gl
    gl.clearColor(0, 0, 0, 0)

    // Use Plane geometry which has UV coordinates (Triangle doesn't)
    const geometry = new Plane(gl, { width: 2, height: 2 })

    const program = new Program(gl, {
      vertex: VERTEX_SHADER,
      fragment: FRAGMENT_SHADER,
      uniforms: {
        uTime: { value: 0 },
        uAmplitude: { value: 0 },
        uColorA: { value: hexToRgb(colorARef.current) },
        uColorB: { value: hexToRgb(colorBRef.current) },
        uColorC: { value: hexToRgb(colorCRef.current) },
        uResolution: { value: [size, size] },
        uSpeaking: { value: 0 },
      },
      transparent: true,
      depthTest: false,
      depthWrite: false,
    })
    programRef.current = program

    const mesh = new Mesh(gl, { geometry, program })
    meshRef.current = mesh

    const animate = () => {
      const time = (Date.now() - startTimeRef.current) / 1000

      // Smooth amplitude transitions
      const speaking = isSpeakingRef.current
      const amp = amplitudeRef.current
      const targetAmplitude = speaking ? Math.max(0.3, amp) : amp * 0.3
      smoothAmplitudeRef.current += (targetAmplitude - smoothAmplitudeRef.current) * 0.1

      if (programRef.current) {
        programRef.current.uniforms.uTime.value = time
        programRef.current.uniforms.uAmplitude.value = smoothAmplitudeRef.current
        programRef.current.uniforms.uSpeaking.value = speaking ? 1.0 : 0.0
        // Update colors every frame from refs
        programRef.current.uniforms.uColorA.value = hexToRgb(colorARef.current)
        programRef.current.uniforms.uColorB.value = hexToRgb(colorBRef.current)
        programRef.current.uniforms.uColorC.value = hexToRgb(colorCRef.current)
      }

      renderer.render({ scene: mesh })
      animationRef.current = requestAnimationFrame(animate)
    }

    animate()

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
      if (rendererRef.current) {
        rendererRef.current.gl.getExtension('WEBGL_lose_context')?.loseContext()
      }
    }
  }, [size]) // Only re-initialize when size changes

  return (
    <div
      className={cn(
        'relative flex items-center justify-center',
        className
      )}
      style={{ width: size, height: size }}
    >
      <canvas
        ref={canvasRef}
        width={size}
        height={size}
        className="rounded-full"
        style={{
          width: size,
          height: size,
        }}
      />
    </div>
  )
}

export default VoicePoweredOrb
