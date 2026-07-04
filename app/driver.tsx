import { useEffect, useRef, useState } from "react";
import {
    Alert,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { router } from "expo-router";

import * as Location from "expo-location";
import MapView, { Marker } from "react-native-maps";

import { onValue, ref, set, update } from "firebase/database";

import { db } from "../firebaseConfig";
import { getCurrentUser } from "../services/authService";

export default function DriverScreen() {
  const mapRef = useRef<any>(null);
  const user = getCurrentUser();

  const [location, setLocation] = useState<any>(null);
  const [rideRequest, setRideRequest] = useState<any>(null);
  const [enteredOTP, setEnteredOTP] = useState("");
  const [lastRideId, setLastRideId] = useState("");
  const [isCompletingRide, setIsCompletingRide] = useState(false);
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    if (!user) {
      router.replace("/login");
      return;
    }
    startTracking();
    listenForRideRequests();
  }, []);

  useEffect(() => {
    let interval: any;
    
    if (rideRequest && rideRequest.status === "accepted" && location && rideRequest.source) {
      let currentLat = location.latitude;
      let currentLng = location.longitude;
      const targetLat = rideRequest.source.latitude;
      const targetLng = rideRequest.source.longitude;

      const steps = 20;
      const latStep = (targetLat - currentLat) / steps;
      const lngStep = (targetLng - currentLng) / steps;
      let stepCount = 0;

      interval = setInterval(async () => {
        if (stepCount >= steps) {
          clearInterval(interval);
          return;
        }

        currentLat += latStep;
        currentLng += lngStep;
        stepCount += 1;

        const updatedCoords = {
          latitude: currentLat,
          longitude: currentLng,
        };

        setLocation(updatedCoords);

        if (user) {
          await update(ref(db, `drivers/${user.uid}`), {
            latitude: currentLat,
            longitude: currentLng,
          });
        }
      }, 1000);
    }

    if (rideRequest && rideRequest.status === "started" && location && rideRequest.destination) {
      let currentLat = location.latitude;
      let currentLng = location.longitude;
      const targetLat = rideRequest.destination.latitude;
      const targetLng = rideRequest.destination.longitude;

      const steps = 30;
      const latStep = (targetLat - currentLat) / steps;
      const lngStep = (targetLng - currentLng) / steps;
      let stepCount = 0;

      interval = setInterval(async () => {
        if (stepCount >= steps) {
          clearInterval(interval);
          return;
        }

        currentLat += latStep;
        currentLng += lngStep;
        stepCount += 1;

        const updatedCoords = {
          latitude: currentLat,
          longitude: currentLng,
        };

        setLocation(updatedCoords);

        if (user) {
          await update(ref(db, `drivers/${user.uid}`), {
            latitude: currentLat,
            longitude: currentLng,
          });
        }
      }, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [rideRequest?.status]);

  const startTracking = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();

    if (status !== "granted") {
      return;
    }

    await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.BestForNavigation,
        timeInterval: 2000,
        distanceInterval: 2,
      },
      async (loc) => {
        const coords = {
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
        };

        setLocation(coords);

        if (user) {
          await set(ref(db, `drivers/${user.uid}`), {
            latitude: coords.latitude,
            longitude: coords.longitude,
            isActive,
          });
        }

        mapRef.current?.animateCamera({
          center: coords,
          zoom: 18,
        });
      }
    );
  };

  const listenForRideRequests = () => {
    const rideRef = ref(db, "rides/currentRide");

    onValue(rideRef, (snapshot) => {
      const data = snapshot.val();

      if (data) {
        setRideRequest(data);

        if (data.status === "pending" && data.createdAt !== lastRideId) {
          setLastRideId(data.createdAt);
          Alert.alert("🚖 New Ride Request", "Customer booked a ride!");
        }
      }
    });
  };

  const toggleAvailability = async () => {
    const nextState = !isActive;
    setIsActive(nextState);

    if (!user) return;

    if (location) {
      await set(ref(db, `drivers/${user.uid}`), {
        latitude: location.latitude,
        longitude: location.longitude,
        isActive: nextState,
      });
    } else {
      await set(ref(db, `drivers/${user.uid}/isActive`), nextState);
    }
  };

  const acceptRide = async () => {
    if (!rideRequest || !user) return;

    await set(ref(db, "rides/currentRide"), {
      ...rideRequest,
      status: "accepted",
      driverId: user.uid,
      driverName: user.displayName || "Driver",
    });
    Alert.alert("Ride Accepted 🚖");
  };

  const startRide = async () => {
    if (!rideRequest) return;

    if (enteredOTP === String(rideRequest?.otp)) {
      await set(ref(db, "rides/currentRide"), {
        ...rideRequest,
        status: "started",
      });
      Alert.alert("OTP Verified ✅");
    } else {
      Alert.alert("Invalid OTP ❌");
    }
  };

  const completeRide = async () => {
    if (!rideRequest || isCompletingRide || rideRequest.status !== "started") return;

    setIsCompletingRide(true);

    try {
      const completedAt = Date.now();
      const rideId = String(completedAt);

      await set(ref(db, `rides/history/${rideId}`), {
        ...rideRequest,
        status: "completed",
        completedAt,
      });

      await set(ref(db, "rides/currentRide"), {
        ...rideRequest,
        status: "completed",
        completedAt,
      });

      setRideRequest((currentRide: any) =>
        currentRide ? { ...currentRide, status: "completed", completedAt } : currentRide
      );

      Alert.alert("Ride Completed ✅");
    } finally {
      setIsCompletingRide(false);
    }
  };

  const rejectRide = async () => {
    if (!rideRequest) return;

    await set(ref(db, "rides/currentRide"), {
      ...rideRequest,
      status: "rejected",
    });
    Alert.alert("Ride Rejected");
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      <View style={styles.topGlow} />
      <View style={styles.bottomGlow} />

      <MapView
        ref={mapRef}
        style={styles.map}
        showsUserLocation={true}
        initialRegion={{
          latitude: location?.latitude || 28.6139,
          longitude: location?.longitude || 77.209,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        }}
      >
        {location && (
          <Marker coordinate={location}>
            <View style={styles.driverMarker}>
              <Text style={styles.driverEmoji}>🚗</Text>
            </View>
          </Marker>
        )}
      </MapView>

      <View style={styles.topCard}>
        <View style={styles.topRow}>
          <View>
            <Text style={styles.kicker}>Driver Console</Text>
            <Text style={styles.title}>Live tracking active</Text>
          </View>

          <TouchableOpacity
            onPress={toggleAvailability}
            style={[styles.livePill, !isActive && styles.livePillInactive]}
          >
            <View style={[styles.liveDot, !isActive && styles.liveDotInactive]} />
            <Text style={[styles.liveText, !isActive && styles.liveTextInactive]}>
              {isActive ? "ACTIVE" : "INACTIVE"}
            </Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.sub}>
          Stay visible to nearby riders, receive requests instantly, and verify every trip with a fast OTP flow.
        </Text>
      </View>

      {rideRequest && (
        <View style={styles.rideCard}>
          <View style={styles.rideHeader}>
            <View>
              <Text style={styles.rideEyebrow}>Incoming ride</Text>
              <Text style={styles.rideTitle}>Customer request</Text>
              {rideRequest?.bookingForSomeoneElse && (
                <Text style={styles.passengerHighlightText}>
                  👥 For: {rideRequest.passengerName} ({rideRequest.passengerPhone})
                </Text>
              )}
            </View>
            <View style={styles.statusBadge}>
              <Text style={styles.statusBadgeText}>{rideRequest?.status}</Text>
            </View>
          </View>

          <View style={styles.metricsRow}>
            <View style={styles.metricCard}>
              <Text style={styles.metricValue}>{rideRequest?.distance} km</Text>
              <Text style={styles.metricLabel}>Distance</Text>
            </View>
            <View style={styles.metricCard}>
              <Text style={styles.metricValue}>{rideRequest?.duration} mins</Text>
              <Text style={styles.metricLabel}>ETA</Text>
            </View>
            <View style={styles.metricCard}>
              <Text style={styles.metricValue}>{rideRequest?.otp}</Text>
              <Text style={styles.metricLabel}>OTP</Text>
            </View>
          </View>

          {rideRequest?.status === "pending" && (
            <View style={styles.btnRow}>
              <TouchableOpacity style={styles.acceptBtn} onPress={acceptRide}>
                <Text style={styles.btnText}>Accept</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.rejectBtn} onPress={rejectRide}>
                <Text style={styles.btnText}>Reject</Text>
              </TouchableOpacity>
            </View>
          )}

          {rideRequest?.status === "accepted" && (
            <>
              <TextInput
                placeholder="Enter OTP"
                placeholderTextColor="#94A3B8"
                value={enteredOTP}
                onChangeText={setEnteredOTP}
                keyboardType="numeric"
                style={styles.otpInput}
              />

              <TouchableOpacity style={styles.startBtn} onPress={startRide}>
                <Text style={styles.btnText}>Verify OTP</Text>
              </TouchableOpacity>
            </>
          )}

          {rideRequest?.status === "started" && (
            <TouchableOpacity
              style={[styles.completeBtn, isCompletingRide && styles.completeBtnDisabled]}
              onPress={completeRide}
              disabled={isCompletingRide}
            >
              <Text style={styles.btnText}>Complete Ride</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#08111F",
  },
  map: {
    flex: 1,
  },
  topGlow: {
    position: "absolute",
    top: -80,
    right: -90,
    width: 220,
    height: 220,
    borderRadius: 220,
    backgroundColor: "rgba(37, 99, 235, 0.22)",
    zIndex: 1,
  },
  bottomGlow: {
    position: "absolute",
    bottom: 20,
    left: -100,
    width: 250,
    height: 250,
    borderRadius: 250,
    backgroundColor: "rgba(34, 197, 94, 0.14)",
    zIndex: 1,
  },
  driverMarker: {
    alignItems: "center",
    justifyContent: "center",
  },
  driverEmoji: {
    fontSize: 35,
  },
  topCard: {
    position: "absolute",
    top: 58,
    left: 20,
    right: 20,
    backgroundColor: "rgba(15, 23, 42, 0.92)",
    borderRadius: 28,
    padding: 20,
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.16)",
    shadowColor: "#000",
    shadowOpacity: 0.24,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
    zIndex: 5,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  kicker: {
    color: "#86EFAC",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.4,
    textTransform: "uppercase",
  },
  title: {
    color: "white",
    fontSize: 24,
    fontWeight: "900",
    marginTop: 4,
  },
  sub: {
    color: "#CBD5E1",
    marginTop: 12,
    fontSize: 15,
    lineHeight: 22,
  },
  livePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(34, 197, 94, 0.15)",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 8,
    backgroundColor: "#22C55E",
  },
  livePillInactive: {
    backgroundColor: "rgba(248, 113, 113, 0.14)",
    borderWidth: 1,
    borderColor: "rgba(248, 113, 113, 0.24)",
  },
  liveText: {
    color: "#86EFAC",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1,
  },
  liveTextInactive: {
    color: "#FCA5A5",
  },
  liveDotInactive: {
    backgroundColor: "#F87171",
  },
  rideCard: {
    position: "absolute",
    bottom: 30,
    left: 20,
    right: 20,
    backgroundColor: "rgba(255, 255, 255, 0.96)",
    borderRadius: 28,
    padding: 20,
    elevation: 10,
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    borderWidth: 1,
    borderColor: "rgba(15, 23, 42, 0.08)",
    zIndex: 5,
  },
  rideHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  rideEyebrow: {
    color: "#2563EB",
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 1.2,
  },
  rideTitle: {
    fontSize: 22,
    fontWeight: "900",
    color: "#111827",
  },
  statusBadge: {
    backgroundColor: "rgba(37, 99, 235, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(37, 99, 235, 0.2)",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  statusBadgeText: {
    color: "#2563EB",
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  metricsRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 16,
  },
  metricCard: {
    flex: 1,
    backgroundColor: "#F8FAFC",
    borderRadius: 18,
    padding: 14,
  },
  metricValue: {
    fontSize: 16,
    fontWeight: "800",
    color: "#111827",
  },
  metricLabel: {
    marginTop: 4,
    fontSize: 12,
    color: "#64748B",
  },
  btnRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 4,
  },
  acceptBtn: {
    backgroundColor: "#10B981",
    flex: 1,
    marginRight: 10,
    padding: 16,
    borderRadius: 18,
    alignItems: "center",
  },
  rejectBtn: {
    backgroundColor: "#EF4444",
    flex: 1,
    marginLeft: 10,
    padding: 16,
    borderRadius: 18,
    alignItems: "center",
  },
  otpInput: {
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 14,
    padding: 14,
    marginTop: 15,
    fontSize: 16,
    backgroundColor: "#FFFFFF",
  },
  startBtn: {
    backgroundColor: "#2563EB",
    marginTop: 12,
    padding: 16,
    borderRadius: 18,
    alignItems: "center",
  },
  completeBtn: {
    backgroundColor: "#111827",
    marginTop: 12,
    padding: 16,
    borderRadius: 18,
    alignItems: "center",
  },
  completeBtnDisabled: {
    opacity: 0.7,
  },
  btnText: {
    color: "white",
    fontSize: 16,
    fontWeight: "800",
  },
  passengerHighlightText: {
    fontSize: 13,
    color: "#475569",
    fontWeight: "700",
    marginTop: 4,
  },
});
