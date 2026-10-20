
let transport = "";
let bookings = [];
let fareAmount = 0;
let routeDistance = null;

// Supabase Edge Function
const SUPABASE_FUNCTION_URL =
  "https://vcndnnjrftexsgrrezxi.supabase.co/functions/v1/lankago-booking";

// Add your Supabase PUBLISHABLE key below.
// Never put a service_role or secret key in website code.
const SUPABASE_PUBLISHABLE_KEY =
  sb_publishable_B3g1DSpHOQ4nZHFdmsQO_Q_BqAFHYKi";
// Sample rates only — not official Sri Lankan fares
const fareRates = {
  "Tuk Tuk": { base: 100, perKm: 80 },
  "Car": { base: 250, perKm: 120 },
  "Van": { base: 400, perKm: 160 }
};

function getValue(id) {
  const element = document.getElementById(id);
  return element ? element.value.trim() : "";
}

function setText(id, message) {
  const element = document.getElementById(id);
  if (element) element.textContent = message;
}

// Select transport — supports the current HTML button names
function selectTransport(type) {
  transport = type;
  setText("selected-transport", "Selected: " + type);
  setText("selected", "Selected: " + type);
  calculateFare();
}

// Keep compatibility with older buttons
function choose(type) {
  selectTransport(type);
}

// Find a location in Sri Lanka
async function findLocation(place) {
  const url =
    "https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=lk&q=" +
    encodeURIComponent(place);

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error("Location search is temporarily unavailable.");
  }

  const data = await response.json();

  if (!data.length) {
    throw new Error(
      'Location not found: "' + place +
      '". Try adding the town or district.'
    );
  }

  return {
    lat: Number(data[0].lat),
    lon: Number(data[0].lon)
  };
}

// Calculate road distance using OSRM
async function calculateRouteDistance() {
  const pickup = getValue("pickup");
  const destination = getValue("destination");
  const button = document.getElementById("distance-button");
  const distanceInput = document.getElementById("distance");

  if (!pickup || !destination) {
    setText("route-status", "Enter both pickup and destination.");
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
  if (distanceInput) distanceInput.value = "";

  calculateFare();
  setText("route-status", "Finding locations and road distance...");

  if (button) button.disabled = true;

  try {
    const start = await findLocation(pickup);
    const end = await findLocation(destination);

    const routeUrl =
      "https://router.project-osrm.org/route/v1/driving/" +
      start.lon + "," + start.lat + ";" +
      end.lon + "," + end.lat + "?overview=false";

    const response = await fetch(routeUrl);

    if (!response.ok) {
      throw new Error("Route service is temporarily unavailable.");
    }

    const data = await response.json();

    if (data.code !== "Ok" || !data.routes?.length) {
      throw new Error("No road route found for these locations.");
    }

    const km = Math.round(data.routes[0].distance / 100) / 10;

    routeDistance = km;
    if (distanceInput) distanceInput.value = km;

    setText(
      "route-status",
      "Road distance: " + km + " km. Please check the locations."
    );

    calculateFare();
  } catch (error) {
    routeDistance = null;
    if (distanceInput) distanceInput.value = "";

    setText(
      "route-status",
      error.message || "Could not calculate distance. Try again."
    );

    calculateFare();
  } finally {
    if (button) button.disabled = false;
  }
}

// Calculate estimated fare
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

  fareAmount = Math.round(rate.base + distance * rate.perKm);

  setText(
    "fare",
    "Distance: " + distance +
    " km | Estimated Fare: LKR " +
    fareAmount.toLocaleString("en-LK")
  );
}

// Create a real booking using the Supabase Edge Function
async function bookRide() {
  const result = document.getElementById("result");

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
      "PASTE_YOUR_SUPABASE_PUBLISHABLE_KEY_HERE"
  ) {
    setText(
      "result",
      "Setup needed: add your Supabase Publishable key in script.js."
    );
    return;
  }

  const button = document.querySelector(".book-button");
  if (button) button.disabled = true;

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

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data.error || "Booking failed. Please try again."
      );
    }

    const booking = {
      booking_code: data.booking_code,
      pickup: pickup,
      destination: destination,
      distance: distance,
      transport: transport,
      fare: data.estimated_fare,
      status: data.booking_status
    };

    bookings.unshift(booking);
    renderHistory();

    setText(
      "result",
      "Booking saved! Code: " + data.booking_code +
      ". Status: " + data.booking_status +
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
    if (button) button.disabled = false;
  }
}

// Display bookings created during this page session
function renderHistory() {
  const history = document.getElementById("history");
  if (!history) return;

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
    code.textContent = "Booking code: " + booking.booking_code;

    const route = document.createElement("p");
    route.textContent =
      booking.pickup + " → " + booking.destination;

    const distance = document.createElement("p");
    distance.textContent = "Distance: " + booking.distance + " km";

    const status = document.createElement("p");
    status.textContent = "Status: " + booking.status;

    item.append(title, code, route, distance, status);
    history.appendChild(item);
  });
}

// Clear only the displayed session history.
// This does NOT delete bookings from the database.
function clearHistory() {
  bookings = [];
  renderHistory();
  setText(
    "result",
    "Displayed history cleared. Saved database bookings are unchanged."
  );
}

// Changing locations means distance must be recalculated
["pickup", "destination"].forEach(function(id) {
  const input = document.getElementById(id);

  if (input) {
    input.addEventListener("input", function() {
      routeDistance = null;

      const distanceInput = document.getElementById("distance");
      if (distanceInput) distanceInput.value = "";

      setText(
        "route-status",
        "Calculate distance again after changing locations."
      );

      calculateFare();
    });
  }
});
