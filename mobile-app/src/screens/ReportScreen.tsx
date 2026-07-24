import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, Text, TextInput, View } from 'react-native';

import { EmptyState } from '../components/EmptyState';
import {
  canAnswerQuestion,
  formatDistance,
  getAnswerDistanceMeters,
  getAnswerableQuestions,
  getQuestionStatus,
  getVisibleFieldReports,
  isMyQuestionVisible,
  isQuestionActive,
} from '../domain/community';
import { visibleReportsOnly } from '../domain/moderation';
import { inferConditionFromText } from '../domain/reports';
import { isValidKoreaMapCoordinate } from '../domain/mapClustering';
import { formatPostTime } from '../domain/timeDisplay';
import {
  createRemoteFieldReportResult,
  createRemoteReportRequest,
} from '../services/fieldReports';
import { searchRemotePlaces } from '../services/geocoding';
import { styles } from '../styles/appStyles';
import type { LocationStatus } from '../types/appState';
import type { LocalReport, ReportRequest, SearchContext } from '../types/weather';

type ReportTab = 'ask' | 'questions' | 'feed';

type ReportScreenProps = {
  askFocusToken: number;
  reports: LocalReport[];
  requests: ReportRequest[];
  searchContext: SearchContext;
  locationStatus: LocationStatus;
  onAddReport: (report: LocalReport) => void;
  onDeleteReport: (reportId: string) => void;
  onDeleteRequest: (requestId: string) => void;
  onReportIssue: (report: LocalReport) => void;
  onRefreshLocation: () => void;
  onRequestsChange: (requests: ReportRequest[] | ((prev: ReportRequest[]) => ReportRequest[])) => void;
  onUpdateReport: (reportId: string, updates: Partial<Pick<LocalReport, 'body' | 'condition'>>) => void;
  onUpdateRequest: (requestId: string, updates: Partial<Pick<ReportRequest, 'question'>>) => void;
};

const reportTabs: { key: ReportTab; label: string }[] = [
  { key: 'ask', label: '내 문의' },
  { key: 'questions', label: '답변하기' },
  { key: 'feed', label: '현장 소식' },
];

