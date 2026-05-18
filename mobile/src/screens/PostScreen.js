import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing } from '../theme';

export default function PostScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Post a Set</Text>
      <Text style={styles.body}>
        Coming on day 4: record, pick from library, or upload a file. Trim into clips and swap in
        your external audio track.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  title: { color: colors.text, fontSize: 24, fontWeight: '700', marginBottom: spacing.md },
  body: { color: colors.textDim, textAlign: 'center', fontSize: 14, lineHeight: 20 },
});
