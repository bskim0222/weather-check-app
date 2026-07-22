import Ionicons from '@expo/vector-icons/Ionicons';
import { useRef, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { searchRemotePlaces, type PlaceCandidate } from '../services/geocoding';
import { styles } from '../styles/appStyles';
import type { LocationReference } from '../types/weather';

type QuestionSearchBarProps = {
  isBusy?: boolean;
  value: string;
  onChangeText: (value: string) => void;
  onSubmit: (query?: string, location?: LocationReference) => void;
};

export function QuestionSearchBar({
  isBusy = false,
  value,
  onChangeText,
  onSubmit,
}: QuestionSearchBarProps) {
  const [placeCandidates, setPlaceCandidates] = useState<PlaceCandidate[]>([]);
  const [isSearchingPlace, setIsSearchingPlace] = useState(false);
  const inputRef = useRef<TextInput>(null);

  const submitStructuredSearch = async () => {
    const query = value.trim();
    const place = normalizePlaceInput(value);

    if (!query || !place) return;

    setIsSearchingPlace(true);
    let candidates: PlaceCandidate[] = [];

    try {
      candidates = await searchRemotePlaces(place, query);
    } finally {
      setIsSearchingPlace(false);
    }

    if (candidates.length === 1) {
      setPlaceCandidates([]);
      onSubmit(query, candidates[0].location);
      return;
    }

    if (candidates.length > 1) {
      setPlaceCandidates(candidates.slice(0, 6));
      return;
    }

    setPlaceCandidates([]);
    onSubmit(query);
  };

  const refineSearch = () => {
    setPlaceCandidates([]);
    inputRef.current?.focus();
  };

  const submitCandidate = (candidate: PlaceCandidate) => {
    const query = value.trim() || candidate.location.label;

    setPlaceCandidates([]);
    onChangeText(query);
    onSubmit(query, candidate.location);
  };

  return (
    <View>
      <View style={styles.searchBox}>
        <Ionicons color="rgba(25,28,27,0.62)" name="search" size={23} style={styles.searchIcon} />
        <TextInput
          ref={inputRef}
          accessibilityLabel="날씨를 확인할 장소와 시간"
          editable={!isBusy}
          value={value}
          onChangeText={(nextValue) => {
            setPlaceCandidates([]);
            onChangeText(nextValue);
          }}
          onSubmitEditing={submitStructuredSearch}
          selectTextOnFocus
          placeholder="예: 서서울CC 내일 오전 9시"
          placeholderTextColor="rgba(34,36,38,0.36)"
          returnKeyType="search"
          style={styles.searchInput}
        />
        <Pressable
          accessibilityLabel="장소와 시간 검색"
          accessibilityRole="button"
          disabled={isBusy || isSearchingPlace}
          onPress={submitStructuredSearch}
          style={[styles.searchSubmit, (isBusy || isSearchingPlace) && styles.searchSubmitDisabled]}
        >
          <Text style={styles.searchSubmitText}>{isBusy || isSearchingPlace ? '…' : '↗'}</Text>
        </Pressable>
      </View>

      {isSearchingPlace ? (
        <View accessibilityLiveRegion="polite" style={styles.searchProgressNotice}>
          <Ionicons color="rgba(25,28,27,0.62)" name="location-outline" size={15} />
          <Text style={styles.searchProgressNoticeText}>
            장소를 찾고 있어요. 아래 날씨는 검색 전 결과예요.
          </Text>
        </View>
      ) : null}

      {placeCandidates.length > 0 ? (
        <View style={styles.placeCandidatePanel}>
          <Text style={styles.placeCandidateTitle}>어느 장소로 볼까요?</Text>
          {placeCandidates.map((candidate) => (
            <Pressable
              key={`${candidate.location.id}-${candidate.location.latitude}-${candidate.location.longitude}`}
              accessibilityRole="button"
              onPress={() => submitCandidate(candidate)}
              style={styles.placeCandidateRow}
            >
              <View style={styles.placeCandidateTextWrap}>
                <Text style={styles.placeCandidateName}>{candidate.location.label}</Text>
                {candidate.subtitle ? (
                  <Text style={styles.placeCandidateSubtitle}>{candidate.subtitle}</Text>
                ) : null}
              </View>
              <Text style={styles.placeCandidateAction}>날씨 보기</Text>
            </Pressable>
          ))}
          <Pressable
            accessibilityRole="button"
            onPress={refineSearch}
            style={styles.placeCandidateRow}
          >
            <View style={styles.placeCandidateTextWrap}>
              <Text style={styles.placeCandidateName}>원하는 장소가 없어요</Text>
              <Text style={styles.placeCandidateSubtitle}>
                장소명을 더 자세히 입력해볼게요
              </Text>
            </View>
            <Text style={styles.placeCandidateAction}>수정</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

function normalizePlaceInput(value: string) {
  return value
    .replace(/[?？!！]/g, ' ')
    .replace(/(오늘\s*밤|내일\s*오전|내일\s*오후|오늘|내일|모레|주말|아침|오전|오후|저녁|밤|새벽|점심|낮|퇴근길|지금|\d{1,2}\s*시)/g, ' ')
    .replace(/\s*(날씨|비\s*(?:와|오|올|내리|안|소식)|눈\s*(?:와|오|올|내리|안|소식)|안개|기온|우산|소나기|천둥|번개|흐림|맑음|바람).*$/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
