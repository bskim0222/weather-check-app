import { StatusBar } from 'expo-status-bar';
import { SafeAreaView, ScrollView, View } from 'react-native';

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

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <View style={styles.app}>
        <AppHeader
          locationStatus={appState.locationStatus}
          refreshLabel={appState.refreshLabel}
          screenTitle={appState.screenTitle}
          onRefresh={appState.refreshCurrentLocation}
        />
        <QuestionSearchBar
          isBusy={appState.isBusy}
          suggestions={appState.questionSuggestions}
          value={appState.questionText}
          onChangeText={appState.setQuestionText}
          onPickSuggestion={appState.runQuestion}
          onSubmit={appState.submitQuestion}
        />
        <DataStatusBanner status={appState.dataStatus} />
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {appState.activeTab === 'decision' && (
            <DecisionScreen
              current={appState.current}
              locationStatus={appState.locationStatus}
              reportCondition={appState.reportCondition}
              reportText={appState.reportText}
              reports={appState.reports}
              searchContext={appState.searchContext}
              weatherKey={appState.weatherKey}
              onReportConditionChange={appState.setReportCondition}
              onReportTextChange={appState.setReportText}
              onSubmitReport={appState.submitReport}
              onReportIssue={appState.reportFieldReport}
              onWeatherChange={appState.changeWeather}
            />
          )}
          {appState.activeTab === 'map' && (
            <MapScreen
              reports={appState.reports}
              searchContext={appState.searchContext}
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
        </ScrollView>

        <BottomTabs activeTab={appState.activeTab} onTabChange={appState.setActiveTab} />
      </View>
    </SafeAreaView>
  );
}
