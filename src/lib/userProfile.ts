export interface UserProfile {
  fullName: string;
  age: string;
  patientId: string;
  password: string;
}

const USER_PROFILES_STORAGE_KEY = "gentle-dose-user-profiles-v1";
const ACTIVE_PROFILE_STORAGE_KEY = "gentle-dose-active-profile-v1";

const normalizeName = (value: string) => value.trim().toLowerCase();

export const generatePatientId = (name: string) => {
  const seed = name
    .trim()
    .toUpperCase()
    .split("")
    .reduce((total, char, index) => total + char.charCodeAt(0) * (index + 7), 0);

  return `MM-${(seed % 9000 + 1000).toString().padStart(4, "0")}`;
};

export const loadUserProfiles = (): UserProfile[] => {
  if (typeof window === "undefined") return [];

  try {
    const stored = window.localStorage.getItem(USER_PROFILES_STORAGE_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored) as UserProfile[];
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error("Could not load user profiles:", error);
    return [];
  }
};

export const saveUserProfiles = (profiles: UserProfile[]) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(USER_PROFILES_STORAGE_KEY, JSON.stringify(profiles));
};

export const findUserProfile = (fullName: string) =>
  loadUserProfiles().find((profile) => normalizeName(profile.fullName) === normalizeName(fullName));

export const saveUserProfile = (profile: UserProfile) => {
  const profiles = loadUserProfiles();
  const nextProfiles = [
    profile,
    ...profiles.filter(
      (savedProfile) =>
        savedProfile.patientId !== profile.patientId &&
        normalizeName(savedProfile.fullName) !== normalizeName(profile.fullName)
    ),
  ];

  saveUserProfiles(nextProfiles);
  saveActiveUserProfile(profile);
};

export const loadActiveUserProfile = (): UserProfile | null => {
  if (typeof window === "undefined") return null;

  try {
    const stored = window.localStorage.getItem(ACTIVE_PROFILE_STORAGE_KEY);
    if (!stored) return null;
    const parsed = JSON.parse(stored) as UserProfile;
    return parsed?.fullName ? parsed : null;
  } catch (error) {
    console.error("Could not load active user profile:", error);
    return null;
  }
};

export const saveActiveUserProfile = (profile: UserProfile) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(ACTIVE_PROFILE_STORAGE_KEY, JSON.stringify(profile));
};

export const clearActiveUserProfile = () => {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(ACTIVE_PROFILE_STORAGE_KEY);
};
