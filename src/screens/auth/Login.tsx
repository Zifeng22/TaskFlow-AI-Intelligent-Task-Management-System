import React, { useState } from "react";
import {
  ScrollView,
  TouchableOpacity,
  View,
  KeyboardAvoidingView,
  Image,
  StyleSheet,
  Platform,
} from "react-native";
import { AuthStackParamList } from "../../types/navigation";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import {
  Layout,
  Text,
  TextInput,
  Button,
  useTheme,
} from "react-native-rapi-ui";
import { Ionicons } from "@expo/vector-icons";

export default function ({
  navigation,
}: NativeStackScreenProps<AuthStackParamList, "Login">) {
  const { isDarkmode, setTheme } = useTheme();
  const auth = getAuth();
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);

  // Dynamic design tokens
  const primaryAccent = "#6366F1";
  const bgHeader = isDarkmode ? "#111827" : "#EEF2FF";
  const cardBg = isDarkmode ? "#1F2937" : "#FFFFFF";
  const textColor = isDarkmode ? "#F9FAFB" : "#111827";
  const subTextColor = isDarkmode ? "#9CA3AF" : "#6B7280";
  const inputBg = isDarkmode ? "#111827" : "#F9FAFB";
  const borderColor = isDarkmode ? "#374151" : "#E5E7EB";

  async function login() {
    if (!email || !password) {
      alert("Please enter both email and password.");
      return;
    }

    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error: any) {
      var errorMessage = error.message;
      alert(errorMessage);
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      enabled
      style={{ flex: 1 }}
    >
      <Layout style={{ backgroundColor: bgHeader }}>
        <ScrollView
          contentContainerStyle={{ flexGrow: 1 }}
          showsVerticalScrollIndicator={false}
        >
          {/* HEADER SECTION WITH HERO IMAGE */}
          <View
            style={{ ...styles.headerContainer, backgroundColor: bgHeader }}
          >
            <View style={styles.imageGlowCircle}>
              <Image
                resizeMode="contain"
                style={styles.heroImage}
                source={require("../../../assets/images/login.png")}
              />
            </View>
          </View>

          {/* FLOATING CARD CONTAINER */}
          <View
            style={{
              ...styles.formCard,
              backgroundColor: cardBg,
              borderColor: borderColor,
            }}
          >
            {/* TITLE & SUBTITLE */}
            <View style={styles.titleSection}>
              <Text
                fontWeight="bold"
                style={{ ...styles.headingText, color: textColor }}
              >
                Welcome Back
              </Text>
              <Text style={{ ...styles.subtitleText, color: subTextColor }}>
                Sign in to manage your tasks and stay productive
              </Text>
            </View>

            {/* EMAIL INPUT */}
            <View style={styles.inputGroup}>
              <Text style={{ ...styles.label, color: textColor }}>
                Email Address
              </Text>
              <TextInput
                containerStyle={{
                  ...styles.inputContainer,
                  backgroundColor: inputBg,
                  borderColor: borderColor,
                }}
                placeholder="enter your email..."
                value={email}
                autoCapitalize="none"
                autoComplete="off"
                autoCorrect={false}
                keyboardType="email-address"
                onChangeText={(text) => setEmail(text)}
                leftContent={
                  <Ionicons
                    name="mail-outline"
                    size={20}
                    color={subTextColor}
                    style={{ marginLeft: 12 }}
                  />
                }
              />
            </View>

            {/* PASSWORD INPUT */}
            <View style={styles.inputGroup}>
              <View style={styles.passwordHeader}>
                <Text style={{ ...styles.label, color: textColor }}>
                  Password
                </Text>
                <TouchableOpacity
                  onPress={() => navigation.navigate("ForgetPassword")}
                  activeOpacity={0.7}
                >
                  <Text style={{ ...styles.forgotText, color: primaryAccent }}>
                    Forgot?
                  </Text>
                </TouchableOpacity>
              </View>

              <TextInput
                containerStyle={{
                  ...styles.inputContainer,
                  backgroundColor: inputBg,
                  borderColor: borderColor,
                }}
                placeholder="enter your password..."
                value={password}
                autoCapitalize="none"
                autoComplete="off"
                autoCorrect={false}
                secureTextEntry={true}
                onChangeText={(text) => setPassword(text)}
                leftContent={
                  <Ionicons
                    name="lock-closed-outline"
                    size={20}
                    color={subTextColor}
                    style={{ marginLeft: 12 }}
                  />
                }
              />
            </View>

            {/* SUBMIT BUTTON */}
            <Button
              text={loading ? "Authenticating..." : "Sign In"}
              onPress={login}
              style={{
                ...styles.submitButton,
                backgroundColor: primaryAccent,
              }}
              disabled={loading}
            />

            {/* REGISTER FOOTER LINK */}
            <View style={styles.footerRow}>
              <Text style={{ fontSize: 14, color: subTextColor }}>
                Don't have an account?
              </Text>
              <TouchableOpacity
                onPress={() => navigation.navigate("Register")}
                activeOpacity={0.7}
              >
                <Text
                  fontWeight="bold"
                  style={{
                    fontSize: 14,
                    color: primaryAccent,
                    marginLeft: 6,
                  }}
                >
                  Register here
                </Text>
              </TouchableOpacity>
            </View>

            {/* THEME TOGGLE PILL */}
            <TouchableOpacity
              onPress={() => setTheme(isDarkmode ? "light" : "dark")}
              activeOpacity={0.8}
              style={{
                ...styles.themeTogglePill,
                backgroundColor: isDarkmode ? "#374151" : "#F3F4F6",
                borderColor: borderColor,
              }}
            >
              <Ionicons
                name={isDarkmode ? "sunny" : "moon"}
                size={16}
                color={isDarkmode ? "#FBBF24" : "#4B5563"}
              />
              <Text
                fontWeight="bold"
                style={{
                  fontSize: 13,
                  marginLeft: 8,
                  color: isDarkmode ? "#F9FAFB" : "#374151",
                }}
              >
                {isDarkmode ? "Light Mode" : "Dark Mode"}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </Layout>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  headerContainer: {
    height: 220,
    justifyContent: "center",
    alignItems: "center",
    paddingTop: Platform.OS === "ios" ? 20 : 10,
  },
  imageGlowCircle: {
    width: 170,
    height: 170,
    borderRadius: 85,
    justifyContent: "center",
    alignItems: "center",
  },
  heroImage: {
    height: 160,
    width: 160,
  },
  formCard: {
    flex: 1,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingHorizontal: 24,
    paddingTop: 30,
    paddingBottom: 40,
    borderTopWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 8,
  },
  titleSection: {
    marginBottom: 24,
    alignItems: "center",
  },
  headingText: {
    fontSize: 26,
    letterSpacing: -0.5,
  },
  subtitleText: {
    fontSize: 14,
    marginTop: 6,
    textAlign: "center",
    lineHeight: 20,
  },
  inputGroup: {
    marginBottom: 18,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 8,
  },
  passwordHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  forgotText: {
    fontSize: 13,
    fontWeight: "600",
  },
  inputContainer: {
    borderRadius: 14,
    borderWidth: 1,
    height: 52,
  },
  submitButton: {
    height: 52,
    borderRadius: 14,
    marginTop: 10,
    shadowColor: "#6366F1",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  footerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 24,
  },
  themeTogglePill: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    marginTop: 28,
  },
});
