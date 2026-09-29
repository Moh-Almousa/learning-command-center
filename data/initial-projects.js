/*
 * STARTER PROJECTS — plain data, no logic. Used only on first open / reset to starter data.
 *
 * Project fields: key, name, type, description, status ('idea' | 'planning' | 'in_progress' | 'paused' | 'ready' | 'delivered' | 'archived'),
 *   technologies, repoUrl, liveUrl, docsUrl, notes,
 *   learning   keys from initial-roadmap.js this project practises,
 *   milestones names,
 *   groups     [{ name, tasks: [...] }]
 *   applied    [{ tech, learning (roadmap key), items: [...] }]  — "What I Applied"
 *
 * Task fields: title, status ('not_started' | 'in_progress' | 'completed'), priority ('low' | 'medium' | 'high' | 'critical'),
 *   milestone (name), learning (roadmap key), dependsOn (task titles in the same project), current: true (the task you're on).
 *   A plain string is a not-started, medium-priority task.
 */
(function () {
  'use strict';
  const LCC = (window.LCC_DATA = window.LCC_DATA || {});

  LCC.projects = [
    {
      key: 'coachlink',
      name: 'CoachLink Backend',
      type: 'Django REST API',
      description: 'Backend API for a coach–player sports coaching platform. Graduation project — I owned the backend and the database design.',
      status: 'in_progress',
      technologies: ['Python', 'Django', 'DRF', 'PostgreSQL', 'Redis', 'Celery', 'WebSockets', 'Stripe', 'Docker'],
      notes: 'Repository is private. Remaining before launch: Docker Compose, tests, CI/CD and deployment.',
      learning: ['django', 'drf', 'postgres', 'redis', 'celery', 'ws', 'docker'],
      milestones: ['Authentication', 'Payments', 'Deployment'],
      groups: [
        {
          name: 'Setup',
          tasks: [
            { title: 'Create project', status: 'completed' },
            { title: 'Configure environment', status: 'completed' },
            { title: 'Configure PostgreSQL', status: 'completed' },
            { title: 'Configure Redis', status: 'completed' },
          ],
        },
        {
          name: 'Authentication',
          tasks: [
            { title: 'Create custom User model', status: 'completed', milestone: 'Authentication' },
            { title: 'Email verification', status: 'completed', milestone: 'Authentication' },
            { title: 'OTP system', status: 'completed', milestone: 'Authentication' },
            { title: 'JWT authentication', status: 'completed', milestone: 'Authentication' },
            { title: 'Google Login', milestone: 'Authentication' },
            { title: 'Password reset', milestone: 'Authentication' },
          ],
        },
        {
          name: 'Programs',
          tasks: [
            { title: 'Program model', status: 'completed' },
            { title: 'Program serializer', status: 'completed' },
            { title: 'Program API', status: 'completed' },
            'Advanced filtering',
            { title: 'Permissions', priority: 'high' },
            { title: 'Tests', priority: 'high', learning: 'testing' },
          ],
        },
        {
          name: 'Payments',
          tasks: [
            { title: 'Stripe Checkout', status: 'completed', milestone: 'Payments' },
            { title: 'Payment model', status: 'completed', milestone: 'Payments' },
            { title: 'Stripe Webhook', status: 'in_progress', priority: 'high', milestone: 'Payments', current: true },
            { title: 'Subscription activation', priority: 'high', milestone: 'Payments' },
          ],
        },
        {
          name: 'Deployment',
          tasks: [
            { title: 'Dockerfile', status: 'completed', milestone: 'Deployment', learning: 'docker' },
            { title: 'Docker Compose', priority: 'high', milestone: 'Deployment', learning: 'docker', dependsOn: ['Dockerfile'] },
            { title: 'CI/CD', milestone: 'Deployment', learning: 'cicd', dependsOn: ['Docker Compose'] },
            { title: 'Deploy', priority: 'critical', milestone: 'Deployment', learning: 'deploy', dependsOn: ['Docker Compose', 'CI/CD'] },
          ],
        },
      ],
      applied: [
        { tech: 'Django', learning: 'django', items: ['Custom User Model', 'Generic Relations', 'Permissions', 'ORM', 'Transactions'] },
        { tech: 'Django REST Framework', learning: 'drf', items: ['APIViews', 'Serializers', 'Permissions', 'JWT Authentication', 'Pagination', 'Filtering'] },
        { tech: 'PostgreSQL', learning: 'postgres', items: ['Relational Database', 'Foreign Keys', 'Indexes', 'Transactions'] },
        { tech: 'Redis', learning: 'redis', items: ['Celery Broker', 'Caching'] },
        { tech: 'Docker', learning: 'docker', items: ['Dockerfile'] },
      ],
    },
    {
      key: 'bus',
      name: 'Intercity Bus Booking (Syria)',
      type: 'Django REST API',
      description: 'Book seats on intercity buses between Syrian governorates. Roles: travel company, driver, citizen.',
      status: 'planning',
      technologies: ['Python', 'Django', 'DRF', 'PostgreSQL', 'Stripe'],
      notes: 'Watch out: two passengers booking the same seat at the same time (race condition) — lock the row.',
      learning: ['drf', 'dbdesign'],
      milestones: ['MVP'],
      groups: [
        {
          name: 'Planning',
          tasks: [
            { title: 'Write requirements & assumptions', priority: 'high', milestone: 'MVP', learning: 'req' },
            { title: 'Define roles: company, driver, citizen', milestone: 'MVP' },
            { title: 'Draw the ERD (trips, seats, bookings)', milestone: 'MVP', learning: 'dbdesign' },
          ],
        },
        { name: 'Models', tasks: [{ title: 'Company & bus models', milestone: 'MVP' }, { title: 'Trip & seat models', milestone: 'MVP' }, { title: 'Booking model', milestone: 'MVP' }] },
        { name: 'APIs', tasks: [{ title: 'Trip search API', milestone: 'MVP' }, { title: 'Seat booking with select_for_update', milestone: 'MVP', priority: 'critical' }] },
        { name: 'Payments', tasks: ['Stripe payment simulation'] },
        { name: 'Testing', tasks: [{ title: 'Test double-booking the same seat', priority: 'high', learning: 'testing' }] },
        { name: 'Deployment', tasks: [{ title: 'Docker Compose', learning: 'docker' }, 'Deploy'] },
      ],
      applied: [],
    },
  ];
})();
