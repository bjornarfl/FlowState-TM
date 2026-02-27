# What is Threat Modeling?

Threat modeling is a structured approach to identifying, analyzing, and mitigating security risks in a system before they become real problems.

## Why Threat Model?

Think of threat modeling like reviewing architectural blueprints before building a house. It's much cheaper and easier to fix security issues during design than after deployment.

**Key benefits:**

- **Find problems early** - Identify vulnerabilities before writing code
- **Save time and money** - Prevention costs less than fixing breaches
- **Prioritize security work** - Focus on the most critical risks first
- **Build security culture** - Get everyone thinking about security

## When to Threat Model

Ideally, threat modeling should be done at the begining of the development process.

- **New projects** - During the design phase
- **Feature changes** - Before adding new functionality
- **Architecture changes** - When modifying system structure
- **Regular reviews** - Periodically revisit existing systems

## The Process

1. **Map your system** - Create a diagram showing components and data flows
2. **Identify threats** - For each component and flow, ask "what could go wrong?"
3. **Define mitigations** - Decide how to address each threat
4. **Implement** - Build and implement the identified mitigations
5. **Maintain** - Update the threat model as the system evolves

## The Four Question Framework

Threat modeling can be broken down into four fundamental questions:

### 1️⃣ What are we working on?

Document your system's architecture in a data flow diagram (DFD):

- **Components** - Servers, databases, APIs, users, external services
- **Assets** - What you're protecting: customer data, credentials, intellectual property, availability
- **Data Flows** - How information moves between components
- **Trust Boundaries** - Lines separating different security zones (e.g., internal network vs. internet)

The diagram should show what you're building, what needs protection, and how data moves through it.

### 2️⃣ What can go wrong?

Identify potential threats to your system. Some common threat categories following the STRIDE framework:

- **Spoofing** - Impersonating users or systems
- **Tampering** - Modifying data or code
- **Repudiation** - Denying actions taken
- **Information Disclosure** - Exposing sensitive data
- **Denial of Service** - Making systems unavailable
- **Elevation of Privilege** - Gaining unauthorized access

For each component and data flow, ask: "How could an attacker abuse this?"

### 3️⃣ What are we going to do about it?

For each identified threat, decide how to respond. This includes:

- **Accept** - Acknowledge the risk but take no action (e.g., low impact, low likelihood)
- **Mitigate** - Implement controls to reduce the risk (e.g., encryption, authentication)
- **Avoid** - Change the design to eliminate the risk entirely
- **Dismiss** - Determine that the threat is not relevant (e.g., out of scope)

### 4️⃣ Did we do a good job?

Validate your threat model by asking:

- Did we scope the threat model correctly? Are there other parts of the system we should include?
- Have we identified all critical assets and data flows?
- Did we spend enough time brainstorming potential threats?
- Have we properly responded to all identified threats?
