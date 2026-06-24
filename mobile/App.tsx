import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";

const API_BASE = process.env.EXPO_PUBLIC_API_BASE ?? "http://localhost:8000";

type Task = {
  id: string;
  description: string;
};

type LeaderboardRow = {
  run_id: string;
  env: string;
  agent: string;
  success_rate: number;
  mean_return: number;
};

type RunData = {
  id: string;
  env: string;
  agent: string;
  track: string;
  metrics: { success_rate?: number } | null;
};

/** Coerce an unknown value into a finite number, or null if it isn't one. */
function toFiniteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/** Format a possibly-missing numeric metric, falling back to a dash. */
function formatMetric(value: unknown, digits = 2): string {
  const num = toFiniteNumber(value);
  return num === null ? "—" : num.toFixed(digits);
}

function toStringOr(value: unknown, fallback: string): string {
  return typeof value === "string" && value.length > 0 ? value : fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/** Pull a clean list of tasks out of an arbitrary JSON payload. */
function parseTasks(json: unknown): Task[] {
  if (!isRecord(json) || !Array.isArray(json.tasks)) {
    return [];
  }
  return json.tasks.filter(isRecord).map((raw, index) => ({
    id: toStringOr(raw.id, `task-${index}`),
    description: toStringOr(raw.description, "")
  }));
}

/** Pull a clean list of leaderboard rows out of an arbitrary JSON payload. */
function parseLeaderboard(json: unknown): LeaderboardRow[] {
  if (!Array.isArray(json)) {
    return [];
  }
  return json.filter(isRecord).map((raw, index) => ({
    run_id: toStringOr(raw.run_id, `run-${index}`),
    env: toStringOr(raw.env, "unknown"),
    agent: toStringOr(raw.agent, "unknown"),
    success_rate: toFiniteNumber(raw.success_rate) ?? NaN,
    mean_return: toFiniteNumber(raw.mean_return) ?? NaN
  }));
}

/** Pull a clean run summary out of an arbitrary JSON payload. */
function parseRun(json: unknown): RunData {
  const raw = isRecord(json) ? json : {};
  return {
    id: toStringOr(raw.id, "unknown"),
    env: toStringOr(raw.env, "unknown"),
    agent: toStringOr(raw.agent, "unknown"),
    track: toStringOr(raw.track, "unknown"),
    metrics: isRecord(raw.metrics)
      ? { success_rate: toFiniteNumber(raw.metrics.success_rate) ?? undefined }
      : null
  };
}

/** Fetch JSON with status + network error handling. */
async function fetchJson(path: string): Promise<unknown> {
  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) {
    throw new Error(`Request failed (${res.status})`);
  }
  return res.json();
}

function errorMessage(err: unknown): string {
  if (err instanceof Error && err.message) {
    return err.message;
  }
  return "Could not reach the server. Check your connection and try again.";
}

