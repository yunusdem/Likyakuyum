import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { Provider } from "react-redux";
import store from "store/store";
import App from "./App";
import GlobalCalculator from "./components/common/GlobalCalculator";

// Import Swiper styles
import "swiper/css";
import "swiper/css/navigation";
import "swiper/css/pagination";
import "swiper/css/scrollbar";

// Import main theme scss
import "styles/theme.scss";
import { initGlobalNumericInputInterceptor } from "./utils/numericInput";
import { initGlobalSelectSpaceInterceptor } from "./utils/selectSpaceInterceptor";

initGlobalNumericInputInterceptor();
initGlobalSelectSpaceInterceptor();

// Masaüstü uygulaması (tarayıcıdan "uygulama olarak yükle") kök adresle açılırsa tanıtım sayfası yerine giriş ekranı gelsin.
// Manifest'teki start_url yeni kurulumları zaten /login'e açar; bu satır manifest'ten önce kurulmuş uygulamalar içindir.
// Oturum açıksa giriş ekranı kendisi ana ekrana geçer.
const uygulamaPenceresi =
  ["standalone", "window-controls-overlay", "minimal-ui"].some(
    (m) => window.matchMedia?.(`(display-mode: ${m})`).matches
  ) || (navigator as Navigator & { standalone?: boolean }).standalone === true;
if (uygulamaPenceresi && window.location.pathname === "/") {
  window.history.replaceState(null, "", "/login" + window.location.search + window.location.hash);
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <Provider store={store}>
    <BrowserRouter>
      <App />
      <GlobalCalculator />
    </BrowserRouter>
  </Provider>
);
