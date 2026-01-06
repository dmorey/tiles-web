// Handles the running of the game in gui mode
import { GameState, Move, PlayerInterface, PlayerType, Tile } from "azul-tiles";
import { State } from "azul-tiles/dist/state.js";
import { GuiDisplay } from "./display";
import { BagView } from "./bag-view";
import { FactoryDropHandler } from "./factory-drop-handler";

export class Human implements PlayerInterface {
    type = PlayerType.HUMAN;
    constructor(public id: number, public name: string) {}
    getMove(gs: GameState): Move | undefined {
        return undefined;
    }
    newRound(gs: GameState): void {}
}

// Class that manages the interaction between the game logic, display and players
export class GuiGame {
    gamestate: GameState;
    display: GuiDisplay;

    selected_tile: Tile = Tile.Null;
    selected_factory: number = -1;
    possible_lines: Array<number> = [];

    // Manual distribution state
    private manualDistributionMode: boolean = false;
    private bagView: BagView | null = null;
    private factoryDropHandler: FactoryDropHandler | null = null;

    // Our own tile bag - we manage this ourselves, ignoring library's bag manipulation
    private ourBag: Array<number> = [];

    // Discarded tiles - tiles from floor/incomplete lines that don't return to bag until it's depleted
    private discardedTiles: Array<number> = [];

    // Creates a new game with given setup details
    constructor(public players: Array<PlayerInterface>) {
        // Create gamestate
        this.gamestate = new GameState();

        // Start game (this does random distribution internally)
        this.gamestate.newGame(this.players.length);

        // Update the display
        this.display = new GuiDisplay(this.gamestate, this.players);

        this.assign_callbacks();

        // Enter manual distribution phase instead of starting with random tiles
        this.enterManualDistributionPhase();
    }

    // Replay the game with same seed
    replay() {
        console.log("Replay");
        // Create game with same seed
        const seed = this.gamestate.seed;
        this.gamestate = new GameState();
        this.gamestate.seed = seed;
        // Start game
        this.gamestate.newGame(this.players.length);
        // Reset our bag and discarded tiles for new game
        this.ourBag = [];
        this.discardedTiles = [];
        // Reset display
        // this.display.clear()
        // Update the display
        this.display.update_for_end_of_round(this.gamestate);

        // Enter manual distribution phase
        this.enterManualDistributionPhase();

        // @ts-ignore
        plausible("Tiles Game", { props: { type: "Replay" } });
    }

    // Play with same players
    rematch() {
        console.log("Rematch");
        // Create game with different seed
        this.gamestate = new GameState();
        // Start game
        this.gamestate.newGame(this.players.length);
        // Reset our bag and discarded tiles for new game
        this.ourBag = [];
        this.discardedTiles = [];
        // Update display for start of game
        this.display.update_for_end_of_round(this.gamestate);

        // Enter manual distribution phase
        this.enterManualDistributionPhase();

        // @ts-ignore
        plausible("Tiles Game", { props: { type: "Rematch" } });
    }

    // Start from scratch
    new_game() {
        console.log("New Game");
        // @ts-ignore
        plausible("Tiles Game", { props: { type: "New" } });
        location.reload();
    }

    get_active_player(): PlayerInterface {
        return this.players[this.gamestate.activePlayer];
    }

    assign_callbacks(): void {
        // Add callbacks to factory tiles
        this.assign_factory_callbacks();

        // Add callbacks to lines
        this.players.forEach((player, ind) => {
            if (player.type != PlayerType.HUMAN) {
                return;
            }
            this.display.lines[ind].forEach((line) => {
                line.addEventListener("click", (event) => {
                    this.line_click_callback(event);
                });
            });
        });

        // assign whole screen callback
        document.body.addEventListener("click", (event) => {
            this.screen_click_callback(event);
        });

        // Assign game end button callbacks
        document.getElementById("replay-button")?.addEventListener("click", (event) => {
            this.replay();
        });
        document.getElementById("rematch-button")?.addEventListener("click", (event) => {
            this.rematch();
        });
        document.getElementById("new-game-button")?.addEventListener("click", (event) => {
            this.new_game();
        });
    }

    assign_factory_callbacks(): void {
        this.display.factories.forEach((factory, ind) => {
            const tiles = [...factory.children];
            tiles.forEach((tile) => {
                tile.addEventListener("click", (event) => {
                    this.factory_tile_callback(event);
                });
            });
        });
    }

