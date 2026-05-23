import { useState } from "react";
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

const API = process.env.EXPO_PUBLIC_API_URL || "http://localhost:4000/api";

export default function LoginScreen() {
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [challengeId, setChallengeId] = useState("");

  async function sendOtp() {
    const res = await fetch(`${API}/auth/send-otp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone }),
    });
    const data = await res.json();
    if (!res.ok) return Alert.alert("Error", data.error);
    setChallengeId(data.challengeId);
    if (data.otp) Alert.alert("Demo OTP", data.otp);
  }

  async function verify() {
    const res = await fetch(`${API}/auth/verify-otp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ challengeId, phone, otp }),
    });
    const data = await res.json();
    if (!res.ok) return Alert.alert("Error", data.error);
    Alert.alert("Logged in", `Welcome ${data.user.name}`);
  }

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Phone</Text>
      <TextInput style={styles.input} value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
      <Pressable style={styles.btn} onPress={sendOtp}>
        <Text style={styles.btnText}>Send OTP</Text>
      </Pressable>
      <Text style={styles.label}>OTP</Text>
      <TextInput style={styles.input} value={otp} onChangeText={setOtp} maxLength={6} />
      <Pressable style={styles.btn} onPress={verify}>
        <Text style={styles.btnText}>Verify</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, backgroundColor: "#f8fbf9" },
  label: { fontWeight: "700", marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: "#dbe6e0",
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    backgroundColor: "#fff",
  },
  btn: { backgroundColor: "#1f8f58", padding: 14, borderRadius: 12, alignItems: "center" },
  btnText: { color: "#fff", fontWeight: "700" },
});
