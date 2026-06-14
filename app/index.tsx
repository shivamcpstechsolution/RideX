
import {
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { router } from "expo-router";

export default function HomeScreen() {

  return (

    <View style={styles.container}>

      <StatusBar
        barStyle="light-content"
      />

      {/* LOGO */}
      <View style={styles.topSection}>

        <Text style={styles.logo}>
          RideX
        </Text>

        <Text style={styles.subText}>
          Real-Time Ride Tracking
        </Text>

      </View>

      {/* ROLE CARDS */}
      <View style={styles.cardContainer}>

        {/* CUSTOMER */}
        <TouchableOpacity

          style={styles.card}

          onPress={() =>
            router.push("/customer")
          }

        >

          <Text style={styles.icon}>
            👤
          </Text>

          <Text style={styles.title}>
            Customer
          </Text>

          <Text style={styles.description}>
            Book rides and track drivers live
          </Text>

        </TouchableOpacity>

        {/* DRIVER */}
        <TouchableOpacity

          style={styles.card}

          onPress={() =>
            router.push("/driver")
          }

        >

          <Text style={styles.icon}>
            🚗
          </Text>

          <Text style={styles.title}>
            Driver
          </Text>

          <Text style={styles.description}>
            Share live location and accept rides
          </Text>

        </TouchableOpacity>

      </View>

    </View>
  );
}

const styles = StyleSheet.create({

  container: {
    flex: 1,
    backgroundColor: "#0F172A",
    justifyContent: "center",
    paddingHorizontal: 20,
  },

  topSection: {
    alignItems: "center",
    marginBottom: 60,
  },

  logo: {
    fontSize: 50,
    fontWeight: "bold",
    color: "white",
  },

  subText: {
    fontSize: 18,
    color: "#CBD5E1",
    marginTop: 10,
  },

  cardContainer: {
    gap: 25,
  },

  card: {
    backgroundColor: "#1E293B",
    borderRadius: 30,
    padding: 30,
    alignItems: "center",
  },

  icon: {
    fontSize: 60,
    marginBottom: 15,
  },

  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "white",
  },

  description: {
    fontSize: 16,
    color: "#CBD5E1",
    textAlign: "center",
    marginTop: 10,
  },

});