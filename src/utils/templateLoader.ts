/**
 * Template Loader Utility
 * Handles loading threat model templates from various sources
 */

export interface TemplateMetadata {
  name: string;
  path: string;
  description?: string;
  tags?: string[];
}

/**
 * Fetch and load a template file by path
 */
export const loadTemplateByPath = async (
  path: string
): Promise<string> => {
  const response = await fetch(`/${path}`);
  if (!response.ok) {
    throw new Error(
      `Failed to load template from ${path}: ${response.statusText}`
    );
  }
  return response.text();
};

/**
 * Parse a threat model file (YAML or JSON)
 */
export const parseThreateModelFile = async (
  file: File
): Promise<string> => {
  return file.text();
};

/**
 * Get all available templates
 * Currently returns a static list, can be enhanced to read from a manifest
 */
export const getAvailableTemplates = (): TemplateMetadata[] => {
  return [
    {
      name: 'Simple Web Application',
      path: 'templates/simple.yaml',
      description:
        'A basic threat model for a web application with user, web server, and database',
      tags: ['web', 'basic', 'beginner'],
    },
    {
      name: 'Version Control and CI CD',
      path: 'templates/version_control_and_cicd.yaml',
      description:
        'Threat model for the usage of GitHub to code and deploy applications',
      tags: ['cicd', 'intermediate'],
    },
    {
      name: 'Mobile App with Backend',
      path: 'templates/mobile_app_backend.yaml',
      description:
        'A mobile application communicating with backend services including authentication, API gateway, and database',
      tags: ['mobile', 'backend', 'api', 'intermediate', 'AI-generated'],
    },
    {
      name: 'Serverless Architecture',
      path: 'templates/serverless_architecture.yaml',
      description:
        'Event-driven serverless application with functions, API gateway, managed database, object storage, and message queues',
      tags: ['serverless', 'cloud', 'lambda', 'event-driven', 'advanced', 'AI-generated'],
    },
    {
      name: 'Containerized Microservices',
      path: 'templates/containerized_microservices.yaml',
      description:
        'Kubernetes-orchestrated microservices with service mesh, ingress controller, container registry, and persistent storage',
      tags: ['kubernetes', 'containers', 'microservices', 'docker', 'service-mesh', 'advanced', 'AI-generated'],
    },
    {
      name: 'IoT System',
      path: 'templates/iot_system.yaml',
      description:
        'Internet of Things architecture with edge devices, gateways, IoT hub, stream processing, and device management',
      tags: ['iot', 'edge', 'devices', 'sensors', 'telemetry', 'advanced', 'AI-generated'],
    },
    {
      name: 'Web App with CDN',
      path: 'templates/web_app_cdn.yaml',
      description:
        'Web application delivered through CDN with origin server, application backend, database, and caching layer',
      tags: ['web', 'cdn', 'cache', 'intermediate', 'AI-generated'],
    },
    {
      name: 'Payment Processing Flow',
      path: 'templates/payment_processing.yaml',
      description:
        'Online payment processing flow including card data handling, payment gateway integration, fraud detection, and webhooks',
      tags: ['payment', 'pci-dss', 'e-commerce', 'business-flow', 'intermediate', 'AI-generated'],
    },
    // Future templates can be added here:
    // {
    //   name: 'Microservices Architecture',
    //   path: 'templates/microservices.yaml',
    //   description: 'A threat model for microservices-based applications',
    //   tags: ['microservices', 'advanced'],
    // },
  ];
};
