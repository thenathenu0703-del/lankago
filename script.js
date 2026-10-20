
let transport = "";
let bookings = [];
let fareAmount = 0;
let routeDistance = null;

// Supabase Edge Function
const SUPABASE_FUNCTION_URL =
  "https://vcndnnjrftexsgrrezxi.supabase.co/functions/v1/lankago-booking";

// உங்கள் தற்போதைய Supabase Publishable Key-ஐ இங்கே இடவும்.
// service_role / secret key-ஐ இங்கே பயன்படுத்த வேண்டாம்.
const SUPABASE_PUBLISHABLE_KEY =
  "sb_publishable_B3g1DSpHOQ4nZHFdmsQO_Q_BqAFHYKi";

// Sample rates only — not official Sri Lankan fares
const fareRates = {
  "Tuk Tuk": { base: 100, perKm: 80 },
  "Car": { base: 250, perKm: 120 },
  "Van": { base: 400, perKm: 160 }
};

// Map variables
let lankagoMap = null;
let pickupMarker = null;
let destinationMarker = null;
let routeLine = null;

// Basic helpers
function getValue(id) {
  const element = document.getElementById(id);
  return element ? element.value.trim() : "";
}

function setText(id, message) {
  const element = document.getElementById(id);
  if (element) element.textContent = message;
}

// ------------------------------
// MAP
// ------------------------------

function initializeLankaGoMap() {
  const mapElement = document.getElementById("map");

  if (!mapElement || typeof L === "undefined") {
    return;
  }

  if (lankagoMap) {
    lankagoMap.invalidateSize();
    return;
  }

  lankagoMap = L.map("map").setView([7.8731, 80.7718], 7);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "&copy; OpenStreetMap contributors",
    maxZoom: 19
  }).addTo(lankagoMap);
}

function updateLankaGoMap(start, end, coordinates) {
  initializeLankaGoMap();

  if (!lankagoMap || typeof L === "undefined") {
    setText(
      "route-status",
      "Distance calculated, but the map could not load. Check your internet connection."
    );
    return;
  }

  if (pickupMarker) {
    lankagoMap.removeLayer(pickupMarker);
  }

  if (destinationMarker) {
    lankagoMap.removeLayer(destinationMarker);
  }

  if (routeLine) {
    lankagoMap.removeLayer(routeLine);
  }

  pickupMarker = L.marker([start.lat, start.lon])
    .addTo(lankagoMap)
    .bindPopup("Pickup: " + getValue("pickup"));

  destinationMarker = L.marker([end.lat, end.lon])
    .addTo(lankagoMap)
    .bindPopup("Destination: " + getValue("destination"));

  // OSRM coordinates are [longitude, latitude].
  // Leaflet needs [latitude, longitude].
  const roadCoordinates = coordinates.map(function(point) {
    return [point[1], point[0]];
  });

  routeLine = L.polyline(roadCoordinates, {
    color: "#087f5b",
    weight: 5
  }).addTo(lankagoMap);

  lankagoMap.fitBounds(routeLine.getBounds(), {
    padding: [25, 25]
  });

  setTimeout(function() {
    if (lankagoMap) lankagoMap.invalidateSize();
  }, 200);
}

// ------------------------------
// TRANSPORT SELECTION
// ------------------------------

function selectTransport(type) {
  transport = type;

  setText("selected-transport", "Selected: " + type);
  setText("selected", "Selected: " + type);

  calculateFare();
}

// Compatibility with older buttons
function choose(type) {
  selectTransport(type);
}

// ------------------------------
// FIND LOCATION IN SRI LANKA
// ------------------------------

async function findLocation(place) {
  const url =
    "https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=lk&q=" +
    encodeURIComponent(place);

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(
      "Location search is temporarily unavailable. Please try again."
    );
  }

  const data = await response.json();

  if (!data.length) {
    throw new Error(
      'Location not found: "' +
      place +
      '". Try adding the town or district.'
    );
  }

  return {
    lat: Number(data[0].lat),
    lon: Number(data[0].lon)
  };
}

// ------------------------------
// CALCULATE ROAD DISTANCE
// ------------------------------

