import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Alert, StatusBar, StyleSheet, Text, TouchableOpacity, View } from "react-native";

import * as Location from "expo-location";
import { onValue, ref, set } from "firebase/database";
import { getDistance } from "geolib";
import { GooglePlacesAutocomplete } from "react-native-google-places-autocomplete";
import MapView, { Marker } from "react-native-maps";
import MapViewDirections from "react-native-maps-directions";

import { db } from "../firebaseConfig";

const GOOGLE_MAPS_APIKEY = "AIzaSyByV5E8B_TD71Hb4d1HN6s-T6GiYCrTZtM";

export default function CustomerScreen() {
  const mapRef = useRef<any>(null);
  const pickupRef = useRef<any>(null);

  const [source, setSource] = useState<any>(null);
  const [destination, setDestination] = useState<any>(null);
  const [fare, setFare] = useState(0);
  const [drivers, setDrivers] = useState<any>([]);
  const [selectedDriver, setSelectedDriver] = useState<any>(null);
  const [distance, setDistance] = useState<any>(null);
  const [duration, setDuration] = useState<any>(null);
  const [pickupAddress, setPickupAddress] = useState("");
  const [destinationAddress, setDestinationAddress] = useState("");
  const [rideStatus, setRideStatus] = useState<any>(null);
  const [searchingDriver, setSearchingDriver] = useState(false);
  const [driverETA, setDriverETA] = useState<number | null>(null);
  const [showArrivalCard, setShowArrivalCard] = useState(false);
  const [rideOTP, setRideOTP] = useState("");

  useEffect(() => {
    getCurrentLocation();
    listenForRideUpdates();
  }, []);

  useEffect(() => {
    if (source) {
      getNearbyDrivers();
    }
  }, [source]);

  const getCurrentLocation = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();

    if (status !== "granted") {
      return;
    }

    const location = await Location.getCurrentPositionAsync({});

    const currentCoords = {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
    };

    setSource(currentCoords);
    pickupRef.current?.setAddressText("📍 Current Location");
  };

  const getNearbyDrivers = () => {
    const driversRef = ref(db, "drivers");

    onValue(driversRef, (snapshot) => {
      const data = snapshot.val();

      if (data && source) {
        const nearbyDrivers = Object.keys(data)
          .map((key) => {
            const driver = data[key];
            const driverDistance = getDistance(
              {
                latitude: source.latitude,
                longitude: source.longitude,
              },
              {
                latitude: driver.latitude,
                longitude: driver.longitude,
              }
            );

            return {
              id: key,
              ...driver,
              distance: driverDistance / 1000,
            };
          })
          .filter((driver) => driver.distance <= 10)
          .sort((a, b) => a.distance - b.distance);

        setDrivers(nearbyDrivers);

        if (selectedDriver) {
          const updatedDriver = nearbyDrivers.find((d) => d.id === selectedDriver.id);

          if (updatedDriver) {
            setSelectedDriver(updatedDriver);
            mapRef.current?.animateCamera({
              center: {
                latitude: updatedDriver.latitude,
                longitude: updatedDriver.longitude,
              },
              zoom: 16,
            });
          }
        }
      }
    });
  };

  const bookRide = async () => {
    if (distance && Number(distance) > 50) {
      Alert.alert(
        "Service Not Available",
        "Our service is currently available only within the city limits."
      );
      return;
    }

    if (!drivers || drivers.length === 0) {
      Alert.alert("No Driver Available 🚫", "No nearby drivers found");
      return;
    }

    const generatedOTP = Math.floor(1000 + Math.random() * 9000);
    const nearestDriver = drivers[0];

    if (!nearestDriver) {
      Alert.alert("No Driver Available 🚫");
      return;
    }

    setSelectedDriver(nearestDriver);
    setSearchingDriver(true);

    await set(ref(db, "rides/currentRide"), {
      source,
      destination,
      pickupAddress,
      destinationAddress,
      distance,
      duration,
      otp: generatedOTP,
      driverId: nearestDriver.id,
      driverDistance: nearestDriver.distance.toFixed(1),
      status: "pending",
      createdAt: Date.now(),
    });

    Alert.alert("Searching Driver 🚖", `Your OTP is ${generatedOTP}`);
  };

  const listenForRideUpdates = () => {
    const rideRef = ref(db, "rides/currentRide");

    onValue(rideRef, (snapshot) => {
      const data = snapshot.val();

      if (data) {
        setRideStatus(data.status);
        setSource(data.source);
        setDestination(data.destination);
        setRideOTP(String(data.otp));
        setPickupAddress(data.pickupAddress || "");
        setDestinationAddress(data.destinationAddress || "");

        if (data.driverId && drivers.length > 0) {
          const driver = drivers.find((d: any) => d.id === data.driverId);

          if (driver) {
            setSelectedDriver(driver);
          }
        }

        if (data.status === "pending") {
          setSearchingDriver(true);
        }

        if (data.status === "accepted") {
          setSearchingDriver(false);
          setShowArrivalCard(true);
        }

        if (data.status === "rejected") {
          setSearchingDriver(false);
          Alert.alert("Ride Rejected ❌", "Driver rejected your ride");
        }

        if (data.status === "started") {
          Alert.alert("Ride Started 🚕");
        }

        if (data.status === "completed") {
          setShowArrivalCard(false);
          setSearchingDriver(false);
          Alert.alert("Ride Completed ✅");
        }
      }
    });
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      <View style={styles.topGlow} />
      <View style={styles.bottomGlow} />

      <TouchableOpacity onPress={() => router.push("/history")} style={styles.historyButton}>
        <Text style={styles.historyButtonLabel}>Ride History</Text>
        <Text style={styles.historyButtonSub}>Trips and records</Text>
      </TouchableOpacity>

      {drivers.length === 0 && (
        <View style={styles.noDriverCard}>
          <Text style={styles.noDriverText}>🚫 No drivers nearby</Text>
        </View>
      )}

      <MapView
        ref={mapRef}
        style={styles.map}
        showsUserLocation={true}
        initialRegion={{
          latitude: source?.latitude || 28.6139,
          longitude: source?.longitude || 77.2090,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        }}
      >
        {source && <Marker coordinate={source} pinColor="#22C55E" />}

        {destination && <Marker coordinate={destination} pinColor="#EF4444" />}

        {selectedDriver && (
          <Marker
            coordinate={{
              latitude: selectedDriver.latitude,
              longitude: selectedDriver.longitude,
            }}
          >
            <View style={styles.driverMarkerWrap}>
              <Text style={styles.driverMarkerEmoji}>🚖</Text>
            </View>
          </Marker>
        )}

        {rideStatus === "accepted" && selectedDriver && source && (
          <MapViewDirections
            origin={{
              latitude: selectedDriver.latitude,
              longitude: selectedDriver.longitude,
            }}
            destination={{
              latitude: source.latitude,
              longitude: source.longitude,
            }}
            apikey={GOOGLE_MAPS_APIKEY}
            strokeWidth={5}
            strokeColor="#22C55E"
            onReady={(result) => {
              setDriverETA(Math.ceil(result.duration));
            }}
          />
        )}

        {source && destination && (
          <MapViewDirections
            origin={source}
            destination={destination}
            apikey={GOOGLE_MAPS_APIKEY}
            strokeWidth={5}
            strokeColor="#2563EB"
            optimizeWaypoints={true}
            onReady={(result) => {
              setDistance(result.distance.toFixed(1));
              const rideFare = 50 + result.distance * 10;
              setFare(Math.round(rideFare));
              setDuration(Math.ceil(result.duration));
            }}
          />
        )}
      </MapView>

      {rideStatus !== "pending" && rideStatus !== "accepted" && rideStatus !== "started" && (
        <View style={styles.searchContainer}>
          <View style={styles.heroCard}>
            <View style={styles.heroTopRow}>
              <View>
                <Text style={styles.kicker}>RideX</Text>
                <Text style={styles.heading}>Plan your trip</Text>
              </View>
              <View style={styles.liveBadge}>
                <View style={styles.liveDot} />
                <Text style={styles.liveBadgeText}>Online</Text>
              </View>
            </View>

            <Text style={styles.subheading}>Enter pickup and destination to book.</Text>

            <View style={styles.heroStatsRow}>
              <View style={styles.statChip}>
                <Text style={styles.statValue}>{drivers.length}</Text>
                <Text style={styles.statLabel}>drivers nearby</Text>
              </View>
              <View style={styles.statChip}>
                <Text style={styles.statValue}>OTP</Text>
                <Text style={styles.statLabel}>secure ride</Text>
              </View>
              <View style={styles.statChip}>
                <Text style={styles.statValue}>Live</Text>
                <Text style={styles.statLabel}>tracking</Text>
              </View>
            </View>
          </View>

          <GooglePlacesAutocomplete
            ref={pickupRef}
            placeholder="Pickup Location"
            fetchDetails={true}
            minLength={1}
            onFail={(error) => {
              Alert.alert("Places Error", JSON.stringify(error));
            }}
            debounce={300}
            enablePoweredByContainer={false}
            keyboardShouldPersistTaps="handled"
            listViewDisplayed="auto"
            predefinedPlaces={[
              {
                description: "📍 Use Current Location",
                geometry: {
                  location: {
                    latitude: source?.latitude || 0,
                    longitude: source?.longitude || 0,
                  },
                },
              },
            ] as any}
            textInputProps={{
              placeholderTextColor: "#94A3B8",
            }}
            onPress={(data, details = null) => {
              if (data.description === "📍 Use Current Location") {
                getCurrentLocation();
                return;
              }

              const location = details?.geometry.location;

              if (!location) {
                return;
              }

              setSource({
                latitude: location.lat,
                longitude: location.lng,
              });
              setPickupAddress(data.description);
            }}
            query={{
              key: GOOGLE_MAPS_APIKEY,
              language: "en",
            }}
            styles={{
              container: {
                flex: 0,
                marginBottom: 12,
              },
              textInput: {
                backgroundColor: "rgba(15, 23, 42, 0.94)",
                borderRadius: 18,
                height: 58,
                paddingHorizontal: 18,
                fontSize: 16,
                color: "white",
                fontWeight: "600",
                borderWidth: 1,
                borderColor: "rgba(148, 163, 184, 0.16)",
              },
              listView: {
                backgroundColor: "white",
                zIndex: 999,
                elevation: 999,
                borderRadius: 16,
                overflow: "hidden",
              },
            }}
          />

          <GooglePlacesAutocomplete
            placeholder="Where to?"
            fetchDetails={true}
            minLength={2}
            debounce={300}
            enablePoweredByContainer={false}
            keyboardShouldPersistTaps="handled"
            listViewDisplayed="auto"
            textInputProps={{
              placeholderTextColor: "#94A3B8",
            }}
            onPress={(data, details = null) => {
              const location = details?.geometry.location;

              if (!location) {
                return;
              }

              setDestination({
                latitude: location.lat,
                longitude: location.lng,
              });
              setDestinationAddress(data.description);

              mapRef.current?.animateToRegion({
                latitude: location.lat,
                longitude: location.lng,
                latitudeDelta: 0.05,
                longitudeDelta: 0.05,
              });
            }}
            query={{
              key: GOOGLE_MAPS_APIKEY,
              language: "en",
              components: "country:in",
            }}
            styles={{
              container: {
                flex: 0,
              },
              textInput: {
                backgroundColor: "rgba(15, 23, 42, 0.94)",
                borderRadius: 18,
                height: 58,
                paddingHorizontal: 18,
                fontSize: 16,
                color: "white",
                fontWeight: "600",
                borderWidth: 1,
                borderColor: "rgba(148, 163, 184, 0.16)",
              },
              listView: {
                backgroundColor: "white",
                zIndex: 999,
                elevation: 999,
                borderRadius: 16,
                overflow: "hidden",
              },
            }}
          />
        </View>
      )}

      {searchingDriver && rideStatus === "pending" && (
        <View style={styles.searchingCard}>
          <Text style={styles.searchingTitle}>Searching for the best driver</Text>
          <Text style={styles.searchingText}>Your request is live and the nearest driver is being notified.</Text>
        </View>
      )}

      {rideOTP && (
        <View style={styles.otpCard}>
          <Text style={styles.otpLabel}>Share OTP With Driver</Text>
          <Text style={styles.otpValue}>{rideOTP}</Text>
          <Text style={styles.otpFare}>₹{fare}</Text>
        </View>
      )}

      {showArrivalCard && (
        <View style={styles.arrivalCard}>
          <Text style={styles.arrivalTitle}>🚖 Driver arriving</Text>
          <Text style={styles.arrivalText}>Your ride will start soon.</Text>
          <Text style={styles.arrivalText}>Driver is on the way.</Text>
          {driverETA && <Text style={styles.arrivalEta}>ETA: {driverETA} mins</Text>}
        </View>
      )}

      {distance && (
        <View style={styles.bottomCard}>
          <View>
            <Text style={styles.distance}>{distance} km</Text>
            <Text style={styles.duration}>{duration} mins away</Text>
          </View>

          <TouchableOpacity style={styles.bookBtn} onPress={bookRide}>
            <Text style={styles.bookText}>Book Ride</Text>
          </TouchableOpacity>
        </View>
      )}

      {rideStatus === "otp_verified" && (
        <TouchableOpacity
          style={styles.confirmBtn}
          onPress={async () => {
            await set(ref(db, "rides/currentRide/status"), "started");
            Alert.alert("Ride Started 🚕");
          }}
        >
          <Text style={styles.confirmText}>Confirm OTP & Start Ride</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F7F8FC",
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
  searchContainer: {
    position: "absolute",
    top: 46,
    left: 20,
    right: 20,
    zIndex: 999,
    elevation: 999,
  },
  heroCard: {
    backgroundColor: "rgba(255,255,255,0.98)",
    borderWidth: 1,
    borderColor: "rgba(15, 23, 42, 0.06)",
    borderRadius: 28,
    padding: 18,
    marginBottom: 14,
    shadowColor: "#0F172A",
    shadowOpacity: 0.08,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 12 },
    elevation: 4,
  },
  kicker: {
    color: "#2563EB",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.4,
    textTransform: "uppercase",
  },
  heading: {
    fontSize: 28,
    fontWeight: "900",
    color: "#0F172A",
    marginTop: 4,
    letterSpacing: -0.8,
  },
  subheading: {
    color: "#475569",
    fontSize: 14,
    lineHeight: 20,
    marginTop: 10,
  },
  heroStatsRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 16,
  },
  statChip: {
    flex: 1,
    backgroundColor: "#F8FAFC",
    borderRadius: 18,
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: "rgba(15, 23, 42, 0.08)",
  },
  statValue: {
    color: "#0F172A",
    fontSize: 16,
    fontWeight: "800",
  },
  statLabel: {
    color: "#64748B",
    fontSize: 11,
    marginTop: 4,
  },
  heroTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  liveBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(34, 197, 94, 0.10)",
    borderWidth: 1,
    borderColor: "rgba(34, 197, 94, 0.16)",
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
  liveBadgeText: {
    color: "#16A34A",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1,
  },
  historyButton: {
    position: "absolute",
    top: 62,
    right: 20,
    zIndex: 999,
    backgroundColor: "#0F172A",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: "rgba(255, 255, 255, 0.12)",
    elevation: 8,
  },
  historyButtonLabel: {
    color: "white",
    fontWeight: "800",
    fontSize: 13,
  },
  historyButtonSub: {
    color: "#94A3B8",
    fontSize: 10,
    marginTop: 2,
  },
  noDriverCard: {
    position: "absolute",
    top: 130,
    alignSelf: "center",
    backgroundColor: "rgba(255,255,255,0.98)",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 20,
    zIndex: 999,
    borderWidth: 1,
    borderColor: "rgba(15, 23, 42, 0.08)",
  },
  noDriverText: {
    color: "#0F172A",
    fontSize: 15,
    fontWeight: "600",
  },
  driverMarkerWrap: {
    alignItems: "center",
  },
  driverMarkerEmoji: {
    fontSize: 35,
  },
  searchingCard: {
    position: "absolute",
    bottom: 138,
    left: 20,
    right: 20,
    backgroundColor: "rgba(255,255,255,0.98)",
    borderRadius: 22,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(15, 23, 42, 0.08)",
    zIndex: 10,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  searchingTitle: {
    color: "#0F172A",
    fontWeight: "800",
    fontSize: 16,
  },
  searchingText: {
    color: "#64748B",
    marginTop: 4,
    fontSize: 13,
    lineHeight: 18,
  },
  bottomCard: {
    position: "absolute",
    bottom: 25,
    left: 20,
    right: 20,
    backgroundColor: "rgba(255,255,255,0.98)",
    borderRadius: 25,
    padding: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    elevation: 10,
    borderWidth: 1,
    borderColor: "rgba(15, 23, 42, 0.08)",
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
  },
  distance: {
    fontSize: 24,
    fontWeight: "900",
    color: "#0F172A",
  },
  duration: {
    fontSize: 15,
    color: "#64748B",
    marginTop: 5,
  },
  bookBtn: {
    backgroundColor: "#2563EB",
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 18,
    shadowColor: "#2563EB",
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 5,
  },
  bookText: {
    color: "white",
    fontSize: 16,
    fontWeight: "bold",
  },
  confirmBtn: {
    position: "absolute",
    bottom: 120,
    left: 20,
    right: 20,
    backgroundColor: "#22C55E",
    padding: 16,
    borderRadius: 18,
    alignItems: "center",
    shadowColor: "#22C55E",
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 5,
  },
  confirmText: {
    color: "white",
    fontWeight: "bold",
    fontSize: 16,
  },
  otpCard: {
    position: "absolute",
    bottom: 130,
    left: 20,
    right: 20,
    backgroundColor: "rgba(255,255,255,0.98)",
    padding: 16,
    borderRadius: 22,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(15, 23, 42, 0.08)",
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  otpLabel: {
    color: "#64748B",
    fontSize: 13,
    fontWeight: "600",
  },
  otpValue: {
    color: "#16A34A",
    fontSize: 34,
    fontWeight: "900",
    marginTop: 4,
  },
  otpFare: {
    fontSize: 18,
    fontWeight: "800",
    color: "#2563EB",
    marginTop: 4,
  },
  arrivalCard: {
    position: "absolute",
    bottom: 220,
    left: 20,
    right: 20,
    backgroundColor: "rgba(255, 255, 255, 0.96)",
    padding: 16,
    borderRadius: 22,
    elevation: 10,
    borderWidth: 1,
    borderColor: "rgba(15, 23, 42, 0.08)",
  },
  arrivalTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: "#111827",
  },
  arrivalText: {
    color: "#475569",
    marginTop: 6,
    fontSize: 14,
  },
  arrivalEta: {
    color: "#2563EB",
    marginTop: 8,
    fontSize: 15,
    fontWeight: "800",
  },
});
