import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
  {
    path: 'dashboard',
    title: 'Dashboard · Waldrick Medical',
    loadComponent: () => import('./features/dashboard/dashboard').then((m) => m.Dashboard),
  },
  {
    path: 'family',
    title: 'Family · Waldrick Medical',
    loadComponent: () => import('./features/family/family-list').then((m) => m.FamilyList),
  },
  {
    path: 'family/:id',
    title: 'Family member · Waldrick Medical',
    loadComponent: () => import('./features/family/family-detail').then((m) => m.FamilyDetail),
  },
  {
    path: 'schedule',
    title: 'Schedule · Waldrick Medical',
    loadComponent: () => import('./features/schedule/schedule-page').then((m) => m.SchedulePage),
  },
  {
    path: 'documents',
    title: 'Documents · Waldrick Medical',
    loadComponent: () => import('./features/documents/documents-page').then((m) => m.DocumentsPage),
  },
  {
    path: 'alerts',
    title: 'Alerts · Waldrick Medical',
    loadComponent: () => import('./features/alerts/alerts-page').then((m) => m.AlertsPage),
  },
  {
    path: 'settings',
    title: 'Settings · Waldrick Medical',
    loadComponent: () => import('./features/settings/settings-page').then((m) => m.SettingsPage),
  },
  { path: '**', redirectTo: 'dashboard' },
];
