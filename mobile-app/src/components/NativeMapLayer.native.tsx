import { useEffect, useMemo, useRef } from 'react';
import { Text, View } from 'react-native';
import MapView, { Marker, type Region } from 'react-native-maps';

import { hasMapTargetCoordinates } from '../domain/mapClustering';
import { styles } from '../styles/appStyles';
import type { MapReportCluster, SearchContext } from '../types/weather';

type NativeMapLayerProps = {
  onClusterGridChange: (gridDegrees: number) => void;
  searchContext: SearchContext;
  selectedIndex: number;
  visibleClusters: MapReportCluster[];
  onSelectCluster: (index: number) => void;
};

export function NativeMapLayer({
  onClusterGridChange,
  onSelectCluster,
  searchContext,
  selectedIndex,
  visibleClusters,
}: NativeMapLayerProps) {
  const mapRef = useRef<MapView | null>(null);
  const center = useMemo(() => resolveMapCenter(searchContext), [searchContext]);
  const hasVerifiedCenter = hasMapTargetCoordinates(searchContext);
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
      onRegionChangeComplete={(nextRegion) => onClusterGridChange(getGridDegreesForRegion(nextRegion))}
      showsUserLocation={false}
      style={styles.mapNativeMap}
      toolbarEnabled={false}
      zoomEnabled
    >
      {hasVerifiedCenter ? (
        <Marker
          coordinate={center}
          description={searchContext.target.kind === 'current' ? '현재 위치' : '검색한 위치'}
          pinColor="#2f7894"
          title={searchContext.place}
        />
      ) : null}
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

function getGridDegreesForRegion(region: Region) {
  const delta = Math.max(region.latitudeDelta, region.longitudeDelta);
  if (delta <= 0.06) return 0.015;
  if (delta <= 0.12) return 0.03;
  if (delta <= 0.25) return 0.06;
  if (delta <= 0.5) return 0.12;
  if (delta <= 1) return 0.25;
  if (delta <= 2) return 0.5;
  if (delta <= 4) return 1;
  return 2;
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
