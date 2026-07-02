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
  const [selectedRequestId, setSelectedRequestId] = useState(requests[0]?.id ?? '');
  const [replyNotice, setReplyNotice] = useState('');

  const fieldSnapshot = useMemo(
    () => getMockFieldReportSnapshot(reports, searchContext, requests),
    [reports, requests, searchContext],
  );
  const orderedReports = fieldSnapshot.reports;
  const orderedRequests = fieldSnapshot.requests;
  const selectedRequest = useMemo(
    () => orderedRequests.find((request) => request.id === selectedRequestId),
    [orderedRequests, selectedRequestId],
  );

  useEffect(() => {
    if (orderedRequests.length === 0) {
      setSelectedRequestId('');
      return;
    }

    const selectedRequestExists = orderedRequests.some((request) => request.id === selectedRequestId);
    if (!selectedRequestExists) {
      setSelectedRequestId(orderedRequests[0].id);
    }
  }, [orderedRequests, searchContext.detectedWeather, searchContext.place, searchContext.timeLabel, selectedRequestId]);

  const addRequest = () => {
    const clean = requestDraft.trim();
    if (!clean) return;

    const newRequest: ReportRequest = {
      id: `request-${Date.now()}`,
      question: clean,
      hint: `${searchContext.place} · ${searchContext.detectedWeather} 확인 요청`,
      place: searchContext.place === '현재 위치' ? '내가 궁금한 장소' : searchContext.place,
      distance: '주변',
      answers: 0,
      time: '방금',
      status: '답변 대기',
      mark: '새',
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
          {searchContext.place} 근처 사람에게 묻고, 지금 본 날씨로 답해요.
        </Text>
        <View style={styles.reportGuide}>
          <View style={styles.reportStep}>
            <Text style={styles.reportStepLabel}>요청</Text>
            <Text style={styles.reportStepText}>장소를 올림</Text>
          </View>
          <View style={styles.reportStep}>
            <Text style={styles.reportStepLabel}>답변</Text>
            <Text style={styles.reportStepText}>근처가 확인</Text>
          </View>
          <View style={styles.reportStep}>
            <Text style={styles.reportStepLabel}>반영</Text>
            <Text style={styles.reportStepText}>판정에 사용</Text>
          </View>
        </View>
        <View style={styles.requestForm}>
          <TextInput
            value={requestDraft}
            onChangeText={setRequestDraft}
            placeholder={`예: ${searchContext.place} 지금 ${searchContext.detectedWeather} 맞아요?`}
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
        <Text style={styles.reportSectionAction}>근처순</Text>
      </View>

      {orderedRequests.length > 0 ? (
        <View style={styles.requestList}>
          {orderedRequests.map((request) => {
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
        <Text style={styles.reportSectionTitle}>방금 올라온 현장 글</Text>
        <Text style={styles.reportSectionAction}>지도에서 보기</Text>
      </View>

      {orderedReports.length > 0 ? (
        <View style={styles.liveReportList}>
          {orderedReports.map((report, index) => (
            <View key={`${report.place}-${report.body}-${index}`} style={styles.liveReportItem}>
              <View>
                <Text style={styles.liveReportPlace}>{report.place}</Text>
                <Text style={styles.liveReportBody}>
                  {report.time} · {report.body}
                </Text>
              </View>
              <View style={styles.reportSide}>
                <Text style={styles.liveReportCondition}>{report.condition}</Text>
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
