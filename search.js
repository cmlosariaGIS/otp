// search.js - Direct event handling approach for popups

// Global array to store farm data for searching
let allFarms = [];

// Global registry for popup markers and their data
let activeMarkers = new Map();
let markerCounter = 0;

// Initialize search functionality
function initSearch() {
    console.log("Initializing search functionality...");
    
    // Create search control
    createSearchControl();
    
    // Fetch farm data for search
    fetchFarmData();
    
    // Enhance search with farm search functionality
    setTimeout(enhanceSearchControl, 1500);
    
    // Add global click handler to document for delegated events
    document.addEventListener('click', handleGlobalClick);
}

// Global event handler for all button clicks
function handleGlobalClick(e) {
    // Handle "Add as destination" button click
    if (e.target && (e.target.classList.contains('add-destination-btn') || 
                     e.target.parentElement.classList.contains('add-destination-btn'))) {
        e.preventDefault();
        e.stopPropagation();
        
        // Get the button element (could be the target or its parent)
        const button = e.target.classList.contains('add-destination-btn') ? 
                     e.target : e.target.parentElement;
                     
        // Get the marker ID from the button
        const markerId = button.getAttribute('data-marker-id');
        console.log(`Button clicked for marker ID: ${markerId}`);
        
        if (markerId && activeMarkers.has(parseInt(markerId))) {
            const markerData = activeMarkers.get(parseInt(markerId));
            console.log('Marker data found:', markerData);
            
            // Check if we can add more destinations
            if (window.destinationCount >= window.maxDestinations) {
                showError(`Maximum of ${window.maxDestinations} destinations allowed`);
                return;
            }
            
            // Add the location as a destination
            const index = window.addDestinationField({ 
                lat: markerData.lat, 
                lng: markerData.lng 
            });
            
            // Update the input field with the location name
            const inputs = document.querySelectorAll('.destination-input');
            if (inputs[index]) {
                inputs[index].value = markerData.name;
            }
            
            // Remove the marker if it exists
            if (markerData.marker) {
                markerData.marker.closePopup();
                map.removeLayer(markerData.marker);
                activeMarkers.delete(parseInt(markerId));
            }
            
            // Show success message
            showInfo(`Added ${markerData.name} to destinations`);
        } else {
            console.error(`No marker data found for ID: ${markerId}`);
        }
    }
}

// Create the search control
function createSearchControl() {
    console.log("Creating search control...");
    
    // Create a custom control for search
    const searchControl = L.Control.extend({
        options: {
            position: 'topleft'
        },

        onAdd: function (map) {
            console.log("Adding search control to map...");
            
            const container = L.DomUtil.create('div', 'leaflet-control leaflet-search-control');
            container.style.marginBottom = '10px'; // Add some spacing

            const input = L.DomUtil.create('input', 'search-input', container);
            input.type = 'text';
            input.id = 'location-search-input';
            input.placeholder = 'Search for a customer farm, a location, or enter coordinates...';
            input.style.padding = '8px';
            input.style.width = '380px';
            input.style.border = '1px solid #ccc';
            input.style.borderRadius = '4px';
            input.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.1)';
            input.style.outline = 'none';
            input.style.fontSize = '12px';

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

    // Create the control instance
    const searchControlInstance = new searchControl();
    
    // Add the search control to the map
    if (typeof map !== 'undefined' && map) {
        console.log("Map is available, adding search control");
        map.addControl(searchControlInstance);
    } else {
        console.error("Map is not available! Cannot add search control.");
        // Try again after a delay to ensure map is initialized
        setTimeout(function() {
            if (typeof map !== 'undefined' && map) {
                console.log("Map is now available, adding search control");
                map.addControl(searchControlInstance);
            } else {
                console.error("Map is still not available after delay. Search control not added.");
            }
        }, 1000);
    }
}

// Function to fetch farm data for searching
function fetchFarmData() {
    // Only fetch if we don't already have the data
    if (allFarms.length === 0) {
        // Show loading indicator
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
                    allFarms = data.content.map(farm => ({
                        id: farm.farmid,
                        name: farm.farmname || `Farm ${farm.farmid}`,
                        lat: farm.lat,
                        lng: farm.long,
                        userId: farm.user_id,
                        treeType: farm.tree_type,
                        isExhibit: farm.is_exhibit
                    }));
                    console.log(`Loaded ${allFarms.length} farms for search`);
                } else {
                    showError('Invalid data received from API');
                }
            })
            .catch(error => {
                if (loadingIndicator) loadingIndicator.style.display = 'none';
                showError('Error fetching farm data: ' + error.message);
                console.error('Error fetching farm data:', error);
            });
    }
}

