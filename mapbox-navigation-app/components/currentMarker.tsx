import {Marker} from "react-map-gl";
import {useEffect, useRef, useState} from "react";
import * as icon from '../public/vercel.svg'
import Image from 'next/image'
interface Props {
  position: {lat:number;lng:number;};
}

const CurrentPositionMarker = ({ position }: Props)=> {
  const [rotation, setRotation] = useState(0);
  const angleRef = useRef(0);

  useEffect(() => {
    if (!window || !window.DeviceOrientationEvent) return () => {};

    const handleMotionEvent = (event: DeviceOrientationEvent) => {
      // @ts-ignore
      const alpha = event.webkitCompassHeading ? event.webkitCompassHeading : event.alpha;
      setRotation(alpha + angleRef.current);
    };

    const handleOrientation = () => {
      // eslint-disable-next-line no-restricted-globals
      let angle = screen && screen.orientation && screen.orientation.angle;
      if (angle === undefined) {
        angle = Number(window.orientation); // iOS用
      }
      angleRef.current = angle;
    };

    window.addEventListener('deviceorientation', handleMotionEvent);
    window.addEventListener('orientationchange', handleOrientation);

    return () => {
      window.removeEventListener('deviceorientation', handleMotionEvent);
      window.removeEventListener('orientationchange', handleOrientation);
    };
  }, []);

  return (
    <Marker longitude={position.lng} latitude={position.lat}>
      <Image src={icon}/>
    </Marker>
  );
}

export default CurrentPositionMarker;
