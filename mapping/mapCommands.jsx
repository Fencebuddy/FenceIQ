/**
 * MAP EDITING COMMANDS
 * Concrete command implementations for Pro Mapping
 */

import { Command } from './commandStack';

/**
 * Delete Objects Command
 * Supports deleting fence lines, gates, structures, etc.
 */
export class DeleteObjectsCommand extends Command {
  constructor(selectedItems, getStateFn, setStateFn) {
    super('DeleteObjects');
    this.selectedItems = selectedItems;
    this.getState = getStateFn;
    this.setState = setStateFn;
    this.savedState = null;
  }

  execute() {
    // Save current state
    const currentState = this.getState();
    this.savedState = JSON.parse(JSON.stringify(currentState));
    
    // Delete selected items
    const newState = { ...currentState };
    
    this.selectedItems.forEach(item => {
      if (item.type === 'line' && newState.fenceLines) {
        newState.fenceLines = newState.fenceLines.filter((_, i) => i !== item.index);
      } else if (item.type === 'gate' && newState.gates) {
        newState.gates = newState.gates.filter((_, i) => i !== item.index);
      } else if (item.type === 'doubleGate' && newState.doubleGates) {
        newState.doubleGates = newState.doubleGates.filter((_, i) => i !== item.index);
      } else if (item.type === 'tree' && newState.trees) {
        newState.trees = newState.trees.filter((_, i) => i !== item.index);
      } else if (item.type === 'house' && newState.houses) {
        newState.houses = newState.houses.filter((_, i) => i !== item.index);
      } else if (item.type === 'pool' && newState.pools) {
        newState.pools = newState.pools.filter((_, i) => i !== item.index);
      } else if (item.type === 'garage' && newState.garages) {
        newState.garages = newState.garages.filter((_, i) => i !== item.index);
      } else if (item.type === 'dog' && newState.dogs) {
        newState.dogs = newState.dogs.filter((_, i) => i !== item.index);
      } else if (item.type === 'annotation' && newState.annotations) {
        newState.annotations = newState.annotations.filter((_, i) => i !== item.index);
      }
    });
    
    this.setState(newState);
  }

  undo() {
    if (this.savedState) {
      this.setState(this.savedState);
    }
  }
}

/**
 * Add Fence Line Command
 */
export class AddFenceLineCommand extends Command {
  constructor(line, getStateFn, setStateFn) {
    super('AddFenceLine');
    this.line = line;
    this.getState = getStateFn;
    this.setState = setStateFn;
    this.addedIndex = null;
  }

  execute() {
    const currentState = this.getState();
    const newLines = [...(currentState.fenceLines || []), this.line];
    this.addedIndex = newLines.length - 1;
    this.setState({ ...currentState, fenceLines: newLines });
  }

  undo() {
    if (this.addedIndex !== null) {
      const currentState = this.getState();
      const newLines = currentState.fenceLines.filter((_, i) => i !== this.addedIndex);
      this.setState({ ...currentState, fenceLines: newLines });
    }
  }
}

/**
 * Move Fence Line Command
 */
export class MoveFenceLineCommand extends Command {
  constructor(lineIndex, newStart, newEnd, getStateFn, setStateFn) {
    super('MoveFenceLine');
    this.lineIndex = lineIndex;
    this.newStart = newStart;
    this.newEnd = newEnd;
    this.getState = getStateFn;
    this.setState = setStateFn;
    this.oldStart = null;
    this.oldEnd = null;
  }

  execute() {
    const currentState = this.getState();
    const line = currentState.fenceLines[this.lineIndex];
    
    // Save old position
    this.oldStart = { ...line.start };
    this.oldEnd = { ...line.end };
    
    // Apply new position
    const newLines = [...currentState.fenceLines];
    newLines[this.lineIndex] = {
      ...line,
      start: this.newStart,
      end: this.newEnd,
      length: this.calculateDistance(this.newStart, this.newEnd)
    };
    
    this.setState({ ...currentState, fenceLines: newLines });
  }

  undo() {
    const currentState = this.getState();
    const newLines = [...currentState.fenceLines];
    newLines[this.lineIndex] = {
      ...newLines[this.lineIndex],
      start: this.oldStart,
      end: this.oldEnd,
      length: this.calculateDistance(this.oldStart, this.oldEnd)
    };
    this.setState({ ...currentState, fenceLines: newLines });
  }

  calculateDistance(p1, p2) {
    const PIXELS_PER_FOOT = 10;
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const pixels = Math.sqrt(dx * dx + dy * dy);
    return pixels / PIXELS_PER_FOOT;
  }
}