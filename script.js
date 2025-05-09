// Initialize the map
const map = L.map('map').setView([12.690758005394018, 108.06132029871573], 13);

// Add OpenStreetMap tiles
//L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
//  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
//}).addTo(map);

// And add these lines after map initialization:
createSearchControl();
createBasemapControl();



// Define Enfarm Office location
const enfarmOfficeLocation = {
    lat: 12.690758005394018,
    lng: 108.06132029871573,
    name: "enfarm Store/Office Dak Lak"
};

// Initialize variables
let markers = [];
let routingControl = null;
let destinationCount = 0;
const maxDestinations = 8; // Changed from 5 to 8
const colors = ['#3498db', '#e74c3c', '#2ecc71', '#f39c12', '#9b59b6', '#1abc9c', '#e67e22', '#34495e']; // Added 3 more colors
let showDirectionArrows = true;

// DOM elements
const destinationsContainer = document.getElementById('destinations-container');
const addDestinationBtn = document.getElementById('add-destination');
const calculateRouteBtn = document.getElementById('calculate-route');
const clearAllBtn = document.getElementById('clear-all');
const loadingIndicator = document.getElementById('loading');
const errorMessage = document.getElementById('error-message');
const resultsSection = document.getElementById('results');
const destinationsList = document.getElementById('destinations-list');
const totalDistanceEl = document.getElementById('total-distance');
const showDirectionArrowsCheckbox = document.getElementById('show-direction-arrows');

// Add event listeners
addDestinationBtn.addEventListener('click', function () {
    addDestinationField(); // Call without coordinates to add an empty field
});
calculateRouteBtn.addEventListener('click', calculateRoute);
clearAllBtn.addEventListener('click', clearAll);

// Enable click-to-add-destination functionality
map.on('click', onMapClick);

// Function to get the display label for a destination
function getDestinationLabel(index) {
    if (index === 0) {
        return "Origin";
    } else {
        return `Destination ${index}`;
    }
}

// Function to add a destination input field
function addDestinationField(latLng = null) {
    if (destinationCount >= maxDestinations) {
        showError('Maximum of 8 destinations allowed'); // Updated error message
        return;
    }

    const index = destinationCount;
    const color = colors[index];

    const destinationDiv = document.createElement('div');
    destinationDiv.className = 'input-group';
    destinationDiv.dataset.index = index;

    let placeholderText = "Enter location or coordinates";
    let inputValue = "";

    // If latLng is provided (from map click), use those coordinates
    if (latLng) {
        const lat = latLng.lat.toFixed(6);
        const lng = latLng.lng.toFixed(6);
        inputValue = `${lat}, ${lng}`;
        placeholderText = "Location from map";
    }

    // If it's the first destination and enfarmOfficeLocation exists and no custom coordinates
    if (index === 0 && !latLng) {
        inputValue = enfarmOfficeLocation.name;
    }

    const displayLabel = getDestinationLabel(index);

    const inputHtml = `
        <label>
            <div class="destination-item">
                <span class="marker" style="background-color: ${color};"></span>
                ${displayLabel}
            </div>
        </label>
        <div class="destination-controls">
            <input type="text" class="destination-input" placeholder="${placeholderText}" value="${inputValue}">
            <button type="button" class="btn-geocode" data-index="${index}">Go</button>
            <button type="button" class="btn-remove" data-index="${index}">×</button>
        </div>
    `;

    destinationDiv.innerHTML = inputHtml;
    destinationsContainer.appendChild(destinationDiv);

    // Add event listener to remove button
    const removeBtn = destinationDiv.querySelector('.btn-remove');
    if (removeBtn) {
        removeBtn.addEventListener('click', function () {
            removeDestination(this.dataset.index);
        });
    }

    // Add event listeners for input field
    const input = destinationDiv.querySelector('input');
    const geocodeBtn = destinationDiv.querySelector('.btn-geocode');

    // Listen for Enter key
    input.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            geocodeLocation(this.value, index);
        }
    });

    // Listen for geocode button click
    geocodeBtn.addEventListener('click', function () {
        geocodeLocation(input.value, index);
    });

    // Enable calculate button if we have at least 2 destinations
    destinationCount++;
    calculateRouteBtn.disabled = destinationCount < 2;

    // Disable add button if we reached max
    addDestinationBtn.disabled = destinationCount >= maxDestinations;

    // If coordinates were provided (from map click), add the marker immediately
    if (latLng) {
        addMarker(latLng.lat, latLng.lng, index);
    } else if (index === 0 && inputValue === enfarmOfficeLocation.name) {
        // If it's the first destination with Enfarm Office, add the marker
        addMarker(enfarmOfficeLocation.lat, enfarmOfficeLocation.lng, index);
    }

    return index;
}

// Function to remove a destination
function removeDestination(index) {
    // Remove the input group
    const destinationDiv = document.querySelector(`.input-group[data-index="${index}"]`);
    if (destinationDiv) {
        destinationsContainer.removeChild(destinationDiv);
    }

    // Remove the marker if it exists
    if (markers[index]) {
        map.removeLayer(markers[index]);
        markers[index] = null;
    }

    destinationCount--;

    // Re-enable add button
    addDestinationBtn.disabled = destinationCount >= maxDestinations;

    // Update calculate button state
    calculateRouteBtn.disabled = destinationCount < 2;

    // Clear any existing route
    clearRoute();

    // Hide results
    resultsSection.style.display = 'none';
}

// Function to geocode a location string to coordinates
function geocodeLocation(locationStr, index) {
    if (!locationStr.trim()) return;

    // Show loading indicator
    loadingIndicator.style.display = 'block';

    // Check if it's a coordinate pair
    const coordPattern = /^[-+]?([1-8]?\d(\.\d+)?|90(\.0+)?),\s*[-+]?(180(\.0+)?|((1[0-7]\d)|([1-9]?\d))(\.\d+)?)$/;

    if (coordPattern.test(locationStr)) {
        // It's coordinates
        const [lat, lng] = locationStr.split(',').map(coord => parseFloat(coord.trim()));
        addMarker(lat, lng, index);
        loadingIndicator.style.display = 'none';
    } else {
        // Use Nominatim for geocoding
        fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(locationStr)}`)
            .then(response => response.json())
            .then(data => {
                loadingIndicator.style.display = 'none';

                if (data && data.length > 0) {
                    const result = data[0];
                    addMarker(parseFloat(result.lat), parseFloat(result.lon), index);
                } else {
                    showError(`Could not find location: ${locationStr}`);
                }
            })
            .catch(error => {
                loadingIndicator.style.display = 'none';
                showError('Error geocoding location: ' + error.message);
            });
    }
}



// Function to add a marker to the map
function addMarker(lat, lng, index) {
    // Remove existing marker at this index
    if (markers[index]) {
        map.removeLayer(markers[index]);
    }

    // Create a marker with custom icon
    const color = colors[index];

    // Special handling for Enfarm Office (first marker)
    let icon;
    if (index === 0 && lat === enfarmOfficeLocation.lat && lng === enfarmOfficeLocation.lng) {
        // Use Enfarm favicon for the first marker (Enfarm Office)
        icon = L.icon({
            iconUrl: 'https://i.ibb.co/39PGw6ky/enfarm-store.png',
            iconSize: [60, 60], // Adjust size as needed
            iconAnchor: [20, 20], // Half of iconSize for proper positioning
            popupAnchor: [0, -20]
        });
    } else {
        // Display number (1-based for UI, but 0-based for Origin)
        const displayNumber = index === 0 ? "O" : (index).toString();

        icon = L.divIcon({
            className: 'custom-marker',
            html: `<div style="background-color: ${color}; width: 24px; height: 24px; border-radius: 50%; border: 2px solid white; display: flex; justify-content: center; align-items: center; color: white; font-weight: bold; font-size: 12px;">${displayNumber}</div>`,
            iconSize: [28, 28],
            iconAnchor: [14, 14]
        });
    }

    // Add the marker to the map
    const marker = L.marker([lat, lng], { icon }).addTo(map);

    // Bind tooltip based on index
    marker.bindTooltip(getDestinationLabel(index));

    // For Enfarm Office, add a popup with the store name
    if (index === 0 && lat === enfarmOfficeLocation.lat && lng === enfarmOfficeLocation.lng) {
        marker.bindPopup('Enfarm Store');
    }

    // Store the marker
    markers[index] = marker;

    // Fit map to show all markers
    const validMarkers = markers.filter(m => m !== null);
    if (validMarkers.length > 0) {
        const group = L.featureGroup(validMarkers);
        map.fitBounds(group.getBounds().pad(0.1));
    }

    // Clear any existing route
    clearRoute();

    // Hide results
    resultsSection.style.display = 'none';
}

// Function to calculate the route
function calculateRoute() {
    // Check if we have at least 2 valid destinations
    const validMarkers = markers.filter(m => m !== null);
    if (validMarkers.length < 2) {
        showError('Please add at least 2 valid destinations');
        return;
    }

    // Clear any existing route
    clearRoute();

    // Show loading indicator
    loadingIndicator.style.display = 'block';

    // Create waypoints for all markers
    const waypoints = validMarkers.map((marker, idx) => {
        const latLng = marker.getLatLng();
        // Find the original index by searching through the markers array
        const originalIndex = markers.findIndex(m => m === marker);
        return {
            latLng: latLng,
            name: getDestinationLabel(originalIndex),
            originalIndex: originalIndex
        };
    });

    // Always calculate optimal route
    calculateOptimalRoute(waypoints);
}

// Function to calculate the optimal route
function calculateOptimalRoute(waypoints) {
    const n = waypoints.length;

    // Show loading indicator
    loadingIndicator.style.display = 'block';

    // Create a string of coordinates for the OSRM API
    const coordinates = waypoints.map(point => `${point.latLng.lng},${point.latLng.lat}`).join(';');
    const url = `https://router.project-osrm.org/table/v1/driving/${coordinates}?annotations=distance`;

    fetch(url)
        .then(response => response.json())
        .then(data => {
            if (data.code === 'Ok') {
                const distanceMatrix = data.distances;

                // Implement a greedy algorithm (nearest neighbor) to find the optimal route
                const optimalRoute = [waypoints[0]]; // Start with the first waypoint
                const visited = new Set([0]);
                let currentIndex = 0;

                // Visit all destinations
                while (visited.size < n) {
                    let minDistance = Infinity;
                    let nextIndex = -1;

                    // Find nearest unvisited destination
                    for (let i = 0; i < n; i++) {
                        if (!visited.has(i) && distanceMatrix[currentIndex][i] < minDistance) {
                            minDistance = distanceMatrix[currentIndex][i];
                            nextIndex = i;
                        }
                    }

                    if (nextIndex !== -1) {
                        optimalRoute.push(waypoints[nextIndex]);
                        visited.add(nextIndex);
                        currentIndex = nextIndex;
                    }
                }

                // Add the origin as the final destination to create a round trip
                optimalRoute.push(waypoints[0]);

                // Create the route with optimal order
                createRoute(optimalRoute);
            } else {
                showError('Error calculating optimal route');
                // Fallback to original order
                createRoute(waypoints);
            }
        })
        .catch(error => {
            console.error('Error fetching distance matrix:', error);
            showError('Error optimizing route. Using original order.');
            // Fallback to original order
            createRoute(waypoints);
        });
}

