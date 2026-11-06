import React from "react";
import ReactDOM from "react-dom/client";
import MobilApp from "./MobilApp";

import "styles/theme.scss";
import "./mobil.scss";

// Mobil cari sitesi girişi (mobil.likyaerp.com; docs/MOBIL_CARI_YOL_HARITASI.md)
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <MobilApp />
  </React.StrictMode>
);
