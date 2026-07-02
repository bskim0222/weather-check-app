import { Text, View } from 'react-native';

import { styles } from '../styles/appStyles';

type EmptyStateProps = {
  action?: string;
  body: string;
  title: string;
};

export function EmptyState({ action, body, title }: EmptyStateProps) {
  return (
    <View style={styles.emptyState}>
      <View style={styles.emptyStateMark}>
        <Text style={styles.emptyStateMarkText}>?</Text>
      </View>
      <View style={styles.emptyStateContent}>
        <Text style={styles.emptyStateTitle}>{title}</Text>
        <Text style={styles.emptyStateBody}>{body}</Text>
        {!!action && <Text style={styles.emptyStateAction}>{action}</Text>}
      </View>
    </View>
  );
}
