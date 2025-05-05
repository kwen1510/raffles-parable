// Clear sessionStorage on load to reset reflection submission state for testing
sessionStorage.clear();

// --- Team Dashboard Demo ---
// This file assumes the HTML structure is similar to leader-dashboard-demo.html but without grid, pickup/inject, or start game button.
// Only reflection input is enabled; all other info is read-only and synced from the leader via WebSocket.

// Team dashboard initialization

const itemNames = { W: 'Wood', M: 'Metal', F: 'Feathers', S: 'Stardust' };
const itemEmojis = { W: '🪵', M: '🔩', F: '🪶', S: '✨' };
const itemCodes = Object.keys(itemNames);

let roleSpecificElderChewMessages = [];
let introductoryMessage = "Awaiting role assignment...";
let logEntries = [];
let roundNum = 1;
let sessionEndTime = null; // Stores end timestamp received from server
let roundEndTime = null;   // Stores end timestamp received from server
let timerInterval = null;
let reflectionSubmitted = false;
let reflectionSubmittedThisRound = false;
let teamRoundHistory = [];
let lastRoundNum = null; // Track last roundNum from server
let inventory = { W: 0, M: 0, F: 0, S: 0 };

const reflectionArea = document.getElementById('reflection-area');
const reflectionBtn = document.getElementById('submit-reflection');

// --- WebSocket Integration ---
const urlParams = new URLSearchParams(window.location.search);
const sessionId = urlParams.get('sessionId'); // Must be provided via URL
let playerId = urlParams.get('playerId'); // Must be provided via URL
const role = urlParams.get('role') || 'Warrior'; // Fallback to Warrior role if not specified

// Session parameters loaded

let ws = new WebSocket('ws://localhost:8080');

// Add necessary constants (copy from leader)
let N = 5; // Grid size - will be updated from server
const PLAYER = '🧑‍🚀'; // Use the same player emoji
const ITEM_EMOJI = { S: '✨', F: '🪶', W: '🪵', M: '🔩' }; // Use same item emojis

// Add state variables for map
let itemsGrid = {};
let visited = new Set();
let curr = null;
// N is defined above

// Add grid element reference
let gridEl; // Will be assigned in initialize

// Add necessary variables at the top level if they don't exist
let sessionStartTime = null;
let roundDuration = 60; // Default or get from server
let totalRounds = 8; // Default or get from server
let currentRoundNumber = 1;

// --- Timer constants ---
const SESSION_DURATION = 120; // 2 minutes in seconds
const ROUND_DURATION = 15; // 15 seconds per round
const TOTAL_ROUNDS = 8;

let config = null;
async function loadConfig() {
  const response = await fetch('/api/game-config');
  config = await response.json();
}

// Load Elder Chew's role-specific messages
async function loadElderChewMessages() {
    if (!role) {
        console.error("Cannot load elder chew messages, role not yet assigned.");
        return;
    }
    
    try {
        // First, load the intro message
        const introResponse = await fetch(`/text/role-introductions.json`);
        if (!introResponse.ok) throw new Error(`HTTP error for intro: ${introResponse.status}`);
        const intros = await introResponse.json();
        introductoryMessage = intros[role] || "Follow the leader's path!";
        
        // Then load the role-specific round messages
        const messagesResponse = await fetch(`/text/elder-chew-${role.toLowerCase()}.json`);
        if (!messagesResponse.ok) throw new Error(`HTTP error for messages: ${messagesResponse.status}`);
        roleSpecificElderChewMessages = await messagesResponse.json();
        
        // Display initial message and log it
        updateObjectiveBox();
        logEntries.push(`Elder Chew: ${introductoryMessage}`);
        
        renderLog();
    } catch (error) {
        console.error('Error loading role-specific messages:', error);
        introductoryMessage = "Error loading guidance...";
        updateObjectiveBox();
    }
}

// Function removed - Elder Chew messages now appear only in the chat

