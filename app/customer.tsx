import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Alert, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";

import * as Location from "expo-location";
import { onValue, ref, set } from "firebase/database";
import { getDistance } from "geolib";
import { GooglePlacesAutocomplete } from "react-native-google-places-autocomplete";
import MapView, { Marker } from "react-native-maps";
import MapViewDirections from "react-native-maps-directions";

import { db } from "../firebaseConfig";
import { getCurrentUser, logoutUser } from "../services/authService";

const GOOGLE_MAPS_APIKEY = "AIzaSyByV5E8B_TD71Hb4d1HN6s-T6GiYCrTZtM";

export default function CustomerScreen() {
  const mapRef = useRef<any>(null);
  const pickupRef = useRef<any>(null);
  const user = getCurrentUser();

  const [source, setSource] = useState<any>(null);
  const [destination, setDestination] = useState<any>(null);
  const [fare, setFare] = useState(0);
  const [selectedVehicle, setSelectedVehicle] = useState<"bike" | "auto" | "car">("car");
  const [drivers, setDrivers] = useState<any>([]);
  const [selectedDriver, setSelectedDriver] = useState<any>(null);
  const [distance, setDistance] = useState<any>(null);
  const [duration, setDuration] = useState<any>(null);
  const [pickupAddress, setPickupAddress] = useState("");
  const [destinationAddress, setDestinationAddress] = useState("");
  const [rideStatus, setRideStatus] = useState<any>(null);
  const [rideStatusTitle, setRideStatusTitle] = useState("Ready to ride");
  const [rideStatusMessage, setRideStatusMessage] = useState(
    "Book a ride to see live updates here."
  );
  const [searchingDriver, setSearchingDriver] = useState(false);
  const [driverETA, setDriverETA] = useState<number | null>(null);
  const [showArrivalCard, setShowArrivalCard] = useState(false);
  const [rideOTP, setRideOTP] = useState("");
  const [activeTab, setActiveTab] = useState<"home" | "services" | "activity" | "account">("home");
  const [rideHistory, setRideHistory] = useState<any[]>([]);
  const [isBookingForSomeoneElse, setIsBookingForSomeoneElse] = useState<boolean>(false);
  const [passengerName, setPassengerName] = useState("");
  const [passengerPhone, setPassengerPhone] = useState("");

  useEffect(() => {
    if (!user) {
      router.replace("/login");
      return;
    }
    getCurrentLocation();
    listenForRideUpdates();
    listenForRideHistory();
  }, []);

  useEffect(() => {
    if (source) {
      getNearbyDrivers();
    }
  }, [source]);
  const getFareForVehicle = (vehicle: "bike" | "auto" | "car", dist: number) => {
    return Math.round(
      vehicle === "bike"
        ? 20 + dist * 6
        : vehicle === "auto"
        ? 30 + dist * 9
        : 50 + dist * 14
    );
  };

  useEffect(() => {
    if (distance) {
      const calculatedFare = getFareForVehicle(selectedVehicle, Number(distance));
      setFare(calculatedFare);
    }
  }, [selectedVehicle, distance]);
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
    setPickupAddress("📍 Current Location");
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
          .filter((driver) => driver.isActive !== false && driver.distance <= 10)
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

    if (isBookingForSomeoneElse && (!passengerName.trim() || !passengerPhone.trim())) {
      Alert.alert("Passenger Info Required", "Please enter the passenger's name and phone number.");
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
    setShowArrivalCard(false);
    setRideStatusTitle("Ride request sent");
    setRideStatusMessage("Your request is live and nearby active drivers are being notified.");

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
      bookingForSomeoneElse: isBookingForSomeoneElse,
      passengerName: isBookingForSomeoneElse ? passengerName.trim() : "",
      passengerPhone: isBookingForSomeoneElse ? passengerPhone.trim() : "",
      vehicleType: selectedVehicle,
      fare: fare,
    });

    setRideStatus("pending");
    Alert.alert("Searching Driver 🚖", `Your OTP is ${generatedOTP}`);
  };

  const listenForRideUpdates = () => {
    const rideRef = ref(db, "rides/currentRide");

    onValue(rideRef, (snapshot) => {
      const data = snapshot.val();

      if (data) {
        const status = data.status || "pending";
        setRideStatus(status);
        setSource(data.source);
        setDestination(data.destination);
        setRideOTP(String(data.otp));
        setPickupAddress(data.pickupAddress || "");
        setDestinationAddress(data.destinationAddress || "");

        if (status === "pending") {
          setRideStatusTitle("Ride request sent");
          setRideStatusMessage("Your request is live and the nearest active driver is being notified.");
        } else if (status === "accepted") {
          setRideStatusTitle("Driver accepted");
          setRideStatusMessage("Your driver is on the way. Keep this screen open for live updates.");
        } else if (status === "rejected") {
          setRideStatusTitle("Ride rejected");
          setRideStatusMessage("The driver declined the request. You can try again shortly.");
        } else if (status === "started") {
          setRideStatusTitle("Ride started");
          setRideStatusMessage("Your trip has started. Enjoy the ride.");
        } else if (status === "completed") {
          setRideStatusTitle("Ride completed");
          setRideStatusMessage("The trip has ended successfully.");
        }

        if (data.driverId) {
          const driverLocRef = ref(db, `drivers/${data.driverId}`);
          onValue(driverLocRef, (driverSnap) => {
            const driverLocVal = driverSnap.val();
            if (driverLocVal) {
              setSelectedDriver({
                id: data.driverId,
                latitude: driverLocVal.latitude,
                longitude: driverLocVal.longitude,
                name: data.driverName || "Driver Partner",
                vehicle: data.vehicleType ? data.vehicleType.toUpperCase() : "Car",
              });
            }
          });
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

  const listenForRideHistory = () => {
    const historyRef = ref(db, "rides/history");

    onValue(historyRef, (snapshot) => {
      const data = snapshot.val();

      if (data) {
        const historyList = Object.keys(data)
          .map((key) => ({
            id: key,
            ...data[key],
          }))
          .sort((a, b) => (b.completedAt || 0) - (a.completedAt || 0));

        setRideHistory(historyList);
      } else {
        setRideHistory([]);
      }
    });
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      <View style={styles.topGlow} />
      <View style={styles.bottomGlow} />

      {/* HOME TAB - Map & Ride Booking */}
      {activeTab === "home" && (
        <>
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
                  const initialFare = getFareForVehicle(selectedVehicle, result.distance);
                  setFare(initialFare);
                  setDuration(Math.ceil(result.duration));
                }}
              />
            )}
          </MapView>

          {rideStatus !== "pending" && rideStatus !== "accepted" && rideStatus !== "started" && (
            <View style={styles.searchContainer}>
              <View style={styles.heroCard}>
                <View style={styles.heroCardGlow} />
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

              {/* Pickup Address Label & GPS Shortcut */}
              <View style={styles.pickupLabelRow}>
                <Text style={styles.sectionInputLabel}>From (Pickup Address)</Text>
                <TouchableOpacity
                  style={styles.gpsShortcutBtn}
                  onPress={getCurrentLocation}
                  activeOpacity={0.7}
                >
                  <Text style={styles.gpsShortcutText}>📍 Use Live GPS</Text>
                </TouchableOpacity>
              </View>

              <GooglePlacesAutocomplete
                ref={pickupRef}
                placeholder="Where to pick up from?"
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

              {/* Passenger Selector Card */}
              <View style={styles.passengerSectionCard}>
                <Text style={styles.sectionInputLabel}>Who is riding?</Text>
                <View style={styles.passengerToggleRow}>
                  <TouchableOpacity
                    style={[styles.passengerToggleBtn, !isBookingForSomeoneElse && styles.passengerToggleBtnActive]}
                    onPress={() => setIsBookingForSomeoneElse(false)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.passengerToggleLabel, !isBookingForSomeoneElse && styles.passengerToggleLabelActive]}>👤 Myself</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.passengerToggleBtn, isBookingForSomeoneElse && styles.passengerToggleBtnActive]}
                    onPress={() => setIsBookingForSomeoneElse(true)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.passengerToggleLabel, isBookingForSomeoneElse && styles.passengerToggleLabelActive]}>👥 Someone Else</Text>
                  </TouchableOpacity>
                </View>

                {isBookingForSomeoneElse && (
                  <View style={styles.passengerInputContainer}>
                    <Text style={styles.passengerInputHeading}>Passenger Details</Text>
                    <View style={styles.passengerInputGroup}>
                      <Text style={styles.passengerInputLabel}>Full Name</Text>
                      <TextInput
                        style={styles.passengerTextInput}
                        placeholder="Enter rider's name"
                        placeholderTextColor="#94A3B8"
                        value={passengerName}
                        onChangeText={setPassengerName}
                      />
                    </View>
                    <View style={[styles.passengerInputGroup, { marginTop: 12 }]}>
                      <Text style={styles.passengerInputLabel}>Phone Number</Text>
                      <TextInput
                        style={styles.passengerTextInput}
                        placeholder="Enter rider's phone number"
                        placeholderTextColor="#94A3B8"
                        keyboardType="phone-pad"
                        value={passengerPhone}
                        onChangeText={setPassengerPhone}
                      />
                    </View>
                  </View>
                )}
              </View>
            </View>
          )}

          {rideStatus && (
            <View style={styles.statusBanner}>
              <Text style={styles.statusBannerTitle}>{rideStatusTitle}</Text>
              <Text style={styles.statusBannerText}>{rideStatusMessage}</Text>
            </View>
          )}

          {searchingDriver && rideStatus === "pending" && (
            <View style={styles.searchingCard}>
              <Text style={styles.searchingTitle}>Searching for the best driver</Text>
              <Text style={styles.searchingText}>Your request is live and the nearest active driver is being notified.</Text>
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

          {distance && !rideStatus && (
            <View style={styles.bottomCard}>
              <Text style={styles.selectVehicleTitle}>Select vehicle class</Text>
              
              <View style={styles.vehicleSelectorRow}>
                <TouchableOpacity
                  style={[styles.vehicleOptionCard, selectedVehicle === "bike" && styles.vehicleOptionCardSelected]}
                  onPress={() => setSelectedVehicle("bike")}
                  activeOpacity={0.8}
                >
                  <Text style={styles.vehicleIcon}>🏍️</Text>
                  <View style={styles.vehicleDetails}>
                    <Text style={styles.vehicleLabel}>RideX Bike</Text>
                    <Text style={styles.vehicleEtaText}>Quick & Solo • 2 mins</Text>
                  </View>
                  <Text style={styles.vehiclePrice}>₹{getFareForVehicle("bike", Number(distance))}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.vehicleOptionCard, selectedVehicle === "auto" && styles.vehicleOptionCardSelected]}
                  onPress={() => setSelectedVehicle("auto")}
                  activeOpacity={0.8}
                >
                  <Text style={styles.vehicleIcon}>🛺</Text>
                  <View style={styles.vehicleDetails}>
                    <Text style={styles.vehicleLabel}>RideX Auto</Text>
                    <Text style={styles.vehicleEtaText}>Affordable Everyday • 3 mins</Text>
                  </View>
                  <Text style={styles.vehiclePrice}>₹{getFareForVehicle("auto", Number(distance))}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.vehicleOptionCard, selectedVehicle === "car" && styles.vehicleOptionCardSelected]}
                  onPress={() => setSelectedVehicle("car")}
                  activeOpacity={0.8}
                >
                  <Text style={styles.vehicleIcon}>🚗</Text>
                  <View style={styles.vehicleDetails}>
                    <Text style={styles.vehicleLabel}>RideX Car</Text>
                    <Text style={styles.vehicleEtaText}>Premium Comfort • 4 mins</Text>
                  </View>
                  <Text style={styles.vehiclePrice}>₹{getFareForVehicle("car", Number(distance))}</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.bookingActionRow}>
                <View>
                  <Text style={styles.distanceText}>{distance} km</Text>
                  <Text style={styles.durationText}>{duration} mins route</Text>
                </View>

                <TouchableOpacity style={styles.bookBtn} onPress={bookRide}>
                  <Text style={styles.bookText}>Book {selectedVehicle.toUpperCase()}</Text>
                </TouchableOpacity>
              </View>
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
        </>
      )}

      {/* SERVICES TAB */}
      {activeTab === "services" && (
        <View style={styles.tabContent}>
          <Text style={styles.tabTitle}>Services</Text>
          <View style={styles.serviceItem}>
            <Text style={styles.serviceIcon}>🚗</Text>
            <View style={styles.serviceInfo}>
              <Text style={styles.serviceName}>RideX Go</Text>
              <Text style={styles.serviceDesc}>Economy rides</Text>
            </View>
            <Text style={styles.serviceArrow}>→</Text>
          </View>
          <View style={styles.serviceItem}>
            <Text style={styles.serviceIcon}>⭐</Text>
            <View style={styles.serviceInfo}>
              <Text style={styles.serviceName}>RideX Prime</Text>
              <Text style={styles.serviceDesc}>Premium rides</Text>
            </View>
            <Text style={styles.serviceArrow}>→</Text>
          </View>
          <View style={styles.serviceItem}>
            <Text style={styles.serviceIcon}>📦</Text>
            <View style={styles.serviceInfo}>
              <Text style={styles.serviceName}>Delivery</Text>
              <Text style={styles.serviceDesc}>Send packages</Text>
            </View>
            <Text style={styles.serviceArrow}>→</Text>
          </View>
        </View>
      )}

      {/* ACTIVITY TAB */}
      {activeTab === "activity" && (
        <View style={styles.tabContent}>
          <Text style={styles.tabTitle}>Activity</Text>

          {rideHistory.length === 0 ? (
            <View style={styles.emptyStateCard}>
              <Text style={styles.emptyStateEmoji}>🧾</Text>
              <Text style={styles.emptyStateTitle}>No ride history yet</Text>
              <Text style={styles.emptyStateText}>Your completed trips will appear here automatically.</Text>
            </View>
          ) : (
            rideHistory.map((ride) => (
              <View key={ride.id} style={styles.activityCard}>
                <Text style={styles.activityEmoji}>🚕</Text>
                <View style={styles.activityInfo}>
                  <Text style={styles.activityTitle}>{ride.destinationAddress || "Trip"}</Text>
                  <Text style={styles.activityTime}>
                    {ride.completedAt ? new Date(ride.completedAt).toLocaleString() : "Recent ride"}
                  </Text>
                  <Text style={styles.activityDistance}>
                    {ride.distance ? `${ride.distance} km` : "—"} • {ride.fare ? `₹${ride.fare}` : "Fare pending"}
                  </Text>
                </View>
              </View>
            ))
          )}
        </View>
      )}

      {/* ACCOUNT TAB */}
      {activeTab === "account" && (
        <View style={styles.tabContent}>
          <Text style={styles.tabTitle}>Account</Text>
          <View style={styles.accountCard}>
            <View style={styles.accountAvatar}>
              <Text style={styles.avatarEmoji}>👤</Text>
            </View>
            <View style={styles.accountInfo}>
              <Text style={styles.accountName}>{user?.displayName || "RideX Explorer"}</Text>
              <Text style={styles.accountEmail}>{user?.email || "No email"}</Text>
              <Text style={styles.accountPhone}>Authenticated Securely</Text>
            </View>
          </View>
          <TouchableOpacity style={styles.accountMenuItem}>
            <Text style={styles.accountMenuText}>⚙️ Settings</Text>
            <Text style={styles.accountMenuArrow}>→</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.accountMenuItem}>
            <Text style={styles.accountMenuText}>🎫 Promo Codes</Text>
            <Text style={styles.accountMenuArrow}>→</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.accountMenuItem}>
            <Text style={styles.accountMenuText}>💳 Payment Methods</Text>
            <Text style={styles.accountMenuArrow}>→</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.accountMenuItem}>
            <Text style={styles.accountMenuText}>ℹ️ Help & Support</Text>
            <Text style={styles.accountMenuArrow}>→</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.accountMenuItem, { borderColor: "rgba(239, 68, 68, 0.2)", backgroundColor: "rgba(239, 68, 68, 0.05)" }]}
            onPress={async () => {
              await logoutUser();
              router.replace("/login");
            }}
          >
            <Text style={[styles.accountMenuText, { color: "#EF4444" }]}>🚪 Sign Out</Text>
            <Text style={[styles.accountMenuArrow, { color: "#EF4444" }]}>→</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* BOTTOM TAB NAVIGATION */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tabItem, activeTab === "home" && styles.tabItemActive]}
          onPress={() => setActiveTab("home")}
        >
          <Text style={styles.tabIcon}>{activeTab === "home" ? "🏠" : "🏠"}</Text>
          <Text style={[styles.tabLabel, activeTab === "home" && styles.tabLabelActive]}>Home</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabItem, activeTab === "services" && styles.tabItemActive]}
          onPress={() => setActiveTab("services")}
        >
          <Text style={styles.tabIcon}>{activeTab === "services" ? "🛠️" : "🛠️"}</Text>
          <Text style={[styles.tabLabel, activeTab === "services" && styles.tabLabelActive]}>Services</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabItem, activeTab === "activity" && styles.tabItemActive]}
          onPress={() => setActiveTab("activity")}
        >
          <Text style={styles.tabIcon}>{activeTab === "activity" ? "📋" : "📋"}</Text>
          <Text style={[styles.tabLabel, activeTab === "activity" && styles.tabLabelActive]}>Activity</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabItem, activeTab === "account" && styles.tabItemActive]}
          onPress={() => setActiveTab("account")}
        >
          <Text style={styles.tabIcon}>{activeTab === "account" ? "👤" : "👤"}</Text>
          <Text style={[styles.tabLabel, activeTab === "account" && styles.tabLabelActive]}>Account</Text>
        </TouchableOpacity>
      </View>
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
    backgroundColor: "rgba(37, 99, 235, 0.26)",
    zIndex: 1,
  },
  bottomGlow: {
    position: "absolute",
    bottom: 20,
    left: -100,
    width: 250,
    height: 250,
    borderRadius: 250,
    backgroundColor: "rgba(34, 197, 94, 0.18)",
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
    position: "relative",
    backgroundColor: "rgba(255,255,255,0.97)",
    borderWidth: 1,
    borderColor: "rgba(37, 99, 235, 0.08)",
    borderRadius: 28,
    padding: 18,
    marginBottom: 14,
    shadowColor: "#0F172A",
    shadowOpacity: 0.14,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 14 },
    elevation: 8,
    overflow: "hidden",
  },
  heroCardGlow: {
    position: "absolute",
    top: -40,
    right: -20,
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: "rgba(37, 99, 235, 0.10)",
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
    borderColor: "rgba(255, 255, 255, 0.14)",
    elevation: 8,
    shadowColor: "#0F172A",
    shadowOpacity: 0.22,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
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
    backgroundColor: "rgba(255,255,255,0.96)",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 20,
    zIndex: 999,
    borderWidth: 1,
    borderColor: "rgba(37, 99, 235, 0.08)",
    shadowColor: "#0F172A",
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
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
    borderColor: "rgba(37, 99, 235, 0.08)",
    zIndex: 10,
    shadowColor: "#0F172A",
    shadowOpacity: 0.1,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
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
    elevation: 10,
    borderWidth: 1,
    borderColor: "rgba(37, 99, 235, 0.08)",
    shadowColor: "#0F172A",
    shadowOpacity: 0.12,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
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
    borderColor: "rgba(37, 99, 235, 0.08)",
    shadowColor: "#0F172A",
    shadowOpacity: 0.1,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
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
    borderColor: "rgba(37, 99, 235, 0.08)",
    shadowColor: "#0F172A",
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
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
  tabBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 74,
    backgroundColor: "rgba(255,255,255,0.96)",
    borderTopWidth: 1,
    borderTopColor: "rgba(15, 23, 42, 0.08)",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    paddingBottom: 10,
    paddingHorizontal: 8,
    shadowColor: "#0F172A",
    shadowOpacity: 0.12,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: -10 },
    elevation: 12,
    zIndex: 100,
  },
  tabItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
  },
  tabItemActive: {
    backgroundColor: "rgba(37, 99, 235, 0.12)",
    borderRadius: 16,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  tabIcon: {
    fontSize: 24,
    marginBottom: 4,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: "#64748B",
  },
  tabLabelActive: {
    color: "#2563EB",
    fontWeight: "700",
  },
  tabContent: {
    flex: 1,
    backgroundColor: "#F7F8FC",
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: 80,
  },
  tabTitle: {
    fontSize: 28,
    fontWeight: "900",
    color: "#0F172A",
    marginBottom: 20,
  },
  serviceItem: {
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(37, 99, 235, 0.08)",
    shadowColor: "#0F172A",
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  serviceIcon: {
    fontSize: 32,
    marginRight: 16,
  },
  serviceInfo: {
    flex: 1,
  },
  serviceName: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0F172A",
  },
  serviceDesc: {
    fontSize: 13,
    color: "#64748B",
    marginTop: 4,
  },
  serviceArrow: {
    fontSize: 18,
    color: "#94A3B8",
  },
  activityCard: {
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(37, 99, 235, 0.08)",
    shadowColor: "#0F172A",
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  emptyStateCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    padding: 24,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(37, 99, 235, 0.08)",
    shadowColor: "#0F172A",
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  emptyStateEmoji: {
    fontSize: 34,
    marginBottom: 8,
  },
  emptyStateTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0F172A",
  },
  emptyStateText: {
    fontSize: 13,
    color: "#64748B",
    marginTop: 6,
    textAlign: "center",
  },
  activityEmoji: {
    fontSize: 32,
    marginRight: 16,
  },
  activityInfo: {
    flex: 1,
  },
  activityTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#0F172A",
  },
  activityTime: {
    fontSize: 12,
    color: "#94A3B8",
    marginTop: 4,
  },
  activityDistance: {
    fontSize: 13,
    color: "#2563EB",
    fontWeight: "600",
    marginTop: 4,
  },
  accountCard: {
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    padding: 16,
    marginBottom: 20,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(37, 99, 235, 0.08)",
    shadowColor: "#0F172A",
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  accountAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "rgba(37, 99, 235, 0.12)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 16,
  },
  avatarEmoji: {
    fontSize: 32,
  },
  accountInfo: {
    flex: 1,
  },
  accountName: {
    fontSize: 16,
    fontWeight: "900",
    color: "#0F172A",
  },
  accountEmail: {
    fontSize: 13,
    color: "#64748B",
    marginTop: 4,
  },
  accountPhone: {
    fontSize: 13,
    color: "#2563EB",
    fontWeight: "600",
    marginTop: 2,
  },
  accountMenuItem: {
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 16,
    marginBottom: 10,
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: "rgba(37, 99, 235, 0.08)",
    shadowColor: "#0F172A",
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  accountMenuText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#0F172A",
  },
  accountMenuArrow: {
    fontSize: 16,
    color: "#94A3B8",
  },
  statusBanner: {
    position: "absolute",
    top: 180,
    left: 20,
    right: 20,
    backgroundColor: "rgba(37, 99, 235, 0.12)",
    borderRadius: 16,
    padding: 14,
    borderLeftWidth: 4,
    borderLeftColor: "#2563EB",
    zIndex: 50,
  },
  statusBannerTitle: {
    color: "#0F172A",
    fontWeight: "800",
    fontSize: 14,
  },
  statusBannerText: {
    color: "#64748B",
    marginTop: 4,
    fontSize: 12,
    lineHeight: 16,
  },
  pickupLabelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  gpsShortcutBtn: {
    backgroundColor: "rgba(37, 99, 235, 0.08)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  gpsShortcutText: {
    fontSize: 12,
    color: "#2563EB",
    fontWeight: "800",
  },
  passengerSectionCard: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
  },
  sectionInputLabel: {
    fontSize: 13,
    fontWeight: "800",
    color: "#334155",
    marginBottom: 10,
    letterSpacing: 0.5,
  },
  passengerToggleRow: {
    flexDirection: "row",
    gap: 10,
  },
  passengerToggleBtn: {
    flex: 1,
    backgroundColor: "#F1F5F9",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  passengerToggleBtnActive: {
    borderColor: "#0F172A",
    backgroundColor: "rgba(15, 23, 42, 0.03)",
  },
  passengerToggleLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#64748B",
  },
  passengerToggleLabelActive: {
    color: "#0F172A",
    fontWeight: "800",
  },
  passengerInputContainer: {
    marginTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
    paddingTop: 14,
  },
  passengerInputHeading: {
    fontSize: 13,
    fontWeight: "800",
    color: "#0F172A",
    marginBottom: 12,
  },
  passengerInputGroup: {
    width: "100%",
  },
  passengerInputLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: "#64748B",
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  passengerTextInput: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: "#0F172A",
    fontWeight: "600",
  },
  selectVehicleTitle: {
    fontSize: 12,
    fontWeight: "900",
    color: "#0F172A",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 12,
  },
  vehicleSelectorRow: {
    width: "100%",
    gap: 8,
    marginBottom: 16,
  },
  vehicleOptionCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 16,
    padding: 12,
  },
  vehicleOptionCardSelected: {
    borderColor: "#2563EB",
    backgroundColor: "rgba(37, 99, 235, 0.04)",
  },
  vehicleIcon: {
    fontSize: 26,
    marginRight: 12,
  },
  vehicleDetails: {
    flex: 1,
  },
  vehicleLabel: {
    fontSize: 14,
    fontWeight: "800",
    color: "#0F172A",
  },
  vehicleEtaText: {
    fontSize: 11,
    color: "#64748B",
    marginTop: 2,
    fontWeight: "600",
  },
  vehiclePrice: {
    fontSize: 16,
    fontWeight: "900",
    color: "#0F172A",
  },
  bookingActionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    width: "100%",
  },
  distanceText: {
    fontSize: 20,
    fontWeight: "900",
    color: "#0F172A",
  },
  durationText: {
    fontSize: 13,
    color: "#64748B",
    marginTop: 2,
    fontWeight: "600",
  },
});
