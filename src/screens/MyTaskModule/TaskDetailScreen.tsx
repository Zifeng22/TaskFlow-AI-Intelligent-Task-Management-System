import React, { useEffect, useState } from "react";

import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
} from "react-native";

import {
  Layout,
  TopNav,
  Text,
  useTheme,
  themeColor,
} from "react-native-rapi-ui";

import { Ionicons } from "@expo/vector-icons";

import {
  getFirestore,
  doc,
  getDoc,
  updateDoc,
  deleteDoc,
  increment,
} from "firebase/firestore";

import { getAuth } from "firebase/auth";

import CssThinkingLoader from "../../components/utils/CssThinkingLoader";

export default function TaskDetailScreen({ route, navigation }: any) {
  const { isDarkmode, setTheme } = useTheme();

  const db = getFirestore();
  const auth = getAuth();

  const taskId = route.params?.taskId;

  const [loading, setLoading] = useState(true);
  const [task, setTask] = useState<any>(null);
  const [dependencyTitle, setDependencyTitle] = useState<string | null>(null);

  // ==========================================================
  // DESIGN TOKENS
  // ==========================================================

  const cardBg = isDarkmode ? "#1E293B" : "#FFFFFF";
  const innerBoxBg = isDarkmode ? "#0F172A" : "#F1F5F9";
  const textColor = isDarkmode ? "#F8FAFC" : "#0F172A";
  const subTextColor = isDarkmode ? "#94A3B8" : "#64748B";
  const borderColor = isDarkmode ? "#334155" : "#E2E8F0";
  const accentColor = "#6366F1";

  // ==========================================================
  // LOAD TASK & DEPENDENCY
  // ==========================================================

  useEffect(() => {
    loadTask();
  }, [taskId]);

  const loadTask = async () => {
    if (!taskId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      const taskRef = doc(db, "Tasks", taskId);
      const taskSnap = await getDoc(taskRef);

      if (!taskSnap.exists()) {
        Alert.alert("Task Not Found", "This task no longer exists.");
        navigation.goBack();
        return;
      }

      const data = taskSnap.data();

      setTask({
        taskId: taskSnap.id,
        ...data,
      });

      // Fetch Dependency Task Title if ID exists
      if (data.dependsOnTaskId) {
        fetchDependencyTitle(data.dependsOnTaskId);
      } else {
        setDependencyTitle(null);
      }
    } catch (error) {
      console.log("Load task error:", error);
      Alert.alert("Error", "Unable to load task details.");
    } finally {
      setLoading(false);
    }
  };

  const fetchDependencyTitle = async (depId: string) => {
    try {
      const depSnap = await getDoc(doc(db, "Tasks", depId));
      if (depSnap.exists()) {
        setDependencyTitle(depSnap.data().title || "Untitled Task");
      } else {
        setDependencyTitle("Unknown or Deleted Task");
      }
    } catch (error) {
      console.log("Fetch dependency title error:", error);
      setDependencyTitle("Unable to load task title");
    }
  };

  // ==========================================================
  // EDIT TASK
  // ==========================================================

  const editTask = () => {
    navigation.navigate("TaskEditScreen", {
      taskId: taskId,
    });
  };

  // ==========================================================
  // COMPLETE TASK
  // ==========================================================

  const completeTask = async () => {
    if (!task) return;

    if (task.status === "Completed") {
      Alert.alert("Already Completed", "This task has already been completed.");
      return;
    }

    const user = auth.currentUser;

    if (!user) {
      Alert.alert("Authentication Error", "Please log in again.");
      return;
    }

    try {
      // 1. Mark task completed
      await updateDoc(doc(db, "Tasks", taskId), {
        status: "Completed",
        progress: 100,
      });

      // 2. Increment user points and update rewards string attribute
      await updateDoc(doc(db, "Users", user.uid), {
        points: increment(50),
        rewards: "50", // Updates reward string from " " to "50"
      });

      setTask({
        ...task,
        status: "Completed",
        progress: 100,
      });

      Alert.alert("Task Completed!", "You earned 50 points!");
    } catch (error: any) {
      console.log("Complete task error:", error);
      Alert.alert("Error", error?.message || "Unable to complete this task.");
    }
  };

  // ==========================================================
  // DELETE TASK
  // ==========================================================

  const deleteTask = () => {
    Alert.alert("Delete Task", "Are you sure you want to delete this task?", [
      {
        text: "Cancel",
        style: "cancel",
      },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteDoc(doc(db, "Tasks", taskId));
            navigation.goBack();
          } catch (error) {
            console.log("Delete task error:", error);
            Alert.alert("Error", "Unable to delete the task.");
          }
        },
      },
    ]);
  };

  // ==========================================================
  // PRIORITY HELPERS
  // ==========================================================

  const getPriorityBadgeBg = () => {
    switch (task?.priority) {
      case "High":
        return "#EF4444";
      case "Medium":
        return "#F59E0B";
      case "Low":
        return "#22C55E";
      default:
        return "#64748B";
    }
  };

  const getPriorityIcon = () => {
    switch (task?.priority) {
      case "High":
        return "alert-circle-outline";
      case "Medium":
        return "remove-circle-outline";
      case "Low":
        return "arrow-down-circle-outline";
      default:
        return "help-circle-outline";
    }
  };

  // ==========================================================
  // LOADING SCREEN
  // ==========================================================

  if (loading) {
    return (
      <View
        style={[
          styles.centered,
          {
            backgroundColor: isDarkmode ? themeColor.dark200 : "#F8FAFC",
          },
        ]}
      >
        <CssThinkingLoader isDarkmode={isDarkmode} size={44} speed={1.5} />
      </View>
    );
  }

  if (!task) {
    return null;
  }

  // ==========================================================
  // MAIN UI
  // ==========================================================

  return (
    <Layout
      style={{
        backgroundColor: isDarkmode ? themeColor.dark200 : "#F8FAFC",
      }}
    >
      <TopNav
        middleContent="Task Details"
        leftContent={
          <Ionicons name="chevron-back" size={24} color={textColor} />
        }
        leftAction={() => navigation.goBack()}
        rightContent={
          <View style={styles.headerActions}>
            <TouchableOpacity onPress={editTask} style={styles.headerButton}>
              <Ionicons name="create-outline" size={22} color={textColor} />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setTheme(isDarkmode ? "light" : "dark")}
              style={styles.headerButton}
            >
              <Ionicons
                name={isDarkmode ? "sunny" : "moon"}
                size={20}
                color={textColor}
              />
            </TouchableOpacity>
          </View>
        }
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* HERO CARD */}
        <View
          style={[styles.heroCard, { backgroundColor: cardBg, borderColor }]}
        >
          <View
            style={[
              styles.statusIconContainer,
              {
                backgroundColor:
                  task.status === "Completed" ? "#22C55E" : `${accentColor}20`,
                borderColor:
                  task.status === "Completed" ? "#22C55E" : accentColor,
              },
            ]}
          >
            <Ionicons
              name={task.status === "Completed" ? "checkmark" : "time-outline"}
              size={28}
              color={task.status === "Completed" ? "#FFFFFF" : accentColor}
            />
          </View>

          <View style={styles.heroTextContainer}>
            <Text
              fontWeight="bold"
              style={{
                ...styles.title,
                color: textColor,
                ...(task.status === "Completed" ? styles.completedTitle : {}),
              }}
            >
              {task.title || "Untitled Task"}
            </Text>

            <View style={styles.categoryBadge}>
              <Ionicons name="folder-outline" size={12} color={subTextColor} />
              <Text style={{ ...styles.categoryText, color: subTextColor }}>
                {task.category || "General"}
              </Text>
            </View>
          </View>
        </View>

        {/* PRIORITY & IMPORTANCE CARD */}
        <View
          style={[
            styles.priorityCard,
            { backgroundColor: getPriorityBadgeBg() },
          ]}
        >
          <View style={styles.priorityLeft}>
            <Ionicons
              name={getPriorityIcon() as any}
              size={22}
              color="#FFFFFF"
            />
            <Text fontWeight="bold" style={styles.priorityText}>
              {task.priority || "Not Specified"} Priority
            </Text>
          </View>

          <View style={styles.importanceBadge}>
            <Ionicons
              name="star"
              size={13}
              color="#FBBF24"
              style={{ marginRight: 4 }}
            />
            <Text style={styles.importanceText}>
              Importance {task.importance ?? 0}/5
            </Text>
          </View>
        </View>

        {/* STATUS & PROGRESS */}
        <View style={styles.rowContainer}>
          <View
            style={[
              styles.smallCard,
              { backgroundColor: cardBg, borderColor, marginRight: 6 },
            ]}
          >
            <View
              style={[
                styles.smallCardIcon,
                { backgroundColor: `${accentColor}15` },
              ]}
            >
              <Ionicons name="flag-outline" size={20} color={accentColor} />
            </View>
            <Text style={{ ...styles.smallCardLabel, color: subTextColor }}>
              STATUS
            </Text>
            <Text
              fontWeight="bold"
              style={{ ...styles.smallCardValue, color: textColor }}
            >
              {task.status || "Pending"}
            </Text>
          </View>

          <View
            style={[
              styles.smallCard,
              { backgroundColor: cardBg, borderColor, marginLeft: 6 },
            ]}
          >
            <View
              style={[
                styles.smallCardIcon,
                { backgroundColor: `${accentColor}15` },
              ]}
            >
              <Ionicons
                name="speedometer-outline"
                size={20}
                color={accentColor}
              />
            </View>
            <Text style={{ ...styles.smallCardLabel, color: subTextColor }}>
              PROGRESS
            </Text>
            <Text
              fontWeight="bold"
              style={{ ...styles.smallCardValue, color: textColor }}
            >
              {task.progress ?? 0}%
            </Text>
          </View>
        </View>

        {/* DESCRIPTION */}
        <View style={[styles.card, { backgroundColor: cardBg, borderColor }]}>
          <View style={styles.cardHeader}>
            <Ionicons
              name="document-text-outline"
              size={20}
              color={accentColor}
            />
            <Text
              fontWeight="bold"
              style={{ ...styles.cardTitle, color: textColor }}
            >
              Description
            </Text>
          </View>

          <Text style={{ ...styles.description, color: subTextColor }}>
            {task.description?.trim()
              ? task.description
              : "No description provided for this task."}
          </Text>
        </View>

        {/* TASK INFORMATION */}
        <View style={[styles.card, { backgroundColor: cardBg, borderColor }]}>
          <View style={styles.cardHeader}>
            <Ionicons
              name="information-circle-outline"
              size={20}
              color={accentColor}
            />
            <Text
              fontWeight="bold"
              style={{ ...styles.cardTitle, color: textColor }}
            >
              Task Information
            </Text>
          </View>

          {/* START DATE */}
          <View style={[styles.detailRow, { borderBottomColor: borderColor }]}>
            <View style={styles.detailLeft}>
              <Ionicons name="play-outline" size={18} color={subTextColor} />
              <Text style={{ ...styles.detailLabel, color: subTextColor }}>
                Start Date
              </Text>
            </View>
            <Text
              fontWeight="bold"
              style={{ ...styles.detailValue, color: textColor }}
            >
              {task.startDate || "Not specified"}
            </Text>
          </View>

          {/* DUE DATE */}
          <View style={[styles.detailRow, { borderBottomColor: borderColor }]}>
            <View style={styles.detailLeft}>
              <Ionicons
                name="calendar-outline"
                size={18}
                color={subTextColor}
              />
              <Text style={{ ...styles.detailLabel, color: subTextColor }}>
                Due Date
              </Text>
            </View>
            <Text
              fontWeight="bold"
              style={{ ...styles.detailValue, color: textColor }}
            >
              {task.dueDate || "Not specified"}
            </Text>
          </View>

          {/* IMPORTANCE */}
          <View style={[styles.detailRow, { borderBottomColor: borderColor }]}>
            <View style={styles.detailLeft}>
              <Ionicons name="star-outline" size={18} color={subTextColor} />
              <Text style={{ ...styles.detailLabel, color: subTextColor }}>
                Importance Rating
              </Text>
            </View>
            <Text
              fontWeight="bold"
              style={{ ...styles.detailValue, color: textColor }}
            >
              {task.importance !== undefined && task.importance !== null
                ? `${task.importance} / 5`
                : "Not specified"}
            </Text>
          </View>

          {/* CATEGORY */}
          <View style={[styles.detailRow, { borderBottomWidth: 0 }]}>
            <View style={styles.detailLeft}>
              <Ionicons
                name="pricetag-outline"
                size={18}
                color={subTextColor}
              />
              <Text style={{ ...styles.detailLabel, color: subTextColor }}>
                Category
              </Text>
            </View>
            <Text
              fontWeight="bold"
              style={{ ...styles.detailValue, color: textColor }}
            >
              {task.category || "Not specified"}
            </Text>
          </View>
        </View>

        {/* DEPENDENCY */}
        <View style={[styles.card, { backgroundColor: cardBg, borderColor }]}>
          <View style={styles.cardHeader}>
            <Ionicons name="git-branch-outline" size={20} color={accentColor} />
            <Text
              fontWeight="bold"
              style={{ ...styles.cardTitle, color: textColor }}
            >
              Dependency
            </Text>
          </View>

          <View
            style={[
              styles.dependencyBox,
              { backgroundColor: innerBoxBg, borderColor },
            ]}
          >
            <Ionicons
              name={
                task.dependsOnTaskId
                  ? "link-outline"
                  : "checkmark-circle-outline"
              }
              size={20}
              color={task.dependsOnTaskId ? "#F59E0B" : "#22C55E"}
            />

            <View style={{ marginLeft: 10, flex: 1 }}>
              <Text style={{ ...styles.dependencyText, color: textColor }}>
                {task.dependsOnTaskId
                  ? dependencyTitle || "Loading dependent task..."
                  : "No blocking dependency"}
              </Text>
            </View>
          </View>
        </View>

        {/* ACTION BUTTONS */}
        <TouchableOpacity
          style={[styles.button, styles.editButton]}
          onPress={editTask}
          activeOpacity={0.8}
        >
          <Ionicons name="create-outline" size={20} color="#FFFFFF" />
          <Text style={styles.buttonText}>Edit Task</Text>
        </TouchableOpacity>

        {task.status !== "Completed" && (
          <TouchableOpacity
            style={[styles.button, styles.completeButton]}
            onPress={completeTask}
            activeOpacity={0.8}
          >
            <Ionicons
              name="checkmark-circle-outline"
              size={20}
              color="#FFFFFF"
            />
            <Text style={styles.buttonText}>Complete Task (+50 Pts)</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[styles.button, styles.deleteButton]}
          onPress={deleteTask}
          activeOpacity={0.8}
        >
          <Ionicons name="trash-outline" size={20} color="#FFFFFF" />
          <Text style={styles.buttonText}>Delete Task</Text>
        </TouchableOpacity>
      </ScrollView>
    </Layout>
  );
}

