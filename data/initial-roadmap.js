/*
 * STARTER ROADMAP — plain data, no logic.
 * Used only the first time the app opens (or after Data → Reset → starter roadmap).
 * After that, edit everything from the website; this file is never read again.
 *
 * Item fields (all optional except title):
 *   type        'path' | 'track' | 'course' | 'module' | 'lesson' | 'task'
 *   title       display name
 *   key         short id used by dependencies / projects / skills below
 *   status      'not_started' | 'in_progress' | 'completed' | 'skipped'
 *   description, provider ('udemy' | 'youtube' | 'coursera' | 'docs' | 'programmingadvices' | 'other'),
 *   url, hours (estimated), resources: [{ type, label, url }]
 *   children    nested items. A plain string is a shortcut for { title: '…' } of the natural child type
 *               (course/module → lesson, lesson → task).
 */
(function () {
  'use strict';
  const YT = (q) => 'https://www.youtube.com/results?search_query=' + encodeURIComponent(q);
  const LCC = (window.LCC_DATA = window.LCC_DATA || {});

  LCC.roadmap = [
    {
      type: 'path',
      title: 'Backend Software Engineer — 12-month plan',
      description: 'Fundamentals (Programming Advices) + software engineering + filling backend gaps: security, testing, Docker, deployment.',
      children: [
        {
          type: 'track', key: 'foundations', title: 'Programming Foundations',
          children: [
            {
              type: 'course', key: 'pa', title: 'Programming Advices Roadmap (Abu-Hadhoud)',
              provider: 'programmingadvices', url: 'https://programmingadvices.com/p/roadmap',
              description: 'The 24-course fundamentals roadmap. Rename each lesson to the exact course title as you go.',
              resources: [{ type: 'course', label: 'Programming Advices — Roadmap', url: 'https://programmingadvices.com/p/roadmap' }],
              children: [
                { title: 'Course 1', status: 'completed' },
                { title: 'Course 2', status: 'completed' },
                { title: 'Course 3', status: 'completed' },
                { title: 'Course 4', status: 'completed' },
                { title: 'Course 5 — Algorithms & Problem Solving Level 2', status: 'completed' },
                {
                  title: 'Course 6', key: 'ph6', status: 'in_progress',
                  children: [{ title: 'Finish all course exercises', status: 'in_progress' }, 'Push solutions to GitHub'],
                },
                'Course 7 — Algorithms & Problem Solving Level 3',
                'Course 8 — Algorithms & Problem Solving Level 4',
                'Course 9', 'Course 10', 'Course 11', 'Course 12', 'Course 13',
                'Course 14 — C# Level 1',
                'Course 15', 'Course 16', 'Course 17', 'Course 18', 'Course 19', 'Course 20',
                'Course 21', 'Course 22', 'Course 23', 'Course 24',
              ],
            },
            {
              type: 'course', key: 'python', title: 'Python', provider: 'docs', url: 'https://docs.python.org/3/tutorial/',
              children: [
                { title: 'Syntax & data types', status: 'completed' },
                { title: 'Functions & modules', status: 'completed' },
                { title: 'Error handling', status: 'completed' },
                { title: 'Comprehensions & generators', status: 'completed' },
                { title: 'Type hints', status: 'skipped' },
              ],
            },
            {
              type: 'course', key: 'oop', title: 'Object-Oriented Programming', provider: 'youtube',
              url: YT('corey schafer python oop tutorial'), hours: 20,
              description: 'Close the theory gap: know the names behind what you already do in Django.',
              resources: [
                { type: 'youtube', label: 'Corey Schafer — Python OOP', url: YT('corey schafer python oop tutorial') },
                { type: 'youtube', label: 'Elzero Web School — Python OOP (Arabic)', url: YT('elzero python oop') },
              ],
              children: [
                {
                  type: 'module', title: 'Corey Schafer — Python OOP',
                  children: ['Classes and Instances', 'Class Variables', 'classmethods and staticmethods',
                    'Inheritance - Creating Subclasses', 'Special (Magic/Dunder) Methods', 'Property Decorators'],
                },
                {
                  type: 'module', title: 'Core Concepts',
                  children: [
                    'Class vs Object',
                    { title: 'Encapsulation', children: ['Explain it in your own words, without notes', 'Find an example in CoachLink'] },
                    'Inheritance',
                    'Polymorphism: overloading vs overriding',
                    'Abstraction: abstract class vs interface',
                    { title: 'Composition over inheritance', children: ['Refactor one inheritance example into composition'] },
                  ],
                },
              ],
            },
            {
              type: 'course', key: 'git', title: 'Git & GitHub', provider: 'docs', url: 'https://docs.github.com/en/get-started',
              children: [
                { title: 'Branching & merging', status: 'completed' },
                'Pull requests & code review', 'Rebase & resolving conflicts', 'Writing good commit messages',
              ],
            },
          ],
        },

        {
          type: 'track', key: 'se', title: 'Software Engineering',
          children: [
            {
              type: 'course', key: 'solid', title: 'SOLID & Clean Code', provider: 'youtube', url: YT('ArjanCodes SOLID principles python'),
              resources: [
                { type: 'youtube', label: 'ArjanCodes — SOLID', url: YT('ArjanCodes SOLID principles python') },
                { type: 'youtube', label: 'Uncle Bob — Clean Code lectures', url: YT('uncle bob clean code lesson') },
              ],
              children: [
                { title: 'Single Responsibility Principle', children: ['Apply SRP to one CoachLink service'] },
                'Open/Closed Principle', 'Liskov Substitution Principle', 'Interface Segregation Principle',
                'Dependency Inversion & Dependency Injection', 'Clean Code: naming & functions', 'Refactoring basics',
              ],
            },
            {
              type: 'course', key: 'patterns', title: 'Design Patterns', provider: 'youtube', url: YT('Christopher Okhravi design patterns'),
              resources: [{ type: 'youtube', label: 'Christopher Okhravi — Design Patterns', url: YT('Christopher Okhravi design patterns') }],
              children: ['Strategy', 'Observer', 'Factory Method', 'Decorator', 'Adapter', 'Singleton (and when not to use it)'],
            },
            {
              type: 'course', key: 'arch', title: 'Software Design and Architecture (University of Alberta)',
              provider: 'coursera', url: 'https://www.coursera.org/specializations/software-design-architecture',
              description: 'Start after OOP, SOLID and Design Patterns — it assumes them.',
              children: [
                { type: 'module', title: 'Object-Oriented Design', children: ['UML class diagrams', 'UML sequence diagrams'] },
                { type: 'module', title: 'Design Patterns', children: ['Creational & structural patterns', 'Behavioural patterns'] },
                { type: 'module', title: 'Software Architecture', children: ['Layered architecture & MVC', 'Architecture quality attributes'] },
                { type: 'module', title: 'Service-Oriented Architecture', children: ['Monolith vs microservices', 'REST & web services'] },
              ],
            },
            {
              type: 'course', key: 'req', title: 'Requirements & Analysis',
              children: ['Functional vs non-functional requirements', 'Writing assumptions explicitly', 'User stories & use cases', 'Domain modelling'],
            },
            {
              type: 'course', key: 'sysdesign', title: 'System Design', provider: 'youtube', url: YT('ByteByteGo system design'),
              resources: [
                { type: 'youtube', label: 'ByteByteGo', url: YT('ByteByteGo system design') },
                { type: 'youtube', label: 'Hussein Nasser — backend engineering', url: YT('Hussein Nasser backend engineering') },
              ],
              children: ['Caching', 'Load balancing', 'Message queues', 'Database replication & sharding', 'Rate limiting'],
            },
          ],
        },

        {
          type: 'track', key: 'backend', title: 'Backend Development',
          children: [
            {
              type: 'course', key: 'django', title: 'Django', provider: 'docs', url: 'https://docs.djangoproject.com/en/stable/',
              children: [
                {
                  type: 'module', title: 'Models & ORM',
                  children: [
                    { title: 'Models & relationships', status: 'completed' },
                    { title: 'Migrations', status: 'completed' },
                    { title: 'QuerySets', status: 'completed' },
                    {
                      title: 'Query Optimization', status: 'in_progress',
                      children: [
                        { title: 'select_related', status: 'completed' },
                        { title: 'prefetch_related', status: 'in_progress' },
                        'annotate & aggregate', 'Subquery & OuterRef',
                      ],
                    },
                    'Transactions & select_for_update',
                  ],
                },
                { type: 'module', title: 'Advanced Django', children: ['Signals', 'Custom managers & querysets', 'Caching framework', 'Management commands'] },
              ],
            },
            {
              type: 'course', key: 'drf', title: 'Django REST Framework (DRF)', provider: 'docs', url: 'https://www.django-rest-framework.org/',
              resources: [{ type: 'docs', label: 'DRF documentation', url: 'https://www.django-rest-framework.org/' }],
              children: [
                {
                  type: 'module', title: 'Serializers',
                  children: [
                    { title: 'ModelSerializer', status: 'completed' },
                    { title: 'Nested serializers', status: 'completed' },
                    { title: 'Validation', status: 'completed' },
                  ],
                },
                {
                  type: 'module', title: 'Views & ViewSets',
                  children: [
                    { title: 'APIView', status: 'completed' },
                    { title: 'Generic views', status: 'completed' },
                    { title: 'ViewSets & routers', status: 'in_progress' },
                  ],
                },
                {
                  type: 'module', title: 'Authentication',
                  children: [
                    {
                      title: 'JWT Authentication (SimpleJWT)',
                      resources: [{ type: 'docs', label: 'SimpleJWT docs', url: 'https://django-rest-framework-simplejwt.readthedocs.io/' }],
                      children: [{ title: 'Implement JWT login', status: 'completed' }, 'Test refresh token endpoint', 'Blacklist tokens on logout'],
                    },
                    'Permissions & object-level permissions',
                  ],
                },
                { type: 'module', title: 'Pagination, Filtering & Throttling', children: ['Pagination', 'django-filter', 'Throttling'] },
              ],
            },
            {
              type: 'course', key: 'api', title: 'API Design',
              children: ['REST conventions & status codes', 'Versioning', 'Consistent error format', 'OpenAPI docs (drf-spectacular)'],
            },
            {
              type: 'course', key: 'security', title: 'Web Security', provider: 'docs', url: 'https://owasp.org/www-project-top-ten/',
              description: 'A known weak spot — prioritise it.',
              resources: [{ type: 'docs', label: 'OWASP Top 10', url: 'https://owasp.org/www-project-top-ten/' }],
              children: ['OWASP Top 10', 'CSRF, CORS & XSS', 'Secrets & environment variables', 'Rate limiting & brute-force protection', 'Security headers'],
            },
            {
              type: 'course', key: 'testing', title: 'Testing', provider: 'docs', url: 'https://pytest-django.readthedocs.io/',
              description: 'A known weak spot — every lesson should end with tests in a real project.',
              resources: [{ type: 'youtube', label: 'ArjanCodes — testing with pytest', url: YT('ArjanCodes pytest') }],
              children: [
                'Unit vs integration tests', 'pytest-django setup & fixtures',
                { title: 'Testing DRF APIs (APIClient)', children: ['Write tests for CoachLink auth endpoints'] },
                'Test data with factory_boy', 'Coverage',
              ],
            },
          ],
        },

        {
          type: 'track', key: 'databases', title: 'Databases',
          children: [
            {
              type: 'course', key: 'sql', title: 'SQL',
              children: [
                { title: 'SELECT & filtering', status: 'completed' },
                { title: 'JOINs', status: 'completed' },
                'GROUP BY & aggregates', 'Subqueries & CTEs', 'Indexes',
              ],
            },
            {
              type: 'course', key: 'postgres', title: 'PostgreSQL', provider: 'docs', url: 'https://www.postgresql.org/docs/',
              children: ['Data types & constraints', 'Indexes & EXPLAIN', 'Transactions & isolation levels', 'Full-text search'],
            },
            {
              type: 'course', key: 'dbdesign', title: 'Database Design', provider: 'youtube', url: YT('freeCodeCamp database design course'),
              resources: [{ type: 'youtube', label: 'freeCodeCamp — Database Design Course', url: YT('freeCodeCamp database design course') }],
              children: [
                'ER diagrams', 'Normalization (1NF–3NF)', 'One-to-many vs many-to-many', 'Junction tables with extra fields',
                { title: 'Practice', children: ['Redraw the CoachLink ERD on paper', 'Design the pharmacy-delivery schema'] },
              ],
            },
          ],
        },

        {
          type: 'track', key: 'devops', title: 'DevOps',
          children: [
            { type: 'course', key: 'linux', title: 'Linux', children: ['Command line basics', 'Permissions & users', 'Processes & systemd', 'SSH'] },
            {
              type: 'course', key: 'docker', title: 'Docker', provider: 'docs', url: 'https://docs.docker.com/get-started/',
              resources: [{ type: 'docs', label: 'Docker — Get started', url: 'https://docs.docker.com/get-started/' }],
              children: [
                'Images vs containers', 'Dockerfile',
                { title: 'Docker Compose', children: ['Practice Docker Compose with Django + PostgreSQL + Redis'] },
                'Volumes & networks',
              ],
            },
            {
              type: 'course', key: 'cicd', title: 'CI/CD (GitHub Actions)', provider: 'docs', url: 'https://docs.github.com/en/actions',
              children: ['Workflow basics', 'Run tests on every push', 'Build & push a Docker image'],
            },
            {
              type: 'course', key: 'deploy', title: 'Deployment',
              children: ['VPS setup', 'Gunicorn + Nginx', "HTTPS with Let's Encrypt", 'Environment & secrets in production'],
            },
          ],
        },

        {
          type: 'track', key: 'advanced', title: 'Advanced Topics',
          children: [
            {
              type: 'course', key: 'redis', title: 'Redis', provider: 'docs', url: 'https://redis.io/docs/latest/',
              children: ['Data structures', 'Caching in Django', 'Redis as a Celery broker'],
            },
            {
              type: 'course', key: 'celery', title: 'Celery', provider: 'docs', url: 'https://docs.celeryq.dev/',
              children: [{ title: 'Tasks & workers', status: 'completed' }, 'Periodic tasks (celery beat)', 'Retries & error handling'],
            },
            {
              type: 'course', key: 'ws', title: 'WebSockets (Django Channels)', provider: 'docs', url: 'https://channels.readthedocs.io/',
              children: [{ title: 'Consumers', status: 'completed' }, 'Channel layers with Redis', 'Authenticating WebSocket connections'],
            },
          ],
        },
      ],
    },
  ];

  /* Prerequisites: [item, requires]. The first item shows as locked until the second is done (you can still start it). */
  LCC.dependencies = [
    ['oop', 'python'], ['django', 'python'], ['drf', 'django'], ['api', 'drf'],
    ['solid', 'oop'], ['patterns', 'solid'], ['arch', 'patterns'], ['sysdesign', 'arch'], ['sysdesign', 'dbdesign'],
    ['postgres', 'sql'], ['dbdesign', 'sql'], ['docker', 'linux'], ['cicd', 'docker'], ['cicd', 'testing'],
    ['deploy', 'docker'], ['celery', 'redis'],
  ];

  /* Where "You are here" starts on first open (a key from above). */
  LCC.startAt = 'ph6';
})();
