import { useEffect, useState } from 'react';
import { Platform, SafeAreaView, ScrollView, StatusBar as NativeStatusBar, View } from 'react-native';

import { AppHeader } from './src/components/AppHeader';
import { AppLoadingScreen } from './src/components/AppLoadingScreen';
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
  const [reportAskFocusToken, setReportAskFocusToken] = useState(0);
  const [showBootLoading, setShowBootLoading] = useState(true);
  const androidTopInset =
    Platform.OS === 'android' ? Math.max(38, (NativeStatusBar.currentHeight ?? 24) + 14) : 0;
  const openReportAsk = () => {
    setReportAskFocusToken((token) => token + 1);
    appState.setActiveTab('report');
  };
  const isMapTab = appState.activeTab === 'map';

  useEffect(() => {
    if (appState.isInitialLoading) return;

    const timeoutId = setTimeout(() => {
      setShowBootLoading(false);
    }, 520);

    return () => clearTimeout(timeoutId);
  }, [appState.isInitialLoading]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <NativeStatusBar backgroundColor="#f4f5f2" barStyle="dark-content" translucent={false} />
      <View style={[styles.app, androidTopInset > 0 && { paddingTop: androidTopInset }]}>
        {isMapTab ? (
          <View style={styles.mapTabFrame}>
            <MapScreen
              current={appState.current}
              requests={appState.reportRequests}
              reports={appState.reports}
              searchContext={appState.searchContext}
              questionText={appState.questionText}
              onSearchLocation={appState.submitQuestion}
              onUseCurrentLocation={appState.refreshCurrentLocation}
              onReportIssue={appState.reportFieldReport}
            />
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={styles.scrollContent}
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
                  dataStatus={appState.dataStatus}
                  locationStatus={appState.locationStatus}
                  lastUpdatedAt={appState.lastUpdatedAt}
                  providerSnapshot={appState.providerSnapshot}
                  reportCondition={appState.reportCondition}
                  reportText={appState.reportText}
                  reports={appState.reports}
                  searchContext={appState.searchContext}
                  onReportConditionChange={appState.setReportCondition}
                  onReportTextChange={appState.setReportText}
                  onSubmitReport={appState.submitReport}
                  onReportIssue={appState.reportFieldReport}
                  onAskFieldQuestion={openReportAsk}
                />
              )}
              {appState.activeTab === 'report' && (
                <ReportScreen
                  requests={appState.reportRequests}
                  reports={appState.reports}
                  askFocusToken={reportAskFocusToken}
                  searchContext={appState.searchContext}
                  onAddReport={appState.addLocalReport}
                  onRemovePendingReport={appState.removePendingLocalReport}
                  onReportIssue={appState.reportFieldReport}
                  onRequestsChange={appState.setReportRequests}
                  onUpdateReport={appState.updateLocalReport}
                  onDeleteReport={appState.deleteLocalReport}
                  onUpdateRequest={appState.updateLocalRequest}
                  onDeleteRequest={appState.deleteLocalRequest}
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
        )}

        <BottomTabs activeTab={appState.activeTab} onTabChange={appState.setActiveTab} />
        {showBootLoading && <AppLoadingScreen />}
      </View>
    </SafeAreaView>
  );
}