    factory_tile_callback(event: Event): void {
        // Check if its an AI turn, then let event propagate
        if (this.get_active_player().type != PlayerType.HUMAN) {
            return;
        }
        // Prevent event from reaching upper elements
        event.stopPropagation();

        // Clear all current highlights and selection
        this.clear_selected();

        // Get tile info
        const tile_elem = event.target as HTMLElement;
        const tile_str = tile_elem.getAttribute("tile-colour");
        if (tile_str == undefined) {
            // centre factory with no tile

            return;
        }
        const tile = parseInt(tile_str);

        // Get factory info
        const factory_elem = tile_elem.parentElement as HTMLElement;
        const factory_id = parseInt(factory_elem.getAttribute("factory-id") as string);

        // Highlight factory tiles
        this.display.highlight_factory_tiles(event.target as HTMLElement);

        // Highlight possible lines
        const moves = this.gamestate.availableMoves.filter((move) => {
            if (move.factory == factory_id && move.tile == tile) {
                return true;
            } else {
                return false;
            }
        });
        const lines = moves.reduce<Array<number>>((lines, move) => {
            lines.push(move.line);
            return lines;
        }, []);

        this.display.highlight_lines(this.gamestate.activePlayer, lines);

        // Record info for move
        this.possible_lines = lines;
        this.selected_tile = tile;
        this.selected_factory = factory_id;
    }

    line_click_callback(event: Event): void {
        // If not Human go, not interested
        if (this.get_active_player().type != PlayerType.HUMAN) {
            return;
        }

        event.stopPropagation();
        if (this.selected_factory != -1 && this.selected_tile != Tile.Null) {
            // get line id
            const line_elem = event.currentTarget as HTMLElement;
            const line_id = parseInt(line_elem.getAttribute("line-id") as string);
            if (this.possible_lines.includes(line_id)) {
                // double check its a possible move
                const move = this.check_move(
                    this.get_active_player().id,
                    this.selected_tile,
                    this.selected_factory,
                    line_id,
                ) as Move;
                this.gamestate.playMove(move);
                this.gamestate.nextTurn();
                this.display.update_with_move(move, this.gamestate);
                this.clear_selected();
            }
        } else {
            this.clear_selected();
        }
    }

    clear_selected(): void {
        this.display.clear_factory_highlights();
        this.display.clear_line_highlights();
        this.selected_factory = -1;
        this.selected_tile = Tile.Null;
        this.possible_lines = [];
    }

    screen_click_callback(event: Event): void {
        // Skip normal handling when in distribution mode
        if (this.manualDistributionMode) {
            return;
        }

        // Perform different action depending on game state
        switch (this.gamestate.state) {
            case State.turn:
                const activePlayer = this.get_active_player();
                switch (activePlayer.type) {
                    case PlayerType.AI:
                        // Play the AI move
                        const move = activePlayer.getMove(this.gamestate) as Move;
                        this.gamestate.playMove(move);
                        this.gamestate.nextTurn();
                        // Update the screen
                        this.display.update_with_move(move, this.gamestate);

                        break;
                    case PlayerType.HUMAN:
                        this.clear_selected();
                        break;
                }
                break;
            case State.endOfTurns:
                // Either new round with player turn or end of game after this
                const continueGame = this.gamestate.endRound();

                if (!continueGame) {
                    //  Game has finished
                    const player0 = this.players[0];
                    const player1 = this.players[1];
                    const player = player0.name;
                    const opponent = player1.name;
                    let matchup = "";
                    if (player0.type == PlayerType.HUMAN) {
                        if (player1.type == PlayerType.HUMAN) {
                            matchup = "Human v Human";
                        } else {
                            matchup = "Human v AI";
                        }
                    } else {
                        if (player1.type == PlayerType.HUMAN) {
                            matchup = "AI v Human";
                        } else {
                            matchup = "AI v AI";
                        }
                    }
                    // Winner type
                    let type = "Draw";
                    if (this.gamestate.winner.length == 1) {
                        const id = this.gamestate.winner[0];
                        const winner = this.players[id];

                        switch (winner.type) {
                            case PlayerType.HUMAN:
                                type = "Human";
                                break;
                            case PlayerType.AI:
                                type = "AI";
                                break;
                        }
                        const margin = this.gamestate.playerBoards[0].score - this.gamestate.playerBoards[1].score;
                        // Check matchup type

                        // @ts-ignore
                        plausible("Tiles Game Finish", {
                            props: {
                                winner: winner.name,
                                player: player,
                                opponent: opponent,
                                winner_type: type,
                                margin: margin,
                                matchup: matchup,
                            },
                        });
                    } else {
                        // @ts-ignore
                        plausible("Tiles Game Finish", {
                            props: {
                                winner: "",
                                player: player,
                                opponent: opponent,
                                winner_type: type,
                                margin: 0,
                                matchup: matchup,
                            },
                        });
                    }
                    // Show end of game display
                    this.display.update_for_end_of_round(this.gamestate);
                } else {
                    // New round - enter manual distribution phase
                    this.display.update_for_end_of_round(this.gamestate);
                    this.enterManualDistributionPhase();
                }
                break;
        }
    }