ws.onopen = () => {
    // Send registration message immediately
    ws.send(JSON.stringify({
        sessionId,
        type: 'register',
        payload: { playerId, role } // Include role for server logging/state
    }));
    
    // Load role-specific messages
    loadElderChewMessages();
};

ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);

    let updateNeeded = false;
    let newState = null;
    let mapUpdateNeeded = false;

    if (msg.payload && msg.payload.state) {
        newState = msg.payload.state;
        updateNeeded = true;
        // Update state variables directly
        if (newState.sessionStartTime) {
            sessionStartTime = newState.sessionStartTime;
        }
        if (newState.N) {
            // Update grid size from server data
            N = newState.N;
        }
        if (newState.roundDuration) roundDuration = newState.roundDuration;
        if (newState.totalRounds) totalRounds = newState.totalRounds;
        if (newState.inventory) inventory = { ...newState.inventory };
        if (newState.itemsGrid) {
            itemsGrid = newState.itemsGrid;
            mapUpdateNeeded = true;
        }
        if (newState.visited) {
             visited = new Set(newState.visited);
             mapUpdateNeeded = true;
        }
        if (newState.curr) {
             curr = newState.curr;
             mapUpdateNeeded = true;
        }
        if (typeof newState.roundNum === 'number') {
             const newRoundNum = Math.min(newState.roundNum, totalRounds);
             if (newRoundNum > currentRoundNumber) { // Use currentRoundNumber for visual sync
                 // Handle new round transition
                 currentRoundNumber = newRoundNum;
                 reflectionSubmittedThisRound = false;
                 if(reflectionArea) reflectionArea.disabled = false;
                 if(reflectionBtn) reflectionBtn.disabled = false;
                 
                 // Add round separator
                 logEntries.push(`--- Round ${currentRoundNumber} ---`);
                 
                 // Always add Elder Chew message for the round
                 if (roleSpecificElderChewMessages && roleSpecificElderChewMessages.length > 0) {
                     // Use round number to select message deterministically
                     const index = (currentRoundNumber - 1) % roleSpecificElderChewMessages.length;
                     const message = roleSpecificElderChewMessages[index];
                     logEntries.push(`Elder Chew: ${message}`);
                     
                     // Don't show popup, just add to chat log
                 }
                 
                 roundNum = newRoundNum;
                 renderLog();
             }
        }
    }

    switch (msg.type) {
        case 'session-start':
        case 'session-started': // Add this case to match the actual message type
            if (gridEl) {
                gridEl.style.display = 'grid'; 
            } else {
                console.error('Grid element not found during session-start');
            }
            
            // Add Round 1 message right at session start
            if (!logEntries.some(entry => entry.startsWith('--- Round 1 ---'))) {
                logEntries.push('--- Round 1 ---');
                
                // Add Elder Chew message for Round 1
                if (roleSpecificElderChewMessages && roleSpecificElderChewMessages.length > 0) {
                    // Use round number to select message deterministically
                    const index = 0; // Round 1 = index 0
                    const message = roleSpecificElderChewMessages[index];
                    logEntries.push(`Elder Chew: ${message}`);
                }
            }
            
            if (mapUpdateNeeded) {
                 renderGrid();
            }
            if (typeof sessionStartTime === 'number' && sessionStartTime > 0) {
                const reflectionArea = document.getElementById('reflection-area');
                const reflectionBtn = document.getElementById('submit-reflection');
                if(reflectionArea) {
                    reflectionArea.disabled = false;
                    reflectionArea.value = '';
                }
                if(reflectionBtn) {
                    reflectionBtn.disabled = false;
                }
                startLocalUITimer();
            } else {
                console.error('Session started but missing sessionStartTime in initial state');
            }
            break;
        case 'state-update': // Generic state update might still be useful
             if (msg.payload && msg.payload.state) {
                // Check if inventory has changed
                if (msg.payload.state.inventory) {
                    const oldInventory = {...inventory};
                    const newInventory = msg.payload.state.inventory;
                    
                    // Create a delta of changes
                    const changes = [];
                    Object.keys(newInventory).forEach(key => {
                        const diff = newInventory[key] - (oldInventory[key] || 0);
                        if (diff !== 0) {
                            changes.push(`${diff > 0 ? '+' : ''}${diff} ${itemNames[key]} (${itemEmojis[key]})`);
                        }
                    });
                    
                    // Always update inventory
                    inventory = { ...newInventory };
                    renderInventory();
                    
                    // Add log entry for inventory changes
                    if (changes.length > 0) {
                        const updateMessage = `Inventory updated: ${changes.join(', ')}`;
                        
                        // Force add to log and render
                        document.getElementById('log-content').innerHTML += `<div class="log-bubble log-system">${updateMessage}</div>`;
                        document.getElementById('log-content').scrollTop = document.getElementById('log-content').scrollHeight;
                        
                        // Also add to logEntries array for consistency
                        logEntries.push(updateMessage);
                    }
                }
                
                // Update other state properties if they exist
                if (msg.payload.state.curr) {
                    curr = msg.payload.state.curr;
                }
                if (msg.payload.state.visited) {
                    visited = new Set(msg.payload.state.visited);
                }
                if (msg.payload.state.itemsGrid) {
                    itemsGrid = msg.payload.state.itemsGrid;
                }
                
                if (mapUpdateNeeded || msg.payload.state.visited || msg.payload.state.curr) {
                    renderGrid();
                }
            }
             break;
        case 'show-modal': // Keep showing modals (like penalties)
            if (msg.payload) {
                showBigModal({
                    emoji: msg.payload.emoji,
                    main: msg.payload.main,
                    sub: msg.payload.sub,
                    borderColor: msg.payload.borderColor,
                    eventType: msg.payload.eventType,
                });
            }
            break;
        case 'reflection-penalty': // Handle team reflection penalties
            // The server sends this to ALL team members when ANY player misses a reflection
            // The whole team is penalized with the loss of one inventory item
            const lostItemText = msg.payload.itemCode
                ? `Lost 1 ${itemNames[msg.payload.itemCode]} (${itemEmojis[msg.payload.itemCode]})`
                : 'No item lost';
            // Format to match leader dashboard
            logEntries.push(`Reflection Penalty: ${lostItemText}. Reason: ${msg.payload.reason}`);
            if (msg.payload.inventory) {
                // Update our inventory to match the server's penalized inventory
                inventory = { ...msg.payload.inventory };
                renderInventory();
            }
            renderLog();
            break;
        case 'pickup-update':
        case 'inventory-update': // Add this case to handle inventory updates from leader
            if (msg.payload && msg.payload.inventory) {
                // Always update inventory
                const oldInventory = {...inventory};
                const newInventory = msg.payload.inventory;
                
                // Update inventory data
                inventory = { ...newInventory };
                renderInventory();
                
                // Use the exact message sent from leader if available
                if (msg.payload.messageText) {
                    // Add directly to DOM
                    const logDiv = document.getElementById('log-content');
                    if (logDiv) {
                        const msgElement = document.createElement('div');
                        msgElement.className = 'log-bubble log-system'; 
                        msgElement.style.background = '#e6ffe6';
                        msgElement.style.borderLeft = '5px solid #4CAF50';
                        msgElement.textContent = msg.payload.messageText;
                        logDiv.appendChild(msgElement);
                        
                        // Also add to logEntries for later renders
                        logEntries.push(msg.payload.messageText);
                        logDiv.scrollTop = logDiv.scrollHeight;
                    }
                    
                    // Also create a visible alert
                    const alert = document.createElement('div');
                    alert.style.position = 'fixed';
                    alert.style.top = '100px';
                    alert.style.right = '20px';
                    alert.style.backgroundColor = '#4CAF50';
                    alert.style.color = 'white';
                    alert.style.padding = '10px 20px';
                    alert.style.borderRadius = '5px';
                    alert.style.zIndex = '9999';
                    alert.textContent = msg.payload.messageText;
                    document.body.appendChild(alert);
                    
                    // Remove after 4 seconds
                    setTimeout(() => {
                        document.body.removeChild(alert);
                    }, 4000);
                } else {
                    // Fallback: Create a message from inventory changes if no message was provided
                    // Create a delta of changes
                    const changes = [];
                    Object.keys(newInventory).forEach(key => {
                        const diff = newInventory[key] - (oldInventory[key] || 0);
                        if (diff !== 0) {
                            changes.push(`${diff > 0 ? '+' : ''}${diff} ${itemNames[key]} (${itemEmojis[key]})`);
                        }
                    });
                    
                    if (changes.length > 0) {
                        // Create our own update message
                        const updateMessage = `Inventory updated: ${changes.join(', ')}`;
                        
                        // Add directly to DOM
                        const logDiv = document.getElementById('log-content');
                        if (logDiv) {
                            const msgElement = document.createElement('div');
                            msgElement.className = 'log-bubble log-system'; 
                            msgElement.style.background = '#e6ffe6';
                            msgElement.style.borderLeft = '5px solid #4CAF50';
                            msgElement.textContent = updateMessage;
                            logDiv.appendChild(msgElement);
                            
                            // Also add to logEntries for later renders
                            logEntries.push(updateMessage);
                            logDiv.scrollTop = logDiv.scrollHeight;
                        }
                        
                        // Alert visible on screen
                        const alert = document.createElement('div');
                        alert.style.position = 'fixed';
                        alert.style.top = '100px';
                        alert.style.right = '20px';
                        alert.style.backgroundColor = '#4CAF50';
                        alert.style.color = 'white';
                        alert.style.padding = '10px 20px';
                        alert.style.borderRadius = '5px';
                        alert.style.zIndex = '9999';
                        alert.textContent = updateMessage;
                        document.body.appendChild(alert);
                        
                        // Remove after 4 seconds
                        setTimeout(() => {
                            document.body.removeChild(alert);
                        }, 4000);
                    }
                }
            } else {
                console.error('Missing inventory payload in inventory-update message');
            }
            break;
        case 'inject-story':
            if (msg.payload && msg.payload.story) {
                logEntries.push(`Inject Story: ${msg.payload.story}`);
                renderLog();
            }
            break;
        case 'inject': // Add handler for inject messages from leader
            if (msg.payload && msg.payload.inject && msg.payload.inject.story) {
                // First, log the story
                logEntries.push(`Inject Story: ${msg.payload.inject.story}`);
                
                // Then log the item loss if any
                if (msg.payload.inject.item) {
                    const itemCode = msg.payload.inject.item;
                    logEntries.push(`Inject: Lost 1 ${itemNames[itemCode]} (${itemEmojis[itemCode]})`);
                } else {
                    logEntries.push('Inject: No items to lose.');
                }
                
                // Update inventory from the payload if available
                if (msg.payload.inventory) {
                    inventory = { ...msg.payload.inventory };
                    renderInventory();
                }
                
                renderLog();
            }
            break;
        case 'move': // Add handler for player movement
            if (msg.payload && msg.payload.move) {
                // Just update the state, don't show move messages
                if (msg.payload.state) {
                    // Check if inventory changed with this move (pickup)
                    if (msg.payload.state.inventory) {
                        const oldInventory = {...inventory};
                        const newInventory = msg.payload.state.inventory;
                        
                        // Check for changes in the inventory
                        const changes = [];
                        Object.keys(newInventory).forEach(key => {
                            const diff = newInventory[key] - (oldInventory[key] || 0);
                            if (diff !== 0) {
                                changes.push(`${diff > 0 ? '+' : ''}${diff} ${itemNames[key]} (${itemEmojis[key]})`);
                            }
                        });
                        
                        // Update inventory 
                        inventory = { ...newInventory };
                        
                        // Add inventory update to log content
                        if (changes.length > 0) {
                            const updateMessage = `Inventory updated: ${changes.join(', ')}`;
                            
                            // Direct DOM insertion
                            const logDiv = document.getElementById('log-content');
                            if (logDiv) {
                                const msgElement = document.createElement('div');
                                msgElement.className = 'log-bubble log-system';
                                msgElement.style.background = '#e6ffe6';
                                msgElement.style.borderLeft = '5px solid #4CAF50';
                                msgElement.textContent = updateMessage;
                                logDiv.appendChild(msgElement);
                                logDiv.scrollTop = logDiv.scrollHeight;
                            }
                            
                            // Also add to logEntries for consistency
                            logEntries.push(updateMessage);
                        }
                    }
                    
                    if (msg.payload.state.curr) {
                        curr = msg.payload.state.curr;
                    }
                    if (msg.payload.state.visited) {
                        visited = new Set(msg.payload.state.visited);
                    }
                    renderInventory();
                    renderGrid();
                }
            }
            break;
    }

    if (updateNeeded) {
        renderInventory();
        renderLog(); // Render filtered log
        renderTimers();
        if (mapUpdateNeeded) { 
             // Logging removed;
             renderGrid();
        }
    }
};

