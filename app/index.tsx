import { router } from "expo-router";
import { useEffect, useRef } from "react";
import {
  Animated,
  Easing,
  Image,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from "react-native";

function RouteSweep({
  top,
  delay = 0,
  width,
}: {
  top: number;
  delay?: number;
  width: number;
}) {
  const translateX = useRef(new Animated.Value(-120)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(translateX, {
          toValue: 340,
          duration: 3600,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
        Animated.timing(translateX, {
          toValue: -120,
          duration: 0,
          useNativeDriver: true,
        }),
      ])
    );

    animation.start();
    return () => animation.stop();
  }, [delay, translateX]);

  return (
    <Animated.View style={[styles.sweepRow, { top, width, transform: [{ translateX }] }]}>
      <View style={styles.sweepLine} />
      <View style={styles.sweepDot} />
    </Animated.View>
  );
}

export default function HomeScreen() {
  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />

      <View style={styles.bgBlobOne} />
      <View style={styles.bgBlobTwo} />
      <View style={styles.bgBlobThree} />
      <View style={styles.bgGrid} />

      <View style={styles.topMeta}>
        <View style={styles.liveChip}>
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>LIVE</Text>
        </View>
        <Text style={styles.metaText}>RideX</Text>
      </View>

      <View style={styles.brandSection}>
        <View style={styles.logoShell}>
          <View style={styles.logoInner}>
            <Image
              source={require("../assets/images/logg.png")}
              style={styles.logoImage}
              resizeMode="contain"
            />
          </View>
        </View>
        <Text style={styles.brand}>RideX</Text>
        <Text style={styles.subtitle}>Choose your module</Text>
        <View style={styles.brandPill}>
          <Text style={styles.brandPillText}>Premium ride experience</Text>
        </View>
      </View>

      <View style={styles.routeCard}>
        <View style={styles.routeHeader}>
          <Text style={styles.routeTitle}>Fast. Simple. Live.</Text>
          <Text style={styles.routeTag}>Ready</Text>
        </View>

        <View style={styles.routeMap}>
          <View style={styles.pinStartRing} />
          <View style={styles.pinStart} />
          <View style={styles.pinEndRing} />
          <View style={styles.pinEnd} />
          <View style={styles.routePath} />
          <RouteSweep top={18} width={180} delay={0} />
          <RouteSweep top={60} width={220} delay={900} />
        </View>

        <View style={styles.quickStats}>
          <View style={styles.quickStat}>
            <Text style={styles.quickValue}>Fast</Text>
            <Text style={styles.quickLabel}>booking</Text>
          </View>
          <View style={styles.quickStatCenter} />
          <View style={styles.quickStat}>
            <Text style={styles.quickValue}>Live</Text>
            <Text style={styles.quickLabel}>tracking</Text>
          </View>
        </View>
      </View>

      <View style={styles.cardContainer}>
        <TouchableOpacity style={styles.card} onPress={() => router.push("/customer")} activeOpacity={0.85}>
          <View style={styles.cardAccentCustomer} />
          <View style={[styles.cardIconWrap, { backgroundColor: "rgba(37, 99, 235, 0.08)" }]}>
            <Text style={[styles.icon, { color: "#2563EB" }]}>👤</Text>
          </View>
          <View style={styles.cardBody}>
            <Text style={styles.cardTitle}>Customer</Text>
            <Text style={styles.cardSub}>Book and track rides</Text>
          </View>
          <Text style={styles.cardArrow}>›</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.card} onPress={() => router.push("/driver")} activeOpacity={0.85}>
          <View style={styles.cardAccentDriver} />
          <View style={[styles.cardIconWrap, { backgroundColor: "rgba(16, 185, 129, 0.08)" }]}>
            <Text style={[styles.icon, { color: "#10B981" }]}>🚗</Text>
          </View>
          <View style={styles.cardBody}>
            <Text style={styles.cardTitle}>Driver</Text>
            <Text style={styles.cardSub}>Go live and accept requests</Text>
          </View>
          <Text style={styles.cardArrow}>›</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5F7FB",
    paddingHorizontal: 20,
    paddingTop: 52,
    paddingBottom: 20,
    overflow: "hidden",
  },
  bgBlobOne: {
    position: "absolute",
    top: -90,
    right: -70,
    width: 220,
    height: 220,
    borderRadius: 220,
    backgroundColor: "rgba(37, 99, 235, 0.10)",
  },
  bgBlobTwo: {
    position: "absolute",
    bottom: 24,
    left: -110,
    width: 280,
    height: 280,
    borderRadius: 280,
    backgroundColor: "rgba(15, 23, 42, 0.05)",
  },
  bgBlobThree: {
    position: "absolute",
    top: 320,
    right: -130,
    width: 300,
    height: 300,
    borderRadius: 300,
    backgroundColor: "rgba(99, 102, 241, 0.08)",
  },
  bgGrid: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0.18,
    borderTopWidth: 1,
    borderTopColor: "rgba(15, 23, 42, 0.04)",
  },
  topMeta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 18,
  },
  liveChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(34, 197, 94, 0.10)",
    borderWidth: 1,
    borderColor: "rgba(34, 197, 94, 0.18)",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 8,
    backgroundColor: "#22C55E",
  },
  liveText: {
    color: "#16A34A",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.2,
  },
  metaText: {
    color: "#64748B",
    fontSize: 13,
    fontWeight: "700",
  },
  brandSection: {
    alignItems: "center",
    marginTop: 4,
    marginBottom: 8,
  },
  logoShell: {
    width: 92,
    height: 92,
    borderRadius: 28,
    backgroundColor: "#0F172A",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "rgba(255, 255, 255, 0.12)",
    shadowColor: "#0F172A",
    shadowOpacity: 0.22,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 12,
  },
  logoInner: {
    width: 64,
    height: 64,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.22)",
    backgroundColor: "rgba(255,255,255,0.03)",
    alignItems: "center",
    justifyContent: "center",
  },
  logoImage: {
    width: 38,
    height: 38,
  },
  brand: {
    marginTop: 8,
    fontSize: 32,
    fontWeight: "900",
    color: "#0F172A",
    letterSpacing: -1.2,
  },
  subtitle: {
    marginTop: 4,
    color: "#475569",
    fontSize: 14,
  },
  brandPill: {
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(37, 99, 235, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(37, 99, 235, 0.14)",
  },
  brandPillText: {
    color: "#2563EB",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.4,
  },
  routeCard: {
    backgroundColor: "rgba(255,255,255,0.96)",
    borderRadius: 30,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(15, 23, 42, 0.06)",
    shadowColor: "#0F172A",
    shadowOpacity: 0.07,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
    marginBottom: 10,
  },
  routeHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  routeTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: "#0F172A",
  },
  routeTag: {
    color: "#2563EB",
    fontWeight: "800",
    fontSize: 12,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  routeMap: {
    height: 96,
    borderRadius: 20,
    backgroundColor: "#F8FAFF",
    borderWidth: 1,
    borderColor: "rgba(37, 99, 235, 0.08)",
    marginBottom: 10,
    overflow: "hidden",
  },
  routePath: {
    position: "absolute",
    top: 47,
    left: 32,
    right: 32,
    height: 3,
    borderRadius: 999,
    backgroundColor: "rgba(37, 99, 235, 0.16)",
  },
  pinStartRing: {
    position: "absolute",
    top: 30,
    left: 15,
    width: 36,
    height: 36,
    borderRadius: 36,
    backgroundColor: "rgba(34, 197, 94, 0.18)",
  },
  pinStart: {
    position: "absolute",
    top: 39,
    left: 24,
    width: 18,
    height: 18,
    borderRadius: 18,
    backgroundColor: "#22C55E",
    borderWidth: 4,
    borderColor: "#FFFFFF",
    shadowColor: "#22C55E",
    shadowOpacity: 0.4,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  pinEndRing: {
    position: "absolute",
    top: 30,
    right: 15,
    width: 36,
    height: 36,
    borderRadius: 36,
    backgroundColor: "rgba(239, 68, 68, 0.18)",
  },
  pinEnd: {
    position: "absolute",
    top: 39,
    right: 24,
    width: 18,
    height: 18,
    borderRadius: 18,
    backgroundColor: "#EF4444",
    borderWidth: 4,
    borderColor: "#FFFFFF",
    shadowColor: "#EF4444",
    shadowOpacity: 0.4,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  sweepRow: {
    position: "absolute",
    left: 0,
    height: 12,
    alignItems: "center",
  },
  sweepLine: {
    position: "absolute",
    left: 18,
    right: 0,
    top: 5,
    height: 2,
    borderRadius: 999,
    backgroundColor: "rgba(37, 99, 235, 0.20)",
  },
  sweepDot: {
    position: "absolute",
    left: 0,
    top: 0,
    width: 12,
    height: 12,
    borderRadius: 12,
    backgroundColor: "#2563EB",
    shadowColor: "#2563EB",
    shadowOpacity: 0.35,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
  },
  quickStats: {
    flexDirection: "row",
    alignItems: "center",
  },
  quickStat: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 10,
  },
  quickStatCenter: {
    width: 1,
    height: 34,
    backgroundColor: "rgba(15, 23, 42, 0.08)",
  },
  quickValue: {
    color: "#0F172A",
    fontSize: 15,
    fontWeight: "900",
  },
  quickLabel: {
    color: "#64748B",
    fontSize: 11,
    marginTop: 2,
  },
  cardContainer: {
    gap: 12,
  },
  card: {
    backgroundColor: "rgba(255,255,255,0.98)",
    borderRadius: 24,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: "rgba(15, 23, 42, 0.05)",
    shadowColor: "#0F172A",
    shadowOpacity: 0.06,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 5,
    flexDirection: "row",
    alignItems: "center",
    overflow: "hidden",
  },
  cardAccentCustomer: {
    position: "absolute",
    top: -26,
    right: -26,
    width: 86,
    height: 86,
    borderRadius: 86,
    backgroundColor: "rgba(37, 99, 235, 0.12)",
  },
  cardAccentDriver: {
    position: "absolute",
    top: -26,
    right: -26,
    width: 86,
    height: 86,
    borderRadius: 86,
    backgroundColor: "rgba(16, 185, 129, 0.12)",
  },
  cardIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: "rgba(15, 23, 42, 0.05)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  icon: {
    fontSize: 26,
  },
  cardBody: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: "900",
    color: "#0F172A",
  },
  cardSub: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 2,
  },
  cardArrow: {
    fontSize: 30,
    color: "#94A3B8",
    fontWeight: "700",
    marginLeft: 8,
  },
});