export default function App() {
  const [tab, setTab] = useState<"tasks" | "leaderboard" | "run">("tasks");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardRow[]>([]);
  const [runId, setRunId] = useState("");
  const [runData, setRunData] = useState<RunData | null>(null);

  useEffect(() => {
    if (tab === "tasks") {
      void loadTasks();
    }
    if (tab === "leaderboard") {
      void loadLeaderboard();
    }
  }, [tab]);

  async function loadTasks() {
    setLoading(true);
    setError(null);
    try {
      const json = await fetchJson("/api/tasks");
      setTasks(parseTasks(json));
    } catch (err) {
      setTasks([]);
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  async function loadLeaderboard() {
    setLoading(true);
    setError(null);
    try {
      const json = await fetchJson("/api/leaderboard?track=test");
      setLeaderboard(parseLeaderboard(json));
    } catch (err) {
      setLeaderboard([]);
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  async function loadRun() {
    const id = runId.trim();
    if (!id) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const json = await fetchJson(`/api/runs/${encodeURIComponent(id)}`);
      setRunData(parseRun(json));
    } catch (err) {
      setRunData(null);
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  function retry() {
    if (tab === "tasks") {
      void loadTasks();
    } else if (tab === "leaderboard") {
      void loadLeaderboard();
    } else {
      void loadRun();
    }
  }

  const header = useMemo(() => {
    if (tab === "tasks") return "Tasks";
    if (tab === "leaderboard") return "Leaderboard";
    return "Run Viewer";
  }, [tab]);

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
      <View style={styles.container}>
        <Text style={styles.title}>WorldModel Gym Mobile</Text>
        <Text style={styles.subtitle}>{header}</Text>

        <View style={styles.tabs}>
          <Tab label="Tasks" selected={tab === "tasks"} onPress={() => setTab("tasks")} />
          <Tab label="Leaderboard" selected={tab === "leaderboard"} onPress={() => setTab("leaderboard")} />
          <Tab label="Run" selected={tab === "run"} onPress={() => setTab("run")} />
        </View>

        {loading ? <ActivityIndicator size="large" color="#ff7a3d" /> : null}

        {error && !loading ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorTitle}>Something went wrong</Text>
            <Text style={styles.errorBody}>{error}</Text>
            <Pressable onPress={retry} style={styles.retryButton}>
              <Text style={styles.buttonText}>Retry</Text>
            </Pressable>
          </View>
        ) : null}

        {tab === "tasks" && !error ? (
          <FlatList
            data={tasks}
            keyExtractor={(item, index) => item.id || `task-${index}`}
            contentContainerStyle={{ gap: 12, paddingBottom: 24 }}
            ListEmptyComponent={
              loading ? null : <Text style={styles.body}>No tasks available.</Text>
            }
            renderItem={({ item }) => (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>{item.id}</Text>
                <Text style={styles.body}>{item.description}</Text>
              </View>
            )}
          />
        ) : null}

        {tab === "leaderboard" && !error ? (
          <FlatList
            data={leaderboard}
            keyExtractor={(item, index) => item.run_id || `run-${index}`}
            contentContainerStyle={{ gap: 12, paddingBottom: 24 }}
            ListEmptyComponent={
              loading ? null : <Text style={styles.body}>No runs uploaded yet.</Text>
            }
            renderItem={({ item }) => (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>{item.run_id}</Text>
                <Text style={styles.body}>
                  {item.env} | {item.agent}
                </Text>
                <Text style={styles.body}>
                  Success {formatMetric(item.success_rate)} | Return {formatMetric(item.mean_return)}
                </Text>
              </View>
            )}
          />
        ) : null}

        {tab === "run" ? (
          <ScrollView contentContainerStyle={{ gap: 10, paddingBottom: 30 }}>
            <TextInput
              value={runId}
              onChangeText={setRunId}
              style={styles.input}
              placeholder="Enter run id"
              autoCapitalize="none"
            />
            <Pressable onPress={loadRun} style={styles.button}>
              <Text style={styles.buttonText}>Load Run</Text>
            </Pressable>
            {runData && !error ? (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>{runData.id}</Text>
                <Text style={styles.body}>Agent: {runData.agent}</Text>
                <Text style={styles.body}>Env: {runData.env}</Text>
                <Text style={styles.body}>Track: {runData.track}</Text>
                <Text style={styles.body}>Success: {formatMetric(runData.metrics?.success_rate)}</Text>
              </View>
            ) : !error ? (
              <Text style={styles.body}>Load a run to see summary metrics.</Text>
            ) : null}
          </ScrollView>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

function Tab({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.tab, selected && styles.tabSelected]}>
      <Text style={[styles.tabText, selected && styles.tabTextSelected]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#e9f0ff" },
  container: { flex: 1, padding: 16, gap: 12 },
  title: { fontSize: 28, fontWeight: "700", color: "#10213a" },
  subtitle: { fontSize: 16, fontWeight: "600", color: "#44506a" },
  tabs: { flexDirection: "row", gap: 8 },
  tab: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#dbe4ff"
  },
  tabSelected: { backgroundColor: "#ff7a3d", borderColor: "#ff7a3d" },
  tabText: { fontWeight: "600", color: "#10213a" },
  tabTextSelected: { color: "#ffffff" },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 14,
    padding: 14,
    gap: 6,
    shadowColor: "#10213a",
    shadowOpacity: 0.12,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 12,
    elevation: 4
  },
  cardTitle: { fontSize: 16, fontWeight: "700", color: "#10213a" },
  body: { color: "#44506a", fontSize: 13 },
  errorCard: {
    backgroundColor: "#fff1ec",
    borderRadius: 14,
    padding: 14,
    gap: 8,
    borderWidth: 1,
    borderColor: "#ffd2c2"
  },
  errorTitle: { fontSize: 15, fontWeight: "700", color: "#b23a17" },
  errorBody: { color: "#8a4a35", fontSize: 13 },
  retryButton: {
    backgroundColor: "#ff7a3d",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    alignItems: "center",
    alignSelf: "flex-start"
  },
  input: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#dbe4ff",
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  button: {
    backgroundColor: "#10213a",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    alignItems: "center"
  },
  buttonText: { color: "#ffffff", fontWeight: "600" }
});
