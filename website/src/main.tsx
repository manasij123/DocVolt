import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import "./styles.css";
import Landing from "./pages/Landing";
import AdminLogin from "./pages/AdminLogin";
import ClientLogin from "./pages/ClientLogin";
import ClientRegister from "./pages/ClientRegister";
import AdminHome from "./pages/AdminHome";
import AdminClientWorkspace from "./pages/AdminClientWorkspace";
import ClientHome from "./pages/ClientHome";
import ClientCategoryView from "./pages/ClientCategoryView";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter basename="/api/web">
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/client/login" element={<ClientLogin />} />
        <Route path="/client/register" element={<ClientRegister />} />
        <Route path="/admin" element={<AdminHome />} />
        <Route path="/admin/c/:clientId" element={<AdminClientWorkspace />} />
        <Route path="/client" element={<ClientHome />} />
        <Route path="/client/a/:adminId" element={<ClientCategoryView />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>,
);
