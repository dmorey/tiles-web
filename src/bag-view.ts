// Bag View Component - Displays tiles remaining in the bag for manual distribution

import { Tile } from "azul-tiles";

// Tile counts by color
export interface TileCounts {
    [color: number]: number;
}

// Callback types
export type OnTilePlacedCallback = (color: number) => boolean;
export type OnDistributionCompleteCallback = () => void;

export class BagView {
    private container: HTMLElement;
    private tileCounts: TileCounts = {};
    private tilesPlaced: number = 0;
    private tilesNeeded: number = 0;
    private onTilePlaced: OnTilePlacedCallback | null = null;
    private onDistributionComplete: OnDistributionCompleteCallback | null = null;
    private startRoundBtn: HTMLButtonElement | null = null;

    constructor(parentElement: HTMLElement) {
        this.container = document.createElement("div");
        this.container.className = "bag-view";
        this.container.id = "bag-view";
        parentElement.insertBefore(this.container, parentElement.firstChild);
    }

    // Count tiles in the bag by color
    private countTilesInBag(tilebag: Array<number>): TileCounts {
        const counts: TileCounts = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 };
        tilebag.forEach(tile => {
            if (tile >= 0 && tile <= 4) {
                counts[tile]++;
            }
        });
        return counts;
    }

    // Create the bag view UI
    create(tilebag: Array<number>, tilesNeeded: number): void {
        this.tileCounts = this.countTilesInBag(tilebag);
        this.tilesNeeded = tilesNeeded;
        this.tilesPlaced = 0;

        // Calculate total available tiles
        const totalAvailable = Object.values(this.tileCounts).reduce((a, b) => a + b, 0);
        const actualNeeded = Math.min(tilesNeeded, totalAvailable);

        this.container.innerHTML = `
            <h3>Drag tiles to factories</h3>
            <div class="bag-tiles"></div>
            <div class="bag-status">
                <span>Tiles to place: <strong id="tiles-remaining">${actualNeeded}</strong></span>
                <span>Available in bag: <strong id="tiles-available">${totalAvailable}</strong></span>
            </div>
            <button id="start-round-btn" disabled>Start Round</button>
        `;

        const bagTilesContainer = this.container.querySelector(".bag-tiles") as HTMLElement;

        // Create tile groups for each color
        for (let color = 0; color <= 4; color++) {
            const group = this.createTileGroup(color, this.tileCounts[color]);
            bagTilesContainer.appendChild(group);
        }

        // Setup start round button
        this.startRoundBtn = this.container.querySelector("#start-round-btn") as HTMLButtonElement;
        this.startRoundBtn.addEventListener("click", () => {
            if (this.onDistributionComplete) {
                this.onDistributionComplete();
            }
        });

        this.updateStatus();
    }

    // Create a tile group with draggable tile and count
    private createTileGroup(color: number, count: number): HTMLElement {
        const group = document.createElement("div");
        group.className = "bag-tile-group";
        group.setAttribute("data-color", color.toString());

        const tile = document.createElement("div");
        tile.className = "tile bag-tile border";
        tile.setAttribute("tile-colour", color.toString());
        tile.setAttribute("draggable", "true");

        if (count === 0) {
            tile.classList.add("empty");
            tile.setAttribute("draggable", "false");
        }

        // Drag events
        tile.addEventListener("dragstart", (e) => this.handleDragStart(e, color));
        tile.addEventListener("dragend", (e) => this.handleDragEnd(e));

        const countSpan = document.createElement("span");
        countSpan.className = "tile-count";
        countSpan.id = `tile-count-${color}`;
        countSpan.textContent = count.toString();
        if (count === 0) {
            countSpan.classList.add("zero");
        }

        group.appendChild(tile);
        group.appendChild(countSpan);

        return group;
    }

    private handleDragStart(e: DragEvent, color: number): void {
        if (this.tileCounts[color] <= 0) {
            e.preventDefault();
            return;
        }

        e.dataTransfer?.setData("text/plain", color.toString());
        e.dataTransfer!.effectAllowed = "move";
        (e.target as HTMLElement).classList.add("dragging");
    }

    private handleDragEnd(e: DragEvent): void {
        (e.target as HTMLElement).classList.remove("dragging");
    }

    // Called when a tile is successfully placed on a factory
    tilePlaced(color: number): void {
        if (this.tileCounts[color] > 0) {
            this.tileCounts[color]--;
            this.tilesPlaced++;
            this.updateTileDisplay(color);
            this.updateStatus();
        }
    }

    // Called when a tile is returned from a factory
    tileReturned(color: number): void {
        this.tileCounts[color]++;
        this.tilesPlaced--;
        this.updateTileDisplay(color);
        this.updateStatus();
    }

    private updateTileDisplay(color: number): void {
        const countSpan = document.getElementById(`tile-count-${color}`);
        const tileGroup = this.container.querySelector(`[data-color="${color}"]`);
        const tile = tileGroup?.querySelector(".bag-tile") as HTMLElement;

        if (countSpan) {
            countSpan.textContent = this.tileCounts[color].toString();
            if (this.tileCounts[color] === 0) {
                countSpan.classList.add("zero");
            } else {
                countSpan.classList.remove("zero");
            }
        }

        if (tile) {
            if (this.tileCounts[color] === 0) {
                tile.classList.add("empty");
                tile.setAttribute("draggable", "false");
            } else {
                tile.classList.remove("empty");
                tile.setAttribute("draggable", "true");
            }
        }
    }

    private updateStatus(): void {
        const totalAvailable = Object.values(this.tileCounts).reduce((a, b) => a + b, 0);
        const remaining = Math.min(this.tilesNeeded, totalAvailable + this.tilesPlaced) - this.tilesPlaced;

        const tilesRemainingElem = document.getElementById("tiles-remaining");
        const tilesAvailableElem = document.getElementById("tiles-available");

        if (tilesRemainingElem) {
            tilesRemainingElem.textContent = remaining.toString();
        }
        if (tilesAvailableElem) {
            tilesAvailableElem.textContent = totalAvailable.toString();
        }

        // Enable start button when all available tiles are placed
        if (this.startRoundBtn) {
            const allPlaced = remaining === 0 || totalAvailable === 0;
            this.startRoundBtn.disabled = !allPlaced;
        }
    }

    // Get remaining tile counts
    getRemainingCounts(): TileCounts {
        return { ...this.tileCounts };
    }

    // Get number of tiles placed
    getTilesPlaced(): number {
        return this.tilesPlaced;
    }

    // Set callback for when distribution is complete
    setOnDistributionComplete(callback: OnDistributionCompleteCallback): void {
        this.onDistributionComplete = callback;
    }

    // Show/hide the bag view
    show(): void {
        this.container.style.display = "";
    }

    hide(): void {
        this.container.style.display = "none";
    }

    // Cleanup
    destroy(): void {
        this.container.remove();
    }
}
