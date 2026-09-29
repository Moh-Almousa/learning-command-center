/*
 * STARTER SKILLS, TECHNOLOGIES, PROJECT TEMPLATES and LISTS — plain data, no logic.
 * Used only on first open / reset to starter data. Manage all of these later from the website (Manage page).
 */
(function () {
  'use strict';
  const LCC = (window.LCC_DATA = window.LCC_DATA || {});

  /* A skill's progress comes from the roadmap items it is built by (keys from initial-roadmap.js). */
  LCC.skills = [
    { name: 'Python', learning: ['python', 'oop'] },
    { name: 'Object-Oriented Programming', learning: ['oop'] },
    { name: 'Django', learning: ['django'] },
    { name: 'Django REST Framework', learning: ['drf', 'api'] },
    { name: 'PostgreSQL', learning: ['sql', 'postgres'] },
    { name: 'Database Design', learning: ['dbdesign'] },
    { name: 'Testing', learning: ['testing'] },
    { name: 'Web Security', learning: ['security'] },
    { name: 'Docker', learning: ['docker'] },
    { name: 'CI/CD', learning: ['cicd'] },
    { name: 'Redis', learning: ['redis'] },
    { name: 'Celery', learning: ['celery'] },
    { name: 'Software Design', learning: ['solid', 'patterns', 'arch'] },
    { name: 'System Design', learning: ['sysdesign'] },
  ];

  /* Technology registry (suggestions when you add technologies to projects). */
  LCC.technologies = [
    'Python', 'Django', 'DRF', 'PostgreSQL', 'Redis', 'Celery', 'WebSockets', 'Stripe', 'Docker',
    'Git', 'Linux', 'Nginx', 'GitHub Actions', 'pytest', 'C++', 'C#',
  ];

  /* Project templates. One group per line; lines starting with "-" are tasks in the group above. */
  LCC.templates = [
    {
      name: 'Django Backend Project',
      text: [
        'Planning', '- Write requirements & assumptions', '- Define user roles & permissions', '- Draw the ERD',
        'Project Setup', '- Create project & apps', '- Configure settings per environment',
        'Environment', '- .env & secrets', '- requirements / dependencies',
        'Database', '- Configure PostgreSQL', '- Initial migrations',
        'Authentication', '- Custom User model', '- JWT authentication', '- Password reset',
        'Models', '- Core models',
        'Serializers', '- Core serializers',
        'APIs', '- CRUD endpoints', '- Filtering & pagination',
        'Permissions', '- Role-based permissions', '- Object-level permissions',
        'Testing', '- Model tests', '- API tests',
        'Docker', '- Dockerfile', '- Docker Compose',
        'Deployment', '- CI pipeline', '- Deploy to server',
        'Documentation', '- README', '- API docs (OpenAPI)',
      ].join('\n'),
    },
  ];

  /* Free-form lists (reading list, certifications, interview prep…). Items: { title, url, status: 'todo' | 'doing' | 'done', notes }. */
  LCC.lists = [
    {
      name: 'Reading list',
      description: 'Books and long articles to read.',
      items: [
        { title: 'Clean Code — Robert C. Martin', status: 'todo' },
        { title: 'Designing Data-Intensive Applications — Martin Kleppmann', status: 'todo' },
      ],
    },
    {
      name: 'Interview preparation',
      description: 'Topics to review before backend interviews.',
      items: [
        { title: 'Explain OOP pillars with examples', status: 'todo' },
        { title: 'Explain SOLID with a Django example', status: 'todo' },
        { title: 'Design a URL shortener (system design)', status: 'todo' },
      ],
    },
  ];
})();