ws.onerror = (error) => {
    console.error(`WebSocket Error (${role}):`, error);
};

ws.onclose = () => {
    // WebSocket connection closed
};

function renderInventory() {
    // Logging removed);
    const ul = document.getElementById('inventory-list');
    if (!ul) {
        console.error('RENDER INVENTORY: inventory-list element not found!');
        return;
    }
    
    ul.innerHTML = '';
    Object.entries(inventory).forEach(([code, qty]) => {
        const li = document.createElement('li');
        li.textContent = `${itemNames[code]}: ${qty}`;
        ul.appendChild(li);
    });
    // Logging removed;
}

function renderLog() {
    // Logging removed;
    const logDiv = document.getElementById('log-content');
    if (!logDiv) {
        console.error('RENDER LOG: log-content element not found!');
        return;
    }
    
    logDiv.innerHTML = '';
    logEntries.forEach((entry, index) => {
        const msg = document.createElement('div');
        msg.className = 'log-bubble';
        
        // Logging removed;
        
        // Set message class based on content for proper styling
        if (entry.startsWith('--- Round ')) {
            msg.classList.add('log-round-separator');
            msg.style.textAlign = 'center';
            msg.style.fontWeight = 'bold';
            msg.style.background = '#f0f0f0';
            msg.style.borderLeft = 'none';
        } else if (entry.startsWith('Elder Chew:')) {
            msg.classList.add('log-elder');
        } else if (entry.startsWith('Inject Story:')) {
            msg.classList.add('log-inject-story');
        } else if (entry.startsWith('Reflection Submitted')) {
            msg.classList.add('log-user');
        } else if (entry.startsWith('Reflection Missed')) {
            msg.classList.add('log-missed-reflection');
            msg.style.background = '#ffecec';
            msg.style.borderLeft = '5px solid #ff5757';
        } else if (entry.startsWith('Reflection Penalty:')) {
            msg.classList.add('log-penalty');
            msg.style.background = '#fff0f0';
            msg.style.borderLeft = '5px solid #ff4500';
        } else if (entry.startsWith('Inventory updated:')) {
            msg.classList.add('log-system');
            msg.style.background = '#e6ffe6';  // Light green background
            msg.style.borderLeft = '5px solid #4CAF50';  // Green border
            // Logging removed;
        }
        
        msg.textContent = entry;
        logDiv.appendChild(msg);
    });
    
    // Force scroll to bottom to ensure new messages are visible
    setTimeout(() => {
    logDiv.scrollTop = logDiv.scrollHeight;
    }, 50);
}

