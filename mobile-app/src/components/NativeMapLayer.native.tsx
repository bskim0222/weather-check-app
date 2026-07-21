import { useEffect, useMemo, useRef } from 'react';
import { Text, View } from 'react-native';
import MapView, { Marker, type Region } from 'react-native-maps';

import { styles } from '../styles/appStyles';
import type { MapReportCluster, SearchContext } from '../types/weather';

type NativeMapLayerProps = {
  searchContext: SearchContext;
  selectedIndex: number;
  visibleClusters: MapReportCluster[];
  onSelectCluster: (index: number) => void;
};

export function NativeMapLayer({
  onSelectCluster,
  searchContext,
  selectedIndex,
  visibleClusters,
}: NativeMapLayerProps) {
  const mapRef = useRef<MapView | null>(null);
  const center = useMemo(() => resolveMapCenter(searchContext), [searchContext]);
  const region = useMemo<Region>(() => ({
    ...center,
    latitudeDelta: 0.035,
    longitudeDelta: 0.035,
  }), [center]);

  useEffect(() => {
    mapRef.current?.animateToRegion(region, 450);
  }, [region]);

  return (
    <MapView
      initialRegion={region}
      mapPadding={{ top: 64, right: 12, bottom: 118, left: 12 }}
      pitchEnabled
      ref={mapRef}
      rotateEnabled
      scrollEnabled
      showsCompass={false}
      showsMyLocationButton={false}
      showsUserLocation={searchContext.target.kind === 'current'}
      style={styles.mapNativeMap}
      toolbarEnabled={false}
      zoomEnabled
    >
      <Marker
        coordinate={center}
        description={searchContext.target.kind === 'current' ? '현재 위치' : '검색한 위치'}
        pinColor="#2f7894"
        title={searchContext.place}
      />
      {visibleClusters.map((cluster, index) => {
        if (!Number.isFinite(cluster.latitude) || !Number.isFinite(cluster.longitude)) return null;
        const active = index === selectedIndex;

        return (
          <Marker
            anchor={{ x: 0.5, y: 0.5 }}
            coordinate={{ latitude: cluster.latitude!, longitude: cluster.longitude! }}
            key={cluster.id}
            onPress={() => onSelectCluster(index)}
            tracksViewChanges={active}
          >
            <View style={[styles.mapNativeCluster, active && styles.mapNativeClusterActive]}>
              <Text style={styles.mapNativeClusterIcon}>
                {getClusterWeatherSymbol(cluster.dominantCondition)}
              </Text>
              <Text style={styles.mapNativeClusterCount}>{cluster.count}</Text>
            </View>
          </Marker>
        );
      })}
    </MapView>
  );
}

function resolveMapCenter(searchContext: SearchContext) {
  return {
    latitude: searchContext.target.latitude ?? 37.5146,
    longitude: searchContext.target.longitude ?? 127.0736,
  };
}

function getClusterWeatherSymbol(condition: string) {
  if (/천둥|번개/.test(condition)) return '⚡';
  if (/눈/.test(condition)) return '❄';
  if (/비|소나기/.test(condition)) return '☂';
  if (/맑/.test(condition)) return '☀';
  if (/흐|구름/.test(condition)) return '☁';
  if (/안개/.test(condition)) return '≋';
  return '•';
}
