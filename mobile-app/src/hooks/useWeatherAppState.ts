import { useEffect, useMemo, useRef, useState } from 'react';

import { appConfig } from '../config/appConfig';
import { initialReports, reportRequests as initialReportRequests } from '../data/mockWeather';
import {
  createDefaultJudgement,
  createQuestionJudgement,
  restoreJudgement,
  updateJudgementLocation,
  updateJudgementWeather,
} from '../domain/judgement';
import {
  defaultQuestionSuggestions,
  resolveReportPlace,
} from '../domain/search';
import { createProviderAdjustedPreset } from '../domain/providerJudgement';
import { markReportPending } from '../domain/moderation';
import {
  readPersistedAppSnapshot,
  writePersistedAppSnapshot,
} from '../services/appPersistence';
import { createRemoteFieldReport, fetchFieldReportSnapshot, moderateRemoteFieldReport } from '../services/fieldReports';
import { resolveRemoteLocation } from '../services/geocoding';
import {
  createCheckingLocationStatus,
  createFallbackLocationStatus,
  initialLocationStatus,
  resolveCurrentLocation,
} from '../services/locationService';
import {
  fetchProviderSnapshot,
  getMockWeatherProviderSnapshot,
  type WeatherProviderSnapshot,
} from '../services/weatherProviders';
import type { DataStatus, LocationStatus, PersistedAppSnapshot } from '../types/appState';
import type { ForecastProviderId, LocalReport, ReportRequest, TabKey, WeatherKey } from '../types/weather';

const mockStatus: DataStatus = {
  phase: 'mock',
  label: '미리보기 데이터',
  message: '아직 실제 날씨 API 연결 전이라 샘플 예보와 현장 제보로 화면 흐름을 확인하고 있어요.',
};

const apiInitialStatus: DataStatus = {
  phase: 'loading',
  label: '날씨 확인 중',
  message: '실제 예보 데이터를 불러오고 있어요.',
};