async function calculateRouteDistance() {
  const pickup = getValue("pickup");
  const destination = getValue("destination");
  const button = document.getElementById("distance-button");
  const distanceInput = document.getElementById("distance");

  if (!pickup || !destination) {
    setText(
      "route-status",
      "Enter both pickup and destination."
    );
    return;
  }

  if (pickup.toLowerCase() === destination.toLowerCase()) {
    setText(
      "route-status",
      "Pickup and destination must be different."
    );
    return;
  }

  routeDistance = null;

  if (distanceInput) {
    distanceInput.value = "";
  }

  calculateFare();
  setText(
    "route-status",
    "Finding locations and road distance..."
  );

  if (button) {
    button.disabled = true;
  }

  try {
    const start = await findLocation(pickup);
    const end = await findLocation(destination);

    // Request the actual road route geometry from OSRM
    const routeUrl =
      "https://router.project-osrm.org/route/v1/driving/" +
      start.lon + "," + start.lat + ";" +
      end.lon + "," + end.lat +
      "?overview=full&geometries=geojson";

    const response = await fetch(routeUrl);

    if (!response.ok) {
      throw new Error(
        "Route service is temporarily unavailable. Please try again."
      );
    }

    const data = await response.json();

    if (data.code !== "Ok" || !data.routes?.length) {
      throw new Error(
        "No road route found. Please check the locations."
      );
    }

    const route = data.routes[0];
    const km = Math.round(route.distance / 100) / 10;

    if (
      !Number.isFinite(km) ||
      km <= 0 ||
      !route.geometry?.coordinates?.length
    ) {
      throw new Error(
        "Could not get a valid road route for these locations."
      );
    }

    routeDistance = km;

    if (distanceInput) {
      distanceInput.value = km;
    }

    updateLankaGoMap(
      start,
      end,
      route.geometry.coordinates
    );

    setText(
      "route-status",
      "Road distance: " + km +
      " km. Please check the route on the map."
    );

    calculateFare();

  } catch (error) {
    routeDistance = null;

    if (distanceInput) {
      distanceInput.value = "";
    }

    setText(
      "route-status",
      error.message ||
      "Could not calculate distance. Please try again."
    );

    calculateFare();

  } finally {
    if (button) {
      button.disabled = false;
    }
  }
}

// ------------------------------
// CALCULATE ESTIMATED FARE
// ------------------------------

function calculateFare() {
  const pickup = getValue("pickup");
  const destination = getValue("destination");
  const distance = Number(getValue("distance"));

  if (
    !pickup ||
    !destination ||
    !transport ||
    !Number.isFinite(distance) ||
    distance <= 0 ||
    routeDistance === null ||
    Math.abs(distance - routeDistance) > 0.01
  ) {
    fareAmount = 0;

    setText(
      "fare",
      "Enter both locations, calculate road distance and choose transport."
    );

    return;
  }

  const rate = fareRates[transport];

  if (!rate) {
    fareAmount = 0;
    setText("fare", "Please select a valid transport.");
    return;
  }

  fareAmount = Math.round(
    rate.base + distance * rate.perKm
  );

  setText(
    "fare",
    "Distance: " + distance +
    " km | Estimated Fare: LKR " +
    fareAmount.toLocaleString("en-LK")
  );
}

// ------------------------------
// CREATE BOOKING IN SUPABASE
// ------------------------------

