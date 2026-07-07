import { router } from "expo-router";
import { User } from "firebase/auth";
import { onValue, ref, update, set } from "firebase/database";
import { useEffect, useRef, useState } from "react";
import {
    ActivityIndicator,
    Dimensions,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import MapView, { Marker } from "react-native-maps";

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

export default function HomeScreen() {
  const mapRef = useRef<any>(null);


  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authResolved, setAuthResolved] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [activeRide, setActiveRide] = useState<any>(null);
  const [allTrips, setAllTrips] = useState<any[]>([]);
  const [mapRegion, setMapRegion] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<"home" | "services" | "activity" | "account">("home");
  const [userRole, setUserRole] = useState<"rider" | "driver" | null>(null);

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

  useEffect(() => {
    if (!currentUser) return;

    // Resolve Database Role
    getUserRole(currentUser.uid).then((role) => {
      setUserRole(role || "rider");
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

    return () => {
      unsubscribeCurrentRide();
      unsubscribeHistory();
    };
  }, [currentUser]);

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
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color="#0F172A" />
        <Text style={styles.loaderText}>
          {signingOut ? "Signing out..." : "Initializing RideX..."}
        </Text>
      </View>
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
  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />

      {/* HOME TAB VIEW */}
      {activeTab === "home" && (
        <>
          {/* Floating Header Overlay */}
          <View style={styles.floatingHeader}>
            <View style={styles.brandBadge}>
              <Text style={styles.brandName}>RideX</Text>
              <View style={styles.liveIndicatorDot} />
            </View>

            <View style={styles.profileSection}>
              <View style={styles.avatarCircle}>
                <Text style={styles.avatarText}>
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
            style={styles.bottomSheet} 
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.sheetContent}
          >
            {/* Grab Handle Indicator */}
            <View style={styles.dragHandle} />

            {/* User Greeting */}
            <View style={styles.greetingHeader}>
              <Text style={styles.greetingText}>{getGreetingText()},</Text>
              <Text style={styles.userNameText}>{getFirstName(currentUser?.displayName)}</Text>
            </View>

            {/* Uber-Style Search Input Pill */}
            <TouchableOpacity 
              style={styles.searchPill} 
              onPress={() => router.push("/customer")}
              activeOpacity={0.9}
            >
              <View style={styles.searchPillLeft}>
                <Text style={styles.searchIcon}>🔍</Text>
                <Text style={styles.searchPlaceholder}>Where to?</Text>
              </View>
              <View style={styles.timePill}>
                <Text style={styles.timePillIcon}>🕒</Text>
                <Text style={styles.timePillText}>Now</Text>
                <Text style={styles.timePillArrow}>▼</Text>
              </View>
            </TouchableOpacity>

            {/* Location Shortcuts capsule Tags */}
            <View style={styles.quickLocationsRow}>
              <TouchableOpacity style={styles.locationCapsule} onPress={() => router.push("/customer")} activeOpacity={0.8}>
                <Text style={styles.capsuleIcon}>🏠</Text>
                <Text style={styles.capsuleText}>Home</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.locationCapsule} onPress={() => router.push("/customer")} activeOpacity={0.8}>
                <Text style={styles.capsuleIcon}>🏢</Text>
                <Text style={styles.capsuleText}>Work</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.locationCapsule} onPress={() => router.push("/customer")} activeOpacity={0.8}>
                <Text style={styles.capsuleIcon}>➕</Text>
                <Text style={styles.capsuleText}>Saved</Text>
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
                  onPress={() => router.push("/customer")}
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
        <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
          <Text style={styles.tabTitle}>Services</Text>
          
          <View style={styles.serviceItemBox}>
            <Text style={styles.serviceIcon}>🚖</Text>
            <View style={styles.serviceInfo}>
              <Text style={styles.serviceName}>RideX Go</Text>
              <Text style={styles.serviceDesc}>Affordable everyday rides across city limits</Text>
            </View>
            <TouchableOpacity style={styles.serviceGoButton} onPress={() => router.push("/customer")}>
              <Text style={styles.serviceGoText}>Go</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.serviceItemBox}>
            <Text style={styles.serviceIcon}>⭐</Text>
            <View style={styles.serviceInfo}>
              <Text style={styles.serviceName}>RideX Premium</Text>
              <Text style={styles.serviceDesc}>Elite comfort rides with top-rated drivers</Text>
            </View>
            <TouchableOpacity style={styles.serviceGoButton} onPress={() => router.push("/customer")}>
              <Text style={styles.serviceGoText}>Go</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.serviceItemBox}>
            <Text style={styles.serviceIcon}>📦</Text>
            <View style={styles.serviceInfo}>
              <Text style={styles.serviceName}>Intercity Delivery</Text>
              <Text style={styles.serviceDesc}>Send parcels or documents securely</Text>
            </View>
            <TouchableOpacity style={styles.serviceGoButton} onPress={() => router.push("/customer")}>
              <Text style={styles.serviceGoText}>Go</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.serviceItemBox}>
            <Text style={styles.serviceIcon}>📅</Text>
            <View style={styles.serviceInfo}>
              <Text style={styles.serviceName}>Reserved Booking</Text>
              <Text style={styles.serviceDesc}>Schedule trips up to 30 days in advance</Text>
            </View>
            <TouchableOpacity style={styles.serviceGoButton} onPress={() => router.push("/customer")}>
              <Text style={styles.serviceGoText}>Go</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}

      {/* ACTIVITY TAB VIEW */}
      {activeTab === "activity" && (
        <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
          <Text style={styles.tabTitle}>Activity</Text>
          <Text style={styles.tabSubtitle}>Past Completed Trips</Text>

          {allTrips.length === 0 ? (
            <View style={styles.emptyActivityCard}>
              <Text style={styles.emptyActivityEmoji}>🧾</Text>
              <Text style={styles.emptyActivityText}>No completed trips on record yet.</Text>
            </View>
          ) : (
            allTrips.map((trip) => (
              <View key={trip.id} style={styles.activityRowBox}>
                <View style={styles.activityIconWrap}>
                  <Text style={styles.activityIcon}>🚕</Text>
                </View>
                <View style={styles.activityBody}>
                  <Text style={styles.activityDest} numberOfLines={1}>
                    {trip.destinationAddress ? trip.destinationAddress.split(",")[0] : "Trip " + String(trip.id).slice(-4)}
                  </Text>
                  <Text style={styles.activityTime}>
                    {trip.completedAt ? new Date(trip.completedAt).toLocaleString() : "Recent Completed"}
                  </Text>
                </View>
                <View style={styles.activityMetrics}>
                  <Text style={styles.activityPrice}>₹{trip.fare || 0}</Text>
                  <Text style={styles.activityDist}>{trip.distance} km</Text>
                </View>
              </View>
            ))
          )}
        </ScrollView>
      )}

      {/* ACCOUNT TAB VIEW */}
      {activeTab === "account" && (
        <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
          <Text style={styles.tabTitle}>Account</Text>

          <View style={styles.accountCard}>
            <View style={styles.accountAvatar}>
              <Text style={styles.avatarEmojiText}>
                {(currentUser?.displayName || currentUser?.email || "U")[0].toUpperCase()}
              </Text>
            </View>
            <View style={styles.accountInfo}>
              <Text style={styles.accountName}>{currentUser?.displayName || "RideX Explorer"}</Text>
              <Text style={styles.accountEmail}>{currentUser?.email || "No email"}</Text>
              <Text style={styles.accountPhone}>Authenticated Safely</Text>
            </View>
          </View>

          <TouchableOpacity style={styles.accountMenuItem} activeOpacity={0.7}>
            <Text style={styles.accountMenuText}>⚙️ Settings</Text>
            <Text style={styles.accountMenuArrow}>→</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.accountMenuItem} activeOpacity={0.7}>
            <Text style={styles.accountMenuText}>🎫 Promo Codes</Text>
            <Text style={styles.accountMenuArrow}>→</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.accountMenuItem} activeOpacity={0.7}>
            <Text style={styles.accountMenuText}>💳 Payment Methods</Text>
            <Text style={styles.accountMenuArrow}>→</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.accountMenuItem} activeOpacity={0.7}>
            <Text style={styles.accountMenuText}>🛡️ Help & Safety Support</Text>
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
        </ScrollView>
      )}

      {/* Uber-Style Bottom Navigation Tab Bar */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tabItem, activeTab === "home" && styles.tabItemActive]}
          onPress={() => setActiveTab("home")}
          activeOpacity={0.8}
        >
          <Text style={styles.tabIcon}>{activeTab === "home" ? "🏠" : "🏠"}</Text>
          <Text style={[styles.tabLabel, activeTab === "home" && styles.tabLabelActive]}>Home</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabItem, activeTab === "services" && styles.tabItemActive]}
          onPress={() => setActiveTab("services")}
          activeOpacity={0.8}
        >
          <Text style={styles.tabIcon}>{activeTab === "services" ? "🛠️" : "🛠️"}</Text>
          <Text style={[styles.tabLabel, activeTab === "services" && styles.tabLabelActive]}>Services</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabItem, activeTab === "activity" && styles.tabItemActive]}
          onPress={() => setActiveTab("activity")}
          activeOpacity={0.8}
        >
          <Text style={styles.tabIcon}>{activeTab === "activity" ? "📋" : "📋"}</Text>
          <Text style={[styles.tabLabel, activeTab === "activity" && styles.tabLabelActive]}>Activity</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabItem, activeTab === "account" && styles.tabItemActive]}
          onPress={() => setActiveTab("account")}
          activeOpacity={0.8}
        >
          <Text style={styles.tabIcon}>{activeTab === "account" ? "👤" : "👤"}</Text>
          <Text style={[styles.tabLabel, activeTab === "account" && styles.tabLabelActive]}>Account</Text>
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
    backgroundColor: "#FFFFFF",
  },
  loaderText: {
    marginTop: 12,
    fontSize: 15,
    color: "#64748B",
    fontWeight: "600",
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
});
