// routing.js - Route planning functionality module

// Constants
const maxDestinations = 8;
const colors = ['#3498db', '#e74c3c', '#2ecc71', '#f39c12', '#9b59b6', '#1abc9c', '#e67e22', '#34495e'];

// State variables
let markers = [];
let routingControl = null;
let destinationCount = 0;
let showDirectionArrows = true;

// DOM elements (references cached for performance)
let destinationsContainer;
let addDestinationBtn;
let calculateRouteBtn;
let clearAllBtn;
let loadingIndicator;
let errorMessage;
let resultsSection;
let destinationsList;
let totalDistanceEl;
let showDirectionArrowsCheckbox;

// Window globals to maintain state
window.routeCoordinates = null;
window.currentDecorator = null;
window.invisibleRouteLine = null;
window.arrowAnimation = null;
window.progressLine = null;
window.glowLine = null;
window.shadowLine = null;

// Initialize routing functionality
function initRouting() {
    // Add destination input styles
    addDestinationInputStyles();
    
    // Cache DOM elements
    destinationsContainer = document.getElementById('destinations-container');
    addDestinationBtn = document.getElementById('add-destination');
    calculateRouteBtn = document.getElementById('calculate-route');
    clearAllBtn = document.getElementById('clear-all');
    loadingIndicator = document.getElementById('loading');
    errorMessage = document.getElementById('error-message');
    resultsSection = document.getElementById('results');
    destinationsList = document.getElementById('destinations-list');
    totalDistanceEl = document.getElementById('total-distance');
    showDirectionArrowsCheckbox = document.getElementById('show-direction-arrows');
    
    // Add event listeners
    addDestinationBtn.addEventListener('click', function() {
        addDestinationField(); // Call without coordinates to add an empty field
    });
    calculateRouteBtn.addEventListener('click', calculateRoute);
    clearAllBtn.addEventListener('click', clearAll);
    
    // Enable click-to-add-destination functionality
    map.on('click', onMapClick);
    
    // Add event listener for the show direction arrows checkbox
    showDirectionArrowsCheckbox.addEventListener('change', function() {
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
    
    // Ensure farm data is loaded for search functionality
    ensureFarmDataLoaded();
    
    // Add initial destination with Enfarm Office
    addDestinationField();
}

// Add some CSS styles for the destination input
function addDestinationInputStyles() {
    // Create style element if it doesn't exist
    if (!document.getElementById('destination-input-styles')) {
        const styleEl = document.createElement('style');
        styleEl.id = 'destination-input-styles';
        styleEl.textContent = `
            .destination-controls {
                display: flex;
                align-items: center;
                gap: 5px;
                width: 100%;
            }
            
            .destination-input-wrapper {
                position: relative;
                flex-grow: 1;
            }
            
            .destination-input {
                width: 100%;
                padding: 8px;
                border: 1px solid #ccc;
                border-radius: 4px;
                font-size: 14px;
            }
            
            .destination-input:focus {
                border-color: #3498db;
                outline: none;
                box-shadow: 0 0 0 2px rgba(52, 152, 219, 0.2);
            }
            
            .farm-suggestions {
                border-top: none;
                border-top-left-radius: 0;
                border-top-right-radius: 0;
            }
            
            .suggestion-item:hover {
                background-color: #f0f0f0;
            }
            
            .suggestion-item:last-child {
                border-bottom: none;
            }
            
            .btn-geocode, .btn-remove {
                padding: 8px 12px;
                border: none;
                border-radius: 4px;
                cursor: pointer;
                font-weight: bold;
            }
            
            .btn-geocode {
                background-color: #3498db;
                color: white;
            }
            
            .btn-remove {
                background-color: #e74c3c;
                color: white;
            }
        `;
        document.head.appendChild(styleEl);
    }
}

// Function to get the display label for a destination
function getDestinationLabel(index) {
    if (index === 0) {
        return "Origin";
    } else {
        return `Destination ${index}`;
    }
}

// Function to add a destination input field with enhanced search capabilities
function addDestinationField(latLng = null) {
    if (destinationCount >= maxDestinations) {
        showError('Maximum of 8 destinations allowed');
        return;
    }

    const index = destinationCount;
    const color = colors[index];

    const destinationDiv = document.createElement('div');
    destinationDiv.className = 'input-group';
    destinationDiv.dataset.index = index;

    let placeholderText = "Enter location, farm name or coordinates";
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
        inputValue = ENFARM_OFFICE.name;
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
            <div class="destination-input-wrapper" style="position: relative; flex-grow: 1;">
                <input type="text" class="destination-input" placeholder="${placeholderText}" value="${inputValue}" autocomplete="off">
                <div class="farm-suggestions" style="display: none; position: absolute; width: 100%; max-height: 200px; overflow-y: auto; z-index: 1000; background: white; border: 1px solid #ccc; border-radius: 0 0 4px 4px; box-shadow: 0 2px 4px rgba(0,0,0,0.2);"></div>
            </div>
            <button type="button" class="btn-geocode" data-index="${index}">Go</button>
            <button type="button" class="btn-remove" data-index="${index}">×</button>
        </div>
    `;

    destinationDiv.innerHTML = inputHtml;
    destinationsContainer.appendChild(destinationDiv);

    // Add event listener to remove button
    const removeBtn = destinationDiv.querySelector('.btn-remove');
    if (removeBtn) {
        removeBtn.addEventListener('click', function() {
            removeDestination(this.dataset.index);
        });
    }

    // Add event listeners for input field
    const input = destinationDiv.querySelector('input');
    const suggestionsContainer = destinationDiv.querySelector('.farm-suggestions');
    const geocodeBtn = destinationDiv.querySelector('.btn-geocode');

    // Listen for input changes to show farm suggestions
    // Updated farm suggestions section in the addDestinationField function

// Listen for input changes to show farm suggestions
input.addEventListener('input', function() {
    const query = this.value.trim().toLowerCase();
    
    // Clear suggestions
    suggestionsContainer.innerHTML = '';
    
    // If query is empty or too short, hide suggestions
    if (query.length < 2) {
        suggestionsContainer.style.display = 'none';
        return;
    }
    
    // Make sure farm data is loaded
    if (!window.allFarms || window.allFarms.length === 0) {
        // Show loading message while we load farm data
        suggestionsContainer.innerHTML = `
            <div style="padding: 10px; text-align: center; color: #777;">
                Loading farm data...
            </div>
        `;
        suggestionsContainer.style.display = 'block';
        suggestionsContainer.style.border = '1px solid #ccc';
        suggestionsContainer.style.borderTop = 'none';
        suggestionsContainer.style.marginTop = '-1px';
        
        // Call the fetch function
        ensureFarmDataLoaded();
        
        // Listen for farm data loaded event to update suggestions
        document.addEventListener('farmDataLoaded', function updateSuggestions() {
            // Remove this event listener since it's a one-time operation
            document.removeEventListener('farmDataLoaded', updateSuggestions);
            
            // Re-trigger the input event to show suggestions now that data is loaded
            input.dispatchEvent(new Event('input'));
        });
        
        return;
    }
    
    // Filter farms by name
    const filteredFarms = window.allFarms.filter(farm => 
        farm.name.toLowerCase().includes(query)
    );
    
    // Show suggestions if we have any
    if (filteredFarms.length > 0) {
        console.log(`Found ${filteredFarms.length} matching farms for "${query}"`);
        
        // Add a heading for farm suggestions
        const heading = document.createElement('div');
        heading.className = 'suggestions-heading';
        heading.textContent = 'Farms matching your search:';
        heading.style.padding = '8px 12px';
        heading.style.fontWeight = 'bold';
        heading.style.backgroundColor = '#f5f5f5';
        heading.style.borderBottom = '1px solid #ddd';
        heading.style.color = '#555';
        heading.style.fontSize = '12px';
        heading.style.borderRadius = '4px 4px 0 0';
        suggestionsContainer.appendChild(heading);
        
        // Create suggestion items
        filteredFarms.slice(0, 10).forEach(farm => {
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
            item.addEventListener('mouseenter', function() {
                this.style.backgroundColor = '#f0f0f0';
            });
            
            item.addEventListener('mouseleave', function() {
                this.style.backgroundColor = 'white';
            });
            
            // Add click event to select this farm
            item.addEventListener('click', function() {
                // Set the input value to the farm name
                input.value = farm.name;
                
                // Hide suggestions
                suggestionsContainer.style.display = 'none';
                
                // Add the farm as a marker
                addMarker(farm.lat, farm.lng, index);
            });
            
            suggestionsContainer.appendChild(item);
        });
        
        // Add "more results" message if needed
        if (filteredFarms.length > 10) {
            const moreResults = document.createElement('div');
            moreResults.className = 'more-results';
            moreResults.textContent = `+ ${filteredFarms.length - 10} more farms match your search`;
            moreResults.style.padding = '8px 12px';
            moreResults.style.fontSize = '12px';
            moreResults.style.color = '#777';
            moreResults.style.backgroundColor = '#f9f9f9';
            moreResults.style.borderTop = '1px solid #eee';
            moreResults.style.borderRadius = '0 0 4px 4px';
            suggestionsContainer.appendChild(moreResults);
        }
        
        // Update styling for the suggestions container
        suggestionsContainer.style.display = 'block';
        suggestionsContainer.style.border = '1px solid #ccc';
        suggestionsContainer.style.borderTop = 'none';
        suggestionsContainer.style.marginTop = '-1px';
    } else {
        // Show a "no results" message when there are no matches
        const noResults = document.createElement('div');
        noResults.className = 'no-results';
        noResults.innerHTML = `
            <div style="padding: 10px; text-align: center; color: #777;">
                No farms found matching "<strong>${query}</strong>"
                <div style="font-size: 12px; margin-top: 5px;">Try different keywords or use the Go button to search for a location</div>
            </div>
        `;
        suggestionsContainer.appendChild(noResults);
        suggestionsContainer.style.display = 'block';
        suggestionsContainer.style.border = '1px solid #ccc';
        suggestionsContainer.style.borderTop = 'none';
        suggestionsContainer.style.marginTop = '-1px';
    }
});


    
    // Hide suggestions when clicking outside the input
    document.addEventListener('click', function(e) {
        if (!input.contains(e.target) && !suggestionsContainer.contains(e.target)) {
            suggestionsContainer.style.display = 'none';
        }
    });

    // Listen for Enter key
    input.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            // Hide suggestions
            suggestionsContainer.style.display = 'none';
            
            // Check if the value matches a farm name
            if (window.allFarms && window.allFarms.length > 0) {
                const query = this.value.trim();
                const matchingFarm = window.allFarms.find(farm => 
                    farm.name.toLowerCase() === query.toLowerCase()
                );
                
                if (matchingFarm) {
                    // If it's a farm, add it as a marker
                    addMarker(matchingFarm.lat, matchingFarm.lng, index);
                    return;
                }
            }
            
            // If not a farm, geocode it
            geocodeLocation(this.value, index);
        }
    });

    // Listen for geocode button click
    geocodeBtn.addEventListener('click', function() {
        // Hide suggestions
        suggestionsContainer.style.display = 'none';
        
        // Check if the value matches a farm name
        if (window.allFarms && window.allFarms.length > 0) {
            const query = input.value.trim();
            const matchingFarm = window.allFarms.find(farm => 
                farm.name.toLowerCase() === query.toLowerCase()
            );
            
            if (matchingFarm) {
                // If it's a farm, add it as a marker
                addMarker(matchingFarm.lat, matchingFarm.lng, index);
                return;
            }
        }
        
        // If not a farm, geocode it
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
    } else if (index === 0 && inputValue === ENFARM_OFFICE.name) {
        // If it's the first destination with Enfarm Office, add the marker
        addMarker(ENFARM_OFFICE.lat, ENFARM_OFFICE.lng, index);
    }

    // Ensure farm data is loaded
    if (typeof window.fetchFarmData === 'function' && (!window.allFarms || window.allFarms.length === 0)) {
        window.fetchFarmData();
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
    if (index === 0 && lat === ENFARM_OFFICE.lat && lng === ENFARM_OFFICE.lng) {
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
    if (index === 0 && lat === ENFARM_OFFICE.lat && lng === ENFARM_OFFICE.lng) {
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
        createMarker: function() { return null; }, // Don't create default markers
        
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
        
        // Start the route progression animation instead of showing the entire route at once
        animateRouteProgression(route.coordinates);
        
        // Add a close button to the routing panel
        addCloseButtonToRoutingPanel();
    });
    
    routingControl.on('routingerror', function(e) {
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
            closeButton.addEventListener('click', function() {
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
            row.addEventListener('click', function() {
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

// Function to animate the route progression
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
    
    // Add Copy Link button after the destinations list
    addGoogleMapsButton(waypoints);
}

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
        copyButton.addEventListener('click', function() {
            // Copy the URL to clipboard
            if (copyTextToClipboard(googleMapsUrl)) {
                showCopySuccess();
            }
        });
        
        // Add button to container
        buttonContainer.appendChild(copyButton);
        
        // Add container to results section
        resultsSection.appendChild(buttonContainer);
    }
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

// Function to handle map clicks for adding destinations
function onMapClick(e) {
    // If we've already reached max destinations, show error
    if (destinationCount >= maxDestinations) {
        showError('Maximum of 8 destinations allowed');
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

// Export functions for use in other modules
window.addDestinationField = addDestinationField;
window.destinationCount = destinationCount;
window.maxDestinations = maxDestinations;
window.markers = markers;

// Initialize routing on DOM ready
document.addEventListener('DOMContentLoaded', function() {
    // Wait a moment for the map to initialize
    setTimeout(initRouting, 500);
});


function ensureFarmDataLoaded() {
    // Only load if we don't already have the data
    if (!window.allFarms || window.allFarms.length === 0) {
        console.log("Farm data not loaded, fetching now...");
        
        // Show a loading message
        const loadingIndicator = document.getElementById('loading');
        if (loadingIndicator) loadingIndicator.style.display = 'block';
        
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
                if (loadingIndicator) loadingIndicator.style.display = 'none';
                
                // Check if we got valid data
                if (data && Array.isArray(data.content)) {
                    // Store all farm data for searching
                    window.allFarms = data.content.map(farm => ({
                        id: farm.farmid,
                        name: farm.farmname || `Farm ${farm.farmid}`,
                        lat: farm.lat,
                        lng: farm.long,
                        userId: farm.user_id,
                        treeType: farm.tree_type,
                        isExhibit: farm.is_exhibit
                    }));
                    console.log(`Loaded ${window.allFarms.length} farms for search`);
                    
                    // Dispatch a custom event to notify that farm data is loaded
                    const event = new CustomEvent('farmDataLoaded');
                    document.dispatchEvent(event);
                } else {
                    showError('Invalid data received from API');
                }
            })
            .catch(error => {
                if (loadingIndicator) loadingIndicator.style.display = 'none';
                showError('Error fetching farm data: ' + error.message);
                console.error('Error fetching farm data:', error);
            });
    } else {
        console.log(`Farm data already loaded (${window.allFarms.length} farms)`);
        return Promise.resolve(window.allFarms);
    }
}