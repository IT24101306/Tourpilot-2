import { useEffect, useState } from "react";
import { FlatList, StyleSheet, Text, View } from "react-native";

const API = process.env.EXPO_PUBLIC_API_URL || "http://localhost:4000/api";

type Agency = { id: string; name: string; slug: string; avgRating: number; tourCount: number };

export default function AgenciesScreen() {
  const [agencies, setAgencies] = useState<Agency[]>([]);

  useEffect(() => {
    fetch(`${API}/agencies`)
      .then((r) => r.json())
      .then(setAgencies)
      .catch(console.error);
  }, []);

  return (
    <FlatList
      contentContainerStyle={styles.list}
      data={agencies}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <View style={styles.card}>
          <Text style={styles.name}>{item.name}</Text>
          <Text style={styles.meta}>
            ★ {item.avgRating} · {item.tourCount} tours
          </Text>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  list: { padding: 16, backgroundColor: "#f8fbf9" },
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#dbe6e0",
  },
  name: { fontSize: 18, fontWeight: "700" },
  meta: { color: "#56635f", marginTop: 4 },
});
