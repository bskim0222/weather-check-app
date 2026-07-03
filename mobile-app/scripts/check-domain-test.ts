import {
  createDefaultJudgement,
  createQuestionJudgement,
  updateJudgementLocation,
  updateJudgementWeather,
} from '../src/domain/judgement';
import { getCompareFocusText, getContextualCompareRows } from '../src/domain/compare';
import { markReportHidden, markReportPending, visibleReportsOnly } from '../src/domain/moderation';
import { createProviderAdjustedPreset } from '../src/domain/providerJudgement';
import { getMockFieldReportSnapshot, normalizeFieldReportSnapshot } from '../src/services/fieldReports';
import {
  getMockProviderCompareRows,
  getMockWeatherProviderSnapshot,
  normalizeProviderSnapshot,
} from '../src/services/weatherProviders';

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
expectEqual(golfMorningJudgement.searchContext.needsClarification, true, 'golf question needs place clarification');

const gimpoTonightJudgement = createQuestionJudgement('김포시 오늘밤 날씨');
expectEqual(gimpoTonightJudgement.searchContext.locationQuery, '김포시', 'gimpo question location query');
expectEqual(gimpoTonightJudgement.searchContext.place, '현재 위치', 'gimpo question waits for geocoding');

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
const dailyRows = getMockProviderCompareRows(snowJudgement.searchContext, 'daily');
expectTruthy(hourlyRows.length > 0, 'hourly compare rows');
expectTruthy(dailyRows.length > 0, 'daily compare rows');
expectTruthy(getCompareFocusText(snowJudgement.searchContext).includes('눈'), 'compare focus text');

const providerSnapshot = getMockWeatherProviderSnapshot(snowJudgement.searchContext);
expectEqual(providerSnapshot.source, 'mock', 'provider snapshot source');
expectEqual(providerSnapshot.context.place, '석촌호수', 'provider snapshot context');
expectEqual(providerSnapshot.summaries.length, 3, 'provider summary count');
expectEqual(providerSnapshot.differences.length, 3, 'provider difference count');
expectTruthy(providerSnapshot.hourlyRows.length > 0, 'provider hourly rows');
expectTruthy(providerSnapshot.dailyRows.length > 0, 'provider daily rows');

const adjustedPreset = createProviderAdjustedPreset(defaultJudgement.preset, {
  ...providerSnapshot,
  sources: [
    { ...providerSnapshot.sources[0], condition: '흐림', temp: '24℃' },
    { ...providerSnapshot.sources[1], condition: '흐림', temp: '25℃' },
    { ...providerSnapshot.sources[2], condition: '비', temp: '23℃' },
  ],
});
expectEqual(adjustedPreset.condition, '흐림', 'provider adjusted condition');
expectEqual(adjustedPreset.temp, 24, 'provider adjusted temperature');
expectEqual(adjustedPreset.sources[1].temp, '25℃', 'provider adjusted source temp');

const fieldSnapshot = getMockFieldReportSnapshot([], snowJudgement.searchContext);
expectEqual(fieldSnapshot.source, 'mock', 'field snapshot source');
expectEqual(fieldSnapshot.context.place, '석촌호수', 'field snapshot context');
expectTruthy(fieldSnapshot.reports.length > 0, 'field snapshot reports');
expectTruthy(fieldSnapshot.requests.length > 0, 'field snapshot requests');

const normalizedProviderSnapshot = normalizeProviderSnapshot(
  { ...providerSnapshot, source: 'api' },
  defaultJudgement.searchContext,
);
expectEqual(normalizedProviderSnapshot.source, 'api', 'normalized provider source');
expectEqual(normalizedProviderSnapshot.context.place, '석촌호수', 'normalized provider context');

const normalizedFieldSnapshot = normalizeFieldReportSnapshot(
  { ...fieldSnapshot, source: 'api' },
  defaultJudgement.searchContext,
);
expectEqual(normalizedFieldSnapshot.source, 'api', 'normalized field source');
expectEqual(normalizedFieldSnapshot.context.place, '석촌호수', 'normalized field context');

const moderationReports = [
  { id: 'visible-report', place: 'A', time: 'now', condition: 'clear', body: 'visible', moderationStatus: 'visible' as const },
  { id: 'hidden-report', place: 'B', time: 'now', condition: 'rain', body: 'hidden', moderationStatus: 'hidden' as const },
];
expectEqual(visibleReportsOnly(moderationReports).length, 1, 'visible moderation reports');
expectEqual(markReportPending(moderationReports, 'visible-report')[0].moderationStatus, 'pending', 'pending moderation report');
expectEqual(markReportHidden(moderationReports, 'visible-report')[0].moderationStatus, 'hidden', 'hidden moderation report');

console.log('Domain smoke checks passed.');
