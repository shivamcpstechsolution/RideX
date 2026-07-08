import { useEffect, useRef, useState } from "react";
import {
    Alert,
    Animated,
    Dimensions,
    Easing,
    Modal,
    Platform,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as Location from "expo-location";
import MapView, { Marker } from "react-native-maps";
import MapViewDirections from "react-native-maps-directions";

import { onValue, ref, set, update } from "firebase/database";
import { db } from "../firebaseConfig";
import { getCurrentUser } from "../services/authService";

const { width: screenWidth, height: screenHeight } = Dimensions.get("window");
const GOOGLE_MAPS_APIKEY = "AIzaSyBzGM7ugM4WVLYbaoZ7e7PcyKpSSJhRWgo";

// Premium light silver map style JSON for a clean driver console
const silverMapStyle = [
  {
    "elementType": "geometry",
    "stylers": [{ "color": "#f5f5f5" }]
  },
  {
    "elementType": "labels.icon",
    "stylers": [{ "visibility": "off" }]
  },
  {
    "elementType": "labels.text.fill",
    "stylers": [{ "color": "#616161" }]
  },
  {
    "elementType": "labels.text.stroke",
    "stylers": [{ "color": "#f5f5f5" }]
  },
  {
    "featureType": "administrative.land_parcel",
    "elementType": "labels.text.fill",
    "stylers": [{ "color": "#bdbdbd" }]
  },
  {
    "featureType": "poi",
    "elementType": "geometry",
    "stylers": [{ "color": "#eeeeee" }]
  },
  {
    "featureType": "poi",
    "elementType": "labels.text.fill",
    "stylers": [{ "color": "#757575" }]
  },
  {
    "featureType": "road",
    "elementType": "geometry",
    "stylers": [{ "color": "#ffffff" }]
  },
  {
    "featureType": "road.arterial",
    "elementType": "labels.text.fill",
    "stylers": [{ "color": "#757575" }]
  },
  {
    "featureType": "road.highway",
    "elementType": "geometry",
    "stylers": [{ "color": "#dadada" }]
  },
  {
    "featureType": "road.highway",
    "elementType": "labels.text.fill",
    "stylers": [{ "color": "#616161" }]
  },
  {
    "featureType": "water",
    "elementType": "geometry",
    "stylers": [{ "color": "#c9c9c9" }]
  },
  {
    "featureType": "water",
    "elementType": "labels.text.fill",
    "stylers": [{ "color": "#9e9e9e" }]
  }
];

export default function DriverScreen() {
  const mapRef = useRef<any>(null);
  const user = getCurrentUser();

  // Core tracking states
  const [location, setLocation] = useState<any>(null);
  const [currentRideId, setCurrentRideId] = useState<string | null>(null);
  const [rideRequest, setRideRequest] = useState<any>(null);
  const [enteredOTP, setEnteredOTP] = useState("");
  const [lastRideId, setLastRideId] = useState("");
  const [isCompletingRide, setIsCompletingRide] = useState(false);
  const [isActive, setIsActive] = useState(true);

  // Simulated metrics & timer states
  const [dailyEarnings, setDailyEarnings] = useState(1850);
  const [tripsCompleted, setTripsCompleted] = useState(6);
  const [onlineHours, setOnlineHours] = useState("3.4h");
  const [countdown, setCountdown] = useState(90);
  const [confirmComplete, setConfirmComplete] = useState(false);

  // Modals for UI feedback
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [showEarningsModal, setShowEarningsModal] = useState(false);
  const [tempRideSummary, setTempRideSummary] = useState<any>(null);

  // Chat messaging states
  const [showChatModal, setShowChatModal] = useState(false);
  const [chatMessage, setChatMessage] = useState("");
  const [lastSentMessage, setLastSentMessage] = useState("");

  // Animation values
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const toggleSlideAnim = useRef(new Animated.Value(isActive ? 1 : 0)).current;

  const trackingSubRef = useRef<any>(null);
  const isActiveRef = useRef(isActive);

  useEffect(() => {
    isActiveRef.current = isActive;
    Animated.timing(toggleSlideAnim, {
      toValue: isActive ? 1 : 0,
      duration: 250,
      easing: Easing.out(Easing.ease),
      useNativeDriver: false,
    }).start();
  }, [isActive]);

  // Handle active status location update
  useEffect(() => {
    if (!user) {
      router.replace("/login");
      return;
    }
    startTracking();

    return () => {
      if (trackingSubRef.current) {
        trackingSubRef.current.remove();
      }
    };
  }, [user]);

  // Online Hour Counter simulator
  useEffect(() => {
    let interval: any;
    if (isActive) {
      let seconds = 3.4 * 3600;
      interval = setInterval(() => {
        seconds += 1;
        const hrs = (seconds / 3600).toFixed(1);
        setOnlineHours(`${hrs}h`);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isActive]);

  // Listen for user's active ride ID from Firebase
  useEffect(() => {
    if (!user) return;
    const rideIdRef = ref(db, `drivers/${user.uid}/currentRideId`);
    return onValue(rideIdRef, (snapshot) => {
      const val = snapshot.val();
      setCurrentRideId(val);
    });
  }, [user]);

  // Listen to the unique active ride data
  useEffect(() => {
    if (!currentRideId) {
      setRideRequest(null);
      setConfirmComplete(false);
      return;
    }

    const rideRef = ref(db, `rides/${currentRideId}`);
    const unsubscribe = onValue(rideRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setRideRequest(data);
        if (data.status === "pending" && data.createdAt !== lastRideId) {
          setLastRideId(data.createdAt);
          // Play a premium notification success pattern
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
      } else {
        setRideRequest(null);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [currentRideId]);

  // Ringing Radar Animation & Auto-Decline Timer
  useEffect(() => {
    let timer: any;
    let pulseLoop: any;

    if (rideRequest && rideRequest.status === "pending") {
      setCountdown(90);
      
      // Start Haptic Vibration Alert and Visual Pulsing Loop
      pulseLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.25,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          })
        ])
      );
      pulseLoop.start();

      timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            pulseLoop.stop();
            // Automatically Reject / Ignore Ride when timer ends
            rejectRide();
            return 0;
          }
          // Tick haptics on every second decrement
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          return prev - 1;
        });
      }, 1000);
    } else {
      pulseAnim.setValue(1);
      setCountdown(90);
    }

    return () => {
      if (timer) clearInterval(timer);
      if (pulseLoop) pulseLoop.stop();
    };
  }, [rideRequest?.id, rideRequest?.status]);

  // Simulated Movement along the route (unchanged simulation hooks)
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

  // Adjust map camera view to encompass relevant coordinates
  useEffect(() => {
    if (!mapRef.current || !location) return;
    
    const coords = [location];
    if (rideRequest) {
      if ((rideRequest.status === "pending" || rideRequest.status === "accepted") && rideRequest.source) {
        coords.push(rideRequest.source);
      } else if (rideRequest.status === "started" && rideRequest.destination) {
        coords.push(rideRequest.destination);
      }
    }

    if (coords.length > 1) {
      mapRef.current.fitToCoordinates(coords, {
        edgePadding: { top: 180, right: 60, bottom: 320, left: 60 },
        animated: true,
      });
    } else {
      mapRef.current.animateCamera({
        center: location,
        zoom: 16,
      }, { duration: 1000 });
    }
  }, [location?.latitude, location?.longitude, rideRequest?.status]);

  const startTracking = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") return;

    if (trackingSubRef.current) {
      trackingSubRef.current.remove();
      trackingSubRef.current = null;
    }

    trackingSubRef.current = await Location.watchPositionAsync(
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
          await update(ref(db, `drivers/${user.uid}`), {
            latitude: coords.latitude,
            longitude: coords.longitude,
            isActive: isActiveRef.current,
          });
        }
      }
    );
  };

  const toggleAvailability = async () => {
    const nextState = !isActive;
    setIsActive(nextState);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    if (!user) return;

    if (location) {
      await update(ref(db, `drivers/${user.uid}`), {
        latitude: location.latitude,
        longitude: location.longitude,
        isActive: nextState,
      });
    } else {
      await set(ref(db, `drivers/${user.uid}/isActive`), nextState);
    }
  };

  const acceptRide = async () => {
    if (!rideRequest || !user || !currentRideId) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    await set(ref(db, `rides/${currentRideId}`), {
      ...rideRequest,
      status: "accepted",
      driverId: user.uid,
      driverName: user.displayName || "Driver",
    });
  };

  const startRide = async () => {
    if (!rideRequest || !currentRideId) return;

    if (enteredOTP.trim() === String(rideRequest?.otp)) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await set(ref(db, `rides/${currentRideId}`), {
        ...rideRequest,
        status: "started",
      });
      setEnteredOTP("");
      Alert.alert("OTP Verified ✅", "Start driving to the passenger destination.");
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Invalid OTP ❌", "Please check the code with the customer.");
    }
  };

  const completeRide = async () => {
    if (!rideRequest || isCompletingRide || rideRequest.status !== "started" || !currentRideId || !user) return;

    setIsCompletingRide(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    try {
      const completedAt = Date.now();
      const rideId = String(completedAt);

      const updatedRide = {
        ...rideRequest,
        status: "completed",
        completedAt,
      };

      await set(ref(db, `rides/history/${rideId}`), updatedRide);
      await set(ref(db, `rides/${currentRideId}`), updatedRide);
      await set(ref(db, `drivers/${user.uid}/currentRideId`), null);

      // Save summary data locally to show in summary modal
      setTempRideSummary(updatedRide);
      setDailyEarnings((prev) => prev + (rideRequest.fare || 0));
      setTripsCompleted((prev) => prev + 1);
      setShowSummaryModal(true);

      setRideRequest(null);
      setCurrentRideId(null);
      setLastSentMessage("");
      setChatMessage("");
      setShowChatModal(false);
    } catch (err) {
      console.error(err);
    } finally {
      setIsCompletingRide(false);
      setConfirmComplete(false);
    }
  };

  const rejectRide = async () => {
    if (!rideRequest || !currentRideId || !user) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    await set(ref(db, `rides/${currentRideId}`), {
      ...rideRequest,
      status: "rejected",
    });
    await set(ref(db, `drivers/${user.uid}/currentRideId`), null);
    setRideRequest(null);
    setCurrentRideId(null);
    setLastSentMessage("");
    setChatMessage("");
    setShowChatModal(false);
  };

  const sendChatMessage = async (text: string) => {
    if (!text.trim() || !currentRideId) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    try {
      await update(ref(db, `rides/${currentRideId}`), {
        driverMessage: text.trim(),
        driverMessageTime: Date.now(),
      });
      setLastSentMessage(text.trim());
      setChatMessage("");
      Alert.alert("Message Sent 💬", `"${text.trim()}" has been sent to the passenger.`);
    } catch (err) {
      console.error("Error sending message:", err);
    }
  };

  // Simulating custom customer call trigger
  const triggerCustomerCall = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      "Calling Passenger 📞",
      `Dialing ${rideRequest?.passengerName || rideRequest?.customerName || "Customer"} at ${rideRequest?.passengerPhone || "+91 88888 88888"}`
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />

      {/* Modern High-Performance Map */}
      <MapView
        ref={mapRef}
        style={styles.map}
        customMapStyle={silverMapStyle}
        showsUserLocation={false}
        initialRegion={{
          latitude: location?.latitude || 28.6139,
          longitude: location?.longitude || 77.209,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        }}
      >
        {/* Render Live Routing Paths */}
        {location && rideRequest && (rideRequest.status === "pending" || rideRequest.status === "accepted") && rideRequest.source && (
          <MapViewDirections
            origin={location}
            destination={rideRequest.source}
            apikey={GOOGLE_MAPS_APIKEY}
            strokeWidth={4.5}
            strokeColor="#10b981" // Green route path to pickup
          />
        )}

        {location && rideRequest && rideRequest.status === "started" && rideRequest.destination && (
          <MapViewDirections
            origin={location}
            destination={rideRequest.destination}
            apikey={GOOGLE_MAPS_APIKEY}
            strokeWidth={4.5}
            strokeColor="#3b82f6" // Blue route path to dropoff
          />
        )}

        {/* Custom Driver Vehicle Marker */}
        {location && (
          <Marker coordinate={location} anchor={{ x: 0.5, y: 0.5 }}>
            <View style={styles.driverMarkerWrap}>
              <View style={styles.driverMarkerOuter}>
                <View style={styles.driverMarkerInner}>
                  <Text style={styles.driverEmojiText}>
                    {rideRequest?.vehicleType === "bike" ? "🏍️" : rideRequest?.vehicleType === "auto" ? "🛺" : "🚗"}
                  </Text>
                </View>
              </View>
              {isActive && <View style={styles.driverPulse} />}
            </View>
          </Marker>
        )}

        {/* Custom Pickup Marker */}
        {rideRequest && (rideRequest.status === "pending" || rideRequest.status === "accepted") && rideRequest.source && (
          <Marker coordinate={rideRequest.source}>
            <View style={[styles.customPin, styles.pickupPin]}>
              <Ionicons name="pin" size={14} color="#ffffff" />
              <Text style={styles.customPinLabel}>PICKUP</Text>
            </View>
          </Marker>
        )}

        {/* Custom Dropoff Marker */}
        {rideRequest && rideRequest.destination && (
          <Marker coordinate={rideRequest.destination}>
            <View style={[styles.customPin, styles.dropoffPin]}>
              <Ionicons name="flag" size={14} color="#ffffff" />
              <Text style={styles.customPinLabel}>DROP</Text>
            </View>
          </Marker>
        )}
      </MapView>

      {/* Floating Modern Header bar */}
      <View style={styles.headerFloatingContainer}>
        <View style={styles.headerRow}>
          {/* Avatar Profile */}
          <TouchableOpacity 
            style={styles.avatarButton}
            onPress={() => setShowEarningsModal(true)}
          >
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarText}>
                {user?.displayName ? user.displayName.substring(0, 2).toUpperCase() : "DR"}
              </Text>
            </View>
          </TouchableOpacity>

          {/* Go Online/Offline Uber Slide Toggle */}
          <TouchableOpacity 
            style={[styles.toggleContainer, isActive ? styles.toggleContainerActive : styles.toggleContainerInactive]}
            onPress={toggleAvailability}
            activeOpacity={0.9}
          >
            <Animated.View style={[
              styles.toggleCircle,
              {
                transform: [{
                  translateX: toggleSlideAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [4, 106]
                  })
                }]
              }
            ]}>
              <Ionicons 
                name={isActive ? "radio-button-on" : "radio-button-off"} 
                size={18} 
                color={isActive ? "#10b981" : "#ef4444"} 
              />
            </Animated.View>
            <Text style={[styles.toggleText, isActive ? styles.toggleTextActive : styles.toggleTextInactive]}>
              {isActive ? "ONLINE" : "OFFLINE"}
            </Text>
          </TouchableOpacity>

          {/* Menu Info/Help */}
          <TouchableOpacity 
            style={styles.headerInfoButton}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              Alert.alert("RideX Driver Portal", `Logged in as: ${user?.email || "Partner"}`);
            }}
          >
            <Ionicons name="information-circle" size={24} color="#94a3b8" />
          </TouchableOpacity>
        </View>

        {/* Stats Row */}
        {isActive && (
          <View style={styles.statsCard}>
            <TouchableOpacity 
              style={styles.statColumn}
              onPress={() => setShowEarningsModal(true)}
            >
              <Text style={styles.statHeading}>EARNINGS</Text>
              <Text style={styles.statMainValue}>₹{dailyEarnings.toFixed(2)}</Text>
            </TouchableOpacity>

            <View style={styles.statDivider} />

            <View style={styles.statColumn}>
              <Text style={styles.statHeading}>ON RIDES</Text>
              <Text style={styles.statSubValue}>{tripsCompleted} trips</Text>
            </View>

            <View style={styles.statDivider} />

            <View style={styles.statColumn}>
              <Text style={styles.statHeading}>TIME ONLINE</Text>
              <Text style={styles.statSubValue}>{onlineHours}</Text>
            </View>
          </View>
        )}
      </View>

      {/* UBER RIDE REQUEST INCOMING INTERACTIVE OVERLAY */}
      {rideRequest && rideRequest.status === "pending" && (
        <View style={styles.ringingOverlay}>
          <View style={styles.ringingHeader}>
            <View style={styles.ringingKickerRow}>
              <View style={styles.pulsingLightRed} />
              <Text style={styles.ringingKicker}>NEW INCOMING RIDE REQUEST</Text>
            </View>
            <Text style={styles.ringingFareText}>₹{rideRequest?.fare || "280.00"}</Text>
          </View>

          {/* Glowing Animated Circular Radar */}
          <View style={styles.radarContainer}>
            <Animated.View style={[
              styles.radarRipple,
              { transform: [{ scale: pulseAnim }], opacity: pulseAnim.interpolate({ inputRange: [1, 1.25], outputRange: [0.6, 0] }) }
            ]} />
            <View style={styles.radarCenterCircle}>
              <Text style={styles.radarTimerNum}>{countdown}</Text>
              <Text style={styles.radarTimerLabel}>secs left</Text>
            </View>
          </View>

          {/* Ride Details Card */}
          <View style={styles.ringingDetailsCard}>
            <View style={styles.tripMetaRow}>
              <View style={styles.metaChip}>
                <Ionicons name="car-outline" size={16} color="#10b981" />
                <Text style={styles.metaChipText}>
                  {String(rideRequest?.vehicleType || "car").toUpperCase()}
                </Text>
              </View>
              <View style={styles.metaChip}>
                <Ionicons name="map" size={16} color="#3b82f6" />
                <Text style={styles.metaChipText}>{rideRequest?.distance || "0.0"} km</Text>
              </View>
              <View style={styles.metaChip}>
                <Ionicons name="time" size={16} color="#f59e0b" />
                <Text style={styles.metaChipText}>{rideRequest?.duration || "0"} mins</Text>
              </View>
            </View>

            {/* Address paths */}
            <View style={styles.routeContainer}>
              <View style={styles.routeIndicatorColumn}>
                <View style={styles.greenRouteDot} />
                <View style={styles.routeConnectorLine} />
                <View style={styles.redRouteDot} />
              </View>

              <View style={styles.routeTextColumn}>
                <View style={styles.routeTextGroup}>
                  <Text style={styles.routeLabel}>PICKUP SOURCE</Text>
                  <Text style={styles.routeAddressText} numberOfLines={1}>
                    {rideRequest?.pickupAddress || "Current Location"}
                  </Text>
                </View>

                <View style={styles.routeTextGroup}>
                  <Text style={styles.routeLabel}>DROP DESTINATION</Text>
                  <Text style={styles.routeAddressText} numberOfLines={1}>
                    {rideRequest?.destinationAddress || "Destination address"}
                  </Text>
                </View>
              </View>
            </View>

            {/* Passenger Info */}
            <View style={styles.passengerBriefRow}>
              <View style={styles.passengerBriefAvatar}>
                <Text style={styles.passengerBriefAvatarText}>
                  {(rideRequest?.passengerName || rideRequest?.customerName || "Rider").substring(0, 1).toUpperCase()}
                </Text>
              </View>
              <View style={styles.passengerBriefDetails}>
                <Text style={styles.passengerBriefName}>
                  {rideRequest?.passengerName || rideRequest?.customerName || "Rider"}
                </Text>
                <View style={styles.starRow}>
                  <Ionicons name="star" size={14} color="#fbbf24" />
                  <Text style={styles.starRatingText}>4.8 Rating</Text>
                </View>
              </View>
            </View>
          </View>

          {/* Actions */}
          <View style={styles.ringingActionsRow}>
            <TouchableOpacity 
              style={styles.ignoreButton} 
              onPress={rejectRide}
              activeOpacity={0.8}
            >
              <Text style={styles.ignoreButtonText}>Decline</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.acceptBigButton} 
              onPress={acceptRide}
              activeOpacity={0.85}
            >
              <Ionicons name="checkmark-circle-outline" size={24} color="#ffffff" />
              <Text style={styles.acceptBigButtonText}>ACCEPT RIDE</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* ACTIVE TRIP SHEETS (ACCEPTED / STARTED) */}
      {rideRequest && (rideRequest.status === "accepted" || rideRequest.status === "started") && (
        <View style={styles.activeRideSheet}>
          {/* Top Progress bar indicator */}
          <View style={styles.activeProgressRow}>
            <View style={[styles.progressNode, styles.progressNodeCompleted]}>
              <Ionicons name="checkmark" size={12} color="#ffffff" />
              <Text style={styles.progressNodeText}>Booked</Text>
            </View>
            <View style={[styles.progressLine, rideRequest.status !== "accepted" && styles.progressLineCompleted]} />
            <View style={[
              styles.progressNode,
              rideRequest.status === "accepted" ? styles.progressNodeCurrent : styles.progressNodeCompleted
            ]}>
              {rideRequest.status === "accepted" ? (
                <View style={styles.progressDotPulse} />
              ) : (
                <Ionicons name="checkmark" size={12} color="#ffffff" />
              )}
              <Text style={styles.progressNodeText}>Arrive</Text>
            </View>
            <View style={[styles.progressLine, rideRequest.status === "started" && styles.progressLineCompleted]} />
            <View style={[
              styles.progressNode,
              rideRequest.status === "started" ? styles.progressNodeCurrent : styles.progressNodePending
            ]}>
              {rideRequest.status === "started" && <View style={styles.progressDotPulse} />}
              <Text style={styles.progressNodeText}>Trip</Text>
            </View>
          </View>

          {/* Heading Alert Panel */}
          <View style={[
            styles.headingAlertBar, 
            rideRequest.status === "accepted" ? styles.headingAlertBarPickup : styles.headingAlertBarDrop
          ]}>
            <Ionicons 
              name={rideRequest.status === "accepted" ? "navigate" : "flag"} 
              size={18} 
              color="#ffffff" 
            />
            <Text style={styles.headingAlertBarText}>
              {rideRequest.status === "accepted" 
                ? "On the way to pickup location..." 
                : "Trip started: heading to destination"
              }
            </Text>
          </View>

          {/* Passenger details & communication */}
          <View style={styles.activePassengerPanel}>
            <View style={styles.avatarPill}>
              <View style={styles.passengerBigAvatar}>
                <Text style={styles.passengerBigAvatarText}>
                  {(rideRequest?.passengerName || rideRequest?.customerName || "Rider").substring(0, 1).toUpperCase()}
                </Text>
              </View>
              <View style={styles.passengerBigMeta}>
                <Text style={styles.passengerBigName}>
                  {rideRequest?.passengerName || rideRequest?.customerName || "Customer"}
                </Text>
                <View style={styles.starRow}>
                  <Ionicons name="star" size={14} color="#fbbf24" />
                  <Text style={styles.passengerBriefRatingText}>4.9 (248 ratings)</Text>
                </View>
              </View>
            </View>

            <View style={styles.commButtonsRow}>
              <TouchableOpacity 
                style={styles.commCircleButton}
                onPress={triggerCustomerCall}
              >
                <Ionicons name="call" size={20} color="#3b82f6" />
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.commCircleButton}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setShowChatModal(true);
                }}
              >
                <Ionicons name="chatbubble" size={20} color="#3b82f6" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Route details description */}
          <View style={styles.activeAddressesPanel}>
            <View style={styles.activeAddressRow}>
              <View style={styles.routePinCircleGreen} />
              <View style={styles.activeAddressInfo}>
                <Text style={styles.activeAddressTitle}>PICKUP LOCATION</Text>
                <Text style={styles.activeAddressValue} numberOfLines={1}>
                  {rideRequest?.pickupAddress || "Current location"}
                </Text>
              </View>
            </View>

            <View style={styles.activeAddressDivider} />

            <View style={styles.activeAddressRow}>
              <View style={styles.routePinCircleRed} />
              <View style={styles.activeAddressInfo}>
                <Text style={styles.activeAddressTitle}>DROP DESTINATION</Text>
                <Text style={styles.activeAddressValue} numberOfLines={1}>
                  {rideRequest?.destinationAddress || "Destination address"}
                </Text>
              </View>
            </View>
          </View>

          {/* Fare / Vehicle metrics details */}
          <View style={styles.activeMetricsBox}>
            <View style={styles.activeMetricCell}>
              <Text style={styles.activeMetricHeading}>FARE AMOUNT</Text>
              <Text style={styles.activeMetricVal}>₹{rideRequest?.fare || "0"}</Text>
            </View>
            <View style={styles.activeMetricCell}>
              <Text style={styles.activeMetricHeading}>DISTANCE</Text>
              <Text style={styles.activeMetricVal}>{rideRequest?.distance || "0"} km</Text>
            </View>
            <View style={styles.activeMetricCell}>
              <Text style={styles.activeMetricHeading}>VEHICLE TYPE</Text>
              <Text style={styles.activeMetricVal}>
                {String(rideRequest?.vehicleType || "car").toUpperCase()}
              </Text>
            </View>
          </View>

          {/* STEP ACTION TRIGGERS */}
          {rideRequest.status === "accepted" && (
            <View style={styles.otpSection}>
              <Text style={styles.otpKicker}>Enter OTP from passenger to start trip:</Text>
              
              <View style={styles.otpVerifyRow}>
                <TextInput
                  placeholder="Enter 4-Digit OTP"
                  placeholderTextColor="#64748b"
                  value={enteredOTP}
                  onChangeText={setEnteredOTP}
                  keyboardType="numeric"
                  maxLength={4}
                  style={styles.otpInputField}
                />

                <TouchableOpacity 
                  style={styles.otpStartButton} 
                  onPress={startRide}
                  activeOpacity={0.8}
                >
                  <Text style={styles.otpStartButtonText}>Verify & Start</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {rideRequest.status === "started" && (
            <View style={styles.completionSection}>
              <TouchableOpacity
                style={[
                  styles.completeTripBtn,
                  confirmComplete ? styles.completeTripBtnConfirm : null,
                  isCompletingRide && styles.completeTripBtnDisabled
                ]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  if (!confirmComplete) {
                    setConfirmComplete(true);
                  } else {
                    completeRide();
                  }
                }}
                disabled={isCompletingRide}
                activeOpacity={0.9}
              >
                <Ionicons 
                  name={confirmComplete ? "checkmark-circle" : "flag"} 
                  size={20} 
                  color="#ffffff" 
                />
                <Text style={styles.completeTripBtnText}>
                  {isCompletingRide 
                    ? "Completing Ride..." 
                    : confirmComplete 
                      ? "TAP AGAIN TO CONFIRM COMPLETE" 
                      : "TAP TO COMPLETE TRIP"
                  }
                </Text>
              </TouchableOpacity>

              {confirmComplete && (
                <TouchableOpacity 
                  style={styles.cancelConfirmBtn}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setConfirmComplete(false);
                  }}
                >
                  <Text style={styles.cancelConfirmText}>Cancel</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
      )}

      {/* CHAT MODAL OVERLAY */}
      <Modal
        visible={showChatModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowChatModal(false)}
      >
        <View style={styles.chatModalBackdrop}>
          <View style={styles.chatModalCard}>
            <View style={styles.chatModalDragHandle} />
            <View style={styles.chatModalHeader}>
              <Text style={styles.chatModalTitle}>Chat with Passenger</Text>
              <TouchableOpacity 
                style={styles.chatModalCloseBtn}
                onPress={() => setShowChatModal(false)}
              >
                <Ionicons name="close-circle" size={24} color="#94a3b8" />
              </TouchableOpacity>
            </View>

            <View style={styles.chatModalBody}>
              {/* Message History Thread (simulated) */}
              <ScrollView 
                style={styles.chatMessagesScrollView}
                contentContainerStyle={styles.chatMessagesScrollContent}
              >
                <View style={styles.chatSystemNotice}>
                  <Text style={styles.chatSystemNoticeText}>
                    Always stay focused on the road. Tap a quick reply below to send instantly.
                  </Text>
                </View>

                {lastSentMessage ? (
                  <View style={styles.chatBubbleDriver}>
                    <Text style={styles.chatBubbleTextDriver}>{lastSentMessage}</Text>
                    <Text style={styles.chatBubbleTimeDriver}>Sent just now ✓</Text>
                  </View>
                ) : (
                  <View style={styles.chatEmptyState}>
                    <Ionicons name="chatbubbles-outline" size={32} color="#475569" />
                    <Text style={styles.chatEmptyStateText}>No messages sent yet</Text>
                  </View>
                )}
              </ScrollView>

              {/* Quick Replies list */}
              <Text style={styles.quickRepliesHeading}>QUICK REPLIES</Text>
              <View style={styles.quickRepliesContainer}>
                {[
                  "I'm on my way!",
                  "I have arrived at your pickup point.",
                  "Stuck in traffic, will be there in 5 mins.",
                  "Where are you standing?"
                ].map((msg, index) => (
                  <TouchableOpacity
                    key={index}
                    style={styles.quickReplyChip}
                    onPress={() => sendChatMessage(msg)}
                  >
                    <Text style={styles.quickReplyChipText}>{msg}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Custom Input area */}
              <View style={styles.chatInputContainer}>
                <TextInput
                  placeholder="Type custom message..."
                  placeholderTextColor="#64748b"
                  value={chatMessage}
                  onChangeText={setChatMessage}
                  style={styles.chatInputField}
                />
                <TouchableOpacity 
                  style={styles.chatSendBtn}
                  onPress={() => sendChatMessage(chatMessage)}
                  disabled={!chatMessage.trim()}
                >
                  <Ionicons name="send" size={18} color="#ffffff" />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {/* ONLINE TRIP SUMMARY DIALOG MODAL */}
      {showSummaryModal && tempRideSummary && (
        <Modal
          visible={showSummaryModal}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setShowSummaryModal(false)}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.modalContentCard}>
              <View style={styles.successCheckIconCircle}>
                <Ionicons name="checkmark-done-circle" size={54} color="#10b981" />
              </View>

              <Text style={styles.modalTitle}>Trip Completed!</Text>
              <Text style={styles.modalSub}>Successfully transferred passenger to destination.</Text>

              <View style={styles.modalDivider} />

              <View style={styles.summaryStatsBox}>
                <View style={styles.summaryStatItem}>
                  <Text style={styles.summaryStatLabel}>TOTAL FARE</Text>
                  <Text style={styles.summaryStatValHighlight}>₹{tempRideSummary?.fare || "0.00"}</Text>
                </View>

                <View style={styles.summaryStatsGrid}>
                  <View style={styles.summaryGridCell}>
                    <Text style={styles.summaryStatLabel}>DISTANCE</Text>
                    <Text style={styles.summaryStatSubVal}>{tempRideSummary?.distance || "0"} km</Text>
                  </View>

                  <View style={styles.summaryGridCell}>
                    <Text style={styles.summaryStatLabel}>DURATION</Text>
                    <Text style={styles.summaryStatSubVal}>{tempRideSummary?.duration || "0"} mins</Text>
                  </View>
                </View>
              </View>

              <View style={styles.summaryRouteBox}>
                <View style={styles.summaryRouteNode}>
                  <View style={styles.greenRouteDot} />
                  <Text style={styles.summaryRouteText} numberOfLines={1}>
                    {tempRideSummary?.pickupAddress || "Pickup location"}
                  </Text>
                </View>
                <View style={styles.summaryRouteNode}>
                  <View style={styles.redRouteDot} />
                  <Text style={styles.summaryRouteText} numberOfLines={1}>
                    {tempRideSummary?.destinationAddress || "Destination address"}
                  </Text>
                </View>
              </View>

              <TouchableOpacity 
                style={styles.modalCloseBtn}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  setShowSummaryModal(false);
                }}
              >
                <Text style={styles.modalCloseBtnText}>Go Online Again</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}

      {/* DAILY EARNINGS BREAKDOWN MODAL */}
      <Modal
        visible={showEarningsModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowEarningsModal(false)}
      >
        <View style={styles.bottomModalBackdrop}>
          <View style={styles.bottomModalCard}>
            <View style={styles.bottomModalDragHandle} />
            
            <View style={styles.bottomModalHeader}>
              <Text style={styles.bottomModalTitle}>Today's Activity</Text>
              <TouchableOpacity 
                style={styles.bottomModalCloseX}
                onPress={() => setShowEarningsModal(false)}
              >
                <Ionicons name="close-circle" size={24} color="#94a3b8" />
              </TouchableOpacity>
            </View>

            <ScrollView 
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.bottomModalScrollContent}
            >
              {/* Grand Total */}
              <View style={styles.earningsSummaryLargeCard}>
                <Text style={styles.earningsLargeLabel}>TOTAL PAYOUT</Text>
                <Text style={styles.earningsLargeVal}>₹{dailyEarnings.toFixed(2)}</Text>
                <Text style={styles.earningsLargeSub}>Active for {onlineHours} today</Text>
              </View>

              {/* Individual Trips stats */}
              <Text style={styles.sectionTitle}>Breakdown</Text>
              
              <View style={styles.breakdownStatsGrid}>
                <View style={styles.breakdownCell}>
                  <Text style={styles.breakdownVal}>{tripsCompleted}</Text>
                  <Text style={styles.breakdownLabel}>Completed Rides</Text>
                </View>
                <View style={styles.breakdownCell}>
                  <Text style={styles.breakdownVal}>98%</Text>
                  <Text style={styles.breakdownLabel}>Acceptance Rate</Text>
                </View>
                <View style={styles.breakdownCell}>
                  <Text style={styles.breakdownVal}>4.96 ★</Text>
                  <Text style={styles.breakdownLabel}>Driver Rating</Text>
                </View>
              </View>

              <Text style={styles.sectionTitle}>Trips List</Text>
              <View style={styles.tripsListContainer}>
                <View style={styles.simulatedTripRow}>
                  <View style={styles.simulatedTripAvatar}>
                    <Text style={styles.simulatedAvatarText}>JD</Text>
                  </View>
                  <View style={styles.simulatedTripDetails}>
                    <Text style={styles.simulatedTripRider}>Jane Doe</Text>
                    <Text style={styles.simulatedTripTime}>2 hours ago • Cash payment</Text>
                  </View>
                  <Text style={styles.simulatedTripFare}>+₹350.00</Text>
                </View>

                <View style={styles.simulatedTripRow}>
                  <View style={styles.simulatedTripAvatar}>
                    <Text style={styles.simulatedAvatarText}>MK</Text>
                  </View>
                  <View style={styles.simulatedTripDetails}>
                    <Text style={styles.simulatedTripRider}>Mike Kapoor</Text>
                    <Text style={styles.simulatedTripTime}>4 hours ago • RideX Wallet</Text>
                  </View>
                  <Text style={styles.simulatedTripFare}>+₹520.00</Text>
                </View>

                <View style={styles.simulatedTripRow}>
                  <View style={styles.simulatedTripAvatar}>
                    <Text style={styles.simulatedAvatarText}>AR</Text>
                  </View>
                  <View style={styles.simulatedTripDetails}>
                    <Text style={styles.simulatedTripRider}>Amit Rawat</Text>
                    <Text style={styles.simulatedTripTime}>6 hours ago • UPI Pay</Text>
                  </View>
                  <Text style={styles.simulatedTripFare}>+₹280.00</Text>
                </View>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  map: {
    flex: 1,
  },
  driverMarkerWrap: {
    alignItems: "center",
    justifyContent: "center",
  },
  driverMarkerOuter: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(59, 130, 246, 0.15)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "rgba(59, 130, 246, 0.3)",
  },
  driverMarkerInner: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#0f172a",
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  driverEmojiText: {
    fontSize: 18,
  },
  driverPulse: {
    position: "absolute",
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: "#3b82f6",
    opacity: 0.35,
    zIndex: -1,
  },
  customPin: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  pickupPin: {
    backgroundColor: "#10b981",
  },
  dropoffPin: {
    backgroundColor: "#ef4444",
  },
  customPinLabel: {
    color: "#ffffff",
    fontSize: 10,
    fontWeight: "900",
    marginLeft: 4,
  },

  // Floating Header & Stats styles
  headerFloatingContainer: {
    position: "absolute",
    top: 55,
    left: 16,
    right: 16,
    zIndex: 10,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  avatarButton: {
    shadowColor: "#0F172A",
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#ffffff",
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: "#0F172A",
    fontSize: 14,
    fontWeight: "800",
  },
  toggleContainer: {
    width: 154,
    height: 40,
    borderRadius: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
    paddingHorizontal: 2,
    shadowColor: "#0F172A",
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  toggleContainerActive: {
    backgroundColor: "#10b981",
    borderWidth: 1,
    borderColor: "#059669",
  },
  toggleContainerInactive: {
    backgroundColor: "#ef4444",
    borderWidth: 1,
    borderColor: "#dc2626",
  },
  toggleCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 2,
  },
  toggleText: {
    position: "absolute",
    alignSelf: "center",
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: 1.2,
  },
  toggleTextActive: {
    color: "#ffffff",
    right: 28,
  },
  toggleTextInactive: {
    color: "#ffffff",
    right: 22,
  },
  headerInfoButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#ffffff",
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#0F172A",
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  statsCard: {
    marginTop: 12,
    backgroundColor: "#ffffff",
    borderRadius: 20,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    shadowColor: "#0F172A",
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  statColumn: {
    flex: 1,
    alignItems: "center",
  },
  statHeading: {
    color: "#64748b",
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1.2,
  },
  statMainValue: {
    color: "#10b981",
    fontSize: 16,
    fontWeight: "900",
    marginTop: 2,
  },
  statSubValue: {
    color: "#0F172A",
    fontSize: 14,
    fontWeight: "800",
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 24,
    backgroundColor: "#E2E8F0",
  },

  // Ringing Incoming request styles
  ringingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#F8FAFC",
    zIndex: 999,
    paddingHorizontal: 24,
    paddingTop: 80,
    paddingBottom: 40,
    justifyContent: "space-between",
    alignItems: "center",
  },
  ringingHeader: {
    alignItems: "center",
    width: "100%",
  },
  ringingKickerRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(239, 68, 68, 0.08)",
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: "#FCA5A5",
  },
  pulsingLightRed: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#ef4444",
    marginRight: 8,
  },
  ringingKicker: {
    color: "#EF4444",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.5,
  },
  ringingFareText: {
    color: "#0F172A",
    fontSize: 48,
    fontWeight: "900",
    marginTop: 12,
  },
  radarContainer: {
    width: 160,
    height: 160,
    justifyContent: "center",
    alignItems: "center",
    marginVertical: 20,
  },
  radarRipple: {
    position: "absolute",
    width: 160,
    height: 160,
    borderRadius: 80,
    borderWidth: 4,
    borderColor: "#ef4444",
    backgroundColor: "rgba(239, 68, 68, 0.08)",
  },
  radarCenterCircle: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: "#ef4444",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#ef4444",
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
  },
  radarTimerNum: {
    color: "#ffffff",
    fontSize: 38,
    fontWeight: "900",
  },
  radarTimerLabel: {
    color: "rgba(255, 255, 255, 0.8)",
    fontSize: 9,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  ringingDetailsCard: {
    width: "100%",
    backgroundColor: "#ffffff",
    borderRadius: 24,
    padding: 20,
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    shadowColor: "#0F172A",
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  tripMetaRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 16,
  },
  metaChip: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F1F5F9",
    paddingVertical: 8,
    borderRadius: 14,
    gap: 6,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  metaChipText: {
    color: "#475569",
    fontSize: 12,
    fontWeight: "800",
  },
  routeContainer: {
    flexDirection: "row",
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  routeIndicatorColumn: {
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 6,
    width: 16,
  },
  greenRouteDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#10b981",
  },
  routeConnectorLine: {
    width: 2,
    flex: 1,
    backgroundColor: "#CBD5E1",
    marginVertical: 4,
  },
  redRouteDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#ef4444",
  },
  routeTextColumn: {
    flex: 1,
    marginLeft: 12,
    gap: 12,
  },
  routeTextGroup: {
    justifyContent: "center",
  },
  routeLabel: {
    color: "#64748b",
    fontSize: 8,
    fontWeight: "800",
    letterSpacing: 1,
  },
  routeAddressText: {
    color: "#0F172A",
    fontSize: 14,
    fontWeight: "700",
    marginTop: 2,
  },
  passengerBriefRow: {
    flexDirection: "row",
    alignItems: "center",
    borderTopWidth: 1.5,
    borderTopColor: "#F1F5F9",
    paddingTop: 12,
  },
  passengerBriefAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#3b82f6",
    alignItems: "center",
    justifyContent: "center",
  },
  passengerBriefAvatarText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "800",
  },
  passengerBriefDetails: {
    marginLeft: 12,
  },
  passengerBriefName: {
    color: "#0F172A",
    fontSize: 14,
    fontWeight: "800",
  },
  starRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 2,
  },
  starRatingText: {
    color: "#fbbf24",
    fontSize: 11,
    fontWeight: "800",
  },
  ringingActionsRow: {
    flexDirection: "row",
    width: "100%",
    gap: 12,
  },
  ignoreButton: {
    flex: 1,
    height: 54,
    borderRadius: 18,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "#CBD5E1",
  },
  ignoreButtonText: {
    color: "#475569",
    fontSize: 16,
    fontWeight: "800",
  },
  acceptBigButton: {
    flex: 2,
    height: 54,
    borderRadius: 18,
    backgroundColor: "#10b981",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    shadowColor: "#10b981",
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 6,
  },
  acceptBigButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "900",
    letterSpacing: 0.8,
  },

  // Active Ride sheet card styles
  activeRideSheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingTop: 16,
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === "ios" ? 35 : 20,
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    shadowColor: "#0F172A",
    shadowOpacity: 0.1,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: -5 },
    elevation: 20,
    zIndex: 100,
  },
  activeProgressRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  progressNode: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  progressNodeCompleted: {
    backgroundColor: "#10b981",
  },
  progressNodeCurrent: {
    backgroundColor: "#3b82f6",
    borderWidth: 2,
    borderColor: "#ffffff",
  },
  progressNodePending: {
    backgroundColor: "#E2E8F0",
  },
  progressDotPulse: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#ffffff",
  },
  progressNodeText: {
    position: "absolute",
    bottom: -16,
    fontSize: 9,
    fontWeight: "800",
    color: "#64748b",
    width: 50,
    textAlign: "center",
  },
  progressLine: {
    flex: 1,
    height: 2,
    backgroundColor: "#CBD5E1",
    marginHorizontal: 4,
  },
  progressLineCompleted: {
    backgroundColor: "#10b981",
  },
  headingAlertBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    gap: 8,
    marginTop: 10,
    marginBottom: 16,
  },
  headingAlertBarPickup: {
    backgroundColor: "rgba(16, 185, 129, 0.08)",
    borderWidth: 1.5,
    borderColor: "#A7F3D0",
  },
  headingAlertBarDrop: {
    backgroundColor: "rgba(59, 130, 246, 0.08)",
    borderWidth: 1.5,
    borderColor: "#BFDBFE",
  },
  headingAlertBarText: {
    color: "#0F172A",
    fontSize: 12,
    fontWeight: "800",
  },
  activePassengerPanel: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  avatarPill: {
    flexDirection: "row",
    alignItems: "center",
  },
  passengerBigAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#3b82f6",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
  },
  passengerBigAvatarText: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "900",
  },
  passengerBigMeta: {
    marginLeft: 14,
  },
  passengerBigName: {
    color: "#0F172A",
    fontSize: 16,
    fontWeight: "800",
  },
  passengerBriefRatingText: {
    color: "#64748b",
    fontSize: 12,
    fontWeight: "700",
  },
  commButtonsRow: {
    flexDirection: "row",
    gap: 10,
  },
  commCircleButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#EFF6FF",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "#BFDBFE",
  },
  activeAddressesPanel: {
    backgroundColor: "#F8FAFC",
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  activeAddressRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  routePinCircleGreen: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#10b981",
  },
  routePinCircleRed: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#ef4444",
  },
  activeAddressInfo: {
    marginLeft: 12,
    flex: 1,
  },
  activeAddressTitle: {
    color: "#64748b",
    fontSize: 8,
    fontWeight: "800",
    letterSpacing: 1,
  },
  activeAddressValue: {
    color: "#0F172A",
    fontSize: 13,
    fontWeight: "700",
    marginTop: 2,
  },
  activeAddressDivider: {
    height: 1,
    backgroundColor: "#E2E8F0",
    marginVertical: 10,
    marginLeft: 22,
  },
  activeMetricsBox: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 20,
  },
  activeMetricCell: {
    flex: 1,
    backgroundColor: "#F8FAFC",
    borderRadius: 14,
    padding: 10,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  activeMetricHeading: {
    color: "#64748b",
    fontSize: 8,
    fontWeight: "800",
  },
  activeMetricVal: {
    color: "#0F172A",
    fontSize: 14,
    fontWeight: "900",
    marginTop: 3,
  },

  // OTP inputs
  otpSection: {
    borderTopWidth: 1.5,
    borderTopColor: "#F1F5F9",
    paddingTop: 16,
  },
  otpKicker: {
    color: "#64748b",
    fontSize: 12,
    fontWeight: "800",
    marginBottom: 10,
  },
  otpVerifyRow: {
    flexDirection: "row",
    gap: 12,
  },
  otpInputField: {
    flex: 1.5,
    backgroundColor: "#F8FAFC",
    borderWidth: 1.5,
    borderColor: "#CBD5E1",
    borderRadius: 14,
    color: "#0F172A",
    fontSize: 16,
    fontWeight: "900",
    textAlign: "center",
    letterSpacing: 4,
    height: 50,
  },
  otpStartButton: {
    flex: 1,
    height: 50,
    borderRadius: 14,
    backgroundColor: "#10b981",
    alignItems: "center",
    justifyContent: "center",
  },
  otpStartButtonText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "900",
  },

  // Slide verification completing button
  slideActionTrack: {
    width: "100%",
    height: 56,
    borderRadius: 28,
    backgroundColor: "#F1F5F9",
    borderWidth: 1.5,
    borderColor: "#CBD5E1",
    flexDirection: "row",
    alignItems: "center",
    padding: 3,
    marginTop: 6,
  },
  slideActionButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#2563eb",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#2563eb",
    shadowOpacity: 0.35,
    shadowRadius: 5,
    elevation: 4,
  },
  slideActionText: {
    flex: 1,
    textAlign: "center",
    color: "#475569",
    fontSize: 14,
    fontWeight: "800",
    marginRight: 40,
  },
  completionSection: {
    alignItems: "center",
    width: "100%",
  },
  completeTripBtn: {
    width: "100%",
    height: 54,
    borderRadius: 16,
    backgroundColor: "#3b82f6",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#3b82f6",
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 4,
  },
  completeTripBtnConfirm: {
    backgroundColor: "#10b981",
  },
  completeTripBtnDisabled: {
    opacity: 0.5,
  },
  completeTripBtnText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "900",
    letterSpacing: 1,
  },
  cancelConfirmBtn: {
    marginTop: 10,
    paddingVertical: 8,
  },
  cancelConfirmText: {
    color: "#64748b",
    fontSize: 13,
    fontWeight: "800",
  },

  // Modal styling (Trip completion)
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(2, 6, 17, 0.75)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  modalContentCard: {
    width: "100%",
    backgroundColor: "#ffffff",
    borderRadius: 28,
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    padding: 24,
    alignItems: "center",
    shadowColor: "#0F172A",
    shadowOpacity: 0.15,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
  },
  successCheckIconCircle: {
    marginBottom: 16,
  },
  modalTitle: {
    color: "#0F172A",
    fontSize: 22,
    fontWeight: "900",
  },
  modalSub: {
    color: "#64748b",
    fontSize: 13,
    fontWeight: "700",
    textAlign: "center",
    marginTop: 6,
    lineHeight: 18,
  },
  modalDivider: {
    width: "100%",
    height: 1,
    backgroundColor: "#E2E8F0",
    marginVertical: 18,
  },
  summaryStatsBox: {
    width: "100%",
    backgroundColor: "#F8FAFC",
    borderRadius: 18,
    padding: 16,
    alignItems: "center",
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  summaryStatItem: {
    alignItems: "center",
    marginBottom: 14,
  },
  summaryStatLabel: {
    color: "#64748b",
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1.2,
  },
  summaryStatValHighlight: {
    color: "#10b981",
    fontSize: 26,
    fontWeight: "900",
    marginTop: 4,
  },
  summaryStatsGrid: {
    flexDirection: "row",
    width: "100%",
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
    paddingTop: 12,
  },
  summaryGridCell: {
    flex: 1,
    alignItems: "center",
  },
  summaryStatSubVal: {
    color: "#0F172A",
    fontSize: 16,
    fontWeight: "800",
    marginTop: 3,
  },
  summaryRouteBox: {
    width: "100%",
    backgroundColor: "#F8FAFC",
    borderRadius: 18,
    padding: 14,
    gap: 8,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  summaryRouteNode: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  summaryRouteText: {
    color: "#0F172A",
    fontSize: 12,
    fontWeight: "700",
    flex: 1,
  },
  modalCloseBtn: {
    width: "100%",
    height: 52,
    borderRadius: 16,
    backgroundColor: "#10b981",
    alignItems: "center",
    justifyContent: "center",
  },
  modalCloseBtnText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "900",
  },

  // Bottom modal (Earnings Breakdown) styling
  bottomModalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(2, 6, 17, 0.75)",
    justifyContent: "flex-end",
  },
  bottomModalCard: {
    height: screenHeight * 0.65,
    width: "100%",
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 10,
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
  },
  bottomModalDragHandle: {
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: "#CBD5E1",
    alignSelf: "center",
    marginBottom: 10,
  },
  bottomModalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: 1.5,
    borderBottomColor: "#F1F5F9",
  },
  bottomModalTitle: {
    color: "#0F172A",
    fontSize: 18,
    fontWeight: "900",
  },
  bottomModalCloseX: {
    padding: 2,
  },
  bottomModalScrollContent: {
    padding: 20,
  },
  earningsSummaryLargeCard: {
    backgroundColor: "#F8FAFC",
    borderRadius: 20,
    padding: 20,
    alignItems: "center",
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  earningsLargeLabel: {
    color: "#64748b",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.5,
  },
  earningsLargeVal: {
    color: "#10b981",
    fontSize: 34,
    fontWeight: "900",
    marginTop: 6,
  },
  earningsLargeSub: {
    color: "#475569",
    fontSize: 12,
    fontWeight: "700",
    marginTop: 6,
  },
  sectionTitle: {
    color: "#0F172A",
    fontSize: 15,
    fontWeight: "900",
    marginBottom: 12,
  },
  breakdownStatsGrid: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 20,
  },
  breakdownCell: {
    flex: 1,
    backgroundColor: "#F8FAFC",
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 6,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  breakdownVal: {
    color: "#0F172A",
    fontSize: 15,
    fontWeight: "900",
  },
  breakdownLabel: {
    color: "#64748b",
    fontSize: 9,
    fontWeight: "800",
    textAlign: "center",
    marginTop: 3,
  },
  tripsListContainer: {
    gap: 10,
  },
  simulatedTripRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  simulatedTripAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#E2E8F0",
    alignItems: "center",
    justifyContent: "center",
  },
  simulatedAvatarText: {
    color: "#475569",
    fontSize: 12,
    fontWeight: "800",
  },
  simulatedTripDetails: {
    marginLeft: 12,
    flex: 1,
  },
  simulatedTripRider: {
    color: "#0F172A",
    fontSize: 14,
    fontWeight: "800",
  },
  simulatedTripTime: {
    color: "#64748b",
    fontSize: 11,
    fontWeight: "700",
    marginTop: 2,
  },
  simulatedTripFare: {
    color: "#10b981",
    fontSize: 14,
    fontWeight: "900",
  },
  chatModalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(2, 6, 17, 0.75)",
    justifyContent: "flex-end",
  },
  chatModalCard: {
    height: screenHeight * 0.65,
    width: "100%",
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 10,
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
  },
  chatModalDragHandle: {
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: "#CBD5E1",
    alignSelf: "center",
    marginBottom: 10,
  },
  chatModalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: 1.5,
    borderBottomColor: "#F1F5F9",
  },
  chatModalTitle: {
    color: "#0F172A",
    fontSize: 18,
    fontWeight: "900",
  },
  chatModalCloseBtn: {
    padding: 2,
  },
  chatModalBody: {
    flex: 1,
    padding: 20,
    justifyContent: "space-between",
  },
  chatMessagesScrollView: {
    flex: 1,
    marginBottom: 12,
  },
  chatMessagesScrollContent: {
    gap: 12,
  },
  chatSystemNotice: {
    backgroundColor: "rgba(59, 130, 246, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(59, 130, 246, 0.2)",
    padding: 12,
    borderRadius: 14,
  },
  chatSystemNoticeText: {
    color: "#475569",
    fontSize: 12,
    lineHeight: 16,
    textAlign: "center",
    fontWeight: "600",
  },
  chatBubbleDriver: {
    alignSelf: "flex-end",
    backgroundColor: "#2563eb",
    borderRadius: 16,
    borderTopRightRadius: 4,
    paddingVertical: 10,
    paddingHorizontal: 14,
    maxWidth: "85%",
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  chatBubbleTextDriver: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "600",
  },
  chatBubbleTimeDriver: {
    color: "rgba(255, 255, 255, 0.7)",
    fontSize: 10,
    fontWeight: "700",
    marginTop: 4,
    textAlign: "right",
  },
  chatEmptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40,
    gap: 8,
  },
  chatEmptyStateText: {
    color: "#64748b",
    fontSize: 14,
    fontWeight: "700",
  },
  quickRepliesHeading: {
    color: "#64748b",
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1,
    marginBottom: 8,
  },
  quickRepliesContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 16,
  },
  quickReplyChip: {
    backgroundColor: "#F1F5F9",
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  quickReplyChipText: {
    color: "#475569",
    fontSize: 12,
    fontWeight: "700",
  },
  chatInputContainer: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
    borderTopWidth: 1.5,
    borderTopColor: "#F1F5F9",
    paddingTop: 12,
  },
  chatInputField: {
    flex: 1,
    height: 48,
    backgroundColor: "#F1F5F9",
    borderRadius: 14,
    paddingHorizontal: 16,
    color: "#0F172A",
    fontSize: 14,
    fontWeight: "600",
    borderWidth: 1,
    borderColor: "#CBD5E1",
  },
  chatSendBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#3b82f6",
    alignItems: "center",
    justifyContent: "center",
  },
});
