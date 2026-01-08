// Entry point for web gui
// Load required resources (webpack)

import "./gui.css";

// Import PlayerBoard to override floor scores
import { PlayerBoard } from "azul-tiles";

// Floor scores (using library default: 7th tile is -3)
PlayerBoard.floorScores = [-1, -1, -2, -2, -2, -3, -3];

// For managing the startup page
import { add_player, get_options, get_players, validate_players } from "./setup";

// For mainpulating the display of the game
import "./display";

// For running the game
import { GuiGame } from "./game";

// global variable
var gui_game: GuiGame;

// Plausible event tracking
// @ts-ignore
window.plausible =
    // @ts-ignore
    window.plausible ||
    function () {
        // @ts-ignore
        (window.plausible.q = window.plausible.q || []).push(arguments);
    };

// On document load, hide game
// and add human and AI
document.addEventListener("DOMContentLoaded", (event) => {
    document.getElementById("game")!.style.display = "none";
    add_player("human");
    add_player("ai");
});

// Add required functionality to start button
document.getElementById("start-button")?.addEventListener("click", (event) => {
    console.log("Start Button");
    event.stopPropagation();

    // Check first player selection
    const firstPlayerSelect = document.getElementById("first-player") as HTMLSelectElement;
    const player2First = firstPlayerSelect && firstPlayerSelect.value === "2";

    // Get setup info - pass swap flag to create players with correct IDs from the start
    let players = get_players(player2First);
    const options = get_options();

    // Validate setup info
    const player_check = validate_players(players);
    if (!player_check.valid) {
        alert(player_check.message);
        return;
    }

    // Hide start and show game div
    document.getElementById("start")!.style.display = "none";
    document.getElementById("game")!.style.display = "";

    // Start the game
    gui_game = new GuiGame(players);

    // @ts-ignore
    plausible("Tiles Game", { props: { type: "Start" } });
});
