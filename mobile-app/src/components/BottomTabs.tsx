import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';
import type { ComponentProps } from 'react';

import { tabs } from '../data/mockWeather';
import { styles } from '../styles/appStyles';
import type { TabKey } from '../types/weather';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

const tabIcons: Record<TabKey, { active: IoniconName; inactive: IoniconName }> = {
  decision: { active: 'locate', inactive: 'locate-outline' },
  map: { active: 'location', inactive: 'location-outline' },
  report: { active: 'chatbubble-ellipses', inactive: 'chatbubble-ellipses-outline' },
  compare: { active: 'stats-chart', inactive: 'stats-chart-outline' },
};

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
  const icon = tabIcons[tabKey];

  return (
    <Ionicons
      name={isActive ? icon.active : icon.inactive}
      size={26}
      color={color}
      style={styles.tabIconVector}
    />
  );
}
