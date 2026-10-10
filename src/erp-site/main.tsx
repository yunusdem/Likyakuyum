import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import ErpApp from "./ErpApp";

// Bootstrap / tema yüklenmez: site kendi hafif stilini kullanır (docs/LIKYAERP_TANITIM_SITESI.md)
import "./erp.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <ErpApp />
    </BrowserRouter>
  </React.StrictMode>
);
