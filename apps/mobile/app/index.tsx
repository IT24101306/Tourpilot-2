import { Link } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

export default function Home() {
  return (
    <View style={styles.container}>
      <Text style={styles.brand}>
        Tour<Text style={styles.accent}>Pilot</Text>
      </Text>
      <Text style={styles.sub}>Sri Lanka tourism — mobile</Text>
      <Link href="/agencies" style={styles.btn}>
        Browse agencies
      </Link>
      <Link href="/login" style={[styles.btn, styles.btnGhost]}>
        Login with OTP
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, justifyContent: "center", backgroundColor: "#f8fbf9" },
  brand: { fontSize: 32, fontWeight: "800", marginBottom: 8 },
  accent: { color: "#1f8f58" },
  sub: { color: "#56635f", marginBottom: 24 },
  btn: {
    backgroundColor: "#1f8f58",
    color: "#fff",
    textAlign: "center",
    padding: 14,
    borderRadius: 999,
    overflow: "hidden",
    marginBottom: 12,
    fontWeight: "700",
  },
  btnGhost: { backgroundColor: "#eef3f1", color: "#151a19" },
});