// Function to create the actual route
function createRoute(optimizedWaypoints) {
    // Prepare waypoints for routing
    const routingWaypoints = optimizedWaypoints.map((point) => {
        return L.Routing.waypoint(point.latLng, point.name);
    });

    // Create routing control
    routingControl = L.Routing.control({
        waypoints: routingWaypoints,
        routeWhileDragging: false,
        showAlternatives: false,
        fitSelectedRoutes: true,
        router: L.Routing.osrmv1({
            serviceUrl: 'https://router.project-osrm.org/route/v1',
            profile: 'driving'
        }),
        lineOptions: {
            styles: [{ color: '#3498db', weight: 6, opacity: 0.8 }]
        },
        createMarker: function () { return null; }, // Don't create default markers

        // Add formatter to customize the route summary
        formatter: new L.Routing.Formatter({
            distanceTemplate: '{value} {unit}',
            summaryTemplate: '{distance}', // Only show distance, no time
            timeTemplate: '' // Empty template for time to hide it
        })
    }).addTo(map);

    // Update marker labels with new order
    optimizedWaypoints.forEach((point, idx) => {
        const marker = markers[point.originalIndex];
        if (marker) {
            // Update visual markers
            const color = colors[idx]; // Use the color based on new sequence

            // Create new icon with new color and number/letter
            const displayChar = idx === 0 ? "O" : idx.toString();

            const icon = L.divIcon({
                className: 'custom-marker',
                html: `<div style="background-color: ${color}; width: 24px; height: 24px; border-radius: 50%; border: 2px solid white; display: flex; justify-content: center; align-items: center; color: white; font-weight: bold; font-size: 12px;">${displayChar}</div>`,
                iconSize: [28, 28],
                iconAnchor: [14, 14]
            });

            marker.setIcon(icon);

            // Update tooltip
            marker.unbindTooltip();

            const originalLabel = getDestinationLabel(point.originalIndex);
            // Inside the createRoute function, in the forEach loop that updates marker tooltips:
            const newLabel = idx === 0 ? "Origin" : `🏳️ Stop ${idx}`;

            marker.bindTooltip(`${newLabel} (${originalLabel})`, {
                permanent: true,
                direction: 'top',
                offset: [0, -10],
                className: 'permanent-tooltip'
            }).openTooltip();
        }
    });

    // Handle route calculation events
    routingControl.on('routesfound', function (e) {
        loadingIndicator.style.display = 'none';

        const routes = e.routes;
        const route = routes[0]; // Use the first route

        // Display route summary
        const distance = (route.summary.totalDistance / 1000).toFixed(1); // km

        totalDistanceEl.textContent = distance;

        // Populate the destinations list
        populateDestinationsList(optimizedWaypoints);

        // Show results section
        resultsSection.style.display = 'block';

        // Style arrival instructions to make them bold
        styleArrivalInstructions();

        // Add direction arrows to the route line
        addDirectionArrows(route.coordinates);

        // Add a close button to the routing panel
        addCloseButtonToRoutingPanel();
    });

    routingControl.on('routingerror', function (e) {
        loadingIndicator.style.display = 'none';
        showError('Error calculating route: ' + e.error.message);
    });
}

// Function to add a close button to the routing panel
function addCloseButtonToRoutingPanel() {
    // Wait a bit for the DOM to be updated
    setTimeout(() => {
        // Find the routing container
        const routingContainer = document.querySelector('.leaflet-routing-container');

        if (routingContainer && !routingContainer.querySelector('.routing-close-btn')) {
            // Create close button with Material Icon
            const closeButton = document.createElement('button');
            closeButton.className = 'routing-close-btn';
            closeButton.title = 'Close directions panel';

            // Create Material Icon span element
            const closeIcon = document.createElement('span');
            closeIcon.className = 'material-symbols-outlined';
            closeIcon.textContent = 'close';
            closeButton.appendChild(closeIcon);

            // Add click handler
            closeButton.addEventListener('click', function () {
                // Find the routing container again (in case it changed)
                const container = document.querySelector('.leaflet-routing-container');
                if (container) {
                    container.style.display = 'none';
                }
            });

            // Add the button to the routing container
            routingContainer.insertBefore(closeButton, routingContainer.firstChild);
        }
    }, 200);
}

// Add event listener for the checkbox
showDirectionArrowsCheckbox.addEventListener('change', function () {
    showDirectionArrows = this.checked;

    // If there's an active route, update the arrows
    if (routingControl && window.routeCoordinates) {
        if (showDirectionArrows) {
            addDirectionArrows(window.routeCoordinates);
        } else {
            removeDirectionArrows();
        }
    }
});

// Add this new function to create the direction arrows
function addDirectionArrows(coordinates) {
    // Store the coordinates for later use
    window.routeCoordinates = coordinates;

    // If arrows are turned off, don't add them
    if (!showDirectionArrows) {
        return;
    }

    // Remove any existing decorators
    removeDirectionArrows();

    // Create a polyline from the route coordinates
    const routeLine = L.polyline(coordinates, {
        opacity: 0, // Make this invisible so we don't see duplicate lines
        weight: 1
    }).addTo(map);

    // Create the decorator with arrow patterns
    const decorator = L.polylineDecorator(routeLine, {
        patterns: [
            {
                offset: 25, // Offset from start in pixels
                repeat: 250, // Repeat every 150 pixels (adjust as needed)
                symbol: L.Symbol.arrowHead({
                    pixelSize: 12, // Size of the arrow
                    polygon: false,
                    pathOptions: {
                        stroke: true,
                        color: '#FFFFFF', // White color for visibility
                        weight: 2,
                        fillOpacity: 1,
                        opacity: 0.8
                    }
                })
            }
        ]
    }).addTo(map);

    // Store references to remove them later
    window.currentDecorator = decorator;
    window.invisibleRouteLine = routeLine;
}

// Add a function to remove direction arrows
function removeDirectionArrows() {
    // Remove any existing direction arrows
    if (window.currentDecorator) {
        map.removeLayer(window.currentDecorator);
        window.currentDecorator = null;
    }

    // Remove invisible line used for decoration
    if (window.invisibleRouteLine) {
        map.removeLayer(window.invisibleRouteLine);
        window.invisibleRouteLine = null;
    }
}

// Function to populate the destinations list
function populateDestinationsList(waypoints) {
    destinationsList.innerHTML = '';

    waypoints.forEach((waypoint, index) => {
        const color = colors[index % colors.length];

        const item = document.createElement('div');
        item.className = 'destination-item';

        // Display number (adjusted for route order)
        const displayChar = index === 0 ? "O" : index.toString();

        // Get the original label
        const originalLabel = getDestinationLabel(waypoint.originalIndex);

        // Create the route step label with flag emoji for stops (not for origin)
        const stepLabel = index === 0 ? "Origin" : `🏳️ Stop ${index}`;

        let originalOrderText = '';
        if (waypoint.originalIndex !== index) {
            originalOrderText = ` (${originalLabel})`;
        }

        item.innerHTML = `
            <div class="destination-number" style="background-color: ${color};">${displayChar}</div>
            <div><strong>${stepLabel}</strong>${originalOrderText}</div>
        `;

        destinationsList.appendChild(item);

        // Add arrow between destinations
        if (index < waypoints.length - 1) {
            const arrow = document.createElement('div');
            arrow.className = 'route-arrow';
            arrow.innerHTML = '↓';
            destinationsList.appendChild(arrow);
        }
    });
}

