export type DoseStatus = "taken" | "missed" | "due" | "upcoming";

export interface Dose {
  id: string;
  name: string;
  dosage: string;
  time: string;
  date: string;
  status: DoseStatus;
}

export const nextDose = {
  name: "Metformin",
  dosage: "1 tablet - 500 mg",
  time: "9:30 AM",
  withFood: true,
};

export const history: Dose[] = [
  { id: "1", name: "Atorvastatin", dosage: "10 mg", time: "8:00 AM", date: "Today", status: "taken" },
  { id: "2", name: "Aspirin", dosage: "75 mg", time: "8:00 AM", date: "Today", status: "taken" },
  { id: "3", name: "Metformin", dosage: "500 mg", time: "9:00 PM", date: "Yesterday", status: "missed" },
  { id: "4", name: "Atorvastatin", dosage: "10 mg", time: "8:00 AM", date: "Yesterday", status: "taken" },
  { id: "5", name: "Vitamin D", dosage: "1 capsule", time: "1:00 PM", date: "Yesterday", status: "taken" },
  { id: "6", name: "Metformin", dosage: "500 mg", time: "9:00 AM", date: "Yesterday", status: "taken" },
  { id: "7", name: "Aspirin", dosage: "75 mg", time: "8:00 AM", date: "May 12", status: "taken" },
  { id: "8", name: "Vitamin D", dosage: "1 capsule", time: "1:00 PM", date: "May 12", status: "missed" },
];

export type AlertType = "reminder" | "success" | "missed" | "stock" | "expired";

export interface AlertItem {
  id: string;
  type: AlertType;
  title: string;
  message: string;
  time: string;
}

export const alerts: AlertItem[] = [
  { id: "a0", type: "reminder", title: "Medicine time", message: "Metformin 500 mg is due at 9:30 AM", time: "Just now" },
  { id: "a1", type: "success", title: "Medicine taken successfully", message: "Atorvastatin 10 mg at 8:00 AM", time: "2h ago" },
  { id: "a2", type: "missed", title: "Missed dose detected", message: "Metformin 500 mg was not taken at 9:00 PM", time: "12h ago" },
  { id: "a3", type: "stock", title: "Low medicine stock", message: "Only 5 tablets of Aspirin remaining", time: "1d ago" },
  { id: "a4", type: "expired", title: "Expiry warning", message: "Vitamin D bottle expires in 7 days", time: "3d ago" },
  { id: "a5", type: "success", title: "Medicine taken successfully", message: "Aspirin 75 mg at 8:00 AM", time: "1d ago" },
];

export interface Schedule {
  id: string;
  name: string;
  time: string;
  enabled: boolean;
  stock: number;
  expiresInDays: number;
}

export const initialSchedules: Schedule[] = [
  { id: "s1", name: "Metformin - 500 mg", time: "9:30 AM", enabled: true, stock: 22, expiresInDays: 120 },
  { id: "s2", name: "Atorvastatin - 10 mg", time: "8:00 AM", enabled: true, stock: 14, expiresInDays: 60 },
  { id: "s3", name: "Aspirin - 75 mg", time: "8:00 AM", enabled: true, stock: 5, expiresInDays: 200 },
  { id: "s4", name: "Vitamin D", time: "1:00 PM", enabled: false, stock: 30, expiresInDays: 7 },
];
