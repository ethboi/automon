'use client';

import { OrthographicCamera } from '@react-three/drei';
import { useRef, useEffect } from 'react';
import * as THREE from 'three';

interface IsometricCameraProps {
  zoom?: number;
  target?: [number, number, number];
}

export function IsometricCamera({ zoom = 40, target = [0, 0, 0] }: IsometricCameraProps) {
  const cameraRef = useRef<THREE.OrthographicCamera>(null);

  // Camera distance from target
  const distance = 50;

  // Isometric camera position - 45° around Y, ~35° down
  const cameraPosition: [number, number, number] = [
    distance,
    distance,
    distance,
  ];

  useEffect(() => {
    if (cameraRef.current) {
      cameraRef.current.lookAt(target[0], target[1], target[2]);
      cameraRef.current.updateProjectionMatrix();
    }
  }, [target]);

  return (
    <OrthographicCamera
      ref={cameraRef}
      makeDefault
      zoom={zoom}
      position={cameraPosition}
      near={0.1}
      far={1000}
    />
  );
}