// Function to clear the route
function clearRoute() {
    if (routingControl) {
        map.removeControl(routingControl);
        routingControl = null;
    }

    // Clear route coordinates
    window.routeCoordinates = null;

    // Remove direction arrows
    removeDirectionArrows();

    // Reset marker tooltips to non-permanent
    markers.forEach((marker, index) => {
        if (marker) {
            marker.unbindTooltip();
            marker.bindTooltip(getDestinationLabel(index));
        }
    });

    errorMessage.style.display = 'none';
}

// Function to clear all destinations and routes
function clearAll() {
    // Remove all markers
    markers.forEach(marker => {
        if (marker) {
            map.removeLayer(marker);
        }
    });
    markers = [];

    // Clear the destinations container
    destinationsContainer.innerHTML = '';

    // Clear the route
    clearRoute();

    // Reset counters
    destinationCount = 0;

    // Reset UI elements
    addDestinationBtn.disabled = false;
    calculateRouteBtn.disabled = true;
    resultsSection.style.display = 'none';
    loadingIndicator.style.display = 'none';
    errorMessage.style.display = 'none';

    // Add initial destination with Enfarm Office
    addDestinationField();
}

// Function to show error message
function showError(message) {
    errorMessage.textContent = message;
    errorMessage.style.display = 'block';
    loadingIndicator.style.display = 'none';

    // Hide after 5 seconds
    setTimeout(() => {
        errorMessage.style.display = 'none';
    }, 5000);
}

// Function to handle map clicks for adding destinations
function onMapClick(e) {
    // If we've already reached max destinations, show error
    if (destinationCount >= maxDestinations) {
        showError('Maximum of 8 destinations allowed'); // Updated error message
        return;
    }

    // Add a new destination with the clicked coordinates
    addDestinationField(e.latlng);

    // Reverse geocode to get address
    fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${e.latlng.lat}&lon=${e.latlng.lng}&zoom=18&addressdetails=1`)
        .then(response => response.json())
        .then(data => {
            if (data && data.display_name) {
                // Update the input field with the address
                const inputs = document.querySelectorAll('.destination-input');
                const lastIndex = inputs.length - 1;

                if (inputs[lastIndex]) {
                    inputs[lastIndex].value = data.display_name;
                }
            }
        })
        .catch(error => {
            console.error('Error reverse geocoding:', error);
        });
}

// Function to make directions interactive and add flag emoji to arrivals
function styleArrivalInstructions() {
    // This function runs after the route is created and displayed
    setTimeout(() => {
        // Find all instruction rows in the routing table
        const instructionRows = document.querySelectorAll('.leaflet-routing-alt tbody tr');

        // Loop through each row
        instructionRows.forEach((row) => {
            const cell = row.querySelector('td:nth-child(2)');
            if (!cell) return;

            // Check if the text contains "You have arrived"
            if (cell.textContent.includes('You have arrived')) {
                // Add the flag emoji to the text
                cell.textContent = '🏳️ ' + cell.textContent;

                // Add the arrival-instruction class to this cell
                cell.classList.add('arrival-instruction');
            }

            // Make the row clickable
            row.style.cursor = 'pointer';

            // Add hover effect
            row.classList.add('instruction-row-interactive');

            // Get the coordinate data from the row's data attribute if possible
            // In Leaflet Routing Machine, each instruction row has a latLng property
            row.addEventListener('click', function () {
                // Try to get coordinates directly from the instruction
                if (row.getAttribute('data-lat') && row.getAttribute('data-lng')) {
                    // Some versions of Leaflet Routing Machine store coordinates as data attributes
                    const lat = parseFloat(row.getAttribute('data-lat'));
                    const lng = parseFloat(row.getAttribute('data-lng'));
                    map.setView([lat, lng], 20);
                } else {
                    // Fallback: extract coordinates from the instruction text if possible
                    // This is a bit hacky but can work for many routing engines
                    const coordMatch = cell.textContent.match(/\((-?\d+\.\d+),\s*(-?\d+\.\d+)\)/);
                    if (coordMatch && coordMatch.length === 3) {
                        const lat = parseFloat(coordMatch[1]);
                        const lng = parseFloat(coordMatch[2]);
                        map.setView([lat, lng], 20);
                    } else if (routingControl && routingControl._routes && routingControl._routes[0]) {
                        // Another fallback: use the route's waypoints
                        // Find which waypoint this instruction is closest to
                        const route = routingControl._routes[0];
                        const instructions = route.instructions || [];

                        // Try to find the instruction index
                        let instructionIndex = -1;
                        instructionRows.forEach((r, idx) => {
                            if (r === row) instructionIndex = idx;
                        });

                        if (instructionIndex >= 0 && instructionIndex < instructions.length) {
                            // Use the coordinate for this instruction
                            const instruction = instructions[instructionIndex];
                            if (instruction.index !== undefined && route.coordinates) {
                                const latlng = L.latLng(
                                    route.coordinates[instruction.index].lat,
                                    route.coordinates[instruction.index].lng
                                );
                                map.setView(latlng, 20);
                                return;
                            }
                        }

                        // Final fallback: use proportional mapping
                        const totalInstructions = instructionRows.length;
                        const totalCoords = route.coordinates.length;
                        const coordIndex = Math.min(
                            Math.floor((instructionIndex / totalInstructions) * totalCoords),
                            totalCoords - 1
                        );
                        const latlng = L.latLng(
                            route.coordinates[coordIndex].lat,
                            route.coordinates[coordIndex].lng
                        );
                        map.setView(latlng, 16);
                    }
                }
            });
        });
    }, 500);
}



// Add initial destination with Enfarm Office
addDestinationField();

// Create the search control without button, using Enter key only
function createSearchControl() {
    // Create a custom control for search
    const searchControl = L.Control.extend({
        options: {
            position: 'topleft'
        },

        onAdd: function (map) {
            const container = L.DomUtil.create('div', 'leaflet-control');

            const input = L.DomUtil.create('input', '', container);
            input.type = 'text';
            input.placeholder = 'Search for a customer farm, a location or enter coordinates...';
            input.style.padding = '8px';
            input.style.width = '420px';
            input.style.border = '1px solid #ccc';
            input.style.borderRadius = '4px';
            input.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.1)'; // Add shadow
            input.style.outline = 'none'; // Remove the outline on focus

            // Prevent map click events from triggering on the control
            L.DomEvent.disableClickPropagation(container);
            L.DomEvent.disableScrollPropagation(container);

            // Add event listener to the input for Enter key
            L.DomEvent.addListener(input, 'keydown', function (e) {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    searchLocation(input.value);
                }
            });

            return container;
        }
    });

    // Add the search control to the map
    map.addControl(new searchControl());
}

// Function to search for a location
function searchLocation(searchText) {
    if (!searchText.trim()) return;

    // Show loading indicator
    loadingIndicator.style.display = 'block';

    // Check if it's a coordinate pair
    const coordPattern = /^[-+]?([1-8]?\d(\.\d+)?|90(\.0+)?),\s*[-+]?(180(\.0+)?|((1[0-7]\d)|([1-9]?\d))(\.\d+)?)$/;

    if (coordPattern.test(searchText)) {
        // It's coordinates
        const [lat, lng] = searchText.split(',').map(coord => parseFloat(coord.trim()));

        // Pan the map to the coordinates
        map.setView([lat, lng], 10);

        // Create a temporary marker
        const tempMarker = L.marker([lat, lng]).addTo(map);

        // Create a popup with the add button
        const popupContent = document.createElement('div');
        popupContent.innerHTML = `<strong>Location:</strong> ${lat}, ${lng}<br>`;

        const addButton = document.createElement('button');
        addButton.className = 'basemap-button';
        addButton.innerText = 'Add to destinations';
        addButton.onclick = function () {
            if (destinationCount < maxDestinations) {
                addDestinationField({ lat: lat, lng: lng });
                map.removeLayer(tempMarker);
            } else {
                showError('Maximum of 8 destinations allowed'); // Updated error message
            }
        };

        popupContent.appendChild(addButton);
        tempMarker.bindPopup(popupContent).openPopup();

        loadingIndicator.style.display = 'none';
    } else {
        // Use Nominatim for geocoding
        fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchText)}`)
            .then(response => response.json())
            .then(data => {
                loadingIndicator.style.display = 'none';

                if (data && data.length > 0) {
                    const result = data[0];
                    const lat = parseFloat(result.lat);
                    const lng = parseFloat(result.lon);

                    // Pan the map to the result
                    map.setView([lat, lng], 10);

                    // Create a temporary marker
                    const tempMarker = L.marker([lat, lng]).addTo(map);

                    // Create a popup with the add button
                    const popupContent = document.createElement('div');
                    popupContent.innerHTML = `<strong>${result.display_name}</strong><br>`;

                    const addButton = document.createElement('button');
                    addButton.className = 'basemap-button';
                    addButton.innerText = 'Add to destinations';
                    addButton.onclick = function () {
                        if (destinationCount < maxDestinations) {
                            addDestinationField({ lat: lat, lng: lng });
                            map.removeLayer(tempMarker);
                        } else {
                            showError('Maximum of 8 destinations allowed'); // Updated error message
                        }
                    };

                    popupContent.appendChild(addButton);
                    tempMarker.bindPopup(popupContent).openPopup();
                } else {
                    showError(`Could not find location: ${searchText}`);
                }
            })
            .catch(error => {
                loadingIndicator.style.display = 'none';
                showError('Error geocoding location: ' + error.message);
            });
    }
}

