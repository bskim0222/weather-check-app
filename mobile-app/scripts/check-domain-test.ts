import {
  createDefaultJudgement,
  createQuestionJudgement,
  updateJudgementLocation,
  updateJudgementWeather,
} from '../src/domain/judgement';
import { getCompareFocusText, getContextualCompareRows } from '../src/domain/compare';
import { markReportHidden, markReportPending, visibleReportsOnly } from '../src/domain/moderation';
import { createProviderAdjustedPreset } from '../src/domain/providerJudgement';
import { weatherPresets } from '../src/data/mockWeather';
import {
  getUnavailableWeatherProviderSnapshot,
  normalizeProviderSnapshot,
  type WeatherProviderSnapshot,
} from '../src/services/weatherProviders';
import { getUnavailableFieldReportSnapshot } from '../src/services/fieldReports';

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

const alignedSnapshot: WeatherProviderSnapshot = {
  context: defaultJudgement.searchContext,
  generatedAt: new Date().toISOString(),
  source: 'api',
  meta: {
    providerMode: 'live',
    liveProviderIds: ['kma', 'yr', 'fmi'],
    fallbackProviderIds: [],
    thirdProviderId: 'fmi',
  },
  sources: weatherPresets.rain.sources,
  summaries: [],
  differences: [],
  hourlyRows: [
    {
      label: '지금',
      forecastKey: '2026-07-21T15',
      kma: { mark: 'K', weather: '비', detail: '29°C · 강수 0.5mm', tone: '#aaa' },
      yr: { mark: '-', weather: '자료 없음', detail: '해당 시각 제공값 없음', tone: '#aaa' },
      windy: { mark: 'FMI', weather: '자료 없음', detail: '해당 시각 제공값 없음', tone: '#aaa' },
      fmi: { mark: 'FMI', weather: '자료 없음', detail: '해당 시각 제공값 없음', tone: '#aaa' },
    },
  ],
  dailyRows: [],
};
const alignedPreset = createProviderAdjustedPreset(weatherPresets.rain, alignedSnapshot);
expectEqual(alignedPreset.condition, '비', 'missing providers do not cast fallback cloudy votes');
expectEqual(alignedPreset.temp, 29, 'representative temperature uses aligned usable cells only');
expectEqual(alignedPreset.sources[0].condition, '비', 'summary first source uses aligned row');
expectEqual(alignedPreset.sources[1].condition, '자료 없음', 'summary second source remains explicit');
expectEqual(alignedPreset.sources[2].condition, '자료 없음', 'summary missing source remains explicit');
expectEqual(alignedPreset.sources[1].temp, '--', 'live missing temperature never falls back to an unrelated value');
expectEqual(alignedPreset.forecastRows.length, 1, 'live forecast rows never append mock hours');
expectTruthy(!alignedPreset.summary.includes('자료 없음'), 'missing provider excluded from summary sentence');

const unavailableSnapshot = getUnavailableWeatherProviderSnapshot(defaultJudgement.searchContext);
expectEqual(unavailableSnapshot.source, 'unavailable', 'unavailable snapshot source');
expectEqual(unavailableSnapshot.hourlyRows.length, 0, 'unavailable snapshot has no fake hourly rows');
expectEqual(unavailableSnapshot.sources.length, 0, 'unavailable snapshot has no fake provider cards');

const unavailableReports = getUnavailableFieldReportSnapshot(defaultJudgement.searchContext);
expectEqual(unavailableReports.source, 'unavailable', 'unavailable field report source');
expectEqual(unavailableReports.reports.length, 0, 'unavailable field reports contain no samples');
expectEqual(unavailableReports.requests.length, 0, 'unavailable report requests contain no samples');

const emptyApiSnapshot = normalizeProviderSnapshot(
  {
    context: defaultJudgement.searchContext,
    generatedAt: new Date().toISOString(),
    source: 'api',
    sources: [],
    summaries: [],
    differences: [],
    hourlyRows: [],
    dailyRows: [],
  },
  defaultJudgement.searchContext,
);
expectEqual(emptyApiSnapshot.hourlyRows.length, 0, 'empty API response does not receive mock hourly rows');
expectEqual(emptyApiSnapshot.sources.length, 0, 'empty API response does not receive mock provider cards');
expectEqual(emptyApiSnapshot.source, 'unavailable', 'empty API response is explicitly unavailable');

const threeProviderSnapshot: WeatherProviderSnapshot = {
  ...alignedSnapshot,
  hourlyRows: [
    {
      label: '지금',
      forecastKey: '2026-07-21T15',
      kma: { mark: 'K', weather: '흐림', detail: '29°C · 강수 0mm', tone: '#aaa' },
      yr: { mark: 'Yr', weather: '흐림', detail: '28°C · 강수 0mm', tone: '#aaa' },
      windy: { mark: 'FMI', weather: '비', detail: '27°C · 강수 0.2mm', tone: '#aaa' },
      fmi: { mark: 'FMI', weather: '비', detail: '27°C · 강수 0.2mm', tone: '#aaa' },
    },
  ],
};
const threeProviderPreset = createProviderAdjustedPreset(weatherPresets.rain, threeProviderSnapshot);
expectTruthy(threeProviderPreset.summary.includes('대한민국 기상청 흐림 29°C'), 'summary names KMA correctly');
expectTruthy(threeProviderPreset.summary.includes('노르웨이 기상청 흐림 28°C'), 'summary names Norway correctly');
expectTruthy(threeProviderPreset.summary.includes('핀란드 기상청 비 27°C'), 'summary names Finland correctly');

console.log('Domain smoke checks passed.');
