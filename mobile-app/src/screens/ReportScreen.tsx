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
    panel: '#c8e8f8',
    inactive: '#e2ded4',
    ink: '#0a2038',
    sub: '#3a7098',
    accent: '#2a6090',
  },
  questions: {
    panel: '#ffe600',
    inactive: '#e2ded4',
    ink: '#2e2000',
    sub: '#735300',
    accent: '#8a6400',
  },
  feed: {
    panel: '#f1b2aa',
    inactive: '#e2ded4',
    ink: '#3b1010',
    sub: '#7b3d36',
    accent: '#b64b42',
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
  const visibleReports = createNationalReports(orderedReports);
  const myQuestions = orderedRequests.filter((request) => request.source === 'local');
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

    if (!orderedRequests.some((request) => request.id === selectedRequestId)) {
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
    setSelectedRequestId(newRequest.id);
    setRequestDraft('');
    setReplyNotice('질문을 올렸어요. 답변이 달리면 내 질문에서 확인할 수 있어요.');

    createRemoteReportRequest(newRequest).then((remoteRequest) => {
      if (!remoteRequest) return;

      onRequestsChange((prev) => replaceRequestById(prev, newRequest.id, { ...remoteRequest, source: 'local' }));
      setSelectedRequestId(remoteRequest.id);
    });
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
    setReplyDraft('');
    setReplyNotice(`${selectedRequest.place} 질문에 현장 답변을 남겼어요.`);
    setAnswerModalVisible(false);

    answerRemoteReportRequest(selectedRequest.id, '답변 있음', '방금 답변됨').then((remoteRequest) => {
      if (!remoteRequest) return;

      onRequestsChange((prev) => replaceRequestById(prev, selectedRequest.id, remoteRequest));
    });
    createRemoteFieldReport(replyReport).then((remoteReport) => {
      if (!remoteReport) return;

      onAddReport(remoteReport);
    });
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
        <Text style={styles.reportHeaderCaption}>물어보고, 답하고, 전국 현장 날씨를 모아요.</Text>
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
              requests={orderedRequests}
              onAnswer={openAnswerModal}
              tone={tone}
            />
          )}

          {activeReportTab === 'feed' && (
            <FeedPanel
              reports={visibleReports}
              onReportIssue={onReportIssue}
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
      <Text style={[styles.reportPanelTitle, { color: tone.ink }]}>궁금한 지역의 현재 상황을 물어보세요</Text>
      <Text style={[styles.reportPanelCaption, { color: tone.sub }]}>근처에 있는 사람의 현장 답변을 기다려요.</Text>
      <View style={styles.reportBigQuestionBox}>
        <TextInput
          value={requestDraft}
          onChangeText={setRequestDraft}
          placeholder="예: 청와대 지금 비 와요?"
          placeholderTextColor="#8a8178"
          style={styles.reportBigQuestionInput}
          onSubmitEditing={onAddRequest}
          returnKeyType="send"
        />
        <Pressable onPress={onAddRequest} style={styles.reportRoundSubmit}>
          <Text style={styles.reportRoundSubmitText}>보내기</Text>
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
          body="궁금한 지역을 물어보면 여기서 답변 상태를 볼 수 있어요."
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
      <Text style={[styles.reportPanelTitle, { color: tone.ink }]}>가까운데 계시면 현장날씨가 궁금한 친구에게 답장을 보내주세요</Text>
      <Text style={[styles.reportPanelCaption, { color: tone.sub }]}>
        답변은 질문 장소 근처에서만 남길 수 있게 설계할 거예요.
      </Text>

      {requests.length > 0 ? (
        <View style={styles.requestList}>
          {requests.slice(0, 6).map((request) => (
            <ReportQuestionItem
              key={request.id}
              request={request}
              onPress={() => onAnswer(request)}
              actionLabel="답변쓰기"
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
  reports,
  onReportIssue,
  tone,
}: {
  reports: LocalReport[];
  onReportIssue: (report: LocalReport) => void;
  tone: (typeof tabTone)[ReportTab];
}) {
  return (
    <>
      <Text style={[styles.reportPanelTitle, { color: tone.ink }]}>전국 실시간 현장 제보</Text>
      <Text style={[styles.reportPanelCaption, { color: tone.sub }]}>질문 답변과 현재위치 제보가 최신순으로 올라와요.</Text>

      {reports.length > 0 ? (
        <View style={styles.liveReportList}>
          {reports.map((report, index) => (
            <View key={`${report.place}-${report.body}-${index}`} style={styles.liveReportItem}>
              <View style={styles.liveReportMain}>
                <View style={styles.liveReportTopRow}>
                  <Text numberOfLines={1} style={styles.liveReportPlace}>{report.place}</Text>
                  <Text style={styles.liveReportTime}>{report.time}</Text>
                </View>
                <Text numberOfLines={2} style={styles.liveReportBody}>{report.body}</Text>
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
          ))}
        </View>
      ) : (
        <EmptyState
          title="올라온 현장 글이 없어요"
          body="질문 답변이나 현재위치 제보가 등록되면 최신순으로 보입니다."
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
      <View style={styles.requestListContent}>
        <Text style={styles.requestQuestion}>{request.question}</Text>
        <Text style={styles.requestHint}>{request.place} · {request.time}</Text>
        <Text style={styles.requestAnswerMeta}>
          현장 답변 {request.answers}개 · 질문 장소 근처에서만 답변 가능
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
          <Text style={styles.replyEyebrow}>선택한 질문에 답변쓰기</Text>
          <Text style={styles.replyQuestion}>{request?.question ?? '질문을 선택해주세요'}</Text>
          <Text style={styles.replyNotice}>질문 장소 근처에서 확인한 현재 날씨만 남겨주세요.</Text>
          {!!request && request.answers > 0 && (
            <View style={styles.reportAnswerBubble}>
              <Text style={styles.reportAnswerText}>
                {`${request.place} 주변에서 현장 답변 ${request.answers}개가 도착했어요.\n- 방금 확인: 비는 약하거나 멈춘 상태예요.\n- 주변 제보: 바닥은 젖었지만 이동은 가능해요.`}
              </Text>
            </View>
          )}
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
                ? `${request.place} 주변에서 답변 ${request.answers}개가 도착했어요. 실제 답변 목록은 서버 저장 구조를 붙이면서 이곳에 연결할게요.`
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

function resolveRequestPlace(question: string, fallbackPlace: string) {
  const normalized = question.replace(/[?!,.]/g, ' ').replace(/\s+/g, ' ').trim();
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
    .replace(/.*(?:근데|그러면|혹시|그리고)/, '')
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
      body: '해안가 쪽 시야가 뿌옇습니다. 운전은 조심해야 해요.',
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