// Function to update the objective box
function updateObjectiveBox() {
    const objectiveBox = document.getElementById('objective-box');
    if (!objectiveBox) return;
    objectiveBox.textContent = 'Elder Chew: ' + introductoryMessage;
}

// Function to log messages
function log(msg) {
    logEntries.push(msg);
    renderLog(); 
}

// Modify startLocalUITimer to prevent multiple missed reflection reports
function startLocalUITimer() {
    // Logging removed;
    if (timerInterval) {
        // Logging removed;
        clearInterval(timerInterval);
    }
    if (!sessionStartTime) {
        console.error('No sessionStartTime set!');
        return;
    }
    
    // Track rounds we've already reported as missed
    const reportedMissedRounds = new Set();
    
    // Logging removed;
    timerInterval = setInterval(() => {
        const now = Date.now();
        const elapsed = Math.round((now - sessionStartTime) / 1000);
        const sessionDuration = totalRounds * roundDuration;
        const remainingSession = Math.max(0, sessionDuration - elapsed);
        const clampedRoundNum = Math.min(currentRoundNumber, totalRounds);
        const roundElapsed = elapsed - (clampedRoundNum - 1) * roundDuration;
        const remainingRound = Math.max(0, roundDuration - roundElapsed);
        // Logging removed;
        renderTimers(remainingSession, remainingRound, clampedRoundNum);

        if (remainingRound === 0 && clampedRoundNum < totalRounds) {
            // Only report missed reflections if we haven't already reported for this round
            if (!reflectionSubmittedThisRound && !reportedMissedRounds.has(clampedRoundNum)) {
                 const text = reflectionArea.value;
                 // Logging removed;
                 logEntries.push(`Reflection Missed (R${clampedRoundNum}): ${text || '[Empty]'}`); 
                 reflectionArea.value = '';
                 renderLog(); 
                
                // Mark this round as reported
                reportedMissedRounds.add(clampedRoundNum);
                
                 ws.send(JSON.stringify({
                     sessionId,
                     type: 'reflection-missing',
                     payload: { playerId, roundNum: clampedRoundNum, text }
                 }));
            }
            currentRoundNumber++;
            reflectionSubmittedThisRound = false; 
            if(reflectionArea) reflectionArea.disabled = false;
            if(reflectionBtn) reflectionBtn.disabled = false;
            logEntries.push(`--- Round ${currentRoundNumber} ---`); 
            
            // Add Elder Chew comment for the new round if we have messages
            if (roleSpecificElderChewMessages && roleSpecificElderChewMessages.length > 0) {
                // Use round number to select message deterministically
                const index = (currentRoundNumber - 1) % roleSpecificElderChewMessages.length;
                const message = roleSpecificElderChewMessages[index];
                logEntries.push(`Elder Chew: ${message}`);
                
                // Don't show popup, just add to chat log
            }
            
            renderLog(); 
        }

        if (remainingSession === 0 || (remainingRound === 0 && clampedRoundNum >= totalRounds)) {
            // Only report missed reflection for final round if we haven't already
            if (clampedRoundNum === totalRounds && !reflectionSubmittedThisRound && !reportedMissedRounds.has(clampedRoundNum)) {
                 const text = reflectionArea.value;
                 // Logging removed;
                 logEntries.push(`Reflection Missed (R${clampedRoundNum}): ${text || '[Empty]'}`); 
                 reflectionArea.value = ''; 
                 renderLog(); 
                
                // Mark this round as reported
                reportedMissedRounds.add(clampedRoundNum);
                
                 ws.send(JSON.stringify({
                     sessionId,
                     type: 'reflection-missing',
                     payload: { playerId, roundNum: clampedRoundNum, text }
                 }));
            }
            clearInterval(timerInterval);
            renderTimers(remainingSession, remainingRound, clampedRoundNum);
        }
    }, 250);
}

