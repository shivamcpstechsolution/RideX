import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  Alert,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import MapView, {
  Marker,
} from "react-native-maps";

import MapViewDirections from "react-native-maps-directions";

import {
  GooglePlacesAutocomplete,
} from "react-native-google-places-autocomplete";

import {
  onValue,
  ref,
  set,
} from "firebase/database";

import {
  getDistance,
} from "geolib";

import { db } from "../firebaseConfig";

import * as Location from "expo-location";

const GOOGLE_MAPS_APIKEY =
  "AIzaSyByV5E8B_TD71Hb4d1HN6s-T6GiYCrTZtM";

export default function CustomerScreen() {

  const mapRef = useRef<any>(null);

  const pickupRef = useRef<any>(null);

  const [source, setSource] =
    useState<any>(null);

  const [destination, setDestination] =
    useState<any>(null);
  
  const [fare, setFare] =
  useState(0);

  const [drivers, setDrivers] =
    useState<any>([]);

  const [selectedDriver, setSelectedDriver] =
    useState<any>(null);

  const [distance, setDistance] =
    useState<any>(null);

  const [duration, setDuration] =
    useState<any>(null);


    const [pickupAddress, setPickupAddress] =
  useState("");

const [destinationAddress, setDestinationAddress] =
  useState("");
  const [rideStatus, setRideStatus] =
    useState<any>(null);

  const [searchingDriver, setSearchingDriver] =
  useState(false);

  const [driverETA, setDriverETA] =
  useState<number | null>(null);
  const [showArrivalCard, setShowArrivalCard] =
  useState(false);

  const [rideOTP, setRideOTP] =
  useState("");

  useEffect(() => {

    getCurrentLocation();

    listenForRideUpdates();

  }, []);

  useEffect(() => {

    if (source) {

      getNearbyDrivers();
    }

  }, [source]);
  const [showMenu, setShowMenu] =
  useState(false);

  // CURRENT LOCATION
  const getCurrentLocation = async () => {

    const { status } =
      await Location.requestForegroundPermissionsAsync();

    if (status !== "granted") {
      return;
    }

    const location =
      await Location.getCurrentPositionAsync({});

    const currentCoords = {

      latitude:
        location.coords.latitude,

      longitude:
        location.coords.longitude,
    };

    setSource(currentCoords);

    pickupRef.current?.setAddressText(
      "📍 Current Location"
    );
  };

  // SMART DRIVER SYSTEM
  const getNearbyDrivers = () => {

    const driversRef =
      ref(db, "drivers");

    onValue(driversRef, (snapshot) => {

      const data = snapshot.val();

      if (data && source) {

        const nearbyDrivers =
          Object.keys(data)

            .map((key) => {

              const driver =
                data[key];

              const distance =
                getDistance(

                  {
                    latitude:
                      source.latitude,

                    longitude:
                      source.longitude,
                  },

                  {
                    latitude:
                      driver.latitude,

                    longitude:
                      driver.longitude,
                  }
                );

              return {

                id: key,

                ...driver,

                distance:
                  distance / 1000,
              };
            })

            .filter(
              (driver) =>
                driver.distance <= 10
            )

            .sort(
              (a, b) =>
                a.distance - b.distance
            );

        setDrivers(
          nearbyDrivers
        );

        // LIVE DRIVER UPDATE
        if (selectedDriver) {

          const updatedDriver =
            nearbyDrivers.find(
              (d) =>
                d.id ===
                selectedDriver.id
            );

          if (updatedDriver) {

            setSelectedDriver(
              updatedDriver
            );

            mapRef.current?.animateCamera({

              center: {

                latitude:
                  updatedDriver.latitude,

                longitude:
                  updatedDriver.longitude,
              },

              zoom: 16,
            });
          }
        }
      }
    });
  };

  // BOOK RIDE
  const bookRide = async () => {

   if (distance && Number(distance) > 50) {

  Alert.alert(
    "Service Not Available",
    "Our service is currently available only within the city limits."
  );

  return;
}

    // NO DRIVER
    if (
      !drivers ||
      drivers.length === 0
    ) {

      Alert.alert(
        "No Driver Available 🚫",
        "No nearby drivers found"
      );

      return;
    }

    // OTP
 const generatedOTP =
  Math.floor(
    1000 + Math.random() * 9000
  );

Alert.alert(
  "Searching Driver 🚖",
  `Your OTP is ${generatedOTP}`
);

    // NEAREST DRIVER
    const nearestDriver =
      drivers[0];

    if (!nearestDriver) {

      Alert.alert(
        "No Driver Available 🚫"
      );

      return;
    }

    // SET DRIVER
   setSelectedDriver(
  nearestDriver
);

setSearchingDriver(true);

// SAVE RIDE
await set(
  ref(db, "rides/currentRide"),
  {
  

        source,

        destination,

        pickupAddress,
destinationAddress,
  
        distance,

        duration,

        otp: generatedOTP,

        driverId:
          nearestDriver.id,

        driverDistance:
          nearestDriver.distance.toFixed(1),

        status: "pending",

        createdAt: Date.now(),
      }
    );

    Alert.alert(
      "Searching Driver 🚖",
      `Your OTP is ${rideOTP}`
    );
  };
  // LISTEN RIDE STATUS
const listenForRideUpdates = () => {

  const rideRef =
    ref(db, "rides/currentRide");

  onValue(rideRef, (snapshot) => {

    const data = snapshot.val();

   if (data) {

  setRideStatus(
    data.status
  );

  setSource(
    data.source
  );

  setDestination(
    data.destination
  );

  setRideOTP(
    String(data.otp)
  );
  setPickupAddress(
  data.pickupAddress || ""
);

setDestinationAddress(
  data.destinationAddress || ""
);

  if (
    data.driverId &&
    drivers.length > 0
  ) {

    const driver =
      drivers.find(
        (d) =>
          d.id ===
          data.driverId
      );

    if (driver) {

      setSelectedDriver(
        driver
      );

    }
  }

  // SEARCHING DRIVER
  if (
    data.status === "pending"
  ) {

    setSearchingDriver(
      true
    );

  }

  // ACCEPTED
  if (
    data.status === "accepted"
  ) {

    setSearchingDriver(
      false
    );

    setShowArrivalCard(
      true
    );

  }

  // REJECTED
  if (
    data.status === "rejected"
  ) {

    setSearchingDriver(
      false
    );

    Alert.alert(
      "Ride Rejected ❌",
      "Driver rejected your ride"
    );
  }

  // STARTED
  if (
    data.status === "started"
  ) {

    Alert.alert(
      "Ride Started 🚕"
    );
  }

  // COMPLETED
  if (
    data.status === "completed"
  ) {

    setShowArrivalCard(
      false
    );

    setSearchingDriver(
      false
    );

    Alert.alert(
      "Ride Completed ✅"
    );
  }

}
  });

};

  return (

    <View style={styles.container}>

      <StatusBar
        barStyle="dark-content"
      />
 <TouchableOpacity

  onPress={() =>
    router.push("/history")
  }

  style={{
    position: "absolute",
    top: 65,
    right: 20,
    zIndex: 999,
    backgroundColor: "#2563EB",
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 10,
  }}

>

  <Text
    style={{
      color: "white",
      fontWeight: "bold",
    }}
  >
    Ride History
  </Text>

</TouchableOpacity>

      {/* NO DRIVER */}
      {drivers.length === 0 && (

        <View style={styles.noDriverCard}>

          <Text style={styles.noDriverText}>
            🚫 No drivers nearby
          </Text>

        </View>

      )}

      {/* MAP */}
      <MapView

        ref={mapRef}

        style={styles.map}

        showsUserLocation={true}

        initialRegion={{

          latitude:
            source?.latitude || 28.6139,

          longitude:
            source?.longitude || 77.2090,

          latitudeDelta: 0.05,

          longitudeDelta: 0.05,
        }}
      >

        {/* USER */}
        {source && (

          <Marker
            coordinate={source}
            pinColor="#22C55E"
          />

        )}

        {/* DESTINATION */}
        {destination && (

          <Marker
            coordinate={destination}
            pinColor="#EF4444"
          />

        )}

        {/* LIVE DRIVER */}
        {selectedDriver && (

          <Marker

            coordinate={{

              latitude:
                selectedDriver.latitude,

              longitude:
                selectedDriver.longitude,
            }}

          >

            <View style={{
              alignItems: "center",
            }}>

              <Text style={{
                fontSize: 35,
              }}>
                🚖
              </Text>

            </View>

          </Marker>

        )}

        {/* DRIVER TO CUSTOMER ROUTE */}

      {rideStatus === "accepted" &&
 selectedDriver &&
 source && (

<MapViewDirections

            origin={{
              latitude:
                selectedDriver.latitude,

              longitude:
                selectedDriver.longitude,
            }}

            destination={{
              latitude:
                source.latitude,

              longitude:
                source.longitude,
            }}

            apikey={GOOGLE_MAPS_APIKEY}

            strokeWidth={5}

            strokeColor="#22C55E"
            onReady={(result) => {

    setDriverETA(
      Math.ceil(result.duration)
    );

  }}

          />

        )}

        {/* CUSTOMER TO DESTINATION */}

        {source && destination && (

          <MapViewDirections

            origin={source}

            destination={destination}

            apikey={GOOGLE_MAPS_APIKEY}

            strokeWidth={5}

            strokeColor="#2563EB"

            optimizeWaypoints={true}

            onReady={(result) => {

              setDistance(
                result.distance.toFixed(1)
              );const rideFare =
  50 +
  result.distance * 10;

setFare(
  Math.round(rideFare)
);

              
              setDuration(
                Math.ceil(result.duration)
              );
            }}

          />

        )}

      </MapView>

      {/* SEARCH */}
      {rideStatus !== "pending" &&
 rideStatus !== "accepted" &&
 rideStatus !== "started" && (
      <View style={styles.searchContainer}>



        <Text style={styles.heading}>
          RideX
        </Text>

        {/* PICKUP */}
        <GooglePlacesAutocomplete

          ref={pickupRef}

          placeholder="Pickup Location"

          fetchDetails={true}

          minLength={1}

onFail={(error) => {
  Alert.alert(
    "Places Error",
    JSON.stringify(error)
  );
}}

          debounce={300}

          enablePoweredByContainer={false}

          keyboardShouldPersistTaps="handled"

          listViewDisplayed="auto"

          predefinedPlaces={[
            {
              description:
                "📍 Use Current Location",

              geometry: {
                location: {
                  lat:
                    source?.latitude || 0,

                  lng:
                    source?.longitude || 0,
                },
              },
            },
          ]}

          textInputProps={{
            placeholderTextColor:
              "#6B7280",
          }}

          onPress={(
            data,
            details = null
          ) => {

            if (
              data.description ===
              "📍 Use Current Location"
            ) {

              getCurrentLocation();
              return;
            }

            const location =
              details?.geometry.location;

            setSource({

           
  latitude: location.lat,
  longitude: location.lng,
});

setPickupAddress(
  data.description
);
          }}

          query={{

  key:
    GOOGLE_MAPS_APIKEY,

  language: "en",
}}
          styles={{

            container: {
              flex: 0,
              marginBottom: 15,
            },

            textInput: {

              backgroundColor:
                "white",

              borderRadius: 18,

              height: 58,

              paddingHorizontal: 18,

              fontSize: 16,

              color: "#111827",

              fontWeight: "600",

              elevation: 3,
            },

            listView: {
              backgroundColor: "white",
              zIndex: 999,
              elevation: 999,
            },
          }}

        />

        {/* DESTINATION */}
        <GooglePlacesAutocomplete

          placeholder="Where to?"

          fetchDetails={true}

          minLength={2}

          debounce={300}

          enablePoweredByContainer={false}

          keyboardShouldPersistTaps="handled"

          listViewDisplayed="auto"

          textInputProps={{
            placeholderTextColor:
              "#6B7280",
          }}

          onPress={(
            data,
            details = null
          ) => {

            const location =
              details?.geometry.location;

            setDestination({
             
              latitude: location.lat,

              longitude: location.lng,
            });
            setDestinationAddress(
  data.description
);

            mapRef.current?.animateToRegion({

              latitude:
                location.lat,

              longitude:
                location.lng,

              latitudeDelta: 0.05,

              longitudeDelta: 0.05,
            });
          }}

          query={{

            key:
              GOOGLE_MAPS_APIKEY,

            language: "en",

            components:
              "country:in",
          }}

          styles={{

            container: {
              flex: 0,
            },

            textInput: {

              backgroundColor:
                "white",

              borderRadius: 18,

              height: 58,

              paddingHorizontal: 18,

              fontSize: 16,

              color: "#111827",

              fontWeight: "600",

              elevation: 3,
            },

            listView: {
              backgroundColor: "white",
              zIndex: 999,
              elevation: 999,
            },
          }}

        />

      
     

      </View>
      )}
      {rideOTP && (

  <View
    style={{
      position: "absolute",
      bottom: 130,
      left: 20,
      right: 20,
      backgroundColor: "#111827",
      padding: 15,
      borderRadius: 15,
      alignItems: "center",
    }}
  >

    <Text
      style={{
        color: "white",
      }}
    >
      Share OTP With Driver
    </Text>

    <Text
      style={{
        color: "#22C55E",
        fontSize: 30,
        fontWeight: "bold",
      }}
    >
      {rideOTP}
    </Text>
    <Text
  style={{
    fontSize: 18,
    fontWeight: "bold",
    color: "#22C55E",
  }}
>
  ₹{fare}
</Text>

  </View>
  

)}



      {/* RIDE CARD */}

      {showArrivalCard && (

<View
  style={{
    position: "absolute",
    bottom: 220,
    left: 20,
    right: 20,
    backgroundColor: "white",
    padding: 15,
    borderRadius: 15,
    elevation: 10,
  }}
>

  <Text
    style={{
      fontSize: 18,
      fontWeight: "bold",
    }}
  >
    🚖 Driver Arriving
  </Text>

  <Text>
    Your ride will start soon.
  </Text>

  <Text>
    Driver is on the way.
  </Text>

  {driverETA && (

    <Text>
      ETA: {driverETA} mins
    </Text>

  )}

</View>

)}
    {distance && (

  <View style={styles.bottomCard}>

    <View>

      <Text style={styles.distance}>
        {distance} km
      </Text>

      <Text style={styles.duration}>
        {duration} mins away
      </Text>

    </View>

    <TouchableOpacity

      style={styles.bookBtn}

      onPress={bookRide}

    >

      <Text style={styles.bookText}>
        Book Ride
      </Text>

    </TouchableOpacity>

  </View>

)}
      

      {/* OTP CONFIRM */}

      {rideStatus ===
        "otp_verified" && (

        <TouchableOpacity

          style={styles.confirmBtn}

          onPress={async () => {

            await set(
              ref(db, "rides/currentRide/status"),
              "started"
            );

            Alert.alert(
              "Ride Started 🚕"
            );
          }}

        >

          <Text style={styles.confirmText}>
            Confirm OTP & Start Ride
          </Text>

        </TouchableOpacity>

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

  searchContainer: {

    position: "absolute",

    top: 55,

    left: 20,

    right: 20,

    zIndex: 999,

    elevation: 999,
  },

  heading: {

    fontSize: 34,

    fontWeight: "bold",

    color: "#111827",

    marginBottom: 18,
  },

  noDriverCard: {

    position: "absolute",

    top: 130,

    alignSelf: "center",

    backgroundColor: "#111827",

    paddingHorizontal: 20,

    paddingVertical: 12,

    borderRadius: 20,

    zIndex: 999,
  },

  noDriverText: {

    color: "white",

    fontSize: 15,

    fontWeight: "600",
  },

  bottomCard: {

    position: "absolute",

    bottom: 25,

    left: 20,

    right: 20,

    backgroundColor: "white",

    borderRadius: 25,

    padding: 20,

    flexDirection: "row",

    justifyContent: "space-between",

    alignItems: "center",

    elevation: 10,
  },

  distance: {

    fontSize: 24,

    fontWeight: "bold",

    color: "#111827",
  },

  duration: {

    fontSize: 15,

    color: "#6B7280",

    marginTop: 5,
  },

  bookBtn: {

    backgroundColor: "#2563EB",

    paddingHorizontal: 24,

    paddingVertical: 14,

    borderRadius: 18,
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
  },

  confirmText: {

    color: "white",

    fontWeight: "bold",

    fontSize: 16,
  },
  

});


