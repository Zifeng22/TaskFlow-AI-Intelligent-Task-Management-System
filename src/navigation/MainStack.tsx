import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import ScanQR from "../screens/MyTaskModule/ScanQR";
import Profile from "../screens/MyTaskModule/Profile";
import TaskDashboard from "../screens/MyTaskModule/TaskDashboard";
import TaskListScreen from "../screens/MyTaskModule/TaskListScreen";
import TaskEditScreen from "../screens/MyTaskModule/TaskEditScreen";
import TaskDetailScreen from "../screens/MyTaskModule/TaskDetailScreen";
import TaskProgressScreen from "../screens/MyTaskModule/TaskProgressScreen";

const MainStack = createNativeStackNavigator();

const Main = () => {
  return (
    <MainStack.Navigator
      initialRouteName="TaskDashboard" // Explicitly sets TaskDashboard as the first screen
      screenOptions={{
        headerShown: false,
      }}
    >
      {/* Placed at the top as the default landing route */}
      <MainStack.Screen name="TaskDashboard" component={TaskDashboard} />
      <MainStack.Screen name="ScanQR" component={ScanQR} />
      <MainStack.Screen name="Profile" component={Profile} />
      <MainStack.Screen name="TaskListScreen" component={TaskListScreen} />
      <MainStack.Screen name="TaskEditScreen" component={TaskEditScreen} />
      <MainStack.Screen name="TaskDetailScreen" component={TaskDetailScreen} />
      <MainStack.Screen
        name="TaskProgressScreen"
        component={TaskProgressScreen}
      />
    </MainStack.Navigator>
  );
};

export default Main;
