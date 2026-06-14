import {
    FlatList,
    StyleSheet,
    Text,
    View,
} from "react-native";

import {
    useEffect,
    useState,
} from "react";

import {
    onValue,
    ref,
} from "firebase/database";

import { db } from "../firebaseConfig";

export default function HistoryScreen() {

  const [rides, setRides] =
    useState<any[]>([]);

  useEffect(() => {

    const historyRef =
      ref(db, "rides/history");

    onValue(
      historyRef,
      (snapshot) => {

        const data =
          snapshot.val();

        if (data) {

          const list =
            Object.keys(data)

              .map((key) => ({
                id: key,
                ...data[key],
              }))

              .reverse();

          setRides(list);
        }
      }
    );

  }, []);

  return (

    <View style={styles.container}>

      <Text style={styles.title}>
        Booking History
      </Text>

      <FlatList

        data={rides}

        keyExtractor={(item) =>
          item.id
        }

        renderItem={({ item }) => (

          <View style={styles.card}>

            <Text>
              Distance:
              {" "}
              {item.distance} km
            </Text>

            <Text>
              Duration:
              {" "}
              {item.duration} mins
            </Text>

            <Text>
              Status:
              {" "}
              {item.status}
            </Text>

          </View>

        )}

      />

    </View>

  );
}

const styles = StyleSheet.create({

  container: {
    flex: 1,
    padding: 20,
    backgroundColor: "#fff",
  },

  title: {
    fontSize: 28,
    fontWeight: "bold",
    marginBottom: 20,
  },

  card: {
    backgroundColor: "#F3F4F6",
    padding: 15,
    borderRadius: 12,
    marginBottom: 12,
  },

});