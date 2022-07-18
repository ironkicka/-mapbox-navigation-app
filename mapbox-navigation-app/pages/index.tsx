import {useEffect, useState, FC, useRef} from 'react';
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
  const getCurrentPosition = () => {
    navigator.geolocation.getCurrentPosition(position => {
        const {latitude, longitude} = position.coords;
        const start = {
          type: 'FeatureCollection' as const,
          features: [
            {
              type: 'Feature' as const,
              properties: {},
              geometry: {
                type: 'Point' as const,
                coordinates: [longitude, latitude],
              },
            },
          ],
        };
        console.log({lat: latitude, lng: longitude})
        setStart({lat: latitude, lng: longitude})
        // naviMap?.flyTo({center:{lat:position.latitude,lng:position.longitude}})
      },
      (error) => console.log,
      {enableHighAccuracy: true, timeout: 10000, maximumAge: 0});
  };

  useEffect(() => {
    getCurrentPosition();
  }, []);

  const onClick = (event: mapboxgl.MapLayerMouseEvent) => {
    setEnd({lat: event.lngLat.lat, lng: event.lngLat.lng})
  };

  useEffect(() => {
    if (!naviMap) return;

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
  }, [profile, start, end]);
  const [rotation, setRotation] = useState(0);

  useEffect(()=>{
    naviMap?.rotateTo(rotation);
  },[rotation])

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

  return (
    <div>
      <div>
        <button onClick={() => setProfile('walking')}>歩き</button>
        <button onClick={() => setProfile('driving')}>車</button>
        <span>{profile}</span>
        <button onClick={() => checkDevicePositionPermission()}>許可</button>
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
        {start &&
        <CurrentPositionMarker position={{lat:start.lat,lng:start.lng}}/>
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