function renderTimers(currentSessionSec, currentRoundSec, displayRoundNum) {
    const sessionTimerEl = document.getElementById('primary-timer');
    const roundTimerEl = document.getElementById('secondary-timer');
    const roundNumberEl = document.getElementById('turn-counter');

    // Defensive: Only show timers if sessionStartTime is a valid number and > 0
    if (typeof sessionStartTime !== 'number' || sessionStartTime <= 0) {
        if (sessionTimerEl) sessionTimerEl.textContent = 'Session: --:--';
        if (roundTimerEl) roundTimerEl.textContent = 'Round Timer: --:--';
        if (roundNumberEl) roundNumberEl.textContent = `- / -`;
        return;
    }

    const roundToShow = displayRoundNum !== undefined ? displayRoundNum : currentRoundNumber;
    // Calculate remaining times if not provided (e.g., for initial render)
    if (currentSessionSec === undefined || currentRoundSec === undefined) {
        const now = Date.now();
        // Always use sessionStartTime from the leader for all math
        const elapsedSession = sessionStartTime ? (now - sessionStartTime) / 1000 : 0; // in seconds
        const sessionDuration = totalRounds * roundDuration; // in seconds
        const initialRoundNum = sessionStartTime ? Math.min(totalRounds, Math.floor(elapsedSession / roundDuration) + 1) : roundToShow;
        const roundStartTime = sessionStartTime + (initialRoundNum - 1) * roundDuration * 1000; // ms
        currentRoundSec = sessionStartTime ? Math.max(0, Math.round((roundStartTime + roundDuration * 1000 - now) / 1000)) : 0;
        currentSessionSec = sessionStartTime
            ? Math.max(0, Math.round(sessionStartTime / 1000 + sessionDuration - now / 1000))
            : 0;
    }

    const sessionMinutes = Math.floor(currentSessionSec / 60);
    const sessionSeconds = currentSessionSec % 60;
    const roundMinutes = Math.floor(currentRoundSec / 60);
    const roundSeconds = currentRoundSec % 60;

    if (sessionTimerEl) sessionTimerEl.textContent = `Session: ${pad(sessionMinutes)}:${pad(sessionSeconds)}`;
    if (roundTimerEl) {
         roundTimerEl.textContent = `Round Timer: ${pad(roundMinutes)}:${pad(roundSeconds)}`;
         roundTimerEl.style.color = currentRoundSec <= 5 ? 'red' : 'inherit';
    }
    if (roundNumberEl) roundNumberEl.textContent = `${roundToShow} / ${totalRounds}`;
}

