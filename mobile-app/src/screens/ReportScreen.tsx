import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, Text, TextInput, View } from 'react-native';

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

type ReportTab = 'ask' | 'questions' | 'feed';

type ReportScreenProps = {
  reports: LocalReport[];
  requests: ReportRequest[];
  searchContext: SearchContext;
  onAddReport: (report: LocalReport) => void;
  onReportIssue: (report: LocalReport) => void;
  onRequestsChange: (requests: ReportRequest[] | ((prev: ReportRequest[]) => ReportRequest[])) => void;
};

const reportTabs: { key: ReportTab; label: string }[] = [
  { key: 'ask', label: '문의하기' },
  { key: 'questions', label: '질문모음' },
  { key: 'feed', label: '제보모음' },
];

const tabTone: Record<ReportTab, { panel: string; inactive: string; ink: string; sub: string; accent: string }> = {
  ask: {
    panel: '#b8ceda',
    inactive: '#dedad1',
    ink: '#22323b',
    sub: '#5b717b',
    accent: '#376d8f',
  },
  questions: {
    panel: '#c7c1d0',
    inactive: '#dedad1',
    ink: '#302d39',
    sub: '#625d72',
    accent: '#5d5575',
  },
  feed: {
    panel: '#b8c8ae',
    inactive: '#dedad1',
    ink: '#24351f',
    sub: '#516047',
    accent: '#55784d',
  },
};

