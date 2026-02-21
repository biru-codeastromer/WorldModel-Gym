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

type LeaderboardRow = {
  run_id: string;
  env: string;
  agent: string;
  success_rate: number;
  mean_return: number;
};

export default function App() {
  const [tab, setTab] = useState<"tasks" | "leaderboard" | "run">("tasks");
  const [loading, setLoading] = useState(false);
  const [tasks, setTasks] = useState<any[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardRow[]>([]);
  const [runId, setRunId] = useState("");
  const [runData, setRunData] = useState<any | null>(null);

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
    try {
      const res = await fetch(`${API_BASE}/api/tasks`);
      const json = await res.json();
      setTasks(json.tasks ?? []);
    } finally {
      setLoading(false);
    }
  }

  async function loadLeaderboard() {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/leaderboard?track=test`);
      const json = (await res.json()) as LeaderboardRow[];
      setLeaderboard(json);
    } finally {
      setLoading(false);
    }
  }

  async function loadRun() {
    if (!runId.trim()) {
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/runs/${runId.trim()}`);
      const json = await res.json();
      setRunData(json);
    } finally {
      setLoading(false);
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

        {tab === "tasks" ? (
          <FlatList
            data={tasks}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ gap: 12, paddingBottom: 24 }}
            renderItem={({ item }) => (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>{item.id}</Text>
                <Text style={styles.body}>{item.description}</Text>
              </View>
            )}
          />
        ) : null}

        {tab === "leaderboard" ? (
          <FlatList
            data={leaderboard}
            keyExtractor={(item) => item.run_id}
            contentContainerStyle={{ gap: 12, paddingBottom: 24 }}
            ListEmptyComponent={<Text style={styles.body}>No runs uploaded yet.</Text>}
            renderItem={({ item }) => (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>{item.run_id}</Text>
                <Text style={styles.body}>{item.env} | {item.agent}</Text>
                <Text style={styles.body}>Success {item.success_rate.toFixed(2)} | Return {item.mean_return.toFixed(2)}</Text>
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
            {runData ? (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>{runData.id}</Text>
                <Text style={styles.body}>Agent: {runData.agent}</Text>
                <Text style={styles.body}>Env: {runData.env}</Text>
                <Text style={styles.body}>Track: {runData.track}</Text>
                <Text style={styles.body}>Success: {(runData.metrics?.success_rate ?? 0).toFixed(2)}</Text>
              </View>
            ) : (
              <Text style={styles.body}>Load a run to see summary metrics.</Text>
            )}
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
