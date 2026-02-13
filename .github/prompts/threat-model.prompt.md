---
description: Create a threat model using the FlowState-TM YAML format.
agent: 'agent'
tools: ['search', 'edit', 'read', 'web', 'todo']
---

# Threat Model Generation

When generating threat models, follow these guidelines to create structured YAML threat models that comply with the FlowState-TM schema.

## Format and Schema

All threat models must be valid YAML files following the threat model schema v1.0.

## Structure Requirements

### Required Root Properties
```yaml
schema_version: '1.0'
name: [Descriptive name of the system]
description: [Brief description of what the system does]
```

### Optional Root Properties
- `owner`: GitHub organization or username for issue tracking
- `repository`: GitHub repository name for issue tracking

## Core Sections

### 1. Assets
Assets represent data or resources that need protection. Each asset must have:
- `ref`: Unique identifier (lowercase, alphanumeric, hyphens/underscores only)
- `name`: Human-readable name
- `description`: What the asset is and why it's important

Example:
```yaml
assets:
  - ref: user-credentials
    name: User Credentials
    description: Usernames, passwords, and authentication tokens
```

### 2. Components
Components are the building blocks of the system. Each component must have:
- `ref`: Unique identifier (lowercase, alphanumeric, hyphens/underscores only)
- `name`: Human-readable name
- `component_type`: Must be one of:
  - `internal`: Components you control (applications, services)
  - `external_dependency`: External entities (users, third-party services)
  - `data_store`: Databases, file systems, caches
- `description`: What the component does
- `assets`: (optional) Array of asset refs that this component processes or stores
- `x`, `y`: (optional) Coordinates for visual positioning in diagram

Example:
```yaml
components:
  - ref: api-server
    name: API Server
    component_type: internal
    description: REST API handling business logic
    assets: [user-credentials, business-data]
    x: 200
    y: 100
```

### 3. Data Flows
Data flows represent connections between components. Each data flow must have:
- `ref`: Unique identifier (can include `<->` or `->` for clarity)
- `source`: Component ref where data originates
- `destination`: Component ref where data goes
- `direction`: Either `unidirectional` or `bidirectional`
- `label`: (optional) Protocol or data type (e.g., "HTTPS", "SQL", "gRPC")
- `source_point`, `destination_point`: (optional) Connection points on components
  - Format: `{side}-{position}` where side is `top|right|bottom|left` and position is `1|2|3`
  - Positions are ordered left-to-right for top/bottom, top-to-bottom for left/right

Example:
```yaml
data_flows:
  - ref: client<->api
    source: mobile-client
    destination: api-server
    direction: bidirectional
    label: HTTPS/JSON
    source_point: right-2
    destination_point: left-2
```

### 4. Boundaries
Boundaries represent trust boundaries separating different security zones. Each boundary must have:
- `ref`: Unique identifier
- `name`: Human-readable name
- `description`: What the boundary represents
- `components`: Array of component refs within this boundary
- `x`, `y`, `width`, `height`: (optional) Visual dimensions for diagram

Example:
```yaml
boundaries:
  - ref: dmz
    name: DMZ
    description: Demilitarized zone accessible from internet
    components: [api-server, web-server]
    x: 150
    y: 50
    width: 300
    height: 200
```

### 5. Threats
Threats identify potential security risks. Each threat must have:
- `ref`: Unique identifier
- `name`: Human-readable threat name
- `description`: Detailed description of the threat, attack vectors, and potential impact
- `affected_components`: (optional) Array of component refs
- `affected_data_flows`: (optional) Array of data flow refs
- `affected_assets`: (optional) Array of asset refs

Use STRIDE methodology when identifying threats:
- **S**poofing: Impersonating users or systems
- **T**ampering: Unauthorized modification of data
- **R**epudiation: Denying actions or transactions
- **I**nformation Disclosure: Exposing sensitive information
- **D**enial of Service: Making system unavailable
- **E**levation of Privilege: Gaining unauthorized access

