# Loading & Saving Threat Models

Learn how to load and save threat models using FlowState TM's different save sources.

> **Note:** FlowState TM has no central database. Everything processed within the application itself happens locally in your browser.

## What You'll Learn

- Understanding the two local save sources (Browser, File)
- How to load and save threat models with each source
- How auto-save and the auto-save draft work
- When to use each method
- Working with the save indicator

## Understanding Save Sources

FlowState TM uses a **save source** system. Each threat model can be associated with one of these save sources:

### 🗄️ Browser Storage (IndexedDB)

- Stored locally in your browser using IndexedDB
- Persists across browser sessions
- Can store multiple named threat models
- Survives browser restarts but NOT if you clear browser data

### 💾 Local File

- Saves to your computer's file system using the File System Access API
- Direct read/write to your .yaml files
- Keeps file handle for seamless saving
- Supports drag-and-drop file loading

### 🔗 GitHub

- Commits directly to your GitHub repository
- Full version control and collaboration
- See the [GitHub Integration](github-integration.md) tutorial for details

## The Auto-Save Draft

FlowState TM maintains a **single ephemeral draft** in IndexedDB that acts as a crash-recovery safety net:

- Automatically saves every 2 seconds as you type
- Stores the last state of your work regardless of save source
- Prompts you to recover if the app crashes or browser closes unexpectedly
- Persists even when you haven't chosen a save source yet

> **Key concept:** The draft is for crash recovery. To actually save your work to Browser Storage, File, or GitHub, you need to use the Save button.

## Save Button & Keyboard Shortcut

Press **⌘S** (Mac) or **Ctrl+S** (Windows/Linux) to quickly save, or click the **Save** button (💾 icon) in the navbar.

### What "Save" Does

The behavior depends on your active save source:

| Save Source | What Happens |
|-------------|--------------|
| **Browser** | Updates the browser storage entry in-place |
| **File** | Writes to your local .yaml file |
| **GitHub** | Opens the commit modal |
| **None** | Shows the file save picker to create a new local file |

The save indicator in the navbar center shows:
- Your current save source (📁 Browser, 💾 File, or 🔗 GitHub)
- "Saved" or "Saving..." status
- Timestamp of last save
- A blue dot (●) when you have unsaved changes

## Browser Storage (IndexedDB)

Browser storage lets you save multiple named threat models locally in your browser.

### Loading from Browser Storage

1. Click **New** (+) → **Load from Browser Storage**
2. Browse your saved models in the list
3. Click on a model to load it

The file browser shows all models with their names and last modified timestamps. You can also rename, duplicate, or delete models from this interface.

### Saving to Browser Storage

**First time:**
1. Click **Save** (💾 dropdown) → **Save to Browser Storage**
2. Your model is saved with its current name

**Subsequent saves:**
- Press **⌘S** (Mac) or **Ctrl+S** (Windows/Linux)
- Or click **Save** → **Save**
- The existing browser entry is updated in-place

This creates or updates an entry in your browser's IndexedDB. You'll see a 🗄️ Database icon in the navbar showing the model name.

### Auto-Save to Browser

Enable **auto-save to browser** in settings (⚙️ icon):
- Changes are automatically written to browser storage every 2 seconds
- The navbar shows "Saved" instead of a timestamp
- No manual saves needed!

### Save to New Browser Entry

To create a copy with a different name:
1. Click **Save** → **Save to New Browser Storage...**
2. Enter a new name (e.g., "Payment API (copy)")
3. A new browser entry is created

## Local Files

Save threat models directly to your computer's file system.

### Loading Local Files

**Method 1: Drag and drop**
- Drag a `.yaml` file directly into the FlowState window

**Method 2: File picker**
1. Click **New** (+) → **Load from Local**
2. Browse and select your `.yaml` file
3. Click **Open**

FlowState stores the **file handle**, allowing direct writes back to the same file.

### Saving to Local Files

**First time:**
1. Click **Save** → **Save to File...**
2. Choose a location and filename (e.g., `payment-api.yaml`)
3. Click **Save**

**Subsequent saves:**
- Press **⌘S** or **Ctrl+S**
- Or click **Save** → **Save**
- FlowState writes directly to your file

You'll see a 💾 icon with the filename in the navbar.

### Save to New File

If you want to save to a different file:

1. Click **Save** → **Save to New File...**
2. Choose a new location/filename
3. The file handle updates to the new file

### Auto-Save to Local Files

Enable **auto-save to local files** in settings (⚙️ icon):
- Changes automatically write to your .yaml file every 2 seconds
- Requires the browser to retain file permissions (works best in Chrome/Edge)
- If permission is lost, you'll be prompted to grant it again

> **Note:** The File System Access API is supported in Chrome, Edge, and other Chromium browsers. Firefox and Safari have limited support.

## GitHub Integration

For version control and team collaboration, FlowState offers GitHub integration. See the dedicated [GitHub Integration](github-integration.md) tutorial for:

- Setting up Personal Access Tokens
- Understanding the `.threat-models` folder convention  
- Committing and loading from GitHub
- Using extra files (diagrams and markdown)
- Alternative workflows with standard git commands

## Download ZIP Folder

For complete documentation export:

1. Click **Save** → **Download ZIP Folder**
2. FlowState creates a `.zip` containing:
   - `threat_model.yaml` - The threat model file
   - `diagram.png` - Data flow diagram image
   - `README.md` - Markdown documentation with tables and diagram

Perfect for sharing with stakeholders or archiving.