// Create the basemap control
function createBasemapControl() {
    // Define the basemap layers
    const basemaps = {
        //'OpenStreetMap': L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        //  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        //}),
        'Google Maps': L.tileLayer('https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
            attribution: '&copy; Google Maps',
            subdomains: ['mt0', 'mt1', 'mt2', 'mt3']
        }),
        'Google Satellite': L.tileLayer('https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', {
            attribution: '&copy; Google Maps',
            subdomains: ['mt0', 'mt1', 'mt2', 'mt3']
        }),
        'Google Hybrid': L.tileLayer('https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', {
            attribution: '&copy; Google Maps',
            subdomains: ['mt0', 'mt1', 'mt2', 'mt3']
        })
    };

    // Set the default layer (OpenStreetMap)
    basemaps['Google Satellite'].addTo(map);

    // Create a custom control for basemap selection
    const basemapControl = L.Control.extend({
        options: {
            position: 'bottomleft'
        },

        onAdd: function (map) {
            const container = L.DomUtil.create('div', 'basemap-control');

            // Add a title
            //const title = L.DomUtil.create('div', 'basemap-control-title', container);
            //title.textContent = 'Base Maps';

            // Create a container for the buttons
            const buttonContainer = L.DomUtil.create('div', 'basemap-button-container', container);

            // Create buttons for each basemap
            for (const [name, layer] of Object.entries(basemaps)) {
                const button = L.DomUtil.create('button', 'basemap-button', buttonContainer);
                button.textContent = name;

                // Mark the default layer button as active
                if (name === 'Google Satellite') {
                    button.classList.add('active');
                }

                // Add click event to switch basemaps
                L.DomEvent.addListener(button, 'click', function () {
                    // Remove all existing basemap layers
                    for (const [_, baseLayer] of Object.entries(basemaps)) {
                        if (map.hasLayer(baseLayer)) {
                            map.removeLayer(baseLayer);
                        }
                    }

                    // Add the selected basemap
                    map.addLayer(layer);

                    // Update active button styling
                    const buttons = container.querySelectorAll('.basemap-button');
                    buttons.forEach(btn => btn.classList.remove('active'));
                    button.classList.add('active');
                });
            }

            // Prevent click events from propagating to the map
            L.DomEvent.disableClickPropagation(container);
            L.DomEvent.disableScrollPropagation(container);

            return container;
        }
    });

    // Add the basemap control to the map
    map.addControl(new basemapControl());
}

/*

// Add this new function to create the direction arrows with animation
function addDirectionArrows(coordinates) {
    // Store the coordinates for later use
    window.routeCoordinates = coordinates;
    
    // If arrows are turned off, don't add them
    if (!showDirectionArrows) {
        return;
    }
    
    // Remove any existing decorators
    removeDirectionArrows();
    
    // Create a polyline from the route coordinates
    const routeLine = L.polyline(coordinates, {
        opacity: 0, // Make this invisible so we don't see duplicate lines
        weight: 1
    }).addTo(map);
    
    // Create the decorator with arrow patterns
    const decorator = L.polylineDecorator(routeLine, {
        patterns: [
            {
                offset: 0,
                repeat: 150, // Repeat every 150 pixels
                symbol: L.Symbol.arrowHead({
                    pixelSize: 12, // Size of the arrow
                    polygon: false,
                    pathOptions: {
                        stroke: true,
                        color: '#FFFFFF', // White color for visibility
                        weight: 2,
                        fillOpacity: 1,
                        opacity: 0.8
                    }
                })
            }
        ]
    }).addTo(map);
    
    // Store references to remove them later
    window.currentDecorator = decorator;
    window.invisibleRouteLine = routeLine;
    
    // Add animation to the arrows
    animateArrows();
}

// Function to animate the direction arrows
function animateArrows() {
    if (!window.currentDecorator || !showDirectionArrows) return;
    
    let offset = 0;
    const animationSpeed = 50; // ms between animation frames (lower = faster)
    const step = 1; // How far to move each frame
    
    // Clear any existing animation
    if (window.arrowAnimation) {
        clearInterval(window.arrowAnimation);
    }
    
    // Create animation interval
    window.arrowAnimation = setInterval(() => {
        offset = (offset + step) % 150; // Reset after reaching pattern repeat distance
        
        // Update the pattern offset
        window.currentDecorator.setPatterns([
            {
                offset: offset,
                repeat: 150,
                symbol: L.Symbol.arrowHead({
                    pixelSize: 12,
                    polygon: false,
                    pathOptions: {
                        stroke: true,
                        color: '#FFFFFF',
                        weight: 2,
                        fillOpacity: 1,
                        opacity: 0.8
                    }
                })
            }
        ]);
    }, animationSpeed);
}

// Modified to also clear animation interval
function removeDirectionArrows() {
    // Clear animation interval
    if (window.arrowAnimation) {
        clearInterval(window.arrowAnimation);
        window.arrowAnimation = null;
    }
    
    // Remove any existing direction arrows
    if (window.currentDecorator) {
        map.removeLayer(window.currentDecorator);
        window.currentDecorator = null;
    }
    
    // Remove invisible line used for decoration
    if (window.invisibleRouteLine) {
        map.removeLayer(window.invisibleRouteLine);
        window.invisibleRouteLine = null;
    }
}
    */


// Function to animate the route progression - to be called after route calculation
function animateRouteProgression(coordinates) {
    // Store the coordinates for later use
    window.routeCoordinates = coordinates;

    // Remove any existing route animations
    removeRouteAnimations();

    // Create a visible polyline that will grow
    // First create a shadow effect with black line
    const shadowLine = L.polyline([], {
        color: '#000000',
        weight: 14, // Widest line for shadow
        opacity: 0.3, // Very transparent
        lineCap: 'round',
        lineJoin: 'round',
        offset: 2 // Slight offset to create shadow effect
    }).addTo(map);

    // Then create a glow effect with wider, semi-transparent line
    const glowLine = L.polyline([], {
        color: '#3498db',
        weight: 12, // Wider line for glow
        opacity: 0.4, // Semi-transparent
        lineCap: 'round',
        lineJoin: 'round'
    }).addTo(map);

    // Then add the main line on top
    const progressLine = L.polyline([], {
        color: '#3498db',
        weight: 6,
        opacity: 0.9, // Increased for better contrast
        lineCap: 'round',
        lineJoin: 'round'
    }).addTo(map);

    // Store references to remove them later
    window.shadowLine = shadowLine;
    window.glowLine = glowLine;
    window.progressLine = progressLine;

    // Animation variables
    let currentSegment = 0;
    let currentPoint = 0;
    const totalPoints = coordinates.length;
    const pointsPerFrame = 2; // Reduced from 3 to 1 for slower animation
    const segmentDelay = 500; // Increased from 500 to 800 milliseconds

    // Function to animate a single segment of the route
    function animateSegment() {
        // Get start and end indices for the current segment
        const segmentStartIndex = currentSegment;
        let segmentEndIndex = coordinates.length - 1;

        // Find the next waypoint (or destination) index
        if (routingControl && routingControl._routes && routingControl._routes[0] && routingControl._routes[0].waypointIndices) {
            const waypointIndices = routingControl._routes[0].waypointIndices;

            // If we have more waypoints to process
            if (currentSegment < waypointIndices.length - 1) {
                segmentEndIndex = waypointIndices[currentSegment + 1];
            }
        }

        // Animation frame function for this segment
        function animateFrame() {
            // Add points to the line for this frame
            for (let i = 0; i < pointsPerFrame; i++) {
                if (currentPoint <= segmentEndIndex) {
                    // Update all three lines - shadow, glow, and main
                    const displayPoints = progressLine.getLatLngs();
                    displayPoints.push(coordinates[currentPoint]);
                    shadowLine.setLatLngs(displayPoints); // Update shadow line
                    glowLine.setLatLngs(displayPoints); // Update glow line
                    progressLine.setLatLngs(displayPoints); // Update main line
                    currentPoint++;
                } else {
                    // We've finished this segment
                    clearInterval(animationInterval);

                    // Move to the next segment
                    currentSegment++;

                    // If we have more segments to animate
                    if (currentSegment < (routingControl._routes[0].waypointIndices?.length - 1 || 0)) {
                        // After a delay, start the next segment
                        setTimeout(animateSegment, segmentDelay);
                    } else if (currentPoint < totalPoints) {
                        // Animate the final segment back to the origin (for round trips)
                        setTimeout(animateSegment, segmentDelay);
                    } else {
                        // We've finished all segments, add animated directional arrows
                        if (showDirectionArrows) {
                            addAnimatedDirectionArrows(coordinates);
                        }
                    }
                    return;
                }
            }
        }

        // Start animation for this segment
        const animationInterval = setInterval(animateFrame, 100); // Increased from 50 to 100 milliseconds
    }

    // Start the animation with the first segment
    animateSegment();
}

