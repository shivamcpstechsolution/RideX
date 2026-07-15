import { router } from "expo-router";
import { User } from "firebase/auth";
import { onValue, ref, update, set, push } from "firebase/database";
import { useEffect, useRef, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Animated,
    Dimensions,
    Easing,
    Image,
    Linking,
    ScrollView,
    StatusBar,
    StyleSheet,
    Switch,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import MapView, { Marker } from "react-native-maps";
import { Ionicons } from "@expo/vector-icons";

import * as Location from "expo-location";
import { db } from "../firebaseConfig";
import { getUserRole, logoutUser, onAuthChange } from "../services/authService";



const { height: screenHeight } = Dimensions.get("window");

// Custom Silver Map Style JSON for premium cartography
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

function AnimatedLoader({ message }: { message: string }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.4)).current;
  const rotateX = useRef(new Animated.Value(60)).current; // degrees
  const rotateY = useRef(new Animated.Value(-45)).current; // degrees
  const glowScale = useRef(new Animated.Value(0.6)).current;
  const hoverAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // 3D Entrance Animation
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.spring(scale, {
        toValue: 1.0,
        friction: 6,
        tension: 30,
        useNativeDriver: true,
      }),
      Animated.timing(rotateX, {
        toValue: 0,
        duration: 1200,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(rotateY, {
        toValue: 0,
        duration: 1200,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(glowScale, {
        toValue: 1.2,
        duration: 1400,
        easing: Easing.out(Easing.sin),
        useNativeDriver: true,
      }),
    ]).start();

    // Looping Hover Animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(hoverAnim, {
          toValue: 1,
          duration: 1600,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(hoverAnim, {
          toValue: 0,
          duration: 1600,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  const spinX = rotateX.interpolate({
    inputRange: [0, 90],
    outputRange: ["0deg", "90deg"],
  });

  const spinY = rotateY.interpolate({
    inputRange: [-90, 0],
    outputRange: ["-90deg", "0deg"],
  });

  const hoverTranslateY = hoverAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-10, 10],
  });

  return (
    <View style={styles.loaderContainer}>
      <StatusBar barStyle="light-content" backgroundColor="#000000" />
      
      {/* Ambient Glow Background */}
      <Animated.View
        style={[
          styles.loaderGlow,
          {
            transform: [{ scale: glowScale }],
          }
        ]}
      />

      {/* 3D Animated Logo and Text Container */}
      <Animated.View
        style={[
          styles.loaderLogoWrapper,
          {
            opacity: opacity,
            transform: [
              { perspective: 1000 },
              { scale: scale },
              { rotateX: spinX },
              { rotateY: spinY },
              { translateY: hoverTranslateY },
            ],
          }
        ]}
      >
        {/* Custom Looped X Logo Image */}
        <Image
          source={require("../assets/images/logg.png")}
          style={styles.loaderLogoImage}
          resizeMode="contain"
        />

        <View style={styles.loaderTextContainer}>
          <Text style={styles.loaderRideText}>Ride</Text>
          <Text style={styles.loaderXText}>X</Text>
        </View>
        <Text style={styles.loaderSubtext}>{message}</Text>
      </Animated.View>
    </View>
  );
}

