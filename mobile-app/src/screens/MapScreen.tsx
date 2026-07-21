import { useCallback, useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';

import { FieldReportMapCard } from '../components/FieldReportMapCard';
import {
  createMapReportClusters,
  getRecentMapReports,
  hasStoredClusterCoordinate,
  MAP_PRIVACY_GRID_DEGREES,
  requestToMapReport,
  roundToPrivacyGrid,
  type MapCoordinate,
} from '../domain/mapClustering';
import { searchRemotePlaces } from '../services/geocoding';
import { styles } from '../styles/appStyles';
import type { LocalReport, ReportRequest, SearchContext } from '../types/weather';

type MapScreenProps = {
  requests: ReportRequest[];
  reports: LocalReport[];
  searchContext: SearchContext;
  questionText: string;
  onUseCurrentLocation: () => void;
  onSearchLocation: (query?: string, location?: SearchContext['target']) => void;
  onReportIssue: (report: LocalReport) => void;
};

export function MapScreen({
  requests,
  reports,
  searchContext,
  questionText,
  onUseCurrentLocation,
  onSearchLocation,
  onReportIssue,
}: MapScreenProps) {
  const mapReports = useMemo(
    () => getRecentMapReports([...reports, ...requests.map(requestToMapReport)]),
    [reports, requests],
  );
  const [coordinatesByPlace, setCoordinatesByPlace] = useState<Record<string, MapCoordinate | null>>({});
  const [clusterGridDegrees, setClusterGridDegrees] = useState(MAP_PRIVACY_GRID_DEGREES);
  const visibleClusters = useMemo(
    () => createMapReportClusters(mapReports, coordinatesByPlace, clusterGridDegrees),
    [clusterGridDegrees, coordinatesByPlace, mapReports],
  );
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const updateClusterGrid = useCallback((nextGridDegrees: number) => {
    if (clusterGridDegrees === nextGridDegrees) return;
    setSelectedIndex(-1);
    setClusterGridDegrees(nextGridDegrees);
  }, [clusterGridDegrees]);

  useEffect(() => {
    setSelectedIndex(-1);
  }, [searchContext.place]);

  useEffect(() => {
    let cancelled = false;
    const places = Array.from(
      new Set(
        mapReports
          .filter((report) => !hasStoredClusterCoordinate(report))
          .map((report) => report.place.trim())
          .filter(Boolean),
      ),
    );
    const unresolvedPlaces = places.filter((place) => !(place in coordinatesByPlace));

    if (unresolvedPlaces.length === 0) return;

    Promise.all(
      unresolvedPlaces.map(async (place) => {
        const candidates = await searchRemotePlaces(place, place);
        const location = candidates[0]?.location;

        return [
          place,
          location?.latitude != null && location?.longitude != null
            ? {
              latitude: roundToPrivacyGrid(location.latitude),
              longitude: roundToPrivacyGrid(location.longitude),
            }
            : null,
        ] as const;
      }),
    ).then((entries) => {
      if (cancelled) return;
      setCoordinatesByPlace((current) => ({ ...current, ...Object.fromEntries(entries) }));
    });

    return () => {
      cancelled = true;
    };
  }, [coordinatesByPlace, mapReports]);

  const selectedCluster = selectedIndex >= 0 ? visibleClusters[selectedIndex] : undefined;

  return (
    <View style={styles.mapScreenRoot}>
      <FieldReportMapCard
        searchContext={searchContext}
        selectedCluster={selectedCluster}
        selectedIndex={selectedIndex}
        visibleClusters={visibleClusters}
        onCloseCluster={() => setSelectedIndex(-1)}
        onClusterGridChange={updateClusterGrid}
        onReportIssue={onReportIssue}
        questionText={questionText}
        onSearchLocation={onSearchLocation}
        onSelectCluster={setSelectedIndex}
        onUseCurrentLocation={onUseCurrentLocation}
      />
    </View>
  );
}
