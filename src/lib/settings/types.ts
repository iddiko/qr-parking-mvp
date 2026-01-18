export type MenuToggleGroup = Record<string, boolean>;

export type MenuToggles = {
  main: MenuToggleGroup;
  guard: MenuToggleGroup;
  resident: MenuToggleGroup;
  sub: MenuToggleGroup;
};

export type SettingsRecord = {
  complex_id: string;
  menu_toggles: MenuToggles;
};
