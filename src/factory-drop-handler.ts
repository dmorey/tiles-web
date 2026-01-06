// Factory Drop Handler - Manages drop zones on factories during manual distribution

// Tracks state of a single factory during distribution
interface FactoryState {
    factoryId: number;
    tiles: Array<number>;  // Colors of tiles placed (max 4)
    element: HTMLElement;
    tileElements: Array<HTMLElement>;
}

// Callback types
export type OnTileDroppedCallback = (factoryId: number, color: number) => void;
export type OnTileRemovedCallback = (factoryId: number, color: number) => void;

export class FactoryDropHandler {
    private factories: Map<number, FactoryState> = new Map();
    private onTileDropped: OnTileDroppedCallback | null = null;
    private onTileRemoved: OnTileRemovedCallback | null = null;
    private enabled: boolean = true;

    constructor() {}

    // Initialize drop zones on factory elements (skip factory 0 - centre)
    setupDropZones(factoryElements: Array<HTMLElement>): void {
        this.factories.clear();

        factoryElements.forEach((factoryElem, index) => {
            const factoryId = index + 1; // Skip centre (factory 0)
            const tileElements = [...factoryElem.children] as Array<HTMLElement>;

            // Initialize factory state
            this.factories.set(factoryId, {
                factoryId,
                tiles: [],
                element: factoryElem,
                tileElements
            });

            // Setup each tile slot as a drop target
            tileElements.forEach((tileElem, slotIndex) => {
                // Mark as drop target
                tileElem.classList.add("drop-target");
                tileElem.removeAttribute("tile-colour");

                // Drag events
                tileElem.addEventListener("dragover", (e) => this.handleDragOver(e));
                tileElem.addEventListener("dragleave", (e) => this.handleDragLeave(e));
                tileElem.addEventListener("drop", (e) => this.handleDrop(e, factoryId));

                // Click to remove
                tileElem.addEventListener("click", (e) => this.handleTileClick(e, factoryId, slotIndex));
            });
        });
    }

    private handleDragOver(e: DragEvent): void {
        if (!this.enabled) return;
        e.preventDefault();
        e.dataTransfer!.dropEffect = "move";
        (e.target as HTMLElement).classList.add("drag-over");
    }

    private handleDragLeave(e: DragEvent): void {
        (e.target as HTMLElement).classList.remove("drag-over");
    }

    private handleDrop(e: DragEvent, factoryId: number): void {
        e.preventDefault();
        (e.target as HTMLElement).classList.remove("drag-over");

        if (!this.enabled) return;

        const colorStr = e.dataTransfer?.getData("text/plain");
        if (colorStr === undefined || colorStr === "") return;

        const color = parseInt(colorStr);
        if (isNaN(color) || color < 0 || color > 4) return;

        // Try to add tile to this factory
        if (this.addTileToFactory(factoryId, color)) {
            if (this.onTileDropped) {
                this.onTileDropped(factoryId, color);
            }
        }
    }

    private handleTileClick(e: Event, factoryId: number, slotIndex: number): void {
        if (!this.enabled) return;

        const factory = this.factories.get(factoryId);
        if (!factory) return;

        // Check if this slot has a tile
        if (slotIndex < factory.tiles.length) {
            const color = factory.tiles[slotIndex];
            this.removeTileFromFactory(factoryId, slotIndex);
            if (this.onTileRemoved) {
                this.onTileRemoved(factoryId, color);
            }
        }
    }

    // Add a tile to a factory, returns true if successful
    private addTileToFactory(factoryId: number, color: number): boolean {
        const factory = this.factories.get(factoryId);
        if (!factory) return false;

        // Check if factory is full
        if (factory.tiles.length >= 4) return false;

        // Add tile
        factory.tiles.push(color);

        // Update display
        this.updateFactoryDisplay(factoryId);

        return true;
    }

    // Remove a tile from a factory at a specific slot
    private removeTileFromFactory(factoryId: number, slotIndex: number): number | null {
        const factory = this.factories.get(factoryId);
        if (!factory) return null;

        if (slotIndex >= factory.tiles.length) return null;

        // Remove tile
        const color = factory.tiles.splice(slotIndex, 1)[0];

        // Update display
        this.updateFactoryDisplay(factoryId);

        return color;
    }

    private updateFactoryDisplay(factoryId: number): void {
        const factory = this.factories.get(factoryId);
        if (!factory) return;

        // Update each tile slot
        factory.tileElements.forEach((tileElem, index) => {
            if (index < factory.tiles.length) {
                // Slot has a tile
                tileElem.setAttribute("tile-colour", factory.tiles[index].toString());
                tileElem.classList.remove("drop-target");
                tileElem.classList.add("placed");
            } else {
                // Slot is empty
                tileElem.removeAttribute("tile-colour");
                tileElem.classList.add("drop-target");
                tileElem.classList.remove("placed");
            }
        });

        // Update factory complete state
        if (factory.tiles.length === 4) {
            factory.element.classList.add("complete");
        } else {
            factory.element.classList.remove("complete");
        }
    }

    // Check if all factories are filled (or as filled as possible)
    isComplete(totalTilesAvailable: number): boolean {
        let totalPlaced = 0;
        this.factories.forEach(factory => {
            totalPlaced += factory.tiles.length;
        });

        // Complete if we've placed all available tiles or all factories are full
        const maxCapacity = this.factories.size * 4;
        return totalPlaced >= Math.min(totalTilesAvailable, maxCapacity);
    }

    // Get the number of tiles currently placed
    getTotalTilesPlaced(): number {
        let total = 0;
        this.factories.forEach(factory => {
            total += factory.tiles.length;
        });
        return total;
    }

    // Get the final factory configuration (array of tile arrays)
    getFactoryConfiguration(): Array<Array<number>> {
        const config: Array<Array<number>> = [];

        // Get factories in order (1, 2, 3, 4, 5...)
        const sortedIds = [...this.factories.keys()].sort((a, b) => a - b);
        sortedIds.forEach(id => {
            const factory = this.factories.get(id);
            if (factory) {
                config.push([...factory.tiles]);
            }
        });

        return config;
    }

    // Reset all factories to empty
    reset(): void {
        this.factories.forEach((factory, factoryId) => {
            factory.tiles = [];
            this.updateFactoryDisplay(factoryId);
        });
    }

    // Enable/disable drop functionality
    setEnabled(enabled: boolean): void {
        this.enabled = enabled;
    }

    // Set callbacks
    setOnTileDropped(callback: OnTileDroppedCallback): void {
        this.onTileDropped = callback;
    }

    setOnTileRemoved(callback: OnTileRemovedCallback): void {
        this.onTileRemoved = callback;
    }

    // Cleanup
    destroy(): void {
        this.factories.clear();
    }
}
