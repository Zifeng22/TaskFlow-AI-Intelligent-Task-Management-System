import React, { useEffect, useState } from "react";
import {
  View,
  StyleSheet,
  Alert,
  ScrollView,
  Image,
  TouchableOpacity,
  Platform,
} from "react-native";

import { MainStackParamList } from "../../types/navigation";
import { NativeStackScreenProps } from "@react-navigation/native-stack";

import {
  Layout,
  TopNav,
  Text,
  Button,
  TextInput,
  useTheme,
  themeColor,
} from "react-native-rapi-ui";

import { Ionicons } from "@expo/vector-icons";
import QRCode from "react-native-qrcode-svg";

import * as ImagePicker from "expo-image-picker";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";

import { getAuth } from "firebase/auth";
import { getFirestore, doc, getDoc, updateDoc } from "firebase/firestore";

import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";

export default function ProfileScreen({
  navigation,
}: NativeStackScreenProps<MainStackParamList, "Profile">) {
  const { isDarkmode, setTheme } = useTheme();

  const [displayName, setDisplayName] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [phone, setPhone] = useState<string>("");
  const [photoURL, setPhotoURL] = useState<string>("");

  const [originalData, setOriginalData] = useState({
    displayName: "",
    email: "",
    phone: "",
    photoURL: "",
  });

  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [exporting, setExporting] = useState<boolean>(false);

  // Dynamic Theme Palette
  const backgroundColor = isDarkmode ? themeColor.dark200 : "#F8FAFC";
  const cardBackgroundColor = isDarkmode ? "#1E293B" : "#FFFFFF";
  const textColor = isDarkmode ? "#F8FAFC" : "#0F172A";
  const subTextColor = isDarkmode ? "#94A3B8" : "#64748B";
  const borderColor = isDarkmode ? "#334155" : "#E2E8F0";
  const accentColor = "#6366F1";
  const buttonIconColor = isDarkmode ? "#F8FAFC" : "#6366F1";

  // FETCH PROFILE FROM "Users"
  useEffect(() => {
    const fetchUserProfile = async () => {
      try {
        const auth = getAuth();
        const currentUser = auth.currentUser;

        if (!currentUser) return;

        const db = getFirestore();
        const docRef = doc(db, "Users", currentUser.uid);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const data = docSnap.data();

          const fetchedName = data.displayName ? String(data.displayName) : "";
          const fetchedEmail = data.email ? String(data.email) : "";
          const fetchedPhone = data.phone ? String(data.phone) : "";
          const fetchedPhoto =
            data.photoURL && data.photoURL !== "-" && data.photoURL !== "_"
              ? String(data.photoURL)
              : "";

          setDisplayName(fetchedName);
          setEmail(fetchedEmail);
          setPhone(fetchedPhone);
          setPhotoURL(fetchedPhoto);

          setOriginalData({
            displayName: fetchedName,
            email: fetchedEmail,
            phone: fetchedPhone,
            photoURL: fetchedPhoto,
          });
        }
      } catch (error) {
        console.error("Error fetching profile:", error);
      }
    };

    fetchUserProfile();
  }, []);

  // PICK PROFILE PICTURE
  const pickImage = async () => {
    if (!isEditing) return;

    try {
      const permission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        Alert.alert(
          "Permission Required",
          "Please allow photo library access to select a profile picture.",
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.5,
      });

      if (result.canceled || !result.assets[0]?.uri) return;

      const asset = result.assets[0];
      const auth = getAuth();
      const currentUser = auth.currentUser;

      if (!currentUser) {
        Alert.alert("Error", "You are not logged in.");
        return;
      }

      setLoading(true);

      const response = await fetch(asset.uri);
      if (!response.ok) {
        throw new Error("Unable to read selected image.");
      }

      const blob = await response.blob();
      const storage = getStorage();
      const imageRef = ref(storage, `profilePictures/${currentUser.uid}.jpg`);

      await uploadBytes(imageRef, blob, {
        contentType: asset.mimeType || blob.type || "image/jpeg",
      });

      const downloadURL = await getDownloadURL(imageRef);
      setPhotoURL(downloadURL);

      Alert.alert("Success", "Profile picture uploaded successfully.");
    } catch (error) {
      console.error("Image upload error:", error);
      Alert.alert(
        "Error",
        error instanceof Error
          ? error.message
          : "Unable to upload profile picture.",
      );
    } finally {
      setLoading(false);
    }
  };

  // SAVE PROFILE TO "Users"
  const handleSave = async () => {
    const auth = getAuth();
    const currentUser = auth.currentUser;

    if (!currentUser) {
      Alert.alert("Error", "You are not logged in.");
      return;
    }

    try {
      setLoading(true);
      const db = getFirestore();
      const docRef = doc(db, "Users", currentUser.uid);

      await updateDoc(docRef, {
        displayName: displayName.trim(),
        email: email.trim(),
        phone: phone.trim(),
        photoURL: photoURL || "",
      });

      setOriginalData({
        displayName: displayName.trim(),
        email: email.trim(),
        phone: phone.trim(),
        photoURL: photoURL,
      });

      setIsEditing(false);
      Alert.alert("Success", "Profile updated successfully!");
    } catch (error) {
      console.error("Error updating profile:", error);
      Alert.alert("Error", "Failed to update profile.");
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setDisplayName(originalData.displayName);
    setEmail(originalData.email);
    setPhone(originalData.phone);
    setPhotoURL(originalData.photoURL);
    setIsEditing(false);
  };

  const currentQrValue = JSON.stringify({
    displayName: displayName,
    email: email,
    phone: phone,
  });

  // EXPORT PDF
  const handleExportPDF = async () => {
    try {
      setExporting(true);

      const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=${encodeURIComponent(
        currentQrValue || "N/A",
      )}`;

      const htmlContent = `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<title>${displayName || "Profile"}</title>
<style>
@page { size: A4 portrait; margin: 0; }
* { box-sizing: border-box; margin: 0; padding: 0; }
html, body { width: 210mm; height: 297mm; margin: 0; padding: 0; }
body { background: #F8FAFC; display: flex; justify-content: center; align-items: center; font-family: sans-serif; }
.card { background: #FFFFFF; width: 160mm; border-radius: 24px; padding: 15mm; text-align: center; border: 1px solid #E2E8F0; box-shadow: 0 10px 25px rgba(0,0,0,0.05); }
.name { font-size: 28px; font-weight: 800; color: #0F172A; margin-bottom: 6mm; }
.info-row { font-size: 15px; color: #475569; margin-bottom: 3mm; font-weight: 500; }
.divider { width: 80%; height: 1px; background-color: #E2E8F0; margin: 8mm auto; border: none; }
.qr-code { width: 50mm; height: 50mm; margin-top: 4mm; }
.footer-label { font-size: 13px; color: #94A3B8; margin-top: 5mm; font-weight: 500; }
</style>
</head>
<body>
<div class="card">
  <h1 class="name">${displayName || "Your Name"}</h1>
  <div class="info-row">✉️ ${email || "your.email@example.com"}</div>
  <div class="info-row">📞 ${phone || "Your Phone Number"}</div>
  <hr class="divider" />
  <img class="qr-code" src="${qrApiUrl}" alt="QR Code" />
  <p class="footer-label">Scan to save contact</p>
</div>
</body>
</html>
`;

      if (Platform.OS === "web") {
        const printWindow = window.open("", "_blank");
        if (!printWindow) throw new Error("Unable to open print window.");
        printWindow.document.write(htmlContent);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => {
          printWindow.print();
          printWindow.close();
        }, 500);
      } else {
        const { uri } = await Print.printToFileAsync({ html: htmlContent });
        await Sharing.shareAsync(uri, {
          UTI: ".pdf",
          mimeType: "application/pdf",
        });
      }
    } catch (error: any) {
      console.error("PDF Export Error:", error);
      Alert.alert("Error", "Failed to export PDF: " + error.message);
    } finally {
      setExporting(false);
    }
  };

  return (
    <Layout style={{ backgroundColor }}>
      <TopNav
        middleContent="Digital Identity"
        leftContent={
          <Ionicons name="chevron-back" size={22} color={textColor} />
        }
        leftAction={() => navigation.goBack()}
        rightContent={
          <Ionicons
            name={isDarkmode ? "sunny" : "moon"}
            size={20}
            color={textColor}
          />
        }
        rightAction={() => setTheme(isDarkmode ? "light" : "dark")}
      />

      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        showsVerticalScrollIndicator={false}
      >
        <View
          style={[
            styles.idCard,
            { backgroundColor: cardBackgroundColor, borderColor },
          ]}
        >
          <TouchableOpacity
            onPress={pickImage}
            disabled={!isEditing}
            activeOpacity={0.8}
            style={styles.profilePicWrapper}
          >
            {photoURL ? (
              <Image source={{ uri: photoURL }} style={styles.profilePic} />
            ) : (
              <View
                style={[
                  styles.placeholderPic,
                  { backgroundColor: isDarkmode ? "#0F172A" : "#F1F5F9" },
                ]}
              >
                <Ionicons name="person" size={48} color={subTextColor} />
              </View>
            )}

            {isEditing && (
              <View
                style={[styles.editIconBadge, { backgroundColor: accentColor }]}
              >
                <Ionicons name="camera" size={14} color="#FFF" />
              </View>
            )}
          </TouchableOpacity>

          <Text
            fontWeight="bold"
            style={StyleSheet.flatten([styles.nameText, { color: textColor }])}
          >
            {displayName || "Your Name"}
          </Text>

          <View style={styles.infoRow}>
            <Ionicons name="mail-outline" size={15} color={accentColor} />
            <Text
              style={StyleSheet.flatten([
                styles.infoText,
                { color: subTextColor },
              ])}
            >
              {email || "your.email@example.com"}
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Ionicons name="call-outline" size={15} color={accentColor} />
            <Text
              style={StyleSheet.flatten([
                styles.infoText,
                { color: subTextColor },
              ])}
            >
              {phone || "Your Phone Number"}
            </Text>
          </View>

          <View style={[styles.divider, { borderBottomColor: borderColor }]} />

          <View style={styles.qrWrapper}>
            <QRCode
              value={currentQrValue || "NA"}
              size={130}
              color="black"
              backgroundColor="white"
            />
          </View>

          <Text
            style={StyleSheet.flatten([
              styles.qrLabel,
              { color: subTextColor },
            ])}
          >
            Scan to save contact details
          </Text>
        </View>

        {isEditing ? (
          <View style={styles.formContainer}>
            <Text
              fontWeight="bold"
              style={StyleSheet.flatten([
                styles.inputLabel,
                { color: textColor },
              ])}
            >
              Display Name
            </Text>
            <TextInput
              value={displayName}
              onChangeText={setDisplayName}
              placeholder="Enter full name"
              containerStyle={styles.inputSpacing}
            />

            <Text
              fontWeight="bold"
              style={StyleSheet.flatten([
                styles.inputLabel,
                { color: textColor },
              ])}
            >
              Email Address
            </Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="Enter email address"
              autoCapitalize="none"
              keyboardType="email-address"
              containerStyle={styles.inputSpacing}
            />

            <Text
              fontWeight="bold"
              style={StyleSheet.flatten([
                styles.inputLabel,
                { color: textColor },
              ])}
            >
              Phone Number
            </Text>
            <TextInput
              value={phone}
              onChangeText={setPhone}
              placeholder="Enter phone number"
              keyboardType="phone-pad"
              containerStyle={styles.inputSpacing}
            />

            <Button
              text={loading ? "Saving Changes..." : "Save Details"}
              onPress={handleSave}
              style={StyleSheet.flatten([
                styles.actionButton,
                { backgroundColor: accentColor },
              ])}
              disabled={loading}
            />

            <Button
              text="Cancel"
              status="danger"
              onPress={handleCancel}
              style={styles.actionButton}
              disabled={loading}
              outline
            />
          </View>
        ) : (
          <View style={styles.actionContainer}>
            <Button
              text="Edit Profile"
              onPress={() => setIsEditing(true)}
              style={StyleSheet.flatten([
                styles.actionButton,
                { backgroundColor: accentColor },
              ])}
            />

            <View style={styles.gridRow}>
              <View style={styles.gridBtnItem}>
                <Button
                  text="QR Scanner"
                  onPress={() => navigation.navigate("ScanQR" as any)}
                  outline
                  leftContent={
                    <Ionicons
                      name="qr-code-outline"
                      size={16}
                      color={buttonIconColor}
                      style={{ marginRight: 6 }}
                    />
                  }
                />
              </View>

              <View style={styles.gridBtnItem}>
                <Button
                  text={exporting ? "Exporting..." : "Export PDF"}
                  onPress={handleExportPDF}
                  disabled={exporting}
                  outline
                  leftContent={
                    <Ionicons
                      name="document-text-outline"
                      size={16}
                      color={buttonIconColor}
                      style={{ marginRight: 6 }}
                    />
                  }
                />
              </View>
            </View>
          </View>
        )}
      </ScrollView>
    </Layout>
  );
}

const styles = StyleSheet.create({
  scrollContainer: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 40,
    alignItems: "center",
  },
  idCard: {
    width: "100%",
    borderRadius: 22,
    padding: 24,
    alignItems: "center",
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
    marginBottom: 20,
  },
  profilePicWrapper: {
    position: "relative",
    marginBottom: 14,
  },
  profilePic: {
    width: 96,
    height: 96,
    borderRadius: 48,
  },
  placeholderPic: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  editIconBadge: {
    position: "absolute",
    bottom: 2,
    right: 2,
    padding: 7,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: "#FFF",
  },
  nameText: {
    fontSize: 22,
    marginBottom: 6,
    textAlign: "center",
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },
  infoText: {
    fontSize: 13,
    marginLeft: 8,
    fontWeight: "500",
  },
  divider: {
    width: "85%",
    borderBottomWidth: 1,
    marginVertical: 18,
  },
  qrWrapper: {
    backgroundColor: "#FFF",
    padding: 12,
    borderRadius: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
    marginBottom: 8,
  },
  qrLabel: {
    fontSize: 12,
    marginTop: 4,
    fontWeight: "600",
  },
  formContainer: {
    width: "100%",
  },
  inputLabel: {
    marginBottom: 6,
    fontSize: 13,
  },
  inputSpacing: {
    marginBottom: 14,
  },
  actionContainer: {
    width: "100%",
  },
  actionButton: {
    marginBottom: 12,
  },
  gridRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  gridBtnItem: {
    flex: 0.485,
  },
});
