
let transport = "";
let bookings = [];
let fareAmount = 0;

// Sample rates only — not official Sri Lankan fares
const fareRates = {
  "Tuk Tuk": { base: 100, perKm: 80 },
  "Car": { base: 250, perKm: 120 },
  "Van": { base: 400, perKm: 160 }
};

let routeDistance = null;

// Get elements safely
function getValue(id) {
  const element = document.getElementById(id);
  return element ? element.value.trim() : "";
}

function setText(id, message) {
  const element = document.getElementById(id);
  if (element) element.textContent = message;
}

// Choose transport
function choose(type) {
  transport = type;
  setText("selected", "Selected: " + type);
  calculateFare();
}

// Find location coordinates using OpenStreetMap Nominatim
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
      '". Try adding the town or district name.'
    );
  }

  return {
    lat: Number(data[0].lat),
    lon: Number(data[0].lon),
    name: data[0].display_name
  };
}

// Calculate road distance using OSRM
async function calculateRouteDistance() {
  const pickup = getValue("pickup");
  const destination = getValue("destination");
  const button = document.getElementById("distance-button");

  if (!pickup || !destination) {
    setText("route-status", "Enter both pickup and destination.");
    return;
  }

  if (pickup.toLowerCase() === destination.toLowerCase()) {
    setText("route-status", "Pickup and destination must be different.");
    return;
  }

  routeDistance = null;
  const distanceInput = document.getElementById("distance");

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
      end.lon + "," + end.lat +
      "?overview=false";

    const response = await fetch(routeUrl);

    if (!response.ok) {
      throw new Error("Route service is temporarily unavailable.");
    }

    const data = await response.json();

    if (data.code !== "Ok" || !data.routes || !data.routes.length) {
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
      error.message || "Could not calculate distance. Please try again."
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

  fareAmount = Math.round(rate.base + distance * rate.perKm);

  setText(
    "fare",
    "Distance: " + distance +
    " km | Estimated Fare: LKR " +
    fareAmount.toLocaleString("en-LK")
  );
}

// Book a demo ride
function bookRide() {
  const pickup = getValue("pickup");
  const destination = getValue("destination");
  const distance = Number(getValue("distance"));
  const result = document.getElementById("result");

  if (
    !pickup ||
    !destination ||
    !transport ||
    !Number.isFinite(distance) ||
    distance <= 0 ||
    routeDistance === null ||
    Math.abs(distance - routeDistance) > 0.01
  ) {
    if (result) {
      result.textContent =
        "Enter both locations, calculate road distance and choose transport.";
    }
    return;
  }

  calculateFare();

  if (fareAmount <= 0) {
    if (result) result.textContent = "Please calculate the fare first.";
    return;
  }

  const booking = {
    id: Date.now(),
    pickup: pickup,
    destination: destination,
    distance: distance,
    transport: transport,
    fare: fareAmount,
    status: "Demo booking — not a real reservation"
  };

  bookings.unshift(booking);
  renderHistory();

  if (result) {
    result.textContent =
      "Demo booking saved! Estimated fare: LKR " +
      fareAmount.toLocaleString("en-LK");
  }
}

// Display demo booking history
function renderHistory() {
  const history = document.getElementById("history");
  if (!history) return;

  history.replaceChildren();

  if (bookings.length === 0) {
    const message = document.createElement("p");
    message.textContent = "No bookings yet.";
    history.appendChild(message);
    return;
  }

  bookings.forEach(function(booking) {
    const item = document.createElement("div");
    item.className = "booking-item";

    const title = document.createElement("strong");
    title.textContent =
      booking.transport + " — LKR " +
      booking.fare.toLocaleString("en-LK");

    const route = document.createElement("p");
    route.textContent =
      booking.pickup + " → " + booking.destination;

    const distance = document.createElement("p");
    distance.textContent = "Distance: " + booking.distance + " km";

    const status = document.createElement("p");
    status.textContent = booking.status;

    item.append(title, route, distance, status);
    history.appendChild(item);
  });
}

// Clear demo booking history
function clearHistory() {
  bookings = [];
  renderHistory();

  setText("result", "Demo booking history cleared.");
}

// Keep fare estimate updated when locations change
["pickup", "destination"].forEach(function(id) {
  const input = document.getElementById(id);

  if (input) {
    input.addEventListener("input", function() {
      routeDistance = null;

      const distanceInput = document.getElementById("distance");
      if (distanceInput) distanceInput.value = "";

      setText("route-status", "Calculate distance again after changing locations.");
      calculateFare();
    });
  }
});
