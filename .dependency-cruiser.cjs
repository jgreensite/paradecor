/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'core-independent-of-infrastructure',
      comment: 'The core domain must not depend on infrastructure adapters or third-party vendor services.',
      severity: 'error',
      from: {
        path: '^src/core/'
      },
      to: {
        path: '^src/infrastructure/'
      }
    },
    {
      name: 'core-vendor-agnostic',
      comment: 'The core domain must remain vendor-agnostic and should not import specific vendor SDKs directly.',
      severity: 'error',
      from: {
        path: '^src/core/'
      },
      to: {
        path: '(^node_modules/@clerk|^node_modules/@supabase|^node_modules/stripe)'
      }
    },
    {
      name: 'domain-independent-of-react',
      comment: 'Core domain logic should not depend on React or the UI Layer directly.',
      severity: 'error',
      from: {
        path: '^src/core/domain/'
      },
      to: {
        path: ['^src/(?!core/)', '^node_modules/react']
      }
    }
  ],
  options: {
    doNotFollow: {
      path: 'node_modules'
    },
    includeOnly: '^src',
    tsPreCompilationDeps: true,
  }
};
