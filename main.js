// main.js - Main application initialization and coordination

// Initialize the application when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', function() {
    // Load the CSS styles first
    loadStyles();
    
    // Initialize the modules in the correct order
    // First the map, then search, then routing
    initApplication();
});

// Load additional styles needed for the application
function loadStyles() {
    // Add custom CSS for the application
    const style = document.createElement('style');
    style.textContent = `
        /* Custom styles for the application */
        .permanent-tooltip {
            font-weight: bold;
            background-color: rgba(0, 0, 0, 0.7);
            border: none;
            color: white;
            padding: 5px 8px;
        }
        
        .instruction-row-interactive:hover {
            background-color: #f0f8ff;
            cursor: pointer;
        }
        
        .arrival-instruction {
            font-weight: bold;
            color: #27ae60;
        }
        
        .farm-popup {
            min-width: 200px;
        }
        
        .search-suggestions {
            z-index: 1000;
        }
        
        .copy-link-button {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            background-color: #34A853;
            color: white;
            border: none;
            border-radius: 4px;
            padding: 8px 16px;
            font-weight: bold;
            cursor: pointer;
            width: 100%;
        }
        
        .copy-link-button:hover {
            background-color: #2E9648;
        }
        
        .routing-close-btn {
            position: absolute;
            top: 10px;
            right: 10px;
            background: none;
            border: none;
            color: #555;
            cursor: pointer;
            z-index: 1000;
        }
        
        .routing-close-btn:hover {
            color: #000;
        }
        
        .basemap-button-container {
            display: flex;
            flex-direction: column;
            gap: 5px;
        }
        
        .basemap-button {
            background-color: white;
            border: 1px solid #ddd;
            padding: 8px 12px;
            border-radius: 4px;
            cursor: pointer;
            font-weight: bold;
            text-align: center;
        }
        
        .basemap-button.active {
            background-color: #f0f0f0;
            border-color: #aaa;
        }
        
        /* Define rules for various screen sizes */
        @media (max-width: 768px) {
            .leaflet-control input[type="text"] {
                width: 280px !important;
            }
        }
        
        @media (max-width: 480px) {
            .leaflet-control input[type="text"] {
                width: 220px !important;
            }
        }
    `;
    
    document.head.appendChild(style);
}

// Initialize the application modules
function initApplication() {
    console.log('Initializing route planner application...');
    
    // The modules will initialize themselves when their script files are loaded
    // Each module has its own DOMContentLoaded listener
    
    // Optional: We could add code here to check if Leaflet and other dependencies are loaded
    if (!window.L) {
        console.error('Leaflet library not loaded! Please check your dependencies.');
        displayErrorMessage('Failed to initialize map. Please reload the page.');
        return;
    }
    
    // Optional: We could execute any coordination logic between modules here
    console.log('Application initialization complete.');
}

// Helper function to display error messages
function displayErrorMessage(message) {
    // Create an error message element
    const errorDiv = document.createElement('div');
    errorDiv.style.backgroundColor = '#e74c3c';
    errorDiv.style.color = 'white';
    errorDiv.style.padding = '10px';
    errorDiv.style.position = 'fixed';
    errorDiv.style.top = '0';
    errorDiv.style.left = '0';
    errorDiv.style.right = '0';
    errorDiv.style.textAlign = 'center';
    errorDiv.style.zIndex = '10000';
    errorDiv.textContent = message;
    
    document.body.appendChild(errorDiv);
}