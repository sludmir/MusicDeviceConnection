import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { colors, radius, spacing } from '../theme';
import SetupDiagram from '../components/SetupDiagram';
import { buildMobileDiagram } from '../utils/buildMobileDiagram';

export default function SetupViewerScreen({ route, navigation }) {
  const setupId = route?.params?.setupId;
  const setupNameFromRoute = route?.params?.setupName;

  const [setupDoc, setSetupDoc] = useState(null);
  const [diagram, setDiagram] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [rawDevices, setRawDevices] = useState(null);

  const load = useCallback(async () => {
    if (!setupId) {
      setError('No setup id provided.');
      setLoading(false);
      return;
    }
    try {
      const snap = await getDoc(doc(db, 'setups', setupId));
      if (!snap.exists()) {
        setError('This setup could not be found.');
        setLoading(false);
        return;
      }
      const data = snap.data();
      setSetupDoc({ id: snap.id, ...data });
      setRawDevices(Array.isArray(data.devices) ? data.devices : []);

      // Prefer the stored diagram; fall back to building one from devices[] for
      // setups saved before this feature shipped.
      if (data.mobileDiagram && Array.isArray(data.mobileDiagram.devices)) {
        setDiagram(data.mobileDiagram);
      } else {
        setDiagram(buildMobileDiagram(data.devices || [], data.setupType || 'DJ'));
      }
    } catch (err) {
      setError(err?.message || 'Failed to load setup.');
    } finally {
      setLoading(false);
    }
  }, [setupId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const title = setupDoc?.name || setupNameFromRoute || 'Setup';
    navigation.setOptions({ title });
  }, [navigation, setupDoc, setupNameFromRoute]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  const deviceCount = diagram?.devices?.length || 0;

  return (
    <View style={styles.root}>
      <View style={styles.meta}>
        <Text style={styles.title}>{setupDoc?.name || 'Setup'}</Text>
        <Text style={styles.subtitle}>
          {(setupDoc?.setupType || 'DJ')} · {deviceCount} device{deviceCount === 1 ? '' : 's'}
        </Text>
      </View>

      <View style={styles.diagramWrap}>
        <SetupDiagram diagram={diagram} fallbackDevices={rawDevices} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg,
    padding: spacing.lg,
  },
  errorText: { color: colors.textDim, fontSize: 14, textAlign: 'center' },
  meta: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  title: { color: colors.text, fontSize: 20, fontWeight: '700' },
  subtitle: { color: colors.textDim, fontSize: 13, marginTop: 2 },
  diagramWrap: {
    flex: 1,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
});