// Function to remove route animations
function removeRouteAnimations() {
    // Remove any existing route progression line
    if (window.progressLine) {
        map.removeLayer(window.progressLine);
        window.progressLine = null;
    }

    // Remove the glow line
    if (window.glowLine) {
        map.removeLayer(window.glowLine);
        window.glowLine = null;
    }

    // Remove the shadow line
    if (window.shadowLine) {
        map.removeLayer(window.shadowLine);
        window.shadowLine = null;
    }

    // Also remove direction arrows
    removeDirectionArrows();
}

// Function to create the actual route - modified to use animation
function createRoute(optimizedWaypoints) {
    // Prepare waypoints for routing
    const routingWaypoints = optimizedWaypoints.map((point) => {
        return L.Routing.waypoint(point.latLng, point.name);
    });

    // Create routing control
    routingControl = L.Routing.control({
        waypoints: routingWaypoints,
        routeWhileDragging: false,
        showAlternatives: false,
        fitSelectedRoutes: true,
        router: L.Routing.osrmv1({
            serviceUrl: 'https://router.project-osrm.org/route/v1',
            profile: 'driving'
        }),
        lineOptions: {
            styles: [{ color: '#3498db', weight: 6, opacity: 0 }], // Make the default line invisible
            addWaypoints: false // Don't show the draggable waypoints
        },
        createMarker: function () { return null; }, // Don't create default markers

        // Add formatter to customize the route summary
        formatter: new L.Routing.Formatter({
            distanceTemplate: '{value} {unit}',
            summaryTemplate: '{distance}', // Only show distance, no time
            timeTemplate: '' // Empty template for time to hide it
        })
    }).addTo(map);

    // Update marker labels with new order
    optimizedWaypoints.forEach((point, idx) => {
        const marker = markers[point.originalIndex];
        if (marker) {
            // Update visual markers
            const color = colors[idx]; // Use the color based on new sequence

            // Create new icon with new color and number/letter
            const displayChar = idx === 0 ? "O" : idx.toString();

            const icon = L.divIcon({
                className: 'custom-marker',
                html: `<div style="background-color: ${color}; width: 24px; height: 24px; border-radius: 50%; border: 2px solid white; display: flex; justify-content: center; align-items: center; color: white; font-weight: bold; font-size: 12px;">${displayChar}</div>`,
                iconSize: [28, 28],
                iconAnchor: [14, 14]
            });

            marker.setIcon(icon);

            // Update tooltip
            marker.unbindTooltip();

            const originalLabel = getDestinationLabel(point.originalIndex);
            const newLabel = idx === 0 ? "Origin" : `🏳️ Stop ${idx}`;

            marker.bindTooltip(`${newLabel} (${originalLabel})`, {
                permanent: true,
                direction: 'top',
                offset: [0, -10],
                className: 'permanent-tooltip'
            }).openTooltip();
        }
    });

    // Handle route calculation events
    routingControl.on('routesfound', function (e) {
        loadingIndicator.style.display = 'none';

        const routes = e.routes;
        const route = routes[0]; // Use the first route

        // Display route summary
        const distance = (route.summary.totalDistance / 1000).toFixed(1); // km

        totalDistanceEl.textContent = distance;

        // Populate the destinations list
        populateDestinationsList(optimizedWaypoints);

        // Show results section
        resultsSection.style.display = 'block';

        // Style arrival instructions to make them bold
        styleArrivalInstructions();

        // Start the route progression animation instead of showing the entire route at once
        animateRouteProgression(route.coordinates);

        // Add a close button to the routing panel
        addCloseButtonToRoutingPanel();
    });

    routingControl.on('routingerror', function (e) {
        loadingIndicator.style.display = 'none';
        showError('Error calculating route: ' + e.error.message);
    });
}

// Function to add animated direction arrows
function addAnimatedDirectionArrows(coordinates) {
    // Store the coordinates for later use
    window.routeCoordinates = coordinates;

    // If arrows are turned off, don't add them
    if (!showDirectionArrows) {
        return;
    }

    // Remove any existing decorators
    removeDirectionArrows();

    // Create a polyline from the route coordinates (invisible)
    const routeLine = L.polyline(coordinates, {
        opacity: 0, // Make this invisible so we don't see duplicate lines
        weight: 1
    }).addTo(map);

    // Create the decorator with arrow patterns
    const decorator = L.polylineDecorator(routeLine, {
        patterns: [
            {
                offset: 0,
                repeat: 300, // Increased from 150 to 300 pixels - fewer arrows
                symbol: L.Symbol.arrowHead({
                    pixelSize: 12, // Size of the arrow
                    polygon: false,
                    pathOptions: {
                        stroke: true,
                        color: '#FFFFFF', // White color for visibility
                        weight: 2,
                        fillOpacity: 1,
                        opacity: 0.8
                    }
                })
            }
        ]
    }).addTo(map);

    // Store references to remove them later
    window.currentDecorator = decorator;
    window.invisibleRouteLine = routeLine;

    // Add animation to the arrows
    animateArrows();
}

// Function to animate the direction arrows
function animateArrows() {
    if (!window.currentDecorator || !showDirectionArrows) return;

    let offset = 0;
    const animationSpeed = 50; // ms between animation frames (lower = faster)
    const step = 1; // How far to move each frame

    // Clear any existing animation
    if (window.arrowAnimation) {
        clearInterval(window.arrowAnimation);
    }

    // Create animation interval
    window.arrowAnimation = setInterval(() => {
        offset = (offset + step) % 300; // Reset after reaching pattern repeat distance (increased to 300)

        // Update the pattern offset
        window.currentDecorator.setPatterns([
            {
                offset: offset,
                repeat: 300, // Increased to 300 pixels to match the pattern definition
                symbol: L.Symbol.arrowHead({
                    pixelSize: 12,
                    polygon: false,
                    pathOptions: {
                        stroke: true,
                        color: '#FFFFFF',
                        weight: 2,
                        fillOpacity: 1,
                        opacity: 0.8
                    }
                })
            }
        ]);
    }, animationSpeed);
}

// Function to remove direction arrows
function removeDirectionArrows() {
    // Clear animation interval
    if (window.arrowAnimation) {
        clearInterval(window.arrowAnimation);
        window.arrowAnimation = null;
    }

    // Remove any existing direction arrows
    if (window.currentDecorator) {
        map.removeLayer(window.currentDecorator);
        window.currentDecorator = null;
    }

    // Remove invisible line used for decoration
    if (window.invisibleRouteLine) {
        map.removeLayer(window.invisibleRouteLine);
        window.invisibleRouteLine = null;
    }
}

// Add event listener for the checkbox - modified to handle the new animation
showDirectionArrowsCheckbox.addEventListener('change', function () {
    showDirectionArrows = this.checked;

    // If there's an active route and a progressLine, toggle arrows on the progressLine
    if (routingControl && window.routeCoordinates) {
        if (showDirectionArrows) {
            addAnimatedDirectionArrows(window.routeCoordinates);
        } else {
            removeDirectionArrows();
        }
    }
});

// Function to clear the route - modified to remove animations
function clearRoute() {
    if (routingControl) {
        map.removeControl(routingControl);
        routingControl = null;
    }

    // Clear route coordinates
    window.routeCoordinates = null;

    // Remove animations
    removeRouteAnimations();

    // Reset marker tooltips to non-permanent
    markers.forEach((marker, index) => {
        if (marker) {
            marker.unbindTooltip();
            marker.bindTooltip(getDestinationLabel(index));
        }
    });

    errorMessage.style.display = 'none';
}






// Variable to store farm location markers
let farmMarkers = [];
let farmLayerGroup = null;
let farmsVisible = false;

// Function to fetch and display farm locations
function fetchAndDisplayFarmLocations() {
    // If farms are already loaded and visible, toggle them off
    if (farmLayerGroup && farmsVisible) {
        hideFarms();
        return;
    }

    // If farms are already loaded but hidden, show them
    if (farmLayerGroup && !farmsVisible) {
        showFarms();
        return;
    }

    // Otherwise, fetch and load farms
    // Show loading indicator
    loadingIndicator.style.display = 'block';

    // Fetch data from the API
    fetch('https://api-ma.enfarm.com/api/v1/ma/get-install-locations')
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        })
        .then(data => {
            // Hide loading indicator
            loadingIndicator.style.display = 'none';

            // Check if we got valid data
            if (data && Array.isArray(data.content)) {
                // Add markers for each farm location
                addFarmLocationMarkers(data.content);
                // Set farms visible flag
                farmsVisible = true;
                // Update toggle button text
                updateFarmToggleButton();
            } else {
                showError('Invalid data received from API');
            }
        })
        .catch(error => {
            loadingIndicator.style.display = 'none';
            showError('Error fetching farm locations: ' + error.message);
        });
}