export function ReportScreen({
  askFocusToken,
  reports,
  requests,
  searchContext,
  locationStatus,
  onAddReport,
  onDeleteReport,
  onDeleteRequest,
  onReportIssue,
  onRefreshLocation,
  onRequestsChange,
  onUpdateReport,
  onUpdateRequest,
}: ReportScreenProps) {
  const [activeReportTab, setActiveReportTab] = useState<ReportTab>('ask');
  const [requestDraft, setRequestDraft] = useState('');
  const [replyDraft, setReplyDraft] = useState('');
  const [selectedRequestId, setSelectedRequestId] = useState(requests[0]?.id ?? '');
  const [replyNotice, setReplyNotice] = useState('');
  const [replySubmitting, setReplySubmitting] = useState(false);
  const [requestSubmitting, setRequestSubmitting] = useState(false);
  const [answerModalVisible, setAnswerModalVisible] = useState(false);
  const [myQuestionModalVisible, setMyQuestionModalVisible] = useState(false);
  const [editingReport, setEditingReport] = useState<LocalReport | undefined>();
  const [editingRequest, setEditingRequest] = useState<ReportRequest | undefined>();
  const [editDraft, setEditDraft] = useState('');
  const [communityNow, setCommunityNow] = useState(Date.now());

  const orderedRequests = useMemo(
    () => requests.filter((request) => request.source !== 'mock'),
    [requests],
  );
  const visibleReports = useMemo(
    () => orderLiveReports(getVisibleFieldReports(
      visibleReportsOnly(reports).filter((report) => report.source !== 'mock'),
      communityNow,
    )),
    [communityNow, reports],
  );
  const myQuestions = orderedRequests.filter((request) => isMyQuestionVisible(request, communityNow));
  const answerableQuestions = getAnswerableQuestions(orderedRequests, locationStatus, communityNow)
    .map((request) => ({
      ...request,
      distance: formatDistance(getAnswerDistanceMeters(request, locationStatus)),
    }));
  const selectedRequest = useMemo(
    () => orderedRequests.find((request) => request.id === selectedRequestId),
    [orderedRequests, selectedRequestId],
  );
  const selectedRequestReplies = selectedRequestId
    ? visibleReports.filter((report) => report.requestId === selectedRequestId)
    : [];
  const answerLocationMessage = getAnswerLocationMessage(selectedRequest, locationStatus);

  useEffect(() => {
    if (askFocusToken > 0) setActiveReportTab('ask');
  }, [askFocusToken]);

  useEffect(() => {
    const intervalId = setInterval(() => setCommunityNow(Date.now()), 60_000);
    return () => clearInterval(intervalId);
  }, []);

  useEffect(() => {
    if (orderedRequests.length === 0) {
      setSelectedRequestId('');
      return;
    }

    if (!orderedRequests.some((request) => request.id === selectedRequestId)) {
      setSelectedRequestId(orderedRequests[0].id);
    }
  }, [orderedRequests, selectedRequestId]);

  const addRequest = async () => {
    const clean = requestDraft.trim();
    if (!clean || requestSubmitting) return;

    setRequestSubmitting(true);
    setReplyNotice('문의할 장소를 확인하고 있어요.');

    const placeQuery = resolveRequestPlace(clean, searchContext.place);
    let resolvedTarget: SearchContext['target'] | undefined;

    try {
      const candidates = await searchRemotePlaces(placeQuery, clean);
      resolvedTarget = candidates.find((candidate) => isValidKoreaMapCoordinate(candidate.location))?.location
        ?? (searchContext.target.kind !== 'current' && isValidKoreaMapCoordinate(searchContext.target)
          ? searchContext.target
          : undefined);
    } catch {
      resolvedTarget = searchContext.target.kind !== 'current' && isValidKoreaMapCoordinate(searchContext.target)
        ? searchContext.target
        : undefined;
    }

    if (!resolvedTarget) {
      setRequestSubmitting(false);
      setReplyNotice('문의할 장소를 찾지 못했어요. 장소명을 더 구체적으로 입력해주세요.');
      return;
    }

    const newRequest: ReportRequest = {
      id: `request-${Date.now()}`,
      question: clean,
      hint: '현장 답변을 기다리는 중',
      place: resolvedTarget.label,
      distance: '질문 지역',
      answers: 0,
      time: '방금',
      status: '답변 대기',
      mark: getRequestMark(clean),
      accent: '#f4f5f2',
      createdAt: new Date().toISOString(),
      source: 'local',
      syncState: 'pending',
      latitude: resolvedTarget.latitude,
      longitude: resolvedTarget.longitude,
    };

    onRequestsChange((prev) => [newRequest, ...prev]);
    setSelectedRequestId(newRequest.id);
    setRequestDraft('');
    setReplyNotice('문의가 올라갔어요. 답변이 달리면 문의하기에서 확인할 수 있어요.');

    createRemoteReportRequest(newRequest).then((remoteRequest) => {
      setRequestSubmitting(false);
      if (!remoteRequest) {
        onRequestsChange((prev) => prev.filter((request) => request.id !== newRequest.id));
        setReplyNotice('문의가 서버에 저장되지 않았어요. 연결을 확인한 뒤 다시 시도해주세요.');
        return;
      }
      onRequestsChange((prev) => replaceRequestById(prev, newRequest.id, {
        ...remoteRequest,
        source: 'local',
        syncState: 'synced',
      }));
      setSelectedRequestId(remoteRequest.id);
    }).catch(() => {
      setRequestSubmitting(false);
      onRequestsChange((prev) => prev.filter((request) => request.id !== newRequest.id));
      setReplyNotice('문의 저장 중 오류가 생겼어요. 잠시 뒤 다시 시도해주세요.');
    });
  };

  const submitReply = async () => {
    const clean = replyDraft.trim();
    if (replySubmitting) return;
    if (!selectedRequest) {
      setReplyNotice('답변할 질문을 다시 선택해주세요.');
      return;
    }
    if (!isQuestionActive(selectedRequest)) {
      setReplyNotice('답변 시간이 끝난 문의예요.');
      return;
    }
    if (!clean) {
      setReplyNotice('지금 보이는 날씨를 한 줄로 적어주세요.');
      return;
    }

    if (!hasUsableLocation(locationStatus)) {
      setReplyNotice('현장 답변은 현재 위치를 확인한 뒤 남길 수 있어요.');
      return;
    }

    if (!canAnswerQuestion(selectedRequest, locationStatus)) {
      setReplyNotice('질문 지역에서 약 3km 이내에 있을 때만 현장 답변을 남길 수 있어요.');
      return;
    }

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
      syncState: 'pending',
      latitude: locationStatus.latitude,
      longitude: locationStatus.longitude,
    };

    setReplySubmitting(true);
    setReplyNotice('현장 답변을 저장하고 있어요.');

    try {
      const response = await createRemoteFieldReportResult(replyReport);
      if (!response?.ok || !response.data) {
        setReplyNotice(getReplySaveErrorMessage(response?.error));
        return;
      }
      const remoteReport = response.data;

      onAddReport({ ...remoteReport, source: 'local', syncState: 'synced' });
      onRequestsChange((prev) => prev.map((request) => (
        request.id === selectedRequest.id
          ? {
              ...request,
              answers: request.answers + 1,
              status: `답변 ${request.answers + 1}개`,
              hint: '방금 답변',
            }
          : request
      )));
      setReplyDraft('');
      setReplyNotice(`${selectedRequest.place} 질문에 현장 답변을 남겼어요.`);
      setAnswerModalVisible(false);
    } catch {
      setReplyNotice('답변 저장 중 연결이 끊겼어요. 잠시 뒤 다시 시도해주세요.');
    } finally {
      setReplySubmitting(false);
    }
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
          <Text style={styles.reportHeaderTitle}>현장 날씨</Text>
          <Text style={styles.reportHeaderCaption}>궁금한 곳은 묻고, 가까운 곳은 직접 알려주세요</Text>
        </View>
      </View>

      <View style={styles.reportToggleShell}>
        <View style={styles.reportSegmented}>
          {reportTabs.map((tab) => {
            const selected = activeReportTab === tab.key;
            return (
              <Pressable
                key={tab.key}
                accessibilityLabel={`${tab.label} 보기`}
                accessibilityRole="tab"
                accessibilityState={{ selected }}
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
              locationReady={hasUsableLocation(locationStatus)}
              requests={answerableQuestions}
              onAnswer={openAnswerModal}
              onDeleteRequest={onDeleteRequest}
              onEditRequest={openEditRequest}
              onRefreshLocation={onRefreshLocation}
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
        replyNotice={replyNotice}
        locationMessage={answerLocationMessage}
        onRefreshLocation={onRefreshLocation}
        setReplyDraft={setReplyDraft}
        submitReply={submitReply}
        submitting={replySubmitting}
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

function hasUsableLocation(
  locationStatus: LocationStatus,
): locationStatus is LocationStatus & { latitude: number; longitude: number } {
  return Number.isFinite(locationStatus.latitude) && Number.isFinite(locationStatus.longitude);
}

function getAnswerLocationMessage(request: ReportRequest | undefined, locationStatus: LocationStatus) {
  if (!request) return '답변할 질문을 선택해주세요.';
  if (!isQuestionActive(request)) return '답변 시간이 끝난 문의예요.';
  if (!hasUsableLocation(locationStatus)) return '현재 위치를 확인할 수 없어 답변을 등록할 수 없어요.';
  if (!Number.isFinite(request.clusterLatitude) || !Number.isFinite(request.clusterLongitude)) {
    return '이 질문은 장소를 확인할 수 없어 답변을 등록할 수 없어요.';
  }

  const distanceMeters = getDistanceMeters(
    locationStatus.latitude,
    locationStatus.longitude,
    request.clusterLatitude!,
    request.clusterLongitude!,
  );

  if (distanceMeters > 3000) {
    const distanceLabel = distanceMeters >= 1000
      ? `약 ${(distanceMeters / 1000).toFixed(distanceMeters >= 10_000 ? 0 : 1)}km`
      : `약 ${Math.max(100, Math.round(distanceMeters / 100) * 100)}m`;
    return `현재 위치가 질문 지역에서 ${distanceLabel} 떨어져 있어요. 약 3km 안에서만 답변할 수 있어요.`;
  }

  return '질문 지역 근처로 확인됐어요. 지금 직접 본 날씨를 남겨주세요.';
}

function hasUsableLocationStatusForReply(message: string) {
  return !message.includes('현재 위치를 확인할 수 없어');
}

function getReplySaveErrorMessage(error?: string) {
  const normalizedError = error?.toLowerCase() ?? '';

  if (normalizedError.includes('within about 3 km')) {
    return '현재 위치가 질문 지역에서 약 3km 밖이라 답변을 등록할 수 없어요.';
  }
  if (normalizedError.includes('current location is required')) {
    return '현재 위치를 확인한 뒤 다시 답변해주세요.';
  }
  if (normalizedError.includes('question location cannot be verified')) {
    return '질문 장소를 확인할 수 없어 답변을 등록하지 못했어요.';
  }
  if (normalizedError.includes('report request not found')) {
    return '이미 삭제된 질문이에요. 질문 목록을 새로고침해주세요.';
  }
  if (normalizedError.includes('field question is closed')) {
    return '답변 시간이 끝난 문의예요.';
  }

  return '답변이 서버에 저장되지 않았어요. 연결을 확인한 뒤 다시 시도해주세요.';
}

function getDistanceMeters(latitudeA: number, longitudeA: number, latitudeB: number, longitudeB: number) {
  const earthRadiusMeters = 6371000;
  const toRadians = (value: number) => value * Math.PI / 180;
  const latitudeDelta = toRadians(latitudeB - latitudeA);
  const longitudeDelta = toRadians(longitudeB - longitudeA);
  const a = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(toRadians(latitudeA)) * Math.cos(toRadians(latitudeB))
    * Math.sin(longitudeDelta / 2) ** 2;

  return earthRadiusMeters * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
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
          <Text style={styles.reportAskKicker}>궁금한 지역의 지금 날씨를 물어보세요</Text>
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
      </View>

      {!!replyNotice && <Text style={styles.reportInlineNotice}>{replyNotice}</Text>}

      <View style={styles.reportPanelSectionHeader}>
        <Text style={styles.reportPanelSectionTitle}>내가 보낸 문의</Text>
        <Text style={styles.reportPanelSectionMeta}>{rows.length}개</Text>
      </View>
      <Text style={styles.reportInlineNotice}>
        답변이 달리면 문의를 눌러 한자리에서 확인할 수 있어요.
      </Text>
      <View style={styles.reportLiveFeed}>
        {rows.length > 0 ? rows.map((request) => (
            <ReportQuestionItem
              key={request.id}
              request={request}
              onDelete={onDeleteRequest}
              onEdit={onEditRequest}
              onPress={() => onOpenQuestion(request)}
              actionLabel={getQuestionStatus(request)}
              variant="mine"
            />
          )) : (
            <EmptyState
              title="아직 보낸 문의가 없어요"
              body="궁금한 지역과 현재 날씨를 적어 문의를 보내보세요."
            />
          )}
      </View>
    </>
  );
}

function QuestionsPanel({
  locationReady,
  onDeleteRequest,
  requests,
  onAnswer,
  onEditRequest,
  onRefreshLocation,
}: {
  locationReady: boolean;
  onDeleteRequest: (requestId: string) => void;
  requests: ReportRequest[];
  onAnswer: (request: ReportRequest) => void;
  onEditRequest: (request: ReportRequest) => void;
  onRefreshLocation: () => void;
}) {
  return (
    <>
      <View style={styles.reportPanelSectionHeader}>
        <Text style={styles.reportPanelSectionTitle}>가까운 현장 질문</Text>
        <Text style={styles.reportPanelSectionMeta}>3km 이내</Text>
      </View>
      <Text style={styles.reportInlineNotice}>
        현재 위치에서 직접 확인할 수 있는 질문만 보여드려요.
      </Text>
      {!locationReady ? (
        <>
          <EmptyState
            title="현재 위치 확인이 필요해요"
            body="현장 답변은 질문 지역 3km 안에서만 남길 수 있어요."
          />
          <Pressable onPress={onRefreshLocation} style={styles.replyLocationRetryButton}>
            <Text style={styles.replyLocationRetryText}>위치 다시 확인</Text>
          </Pressable>
        </>
      ) : requests.length > 0 ? (
        <View style={styles.reportLiveFeed}>
          {requests.map((request) => (
            <ReportQuestionItem
              key={request.id}
              request={request}
              onDelete={onDeleteRequest}
              onEdit={onEditRequest}
              onPress={() => onAnswer(request)}
              actionLabel={request.answers > 0 ? `답변 ${request.answers}개 · 답변 남기기` : '현장 답변 남기기'}
              variant={request.answers > 0 ? 'answered' : 'open'}
            />
          ))}
        </View>
      ) : (
        <EmptyState
          title="근처에 답변할 질문이 없어요"
          body="위치를 새로 확인하거나 잠시 뒤 다시 살펴보세요."
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
        <Text style={styles.reportPanelSectionTitle}>최신 현장 소식</Text>
        <Text style={styles.reportPanelSectionMeta}>최근 24시간</Text>
      </View>
      {reports.length > 0 ? (
        <View style={styles.reportLiveFeed}>
          {reports.map((report, index) => (
            <FieldReportPost
              key={`${report.id ?? report.place}-${report.body}-${index}`}
              report={report}
              onDeleteReport={onDeleteReport}
              onEditReport={onEditReport}
              onReportIssue={onReportIssue}
            />
          ))}
        </View>
      ) : (
        <EmptyState
          title="아직 현장 소식이 없어요"
          body="현재 위치 제보나 문의 답변이 등록되면 최신순으로 보여드려요."
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
            <Text style={styles.reportMetaSmall}>
              {formatPostTime(request.createdAt)} · {variant !== 'mine' && request.distance ? `${request.distance} · ` : ''}{getQuestionStatus(request)}
            </Text>
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
  onDeleteReport,
  onEditReport,
  onReportIssue,
  report,
}: {
  onDeleteReport: (reportId: string) => void;
  onEditReport: (report: LocalReport) => void;
  onReportIssue: (report: LocalReport) => void;
  report: LocalReport;
}) {
  const canEdit = report.source === 'local' && Boolean(report.id);

  return (
    <View style={styles.reportPostCard}>
      <View style={styles.reportPostHead}>
        <View style={styles.reportAuthorRow}>
          <View style={styles.reportAvatar} />
          <View>
            <Text style={styles.reportAuthorName}>{report.place}</Text>
            <Text style={styles.reportMetaSmall}>
              {report.requestId ? '문의 답변' : '현장 제보'} · {formatPostTime(report.createdAt)}
            </Text>
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
              {report.moderationStatus === 'pending' ? '신고 접수됨' : '신고'}
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
  locationMessage,
  onClose,
  onRefreshLocation,
  replyDraft,
  replyNotice,
  replies,
  request,
  setReplyDraft,
  submitReply,
  submitting,
  visible,
}: {
  locationMessage: string;
  onClose: () => void;
  onRefreshLocation: () => void;
  replyDraft: string;
  replyNotice: string;
  replies: LocalReport[];
  request?: ReportRequest;
  setReplyDraft: (value: string) => void;
  submitReply: () => void;
  submitting: boolean;
  visible: boolean;
}) {
  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onClose}>
      <View style={styles.reportModalBackdrop}>
        <View style={styles.reportModalCard}>
          <Text style={styles.replyEyebrow}>선택한 질문에 답변쓰기</Text>
          <Text style={styles.replyQuestion}>{request?.question ?? '질문을 선택해주세요'}</Text>
          <Text style={styles.replyNotice}>{locationMessage}</Text>
          {!hasUsableLocationStatusForReply(locationMessage) ? (
            <Pressable onPress={onRefreshLocation} style={styles.replyLocationRetryButton}>
              <Text style={styles.replyLocationRetryText}>위치 다시 확인</Text>
            </Pressable>
          ) : null}
          {!!replyNotice && <Text style={styles.replyFeedback}>{replyNotice}</Text>}
          <ReplyList replies={replies} emptyText={request?.answers ? '답변을 불러오는 중이에요.' : '아직 현장 답변이 없어요.'} />
          <TextInput
            multiline
            value={replyDraft}
            onChangeText={setReplyDraft}
            placeholder="예: 지금은 비 거의 안 오고 바닥만 조금 젖어 있어요."
            placeholderTextColor="#8f7f87"
            style={styles.replyInput}
          />
          <Pressable
            disabled={submitting}
            onPress={submitReply}
            style={[styles.replySubmitButton, submitting && { opacity: 0.55 }]}
          >
            <Text style={styles.replySubmitText}>
              {submitting ? '저장 중...' : '현장 답변 남기기'}
            </Text>
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

function orderLiveReports(reports: LocalReport[]) {
  return visibleReportsOnly(reports).sort((a, b) => {
    const left = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const right = b.createdAt ? new Date(b.createdAt).getTime() : 0;

    return right - left;
  });
}
