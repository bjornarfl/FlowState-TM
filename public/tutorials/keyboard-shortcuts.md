# Keyboard Shortcuts & Hotkeys

## Global Shortcuts

These shortcuts work throughout the application:

### Saving & History

| Shortcut | Action | Description |
|----------|--------|-------------|
| `Cmd/Ctrl + S` | Quick Save | Save to current save source (Browser/File/GitHub) |
| `Cmd/Ctrl + Z` | Undo | Undo the last action |
| `Cmd/Ctrl + Shift + Z` | Redo | Redo the previously undone action |

## Table View
### Table Navigation Shortcuts

When editing cells in tables:

| Shortcut | Action | Description |
|----------|--------|-------------|
| `Tab` | Next Cell | Move to the next cell (right or next row) |
| `Shift + Tab` | Previous Cell | Move to the previous cell (left or previous row) |
| `Arrow Keys` | Navigate | Move between cells when at text boundaries |
| `Enter` | Save & Down | Save current cell and move down |
| `Escape` | Cancel Edit | Discard changes and exit edit mode |

**Navigation Tips:**
- Arrow keys work when your cursor is at the start/end of text
- Use `Tab` and `Shift + Tab` for quick horizontal navigation
- `Enter` saves your changes automatically

### Section Management

| Shortcut | Action | Description |
|----------|--------|-------------|
| `-` | Toggle All Sections | Collapse/expand all table sections at once |

## Canvas View

These shortcuts work when the diagram view is active and you're not editing text:

### Canvas Navigation

| Shortcut | Action | Description |
|----------|--------|-------------|
| `Shift + F` | Fit View | Center and zoom to fit all nodes on screen |
| `option/alt + Arrow Keys` | Move focus | (if a node is focused/selected) shifts focus to the closest node in the direction of the arrow key |

### Node & Edge Editing

| Shortcut | Action | Description |
|----------|--------|-------------|
| `E` | Edit Mode | Start editing the selected node or edge |
| `Tab` | Next input | (While editing a node) Move to the next input |

**Usage:** Select a component or data flow, press `E`, and you can immediately start typing to rename it.

### Multi-Select & Shift Modifier

Canvas nodes can be multi-selected in two different ways:

| Action | Description |
|--------|-------------|
| `Cmd/Ctrl + Click` | Add/remove nodes from selection |
| `Shift + Drag` | Select multiple nodes with box selection |

## Data Flow Creation Shortcuts

When creating or reconnecting data flows, these shortcuts help you navigate through the multi-step process:

### Starting Data Flow Operations

| Shortcut | Action | Description |
|----------|--------|-------------|
| `D` | Start Data Flow | With a node selected: create new data flow<br>With an edge selected: reconnect existing data flow |

### During Data Flow Creation/Reconnection

| Shortcut | Action | Description |
|----------|--------|-------------|
| `Arrow Keys` | Navigate | Move between nodes and handles |
| `Enter` | Confirm | Confirm current selection and proceed to next step |
| `Backspace` | Go Back | Return to the previous step |
| `Escape` | Cancel | Cancel the entire operation |

**Workflow Example:**
1. Select a component
2. Press `D` to start creating a data flow
3. Use `Arrow Keys` to select the source handle
4. Press `Enter` to confirm
5. Navigate to target node with `Arrow Keys`
6. Press `Enter` to confirm
7. Select target handle and press `Enter` again

## YAML Editor Shortcuts

When editing in the YAML view:

| Shortcut | Action | Description |
|----------|--------|-------------|
| `Cmd/Ctrl + S` | Apply Changes | Apply YAML changes to the threat model |
| `Escape` | Reset | Discard YAML changes and revert to previous state |
| `Tab` | Indent | Insert 2 spaces for proper YAML indentation |

> **Note:** YAML is sensitive to indentation. Use `Tab` for consistent formatting!




