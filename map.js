// map.js - Core map functionality with fixes

// Global map object that will be accessible to other modules
let map;

// Define Enfarm Office location
const ENFARM_OFFICE = {
    lat: 12.690758005394018,
    lng: 108.06132029871573,
    name: "enfarm Store/Office Dak Lak"
};

// Farm display variables
let farmMarkers = [];
let farmLayerGroup = null;
let farmsVisible = false;

// Initialize the map and core functionality
function initMap() {
    console.log("Initializing map...");
    
    // Create the map centered on Enfarm Office
    map = L.map('map').setView([ENFARM_OFFICE.lat, ENFARM_OFFICE.lng], 13);
    
    // Make map globally available immediately
    window.map = map;
    
    // Add basemap controls 
    createBasemapControl();
    
    // Add home button
    addHomeButton();
    
    // Add farm toggle button
    addFarmToggleButton();
    
    console.log("Map initialization complete");
}

// Create the basemap control with different map options
function createBasemapControl() {
    console.log("Creating basemap control...");
    
    // Define the basemap layers
    const basemaps = {
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

    // Set the default layer
    basemaps['Google Satellite'].addTo(map);

    // Create a custom control for basemap selection
    const BasemapControl = L.Control.extend({
        options: {
            position: 'bottomleft'
        },

        onAdd: function (map) {
            const container = L.DomUtil.create('div', 'basemap-control');
            const buttonContainer = L.DomUtil.create('div', 'basemap-button-container', container);

            // Add a style for the active button with light blue background
            const style = document.createElement('style');
            style.textContent = `
                .basemap-button.active {
                    background-color: #3498db !important; /* Light blue color */
                    color: white !important;
                    border-color: #2980b9 !important;
                    box-shadow: 0 1px 3px rgba(0,0,0,0.2) !important;
                }
            `;
            document.head.appendChild(style);

            // Create buttons for each basemap
            for (const [name, layer] of Object.entries(basemaps)) {
                const button = L.DomUtil.create('button', 'basemap-button', buttonContainer);
                button.textContent = name;
                
                // Style the button
                button.style.backgroundColor = 'white';
                button.style.color = '#333';
                button.style.border = '1px solid #ddd';
                button.style.padding = '8px 12px';
                button.style.margin = '0 0 5px 0';
                button.style.borderRadius = '4px';
                button.style.cursor = 'pointer';
                button.style.fontWeight = 'bold';
                button.style.textAlign = 'center';
                button.style.width = '100%';
                button.style.transition = 'all 0.2s ease';

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
    map.addControl(new BasemapControl());
}

// Add a home button control to center on Enfarm Office
function addHomeButton() {
    console.log("Adding home button...");
    
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
            button.style.color = '#3498db';
            button.style.fontSize = '18px';
            
            // Add click event to center map on Enfarm Office
            L.DomEvent.on(button, 'click', function(e) {
                L.DomEvent.preventDefault(e);
                map.setView([ENFARM_OFFICE.lat, ENFARM_OFFICE.lng], 13);
                
                // Show a brief info message
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

// Add farm toggle button
function addFarmToggleButton() {
    console.log("Adding farm toggle button...");
    
    // Create toggle control
    const FarmToggleControl = L.Control.extend({
        options: {
            position: 'topright'
        },
        
        onAdd: function() {
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
            button.style.color = 'gray';
            button.style.fontWeight = 'bold';
            button.style.textDecoration = 'none';
            button.style.borderRadius = '10px';
            button.style.textAlign = 'center';
            button.style.minWidth = '100px';
            //button.style.boxShadow = '0 2px px rgba(0,0,0,0.2)'; // Added drop shadow
            button.style.border = '1px solid #ddd'; // Light border for better definition
            button.style.margin = '-3px'; // Small margin for better spacing
            
            // Add spacing between icon and text
            const iconStyle = document.createElement('style');
            iconStyle.innerHTML = `
                .farm-toggle-button .material-symbols-outlined {
                    margin-right: 6px;
                    font-size: 18px;
                    vertical-align: middle;
                }
                
                /* Style for when farms are visible */
                .farm-toggle-button.active {
                    background-color: #27ae60 !important;
                    color: white !important;
                    border-color: #219652 !important;
                }
            `;
            document.head.appendChild(iconStyle);
            
            // Toggle farm locations when clicked
            L.DomEvent.on(button, 'click', function(e) {
                L.DomEvent.preventDefault(e);
                fetchAndDisplayFarmLocations();
                
                // Toggle active class for styling
                if (farmsVisible) {
                    button.classList.add('active');
                } else {
                    button.classList.remove('active');
                }
            });
            
            // Prevent map click events from being triggered
            L.DomEvent.disableClickPropagation(container);
            
            return container;
        }
    });
    
    // Add the control to the map
    map.addControl(new FarmToggleControl());
}

// Update farm toggle button text based on visibility state
function updateFarmToggleButton() {
    const toggleButton = document.querySelector('.farm-toggle-button');
    if (toggleButton) {
        if (farmsVisible) {
            toggleButton.innerHTML = `<span class="material-symbols-outlined">visibility_off</span> Hide Farms`;
            toggleButton.classList.add('active');
        } else {
            toggleButton.innerHTML = `<span class="material-symbols-outlined">visibility</span> Show Farms`;
            toggleButton.classList.remove('active');
        }
    }
}

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
            if (loadingIndicator) loadingIndicator.style.display = 'none';
            
            if (data && Array.isArray(data.content)) {
                addFarmLocationMarkers(data.content);
                farmsVisible = true;
                updateFarmToggleButton();
            } else {
                showError('Invalid data received from API');
            }
        })
        .catch(error => {
            if (loadingIndicator) loadingIndicator.style.display = 'none';
            showError('Error fetching farm locations: ' + error.message);
            console.error('Error fetching farm locations:', error);
        });
}

// Function to add markers for farm locations
function addFarmLocationMarkers(locations) {
    // Clear any existing farm markers
    clearFarmMarkers();
    
    // Create a marker group to hold all farm markers
    farmLayerGroup = L.layerGroup();
    
    // Create custom icon for farm locations with glowing effect
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
            // Process farm data into standard format
            const farm = {
                id: location.farmid,
                name: location.farmname || `Farm ${location.farmid}`,
                lat: location.lat,
                lng: location.long,
                userId: location.user_id,
                treeType: location.tree_type,
                //isExhibit: location.is_exhibit
            };
            
            // Create marker
            const marker = L.marker([farm.lat, farm.lng], {
                icon: farmIcon
            });
            
            // Create popup content
            const popupContent = createFarmPopupContent(farm);
            
            // Create popup with custom content
            const popup = L.popup().setContent(popupContent);
            
            // Bind popup to marker
            marker.bindPopup(popup);
            
            // Add popup open event to attach button listener
            marker.on('popupopen', function() {
                // Find the button in the popup
                const addButton = document.querySelector('.add-farm-destination');
                if (addButton) {
                    // Add click event listener
                    addButton.addEventListener('click', function() {
                        handleAddFarmToDestinations(this, null);
                    });
                }
            });
            
            // Add tooltip with name
            if (farm.name) {
                marker.bindTooltip(`Farm: ${farm.name}`);
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

// Helper function to create popup content for a farm
function createFarmPopupContent(farm) {
    let popupContent = `<div class="farm-popup">`;
    
    // Add farm name if available
    if (farm.name) {
        popupContent += `<strong>Farm: ${farm.name}</strong><br>`;
    }
    
    // Add farm ID
    popupContent += `Farm ID: ${farm.id}<br>`;
    
    // Add user ID if available
    //if (farm.userId) {
      //  popupContent += `User ID: ${farm.userId}<br>`;
    //}
    
    // Add tree type if available
    if (farm.treeType) {
        popupContent += `Tree Type: ${farm.treeType}<br>`;
    }
    
    // Add exhibit status
    //popupContent += `Exhibit: ${farm.isExhibit ? 'Yes' : 'No'}<br><br>`;
    
    // Add button to add farm as a destination with plus sign
    popupContent += `<button class="add-farm-destination" 
        data-lat="${farm.lat}" 
        data-lng="${farm.lng}" 
        data-name="${farm.name}"
        style="background-color: #3498db; color: white; border: none; border-radius: 4px; padding: 5px 10px; cursor: pointer; font-weight: bold; display: flex; align-items: center; gap: 5px;">
        <span style="font-size: 16px;">+</span> Add to Destinations
    </button>`;
    
    popupContent += `</div>`;
    
    return popupContent;
}

// Function to handle clicking "Add to Destinations" button
function handleAddFarmToDestinations(button, tempMarker = null) {
    // Get farm data from button attributes
    const lat = parseFloat(button.getAttribute('data-lat'));
    const lng = parseFloat(button.getAttribute('data-lng'));
    const name = button.getAttribute('data-name');
    
    // Check if we can add more destinations
    if (window.destinationCount >= window.maxDestinations) {
        showError(`Maximum of ${window.maxDestinations} destinations allowed`);
        return;
    }
    
    // Add the farm as a destination - calls function from routing.js
    const index = window.addDestinationField({ lat: lat, lng: lng });
    
    // Update the input field with the farm name
    const inputs = document.querySelectorAll('.destination-input');
    if (inputs[index]) {
        inputs[index].value = name;
    }
    
    // Close the popup and remove the temporary marker if it exists
    if (tempMarker) {
        tempMarker.closePopup();
        map.removeLayer(tempMarker);
    }
    
    // Show success message
    showInfo(`Added ${name} to destinations`);
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

// Function to show info messages
function showInfo(message) {
    const infoEl = document.createElement('div');
    infoEl.className = 'info-message';
    infoEl.textContent = message;
    infoEl.style.position = 'absolute';
    infoEl.style.bottom = '20px';
    infoEl.style.left = '50%';
    infoEl.style.transform = 'translateX(-50%)';
    infoEl.style.backgroundColor = 'rgba(39, 174, 96, 0.9)';
    infoEl.style.color = 'white';
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

// Function to show error messages
function showError(message) {
    // Get the error message element
    const errorMessage = document.getElementById('error-message');
    
    if (errorMessage) {
        errorMessage.textContent = message;
        errorMessage.style.display = 'block';
        
        // Hide loading indicator if it's showing
        const loadingIndicator = document.getElementById('loading');
        if (loadingIndicator) {
            loadingIndicator.style.display = 'none';
        }
        
        // Hide after 5 seconds
        setTimeout(() => {
            errorMessage.style.display = 'none';
        }, 5000);
    } else {
        // Fallback if error element doesn't exist
        console.error(message);
        alert(message);
    }
}

// Export functions and variables that need to be accessible from other modules
window.map = map;
window.ENFARM_OFFICE = ENFARM_OFFICE;
window.showInfo = showInfo;
window.showError = showError;
window.createFarmPopupContent = createFarmPopupContent;
window.handleAddFarmToDestinations = handleAddFarmToDestinations;

// Initialize the map when the DOM is fully loaded - initialize immediately
document.addEventListener('DOMContentLoaded', function() {
    console.log("DOM fully loaded, initializing map...");
    initMap();
});