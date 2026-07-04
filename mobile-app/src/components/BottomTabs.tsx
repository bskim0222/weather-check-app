import { Pressable, Text, View } from 'react-native';
import Svg, { Circle, Line, Path, Polyline } from 'react-native-svg';

import { tabs } from '../data/mockWeather';
import { styles } from '../styles/appStyles';
import type { TabKey } from '../types/weather';

type BottomTabsProps = {
  activeTab: TabKey;
  onTabChange: (tab: TabKey) => void;
};

export function BottomTabs({ activeTab, onTabChange }: BottomTabsProps) {
  return (
    <View style={styles.bottomTabs}>
      {tabs.map((tab) => {
        const isActive = activeTab === tab.key;
        return (
          <Pressable
            key={tab.key}
            onPress={() => onTabChange(tab.key)}
            style={[styles.tabButton, isActive && styles.tabButtonActive]}
          >
            <TabIcon tabKey={tab.key} isActive={isActive} />
            <Text style={[styles.tabText, isActive && styles.tabTextActive]}>{tab.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function TabIcon({ tabKey, isActive }: { tabKey: TabKey; isActive: boolean }) {
  const color = isActive ? '#fff7ee' : '#9b8a91';
  const strokeWidth = isActive ? 2.8 : 2.4;

  return (
    <Svg width={30} height={30} viewBox="0 0 30 30" style={styles.tabIconVector}>
      {tabKey === 'decision' && (
        <>
          <Circle cx="15" cy="15" r="8" stroke={color} strokeWidth={strokeWidth} fill="none" />
          <Circle cx="15" cy="15" r="2.8" fill={color} />
          <Line x1="15" y1="3" x2="15" y2="7" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
          <Line x1="15" y1="23" x2="15" y2="27" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
          <Line x1="3" y1="15" x2="7" y2="15" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
          <Line x1="23" y1="15" x2="27" y2="15" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
        </>
      )}
      {tabKey === 'map' && (
        <>
          <Path
            d="M15 27 C15 27 6.5 18.9 6.5 11.8 C6.5 6.9 10.1 3.5 15 3.5 C19.9 3.5 23.5 6.9 23.5 11.8 C23.5 18.9 15 27 15 27 Z"
            stroke={color}
            strokeWidth={strokeWidth}
            fill="none"
            strokeLinejoin="round"
          />
          <Circle cx="15" cy="12" r="3.2" fill={isActive ? color : 'none'} stroke={color} strokeWidth={strokeWidth} />
        </>
      )}
      {tabKey === 'report' && (
        <>
          <Path
            d="M6 7.5 H24 C25.4 7.5 26.5 8.6 26.5 10 V19 C26.5 20.4 25.4 21.5 24 21.5 H14 L8.5 25 V21.5 H6 C4.6 21.5 3.5 20.4 3.5 19 V10 C3.5 8.6 4.6 7.5 6 7.5 Z"
            stroke={color}
            strokeWidth={strokeWidth}
            fill="none"
            strokeLinejoin="round"
          />
          <Circle cx="10.5" cy="14.5" r="1.4" fill={color} />
          <Circle cx="15" cy="14.5" r="1.4" fill={color} />
          <Circle cx="19.5" cy="14.5" r="1.4" fill={color} />
        </>
      )}
      {tabKey === 'compare' && (
        <>
          <Line x1="6" y1="24" x2="24" y2="24" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
          <Line x1="8" y1="14" x2="8" y2="24" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
          <Line x1="15" y1="7" x2="15" y2="24" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
          <Line x1="22" y1="11" x2="22" y2="24" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
          <Polyline points="7,11 13,8 18,12 24,6" stroke={color} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" opacity="0.7" />
        </>
      )}
    </Svg>
  );
}
