import { Canvas, useFrame, type RootState } from '@react-three/fiber'
import { Sphere, MeshDistortMaterial } from '@react-three/drei'
import { useRef, useMemo, Suspense } from 'react'
import type { Mesh, BufferGeometry, Points as ThreePoints } from 'three'
import { getThemeColor, getThemeGlow, type ColorTheme, type VisualizerVariant } from './ColorThemes'

interface VisualizerProps {
  intensity: number
  speaking: boolean
  listening: boolean
  colorTheme?: ColorTheme
}

// Halo Ring Visualizer
function HaloVisualizer({ intensity, speaking, listening, colorTheme = 'purple' }: VisualizerProps) {
  const torusRef = useRef<Mesh>(null)

  useFrame((state: RootState) => {
    const t = state.clock.getElapsedTime()
    if (torusRef.current) {
      torusRef.current.rotation.x = Math.sin(t * 0.4) * 0.2
      torusRef.current.rotation.y = t * 0.3
      const scale = 1 + Math.sin(t * 2) * 0.05 * intensity
      torusRef.current.scale.setScalar(scale)
    }
  })

  const ringRadius = 0.9 + intensity * 0.12
  const tube = 0.18 + intensity * 0.08
  const baseColor = getThemeColor(colorTheme, speaking, listening)

  return (
    <mesh ref={torusRef} rotation={[Math.PI / 2, 0, 0]}>
      <torusGeometry args={[ringRadius, tube, 64, 256]} />
      <meshPhysicalMaterial
        color={baseColor}
        roughness={0.15}
        metalness={0.0}
        transmission={0.85}
        thickness={0.6}
        ior={1.22}
        transparent
        opacity={0.9}
      />
    </mesh>
  )
}

// Organic Blob Visualizer
function BlobShape({ intensity, speaking, listening, colorTheme = 'purple' }: VisualizerProps) {
  const meshRef = useRef<Mesh>(null)
  
  useFrame((state: RootState) => {
    const t = state.clock.getElapsedTime()
    if (meshRef.current) {
      meshRef.current.rotation.x = Math.sin(t * 0.3) * 0.12
      meshRef.current.rotation.y = t * 0.25
      const scale = 1 + Math.sin(t * 2) * 0.05 * intensity
      meshRef.current.scale.setScalar(scale)
    }
  })
  
  const color = getThemeColor(colorTheme, speaking, listening)
  
  return (
    <mesh ref={meshRef}>
      <Sphere args={[1, 128, 128]}>
        <MeshDistortMaterial 
          color={color} 
          distort={0.35 + intensity * 0.2} 
          speed={1.4 + intensity * 0.5} 
          roughness={0.15} 
          metalness={0} 
          transparent
          opacity={0.95} 
        />
      </Sphere>
    </mesh>
  )
}

// Particle Cloud Visualizer
function ParticlesVisualizer({ intensity, speaking, listening, colorTheme = 'purple' }: VisualizerProps) {
  const pointsRef = useRef<ThreePoints>(null)
  
  const particlePositions = useMemo(() => {
    const count = 1000
    const positions = new Float32Array(count * 3)
    
    for (let i = 0; i < count; i++) {
      const i3 = i * 3
      const radius = 0.5 + Math.random() * 1.5
      const theta = Math.random() * Math.PI * 2
      const phi = Math.random() * Math.PI
      
      positions[i3] = radius * Math.sin(phi) * Math.cos(theta)
      positions[i3 + 1] = radius * Math.sin(phi) * Math.sin(theta)
      positions[i3 + 2] = radius * Math.cos(phi)
    }
    
    return positions
  }, [])

  useFrame((state: RootState) => {
    const t = state.clock.getElapsedTime()
    if (pointsRef.current) {
      pointsRef.current.rotation.y = t * 0.1
      pointsRef.current.rotation.x = Math.sin(t * 0.2) * 0.1
      
      const positions = pointsRef.current.geometry.attributes.position.array as Float32Array
      for (let i = 0; i < positions.length; i += 3) {
        const x = positions[i]
        const y = positions[i + 1]
        
        positions[i + 1] = y + Math.sin(t * 2 + x * 2) * 0.01 * intensity
      }
      pointsRef.current.geometry.attributes.position.needsUpdate = true
    }
  })

  const color = getThemeColor(colorTheme, speaking, listening)
  
  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[particlePositions, 3]}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.02 + intensity * 0.01}
        color={color}
        transparent
        opacity={0.8}
        sizeAttenuation
      />
    </points>
  )
}

// Wave Surface Visualizer
function WavesVisualizer({ intensity, speaking, listening, colorTheme = 'purple' }: VisualizerProps) {
  const meshRef = useRef<Mesh>(null)
  
  useFrame((state: RootState) => {
    const t = state.clock.getElapsedTime()
    if (meshRef.current) {
      const geometry = meshRef.current.geometry as BufferGeometry
      const positions = geometry.attributes.position.array as Float32Array
      
      for (let i = 0; i < positions.length; i += 3) {
        const x = positions[i]
        const y = positions[i + 1]
        positions[i + 2] = Math.sin(x * 2 + t * 2) * Math.cos(y * 2 + t * 1.5) * 0.2 * (1 + intensity)
      }
      
      geometry.attributes.position.needsUpdate = true
      geometry.computeVertexNormals()
    }
  })

  const color = getThemeColor(colorTheme, speaking, listening)

  return (
    <mesh ref={meshRef}>
      <planeGeometry args={[3, 3, 64, 64]} />
      <meshStandardMaterial
        color={color}
        transparent
        opacity={0.8}
        roughness={0.1}
        metalness={0.2}
        emissive={color}
        emissiveIntensity={0.1 + intensity * 0.2}
      />
    </mesh>
  )
}

