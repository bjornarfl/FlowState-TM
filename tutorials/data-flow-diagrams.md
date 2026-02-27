# Data Flow Diagrams

Data Flow Diagrams (DFDs) are visual representations that show how data moves through a system. In threat modeling, DFDs help identify where threats might occur by mapping the flow of information.

## Why Use DFDs?

DFDs make security analysis visual and systematic:

- **See the big picture** - Understand how components interact
- **Identify attack surfaces** - Spot where data enters and exits the system
- **Find trust boundaries** - See where security controls are needed
- **Communicate clearly** - Share security concerns with technical and non-technical stakeholders

## Core Elements

### Internal Components

Anything you/your team have controll over that processes or transforms data:

- Web servers
- APIs
- Databases
- Microservices
- Background jobs

**In FlowState** they are depicted as rectangles with rounded corners:

<svg width="200" height="80" xmlns="http://www.w3.org/2000/svg">
  <rect x="10" y="10" width="180" height="60" rx="30" ry="30" fill="var(--bg-secondary)" stroke="var(--node-border)" stroke-width="2"/>
  <text x="100" y="45" text-anchor="middle" font-family="Arial, sans-serif" font-size="14" fill="var(--text-primary)">Component</text>
</svg>

### External Components

People or systems outside your control that interact with your system:

- Users
- Administrators
- Third-party services
- External APIs

**In FlowState** they are depicted as rectangles with straight corners:

<svg width="200" height="80" xmlns="http://www.w3.org/2000/svg">
  <rect x="10" y="10" width="180" height="60" fill="var(--bg-secondary)" stroke="var(--node-border)" stroke-width="2"/>
  <text x="100" y="45" text-anchor="middle" font-family="Arial, sans-serif" font-size="14" fill="var(--text-primary)">External Entity</text>
</svg>

### Data Stores

Places where data is persisted:

- Databases
- File systems
- Caches
- Message queues

**In FlowState** they are depicted as two parallel lines:

<svg width="200" height="80" xmlns="http://www.w3.org/2000/svg">
  <line x1="10" y1="20" x2="190" y2="20" stroke="var(--node-border)" stroke-width="2"/>
  <line x1="10" y1="60" x2="190" y2="60" stroke="var(--node-border)" stroke-width="2"/>
  <text x="100" y="45" text-anchor="middle" font-family="Arial, sans-serif" font-size="14" fill="var(--text-primary)">Data Store</text>
</svg>

### Data Flows

Arrows showing how information moves:

- HTTP requests/responses
- Database queries
- API calls
- File uploads
- Messages

**In FlowState** they are depicted as directed arrows with labels:

<svg width="250" height="60" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <marker id="arrowhead" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto">
      <polygon points="0 0, 10 3, 0 6" fill="var(--node-border)"/>
    </marker>
  </defs>
  <line x1="10" y1="40" x2="230" y2="40" stroke="var(--node-border)" stroke-width="2" marker-end="url(#arrowhead)"/>
  <text x="120" y="25" text-anchor="middle" font-family="Arial, sans-serif" font-size="12" fill="var(--text-primary)">Data Flow</text>
</svg>

### Trust Boundaries

Lines separating security zones with different trust levels. Where flows from internal to external entities:

- Internet vs. internal network
- User space vs. admin space
- Client-side vs. server-side
- One microservice vs. another

**In FlowState** they are depicted as boxes with red dashed borders:

<svg width="200" height="120" xmlns="http://www.w3.org/2000/svg">
  <rect x="10" y="10" width="180" height="100" fill="none" stroke="var(--entity-boundaries-border)" stroke-width="2" stroke-dasharray="5,5"/>
  <text x="100" y="65" text-anchor="middle" font-family="Arial, sans-serif" font-size="14" fill="var(--entity-boundaries-border)" font-weight="bold">Trust Boundary</text>
</svg>

## Building Your First DFD

### 1. Start with External Components

Identify who or what interacts with your system:

- End users
- Administrators
- Partner systems

### 2. Add Your Internal Components

Map the key components that handle data:

- Authentication service
- Application server
- Payment processor

### 3. Include Data Stores

Show where data is stored:

- User database
- Session store
- File storage

### 4. Draw Data Flows

Connect components with arrows showing:

- Direction of data movement
- Type of data being transferred
- Protocol used (HTTP, HTTPS, SQL, etc.)

### 5. Mark Trust Boundaries

Draw lines around:

- Different network zones
- Different privilege levels
- Different organizations

## DFD Best Practices
>
> "All models are wrong, but some are useful"

**Keep it simple**

- Start high-level, add detail as needed
- Don't model every detail upfront
- Focus on security-relevant flows
- Set a managable scope

**Label everything**

- Name each component clearly
- Describe what type of data the data flows contain

**Show trust boundaries**

- Crossing boundaries = higher risk
- Add security controls at boundaries
- Validate all inputs at boundaries

**Focus on data, not control flow**

- Show what data moves, not how code executes
- Avoid implementation details
- Think about information, not functions
