# Using STRIDE in Threat Modeling

STRIDE is a mnemonic developed by Microsoft that helps you think about different types of security threats. It's a useful source of inspiration when you're not sure where to start with threat identification.

## What is STRIDE?

STRIDE is a memory aid that breaks down security thinking into six categories. You don't need to force every threat into one of these categories—think of them as prompts to help you explore different angles:

- **S**poofing
- **T**ampering
- **R**epudiation
- **I**nformation Disclosure
- **D**enial of Service
- **E**levation of Privilege

Each category represents a different way an attacker might compromise your system's security properties.

## The Six Threat Categories

### 🎭 Spoofing (Identity)

**What it is:** Pretending to be someone or something you're not.

**Security Property Violated:** Authentication

**Examples:**

- An attacker impersonates a legitimate user by stealing credentials
- A malicious website pretends to be your bank (phishing)
- An API client forges authentication tokens
- A system component masquerades as another trusted component

**Common Mitigations:**

- Multi-factor authentication (MFA)
- Strong password policies
- Certificate-based authentication
- API key management and rotation
- Digital signatures

**Questions to Ask:**

- Can someone pretend to be a legitimate user?
- How do we verify the identity of users and systems?
- What happens if authentication tokens are stolen?

---

### 🔧 Tampering (Integrity)

**What it is:** Modifying data or code without authorization.

**Security Property Violated:** Integrity

**Examples:**

- Modifying data in transit (man-in-the-middle attacks)
- Changing data in a database directly
- Injecting malicious code into web pages (XSS)
- Modifying configuration files
- Tampering with log files to hide tracks

**Common Mitigations:**

- Input validation and sanitization
- Digital signatures and checksums
- Access controls and permissions
- HTTPS/TLS for data in transit
- Immutable audit logs
- Code signing

**Questions to Ask:**

- Can an attacker modify data in transit or at rest?
- Are all inputs properly validated?
- Can configuration files be tampered with?
- How do we ensure data hasn't been modified?

---

### 🙈 Repudiation (Non-repudiation)

**What it is:** Denying that an action was performed, with no way to prove otherwise.

**Security Property Violated:** Non-repudiation

**Examples:**

- A user denies making a financial transaction
- An attacker deletes or modifies audit logs
- A system action occurs without proper logging
- An administrator denies making configuration changes

**Common Mitigations:**

- Comprehensive audit logging
- Digital signatures on transactions
- Tamper-proof log storage
- Time-stamping services
- Secure log aggregation
- Video/screen recording for sensitive operations

**Questions to Ask:**

- Can users deny actions they've taken?
- Are all critical operations logged?
- Can audit logs be tampered with or deleted?
- How do we prove who did what and when?

---

### 🔓 Information Disclosure (Confidentiality)

**What it is:** Exposing information to unauthorized parties.

**Security Property Violated:** Confidentiality

**Examples:**

- Exposing sensitive data through error messages
- Insecure data storage (unencrypted databases)
- Data leaks through insufficient access controls
- Exposing internal system details in API responses
- Unencrypted data transmission
- Information disclosure through timing attacks

**Common Mitigations:**

- Encryption at rest and in transit
- Access control lists (ACLs)
- Data classification and handling policies
- Least privilege principle
- Sanitized error messages
- Data masking and redaction
- Secure key management

**Questions to Ask:**

- What data is sensitive and needs protection?
- Could error messages reveal sensitive information?
- Is data encrypted both at rest and in transit?
- Who has access to what data?
- Could API responses leak internal system details?

---

### 💥 Denial of Service (Availability)

**What it is:** Making a system or resource unavailable to legitimate users.

**Security Property Violated:** Availability

**Examples:**

- Overwhelming a server with requests (DDoS)
- Resource exhaustion (memory, CPU, disk space)
- Algorithmic complexity attacks
- Crashing services through malformed inputs
- Consuming all database connections
- Filling up disk space with logs

**Common Mitigations:**

- Rate limiting and throttling
- Resource quotas and limits
- Load balancing and auto-scaling
- Input validation and size limits
- DDoS protection services
- Caching strategies
- Circuit breakers and timeouts
- Resource monitoring and alerting

**Questions to Ask:**

- What happens if we receive too many requests?
- Are there resource limits in place?
- Could malformed input crash the service?
- How do we handle traffic spikes?
- Are there single points of failure?

---

### 👑 Elevation of Privilege (Authorization)

**What it is:** Gaining capabilities or access beyond what was authorized.

**Security Property Violated:** Authorization

**Examples:**

- A regular user gaining admin access
- SQL injection allowing unauthorized data access
- Path traversal accessing restricted files
- Exploiting bugs to bypass authorization checks
- Privilege escalation through misconfigured permissions
- Container escape attacks

**Common Mitigations:**

- Principle of least privilege
- Role-based access control (RBAC)
- Input validation and parameterized queries
- Security boundaries and sandboxing
- Regular security audits
- Secure defaults
- Defense in depth

**Questions to Ask:**

- Can users access resources they shouldn't?
- Are authorization checks consistently applied?
- What's the impact if a component is compromised?
- Are privileges properly segregated?
- Can users escalate their own privileges?

---

## Using STRIDE as Inspiration

STRIDE can be particularly helpful when you're staring at your system and wondering "what could go wrong?"
**STRIDE** works well as:

- A brainstorming prompt when you're stuck
- A teaching tool for introducing security thinking
- A quick checklist to ensure you haven't missed obvious threat types

**For Internal Components:**

- Spoofing: Can it be impersonated?
- Tampering: Can its behavior be modified?
- Repudiation: Are actions logged?
- Information Disclosure: Can it leak data?
- Denial of Service: Can it be overwhelmed?
- Elevation of Privilege: Can it be exploited?

**For Data Flows:**

- Tampering: Can data be modified in transit?
- Information Disclosure: Can data be intercepted?
- Denial of Service: Can the connection be disrupted?

**For Data Stores:**

- Tampering: Can data be modified?
- Information Disclosure: Can data be read by unauthorized parties?
- Denial of Service: Can it be made unavailable?

**For External Components:**

- Spoofing: Can they be impersonated?
- Repudiation: Can they deny actions?

**Remember:** STRIDE is just one tool in your toolbox. If you discover threats through other means—brainstorming, security testing, incident reviews—that's great! The goal is to find threats, not to fit them into categories.
