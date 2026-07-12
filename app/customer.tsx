import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Alert, StatusBar, StyleSheet, Text, TouchableOpacity, View, TextInput, ScrollView, ActivityIndicator } from "react-native";

import * as Location from "expo-location";
import { onValue, ref, set, push } from "firebase/database";
import { getDistance } from "geolib";
import MapView, { Marker } from "react-native-maps";
import MapViewDirections from "react-native-maps-directions";

import { Ionicons } from "@expo/vector-icons";
import { db } from "../firebaseConfig";
import { getCurrentUser, logoutUser } from "../services/authService";

const GOOGLE_MAPS_APIKEY = "AIzaSyBzGM7ugM4WVLYbaoZ7e7PcyKpSSJhRWgo";
const MAX_DRIVER_RADIUS_KM = 10;
const MAX_RIDE_DISTANCE_KM = 35;

export default function CustomerScreen() {
  const mapRef = useRef<any>(null);
  const user = getCurrentUser();


  const [currentRideId, setCurrentRideId] = useState<string | null>(null);
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
  const [driverMessage, setDriverMessage] = useState<string | null>(null);

  const [pickupSearchText, setPickupSearchText] = useState("");
  const [destinationSearchText, setDestinationSearchText] = useState("");
  const [pickupSuggestions, setPickupSuggestions] = useState<any[]>([]);
  const [destinationSuggestions, setDestinationSuggestions] = useState<any[]>([]);
  const [loadingPickup, setLoadingPickup] = useState(false);
  const [loadingDestination, setLoadingDestination] = useState(false);

  const pickupTimeoutRef = useRef<any>(null);
  const destTimeoutRef = useRef<any>(null);

  const fetchAutocomplete = async (
    inputText: string,
    setSuggestions: (s: any[]) => void,
    setLoading: (l: boolean) => void
  ) => {
    if (!inputText || inputText.trim().length < 2) {
      setSuggestions([]);
      return;
    }
    setLoading(true);
    try {
      console.log("Fetching OSM suggestions for query:", inputText);
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(inputText)}&format=json&limit=5&countrycodes=in`,
        {
          headers: {
            "User-Agent": "RideXApp/1.0",
          },
        }
      );
      const data = await response.json();
      console.log("OSM API response status/length:", data?.length);

      if (data && Array.isArray(data)) {
        // Map OSM results to match the schema expected by the UI and prediction parsing
        const mapped = data.map((item: any) => ({
          placePrediction: {
            placeId: `osm_${item.lat}_${item.lon}`,
            text: {
              text: item.display_name,
            },
          },
        }));
        setSuggestions(mapped);
      } else {
        setSuggestions([]);
      }
    } catch (error) {
      console.error("OSM Autocomplete API error:", error);
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  };

  const handlePickupTextChange = (text: string) => {
    setPickupSearchText(text);
    if (pickupTimeoutRef.current) {
      clearTimeout(pickupTimeoutRef.current);
    }
    pickupTimeoutRef.current = setTimeout(() => {
      fetchAutocomplete(text, setPickupSuggestions, setLoadingPickup);
    }, 400);
  };

  const handleDestinationTextChange = (text: string) => {
    setDestinationSearchText(text);
    if (destTimeoutRef.current) {
      clearTimeout(destTimeoutRef.current);
    }
    destTimeoutRef.current = setTimeout(() => {
      fetchAutocomplete(text, setDestinationSuggestions, setLoadingDestination);
    }, 400);
  };

  const handlePlaceSelect = async (
    placeId: string,
    description: string,
    isPickup: boolean
  ) => {
    // If the suggestion is from OpenStreetMap, extract coordinates directly from the placeId
    if (placeId.startsWith("osm_")) {
      try {
        const parts = placeId.split("_");
        const lat = parseFloat(parts[1]);
        const lng = parseFloat(parts[2]);
        const address = description;

        if (isPickup) {
          setSource({ latitude: lat, longitude: lng });
          setPickupAddress(address);
          setPickupSearchText(address);
          setPickupSuggestions([]);
        } else {
          setDestination({ latitude: lat, longitude: lng });
          setDestinationAddress(address);
          setDestinationSearchText(address);
          setDestinationSuggestions([]);

          mapRef.current?.animateCamera({
            center: { latitude: lat, longitude: lng },
            zoom: 14,
          });
        }
      } catch (err) {
        console.error("Error parsing OSM coordinates:", err);
        Alert.alert("Error", "Failed to resolve coordinates.");
      }
      return;
    }

    try {
      const response = await fetch(`https://places.googleapis.com/v1/places/${placeId}`, {
        method: "GET",
        headers: {
          "X-Goog-Api-Key": GOOGLE_MAPS_APIKEY,
          "X-Goog-FieldMask": "id,location,displayName,formattedAddress",
        },
      });
      const details = await response.json();

      if (details && details.location) {
        const lat = details.location.latitude;
        const lng = details.location.longitude;
        const address = details.formattedAddress || details.displayName?.text || description;

        if (isPickup) {
          setSource({ latitude: lat, longitude: lng });
          setPickupAddress(address);
          setPickupSearchText(address);
          setPickupSuggestions([]);
        } else {
          setDestination({ latitude: lat, longitude: lng });
          setDestinationAddress(address);
          setDestinationSearchText(address);
          setDestinationSuggestions([]);

          mapRef.current?.animateCamera({
            center: { latitude: lat, longitude: lng },
            zoom: 14,
          });
        }
      } else {
        Alert.alert("Error", "Could not fetch location details.");
      }
    } catch (error) {
      console.error("Place details API error:", error);
      Alert.alert("Error", "Failed to retrieve location details.");
    }
  };

  const driverLocSubRef = useRef<any>(null);

  useEffect(() => {
    if (!user) {
      router.replace("/login");
      return;
    }
    getCurrentLocation();
    const unsubHistory = listenForRideHistory();

    return () => {
      unsubHistory?.();
      if (driverLocSubRef.current) {
        driverLocSubRef.current();
      }
    };
  }, [user]);

  useEffect(() => {
    if (source) {
      const unsubDrivers = getNearbyDrivers(source);
      return () => {
        unsubDrivers?.();
      };
    }
  }, [source]);

  // Listen for user's active ride ID from Firebase on mount/auth change
  useEffect(() => {
    if (!user) return;
    const currentRideIdRef = ref(db, `users/${user.uid}/currentRideId`);
    return onValue(currentRideIdRef, (snapshot) => {
      const rideId = snapshot.val();
      if (rideId) {
        setCurrentRideId(rideId);
      }
    });
  }, [user]);

  // Listen to the unique active ride data
  useEffect(() => {
    if (!currentRideId) return;

    const rideRef = ref(db, `rides/${currentRideId}`);
    const unsubscribe = onValue(rideRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const status = data.status || "pending";
        setRideStatus(status);
        setSource(data.source);
        setDestination(data.destination);
        setRideOTP(String(data.otp));
        setPickupAddress(data.pickupAddress || "");
        setDestinationAddress(data.destinationAddress || "");

        // Listen to driver messages
        if (data.driverMessage) {
          setDriverMessage(data.driverMessage);
        } else {
          setDriverMessage(null);
        }

        if (status === "pending") {
          setRideStatusTitle("Ride request sent");
          setRideStatusMessage("Your request is live and the nearest active driver is being notified.");
        } else if (status === "accepted") {
          setRideStatusTitle("Driver accepted");
          setRideStatusMessage("Your driver is on the way. Keep this screen open for live updates.");
        } else if (status === "rejected") {
          setRideStatusTitle("Ride request rejected");
          setRideStatusMessage("Your request was declined. Please try booking again.");
        } else if (status === "started") {
          setRideStatusTitle("Trip started");
          setRideStatusMessage("Have a safe journey!");
        } else if (status === "completed") {
          setRideStatusTitle("Trip completed");
          setRideStatusMessage("Thank you for riding with RideX!");
        } else if (status === "cancelled") {
          setRideStatusTitle("Trip cancelled");
          setRideStatusMessage("This ride request has been cancelled.");
        }

        if (data.driverId) {
          const driverLocRef = ref(db, `drivers/${data.driverId}`);
          if (driverLocSubRef.current) {
            driverLocSubRef.current();
          }
          driverLocSubRef.current = onValue(driverLocRef, (driverSnap) => {
            const driverLocVal = driverSnap.val();
            if (driverLocVal) {
              setSelectedDriver({
                id: data.driverId,
                latitude: driverLocVal.latitude,
                longitude: driverLocVal.longitude,
                driverDistance: data.driverDistance,
              });
            }
          });
        }
      } else {
        setRideStatus(null);
        setRideOTP("");
        setSelectedDriver(null);
        setDriverMessage(null);
      }
    });

    return () => {
      unsubscribe();
      if (driverLocSubRef.current) {
        driverLocSubRef.current();
      }
    };
  }, [currentRideId]);
  useEffect(() => {
    if (pickupAddress) {
      setPickupSearchText(pickupAddress);
    }
  }, [pickupAddress]);

  useEffect(() => {
    if (destinationAddress) {
      setDestinationSearchText(destinationAddress);
    }
  }, [destinationAddress]);

  const getFareForVehicle = (vehicle: "bike" | "auto" | "car", dist: number) => {
    return Math.round(
      vehicle === "bike"
        ? 20 + dist * 6
        : vehicle === "auto"
          ? 30 + dist * 9
          : 50 + dist * 14
    );
  };

  // Local fallback distance calculation (if Directions API fails or is not billed)
  useEffect(() => {
    if (source && destination) {
      const directDist = getDistance(source, destination) / 1000;
      const estimatedRoadDist = directDist * 1.25; // 25% overhead for road curves
      setDistance(estimatedRoadDist.toFixed(1));
      const calculatedFare = getFareForVehicle(selectedVehicle, estimatedRoadDist);
      setFare(calculatedFare);
      setDuration(Math.ceil(estimatedRoadDist * 2)); // Estimate 2 mins per km
    }
  }, [source, destination, selectedVehicle]);
  const resetBookingState = async () => {
    try {
      if (currentRideId) {
        await set(ref(db, `rides/${currentRideId}`), null);
      }
      if (user) {
        await set(ref(db, `users/${user.uid}/currentRideId`), null);
      }
    } catch (err) {
      console.error("Error clearing current ride:", err);
    }
    setCurrentRideId(null);
    setRideStatus(null);
    setRideOTP("");
    setSelectedDriver(null);
    setDriverMessage(null);
    setDestination(null);
    setDestinationAddress("");
    setDistance(null);
    setDuration(null);
    setFare(0);
    setSearchingDriver(false);
    setShowArrivalCard(false);
    setDriverETA(null);
    setPickupSearchText("");
    setDestinationSearchText("");
    setPickupSuggestions([]);
    setDestinationSuggestions([]);
    getCurrentLocation();
  };

  const cancelRideRequest = async () => {
    try {
      if (currentRideId) {
        await set(ref(db, `rides/${currentRideId}/status`), "cancelled");
      }
      if (user) {
        await set(ref(db, `users/${user.uid}/currentRideId`), null);
      }
    } catch (err) {
      console.error("Error cancelling ride:", err);
    }
    setCurrentRideId(null);
    setRideStatus(null);
    setRideOTP("");
    setSelectedDriver(null);
    setDriverMessage(null);
    setDestination(null);
    setDestinationAddress("");
    setDistance(null);
    setDuration(null);
    setFare(0);
    setSearchingDriver(false);
    setShowArrivalCard(false);
    setDriverETA(null);
    setPickupSearchText("");
    setDestinationSearchText("");
    setPickupSuggestions([]);
    setDestinationSuggestions([]);
    getCurrentLocation();
    Alert.alert("Ride Cancelled ❌", "Your ride request has been cancelled.");
  };

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
    setPickupSearchText("📍 Current Location");
  };

  const getNearbyDrivers = (currentSource: any) => {
    const driversRef = ref(db, "drivers");

    return onValue(driversRef, (snapshot) => {
      const data = snapshot.val();

      if (data && currentSource) {
        const nearbyDrivers = Object.keys(data)
          .map((key) => {
            const driver = data[key];
            if (
              !driver ||
              typeof driver.latitude !== "number" ||
              typeof driver.longitude !== "number"
            ) {
              return null;
            }
            try {
              const driverDistance = getDistance(
                {
                  latitude: currentSource.latitude,
                  longitude: currentSource.longitude,
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
            } catch (err) {
              console.error("Error calculating distance:", err);
              return null;
            }
          })
          .filter((d): d is any => d !== null && d.isActive !== false)
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
      } else {
        setDrivers([]);
      }
    });
  };

  const bookRide = async () => {
    const rideDistanceKm = Number(distance || 0);

    if (rideDistanceKm > MAX_RIDE_DISTANCE_KM) {
      Alert.alert(
        "Service Not Available",
        `RideX currently supports bookings up to ${MAX_RIDE_DISTANCE_KM} km.`
      );
      return;
    }

    const availableDrivers = (drivers || []).filter(
      (driver: any) => (driver.distance ?? 0) <= MAX_DRIVER_RADIUS_KM
    );

    const generatedOTP = Math.floor(1000 + Math.random() * 9000);
    let nearestDriver = availableDrivers && availableDrivers.length > 0 ? availableDrivers[0] : null;

    // Robust testing fallback: If no driver is within 10km, but a driver is online in Firebase, assign it to them!
    if (!nearestDriver && drivers && drivers.length > 0) {
      nearestDriver = drivers[0];
    }

    if (!nearestDriver && user) {
      // Self-assignment simulation mode when no online drivers are found
      const driverLat = (source?.latitude || 28.6139) + 0.005;
      const driverLng = (source?.longitude || 77.2090) + 0.005;

      nearestDriver = {
        id: user.uid,
        name: user.displayName || "Test Driver",
        distance: 1.2,
        latitude: driverLat,
        longitude: driverLng,
      };

      // Register current user as active driver in the database at the current source location
      await set(ref(db, `drivers/${user.uid}`), {
        latitude: driverLat,
        longitude: driverLng,
        isActive: true,
        updatedAt: Date.now(),
      });
    }

    if (!nearestDriver) {
      Alert.alert("No Driver Available 🚫");
      return;
    }

    setSelectedDriver(nearestDriver);
    setSearchingDriver(true);
    setShowArrivalCard(false);
    setRideStatusTitle("Ride request sent");
    setRideStatusMessage("Your request is live and nearby active drivers are being notified.");

    const newRideRef = push(ref(db, "rides"));
    const rideId = newRideRef.key;
    if (!rideId || !user) return;

    setCurrentRideId(rideId);
    await set(ref(db, `users/${user.uid}/currentRideId`), rideId);

    // Set the driver's currentRideId so their driver screen immediately loads it
    await set(ref(db, `drivers/${nearestDriver.id}/currentRideId`), rideId);

    await set(newRideRef, {
      id: rideId,
      customerId: user.uid,
      customerName: user.displayName || "RideX Customer",
      customerPhone: "+91 88888 88888",
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
      vehicleType: selectedVehicle,
      fare: fare,
    });

    setRideStatus("pending");
    Alert.alert("Searching Driver 🚖", "We are connecting you to the nearest active driver.");
  };

  const listenForRideHistory = () => {
    const historyRef = ref(db, "rides/history");

    return onValue(historyRef, (snapshot) => {
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

      {/* Floating Debug Reset Button */}
      <TouchableOpacity style={styles.resetDebugBtn} onPress={resetBookingState}>
        <Text style={styles.resetDebugText}>Reset Console</Text>
      </TouchableOpacity>

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
            {source && typeof source.latitude === "number" && typeof source.longitude === "number" && (
              <Marker coordinate={source} anchor={{ x: 0.5, y: 0.5 }}>
                <View style={styles.uberPickupMarkerOuter}>
                  <View style={styles.uberPickupMarkerInner} />
                </View>
              </Marker>
            )}

            {destination && typeof destination.latitude === "number" && typeof destination.longitude === "number" && (
              <Marker coordinate={destination} anchor={{ x: 0.5, y: 0.5 }}>
                <View style={styles.uberDropoffMarkerOuter}>
                  <View style={styles.uberDropoffMarkerInner} />
                </View>
              </Marker>
            )}

            {/* Render all nearby active drivers when no driver is selected */}
            {!selectedDriver &&
              drivers.map((driver: any) => {
                if (typeof driver.latitude !== "number" || typeof driver.longitude !== "number") {
                  return null;
                }
                return (
                  <Marker
                    key={driver.id}
                    coordinate={{
                      latitude: driver.latitude,
                      longitude: driver.longitude,
                    }}
                  >
                    <View style={styles.driverMarkerWrap}>
                      <Text style={styles.driverMarkerEmoji}>🚖</Text>
                    </View>
                  </Marker>
                );
              })}

            {selectedDriver && typeof selectedDriver.latitude === "number" && typeof selectedDriver.longitude === "number" && (
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

            {rideStatus === "accepted" && selectedDriver && typeof selectedDriver.latitude === "number" && typeof selectedDriver.longitude === "number" && source && (
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

          {rideStatus !== "pending" && rideStatus !== "accepted" && rideStatus !== "started" && !destination && (
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

              {/* Pickup Address Field with Real Google API (New) */}
              <View style={styles.inputSearchWrapper}>
                <TextInput
                  style={styles.realAddressInput}
                  placeholder="Where to pick up from?"
                  placeholderTextColor="#94A3B8"
                  value={pickupSearchText}
                  onChangeText={handlePickupTextChange}
                />
                {loadingPickup && (
                  <ActivityIndicator style={styles.inputSpinner} size="small" color="#2563EB" />
                )}
                {pickupSuggestions.length > 0 && (
                  <View style={styles.liveSuggestionsDropdown}>
                    <ScrollView keyboardShouldPersistTaps="handled">
                      {pickupSuggestions.map((item) => (
                        <TouchableOpacity
                          key={item.placePrediction.placeId}
                          style={styles.liveSuggestionRow}
                          onPress={() => handlePlaceSelect(item.placePrediction.placeId, item.placePrediction.text.text, true)}
                        >
                          <Text style={styles.liveSuggestionLabel}>{item.placePrediction.text.text}</Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                )}
              </View>

              {/* Destination Address Field with Real Google API (New) */}
              <View style={styles.inputSearchWrapper}>
                <TextInput
                  style={styles.realAddressInput}
                  placeholder="Where to?"
                  placeholderTextColor="#94A3B8"
                  value={destinationSearchText}
                  onChangeText={handleDestinationTextChange}
                />
                {loadingDestination && (
                  <ActivityIndicator style={styles.inputSpinner} size="small" color="#2563EB" />
                )}
                {destinationSuggestions.length > 0 && (
                  <View style={styles.liveSuggestionsDropdown}>
                    <ScrollView keyboardShouldPersistTaps="handled">
                      {destinationSuggestions.map((item) => (
                        <TouchableOpacity
                          key={item.placePrediction.placeId}
                          style={styles.liveSuggestionRow}
                          onPress={() => handlePlaceSelect(item.placePrediction.placeId, item.placePrediction.text.text, false)}
                        >
                          <Text style={styles.liveSuggestionLabel}>{item.placePrediction.text.text}</Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                )}
              </View>
            </View>
          )}

          {destination && !rideStatus && (
            <View style={styles.minimizedSearchHeader}>
              <TouchableOpacity style={styles.miniBackBtn} onPress={() => {
                setDestination(null);
                setDestinationAddress("");
                setDistance(null);
              }}>
                <Text style={styles.miniBackArrow}>←</Text>
              </TouchableOpacity>
              <View style={styles.miniRouteInfo}>
                <Text style={styles.miniRouteText} numberOfLines={1}>
                  🟢 {pickupAddress || "Current Location"}
                </Text>
                <Text style={styles.miniRouteText} numberOfLines={1}>
                  🔴 {destinationAddress}
                </Text>
              </View>
            </View>
          )}

          {driverMessage && (
            <View style={styles.driverMessageAlert}>
              <View style={styles.messageAlertHeader}>
                <Text style={styles.messageAlertTitle}>💬 Message from Driver</Text>
              </View>
              <Text style={styles.messageAlertContent}>"{driverMessage}"</Text>
            </View>
          )}

          {rideStatus && (
            <View style={styles.statusBanner}>
              <Text style={styles.statusBannerTitle}>{rideStatusTitle}</Text>
              <Text style={styles.statusBannerText}>{rideStatusMessage}</Text>
              {(rideStatus === "completed" || rideStatus === "rejected") && (
                <TouchableOpacity style={styles.bookNewRideBtn} onPress={resetBookingState}>
                  <Text style={styles.bookNewRideBtnText}>Book New Ride</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {searchingDriver && rideStatus === "pending" && (
            <View style={styles.searchingCard}>
              <Text style={styles.searchingTitle}>Searching for the best driver</Text>
              <Text style={styles.searchingText}>Your request is live and the nearest active driver is being notified.</Text>
              <TouchableOpacity style={styles.cancelRideBtn} onPress={cancelRideRequest}>
                <Text style={styles.cancelRideBtnText}>Cancel Request</Text>
              </TouchableOpacity>
            </View>
          )}

          {rideOTP && rideStatus === "accepted" && (
            <View style={styles.otpCard}>
              <Text style={styles.otpLabel}>Share OTP With Driver</Text>
              <Text style={styles.otpValue}>{rideOTP}</Text>
              <Text style={styles.otpFare}>₹{fare}</Text>
            </View>
          )}

          {showArrivalCard && (
            <View style={styles.arrivalCard}>
              <View style={styles.arrivalCardHeader}>
                <Text style={styles.arrivalTitle}>🚖 Driver arriving</Text>
                {driverETA && <Text style={styles.arrivalEtaText}>{driverETA} mins away</Text>}
              </View>

              {/* Driver Partner Identity Row */}
              <View style={styles.driverIdentityRow}>
                <View style={styles.driverAvatar}>
                  <Text style={styles.driverAvatarText}>
                    {String(selectedDriver?.name || "D").substring(0, 1).toUpperCase()}
                  </Text>
                </View>
                <View style={styles.driverMeta}>
                  <Text style={styles.driverNameText}>{selectedDriver?.name || "Driver Partner"}</Text>
                  <Text style={styles.driverVehicleText}>
                    🚗 Suzuki Dzire • {String(selectedVehicle || "Car").toUpperCase()}
                  </Text>
                </View>
                <View style={styles.riderCommRow}>
                  <TouchableOpacity
                    style={styles.riderCommCircle}
                    onPress={() => Alert.alert("Calling Driver 📞", `Dialing driver partner ${selectedDriver?.name || ""}...`)}
                  >
                    <Ionicons name="call" size={18} color="#0F172A" />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Driver Message Option block */}
              {driverMessage && (
                <View style={styles.riderMsgOptionRow}>
                  <View style={styles.riderMsgHeader}>
                    <Text style={styles.riderMsgTitle}>💬 MESSAGE FROM DRIVER</Text>
                  </View>
                  <Text style={styles.riderMsgText}>"{driverMessage}"</Text>
                </View>
              )}

              <TouchableOpacity style={styles.cancelRideBtn} onPress={cancelRideRequest}>
                <Text style={styles.cancelRideBtnText}>Cancel Ride</Text>
              </TouchableOpacity>
            </View>
          )}

          {distance && !rideStatus && (
            <View style={styles.bottomCard}>
              <View style={styles.dragHandle} />

              <View style={styles.routeSummaryRow}>
                <Text style={styles.routeSummaryText}>⏱️ {duration} mins • {distance} km</Text>
                <TouchableOpacity style={styles.paymentMethodRow} activeOpacity={0.7}>
                  <Text style={styles.paymentMethodText}>💵 Cash</Text>
                  <Text style={styles.paymentMethodArrow}>›</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.selectVehicleTitle}>Select vehicle class</Text>

              <View style={styles.vehicleSelectorRow}>
                <TouchableOpacity
                  style={[styles.vehicleOptionCard, selectedVehicle === "bike" && styles.vehicleOptionCardSelected]}
                  onPress={() => setSelectedVehicle("bike")}
                  activeOpacity={0.8}
                >
                  <Text style={styles.vehicleIcon}>🏍️</Text>
                  <View style={styles.vehicleDetails}>
                    <Text style={styles.vehicleLabel}>RideX Moto</Text>
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
                    <Text style={styles.vehicleLabel}>RideX Go</Text>
                    <Text style={styles.vehicleEtaText}>Premium Comfort • 4 mins</Text>
                  </View>
                  <Text style={styles.vehiclePrice}>₹{getFareForVehicle("car", Number(distance))}</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity style={styles.fullWidthBookBtn} onPress={bookRide} activeOpacity={0.9}>
                <Text style={styles.fullWidthBookText}>Confirm Ride</Text>
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
      {!destination && !rideStatus && (
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
    overflow: "visible",
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
  dragHandle: {
    width: 40,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: "#E2E8F0",
    alignSelf: "center",
    marginBottom: 12,
  },
  routeSummaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
    paddingBottom: 12,
  },
  routeSummaryText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#475569",
  },
  paymentMethodRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  paymentMethodText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0F172A",
  },
  paymentMethodArrow: {
    fontSize: 18,
    color: "#94A3B8",
    fontWeight: "bold",
    marginTop: -2,
  },
  fullWidthBookBtn: {
    backgroundColor: "#0F172A", // Slate black like Uber
    width: "100%",
    height: 54,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  fullWidthBookText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  resetDebugBtn: {
    position: "absolute",
    top: 50,
    right: 20,
    backgroundColor: "rgba(15, 23, 42, 0.92)",
    borderRadius: 16,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    zIndex: 9999,
  },
  resetDebugText: {
    color: "#EF4444",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  cancelRideBtn: {
    backgroundColor: "#F1F5F9",
    borderRadius: 16,
    height: 44,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 12,
    width: "100%",
    borderWidth: 1,
    borderColor: "#CBD5E1",
  },
  cancelRideBtnText: {
    color: "#475569",
    fontSize: 14,
    fontWeight: "800",
  },
  bookNewRideBtn: {
    backgroundColor: "#2563EB",
    borderRadius: 16,
    height: 48,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 12,
    width: "100%",
    shadowColor: "#2563EB",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 4,
  },
  bookNewRideBtnText: {
    color: "white",
    fontSize: 15,
    fontWeight: "800",
  },
  minimizedSearchHeader: {
    position: "absolute",
    top: 50,
    left: 20,
    right: 20,
    backgroundColor: "white",
    borderRadius: 20,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.16)",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 6,
    zIndex: 999,
  },
  miniBackBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  miniBackArrow: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0F172A",
  },
  miniRouteInfo: {
    flex: 1,
    gap: 4,
  },
  miniRouteText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#334155",
  },
  realAddressInput: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    height: 52,
    paddingHorizontal: 16,
    fontSize: 15,
    color: "#0F172A",
    fontWeight: "600",
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    shadowColor: "#0F172A",
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  liveSuggestionsDropdown: {
    backgroundColor: "white",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.16)",
    marginTop: 6,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 6,
    zIndex: 9999,
    maxHeight: 200,
    overflow: "hidden",
  },
  liveSuggestionRow: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  liveSuggestionLabel: {
    fontSize: 14,
    color: "#334155",
    fontWeight: "600",
  },
  inputSearchWrapper: {
    position: "relative",
    marginBottom: 12,
    zIndex: 9999,
  },
  inputSpinner: {
    position: "absolute",
    right: 18,
    top: 18,
  },
  driverMessageAlert: {
    position: "absolute",
    top: 130,
    left: 20,
    right: 20,
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 14,
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    shadowColor: "#0F172A",
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
    zIndex: 1000,
  },
  messageAlertHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  messageAlertTitle: {
    fontSize: 12,
    fontWeight: "900",
    color: "#2563EB",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  messageAlertContent: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0F172A",
    lineHeight: 18,
  },
  uberPickupMarkerOuter: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#000000",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000000",
    shadowOpacity: 0.2,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  uberPickupMarkerInner: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#FFFFFF",
  },
  uberDropoffMarkerOuter: {
    width: 16,
    height: 16,
    backgroundColor: "#000000",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000000",
    shadowOpacity: 0.2,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  uberDropoffMarkerInner: {
    width: 5,
    height: 5,
    backgroundColor: "#FFFFFF",
  },
  arrivalCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  arrivalEtaText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#2563EB",
  },
  driverIdentityRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderTopWidth: 1.5,
    borderTopColor: "#F1F5F9",
    borderBottomWidth: 1.5,
    borderBottomColor: "#F1F5F9",
    marginBottom: 12,
  },
  driverAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#E2E8F0",
    alignItems: "center",
    justifyContent: "center",
  },
  driverAvatarText: {
    fontSize: 16,
    fontWeight: "800",
    color: "#475569",
  },
  driverMeta: {
    flex: 1,
    marginLeft: 12,
  },
  driverNameText: {
    fontSize: 15,
    fontWeight: "800",
    color: "#0F172A",
  },
  driverVehicleText: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 2,
  },
  riderCommRow: {
    flexDirection: "row",
  },
  riderCommCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#F1F5F9",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    alignItems: "center",
    justifyContent: "center",
  },
  riderMsgOptionRow: {
    backgroundColor: "#F8FAFC",
    borderLeftWidth: 4,
    borderLeftColor: "#2563EB",
    padding: 12,
    borderRadius: 8,
    marginBottom: 14,
  },
  riderMsgHeader: {
    marginBottom: 4,
  },
  riderMsgTitle: {
    fontSize: 10,
    fontWeight: "800",
    color: "#2563EB",
    letterSpacing: 0.5,
  },
  riderMsgText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#334155",
    fontStyle: "italic",
  },
});
