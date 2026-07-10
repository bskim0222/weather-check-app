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
  isExplicitCurrentLocationQuery,
  resolveReportPlace,
} from '../domain/search';
import { createProviderAdjustedPreset } from '../domain/providerJudgement';
import { markReportPending } from '../domain/moderation';
import {
  readPersistedAppSnapshot,
  writePersistedAppSnapshot,
} from '../services/appPersistence';
import {
  createRemoteFieldReport,
  deleteRemoteFieldReport,
  deleteRemoteReportRequest,
  fetchFieldReportSnapshot,
  moderateRemoteFieldReport,
  updateRemoteFieldReport,
  updateRemoteReportRequest,
} from '../services/fieldReports';
import { resolveRemoteLocation } from '../services/geocoding';
import {
  createCheckingLocationStatus,
  initialLocationStatus,
  resolveCurrentLocation,
} from '../services/locationService';
import {
  fetchProviderSnapshot,
  getMockWeatherProviderSnapshot,
  type WeatherProviderSnapshot,
} from '../services/weatherProviders';
import type { DataStatus, LocationStatus, PersistedAppSnapshot } from '../types/appState';
import type { ForecastProviderId, LocalReport, LocationReference, ReportRequest, SearchContext, TabKey, WeatherKey } from '../types/weather';

const mockStatus: DataStatus = {
  phase: 'mock',
  label: '미리보기 데이터',
  message: '아직 실제 날씨 API 연결 전이라 샘플 예보와 현장 제보로 화면 흐름을 확인하고 있어요.',
};

