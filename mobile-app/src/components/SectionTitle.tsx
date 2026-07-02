import { Text, View } from 'react-native';

import { styles } from '../styles/appStyles';

type SectionTitleProps = {
  title: string;
  caption: string;
};

export function SectionTitle({ title, caption }: SectionTitleProps) {
  return (
    <View style={styles.sectionTitle}>
      <Text style={styles.sectionHeading}>{title}</Text>
      <Text style={styles.sectionCaption}>{caption}</Text>
    </View>
  );
}
