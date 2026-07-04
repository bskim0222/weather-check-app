import { useEffect, useMemo, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { EmptyState } from '../components/EmptyState';
import { inferConditionFromText } from '../domain/reports';
import {
  answerRemoteReportRequest,
  createRemoteFieldReport,
  createRemoteReportRequest,
  getMockFieldReportSnapshot,
} from '../services/fieldReports';
import { styles } from '../styles/appStyles';
import type { LocalReport, ReportRequest, SearchContext } from '../types/weather';

type ReportScreenProps = {
  reports: LocalReport[];
  requests: ReportRequest[];
  searchContext: SearchContext;
  onAddReport: (report: LocalReport) => void;
  onReportIssue: (report: LocalReport) => void;
  onRequestsChange: (requests: ReportRequest[] | ((prev: ReportRequest[]) => ReportRequest[])) => void;
};

export function ReportScreen({
  reports,
  requests,
  searchContext,
  onAddReport,
  onReportIssue,
  onRequestsChange,
}: ReportScreenProps) {
  const [requestDraft, setRequestDraft] = useState('');
  const [replyDraft, setReplyDraft] = useState('');
  const [feedMode, setFeedMode] = useState<'nearby' | 'national'>('nearby');
  const [selectedRequestId, setSelectedRequestId] = useState(requests[0]?.id ?? '');
  const [replyNotice, setReplyNotice] = useState('');

  const fieldSnapshot = useMemo(
    () => getMockFieldReportSnapshot(reports, searchContext, requests),
    [reports, requests, searchContext],
  );
  const orderedReports = fieldSnapshot.reports;
  const orderedRequests = fieldSnapshot.requests;
  const visibleReports = feedMode === 'national' ? createNationalReports(orderedReports) : orderedReports;
  const visibleRequests = orderedRequests;
  const selectedRequest = useMemo(
    () => visibleRequests.find((request) => request.id === selectedRequestId),
    [visibleRequests, selectedRequestId],
  );

  useEffect(() => {
    if (visibleRequests.length === 0) {
      setSelectedRequestId('');
      return;
    }

    const selectedRequestExists = visibleRequests.some((request) => request.id === selectedRequestId);
    if (!selectedRequestExists) {
      setSelectedRequestId(visibleRequests[0].id);
    }
  }, [visibleRequests, searchContext.detectedWeather, searchContext.place, searchContext.timeLabel, selectedRequestId]);

  const addRequest = () => {
    const clean = requestDraft.trim();
    if (!clean) return;

    const newRequest: ReportRequest = {
      id: `request-${Date.now()}`,
      question: clean,
      hint: '현재 상황 확인 요청',
      place: resolveRequestPlace(clean, searchContext.place),
      distance: '질문 지역',
      answers: 0,
      time: '방금',
      status: '답변 대기',
      mark: getRequestMark(clean),
      accent: '#f4f5f2',
      createdAt: new Date().toISOString(),
      source: 'local',
    };

    onRequestsChange((prev) => [newRequest, ...prev]);
    createRemoteReportRequest(newRequest).then((remoteRequest) => {
      if (!remoteRequest) return;

      onRequestsChange((prev) => replaceRequestById(prev, newRequest.id, remoteRequest));
      setSelectedRequestId(remoteRequest.id);
    });
    setSelectedRequestId(newRequest.id);
    setRequestDraft('');
    setReplyNotice('');
  };

  const submitReply = () => {
    const clean = replyDraft.trim();
    if (!clean || !selectedRequest) return;

    onRequestsChange((prev) =>
      prev.map((request) =>
        request.id === selectedRequest.id
          ? { ...request, answers: request.answers + 1, status: '답변 있음', hint: '방금 답변됨' }
        : request,
      ),
    );
    const replyReport: LocalReport = {
      id: `reply-${selectedRequest.id}-${Date.now()}`,
      place: selectedRequest.place,
      time: '방금',
      condition: inferConditionFromText(clean),
      body: clean,
      createdAt: new Date().toISOString(),
      moderationStatus: 'visible',
      source: 'local',
    };

    onAddReport(replyReport);
    answerRemoteReportRequest(selectedRequest.id, '답변 있음', '방금 답변됨').then((remoteRequest) => {
      if (!remoteRequest) return;

      onRequestsChange((prev) => replaceRequestById(prev, selectedRequest.id, remoteRequest));
    });
    createRemoteFieldReport(replyReport).then((remoteReport) => {
      if (!remoteReport) return;

      onAddReport(remoteReport);
    });
    setReplyDraft('');
    setReplyNotice(`${selectedRequest.place} 요청에 현장 답변을 연결했어요.`);
  };

  return (
    <View>
      <View style={styles.requestCard}>
        <Text style={styles.requestKicker}>현장 제보</Text>
        <Text style={styles.requestTitle}>
          궁금한 지역의 현재 상황을 물어보세요.
        </Text>
        <View style={styles.requestForm}>
          <TextInput
            value={requestDraft}
            onChangeText={setRequestDraft}
            placeholder="예: 청와대 지금 날씨 어떤가요?"
            placeholderTextColor="#8f7f87"
            style={styles.requestInput}
          />
          <Pressable onPress={addRequest} style={styles.requestSubmitButton}>
            <Text style={styles.requestSubmitText}>요청</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.reportSectionHeader}>
        <Text style={styles.reportSectionTitle}>답변 기다리는 요청</Text>
        <Text style={styles.reportSectionAction}>내 주변</Text>
      </View>

      {visibleRequests.length > 0 ? (
        <View style={styles.requestList}>
          {visibleRequests.map((request) => {
            const isSelected = selectedRequestId === request.id;
            return (
              <Pressable
                key={request.id}
                onPress={() => {
                  setSelectedRequestId(request.id);
                  setReplyNotice('');
                }}
                style={[styles.requestListItem, isSelected && styles.requestListItemActive]}
              >
                <View style={[styles.requestMark, { backgroundColor: isSelected ? '#242424' : '#f4f5f2' }]}>
                  <Text style={[styles.requestMarkText, isSelected && styles.requestMarkTextActive]}>
                    {request.mark}
                  </Text>
                </View>
                <View style={styles.requestListContent}>
                  <Text style={[styles.requestQuestion, isSelected && styles.requestQuestionActive]}>
                    {request.question}
                  </Text>
                  <Text style={[styles.requestHint, isSelected && styles.requestHintActive]}>
                    {request.distance} · 현장 답변 {request.answers}개 · {request.time}
                  </Text>
                </View>
                <Text style={[styles.requestStatus, isSelected && styles.requestStatusActive]}>
                  {request.status}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : (
        <EmptyState
          title="답변 기다리는 요청이 없어요"
          body={`${searchContext.place} 주변에 새 질문을 올리면 이곳에 요청 카드가 생깁니다.`}
          action="위 입력창에서 제보 요청을 만들어보세요."
        />
      )}

      {selectedRequest ? (
        <View style={styles.replyBox}>
          <Text style={styles.replyEyebrow}>{selectedRequest.place} 요청에 현장 답변하기</Text>
          <Text style={styles.replyQuestion}>{selectedRequest.question}</Text>
          <TextInput
            multiline
            value={replyDraft}
            onChangeText={setReplyDraft}
            placeholder="예: 3루 출입구 쪽은 아직 비 안 와요. 바닥도 말라있어요."
            placeholderTextColor="#8f7f87"
            style={styles.replyInput}
          />
          <Pressable onPress={submitReply} style={styles.replySubmitButton}>
            <Text style={styles.replySubmitText}>선택한 요청에 답변</Text>
          </Pressable>
          {!!replyNotice && <Text style={styles.replyNotice}>{replyNotice}</Text>}
        </View>
      ) : (
        <EmptyState
          title="선택한 요청이 없어요"
          body="답변할 요청을 선택하면 바로 아래에 현장 답변 입력창이 열립니다."
        />
      )}

      <View style={styles.reportSectionHeader}>
        <Text style={styles.reportSectionTitle}>현장 답변 모아보기</Text>
        <Text style={styles.reportSectionAction}>{feedMode === 'national' ? '전국' : '근처'}</Text>
      </View>
      <View style={styles.reportFeedMode}>
        <Pressable
          onPress={() => setFeedMode('nearby')}
          style={[styles.reportFeedModeButton, feedMode === 'nearby' && styles.reportFeedModeButtonActive]}
        >
          <Text style={[styles.reportFeedModeText, feedMode === 'nearby' && styles.reportFeedModeTextActive]}>
            근처
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setFeedMode('national')}
          style={[styles.reportFeedModeButton, feedMode === 'national' && styles.reportFeedModeButtonActive]}
        >
          <Text style={[styles.reportFeedModeText, feedMode === 'national' && styles.reportFeedModeTextActive]}>
            전국
          </Text>
        </Pressable>
      </View>

      {visibleReports.length > 0 ? (
        <View style={styles.liveReportList}>
          {visibleReports.map((report, index) => {
            const tone = getReportTone(report.condition);

            return (
            <View key={`${report.place}-${report.body}-${index}`} style={styles.liveReportItem}>
              <View style={[styles.liveReportMark, { backgroundColor: tone.bg }]}>
                <Text style={[styles.liveReportMarkText, { color: tone.ink }]}>
                  {getConditionMark(report.condition)}
                </Text>
              </View>
              <View style={styles.liveReportMain}>
                <View style={styles.liveReportTopRow}>
                  <Text numberOfLines={1} style={styles.liveReportPlace}>{report.place}</Text>
                  <Text style={styles.liveReportTime}>{report.time}</Text>
                </View>
                <Text style={styles.liveReportBody}>{report.body}</Text>
                <View style={styles.liveReportBottomRow}>
                  <Text style={[styles.liveReportCondition, { backgroundColor: tone.pill, color: tone.ink }]}>
                    {report.condition}
                  </Text>
                  <Text style={styles.liveReportSource}>
                    {report.source === 'local' ? '내 제보' : '현장 글'}
                  </Text>
                </View>
              </View>
              <View style={styles.liveReportAction}>
                <Pressable
                  disabled={report.moderationStatus === 'pending'}
                  onPress={() => onReportIssue(report)}
                  style={[
                    styles.reportIssueButton,
                    report.moderationStatus === 'pending' && styles.reportIssueButtonPending,
                  ]}
                >
                  <Text style={styles.reportIssueText}>
                    {report.moderationStatus === 'pending' ? '검토중' : '신고'}
                  </Text>
                </Pressable>
              </View>
            </View>
            );
          })}
        </View>
      ) : (
        <EmptyState
          title="방금 올라온 현장 글이 없어요"
          body="사용자 답변이나 한 줄 제보가 등록되면 이곳에 시간순으로 쌓입니다."
          action="첫 글이 올라오면 지도 탭에도 함께 표시됩니다."
        />
      )}
    </View>
  );
}

function replaceRequestById(
  requests: ReportRequest[],
  requestId: string,
  replacement: ReportRequest,
) {
  return requests.map((request) => (request.id === requestId ? replacement : request));
}

function getConditionMark(condition: string) {
  if (condition.includes('맑')) return '맑';
  if (condition.includes('비')) return '비';
  if (condition.includes('눈')) return '눈';
  if (condition.includes('안개')) return '안';
  if (condition.includes('천둥') || condition.includes('번개')) return '번';
  if (condition.includes('흐') || condition.includes('구름')) return '흐';

  return condition.slice(0, 1) || '현';
}

function getReportTone(condition: string) {
  if (condition.includes('맑')) return { bg: '#fff05a', pill: 'rgba(255,240,90,0.34)', ink: '#242424' };
  if (condition.includes('비')) return { bg: '#74c9ee', pill: 'rgba(116,201,238,0.28)', ink: '#0a4660' };
  if (condition.includes('눈')) return { bg: '#d7eef8', pill: 'rgba(215,238,248,0.54)', ink: '#24526a' };
  if (condition.includes('안개')) return { bg: '#d6d2c4', pill: 'rgba(214,210,196,0.54)', ink: '#4f514c' };
  if (condition.includes('천둥') || condition.includes('번개')) return { bg: '#242424', pill: 'rgba(36,36,36,0.10)', ink: '#242424' };

  return { bg: '#c7d6c5', pill: 'rgba(199,214,197,0.42)', ink: '#2f4635' };
}

function resolveRequestPlace(question: string, fallbackPlace: string) {
  const normalized = question.replace(/[?!,。]/g, ' ').replace(/\s+/g, ' ').trim();
  const beforeWeather = normalized.match(
    /(.+?)(?:오늘|내일|모레|주말|아침|오전|오후|저녁|밤|새벽|\d{1,2}\s*시|지금)?\s*(?:날씨|비|눈|안개|기온|우산|소나기|천둥|번개|바람)/,
  )?.[1];
  const candidate = cleanRequestPlace(beforeWeather ?? '');

  if (candidate) return candidate;
  if (fallbackPlace !== '현재 위치') return fallbackPlace;

  return '궁금한 지역';
}

function cleanRequestPlace(value: string) {
  return value
    .replace(/.*(?:근데|그런데|이면|라면|하고|그리고)/, '')
    .replace(/^(오늘|내일|모레|주말|아침|오전|오후|저녁|밤|새벽|지금)\s*/g, '')
    .replace(/\s*(날씨|비|눈|안개|기온|우산|소나기|천둥|번개|바람).*$/, '')
    .trim();
}

function getRequestMark(question: string) {
  const place = resolveRequestPlace(question, '궁금한 지역');

  return place.slice(0, 1) || '새';
}

function createNationalReports(reports: LocalReport[]) {
  const nationalReports: LocalReport[] = [
    {
      id: 'national-report-gangneung-rain',
      place: '강릉 교동',
      time: '방금',
      condition: '비',
      body: '갑자기 빗방울 굵어졌어요. 우산 없으면 조금 힘들 듯해요.',
      source: 'mock',
    },
    {
      id: 'national-report-busan-cloudy',
      place: '부산 해운대',
      time: '4분 전',
      condition: '흐림',
      body: '바람은 있는데 비는 아직 안 와요. 하늘은 많이 어두워졌어요.',
      source: 'mock',
    },
    {
      id: 'national-report-jeju-fog',
      place: '제주 성산',
      time: '8분 전',
      condition: '안개',
      body: '해안도로 쪽 시야가 뿌옇습니다. 운전 조심해야 해요.',
      source: 'mock',
    },
    {
      id: 'national-report-daegu-sunny',
      place: '대구 수성구',
      time: '12분 전',
      condition: '맑음',
      body: '햇빛 강하고 비 올 느낌은 거의 없어요.',
      source: 'mock',
    },
  ];

  return [...reports, ...nationalReports];
}
