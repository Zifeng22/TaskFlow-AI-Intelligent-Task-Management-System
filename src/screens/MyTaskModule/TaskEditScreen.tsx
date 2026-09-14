import React, { useState, useEffect } from "react";
import { GROQ_CONFIG } from "../../../keys";
import OpenAI from "openai";
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput as RNTextInput,
  Text as RNText,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from "react-native";
import { Layout, TopNav, useTheme, themeColor } from "react-native-rapi-ui";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker, {
  DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  getDocs,
  increment,
} from "firebase/firestore";
import { getAuth } from "firebase/auth";
import CssThinkingLoader from "../../components/utils/CssThinkingLoader";

// Initialize OpenAI client for Groq API calls
const groq = new OpenAI({
  baseURL: GROQ_CONFIG.BASE_URL,
  apiKey: GROQ_CONFIG.API_KEY,
  dangerouslyAllowBrowser: true, // This option allows the OpenAI client to be used in a browser environment, which is necessary for React Native apps that run on mobile devices.
});

export default function TaskEditScreen({ navigation, route }: any) {
  const { isDarkmode } = useTheme();

  const auth = getAuth();
  const db = getFirestore();
  const editTaskId = route.params?.taskId;
  const isEditing = !!editTaskId;

  // ============================================================
  // LOADING STATES
  // ============================================================

  const [loading, setLoading] = useState(isEditing);
  const [saving, setSaving] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);

  // ============================================================
  // DATE PICKERS
  // ============================================================

  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showDueDatePicker, setShowDueDatePicker] = useState(false);

  // ============================================================
  // AVAILABLE TASKS FOR DEPENDENCY
  // ============================================================

  const [availableTasks, setAvailableTasks] = useState<
    { id: string; title: string }[]
  >([]);

  // ============================================================
  // TASK STATE
  // ============================================================

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");

  const [priority, setPriority] = useState<"Low" | "Medium" | "High" | "">("");

  const [importance, setImportance] = useState("");

  const [status, setStatus] = useState<
    "Pending" | "In Progress" | "Completed" | ""
  >("");

  const [progress, setProgress] = useState("");

  // Stored in YYYY-MM-DD format
  const [startDate, setStartDate] = useState("");
  const [dueDate, setDueDate] = useState("");

  // Optional dependency
  const [dependsOnTaskId, setDependsOnTaskId] = useState("");

  // Used to determine whether the user is completing a task for the first time.
  const [originalStatus, setOriginalStatus] = useState("");

  // ============================================================
  // DESIGN TOKENS
  // ============================================================

  const backgroundColor = isDarkmode ? "#0F172A" : "#F8FAFC";
  const cardColor = isDarkmode ? "#1E293B" : "#FFFFFF";
  const textColor = isDarkmode ? "#F8FAFC" : "#0F172A";
  const subTextColor = isDarkmode ? "#94A3B8" : "#64748B";
  const borderColor = isDarkmode ? "#334155" : "#E2E8F0";
  const inputBgColor = isDarkmode ? "#0F172A" : "#F1F5F9";
  const accentColor = "#6366F1";

  // ============================================================
  // GET TODAY
  // ============================================================

  const getToday = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
  };

  // ============================================================
  // FORMAT DATE TO YYYY-MM-DD
  // ============================================================

  const formatDate = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  // ============================================================
  // CONVERT YYYY-MM-DD TO DATE OBJECT
  // ============================================================

  const getDateFromString = (dateString: string) => {
    if (!dateString) {
      return getToday();
    }

    const parts = dateString.split("-");

    if (parts.length !== 3) {
      return getToday();
    }

    const year = Number(parts[0]);
    const month = Number(parts[1]);
    const day = Number(parts[2]);

    const date = new Date(year, month - 1, day);
    date.setHours(0, 0, 0, 0);

    return date;
  };

  // ============================================================
  // FORMAT DATE FOR DISPLAY
  // ============================================================

  const getDisplayDate = (dateStr: string, placeholder: string) => {
    if (!dateStr) {
      return placeholder;
    }
    return getDateFromString(dateStr).toDateString();
  };

  // ============================================================
  // 1. FETCH DATA ON LOAD
  // ============================================================

  useEffect(() => {
    const fetchData = async () => {
      const user = auth.currentUser;

      if (!user) {
        setLoading(false);
        return;
      }

      try {
        const tasksSnap = await getDocs(collection(db, "Tasks"));

        const tasksList = tasksSnap.docs
          .map((d) => ({
            id: d.id,
            title: d.data().title || "Untitled Task",
          }))
          .filter((task) => task.id !== editTaskId);

        setAvailableTasks(tasksList);

        if (isEditing) {
          const taskDoc = await getDoc(doc(db, "Tasks", editTaskId));

          if (taskDoc.exists()) {
            const task = taskDoc.data();

            setTitle(task.title || "");
            setDescription(task.description || "");
            setCategory(task.category || "");
            setPriority(task.priority || "");
            setImportance(
              task.importance !== undefined ? String(task.importance) : "",
            );
            setStatus(task.status || "");
            setOriginalStatus(task.status || "");
            setProgress(
              task.progress !== undefined ? String(task.progress) : "",
            );
            setStartDate(task.startDate || "");
            setDueDate(task.dueDate || "");
            setDependsOnTaskId(task.dependsOnTaskId || "");
          }
        }
      } catch (error) {
        console.log("Fetch data error:", error);
        Alert.alert("Error", "Failed to load task data.");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [editTaskId]);

  // ============================================================
  // 2. DATE PICKER HANDLERS
  // ============================================================

  const handleStartDateChange = (
    event: DateTimePickerEvent,
    selectedDate?: Date,
  ) => {
    setShowStartDatePicker(false);

    if (event.type !== "set" || !selectedDate) {
      return;
    }

    const selected = new Date(selectedDate);
    selected.setHours(0, 0, 0, 0);

    if (dueDate && selected > getDateFromString(dueDate)) {
      Alert.alert(
        "Invalid Start Date",
        "Start date cannot be after the due date.",
      );
      return;
    }

    setStartDate(formatDate(selected));
  };

  const handleDueDateChange = (
    event: DateTimePickerEvent,
    selectedDate?: Date,
  ) => {
    setShowDueDatePicker(false);

    if (event.type !== "set" || !selectedDate) {
      return;
    }

    const selected = new Date(selectedDate);
    selected.setHours(0, 0, 0, 0);

    const today = getToday();

    if (selected < today) {
      Alert.alert("Invalid Due Date", "The due date cannot be before today.");
      return;
    }

    if (startDate && selected < getDateFromString(startDate)) {
      Alert.alert(
        "Invalid Due Date",
        "Due date cannot be before the start date.",
      );
      return;
    }

    setDueDate(formatDate(selected));
  };

  // ============================================================
  // 3. AI ASSIST (REFACTORED FOR GROQ API)
  // ============================================================

  const handleAiAssist = async () => {
    const hasTitle = title.trim().length > 0;
    const hasDescription = description.trim().length > 0;

    if (!hasTitle && !hasDescription) {
      Alert.alert(
        "AI Assist",
        "Please enter either a task title or description first.",
      );
      return;
    }

    if (!GROQ_CONFIG.API_KEY) {
      Alert.alert(
        "AI Configuration Error",
        "Please add your Groq API key inside keys.ts before using AI Assist.",
      );
      return;
    }

    setAiLoading(true);

    let instruction = "";

    if (hasTitle && !hasDescription) {
      instruction = `The user entered a title but no description. Keep title unchanged and generate a useful description.`;
    } else if (!hasTitle && hasDescription) {
      instruction = `The user entered a description but no title. Keep description unchanged and generate a short title.`;
    } else {
      instruction = `Improve both title and description while keeping original meaning. Make title concise and description clear.`;
    }

    const systemPrompt = {
      role: "system" as const,
      content: `You are an AI task assistant. Return JSON ONLY with keys "title" and "description". Do NOT wrap the response in markdown blocks or write extra words.
JSON Schema format:
{"title": "string", "description": "string"}`,
    };

    const userPrompt = {
      role: "user" as const,
      content: `${instruction}
Current Title: "${title}"
Current Description: "${description}"`,
    };

    try {
      const response = await groq.chat.completions.create({
        model: GROQ_CONFIG.MODEL,
        messages: [systemPrompt, userPrompt],
        temperature: 0.3,
        response_format: { type: "json_object" },
      });

      const content = response.choices[0]?.message?.content;

      if (!content) {
        throw new Error("The AI returned an empty response.");
      }

      const aiData = JSON.parse(content);

      if (typeof aiData.title === "string" && aiData.title.trim()) {
        setTitle(aiData.title.trim());
      }

      if (typeof aiData.description === "string" && aiData.description.trim()) {
        setDescription(aiData.description.trim());
      }

      Alert.alert(
        "AI Assist",
        "The task information has been generated successfully.",
      );
    } catch (error: any) {
      console.log("Groq AI Assist Error:", error);
      Alert.alert(
        "AI Error",
        error?.message || "Could not generate task details right now.",
      );
    } finally {
      setAiLoading(false);
    }
  };

  // ============================================================
  // 4. VALIDATION
  // ============================================================

  const validateTask = () => {
    if (!title.trim()) {
      Alert.alert("Required Field", "Please enter a task title.");
      return false;
    }

    if (!description.trim()) {
      Alert.alert("Required Field", "Please enter a task description.");
      return false;
    }

    if (!category.trim()) {
      Alert.alert("Required Field", "Please enter a task category.");
      return false;
    }

    if (!priority) {
      Alert.alert("Required Field", "Please select a priority.");
      return false;
    }

    if (!importance) {
      Alert.alert("Required Field", "Please select the task importance.");
      return false;
    }

    if (!startDate) {
      Alert.alert("Required Field", "Please select a start date.");
      return false;
    }

    if (!dueDate) {
      Alert.alert("Required Field", "Please select a due date.");
      return false;
    }

    const selectedStartDate = getDateFromString(startDate);
    const selectedDueDate = getDateFromString(dueDate);
    const today = getToday();

    if (selectedDueDate < today) {
      Alert.alert("Invalid Due Date", "The due date cannot be before today.");
      return false;
    }

    if (selectedDueDate < selectedStartDate) {
      Alert.alert(
        "Invalid Dates",
        "The due date cannot be earlier than the start date.",
      );
      return false;
    }

    if (!status) {
      Alert.alert("Required Field", "Please select a task status.");
      return false;
    }

    if (status === "In Progress") {
      if (!progress.trim()) {
        Alert.alert("Required Field", "Please enter the task progress.");
        return false;
      }

      const progressNumber = Number(progress);

      if (isNaN(progressNumber) || progressNumber < 0 || progressNumber > 100) {
        Alert.alert("Invalid Progress", "Progress must be between 0 and 100.");
        return false;
      }
    }

    return true;
  };

  // ============================================================
  // 5. SAVE TASK
  // ============================================================

  const handleSave = async () => {
    if (!validateTask()) {
      return;
    }

    const user = auth.currentUser;

    if (!user) {
      Alert.alert("Authentication Error", "Please log in again.");
      return;
    }

    setSaving(true);

    try {
      const taskId = isEditing ? editTaskId : doc(collection(db, "Tasks")).id;
      const finalProgress = status === "Completed" ? 100 : Number(progress);

      const taskData = {
        title: title.trim(),
        description: description.trim(),
        category: category.trim(),
        priority,
        importance: Number(importance),
        status,
        progress: finalProgress,
        startDate,
        dueDate,
        assignedTo: user.uid,
        dependsOnTaskId: dependsOnTaskId.trim(),
      };

      if (isEditing) {
        await updateDoc(doc(db, "Tasks", taskId), taskData);
      } else {
        await setDoc(doc(db, "Tasks", taskId), taskData);
      }

      if (status === "Completed" && originalStatus !== "Completed") {
        const userRef = doc(db, "Users", user.uid);

        await updateDoc(userRef, {
          points: increment(50),
        });

        Alert.alert("Task Completed!", "You earned 50 Points!", [
          {
            text: "Awesome!",
            onPress: () => navigation.goBack(),
          },
        ]);
      } else {
        navigation.goBack();
      }
    } catch (error: any) {
      console.log("Save task error:", error);
      Alert.alert(
        "Error Saving Task",
        error?.message || "Something went wrong while saving the task.",
      );
    } finally {
      setSaving(false);
    }
  };

  // ============================================================
  // LOADING SCREEN
  // ============================================================

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor,
        }}
      >
        <CssThinkingLoader isDarkmode={isDarkmode} size={44} speed={1.5} />
      </View>
    );
  }

  // ============================================================
  // MAIN UI
  // ============================================================

  return (
    <Layout
      style={{
        flex: 1,
        backgroundColor: isDarkmode ? themeColor.dark200 : backgroundColor,
      }}
    >
      <TopNav
        middleContent={isEditing ? "Edit Task" : "Create Task"}
        leftContent={
          <Ionicons name="chevron-back" size={22} color={textColor} />
        }
        leftAction={() => navigation.goBack()}
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* BASIC INFORMATION */}
          <View
            style={[styles.card, { backgroundColor: cardColor, borderColor }]}
          >
            {/* TITLE */}
            <View style={styles.rowBetween}>
              <RNText style={[styles.label, { color: textColor }]}>
                Title *
              </RNText>

              <TouchableOpacity
                onPress={handleAiAssist}
                style={styles.aiButton}
                disabled={aiLoading}
              >
                {aiLoading ? (
                  <CssThinkingLoader isDarkmode={true} size={14} speed={2} />
                ) : (
                  <Ionicons name="sparkles" size={14} color="#FFFFFF" />
                )}
                <RNText style={styles.aiButtonText}>AI Assist</RNText>
              </TouchableOpacity>
            </View>

            <RNTextInput
              style={[
                styles.input,
                {
                  backgroundColor: inputBgColor,
                  borderColor,
                  color: textColor,
                },
              ]}
              placeholder="What needs to be done?"
              placeholderTextColor={subTextColor}
              value={title}
              onChangeText={setTitle}
            />

            {/* DESCRIPTION */}
            <RNText style={[styles.label, { color: textColor, marginTop: 12 }]}>
              Description *
            </RNText>

            <RNTextInput
              style={[
                styles.input,
                {
                  backgroundColor: inputBgColor,
                  borderColor,
                  color: textColor,
                  minHeight: 90,
                  textAlignVertical: "top",
                },
              ]}
              placeholder="Add details, links, or notes..."
              placeholderTextColor={subTextColor}
              multiline
              value={description}
              onChangeText={setDescription}
            />

            {/* CATEGORY */}
            <View style={{ marginTop: 12 }}>
              <RNText style={[styles.label, { color: textColor }]}>
                Category *
              </RNText>

              <RNTextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: inputBgColor,
                    borderColor,
                    color: textColor,
                  },
                ]}
                placeholder="e.g. Design, Dev"
                placeholderTextColor={subTextColor}
                value={category}
                onChangeText={setCategory}
              />
            </View>
          </View>

          {/* PRIORITY, START DATE & DUE DATE */}
          <View
            style={[styles.card, { backgroundColor: cardColor, borderColor }]}
          >
            {/* PRIORITY */}
            <RNText style={[styles.label, { color: textColor }]}>
              Priority *
            </RNText>

            <View
              style={[
                styles.segmentContainer,
                {
                  backgroundColor: isDarkmode
                    ? "rgba(255,255,255,0.08)"
                    : "#F1F5F9",
                },
              ]}
            >
              {(["Low", "Medium", "High"] as const).map((p) => (
                <TouchableOpacity
                  key={p}
                  style={[
                    styles.segmentButton,
                    priority === p && {
                      backgroundColor:
                        p === "High"
                          ? "#F87171"
                          : p === "Medium"
                            ? "#FBBF24"
                            : "#34D399",
                    },
                  ]}
                  onPress={() => setPriority(p)}
                >
                  <RNText
                    style={{
                      color: priority === p ? "#FFFFFF" : subTextColor,
                      fontWeight: priority === p ? "700" : "600",
                    }}
                  >
                    {p}
                  </RNText>
                </TouchableOpacity>
              ))}
            </View>

            {/* DATES ROW */}
            <View style={styles.dateRow}>
              {/* START DATE */}
              <View style={{ flex: 1 }}>
                <RNText
                  style={[styles.label, { color: textColor, marginTop: 15 }]}
                >
                  Start Date *
                </RNText>

                <TouchableOpacity
                  onPress={() => setShowStartDatePicker(true)}
                  style={[
                    styles.dateButton,
                    { backgroundColor: inputBgColor, borderColor },
                  ]}
                >
                  <RNText
                    style={{
                      color: startDate ? textColor : subTextColor,
                      fontSize: 13,
                    }}
                  >
                    {getDisplayDate(startDate, "Select start")}
                  </RNText>

                  <Ionicons
                    name="calendar-outline"
                    size={18}
                    color={subTextColor}
                  />
                </TouchableOpacity>

                {showStartDatePicker && Platform.OS === "web" && (
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (!val) return;
                      if (dueDate && val > dueDate) {
                        Alert.alert(
                          "Invalid Start Date",
                          "Start date cannot be after the due date.",
                        );
                        return;
                      }
                      setStartDate(val);
                      setShowStartDatePicker(false);
                    }}
                    style={{
                      marginTop: 10,
                      padding: 10,
                      fontSize: 14,
                      borderRadius: 8,
                      border: `1px solid ${borderColor}`,
                      backgroundColor: inputBgColor,
                      color: textColor,
                      width: "100%",
                      boxSizing: "border-box",
                    }}
                  />
                )}

                {showStartDatePicker && Platform.OS !== "web" && (
                  <DateTimePicker
                    value={
                      startDate ? getDateFromString(startDate) : getToday()
                    }
                    mode="date"
                    display="default"
                    onChange={handleStartDateChange}
                  />
                )}
              </View>

              {/* DUE DATE */}
              <View style={{ flex: 1 }}>
                <RNText
                  style={[styles.label, { color: textColor, marginTop: 15 }]}
                >
                  Due Date *
                </RNText>

                <TouchableOpacity
                  onPress={() => setShowDueDatePicker(true)}
                  style={[
                    styles.dateButton,
                    { backgroundColor: inputBgColor, borderColor },
                  ]}
                >
                  <RNText
                    style={{
                      color: dueDate ? textColor : subTextColor,
                      fontSize: 13,
                    }}
                  >
                    {getDisplayDate(dueDate, "Select due")}
                  </RNText>

                  <Ionicons
                    name="calendar-outline"
                    size={18}
                    color={subTextColor}
                  />
                </TouchableOpacity>

                {showDueDatePicker && Platform.OS === "web" && (
                  <input
                    type="date"
                    value={dueDate}
                    min={startDate || formatDate(getToday())}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (!val) return;
                      if (val < formatDate(getToday())) {
                        Alert.alert(
                          "Invalid Due Date",
                          "The due date cannot be before today.",
                        );
                        return;
                      }
                      if (startDate && val < startDate) {
                        Alert.alert(
                          "Invalid Due Date",
                          "Due date cannot be before start date.",
                        );
                        return;
                      }
                      setDueDate(val);
                      setShowDueDatePicker(false);
                    }}
                    style={{
                      marginTop: 10,
                      padding: 10,
                      fontSize: 14,
                      borderRadius: 8,
                      border: `1px solid ${borderColor}`,
                      backgroundColor: inputBgColor,
                      color: textColor,
                      width: "100%",
                      boxSizing: "border-box",
                    }}
                  />
                )}

                {showDueDatePicker && Platform.OS !== "web" && (
                  <DateTimePicker
                    value={dueDate ? getDateFromString(dueDate) : getToday()}
                    mode="date"
                    display="default"
                    minimumDate={
                      startDate ? getDateFromString(startDate) : getToday()
                    }
                    onChange={handleDueDateChange}
                  />
                )}
              </View>
            </View>

            {/* IMPORTANCE */}
            <View style={{ marginTop: 15 }}>
              <RNText style={[styles.label, { color: textColor }]}>
                Importance *
              </RNText>

              <View style={styles.importanceRow}>
                {[1, 2, 3, 4, 5].map((value) => {
                  const selected = importance === String(value);

                  return (
                    <TouchableOpacity
                      key={value}
                      onPress={() => setImportance(String(value))}
                      style={[
                        styles.importanceOption,
                        {
                          backgroundColor: selected
                            ? accentColor
                            : inputBgColor,
                          borderColor: selected ? accentColor : borderColor,
                        },
                      ]}
                    >
                      <RNText
                        style={{
                          color: selected ? "#FFFFFF" : textColor,
                          fontWeight: "700",
                          fontSize: 15,
                        }}
                      >
                        {value}
                      </RNText>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <RNText
                style={{
                  marginTop: 6,
                  color: subTextColor,
                  fontSize: 12,
                }}
              >
                1 = Least important {"   "}5 = Most important
              </RNText>
            </View>
          </View>

          {/* STATUS & DEPENDENCIES */}
          <View
            style={[styles.card, { backgroundColor: cardColor, borderColor }]}
          >
            {/* STATUS */}
            <RNText style={[styles.label, { color: textColor }]}>
              Status *
            </RNText>

            <View
              style={[
                styles.segmentContainer,
                {
                  backgroundColor: isDarkmode
                    ? "rgba(255,255,255,0.08)"
                    : "#F1F5F9",
                },
              ]}
            >
              {(["Pending", "In Progress", "Completed"] as const).map((s) => (
                <TouchableOpacity
                  key={s}
                  style={[
                    styles.segmentButton,
                    status === s && {
                      backgroundColor: accentColor,
                    },
                  ]}
                  onPress={() => setStatus(s)}
                >
                  <RNText
                    style={{
                      color: status === s ? "#FFFFFF" : subTextColor,
                      fontWeight: status === s ? "700" : "600",
                      fontSize: 12,
                    }}
                  >
                    {s}
                  </RNText>
                </TouchableOpacity>
              ))}
            </View>

            {/* PROGRESS */}
            {status === "In Progress" && (
              <View style={{ marginTop: 16 }}>
                <RNText style={[styles.label, { color: textColor }]}>
                  Progress % *
                </RNText>

                <RNTextInput
                  style={[
                    styles.input,
                    {
                      backgroundColor: inputBgColor,
                      borderColor,
                      color: textColor,
                    },
                  ]}
                  keyboardType="numeric"
                  placeholder="0 - 100"
                  placeholderTextColor={subTextColor}
                  value={progress}
                  onChangeText={setProgress}
                />

                <RNText
                  style={{
                    marginTop: 5,
                    color: subTextColor,
                    fontSize: 12,
                  }}
                >
                  Enter a value from 0 to 100.
                </RNText>
              </View>
            )}

            {/* DEPENDENCY */}
            <RNText style={[styles.label, { color: textColor, marginTop: 16 }]}>
              Depends On
            </RNText>

            <RNTextInput
              style={[
                styles.input,
                {
                  backgroundColor: inputBgColor,
                  borderColor,
                  color: textColor,
                },
              ]}
              placeholder="Optional blocker task ID"
              placeholderTextColor={subTextColor}
              value={dependsOnTaskId}
              onChangeText={setDependsOnTaskId}
            />

            {/* AVAILABLE TASKS */}
            {availableTasks.length > 0 && (
              <View style={{ marginTop: 8 }}>
                <RNText
                  style={{
                    fontSize: 12,
                    color: subTextColor,
                    marginBottom: 4,
                  }}
                >
                  Available Tasks:
                </RNText>

                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {availableTasks.map((task) => (
                    <TouchableOpacity
                      key={task.id}
                      onPress={() => setDependsOnTaskId(task.id)}
                      style={[
                        styles.pill,
                        {
                          backgroundColor: inputBgColor,
                          borderColor: borderColor,
                        },
                      ]}
                    >
                      <RNText
                        style={{
                          fontSize: 11,
                          color: textColor,
                        }}
                      >
                        {task.title}
                      </RNText>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}
          </View>

          {/* SAVE BUTTON */}
          <TouchableOpacity
            style={[
              styles.submitButton,
              {
                backgroundColor: accentColor,
                opacity: saving ? 0.7 : 1,
              },
            ]}
            onPress={handleSave}
            disabled={saving}
            activeOpacity={0.8}
          >
            {saving ? (
              <CssThinkingLoader isDarkmode={true} size={24} speed={1.5} />
            ) : (
              <RNText style={styles.submitButtonText}>
                {isEditing ? "Update Task" : "Create Task"}
              </RNText>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </Layout>
  );
}

// ============================================================
// STYLES
// ============================================================

const styles = StyleSheet.create({
  scrollContent: {
    padding: 16,
    paddingBottom: 60,
  },
  card: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  label: {
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 6,
    marginLeft: 4,
  },
  input: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
  },
  rowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  aiButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#A855F7",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  aiButtonText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "700",
    marginLeft: 4,
  },
  segmentContainer: {
    flexDirection: "row",
    borderRadius: 14,
    padding: 4,
  },
  segmentButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
  },
  dateRow: {
    flexDirection: "row",
    gap: 12,
  },
  dateButton: {
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  importanceRow: {
    flexDirection: "row",
    gap: 8,
  },
  importanceOption: {
    flex: 1,
    minHeight: 45,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 12,
    borderWidth: 1,
    marginRight: 8,
  },
  submitButton: {
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  submitButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
});
