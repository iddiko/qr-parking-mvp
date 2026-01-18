const AllowedRoles = ["MAIN", "SUB", "GUARD", "RESIDENT"] as const;
const AllowedVehicleTypes = ["EV", "ICE"] as const;

export type InviteCsvRow = {
  email: string;
  role: string;
  building_code?: string;
  unit_code?: string;
  has_vehicle?: string;
  plate?: string;
  vehicle_type?: string;
  location_label_default?: string;
  error?: string;
};

function parseCsvLine(line: string) {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === "\"") {
      if (inQuotes && line[i + 1] === "\"") {
        current += "\"";
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

function parseCsv(content: string) {
  const lines = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  if (lines.length === 0) {
    return [];
  }
  const headers = parseCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    const record: Record<string, string> = {};
    headers.forEach((header, index) => {
      record[header] = values[index] ?? "";
    });
    return record as InviteCsvRow;
  });
}

function isValidEmail(value: string) {
  return /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(value);
}

export function parseInviteCsv(content: string) {
  const records = parseCsv(content);

  return records.map((row) => {
    const errors: string[] = [];
    if (!row.email || !isValidEmail(row.email)) {
      errors.push("이메일 형식 오류");
    }
    if (!row.role || !AllowedRoles.includes(row.role as any)) {
      errors.push("역할 값 오류");
    }
    if (row.role === "SUB" && !row.building_code) {
      errors.push("SUB는 building_code 필수");
    }
    if (row.role === "RESIDENT" && (!row.building_code || !row.unit_code)) {
      errors.push("RESIDENT는 building_code와 unit_code 필수");
    }
    if (row.has_vehicle === undefined || row.has_vehicle === "") {
      errors.push("has_vehicle 값 필요");
    }
    const hasVehicle = row.has_vehicle?.toLowerCase() === "true";
    if (hasVehicle && (!row.plate || !row.vehicle_type)) {
      errors.push("has_vehicle=true이면 plate와 vehicle_type 필수");
    }
    if (row.vehicle_type && !AllowedVehicleTypes.includes(row.vehicle_type as any)) {
      errors.push("vehicle_type은 EV 또는 ICE");
    }
    return { ...row, error: errors.join("; ") };
  });
}
