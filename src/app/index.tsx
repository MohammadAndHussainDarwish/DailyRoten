import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  AppState,
  FlatList,
  Keyboard,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

type Task = {
  id: string;
  title: string;
  time?: string;
  completed: boolean;
  date: string;
};

const TASKS_STORAGE_KEY = "todo-tasks";

function getDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isTask(value: unknown): value is Task {
  if (typeof value !== "object" || value === null) return false;

  const task = value as Record<string, unknown>;
  return (
    typeof task.id === "string" &&
    typeof task.title === "string" &&
    typeof task.completed === "boolean" &&
    (task.time === undefined || typeof task.time === "string") &&
    typeof task.date === "string"
  );
}

function formatTaskTime(time: string) {
  if (time.includes("ص") || time.includes("م")) return time;

  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(time);
  if (!match) return time;

  const hour = Number(match[1]);
  const period = hour < 12 ? "ص" : "م";
  const hour12 = hour % 12 || 12;
  return `${String(hour12).padStart(2, "0")}:${match[2]} ${period}`;
}

export default function Index() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [title, setTitle] = useState("");
  const [time, setTime] = useState("");
  const [timePeriod, setTimePeriod] = useState<"ص" | "م">("ص");
  const [showTime, setShowTime] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [storageReady, setStorageReady] = useState(false);
  const writeQueue = useRef<Promise<void>>(Promise.resolve());

  const completedCount = useMemo(
    () => tasks.filter((task) => task.completed).length,
    [tasks],
  );
  const dateLabel = new Intl.DateTimeFormat("ar", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date());

  useEffect(() => {
    let mounted = true;

    async function loadTasks() {
      try {
        const storedTasks = await AsyncStorage.getItem(TASKS_STORAGE_KEY);
        const parsedTasks: unknown = storedTasks ? JSON.parse(storedTasks) : [];

        if (!Array.isArray(parsedTasks) || !parsedTasks.every(isTask)) {
          throw new Error("Saved task data has an invalid format.");
        }

        const today = getDateKey(new Date());
        const currentTasks = parsedTasks.filter((task) => task.date === today);
        if (mounted) {
          setTasks(currentTasks);
          setStorageReady(true);
        }
      } catch (error) {
        console.error("Failed to load saved tasks.", error);
        if (mounted) {
          Alert.alert("تعذر تحميل المهام", "حدث خطأ أثناء قراءة المهام المحفوظة.");
        }
      }
    }

    void loadTasks();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!storageReady) return;

    writeQueue.current = writeQueue.current
      .then(() => AsyncStorage.setItem(TASKS_STORAGE_KEY, JSON.stringify(tasks)))
      .catch((error: unknown) => {
        console.error("Failed to save tasks.", error);
        Alert.alert("تعذر حفظ المهام", "تحقق من مساحة التخزين وحاول مرة أخرى.");
      });
  }, [storageReady, tasks]);

  const removePreviousDayTasks = useCallback(() => {
    const today = getDateKey(new Date());
    setTasks((currentTasks) =>
      currentTasks.filter((task) => task.date === today),
    );
  }, []);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    let active = true;

    function scheduleCleanup() {
      const now = new Date();
      const nextCleanup = new Date(now);
      nextCleanup.setHours(0, 10, 0, 0);
      if (nextCleanup <= now) nextCleanup.setDate(nextCleanup.getDate() + 1);

      timer = setTimeout(() => {
        removePreviousDayTasks();
        if (active) scheduleCleanup();
      }, nextCleanup.getTime() - now.getTime());
    }

    scheduleCleanup();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") removePreviousDayTasks();
    });

    return () => {
      active = false;
      clearTimeout(timer);
      subscription.remove();
    };
  }, [removePreviousDayTasks]);

  useEffect(() => {
    if (!toastMessage) return;

    const timer = setTimeout(() => setToastMessage(""), 1800);
    return () => clearTimeout(timer);
  }, [toastMessage]);

  function addTask() {
    if (!storageReady) {
      Alert.alert("انتظر قليلاً", "جاري تحميل مهامك المحفوظة.");
      return;
    }

    const trimmedTitle = title.trim();
    const trimmedTime = time.trim();

    if (!trimmedTitle) {
      Alert.alert("أضف مهمة", "اكتب اسم المهمة أولاً.");
      return;
    }

    if (trimmedTime && !/^(0?[1-9]|1[0-2]):[0-5]\d$/.test(trimmedTime)) {
      Alert.alert("الوقت غير صحيح", "اكتب الوقت بنظام 12 ساعة، مثل 09:30.");
      return;
    }

    setTasks((currentTasks) => [
      ...currentTasks,
      {
        id: `${Date.now()}-${Math.random()}`,
        title: trimmedTitle,
        ...(trimmedTime ? { time: `${trimmedTime} ${timePeriod}` } : {}),
        completed: false,
        date: getDateKey(new Date()),
      },
    ]);
    setTitle("");
    setTime("");
    setTimePeriod("ص");
    setShowTime(false);
    Keyboard.dismiss();
  }

  function toggleTask(id: string) {
    setTasks((currentTasks) => {
      const updatedTasks = currentTasks.map((task) =>
        task.id === id ? { ...task, completed: !task.completed } : task,
      );

      const toggledTask = updatedTasks.find((task) => task.id === id);
      if (toggledTask) {
        setToastMessage(
          toggledTask.completed
            ? "🎉 تم إكمال المهمة بنجاح!"
            : "↩️ تم إلغاء إكمال المهمة",
        );
      }

      return updatedTasks;
    });
  }

  function deleteTask(id: string) {
    setTasks((currentTasks) => currentTasks.filter((task) => task.id !== id));
  }

  return (
    <View style={styles.screen}>
      <FlatList
        contentContainerStyle={styles.content}
        data={tasks}
        keyExtractor={(task) => task.id}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <>
            <View style={styles.header}>
              <View>
                <Text style={styles.eyebrow}>قائمة مهامي</Text>
                <Text style={styles.heading}>يومك، خطوة بخطوة</Text>
                <Text style={styles.date}>{dateLabel}</Text>
              </View>
              <View style={styles.headerIcon}>
                <Text style={styles.headerIconText}>✓</Text>
              </View>
            </View>

            <View style={styles.progressCard}>
              <View style={styles.progressTextRow}>
                <Text style={styles.progressTitle}>إنجاز اليوم</Text>
                <Text style={styles.progressCount}>
                  {completedCount} من {tasks.length}
                </Text>
              </View>
              <View style={styles.progressTrack}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      width:
                        tasks.length === 0
                          ? "0%"
                          : `${(completedCount / tasks.length) * 100}%`,
                    },
                  ]}
                />
              </View>
            </View>

            <View style={styles.formCard}>
              <Text style={styles.sectionTitle}>مهمة جديدة</Text>
              <TextInput
                value={title}
                onChangeText={setTitle}
                placeholder="ماذا تريد أن تنجز اليوم؟"
                placeholderTextColor="#99A3B2"
                style={styles.input}
                textAlign="right"
                returnKeyType="done"
                onSubmitEditing={addTask}
                accessibilityLabel="اسم المهمة"
              />

              <Pressable
                style={styles.timeToggle}
                onPress={() => {
                  setShowTime((visible) => !visible);
                  if (showTime) setTime("");
                }}
                accessibilityRole="switch"
                accessibilityState={{ checked: showTime }}
              >
                <View
                  style={[
                    styles.switchTrack,
                    showTime && styles.switchTrackActive,
                  ]}
                >
                  <View
                    style={[
                      styles.switchThumb,
                      showTime && styles.switchThumbActive,
                    ]}
                  />
                </View>
                <Text style={styles.timeToggleText}>إضافة وقت (اختياري)</Text>
              </Pressable>

              {showTime && (
                <TextInput
                  value={time}
                  onChangeText={setTime}
                  placeholder="مثال: 09:30"
                  placeholderTextColor="#99A3B2"
                  style={[styles.input, styles.timeInput]}
                  keyboardType="numbers-and-punctuation"
                  textAlign="right"
                  maxLength={5}
                  accessibilityLabel="وقت المهمة الاختياري"
                />
              )}
              {showTime && (
                <View style={styles.periodSelector}>
                  {(["ص", "م"] as const).map((period) => (
                    <Pressable
                      key={period}
                      onPress={() => setTimePeriod(period)}
                      style={[
                        styles.periodButton,
                        timePeriod === period && styles.periodButtonActive,
                      ]}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: timePeriod === period }}
                    >
                      <Text
                        style={[
                          styles.periodText,
                          timePeriod === period && styles.periodTextActive,
                        ]}
                      >
                        {period}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              )}

              <Pressable
                style={({ pressed }) => [
                  styles.addButton,
                  pressed && styles.buttonPressed,
                ]}
                onPress={addTask}
              >
                <Text style={styles.addButtonText}>+  أضف المهمة</Text>
              </Pressable>
            </View>

            <View style={styles.listHeading}>
              <Text style={styles.sectionTitle}>مهام اليوم</Text>
              <Text style={styles.taskCount}>{tasks.length} مهام</Text>
            </View>
          </>
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>☀</Text>
            <Text style={styles.emptyTitle}>يوم جديد وبداية جميلة</Text>
            <Text style={styles.emptyText}>
              أضف أول مهمة لك. يمكنك تحديد وقت لها أو تركها بدون وقت.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.taskCard}>
            <Pressable
              onPress={() => toggleTask(item.id)}
              style={styles.taskMain}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: item.completed }}
              accessibilityLabel={`تغيير حالة المهمة: ${item.title}`}
            >
              <View
                style={[
                  styles.checkbox,
                  item.completed && styles.checkboxCompleted,
                ]}
              >
                {item.completed && <Text style={styles.checkmark}>✓</Text>}
              </View>
              <View style={styles.taskInfo}>
                <Text
                  style={[
                    styles.taskTitle,
                    item.completed && styles.taskTitleCompleted,
                  ]}
                >
                  {item.title}
                </Text>
                <Text style={styles.taskTime}>
                  {item.time ? `◷  ${formatTaskTime(item.time)}` : "بدون وقت محدد"}
                </Text>
              </View>
            </Pressable>
            <Pressable
              onPress={() => deleteTask(item.id)}
              style={styles.deleteButton}
              accessibilityRole="button"
              accessibilityLabel={`حذف المهمة: ${item.title}`}
            >
              <Text style={styles.deleteText}>×</Text>
            </Pressable>
          </View>
        )}
      />

      {toastMessage ? (
        <View style={styles.toast} pointerEvents="none">
          <Text style={styles.toastText}>{toastMessage}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F5F7FB",
  },
  content: {
    paddingHorizontal: 22,
    paddingTop: 24,
    paddingBottom: 40,
  },
  header: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
  },
  eyebrow: {
    color: "#64748B",
    fontSize: 14,
    textAlign: "right",
    marginBottom: 6,
  },
  heading: {
    color: "#17233B",
    fontSize: 27,
    fontWeight: "800",
    textAlign: "right",
  },
  date: {
    color: "#78849A",
    fontSize: 14,
    textAlign: "right",
    marginTop: 7,
  },
  headerIcon: {
    width: 54,
    height: 54,
    borderRadius: 18,
    backgroundColor: "#E6F4EF",
    alignItems: "center",
    justifyContent: "center",
  },
  headerIconText: {
    color: "#24956F",
    fontSize: 28,
    fontWeight: "700",
  },
  progressCard: {
    backgroundColor: "#253B65",
    borderRadius: 20,
    padding: 19,
    marginBottom: 18,
  },
  progressTextRow: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  progressTitle: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  progressCount: {
    color: "#D5DEEF",
    fontSize: 13,
  },
  progressTrack: {
    height: 7,
    borderRadius: 4,
    backgroundColor: "#50658B",
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 4,
    backgroundColor: "#69D2A8",
  },
  formCard: {
    padding: 18,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    marginBottom: 26,
    shadowColor: "#1F3150",
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  sectionTitle: {
    color: "#17233B",
    fontSize: 17,
    fontWeight: "700",
    textAlign: "right",
  },
  input: {
    height: 50,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E6EAF0",
    backgroundColor: "#FAFBFD",
    color: "#17233B",
    fontSize: 15,
    marginTop: 14,
  },
  timeToggle: {
    flexDirection: "row-reverse",
    alignItems: "center",
    alignSelf: "flex-start",
    marginTop: 16,
    gap: 10,
  },
  timeToggleText: {
    color: "#55637A",
    fontSize: 14,
  },
  switchTrack: {
    width: 38,
    height: 22,
    padding: 3,
    borderRadius: 12,
    backgroundColor: "#D8DEE8",
    justifyContent: "center",
  },
  switchTrackActive: {
    backgroundColor: "#76CBA8",
  },
  switchThumb: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#FFFFFF",
    alignSelf: "flex-start",
  },
  switchThumbActive: {
    alignSelf: "flex-end",
  },
  timeInput: {
    width: 130,
    alignSelf: "flex-end",
    marginTop: 12,
  },
  periodSelector: {
    flexDirection: "row-reverse",
    alignSelf: "flex-end",
    gap: 8,
    marginTop: 8,
  },
  periodButton: {
    minWidth: 42,
    alignItems: "center",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E6EAF0",
    paddingVertical: 7,
  },
  periodButtonActive: {
    borderColor: "#2B9A73",
    backgroundColor: "#E6F4EF",
  },
  periodText: {
    color: "#55637A",
    fontSize: 14,
  },
  periodTextActive: {
    color: "#237A5C",
    fontWeight: "700",
  },
  addButton: {
    height: 50,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 13,
    backgroundColor: "#2B9A73",
    marginTop: 16,
  },
  buttonPressed: {
    opacity: 0.82,
  },
  addButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },
  listHeading: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  taskCount: {
    color: "#7B879A",
    fontSize: 13,
  },
  emptyState: {
    alignItems: "center",
    paddingHorizontal: 26,
    paddingTop: 25,
    paddingBottom: 35,
  },
  emptyIcon: {
    color: "#E9A93B",
    fontSize: 34,
    marginBottom: 12,
  },
  emptyTitle: {
    color: "#263653",
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 8,
  },
  emptyText: {
    color: "#78849A",
    fontSize: 14,
    lineHeight: 22,
    textAlign: "center",
  },
  taskCard: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 15,
    paddingVertical: 19,
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    marginBottom: 10,
  },
  taskMain: {
    flex: 1,
    flexDirection: "row-reverse",
    alignItems: "center",
  },
  checkbox: {
    width: 23,
    height: 23,
    borderWidth: 1.5,
    borderColor: "#CBD3DF",
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 12,
  },
  checkboxCompleted: {
    borderColor: "#2B9A73",
    backgroundColor: "#2B9A73",
  },
  checkmark: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },
  taskInfo: {
    flex: 1,
    alignItems: "flex-end",
  },
  taskTitle: {
    color: "#263653",
    fontSize: 18,
    fontWeight: "600",
    textAlign: "right",
    lineHeight: 25,
  },
  taskTitleCompleted: {
    color: "#9AA4B3",
    textDecorationLine: "line-through",
  },
  taskTime: {
    color: "#8390A3",
    fontSize: 12,
    marginTop: 6,
  },
  deleteButton: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },
  deleteText: {
    color: "#9AA4B3",
    fontSize: 25,
    fontWeight: "300",
  },
  toast: {
    position: "absolute",
    bottom: 82,
    alignSelf: "center",
    backgroundColor: "#1F3150",
    borderRadius: 999,
    paddingHorizontal: 24,
    paddingVertical: 15,
    shadowColor: "#13213F",
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  toastText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
    textAlign: "center",
  },
});
