import { router } from "expo-router";
import { useState } from "react";
import {
    ActivityIndicator,
    Image,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { signupUser } from "../services/authService";

export default function SignupScreen() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"rider" | "driver">("rider");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  const handleSignup = async () => {
    if (!name || !email || !password) {
      setErrorMessage("Please fill in all fields");
      setValidationErrors([]);
      return;
    }

    setErrorMessage("");
    setValidationErrors([]);
    setLoading(true);

    try {
      const response = await signupUser(email, password, name, role);

      if (response.success) {
        // Redirect to portal dashboard
        router.replace("/");
      } else {
        if (response.validationErrors) {
          setValidationErrors(response.validationErrors);
        } else {
          setErrorMessage(response.error || "Failed to create account");
        }
      }
    } catch (err: any) {
      setErrorMessage(err.message || "An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <StatusBar barStyle="dark-content" backgroundColor="#F8FAFC" />

      {/* Decorative Glow Blobs */}
      <View style={styles.glowBlobOne} />
      <View style={styles.glowBlobTwo} />

      <ScrollView 
        contentContainerStyle={styles.scrollContent} 
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.card}>
          <View style={styles.header}>
            <View style={styles.logoContainer}>
              <View style={styles.logoShell}>
                <View style={styles.logoInner}>
                  <Image
                    source={require("../assets/images/logg.png")}
                    style={styles.logoImage}
                    resizeMode="contain"
                  />
                </View>
              </View>
            </View>
            <Text style={styles.eyebrow}>Create account</Text>
            <Text style={styles.title}>Join RideX</Text>
            <Text style={styles.subtitle}>Sign up to request trips or register as a driver partner.</Text>
          </View>

          {errorMessage ? (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>⚠️ {errorMessage}</Text>
            </View>
          ) : null}

          {validationErrors.length > 0 ? (
            <View style={styles.errorContainer}>
              <Text style={styles.errorTitle}>Password Requirements:</Text>
              {validationErrors.map((err, idx) => (
                <Text key={idx} style={styles.errorTextItem}>• {err}</Text>
              ))}
            </View>
          ) : null}

          {/* Premium Stacked Selection Cards */}
          <View style={styles.roleContainer}>
            <Text style={styles.roleLabel}>I want to sign up as a:</Text>
            
            <TouchableOpacity
              style={[
                styles.roleCard,
                role === "rider" ? styles.roleCardActiveRider : styles.roleCardInactive
              ]}
              onPress={() => setRole("rider")}
              activeOpacity={0.9}
              disabled={loading}
            >
              <View style={[styles.roleIconCircle, { backgroundColor: role === "rider" ? "#DBEAFE" : "#F1F5F9" }]}>
                <Text style={styles.roleEmojiText}>🚖</Text>
              </View>
              <View style={styles.roleTextWrapper}>
                <Text style={styles.roleTitleText}>Rider Account</Text>
                <Text style={styles.roleDescText}>Request standard & luxury rides</Text>
              </View>
              <View style={[styles.radioCircle, role === "rider" && styles.radioActiveRider]}>
                {role === "rider" && <View style={styles.radioDotRider} />}
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.roleCard,
                role === "driver" ? styles.roleCardActiveDriver : styles.roleCardInactive
              ]}
              onPress={() => setRole("driver")}
              activeOpacity={0.9}
              disabled={loading}
            >
              <View style={[styles.roleIconCircle, { backgroundColor: role === "driver" ? "#D1FAE5" : "#F1F5F9" }]}>
                <Text style={styles.roleEmojiText}>🏎️</Text>
              </View>
              <View style={styles.roleTextWrapper}>
                <Text style={styles.roleTitleText}>Driver Partner</Text>
                <Text style={styles.roleDescText}>Go online, accept requests & earn</Text>
              </View>
              <View style={[styles.radioCircle, role === "driver" && styles.radioActiveDriver]}>
                {role === "driver" && <View style={styles.radioDotDriver} />}
              </View>
            </TouchableOpacity>
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Full Name</Text>
            <TextInput
              style={[styles.input, loading && styles.disabledInput]}
              placeholder="John Doe"
              placeholderTextColor="#94A3B8"
              value={name}
              onChangeText={setName}
              editable={!loading}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Email Address</Text>
            <TextInput
              style={[styles.input, loading && styles.disabledInput]}
              placeholder="name@example.com"
              placeholderTextColor="#94A3B8"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              editable={!loading}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Password</Text>
            <TextInput
              style={[styles.input, loading && styles.disabledInput]}
              placeholder="Create a strong password"
              placeholderTextColor="#94A3B8"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              editable={!loading}
            />
          </View>

          <TouchableOpacity 
            style={[styles.primaryButton, loading && styles.disabledButton]} 
            onPress={handleSignup}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={styles.primaryButtonText}>Create Account</Text>
            )}
          </TouchableOpacity>

          <Pressable 
            onPress={() => !loading && router.push("/login")}
            disabled={loading}
            style={({ pressed }) => [
              styles.switchButton,
              pressed && { opacity: 0.7 }
            ]}
          > 
            <Text style={styles.switchText}>
              Already have an account? <Text style={styles.switchTextBold}>Log in</Text>
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC", // Unified Snow White background
  },
  glowBlobOne: {
    position: "absolute",
    top: -100,
    right: -100,
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: "rgba(16, 185, 129, 0.06)", // Soft Emerald Green Glow
  },
  glowBlobTwo: {
    position: "absolute",
    bottom: -120,
    left: -120,
    width: 350,
    height: 350,
    borderRadius: 175,
    backgroundColor: "rgba(37, 99, 235, 0.06)", // Soft Blue Glow
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    padding: 24,
  },
  card: {
    backgroundColor: "rgba(255, 255, 255, 0.85)", // Glassmorphic Translucent White
    borderRadius: 28,
    padding: 24,
    borderWidth: 1,
    borderColor: "rgba(15, 23, 42, 0.06)",
    shadowColor: "#0F172A",
    shadowOpacity: 0.05,
    shadowRadius: 15,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  header: {
    marginBottom: 24,
    alignItems: "center",
  },
  logoContainer: {
    alignItems: "center",
    marginBottom: 20,
  },
  logoShell: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: "#0F172A", // Contrast logo holder
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  logoInner: {
    width: 56,
    height: 56,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    alignItems: "center",
    justifyContent: "center",
  },
  logoImage: {
    width: 36,
    height: 36,
  },
  eyebrow: {
    color: "#10B981", // Emerald accent
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 1.6,
    textTransform: "uppercase",
    marginBottom: 8,
    textAlign: "center",
  },
  title: {
    fontSize: 28,
    fontWeight: "900",
    color: "#0F172A", // Deep Dark Slate title
    marginBottom: 8,
    letterSpacing: -0.5,
    textAlign: "center",
  },
  subtitle: {
    color: "#475569", // Soft slate subtitle
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },
  errorContainer: {
    backgroundColor: "rgba(239, 68, 68, 0.06)",
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.15)",
    borderRadius: 12,
    padding: 12,
    marginBottom: 20,
    width: "100%",
  },
  errorTitle: {
    color: "#DC2626",
    fontSize: 13,
    fontWeight: "800",
    marginBottom: 4,
  },
  errorText: {
    color: "#DC2626",
    fontSize: 13,
    fontWeight: "600",
  },
  errorTextItem: {
    color: "#B91C1C",
    fontSize: 12.5,
    fontWeight: "500",
    lineHeight: 18,
    marginLeft: 4,
  },
  roleContainer: {
    marginBottom: 20,
    width: "100%",
  },
  roleLabel: {
    color: "#334155",
    fontSize: 13,
    fontWeight: "800",
    marginBottom: 10,
    letterSpacing: 0.5,
  },
  roleCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1.5,
    borderRadius: 20,
    padding: 14,
    marginBottom: 10,
    gap: 12,
  },
  roleCardInactive: {
    borderColor: "#E2E8F0",
  },
  roleCardActiveRider: {
    borderColor: "#2563EB",
    backgroundColor: "rgba(37, 99, 235, 0.02)",
  },
  roleCardActiveDriver: {
    borderColor: "#10B981",
    backgroundColor: "rgba(16, 185, 129, 0.02)",
  },
  roleIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  roleEmojiText: {
    fontSize: 22,
  },
  roleTextWrapper: {
    flex: 1,
  },
  roleTitleText: {
    fontSize: 15,
    fontWeight: "800",
    color: "#0F172A",
  },
  roleDescText: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 2,
    fontWeight: "600",
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "#CBD5E1",
    alignItems: "center",
    justifyContent: "center",
  },
  radioActiveRider: {
    borderColor: "#2563EB",
  },
  radioActiveDriver: {
    borderColor: "#10B981",
  },
  radioDotRider: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#2563EB",
  },
  radioDotDriver: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#10B981",
  },
  formGroup: {
    marginBottom: 20,
    width: "100%",
  },
  label: {
    color: "#334155",
    fontSize: 13,
    fontWeight: "800",
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  input: {
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: "#0F172A",
    backgroundColor: "#FFFFFF",
    width: "100%",
  },
  disabledInput: {
    opacity: 0.6,
    backgroundColor: "#F1F5F9",
    color: "#94A3B8",
  },
  primaryButton: {
    backgroundColor: "#10B981", // Emerald accent button
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
    shadowColor: "#10B981",
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
    width: "100%",
  },
  disabledButton: {
    opacity: 0.6,
    backgroundColor: "#34D399",
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: 0.4,
  },
  switchButton: {
    marginTop: 20,
    alignSelf: "center",
  },
  switchText: {
    color: "#64748B",
    fontSize: 14,
  },
  switchTextBold: {
    color: "#10B981",
    fontWeight: "800",
  },
});
