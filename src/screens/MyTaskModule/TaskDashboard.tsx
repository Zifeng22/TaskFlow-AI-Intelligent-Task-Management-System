import React, { useState, useEffect, useRef } from "react";
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Text as RNText,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  FlatList,
} from "react-native";
import { Layout, TopNav, useTheme, themeColor } from "react-native-rapi-ui";
import { Ionicons } from "@expo/vector-icons";
import { getAuth } from "firebase/auth";
import {
  getFirestore,
  collection,
  query,
  where,
  onSnapshot,
  doc,
  setDoc,
} from "firebase/firestore";
import OpenAI from "openai";

import CssThinkingLoader from "../../components/utils/CssThinkingLoader";
import { GROQ_CONFIG } from "../../../keys";

// Initialize OpenAI client configured for Groq endpoints
const groq = new OpenAI({
  baseURL: GROQ_CONFIG.BASE_URL,
  apiKey: GROQ_CONFIG.API_KEY,
  dangerouslyAllowBrowser: true,
});

export default function TaskDashboard({ navigation }: any) {
  const { isDarkmode, setTheme } = useTheme();
  const auth = getAuth();
  const db = getFirestore();

  const [loading, setLoading] = useState(true);
  const [tasks, setTasks] = useState<any[]>([]);
  const [userData, setUserData] = useState<any>(null);

  // Notes & AI Suggestion State
  const [userNote, setUserNote] = useState("");
  const [showFullScreenNote, setShowFullScreenNote] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState<string | null>(null);
  const [isGeneratingSuggestion, setIsGeneratingSuggestion] = useState(false);

  // Modals
  const [showAIChat, setShowAIChat] = useState(false);
  const [chatMessages, setChatMessages] = useState<
    { role: "user" | "assistant" | "system"; content: string }[]
  >([]);
  const [chatInput, setChatInput] = useState("");
  const [isAiTyping, setIsAiTyping] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const [showLevelMap, setShowLevelMap] = useState(false);

  // Dynamic Theme Colors
  const backgroundColor = isDarkmode ? "#090D16" : "#F4F6FA";
  const cardColor = isDarkmode ? "#151C2C" : "#FFFFFF";
  const textColor = isDarkmode ? "#F8FAFC" : "#0F172A";
  const subTextColor = isDarkmode ? "#8E9BAE" : "#64748B";
  const borderColor = isDarkmode ? "#232D42" : "#E2E8F0";
  const accentColor = "#6366F1";

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    // Listen to unified "Users" dataset
    const userUnsub = onSnapshot(doc(db, "Users", user.uid), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setUserData(data);
        if (data.dashboardNote) setUserNote(data.dashboardNote);
      } else {
        setUserData({
          points: 0,
          role: "Team Member",
          displayName: user.displayName || "User",
        });
      }
    });

    const q = query(
      collection(db, "Tasks"),
      where("assignedTo", "==", user.uid),
    );
    const tasksUnsub = onSnapshot(q, (snap) => {
      const fetchedTasks = snap.docs.map((d) => ({
        taskId: d.id,
        ...d.data(),
      }));
      setTasks(fetchedTasks);
      setLoading(false);
    });

    return () => {
      userUnsub();
      tasksUnsub();
    };
  }, []);

  // --- CALCULATIONS ---
  const today = new Date().toISOString().split("T")[0];
  const activeTasks = tasks.filter((t) => t.status !== "Completed");
  const overdueTasks = activeTasks.filter((t) => t.dueDate < today);
  const completedTasksCount = tasks.length - activeTasks.length;
  const completionRatio =
    tasks.length > 0 ? (completedTasksCount / tasks.length) * 100 : 0;

  // PROGRESSIVE GAMIFICATION STRUCTURE
  const LEVEL_MAP_DATA = [
    { level: 1, title: "Rookie Novice", minPts: 0, maxPts: 99 },
    { level: 2, title: "Task Explorer", minPts: 100, maxPts: 299 },
    { level: 3, title: "Productivity Knight", minPts: 300, maxPts: 599 },
    { level: 4, title: "Focus Champion", minPts: 600, maxPts: 999 },
    { level: 5, title: "Master Strategist", minPts: 1000, maxPts: 1499 },
    { level: 6, title: "Task Legend", minPts: 1500, maxPts: 9999 },
  ];

  const points = Math.max(0, userData?.points || 0);

  const currentLevelObj =
    LEVEL_MAP_DATA.find((l) => points >= l.minPts && points <= l.maxPts) ||
    LEVEL_MAP_DATA[LEVEL_MAP_DATA.length - 1];

  const currentLevel = currentLevelObj.level;

  const nextLevelObj = LEVEL_MAP_DATA.find((l) => l.level === currentLevel + 1);
  const targetXp = nextLevelObj ? nextLevelObj.minPts : currentLevelObj.maxPts;
  const pointsToNextLevel = Math.max(0, targetXp - points);

  const currentSpan = Math.max(
    1,
    currentLevelObj.maxPts - currentLevelObj.minPts + 1,
  );
  const xpEarnedInLevel = points - currentLevelObj.minPts;
  const levelProgressPercent = Math.min(
    100,
    Math.max(0, (xpEarnedInLevel / currentSpan) * 100),
  );

  // Save note directly to "Users" collection
  const handleSaveNote = async (text: string) => {
    setUserNote(text);
    const user = auth.currentUser;
    if (user) {
      try {
        await setDoc(
          doc(db, "Users", user.uid),
          { dashboardNote: text },
          { merge: true },
        );
      } catch (err) {
        console.error("Error saving note:", err);
      }
    }
  };

  // --- GROQ HELPER FUNCTION ---
  const callGroqChat = async (
    messages: { role: "system" | "user" | "assistant"; content: string }[],
  ) => {
    const response = await groq.chat.completions.create({
      model: GROQ_CONFIG.MODEL,
      messages: messages as any,
      temperature: 0.6,
    });
    return response.choices[0]?.message?.content?.trim() || "";
  };

  // --- GROQ API: Generate Dynamic AI Suggestion ---
  const handleGenerateAISuggestion = async () => {
    setIsGeneratingSuggestion(true);
    try {
      const sortedActiveTasks = [...activeTasks].sort(
        (a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime(),
      );

      const topTasksContext = sortedActiveTasks
        .slice(0, 3)
        .map(
          (t) =>
            `- "${t.title}" (Due: ${t.dueDate || "N/A"}, Priority: ${
              t.priority || "Normal"
            })`,
        )
        .join("\n");

      const prompt = `User Name: ${
        userData?.displayName || userData?.name || "User"
      }
Today's Date: ${today}
Active Tasks Count: ${activeTasks.length}
Overdue Tasks Count: ${overdueTasks.length}

Top Pending Tasks:
${topTasksContext || "No upcoming tasks."}

Instructions:
Give a specific 2-sentence productivity tip. Directly mention 1 specific task title by name that they should focus on first based on due dates and priorities. Keep it motivating and concise.`;

      const replyText = await callGroqChat([
        {
          role: "system",
          content:
            "You are an intelligent project productivity coach. Give a 2-sentence actionable tip referencing specific task titles.",
        },
        { role: "user", content: prompt },
      ]);

      setAiSuggestion(
        replyText || "Focus on your most urgent task today to keep momentum!",
      );
    } catch (error) {
      console.error("Groq AI Suggestion Error:", error);
      setAiSuggestion(
        "Focus on your most urgent overdue task first to preserve your XP rank!",
      );
    } finally {
      setIsGeneratingSuggestion(false);
    }
  };

  // --- GROQ API: Multi-turn Assistant Chat with Full Task Data ---
  const handleSendAiMessage = async () => {
    if (!chatInput.trim()) return;

    const userText = chatInput.trim();
    const newHistory = [
      ...chatMessages,
      { role: "user" as const, content: userText },
    ];
    setChatMessages(newHistory);
    setChatInput("");
    setIsAiTyping(true);

    const formattedTasksList = tasks.map((t) => ({
      title: t.title || "Untitled Task",
      dueDate: t.dueDate || "No Due Date",
      status: t.status || "Pending",
      priority: t.priority || "Normal",
      category: t.category || "General",
    }));

    const systemMsg = {
      role: "system" as const,
      content: `You are an AI Project Management Assistant for ${
        userData?.displayName || userData?.name || "User"
      }.
    
Current Today's Date: ${today}

Full User Task List:
${JSON.stringify(formattedTasksList, null, 2)}

Instructions:
- Use the task list above to answer specific questions about task titles, due dates, priorities, and deadlines.
- If the user asks about tasks due in the next two weeks, compare their 'dueDate' against today's date (${today}).
- Keep your answers concise, helpful, and directly reference the user's tasks when asked.
- Keep responses concise and easy to read on mobile.
- Use clean bullet points instead of complex tables for lists.`,
    };

    try {
      const replyText = await callGroqChat([systemMsg, ...newHistory]);

      setChatMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            replyText || "Sorry, I couldn't process that request right now.",
        },
      ]);
    } catch (error: any) {
      console.error("Groq Chat Error:", error);
      setChatMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `Connection error: ${
            error?.message || "Unable to reach Groq assistant."
          }`,
        },
      ]);
    } finally {
      setIsAiTyping(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor }]}>
        <CssThinkingLoader isDarkmode={isDarkmode} size={44} speed={1.5} />
      </View>
    );
  }

  return (
    <Layout
      style={{
        flex: 1,
        backgroundColor: isDarkmode ? themeColor.dark200 : backgroundColor,
      }}
    >
      <TopNav
        middleContent="My Dashboard"
        rightContent={
          <Ionicons
            name={isDarkmode ? "sunny" : "moon"}
            size={22}
            color={textColor}
          />
        }
        rightAction={() => setTheme(isDarkmode ? "light" : "dark")}
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* GAMIFICATION HERO BANNER */}
        <TouchableOpacity
          activeOpacity={0.88}
          onPress={() => setShowLevelMap(true)}
          style={[
            styles.heroCard,
            { backgroundColor: cardColor, borderColor, borderWidth: 1 },
          ]}
        >
          <View style={styles.heroTopRow}>
            <View style={styles.badgeLabelContainer}>
              <View style={styles.pulseDot} />
              <RNText style={styles.heroSubHeader}>GAMIFICATION RANK</RNText>
            </View>
            <View style={styles.xpPill}>
              <Ionicons name="flash" size={13} color="#FBBF24" />
              <RNText style={styles.xpText}>{points} XP</RNText>
            </View>
          </View>

          <View style={styles.levelRow}>
            <View>
              <RNText style={[styles.levelTitleText, { color: textColor }]}>
                Level {currentLevel}
              </RNText>
              <RNText
                style={{ fontSize: 13, color: subTextColor, marginTop: 2 }}
              >
                {currentLevelObj.title}
              </RNText>
            </View>

            <View style={styles.trophyGlowBox}>
              <Ionicons name="trophy" size={28} color="#FBBF24" />
            </View>
          </View>

          <View style={styles.progressTrackContainer}>
            <View
              style={[
                styles.progressBarBackground,
                { backgroundColor: isDarkmode ? "#202A3C" : "#E2E8F0" },
              ]}
            >
              <View
                style={[
                  styles.progressBarFill,
                  {
                    width: `${levelProgressPercent}%`,
                    backgroundColor: "#FBBF24",
                  },
                ]}
              />
            </View>
          </View>

          <View style={styles.heroBottomRow}>
            <RNText
              style={{ fontSize: 12, color: subTextColor, fontWeight: "500" }}
            >
              {nextLevelObj ? (
                <>
                  <RNText style={{ fontWeight: "700", color: textColor }}>
                    {pointsToNextLevel} XP
                  </RNText>{" "}
                  to Level {currentLevel + 1}
                </>
              ) : (
                <RNText style={{ fontWeight: "700", color: "#FBBF24" }}>
                  Max Level Reached!
                </RNText>
              )}
            </RNText>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <RNText
                style={{ fontSize: 12, color: accentColor, fontWeight: "700" }}
              >
                Rules & Map
              </RNText>
              <Ionicons name="chevron-forward" size={14} color={accentColor} />
            </View>
          </View>
        </TouchableOpacity>

        {/* PROGRESS ENGINE DASHBOARD MODULES */}
        <View style={styles.sectionHeaderRow}>
          <RNText style={[styles.sectionTitle, { color: textColor }]}>
            Progress Overview
          </RNText>
          <RNText style={{ fontSize: 12, color: subTextColor }}>
            Live Stats
          </RNText>
        </View>

        {/* OVERALL PROGRESS HERO CARD */}
        <TouchableOpacity
          activeOpacity={0.88}
          onPress={() => navigation.navigate("TaskProgressScreen")}
          style={[
            styles.card,
            { backgroundColor: cardColor, borderColor, borderWidth: 1 },
          ]}
        >
          <View style={styles.progressHeroRow}>
            <View style={styles.ringGraphicContainer}>
              <View
                style={[
                  styles.outerRing,
                  {
                    borderColor: `${accentColor}30`,
                    backgroundColor: `${accentColor}12`,
                  },
                ]}
              >
                <Ionicons name="checkmark-done" size={28} color={accentColor} />
              </View>
            </View>

            <View style={styles.progressHeroMeta}>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <RNText style={[styles.cardLabelText, { color: subTextColor }]}>
                  PROJECT COMPLETION
                </RNText>
                <Ionicons name="stats-chart" size={16} color={accentColor} />
              </View>

              <RNText
                style={[styles.progressHeroHeading, { color: textColor }]}
              >
                Total Task Completion
              </RNText>

              <View
                style={[
                  styles.miniBarBg,
                  { backgroundColor: isDarkmode ? "#1E293B" : "#F1F5F9" },
                ]}
              >
                <View
                  style={[
                    styles.miniBarFill,
                    {
                      width: `${completionRatio}%`,
                      backgroundColor: accentColor,
                    },
                  ]}
                />
              </View>

              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  marginTop: 8,
                }}
              >
                <RNText
                  style={{
                    fontSize: 12,
                    color: subTextColor,
                    fontWeight: "700",
                  }}
                >
                  {completedTasksCount} of {tasks.length} Completed
                </RNText>
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <RNText
                    style={{
                      fontSize: 11,
                      color: accentColor,
                      fontWeight: "700",
                    }}
                  >
                    View Trends
                  </RNText>
                  <Ionicons
                    name="arrow-forward"
                    size={12}
                    color={accentColor}
                    style={{ marginLeft: 2 }}
                  />
                </View>
              </View>
            </View>
          </View>
        </TouchableOpacity>

        {/* SPLIT STATUS STAT CARDS */}
        <View style={styles.gridRow}>
          <View
            style={[
              styles.gridCard,
              { backgroundColor: cardColor, borderColor, borderWidth: 1 },
            ]}
          >
            <View style={styles.gridCardTop}>
              <View style={[styles.iconBox, { backgroundColor: "#3B82F615" }]}>
                <Ionicons name="time" size={20} color="#3B82F6" />
              </View>
              <View style={styles.statusPillActive}>
                <RNText style={styles.statusPillActiveText}>Active</RNText>
              </View>
            </View>

            <RNText style={[styles.gridValueText, { color: textColor }]}>
              {activeTasks.length}
            </RNText>

            <RNText style={[styles.gridLabelText, { color: subTextColor }]}>
              Active Tasks
            </RNText>
          </View>

          <View
            style={[
              styles.gridCard,
              { backgroundColor: cardColor, borderColor, borderWidth: 1 },
            ]}
          >
            <View style={styles.gridCardTop}>
              <View style={[styles.iconBox, { backgroundColor: "#EF444415" }]}>
                <Ionicons name="alert-circle" size={20} color="#EF4444" />
              </View>
              <View
                style={[
                  styles.statusPillOverdue,
                  {
                    backgroundColor:
                      overdueTasks.length > 0 ? "#EF444415" : "#10B98115",
                  },
                ]}
              >
                <RNText
                  style={[
                    styles.statusPillOverdueText,
                    { color: overdueTasks.length > 0 ? "#EF4444" : "#10B981" },
                  ]}
                >
                  {overdueTasks.length > 0 ? "Attention" : "On Track"}
                </RNText>
              </View>
            </View>

            <RNText
              style={[
                styles.gridValueText,
                { color: overdueTasks.length > 0 ? "#EF4444" : textColor },
              ]}
            >
              {overdueTasks.length}
            </RNText>

            <RNText style={[styles.gridLabelText, { color: subTextColor }]}>
              Overdue Tasks
            </RNText>
          </View>
        </View>

        {/* DASHBOARD NOTES & AI SUGGESTIONS WIDGET */}
        <View
          style={[
            styles.card,
            { backgroundColor: cardColor, borderColor, borderWidth: 1 },
          ]}
        >
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 10,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Ionicons name="journal-outline" size={18} color={accentColor} />
              <RNText
                style={{
                  fontSize: 15,
                  fontWeight: "800",
                  color: textColor,
                  marginLeft: 8,
                }}
              >
                Quick Notes & AI Tips
              </RNText>
            </View>

            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <TouchableOpacity
                onPress={handleGenerateAISuggestion}
                disabled={isGeneratingSuggestion}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  backgroundColor: `${accentColor}18`,
                  paddingHorizontal: 10,
                  paddingVertical: 5,
                  borderRadius: 10,
                  marginRight: 6,
                }}
              >
                <Ionicons name="sparkles" size={12} color={accentColor} />
                <RNText
                  style={{
                    fontSize: 11,
                    fontWeight: "700",
                    color: accentColor,
                    marginLeft: 4,
                  }}
                >
                  {isGeneratingSuggestion ? "Generating..." : "Get AI Tip"}
                </RNText>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setShowFullScreenNote(true)}
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 8,
                  backgroundColor: isDarkmode ? "#1E293B" : "#F1F5F9",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Ionicons name="expand-outline" size={16} color={textColor} />
              </TouchableOpacity>
            </View>
          </View>

          {aiSuggestion && (
            <View
              style={[
                styles.aiSuggestionBox,
                { backgroundColor: isDarkmode ? "#1E293B" : "#F0F3FF" },
              ]}
            >
              <Ionicons
                name="bulb-outline"
                size={16}
                color="#FBBF24"
                style={{ marginRight: 8, marginTop: 2 }}
              />
              <RNText
                style={{
                  flex: 1,
                  fontSize: 12,
                  color: textColor,
                  lineHeight: 18,
                }}
              >
                {aiSuggestion}
              </RNText>
            </View>
          )}

          <TextInput
            style={[
              styles.notesInput,
              {
                color: textColor,
                backgroundColor: isDarkmode ? "#0F172A" : "#F8FAFC",
                borderColor,
              },
            ]}
            multiline
            numberOfLines={3}
            placeholder="Type quick reminders, daily focus, or task notes here..."
            placeholderTextColor={subTextColor}
            value={userNote}
            onChangeText={handleSaveNote}
          />
        </View>
      </ScrollView>

      {/* UNIFIED BOTTOM NAVIGATION BAR */}
      <View
        style={[
          styles.bottomNav,
          { backgroundColor: cardColor, borderTopColor: borderColor },
        ]}
      >
        <TouchableOpacity style={styles.navItem} activeOpacity={0.7}>
          <Ionicons name="home" size={24} color={accentColor} />
          <RNText style={[styles.navText, { color: accentColor }]}>Home</RNText>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navItem}
          onPress={() => navigation.navigate("TaskListScreen")}
          activeOpacity={0.7}
        >
          <Ionicons name="list" size={24} color={subTextColor} />
          <RNText style={[styles.navText, { color: subTextColor }]}>
            Tasks
          </RNText>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navItemCentral}
          onPress={() => navigation.navigate("TaskEditScreen")}
          activeOpacity={0.8}
        >
          <View
            style={[styles.centralButton, { backgroundColor: accentColor }]}
          >
            <Ionicons name="add" size={32} color="#FFF" />
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navItem}
          onPress={() => setShowAIChat(true)}
          activeOpacity={0.7}
        >
          <Ionicons name="sparkles-outline" size={24} color={subTextColor} />
          <RNText style={[styles.navText, { color: subTextColor }]}>
            AI Assist
          </RNText>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navItem}
          onPress={() => navigation.navigate("Profile")}
          activeOpacity={0.7}
        >
          <Ionicons name="person-outline" size={24} color={subTextColor} />
          <RNText style={[styles.navText, { color: subTextColor }]}>
            Profile
          </RNText>
        </TouchableOpacity>
      </View>

      {/* FULL SCREEN NOTES MODAL */}
      <Modal
        visible={showFullScreenNote}
        animationType="slide"
        transparent={false}
      >
        <View style={{ flex: 1, backgroundColor }}>
          <View
            style={{
              paddingTop: Platform.OS === "ios" ? 50 : 30,
              backgroundColor: cardColor,
              borderBottomWidth: 1,
              borderBottomColor: borderColor,
              paddingHorizontal: 16,
              paddingBottom: 12,
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Ionicons name="journal" size={22} color={accentColor} />
              <RNText
                style={{
                  fontSize: 18,
                  fontWeight: "800",
                  color: textColor,
                  marginLeft: 8,
                }}
              >
                Focus Notes Mode
              </RNText>
            </View>

            <TouchableOpacity
              onPress={() => setShowFullScreenNote(false)}
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                backgroundColor: isDarkmode ? "#1E293B" : "#F1F5F9",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons name="contract" size={20} color={textColor} />
            </TouchableOpacity>
          </View>

          <KeyboardAvoidingView
            style={{ flex: 1, padding: 20 }}
            behavior={Platform.OS === "ios" ? "padding" : undefined}
          >
            <TextInput
              style={[
                styles.fullNotesInput,
                {
                  color: textColor,
                  backgroundColor: cardColor,
                  borderColor,
                },
              ]}
              multiline
              autoFocus
              placeholder="Write detailed scratchpad notes, meeting takeaways, or study priorities..."
              placeholderTextColor={subTextColor}
              value={userNote}
              onChangeText={handleSaveNote}
            />

            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                marginTop: 12,
              }}
            >
              <RNText style={{ fontSize: 12, color: subTextColor }}>
                {userNote.length} characters • Auto-saved
              </RNText>

              <TouchableOpacity
                onPress={() => handleSaveNote("")}
                style={{ flexDirection: "row", alignItems: "center" }}
              >
                <Ionicons name="trash-outline" size={14} color="#EF4444" />
                <RNText
                  style={{
                    fontSize: 12,
                    color: "#EF4444",
                    marginLeft: 4,
                    fontWeight: "600",
                  }}
                >
                  Clear Note
                </RNText>
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* GAME LEVEL MAP MODAL */}
      <Modal visible={showLevelMap} animationType="slide" transparent={false}>
        <View style={{ flex: 1, backgroundColor }}>
          <View
            style={{
              paddingTop: Platform.OS === "ios" ? 50 : 30,
              backgroundColor: cardColor,
              borderBottomWidth: 1,
              borderBottomColor: borderColor,
            }}
          >
            <TopNav
              middleContent="Level Progression & Rules"
              leftContent={
                <Ionicons name="close" size={28} color={textColor} />
              }
              leftAction={() => setShowLevelMap(false)}
            />
          </View>

          <ScrollView
            contentContainerStyle={{ padding: 20, paddingBottom: 50 }}
            showsVerticalScrollIndicator={false}
          >
            <View
              style={[
                styles.card,
                { backgroundColor: cardColor, borderColor, borderWidth: 1 },
              ]}
            >
              <RNText
                style={{
                  fontSize: 16,
                  fontWeight: "800",
                  color: textColor,
                  marginBottom: 10,
                }}
              >
                Gamification & XP Rules
              </RNText>

              <View style={styles.ruleRow}>
                <Ionicons name="checkmark-circle" size={18} color="#10B981" />
                <RNText style={[styles.ruleText, { color: textColor }]}>
                  <RNText style={{ fontWeight: "700" }}>+50 XP</RNText> for each
                  completed task.
                </RNText>
              </View>

              <View style={styles.ruleRow}>
                <Ionicons name="warning" size={18} color="#EF4444" />
                <RNText style={[styles.ruleText, { color: textColor }]}>
                  <RNText style={{ fontWeight: "700", color: "#EF4444" }}>
                    -20 XP
                  </RNText>{" "}
                  penalty for tasks overdue past deadline.
                </RNText>
              </View>

              <View style={styles.ruleRow}>
                <Ionicons name="trending-up" size={18} color="#FBBF24" />
                <RNText style={[styles.ruleText, { color: textColor }]}>
                  Higher levels require larger XP milestones to unlock!
                </RNText>
              </View>
            </View>

            <View
              style={[
                styles.card,
                {
                  backgroundColor: cardColor,
                  borderColor,
                  borderWidth: 1,
                  alignItems: "center",
                  padding: 24,
                },
              ]}
            >
              <View style={styles.modalBadgeHeader}>
                <Ionicons name="trophy" size={42} color="#FBBF24" />
              </View>

              <RNText
                style={{ fontSize: 24, fontWeight: "800", color: textColor }}
              >
                Level {currentLevel}
              </RNText>

              <RNText
                style={{
                  fontSize: 14,
                  fontWeight: "600",
                  color: accentColor,
                  marginTop: 2,
                }}
              >
                {currentLevelObj.title}
              </RNText>

              <RNText
                style={{
                  fontSize: 13,
                  color: subTextColor,
                  marginTop: 10,
                  textAlign: "center",
                }}
              >
                You have earned{" "}
                <RNText style={{ fontWeight: "700", color: textColor }}>
                  {points} XP
                </RNText>
                . Keep completing tasks to reach the next rank!
              </RNText>
            </View>

            <RNText
              style={{
                fontSize: 16,
                fontWeight: "700",
                color: textColor,
                marginTop: 10,
                marginBottom: 20,
              }}
            >
              Progression Path
            </RNText>

            <View style={{ paddingLeft: 10 }}>
              {LEVEL_MAP_DATA.map((lvl, idx) => {
                const isPassed = currentLevel > lvl.level;
                const isCurrent = currentLevel === lvl.level;
                const isLocked = currentLevel < lvl.level;

                return (
                  <View
                    key={lvl.level}
                    style={{
                      flexDirection: "row",
                      marginBottom: 24,
                      position: "relative",
                    }}
                  >
                    {idx !== LEVEL_MAP_DATA.length - 1 && (
                      <View
                        style={{
                          position: "absolute",
                          left: 20,
                          top: 40,
                          bottom: -24,
                          width: 4,
                          backgroundColor: isPassed
                            ? "#10B981"
                            : isDarkmode
                              ? "#232D42"
                              : "#CBD5E1",
                        }}
                      />
                    )}

                    <View
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 22,
                        backgroundColor: isCurrent
                          ? "#FBBF24"
                          : isPassed
                            ? "#10B981"
                            : isDarkmode
                              ? "#1E293B"
                              : "#E2E8F0",
                        alignItems: "center",
                        justifyContent: "center",
                        zIndex: 2,
                        borderWidth: isCurrent ? 3 : 1,
                        borderColor: isCurrent
                          ? "#FFFFFF"
                          : isPassed
                            ? "#059669"
                            : borderColor,
                      }}
                    >
                      {isPassed ? (
                        <Ionicons name="checkmark" size={22} color="#FFFFFF" />
                      ) : isCurrent ? (
                        <Ionicons name="star" size={22} color="#FFFFFF" />
                      ) : (
                        <Ionicons
                          name="lock-closed"
                          size={18}
                          color={subTextColor}
                        />
                      )}
                    </View>

                    <View
                      style={[
                        styles.card,
                        {
                          flex: 1,
                          marginLeft: 16,
                          marginBottom: 0,
                          backgroundColor: cardColor,
                          borderColor: isCurrent ? "#FBBF24" : borderColor,
                          borderWidth: isCurrent ? 2 : 1,
                          padding: 14,
                        },
                      ]}
                    >
                      <View
                        style={{
                          flexDirection: "row",
                          justifyContent: "space-between",
                          alignItems: "center",
                        }}
                      >
                        <RNText
                          style={{
                            fontSize: 15,
                            fontWeight: "800",
                            color: isLocked ? subTextColor : textColor,
                          }}
                        >
                          Level {lvl.level}: {lvl.title}
                        </RNText>
                        {isCurrent && (
                          <View style={styles.currentBadgePill}>
                            <RNText style={styles.currentBadgePillText}>
                              CURRENT
                            </RNText>
                          </View>
                        )}
                      </View>

                      <RNText
                        style={{
                          fontSize: 12,
                          color: subTextColor,
                          marginTop: 4,
                        }}
                      >
                        {lvl.minPts} -{" "}
                        {lvl.maxPts === 9999 ? "1500+" : lvl.maxPts} XP Needed
                      </RNText>

                      {isCurrent && (
                        <View style={{ marginTop: 8 }}>
                          <View
                            style={[
                              styles.progressBarBackground,
                              {
                                backgroundColor: isDarkmode
                                  ? "#202A3C"
                                  : "#E2E8F0",
                                height: 6,
                              },
                            ]}
                          >
                            <View
                              style={[
                                styles.progressBarFill,
                                {
                                  width: `${levelProgressPercent}%`,
                                  backgroundColor: "#FBBF24",
                                },
                              ]}
                            />
                          </View>
                        </View>
                      )}
                    </View>
                  </View>
                );
              })}
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* AI CHAT MODAL */}
      <Modal visible={showAIChat} animationType="slide" transparent={false}>
        <View style={{ flex: 1, backgroundColor }}>
          <View
            style={{
              paddingTop: Platform.OS === "ios" ? 50 : 30,
              backgroundColor: cardColor,
              borderBottomWidth: 1,
              borderBottomColor: borderColor,
            }}
          >
            <TopNav
              middleContent="AI Task Assistant"
              leftContent={
                <Ionicons name="close" size={28} color={textColor} />
              }
              leftAction={() => setShowAIChat(false)}
            />
          </View>

          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === "ios" ? "padding" : undefined}
          >
            <FlatList
              ref={flatListRef}
              data={chatMessages}
              keyExtractor={(_, index) => index.toString()}
              contentContainerStyle={{ padding: 16 }}
              onContentSizeChange={() => flatListRef.current?.scrollToEnd()}
              ListEmptyComponent={
                <View style={{ alignItems: "center", marginTop: 50 }}>
                  <Ionicons
                    name="chatbubbles-outline"
                    size={48}
                    color={subTextColor}
                  />
                  <RNText
                    style={{
                      color: subTextColor,
                      marginTop: 16,
                      textAlign: "center",
                      fontSize: 15,
                    }}
                  >
                    Ask me about your priorities, workload,{"\n"}or how to
                    tackle your overdue tasks!
                  </RNText>
                </View>
              }
              renderItem={({ item }) => (
                <View
                  style={[
                    styles.chatBubble,
                    item.role === "user"
                      ? [styles.chatUser, { backgroundColor: accentColor }]
                      : [
                          styles.chatAi,
                          {
                            backgroundColor: cardColor,
                            borderColor,
                            borderWidth: 1,
                          },
                        ],
                  ]}
                >
                  <RNText
                    style={{
                      color: item.role === "user" ? "#FFF" : textColor,
                      fontSize: 15,
                      lineHeight: 22,
                    }}
                  >
                    {item.content}
                  </RNText>
                </View>
              )}
            />

            {isAiTyping && (
              <View style={{ paddingHorizontal: 20, paddingBottom: 10 }}>
                <RNText
                  style={{
                    color: subTextColor,
                    fontStyle: "italic",
                    fontSize: 12,
                  }}
                >
                  Assistant is typing...
                </RNText>
              </View>
            )}

            <View
              style={[
                styles.chatInputContainer,
                { backgroundColor: cardColor, borderTopColor: borderColor },
              ]}
            >
              <TextInput
                style={[
                  styles.chatInput,
                  {
                    color: textColor,
                    backgroundColor: isDarkmode ? "#0F172A" : "#F1F5F9",
                  },
                ]}
                placeholder="Message AI Assistant..."
                placeholderTextColor={subTextColor}
                value={chatInput}
                onChangeText={setChatInput}
                onSubmitEditing={handleSendAiMessage}
              />
              <TouchableOpacity
                style={[
                  styles.sendBtn,
                  {
                    backgroundColor: chatInput.trim()
                      ? accentColor
                      : subTextColor,
                  },
                ]}
                onPress={handleSendAiMessage}
                disabled={!chatInput.trim()}
              >
                <Ionicons name="send" size={16} color="#FFF" />
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </Layout>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  scrollContent: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 24 },
  card: {
    borderRadius: 22,
    padding: 18,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
  },
  heroCard: {
    borderRadius: 22,
    padding: 18,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  heroTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  badgeLabelContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  pulseDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "#10B981",
    marginRight: 6,
  },
  heroSubHeader: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.8,
    color: "#64748B",
  },
  xpPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FBBF2418",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#FBBF2430",
  },
  xpText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#D97706",
    marginLeft: 4,
  },
  levelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 10,
  },
  levelTitleText: {
    fontSize: 26,
    fontWeight: "900",
    letterSpacing: -0.5,
  },
  trophyGlowBox: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#FBBF2415",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#FBBF2440",
  },
  progressTrackContainer: {
    marginTop: 14,
  },
  progressBarBackground: {
    height: 10,
    borderRadius: 6,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    borderRadius: 6,
  },
  heroBottomRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 10,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
    paddingHorizontal: 2,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  progressHeroRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  ringGraphicContainer: {
    marginRight: 16,
  },
  outerRing: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  progressHeroMeta: {
    flex: 1,
  },
  cardLabelText: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  progressHeroHeading: {
    fontSize: 16,
    fontWeight: "800",
    marginTop: 2,
  },
  miniBarBg: {
    height: 6,
    borderRadius: 3,
    overflow: "hidden",
    marginTop: 8,
  },
  miniBarFill: {
    height: "100%",
    borderRadius: 3,
  },
  gridRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  gridCard: {
    width: "48%",
    borderRadius: 20,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  gridCardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  statusPillActive: {
    backgroundColor: "#3B82F615",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  statusPillActiveText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#3B82F6",
  },
  statusPillOverdue: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  statusPillOverdueText: {
    fontSize: 10,
    fontWeight: "700",
  },
  gridValueText: {
    fontSize: 28,
    fontWeight: "900",
    marginTop: 12,
  },
  gridLabelText: {
    fontSize: 12,
    fontWeight: "600",
    marginTop: 2,
  },
  aiSuggestionBox: {
    flexDirection: "row",
    padding: 10,
    borderRadius: 12,
    marginBottom: 12,
  },
  notesInput: {
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    fontSize: 13,
    textAlignVertical: "top",
    minHeight: 70,
  },
  fullNotesInput: {
    flex: 1,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    fontSize: 15,
    lineHeight: 22,
    textAlignVertical: "top",
  },
  ruleRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  ruleText: {
    fontSize: 13,
    marginLeft: 8,
  },
  modalBadgeHeader: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#FBBF2420",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#FBBF24",
    marginBottom: 12,
  },
  currentBadgePill: {
    backgroundColor: "#FBBF2420",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  currentBadgePillText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#D97706",
  },
  bottomNav: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    height: 72,
    borderTopWidth: 1,
    paddingBottom: Platform.OS === "ios" ? 18 : 0,
  },
  navItem: { alignItems: "center", justifyContent: "center", flex: 1 },
  navText: { fontSize: 10, marginTop: 3, fontWeight: "600" },
  navItemCentral: {
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
    marginTop: -22,
  },
  centralButton: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#6366F1",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
  chatBubble: {
    maxWidth: "80%",
    padding: 14,
    borderRadius: 20,
    marginBottom: 12,
  },
  chatUser: { alignSelf: "flex-end", borderBottomRightRadius: 4 },
  chatAi: { alignSelf: "flex-start", borderBottomLeftRadius: 4 },
  chatInputContainer: {
    flexDirection: "row",
    padding: 12,
    paddingBottom: Platform.OS === "ios" ? 30 : 12,
    borderTopWidth: 1,
  },
  chatInput: {
    flex: 1,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    marginRight: 10,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
});