// Geometric Wireframe Visualizer
function GeometricVisualizer({ intensity, speaking, listening, colorTheme = 'purple' }: VisualizerProps) {
  const meshRef = useRef<Mesh>(null)
  
  useFrame((state: RootState) => {
    const t = state.clock.getElapsedTime()
    if (meshRef.current) {
      meshRef.current.rotation.x = t * 0.2
      meshRef.current.rotation.y = t * 0.3
      meshRef.current.rotation.z = t * 0.1
      const scale = 1 + Math.sin(t * 2) * 0.1 * intensity
      meshRef.current.scale.setScalar(scale)
    }
  })

  const color = getThemeColor(colorTheme, speaking, listening)

  return (
    <mesh ref={meshRef}>
      <sphereGeometry args={[1, 8, 6]} />
      <meshBasicMaterial
        color={color}
        transparent
        opacity={0.8}
        wireframe
      />
    </mesh>
  )
}

// Aurora Curtain Visualizer  
function AuroraVisualizer({ intensity, speaking, listening, colorTheme = 'purple' }: VisualizerProps) {
  const meshRef = useRef<Mesh>(null)
  
  useFrame((state: RootState) => {
    const t = state.clock.getElapsedTime()
    if (meshRef.current) {
      const geometry = meshRef.current.geometry as BufferGeometry
      const positions = geometry.attributes.position.array as Float32Array
      
      for (let i = 0; i < positions.length; i += 3) {
        const x = positions[i]
        const originalY = positions[i + 1]
        positions[i + 2] = Math.sin(x * 3 + t * 2) * Math.cos(originalY * 2 + t) * 0.3 * (1 + intensity * 0.5)
      }
      
      geometry.attributes.position.needsUpdate = true
    }
  })

  const color = getThemeColor(colorTheme, speaking, listening)

  return (
    <mesh ref={meshRef} rotation={[0, 0, Math.PI / 4]}>
      <planeGeometry args={[2, 3, 32, 48]} />
      <meshStandardMaterial
        color={color}
        transparent
        opacity={0.7}
        roughness={0.0}
        metalness={0.1}
        emissive={color}
        emissiveIntensity={0.2 + intensity * 0.3}
      />
    </mesh>
  )
}

// Main Visualizer Component
interface BlobVisualizerProps {
  listening: boolean
  speaking: boolean
  variant?: VisualizerVariant
  colorTheme?: ColorTheme
}

// Simple fallback component
function SimpleFallback({ variant, speaking, listening, intensity, shadowColor }: {
  variant: string
  speaking: boolean
  listening: boolean
  intensity: number
  shadowColor: string
}) {
  return (
    <div 
      className="w-full h-full rounded-full flex items-center justify-center text-white/70 text-sm border border-white/20"
      style={{ 
        background: `radial-gradient(circle, ${shadowColor.replace('0.45', '0.2').replace('0.35', '0.15').replace('0.30', '0.1')} 0%, transparent 70%)`,
        animation: intensity > 0.5 ? 'pulse 2s infinite' : 'none'
      }}
    >
      {variant} {speaking ? '🎤' : listening ? '👂' : '⭕'}
    </div>
  )
}

export function BlobVisualizer({ listening, speaking, variant = 'halo', colorTheme = 'purple' }: BlobVisualizerProps) {
  const intensity = speaking ? 1.0 : listening ? 0.6 : 0.25
  const shadowColor = getThemeGlow(colorTheme, intensity)

  const renderVisualizer = () => {
    const props = { intensity, speaking, listening, colorTheme }
    
    try {
      switch (variant) {
        case 'blob':
          return <BlobShape {...props} />
        case 'particles':
          return <ParticlesVisualizer {...props} />
        case 'waves':
          return <WavesVisualizer {...props} />
        case 'geometric':
          return <GeometricVisualizer {...props} />
        case 'aurora':
          return <AuroraVisualizer {...props} />
        case 'halo':
        default:
          return <HaloVisualizer {...props} />
      }
    } catch (error) {
      console.error('Visualizer render error:', error)
      return <SimpleFallback variant={variant} speaking={speaking} listening={listening} intensity={intensity} shadowColor={shadowColor} />
    }
  }

  // Try Canvas first, fallback to simple version if it fails
  try {
    return (
      <div
        style={{
          width: 220,
          height: 220,
          filter: `drop-shadow(0 0 ${20 + intensity * 20}px ${shadowColor})`,
        }}
        className="rounded-full overflow-hidden relative"
        data-testid={`visualizer-${variant}`}
      >
        <Canvas 
          camera={{ position: [0, 0, 3], fov: 50 }} 
          gl={{ antialias: true, alpha: true, preserveDrawingBuffer: true }} 

          onCreated={({ gl }) => {
            console.log('Canvas created successfully')
            gl.setClearColor('#000000', 0)
          }}
          onError={(error) => {
            console.error('Canvas error:', error)
          }}
        >
          <Suspense fallback={null}>
            <ambientLight intensity={0.6} color="#ede9fe" />
            <pointLight position={[2, 2, 2]} intensity={0.8} color="#faf5ff" />
            <directionalLight position={[-2, 1, 1]} intensity={0.3} color="#f0f4ff" />
            {renderVisualizer()}
          </Suspense>
        </Canvas>

      </div>
    )
  } catch (error) {
    console.error('Canvas initialization failed:', error)
    return (
      <div
        style={{
          width: 220,
          height: 220,
          filter: `drop-shadow(0 0 ${20 + intensity * 20}px ${shadowColor})`,
        }}
        className="rounded-full overflow-hidden relative"
      >
        <SimpleFallback variant={variant} speaking={speaking} listening={listening} intensity={intensity} shadowColor={shadowColor} />
      </div>
    )
  }
}