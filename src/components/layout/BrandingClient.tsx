"use client";

import { useEffect } from "react";

const updateFavicon = (url: string) => {
  const head = document.head;
  let icon = head.querySelector("link[rel~='icon']") as HTMLLinkElement | null;
  if (!icon) {
    icon = document.createElement("link");
    icon.rel = "icon";
    head.appendChild(icon);
  }
  icon.href = url;
};

export function BrandingClient() {
  useEffect(() => {
    const load = async () => {
      const response = await fetch("/api/branding");
      if (!response.ok) {
        return;
      }
      const data = await response.json();
      if (data?.logo_url) {
        updateFavicon(data.logo_url);
      }
    };
    load();
  }, []);

  return null;
}
