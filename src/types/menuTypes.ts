export interface CustomToggleType {
  children: React.ReactNode;
  eventKey: string;
  icon?: React.ReactNode;
  callback?: () => void;
}

export interface MenuItemType {
  id: string;
  /** Ana menünün kalıcı modül kodu (yönetim panelindeki modül açma-kapama). Bkz. src/config/modulKatalogu.ts */
  key?: string;
  title?: string;
  name?: string;
  link?: string;
  icon?: React.ReactNode;
  grouptitle?: boolean;
  badge?: string;
  badgecolor?: string;
  children?: MenuItemType[];
}