export function ReportScreen({
  reports,
  requests,
  searchContext,
  onAddReport,
  onReportIssue,
  onRequestsChange,
}: ReportScreenProps) {
  const [activeReportTab, setActiveReportTab] = useState<ReportTab>('ask');
  const [requestDraft, setRequestDraft] = useState('');
  const [replyDraft, setReplyDraft] = useState('');
  const [feedMode, setFeedMode] = useState<'nearby' | 'national'>('national');
  const [selectedRequestId, setSelectedRequestId] = useState(requests[0]?.id ?? '');
  const [replyNotice, setReplyNotice] = useState('');
  const [answerModalVisible, setAnswerModalVisible] = useState(false);
  const [myQuestionModalVisible, setMyQuestionModalVisible] = useState(false);

  const fieldSnapshot = useMemo(
    () => getMockFieldReportSnapshot(reports, searchContext, requests),
    [reports, requests, searchContext],
  );
  const orderedReports = fieldSnapshot.reports;
  const orderedRequests = fieldSnapshot.requests;
  const visibleReports = feedMode === 'national' ? createNationalReports(orderedReports) : orderedReports;
  const myQuestions = orderedRequests.filter((request) => request.source === 'local');
  const answerableRequests = orderedRequests;
  const selectedRequest = useMemo(
    () => orderedRequests.find((request) => request.id === selectedRequestId),
    [orderedRequests, selectedRequestId],
  );
  const tone = tabTone[activeReportTab];

  useEffect(() => {
    if (orderedRequests.length === 0) {
      setSelectedRequestId('');
      return;
    }

    const selectedRequestExists = orderedRequests.some((request) => request.id === selectedRequestId);
    if (!selectedRequestExists) {
      setSelectedRequestId(orderedRequests[0].id);
    }
  }, [orderedRequests, selectedRequestId]);

  const addRequest = () => {
    const clean = requestDraft.trim();
    if (!clean) return;

    const newRequest: ReportRequest = {
      id: `request-${Date.now()}`,
      question: clean,
      hint: '현장 답변을 기다리는 중',
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

      onRequestsChange((prev) => replaceRequestById(prev, newRequest.id, { ...remoteRequest, source: 'local' }));
      setSelectedRequestId(remoteRequest.id);
    });
    setSelectedRequestId(newRequest.id);
    setRequestDraft('');
    setReplyNotice('질문을 올렸어요. 답변이 달리면 내 질문에서 확인할 수 있어요.');
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
    setReplyNotice(`${selectedRequest.place} 질문에 현장 답변을 남겼어요.`);
    setAnswerModalVisible(false);
  };

  const openAnswerModal = (request: ReportRequest) => {
    setSelectedRequestId(request.id);
    setReplyDraft('');
    setReplyNotice('');
    setAnswerModalVisible(true);
  };

  const openMyQuestionModal = (request: ReportRequest) => {
    setSelectedRequestId(request.id);
    setMyQuestionModalVisible(true);
  };

  return (
    <View>
      <View style={styles.reportHeaderBlock}>
        <Text style={styles.reportHeaderTitle}>생생날씨특파원</Text>
        <Text style={styles.reportHeaderCaption}>묻고, 답하고, 현장 날씨를 모아요</Text>
      </View>

      <View style={styles.reportTabbedCard}>
        <View style={styles.reportTabRail}>
          {reportTabs.map((tab) => {
            const selected = activeReportTab === tab.key;
            const tabColor = selected ? tabTone[tab.key].panel : tone.inactive;
            return (
              <Pressable
                key={tab.key}
                onPress={() => setActiveReportTab(tab.key)}
                style={[
                  styles.reportTopTab,
                  selected && styles.reportTopTabActive,
                  { backgroundColor: tabColor },
                ]}
              >
                <Text
                  style={[
                    styles.reportTopTabText,
                    selected && { color: tabTone[tab.key].ink },
                  ]}
                >
                  {tab.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={[styles.reportTabPanel, { backgroundColor: tone.panel }]}>
          {activeReportTab === 'ask' && (
            <AskPanel
              myQuestions={myQuestions}
              onAddRequest={addRequest}
              onOpenQuestion={openMyQuestionModal}
              requestDraft={requestDraft}
              replyNotice={replyNotice}
              setRequestDraft={setRequestDraft}
              tone={tone}
            />
          )}

          {activeReportTab === 'questions' && (
            <QuestionsPanel
              requests={answerableRequests}
              onAnswer={openAnswerModal}
              tone={tone}
            />
          )}

          {activeReportTab === 'feed' && (
            <FeedPanel
              feedMode={feedMode}
              reports={visibleReports}
              onReportIssue={onReportIssue}
              setFeedMode={setFeedMode}
              tone={tone}
            />
          )}
        </View>
      </View>

      <AnswerModal
        request={selectedRequest}
        replyDraft={replyDraft}
        setReplyDraft={setReplyDraft}
        submitReply={submitReply}
        visible={answerModalVisible}
        onClose={() => setAnswerModalVisible(false)}
      />
      <MyQuestionModal
        request={selectedRequest}
        visible={myQuestionModalVisible}
        onClose={() => setMyQuestionModalVisible(false)}
      />
    </View>
  );
}

function AskPanel({
  myQuestions,
  onAddRequest,
  onOpenQuestion,
  requestDraft,
  replyNotice,
  setRequestDraft,
  tone,
}: {
  myQuestions: ReportRequest[];
  onAddRequest: () => void;
  onOpenQuestion: (request: ReportRequest) => void;
  requestDraft: string;
  replyNotice: string;
  setRequestDraft: (value: string) => void;
  tone: (typeof tabTone)[ReportTab];
}) {
  return (
    <>
      <Text style={[styles.reportPanelTitle, { color: tone.ink }]}>궁금한 지역의 현재 날씨</Text>
      <Text style={[styles.reportPanelCaption, { color: tone.sub }]}>현장에 있는 사람에게 바로 물어보세요.</Text>
      <View style={styles.reportBigQuestionBox}>
        <TextInput
          value={requestDraft}
          onChangeText={setRequestDraft}
          placeholder="예: 청와대 지금 비 와?"
          placeholderTextColor="#8a8178"
          style={styles.reportBigQuestionInput}
          onSubmitEditing={onAddRequest}
          returnKeyType="send"
        />
        <Pressable onPress={onAddRequest} style={styles.reportRoundSubmit}>
          <Text style={styles.reportRoundSubmitText}>→</Text>
        </Pressable>
      </View>
      {!!replyNotice && <Text style={[styles.reportInlineNotice, { color: tone.ink }]}>{replyNotice}</Text>}

      <View style={styles.reportPanelSectionHeader}>
        <Text style={[styles.reportPanelSectionTitle, { color: tone.ink }]}>내가 한 질문</Text>
        <Text style={[styles.reportPanelSectionMeta, { color: tone.sub }]}>{myQuestions.length}개</Text>
      </View>

      {myQuestions.length > 0 ? (
        <View style={styles.requestList}>
          {myQuestions.slice(0, 4).map((request) => (
            <ReportQuestionItem
              key={request.id}
              request={request}
              onPress={() => onOpenQuestion(request)}
              actionLabel={request.answers > 0 ? `답변 ${request.answers}` : '대기중'}
            />
          ))}
        </View>
      ) : (
        <EmptyState
          title="아직 내가 한 질문이 없어요"
          body="궁금한 지역을 물어보면 여기에서 답변 상태를 볼 수 있어요."
        />
      )}
    </>
  );
}

function QuestionsPanel({
  requests,
  onAnswer,
  tone,
}: {
  requests: ReportRequest[];
  onAnswer: (request: ReportRequest) => void;
  tone: (typeof tabTone)[ReportTab];
}) {
  return (
    <>
      <Text style={[styles.reportPanelTitle, { color: tone.ink }]}>답변이 필요한 질문</Text>
      <Text style={[styles.reportPanelCaption, { color: tone.sub }]}>내 주변과 관심 지역 질문부터 보여줘요.</Text>
      <View style={styles.reportFilterPill}>
        <Text style={styles.reportFilterPillText}>가까운 질문 우선</Text>
      </View>

      {requests.length > 0 ? (
        <View style={styles.requestList}>
          {requests.slice(0, 6).map((request) => (
            <ReportQuestionItem
              key={request.id}
              request={request}
              onPress={() => onAnswer(request)}
              actionLabel="답변하기"
            />
          ))}
        </View>
      ) : (
        <EmptyState
          title="답변할 질문이 없어요"
          body="다른 사용자가 질문을 올리면 최신순으로 보여줄게요."
        />
      )}
    </>
  );
}

function FeedPanel({
  feedMode,
  reports,
  onReportIssue,
  setFeedMode,
  tone,
}: {
  feedMode: 'nearby' | 'national';
  reports: LocalReport[];
  onReportIssue: (report: LocalReport) => void;
  setFeedMode: (mode: 'nearby' | 'national') => void;
  tone: (typeof tabTone)[ReportTab];
}) {
  return (
    <>
      <Text style={[styles.reportPanelTitle, { color: tone.ink }]}>실시간 현장 제보</Text>
      <Text style={[styles.reportPanelCaption, { color: tone.sub }]}>질문 답변과 현재위치 제보가 최신순으로 올라와요.</Text>
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

      {reports.length > 0 ? (
        <View style={styles.liveReportList}>
          {reports.map((report, index) => {
            const itemTone = getReportTone(report.condition);

            return (
              <View key={`${report.place}-${report.body}-${index}`} style={styles.liveReportItem}>
                <View style={[styles.liveReportMark, { backgroundColor: itemTone.bg }]}>
                  <Text style={[styles.liveReportMarkText, { color: itemTone.ink }]}>
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
                    <Text style={[styles.liveReportCondition, { backgroundColor: itemTone.pill, color: itemTone.ink }]}>
                      {report.condition}
                    </Text>
                    <Text style={styles.liveReportSource}>
                      {report.source === 'local' ? '현재위치 제보' : '질문 답변'}
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
          title="올라온 현장 글이 없어요"
          body="질문 답변이나 현재위치 제보가 등록되면 최신순으로 쌓입니다."
        />
      )}
    </>
  );
}

function ReportQuestionItem({
  actionLabel,
  onPress,
  request,
}: {
  actionLabel: string;
  onPress: () => void;
  request: ReportRequest;
}) {
  return (
    <Pressable onPress={onPress} style={styles.requestListItem}>
      <View style={[styles.requestMark, { backgroundColor: request.accent || '#f4f5f2' }]}>
        <Text style={styles.requestMarkText}>{request.mark}</Text>
      </View>
      <View style={styles.requestListContent}>
        <Text style={styles.requestQuestion}>{request.question}</Text>
        <Text style={styles.requestHint}>
          {request.place} · {request.time} · 현장 답변 {request.answers}개
        </Text>
      </View>
      <Text style={styles.requestStatus}>{actionLabel}</Text>
    </Pressable>
  );
}

function AnswerModal({
  onClose,
  replyDraft,
  request,
  setReplyDraft,
  submitReply,
  visible,
}: {
  onClose: () => void;
  replyDraft: string;
  request?: ReportRequest;
  setReplyDraft: (value: string) => void;
  submitReply: () => void;
  visible: boolean;
}) {
  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onClose}>
      <View style={styles.reportModalBackdrop}>
        <View style={styles.reportModalCard}>
          <Text style={styles.replyEyebrow}>선택한 질문에 답변하기</Text>
          <Text style={styles.replyQuestion}>{request?.question ?? '질문을 선택해주세요'}</Text>
          <TextInput
            multiline
            value={replyDraft}
            onChangeText={setReplyDraft}
            placeholder="예: 지금은 비 거의 안 오고 바닥만 조금 젖어 있어요."
            placeholderTextColor="#8f7f87"
            style={styles.replyInput}
          />
          <Pressable onPress={submitReply} style={styles.replySubmitButton}>
            <Text style={styles.replySubmitText}>현장 답변 남기기</Text>
          </Pressable>
          <Pressable onPress={onClose} style={styles.reportModalClose}>
            <Text style={styles.reportModalCloseText}>닫기</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function MyQuestionModal({
  onClose,
  request,
  visible,
}: {
  onClose: () => void;
  request?: ReportRequest;
  visible: boolean;
}) {
  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onClose}>
      <View style={styles.reportModalBackdrop}>
        <View style={styles.reportModalCard}>
          <Text style={styles.replyEyebrow}>내 질문 답변</Text>
          <Text style={styles.replyQuestion}>{request?.question ?? '질문을 선택해주세요'}</Text>
          <View style={styles.reportAnswerBubble}>
            <Text style={styles.reportAnswerText}>
              {request && request.answers > 0
                ? `${request.place} 주변에서 답변 ${request.answers}개가 도착했어요. 실제 답변 목록은 서버 저장 구조를 붙이면서 여기로 연결할게요.`
                : '아직 도착한 답변이 없어요.'}
            </Text>
          </View>
          <Pressable onPress={onClose} style={styles.replySubmitButton}>
            <Text style={styles.replySubmitText}>확인</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
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
    /(.+?)(?:오늘|내일|모레|주말|아침|오전|오후|저녁|밤|지금|\d{1,2}\s*시|\s*(?:날씨|비|안개|기온|우산|소나기|천둥|번개|바람))/,
  )?.[1];
  const candidate = cleanRequestPlace(beforeWeather ?? '');

  if (candidate) return candidate;
  if (fallbackPlace !== '현재 위치') return fallbackPlace;

  return '궁금한 지역';
}

function cleanRequestPlace(value: string) {
  return value
    .replace(/.*(?:근데|그런데|이면|하고|그리고)/, '')
    .replace(/^(오늘|내일|모레|주말|아침|오전|오후|저녁|밤|지금)\s*/g, '')
    .replace(/\s*(날씨|비|안개|기온|우산|소나기|천둥|번개|바람).*$/, '')
    .trim();
}

function getRequestMark(question: string) {
  const place = resolveRequestPlace(question, '궁금한 지역');

  return place.slice(0, 1) || '?';
}

function createNationalReports(reports: LocalReport[]) {
  const nationalReports: LocalReport[] = [
    {
      id: 'national-report-gangneung-rain',
      place: '강릉 교동',
      time: '방금',
      condition: '비',
      body: '갑자기 빗방울이 굵어졌어요. 우산 없으면 조금 힘들 것 같아요.',
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
      body: '해안도로 쪽 시야가 뿌옇습니다. 운전은 조심해야 해요.',
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

  return [...reports, ...nationalReports].sort((a, b) => {
    const aCreated = a.createdAt ? Date.parse(a.createdAt) : 0;
    const bCreated = b.createdAt ? Date.parse(b.createdAt) : 0;
    return bCreated - aCreated;
  });
}
