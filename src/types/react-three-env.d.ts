/// <reference types="@react-three/fiber" />
import type { Object3D, Material, BufferGeometry, Vector3 } from 'three'
import type { ReactThreeFiber } from '@react-three/fiber'

declare module '@react-three/drei' {
  export const Sphere: React.FC<{ args?: [number, number, number]; children?: React.ReactNode }>
  export const MeshDistortMaterial: React.FC<{
    color?: string
    distort?: number
    speed?: number
    roughness?: number
    metalness?: number
    transparent?: boolean
    opacity?: number
  }>
  export const OrbitControls: React.FC<any>
  export const Points: React.FC<{ children?: React.ReactNode }>
  export const PointMaterial: React.FC<{
    size?: number
    color?: string
    transparent?: boolean
    opacity?: number
    sizeAttenuation?: boolean
  }>
}

// Allow core three tags as intrinsic elements for TSX
declare global {
  namespace JSX {
    interface IntrinsicElements {
      ambientLight: ReactThreeFiber.Object3DNode<any, any> & { intensity?: number; color?: string }
      directionalLight: ReactThreeFiber.Object3DNode<any, any> & { 
        intensity?: number
        color?: string
        position?: [number, number, number]
      }
      pointLight: ReactThreeFiber.Object3DNode<any, any> & {
        intensity?: number
        color?: string
        position?: [number, number, number]
      }
      mesh: ReactThreeFiber.Object3DNode<any, any> & {
        rotation?: [number, number, number]
        position?: [number, number, number]
        scale?: [number, number, number]
      }
      group: ReactThreeFiber.Object3DNode<any, any>
      points: ReactThreeFiber.Object3DNode<any, any>
      torusGeometry: ReactThreeFiber.BufferGeometryNode<any, any> & {
        args?: [number, number, number, number]
      }
      sphereGeometry: ReactThreeFiber.BufferGeometryNode<any, any> & {
        args?: [number, number, number]
      }
      planeGeometry: ReactThreeFiber.BufferGeometryNode<any, any> & {
        args?: [number, number, number, number]
      }
      bufferGeometry: ReactThreeFiber.BufferGeometryNode<any, any>
      meshBasicMaterial: ReactThreeFiber.MaterialNode<any, any> & {
        color?: string
        transparent?: boolean
        opacity?: number
      }
      meshPhysicalMaterial: ReactThreeFiber.MaterialNode<any, any> & {
        color?: string
        roughness?: number
        metalness?: number
        transmission?: number
        thickness?: number
        ior?: number
        transparent?: boolean
        opacity?: number
      }
      meshStandardMaterial: ReactThreeFiber.MaterialNode<any, any> & {
        color?: string
        roughness?: number
        metalness?: number
        transparent?: boolean
        opacity?: number
        emissive?: string
        emissiveIntensity?: number
      }
      pointsMaterial: ReactThreeFiber.MaterialNode<any, any> & {
        size?: number
        color?: string
        transparent?: boolean
        opacity?: number
        sizeAttenuation?: boolean
      }
      bufferAttribute: ReactThreeFiber.BufferAttributeNode & {
        array?: Float32Array
        itemSize?: number
        count?: number
      }
    }
  }
}


