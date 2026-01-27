export type MenuToggleGroup = Record<string, boolean>;

export type MenuToggles = {
  main: MenuToggleGroup;
  guard: MenuToggleGroup;
  resident: MenuToggleGroup;
  sub: MenuToggleGroup;
};

export type MenuOrder = {
  super: string[];
  main: string[];
  guard: string[];
  resident: string[];
  sub: string[];
};

export type MenuLabels = {
  super: Record<string, string>;
  main: Record<string, string>;
  guard: Record<string, string>;
  resident: Record<string, string>;
  sub: Record<string, string>;
};

export type SettingsRecord = {
  complex_id: string;
  menu_toggles: MenuToggles;
  menu_order?: MenuOrder;
  menu_labels?: MenuLabels;
};
