import { createElement } from 'react';
import { View } from 'react-native';

import { styles } from '../styles/appStyles';
import type { LocalReport, SearchContext } from '../types/weather';

type NativeMapLayerProps = {
  searchContext: SearchContext;
  selectedIndex: number;
  visibleReports: LocalReport[];
};

export function NativeMapLayer({ searchContext }: NativeMapLayerProps) {
  const center = resolveMapCenter(searchContext);
  const mapEmbedUrl = createOpenStreetMapEmbedUrl(center.latitude, center.longitude);

  return (
    <View style={styles.mapTileLayer}>
      {typeof document === 'undefined'
        ? null
        : createElement('iframe', {
            title: `${searchContext.place} 지도`,
            src: mapEmbedUrl,
            style: {
              border: 0,
              height: '100%',
              width: '100%',
              filter: 'saturate(0.78) contrast(0.94) brightness(1.03)',
            },
            loading: 'lazy',
            referrerPolicy: 'no-referrer-when-downgrade',
          })}
    </View>
  );
}

function resolveMapCenter(searchContext: SearchContext) {
  return {
    latitude: searchContext.target.latitude ?? 37.5146,
    longitude: searchContext.target.longitude ?? 127.0736,
  };
}

function createOpenStreetMapEmbedUrl(latitude: number, longitude: number) {
  const delta = 0.012;
  const bbox = [
    longitude - delta,
    latitude - delta,
    longitude + delta,
    latitude + delta,
  ].join(',');

  return `https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(bbox)}&layer=mapnik&marker=${latitude},${longitude}`;
}