// Function to add markers for farm locations with glowing effect
function addFarmLocationMarkers(locations) {
    // Clear any existing farm markers
    clearFarmMarkers();

    // Create a marker group to hold all farm markers
    farmLayerGroup = L.layerGroup();

    // Create custom icon for farm locations with glowing halo effect
    const farmIcon = L.divIcon({
        className: 'farm-location-marker',
        html: `
            <div class="farm-marker-container" style="position: relative; width: 100%; height: 100%;">
                <!-- Outer glow (largest) -->
                <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); 
                    width: 22px; height: 22px; border-radius: 50%; background-color: rgba(39, 174, 96, 0.2); 
                    animation: pulse 2s infinite;">
                </div>
                <!-- Middle glow -->
                <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); 
                    width: 18px; height: 18px; border-radius: 50%; background-color: rgba(39, 174, 96, 0.3); 
                    animation: pulse 2s infinite 0.3s;">
                </div>
                <!-- Inner glow -->
                <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); 
                    width: 14px; height: 14px; border-radius: 50%; background-color: rgba(39, 174, 96, 0.4); 
                    animation: pulse 2s infinite 0.6s;">
                </div>
                <!-- Actual marker (center) -->
                <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); 
                    width: 8px; height: 8px; border-radius: 50%; background-color: #27ae60; 
                    border: 2px solid white; box-shadow: 0 1px 3px rgba(0,0,0,0.3);">
                </div>
            </div>
        `,
        iconSize: [30, 30],
        iconAnchor: [15, 15]
    });

    // Add animation style for the pulsing effect
    if (!document.getElementById('farm-marker-animation')) {
        const style = document.createElement('style');
        style.id = 'farm-marker-animation';
        style.textContent = `
            @keyframes pulse {
                0% {
                    transform: translate(-50%, -50%) scale(0.8);
                    opacity: 0.8;
                }
                50% {
                    transform: translate(-50%, -50%) scale(1);
                    opacity: 0.5;
                }
                100% {
                    transform: translate(-50%, -50%) scale(0.8);
                    opacity: 0.8;
                }
            }
        `;
        document.head.appendChild(style);
    }

    // Add markers for each location
    locations.forEach(location => {
        // Check if location has valid coordinates
        if (location.lat && location.long) {
            // Create marker
            const marker = L.marker([location.lat, location.long], {
                icon: farmIcon
            });

            // Create popup content
            let popupContent = `<div class="farm-popup">`;

            // Add farm name if available
            if (location.farmname) {
                popupContent += `<strong>Farm: ${location.farmname}</strong><br>`;
            }

            // Add farm ID
            popupContent += `Farm ID: ${location.farmid}<br>`;

            // Add user ID if available
            if (location.user_id) {
                popupContent += `User ID: ${location.user_id}<br>`;
            }

            // Add tree type if available
            if (location.tree_type) {
                popupContent += `Tree Type: ${location.tree_type}<br>`;
            }

            // Add exhibit status
            popupContent += `Exhibit: ${location.is_exhibit ? 'Yes' : 'No'}<br><br>`;

            // Add button to add farm as a destination
            popupContent += `<button class="add-farm-destination" 
                data-lat="${location.lat}" 
                data-long="${location.long}" 
                data-name="${location.farmname || ('Farm ' + location.farmid)}"
                style="background-color: #3498db; color: white; border: none; border-radius: 4px; padding: 5px 10px; cursor: pointer; font-weight: bold;">
                Add to Destinations
            </button>`;

            popupContent += `</div>`;

            // Create popup with custom content
            const popup = L.popup().setContent(popupContent);

            // Bind popup to marker
            marker.bindPopup(popup);

            // Add event listener to the Add to Destinations button after popup opens
            marker.on('popupopen', function () {
                // Find the button in the popup
                const addButton = document.querySelector('.add-farm-destination');
                if (addButton) {
                    // Add click event listener
                    addButton.addEventListener('click', function () {
                        // Get coordinates and name from data attributes
                        const lat = parseFloat(this.getAttribute('data-lat'));
                        const long = parseFloat(this.getAttribute('data-long'));
                        const name = this.getAttribute('data-name');

                        // Check if we can add more destinations
                        if (destinationCount >= maxDestinations) {
                            showError(`Maximum of ${maxDestinations} destinations allowed`);
                            return;
                        }

                        // Add the farm as a destination
                        const index = addDestinationField({ lat: lat, lng: long });

                        // Update the input field with the farm name
                        const inputs = document.querySelectorAll('.destination-input');
                        if (inputs[index]) {
                            inputs[index].value = name;
                        }

                        // Close the popup
                        marker.closePopup();

                        // Show success message
                        showInfo(`Added ${name} to destinations`);
                    });
                }
            });

            // Add tooltip with name
            if (location.farmname) {
                marker.bindTooltip(`Farm: ${location.farmname}`);
            }

            // Add marker to group
            marker.addTo(farmLayerGroup);

            // Store marker for later removal
            farmMarkers.push(marker);
        }
    });

    // Add the layer group to the map
    farmLayerGroup.addTo(map);

    // Show info message about the number of locations
    showInfo(`Showing ${farmMarkers.length} farm locations`);
}

// Function to clear farm markers
function clearFarmMarkers() {
    if (farmLayerGroup) {
        map.removeLayer(farmLayerGroup);
    }
    farmMarkers = [];
    farmLayerGroup = null;
    farmsVisible = false;
    updateFarmToggleButton();
}

// Function to show farms
function showFarms() {
    if (farmLayerGroup) {
        farmLayerGroup.addTo(map);
        farmsVisible = true;
        showInfo(`Showing ${farmMarkers.length} farm locations`);
        updateFarmToggleButton();
    }
}

// Function to hide farms
function hideFarms() {
    if (farmLayerGroup) {
        map.removeLayer(farmLayerGroup);
        farmsVisible = false;
        showInfo('Farm locations hidden');
        updateFarmToggleButton();
    }
}

// Update farm toggle button text based on visibility state
function updateFarmToggleButton() {
    const toggleButton = document.querySelector('.farm-toggle-button');
    if (toggleButton) {
        if (farmsVisible) {
            toggleButton.innerHTML = `<span class="material-symbols-outlined">visibility_off</span> Hide Farms`;
        } else {
            toggleButton.innerHTML = `<span class="material-symbols-outlined">visibility</span> Show Farms`;
        }
    }
}

// Add a function to show info messages
function showInfo(message) {
    const infoEl = document.createElement('div');
    infoEl.className = 'info-message';
    infoEl.textContent = message;
    infoEl.style.position = 'absolute';
    infoEl.style.bottom = '20px';
    infoEl.style.left = '50%';
    infoEl.style.transform = 'translateX(-50%)';
    infoEl.style.backgroundColor = 'rgba(255, 255, 255, 0.9)';
    infoEl.style.color = 'gray';
    infoEl.style.padding = '8px 16px';
    infoEl.style.borderRadius = '4px';
    infoEl.style.boxShadow = '0 2px 5px rgba(0,0,0,0.2)';
    infoEl.style.zIndex = '1000';

    // Add to document
    document.body.appendChild(infoEl);

    // Remove after 3 seconds
    setTimeout(() => {
        if (document.body.contains(infoEl)) {
            document.body.removeChild(infoEl);
        }
    }, 3000);
}

// Add farm toggle button
function addFarmToggleButton() {
    // Create toggle control
    const FarmToggleControl = L.Control.extend({
        options: {
            position: 'topright'
        },

        onAdd: function () {
            const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control');

            // Create toggle button
            const button = L.DomUtil.create('a', 'farm-toggle-button', container);
            button.href = '#';
            button.innerHTML = `<span class="material-symbols-outlined">visibility</span> Show Farms`;

            // Style the button
            button.style.display = 'flex';
            button.style.alignItems = 'center';
            button.style.padding = '6px 10px';
            button.style.backgroundColor = 'white';
            button.style.color = '#27ae60';
            button.style.fontWeight = 'bold';
            button.style.textDecoration = 'none';
            button.style.borderRadius = '4px';
            //button.style.border = '2px solid #27ae60';
            button.style.textAlign = 'center';
            button.style.minWidth = '100px';

            // Add spacing between icon and text
            const iconStyle = document.createElement('style');
            iconStyle.innerHTML = `
                .farm-toggle-button .material-symbols-outlined {
                    margin-right: 6px;
                    font-size: 18px;
                    vertical-align: middle;
                }
            `;
            document.head.appendChild(iconStyle);

            // Toggle farm locations when clicked
            L.DomEvent.on(button, 'click', function (e) {
                L.DomEvent.preventDefault(e);
                fetchAndDisplayFarmLocations();
            });

            // Prevent map click events from being triggered
            L.DomEvent.disableClickPropagation(container);

            return container;
        }
    });

    // Add the control to the map
    map.addControl(new FarmToggleControl());
}

// Call the function to initialize the farm toggle button
document.addEventListener('DOMContentLoaded', function () {
    // Add the farm toggle button
    addFarmToggleButton();
});











