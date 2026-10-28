import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import PanelApp from "./PanelApp";
import { PanelAuthProvider } from "./context/PanelAuthContext";

import "styles/theme.scss";
import "../admin/admin.scss";
import "./destekPanel.scss";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <PanelAuthProvider>
        <PanelApp />
      </PanelAuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