export function useWeatherAppState() {
  const [activeTab, setActiveTab] = useState<TabKey>('decision');
  const [questionText, setQuestionText] = useState('');
  const [judgement, setJudgement] = useState(createDefaultJudgement);
  const [reportCondition, setReportCondition] = useState('비 안 와요');
  const [reportText, setReportText] = useState('');
  const [recentQuestions, setRecentQuestions] = useState<string[]>([]);
  const [refreshLabel, setRefreshLabel] = useState(appConfig.dataMode === 'api' ? '확인 중' : '미리보기 데이터');
  const [reports, setReports] = useState<LocalReport[]>(initialReports);
  const [reportRequests, setReportRequests] = useState<ReportRequest[]>(initialReportRequests);
  const [providerSnapshot, setProviderSnapshot] = useState<WeatherProviderSnapshot>(() =>
    getMockWeatherProviderSnapshot(createDefaultJudgement().searchContext),
  );
  const [dataStatus, setDataStatus] = useState<DataStatus>(
    appConfig.dataMode === 'api' ? apiInitialStatus : mockStatus,
  );
  const [locationStatus, setLocationStatus] = useState<LocationStatus>(initialLocationStatus);
  const [isPersistenceReady, setIsPersistenceReady] = useState(false);
  const refreshTokenRef = useRef(0);
  const locationAutoRefreshRequestedRef = useRef(false);

  const current = useMemo(
    () => createProviderAdjustedPreset(judgement.preset, providerSnapshot),
    [judgement.preset, providerSnapshot],
  );
  const searchContext = judgement.searchContext;
  const weatherKey = judgement.weatherKey;
  const isBusy = dataStatus.phase === 'loading';

  const questionSuggestions = useMemo(
    () => [...recentQuestions, ...defaultQuestionSuggestions.filter((item) => !recentQuestions.includes(item))].slice(0, 4),
    [recentQuestions],
  );

  const screenTitle = useMemo(() => {
    if (activeTab === 'decision') return '현재 위치 기준 판정';
    if (activeTab === 'map') return '주변 현장 지도';
    if (activeTab === 'report') return '현장 제보';

    return '예보 비교';
  }, [activeTab]);

  useEffect(() => {
    let isMounted = true;

    readPersistedAppSnapshot().then((snapshot) => {
      if (!isMounted) return;

      if (snapshot) {
        setActiveTab(snapshot.activeTab);
        setQuestionText(snapshot.questionText);
        setRecentQuestions(snapshot.recentQuestions);
        setReportText(snapshot.reportText);
        setReports(snapshot.reports.length > 0 ? snapshot.reports : initialReports);
        setReportRequests(snapshot.reportRequests.length > 0 ? snapshot.reportRequests : initialReportRequests);
        if (snapshot.locationStatus) {
          setLocationStatus(snapshot.locationStatus);
        }
        setJudgement(
          restoreJudgement(
            snapshot.judgement.weatherKey,
            snapshot.judgement.searchContext,
            snapshot.judgement.source,
            snapshot.judgement.createdAt,
          ),
        );
      }

      setIsPersistenceReady(true);
    });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!isPersistenceReady) return;

    if (locationAutoRefreshRequestedRef.current) return;
    if (locationStatus.phase === 'checking' || locationStatus.phase === 'granted') return;

    locationAutoRefreshRequestedRef.current = true;
    refreshLocationStatus();
  }, [isPersistenceReady, locationStatus.phase]);

  useEffect(() => {
    if (!isPersistenceReady) return;

    const snapshot: PersistedAppSnapshot = {
      version: 1,
      activeTab,
      questionText,
      recentQuestions,
      reportText,
      reports,
      reportRequests,
      locationStatus,
      judgement: {
        weatherKey,
        searchContext,
        source: judgement.source,
        createdAt: judgement.createdAt,
      },
    };

    writePersistedAppSnapshot(snapshot);
  }, [
    activeTab,
    isPersistenceReady,
    judgement.createdAt,
    judgement.source,
    questionText,
    recentQuestions,
    reportText,
    reportRequests,
    reports,
    searchContext,
    locationStatus,
    weatherKey,
  ]);

  const addLocalReport = (report: LocalReport) => {
    setReports((prev) => [
      report,
      ...prev.filter((item) => item.id !== report.id),
    ]);
  };

  const submitReport = () => {
    const clean = reportText.trim();
    if (!clean) return;

    const report: LocalReport = {
      id: createLocalId('report'),
      place: resolveReportPlace(searchContext.place),
      time: '방금',
      condition: reportCondition,
      body: clean,
      createdAt: new Date().toISOString(),
      moderationStatus: 'visible',
      source: 'local',
    };

    addLocalReport(report);
    createRemoteFieldReport(report).then((remoteReport) => {
      if (!remoteReport) return;

      setReports((prev) => replaceReportById(prev, report.id, remoteReport));
    });
    setReportText('');
  };

  const reportFieldReport = (report: LocalReport) => {
    const reportId = report.id;

    if (!reportId) {
      setReports((prev) =>
        prev.map((item) =>
          item.place === report.place && item.time === report.time && item.body === report.body
            ? { ...item, moderationStatus: 'pending' as const }
            : item,
        ),
      );
      return;
    }

    setReports((prev) => markReportPending(prev, reportId));
    moderateRemoteFieldReport(reportId, 'User reported this field weather post.');
  };

  const runQuestion = (question: string) => {
    const clean = question.trim();
    if (!clean) return;

    const nextJudgement = createQuestionJudgement(clean);
    setJudgement(nextJudgement);
    setQuestionText(clean);
    setRecentQuestions((prev) => [clean, ...prev.filter((item) => item !== clean)].slice(0, 3));
    setActiveTab('decision');
    refreshData('질문 기준', nextJudgement.searchContext);
    resolveQuestionLocation(nextJudgement);
  };

  const submitQuestion = () => {
    runQuestion(questionText);
  };

  const refreshLocationStatus = async () => {
    setLocationStatus(createCheckingLocationStatus());
    const nextLocationStatus = await resolveCurrentLocation();
    const resolvedLocationStatus =
      nextLocationStatus.phase === 'unavailable'
        ? createFallbackLocationStatus()
        : nextLocationStatus;

    setLocationStatus(resolvedLocationStatus);
    setJudgement((prev) => updateJudgementLocation(prev, resolvedLocationStatus));

    return resolvedLocationStatus;
  };

  const refreshCurrentLocation = async () => {
    const nextJudgement = createDefaultJudgement();
    setActiveTab('decision');
    setQuestionText('');
    setReportText('');
    setJudgement(nextJudgement);
    const resolvedLocationStatus = await refreshLocationStatus();
    const nextLocationJudgement = updateJudgementLocation(nextJudgement, resolvedLocationStatus);
    setJudgement(nextLocationJudgement);
    refreshData('현재 위치', nextLocationJudgement.searchContext);
  };

  const changeWeather = (nextWeather: WeatherKey) => {
    setJudgement((prev) => {
      const nextJudgement = updateJudgementWeather(prev, nextWeather);
      refreshData('날씨 수동 변경', nextJudgement.searchContext);

      return nextJudgement;
    });
  };

  const refreshData = async (label: string, nextSearchContext = searchContext) => {
    const token = refreshTokenRef.current + 1;
    refreshTokenRef.current = token;
    setRefreshLabel('확인 중');
    setDataStatus({
      phase: 'loading',
      label: '날씨 확인 중',
      message: `${nextSearchContext.place} · ${nextSearchContext.timeLabel} 기준 예보와 현장 글을 다시 맞춰보고 있어요.`,
    });

    try {
      const [providerSnapshot, fieldSnapshot] = await Promise.all([
        fetchProviderSnapshot(nextSearchContext),
        fetchFieldReportSnapshot(reports, nextSearchContext, reportRequests),
        waitForMinimumLoadingTime(),
      ] as const);

      if (refreshTokenRef.current !== token) return;

      setProviderSnapshot(providerSnapshot);

      if (fieldSnapshot.source === 'api') {
        setReports(fieldSnapshot.reports);
        setReportRequests(fieldSnapshot.requests);
      }

      const isFallback =
        appConfig.dataMode === 'api' &&
        providerSnapshot.source === 'mock';

      if (isFallback) {
        setRefreshLabel('목업 대체');
        setDataStatus({
          phase: 'fallback',
          label: 'API 연결 대기',
          message: createFallbackStatusMessage(providerSnapshot.meta.fallbackProviderIds),
        });
        return;
      }

      if (appConfig.dataMode !== 'api' && (providerSnapshot.source === 'mock' || fieldSnapshot.source === 'mock')) {
        setRefreshLabel(label);
        setDataStatus(mockStatus);
        return;
      }

      setRefreshLabel('방금 갱신');
      setDataStatus({
        phase: 'ready',
        label: '최신 데이터',
        message: createReadyStatusMessage(providerSnapshot.meta.liveProviderIds),
      });
    } catch {
      if (refreshTokenRef.current !== token) return;

      setRefreshLabel('연결 실패');
      setDataStatus({
        phase: 'error',
        label: '연결 실패',
        message: '데이터를 불러오지 못했어요. 마지막으로 확인한 화면을 유지하고 다시 시도할 수 있어요.',
      });
    }
  };

  const resolveQuestionLocation = async (nextJudgement: ReturnType<typeof createQuestionJudgement>) => {
    const resolvedLocation = await resolveRemoteLocation(nextJudgement.searchContext);

    if (!resolvedLocation) return;

    const resolvedSearchContext = {
      ...nextJudgement.searchContext,
      place: resolvedLocation.label,
      target: resolvedLocation,
      locationQuery: resolvedLocation.label,
      interpretationNote: `${resolvedLocation.label}의 ${nextJudgement.searchContext.timeLabel} 날씨를 ${nextJudgement.searchContext.detectedWeather} 기준으로 봤어요.`,
      needsClarification: !hasWeatherIntent(nextJudgement.searchContext),
    };
    const resolvedJudgement = restoreJudgement(
      nextJudgement.weatherKey,
      resolvedSearchContext,
      nextJudgement.source,
      nextJudgement.createdAt,
    );

    setJudgement((currentJudgement) =>
      currentJudgement.createdAt === nextJudgement.createdAt ? resolvedJudgement : currentJudgement,
    );
    refreshData('장소 확인', resolvedSearchContext);
  };

  return {
    activeTab,
    changeWeather,
    current,
    isBusy,
    dataStatus,
    locationStatus,
    questionSuggestions,
    questionText,
    providerSnapshot,
    refreshCurrentLocation,
    refreshLabel,
    reportRequests,
    reportCondition,
    reportText,
    reports,
    runQuestion,
    screenTitle,
    searchContext,
    setActiveTab,
    setQuestionText,
    setReportRequests,
    setReportCondition,
    setReportText,
    submitQuestion,
    submitReport,
    reportFieldReport,
    weatherKey,
    addLocalReport,
  };
}

