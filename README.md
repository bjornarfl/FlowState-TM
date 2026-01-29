<div align="center">
  <img src="public/favicon.svg" alt="FlowState TM Logo" width="120" height="120">
</div>

# FlowState TM - A threat modeling editor

A browser-based threat modeling application that helps security professionals and developers visualize and document what they are working on, what can go wrong, and what they are going to do about it. View and edit your threat models as interactive diagrams and tables, and everything will be defined in simple YAML files.

## What is Threat Modeling?

Threat modeling is a structured approach to identifying and addressing security risks in software systems. It helps teams:
- **Identify assets** worth protecting (data, resources)
- **Map system components** and their interactions
- **Discover potential threats** before they become vulnerabilities
- **Document security controls** that mitigate risks

## Why FlowState?

Threat modeling for me has traditionally relied on static documentation tools (Confluence, draw.io), which are easy to use but lack integration with development workflows. I wanted to leverage the benefits of **Threat Modeling as Code** - storing threat models alongside source code for version control, CI/CD integration, and better traceability.

There are many existing TM-as-code tools available, but in my personal opinion, they tend to be overly complicated or get in the way of the actual process. The most productive TMs i have participated in were done with everyone in the same room using only a whiteboard.

**This tool aims to bridge that gap**: YAML files as the source of truth, with synchronized views (visual canvas, structured tables, direct YAML editing) that aims to emulate the fluidity of whiteboard collaboration while maintaining all the benefits of code-based formats and workflows.

## Features

Create and edit Threat Models using three main views. Changes made in one view will reflect to the others:
- **🎨 Diagram View**: Easily create and edit Data-Flow-Diagrams (leveraging the [React Flow](https://reactflow.dev/) library)
- **📊 Tables View**: Structured data in editable tables
- **📝 YAML View**: Direct source code editing
  
### YAML-Based Format
Define threat models in human-readable YAML format with a clear schema for:
- **Assets**: Data and resources requiring protection
- **Components**: System elements (internal services, external dependencies, data stores)
- **Data Flows**: Connections showing how data moves between components
- **Boundaries**: Trust boundaries separating security zones
- **Threats**: The things that can go wrong in your system
- **Controls**: Security measures mitigating identified threats

### 💾 Managing your threat models
- **Load from file**: Upload your own YAML threat model files to start editing
- **Load from browser**: Save and load threat models stored in your browser
- **Example models**: Try pre-built examples and starter templates
The entire editor runs on the client-side, so your files never leave your computer.

### �📥 Export Options
- Download modified threat models as YAML files
- Export diagrams as PNG images
- Export as markdown file

## Usage

### Getting Started

1. Visit the [application](#)
2. Choose how to start:
   - **Try an example**: Select from pre-built threat models
   - **Upload a file**: Load your own YAML threat model
   - **Start from empty**: Begin with a blank template

### Creating a Threat Model

Threat models are defined using YAML with the following structure:

```yaml
schema_version: '1.0'
name: My Application
description: Description of what you're modeling

# Assets - Represents data or resources that need protection
assets:
  - ref: user-data
    name: User Data
    description: Personal information requiring protection

# Components - Represents the objects in a threat model (users, applications, databases, etc.)
components:
  - ref: web-app
    name: Web Application
    component_type: internal
    description: Main application server
    assets: [user-data]
    x: 300
    y: 0

# Data Flows - Represents connections between components with data flowing between them
data_flows:
  - ref: user<->web-app
    source: user
    destination: web-app
    direction: bidirectional
    label: HTTPS

# Boundaries - Represents trust boundaries in the system
boundaries:
  - ref: dmz
    name: DMZ
    description: Demilitarized zone
    components: [web-app]

# Threats - Represents potential security threats to the system
threats:
  - ref: threat-1
    name: SQL Injection
    description: Malicious SQL via user input
    affected_components: [web-app]
    affected_assets: [user-data]

# Controls - Represents security measures implemented to mitigate threats
controls:
  - ref: control-1
    name: Parameterized Queries
    description: Use prepared statements
    status: To Do
    mitigates: [threat-1]
    implemented_in: [web-app]
```