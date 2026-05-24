import { telegramBotLink } from '../data/demoData'

export type AdminApiRoute = {
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  path: string
  description: string
}

export const adminTools = [
  {
    title: 'Event List',
    description: 'Review raw event rows, filters, image sources, and diagnostics.',
    path: '/admin/event-list',
    status: 'Live',
  },
  {
    title: 'Admin Users',
    description: 'Promote users to admin, disable access, and remove admin entries.',
    path: '/admin/admin-users',
    status: 'Access',
  },
  {
    title: 'User Analytics',
    description: 'Track free vs paid users, conversion, activity, and account quality.',
    path: '/admin/user-analytics',
    status: 'Users',
  },
] as const

export const themePages = [
  { label: 'Orange', path: '/admin/design-theme/orange' },
  { label: 'Purple', path: '/admin/design-theme/purple' },
] as const

export const chatPages = [
  { label: 'Telegram', path: telegramBotLink, external: true },
] as const

export const adminApiGroups: Array<{
  title: string
  description: string
  routes: AdminApiRoute[]
}> = [
  {
    title: 'Events',
    description: 'Raw event inspection and Event List data.',
    routes: [
      {
        method: 'GET',
        path: '/api/admin/events',
        description: 'Paginated admin event feed used by Event List.',
      },
      {
        method: 'GET',
        path: '/api/admin/events/count',
        description: 'Count endpoint for the same admin filters.',
      },
      {
        method: 'GET',
        path: '/api/admin/events/:id',
        description: 'Raw admin event detail by event id.',
      },
    ],
  },
  {
    title: 'Admin Users',
    description: 'Admin allowlist search and access management.',
    routes: [
      {
        method: 'GET',
        path: '/api/admin/admin-users',
        description: 'List current admin users and access status.',
      },
      {
        method: 'GET',
        path: '/api/admin/admin-users/search',
        description: 'Find an existing app user by email.',
      },
      {
        method: 'POST',
        path: '/api/admin/admin-users',
        description: 'Promote an existing user to admin.',
      },
      {
        method: 'PATCH',
        path: '/api/admin/admin-users/:userId',
        description: 'Enable or disable admin access.',
      },
      {
        method: 'DELETE',
        path: '/api/admin/admin-users/:userId',
        description: 'Remove admin access.',
      },
    ],
  },
  {
    title: 'User Analytics',
    description: 'User tier, activity, and conversion reporting.',
    routes: [
      {
        method: 'GET',
        path: '/api/admin/user-analytics',
        description: 'Return user analytics metrics and filtered user rows.',
      },
    ],
  },
]
