import { useEffect, useState, FC } from 'react';
import Map, {Layer, LayerProps, MapProvider, Source, useMap} from 'react-map-gl';
import type { Feature, FeatureCollection } from 'geojson';

type Props = Readonly<{
}>;

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
  },
  beforeId:'point2'
};

const pointStyle: LayerProps = {
  id: 'point',
  type: 'circle',
  paint: {
    'circle-radius': 10,
    'circle-color': '#3887be',
  },
};

const pointStyle2: LayerProps = {
  id: 'point2',
  type: 'circle',
  paint: {
    'circle-radius': 10,
    'circle-color': '#ff001d',
  },
};

const NavigationTemplateContent: FC<Props> = () => {
  const { naviMap } = useMap();
  const [profile, setProfile] = useState<'driving' | 'walking'>('driving');
  const [startPoint, setStartPoint] = useState<FeatureCollection>();
  const [endPoint, setEndPoint] = useState<FeatureCollection>();
  const [routeGeoJson, setRouteGeoJson] = useState<Feature>();
  const getCurrentPosition = () => {
    navigator.geolocation.getCurrentPosition(position => {
        const { latitude, longitude } = position.coords;
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
        setStartPoint(start);
        // naviMap?.flyTo({center:{lat:position.latitude,lng:position.longitude}})
      },
      (error)=>console.log,
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 });
  };

  useEffect(() => {
    getCurrentPosition();
  }, []);

  const onClick = (event: mapboxgl.MapLayerMouseEvent) => {
    const coords = [event.lngLat.lng, event.lngLat.lat];
    const end = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'Point',
            coordinates: coords,
          },
        },
      ],
    } as FeatureCollection;
    setEndPoint(end);
  };

  useEffect(() => {
    if(!naviMap) return;

    if (startPoint?.features[0].geometry.type === 'Point' && endPoint?.features[0].geometry.type === 'Point') {
      const startLng = startPoint.features[0].geometry.coordinates[0];
      const startLat = startPoint.features[0].geometry.coordinates[1];
      const endLng = endPoint.features[0].geometry.coordinates[0];
      const endLat = endPoint.features[0].geometry.coordinates[1];
      naviMap.flyTo({center:{lng:startLng,lat:startLat},zoom:18});

      (async () => {
        const query = await fetch(
          `https://api.mapbox.com/directions/v5/mapbox/${profile}/${startLng},${startLat};${endLng},${endLat}?steps=true&geometries=geojson&access_token=${process.env.NEXT_PUBLIC_MAP_BOX_TOKEN}`,
          { method: 'GET' },
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
  }, [profile,startPoint,endPoint]);

  return (
    <div>
      <div>
        <button onClick={() => setProfile('walking')}>歩き</button>
        <button onClick={() => setProfile('driving')}>車</button>
        <span>{profile}</span>
      </div>
      <Map
        id='naviMap'
        initialViewState={{
          longitude: 139.6632556,
          latitude: 35.7340486,
          zoom: 14,
        }}
        style={{ width: '100%', height: '100vh' }}
        mapStyle={process.env.NEXT_PUBLIC_MAP_BOX_STYLE}
        mapboxAccessToken={process.env.NEXT_PUBLIC_MAP_BOX_TOKEN}
        onClick={onClick}
      >
        {routeGeoJson && (
          <Source id='myMap' type='geojson' data={routeGeoJson}>
            <Layer {...layerStyle} />
          </Source>
        )}
        {startPoint &&
        <Source id='start' type='geojson' data={startPoint}>
          <Layer {...pointStyle} />
        </Source>
        }
        {endPoint && (
          <Source id='end' type='geojson' data={endPoint}>
            <Layer {...pointStyle2} />
          </Source>
        )}
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