function hasWeatherIntent(searchContext: ReturnType<typeof createQuestionJudgement>['searchContext']) {
  return Boolean(searchContext.detectedWeather);
}

function createReadyStatusMessage(providerIds: ForecastProviderId[]) {
  const names = providerIds.map(getProviderDisplayName).filter(Boolean);

  if (names.length === 0) {
    return '예보와 현장 글을 최신 기준으로 확인했어요.';
  }

  return `${names.join(', ')} 예보와 현장 글을 최신 기준으로 확인했어요.`;
}

function createFallbackStatusMessage(providerIds: ForecastProviderId[]) {
  const names = providerIds.map(getProviderDisplayName).filter(Boolean);

  if (names.length === 0) {
    return '실제 데이터 연결이 준비되지 않아 현재는 목업 예보와 현장 글로 대신 보여주고 있어요.';
  }

  return `${names.join(', ')} 데이터가 준비되지 않아 해당 예보는 샘플 값으로 대신 보여주고 있어요.`;
}

function getProviderDisplayName(providerId: ForecastProviderId) {
  if (providerId === 'kma') return '대한민국 기상청';
  if (providerId === 'yr') return '노르웨이 기상청';
  if (providerId === 'fmi') return '핀란드 기상청';
  if (providerId === 'windy') return 'Windy.com';

  return '';
}

function waitForMinimumLoadingTime() {
  return new Promise((resolve) => {
    setTimeout(resolve, 800);
  });
}

function createLocalId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function replaceReportById(reports: LocalReport[], reportId: string | undefined, replacement: LocalReport) {
  if (!reportId) return reports;

  return reports.map((report) => (report.id === reportId ? replacement : report));
}