const apiInitialStatus: DataStatus = {
  phase: 'ready',
  label: '데이터 준비 중',
  message: '화면을 먼저 보여주고 실제 예보 데이터를 갱신하고 있어요.',
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
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  const [isPersistenceReady, setIsPersistenceReady] = useState(false);
  const refreshTokenRef = useRef(0);
  const locationAutoRefreshRequestedRef = useRef(false);

  const current = useMemo(
    () => {
      const snapshotForCurrentContext = isSameWeatherContext(providerSnapshot.context, judgement.searchContext)
        ? providerSnapshot
        : getMockWeatherProviderSnapshot(judgement.searchContext);

      return createProviderAdjustedPreset(judgement.preset, snapshotForCurrentContext);
    },
    [judgement.preset, judgement.searchContext, providerSnapshot],
  );
  const searchContext = judgement.searchContext;
  const weatherKey = judgement.weatherKey;
  const isBusy = dataStatus.phase === 'loading';

  const questionSuggestions = useMemo(
    () => [...recentQuestions, ...defaultQuestionSuggestions.filter((item) => !recentQuestions.includes(item))].slice(0, 4),
    [recentQuestions],
  );

  const screenTitle = useMemo(() => {
    if (activeTab === 'decision') return '요약';
    if (activeTab === 'map') return '주변 현장 지도';
    if (activeTab === 'report') return '현장 제보';

    return '예보 비교';
  }, [activeTab]);

  useEffect(() => {
    if (!isPersistenceReady || appConfig.dataMode !== 'api') return;

    let isCancelled = false;

    const syncFieldReports = async () => {
      const fieldSnapshot = await fetchFieldReportSnapshot([], searchContext, []);

      if (isCancelled || fieldSnapshot.source !== 'api') return;

      setReports((prev) => mergeSyncedItems(fieldSnapshot.reports, prev));
      setReportRequests((prev) => mergeSyncedItems(fieldSnapshot.requests, prev));
    };

    syncFieldReports();
    const syncIntervalMs = activeTab === 'report' || activeTab === 'map' ? 15000 : 30000;
    const intervalId = setInterval(syncFieldReports, syncIntervalMs);

    return () => {
      isCancelled = true;
      clearInterval(intervalId);
    };
  }, [
    activeTab,
    isPersistenceReady,
    searchContext.detectedWeather,
    searchContext.place,
    searchContext.target.latitude,
    searchContext.target.longitude,
    searchContext.timeLabel,
  ]);

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
    if (locationStatus.phase === 'checking') return;

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

  const updateLocalReport = (reportId: string, updates: Partial<Pick<LocalReport, 'body' | 'condition'>>) => {
    setReports((prev) =>
      prev.map((report) =>
        report.id === reportId
          ? {
              ...report,
              ...updates,
              source: report.source ?? 'local',
            }
          : report,
      ),
    );

    updateRemoteFieldReport(reportId, updates).then((remoteReport) => {
      if (!remoteReport) return;

      setReports((prev) => replaceReportById(prev, reportId, { ...remoteReport, source: 'local' }));
    });
  };

  const deleteLocalReport = (reportId: string) => {
    setReports((prev) => prev.filter((report) => report.id !== reportId));
    deleteRemoteFieldReport(reportId);
  };

  const updateLocalRequest = (requestId: string, updates: Partial<Pick<ReportRequest, 'question'>>) => {
    setReportRequests((prev) =>
      prev.map((request) =>
        request.id === requestId
          ? {
              ...request,
              ...updates,
              source: request.source ?? 'local',
            }
          : request,
      ),
    );

    updateRemoteReportRequest(requestId, updates).then((remoteRequest) => {
      if (!remoteRequest) return;

      setReportRequests((prev) => replaceRequestById(prev, requestId, { ...remoteRequest, source: 'local' }));
    });
  };

  const deleteLocalRequest = (requestId: string) => {
    setReportRequests((prev) => prev.filter((request) => request.id !== requestId));
    setReports((prev) => prev.filter((report) => report.requestId !== requestId));
    deleteRemoteReportRequest(requestId);
  };

  const submitReport = () => {
    const clean = reportText.trim();
    if (!clean) return;

    const report: LocalReport = {
      id: createLocalId('report'),
      place: resolveReportPlace(getCurrentReportPlace(locationStatus, searchContext.place)),
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

      setReports((prev) => replaceReportById(prev, report.id, { ...remoteReport, source: 'local' }));
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

  const runQuestion = (question: string, resolvedLocation?: LocationReference) => {
    const clean = question.trim();
    if (!clean) return;

    const nextJudgement = resolvedLocation
      ? applyResolvedLocationToJudgement(createQuestionJudgement(clean), resolvedLocation)
      : createQuestionJudgement(clean);
    if (nextJudgement.searchContext.target.kind === 'pending-place' && !nextJudgement.searchContext.locationQuery) {
      if (activeTab !== 'map') {
        setActiveTab('decision');
      }
      setRefreshLabel('장소 필요');
      setDataStatus({
        phase: 'error',
        label: '장소를 입력해주세요',
        message: isExplicitCurrentLocationQuery(clean)
          ? '현재 위치를 보려면 오른쪽 위 새로고침 버튼을 눌러주세요.'
          : '지금은 장소 중심으로 검색해요. 예: 광화문, 설악산, 부산 해운대처럼 장소명을 먼저 입력해주세요.',
      });
      return;
    }

    setJudgement(nextJudgement);
    setQuestionText(clean);
    setRecentQuestions((prev) => [clean, ...prev.filter((item) => item !== clean)].slice(0, 3));
    if (activeTab !== 'map') {
      setActiveTab('decision');
    }
    if (nextJudgement.searchContext.target.kind === 'pending-place') {
      setRefreshLabel('장소 확인 중');
      setDataStatus({
        phase: 'loading',
        label: '장소 확인 중',
        message: `${nextJudgement.searchContext.place} 위치를 찾고 있어요. 확인되면 그 장소 기준으로 날씨를 판정할게요.`,
      });
      resolveQuestionLocation(nextJudgement);
      return;
    }

    refreshData('질문 기준', nextJudgement.searchContext);
    resolveQuestionLocation(nextJudgement);
  };

  const submitQuestion = (query?: string, resolvedLocation?: LocationReference) => {
    runQuestion(query ?? questionText, resolvedLocation);
  };

  const refreshLocationStatus = async () => {
    setLocationStatus(createCheckingLocationStatus());
    const nextLocationStatus = await resolveCurrentLocation();
    const resolvedLocationStatus = nextLocationStatus;

    setLocationStatus(resolvedLocationStatus);
    setJudgement((prev) => updateJudgementLocation(prev, resolvedLocationStatus));
    if (resolvedLocationStatus.phase === 'denied' || resolvedLocationStatus.phase === 'unavailable') {
      setRefreshLabel('위치 확인 필요');
      setDataStatus({
        phase: 'fallback',
        label: resolvedLocationStatus.label,
        message: resolvedLocationStatus.message,
      });
    }

    return resolvedLocationStatus;
  };

  const refreshCurrentLocation = async () => {
    const nextJudgement = createDefaultJudgement();
    setQuestionText('');
    setReportText('');
    setJudgement(nextJudgement);
    const resolvedLocationStatus = await refreshLocationStatus();
    const nextLocationJudgement = updateJudgementLocation(nextJudgement, resolvedLocationStatus);
    setJudgement(nextLocationJudgement);
    if (!hasUsableCoordinates(resolvedLocationStatus)) return;

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
      label: '날씨 신호 확인 중',
      message: `${nextSearchContext.place} · ${nextSearchContext.timeLabel} 기준 세 기상청 예보를 불러오고 있어요.`,
    });

    try {
      const [providerSnapshot, fieldSnapshot] = await Promise.all([
        fetchProviderSnapshot(nextSearchContext),
        fetchFieldReportSnapshot(reports, nextSearchContext, reportRequests),
      ] as const);

      if (refreshTokenRef.current !== token) return;

      setProviderSnapshot(providerSnapshot);

      if (fieldSnapshot.source === 'api') {
        setReports((prev) => mergeSyncedItems(fieldSnapshot.reports, prev));
        setReportRequests((prev) => mergeSyncedItems(fieldSnapshot.requests, prev));
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
        setLastUpdatedAt(new Date());
        setDataStatus(mockStatus);
        return;
      }

      setRefreshLabel('방금 갱신');
      setLastUpdatedAt(new Date());
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
        message: '데이터를 불러오지 못했어요. 마지막으로 확인한 화면은 유지하고 다시 시도할 수 있어요.',
      });
    }
  };

  const resolveQuestionLocation = async (nextJudgement: ReturnType<typeof createQuestionJudgement>) => {
    const resolvedLocation = await resolveRemoteLocation(nextJudgement.searchContext);

    if (!resolvedLocation) {
      if (nextJudgement.searchContext.target.kind !== 'pending-place') return;

      setRefreshLabel('장소 확인 실패');
      setDataStatus({
        phase: 'error',
        label: '장소를 못 찾았어요',
        message: `${nextJudgement.searchContext.locationQuery ?? nextJudgement.searchContext.place} 위치를 찾지 못했어요. 현재 위치로 바꾸지 않았으니 장소명을 조금 더 구체적으로 다시 입력해주세요.`,
      });
      return;
    }

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
    lastUpdatedAt,
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
    updateLocalReport,
    deleteLocalReport,
    updateLocalRequest,
    deleteLocalRequest,
  };
}

