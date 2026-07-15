import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Animated,
    Easing,
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
import { Ionicons } from "@expo/vector-icons";
import { getUserRole, loginUser, logoutUser } from "../services/authService";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [loginMethod, setLoginMethod] = useState<"phone" | "email">("phone");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"rider" | "driver">((params.role as "rider" | "driver") || "rider");
  const [showRoleMenu, setShowRoleMenu] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const rotateAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 40000, // 40 seconds per rotation
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();
  }, []);

  const spin = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  useEffect(() => {
    if (params.role === "rider" || params.role === "driver") {
      setRole(params.role);
    }
  }, [params.role]);

  const handleLogin = async () => {
    let targetEmail = "";

    if (loginMethod === "phone") {
      if (!phone) {
        setErrorMessage("Please enter your phone number");
        return;
      }
      const cleanPhone = phone.replace(/[^0-9]/g, "");
      if (cleanPhone.length < 10) {
        setErrorMessage("Please enter a valid 10-digit phone number");
        return;
      }
      targetEmail = `${cleanPhone}@ridex.com`;
    } else {
      if (!email) {
        setErrorMessage("Please enter your email address");
        return;
      }
      targetEmail = email;
    }

    if (!password) {
      setErrorMessage("Please enter your password");
      return;
    }

    setErrorMessage("");
    setLoading(true);

    try {
      const response = await loginUser(targetEmail, password);

      if (response.success && response.user) {
        // Fetch User Database Role to verify selection
        const dbRole = await getUserRole(response.user.uid);
        if (dbRole === role) {
          // Dynamic redirect to index portal screen
          router.replace("/");
        } else {
          // Mismatch: sign out
          await logoutUser();
          const targetText = dbRole === "rider" ? "Rider" : "Driver";
          setErrorMessage(`This account is registered as a ${targetText}. Please select ${targetText} in the top-right menu.`);
        }
      } else {
        setErrorMessage(response.error || "Failed to log in");
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

      {/* Animated Rotating Background Logo Watermark (Large above/behind the form) */}
      <Animated.Image
        source={require("../assets/images/logg.png")}
        style={[styles.bgLogoWatermark, { transform: [{ rotate: spin }] }]}
        resizeMode="contain"
      />

      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: insets.top > 0 ? insets.top + 20 : 24,
            paddingBottom: insets.bottom > 0 ? insets.bottom + 40 : 80,
          }
        ]} 
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.card, { overflow: "visible" }]}>
          {/* Top Left Menu Selector inside card */}
          <TouchableOpacity
            style={styles.cardMenuBtn}
            onPress={() => setShowRoleMenu(!showRoleMenu)}
            activeOpacity={0.7}
          >
            <Ionicons name={showRoleMenu ? "close" : "menu"} size={22} color="#0F172A" />
          </TouchableOpacity>

          {showRoleMenu && (
            <View style={styles.roleDropdownInside}>
              <TouchableOpacity
                style={[styles.roleDropdownItem, role === "rider" && styles.roleDropdownItemActiveRider]}
                onPress={() => {
                  setRole("rider");
                  setShowRoleMenu(false);
                  setErrorMessage("");
                }}
                activeOpacity={0.85}
              >
                <View style={[styles.roleDropdownIcon, { backgroundColor: role === "rider" ? "#DBEAFE" : "#F1F5F9" }]}>
                  <Text style={styles.roleDropdownEmoji}>🚖</Text>
                </View>
                <View style={styles.roleDropdownTextGroup}>
                  <Text style={[styles.roleDropdownTitle, role === "rider" && styles.roleDropdownTitleActive]}>
                    Rider Account
                  </Text>
                  <Text style={styles.roleDropdownDesc}>Request standard & luxury rides</Text>
                </View>
                {role === "rider" && (
                  <Ionicons name="checkmark-circle" size={18} color="#2563EB" />
                )}
              </TouchableOpacity>

              <View style={styles.roleDropdownDivider} />

              <TouchableOpacity
                style={[styles.roleDropdownItem, role === "driver" && styles.roleDropdownItemActiveDriver]}
                onPress={() => {
                  setRole("driver");
                  setShowRoleMenu(false);
                  setErrorMessage("");
                }}
                activeOpacity={0.85}
              >
                <View style={[styles.roleDropdownIcon, { backgroundColor: role === "driver" ? "#D1FAE5" : "#F1F5F9" }]}>
                  <Text style={styles.roleDropdownEmoji}>🏎️</Text>
                </View>
                <View style={styles.roleDropdownTextGroup}>
                  <Text style={[styles.roleDropdownTitle, role === "driver" && styles.roleDropdownTitleActive]}>
                    Driver Partner
                  </Text>
                  <Text style={styles.roleDropdownDesc}>Go online & earn money</Text>
                </View>
                {role === "driver" && (
                  <Ionicons name="checkmark-circle" size={18} color="#10B981" />
                )}
              </TouchableOpacity>
            </View>
          )}

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
            <Text style={styles.eyebrow}>Welcome back</Text>
            <Text style={styles.title}>Log In to RideX</Text>
          </View>


          {errorMessage ? (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>⚠️ {errorMessage}</Text>
            </View>
          ) : null}

          {/* Method Switcher */}
          <View style={styles.methodTabContainer}>
            <TouchableOpacity
              style={[styles.methodTab, loginMethod === "phone" && styles.methodTabActive]}
              onPress={() => { setErrorMessage(""); setLoginMethod("phone"); }}
              disabled={loading}
              activeOpacity={0.8}
            >
              <Text style={[styles.methodTabText, loginMethod === "phone" && styles.methodTabTextActive]}>
                📞 Phone Number
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.methodTab, loginMethod === "email" && styles.methodTabActive]}
              onPress={() => { setErrorMessage(""); setLoginMethod("email"); }}
              disabled={loading}
              activeOpacity={0.8}
            >
              <Text style={[styles.methodTabText, loginMethod === "email" && styles.methodTabTextActive]}>
                ✉️ Email Address
              </Text>
            </TouchableOpacity>
          </View>

          {loginMethod === "phone" ? (
            <View style={styles.formGroup}>
              <Text style={styles.label}>Phone Number</Text>
              <View style={styles.phoneInputContainer}>
                <Text style={styles.phonePrefix}>+91</Text>
                <TextInput
                  style={[styles.input, styles.phoneInput, loading && styles.disabledInput]}
                  placeholder="98765 43210"
                  placeholderTextColor="#94A3B8"
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="number-pad"
                  maxLength={10}
                  editable={!loading}
                />
              </View>
            </View>
          ) : (
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
          )}

          <View style={styles.formGroup}>
            <Text style={styles.label}>Password</Text>
            <TextInput
              style={[styles.input, loading && styles.disabledInput]}
              placeholder="Enter your password"
              placeholderTextColor="#94A3B8"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              editable={!loading}
            />
          </View>

          <TouchableOpacity 
            style={[styles.primaryButton, loading && styles.disabledButton]} 
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={styles.primaryButtonText}>Log In</Text>
            )}
          </TouchableOpacity>
          <Pressable 
            onPress={() => !loading && router.push({ pathname: "/signup", params: { role } })}
            disabled={loading}
            style={({ pressed }) => [
              styles.switchButton,
              pressed && { opacity: 0.7 }
            ]}
          > 
            <Text style={styles.switchText}>
              {"Don't have an account? "} <Text style={styles.switchTextBold}>Sign up</Text>
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
    backgroundColor: "rgba(37, 99, 235, 0.05)", // Soft Blue Glow
  },
  glowBlobTwo: {
    position: "absolute",
    bottom: -120,
    left: -120,
    width: 350,
    height: 350,
    borderRadius: 175,
    backgroundColor: "rgba(16, 185, 129, 0.04)", // Soft Emerald Green Glow
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 80,
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
    color: "#2563EB", // Blue accent
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
  errorText: {
    color: "#DC2626",
    fontSize: 13,
    fontWeight: "600",
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
    backgroundColor: "#2563EB", // Blue accent button
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
    shadowColor: "#2563EB",
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
    width: "100%",
  },
  disabledButton: {
    opacity: 0.6,
    backgroundColor: "#60A5FA",
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
    color: "#2563EB",
    fontWeight: "800",
  },
  methodTabContainer: {
    flexDirection: "row",
    backgroundColor: "#F1F5F9",
    borderRadius: 14,
    padding: 4,
    marginBottom: 20,
    width: "100%",
  },
  methodTab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    borderRadius: 10,
  },
  methodTabActive: {
    backgroundColor: "#FFFFFF",
    shadowColor: "#0F172A",
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  methodTabText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#64748B",
  },
  methodTabTextActive: {
    color: "#0F172A",
  },
  phoneInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    borderRadius: 16,
    height: 52,
    paddingHorizontal: 16,
  },
  phonePrefix: {
    fontSize: 15,
    fontWeight: "800",
    color: "#0F172A",
    marginRight: 10,
  },
  phoneInput: {
    flex: 1,
    borderWidth: 0,
    height: "100%",
    paddingHorizontal: 0,
    marginVertical: 0,
    backgroundColor: "transparent",
  },
  cardMenuBtn: {
    position: "absolute",
    top: 16,
    left: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#0F172A",
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
    zIndex: 999,
  },
  roleDropdownInside: {
    position: "absolute",
    top: 64,
    left: 16,
    width: 280,
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    padding: 8,
    shadowColor: "#0F172A",
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
    zIndex: 1000,
  },
  roleDropdownItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 16,
    gap: 12,
  },
  roleDropdownItemActiveRider: {
    backgroundColor: "rgba(37, 99, 235, 0.03)",
  },
  roleDropdownItemActiveDriver: {
    backgroundColor: "rgba(16, 185, 129, 0.03)",
  },
  roleDropdownIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  roleDropdownEmoji: {
    fontSize: 18,
  },
  roleDropdownTextGroup: {
    flex: 1,
  },
  roleDropdownTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#0F172A",
  },
  roleDropdownTitleActive: {
    color: "#0F172A",
  },
  roleDropdownDesc: {
    fontSize: 11,
    color: "#64748B",
    marginTop: 2,
    fontWeight: "600",
  },
  roleDropdownDivider: {
    height: 1,
    backgroundColor: "#F1F5F9",
    marginHorizontal: 8,
    marginVertical: 4,
  },
  bgLogoWatermark: {
    position: "absolute",
    width: 480,
    height: 480,
    top: 50,
    left: "50%",
    marginLeft: -240,
    opacity: 0.25,
    tintColor: "#CBD5E1",
  },
  scrollView: {
    flex: 1,
    backgroundColor: "transparent",
  },
});
