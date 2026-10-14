
let transport = "";
let bookings = [];
let fareAmount = 0;

// Sample rates only — not official Sri Lankan fares
const fareRates = {
  "Tuk Tuk": { base: 100, perKm: 80 },
  "Car": { base: 250, perKm: 120 },
  "Van": { base: 400, perKm: 160 }
};

// Select transport
function choose(type) {
  transport = type;

  document.getElementById("selected").textContent =
    "Selected: " + type;

  calculateFare();
}

// Calculate distance-based fare
function calculateFare() {
  const pickup =
    document.getElementById("pickup").value.trim();

  const destination =
    document.getElementById("destination").value.trim();

  const distance =
    Number(document.getElementById("distance").value);

  const fareDisplay = document.getElementById("fare");

  if (
    !pickup ||
    !destination ||
    !transport ||
    !Number.isFinite(distance) ||
    distance <= 0
  ) {
    fareAmount = 0;
    fareDisplay.textContent =
      "Enter pickup, destination, transport and distance.";
    return;
  }

  const rate = fareRates[transport];

  fareAmount = Math.round(
    rate.base + distance * rate.perKm
  );

  fareDisplay.textContent =
    "Distance: " + distance + " km | Estimated Fare: LKR " +
    fareAmount.toLocaleString("en-LK");
}

// Book a ride
function bookRide() {
  const pickup =
    document.getElementById("pickup").value.trim();

  const destination =
    document.getElementById("destination").value.trim();

  const distance =
    Number(document.getElementById("distance").value);

  const result = document.getElementById("result");

  if (
    !pickup ||
    !destination ||
    !transport ||
    !Number.isFinite(distance) ||
    distance <= 0
  ) {
    result.textContent =
      "Please enter pickup, destination, transport and valid distance.";
    return;
  }

  calculateFare();

  const booking = {
    id: Date.now(),
    pickup: pickup,
    destination: destination,
    distance: distance,
    transport: transport,
    fare: fareAmount,
    status: "Demo booking"
  };

  bookings.unshift(booking);

  renderHistory();

  result.textContent =
    "Booking saved! Estimated fare: LKR " +
    fareAmount.toLocaleString("en-LK");
}

// Display booking history
function renderHistory() {
  const history = document.getElementById("history");

  if (bookings.length === 0) {
    history.innerHTML = "<p>No bookings yet.</p>";
    return;
  }

  history.innerHTML = "";

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
    distance.textContent =
      "Distance: " + booking.distance + " km";

    const status = document.createElement("p");
    status.textContent = booking.status;

    item.append(title, route, distance, status);
    history.appendChild(item);
  });
}

// Clear booking history
function clearHistory() {
  bookings = [];

  renderHistory();

  document.getElementById("result").textContent =
    "Demo booking history cleared.";

  document.getElementById("fare").textContent =
    "Select transport and enter distance.";
}
