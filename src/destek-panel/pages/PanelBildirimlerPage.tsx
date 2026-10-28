import React from "react";
import BildirimlerPage from "../../admin/pages/BildirimlerPage";
import { panelBildirimApi } from "../services/panelApi";

/** Destek paneli > Bildirimler (D11): admin panelindeki ekranın aynısı, destek paneli uçlarıyla. */
const PanelBildirimlerPage: React.FC = () => <BildirimlerPage api={panelBildirimApi} destekYolu="/" />;

export default PanelBildirimlerPage;