    check_move(player: number, tile: Tile, factory: number, line: number) {
        const moves = this.gamestate.availableMoves.filter((move) => {
            if (move.factory == factory && move.tile == tile && move.line == line && move.player == player) {
                return true;
            } else {
                return false;
            }
        });
        if (moves.length == 1) {
            return moves[0];
        } else {
            Error("${moves.length} moves match");
        }
    }

    // ============================================
    // Manual Tile Distribution Methods
    // ============================================

    // Enter the manual distribution phase
    private enterManualDistributionPhase(): void {
        console.log("Entering manual distribution phase");

        // Calculate how many tiles are needed per round
        const numFactories = this.gamestate.factory.length - 1; // Exclude centre
        const tilesPerRound = numFactories * 4; // 20 for 2-player game

        // Initialize our bag on first distribution (round 1)
        if (this.ourBag.length === 0) {
            // First round - restore tiles from factories and save as our bag
            this.restoreTilesToBag();
            this.ourBag = [...this.gamestate.tilebag];
            console.log(`Initialized our bag with ${this.ourBag.length} tiles`);
        }

        // If our bag is depleted, refill from discarded tiles
        if (this.ourBag.length < tilesPerRound && this.discardedTiles.length > 0) {
            console.log(`Bag depleted (${this.ourBag.length} tiles). Refilling from ${this.discardedTiles.length} discarded tiles.`);
            this.ourBag.push(...this.discardedTiles);
            this.discardedTiles = [];
        }

        console.log(`Bag has ${this.ourBag.length} tiles, need ${tilesPerRound}`);

        // 4. Create empty factories for distribution
        this.display.create_empty_factories(numFactories);

        // 4. Add distribution-mode class to game element
        document.getElementById("game")?.classList.add("distribution-mode");

        // 5. Create BagView - use OUR bag, not the library's
        const factoriesContainer = document.getElementById("factories") as HTMLElement;
        this.bagView = new BagView(factoriesContainer);
        this.bagView.create(this.ourBag, tilesPerRound);

        // 6. Setup FactoryDropHandler
        this.factoryDropHandler = new FactoryDropHandler();
        const regularFactories = this.display.getRegularFactories();
        this.factoryDropHandler.setupDropZones(regularFactories);

        // 7. Wire up callbacks
        this.factoryDropHandler.setOnTileDropped((factoryId, color) => {
            this.bagView?.tilePlaced(color);
        });

        this.factoryDropHandler.setOnTileRemoved((factoryId, color) => {
            this.bagView?.tileReturned(color);
        });

        this.bagView.setOnDistributionComplete(() => {
            this.applyManualDistribution();
        });

        // 8. Set mode flag
        this.manualDistributionMode = true;
    }

    // Restore tiles from factories back to the bag (used only on first round)
    private restoreTilesToBag(): void {
        // Iterate through factories 1 to n (skip centre at index 0)
        for (let i = 1; i < this.gamestate.factory.length; i++) {
            const factory = this.gamestate.factory[i];
            // Add each tile back to the bag
            factory.forEach(tile => {
                if (tile !== Tile.Null && tile >= 0) {
                    this.gamestate.tilebag.push(tile);
                }
            });
            // Clear the factory
            this.gamestate.factory[i] = [];
        }
    }

    // Apply the manual distribution and start the round
    private applyManualDistribution(): void {
        console.log("Applying manual distribution");

        if (!this.factoryDropHandler) return;

        // 1. Get the factory configuration from the drop handler
        const factoryConfig = this.factoryDropHandler.getFactoryConfiguration();

        // 2. Apply configuration to gamestate factories
        factoryConfig.forEach((tiles, index) => {
            this.gamestate.factory[index + 1] = tiles; // +1 to skip centre
        });

        // 3. Remove placed tiles from OUR bag
        factoryConfig.forEach(factory => {
            factory.forEach(tileColor => {
                const index = this.ourBag.indexOf(tileColor);
                if (index !== -1) {
                    this.ourBag.splice(index, 1);
                }
            });
        });

        // 4. Sync our bag to the library's tilebag
        this.gamestate.tilebag.length = 0;
        this.gamestate.tilebag.push(...this.ourBag);

        // 4. Regenerate available moves with the new factory state
        // Access the internal getMoves method via type assertion
        (this.gamestate as any).getMoves();

        // 5. Cleanup distribution UI
        this.bagView?.destroy();
        this.bagView = null;
        this.factoryDropHandler?.destroy();
        this.factoryDropHandler = null;

        // 6. Remove distribution-mode class
        document.getElementById("game")?.classList.remove("distribution-mode");

        // 7. Recreate factories with the actual tiles
        this.display.create_factories(this.gamestate);

        // 8. Add callbacks to factory tiles
        this.assign_factory_callbacks();

        // 9. Exit distribution mode
        this.manualDistributionMode = false;

        // 10. Highlight active player
        this.display.highlight_board(this.gamestate.activePlayer);

        console.log("Manual distribution complete. Starting round.");
    }
}
