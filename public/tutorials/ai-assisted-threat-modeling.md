# AI-Assisted Threat Modeling

FlowState TM doesn't have built-in AI support, but you can leverage AI tools like GitHub Copilot, ChatGPT, or Claude to help create and enhance your threat models. This tutorial shows you how to use AI effectively with FlowState.

## What You'll Learn

- How to use AI prompt files with GitHub Copilot
- Two workflows for AI-assisted threat modeling
- Best practices for reviewing AI-generated content

## Get the Prompt File

We've created a comprehensive prompt file that instructs AI tools how to generate FlowState-compatible threat models.

📥 **[Download threat-model.prompt.md](/download/threat-model.prompt.md)**

Place it in your project's `.github/prompts/` directory to use with GitHub Copilot.

### What's Included

The prompt file contains:
- Complete YAML schema documentation
- Examples of proper threat model structure
- STRIDE methodology guidance
- Validation requirements

## Using with GitHub Copilot (VS Code)

GitHub Copilot supports custom prompt files that give the AI context about your specific needs.

### Setup Instructions

**Choose your storage location:**

**Option 1: User Data** - Available in all your projects
1. Open a copilot chat window in VS Code
2. Look for a cog wheel icon (⚙️) at the top right of the chat pane
3. Click "Prompt Files" → "New Prompt File"
4. Select **User Data** as the storage location
5. Name it `threat-model` and paste the prompt content

**Option 2: Project Prompts** - Available only in current project
1. Download the prompt file and place it in your project's `.github/prompts/` directory
2. Name it `threat-model.prompt.md`

📚 **Learn more:** [VS Code Prompt Files Documentation](https://code.visualstudio.com/docs/copilot/customization/prompt-files)

### Example Usage

Prompt files are automatically shortcutable - just start your chat with `/threat-model`:

```
/threat-model create a threat model for this project and 
save it to .threat-models/my-app.yaml
```

## Two Recommended Workflows

### Workflow 1: AI Generates from Source Code

**Best for:** Bootstrapping new threat models, comprehensive analysis of existing systems

**Steps:**

1. **Prepare your prompt** - Use the prompt shortcut and ask AI to analyze your project:
   ```
   /threat-model
   ```
   By default the prompt file instructs the AI to analyze your codebase, identify components, data flows, and generate a complete threat model.

2. **Let AI analyze** - The AI will:
   - Examine your project structure
   - Identify components and technologies
   - Map data flows
   - Apply STRIDE to identify threats
   - Propose security controls

3. **Review in FlowState** - Open the generated YAML file in FlowState:
   - Clean up the diagram layout (AI-generated diagrams will be messy)
   - Review threat descriptions for accuracy
   - Validate controls are appropriate
   - Add missing elements AI didn't catch

4. **Iterate** - Ask AI to refine specific sections:
   ```
   The authentication threats seem incomplete. Can you expand them to 
   cover JWT token vulnerabilities and session management issues?
   ```

### Workflow 2: Manual DFD, AI Suggests Threats

**Best for:** When you know your architecture but need help identifying threats

**Steps:**

1. **Create your DFD manually** in FlowState:
   - Add all components (users, services, databases)
   - Draw data flows between them
   - Define trust boundaries
   - List your critical assets
   - The more detail you add in your descriptions, the better AI can generate relevant threats

2. **Export and share with AI** - Save the YAML to a workspace and open the workspace in VS Code:
   ```
   /threat-model add relevant threats and controls to this threat model
   ```  
   (remember to tag/reference the specific YAML you want it to work on)


3. **AI fills in threats and controls** - The AI will:
   - Apply STRIDE methodology to each component and data flow
   - Identify specific attack vectors
   - Suggest mitigation controls
   - Link threats to affected components/flows/assets

4. **Review and refine** - Load the updated YAML back into FlowState:
   - Evaluate each threat's relevance to your system
   - Assess control feasibility and priority
   - Merge AI suggestions with your own insights
   - Update threat descriptions with project-specific details

## Best Practices

### ✅ Do

- **Always review AI output** - AI can miss context or make assumptions
- **Validate references** - Ensure all `ref` fields are properly linked
- **Check YAML syntax** - Load in FlowState to catch formatting errors
- **Add project-specific details** - AI generates generic threats; customize them
- **Use AI iteratively** - Start broad, then ask for refinements
- **Test the YAML** - Make sure all refs exist and types are valid

### ❌ Don't

- **Blindly trust AI** - It may hallucinate threats or miss critical ones
- **Skip manual review** - You know your system better than AI
- **Accept generic descriptions** - Enhance them with specific attack scenarios
- **Ignore your expertise** - AI complements, not replaces, security knowledge
- **Forget to validate** - Always check the generated YAML is valid

## Tips for Better AI Results

### Be Specific About Scope

Instead of:
```
Create a threat model for my app
```

Try:
```
/threat-model create a threat model focused on the API authentication 
and authorization layer, covering OAuth2 flows, JWT validation, and rate limiting.
```

### Provide Context

Give the AI relevant information:
```
/threat-model This is a Node.js REST API using Express, PostgreSQL database, 
and Redis for session storage. It handles payment processing and integrates 
with Stripe API. User data includes PII and financial information. Create a 
comprehensive threat model.
```

## Working with Multiple Models

For complex systems, AI can help create multiple focused threat models:

```
/threat-model create three separate threat models:
1. frontend.yaml - covering the React SPA, CDN, and browser security
2. api.yaml - covering backend API services and business logic
3. infrastructure.yaml - covering deployment, networking, and cloud resources
```

This approach makes models more maintainable and easier to review.

## Example Prompts

### Initial Generation
```
/threat-model Analyze this codebase and create a threat 
model covering:
- All API endpoints and authentication mechanisms
- Database interactions and data storage
- Third-party integrations
- Infrastructure and deployment model

Save to .threat-models/api-backend.yaml
```

### Refining Threats
```
/threat-model The threat model at .threat-models/api-backend.yaml has a threat about 
SQL injection. Expand it to cover:
- Specific attack vectors for our ORM (Prisma)
- Potential impact scenarios
- Additional controls beyond parameterized queries
```

### Adding Missing Elements
```
/threat-model Review .threat-models/api-backend.yaml and identify:
- Any missing data flows between components
- Assets that aren't currently protected
- Threats related to our Redis cache usage
```

## After AI Generation

Once AI creates or enhances your threat model:

1. **Open in FlowState** - Load the YAML file to visualize the model
2. **Review the Diagram** - Check component positioning and data flow layout
3. **Validate Tables** - Review all threats, controls, and their relationships
4. **Edit as needed** - Use FlowState's interface to refine the model
5. **Save and version control** - Commit your reviewed model to Git

Remember: AI is a powerful assistant, but your security expertise and system knowledge are irreplaceable. Use AI to accelerate your workflow, not replace your judgment.