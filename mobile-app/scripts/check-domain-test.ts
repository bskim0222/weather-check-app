import {
  createDefaultJudgement,
  createQuestionJudgement,
  updateJudgementLocation,
  updateJudgementWeather,
} from '../src/domain/judgement';
import { getCompareFocusText, getContextualCompareRows } from '../src/domain/compare';
import { markReportHidden, markReportPending, visibleReportsOnly } from '../src/domain/moderation';

function expectEqual<T>(actual: T, expected: T, label: string) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${String(expected)}, got ${String(actual)}`);
  }
}

function expectTruthy(value: unknown, label: string) {
  if (!value) {
    throw new Error(`${label}: expected truthy value`);
  }
}

const defaultJudgement = createDefaultJudgement();
expectEqual(defaultJudgement.weatherKey, 'rain', 'default weather');
expectEqual(defaultJudgement.searchContext.place, '현재 위치', 'default place');
expectEqual(defaultJudgement.searchContext.target.kind, 'current', 'default target kind');
expectEqual(defaultJudgement.searchContext.detectedWeather, '비', 'default detected weather');

const snowJudgement = createQuestionJudgement('석촌호수 내일 눈 와?');
expectEqual(snowJudgement.weatherKey, 'snow', 'snow question weather');
expectEqual(snowJudgement.searchContext.place, '석촌호수', 'snow question place');
expectEqual(snowJudgement.searchContext.target.id, 'seokchon-lake', 'snow question target');
expectEqual(snowJudgement.searchContext.timeLabel, '내일', 'snow question time');
expectEqual(snowJudgement.searchContext.detectedWeather, '눈', 'snow question detected weather');

const thunderJudgement = createQuestionJudgement('잠실새내역 퇴근길 천둥번개 들려?');
expectEqual(thunderJudgement.weatherKey, 'thunder', 'thunder question weather');
expectEqual(thunderJudgement.searchContext.place, '잠실새내역', 'thunder question place');
expectEqual(thunderJudgement.searchContext.target.id, 'jamsil-sae-nae', 'thunder question target');
expectEqual(thunderJudgement.searchContext.timeLabel, '퇴근길', 'thunder question time');

const busanTomorrowAfternoonJudgement = createQuestionJudgement('부산 내일 오후에 비 올 것 같아?');
expectEqual(busanTomorrowAfternoonJudgement.weatherKey, 'rain', 'busan question weather');
expectEqual(busanTomorrowAfternoonJudgement.searchContext.place, '부산', 'busan question place');
expectEqual(busanTomorrowAfternoonJudgement.searchContext.target.id, 'busan', 'busan question target');
expectEqual(busanTomorrowAfternoonJudgement.searchContext.timeLabel, '내일 오후', 'busan question time');
expectEqual(busanTomorrowAfternoonJudgement.searchContext.needsClarification, false, 'busan question clarification');

const golfMorningJudgement = createQuestionJudgement('내일 아침7시에 골프칠건데 용인cc에 비가 올까? 기온은 어느정도일거같아?');
expectEqual(golfMorningJudgement.weatherKey, 'rain', 'golf question weather');
expectEqual(golfMorningJudgement.searchContext.locationQuery, '용인cc', 'golf question location query');
expectEqual(golfMorningJudgement.searchContext.timeLabel, '내일 07시', 'golf question exact time');
expectEqual(golfMorningJudgement.searchContext.needsClarification, false, 'golf question has a usable place candidate');

const gimpoTonightJudgement = createQuestionJudgement('김포시 오늘밤 날씨');
expectEqual(gimpoTonightJudgement.searchContext.locationQuery, '김포시', 'gimpo question location query');
expectEqual(gimpoTonightJudgement.searchContext.place, '김포시', 'gimpo question place');

const seoraksanTomorrowJudgement = createQuestionJudgement('설악산 내일 날씨 어때?');
expectEqual(seoraksanTomorrowJudgement.searchContext.locationQuery, '설악산', 'seoraksan question location query');

const cheongwadaeNowJudgement = createQuestionJudgement('청와대 지금 비 와?');
expectEqual(cheongwadaeNowJudgement.searchContext.locationQuery, '청와대', 'cheongwadae question location query');

const gwanghwamunNowJudgement = createQuestionJudgement('광화문 지금 비 와?');
expectEqual(gwanghwamunNowJudgement.searchContext.locationQuery, '광화문', 'gwanghwamun question location query');
expectEqual(gwanghwamunNowJudgement.searchContext.place, '광화문', 'gwanghwamun question place');

const unknownBuildingJudgement = createQuestionJudgement('테스트빌딩 오늘 밤 기온 어때?');
expectEqual(unknownBuildingJudgement.searchContext.locationQuery, '테스트빌딩', 'unknown building location query');
expectEqual(unknownBuildingJudgement.searchContext.place, '테스트빌딩', 'unknown building keeps candidate place');
expectEqual(unknownBuildingJudgement.searchContext.target.kind, 'pending-place', 'unknown building waits for geocoding');

const kyoboTonightJudgement = createQuestionJudgement('종로 교보빌딩 오늘 밤 기온 어때?');
expectEqual(kyoboTonightJudgement.searchContext.locationQuery, '종로 교보빌딩', 'kyobo building question location query');

const dumulmeoriRainJudgement = createQuestionJudgement('두물머리 주말에 비 올까?');
expectEqual(dumulmeoriRainJudgement.searchContext.locationQuery, '두물머리', 'dumulmeori question location query');

const manualJudgement = updateJudgementWeather(snowJudgement, 'fog');
expectEqual(manualJudgement.weatherKey, 'fog', 'manual weather');
expectEqual(manualJudgement.searchContext.detectedWeather, '안개', 'manual detected weather');

const locatedJudgement = updateJudgementLocation(defaultJudgement, {
  phase: 'granted',
  label: 'located',
  message: 'located',
  latitude: 37.5,
  longitude: 127.1,
  source: 'native',
});
expectEqual(locatedJudgement.searchContext.target.latitude, 37.5, 'located latitude');
expectEqual(locatedJudgement.searchContext.target.longitude, 127.1, 'located longitude');

const hourlyRows = getContextualCompareRows('눈', 'hourly');
const dailyRows = getContextualCompareRows('눈', 'daily');
expectTruthy(hourlyRows.length > 0, 'hourly compare rows');
expectTruthy(dailyRows.length > 0, 'daily compare rows');
expectTruthy(getCompareFocusText(snowJudgement.searchContext).includes('눈'), 'compare focus text');

const moderationReports = [
  { id: 'visible-report', place: 'A', time: 'now', condition: 'clear', body: 'visible', moderationStatus: 'visible' as const },
  { id: 'hidden-report', place: 'B', time: 'now', condition: 'rain', body: 'hidden', moderationStatus: 'hidden' as const },
];
expectEqual(visibleReportsOnly(moderationReports).length, 1, 'visible moderation reports');
expectEqual(markReportPending(moderationReports, 'visible-report')[0].moderationStatus, 'pending', 'pending moderation report');
expectEqual(markReportHidden(moderationReports, 'visible-report')[0].moderationStatus, 'hidden', 'hidden moderation report');

console.log('Domain smoke checks passed.');