function pad(n) { return n < 10 ? '0' + n : n; }

// --- Reflection logic ---
reflectionBtn.onclick = function() {
    const text = reflectionArea.value;
    if (!reflectionSubmittedThisRound) {
        // Logging removed;
        // Update log message format to match leader dashboard
        logEntries.push(`Reflection Submitted (R${currentRoundNumber}): ${text || '[Empty]'}`); 
        reflectionArea.value = ''; 
        renderLog();
        reflectionSubmittedThisRound = true; 
        reflectionArea.disabled = true;
        reflectionBtn.disabled = true;
        ws.send(JSON.stringify({
            sessionId,
            type: 'reflection',
            payload: { playerId, text, roundNum: currentRoundNumber } 
        }));
    }
};

function saveTeamHistory() {
    localStorage.setItem('teamRoundHistory', JSON.stringify(teamRoundHistory));
}
function clearTeamHistory() {
    teamRoundHistory = [];
    localStorage.removeItem('teamRoundHistory');
}

// Function to render grid elements
function renderGrid() {
    // Logging removed;
    if (!gridEl) {
        gridEl = document.getElementById('grid'); // Ensure gridEl is assigned
        // Logging removed;
    }
    if (!gridEl) { 
        console.error("Grid element not found in renderGrid!"); 
        return; 
    }
    
    // Logging removed.length);
    gridEl.innerHTML = '';
    gridEl.style.gridTemplateColumns = `repeat(${N}, 1fr)`; // Ensure grid styles are set
    gridEl.style.gridTemplateRows = `repeat(${N}, 1fr)`;
    gridEl.style.display = 'grid'; // Make sure grid is displayed

    for (let r = 0; r < N; r++) {
        for (let c = 0; c < N; c++) {
            const cell = document.createElement('div');
            cell.className = 'cell'; 
            cell.dataset.r = r;
            cell.dataset.c = c;
            const key = `${r},${c}`;

            // Add 'visited' class if the cell key is in the visited set
            if (visited.has(key)) {
                 cell.classList.add('visited');
            }

            if (curr && r === curr.r && c === curr.c) {
                cell.classList.add('current');
                cell.textContent = PLAYER;
            } else if (itemsGrid[key] && !visited.has(key)) { // Show item only if not visited
                // Use itemEmojis for consistent display
                cell.textContent = itemEmojis[itemsGrid[key]];
            }
            
            gridEl.appendChild(cell);
        }
    }
    // Logging removed;
}

