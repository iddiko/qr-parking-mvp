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
  locationLat?: number | null;
  locationLng?: number | null;
  result: string;
  vehiclePlate?: string | null;
}) {
  const resultLabel = payload.result === "RESIDENT" ? "Resident" : "Enforcement";
  const hasCoords =
    typeof payload.locationLat === "number" && typeof payload.locationLng === "number";
  const mapLink = hasCoords
    ? `https://www.google.com/maps?q=${payload.locationLat},${payload.locationLng}`
    : null;
  return {
    subject: "QR Scan Alert",
    html: `
      <div>
        <p>Scan time: ${payload.timestamp}</p>
        <p>Location: ${payload.location}</p>
        ${hasCoords ? `<p>Coordinates: ${payload.locationLat}, ${payload.locationLng}</p>` : ""}
        ${mapLink ? `<p>Map: <a href="${mapLink}">${mapLink}</a></p>` : ""}
        <p>Result: ${resultLabel}</p>
        <p>Plate: ${payload.vehiclePlate ?? "-"}</p>
      </div>
    `,
  };
}