function applyResolvedLocationToJudgement(
  judgement: ReturnType<typeof createQuestionJudgement>,
  resolvedLocation: LocationReference,
) {
  const resolvedSearchContext: SearchContext = {
    ...judgement.searchContext,
    place: resolvedLocation.label,
    target: resolvedLocation,
    locationQuery: resolvedLocation.label,
    interpretationNote: `${resolvedLocation.label}의 ${judgement.searchContext.timeLabel} 날씨를 ${judgement.searchContext.detectedWeather} 기준으로 봤어요.`,
    needsClarification: !hasWeatherIntent(judgement.searchContext),
  };

  return restoreJudgement(
    judgement.weatherKey,
    resolvedSearchContext,
    judgement.source,
    judgement.createdAt,
  );
}

function hasWeatherIntent(searchContext: SearchContext) {
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
    return '실제 데이터 연결이 준비되지 않아 현재는 목업 예보와 현장 글로 대체 보여주고 있어요.';
  }

  return `${names.join(', ')} 데이터가 준비되지 않아 해당 예보는 샘플 값으로 대체 보여주고 있어요.`;
}

function getProviderDisplayName(providerId: ForecastProviderId) {
  if (providerId === 'kma') return '대한민국 기상청';
  if (providerId === 'yr') return '노르웨이 기상청';
  if (providerId === 'fmi') return '핀란드 기상청';
  if (providerId === 'windy') return '핀란드 기상청';

  return '';
}