// Function to enhance the search control with farm search
function enhanceSearchControl() {
    console.log("Enhancing search control with farm search...");
    
    // Find the search input element
    const searchInput = document.querySelector('#location-search-input');
    
    if (searchInput) {
        console.log("Found search input, adding suggestions functionality");
        
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
        searchInput.addEventListener('input', function() {
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
                console.log(`Found ${filteredFarms.length} matching farms for "${query}"`);
                
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
                    item.addEventListener('mouseenter', function() {
                        this.style.backgroundColor = '#f0f0f0';
                    });
                    
                    item.addEventListener('mouseleave', function() {
                        this.style.backgroundColor = 'white';
                    });
                    
                    // Add click event to select this farm
                    item.addEventListener('click', function() {
                        // Set the search input value to the farm name
                        searchInput.value = farm.name;
                        
                        // Hide suggestions
                        suggestionsContainer.style.display = 'none';
                        
                        // Pan to the farm location
                        map.setView([farm.lat, farm.lng], 15);
                        
                        // Create a temporary marker for the farm
                        createTempMarker(farm.lat, farm.lng, farm.name, 'farm');
                    });
                    
                    suggestionsContainer.appendChild(item);
                });
                
                suggestionsContainer.style.display = 'block';
            } else {
                suggestionsContainer.style.display = 'none';
            }
        });
        
        // Hide suggestions when clicking outside
        document.addEventListener('click', function(e) {
            if (!suggestionsContainer.contains(e.target) && e.target !== searchInput) {
                suggestionsContainer.style.display = 'none';
            }
        });
        
        // Add event listener for search function to support farm names
        searchInput.addEventListener('keydown', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                
                const query = this.value.trim();
                
                // Check if the query matches a farm name
                const matchingFarm = allFarms.find(farm => 
                    farm.name.toLowerCase() === query.toLowerCase()
                );
                
                if (matchingFarm) {
                    // If it's a farm, pan to it and create a marker
                    map.setView([matchingFarm.lat, matchingFarm.lng], 15);
                    createTempMarker(matchingFarm.lat, matchingFarm.lng, matchingFarm.name, 'farm');
                    
                    // Hide suggestions
                    suggestionsContainer.style.display = 'none';
                } else {
                    // If not a farm, use the original search function
                    searchLocation(query);
                    suggestionsContainer.style.display = 'none';
                }
            }
        });
    } else {
        console.error("Could not find search input element to enhance!");
    }
}

// Create a temporary marker with popup
function createTempMarker(lat, lng, name, type = 'location') {
    console.log(`Creating temporary marker: ${name} (${lat}, ${lng})`);
    
    // Generate a unique ID for this marker
    const markerId = ++markerCounter;
    
    // Create icon based on type
    let icon;
    if (type === 'farm') {
        icon = L.divIcon({
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
    } else if (type === 'coords') {
        icon = L.divIcon({
            className: 'coord-marker',
            html: `
                <div style="background-color: #3498db; width: 10px; height: 10px; 
                    border-radius: 50%; border: 2px solid white; 
                    box-shadow: 0 1px 3px rgba(0,0,0,0.3);">
                </div>
            `,
            iconSize: [14, 14],
            iconAnchor: [7, 7]
        });
    } else {
        icon = L.divIcon({
            className: 'location-marker',
            html: `
                <div style="background-color: #e74c3c; width: 10px; height: 10px; 
                    border-radius: 50%; border: 2px solid white; 
                    box-shadow: 0 1px 3px rgba(0,0,0,0.3);">
                </div>
            `,
            iconSize: [14, 14],
            iconAnchor: [7, 7]
        });
    }
    
    // Create the marker
    const marker = L.marker([lat, lng], { icon }).addTo(map);
    
    // Store marker data for later reference
    activeMarkers.set(markerId, {
        id: markerId,
        lat: lat,
        lng: lng,
        name: name,
        type: type,
        marker: marker
    });
    
    // Create popup content with the unique marker ID
    const popupContent = `
        <div class="popup-content">
            <strong>${name}</strong><br><br>
            <button class="add-destination-btn" data-marker-id="${markerId}" 
                style="background-color: #3498db; color: white; border: none; 
                border-radius: 4px; padding: 5px 10px; cursor: pointer; 
                font-weight: bold; display: flex; align-items: center; gap: 5px;">
                <span style="font-size: 16px;">+</span> Add as destination
            </button>
        </div>
    `;
    
    // Create and bind popup
    const popup = L.popup().setContent(popupContent);
    marker.bindPopup(popup).openPopup();
    
    return marker;
}

// Function to search for a location
function searchLocation(searchText) {
    if (!searchText.trim()) return;

    console.log(`Searching for location: ${searchText}`);
    
    // Show loading indicator
    const loadingIndicator = document.getElementById('loading');
    if (loadingIndicator) loadingIndicator.style.display = 'block';

    // Check if it's a coordinate pair
    const coordPattern = /^[-+]?([1-8]?\d(\.\d+)?|90(\.0+)?),\s*[-+]?(180(\.0+)?|((1[0-7]\d)|([1-9]?\d))(\.\d+)?)$/;

    if (coordPattern.test(searchText)) {
        // It's coordinates
        console.log("Detected coordinates format");
        const [lat, lng] = searchText.split(',').map(coord => parseFloat(coord.trim()));

        // Pan the map to the coordinates
        map.setView([lat, lng], 15);

        // Create a temporary marker
        createTempMarker(lat, lng, `${lat}, ${lng}`, 'coords');

        if (loadingIndicator) loadingIndicator.style.display = 'none';
    } else {
        // Use Nominatim for geocoding
        console.log("Using Nominatim geocoding for address search");
        fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchText)}`)
            .then(response => response.json())
            .then(data => {
                if (loadingIndicator) loadingIndicator.style.display = 'none';

                if (data && data.length > 0) {
                    const result = data[0];
                    const lat = parseFloat(result.lat);
                    const lng = parseFloat(result.lon);
                    console.log(`Found location: ${result.display_name} (${lat}, ${lng})`);

                    // Pan the map to the result
                    map.setView([lat, lng], 15);

                    // Create a temporary marker
                    createTempMarker(lat, lng, result.display_name, 'location');
                } else {
                    console.log(`No results found for: ${searchText}`);
                    showError(`Could not find location: ${searchText}`);
                }
            })
            .catch(error => {
                if (loadingIndicator) loadingIndicator.style.display = 'none';
                console.error('Error geocoding:', error);
                showError('Error geocoding location: ' + error.message);
            });
    }
}

// Export functions for use in other modules
window.fetchFarmData = fetchFarmData;
window.searchLocation = searchLocation;
window.createTempMarker = createTempMarker;

// Initialize search on DOM ready
document.addEventListener('DOMContentLoaded', function() {
    console.log("DOM fully loaded, initializing search functionality");
    initSearch();
});