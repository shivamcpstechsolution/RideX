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

import MapView, {
  Marker,
} from "react-native-maps";

import * as Location from "expo-location";

import {
  onValue,
  ref,
  set
} from "firebase/database";

import { db } from "../firebaseConfig";

export default function DriverScreen() {

  const mapRef = useRef<any>(null);

  const [location, setLocation] =
    useState<any>(null);

  const [rideRequest, setRideRequest] =
    useState<any>(null);

  const [enteredOTP, setEnteredOTP] =
    useState("");

    const [lastRideId, setLastRideId] =
  useState("");

  useEffect(() => {

    startTracking();

    listenForRideRequests();

  }, []);

  // LIVE TRACKING
  const startTracking = async () => {

    const { status } =
      await Location.requestForegroundPermissionsAsync();

    if (status !== "granted") {
      return;
    }

    await Location.watchPositionAsync(

      {
        accuracy:
          Location.Accuracy.BestForNavigation,

        timeInterval: 2000,

        distanceInterval: 2,
      },

      async (loc) => {

        const coords = {

          latitude:
            loc.coords.latitude,

          longitude:
            loc.coords.longitude,
        };

        setLocation(coords);

        // SAVE DRIVER LOCATION
        await set(
          ref(db, "drivers/driver1"),
          coords
        );

        mapRef.current?.animateCamera({

          center: coords,

          zoom: 18,
        });
      }
    );
  };

  // LISTEN FOR RIDE REQUEST
  const listenForRideRequests = () => {

    const rideRef =
      ref(db, "rides/currentRide");

    onValue(rideRef, (snapshot) => {

      const data = snapshot.val();

      if (data) {

        setRideRequest(data);

if (
  data.status === "pending" &&
  data.createdAt !== lastRideId
) {

  setLastRideId(
    data.createdAt
  );

  Alert.alert(
    "🚖 New Ride Request",
    "Customer booked a ride!"
  );
}
      }
    });
  };

  // ACCEPT RIDE
  const acceptRide = async () => {

    await set(
      ref(db, "rides/currentRide/status"),
      "accepted"
    );

    Alert.alert(
      "Ride Accepted 🚖"
    );
  };

  // START RIDE WITH OTP VERIFY
 const startRide = async () => {

  if (
    enteredOTP ===
    String(rideRequest?.otp)
  ) {

   await set(
  ref(db, "rides/currentRide/status"),
  "started"
);

    Alert.alert(
      "OTP Verified ✅"
    );

  } else {

    Alert.alert(
      "Invalid OTP ❌"
    );
  }
};

  // COMPLETE RIDE
 const completeRide = async () => {

  if (!rideRequest) return;

  const rideId =
    Date.now().toString();

  await set(
    ref(
      db,
      `rides/history/${rideId}`
    ),
    {
      ...rideRequest,
      completedAt:
        Date.now(),
    }
  );

  await set(
    ref(db, "rides/currentRide/status"),
    "completed"
  );

  Alert.alert(
    "Ride Completed ✅"
  );
};

  // REJECT RIDE
  const rejectRide = async () => {

    await set(
      ref(db, "rides/currentRide/status"),
      "rejected"
    );

    Alert.alert(
      "Ride Rejected"
    );
  };

  return (

    <View style={styles.container}>

      <StatusBar
        barStyle="light-content"
      />

      {/* MAP */}
      <MapView

        ref={mapRef}

        style={styles.map}

        showsUserLocation={true}

        initialRegion={{

          latitude:
            location?.latitude || 28.6139,

          longitude:
            location?.longitude || 77.2090,

          latitudeDelta: 0.05,

          longitudeDelta: 0.05,
        }}
      >

        {location && (

          <Marker
            coordinate={location}
          >

            <Text style={{
              fontSize: 35,
            }}>
              🚗
            </Text>

          </Marker>

        )}

      </MapView>

      {/* TOP CARD */}
      <View style={styles.topCard}>

        <Text style={styles.title}>
          Driver Mode
        </Text>

        <Text style={styles.sub}>
          Live tracking active
        </Text>

      </View>

      {/* RIDE REQUEST */}
      {rideRequest && (

        <View style={styles.rideCard}>

          <Text style={styles.rideTitle}>
            🚖 Ride Request
          </Text>

          <Text style={styles.rideText}>
            Distance: {rideRequest?.distance} km
          </Text>

          <Text style={styles.rideText}>
            ETA: {rideRequest?.duration} mins
          </Text>

          <Text style={styles.rideText}>
            Status: {rideRequest?.status}
          </Text>

          <Text style={styles.rideText}>
            OTP: {rideRequest?.otp}
          </Text>
          {rideRequest?.status === "pending" && (

<View style={styles.btnRow}>

  <TouchableOpacity
    style={styles.acceptBtn}
    onPress={acceptRide}
  >
    <Text style={styles.btnText}>
      Accept
    </Text>
  </TouchableOpacity>

  <TouchableOpacity
    style={styles.rejectBtn}
    onPress={rejectRide}
  >
    <Text style={styles.btnText}>
      Reject
    </Text>
  </TouchableOpacity>

</View>
)}




          

          {/* OTP INPUT */}
         
{rideRequest?.status === "accepted" && (

<>

  <TextInput

    placeholder="Enter OTP"

    value={enteredOTP}

    onChangeText={setEnteredOTP}

    keyboardType="numeric"

    style={styles.otpInput}

  />

  <TouchableOpacity

    style={styles.startBtn}

    onPress={startRide}

  >

    <Text style={styles.btnText}>
      Verify OTP
    </Text>

  </TouchableOpacity>

</>

)}
{rideRequest?.status === "started" && (

<TouchableOpacity

  style={styles.completeBtn}

  onPress={completeRide}

>

  <Text style={styles.btnText}>
    Complete Ride
  </Text>

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
  },

  map: {
    flex: 1,
  },

  topCard: {

    position: "absolute",

    top: 60,

    left: 20,

    right: 20,

    backgroundColor: "#111827",

    borderRadius: 25,

    padding: 20,
  },

  title: {

    color: "white",

    fontSize: 28,

    fontWeight: "bold",
  },

  sub: {

    color: "#9CA3AF",

    marginTop: 5,

    fontSize: 15,
  },

  rideCard: {

    position: "absolute",

    bottom: 30,

    left: 20,

    right: 20,

    backgroundColor: "white",

    borderRadius: 25,

    padding: 20,

    elevation: 10,
  },

  rideTitle: {

    fontSize: 22,

    fontWeight: "bold",

    color: "#111827",
  },

  rideText: {

    marginTop: 10,

    fontSize: 16,

    color: "#6B7280",
  },

  btnRow: {

    flexDirection: "row",

    justifyContent: "space-between",

    marginTop: 20,
  },

  acceptBtn: {

    backgroundColor: "#22C55E",

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

  btnText: {

    color: "white",

    fontSize: 16,

    fontWeight: "bold",
  },

});