Example:
```yaml
threats:
  - ref: api-auth-bypass
    name: API Authentication Bypass
    description: |
      Attacker exploits weak authentication to access API endpoints
      without valid credentials. Could lead to unauthorized data access
      and manipulation of user accounts.
    affected_components: [api-server]
    affected_data_flows: [client<->api]
    affected_assets: [user-credentials, business-data]
```

### 6. Controls
Controls are security measures that mitigate threats. Each control must have:
- `ref`: Unique identifier
- `name`: Human-readable control name
- `description`: How the control works and what it protects
- `mitigates`: (optional) Array of threat refs that this control addresses
- `implemented_in`: (optional) Array of component refs where control is implemented
- `status`: (optional) One of: `To Do`, `In Progress`, `Done`, `Cancelled`
- `status_note`: (optional) Additional implementation notes

Example:
```yaml
controls:
  - ref: jwt-authentication
    name: JWT Authentication
    description: |
      Implement JWT-based authentication for all API endpoints.
      Tokens expire after 1 hour and require refresh.
    mitigates: [api-auth-bypass]
    implemented_in: [api-server]
    status: In Progress
    status_note: Implementation started, pending code review.
```

## Best Practices

1. **Start with Architecture**: Define components and data flows first to understand the system
2. **Identify Assets**: Determine what data needs protection
3. **Draw Boundaries**: Group components by trust level
4. **Apply STRIDE**: Systematically identify threats for each component and data flow
5. **Define Controls**: For each threat, specify mitigating controls
6. **Be Specific**: Use detailed descriptions explaining attack vectors and impacts
7. **Use References**: Always link threats to affected components/flows/assets
8. **Track Status**: Use status fields to track control implementation
9. **Manage Scope**: For large or complex systems, divide into multiple threat models with focused scopes rather than creating one massive model. Examples:
   - Separate models for frontend, backend, and infrastructure
   - One model per microservice or major component
   - Models organized by trust boundary or security domain
   - This improves maintainability and makes threat analysis more manageable

## Reference Naming Conventions

- Use lowercase letters, numbers, hyphens, and underscores only
- Be descriptive: `user-auth-db` not `db1`
- For data flows, use arrows to indicate direction: `client->server` or `client<->server`
- Keep refs concise but meaningful

## Complete Example

Here's a complete example of a simple web application threat model:

```yaml
schema_version: '1.0'
name: Simple Web Application
description: A basic web application with database backend

# Assets - Data or resources that need protection
assets:
  - ref: user-data
    name: User Data
    description: Personal information and credentials

  - ref: session-info
    name: Session Information
    description: User session tokens and related data

# Components - System parts (users, applications, databases)
components:
  - ref: user
    name: User
    component_type: external_dependency
    description: End user accessing the application
    x: 0
    y: 0

  - ref: web-app
    name: Web Application
    component_type: internal
    description: Node.js web application
    assets: [user-data, session-info]
    x: 300
    y: 0

  - ref: database
    name: Database
    component_type: data_store
    description: PostgreSQL database
    assets: [user-data]
    x: 300
    y: 150

# Data Flows - Connections between components
data_flows:
  - ref: user<->web-app
    source: user
    destination: web-app
    source_point: right-2
    destination_point: left-2
    direction: bidirectional
    label: HTTPS

  - ref: web-app->database
    source: web-app
    destination: database
    source_point: bottom-2
    destination_point: top-2
    direction: unidirectional
    label: SQL

# Boundaries - Trust boundaries in the system
boundaries:
  - ref: internal-network
    name: Internal Network
    description: Trusted internal network
    components: [web-app, database]
    width: 180
    height: 250
    x: 275
    y: -25

# Threats - Potential security threats
threats:
  - ref: sql-injection
    name: SQL Injection
    description: |
      Attacker injects malicious SQL through user inputs.
      This can lead to unauthorized data access, modification, or deletion.
      Common attack vectors include login forms and search fields.
    affected_components: [web-app]
    affected_data_flows: [user<->web-app, web-app->database]
    affected_assets: [user-data]

  - ref: xss
    name: Cross-Site Scripting (XSS)
    description: |
      Attacker injects malicious scripts into web pages.
      Can be used to steal session tokens or redirect users to malicious sites.
    affected_components: [web-app]
    affected_data_flows: [user<->web-app]
    affected_assets: [session-info]

  - ref: session-hijacking
    name: Session Hijacking
    description: |
      Attacker steals or predicts session tokens to impersonate users.
      Can occur through XSS, network sniffing, or weak token generation.
    affected_components: [web-app]
    affected_assets: [session-info]

# Controls - Security measures to mitigate threats
controls:
  - ref: input-validation
    name: Input Validation
    description: |
      Validate and sanitize all user inputs before processing.
      Use parameterized queries to prevent SQL injection.
    mitigates: [sql-injection]
    implemented_in: [web-app]
    status: Done
    status_note: Implemented using ORM with built-in sanitization.

  - ref: output-encoding
    name: Output Encoding
    description: |
      Encode all dynamic content before rendering in HTML.
      Use Content Security Policy headers to prevent script injection.
    mitigates: [xss]
    implemented_in: [web-app]
    status: In Progress
    status_note: Some CSP headers implemented, reviewing encoding functions.

  - ref: secure-session-management
    name: Secure Session Management
    description: |
      Use cryptographically random session tokens.
      Implement HTTPOnly and Secure cookie flags.
      Set appropriate session timeout and rotation policies.
    mitigates: [session-hijacking]
    implemented_in: [web-app]
    status: To Do
```

