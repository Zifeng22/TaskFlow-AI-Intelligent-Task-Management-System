import React, { useEffect, useState } from "react";
import {
  View,
  StyleSheet,
  ActivityIndicator,
  Dimensions,
  ScrollView,
  TouchableOpacity,
} from "react-native";
import { MainStackParamList } from "../../types/navigation";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import {
  Layout,
  TopNav,
  Text,
  useTheme,
  themeColor,
} from "react-native-rapi-ui";
import { Ionicons } from "@expo/vector-icons";
import { getAuth } from "firebase/auth";
import {
  getFirestore,
  onSnapshot,
  collection,
  query,
  where,
} from "firebase/firestore";
import { LineChart } from "react-native-chart-kit";

const MONTH_LABELS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

export default function TaskChartScreen({
  navigation,
}: NativeStackScreenProps<MainStackParamList, "TaskProgressScreen">) {
  const { isDarkmode, setTheme } = useTheme();

  const auth = getAuth();
  const db = getFirestore();

  const [loading, setLoading] = useState<boolean>(true);
  const [chartData, setChartData] = useState<number[]>(new Array(12).fill(0));
  const [totalTasks, setTotalTasks] = useState<number>(0);
  const [priorityData, setPriorityData] = useState<Record<string, number>>({});
  const [statusData, setStatusData] = useState<Record<string, number>>({});
  const [creatorData, setCreatorData] = useState<Record<string, number>>({});

  // Interactive Zoom & Focus State
  const [isZoomed, setIsZoomed] = useState<boolean>(false);
  const [selectedMonthIndex, setSelectedMonthIndex] = useState<number>(
    new Date().getMonth(),
  );

  const screenWidth = Dimensions.get("window").width;

  // Dynamic Theme Palette
  const backgroundColor = isDarkmode ? themeColor.dark200 : "#F8FAFC";
  const cardBg = isDarkmode ? "#1E293B" : "#FFFFFF";
  const textColor = isDarkmode ? "#F8FAFC" : "#0F172A";
  const subTextColor = isDarkmode ? "#94A3B8" : "#64748B";
  const borderColor = isDarkmode ? "#334155" : "#E2E8F0";
  const accentColor = "#6366F1";

  const toggleTheme = () => {
    setTheme(isDarkmode ? "light" : "dark");
  };

  // Robust Date Parser for Firestore Timestamps, Strings, and Dates
  const convertToDate = (value: any): Date | null => {
    if (!value) return null;

    // Firestore Timestamp object
    if (typeof value.toDate === "function") {
      const date = value.toDate();
      return !isNaN(date.getTime()) ? date : null;
    }

    // Standard JS Date
    if (value instanceof Date) {
      return !isNaN(value.getTime()) ? value : null;
    }

    // Seconds object from Firestore raw JSON
    if (typeof value === "object" && value.seconds) {
      const date = new Date(value.seconds * 1000);
      return !isNaN(date.getTime()) ? date : null;
    }

    // String or Number Timestamp
    const date = new Date(value);
    return !isNaN(date.getTime()) ? date : null;
  };

  const formatDisplayText = (value: string) => {
    if (!value) return "Unknown";
    return value
      .replace(/_/g, " ")
      .replace(/\b\w/g, (letter) => letter.toUpperCase());
  };

  useEffect(() => {
    const currentUser = auth.currentUser;

    if (!currentUser) {
      setLoading(false);
      alert("You must be logged in to view chart.");
      return;
    }

    const q = query(
      collection(db, "Tasks"),
      where("assignedTo", "==", currentUser.uid),
    );

    const unsubscribe = onSnapshot(
      q,
      (querySnapshot) => {
        const monthlyData = new Array(12).fill(0);
        const newPriorityData: Record<string, number> = {};
        const newStatusData: Record<string, number> = {};
        const newCreatorData: Record<string, number> = {};

        let validTaskCount = 0;

        querySnapshot.forEach((document) => {
          const data = document.data();

          // Attempt multiple date fields so no task is missed
          const rawDate =
            data.startDate || data.createdAt || data.dueDate || data.updatedAt;

          const taskDate = convertToDate(rawDate) || new Date(); // Fallback to current date

          const monthIndex = taskDate.getMonth();
          if (monthIndex >= 0 && monthIndex <= 11) {
            monthlyData[monthIndex]++;
          }

          validTaskCount++;

          const priority = data.priority || "Low";
          newPriorityData[priority] = (newPriorityData[priority] || 0) + 1;

          const status = data.status || "Pending";
          newStatusData[status] = (newStatusData[status] || 0) + 1;

          const creator =
            data.CreatedUser?.CreatedUserName ||
            currentUser.displayName ||
            "Self";
          newCreatorData[creator] = (newCreatorData[creator] || 0) + 1;
        });

        setChartData(monthlyData);
        setTotalTasks(validTaskCount);
        setPriorityData(newPriorityData);
        setStatusData(newStatusData);
        setCreatorData(newCreatorData);
        setLoading(false);
      },
      (error) => {
        console.error("Error fetching chart data:", error);
        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, []);

  const renderBreakdown = (
    title: string,
    icon: keyof typeof Ionicons.glyphMap,
    data: Record<string, number>,
  ) => {
    const entries = Object.entries(data);

    return (
      <View style={[styles.card, { backgroundColor: cardBg, borderColor }]}>
        <View style={styles.cardHeader}>
          <View style={styles.iconContainer}>
            <Ionicons name={icon} size={18} color={accentColor} />
          </View>
          <Text
            fontWeight="bold"
            style={{ ...styles.cardTitle, color: textColor }}
          >
            {title}
          </Text>
        </View>

        {entries.length === 0 ? (
          <Text style={{ ...styles.noDataText, color: subTextColor }}>
            No data available
          </Text>
        ) : (
          entries.map(([key, value]) => {
            const percentage =
              totalTasks > 0 ? Math.round((value / totalTasks) * 100) : 0;

            return (
              <View key={key} style={styles.breakdownItem}>
                <View style={styles.breakdownRow}>
                  <Text style={{ ...styles.breakdownLabel, color: textColor }}>
                    {formatDisplayText(key)}
                  </Text>
                  <Text
                    fontWeight="bold"
                    style={{ ...styles.breakdownValue, color: textColor }}
                  >
                    {value} task(s) ({percentage}%)
                  </Text>
                </View>

                <View
                  style={[
                    styles.barBg,
                    { backgroundColor: isDarkmode ? "#334155" : "#E2E8F0" },
                  ]}
                >
                  <View
                    style={[
                      styles.barFill,
                      { width: `${percentage}%`, backgroundColor: accentColor },
                    ]}
                  />
                </View>
              </View>
            );
          })
        )}
      </View>
    );
  };

  const renderContent = () => {
    if (loading) {
      return (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={accentColor} />
          <Text style={{ ...styles.loadingText, color: subTextColor }}>
            Fetching task analytics...
          </Text>
        </View>
      );
    }

    if (totalTasks === 0) {
      return (
        <View style={styles.centerContainer}>
          <Ionicons name="bar-chart-outline" size={60} color={subTextColor} />
          <Text
            fontWeight="bold"
            style={{ ...styles.emptyTitle, color: textColor }}
          >
            No Task Data Found
          </Text>
          <Text style={{ ...styles.emptyText, color: subTextColor }}>
            You don't have any recorded tasks. Create new tasks to see detailed
            monthly performance graphs.
          </Text>
        </View>
      );
    }

    const maxVal = Math.max(...chartData);
    // Control segments to prevent rounding zeros/decimals on the Y-axis
    const segmentsCount = maxVal > 0 ? Math.min(maxVal, 4) : 1;
    const calculatedWidth = isZoomed
      ? Math.max(screenWidth * 1.8, 650)
      : screenWidth - 64;

    return (
      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* SUMMARY HERO BANNER */}
        <View
          style={[styles.summaryCard, { backgroundColor: cardBg, borderColor }]}
        >
          <View style={styles.summaryIconBox}>
            <Ionicons name="analytics" size={28} color={accentColor} />
          </View>
          <View style={styles.summaryTextContainer}>
            <Text style={{ ...styles.summaryLabel, color: subTextColor }}>
              TOTAL RECORDED TASKS
            </Text>
            <Text
              fontWeight="bold"
              style={{ ...styles.totalNumber, color: textColor }}
            >
              {totalTasks}
            </Text>
          </View>
        </View>

        {/* LINE CHART CONTAINER */}
        <View style={[styles.card, { backgroundColor: cardBg, borderColor }]}>
          <View style={styles.cardHeader}>
            <View style={styles.iconContainer}>
              <Ionicons name="trending-up" size={18} color={accentColor} />
            </View>
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text
                fontWeight="bold"
                style={{ ...styles.cardTitle, color: textColor }}
              >
                Monthly Task Trend
              </Text>
              <Text style={{ fontSize: 11, color: subTextColor }}>
                {isZoomed
                  ? "Zoomed view (Swipe chart horizontally)"
                  : "Tap graph points to focus month"}
              </Text>
            </View>

            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => setIsZoomed(!isZoomed)}
              style={[styles.zoomBtn, { backgroundColor: `${accentColor}18` }]}
            >
              <Ionicons
                name={isZoomed ? "contract-outline" : "expand-outline"}
                size={18}
                color={accentColor}
              />
            </TouchableOpacity>
          </View>

          {/* SWAPPABLE / ZOOMABLE CHART AREA */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={isZoomed}
            scrollEnabled={isZoomed}
          >
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={() => setIsZoomed(!isZoomed)}
            >
              <LineChart
                data={{
                  labels: MONTH_LABELS,
                  datasets: [
                    {
                      data: chartData,
                      strokeWidth: 3,
                    },
                  ],
                }}
                width={calculatedWidth}
                height={230}
                fromZero={true}
                segments={segmentsCount}
                yAxisInterval={1}
                onDataPointClick={({ index }) => {
                  setSelectedMonthIndex(index);
                }}
                chartConfig={{
                  backgroundColor: cardBg,
                  backgroundGradientFrom: cardBg,
                  backgroundGradientTo: cardBg,
                  decimalPlaces: 0,
                  color: (opacity = 1) => `rgba(99, 102, 241, ${opacity})`,
                  labelColor: () => subTextColor,
                  propsForDots: {
                    r: "6",
                    strokeWidth: "2",
                    stroke: accentColor,
                    fill: cardBg,
                  },
                  propsForBackgroundLines: {
                    stroke: borderColor,
                    strokeDasharray: "4",
                  },
                }}
                bezier
                style={styles.chart}
              />
            </TouchableOpacity>
          </ScrollView>

          {/* ACTIVE MONTH CALLOUT */}
          <View style={styles.selectedMonthBar}>
            <Ionicons name="calendar-outline" size={14} color={accentColor} />
            <Text
              style={{
                fontSize: 12,
                color: textColor,
                fontWeight: "700",
                marginLeft: 6,
              }}
            >
              {MONTH_LABELS[selectedMonthIndex]}:{" "}
              {chartData[selectedMonthIndex]} task(s)
            </Text>
          </View>
        </View>

        {/* CATEGORY BREAKDOWNS */}
        {renderBreakdown("Priority Breakdown", "flag-outline", priorityData)}
        {renderBreakdown(
          "Status Breakdown",
          "checkmark-circle-outline",
          statusData,
        )}
        {renderBreakdown("Created By", "person-outline", creatorData)}

        {/* MONTHLY BREAKDOWN TABLE */}
        <View style={[styles.card, { backgroundColor: cardBg, borderColor }]}>
          <View style={styles.cardHeader}>
            <View style={styles.iconContainer}>
              <Ionicons name="calendar" size={18} color={accentColor} />
            </View>
            <Text
              fontWeight="bold"
              style={{ ...styles.cardTitle, color: textColor }}
            >
              Monthly Distribution
            </Text>
          </View>

          {MONTH_LABELS.map((month, index) => (
            <View
              key={month}
              style={[
                styles.monthRow,
                { borderBottomColor: borderColor },
                index === MONTH_LABELS.length - 1 && { borderBottomWidth: 0 },
              ]}
            >
              <Text style={{ color: textColor, fontWeight: "600" }}>
                {month}
              </Text>
              <Text
                fontWeight="bold"
                style={{
                  color: chartData[index] > 0 ? accentColor : subTextColor,
                }}
              >
                {chartData[index]} task(s)
              </Text>
            </View>
          ))}
        </View>
      </ScrollView>
    );
  };

  return (
    <Layout style={{ backgroundColor }}>
      <TopNav
        middleContent="Task Analytics"
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
        rightAction={toggleTheme}
      />

      <View style={styles.container}>{renderContent()}</View>
    </Layout>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },

  loadingText: {
    marginTop: 12,
    fontSize: 14,
  },

  emptyTitle: {
    fontSize: 20,
    marginTop: 16,
    marginBottom: 8,
  },

  emptyText: {
    textAlign: "center",
    lineHeight: 22,
    fontSize: 14,
  },

  scrollContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 40,
  },

  summaryCard: {
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
    marginBottom: 14,
    flexDirection: "row",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },

  summaryIconBox: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(99, 102, 241, 0.12)",
    alignItems: "center",
    justifyContent: "center",
  },

  summaryTextContainer: {
    marginLeft: 14,
  },

  summaryLabel: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.8,
  },

  totalNumber: {
    fontSize: 26,
    marginTop: 2,
  },

  card: {
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
    marginBottom: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },

  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
  },

  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: "rgba(99, 102, 241, 0.12)",
    alignItems: "center",
    justifyContent: "center",
  },

  cardTitle: {
    fontSize: 15,
  },

  zoomBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },

  chart: {
    marginTop: 6,
    borderRadius: 12,
    alignSelf: "center",
  },

  selectedMonthBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "rgba(100, 116, 139, 0.15)",
  },

  breakdownItem: {
    marginBottom: 12,
  },

  breakdownRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6,
  },

  breakdownLabel: {
    fontSize: 13,
    fontWeight: "600",
  },

  breakdownValue: {
    fontSize: 13,
  },

  barBg: {
    height: 6,
    borderRadius: 3,
    overflow: "hidden",
  },

  barFill: {
    height: "100%",
    borderRadius: 3,
  },

  noDataText: {
    textAlign: "center",
    paddingVertical: 10,
    fontSize: 13,
  },

  monthRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 11,
    borderBottomWidth: 1,
  },
});
