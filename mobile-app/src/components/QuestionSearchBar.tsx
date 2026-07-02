import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { styles } from '../styles/appStyles';

type QuestionSearchBarProps = {
  isBusy?: boolean;
  suggestions: string[];
  value: string;
  onChangeText: (value: string) => void;
  onPickSuggestion: (value: string) => void;
  onSubmit: () => void;
};

export function QuestionSearchBar({
  isBusy = false,
  suggestions,
  value,
  onChangeText,
  onPickSuggestion,
  onSubmit,
}: QuestionSearchBarProps) {
  return (
    <View>
      <View style={styles.searchBox}>
        <Text style={styles.searchIcon}>⌕</Text>
        <TextInput
          editable={!isBusy}
          value={value}
          onChangeText={onChangeText}
          onSubmitEditing={onSubmit}
          placeholder="잠실운동장 지금 비 와?"
          placeholderTextColor="rgba(34,36,38,0.36)"
          returnKeyType="search"
          style={styles.searchInput}
        />
        <Pressable
          accessibilityLabel="질문 검색"
          accessibilityRole="button"
          disabled={isBusy}
          onPress={onSubmit}
          style={[styles.searchSubmit, isBusy && styles.searchSubmitDisabled]}
        >
          <Text style={styles.searchSubmitText}>{isBusy ? '…' : '↗'}</Text>
        </Pressable>
      </View>

      {false && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.searchSuggestionList}
        >
          {suggestions.map((suggestion) => (
            <Pressable
              key={suggestion}
              accessibilityLabel={`${suggestion} 질문하기`}
              accessibilityRole="button"
              disabled={isBusy}
              onPress={() => onPickSuggestion(suggestion)}
              style={[styles.searchSuggestionChip, isBusy && styles.searchSuggestionChipDisabled]}
            >
              <Text style={styles.searchSuggestionText}>{suggestion}</Text>
            </Pressable>
          ))}
        </ScrollView>
      )}
    </View>
  );
}
