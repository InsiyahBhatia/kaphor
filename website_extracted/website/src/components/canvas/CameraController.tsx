import { useRef, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { ZoneId, CameraWaypoint } from '../../types';

interface CameraControllerProps {
  zone: ZoneId;
  mousePos: { x: number; y: number };
}

const WAYPOINTS: Record<ZoneId, CameraWaypoint> = {
  studio: {
    pos: [0, 0.15, 3.8],
    lookAt: [0, 0, 0],
    fov: 44
  },
  inspection: {
    pos: [0.75, 0.35, 2.2],
    lookAt: [0.2, 0.25, 0.1],
    fov: 38
  },
  styling: {
    pos: [0, 0.2, 4.4],
    lookAt: [0, 0.1, 0],
    fov: 48
  },
  swap: {
    pos: [0, 1.2, 5.8],
    lookAt: [0, -0.2, 0],
    fov: 50
  },
  marketplace: {
    pos: [0, 0.5, 3.9],
    lookAt: [0, 0, 0],
    fov: 46
  },
  ecosystem: {
    pos: [0, 3.8, 14.0],
    lookAt: [0, 0, 0],
    fov: 54
  }
};

export function CameraController({ zone, mousePos }: CameraControllerProps) {
  const { camera } = useThree();
  const currentLookAt = useRef(new THREE.Vector3(0, 0, 0));
  const targetPos = useRef(new THREE.Vector3(0, 0, 4));
  const targetLookAt = useRef(new THREE.Vector3(0, 0, 0));

  useEffect(() => {
    const wp = WAYPOINTS[zone] || WAYPOINTS.studio;
    targetPos.current.set(...wp.pos);
    targetLookAt.current.set(...wp.lookAt);
    if ('fov' in camera) {
      (camera as THREE.PerspectiveCamera).fov = wp.fov;
      (camera as THREE.PerspectiveCamera).updateProjectionMatrix();
    }
  }, [zone, camera]);

  useFrame((_, delta) => {
    // Subtle Mouse Parallax: mousePos.x, mousePos.y in range [-1, 1]
    const parallaxX = mousePos.x * 0.25;
    const parallaxY = mousePos.y * 0.15;

    const desiredX = targetPos.current.x + parallaxX;
    const desiredY = targetPos.current.y + parallaxY;
    const desiredZ = targetPos.current.z;

    // Smooth damp camera position
    camera.position.x = THREE.MathUtils.damp(camera.position.x, desiredX, 3.5, delta);
    camera.position.y = THREE.MathUtils.damp(camera.position.y, desiredY, 3.5, delta);
    camera.position.z = THREE.MathUtils.damp(camera.position.z, desiredZ, 3.5, delta);

    // Smooth damp lookAt
    currentLookAt.current.x = THREE.MathUtils.damp(currentLookAt.current.x, targetLookAt.current.x, 4.0, delta);
    currentLookAt.current.y = THREE.MathUtils.damp(currentLookAt.current.y, targetLookAt.current.y, 4.0, delta);
    currentLookAt.current.z = THREE.MathUtils.damp(currentLookAt.current.z, targetLookAt.current.z, 4.0, delta);

    camera.lookAt(currentLookAt.current);
  });

  return null;
}
