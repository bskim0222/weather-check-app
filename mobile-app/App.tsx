import { Platform, SafeAreaView, ScrollView, StatusBar as NativeStatusBar, View } from 'react-native';

import { AppHeader } from './src/components/AppHeader';
import { BottomTabs } from './src/components/BottomTabs';
import { DataStatusBanner } from './src/components/DataStatusBanner';
import { QuestionSearchBar } from './src/components/QuestionSearchBar';
import { useWeatherAppState } from './src/hooks/useWeatherAppState';
import { CompareScreen } from './src/screens/CompareScreen';
import { DecisionScreen } from './src/screens/DecisionScreen';
import { MapScreen } from './src/screens/MapScreen';
import { ReportScreen } from './src/screens/ReportScreen';
import { styles } from './src/styles/appStyles';

export default function App() {
  const appState = useWeatherAppState();
  const androidTopInset =
    Platform.OS === 'android' ? Math.max(38, (NativeStatusBar.currentHeight ?? 24) + 14) : 0;

  return (
    <SafeAreaView style={styles.safeArea}>
      <NativeStatusBar backgroundColor="#f4f5f2" barStyle="dark-content" translucent={false} />
      <View style={[styles.app, androidTopInset > 0 && { paddingTop: androidTopInset }]}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          disableScrollViewPanResponder={appState.activeTab === 'map'}
          showsVerticalScrollIndicator={false}
        >
          <AppHeader
            locationStatus={appState.locationStatus}
            refreshLabel={appState.refreshLabel}
            onRefresh={appState.refreshCurrentLocation}
          />
          <QuestionSearchBar
            isBusy={appState.isBusy}
            value={appState.questionText}
            onChangeText={appState.setQuestionText}
            onSubmit={appState.submitQuestion}
          />
          <DataStatusBanner status={appState.dataStatus} />
          <View style={styles.content}>
            {appState.activeTab === 'decision' && (
              <DecisionScreen
                current={appState.current}
                locationStatus={appState.locationStatus}
                reportCondition={appState.reportCondition}
                reportText={appState.reportText}
                reports={appState.reports}
                searchContext={appState.searchContext}
                onReportConditionChange={appState.setReportCondition}
                onReportTextChange={appState.setReportText}
                onSubmitReport={appState.submitReport}
                onReportIssue={appState.reportFieldReport}
              />
            )}
            {appState.activeTab === 'map' && (
              <MapScreen
                current={appState.current}
                reports={appState.reports}
                searchContext={appState.searchContext}
                onUseCurrentLocation={appState.refreshCurrentLocation}
                onReportIssue={appState.reportFieldReport}
              />
            )}
            {appState.activeTab === 'report' && (
              <ReportScreen
                requests={appState.reportRequests}
                reports={appState.reports}
                searchContext={appState.searchContext}
                onAddReport={appState.addLocalReport}
                onReportIssue={appState.reportFieldReport}
                onRequestsChange={appState.setReportRequests}
              />
            )}
            {appState.activeTab === 'compare' && (
              <CompareScreen
                providerSnapshot={appState.providerSnapshot}
                searchContext={appState.searchContext}
              />
            )}
          </View>
        </ScrollView>

        <BottomTabs activeTab={appState.activeTab} onTabChange={appState.setActiveTab} />
      </View>
    </SafeAreaView>
  );
}
