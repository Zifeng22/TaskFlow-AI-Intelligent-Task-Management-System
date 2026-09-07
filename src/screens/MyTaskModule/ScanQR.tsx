import React, { useState } from "react";
import {
  View,
  StyleSheet,
  Alert,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";

import { CameraView, useCameraPermissions } from "expo-camera";
import * as Contacts from "expo-contacts";

import {
  Layout,
  TopNav,
  Text,
  Button,
  useTheme,
  themeColor,
} from "react-native-rapi-ui";

import { Ionicons } from "@expo/vector-icons";

import { MainStackParamList } from "../../types/navigation";
import { NativeStackScreenProps } from "@react-navigation/native-stack";

type ScannedContact = {
  displayName: string;
  email: string;
  phone: string;
};

export default function ScanQR({
  navigation,
}: NativeStackScreenProps<MainStackParamList, "ScanQR">) {
  const { isDarkmode, setTheme } = useTheme();

  const [permission, requestPermission] = useCameraPermissions();

  const [scanned, setScanned] = useState(false);
  const [scannedContact, setScannedContact] = useState<ScannedContact | null>(
    null,
  );

  const [addingContact, setAddingContact] = useState(false);

  // =========================================================
  // THEME
  // =========================================================

  const toggleTheme = () => {
    setTheme(isDarkmode ? "light" : "dark");
  };

  // =========================================================
  // REQUEST CAMERA PERMISSION
  // =========================================================

  if (!permission) {
    return (
      <Layout>
        <View style={styles.center}>
          <ActivityIndicator size="large" />
        </View>
      </Layout>
    );
  }

  if (!permission.granted) {
    return (
      <Layout>
        <TopNav
          middleContent="Scan QR"
          leftContent={
            <Ionicons
              name="chevron-back"
              size={20}
              color={isDarkmode ? themeColor.white100 : themeColor.dark}
            />
          }
          leftAction={() => navigation.goBack()}
          rightContent={
            <Ionicons
              name={isDarkmode ? "sunny" : "moon"}
              size={20}
              color={isDarkmode ? themeColor.white100 : themeColor.dark}
            />
          }
          rightAction={toggleTheme}
        />

        <View style={styles.permissionContainer}>
          <Ionicons
            name="camera-outline"
            size={70}
            color={isDarkmode ? "#FFFFFF" : "#333333"}
          />

          <Text fontWeight="bold" size="h3" style={styles.permissionTitle}>
            Camera Permission Required
          </Text>

          <Text style={styles.permissionText}>
            My Memory Buddy needs access to your camera to scan contact QR
            codes.
          </Text>

          <Button
            text="Allow Camera"
            onPress={requestPermission}
            style={styles.permissionButton}
          />
        </View>
      </Layout>
    );
  }

  // =========================================================
  // HANDLE QR SCAN
  // =========================================================

  const handleBarcodeScanned = ({ data }: { data: string }) => {
    if (scanned) {
      return;
    }

    try {
      console.log("QR DATA:", data);

      const parsedData = JSON.parse(data);

      const contact: ScannedContact = {
        displayName:
          typeof parsedData.displayName === "string"
            ? parsedData.displayName.trim()
            : "",

        email:
          typeof parsedData.email === "string" ? parsedData.email.trim() : "",

        phone:
          typeof parsedData.phone === "string" ? parsedData.phone.trim() : "",
      };

      // Check required information
      if (!contact.displayName && !contact.email && !contact.phone) {
        throw new Error(
          "This QR code does not contain valid contact information.",
        );
      }

      setScanned(true);
      setScannedContact(contact);
    } catch (error) {
      console.error("QR Scan Error:", error);

      Alert.alert(
        "Invalid QR Code",
        "This QR code does not contain a valid Memory Buddy contact.",
      );

      // Allow scanning again
      setScanned(false);
    }
  };

  // =========================================================
  // ADD CONTACT
  // =========================================================

  const handleAddContact = async () => {
    if (!scannedContact || addingContact) {
      return;
    }

    try {
      setAddingContact(true);

      const { status } = await Contacts.requestPermissionsAsync();

      if (status !== "granted") {
        Alert.alert("Permission Required", "Please allow contact access.");
        return;
      }

      // Get the account name from QR
      const fullName = scannedContact.displayName.trim();

      if (!fullName) {
        Alert.alert("Error", "The scanned QR code does not contain a name.");
        return;
      }

      // Split full name
      const nameParts = fullName.split(/\s+/);

      const firstName = nameParts[0] || "";

      const lastName = nameParts.slice(1).join(" ") || "";

      // Create contact
      // Create contact object matching the legacy Contacts definition expected by addContactAsync
      const contact = {
        contactType: Contacts.ContactTypes.Person,
        name: fullName,
        firstName: firstName,
        lastName: lastName,
        emails: scannedContact.email
          ? [
              {
                label: "email",
                email: scannedContact.email,
              },
            ]
          : [],
        phoneNumbers: scannedContact.phone
          ? [
              {
                label: "mobile",
                number: scannedContact.phone,
              },
            ]
          : [],
      } as any;

      await Contacts.addContactAsync(contact);

      console.log("CONTACT TO ADD:", contact);

      await Contacts.addContactAsync(contact);

      Alert.alert(
        "Contact Added",
        `${fullName} has been added to your phone contacts.`,
        [
          {
            text: "OK",
            onPress: () => {
              setScanned(false);
              setScannedContact(null);
            },
          },
        ],
      );
    } catch (error) {
      console.error("Contact Error:", error);

      Alert.alert("Error", "Unable to add this contact.");
    } finally {
      setAddingContact(false);
    }
  };

  // =========================================================
  // SCAN AGAIN
  // =========================================================

  const handleScanAgain = () => {
    setScanned(false);
    setScannedContact(null);
  };

  // =========================================================
  // UI
  // =========================================================

  return (
    <Layout>
      <TopNav
        middleContent="Scan QR"
        leftContent={
          <Ionicons
            name="chevron-back"
            size={20}
            color={isDarkmode ? themeColor.white100 : themeColor.dark}
          />
        }
        leftAction={() => navigation.goBack()}
        rightContent={
          <Ionicons
            name={isDarkmode ? "sunny" : "moon"}
            size={20}
            color={isDarkmode ? themeColor.white100 : themeColor.dark}
          />
        }
        rightAction={toggleTheme}
      />

      {!scanned ? (
        // =====================================================
        // CAMERA
        // =====================================================

        <View style={styles.cameraContainer}>
          <CameraView
            style={styles.camera}
            facing="back"
            barcodeScannerSettings={{
              barcodeTypes: ["qr"],
            }}
            onBarcodeScanned={scanned ? undefined : handleBarcodeScanned}
          >
            <View style={styles.cameraOverlay}>
              <View style={styles.scanBox} />

              <Text style={styles.scanInstruction} fontWeight="bold">
                Scan Memory Buddy QR Code
              </Text>

              <Text style={styles.scanSubInstruction}>
                Place the QR code inside the box
              </Text>
            </View>
          </CameraView>
        </View>
      ) : (
        // =====================================================
        // SCANNED CONTACT
        // =====================================================

        <View style={styles.resultContainer}>
          <View
            style={{
              ...styles.contactCard,
              backgroundColor: isDarkmode ? "#1E1E1E" : "#FFFFFF",
            }}
          >
            <View style={styles.contactIcon}>
              <Ionicons
                name="person"
                size={45}
                color={isDarkmode ? "#FFFFFF" : "#333333"}
              />
            </View>

            <Text fontWeight="bold" size="h3" style={styles.contactName}>
              {scannedContact?.displayName || "Unknown Contact"}
            </Text>

            {/* EMAIL */}

            {scannedContact?.email ? (
              <View style={styles.infoRow}>
                <Ionicons
                  name="mail-outline"
                  size={20}
                  color={isDarkmode ? "#AAAAAA" : "#666666"}
                />

                <Text style={styles.infoText}>{scannedContact.email}</Text>
              </View>
            ) : null}

            {/* PHONE */}

            {scannedContact?.phone ? (
              <View style={styles.infoRow}>
                <Ionicons
                  name="call-outline"
                  size={20}
                  color={isDarkmode ? "#AAAAAA" : "#666666"}
                />

                <Text style={styles.infoText}>{scannedContact.phone}</Text>
              </View>
            ) : null}

            {/* DIVIDER */}

            <View
              style={{
                ...styles.divider,
                backgroundColor: isDarkmode ? "#333333" : "#EEEEEE",
              }}
            />

            {/* ADD CONTACT */}

            <Button
              text={
                addingContact ? "Adding Contact..." : "Add to Phone Contacts"
              }
              onPress={handleAddContact}
              disabled={addingContact}
              style={styles.addButton}
            />

            {/* SCAN AGAIN */}

            <TouchableOpacity
              onPress={handleScanAgain}
              disabled={addingContact}
              style={styles.scanAgainButton}
            >
              <Ionicons
                name="scan-outline"
                size={20}
                color={isDarkmode ? "#FFFFFF" : "#333333"}
              />

              <Text style={styles.scanAgainText}>Scan Another QR Code</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </Layout>
  );
}

// =========================================================
// STYLES
// =========================================================

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },

  // =======================================================
  // PERMISSION
  // =======================================================

  permissionContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 30,
  },

  permissionTitle: {
    marginTop: 20,
    textAlign: "center",
  },

  permissionText: {
    marginTop: 15,
    textAlign: "center",
    lineHeight: 22,
  },

  permissionButton: {
    marginTop: 25,
    width: "80%",
  },

  // =======================================================
  // CAMERA
  // =======================================================

  cameraContainer: {
    flex: 1,
    overflow: "hidden",
  },

  camera: {
    flex: 1,
  },

  cameraOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.25)",
  },

  scanBox: {
    width: 260,
    height: 260,
    borderWidth: 3,
    borderColor: "#FFFFFF",
    borderRadius: 20,
    backgroundColor: "transparent",
  },

  scanInstruction: {
    color: "#FFFFFF",
    fontSize: 18,
    marginTop: 30,
    textAlign: "center",
  },

  scanSubInstruction: {
    color: "#FFFFFF",
    fontSize: 14,
    marginTop: 10,
    textAlign: "center",
  },

  // =======================================================
  // RESULT
  // =======================================================

  resultContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },

  contactCard: {
    width: "100%",
    maxWidth: 450,
    borderRadius: 20,
    padding: 30,
    alignItems: "center",

    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.1,
    shadowRadius: 10,

    elevation: 5,
  },

  contactIcon: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: "#EEEEEE",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },

  contactName: {
    textAlign: "center",
    marginBottom: 20,
  },

  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    marginBottom: 12,
  },

  infoText: {
    marginLeft: 12,
    flex: 1,
    fontSize: 15,
  },

  divider: {
    width: "100%",
    height: 1,
    marginVertical: 20,
  },

  addButton: {
    width: "100%",
  },

  scanAgainButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 20,
    padding: 10,
  },

  scanAgainText: {
    marginLeft: 8,
    fontSize: 14,
  },
});
