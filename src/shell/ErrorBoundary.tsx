// Port of web ErrorBoundary: a render error shows what happened and a way back, never a blank screen. `resetKey` (the route) clears it on navigation.
import { Component, type ErrorInfo, type ReactNode } from "react";
import { View } from "react-native";
import * as Updates from "expo-updates";
import { Button, Card, Text } from "@/ui";

type Props = { children: ReactNode; resetKey?: string };
export default class ErrorBoundary extends Component<Props, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error("Page crashed:", error, info.componentStack); }
  componentDidUpdate(prev: Props) { if (this.state.error && prev.resetKey !== this.props.resetKey) this.setState({ error: null }); }
  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <Card style={{ marginVertical: 40, alignItems: "center", paddingVertical: 32, gap: 12 }}>
        <Text weight="medium" align="center">Something went wrong on this page</Text>
        <Text size={14} tone="muted" align="center">{error.message || "Unexpected error"}</Text>
        <View style={{ flexDirection: "row", gap: 8, justifyContent: "center" }}>
          <Button variant="secondary" onPress={() => this.setState({ error: null })}>Try again</Button>
          <Button onPress={() => { Updates.reloadAsync().catch(() => this.setState({ error: null })); }}>Reload</Button>
        </View>
      </Card>
    );
  }
}