async function bookRide() {
  const customerName = getValue("customer_name");
  const customerPhone = getValue("customer_phone");
  const pickup = getValue("pickup");
  const destination = getValue("destination");
  const distance = Number(getValue("distance"));

  if (
    !customerName ||
    !customerPhone ||
    !pickup ||
    !destination
  ) {
    setText(
      "result",
      "Please enter your name, phone number, pickup and destination."
    );
    return;
  }

  if (
    !transport ||
    !Number.isFinite(distance) ||
    distance <= 0 ||
    routeDistance === null ||
    Math.abs(distance - routeDistance) > 0.01
  ) {
    setText(
      "result",
      "Calculate the road distance and choose transport first."
    );
    return;
  }

  calculateFare();

  if (fareAmount <= 0) {
    setText("result", "Please calculate the fare first.");
    return;
  }

  if (
    !SUPABASE_PUBLISHABLE_KEY ||
    SUPABASE_PUBLISHABLE_KEY ===
      "YOUR_SUPABASE_PUBLISHABLE_KEY_HERE"
  ) {
    setText(
      "result",
      "Setup needed: add your Supabase Publishable key in script.js."
    );
    return;
  }

  const button = document.querySelector(".book-button");

  if (button) {
    button.disabled = true;
  }

  setText("result", "Sending booking securely...");

  try {
    const response = await fetch(SUPABASE_FUNCTION_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": SUPABASE_PUBLISHABLE_KEY,
        "Authorization": "Bearer " + SUPABASE_PUBLISHABLE_KEY
      },
      body: JSON.stringify({
        action: "create",
        customer_name: customerName,
        customer_phone: customerPhone,
        pickup_location: pickup,
        destination: destination,
        transport_type: transport,
        distance_km: distance,
        estimated_fare: fareAmount
      })
    });

    let data;

    try {
      data = await response.json();
    } catch {
      throw new Error(
        "The booking service returned an unexpected response."
      );
    }

    if (!response.ok) {
      throw new Error(
        data.error || "Booking failed. Please try again."
      );
    }

    if (!data.booking_code) {
      throw new Error(
        "The service did not return a booking code. Please check your bookings before retrying."
      );
    }

    const booking = {
      booking_code: data.booking_code,
      pickup: pickup,
      destination: destination,
      distance: distance,
      transport: transport,
      fare: data.estimated_fare ?? fareAmount,
      status: data.booking_status || "pending"
    };

    bookings.unshift(booking);
    renderHistory();

    setText(
      "result",
      "Booking saved! Code: " + data.booking_code +
      ". Status: " + booking.status +
      ". Keep your booking code safe."
    );

  } catch (error) {
    console.error("LankaGo booking error:", error);

    setText(
      "result",
      error.message ||
      "Could not contact the booking service. Please try again."
    );

  } finally {
    if (button) {
      button.disabled = false;
    }
  }
}

// ------------------------------
// DISPLAY SESSION BOOKING HISTORY
// ------------------------------

function renderHistory() {
  const history = document.getElementById("history");

  if (!history) {
    return;
  }

  history.replaceChildren();

  if (bookings.length === 0) {
    const message = document.createElement("p");

    message.textContent =
      "Bookings made in this session will appear here.";

    history.appendChild(message);
    return;
  }

  bookings.forEach(function(booking) {
    const item = document.createElement("div");
    item.className = "booking-item";

    const title = document.createElement("strong");

    title.textContent =
      booking.transport + " — LKR " +
      Number(booking.fare).toLocaleString("en-LK");

    const code = document.createElement("p");
    code.textContent =
      "Booking code: " + booking.booking_code;

    const route = document.createElement("p");
    route.textContent =
      booking.pickup + " → " + booking.destination;

    const distance = document.createElement("p");
    distance.textContent =
      "Distance: " + booking.distance + " km";

    const status = document.createElement("p");
    status.textContent =
      "Status: " + booking.status;

    item.append(
      title,
      code,
      route,
      distance,
      status
    );

    history.appendChild(item);
  });
}

// Clear only the displayed session history.
// Database bookings are NOT deleted.
function clearHistory() {
  bookings = [];
  renderHistory();

  setText(
    "result",
    "Displayed history cleared. Saved database bookings are unchanged."
  );
}

// ------------------------------
// RESET DISTANCE WHEN LOCATIONS CHANGE
// ------------------------------

["pickup", "destination"].forEach(function(id) {
  const input = document.getElementById(id);

  if (input) {
    input.addEventListener("input", function() {
      routeDistance = null;

      const distanceInput =
        document.getElementById("distance");

      if (distanceInput) {
        distanceInput.value = "";
      }

      setText(
        "route-status",
        "Calculate distance again after changing locations."
      );

      calculateFare();
    });
  }
});

// ------------------------------
// START MAP WHEN PAGE LOADS
// ------------------------------

window.addEventListener("load", function() {
  initializeLankaGoMap();
  renderHistory();
});