// Modify initializeTeamDashboard
function initializeTeamDashboard() {
    // Logging removed;
    gridEl = document.getElementById('grid');
    // Logging removed;
    if (gridEl) {
        // Logging removed;
    }
    
    // Debug elements removed
    
    renderInventory();
    renderLog();
    renderTimers(); // Initial render uses global vars
    renderGrid();
    
    document.getElementById('player-role').textContent = role;
    // Do NOT start local timer here, wait for session-start message
}

// Move the initialization call inside DOMContentLoaded
document.addEventListener('DOMContentLoaded', async () => {
    await loadConfig();
    // Set up config-dependent variables
    totalRounds = config.ROUND_COUNT;
    roundDuration = config.ROUND_DURATION_SEC;
    // Set up WebSocket using config.WEBSOCKET_URL if present
    ws = new WebSocket(config.WEBSOCKET_URL || 'ws://localhost:8080');
    // Assign ws to global if needed
    window.ws = ws;
    // Continue with the rest of the initialization
    initializeTeamDashboard();
});

// Example: Simulate receiving updates from leader every 10s
// setInterval(() => {
//     receiveFromLeader({
//         roundNum: Math.floor(Math.random()*8)+1,
//         sessionSeconds: Math.floor(Math.random()*2400),
//         roundSeconds: Math.floor(Math.random()*10),
//         inventory: { W: Math.floor(Math.random()*5), M: Math.floor(Math.random()*5), F: Math.floor(Math.random()*5), S: Math.floor(Math.random()*5) },
//         logEntries: [ ...logEntries, 'Inject Story: ' + injectStories[Math.floor(Math.random()*injectStories.length)] ]
//     });
// }, 10000); 

