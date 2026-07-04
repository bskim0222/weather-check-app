import { useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { searchRemotePlaces, type PlaceCandidate } from '../services/geocoding';
import { styles } from '../styles/appStyles';
import type { LocationReference } from '../types/weather';

type QuestionSearchBarProps = {
  isBusy?: boolean;
  value: string;
  onChangeText: (value: string) => void;
  onSubmit: (query?: string, location?: LocationReference) => void;
};

const timeOptions = ['지금', '오늘 밤', '내일 오전', '내일 오후'];

export function QuestionSearchBar({
  isBusy = false,
  value,
  onChangeText,
  onSubmit,
}: QuestionSearchBarProps) {
  const [selectedTime, setSelectedTime] = useState(timeOptions[0]);
  const [placeCandidates, setPlaceCandidates] = useState<PlaceCandidate[]>([]);
  const [isSearchingPlace, setIsSearchingPlace] = useState(false);

  const submitStructuredSearch = async () => {
    const place = value.trim();

    if (!place) return;

    const query = `${place} ${selectedTime} 날씨`;

    setIsSearchingPlace(true);
    const candidates = await searchRemotePlaces(place, query);
    setIsSearchingPlace(false);

    if (candidates.length === 1) {
      setPlaceCandidates([]);
      onSubmit(query, candidates[0].location);
      return;
    }

    if (candidates.length > 1) {
      setPlaceCandidates(candidates.slice(0, 4));
      return;
    }

    setPlaceCandidates([]);
    onSubmit(query);
  };

  const submitCandidate = (candidate: PlaceCandidate) => {
    const query = `${candidate.location.label} ${selectedTime} 날씨`;

    setPlaceCandidates([]);
    onChangeText(candidate.location.label);
    onSubmit(query, candidate.location);
  };

  return (
    <View>
      <View style={styles.searchBox}>
        <Text style={styles.searchIcon}>⌕</Text>
        <TextInput
          editable={!isBusy}
          value={value}
          onChangeText={(nextValue) => {
            setPlaceCandidates([]);
            onChangeText(nextValue);
          }}
          onSubmitEditing={submitStructuredSearch}
          selectTextOnFocus
          placeholder="장소를 입력하세요. 예: 광화문"
          placeholderTextColor="rgba(34,36,38,0.36)"
          returnKeyType="search"
          style={styles.searchInput}
        />
        <Pressable
          accessibilityLabel="질문 검색"
          accessibilityRole="button"
          disabled={isBusy || isSearchingPlace}
          onPress={submitStructuredSearch}
          style={[styles.searchSubmit, (isBusy || isSearchingPlace) && styles.searchSubmitDisabled]}
        >
          <Text style={styles.searchSubmitText}>{isBusy || isSearchingPlace ? '…' : '↗'}</Text>
        </Pressable>
      </View>

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
              <Text style={styles.placeCandidateAction}>보기</Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.searchSuggestionList}
      >
        {timeOptions.map((option) => {
          const isActive = selectedTime === option;

          return (
            <Pressable
              key={option}
              accessibilityLabel={`${option} 기준으로 보기`}
              accessibilityRole="button"
              disabled={isBusy}
              onPress={() => setSelectedTime(option)}
              style={[
                styles.searchSuggestionChip,
                isActive && styles.searchSuggestionChipActive,
                isBusy && styles.searchSuggestionChipDisabled,
              ]}
            >
              <Text style={[styles.searchSuggestionText, isActive && styles.searchSuggestionTextActive]}>
                {option}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

    </View>
  );
}
