export type MainStackParamList = {
  ScanQR: undefined;
  Profile: undefined;
  TaskDashboard: undefined;
  TaskListScreen: undefined;
  TaskDetailScreen: undefined;
  TaskEditScreen: undefined;
  TaskProgressScreen: undefined;

  TaskDetail: {
    key: string;
    taskTitle?: string;
    taskDescription?: string;
    startDate?: string;
    endDate?: string;
    priority?: string;
    status?: string;
    updatedDate?: number;
    CreatedUser?: {
      CreatedUserId?: string;
      CreatedUserName?: string;
      CreatedUserPhoto?: string | null;
    };
  };
};

export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
  ForgetPassword: undefined;
};

export type MainTabsParamList = {
  Home: undefined;
  Profile: undefined;
  About: undefined;
  Settings: undefined;
};

export interface UserData {
  userId: string;
  name: string;
  email: string;
  role: string; // e.g., "User", "Team Member", "Project Manager"
  points: number;
}
export interface TaskData {
  taskId: string;
  title: string;
  description: string;
  category: string;
  priority: string; // e.g., "Low", "Medium", "High"
  importance: number; // e.g., 1 to 5
  status: string; // e.g., "Pending", "In Progress", "Completed"
  progress: number; // 0.0 to 100.0
  startDate: string; // Storing as ISO string (YYYY-MM-DD) for easier sorting
  dueDate: string; // Storing as ISO string (YYYY-MM-DD) for easier sorting
  estimatedHours: number;
  assignedTo: string; // userId of the assignee
  dependsOnTaskId: string; // taskId of the dependency
}

export type MainStack = {
  TaskList: undefined;

  TaskDetail: {
    taskId: string;
  };

  TaskEditScreen: {
    taskId?: string;
  };
};
