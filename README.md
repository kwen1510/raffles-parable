# Raffles Parable Game

## Quick Start instructions

1. **Install Node.js** (if not already installed): https://nodejs.org/
2. **Open a terminal and navigate to the project directory:**
   ```bash
   cd path/to/Raffles_Parable
   ```
3. **Install dependencies:**
   ```bash
   npm install
   ```
4. **Start the server:**
   ```bash
   npm start
   ```
   (Alternatively, you can run `node server.js`)
5. **Open your browser and go to:**
   [http://localhost:8080](http://localhost:8080)
6. **Follow the on-screen instructions to join a session and play!**

---

## Description

Raffles Parable is a cooperative, web-based multiplayer game where players take on specific roles (Leader, Warrior, Mage, Jester) to navigate a grid, gather resources (Wood, Metal, Feathers, Stardust), and achieve objectives set by "Elder Chew". The game emphasizes teamwork, strategic movement (controlled by the Leader), and reflection on actions taken during timed rounds. All game activity is logged for later review and analysis.

## Features

*   Real-time multiplayer gameplay via WebSockets.
*   Distinct player roles with specific functions.
*   Grid-based map navigation.
*   Resource gathering and inventory management.
*   Timed game sessions and rounds.
*   In-game events ("Injects") that can affect inventory.
*   End-of-round reflection prompts for players.
*   Configurable game parameters (durations, items, prompts, etc.).
*   Persistent logging of all game actions to an SQLite database (`data/game.db`).
*   Web-based viewer (`actions-viewer.html`) to review past game sessions.

## Setup and Installation

To run the Raffles Parable game server locally:

1.  **Prerequisites:** Ensure you have Node.js and npm installed on your system.
2.  **Navigate to Directory:** Open your terminal or command prompt and navigate to the `Raffles_Parable` directory:
    ```bash
    cd path/to/Raffles_Parable
    ```
3.  **Install Dependencies:** Install the required Node.js packages:
    ```bash
    npm install
    ```
4.  **Start the Server:** Run the server application:
    ```bash
    npm start
    ```
    (Or use `node server.js`)
5.  **Access the Game:** The server will start, typically listening on port 8080. Players can access the game by opening their web browser and navigating to `http://localhost:8080`.

## How to Play

1.  **Start Server:** Make sure the game server is running (see Setup).
2.  **Join Session:** Each player navigates to `http://localhost:8080`.
3.  **Enter Session ID:** Players will be prompted to enter a Session ID. These IDs must match one of the codes listed in `public/session-ids.json` (e.g., `D1G01`). All players in the same game must enter the same Session ID.
4.  **Enter Player ID:** Each player must enter a unique name or identifier for themselves.
5.  **Select Role:** Players choose one of the available roles (Leader, Warrior, Mage, Jester). Roles are unique per session; only one player can be each role.
6.  **Wait for Leader:** Team members (Warrior, Mage, Jester) are redirected to the Team Dashboard and wait.
7.  **Leader Starts Game:** The Leader is redirected to the Leader Dashboard. Only the Leader sees the game grid and can initiate the game by clicking the "Start Game" button.
8.  **Gameplay:**
    *   **Movement:** The Leader clicks cells on the grid to move the team. Movement is limited by steps per round.
    *   **Objectives:** Follow the instructions provided by "Elder Chew" displayed on the dashboard.
    *   **Resources:** Moving onto certain cells may trigger resource pickups or inject events (potentially causing item loss).
    *   **Timers:** The game progresses in rounds with specific time limits for both the overall session and each round.
    *   **Inventory:** All players see the team's shared inventory.
    *   **Reflections:** At the end of each round (or when prompted), team members must submit reflections via the text area on their dashboard. Missing reflections can trigger penalties (item loss).
9.  **Game End:** The game ends when the total session time runs out or all rounds are completed.

## Configuration

Game parameters can be modified by editing the JSON files within the `config` and `public` directories.

1.  **Core Game Parameters (`config/params.json`):**
    *   `ROUND_COUNT`: Total number of rounds per game.
    *   `ROUND_DURATION_SEC`: Duration of each round in seconds.
    *   `SESSION_DURATION_SEC`: Total duration for the entire game session in seconds.
    *   `GRID_SIZE`: The dimension of the square game grid (e.g., 5 means 5x5).
    *   `MAX_STEPS_PER_ROUND`: Maximum number of cells the Leader can move the team within a single round.
    *   `ITEMS`: Array defining the gatherable items (code, name, emoji).
    *   `ROLES`: Array defining the available player roles.
    *   `INJECT_*_PERCENTAGE`: Probabilities for random events occurring.
    *   `PICKUP_*_QTY`: Amount of resources gained during pickups.
    *   `TEXT_TEMPLATES`: Customizable text strings used for various game messages and logs.
    *   Note: The `DB_PATH` field in this file is not used; the database is always stored at `data/game.db`.

2.  **Valid Session IDs (`public/session-ids.json`):**
    *   This file contains a simple JSON array of strings.
    *   Edit this list to define which Session IDs are considered valid when players join.

3.  **Game Text and Prompts (`public/text/`):**
    *   `role-introductions.json`: Contains introductory text for each role.
    *   `elder-chew-*.json`: Contains the objective/prompt text given by Elder Chew for each role.
    *   Other files in this directory might contain role-specific prompts or dialogues used during the game.
    *   Only the `public/text/` directory is used for serving these files to the browser.

*Remember to restart the Node.js server (`npm start` or `node server.js`) after making changes to `config/params.json` for them to take effect.* Changes to files in `public/` (like `session-ids.json` or files in `public/text/`) are typically reflected immediately on browser refresh.

## Endpoints

Here are the primary URLs and connection points for the game:

*   **Player Entry Point:** `http://localhost:8080/`
    *   Serves the `role-select.html` page for players to join a session and choose a role.
    *   Client-side JavaScript handles redirection to the appropriate dashboard (`leader-dashboard.html` or `team-dashboard.html`) after role selection.
*   **Leader Dashboard:** `http://localhost:8080/leader-dashboard.html` (Accessed via redirection)
    *   Interface for the Leader player, showing the map, inventory, logs, and controls.
*   **Team Dashboard:** `http://localhost:8080/team-dashboard.html` (Accessed via redirection)
    *   Interface for Warrior, Mage, and Jester players, showing inventory, logs, objectives, and the reflection submission area.
*   **Actions Viewer:** `http://localhost:8080/actions-viewer.html`
    *   A separate tool to view detailed logs and summaries of past game sessions stored in the database.
*   **WebSocket:** `ws://localhost:8080`
    *   The core communication channel for real-time game state updates between the server and all connected players' dashboards.
*   **API (Primarily for internal use by the frontend):**
    *   `GET /api/game-config`: Provides the contents of `config/params.json` to the client.
    *   `POST /api/claim-role`: Used by `role-select.html` to register a player's role choice with the server.
    *   `GET /api/actions`: Used by `actions-viewer.html` to fetch logged game data from the database.
    *   `GET /session-ids.json`: Used by `role-select.html` to get the list of valid session IDs.
    *   `GET /text/...`: Used by dashboards to load role introductions, Elder Chew prompts, etc. (served from `public/text/`).

## Data Storage

All game actions, player reflections, and significant events are logged chronologically to an SQLite database file located at `data/game.db`. This allows for persistent storage and later analysis of gameplay via the Actions Viewer.

## Troubleshooting

If you encounter issues with the game, here are some common problems and their solutions:

1. **WebSocket Connection Issues**: If team members cannot connect to the leader dashboard, check that all players are using the same Session ID and that the server is running properly.

2. **UI Problems**:
   - **Modal Windows Not Closing**: Team dashboard has been updated to ensure all modal windows have functional "OK" buttons.
   - **Reflection Input Not Working**: Recent fixes ensure that reflection textareas are properly enabled when needed.

3. **Penalty System Issues**: If reflection penalties don't seem to be working correctly, verify that the leader dashboard is showing the correct inventory changes after penalties are applied.

4. **JavaScript Loading Errors**: If you see "Uncaught SyntaxError: Unexpected token '<'" errors in the console:
   - Ensure proper MIME type specifications in server.js
   - Try clearing your browser cache or using incognito mode
   - Check that all script tags in HTML files have correct paths

5. **Hosting on Glitch.com**: The application is compatible with Glitch hosting. If deploying there, simply import the project and follow the standard Node.js application deployment process on Glitch.

## Recent Updates

The following improvements have been made to enhance game functionality:

- Fixed WebSocket connectivity issues between leader and team dashboards
- Resolved UI problems where team members couldn't close modal boxes
- Fixed issues with reflection system, ensuring team members can properly submit reflections
- Enhanced inventory update mechanisms to properly log penalties and reflect changes
- Updated modal systems to conditionally show "OK" buttons based on context
- Fixed JavaScript loading issues through proper MIME type specifications

## Contributors

The Raffles Parable Game was built for educational purposes. If you'd like to contribute to the project, please submit a pull request or open an issue for discussion.

## License

This project is available under [insert license information]. See the LICENSE file for more details. 