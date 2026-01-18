"use client";

import { useEffect, useState } from "react";
import { supabaseClient } from "@/lib/supabase/client";
import { MenuGuard } from "@/components/layout/MenuGuard";

type CycleRow = {
  id: string;
  title: string;
  start_date: string | null;
  end_date: string | null;
};

export default function Page() {
  const [cycles, setCycles] = useState<CycleRow[]>([]);
  const [cycleId, setCycleId] = useState("");
  const [reading, setReading] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string>("");
  const [status, setStatus] = useState("");

  useEffect(() => {
    const load = async () => {
      const { data: sessionData } = await supabaseClient.auth.getSession();
      const token = sessionData.session?.access_token ?? "";
      const response = await fetch("/api/meter?type=cycles", {
        headers: { authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        return;
      }
      const data = await response.json();
      setCycles(data.cycles ?? []);
    };
    load();
  }, []);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setStatus("");
    const { data: sessionData } = await supabaseClient.auth.getSession();
    const token = sessionData.session?.access_token ?? "";

    let photoUrl: string | null = null;
    if (photoFile) {
      const formData = new FormData();
      formData.append("file", photoFile);
      const uploadResponse = await fetch("/api/meter/upload", {
        method: "POST",
        headers: { authorization: `Bearer ${token}` },
        body: formData,
      });
      if (!uploadResponse.ok) {
        const data = await uploadResponse.json().catch(() => ({}));
        setStatus(data.error ?? "사진 업로드에 실패했습니다.");
        return;
      }
      const data = await uploadResponse.json();
      photoUrl = data.url ?? null;
    }

    const response = await fetch("/api/meter", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        action: "submit",
        cycle_id: cycleId,
        reading_value: Number(reading),
        photo_url: photoUrl,
      }),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setStatus(data.error ?? "검침 제출에 실패했습니다.");
      return;
    }
    setStatus("검침 제출이 완료되었습니다.");
    setReading("");
    setPhotoFile(null);
    if (photoPreview) {
      URL.revokeObjectURL(photoPreview);
      setPhotoPreview("");
    }
  };

  const onPhotoChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    setPhotoFile(file);
    if (photoPreview) {
      URL.revokeObjectURL(photoPreview);
    }
    if (file) {
      setPhotoPreview(URL.createObjectURL(file));
    } else {
      setPhotoPreview("");
    }
  };

  const resetPhoto = () => {
    setPhotoFile(null);
    if (photoPreview) {
      URL.revokeObjectURL(photoPreview);
    }
    setPhotoPreview("");
  };

  return (
    <MenuGuard roleGroup="resident" toggleKey="meter">
      <div>
        <h1 className="page-title">입주민 검침</h1>
        <form onSubmit={submit} style={{ display: "grid", gap: "8px", maxWidth: "360px" }}>
          <label>
            검침 주기
            <select value={cycleId} onChange={(e) => setCycleId(e.target.value)}>
              <option value="">선택</option>
              {cycles.map((cycle) => (
                <option key={cycle.id} value={cycle.id}>
                  {cycle.title}
                </option>
              ))}
            </select>
          </label>
          <label>
            검침값
            <input value={reading} onChange={(e) => setReading(e.target.value)} />
          </label>
          <label>
            검침 사진
            <input type="file" accept="image/*" capture="environment" onChange={onPhotoChange} />
          </label>
          {photoPreview ? (
            <div style={{ display: "grid", gap: "8px" }}>
              <img src={photoPreview} alt="검침 사진 미리보기" style={{ width: "100%", borderRadius: "12px" }} />
              <button type="button" onClick={resetPhoto}>
                다시 찍기
              </button>
            </div>
          ) : null}
          <button type="submit">제출</button>
          {status ? <div className="muted">{status}</div> : null}
        </form>
      </div>
    </MenuGuard>
  );
}
