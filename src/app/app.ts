import { Component, inject, signal } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { catchError, of } from 'rxjs';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { ApiService } from './core/api.service';

interface NavItem {
  path: string;
  label: string;
  icon: string;
}

@Component({
  selector: 'app-root',
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    MatToolbarModule,
    MatSidenavModule,
    MatListModule,
    MatIconModule,
    MatButtonModule,
    MatMenuModule,
  ],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  private api = inject(ApiService);

  protected readonly nav: NavItem[] = [
    { path: '/dashboard', label: 'Dashboard', icon: 'dashboard' },
    { path: '/family', label: 'Family', icon: 'groups' },
    { path: '/schedule', label: 'Schedule', icon: 'event' },
    { path: '/documents', label: 'Documents', icon: 'folder' },
    { path: '/alerts', label: 'Alerts', icon: 'notifications' },
    { path: '/settings', label: 'Settings', icon: 'settings' },
  ];

  protected readonly opened = signal(true);

  protected readonly identity = toSignal(
    this.api.me().pipe(catchError(() => of({ email: '' }))),
    { initialValue: { email: '' } },
  );

  protected toggle(): void {
    this.opened.update((v) => !v);
  }
}
