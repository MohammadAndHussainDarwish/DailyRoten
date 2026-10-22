import { Tabs } from "expo-router";

export default function RootLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarPosition: "top",
        tabBarShowLabel: true,
        tabBarActiveTintColor: "#2B9A73",
        tabBarInactiveTintColor: "#2B9A73",
        tabBarStyle: {
          height: 48,
          elevation: 0,
          shadowOpacity: 0,
        },
        tabBarLabelStyle: {
          fontSize: 14,
          fontWeight: "700",
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "To do list",
          tabBarLabel: "To do list",
        }}
      />
    </Tabs>
  );
}
