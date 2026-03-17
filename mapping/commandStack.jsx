/**
 * COMMAND STACK FOUNDATION
 * Undo/Redo infrastructure for Pro Mapping
 * All map mutations must go through commands
 */

export class Command {
  constructor(name) {
    this.name = name;
    this.timestamp = Date.now();
  }

  execute() {
    throw new Error('Command.execute() must be implemented');
  }

  undo() {
    throw new Error('Command.undo() must be implemented');
  }
}

export class CommandStack {
  constructor(maxSize = 50) {
    this.undoStack = [];
    this.redoStack = [];
    this.maxSize = maxSize;
  }

  execute(command) {
    command.execute();
    this.undoStack.push(command);
    
    // Trim if exceeds max size
    if (this.undoStack.length > this.maxSize) {
      this.undoStack.shift();
    }
    
    // Clear redo stack on new action
    this.redoStack = [];
  }

  undo() {
    if (this.undoStack.length === 0) return false;
    
    const command = this.undoStack.pop();
    command.undo();
    this.redoStack.push(command);
    
    return true;
  }

  redo() {
    if (this.redoStack.length === 0) return false;
    
    const command = this.redoStack.pop();
    command.execute();
    this.undoStack.push(command);
    
    return true;
  }

  canUndo() {
    return this.undoStack.length > 0;
  }

  canRedo() {
    return this.redoStack.length > 0;
  }

  clear() {
    this.undoStack = [];
    this.redoStack = [];
  }

  getUndoCount() {
    return this.undoStack.length;
  }

  getRedoCount() {
    return this.redoStack.length;
  }
}

// Singleton instance
let globalCommandStack = null;

export function getCommandStack() {
  if (!globalCommandStack) {
    globalCommandStack = new CommandStack();
  }
  return globalCommandStack;
}

export function resetCommandStack() {
  globalCommandStack = new CommandStack();
  return globalCommandStack;
}