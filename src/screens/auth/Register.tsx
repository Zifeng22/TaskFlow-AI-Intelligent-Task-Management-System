import React, { useState } from "react";
import DropDownPicker from "react-native-dropdown-picker";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Platform, StyleSheet } from "react-native";
import { getFirestore, doc, setDoc } from "firebase/firestore";
import {
  updateProfile,
  getAuth,
  createUserWithEmailAndPassword,
} from "firebase/auth";
import {
  ScrollView,
  TouchableOpacity,
  View,
  KeyboardAvoidingView,
  Image,
} from "react-native";
import { AuthStackParamList } from "../../types/navigation";
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
}: NativeStackScreenProps<AuthStackParamList, "Register">) {
  const { isDarkmode, setTheme } = useTheme();
  const auth = getAuth();
  const db = getFirestore();

  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [confirmPassword, setConfirmPassword] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [open, setOpen] = useState(false);
  const [gender, setGender] = useState(null);
  const [items, setItems] = useState([
    { label: "Male", value: "Male" },
    { label: "Female", value: "Female" },
  ]);
  const [date, setDate] = useState(new Date());
  const [show, setShow] = useState(false);
  const [phone, setPhone] = useState("");
  const [displayName, setDisplayName] = useState("");

  // Dynamic design tokens matching Login theme
  const primaryAccent = "#6366F1";
  const bgHeader = isDarkmode ? "#111827" : "#EEF2FF";
  const cardBg = isDarkmode ? "#1F2937" : "#FFFFFF";
  const textColor = isDarkmode ? "#F9FAFB" : "#111827";
  const subTextColor = isDarkmode ? "#9CA3AF" : "#6B7280";
  const inputBg = isDarkmode ? "#111827" : "#F9FAFB";
  const borderColor = isDarkmode ? "#374151" : "#E5E7EB";

  const onChange = (event: any, selectedDate?: Date) => {
    setShow(false);
    if (selectedDate) {
      setDate(selectedDate);
    }
  };

  async function register() {
    if (!displayName) {
      alert("Display name is required");
      return;
    }

    if (!email) {
      alert("Email is required");
      return;
    }

    if (!password) {
      alert("Password is required");
      return;
    }

    if (password !== confirmPassword) {
      alert("Passwords do not match");
      return;
    }

    if (!phone) {
      alert("Phone number is required");
      return;
    }

    if (!gender) {
      alert("Gender is required");
      return;
    }

    setLoading(true);

    try {
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        email,
        password,
      );

      const user = userCredential.user;

      await updateProfile(user, {
        displayName: displayName,
        photoURL: "-",
      });

      await setDoc(doc(db, "Users", user.uid), {
        email: user.email,
        displayName: displayName,
        gender: gender,
        birthDate: date.toISOString().split("T")[0],
        photoURL: "-",
        phone: phone,
        points: 0,
        rewards: " ",
        role: "Team Member",
        createdAt: new Date().toISOString(),
      });

      alert("Register successful");
    } catch (error: any) {
      alert(error.message);
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
                source={require("../../../assets/images/register.png")}
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
                Create Account
              </Text>
              <Text style={{ ...styles.subtitleText, color: subTextColor }}>
                Join to track your tasks and earn gamified rewards
              </Text>
            </View>

            {/* DISPLAY NAME */}
            <View style={styles.inputGroup}>
              <Text style={{ ...styles.label, color: textColor }}>
                Display Name
              </Text>
              <TextInput
                containerStyle={{
                  ...styles.inputContainer,
                  backgroundColor: inputBg,
                  borderColor: borderColor,
                }}
                placeholder="Enter your full name..."
                value={displayName}
                autoCapitalize="words"
                autoComplete="off"
                autoCorrect={false}
                onChangeText={(text) => setDisplayName(text)}
                leftContent={
                  <Ionicons
                    name="person-outline"
                    size={20}
                    color={subTextColor}
                    style={{ marginLeft: 12 }}
                  />
                }
              />
            </View>

            {/* EMAIL */}
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
                placeholder="Enter your email..."
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

            {/* PHONE NUMBER */}
            <View style={styles.inputGroup}>
              <Text style={{ ...styles.label, color: textColor }}>
                Phone Number
              </Text>
              <TextInput
                containerStyle={{
                  ...styles.inputContainer,
                  backgroundColor: inputBg,
                  borderColor: borderColor,
                }}
                placeholder="Enter your phone number..."
                value={phone}
                autoCapitalize="none"
                autoComplete="tel"
                autoCorrect={false}
                keyboardType="phone-pad"
                onChangeText={(text) => setPhone(text)}
                leftContent={
                  <Ionicons
                    name="call-outline"
                    size={20}
                    color={subTextColor}
                    style={{ marginLeft: 12 }}
                  />
                }
              />
            </View>

            {/* PASSWORD */}
            <View style={styles.inputGroup}>
              <Text style={{ ...styles.label, color: textColor }}>
                Password
              </Text>
              <TextInput
                containerStyle={{
                  ...styles.inputContainer,
                  backgroundColor: inputBg,
                  borderColor: borderColor,
                }}
                placeholder="Create a strong password..."
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

            {/* CONFIRM PASSWORD */}
            <View style={styles.inputGroup}>
              <Text style={{ ...styles.label, color: textColor }}>
                Confirm Password
              </Text>
              <TextInput
                containerStyle={{
                  ...styles.inputContainer,
                  backgroundColor: inputBg,
                  borderColor: borderColor,
                }}
                placeholder="Re-enter your password..."
                value={confirmPassword}
                autoCapitalize="none"
                autoComplete="off"
                autoCorrect={false}
                secureTextEntry={true}
                onChangeText={(text) => setConfirmPassword(text)}
                leftContent={
                  <Ionicons
                    name="checkmark-circle-outline"
                    size={20}
                    color={subTextColor}
                    style={{ marginLeft: 12 }}
                  />
                }
              />
            </View>

            {/* GENDER PICKER */}
            <View style={{ ...styles.inputGroup, zIndex: 1000 }}>
              <Text style={{ ...styles.label, color: textColor }}>Gender</Text>
              <DropDownPicker
                open={open}
                value={gender}
                items={items}
                setOpen={setOpen}
                setValue={setGender}
                setItems={setItems}
                placeholder="Select Gender"
                style={{
                  backgroundColor: inputBg,
                  borderColor: borderColor,
                  borderRadius: 14,
                  minHeight: 52,
                }}
                textStyle={{
                  color: textColor,
                  fontSize: 14,
                }}
                dropDownContainerStyle={{
                  backgroundColor: cardBg,
                  borderColor: borderColor,
                  borderRadius: 14,
                }}
              />
            </View>

            {/* DATE OF BIRTH */}
            <View style={styles.inputGroup}>
              <Text style={{ ...styles.label, color: textColor }}>
                Date of Birth
              </Text>
              <TouchableOpacity
                onPress={() => setShow(true)}
                activeOpacity={0.8}
                style={{
                  ...styles.datePickerButton,
                  backgroundColor: inputBg,
                  borderColor: borderColor,
                }}
              >
                <Ionicons
                  name="calendar-outline"
                  size={20}
                  color={subTextColor}
                  style={{ marginRight: 10 }}
                />
                <Text style={{ color: textColor, fontSize: 14 }}>
                  {date.toDateString()}
                </Text>
              </TouchableOpacity>

              {show && Platform.OS === "web" && (
                <input
                  type="date"
                  value={date.toISOString().split("T")[0]}
                  onChange={(e) => {
                    setDate(new Date(e.target.value));
                    setShow(false);
                  }}
                  style={{ marginTop: 10, padding: 8 }}
                />
              )}

              {show && Platform.OS !== "web" && (
                <DateTimePicker
                  value={date}
                  mode="date"
                  display="default"
                  onChange={onChange}
                />
              )}
            </View>

            {/* SUBMIT BUTTON */}
            <Button
              text={loading ? "Creating account..." : "Create Account"}
              onPress={register}
              style={{
                ...styles.submitButton,
                backgroundColor: primaryAccent,
              }}
              disabled={loading}
            />

            {/* LOGIN LINK */}
            <View style={styles.footerRow}>
              <Text style={{ fontSize: 14, color: subTextColor }}>
                Already have an account?
              </Text>
              <TouchableOpacity
                onPress={() => navigation.navigate("Login")}
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
                  Login here
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
    height: 180,
    justifyContent: "center",
    alignItems: "center",
    paddingTop: Platform.OS === "ios" ? 20 : 10,
  },
  imageGlowCircle: {
    width: 150,
    height: 150,
    borderRadius: 75,
    justifyContent: "center",
    alignItems: "center",
  },
  heroImage: {
    height: 140,
    width: 140,
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
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 8,
  },
  inputContainer: {
    borderRadius: 14,
    borderWidth: 1,
    height: 52,
  },
  datePickerButton: {
    flexDirection: "row",
    alignItems: "center",
    height: 52,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
  },
  submitButton: {
    height: 52,
    borderRadius: 14,
    marginTop: 12,
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
    marginTop: 24,
  },
});