function isSameWeatherContext(a: SearchContext, b: SearchContext) {
  return (
    a.place === b.place &&
    a.timeLabel === b.timeLabel &&
    a.detectedWeather === b.detectedWeather &&
    a.target.kind === b.target.kind &&
    a.target.latitude === b.target.latitude &&
    a.target.longitude === b.target.longitude
  );
}

function hasUsableCoordinates(locationStatus: LocationStatus) {
  return typeof locationStatus.latitude === 'number' && typeof locationStatus.longitude === 'number';
}

function replaceReportById(reports: LocalReport[], localId: string | undefined, nextReport: LocalReport) {
  if (!localId) return [nextReport, ...reports];

  return reports.map((report) => (report.id === localId ? nextReport : report));
}

function replaceRequestById(
  requests: ReportRequest[],
  requestId: string | undefined,
  nextRequest: ReportRequest,
) {
  if (!requestId) return [nextRequest, ...requests];

  return requests.map((request) => (request.id === requestId ? nextRequest : request));
}

function mergeSyncedItems<T extends { id?: string; source?: string }>(remoteItems: T[], localItems: T[]) {
  const localById = new Map(
    localItems
      .filter((item) => item.id)
      .map((item) => [item.id, item]),
  );
  const mergedRemoteItems = remoteItems.map((remoteItem) => {
    const localItem = remoteItem.id ? localById.get(remoteItem.id) : undefined;

    return localItem ? mergeSyncedItem(remoteItem, localItem) : remoteItem;
  });
  const remoteIds = new Set(remoteItems.map((item) => item.id).filter(Boolean));
  const pendingLocalItems = localItems.filter(
    (item) => item.source === 'local' && item.id && !remoteIds.has(item.id),
  );

  return [...pendingLocalItems, ...mergedRemoteItems];
}

function mergeSyncedItem<T extends { source?: string }>(remoteItem: T, localItem: T) {
  const nextItem = { ...remoteItem } as T & {
    answers?: number;
    status?: string;
    hint?: string;
    lastAnsweredAt?: string;
  };
  const localAnswerCount = getAnswerCount(localItem);
  const remoteAnswerCount = getAnswerCount(remoteItem);

  if (localItem.source === 'local') {
    nextItem.source = 'local' as T['source'];
  }

  if (localAnswerCount > remoteAnswerCount) {
    nextItem.answers = localAnswerCount;
    const localRequest = localItem as {
      status?: string;
      hint?: string;
      lastAnsweredAt?: string;
    };

    if (localRequest.status) nextItem.status = localRequest.status;
    if (localRequest.hint) nextItem.hint = localRequest.hint;
    if (localRequest.lastAnsweredAt) nextItem.lastAnsweredAt = localRequest.lastAnsweredAt;
  }

  return nextItem;
}

function getAnswerCount(item: unknown) {
  const answers = (item as { answers?: unknown }).answers;

  return typeof answers === 'number' && Number.isFinite(answers) ? answers : 0;
}

function getCurrentReportPlace(locationStatus: LocationStatus, fallbackPlace: string) {
  if (locationStatus.phase === 'granted' || locationStatus.phase === 'fallback') {
    return locationStatus.placeName ?? locationStatus.label ?? fallbackPlace;
  }

  return fallbackPlace;
}

function createLocalId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
