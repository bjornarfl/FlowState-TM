# Getting Started with FlowState TM

Welcome to FlowState TM! This tutorial will guide you through the basics of creating and managing threat models.

## What You'll Learn

- Understanding the three main views (Diagram, Tables, YAML)
- Creating your first threat model
- Adding components and data flows
- Identifying threats

## The Three Views

FlowState TM provides three synchronized views of your threat model:

### 🎨 Diagram View

Create visual data flow diagrams by dragging and dropping components onto the canvas. This view is perfect for:
- Brainstorming system architecture
- Visualizing data flows
- Communicating with stakeholders

**Try it:** Click on a component type in the toolbar and click anywhere on the canvas to place it.

### 📊 Tables View

Manage all threat model entities in structured tables. Best for:
- Detailed documentation
- Bulk editing
- Reviewing completeness

### 📝 YAML View

View and edit the underlying YAML source. Ideal for:
- Version control workflows
- Advanced editing
- Copy/paste between models

> **Tip:** Changes in any view instantly reflect in the others!

## Creating Your First Component

Components represent the building blocks of your system. Let's create one:

1. Switch to the **Diagram View**
2. Select a component type from the toolbar:
   - **Process** - Applications, services, APIs
   - **Data Store** - Databases, file systems, caches
   - **External Entity** - Users, external systems
3. Click on the canvas to place it
4. Double-click the component to edit its name and details

## Adding Data Flows

Data flows show how information moves through your system:

1. Click the **Data Flow** button in the toolbar
2. Click on the source component
3. Click on the target component
4. A connection appears - click on it to add details

## Identifying Threats

Now comes the security part! For each component and data flow, ask:

- **What could go wrong?** (Spoofing, Tampering, etc.)
- **What's the impact?** (Data breach, service disruption)
- **What are we doing about it?** (Mitigations and controls)

Switch to the **Tables View** → **Threats** tab to document your findings.

## Saving Your Work

FlowState TM offers multiple save options:

- **Browser Storage** - Auto-saved locally (no account needed)
- **Download YAML** - Save to your file system
- **GitHub Integration** - Commit directly to your repository

## Next Steps

You're now ready to create comprehensive threat models! Explore:

- Try the template gallery for common architectures
- Use the GitHub integration for team collaboration
- Export diagrams as PNG/SVG for documentation

---

**Need help?** Check out the other tutorials in the Help menu or visit our [documentation](https://github.com/SecScanBaseline/flowstate-tm).
