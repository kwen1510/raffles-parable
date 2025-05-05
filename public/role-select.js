// role-select.js
// localStorage.clear(); // Remove this line, allow storage to persist
let config = null;

async function loadConfig() {
  const response = await fetch('/api/game-config');
  config = await response.json();
}

// Replace the hardcoded roles array
let roles = [];

const roleBtns = document.querySelectorAll('.role-btn');
const sessionIdDisplay = document.getElementById('session-id-display');
const playerIdDisplay = document.getElementById('player-id-display');

// Load valid session IDs from JSON file
let validSessionIds = [];

// Function to validate session ID
async function loadValidSessionIds() {
  try {
    const response = await fetch('/session-ids.json');
    if (!response.ok) {
      throw new Error(`Failed to load session IDs: ${response.statusText}`);
    }
    validSessionIds = await response.json();
    console.log(`Loaded ${validSessionIds.length} valid session IDs`);
    return validSessionIds;
  } catch (error) {
    console.error('Error loading session IDs:', error);
    alert('Error loading session data. Please refresh the page.');
    return [];
  }
}

// Prompt for session ID with validation
async function promptForSessionId() {
  await loadValidSessionIds();
  
  let sessionId = '';
  let isValid = false;
  
  while (!isValid) {
    sessionId = prompt("Enter your session code (e.g., D1G01):", "");
    
    if (sessionId === null) { // Handle cancel button
      throw new Error("Session code entry cancelled."); 
    }
    
    if (validSessionIds.includes(sessionId)) {
      isValid = true;
    } else {
      alert(`Invalid session code. Please enter a valid code (e.g., D1G01, D2G03, etc.)`);
    }
  }
  
  return sessionId;
}

// Get player ID
function promptForPlayerId() {
  let playerId = '';
  while (!playerId) {
    playerId = prompt("Enter your unique player name or ID:");
    if (playerId === null) { // Handle cancel button
      throw new Error("Player ID entry cancelled.");
    }
    if (!playerId) {
      alert('Player ID cannot be empty.');
    }
  }
  return playerId;
}

// Use dynamic WebSocket URL for Glitch compatibility
function getWebSocketURL() {
  const wsProtocol = window.location.protocol === "https:" ? "wss" : "ws";
  const wsHost = window.location.host;
  return `${wsProtocol}://${wsHost}`;
}

// Initialize the page
async function initialize() {
  await loadConfig();
  roles = config.ROLES;
  // Get session ID and player ID
  try {
    const sessionId = await promptForSessionId();
    const playerId = promptForPlayerId();
    
    // Update the UI with session and player IDs
    sessionIdDisplay.textContent = sessionId;
    playerIdDisplay.textContent = playerId;
    
    // Set up role buttons
    roleBtns.forEach(btn => {
      btn.onclick = async function() {
        const role = btn.dataset.role;
        const buttonText = btn.textContent;
        btn.textContent = `Selecting...`;
        
        try {
          const res = await fetch('/api/claim-role', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionId, playerId, role })
          });
          
          if (!res.ok) {
            throw new Error(`Server error: ${res.statusText}`);
          }
          
          const data = await res.json();
          
          if (data.success) {
            btn.textContent = `✓ ${role}`;
            
            // Disable other buttons
            roleBtns.forEach(otherBtn => {
              if (otherBtn !== btn) {
                otherBtn.disabled = true;
                otherBtn.classList.add('taken');
              }
            });
            
            localStorage.setItem('sessionId', sessionId);
            localStorage.setItem('playerId', playerId);
            localStorage.setItem('role', role);
            
            setTimeout(() => {
              // Add URL parameters to pass sessionId, playerId, and role
              const params = new URLSearchParams();
              params.append('sessionId', sessionId);
              params.append('playerId', playerId);
              params.append('role', role);
              
              if (role === 'Leader') {
                window.location.href = `leader-dashboard.html?${params.toString()}`;
              } else {
                window.location.href = `team-dashboard.html?${params.toString()}`;
              }
            }, 1000);
          } else {
            btn.textContent = buttonText;
            alert(`Failed to select role: ${data.message || 'Role might be taken or player already claimed.'}`);
          }
        } catch (error) {
          console.error('Error claiming role:', error);
          btn.textContent = buttonText;
          alert(`Error: ${error.message}. Please check connection and try again.`);
        }
      };
    });
  } catch (error) {
    console.error('Initialization error:', error);
    alert(`Error: ${error.message}. Please refresh to try again.`);
  }
}

// Start the initialization process when the page loads
document.addEventListener('DOMContentLoaded', initialize); 