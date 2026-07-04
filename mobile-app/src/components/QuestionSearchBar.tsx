import { useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { styles } from '../styles/appStyles';

type QuestionSearchBarProps = {
  isBusy?: boolean;
  value: string;
  onChangeText: (value: string) => void;
  onSubmit: (query?: string) => void;
};

const timeOptions = ['지금', '오늘 밤', '내일 오전', '내일 오후'];

export function QuestionSearchBar({
  isBusy = false,
  value,
  onChangeText,
  onSubmit,
}: QuestionSearchBarProps) {
  const [selectedTime, setSelectedTime] = useState(timeOptions[0]);
  const submitStructuredSearch = () => {
    const place = value.trim();

    if (!place) return;

    onSubmit(`${place} ${selectedTime} 날씨`);
  };

  return (
    <View>
      <View style={styles.searchBox}>
        <Text style={styles.searchIcon}>⌕</Text>
        <TextInput
          editable={!isBusy}
          value={value}
          onChangeText={onChangeText}
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
          disabled={isBusy}
          onPress={submitStructuredSearch}
          style={[styles.searchSubmit, isBusy && styles.searchSubmitDisabled]}
        >
          <Text style={styles.searchSubmitText}>{isBusy ? '…' : '↗'}</Text>
        </Pressable>
      </View>

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
