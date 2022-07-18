import {useEffect, useState, FC, useRef, useCallback} from 'react';
import Map, {Layer, LayerProps, MapProvider, Marker, NavigationControl, Source, useMap} from 'react-map-gl';
import type {Feature} from 'geojson';
//これがないとmarkerがちゃんと描画されない
import 'mapbox-gl/dist/mapbox-gl.css';
import Pin from "../components/pin";
import CurrentPositionMarker from "../components/currentMarker";

type Props = Readonly<{}>;

const layerStyle: LayerProps = {
  id: 'route',
  type: 'line',
  layout: {
    'line-join': 'round',
    'line-cap': 'round',
  },
  paint: {
    'line-color': '#3887be',
    'line-width': 5,
    'line-opacity': 0.75,
  }
};

// 実験的なAPIのためTypeScriptに型が存在しないためここで記入
declare let DeviceOrientationEvent: {
  requestPermission?: () => string;
};

const checkDevicePositionPermission = async () => {
  if (window === undefined) return false;
  if (typeof DeviceOrientationEvent.requestPermission === 'function') {
    // iOSの場合許可が必要
    const permissionState = await DeviceOrientationEvent.requestPermission();

    return permissionState === 'granted';
  }
  return true;
};

const NavigationTemplateContent: FC<Props> = () => {
  const {naviMap} = useMap();
  const [profile, setProfile] = useState<'driving' | 'walking'>('driving');
  const [start, setStart] = useState<{ lat: number; lng: number } | null>(null);
  const [end, setEnd] = useState<{ lat: number; lng: number } | null>(null);
  const [routeGeoJson, setRouteGeoJson] = useState<Feature>();
  const [currentUserPosition, setCurrentUserPosition] = useState<{ lat: number; lng: number } | null>(null);
  const [isNavigationMode,setIsNavigationMode] = useState(false)

  const getCurrentPosition = ():Promise<{lat: number, lng: number}> => {
    return new Promise<{lat: number, lng: number}>((resolve,reject)=>{
      navigator.geolocation.getCurrentPosition(position => {
          const {latitude, longitude} = position.coords;
          resolve({lat: latitude, lng: longitude})
        },
        (error) => {
          reject(error)
        },
        {enableHighAccuracy: true, timeout: 10000, maximumAge: 0});
    })

  };


  const onClick = (event: mapboxgl.MapLayerMouseEvent) => {
    setEnd({lat: event.lngLat.lat, lng: event.lngLat.lng})
  };

  useEffect(() => {
    if (!naviMap||!isNavigationMode) return;
    if (start && end) {
      naviMap.flyTo({center: {lng: start.lng, lat: start.lat}, zoom: 18});
      (async () => {
        const query = await fetch(
          `https://api.mapbox.com/directions/v5/mapbox/${profile}/${start.lng},${start.lat};${end.lng},${end.lat}?steps=true&geometries=geojson&access_token=${process.env.NEXT_PUBLIC_MAP_BOX_TOKEN}`,
          {method: 'GET'},
        );
        const json = await query.json();
        const data = json.routes[0];
        const route = data.geometry.coordinates;
        const geojson = {
          type: 'Feature' as const,
          properties: {},
          geometry: {
            type: 'LineString' as const,
            coordinates: route,
          },
        };
        setRouteGeoJson(geojson);
      })();
    }
  }, [profile, isNavigationMode,start,end]);

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
  }, [])
  const currentPositionPollingRef = useRef<NodeJS.Timeout | null>();

  const updateCurrentUserPosition = useCallback(async () => {
    const currentPosition = await getCurrentPosition();
    console.log(currentPosition)
    setCurrentUserPosition(currentPosition)
  },[setCurrentUserPosition])

  const clearUpdatePositionPollingRef = useCallback(() => {
    if (currentPositionPollingRef.current === null) return;
    clearInterval(currentPositionPollingRef.current);
    currentPositionPollingRef.current = null;
  }, []);

  const setCurrentPositionPolling = useCallback(() => {
    clearUpdatePositionPollingRef();
    updateCurrentUserPosition();
    currentPositionPollingRef.current = setInterval(() => {
      updateCurrentUserPosition();
    }, 1000);
  }, [clearUpdatePositionPollingRef, updateCurrentUserPosition])

  const onStartNavigation = ()=>{
    checkDevicePositionPermission()
    getCurrentPosition().then((res)=>{
      setStart(res)
    })
    setCurrentPositionPolling()
    setIsNavigationMode(true)
  }

  useEffect(()=>{
    if(!isNavigationMode) return;
    naviMap?.rotateTo(rotation);
  },[isNavigationMode,rotation])

  const onFinishNavigation = ()=>{
    setIsNavigationMode(false)
    setRouteGeoJson(undefined)
    naviMap?.resetNorth().setZoom(14);
  }

  useEffect(()=>{
    if(!currentUserPosition) return;
    naviMap?.setCenter(currentUserPosition)
  },[currentUserPosition])

  return (
    <div>
      <div>
        <button onClick={() => setProfile('walking')}>歩き</button>
        <button onClick={() => setProfile('driving')}>車</button>
        <span>{profile}</span>
        <button disabled={!end||isNavigationMode} onClick={onStartNavigation}>ナビゲーション開始</button>
        <button disabled={!isNavigationMode} onClick={onFinishNavigation}>ナビゲーション終了</button>
      </div>
      <Map
        id='naviMap'
        initialViewState={{
          longitude: 139.6632556,
          latitude: 35.7340486,
          zoom: 14,
        }}
        style={{width: '100%', height: '100vh'}}
        mapStyle={process.env.NEXT_PUBLIC_MAP_BOX_STYLE}
        mapboxAccessToken={process.env.NEXT_PUBLIC_MAP_BOX_TOKEN}
        onClick={onClick}
      >
        {start &&
        <Marker key={'startPoint'} longitude={start.lng} latitude={start.lat} anchor="center">
          <Pin/>
        </Marker>
        }
        {end &&
        <Marker key={'endPoint'} longitude={end.lng} latitude={end.lat} anchor="center">
          <Pin/>
        </Marker>
        }
        {routeGeoJson && (
          <Source id='myMap' type='geojson' data={routeGeoJson}>
            <Layer {...layerStyle} />
          </Source>
        )}
        <NavigationControl />
        {currentUserPosition &&
        <CurrentPositionMarker position={{lat:currentUserPosition.lat,lng:currentUserPosition.lng}}/>
        }
      </Map>
    </div>
  );
};

const Home: FC<Props> = (props) => (
  <MapProvider>
    <NavigationTemplateContent {...props} />
  </MapProvider>
);

export default Home
