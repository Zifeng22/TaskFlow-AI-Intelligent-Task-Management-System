import React, { useContext } from "react";
import { getApps, initializeApp } from "firebase/app";
import { AuthContext } from "../provider/AuthProvider";

import { NavigationContainer } from "@react-navigation/native";

import Main from "./MainStack";
import Auth from "./AuthStack";
import Loading from "../screens/utils/Loading";

// Better put your these secret keys in .env file
const firebaseConfig = {
  apiKey: "AIzaSyCsdhsbMYO8sMQJrPxfX_OcLFEE7bElwe4",
  authDomain: "taskmanagement-57356.firebaseapp.com",
  projectId: "taskmanagement-57356",
  storageBucket: "taskmanagement-57356.firebasestorage.app",
  messagingSenderId: "305969066742",
  appId: "1:305969066742:web:ff5d0ccc7e55d415d4f2d7",
};
if (getApps().length === 0) {
  initializeApp(firebaseConfig);
}

export default () => {
  const auth = useContext(AuthContext);
  const user = auth.user;
  return (
    <NavigationContainer>
      {user == null && <Loading />}
      {user == false && <Auth />}
      {user == true && <Main />}
    </NavigationContainer>
  );
};