// Remove the standalone call below
// initializeTeamDashboard(); 

// Add the showBigModal function (copied from leader, maybe without buttons/onclick)
function showBigModal({emoji, main, sub, okText, onOk, borderColor, eventType}) {
    // Remove existing modals first
    document.querySelectorAll('.modal-popup').forEach(m => m.remove());

    const modal = document.createElement('div');
    // Use a class for easier removal and styling
    modal.className = 'modal-popup'; 
    modal.style.position = 'fixed';
    modal.style.left = '0';
    modal.style.top = '0';
    modal.style.width = '100vw';
    modal.style.height = '100vh';
    modal.style.background = 'rgba(0,0,0,0.25)';
    modal.style.display = 'flex';
    modal.style.alignItems = 'center';
    modal.style.justifyContent = 'center';
    modal.style.zIndex = 1000;
    
    // Informational modal for team member - Always show an OK button to close
    const actualOkText = 'OK'; // Hardcode OK for team

    modal.innerHTML = `<div style="background:#fff;padding:2.5em 3em;border-radius:28px;box-shadow:0 2px 24px #0003;text-align:center;min-width:320px;border:2.5px solid ${borderColor || '#e0e0e0'};">
        ${(eventType ? `<div style='color:#888;font-size:0.95em;margin-bottom:0.7em;'>${eventType}</div>` : '')}
        <div style='font-size:2.5em;margin-bottom:0.5em;'>${emoji || ''}</div>
        <div style='font-size:1.5em;font-weight:bold;margin-bottom:0.7em;'>${main}</div>
        <div style='font-size:1.1em;color:#444;margin-bottom:1.2em;'>${sub || ''}</div>
        <button class='modal-ok-btn' style='font-size:1.2em;padding:0.7em 2.5em;margin-top:1em;border-radius:18px;border:2px solid #222;background:#e0e0e0;color:#222;font-weight:600;'>${actualOkText}</button>
    </div>`;
    document.body.appendChild(modal);
    
    // Attach handler JUST to close the modal
    const okBtn = modal.querySelector('.modal-ok-btn');
    if (okBtn) {
        okBtn.onclick = () => {
            document.body.removeChild(modal);
            // No onOk callback needed for team member
        };
    }
} 