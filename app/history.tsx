import { useEffect, useState } from "react";
import { FlatList, StyleSheet, Text, View } from "react-native";

import { onValue, ref } from "firebase/database";

import { db } from "../firebaseConfig";

export default function HistoryScreen() {
  const [rides, setRides] = useState<any[]>([]);

  useEffect(() => {
    const historyRef = ref(db, "rides/history");

    onValue(historyRef, (snapshot) => {
      const data = snapshot.val();

      if (data) {
        const list = Object.keys(data)
          .map((key) => ({
            id: key,
            ...data[key],
          }))
          .reverse();

        setRides(list);
      }
    });
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.kicker}>Ride Archive</Text>
        <Text style={styles.title}>Booking History</Text>
      </View>

      <View style={styles.summaryRow}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryValue}>{rides.length}</Text>
          <Text style={styles.summaryLabel}>Trips saved</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryValue}>Live</Text>
          <Text style={styles.summaryLabel}>ride updates</Text>
        </View>
      </View>

      <FlatList
        data={rides}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardTopRow}>
              <View>
                <Text style={styles.cardTitle}>Trip {String(item.id).slice(-4)}</Text>
                <Text style={styles.cardSubtitle}>Completed ride</Text>
              </View>
              <View style={styles.statusPill}>
                <Text style={styles.statusPillText}>{item.status || "completed"}</Text>
              </View>
            </View>

            <View style={styles.metricsRow}>
              <View style={styles.metricBlock}>
                <Text style={styles.metricValue}>{item.distance} km</Text>
                <Text style={styles.metricLabel}>Distance</Text>
              </View>
              <View style={styles.metricBlock}>
                <Text style={styles.metricValue}>{item.duration} mins</Text>
                <Text style={styles.metricLabel}>Duration</Text>
              </View>
            </View>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 72,
    paddingHorizontal: 20,
    backgroundColor: "#F7F8FC",
  },
  header: {
    marginBottom: 18,
  },
  kicker: {
    color: "#2563EB",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.6,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  title: {
    fontSize: 34,
    fontWeight: "900",
    color: "#0F172A",
    letterSpacing: -0.8,
  },
  summaryRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 16,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.98)",
    borderRadius: 22,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(15, 23, 42, 0.08)",
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  summaryValue: {
    color: "#0F172A",
    fontSize: 22,
    fontWeight: "900",
  },
  summaryLabel: {
    marginTop: 4,
    color: "#64748B",
    fontSize: 12,
  },
  listContent: {
    paddingBottom: 30,
  },
  card: {
    backgroundColor: "rgba(255,255,255,0.98)",
    padding: 18,
    borderRadius: 24,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "rgba(15, 23, 42, 0.08)",
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  cardTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  cardTitle: {
    color: "#0F172A",
    fontSize: 18,
    fontWeight: "800",
  },
  cardSubtitle: {
    color: "#64748B",
    fontSize: 13,
    marginTop: 2,
  },
  statusPill: {
    backgroundColor: "rgba(37, 99, 235, 0.08)",
    borderColor: "rgba(37, 99, 235, 0.14)",
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  statusPillText: {
    color: "#2563EB",
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  metricsRow: {
    flexDirection: "row",
    gap: 12,
  },
  metricBlock: {
    flex: 1,
    backgroundColor: "#F8FAFC",
    borderRadius: 18,
    padding: 14,
  },
  metricValue: {
    color: "#0F172A",
    fontSize: 16,
    fontWeight: "800",
  },
  metricLabel: {
    marginTop: 4,
    color: "#64748B",
    fontSize: 12,
  },
});
