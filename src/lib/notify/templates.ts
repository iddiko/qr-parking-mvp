export function inviteEmailTemplate(link: string) {
  return {
    subject: "You're invited to QR Parking",
    html: `
      <div>
        <p>You have been invited to QR Parking.</p>
        <p><a href="${link}">Complete signup</a></p>
      </div>
    `,
  };
}

export function scanEmailTemplate(payload: {
  timestamp: string;
  location: string;
  result: string;
  vehiclePlate?: string | null;
}) {
  const resultLabel = payload.result === "RESIDENT" ? "입주민 확인" : "단속대상";
  return {
    subject: "QR Scan Alert",
    html: `
      <div>
        <p>Scan time: ${payload.timestamp}</p>
        <p>Location: ${payload.location}</p>
        <p>Result: ${resultLabel}</p>
        <p>Plate: ${payload.vehiclePlate ?? "-"}</p>
      </div>
    `,
  };
}