// Function to create Google Maps link from optimized route waypoints
function createGoogleMapsLink(optimizedWaypoints) {
    // We need at least 2 waypoints to create a route
    if (!optimizedWaypoints || optimizedWaypoints.length < 2) {
        return null;
    }

    // Extract origin (first waypoint)
    const origin = optimizedWaypoints[0];
    const originCoords = `${origin.latLng.lat},${origin.latLng.lng}`;

    // Extract destination (last waypoint)
    const destination = optimizedWaypoints[optimizedWaypoints.length - 1];
    const destinationCoords = `${destination.latLng.lat},${destination.latLng.lng}`;

    // Extract intermediate waypoints (all points between first and last)
    const waypoints = optimizedWaypoints.slice(1, optimizedWaypoints.length - 1);

    // Format waypoints as required by Google Maps
    let waypointsParam = '';
    if (waypoints.length > 0) {
        waypointsParam = '&waypoints=' + waypoints.map(wp =>
            `${wp.latLng.lat},${wp.latLng.lng}`
        ).join('|');
    }

    // Construct the Google Maps URL
    const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${originCoords}&destination=${destinationCoords}${waypointsParam}&travelmode=driving`;

    return googleMapsUrl;
}

// Function to copy text to clipboard
function copyTextToClipboard(text) {
    // Create a temporary element
    const textArea = document.createElement('textarea');
    textArea.value = text;

    // Make the textarea hidden
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';

    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();

    // Copy text to clipboard
    let success = false;
    try {
        success = document.execCommand('copy');
    } catch (err) {
        console.error('Failed to copy: ', err);
    }

    // Clean up
    document.body.removeChild(textArea);
    return success;
}

// Function to show copy success message
function showCopySuccess() {
    // Create the message element
    const message = document.createElement('div');
    message.textContent = 'Link copied to clipboard!';
    message.style.position = 'fixed';
    message.style.bottom = '20px';
    message.style.left = '50%';
    message.style.transform = 'translateX(-50%)';
    message.style.backgroundColor = 'rgba(39, 174, 96, 0.9)';
    message.style.color = 'white';
    message.style.padding = '8px 16px';
    message.style.borderRadius = '4px';
    message.style.boxShadow = '0 2px 5px rgba(0,0,0,0.2)';
    message.style.zIndex = '1000';

    // Add to document
    document.body.appendChild(message);

    // Remove after 2 seconds
    setTimeout(() => {
        if (document.body.contains(message)) {
            document.body.removeChild(message);
        }
    }, 2000);
}

// Function to add Copy Link button to results section
function addGoogleMapsButton(optimizedWaypoints) {
    // Find the results section
    const resultsSection = document.getElementById('results');

    // Generate the Google Maps URL
    const googleMapsUrl = createGoogleMapsLink(optimizedWaypoints);
    if (!googleMapsUrl) return;

    // Check if results section exists and button doesn't already exist
    if (resultsSection && !document.getElementById('copy-gmaps-link')) {
        // Create button container
        const buttonContainer = document.createElement('div');
        buttonContainer.className = 'google-maps-container';
        buttonContainer.style.marginTop = '15px';

        /* Commented out Google Maps button
        // Create the Open in Google Maps button
        const openButton = document.createElement('button');
        openButton.id = 'open-in-gmaps';
        openButton.className = 'google-maps-button';
        openButton.innerHTML = `
            <span class="material-symbols-outlined">map</span>
            Open in Google Maps
        `;
        openButton.style.backgroundColor = '#4285F4'; // Google blue
        
        // Add click handler for open button
        openButton.addEventListener('click', function() {
            // Open the URL in a new tab
            window.open(googleMapsUrl, '_blank');
        });
        */

        // Create the Copy Link button
        const copyButton = document.createElement('button');
        copyButton.id = 'copy-gmaps-link';
        copyButton.className = 'copy-link-button';
        copyButton.innerHTML = `
            <span class="material-symbols-outlined">content_copy</span>
            Copy Google Maps Link
        `;
        copyButton.style.backgroundColor = '#34A853'; // Google green

        // Add click handler for copy button
        copyButton.addEventListener('click', function () {
            // Copy the URL to clipboard
            if (copyTextToClipboard(googleMapsUrl)) {
                showCopySuccess();
            }
        });

        // Add buttons to container (only copy button for now)
        // buttonContainer.appendChild(openButton); // Commented out
        buttonContainer.appendChild(copyButton);

        // Add container to results section
        resultsSection.appendChild(buttonContainer);
    }
}

// Modify the existing populateDestinationsList function to add the button
function populateDestinationsList(waypoints) {
    destinationsList.innerHTML = '';

    waypoints.forEach((waypoint, index) => {
        const color = colors[index % colors.length];

        const item = document.createElement('div');
        item.className = 'destination-item';

        // Display number (adjusted for route order)
        const displayChar = index === 0 ? "O" : index.toString();

        // Get the original label
        const originalLabel = getDestinationLabel(waypoint.originalIndex);

        // Create the route step label with flag emoji for stops (not for origin)
        const stepLabel = index === 0 ? "Origin" : `🏳️ Stop ${index}`;

        let originalOrderText = '';
        if (waypoint.originalIndex !== index) {
            originalOrderText = ` (${originalLabel})`;
        }

        item.innerHTML = `
            <div class="destination-number" style="background-color: ${color};">${displayChar}</div>
            <div><strong>${stepLabel}</strong>${originalOrderText}</div>
        `;

        destinationsList.appendChild(item);

        // Add arrow between destinations
        if (index < waypoints.length - 1) {
            const arrow = document.createElement('div');
            arrow.className = 'route-arrow';
            arrow.innerHTML = '↓';
            destinationsList.appendChild(arrow);
        }
    });

    // Add Copy Link button after the destinations list
    addGoogleMapsButton(waypoints);
}












// Global variable to store farm data for searching
let allFarms = [];

// Function to fetch farm data for searching
function fetchFarmData() {
    // Only fetch if we don't already have the data
    if (allFarms.length === 0) {
        // Show loading indicator
        loadingIndicator.style.display = 'block';

        // Fetch data from the API
        fetch('https://api-ma.enfarm.com/api/v1/ma/get-install-locations')
            .then(response => {
                if (!response.ok) {
                    throw new Error('Network response was not ok');
                }
                return response.json();
            })
            .then(data => {
                // Hide loading indicator
                loadingIndicator.style.display = 'none';

                // Check if we got valid data
                if (data && Array.isArray(data.content)) {
                    // Store all farm data for searching
                    allFarms = data.content.map(farm => ({
                        id: farm.farmid,
                        name: farm.farmname || `Farm ${farm.farmid}`,
                        lat: farm.lat,
                        lng: farm.long,
                        userId: farm.user_id,
                        treeType: farm.tree_type,
                        isExhibit: farm.is_exhibit
                    }));
                } else {
                    showError('Invalid data received from API');
                }
            })
            .catch(error => {
                loadingIndicator.style.display = 'none';
                showError('Error fetching farm data: ' + error.message);
            });
    }
}

// Function to enhance the search control with farm search
function enhanceSearchControl() {
    // Fetch farm data when the page loads
    fetchFarmData();

    // Find the search input element
    const searchInput = document.querySelector('.leaflet-control input[type="text"]');

    if (searchInput) {
        // Create a suggestions container
        const suggestionsContainer = document.createElement('div');
        suggestionsContainer.className = 'search-suggestions';
        suggestionsContainer.style.display = 'none';
        suggestionsContainer.style.position = 'absolute';
        suggestionsContainer.style.zIndex = '1000';
        suggestionsContainer.style.backgroundColor = 'white';
        suggestionsContainer.style.width = '300px';
        suggestionsContainer.style.maxHeight = '200px';
        suggestionsContainer.style.overflowY = 'auto';
        suggestionsContainer.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.2)';
        suggestionsContainer.style.borderRadius = '0 0 4px 4px';
        suggestionsContainer.style.border = '1px solid #ccc';
        suggestionsContainer.style.top = '100%';
        suggestionsContainer.style.left = '0';

        // Add the suggestions container after the search input
        searchInput.parentNode.style.position = 'relative';
        searchInput.parentNode.appendChild(suggestionsContainer);

        // Add event listener for input to show suggestions
        searchInput.addEventListener('input', function () {
            const query = this.value.trim().toLowerCase();

            // Clear suggestions
            suggestionsContainer.innerHTML = '';

            // If query is empty, hide suggestions
            if (query.length < 2) {
                suggestionsContainer.style.display = 'none';
                return;
            }

            // Filter farms by name
            const filteredFarms = allFarms.filter(farm =>
                farm.name.toLowerCase().includes(query)
            );

            // Show suggestions if we have any
            if (filteredFarms.length > 0) {
                // Create suggestion items
                filteredFarms.slice(0, 20).forEach(farm => {
                    const item = document.createElement('div');
                    item.className = 'suggestion-item';
                    item.style.padding = '8px 12px';
                    item.style.cursor = 'pointer';
                    item.style.borderBottom = '1px solid #eee';
                    item.style.display = 'flex';
                    item.style.alignItems = 'center';

                    // Add a green dot icon for farm
                    item.innerHTML = `
                        <div style="background-color: #27ae60; width: 8px; height: 8px; border-radius: 50%; margin-right: 8px;"></div>
                        <div>${farm.name}</div>
                    `;

                    // Add hover effect
                    item.addEventListener('mouseenter', function () {
                        this.style.backgroundColor = '#f0f0f0';
                    });

                    item.addEventListener('mouseleave', function () {
                        this.style.backgroundColor = 'white';
                    });

                    // Add click event to select this farm
                    item.addEventListener('click', function () {
                        // Set the search input value to the farm name
                        searchInput.value = farm.name;

                        // Hide suggestions
                        suggestionsContainer.style.display = 'none';

                        // Pan to the farm location
                        map.setView([farm.lat, farm.lng], 15);

                        // Create a temporary marker for the farm
                        const farmIcon = L.divIcon({
                            className: 'farm-suggestion-marker',
                            html: `
                                <div style="background-color: #27ae60; width: 10px; height: 10px; 
                                    border-radius: 50%; border: 2px solid white; 
                                    box-shadow: 0 1px 3px rgba(0,0,0,0.3);">
                                </div>
                            `,
                            iconSize: [14, 14],
                            iconAnchor: [7, 7]
                        });

                        const tempMarker = L.marker([farm.lat, farm.lng], {
                            icon: farmIcon
                        }).addTo(map);

                        // Create a popup with farm info and add to destination button
                        let popupContent = `
                            <div class="farm-popup">
                                <strong>Farm: ${farm.name}</strong><br>
                                Farm ID: ${farm.id}<br>
                        `;

                        if (farm.userId) {
                            popupContent += `User ID: ${farm.userId}<br>`;
                        }

                        if (farm.treeType) {
                            popupContent += `Tree Type: ${farm.treeType}<br>`;
                        }

                        popupContent += `Exhibit: ${farm.isExhibit ? 'Yes' : 'No'}<br><br>`;

                        // Add button to add farm as a destination
                        popupContent += `
                            <button class="add-farm-destination" 
                                data-lat="${farm.lat}" 
                                data-lng="${farm.lng}" 
                                data-name="${farm.name}"
                                style="background-color: #3498db; color: white; border: none; 
                                    border-radius: 4px; padding: 5px 10px; cursor: pointer; 
                                    font-weight: bold;">
                                Add to Destinations
                            </button>
                        `;

                        popupContent += `</div>`;

                        // Create and bind popup
                        const popup = L.popup().setContent(popupContent);
                        tempMarker.bindPopup(popup).openPopup();

                        // Add a small delay to ensure the popup DOM is fully rendered
                        setTimeout(() => {
                            const addButton = document.querySelector('.add-farm-destination');
                            if (addButton) {
                                addButton.addEventListener('click', function () {
                                    // Get coordinates and name from data attributes
                                    const lat = parseFloat(this.getAttribute('data-lat'));
                                    const lng = parseFloat(this.getAttribute('data-lng'));
                                    const name = this.getAttribute('data-name');

                                    // Check if we can add more destinations
                                    if (destinationCount >= maxDestinations) {
                                        showError(`Maximum of ${maxDestinations} destinations allowed`);
                                        return;
                                    }

                                    // Add the farm as a destination
                                    const index = addDestinationField({ lat: lat, lng: lng });

                                    // Update the input field with the farm name
                                    const inputs = document.querySelectorAll('.destination-input');
                                    if (inputs[index]) {
                                        inputs[index].value = name;
                                    }

                                    // Close the popup and remove the temporary marker
                                    tempMarker.closePopup();
                                    map.removeLayer(tempMarker);

                                    // Show success message
                                    showInfo(`Added ${name} to destinations`);
                                });
                            }
                        });
                    });

                    suggestionsContainer.appendChild(item);
                });

                suggestionsContainer.style.display = 'block';
            } else {
                suggestionsContainer.style.display = 'none';
            }
        });

        // Hide suggestions when clicking outside
        document.addEventListener('click', function (e) {
            if (!suggestionsContainer.contains(e.target) && e.target !== searchInput) {
                suggestionsContainer.style.display = 'none';
            }
        });

        // Add event listener for search function to support farm names
        searchInput.addEventListener('keydown', function (e) {
            if (e.key === 'Enter') {
                e.preventDefault();

                const query = this.value.trim();

                // Check if the query matches a farm name
                const matchingFarm = allFarms.find(farm =>
                    farm.name.toLowerCase() === query.toLowerCase()
                );

                if (matchingFarm) {
                    // If it's a farm, pan to it
                    map.setView([matchingFarm.lat, matchingFarm.lng], 15);

                    // Create a temporary marker as in the click handler above
                    // (This code is duplicated from above - could be refactored into a function)
                    const farmIcon = L.divIcon({
                        className: 'farm-suggestion-marker',
                        html: `
                            <div style="background-color: #27ae60; width: 10px; height: 10px; 
                                border-radius: 50%; border: 2px solid white; 
                                box-shadow: 0 1px 3px rgba(0,0,0,0.3);">
                            </div>
                        `,
                        iconSize: [14, 14],
                        iconAnchor: [7, 7]
                    });

                    const tempMarker = L.marker([matchingFarm.lat, matchingFarm.lng], {
                        icon: farmIcon
                    }).addTo(map);

                    // Create popup with Add to Destinations button
                    // (Again, duplicated code that could be refactored)
                    let popupContent = `
                        <div class="farm-popup">
                            <strong>Farm: ${matchingFarm.name}</strong><br>
                            Farm ID: ${matchingFarm.id}<br>
                    `;

                    if (matchingFarm.userId) {
                        popupContent += `User ID: ${matchingFarm.userId}<br>`;
                    }

                    if (matchingFarm.treeType) {
                        popupContent += `Tree Type: ${matchingFarm.treeType}<br>`;
                    }

                    popupContent += `Exhibit: ${matchingFarm.isExhibit ? 'Yes' : 'No'}<br><br>`;

                    popupContent += `
                        <button class="add-farm-destination" 
                            data-lat="${matchingFarm.lat}" 
                            data-lng="${matchingFarm.lng}" 
                            data-name="${matchingFarm.name}"
                            style="background-color: #3498db; color: white; border: none; 
                                border-radius: 4px; padding: 5px 10px; cursor: pointer; 
                                font-weight: bold;">
                            Add to Destinations
                        </button>
                    `;

                    popupContent += `</div>`;

                    const popup = L.popup().setContent(popupContent);
                    tempMarker.bindPopup(popup).openPopup();

                    // Add event listener for the Add to Destinations button
                    tempMarker.on('popupopen', function () {
                        const addButton = document.querySelector('.add-farm-destination');
                        if (addButton) {
                            addButton.addEventListener('click', function () {
                                const lat = parseFloat(this.getAttribute('data-lat'));
                                const lng = parseFloat(this.getAttribute('data-lng'));
                                const name = this.getAttribute('data-name');

                                if (destinationCount >= maxDestinations) {
                                    showError(`Maximum of ${maxDestinations} destinations allowed`);
                                    return;
                                }

                                const index = addDestinationField({ lat: lat, lng: lng });

                                const inputs = document.querySelectorAll('.destination-input');
                                if (inputs[index]) {
                                    inputs[index].value = name;
                                }

                                tempMarker.closePopup();
                                map.removeLayer(tempMarker);

                                showInfo(`Added ${name} to destinations`);
                            });
                        }
                    });

                    // Hide suggestions
                    suggestionsContainer.style.display = 'none';
                } else {
                    // If not a farm, use the original search function
                    searchLocation(query);
                    suggestionsContainer.style.display = 'none';
                }
            }
        });
    }
}

// Call the enhance function when the page is loaded
document.addEventListener('DOMContentLoaded', function () {
    // We need to wait a bit for the search control to be created
    setTimeout(enhanceSearchControl, 1000);
});

// Add a home button control to center on Enfarm Office
function addHomeButton() {
    // Create custom control
    const HomeButton = L.Control.extend({
        options: {
            position: 'topleft'
        },
        
        onAdd: function() {
            const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control');
            
            // Create button with home icon
            const button = L.DomUtil.create('a', 'home-button', container);
            button.href = '#';
            button.title = 'Return to Enfarm Office';
            button.innerHTML = '<span class="material-symbols-outlined">home</span>';
            
            // Style the button
            button.style.width = '34px';
            button.style.height = '34px';
            button.style.display = 'flex';
            button.style.alignItems = 'center';
            button.style.justifyContent = 'center';
            button.style.backgroundColor = 'white';
            button.style.color = '#000000';
            button.style.fontSize = '18px';
            
            // Add click event to center map on Enfarm Office
            L.DomEvent.on(button, 'click', function(e) {
                L.DomEvent.preventDefault(e);
                map.setView([12.690758, 108.0613203], 19);
                
                // Optional: Show a brief info message
                showInfo('Map centered on Enfarm Office');
            });
            
            // Prevent map click events from triggering
            L.DomEvent.disableClickPropagation(container);
            
            return container;
        }
    });
    
    // Add the control to the map
    map.addControl(new HomeButton());
}

// Call the function to add the home button
addHomeButton();