// ============================================================
// STYLES
// ============================================================

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },

  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 50,
  },

  headerActions: {
    flexDirection: "row",
    alignItems: "center",
  },

  headerButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 4,
  },

  // HERO CARD
  heroCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
    marginBottom: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },

  statusIconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
    borderWidth: 1,
  },

  heroTextContainer: {
    flex: 1,
  },

  title: {
    fontSize: 20,
    lineHeight: 26,
  },

  completedTitle: {
    textDecorationLine: "line-through",
    opacity: 0.7,
  },

  categoryBadge: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 5,
  },

  categoryText: {
    fontSize: 12,
    fontWeight: "600",
    marginLeft: 4,
  },

  // PRIORITY CARD
  priorityCard: {
    minHeight: 52,
    borderRadius: 14,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },

  priorityLeft: {
    flexDirection: "row",
    alignItems: "center",
  },

  priorityText: {
    color: "#FFFFFF",
    marginLeft: 8,
    fontSize: 14,
    fontWeight: "700",
  },

  importanceBadge: {
    backgroundColor: "rgba(0,0,0,0.2)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    flexDirection: "row",
    alignItems: "center",
  },

  importanceText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },

  // STATUS & PROGRESS
  rowContainer: {
    flexDirection: "row",
    marginBottom: 14,
  },

  smallCard: {
    flex: 1,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },

  smallCardIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },

  smallCardLabel: {
    fontSize: 10,
    letterSpacing: 0.8,
    marginBottom: 4,
    fontWeight: "800",
  },

  smallCardValue: {
    fontSize: 15,
  },

  // GENERAL CARD
  card: {
    borderRadius: 16,
    padding: 16,
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
    marginBottom: 12,
  },

  cardTitle: {
    fontSize: 15,
    marginLeft: 8,
  },

  description: {
    fontSize: 14,
    lineHeight: 22,
  },

  // INFORMATION ROWS
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderBottomWidth: 1,
  },

  detailLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },

  detailLabel: {
    marginLeft: 10,
    fontSize: 13,
    fontWeight: "600",
  },

  detailValue: {
    fontSize: 13,
    maxWidth: "50%",
    textAlign: "right",
  },

  // DEPENDENCY
  dependencyBox: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },

  dependencyText: {
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 18,
  },

  // BUTTONS
  button: {
    minHeight: 50,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 3,
  },

  editButton: {
    backgroundColor: "#6366F1",
  },

  completeButton: {
    backgroundColor: "#22C55E",
  },

  deleteButton: {
    backgroundColor: "#EF4444",
  },

  buttonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
    marginLeft: 6,
  },
});
