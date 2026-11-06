const API_URL =
import.meta.env.VITE_API_URL || "http://localhost:5000/api";

export interface UserLocation {
latitude: number;
longitude: number;
accuracy?: number;
}

export function getCurrentLocation(): Promise<UserLocation> {
return new Promise((resolve, reject) => {
if (!navigator.geolocation) {
reject(new Error("Geolocation is not supported."));
return;
}

navigator.geolocation.getCurrentPosition(
  (position) => {
    resolve({
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      accuracy: position.coords.accuracy,
    });
  },
  (error) => reject(new Error(error.message)),
  {
    enableHighAccuracy: true,
    timeout: 15000,
    maximumAge: 5000,
  }
);

});
}

export async function updateUserLocation(location: UserLocation) {
const response = await fetch(`${API_URL}/location`, {
method: "POST",
credentials: "include",
headers: {
"Content-Type": "application/json",
},
body: JSON.stringify({
lat: location.latitude,
lng: location.longitude,
accuracy: location.accuracy,
}),
});

const data = await response.json().catch(() => ({}));

if (!response.ok) {
throw new Error(
data?.error?.message ||
data?.message ||
`Location update failed (${response.status})`
);
}

return data;
}

export async function getNearbyUsers() {
const response = await fetch(`${API_URL}/nearby`, {
method: "GET",
credentials: "include",
});

const data = await response.json().catch(() => ({}));

if (!response.ok) {
throw new Error(
data?.error?.message ||
data?.message ||
`Unable to fetch nearby users (${response.status})`
);
}

return data;
}