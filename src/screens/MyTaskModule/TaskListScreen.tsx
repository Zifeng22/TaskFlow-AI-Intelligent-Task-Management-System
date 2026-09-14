import React, { useState, useEffect, useMemo } from "react";
import {
  View,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  TextInput as RNTextInput,
  Text as RNText,
  Alert,
  ScrollView,
} from "react-native";

import { Layout, TopNav, useTheme, themeColor } from "react-native-rapi-ui";
import { Ionicons } from "@expo/vector-icons";

import {
  getFirestore,
  collection,
  query,
  where,
  onSnapshot,
  doc,
  updateDoc,
  deleteDoc,
  increment,
} from "firebase/firestore";

import { getAuth } from "firebase/auth";
import OpenAI from "openai";

import CssThinkingLoader from "../../components/utils/CssThinkingLoader";
import { TaskData } from "../../types/navigation";
import { GROQ_CONFIG } from "../../../keys";

// Initialize OpenAI client for Groq API calls
const groq = new OpenAI({
  baseURL: GROQ_CONFIG.BASE_URL,
  apiKey: GROQ_CONFIG.API_KEY,
  dangerouslyAllowBrowser: true, // Necessary for React Native mobile environments
});

export default function TaskListScreen({ navigation }: any) {
  const { isDarkmode, setTheme } = useTheme();

  const auth = getAuth();
  const db = getFirestore();

  // ==========================================================
  // STATE
  // ==========================================================

  const [loading, setLoading] = useState(true);
  const [tasks, setTasks] = useState<TaskData[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isAiSearching, setIsAiSearching] = useState(false);
  const [aiMatchedKeys, setAiMatchedKeys] = useState<string[] | null>(null);

  const [aiRecommendation, setAiRecommendation] = useState<{
    taskId: string;
    reason: string;
  } | null>(null);

  const [isAiRecommending, setIsAiRecommending] = useState(false);

  // Selected tasks
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
  const [selectionMode, setSelectionMode] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // ==========================================================
  // DESIGN TOKENS
  // ==========================================================

  const backgroundColor = isDarkmode ? "#0F172A" : "#F8FAFC";
  const cardColor = isDarkmode ? "#1E293B" : "#FFFFFF";
  const textColor = isDarkmode ? "#F8FAFC" : "#0F172A";
  const subTextColor = isDarkmode ? "#94A3B8" : "#64748B";
  const borderColor = isDarkmode ? "#334155" : "#E2E8F0";
  const accentColor = "#6366F1";

  // ==========================================================
  // FETCH TASKS
  // ==========================================================

  useEffect(() => {
    const user = auth.currentUser;

    if (!user) {
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, "Tasks"),
      where("assignedTo", "==", user.uid),
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const fetchedTasks = snapshot.docs.map((taskDoc) => ({
          taskId: taskDoc.id,
          ...taskDoc.data(),
        })) as TaskData[];

        setTasks(fetchedTasks);
        setLoading(false);
      },
      (error) => {
        console.log("Task listener error:", error);
        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, []);

  // ==========================================================
  // DATE HELPERS
  // ==========================================================

  const getToday = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
  };

  const getParsedDate = (dateString: string) => {
    if (!dateString) {
      return null;
    }

    const date = new Date(`${dateString}T00:00:00`);

    if (isNaN(date.getTime())) {
      return null;
    }

    return date;
  };

  // ==========================================================
  // TASK URGENCY
  // ==========================================================

  const getTaskUrgency = (
    task: TaskData,
  ):
    | "completed"
    | "overdue"
    | "within_1_week"
    | "within_2_weeks"
    | "within_1_month"
    | "more_than_1_month"
    | "normal" => {
    if (task.status === "Completed") {
      return "completed";
    }

    const dueDate = getParsedDate(task.dueDate);

    if (!dueDate) {
      return "normal";
    }

    const today = getToday();
    const difference = dueDate.getTime() - today.getTime();
    const daysLeft = difference / (1000 * 60 * 60 * 24);

    if (daysLeft < 0) {
      return "overdue";
    }

    if (daysLeft <= 7) {
      return "within_1_week";
    }

    if (daysLeft <= 14) {
      return "within_2_weeks";
    }

    if (daysLeft <= 30) {
      return "within_1_month";
    }

    return "more_than_1_month";
  };

  // ==========================================================
  // URGENCY COLOUR
  // ==========================================================

  const getUrgencyColor = (task: TaskData) => {
    const urgency = getTaskUrgency(task);

    if (urgency === "overdue") {
      return "#991B1B";
    }

    if (urgency === "within_1_week") {
      return "#EF4444";
    }

    if (urgency === "within_2_weeks") {
      return "#EC4899";
    }

    if (urgency === "within_1_month") {
      return "#EAB308";
    }

    if (urgency === "more_than_1_month" || urgency === "completed") {
      return "#22C55E";
    }

    return borderColor;
  };

  // ==========================================================
  // URGENCY LABEL
  // ==========================================================

  const getUrgencyLabel = (task: TaskData) => {
    const urgency = getTaskUrgency(task);

    if (urgency === "overdue") {
      return "OVERDUE";
    }

    if (urgency === "within_1_week") {
      return "DUE SOON";
    }

    if (urgency === "within_2_weeks") {
      return "DUE IN 2 WEEKS";
    }

    if (urgency === "within_1_month") {
      return "DUE THIS MONTH";
    }

    if (urgency === "more_than_1_month") {
      return "FUTURE";
    }

    if (urgency === "completed") {
      return "COMPLETED";
    }

    return "";
  };

  // ==========================================================
  // PRIORITY SCORE (ENHANCED ALGORITHM)
  // ==========================================================

  const calculatePriorityScore = (task: TaskData, allTasks: TaskData[]) => {
    let score = 0;

    // 1. Deadline Urgency (Heavy Weight)
    const dueDate = getParsedDate(task.dueDate);
    if (dueDate) {
      const today = getToday();
      const daysLeft =
        (dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24);

      if (daysLeft < 0)
        score += 100; // Overdue: Top Priority
      else if (daysLeft === 0)
        score += 80; // Due Today
      else if (daysLeft <= 3)
        score += 60; // Due in 3 days
      else if (daysLeft <= 7)
        score += 40; // Due this week
      else if (daysLeft <= 14)
        score += 20; // Due in 2 weeks
      else score += 5; // Far future
    }

    // 2. User Priority Rating
    if (task.priority === "High") score += 25;
    else if (task.priority === "Medium") score += 15;
    else score += 5;

    // 3. User Importance (1-5)
    score += (Number(task.importance) || 3) * 4; // Max 20 points

    // 4. Dependency Blocker
    if (task.dependsOnTaskId) {
      const parentTask = allTasks.find(
        (t) => t.taskId === task.dependsOnTaskId,
      );
      if (parentTask && parentTask.status !== "Completed") {
        score -= 80; // Penalize if blocked by incomplete parent task
      }
    }

    if (task.status === "Completed") score = -100;

    return score;
  };

  // ==========================================================
  // AI SEMANTIC SEARCH
  // ==========================================================

  useEffect(() => {
    const q = searchQuery.trim();

    if (!q || q.length < 2 || tasks.length === 0) {
      setAiMatchedKeys(null);
      setIsAiSearching(false);
      return;
    }

    setIsAiSearching(true);

    const timer = setTimeout(async () => {
      try {
        const candidateList = tasks.map((task) => ({
          id: task.taskId,
          title: task.title,
          category: task.category,
          description: task.description,
          priority: task.priority,
          importance: task.importance,
          status: task.status,
          startDate: task.startDate,
          dueDate: task.dueDate,
        }));

        const systemPrompt = {
          role: "system" as const,
          content: `You are an AI search assistant. Return ONLY a valid JSON array of matching task ID strings. Do NOT wrap output in markdown blocks or extra text.
Example: ["task123", "task456"]`,
        };

        const userPrompt = {
          role: "user" as const,
          content: `Search query: "${q}"
Tasks: ${JSON.stringify(candidateList)}`,
        };

        const response = await groq.chat.completions.create({
          model: GROQ_CONFIG.MODEL,
          messages: [systemPrompt, userPrompt],
          temperature: 0.2,
          response_format: { type: "json_object" },
        });

        const content = response.choices[0]?.message?.content;

        if (!content) {
          throw new Error("Groq returned an empty response.");
        }

        const parsed = JSON.parse(content);
        const parsedKeys = Array.isArray(parsed)
          ? parsed
          : parsed.tasks || parsed.matchedKeys || [];

        if (Array.isArray(parsedKeys)) {
          setAiMatchedKeys(parsedKeys);
        } else {
          setAiMatchedKeys([]);
        }
      } catch (error) {
        console.log("AI Search Error:", error);
        setAiMatchedKeys(null);
      } finally {
        setIsAiSearching(false);
      }
    }, 700);

    return () => clearTimeout(timer);
  }, [searchQuery, tasks]);

  // ==========================================================
  // PROCESSED TASKS
  // ==========================================================

  const processedTasks = useMemo(() => {
    let filtered = tasks;

    if (searchQuery.trim().length > 1 && aiMatchedKeys) {
      filtered = filtered.filter((task) => aiMatchedKeys.includes(task.taskId));
    }

    const tasksWithScores = filtered.map((task) => ({
      ...task,
      aiScore: calculatePriorityScore(task, tasks),
    }));

    return tasksWithScores.sort((a, b) => b.aiScore - a.aiScore);
  }, [tasks, searchQuery, aiMatchedKeys]);

  // ==========================================================
  // AI TASK RECOMMENDATION (ENHANCED PROMPT)
  // ==========================================================

  const handleAiRecommendation = async () => {
    const incompleteTasks = tasks.filter((task) => task.status !== "Completed");

    if (incompleteTasks.length === 0) {
      Alert.alert(
        "AI Recommendation",
        "All tasks have already been completed.",
      );
      return;
    }

    setIsAiRecommending(true);

    try {
      const taskInformation = incompleteTasks.map((task) => ({
        id: task.taskId,
        title: task.title,
        description: task.description,
        category: task.category,
        priority: task.priority,
        importance: task.importance,
        status: task.status,
        progress: task.progress,
        startDate: task.startDate,
        dueDate: task.dueDate,
        dependsOnTaskId: task.dependsOnTaskId || null,
        calculatedScore: calculatePriorityScore(task, tasks),
      }));

      const systemPrompt = {
        role: "system" as const,
        content: `You are an expert project manager. Determine which task the user must complete FIRST using these strict rules:
1. OVERDUE or TODAY'S DEADLINES take absolute #1 priority, regardless of importance rating.
2. If multiple tasks are due soon, pick the one with higher importance/priority.
3. A task due in 2 days ALWAYS takes priority over a task due in 30 days, even if the 30-day task has higher importance.

Current Today's Date: ${getToday().toISOString().split("T")[0]}

Return ONLY valid JSON in this exact structure:
{"taskId": "selected_task_id", "reason": "Short 1-sentence explanation focusing on deadline urgency and priority."}`,
      };

      const userPrompt = {
        role: "user" as const,
        content: `Determine the highest priority task to complete first from these tasks:
${JSON.stringify(taskInformation)}`,
      };

      const response = await groq.chat.completions.create({
        model: GROQ_CONFIG.MODEL,
        messages: [systemPrompt, userPrompt],
        temperature: 0.3,
        response_format: { type: "json_object" },
      });

      const content = response.choices[0]?.message?.content;

      if (!content) {
        throw new Error("Groq returned an empty response.");
      }

      const result = JSON.parse(content);

      const recommendedTask = incompleteTasks.find(
        (task) => task.taskId === result.taskId,
      );

      if (!recommendedTask) {
        throw new Error("Groq returned an invalid task ID.");
      }

      setAiRecommendation({
        taskId: recommendedTask.taskId,
        reason: result.reason || "This task has the highest urgency.",
      });
    } catch (error: any) {
      console.log("AI Recommendation Error:", error);
      Alert.alert(
        "AI Error",
        error?.message || "Unable to generate a recommendation.",
      );
    } finally {
      setIsAiRecommending(false);
    }
  };

  // ==========================================================
  // SELECT TASK
  // ==========================================================

  const toggleTaskSelection = (taskId: string) => {
    setSelectedTaskIds((previous) => {
      if (previous.includes(taskId)) {
        return previous.filter((id) => id !== taskId);
      }
      return [...previous, taskId];
    });
  };

  // ==========================================================
  // COMPLETE SELECTED TASKS
  // ==========================================================

  const completeSelectedTasks = async () => {
    if (selectedTaskIds.length === 0) return;

    const user = auth.currentUser;
    if (!user) {
      Alert.alert("Authentication Error", "Please log in again.");
      return;
    }

    setActionLoading(true);

    try {
      let completedCount = 0;

      for (const taskId of selectedTaskIds) {
        const task = tasks.find((item) => item.taskId === taskId);
        if (!task || task.status === "Completed") continue;

        await updateDoc(doc(db, "Tasks", taskId), {
          status: "Completed",
          progress: 100,
        });

        completedCount++;
      }

      if (completedCount > 0) {
        const userRef = doc(db, "Users", user.uid);
        await updateDoc(userRef, {
          points: increment(completedCount * 50),
          rewards: String(completedCount * 50),
        });
      }

      setSelectedTaskIds([]);
      setSelectionMode(false);

      Alert.alert(
        "Tasks Completed",
        `${completedCount} task(s) completed. You earned ${
          completedCount * 50
        } points!`,
      );
    } catch (error: any) {
      console.log("Complete tasks error:", error);
      Alert.alert(
        "Error",
        error?.message || "Unable to complete the selected tasks.",
      );
    } finally {
      setActionLoading(false);
    }
  };

  // ==========================================================
  // DELETE SELECTED TASKS
  // ==========================================================

  const deleteSelectedTasks = () => {
    if (selectedTaskIds.length === 0) return;

    Alert.alert(
      "Delete Tasks",
      `Are you sure you want to delete ${selectedTaskIds.length} selected task(s)?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            setActionLoading(true);
            try {
              for (const taskId of selectedTaskIds) {
                await deleteDoc(doc(db, "Tasks", taskId));
              }
              setSelectedTaskIds([]);
              setSelectionMode(false);
            } catch (error: any) {
              console.log("Delete tasks error:", error);
              Alert.alert("Error", "Unable to delete selected tasks.");
            } finally {
              setActionLoading(false);
            }
          },
        },
      ],
    );
  };

  // ==========================================================
  // PRIORITY COLOUR
  // ==========================================================

  const getPriorityColor = (priority: string) => {
    if (priority === "High") return "#EF4444";
    if (priority === "Medium") return "#F59E0B";
    return "#22C55E";
  };

  // ==========================================================
  // TASK CARD RENDER
  // ==========================================================

  const renderTask = ({ item }: { item: TaskData & { aiScore: number } }) => {
    const isCompleted = item.status === "Completed";
    const isSelected = selectedTaskIds.includes(item.taskId);
    const urgency = getTaskUrgency(item);
    const urgencyColor = getUrgencyColor(item);
    const urgencyLabel = getUrgencyLabel(item);
    const isAiRecommended = aiRecommendation?.taskId === item.taskId;

    return (
      <TouchableOpacity
        activeOpacity={0.8}
        style={[
          styles.taskCard,
          {
            backgroundColor: isAiRecommended
              ? isDarkmode
                ? "#312E81"
                : "#EEF2FF"
              : cardColor,
            borderColor: isAiRecommended ? accentColor : urgencyColor,
            borderLeftWidth: 5,
            opacity: isCompleted ? 0.65 : 1,
          },
        ]}
        onPress={() => {
          if (selectionMode) {
            toggleTaskSelection(item.taskId);
            return;
          }
          navigation.navigate("TaskDetailScreen", { taskId: item.taskId });
        }}
        onLongPress={() => {
          setSelectionMode(true);
          toggleTaskSelection(item.taskId);
        }}
      >
        {/* HEADER */}
        <View style={styles.cardHeader}>
          <View style={{ flex: 1, flexDirection: "row", alignItems: "center" }}>
            {selectionMode ? (
              <View
                style={[
                  styles.checkbox,
                  {
                    backgroundColor: isSelected ? accentColor : "transparent",
                    borderColor: isSelected ? accentColor : subTextColor,
                  },
                ]}
              >
                {isSelected && (
                  <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                )}
              </View>
            ) : isCompleted ? (
              <Ionicons
                name="checkmark-circle"
                size={25}
                color="#22C55E"
                style={{ marginRight: 8 }}
              />
            ) : urgency === "overdue" ? (
              <Ionicons
                name="close-circle"
                size={25}
                color="#991B1B"
                style={{ marginRight: 8 }}
              />
            ) : (
              <Ionicons
                name="ellipse-outline"
                size={23}
                color={urgencyColor}
                style={{ marginRight: 8 }}
              />
            )}

            <View style={{ flex: 1 }}>
              <RNText
                style={{
                  fontSize: 16,
                  fontWeight: "700",
                  color: textColor,
                  textDecorationLine: isCompleted ? "line-through" : "none",
                }}
                numberOfLines={2}
              >
                {item.title}
              </RNText>

              {urgencyLabel !== "" && (
                <RNText
                  style={{
                    marginTop: 3,
                    fontSize: 10,
                    fontWeight: "800",
                    color: urgencyColor,
                  }}
                >
                  {urgencyLabel}
                </RNText>
              )}
            </View>
          </View>

          {/* PRIORITY BADGE */}
          <View
            style={[
              styles.priorityBadge,
              {
                backgroundColor: `${getPriorityColor(item.priority)}20`,
              },
            ]}
          >
            <RNText
              style={{
                fontSize: 11,
                fontWeight: "800",
                color: getPriorityColor(item.priority),
              }}
            >
              {item.priority || "Low"}
            </RNText>
          </View>
        </View>

        {/* DESCRIPTION */}
        <RNText
          style={{
            marginTop: 10,
            marginLeft: 33,
            fontSize: 13,
            color: subTextColor,
            lineHeight: 19,
          }}
          numberOfLines={2}
        >
          {item.description || "No description provided."}
        </RNText>

        {/* AI RECOMMENDATION BANNER */}
        {isAiRecommended && (
          <View
            style={[
              styles.aiRecommendation,
              {
                backgroundColor: isDarkmode ? "#1E1B4B" : "#E0E7FF",
              },
            ]}
          >
            <Ionicons name="sparkles" size={15} color={accentColor} />
            <RNText
              style={{
                flex: 1,
                marginLeft: 6,
                color: accentColor,
                fontSize: 12,
                fontWeight: "700",
              }}
            >
              AI recommends completing this task first.
            </RNText>
          </View>
        )}

        {/* FOOTER */}
        <View style={styles.cardFooter}>
          <View style={styles.footerItem}>
            <Ionicons name="play-outline" size={14} color={subTextColor} />
            <RNText
              style={{
                fontSize: 12,
                color: textColor,
                marginLeft: 4,
                fontWeight: "600",
              }}
            >
              {item.startDate || "No start date"}
            </RNText>
          </View>

          <View style={styles.footerItem}>
            <Ionicons name="calendar-outline" size={14} color={urgencyColor} />
            <RNText
              style={{
                fontSize: 12,
                color: textColor,
                marginLeft: 4,
                fontWeight: "600",
              }}
            >
              {item.dueDate || "No due date"}
            </RNText>
          </View>

          <View style={styles.footerItem}>
            <Ionicons name="folder-outline" size={14} color={subTextColor} />
            <RNText
              style={{
                fontSize: 12,
                color: subTextColor,
                marginLeft: 4,
              }}
            >
              {item.category}
            </RNText>
          </View>
        </View>

        {/* DEPENDENCY BADGE */}
        {item.dependsOnTaskId && (
          <View
            style={{
              marginTop: 8,
              marginLeft: 33,
              flexDirection: "row",
              alignItems: "center",
            }}
          >
            <Ionicons name="link-outline" size={13} color={subTextColor} />
            <RNText
              style={{
                marginLeft: 4,
                fontSize: 11,
                color: subTextColor,
              }}
            >
              Depends on another task
            </RNText>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  // ==========================================================
  // LOADING STATE
  // ==========================================================

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor }]}>
        <CssThinkingLoader isDarkmode={isDarkmode} size={44} speed={1.5} />
      </View>
    );
  }

  // ==========================================================
  // MAIN UI
  // ==========================================================

  return (
    <Layout
      style={{
        flex: 1,
        backgroundColor: isDarkmode ? themeColor.dark200 : backgroundColor,
      }}
    >
      <TopNav
        middleContent={
          selectionMode
            ? `${selectedTaskIds.length} Selected`
            : "Smart Task List"
        }
        leftContent={
          selectionMode ? (
            <Ionicons name="close" size={24} color={textColor} />
          ) : undefined
        }
        leftAction={
          selectionMode
            ? () => {
                setSelectionMode(false);
                setSelectedTaskIds([]);
              }
            : undefined
        }
        rightContent={
          <Ionicons
            name={isDarkmode ? "sunny" : "moon"}
            size={22}
            color={textColor}
          />
        }
        rightAction={() => setTheme(isDarkmode ? "light" : "dark")}
      />

      <View
        style={{
          flex: 1,
          paddingHorizontal: 16,
          paddingTop: 12,
        }}
      >
        {/* AI RECOMMENDATION BUTTON */}
        {!selectionMode && (
          <TouchableOpacity
            style={[
              styles.aiMainButton,
              {
                backgroundColor: accentColor,
              },
            ]}
            onPress={handleAiRecommendation}
            disabled={isAiRecommending}
          >
            {isAiRecommending ? (
              <CssThinkingLoader isDarkmode={true} size={18} speed={2} />
            ) : (
              <Ionicons name="sparkles" size={18} color="#FFFFFF" />
            )}

            <RNText style={styles.aiMainButtonText}>
              {isAiRecommending
                ? "Analysing Tasks..."
                : "Ask AI What to Complete First"}
            </RNText>
          </TouchableOpacity>
        )}

        {/* AI RECOMMENDATION RESULT CARD */}
        {!selectionMode && aiRecommendation && (
          <View
            style={[
              styles.recommendationCard,
              {
                backgroundColor: isDarkmode ? "#1E1B4B" : "#EEF2FF",
                borderColor: accentColor,
              },
            ]}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
              }}
            >
              <Ionicons name="sparkles" size={18} color={accentColor} />
              <RNText
                style={{
                  marginLeft: 7,
                  fontWeight: "800",
                  color: accentColor,
                }}
              >
                AI Recommendation
              </RNText>
            </View>

            <RNText
              style={{
                marginTop: 8,
                color: textColor,
                fontSize: 14,
                fontWeight: "700",
              }}
            >
              {
                tasks.find((task) => task.taskId === aiRecommendation.taskId)
                  ?.title
              }
            </RNText>

            <RNText
              style={{
                marginTop: 5,
                color: subTextColor,
                fontSize: 12,
                lineHeight: 18,
              }}
            >
              {aiRecommendation.reason}
            </RNText>
          </View>
        )}

        {/* SEARCH BAR */}
        {!selectionMode && (
          <View
            style={[
              styles.searchContainer,
              {
                backgroundColor: cardColor,
                borderColor,
              },
            ]}
          >
            <Ionicons
              name="search-outline"
              size={18}
              color={subTextColor}
              style={{ marginRight: 8 }}
            />

            <RNTextInput
              style={[
                styles.searchInput,
                {
                  color: textColor,
                },
              ]}
              placeholder="Ask AI to find tasks..."
              placeholderTextColor={subTextColor}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />

            {isAiSearching && (
              <CssThinkingLoader isDarkmode={isDarkmode} size={18} speed={2} />
            )}
          </View>
        )}

        {/* SELECTION ACTION BAR */}
        {selectionMode && (
          <View
            style={[
              styles.actionBar,
              {
                backgroundColor: cardColor,
                borderColor,
              },
            ]}
          >
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: "#22C55E" }]}
              onPress={completeSelectedTasks}
              disabled={actionLoading}
            >
              <Ionicons name="checkmark" size={18} color="#FFFFFF" />
              <RNText style={styles.actionButtonText}>Complete</RNText>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: "#EF4444" }]}
              onPress={deleteSelectedTasks}
              disabled={actionLoading}
            >
              <Ionicons name="trash-outline" size={18} color="#FFFFFF" />
              <RNText style={styles.actionButtonText}>Delete</RNText>
            </TouchableOpacity>
          </View>
        )}

        {/* COLOR LEGEND BAR */}
        {!selectionMode && (
          <View style={{ marginBottom: 8, marginTop: 4 }}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.legendContainer}
            >
              <View
                style={[
                  styles.legendBadge,
                  {
                    backgroundColor: isDarkmode ? "#311111" : "#FEE2E2",
                    borderColor: "#991B1B",
                  },
                ]}
              >
                <Ionicons name="close-circle" size={13} color="#991B1B" />
                <RNText style={[styles.legendText, { color: "#991B1B" }]}>
                  Overdue
                </RNText>
              </View>

              <View
                style={[
                  styles.legendBadge,
                  {
                    backgroundColor: isDarkmode ? "#2C1212" : "#FEF2F2",
                    borderColor: "#EF4444",
                  },
                ]}
              >
                <Ionicons name="alert-circle" size={13} color="#EF4444" />
                <RNText style={[styles.legendText, { color: "#EF4444" }]}>
                  &lt; 1 Wk
                </RNText>
              </View>

              <View
                style={[
                  styles.legendBadge,
                  {
                    backgroundColor: isDarkmode ? "#2A1221" : "#FDF2F8",
                    borderColor: "#EC4899",
                  },
                ]}
              >
                <Ionicons name="time" size={13} color="#EC4899" />
                <RNText style={[styles.legendText, { color: "#EC4899" }]}>
                  1–2 Wks
                </RNText>
              </View>

              <View
                style={[
                  styles.legendBadge,
                  {
                    backgroundColor: isDarkmode ? "#26200A" : "#FEFCE8",
                    borderColor: "#EAB308",
                  },
                ]}
              >
                <Ionicons name="calendar" size={13} color="#EAB308" />
                <RNText style={[styles.legendText, { color: "#EAB308" }]}>
                  2 Wks–1 Mo
                </RNText>
              </View>

              <View
                style={[
                  styles.legendBadge,
                  {
                    backgroundColor: isDarkmode ? "#0F291E" : "#F0FDF4",
                    borderColor: "#22C55E",
                  },
                ]}
              >
                <Ionicons name="calendar-outline" size={13} color="#22C55E" />
                <RNText style={[styles.legendText, { color: "#22C55E" }]}>
                  &gt; 1 Mo
                </RNText>
              </View>
            </ScrollView>
          </View>
        )}

        {/* TASK LIST */}
        <FlatList
          data={processedTasks}
          renderItem={renderTask}
          keyExtractor={(item) => item.taskId}
          contentContainerStyle={{
            paddingBottom: 110,
            paddingTop: 6,
          }}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={{ alignItems: "center", marginTop: 60 }}>
              <Ionicons
                name="clipboard-outline"
                size={48}
                color={subTextColor}
              />
              <RNText
                style={{
                  color: textColor,
                  marginTop: 16,
                  fontSize: 16,
                  fontWeight: "700",
                }}
              >
                No Tasks Found
              </RNText>
            </View>
          }
        />
      </View>

      {/* FAB */}
      {!selectionMode && (
        <TouchableOpacity
          style={styles.fabButton}
          onPress={() => navigation.navigate("TaskEditScreen")}
          activeOpacity={0.8}
        >
          <Ionicons name="add" size={32} color="#FFFFFF" />
        </TouchableOpacity>
      )}
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
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 46,
    marginBottom: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    height: "100%",
  },
  legendContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 2,
  },
  legendBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    gap: 4,
  },
  legendText: {
    fontSize: 11,
    fontWeight: "700",
  },
  taskCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  priorityBadge: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 10,
    marginLeft: 8,
  },
  cardFooter: {
    flexDirection: "row",
    marginTop: 13,
    marginLeft: 33,
    gap: 12,
  },
  footerItem: {
    flexDirection: "row",
    alignItems: "center",
  },
  checkbox: {
    width: 23,
    height: 23,
    borderRadius: 7,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },
  aiRecommendation: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 10,
    marginLeft: 33,
    padding: 9,
    borderRadius: 10,
  },
  aiMainButton: {
    minHeight: 46,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  aiMainButtonText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "800",
    marginLeft: 7,
  },
  recommendationCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 13,
    marginBottom: 10,
  },
  actionBar: {
    flexDirection: "row",
    gap: 10,
    borderWidth: 1,
    borderRadius: 14,
    padding: 10,
    marginBottom: 8,
  },
  actionButton: {
    flex: 1,
    minHeight: 42,
    borderRadius: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  actionButtonText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "800",
    marginLeft: 5,
  },
  fabButton: {
    position: "absolute",
    right: 22,
    bottom: 22,
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#6366F1",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#6366F1",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 8,
  },
});