export default function HomeScreen() {
  const mapRef = useRef<any>(null);


  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authResolved, setAuthResolved] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [activeRide, setActiveRide] = useState<any>(null);
  const [allTrips, setAllTrips] = useState<any[]>([]);
  const [reservedTrips, setReservedTrips] = useState<any[]>([]);
  const [mapRegion, setMapRegion] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<"home" | "services" | "activity" | "account">("home");
  const [userRole, setUserRole] = useState<"rider" | "driver" | null>(null);

  // Settings states
  const [accountSubView, setAccountSubView] = useState<"menu" | "settings" | "promocodes" | "payment" | "support">("menu");
  const [editDisplayName, setEditDisplayName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editHome, setEditHome] = useState("");
  const [editWork, setEditWork] = useState("");
  const [editEmergency, setEditEmergency] = useState("");
  const [shareLocation, setShareLocation] = useState(false);
  const [settingsLoading, setSettingsLoading] = useState(false);

  // Promo Code States
  const [promoInput, setPromoInput] = useState("");
  const [appliedPromo, setAppliedPromo] = useState<any>(null);

  // Payment Option States
  const [defaultPayment, setDefaultPayment] = useState("💵 Cash");
  const [cardNumber, setCardNumber] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvv, setCardCvv] = useState("");
  const [savedCards, setSavedCards] = useState<any[]>([]);

  // Theme Mode State
  const [themeMode, setThemeMode] = useState<"light" | "dark">("light");

  // Driver Mode specific states
  const [isOnline, setIsOnline] = useState<boolean>(false);
  const [incomingRequests, setIncomingRequests] = useState<any[]>([]);
  const [earnings] = useState<number>(1450);
  const [tripsCount] = useState<number>(4);

  const driverLocationSubRef = useRef<any>(null);

  // Driver Location & Availability tracking
  useEffect(() => {
    if (userRole !== "driver" || !currentUser) {
      if (driverLocationSubRef.current) {
        driverLocationSubRef.current.remove();
        driverLocationSubRef.current = null;
      }
      return;
    }

    const startTrackingDriver = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") {
          console.warn("Location permission not granted for driver tracking");
          return;
        }

        if (driverLocationSubRef.current) {
          driverLocationSubRef.current.remove();
          driverLocationSubRef.current = null;
        }

        if (isOnline) {
          driverLocationSubRef.current = await Location.watchPositionAsync(
            {
              accuracy: Location.Accuracy.BestForNavigation,
              timeInterval: 3000,
              distanceInterval: 5,
            },
            async (loc) => {
              const coords = {
                latitude: loc.coords.latitude,
                longitude: loc.coords.longitude,
              };

              setMapRegion((prevRegion: any) => ({
                ...prevRegion,
                latitude: coords.latitude,
                longitude: coords.longitude,
              }));

              await set(ref(db, `drivers/${currentUser.uid}`), {
                latitude: coords.latitude,
                longitude: coords.longitude,
                isActive: true,
                updatedAt: Date.now(),
              });
            }
          );
        } else {
          await update(ref(db, `drivers/${currentUser.uid}`), {
            isActive: false,
          });
        }
      } catch (err) {
        console.error("Error tracking driver location:", err);
      }
    };

    startTrackingDriver();

    return () => {
      if (driverLocationSubRef.current) {
        driverLocationSubRef.current.remove();
        driverLocationSubRef.current = null;
      }
    };
  }, [userRole, isOnline, currentUser]);

  useEffect(() => {
    const unsubscribe = onAuthChange((user) => {
      setCurrentUser(user);
      setAuthResolved(true);
      if (!user) {
        router.replace("/login");
      }
    });

    return () => unsubscribe();
  }, []);

  // Listen and sync profile settings from Firebase
  useEffect(() => {
    if (!currentUser) return;

    setEditDisplayName(currentUser.displayName || "");
    setEditEmail(currentUser.email || "");

    const userRef = ref(db, `users/${currentUser.uid}`);
    return onValue(userRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        if (data.displayName) setEditDisplayName(data.displayName);
        if (data.email) setEditEmail(data.email);
        if (data.savedPlaces) {
          setEditHome(data.savedPlaces.home || "");
          setEditWork(data.savedPlaces.work || "");
        }
        if (data.emergencyContact) setEditEmergency(data.emergencyContact);
        if (data.shareLocation !== undefined) setShareLocation(data.shareLocation);
        
        // Sync Promo
        if (data.activePromo) {
          setAppliedPromo(data.activePromo);
        } else {
          setAppliedPromo(null);
        }

        // Sync Payments
        if (data.defaultPayment) {
          setDefaultPayment(data.defaultPayment);
        }
        if (data.savedCards) {
          const cardsArray = Object.keys(data.savedCards).map(key => ({
            id: key,
            ...data.savedCards[key]
          }));
          setSavedCards(cardsArray);
        } else {
          setSavedCards([]);
        }

        // Sync Theme Mode
        if (data.themeMode) {
          setThemeMode(data.themeMode);
        }
      }
    });
  }, [currentUser]);

  const handleSaveSettings = async () => {
    if (!currentUser) return;
    setSettingsLoading(true);
    try {
      await update(ref(db, `users/${currentUser.uid}`), {
        displayName: editDisplayName,
        email: editEmail,
        "savedPlaces/home": editHome,
        "savedPlaces/work": editWork,
        emergencyContact: editEmergency,
        shareLocation: shareLocation,
        themeMode: themeMode,
      });
      Alert.alert("Success 🎉", "Profile settings saved successfully!");
      setAccountSubView("menu");
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to save settings");
    } finally {
      setSettingsLoading(false);
    }
  };

  const handleApplyPromo = async (code: string) => {
    if (!currentUser) return;
    const cleanCode = code.toUpperCase().trim();
    if (!cleanCode) {
      Alert.alert("Error", "Please enter a coupon code");
      return;
    }

    let promoDetails = null;
    if (cleanCode === "WELCOME50") {
      promoDetails = { code: "WELCOME50", type: "percent", discount: 50, desc: "50% Off your next trip" };
    } else if (cleanCode === "SAVEMORE") {
      promoDetails = { code: "SAVEMORE", type: "flat", discount: 30, desc: "Flat ₹30 off" };
    } else if (cleanCode === "RIDEXFREE") {
      promoDetails = { code: "RIDEXFREE", type: "percent", discount: 100, desc: "100% Free ride" };
    } else {
      Alert.alert("Invalid Coupon 🎫", "This promo code is either invalid or expired.");
      return;
    }

    try {
      await set(ref(db, `users/${currentUser.uid}/activePromo`), promoDetails);
      Alert.alert("Coupon Applied 🚀", `Code ${cleanCode} has been applied to your account!`);
      setPromoInput("");
    } catch (err) {
      Alert.alert("Error", "Failed to apply coupon");
    }
  };

  const handleRemovePromo = async () => {
    if (!currentUser) return;
    try {
      await set(ref(db, `users/${currentUser.uid}/activePromo`), null);
      Alert.alert("Coupon Removed", "Promo code removed successfully.");
    } catch (err) {
      Alert.alert("Error", "Failed to remove coupon");
    }
  };

  const handleSelectDefaultPayment = async (method: string) => {
    if (!currentUser) return;
    try {
      await set(ref(db, `users/${currentUser.uid}/defaultPayment`), method);
      Alert.alert("Payment Updated 💳", `Default payment method set to ${method}`);
    } catch (err) {
      Alert.alert("Error", "Failed to update payment preference");
    }
  };

  const handleAddCard = async () => {
    if (!currentUser) return;
    if (!cardNumber || !cardExpiry || !cardCvv) {
      Alert.alert("Error", "Please fill in all card details");
      return;
    }
    const cleanCard = cardNumber.replace(/\s/g, "");
    if (cleanCard.length < 16) {
      Alert.alert("Error", "Please enter a valid 16-digit card number");
      return;
    }

    setSettingsLoading(true);
    try {
      const cardRef = ref(db, `users/${currentUser.uid}/savedCards`);
      const newCardRef = push(cardRef);
      await set(newCardRef, {
        number: `•••• •••• •••• ${cleanCard.slice(-4)}`,
        expiry: cardExpiry,
        type: "visa"
      });

      const formattedCardLabel = `💳 Visa (•••• ${cleanCard.slice(-4)})`;
      await set(ref(db, `users/${currentUser.uid}/defaultPayment`), formattedCardLabel);

      Alert.alert("Card Added 💳", "Mock Credit/Debit Card successfully linked and set as default payment!");
      setCardNumber("");
      setCardExpiry("");
      setCardCvv("");
    } catch (err) {
      Alert.alert("Error", "Failed to add payment card");
    } finally {
      setSettingsLoading(false);
    }
  };

  useEffect(() => {
    if (!currentUser) return;

    let unsubscribeDriverRideId: (() => void) | null = null;

    // Resolve Database Role
    getUserRole(currentUser.uid).then((role) => {
      const resolvedRole = role || "rider";
      setUserRole(resolvedRole);

      if (resolvedRole === "driver") {
        const driverRideIdRef = ref(db, `drivers/${currentUser.uid}/currentRideId`);
        unsubscribeDriverRideId = onValue(driverRideIdRef, (snap) => {
          const rideId = snap.val();
          if (rideId) {
            router.push("/driver");
          }
        });
      }
    });

    // Get User's Current Location for Map
    getUserLocation();

    // Listen for current active ride or incoming requests
    const ridesRef = ref(db, "rides");
    const unsubscribeCurrentRide = onValue(ridesRef, (snapshot) => {
      const data = snapshot.val();
      if (!data) {
        setActiveRide(null);
        setIncomingRequests([]);
        return;
      }

      // Update incoming ride request for online driver
      if (userRole === "driver") {
        const pendingForMe = Object.keys(data)
          .map((key) => ({ id: key, ...data[key] }))
          .filter((ride) => ride.driverId === currentUser.uid && ride.status === "pending");
        setIncomingRequests(pendingForMe);
        setActiveRide(null);
      } else {
        // Update active ride for rider view
        const userRideIdRef = ref(db, `users/${currentUser.uid}/currentRideId`);
        onValue(userRideIdRef, (rideIdSnap) => {
          const rideId = rideIdSnap.val();
          if (rideId && data[rideId]) {
            const rideDetails = data[rideId];
            if (["pending", "accepted", "started"].includes(rideDetails.status)) {
              setActiveRide({ id: rideId, ...rideDetails });
            } else {
              setActiveRide(null);
            }
          } else {
            setActiveRide(null);
          }
        }, { onlyOnce: true });
        setIncomingRequests([]);
      }
    });

    // Listen for recent completed rides
    const historyRef = ref(db, "rides/history");
    const unsubscribeHistory = onValue(historyRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const list = Object.keys(data)
          .map((key) => ({
            id: key,
            ...data[key],
          }))
          .filter((ride) => ride.status === "completed")
          .sort((a, b) => (b.completedAt || 0) - (a.completedAt || 0));
        setAllTrips(list);
      } else {
        setAllTrips([]);
      }
    });

    // Listen for scheduled reserved rides
    const reservesRef = ref(db, `users/${currentUser.uid}/reserves`);
    const unsubscribeReserves = onValue(reservesRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const list = Object.keys(data).map((key) => ({
          id: key,
          ...data[key],
        })).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        setReservedTrips(list);
      } else {
        setReservedTrips([]);
      }
    });

    return () => {
      unsubscribeCurrentRide();
      unsubscribeHistory();
      unsubscribeReserves();
      if (unsubscribeDriverRideId) {
        unsubscribeDriverRideId();
      }
    };
  }, [currentUser]);

  const cancelReservedTrip = async (id: string) => {
    if (!currentUser) return;
    try {
      await set(ref(db, `users/${currentUser.uid}/reserves/${id}`), null);
      Alert.alert("Success 📅", "Your reserved booking has been cancelled.");
    } catch (err) {
      console.error("Cancel reserve trip failed:", err);
    }
  };

  const getUserLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === "granted") {
        const loc = await Location.getCurrentPositionAsync({});
        setMapRegion({
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
          latitudeDelta: 0.012,
          longitudeDelta: 0.012,
        });
      } else {
        // Fallback default coordinates (Delhi)
        setMapRegion({
          latitude: 28.6139,
          longitude: 77.209,
          latitudeDelta: 0.02,
          longitudeDelta: 0.02,
        });
      }
    } catch (err) {
      console.warn("Location fetch error on welcome screen:", err);
    }
  };



  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      if (userRole === "driver" && currentUser) {
        await update(ref(db, `drivers/${currentUser.uid}`), {
          isActive: false,
        });
      }
      await logoutUser();
    } catch (error) {
      console.error("Signout error:", error);
    } finally {
      setSigningOut(false);
    }
  };

  const handleAcceptTrip = async (trip: any) => {
    if (!currentUser) return;
    try {
      await update(ref(db, `rides/${trip.id}`), {
        status: "accepted",
        driverId: currentUser.uid,
        driverName: currentUser.displayName || "RideX Driver",
        driverPhone: "+91 99999 99999",
      });
      await set(ref(db, `drivers/${currentUser.uid}/currentRideId`), trip.id);
      // Redirect to the active Driver screen layout
      router.push("/driver");
    } catch (err) {
      console.error("Accept trip error:", err);
    }
  };

  const handleDeclineTrip = async (trip: any) => {
    try {
      await update(ref(db, `rides/${trip.id}`), {
        status: "rejected",
      });
      setIncomingRequests([]);
    } catch (err) {
      console.error("Decline trip error:", err);
    }
  };

  const getGreetingText = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  };

  const getFirstName = (displayName: string | null | undefined) => {
    if (!displayName) return "Explorer";
    return displayName.split(" ")[0];
  };

  if (!authResolved || (authResolved && !currentUser) || signingOut || !userRole) {
    return (
      <AnimatedLoader
        message={signingOut ? "Signing out..." : "Initializing RideX..."}
      />
    );
  }

  // --- RENDERING DRIVER EXPERIENCE ---
  if (userRole === "driver") {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />

        {/* Floating Header */}
        <View style={styles.floatingHeader}>
          <View style={styles.brandBadge}>
            <Text style={styles.brandName}>RideX Driver</Text>
            <View style={[styles.liveIndicatorDot, { backgroundColor: isOnline ? "#10B981" : "#94A3B8" }]} />
          </View>

          <View style={styles.profileSection}>
            <View style={[styles.avatarCircle, { backgroundColor: "#10B981" }]}>
              <Text style={styles.avatarText}>
                {(currentUser?.displayName || currentUser?.email || "D")[0].toUpperCase()}
              </Text>
            </View>
            <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
              <Text style={styles.signOutText}>Sign Out</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Driver Map View */}
        <View style={styles.mapContainer}>
          {mapRegion ? (
            <MapView
              style={styles.map}
              region={mapRegion}
              showsUserLocation={true}
              showsMyLocationButton={false}
              customMapStyle={silverMapStyle}
            >
              {mapRegion && (
                <Marker 
                  coordinate={{ latitude: mapRegion.latitude, longitude: mapRegion.longitude }}
                  title="Your Vehicle"
                />
              )}
            </MapView>
          ) : (
            <View style={styles.mapPlaceholder}>
              <ActivityIndicator size="small" color="#10B981" />
            </View>
          )}

          {/* GO ONLINE / OFFLINE Floating Toggle Pill */}
          <View style={styles.driverToggleContainer}>
            <TouchableOpacity 
              style={[styles.driverTogglePill, isOnline ? styles.driverToggleOnline : styles.driverToggleOffline]}
              onPress={() => setIsOnline(!isOnline)}
              activeOpacity={0.9}
            >
              <View style={[styles.pulseCircle, { backgroundColor: isOnline ? "#10B981" : "#EF4444" }]} />
              <Text style={styles.driverToggleText}>
                {isOnline ? "YOU ARE ONLINE" : "GO ONLINE"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Driver Dashboard Bottom Panels */}
        <ScrollView style={styles.driverBottomSheet} showsVerticalScrollIndicator={false}>
          <View style={styles.dragHandle} />

          {/* Earnings Stats Performance Grid */}
          <View style={styles.statsCardGrid}>
            <View style={styles.statCard}>
              <Text style={styles.statEmoji}>💰</Text>
              <Text style={styles.statVal}>₹{earnings}</Text>
              <Text style={styles.statLabel}>{"Today's Pay"}</Text>
            </View>

            <View style={styles.statCard}>
              <Text style={styles.statEmoji}>⚡</Text>
              <Text style={styles.statVal}>{tripsCount}</Text>
              <Text style={styles.statLabel}>Completed</Text>
            </View>

            <View style={styles.statCard}>
              <Text style={styles.statEmoji}>⭐</Text>
              <Text style={styles.statVal}>4.9</Text>
              <Text style={styles.statLabel}>Rating</Text>
            </View>
          </View>

          {/* Online status feed overlay */}
          {!isOnline ? (
            <View style={styles.offlineHelperCard}>
              <Text style={styles.offlineHelperTitle}>You are currently offline</Text>
              <Text style={styles.offlineHelperDesc}>
                Toggle ONLINE at the top of the map to start receiving ride requests in your area.
              </Text>
            </View>
          ) : (
            <View style={styles.onlineFeedSection}>
              <Text style={styles.sectionHeaderTitle}>Incoming Requests</Text>

              {incomingRequests.length === 0 ? (
                <View style={styles.searchingRequestCard}>
                  <ActivityIndicator size="small" color="#10B981" />
                  <Text style={styles.searchingRequestText}>Looking for passenger requests nearby...</Text>
                </View>
              ) : (
                incomingRequests.map((request, index) => (
                  <View key={index} style={styles.requestCard}>
                    <View style={styles.requestHeader}>
                      <View style={styles.requestBadge}>
                        <Text style={styles.requestBadgeText}>RIDE REQUEST</Text>
                      </View>
                      <Text style={styles.requestFare}>₹{request.fare || 150}</Text>
                    </View>

                    <Text style={styles.requestAddress} numberOfLines={1}>
                      📍 Pickup: {request.pickupAddress ? request.pickupAddress.split(",")[0] : "Loading address..."}
                    </Text>
                    <Text style={[styles.requestAddress, { marginTop: 4 }]} numberOfLines={1}>
                      🏁 Destination: {request.destinationAddress ? request.destinationAddress.split(",")[0] : "Destination"}
                    </Text>

                    {request.bookingForSomeoneElse && (
                      <View style={styles.passengerDetailBadge}>
                        <Text style={styles.passengerDetailText}>
                          👥 Booked for: {request.passengerName} ({request.passengerPhone})
                        </Text>
                      </View>
                    )}

                    <View style={styles.requestActionRow}>
                      <TouchableOpacity 
                        style={styles.declineButton}
                        onPress={() => handleDeclineTrip(request)}
                      >
                        <Text style={styles.declineButtonText}>Decline</Text>
                      </TouchableOpacity>

                      <TouchableOpacity 
                        style={styles.acceptButton}
                        onPress={() => handleAcceptTrip(request)}
                      >
                        <Text style={styles.acceptButtonText}>ACCEPT TRIP</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))
              )}
            </View>
          )}

          {/* Driver Information Safety Cards */}
          <View style={styles.driverSafetyInfoSection}>
            <Text style={styles.sectionHeaderTitle}>Partner Updates</Text>
            <View style={styles.partnerInfoCard}>
              <Text style={styles.partnerInfoIcon}>🛡️</Text>
              <View style={styles.partnerInfoBody}>
                <Text style={styles.partnerInfoTitle}>Safety Standard</Text>
                <Text style={styles.partnerInfoDesc}>Ensure vehicles are sanitized & follow local OTP verification protocols.</Text>
              </View>
            </View>
          </View>
        </ScrollView>
      </View>
    );
  }

  // --- RENDERING RIDER EXPERIENCE ---
  const isDarkMode = themeMode === "dark";
  const themeBg = isDarkMode ? "#090D1A" : "#F8FAFC";
  const themeCard = isDarkMode ? "#171E2E" : "#FFFFFF";
  const themeText = isDarkMode ? "#FFFFFF" : "#0F172A";
  const themeTextMuted = isDarkMode ? "#94A3B8" : "#64748B";
  const themeBorder = isDarkMode ? "#1F2937" : "#E2E8F0";
  const themeStatusBar = isDarkMode ? "light-content" : "dark-content";

  return (
    <View style={[styles.container, { backgroundColor: themeBg }]}>
      <StatusBar barStyle={themeStatusBar} translucent backgroundColor="transparent" />

      {/* HOME TAB VIEW */}
      {activeTab === "home" && (
        <>
          {/* Floating Header Overlay */}
          <View style={[styles.floatingHeader, { backgroundColor: isDarkMode ? "rgba(15, 23, 42, 0.95)" : "rgba(255, 255, 255, 0.95)", borderBottomWidth: 1, borderBottomColor: themeBorder }]}>
            <View style={styles.brandBadge}>
              <Text style={[styles.brandName, { color: themeText }]}>RideX</Text>
              <View style={styles.liveIndicatorDot} />
            </View>

             <View style={styles.profileSection}>
              <View style={[styles.avatarCircle, { backgroundColor: "#3B82F6" }]}>
                <Text style={[styles.avatarText, { color: "#FFFFFF" }]}>
                  {(currentUser?.displayName || currentUser?.email || "U")[0].toUpperCase()}
                </Text>
              </View>
              <TouchableOpacity 
                style={styles.signOutButton} 
                onPress={handleSignOut}
                activeOpacity={0.8}
              >
                <Text style={styles.signOutText}>Sign Out</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Premium Silver Map Section */}
          <View style={styles.mapContainer}>
            {mapRegion ? (
              <MapView
                ref={mapRef}
                style={styles.map}
                region={mapRegion}
                showsUserLocation={true}
                showsMyLocationButton={false}
                pitchEnabled={false}
                rotateEnabled={false}
                customMapStyle={silverMapStyle}
              >
                {mapRegion && (
                  <Marker 
                    coordinate={{ latitude: mapRegion.latitude, longitude: mapRegion.longitude }}
                    title="Your Location"
                  />
                )}
              </MapView>
            ) : (
              <View style={styles.mapPlaceholder}>
                <ActivityIndicator size="small" color="#0F172A" />
              </View>
            )}
          </View>

          {/* Uber-Style Sliding Bottom Sheet */}
          <ScrollView 
            style={[styles.bottomSheet, { backgroundColor: themeCard }]} 
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.sheetContent}
          >
            {/* Grab Handle Indicator */}
            <View style={[styles.dragHandle, { backgroundColor: isDarkMode ? "#334155" : "#E2E8F0" }]} />

            {/* User Greeting */}
            <View style={styles.greetingHeader}>
              <Text style={[styles.greetingText, { color: themeTextMuted }]}>{getGreetingText()},</Text>
              <Text style={[styles.userNameText, { color: themeText }]}>{getFirstName(currentUser?.displayName)}</Text>
            </View>

            {/* Uber-Style Search Input Pill */}
            <TouchableOpacity 
              style={[styles.searchPill, { backgroundColor: isDarkMode ? "#0F172A" : "#F3F4F6", borderColor: themeBorder }]} 
              onPress={() => router.push("/customer")}
              activeOpacity={0.9}
            >
              <View style={styles.searchPillLeft}>
                <Text style={styles.searchIcon}>🔍</Text>
                <Text style={[styles.searchPlaceholder, { color: themeTextMuted }]}>Where to?</Text>
              </View>
              <View style={[styles.timePill, { backgroundColor: isDarkMode ? "#1E293B" : "#FFFFFF" }]}>
                <Text style={styles.timePillIcon}>🕒</Text>
                <Text style={[styles.timePillText, { color: themeText }]}>Now</Text>
                <Text style={[styles.timePillArrow, { color: themeText }]}>▼</Text>
              </View>
            </TouchableOpacity>

            {/* Location Shortcuts capsule Tags */}
            <View style={styles.quickLocationsRow}>
              <TouchableOpacity style={[styles.locationCapsule, { backgroundColor: isDarkMode ? "#0F172A" : "#F3F4F6" }]} onPress={() => router.push("/customer")} activeOpacity={0.8}>
                <Text style={styles.capsuleIcon}>🏠</Text>
                <Text style={[styles.capsuleText, { color: themeText }]}>Home</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.locationCapsule, { backgroundColor: isDarkMode ? "#0F172A" : "#F3F4F6" }]} onPress={() => router.push("/customer")} activeOpacity={0.8}>
                <Text style={styles.capsuleIcon}>🏢</Text>
                <Text style={[styles.capsuleText, { color: themeText }]}>Work</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.locationCapsule, { backgroundColor: isDarkMode ? "#0F172A" : "#F3F4F6" }]} onPress={() => router.push("/customer")} activeOpacity={0.8}>
                <Text style={styles.capsuleIcon}>➕</Text>
                <Text style={[styles.capsuleText, { color: themeText }]}>Saved</Text>
              </TouchableOpacity>
            </View>

            {/* Active Trip Pinned Banner */}
            {activeRide && (
              <TouchableOpacity 
                style={styles.activeRideCard} 
                onPress={() => router.push(activeRide.driverId && activeRide.driverId === currentUser?.uid ? "/driver" : "/customer")}
                activeOpacity={0.9}
              >
                <View style={styles.activeRideHeader}>
                  <View style={styles.activeRideBadge}>
                    <View style={styles.activeRidePulse} />
                    <Text style={styles.activeRideBadgeText}>ACTIVE TRIP</Text>
                  </View>
                  <Text style={styles.activeRideOtp}>OTP: {activeRide.otp}</Text>
                </View>
                <Text style={styles.activeRideTitle}>
                  {activeRide.status === "pending" && "🔄 Searching for drivers..."}
                  {activeRide.status === "accepted" && "🚖 Driver accepted & arriving"}
                  {activeRide.status === "started" && "🚕 Headed to destination"}
                </Text>
                <Text style={styles.activeRideRoute} numberOfLines={1}>
                  {activeRide.pickupAddress ? `${activeRide.pickupAddress.split(",")[0]} ➔ ` : ""}
                  {activeRide.destinationAddress ? activeRide.destinationAddress.split(",")[0] : "Trip In Progress"}
                </Text>
                <Text style={styles.activeRideLink}>Track active trip on live map ➔</Text>
              </TouchableOpacity>
            )}

            {/* Uber-Style Grid of services cards (Mesh Gradient Tiles) */}
            <View style={styles.gridSection}>
              <Text style={styles.sectionHeaderTitle}>Services</Text>
              
              <View style={styles.gridRow}>
                {/* Ride Card */}
                <TouchableOpacity 
                  style={[styles.tileCard, { backgroundColor: "#E0F2FE" }]} 
                  onPress={() => router.push("/customer")}
                  activeOpacity={0.85}
                >
                  <View style={styles.tileHeader}>
                    <Text style={styles.tileTitle}>Ride</Text>
                    <View style={styles.popularBadge}>
                      <Text style={styles.popularBadgeText}>POPULAR</Text>
                    </View>
                  </View>
                  <Text style={styles.tileDesc}>Standard & premium trips</Text>
                  <Text style={styles.tileEmoji}>🚖</Text>
                </TouchableOpacity>

                {/* Drive Card */}
                <TouchableOpacity 
                  style={[styles.tileCard, { backgroundColor: "#ECFDF5" }]} 
                  onPress={() => router.push("/driver")}
                  activeOpacity={0.85}
                >
                  <View style={styles.tileHeader}>
                    <Text style={styles.tileTitle}>Drive</Text>
                    <View style={[styles.popularBadge, { backgroundColor: "rgba(16, 185, 129, 0.12)" }]}>
                      <Text style={[styles.popularBadgeText, { color: "#059669" }]}>EARN</Text>
                    </View>
                  </View>
                  <Text style={styles.tileDesc}>Go online & earn fares</Text>
                  <Text style={styles.tileEmoji}>🏎️</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.gridRowSecondary}>
                {/* Reserve Card */}
                <TouchableOpacity 
                  style={[styles.smallTileCard, { backgroundColor: "#F3E8FF" }]} 
                  onPress={() => router.push({ pathname: "/customer", params: { mode: "reserve" } })}
                  activeOpacity={0.85}
                >
                  <View style={styles.smallTileBody}>
                    <Text style={styles.smallTileEmoji}>📅</Text>
                    <View>
                      <Text style={styles.smallTileTitle}>Reserve</Text>
                      <Text style={styles.smallTileDesc}>Plan trips in advance</Text>
                    </View>
                  </View>
                </TouchableOpacity>

                {/* Activity Card */}
                <TouchableOpacity 
                  style={[styles.smallTileCard, { backgroundColor: "#F3F4F6" }]} 
                  onPress={() => setActiveTab("activity")}
                  activeOpacity={0.85}
                >
                  <View style={styles.smallTileBody}>
                    <Text style={styles.smallTileEmoji}>📋</Text>
                    <View>
                      <Text style={styles.smallTileTitle}>Activity</Text>
                      <Text style={styles.smallTileDesc}>Recent history details</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              </View>
            </View>

            {/* Scheduled Rides Reserve Section */}
            {reservedTrips.length > 0 && (
              <View style={{ marginHorizontal: 20, marginTop: 22 }}>
                <Text style={{ fontSize: 16, fontWeight: "900", color: themeText, marginBottom: 12 }}>
                  📅 Scheduled Rides
                </Text>
                {reservedTrips.map((reserve) => (
                  <View 
                    key={reserve.id} 
                    style={{ 
                      backgroundColor: themeCard, 
                      borderColor: themeBorder, 
                      borderWidth: 1.5, 
                      borderRadius: 16, 
                      padding: 14, 
                      marginBottom: 10,
                      shadowColor: "#000",
                      shadowOpacity: 0.03,
                      shadowRadius: 5,
                      shadowOffset: { width: 0, height: 2 },
                      elevation: 1,
                    }}
                  >
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                      <Text style={{ fontSize: 13, fontWeight: "900", color: "#2563EB" }}>
                        Scheduled: {reserve.scheduledDate} • {reserve.scheduledTime}
                      </Text>
                      <Text style={{ fontSize: 11, fontWeight: "800", color: themeTextMuted }}>
                        {reserve.vehicleType === "car" ? "🚗 RideX Go" : reserve.vehicleType === "bike" ? "🏍️ RideX Moto" : "🛺 RideX Auto"}
                      </Text>
                    </View>

                    <View style={{ marginTop: 8, gap: 4 }}>
                      <Text style={{ fontSize: 13, fontWeight: "700", color: themeText }} numberOfLines={1}>
                        🟢 {reserve.pickupAddress ? reserve.pickupAddress.split(",")[0] : "Current Location"}
                      </Text>
                      <Text style={{ fontSize: 13, fontWeight: "700", color: themeText }} numberOfLines={1}>
                        🔴 {reserve.destinationAddress ? reserve.destinationAddress.split(",")[0] : "Destination"}
                      </Text>
                    </View>

                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 10, borderTopWidth: 1, borderTopColor: themeBorder, paddingTop: 8 }}>
                      <Text style={{ fontSize: 13, fontWeight: "800", color: themeText }}>
                        Fare: ₹{reserve.fare}
                      </Text>
                      <TouchableOpacity 
                        style={{ backgroundColor: "#EF4444", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 }}
                        onPress={() => cancelReservedTrip(reserve.id)}
                        activeOpacity={0.7}
                      >
                        <Text style={{ color: "#FFFFFF", fontSize: 11, fontWeight: "950" }}>
                          Cancel Ride
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </View>
            )}

            {/* Uber-Style Recent Destinations List */}
            <View style={styles.recentDestSection}>
              <View style={styles.recentHeaderRow}>
                <Text style={styles.recentTitle}>Recent destinations</Text>
                <TouchableOpacity onPress={() => setActiveTab("activity")}>
                  <Text style={styles.seeAllText}>See All</Text>
                </TouchableOpacity>
              </View>

              {allTrips.length === 0 ? (
                <View style={styles.emptyRecentCard}>
                  <Text style={styles.emptyRecentEmoji}>🧾</Text>
                  <Text style={styles.emptyRecentText}>No completed trips yet.</Text>
                </View>
              ) : (
                allTrips.slice(0, 3).map((trip) => (
                  <TouchableOpacity 
                    key={trip.id} 
                    style={styles.recentRow}
                    onPress={() => router.push("/customer")}
                    activeOpacity={0.7}
                  >
                    <View style={styles.clockIconCircle}>
                      <Text style={styles.clockIcon}>🕒</Text>
                    </View>
                    <View style={styles.recentBody}>
                      <Text style={styles.recentDestName} numberOfLines={1}>
                        {trip.destinationAddress ? trip.destinationAddress.split(",")[0] : "Trip " + String(trip.id).slice(-4)}
                      </Text>
                      <Text style={styles.recentDestDetail} numberOfLines={1}>
                        {trip.destinationAddress || "Standard ride route"}
                      </Text>
                    </View>
                    <Text style={styles.recentRowArrow}>›</Text>
                  </TouchableOpacity>
                ))
              )}
            </View>

            {/* Uber-Style Promos Slider */}
            <View style={styles.promoSection}>
              <Text style={styles.recentTitle}>Ways to save & track</Text>
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false} 
                contentContainerStyle={styles.promoContainer}
              >
                <View style={[styles.promoCard, { backgroundColor: "#F3F4F6" }]}>
                  <View style={styles.promoIconContainer}>
                    <Text style={styles.promoEmoji}>🛡️</Text>
                  </View>
                  <View style={styles.promoTextGroup}>
                    <Text style={styles.promoTitleText}>Safety Checkup</Text>
                    <Text style={styles.promoDescText}>Share route logs with family members.</Text>
                  </View>
                </View>

                <View style={[styles.promoCard, { backgroundColor: "#F3F4F6" }]}>
                  <View style={styles.promoIconContainer}>
                    <Text style={styles.promoEmoji}>🎫</Text>
                  </View>
                  <View style={styles.promoTextGroup}>
                    <Text style={styles.promoTitleText}>Get 20% Off</Text>
                    <Text style={styles.promoDescText}>Promo code active: Use code RIDEX20.</Text>
                  </View>
                </View>
              </ScrollView>
            </View>

            {/* Footer info */}
            <View style={styles.footer}>
              <Text style={styles.footerText}>RideX Premium Mobility Services</Text>
            </View>
          </ScrollView>
        </>
      )}

      {/* SERVICES TAB VIEW */}
      {activeTab === "services" && (
        <ScrollView style={[styles.tabContent, { backgroundColor: themeBg }]} showsVerticalScrollIndicator={false}>
          <Text style={[styles.tabTitle, { color: themeText }]}>Services</Text>
          
          <View style={[styles.serviceItemBox, { backgroundColor: themeCard, borderColor: themeBorder }]}>
            <Text style={styles.serviceIcon}>🚖</Text>
            <View style={styles.serviceInfo}>
              <Text style={[styles.serviceName, { color: themeText }]}>RideX Go</Text>
              <Text style={[styles.serviceDesc, { color: themeTextMuted }]}>Affordable everyday rides across city limits</Text>
            </View>
            <TouchableOpacity style={styles.serviceGoButton} onPress={() => router.push("/customer")}>
              <Text style={styles.serviceGoText}>Go</Text>
            </TouchableOpacity>
          </View>

          <View style={[styles.serviceItemBox, { backgroundColor: themeCard, borderColor: themeBorder }]}>
            <Text style={styles.serviceIcon}>⭐</Text>
            <View style={styles.serviceInfo}>
              <Text style={[styles.serviceName, { color: themeText }]}>RideX Premium</Text>
              <Text style={[styles.serviceDesc, { color: themeTextMuted }]}>Elite comfort rides with top-rated drivers</Text>
            </View>
            <TouchableOpacity style={styles.serviceGoButton} onPress={() => router.push("/customer")}>
              <Text style={styles.serviceGoText}>Go</Text>
            </TouchableOpacity>
          </View>

          <View style={[styles.serviceItemBox, { backgroundColor: themeCard, borderColor: themeBorder }]}>
            <Text style={styles.serviceIcon}>📦</Text>
            <View style={styles.serviceInfo}>
              <Text style={[styles.serviceName, { color: themeText }]}>Intercity Delivery</Text>
              <Text style={[styles.serviceDesc, { color: themeTextMuted }]}>Send parcels or documents securely</Text>
            </View>
            <TouchableOpacity style={styles.serviceGoButton} onPress={() => router.push("/customer")}>
              <Text style={styles.serviceGoText}>Go</Text>
            </TouchableOpacity>
          </View>

          <View style={[styles.serviceItemBox, { backgroundColor: themeCard, borderColor: themeBorder }]}>
            <Text style={styles.serviceIcon}>📅</Text>
            <View style={styles.serviceInfo}>
              <Text style={[styles.serviceName, { color: themeText }]}>Reserved Booking</Text>
              <Text style={[styles.serviceDesc, { color: themeTextMuted }]}>Schedule trips up to 30 days in advance</Text>
            </View>
            <TouchableOpacity style={styles.serviceGoButton} onPress={() => router.push({ pathname: "/customer", params: { mode: "reserve" } })}>
              <Text style={styles.serviceGoText}>Go</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}

      {/* ACTIVITY TAB VIEW */}
      {activeTab === "activity" && (
        <ScrollView style={[styles.tabContent, { backgroundColor: themeBg }]} showsVerticalScrollIndicator={false}>
          <Text style={[styles.tabTitle, { color: themeText }]}>Activity</Text>
          <Text style={[styles.tabSubtitle, { color: themeTextMuted }]}>Past Completed Trips</Text>

          {allTrips.length === 0 ? (
            <View style={[styles.emptyActivityCard, { backgroundColor: themeCard, borderColor: themeBorder }]}>
              <Text style={styles.emptyActivityEmoji}>🧾</Text>
              <Text style={[styles.emptyActivityText, { color: themeTextMuted }]}>No completed trips on record yet.</Text>
            </View>
          ) : (
            allTrips.map((trip) => (
              <View key={trip.id} style={[styles.activityRowBox, { backgroundColor: themeCard, borderColor: themeBorder }]}>
                <View style={styles.activityIconWrap}>
                  <Text style={styles.activityIcon}>🚕</Text>
                </View>
                <View style={styles.activityBody}>
                  <Text style={[styles.activityDest, { color: themeText }]} numberOfLines={1}>
                    {trip.destinationAddress ? trip.destinationAddress.split(",")[0] : "Trip " + String(trip.id).slice(-4)}
                  </Text>
                  <Text style={[styles.activityTime, { color: themeTextMuted }]}>
                    {trip.completedAt ? new Date(trip.completedAt).toLocaleString() : "Recent Completed"}
                  </Text>
                </View>
                <View style={styles.activityMetrics}>
                  <Text style={[styles.activityPrice, { color: themeText }]}>₹{trip.fare || 0}</Text>
                  <Text style={[styles.activityDist, { color: themeTextMuted }]}>{trip.distance} km</Text>
                </View>
              </View>
            ))
          )}
        </ScrollView>
      )}

      {/* ACCOUNT TAB VIEW */}
      {/* ACCOUNT TAB VIEW */}
      {activeTab === "account" && (
        <ScrollView style={[styles.tabContent, { backgroundColor: themeBg }]} showsVerticalScrollIndicator={false}>
          {accountSubView === "menu" ? (
            <>
              <Text style={[styles.tabTitle, { color: themeText }]}>Account</Text>

              <View style={[styles.accountCard, { backgroundColor: themeCard, borderColor: themeBorder }]}>
                <View style={styles.accountAvatar}>
                  <Text style={styles.avatarEmojiText}>
                    {(currentUser?.displayName || currentUser?.email || "U")[0].toUpperCase()}
                  </Text>
                </View>
                <View style={styles.accountInfo}>
                  <Text style={[styles.accountName, { color: themeText }]}>{currentUser?.displayName || "RideX Explorer"}</Text>
                  <Text style={[styles.accountEmail, { color: themeTextMuted }]}>{currentUser?.email || "No email"}</Text>
                  <Text style={[styles.accountPhone, { color: themeTextMuted }]}>Authenticated Safely</Text>
                </View>
              </View>

              <TouchableOpacity 
                style={[styles.accountMenuItem, { borderColor: "#3B82F6", backgroundColor: isDarkMode ? "rgba(37, 99, 235, 0.1)" : "#EFF6FF" }]} 
                activeOpacity={0.7}
                onPress={async () => {
                  const newRole = userRole === "rider" ? "driver" : "rider";
                  setUserRole(newRole);
                  if (currentUser) {
                    await update(ref(db, `users/${currentUser.uid}`), { role: newRole });
                    Alert.alert("Role Switched 🔄", `Successfully switched to ${newRole === "rider" ? "Rider Account" : "Driver Partner Mode"}`);
                  }
                }}
              >
                <Text style={[styles.accountMenuText, { color: "#3B82F6", fontWeight: "800" }]}>
                  {userRole === "rider" ? "🏎️ Switch to Driver Partner" : "🚖 Switch to Rider Account"}
                </Text>
                <Text style={[styles.accountMenuArrow, { color: "#3B82F6" }]}>→</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.accountMenuItem, { backgroundColor: themeCard, borderColor: themeBorder }]} 
                activeOpacity={0.7}
                onPress={() => setAccountSubView("settings")}
              >
                <Text style={[styles.accountMenuText, { color: themeText }]}>⚙️ Settings</Text>
                <Text style={styles.accountMenuArrow}>→</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.accountMenuItem, { backgroundColor: themeCard, borderColor: themeBorder }]} 
                activeOpacity={0.7}
                onPress={() => setAccountSubView("promocodes")}
              >
                <Text style={[styles.accountMenuText, { color: themeText }]}>🎫 Promo Codes</Text>
                <Text style={styles.accountMenuArrow}>→</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.accountMenuItem, { backgroundColor: themeCard, borderColor: themeBorder }]} 
                activeOpacity={0.7}
                onPress={() => setAccountSubView("payment")}
              >
                <Text style={[styles.accountMenuText, { color: themeText }]}>💳 Payment Methods</Text>
                <Text style={styles.accountMenuArrow}>→</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.accountMenuItem, { backgroundColor: themeCard, borderColor: themeBorder }]} 
                activeOpacity={0.7}
                onPress={() => setAccountSubView("support")}
              >
                <Text style={[styles.accountMenuText, { color: themeText }]}>🛡️ Help & Safety Support</Text>
                <Text style={styles.accountMenuArrow}>→</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.accountMenuItem, { borderColor: "rgba(239, 68, 68, 0.2)", backgroundColor: "rgba(239, 68, 68, 0.05)", marginTop: 14 }]}
                onPress={handleSignOut}
                activeOpacity={0.7}
              >
                <Text style={[styles.accountMenuText, { color: "#EF4444" }]}>🚪 Sign Out</Text>
                <Text style={[styles.accountMenuArrow, { color: "#EF4444" }]}>→</Text>
              </TouchableOpacity>
            </>
          ) : accountSubView === "settings" ? (
            // DETAILED SETTINGS SUBVIEW (Uber-Style)
            <View style={styles.settingsWrapper}>
              <View style={styles.settingsHeader}>
                <TouchableOpacity 
                  onPress={() => setAccountSubView("menu")}
                  style={styles.settingsBackBtn}
                  activeOpacity={0.7}
                >
                  <Ionicons name="arrow-back" size={22} color={themeText} />
                </TouchableOpacity>
                <Text style={[styles.settingsHeaderTitle, { color: themeText }]}>Profile & Saved Places</Text>
              </View>

              <View style={[styles.settingsSection, { backgroundColor: themeCard, borderColor: themeBorder }]}>
                <Text style={[styles.settingsSectionTitle, { color: themeText }]}>Personal Info</Text>
                
                <View style={styles.settingsField}>
                  <Text style={styles.settingsLabel}>Full Name</Text>
                  <TextInput
                    style={[styles.settingsInput, { backgroundColor: isDarkMode ? "#0F172A" : "#F8FAFC", color: themeText, borderColor: themeBorder }]}
                    value={editDisplayName}
                    onChangeText={setEditDisplayName}
                    placeholder="Enter your name"
                    placeholderTextColor="#94A3B8"
                  />
                </View>

                <View style={styles.settingsField}>
                  <Text style={styles.settingsLabel}>Email Address</Text>
                  <TextInput
                    style={[styles.settingsInput, { backgroundColor: isDarkMode ? "#0F172A" : "#F8FAFC", color: themeText, borderColor: themeBorder }]}
                    value={editEmail}
                    onChangeText={setEditEmail}
                    placeholder="name@example.com"
                    placeholderTextColor="#94A3B8"
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                </View>
              </View>

              <View style={[styles.settingsSection, { backgroundColor: themeCard, borderColor: themeBorder }]}>
                <Text style={[styles.settingsSectionTitle, { color: themeText }]}>Saved Places (Uber-Style)</Text>
                
                <View style={styles.settingsField}>
                  <Text style={styles.settingsLabel}>🏠 Home Address</Text>
                  <TextInput
                    style={[styles.settingsInput, { backgroundColor: isDarkMode ? "#0F172A" : "#F8FAFC", color: themeText, borderColor: themeBorder }]}
                    value={editHome}
                    onChangeText={setEditHome}
                    placeholder="Set Home destination address"
                    placeholderTextColor="#94A3B8"
                  />
                </View>

                <View style={styles.settingsField}>
                  <Text style={styles.settingsLabel}>💼 Work Address</Text>
                  <TextInput
                    style={[styles.settingsInput, { backgroundColor: isDarkMode ? "#0F172A" : "#F8FAFC", color: themeText, borderColor: themeBorder }]}
                    value={editWork}
                    onChangeText={setEditWork}
                    placeholder="Set Work destination address"
                    placeholderTextColor="#94A3B8"
                  />
                </View>
              </View>

              <View style={[styles.settingsSection, { backgroundColor: themeCard, borderColor: themeBorder }]}>
                <Text style={[styles.settingsSectionTitle, { color: themeText }]}>Appearance</Text>
                <View style={styles.settingsPrivacyRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.settingsPrivacyTitle, { color: themeText }]}>Theme Accent Mode</Text>
                    <Text style={styles.settingsPrivacyDesc}>Toggle between Light Mode and premium Dark Mode appearance.</Text>
                  </View>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <Text style={{ fontSize: 13, fontWeight: "800", color: themeText }}>
                      {themeMode === "dark" ? "🌙 Dark" : "☀️ Light"}
                    </Text>
                    <Switch
                      value={themeMode === "dark"}
                      onValueChange={(val) => setThemeMode(val ? "dark" : "light")}
                      trackColor={{ false: "#CBD5E1", true: "#3B82F6" }}
                      thumbColor={themeMode === "dark" ? "#2563EB" : "#F1F5F9"}
                    />
                  </View>
                </View>
              </View>

              <View style={[styles.settingsSection, { backgroundColor: themeCard, borderColor: themeBorder }]}>
                <Text style={[styles.settingsSectionTitle, { color: themeText }]}>Safety & Privacy</Text>
                
                <View style={styles.settingsField}>
                  <Text style={styles.settingsLabel}>🚨 Emergency Contact Phone</Text>
                  <TextInput
                    style={[styles.settingsInput, { backgroundColor: isDarkMode ? "#0F172A" : "#F8FAFC", color: themeText, borderColor: themeBorder }]}
                    value={editEmergency}
                    onChangeText={setEditEmergency}
                    placeholder="+91 XXXXX XXXXX"
                    placeholderTextColor="#94A3B8"
                    keyboardType="phone-pad"
                  />
                </View>

                <View style={styles.settingsPrivacyRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.settingsPrivacyTitle, { color: themeText }]}>Share Live Location</Text>
                    <Text style={styles.settingsPrivacyDesc}>Share active trip statuses with emergency contact</Text>
                  </View>
                  <Switch
                    value={shareLocation}
                    onValueChange={setShareLocation}
                    trackColor={{ false: "#CBD5E1", true: "#93C5FD" }}
                    thumbColor={shareLocation ? "#2563EB" : "#F1F5F9"}
                  />
                </View>
              </View>

              <TouchableOpacity 
                style={[styles.saveSettingsButton, settingsLoading && { opacity: 0.7 }]} 
                onPress={handleSaveSettings}
                disabled={settingsLoading}
                activeOpacity={0.85}
              >
                {settingsLoading ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.saveSettingsText}>Save & Apply Settings</Text>
                )}
              </TouchableOpacity>
            </View>
          ) : accountSubView === "promocodes" ? (
            // PROMO CODES SUBVIEW
            <View style={styles.settingsWrapper}>
              <View style={styles.settingsHeader}>
                <TouchableOpacity 
                  onPress={() => setAccountSubView("menu")}
                  style={styles.settingsBackBtn}
                  activeOpacity={0.7}
                >
                  <Ionicons name="arrow-back" size={22} color={themeText} />
                </TouchableOpacity>
                <Text style={[styles.settingsHeaderTitle, { color: themeText }]}>Promo Codes & Offers</Text>
              </View>

              {appliedPromo && (
                <View style={[styles.promoActiveCard, { backgroundColor: "#ECFDF5", borderColor: "#10B981", borderWidth: 1.5, padding: 16, borderRadius: 16, marginBottom: 20 }]}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                    <View style={{ flex: 1, marginRight: 8 }}>
                      <Text style={{ fontSize: 10, fontWeight: "900", color: "#059669", letterSpacing: 0.5 }}>ACTIVE COUPON</Text>
                      <Text style={{ fontSize: 18, fontWeight: "900", color: "#065F46", marginTop: 4 }}>
                        🎟️ {appliedPromo.code}
                      </Text>
                      <Text style={{ fontSize: 12, color: "#047857", fontWeight: "700", marginTop: 2 }}>
                        {appliedPromo.desc}
                      </Text>
                    </View>
                    <TouchableOpacity 
                      style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: "#FEE2E2" }}
                      onPress={handleRemovePromo}
                    >
                      <Text style={{ color: "#DC2626", fontWeight: "800", fontSize: 12 }}>Remove</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              <View style={[styles.settingsSection, { backgroundColor: themeCard, borderColor: themeBorder }]}>
                <Text style={[styles.settingsSectionTitle, { color: themeText }]}>Enter Coupon Code</Text>
                <View style={{ flexDirection: "row", gap: 10 }}>
                  <TextInput
                    style={[styles.settingsInput, { flex: 1, backgroundColor: isDarkMode ? "#0F172A" : "#F8FAFC", color: themeText, borderColor: themeBorder }]}
                    value={promoInput}
                    onChangeText={setPromoInput}
                    placeholder="Enter code (e.g. WELCOME50)"
                    placeholderTextColor="#94A3B8"
                    autoCapitalize="characters"
                  />
                  <TouchableOpacity 
                    style={{ backgroundColor: "#2563EB", paddingHorizontal: 16, borderRadius: 14, justifyContent: "center" }}
                    onPress={() => handleApplyPromo(promoInput)}
                  >
                    <Text style={{ color: "#FFFFFF", fontWeight: "900" }}>Apply</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <Text style={[styles.settingsSectionTitle, { color: themeText, marginTop: 10, marginBottom: 12 }]}>Available coupons</Text>
              
              <View style={[styles.couponOptionBox, { backgroundColor: themeCard, borderColor: themeBorder }]}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.couponOptionTitle, { color: themeText }]}>WELCOME50</Text>
                  <Text style={styles.couponOptionDesc}>Get 50% discount on your next ride request</Text>
                </View>
                <TouchableOpacity 
                  style={styles.couponApplyBtn}
                  onPress={() => handleApplyPromo("WELCOME50")}
                >
                  <Text style={styles.couponApplyBtnText}>Apply</Text>
                </TouchableOpacity>
              </View>

              <View style={[styles.couponOptionBox, { backgroundColor: themeCard, borderColor: themeBorder }]}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.couponOptionTitle, { color: themeText }]}>SAVEMORE</Text>
                  <Text style={styles.couponOptionDesc}>Save flat ₹30 off on any bike/auto/car booking</Text>
                </View>
                <TouchableOpacity 
                  style={styles.couponApplyBtn}
                  onPress={() => handleApplyPromo("SAVEMORE")}
                >
                  <Text style={styles.couponApplyBtnText}>Apply</Text>
                </TouchableOpacity>
              </View>

              <View style={[styles.couponOptionBox, { backgroundColor: themeCard, borderColor: themeBorder }]}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.couponOptionTitle, { color: themeText }]}>RIDEXFREE</Text>
                  <Text style={styles.couponOptionDesc}>Test coupon: 100% discount on standard class ride</Text>
                </View>
                <TouchableOpacity 
                  style={styles.couponApplyBtn}
                  onPress={() => handleApplyPromo("RIDEXFREE")}
                >
                  <Text style={styles.couponApplyBtnText}>Apply</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : accountSubView === "payment" ? (
            // PAYMENT METHODS SUBVIEW
            <View style={styles.settingsWrapper}>
              <View style={styles.settingsHeader}>
                <TouchableOpacity 
                  onPress={() => setAccountSubView("menu")}
                  style={styles.settingsBackBtn}
                  activeOpacity={0.7}
                >
                  <Ionicons name="arrow-back" size={22} color={themeText} />
                </TouchableOpacity>
                <Text style={[styles.settingsHeaderTitle, { color: themeText }]}>Payment Methods</Text>
              </View>

              <View style={[styles.settingsSection, { backgroundColor: themeCard, borderColor: themeBorder }]}>
                <Text style={[styles.settingsSectionTitle, { color: themeText }]}>Active Default Payment</Text>
                <View style={[styles.activePaymentCard, { borderColor: "#2563EB", backgroundColor: isDarkMode ? "rgba(37, 99, 235, 0.08)" : "#F0F6FF" }]}>
                  <Text style={{ fontSize: 16, fontWeight: "900", color: "#2563EB" }}>
                    {defaultPayment}
                  </Text>
                </View>
              </View>

              <View style={[styles.settingsSection, { backgroundColor: themeCard, borderColor: themeBorder }]}>
                <Text style={[styles.settingsSectionTitle, { color: themeText }]}>Select Payment Option</Text>
                
                <TouchableOpacity 
                  style={[styles.paymentSelectRow, defaultPayment === "💵 Cash" && styles.paymentSelectRowActive, { borderBottomColor: themeBorder }]}
                  onPress={() => handleSelectDefaultPayment("💵 Cash")}
                >
                  <Text style={{ fontSize: 18 }}>💵</Text>
                  <Text style={[styles.paymentSelectLabel, { color: themeText }]}>Cash Payment</Text>
                  {defaultPayment === "💵 Cash" && <Ionicons name="checkmark-circle" size={18} color="#2563EB" />}
                </TouchableOpacity>

                <TouchableOpacity 
                  style={[styles.paymentSelectRow, defaultPayment === "📱 UPI / GPay" && styles.paymentSelectRowActive, { borderBottomColor: themeBorder }]}
                  onPress={() => handleSelectDefaultPayment("📱 UPI / GPay")}
                >
                  <Text style={{ fontSize: 18 }}>📱</Text>
                  <Text style={[styles.paymentSelectLabel, { color: themeText }]}>UPI (Google Pay / PhonePe)</Text>
                  {defaultPayment === "📱 UPI / GPay" && <Ionicons name="checkmark-circle" size={18} color="#2563EB" />}
                </TouchableOpacity>

                {savedCards.map((card) => {
                  const cardLabel = `💳 Visa (•••• ${card.number.slice(-4)})`;
                  return (
                    <TouchableOpacity 
                      key={card.id}
                      style={[styles.paymentSelectRow, defaultPayment === cardLabel && styles.paymentSelectRowActive, { borderBottomColor: themeBorder }]}
                      onPress={() => handleSelectDefaultPayment(cardLabel)}
                    >
                      <Text style={{ fontSize: 18 }}>💳</Text>
                      <Text style={[styles.paymentSelectLabel, { color: themeText }]}>Visa (•••• {card.number.slice(-4)})</Text>
                      {defaultPayment === cardLabel && <Ionicons name="checkmark-circle" size={18} color="#2563EB" />}
                    </TouchableOpacity>
                  );
                })}
              </View>

              <View style={[styles.settingsSection, { backgroundColor: themeCard, borderColor: themeBorder }]}>
                <Text style={[styles.settingsSectionTitle, { color: themeText }]}>Add Credit/Debit Card</Text>
                
                <View style={styles.settingsField}>
                  <Text style={styles.settingsLabel}>Card Number</Text>
                  <TextInput
                    style={[styles.settingsInput, { backgroundColor: isDarkMode ? "#0F172A" : "#F8FAFC", color: themeText, borderColor: themeBorder }]}
                    value={cardNumber}
                    onChangeText={setCardNumber}
                    placeholder="4111 2222 3333 4444"
                    placeholderTextColor="#94A3B8"
                    keyboardType="number-pad"
                    maxLength={19}
                  />
                </View>

                <View style={{ flexDirection: "row", gap: 12 }}>
                  <View style={[styles.settingsField, { flex: 1 }]}>
                    <Text style={styles.settingsLabel}>Expiry Date</Text>
                    <TextInput
                      style={[styles.settingsInput, { backgroundColor: isDarkMode ? "#0F172A" : "#F8FAFC", color: themeText, borderColor: themeBorder }]}
                      value={cardExpiry}
                      onChangeText={setEditHome /* wait, expiration setter cardExpiry */}
                      onChangeText={setCardExpiry}
                      placeholder="MM/YY"
                      placeholderTextColor="#94A3B8"
                      maxLength={5}
                    />
                  </View>
                  <View style={[styles.settingsField, { flex: 1 }]}>
                    <Text style={styles.settingsLabel}>CVV</Text>
                    <TextInput
                      style={[styles.settingsInput, { backgroundColor: isDarkMode ? "#0F172A" : "#F8FAFC", color: themeText, borderColor: themeBorder }]}
                      value={cardCvv}
                      onChangeText={setCardCvv}
                      placeholder="123"
                      placeholderTextColor="#94A3B8"
                      keyboardType="number-pad"
                      maxLength={3}
                      secureTextEntry
                    />
                  </View>
                </View>

                <TouchableOpacity 
                  style={[styles.saveSettingsButton, { marginTop: 10, marginBottom: 5 }]}
                  onPress={handleAddCard}
                >
                  <Text style={styles.saveSettingsText}>Add Card</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            // HELP & SAFETY SUPPORT SUBVIEW
            <View style={styles.settingsWrapper}>
              <View style={styles.settingsHeader}>
                <TouchableOpacity 
                  onPress={() => setAccountSubView("menu")}
                  style={styles.settingsBackBtn}
                  activeOpacity={0.7}
                >
                  <Ionicons name="arrow-back" size={22} color={themeText} />
                </TouchableOpacity>
                <Text style={[styles.settingsHeaderTitle, { color: themeText }]}>Help & Safety Support</Text>
              </View>

              <View style={[styles.settingsSection, { backgroundColor: "#FEF2F2", borderColor: "#FCA5A5" }]}>
                <Text style={{ fontSize: 14, fontWeight: "900", color: "#991B1B", marginBottom: 6 }}>🚨 EMERGENCY SOS HELP</Text>
                <Text style={{ fontSize: 12, color: "#7F1D1D", fontWeight: "600", lineHeight: 16, marginBottom: 16 }}>
                  If you are in danger or have an accident, use these rapid tools.
                </Text>

                <TouchableOpacity 
                  style={{ backgroundColor: "#DC2626", borderRadius: 14, paddingVertical: 14, alignItems: "center", justifyContent: "center", marginBottom: 12 }}
                  onPress={() => {
                    Alert.alert(
                      "Call Emergency Services",
                      "This will open your native call dialer populated with the emergency service number 112. Do you want to proceed?",
                      [
                        { text: "Cancel", style: "cancel" },
                        { text: "Call 112", onPress: () => Linking.openURL("tel:112") }
                      ]
                    );
                  }}
                >
                  <Text style={{ color: "#FFFFFF", fontWeight: "900" }}>📞 Call Police / Ambulance (112)</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={{ backgroundColor: "#991B1B", borderRadius: 14, paddingVertical: 14, alignItems: "center", justifyContent: "center" }}
                  onPress={() => {
                    if (!editEmergency) {
                      Alert.alert("No Saved Emergency Contact", "Please add an Emergency Contact inside your Profile Settings tab first.");
                      return;
                    }
                    Alert.alert(
                      "SOS Broadcast Sent 🚨",
                      `A live GPS tracking link message was broadcasted to your emergency contact: ${editEmergency}. Help is on the way!`
                    );
                  }}
                >
                  <Text style={{ color: "#FFFFFF", fontWeight: "900" }}>🛰️ Broadcast SOS GPS Alert</Text>
                </TouchableOpacity>
              </View>

              <View style={[styles.settingsSection, { backgroundColor: themeCard, borderColor: themeBorder }]}>
                <Text style={[styles.settingsSectionTitle, { color: themeText }]}>Help Center Topics</Text>
                
                <TouchableOpacity 
                  style={[styles.helpTopicRow, { borderBottomColor: themeBorder }]}
                  onPress={() => Alert.alert("Support Ticket Created 🎫", "Support has been notified. A representative will contact you via email shortly.")}
                >
                  <Text style={{ fontSize: 18 }}>📦</Text>
                  <Text style={[styles.helpTopicLabel, { color: themeText }]}>I lost an item in my RideX vehicle</Text>
                  <Text style={styles.accountMenuArrow}>→</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={[styles.helpTopicRow, { borderBottomColor: themeBorder }]}
                  onPress={() => Alert.alert("Billing Support", "Opening invoice list...")}
                >
                  <Text style={{ fontSize: 18 }}>💳</Text>
                  <Text style={[styles.helpTopicLabel, { color: themeText }]}>Billing, receipts, & promo questions</Text>
                  <Text style={styles.accountMenuArrow}>→</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={[styles.helpTopicRow, { borderBottomColor: themeBorder }]}
                  onPress={() => Alert.alert("Safety Guidelines", "Always verify vehicle plate number, driver photo, and OTP match before starting.")}
                >
                  <Text style={{ fontSize: 18 }}>🛡️</Text>
                  <Text style={[styles.helpTopicLabel, { color: themeText }]}>RideX Safety Standards & guidelines</Text>
                  <Text style={styles.accountMenuArrow}>→</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </ScrollView>
      )}

      {/* Uber-Style Bottom Navigation Tab Bar */}
      <View style={[styles.tabBar, { backgroundColor: themeCard, borderTopColor: themeBorder, borderTopWidth: 1.5 }]}>
        <TouchableOpacity
          style={[styles.tabItem, activeTab === "home" && styles.tabItemActive]}
          onPress={() => setActiveTab("home")}
          activeOpacity={0.8}
        >
          <Text style={styles.tabIcon}>{activeTab === "home" ? "🏠" : "🏠"}</Text>
          <Text style={[styles.tabLabel, activeTab === "home" && styles.tabLabelActive, { color: activeTab === "home" ? "#2563EB" : themeTextMuted }]}>Home</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabItem, activeTab === "services" && styles.tabItemActive]}
          onPress={() => setActiveTab("services")}
          activeOpacity={0.8}
        >
          <Text style={styles.tabIcon}>{activeTab === "services" ? "🛠️" : "🛠️"}</Text>
          <Text style={[styles.tabLabel, activeTab === "services" && styles.tabLabelActive, { color: activeTab === "services" ? "#2563EB" : themeTextMuted }]}>Services</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabItem, activeTab === "activity" && styles.tabItemActive]}
          onPress={() => setActiveTab("activity")}
          activeOpacity={0.8}
        >
          <Text style={styles.tabIcon}>{activeTab === "activity" ? "📋" : "📋"}</Text>
          <Text style={[styles.tabLabel, activeTab === "activity" && styles.tabLabelActive, { color: activeTab === "activity" ? "#2563EB" : themeTextMuted }]}>Activity</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabItem, activeTab === "account" && styles.tabItemActive]}
          onPress={() => setActiveTab("account")}
          activeOpacity={0.8}
        >
          <Text style={styles.tabIcon}>{activeTab === "account" ? "👤" : "👤"}</Text>
          <Text style={[styles.tabLabel, activeTab === "account" && styles.tabLabelActive, { color: activeTab === "account" ? "#2563EB" : themeTextMuted }]}>Account</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  loaderContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#070A13", // Deep space premium black background
  },
  loaderGlow: {
    position: "absolute",
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: "rgba(37, 99, 235, 0.12)", // Soft blue radial glow
    shadowColor: "#2563EB",
    shadowRadius: 120,
    shadowOpacity: 0.7,
    elevation: 10,
  },
  loaderLogoWrapper: {
    alignItems: "center",
    justifyContent: "center",
  },
  loaderLogoImage: {
    width: 140,
    height: 140,
    tintColor: "#FFFFFF", // Premium clean white logo image symbol
    marginBottom: 20,
  },
  loaderTextContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  loaderRideText: {
    fontSize: 42,
    fontWeight: "900",
    color: "#FFFFFF",
    letterSpacing: -1,
  },
  loaderXText: {
    fontSize: 52,
    fontWeight: "900",
    color: "#2563EB", // Brand Blue accent
    marginLeft: 2,
    textShadowColor: "rgba(37, 99, 235, 0.6)",
    textShadowOffset: { width: 0, height: 4 },
    textShadowRadius: 15,
  },
  loaderSubtext: {
    fontSize: 10.5,
    fontWeight: "900",
    color: "#64748B",
    letterSpacing: 4.5,
    textTransform: "uppercase",
    marginTop: 24,
    textAlign: "center",
  },
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  floatingHeader: {
    position: "absolute",
    top: 50,
    left: 16,
    right: 16,
    zIndex: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.92)",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(15, 23, 42, 0.06)",
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  brandBadge: {
    flexDirection: "row",
    alignItems: "center",
  },
  brandName: {
    fontSize: 22,
    fontWeight: "900",
    color: "#0F172A",
    letterSpacing: -0.6,
  },
  liveIndicatorDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#94A3B8", // Default gray offline, overridden inline
    marginLeft: 5,
    marginTop: 4,
  },
  profileSection: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  avatarCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#0F172A",
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "800",
  },
  signOutButton: {
    backgroundColor: "#F3F4F6",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  signOutText: {
    color: "#475569",
    fontSize: 11,
    fontWeight: "800",
  },
  mapContainer: {
    height: screenHeight * 0.38,
    width: "100%",
  },
  map: {
    flex: 1,
  },
  mapPlaceholder: {
    flex: 1,
    backgroundColor: "#F1F5F9",
    justifyContent: "center",
    alignItems: "center",
  },
  bottomSheet: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    marginTop: -20, // Overlap the map section
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: -6 },
    elevation: 8,
  },
  sheetContent: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 90, // Avoid bottom navigation bar overlap
  },
  dragHandle: {
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: "#E2E8F0",
    alignSelf: "center",
    marginBottom: 18,
    marginTop: 8,
  },
  greetingHeader: {
    marginBottom: 14,
  },
  greetingText: {
    fontSize: 22,
    fontWeight: "800",
    color: "#64748B",
    letterSpacing: -0.5,
  },
  userNameText: {
    fontSize: 34,
    fontWeight: "900",
    color: "#0F172A",
    letterSpacing: -0.8,
    marginTop: 2,
  },
  searchPill: {
    backgroundColor: "#F3F4F6", // Uber-style input background grey
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  searchPillLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  searchIcon: {
    fontSize: 18,
    color: "#111827",
  },
  searchPlaceholder: {
    fontSize: 16,
    color: "#475569",
    fontWeight: "800",
  },
  timePill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 99,
    gap: 4,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    shadowColor: "#000",
    shadowOpacity: 0.02,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
  },
  timePillIcon: {
    fontSize: 12.5,
  },
  timePillText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#0F172A",
  },
  timePillArrow: {
    fontSize: 10,
    color: "#64748B",
    marginLeft: 2,
  },
  quickLocationsRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 26,
  },
  locationCapsule: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F3F4F6",
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 99,
    gap: 6,
  },
  capsuleIcon: {
    fontSize: 14,
  },
  capsuleText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#334155",
  },
  activeRideCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 16,
    borderWidth: 1.5,
    borderColor: "#2563EB",
    shadowColor: "#2563EB",
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
    marginBottom: 24,
  },
  activeRideHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  activeRideBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(37, 99, 235, 0.08)",
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 99,
    gap: 6,
  },
  activeRidePulse: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#2563EB",
  },
  activeRideBadgeText: {
    fontSize: 10,
    fontWeight: "900",
    color: "#2563EB",
    letterSpacing: 0.6,
  },
  activeRideOtp: {
    fontSize: 13,
    fontWeight: "800",
    color: "#0F172A",
    backgroundColor: "#F3F4F6",
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  activeRideTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#0F172A",
    marginBottom: 4,
  },
  activeRideRoute: {
    fontSize: 13,
    color: "#64748B",
    marginBottom: 10,
  },
  activeRideLink: {
    fontSize: 12,
    fontWeight: "800",
    color: "#2563EB",
  },
  gridSection: {
    marginBottom: 26,
  },
  sectionHeaderTitle: {
    fontSize: 12,
    fontWeight: "900",
    color: "#94A3B8",
    letterSpacing: 1.5,
    textTransform: "uppercase",
    marginBottom: 12,
  },
  gridRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 12,
  },
  tileCard: {
    flex: 1,
    borderRadius: 20,
    padding: 16,
    height: 120,
    position: "relative",
    overflow: "hidden",
  },
  tileHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  tileTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: "#0F172A",
  },
  popularBadge: {
    backgroundColor: "rgba(37, 99, 235, 0.12)",
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  popularBadgeText: {
    fontSize: 9,
    fontWeight: "900",
    color: "#2563EB",
    letterSpacing: 0.4,
  },
  tileDesc: {
    fontSize: 12,
    color: "#475569",
    marginTop: 4,
    fontWeight: "600",
  },
  tileEmoji: {
    fontSize: 52,
    position: "absolute",
    bottom: -6,
    right: 4,
    opacity: 0.95,
  },
  gridRowSecondary: {
    flexDirection: "row",
    gap: 12,
  },
  smallTileCard: {
    flex: 1,
    borderRadius: 18,
    padding: 12,
    height: 64,
  },
  smallTileBody: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    height: "100%",
  },
  smallTileEmoji: {
    fontSize: 26,
  },
  smallTileTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#0F172A",
  },
  smallTileDesc: {
    fontSize: 10.5,
    color: "#64748B",
    marginTop: 1,
    fontWeight: "600",
  },
  recentDestSection: {
    marginBottom: 26,
    marginTop: 8,
  },
  recentHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  recentTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0F172A",
    letterSpacing: -0.3,
  },
  seeAllText: {
    fontSize: 13,
    color: "#2563EB",
    fontWeight: "800",
  },
  emptyRecentCard: {
    backgroundColor: "#F9FAFB",
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  emptyRecentEmoji: {
    fontSize: 22,
    marginBottom: 4,
  },
  emptyRecentText: {
    fontSize: 13,
    color: "#64748B",
    fontWeight: "600",
  },
  recentRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  clockIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  clockIcon: {
    fontSize: 15,
  },
  recentBody: {
    flex: 1,
    marginRight: 10,
  },
  recentDestName: {
    fontSize: 15,
    fontWeight: "800",
    color: "#0F172A",
  },
  recentDestDetail: {
    fontSize: 12.5,
    color: "#64748B",
    marginTop: 2,
  },
  recentRowArrow: {
    fontSize: 24,
    color: "#94A3B8",
    fontWeight: "700",
  },
  promoSection: {
    marginBottom: 20,
  },
  promoContainer: {
    gap: 12,
    paddingRight: 20,
    marginTop: 12,
  },
  promoCard: {
    width: 260,
    borderRadius: 16,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  promoIconContainer: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  promoEmoji: {
    fontSize: 18,
  },
  promoTextGroup: {
    flex: 1,
  },
  promoTitleText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#0F172A",
  },
  promoDescText: {
    fontSize: 11,
    color: "#475569",
    marginTop: 2,
    lineHeight: 15,
  },
  footer: {
    alignItems: "center",
    marginTop: 10,
    marginBottom: 10,
  },
  footerText: {
    fontSize: 11,
    color: "#94A3B8",
    fontWeight: "700",
  },
  // Tabs Common Layout Styles
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
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: -6 },
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
    backgroundColor: "rgba(37, 99, 235, 0.08)",
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
    backgroundColor: "#F8FAFC",
    paddingTop: 70,
    paddingHorizontal: 20,
    paddingBottom: 90,
  },
  tabTitle: {
    fontSize: 28,
    fontWeight: "900",
    color: "#0F172A",
    marginBottom: 20,
  },
  tabSubtitle: {
    fontSize: 14,
    color: "#64748B",
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 16,
    marginTop: -16,
  },
  serviceItemBox: {
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(15, 23, 42, 0.06)",
    shadowColor: "#000",
    shadowOpacity: 0.03,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
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
    fontWeight: "600",
  },
  serviceGoButton: {
    backgroundColor: "#0F172A",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  serviceGoText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "800",
  },
  activityRowBox: {
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(15, 23, 42, 0.06)",
    shadowColor: "#000",
    shadowOpacity: 0.03,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  accountCard: {
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    padding: 16,
    marginBottom: 20,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(15, 23, 42, 0.06)",
    shadowColor: "#000",
    shadowOpacity: 0.03,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  accountAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "rgba(37, 99, 235, 0.08)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 16,
  },
  avatarEmojiText: {
    fontSize: 24,
    fontWeight: "900",
    color: "#2563EB",
  },
  accountInfo: {
    flex: 1,
  },
  accountName: {
    fontSize: 17,
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
    fontWeight: "700",
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
    borderColor: "rgba(15, 23, 42, 0.06)",
    shadowColor: "#000",
    shadowOpacity: 0.02,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1,
  },
  accountMenuText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0F172A",
  },
  accountMenuArrow: {
    fontSize: 16,
    color: "#94A3B8",
  },

  // --- DRIVER EXCLUSIVE UI STYLES ---
  driverToggleContainer: {
    position: "absolute",
    bottom: 24,
    left: 20,
    right: 20,
    alignItems: "center",
    zIndex: 100,
  },
  driverTogglePill: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 26,
    borderRadius: 99,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
    gap: 10,
  },
  driverToggleOffline: {
    backgroundColor: "#0F172A",
  },
  driverToggleOnline: {
    backgroundColor: "#10B981",
  },
  pulseCircle: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  driverToggleText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "900",
    letterSpacing: 0.8,
  },
  driverBottomSheet: {
    flex: 1,
    backgroundColor: "#F8FAFC",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    marginTop: -20,
    paddingHorizontal: 20,
    elevation: 4,
  },
  statsCardGrid: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 20,
    marginTop: 10,
  },
  statCard: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(15, 23, 42, 0.05)",
    shadowColor: "#000",
    shadowOpacity: 0.02,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  statEmoji: {
    fontSize: 20,
    marginBottom: 4,
  },
  statVal: {
    fontSize: 16,
    fontWeight: "900",
    color: "#0F172A",
  },
  statLabel: {
    fontSize: 11,
    color: "#64748B",
    marginTop: 2,
    fontWeight: "600",
  },
  offlineHelperCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: "rgba(15, 23, 42, 0.06)",
    shadowColor: "#000",
    shadowOpacity: 0.02,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    marginBottom: 24,
  },
  offlineHelperTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#0F172A",
    marginBottom: 6,
  },
  offlineHelperDesc: {
    fontSize: 13,
    color: "#64748B",
    lineHeight: 18,
  },
  onlineFeedSection: {
    marginBottom: 24,
  },
  searchingRequestCard: {
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 16,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  searchingRequestText: {
    fontSize: 13,
    color: "#64748B",
    fontWeight: "600",
  },
  requestCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 18,
    borderWidth: 1.5,
    borderColor: "#10B981",
    shadowColor: "#10B981",
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
    marginBottom: 12,
  },
  requestHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  requestBadge: {
    backgroundColor: "rgba(16, 185, 129, 0.08)",
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  requestBadgeText: {
    fontSize: 9,
    fontWeight: "900",
    color: "#10B981",
    letterSpacing: 0.5,
  },
  requestFare: {
    fontSize: 18,
    fontWeight: "900",
    color: "#0F172A",
  },
  requestAddress: {
    fontSize: 13,
    color: "#334155",
    fontWeight: "600",
  },
  requestActionRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 16,
  },
  declineButton: {
    flex: 1,
    backgroundColor: "#F1F5F9",
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
  },
  declineButtonText: {
    color: "#64748B",
    fontSize: 13,
    fontWeight: "800",
  },
  acceptButton: {
    flex: 2,
    backgroundColor: "#10B981",
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
  },
  acceptButtonText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "900",
  },
  driverSafetyInfoSection: {
    marginBottom: 30,
  },
  partnerInfoCard: {
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(15, 23, 42, 0.06)",
    gap: 12,
  },
  partnerInfoIcon: {
    fontSize: 22,
  },
  partnerInfoBody: {
    flex: 1,
  },
  partnerInfoTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#0F172A",
  },
  partnerInfoDesc: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 2,
    lineHeight: 16,
  },
  emptyActivityCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 20,
    alignItems: "center",
  },
  emptyActivityEmoji: {
    fontSize: 26,
    marginBottom: 6,
  },
  emptyActivityText: {
    fontSize: 13,
    color: "#64748B",
    fontWeight: "600",
  },
  activityIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  activityIcon: {
    fontSize: 18,
  },
  activityBody: {
    flex: 1,
    marginRight: 10,
  },
  activityDest: {
    fontSize: 14,
    fontWeight: "800",
    color: "#0F172A",
  },
  activityTime: {
    fontSize: 12,
    color: "#94A3B8",
    marginTop: 2,
    fontWeight: "600",
  },
  activityMetrics: {
    alignItems: "flex-end",
  },
  activityPrice: {
    fontSize: 14,
    fontWeight: "900",
    color: "#0F172A",
  },
  activityDist: {
    fontSize: 12,
    color: "#2563EB",
    fontWeight: "700",
    marginTop: 2,
  },
  passengerDetailBadge: {
    backgroundColor: "#F1F5F9",
    borderRadius: 12,
    padding: 10,
    marginTop: 10,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  passengerDetailText: {
    fontSize: 12.5,
    color: "#0F172A",
    fontWeight: "800",
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
    marginBottom: 16,
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
  searchingCard: {
    backgroundColor: "rgba(255,255,255,0.98)",
    borderRadius: 22,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(37, 99, 235, 0.08)",
    marginBottom: 14,
    alignItems: "center",
  },
  searchingTitle: {
    color: "#0F172A",
    fontWeight: "800",
    fontSize: 16,
    textAlign: "center",
  },
  searchingText: {
    color: "#64748B",
    marginTop: 4,
    fontSize: 13,
    lineHeight: 18,
    textAlign: "center",
  },
  arrivalCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: "rgba(37, 99, 235, 0.08)",
    marginBottom: 14,
  },
  arrivalTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#0F172A",
    marginBottom: 12,
  },
  driverProfileRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  driverAvatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },
  driverAvatarText: {
    fontSize: 22,
  },
  driverDetails: {
    flex: 1,
  },
  driverName: {
    fontSize: 15,
    fontWeight: "800",
    color: "#0F172A",
  },
  driverRating: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 2,
  },
  etaContainer: {
    alignItems: "flex-end",
  },
  etaValue: {
    fontSize: 16,
    fontWeight: "900",
    color: "#10B981",
  },
  etaLabel: {
    fontSize: 10,
    color: "#94A3B8",
    fontWeight: "700",
    textTransform: "uppercase",
  },
  otpRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    padding: 12,
    borderRadius: 14,
    marginTop: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  otpLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: "#64748B",
  },
  otpCode: {
    fontSize: 20,
    fontWeight: "900",
    color: "#2563EB",
    letterSpacing: 1,
  },
  cancelTripBtn: {
    backgroundColor: "#EF4444",
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
  },
  cancelTripBtnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  bookingFormContainer: {
    width: "100%",
  },
  fareHighlightSection: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 22,
    padding: 16,
    marginTop: 6,
  },
  fareDetailsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  fareHeading: {
    fontSize: 13,
    fontWeight: "800",
    color: "#64748B",
    textTransform: "uppercase",
  },
  fareMetaText: {
    fontSize: 12,
    color: "#94A3B8",
    fontWeight: "600",
    marginTop: 2,
  },
  fareValue: {
    fontSize: 24,
    fontWeight: "900",
    color: "#0F172A",
  },
  confirmBookingBtn: {
    backgroundColor: "#2563EB",
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  confirmBookingBtnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "900",
    letterSpacing: 0.8,
  },
  helperTipCard: {
    backgroundColor: "rgba(37, 99, 235, 0.05)",
    borderWidth: 1,
    borderColor: "rgba(37, 99, 235, 0.1)",
    borderRadius: 18,
    padding: 12,
    marginTop: 6,
  },
  helperTipText: {
    fontSize: 12,
    color: "#2563EB",
    lineHeight: 18,
    fontWeight: "600",
  },
  driverMarkerWrap: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: "#2563EB",
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  driverMarkerEmoji: {
    fontSize: 24,
  },
  statusSection: {
    width: "100%",
  },
  statusBanner: {
    backgroundColor: "rgba(37, 99, 235, 0.08)",
    borderRadius: 18,
    padding: 14,
    borderLeftWidth: 4,
    borderLeftColor: "#2563EB",
    marginBottom: 14,
  },
  statusBannerTitle: {
    color: "#0F172A",
    fontWeight: "800",
    fontSize: 14,
  },
  statusBannerText: {
    color: "#64748B",
    marginTop: 4,
    fontSize: 12.5,
    lineHeight: 16,
  },
  settingsWrapper: {
    padding: 4,
  },
  settingsHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 24,
    gap: 12,
  },
  settingsBackBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },
  settingsHeaderTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: "#0F172A",
  },
  settingsSection: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 16,
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    marginBottom: 20,
  },
  settingsSectionTitle: {
    fontSize: 14,
    fontWeight: "900",
    color: "#0F172A",
    marginBottom: 16,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  settingsField: {
    marginBottom: 14,
  },
  settingsLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: "#64748B",
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  settingsInput: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: "#0F172A",
    fontWeight: "700",
  },
  settingsPrivacyRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
    paddingTop: 14,
    marginTop: 6,
  },
  settingsPrivacyTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: "#0F172A",
  },
  settingsPrivacyDesc: {
    fontSize: 11,
    color: "#64748B",
    fontWeight: "600",
    marginTop: 2,
  },
  saveSettingsButton: {
    backgroundColor: "#2563EB",
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
    marginBottom: 40,
    shadowColor: "#2563EB",
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  saveSettingsText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  promoActiveCard: {
    borderWidth: 1.5,
    padding: 16,
    borderRadius: 16,
    marginBottom: 20,
  },
  couponOptionBox: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1.5,
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
  },
  couponOptionTitle: {
    fontSize: 15,
    fontWeight: "900",
  },
  couponOptionDesc: {
    fontSize: 11,
    color: "#64748B",
    marginTop: 4,
    fontWeight: "600",
  },
  couponApplyBtn: {
    backgroundColor: "#2563EB",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  couponApplyBtnText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "800",
  },
  activePaymentCard: {
    borderWidth: 1.5,
    borderRadius: 14,
    padding: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  paymentSelectRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    borderBottomWidth: 1,
    gap: 12,
  },
  paymentSelectRowActive: {
    backgroundColor: "rgba(37, 99, 235, 0.03)",
  },
  paymentSelectLabel: {
    flex: 1,
    fontSize: 13,
    fontWeight: "800",
  },
  helpTopicRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    borderBottomWidth: 1,
    gap: 12,
  },
  helpTopicLabel: {
    flex: 1,
    fontSize: 13,
    fontWeight: "800",
  },
});
