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
const maxDestinations = 5;
const colors = ['#3498db', '#e74c3c', '#2ecc71', '#f39c12', '#9b59b6'];
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
//const totalTimeEl = document.getElementById('total-time');
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
        showError('Maximum of 5 destinations allowed');
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
        createMarker: function() { return null; } // Don't create default markers
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
    routingControl.on('routesfound', function(e) {
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
    });
    
    routingControl.on('routingerror', function(e) {
        loadingIndicator.style.display = 'none';
        showError('Error calculating route: ' + e.error.message);
    });
}

// Add event listener for the checkbox
showDirectionArrowsCheckbox.addEventListener('change', function() {
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

// Function to format duration in hours and minutes
function formatDuration(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (hours > 0) {
        return `${hours} h ${minutes} min`;
    } else {
        return `${minutes} min`;
    }
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
        showError('Maximum of 5 destinations allowed');
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

// Function to make "You have arrived at your destination" text bold and add flag emoji
function styleArrivalInstructions() {
    // This function runs after the route is created and displayed
    setTimeout(() => {
        // Find all instruction cells in the routing table
        const instructionCells = document.querySelectorAll('.leaflet-routing-alt tr td:nth-child(2)');
        
        // Loop through each cell
        instructionCells.forEach(cell => {
            // Check if the text contains "You have arrived"
            if (cell.textContent.includes('You have arrived')) {
                // Add the flag emoji to the text
                cell.textContent = '🏳️ ' + cell.textContent;
                
                // Add the arrival-instruction class to this cell
                cell.classList.add('arrival-instruction');
            }
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
            input.placeholder = 'Search for a location or enter coordinates...';
            input.style.padding = '8px';
            input.style.width = '300px';
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
        map.setView([lat, lng], 15);

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
                showError('Maximum of 5 destinations allowed');
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
                    map.setView([lat, lng], 15);

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
                            showError('Maximum of 5 destinations allowed');
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