## Validation

Your generated threat model must:
- Be valid YAML syntax
- Have `schema_version: '1.0'` and a `name` field
- Use only valid `component_type` values: `internal`, `external_dependency`, `data_store`
- Use only valid `direction` values: `unidirectional`, `bidirectional`
- Use only valid `status` values: `To Do`, `In Progress`, `Done`, `Cancelled`
- Have all refs in lowercase with only alphanumerics, hyphens, and underscores
- Have all referenced refs (in assets, mitigates, affected_*, etc.) actually exist in the model

## Scope and Project Analysis

### Default Behavior
By default, analyze the **entire project** to create a comprehensive threat model:
1. Examine the project structure, dependencies, and technologies used
2. Identify all major components, services, and integrations
3. Map data flows between components
4. Create a threat model covering the complete system architecture

### Scoped Threat Models
If the user specifies a particular scope, focus only on that area:
- **Examples**: "Create a threat model for the API layer", "Threat model for the authentication service", "Frontend security model"
- When scoped, clearly state the boundaries in the threat model's `name` and `description`
- Include only components, data flows, and threats relevant to the specified scope
- Note dependencies or connections to out-of-scope components as `external_dependency` types

### When to Recommend Multiple Models
If analyzing the entire project reveals high complexity, recommend creating multiple scoped threat models:
- Systems with 10+ components may benefit from subdivision
- Complex microservices architectures
- Monorepo structures
- Systems with distinct security domains or trust boundaries

## When Creating a Threat Model

1. **Determine Scope**: Analyze entire project unless user specifies a specific scope
2. **Examine Project Structure**: Review code, configuration files, dependencies, and documentation
3. **Ask if Unclear**: If architecture or technologies are unclear, ask clarifying questions
4. **Identify Components**: Map out all components, actors, and data stores within scope
5. **Map Data Flows**: Trace how data moves between components
6. **Identify Assets**: Determine what data needs protection
7. **Define Boundaries**: Establish trust boundaries between security zones
8. **Apply STRIDE**: Systematically identify threats for each component and data flow
9. **Propose Controls**: Define security controls for each identified threat
10. **Output YAML**: Generate a complete, valid YAML threat model file in the `.threat-models/` directory
    - Create the `.threat-models/` directory if it doesn't exist
    - Use descriptive filenames: `system-name.yaml` or `component-name.yaml`
    - For multiple scoped models: `frontend.yaml`, `api.yaml`, `database.yaml`, etc.

The goal is to create a comprehensive, actionable threat model that can be used for security analysis and tracking remediation efforts.