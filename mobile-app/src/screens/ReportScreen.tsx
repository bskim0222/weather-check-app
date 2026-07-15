import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, Text, TextInput, View } from 'react-native';

import { EmptyState } from '../components/EmptyState';
import { inferConditionFromText } from '../domain/reports';
import { formatPostTime } from '../domain/timeDisplay';
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
  askFocusToken: number;
  reports: LocalReport[];
  requests: ReportRequest[];
  searchContext: SearchContext;
  onAddReport: (report: LocalReport) => void;
  onDeleteReport: (reportId: string) => void;
  onDeleteRequest: (requestId: string) => void;
  onReportIssue: (report: LocalReport) => void;
  onRequestsChange: (requests: ReportRequest[] | ((prev: ReportRequest[]) => ReportRequest[])) => void;
  onUpdateReport: (reportId: string, updates: Partial<Pick<LocalReport, 'body' | 'condition'>>) => void;
  onUpdateRequest: (requestId: string, updates: Partial<Pick<ReportRequest, 'question'>>) => void;
};

const reportTabs: { key: ReportTab; label: string }[] = [
  { key: 'ask', label: '문의하기' },
  { key: 'questions', label: '질문모음' },
  { key: 'feed', label: '제보모음' },
];

export function ReportScreen({
  askFocusToken,
  reports,
  requests,
  searchContext,
  onAddReport,
  onDeleteReport,
  onDeleteRequest,
  onReportIssue,
  onRequestsChange,
  onUpdateReport,
  onUpdateRequest,
}: ReportScreenProps) {
  const [activeReportTab, setActiveReportTab] = useState<ReportTab>('ask');
  const [requestDraft, setRequestDraft] = useState('');
  const [replyDraft, setReplyDraft] = useState('');
  const [selectedRequestId, setSelectedRequestId] = useState(requests[0]?.id ?? '');
  const [replyNotice, setReplyNotice] = useState('');
  const [answerModalVisible, setAnswerModalVisible] = useState(false);
  const [myQuestionModalVisible, setMyQuestionModalVisible] = useState(false);
  const [editingReport, setEditingReport] = useState<LocalReport | undefined>();
  const [editingRequest, setEditingRequest] = useState<ReportRequest | undefined>();
  const [editDraft, setEditDraft] = useState('');

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
  const selectedRequestReplies = selectedRequestId
    ? orderedReports.filter((report) => report.requestId === selectedRequestId)
    : [];

  useEffect(() => {
    if (askFocusToken > 0) setActiveReportTab('ask');
  }, [askFocusToken]);

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
    setReplyNotice('문의가 올라갔어요. 답변이 달리면 문의하기에서 확인할 수 있어요.');

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
          ? { ...request, answers: request.answers + 1, status: '답변 있음', hint: '방금 답변' }
          : request,
      ),
    );

    const replyReport: LocalReport = {
      id: `reply-${selectedRequest.id}-${Date.now()}`,
      requestId: selectedRequest.id,
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

    answerRemoteReportRequest(selectedRequest.id, '답변 있음', '방금 답변').then((remoteRequest) => {
      if (!remoteRequest) return;
      onRequestsChange((prev) =>
        replaceRequestById(prev, selectedRequest.id, {
          ...remoteRequest,
          source: selectedRequest.source,
        }),
      );
    });
    createRemoteFieldReport(replyReport).then((remoteReport) => {
      if (!remoteReport) return;
      onAddReport({ ...remoteReport, source: 'local' });
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

  const openEditRequest = (request: ReportRequest) => {
    setEditingRequest(request);
    setEditingReport(undefined);
    setEditDraft(request.question);
  };

  const openEditReport = (report: LocalReport) => {
    setEditingReport(report);
    setEditingRequest(undefined);
    setEditDraft(report.body);
  };

  const closeEditModal = () => {
    setEditingRequest(undefined);
    setEditingReport(undefined);
    setEditDraft('');
  };

  const submitEdit = () => {
    const clean = editDraft.trim();
    if (!clean) return;

    if (editingRequest?.id) {
      onUpdateRequest(editingRequest.id, { question: clean });
    }

    if (editingReport?.id) {
      onUpdateReport(editingReport.id, { body: clean });
    }

    closeEditModal();
  };

  return (
    <View>
      <View style={styles.reportReferenceTop}>
        <View>
          <Text style={styles.reportHeaderTitle}>현장문의</Text>
          <Text style={styles.reportHeaderCaption}>궁금한 곳은 묻고, 내가 본 날씨는 제보로 남겨요.</Text>
        </View>
        <View style={styles.reportHeaderActions}>
          <Text style={styles.reportHeaderActionText}>⌕</Text>
          <Text style={styles.reportHeaderActionText}>•••</Text>
        </View>
      </View>

      <View style={styles.reportToggleShell}>
        <View style={styles.reportSegmented}>
          {reportTabs.map((tab) => {
            const selected = activeReportTab === tab.key;
            return (
              <Pressable
                key={tab.key}
                onPress={() => setActiveReportTab(tab.key)}
                style={[styles.reportSegment, selected && styles.reportSegmentActive]}
              >
                <Text style={[styles.reportSegmentText, selected && styles.reportSegmentTextActive]}>
                  {tab.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={[styles.reportTogglePanel, getReportPanelTone(activeReportTab)]}>
          {activeReportTab === 'ask' && (
            <AskPanel
              myQuestions={myQuestions}
              onAddRequest={addRequest}
              onDeleteRequest={onDeleteRequest}
              onEditRequest={openEditRequest}
              onOpenQuestion={openMyQuestionModal}
              requestDraft={requestDraft}
              replyNotice={replyNotice}
              searchContext={searchContext}
              setRequestDraft={setRequestDraft}
            />
          )}

          {activeReportTab === 'questions' && (
            <QuestionsPanel
              requests={orderedRequests}
              onAnswer={openAnswerModal}
              onDeleteRequest={onDeleteRequest}
              onEditRequest={openEditRequest}
            />
          )}

          {activeReportTab === 'feed' && (
            <FeedPanel
              reports={visibleReports}
              onDeleteReport={onDeleteReport}
              onEditReport={openEditReport}
              onReportIssue={onReportIssue}
            />
          )}
        </View>
      </View>

      <AnswerModal
        request={selectedRequest}
        replies={selectedRequestReplies}
        replyDraft={replyDraft}
        setReplyDraft={setReplyDraft}
        submitReply={submitReply}
        visible={answerModalVisible}
        onClose={() => setAnswerModalVisible(false)}
      />
      <MyQuestionModal
        request={selectedRequest}
        replies={selectedRequestReplies}
        visible={myQuestionModalVisible}
        onClose={() => setMyQuestionModalVisible(false)}
      />
      <EditPostModal
        draft={editDraft}
        isReport={Boolean(editingReport)}
        setDraft={setEditDraft}
        visible={Boolean(editingReport || editingRequest)}
        onClose={closeEditModal}
        onSubmit={submitEdit}
      />
    </View>
  );
}

function AskPanel({
  myQuestions,
  onAddRequest,
  onDeleteRequest,
  onEditRequest,
  onOpenQuestion,
  requestDraft,
  replyNotice,
  searchContext,
  setRequestDraft,
}: {
  myQuestions: ReportRequest[];
  onAddRequest: () => void;
  onDeleteRequest: (requestId: string) => void;
  onEditRequest: (request: ReportRequest) => void;
  onOpenQuestion: (request: ReportRequest) => void;
  requestDraft: string;
  replyNotice: string;
  searchContext: SearchContext;
  setRequestDraft: (value: string) => void;
}) {
  const rows = myQuestions;

  return (
    <>
      <View style={styles.reportAskHeroCard}>
        <View style={styles.reportAskKickerRow}>
          <View style={styles.reportAskPin} />
          <Text style={styles.reportAskKicker}>궁금한 지역의 날씨를 물어보세요</Text>
        </View>
        <Text style={styles.reportAskTitle}>지금 그곳은 실제로 어떤가요?</Text>
        <View style={styles.reportBigQuestionBox}>
          <TextInput
            value={requestDraft}
            onChangeText={setRequestDraft}
            placeholder="예: 광화문 지금 비 와요?"
            placeholderTextColor="#8a8178"
            style={styles.reportBigQuestionInput}
            onSubmitEditing={onAddRequest}
            returnKeyType="send"
          />
          <Pressable onPress={onAddRequest} style={styles.reportRoundSubmit}>
            <Text style={styles.reportRoundSubmitText}>↗</Text>
          </Pressable>
        </View>
        <View style={styles.reportAskChipRow}>
          <Text style={[styles.reportAskChip, styles.reportAskChipBlue]}>서서울CC 잔디 젖었나요?</Text>
          <Text style={[styles.reportAskChip, styles.reportAskChipGreen]}>광안리 바람 어때요?</Text>
          <Text style={styles.reportAskChip}>홍대 앞 우산 필요?</Text>
        </View>
      </View>

      {!!replyNotice && <Text style={styles.reportInlineNotice}>{replyNotice}</Text>}

      <View style={styles.reportPanelSectionHeader}>
        <Text style={styles.reportPanelSectionTitle}>내 문의</Text>
        <Text style={styles.reportPanelSectionMeta}>{rows.length}개</Text>
      </View>
      <View style={styles.reportLiveFeed}>
        {rows.slice(0, 4).map((request) => (
          <ReportQuestionItem
            key={request.id}
            request={request}
            onDelete={onDeleteRequest}
            onEdit={onEditRequest}
            onPress={() => onOpenQuestion(request)}
            actionLabel={request.answers > 0 ? `답변 ${request.answers}개 보기` : '답변 대기'}
            variant="mine"
          />
        ))}
      </View>
    </>
  );
}

function QuestionsPanel({
  onDeleteRequest,
  requests,
  onAnswer,
  onEditRequest,
}: {
  onDeleteRequest: (requestId: string) => void;
  requests: ReportRequest[];
  onAnswer: (request: ReportRequest) => void;
  onEditRequest: (request: ReportRequest) => void;
}) {
  return (
    <>
      <View style={styles.reportPanelSectionHeader}>
        <Text style={styles.reportPanelSectionTitle}>답변이 필요한 질문</Text>
        <Text style={styles.reportPanelSectionMeta}>Live Now</Text>
      </View>
      <Text style={styles.reportInlineNotice}>
        가까이에 있다면 현장 날씨가 궁금한 사람에게 답장을 보내주세요.
      </Text>
      {requests.length > 0 ? (
        <View style={styles.reportLiveFeed}>
          {requests.slice(0, 8).map((request) => (
            <ReportQuestionItem
              key={request.id}
              request={request}
              onDelete={onDeleteRequest}
              onEdit={onEditRequest}
              onPress={() => onAnswer(request)}
              actionLabel={request.answers > 0 ? `현장 답변 ${request.answers}개 · 답변쓰기` : '답변쓰기'}
              variant={request.answers > 0 ? 'answered' : 'open'}
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
  onDeleteReport,
  onEditReport,
  reports,
  onReportIssue,
}: {
  onDeleteReport: (reportId: string) => void;
  onEditReport: (report: LocalReport) => void;
  reports: LocalReport[];
  onReportIssue: (report: LocalReport) => void;
}) {
  return (
    <>
      <View style={styles.reportPanelSectionHeader}>
        <Text style={styles.reportPanelSectionTitle}>실시간 현장 흐름</Text>
        <Text style={styles.reportPanelSectionMeta}>Live Now</Text>
      </View>
      {reports.length > 0 ? (
        <View style={styles.reportLiveFeed}>
          {reports.map((report, index) => (
            <FieldReportPost
              key={`${report.id ?? report.place}-${report.body}-${index}`}
              report={report}
              featured={index === 2}
              onDeleteReport={onDeleteReport}
              onEditReport={onEditReport}
              onReportIssue={onReportIssue}
            />
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
  onDelete,
  onEdit,
  onPress,
  request,
  variant,
}: {
  actionLabel: string;
  onDelete: (requestId: string) => void;
  onEdit: (request: ReportRequest) => void;
  onPress: () => void;
  request: ReportRequest;
  variant: 'mine' | 'open' | 'answered';
}) {
  const canEdit = request.source === 'local' && Boolean(request.id);

  return (
    <Pressable onPress={onPress} style={styles.reportPostCard}>
      <View style={styles.reportPostHead}>
        <View style={styles.reportAuthorRow}>
          <View style={[styles.reportAvatar, variant === 'answered' && styles.reportAvatarAnswer]} />
          <View>
            <Text style={styles.reportAuthorName}>{request.place}</Text>
            <Text style={styles.reportMetaSmall}>{formatPostTime(request.createdAt)} · {request.status}</Text>
          </View>
        </View>
        {canEdit ? (
          <View style={styles.reportItemActions}>
            <Pressable
              onPress={(event) => {
                event.stopPropagation();
                onEdit(request);
              }}
              style={styles.reportItemAction}
            >
              <Text style={styles.reportItemActionText}>수정</Text>
            </Pressable>
            <Pressable
              onPress={(event) => {
                event.stopPropagation();
                onDelete(request.id ?? '');
              }}
              style={[styles.reportItemAction, styles.reportItemActionDanger]}
            >
              <Text style={styles.reportItemActionDangerText}>삭제</Text>
            </Pressable>
          </View>
        ) : (
          <Text style={styles.reportMoreText}>•••</Text>
        )}
      </View>
      <Text numberOfLines={3} style={styles.reportPostTitle}>
        “{request.question}”
      </Text>
      <View style={styles.reportReplyPreview}>
        <View style={styles.reportReplyPreviewTop}>
          <Text style={styles.reportReplyPreviewName}>{actionLabel}</Text>
          {request.answers > 0 && <Text style={styles.reportVerifiedBadge}>현장 답변</Text>}
        </View>
        <Text numberOfLines={2} style={styles.reportReplyPreviewBody}>
          {request.answers > 0
            ? '올린 답변을 확인하거나 현재 상황을 추가로 남겨주세요.'
            : '근처에 있다면 지금 보이는 날씨를 짧게 알려주세요.'}
        </Text>
      </View>
    </Pressable>
  );
}
function FieldReportPost({
  featured,
  onDeleteReport,
  onEditReport,
  onReportIssue,
  report,
}: {
  featured: boolean;
  onDeleteReport: (reportId: string) => void;
  onEditReport: (report: LocalReport) => void;
  onReportIssue: (report: LocalReport) => void;
  report: LocalReport;
}) {
  const canEdit = report.source === 'local' && Boolean(report.id);

  if (featured) {
    return (
      <View style={styles.reportPhotoPostCard}>
        <View style={styles.reportPhotoOverlay}>
          <Text style={styles.reportPhotoTag}>{report.place}</Text>
          <Text numberOfLines={3} style={styles.reportPhotoTitle}>{report.body}</Text>
          <Text style={styles.reportPhotoMeta}>현장 제보 · {formatPostTime(report.createdAt)}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.reportPostCard}>
      <View style={styles.reportPostHead}>
        <View style={styles.reportAuthorRow}>
          <View style={styles.reportAvatar} />
          <View>
            <Text style={styles.reportAuthorName}>{report.place}</Text>
            <Text style={styles.reportMetaSmall}>현장 제보 · {formatPostTime(report.createdAt)}</Text>
          </View>
        </View>
        {canEdit ? (
          <View style={styles.reportItemActions}>
            <Pressable onPress={() => onEditReport(report)} style={styles.reportItemAction}>
              <Text style={styles.reportItemActionText}>수정</Text>
            </Pressable>
            <Pressable
              onPress={() => onDeleteReport(report.id ?? '')}
              style={[styles.reportItemAction, styles.reportItemActionDanger]}
            >
              <Text style={styles.reportItemActionDangerText}>삭제</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable
            disabled={report.moderationStatus === 'pending'}
            onPress={() => onReportIssue(report)}
            style={[
              styles.reportIssueButton,
              report.moderationStatus === 'pending' && styles.reportIssueButtonPending,
            ]}
          >
            <Text style={styles.reportIssueText}>
              {report.moderationStatus === 'pending' ? '신고됨' : '신고'}
            </Text>
          </Pressable>
        )}
      </View>
      <Text numberOfLines={3} style={styles.reportPostTitle}>
        “{report.body}”
      </Text>
      <View style={styles.reportConditionPill}>
        <Text style={styles.reportConditionPillText}>{report.condition}</Text>
      </View>
    </View>
  );
}
function ReplyList({ replies, emptyText }: { replies: LocalReport[]; emptyText: string }) {
  if (replies.length === 0 && !emptyText) return null;

  if (replies.length === 0) {
    return (
      <View style={styles.reportAnswerBubble}>
        <Text style={styles.reportAnswerText}>{emptyText}</Text>
      </View>
    );
  }

  return (
    <View style={styles.reportAnswerBubble}>
      {replies.map((reply, index) => (
        <Text key={`${reply.id ?? reply.body}-${index}`} style={styles.reportAnswerText}>
          {`${reply.place} · ${formatPostTime(reply.createdAt)}\n${reply.body}`}
        </Text>
      ))}
    </View>
  );
}

function EditPostModal({
  draft,
  isReport,
  onClose,
  onSubmit,
  setDraft,
  visible,
}: {
  draft: string;
  isReport: boolean;
  onClose: () => void;
  onSubmit: () => void;
  setDraft: (value: string) => void;
  visible: boolean;
}) {
  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onClose}>
      <View style={styles.reportModalBackdrop}>
        <View style={styles.reportModalCard}>
          <Text style={styles.replyEyebrow}>{isReport ? '내 제보 수정' : '내 문의 수정'}</Text>
          <Text style={styles.replyQuestion}>
            {isReport ? '현장 날씨 내용을 고쳐주세요.' : '궁금한 지역과 내용을 고쳐주세요.'}
          </Text>
          <TextInput
            multiline
            value={draft}
            onChangeText={setDraft}
            placeholder={isReport ? '지금 보이는 날씨를 적어주세요.' : '예: 광화문 지금 비 와요?'}
            placeholderTextColor="#8f7f87"
            style={styles.replyInput}
          />
          <Pressable onPress={onSubmit} style={styles.replySubmitButton}>
            <Text style={styles.replySubmitText}>저장</Text>
          </Pressable>
          <Pressable onPress={onClose} style={styles.reportModalClose}>
            <Text style={styles.reportModalCloseText}>닫기</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function AnswerModal({
  onClose,
  replyDraft,
  replies,
  request,
  setReplyDraft,
  submitReply,
  visible,
}: {
  onClose: () => void;
  replyDraft: string;
  replies: LocalReport[];
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
          <ReplyList replies={replies} emptyText={request?.answers ? '답변을 불러오는 중이에요.' : '아직 현장 답변이 없어요.'} />
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
  replies,
  request,
  visible,
}: {
  onClose: () => void;
  replies: LocalReport[];
  request?: ReportRequest;
  visible: boolean;
}) {
  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onClose}>
      <View style={styles.reportModalBackdrop}>
        <View style={styles.reportModalCard}>
          <Text style={styles.replyEyebrow}>내 문의 답변</Text>
          <Text style={styles.replyQuestion}>{request?.question ?? '질문을 선택해주세요'}</Text>
          <ReplyList replies={replies} emptyText={request && request.answers > 0 ? '답변을 불러오는 중이에요.' : '아직 현장 답변이 없어요.'} />
          <Pressable onPress={onClose} style={styles.replySubmitButton}>
            <Text style={styles.replySubmitText}>확인</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function getReportPanelTone(tab: ReportTab) {
  if (tab === 'questions') return styles.reportTabPanelYellow;
  if (tab === 'feed') return styles.reportTabPanelRose;
  return styles.reportTabPanelBlue;
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

function getDefaultAskRows(place: string): ReportRequest[] {
  return [
    {
      id: 'sample-question-gwangalli',
      question: '광안리 바람 많이 부나요?',
      hint: '현장 답변을 기다리는 중',
      place: '광안리',
      distance: '질문 지역',
      answers: 0,
      time: '1분 전',
      status: '답변 대기',
      mark: '광',
      accent: '#8fb9c8',
      source: 'mock',
    },
    {
      id: 'sample-question-hongdae',
      question: '홍대 앞 우산 필요할까요?',
      hint: '현장 답변 1개',
      place: '홍대 앞',
      distance: '질문 지역',
      answers: 1,
      time: '9분 전',
      status: '답변 있음',
      mark: '홍',
      accent: '#f4d5d0',
      source: 'mock',
    },
    {
      id: 'sample-question-context',
      question: `${place} 지금 걸어다니기 괜찮나요?`,
      hint: '현장 답변을 기다리는 중',
      place,
      distance: '검색 지역',
      answers: 0,
      time: '방금',
      status: '답변 대기',
      mark: place.slice(0, 1) || '?',
      accent: '#f4f5f2',
      source: 'mock',
    },
  ];
}

function createNationalReports(reports: LocalReport[]) {
  const nationalReports: LocalReport[] = [
    {
      id: 'national-report-seoul-cloud',
      place: '광화문',
      time: '3분 전',
      condition: '흐림',
      body: '하늘은 많이 어둡지만 아직 비는 안 와요. 바람은 약한 편이에요.',
      createdAt: new Date(Date.now() - 3 * 60 * 1000).toISOString(),
      moderationStatus: 'visible',
      source: 'mock',
    },
    {
      id: 'national-report-busan-wind',
      place: '광안리',
      time: '8분 전',
      condition: '바람',
      body: '바닷가 쪽은 바람이 꽤 있어요. 우산 쓰기는 조금 불편할 것 같아요.',
      createdAt: new Date(Date.now() - 8 * 60 * 1000).toISOString(),
      moderationStatus: 'visible',
      source: 'mock',
    },
    {
      id: 'national-report-jeju-clear',
      place: '제주공항',
      time: '15분 전',
      condition: '맑음',
      body: '구름은 있지만 시야가 좋아요. 비 느낌은 거의 없습니다.',
      createdAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
      moderationStatus: 'visible',
      source: 'mock',
    },
  ];

  return reports.sort((a, b) => {
    const left = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const right = b.createdAt ? new Date(b.createdAt).getTime() : 0;

    return right - left;
  });
}
