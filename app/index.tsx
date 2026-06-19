import { router } from "expo-router";
import { useEffect, useRef } from "react";
import {
    Animated,
    Easing,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
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
            <Text style={styles.logo}>R</Text>
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
          <View style={styles.pinStart} />
          <View style={styles.pinEnd} />
          <View style={styles.routePath} />
          <RouteSweep top={28} width={180} delay={0} />
          <RouteSweep top={70} width={220} delay={900} />
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
        <TouchableOpacity style={styles.card} onPress={() => router.push("/customer")} activeOpacity={0.9}>
          <View style={styles.cardAccentCustomer} />
          <View style={styles.cardIconWrap}>
            <Text style={styles.icon}>👤</Text>
          </View>
          <View style={styles.cardBody}>
            <Text style={styles.cardTitle}>Customer</Text>
            <Text style={styles.cardSub}>Book and track</Text>
          </View>
          <Text style={styles.cardArrow}>›</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.card} onPress={() => router.push("/driver")} activeOpacity={0.9}>
          <View style={styles.cardAccentDriver} />
          <View style={styles.cardIconWrap}>
            <Text style={styles.icon}>🚗</Text>
          </View>
          <View style={styles.cardBody}>
            <Text style={styles.cardTitle}>Driver</Text>
            <Text style={styles.cardSub}>Go live</Text>
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
    paddingTop: 72,
    paddingBottom: 24,
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
    marginBottom: 16,
  },
  logoShell: {
    width: 108,
    height: 108,
    borderRadius: 34,
    backgroundColor: "rgba(15, 23, 42, 0.95)",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
  logoInner: {
    width: 72,
    height: 72,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.85)",
    alignItems: "center",
    justifyContent: "center",
  },
  logo: {
    color: "white",
    fontSize: 30,
    fontWeight: "900",
  },
  brand: {
    marginTop: 16,
    fontSize: 40,
    fontWeight: "900",
    color: "#0F172A",
    letterSpacing: -1.4,
  },
  subtitle: {
    marginTop: 6,
    color: "#475569",
    fontSize: 15,
  },
  brandPill: {
    marginTop: 14,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "rgba(37, 99, 235, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(37, 99, 235, 0.14)",
  },
  brandPillText: {
    color: "#2563EB",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.4,
  },
  routeCard: {
    backgroundColor: "rgba(255,255,255,0.95)",
    borderRadius: 30,
    padding: 18,
    borderWidth: 1,
    borderColor: "rgba(15, 23, 42, 0.08)",
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
    marginBottom: 14,
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
    height: 118,
    borderRadius: 22,
    backgroundColor: "#F8FAFF",
    borderWidth: 1,
    borderColor: "rgba(37, 99, 235, 0.08)",
    marginBottom: 14,
    overflow: "hidden",
  },
  routePath: {
    position: "absolute",
    top: 54,
    left: 32,
    right: 32,
    height: 3,
    borderRadius: 999,
    backgroundColor: "rgba(37, 99, 235, 0.16)",
  },
  pinStart: {
    position: "absolute",
    top: 34,
    left: 24,
    width: 18,
    height: 18,
    borderRadius: 18,
    backgroundColor: "#22C55E",
    borderWidth: 4,
    borderColor: "rgba(255,255,255,0.9)",
  },
  pinEnd: {
    position: "absolute",
    top: 34,
    right: 24,
    width: 18,
    height: 18,
    borderRadius: 18,
    backgroundColor: "#EF4444",
    borderWidth: 4,
    borderColor: "rgba(255,255,255,0.9)",
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
    paddingVertical: 18,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: "rgba(15, 23, 42, 0.08)",
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
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
